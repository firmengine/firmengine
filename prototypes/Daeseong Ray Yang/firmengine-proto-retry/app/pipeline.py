"""Evidence-only page extraction and the shared n8n/Node calculation boundary."""
from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any

import fitz
import httpx

from . import ai

ROOT = Path(__file__).resolve().parents[1]
DOCUMENT_FEATURES = {
    "identity": ["applicant_name", "birth_date", "address", "registration_number"],
    "family": ["applicant_name", "family_member", "relationship", "birth_date", "address"],
    "business_registration": ["applicant_name", "business_name", "business_number", "business_address", "business_type", "tax_type", "opening_date"],
    "tax": ["applicant_name", "business_number", "tax_period", "gross_revenue", "taxable_income", "tax_amount", "arrears", "due_date", "tax_type"],
    "bank_statement": ["account_number", "account_holder", "transaction_date", "deposit_amount", "withdrawal_amount", "balance", "counterparty", "description"],
    "debt_certificate": ["creditor_name", "contract_id", "account_number", "principal", "interest", "debt_reference_date", "security", "priority", "arrears"],
    "property": ["asset_name", "address", "area", "ownership_share", "market_value", "secured_balance", "valuation_date", "valuation_source"],
    "vehicle": ["vehicle_number", "vehicle_model", "model_year", "ownership_share", "market_value", "secured_balance", "valuation_date", "valuation_source"],
    "salary": ["employer", "employee_name", "period_start", "period_end", "monthly_gross", "monthly_expense", "net_salary", "deduction_amount"],
    "business_income": ["business_name", "business_number", "period_start", "period_end", "monthly_gross", "monthly_expense", "net_business_income", "expense_type"],
    "other_income": ["income_source", "income_kind", "period_start", "period_end", "gross_amount", "deduction_amount", "net_amount", "recurrence"],
    "statement": ["applicant_name", "debt_cause", "statement", "past_proceeding", "event_date"],
    "unknown": [],
}


def _object(properties: dict[str, Any]) -> dict[str, Any]:
    return {"type": "object", "properties": properties, "required": list(properties), "additionalProperties": False}


STRING = {"type": "string"}
CLASSIFY_SCHEMA = _object({
    "document_type": {"type": "string", "enum": list(DOCUMENT_FEATURES)},
    "role": {"type": "string", "enum": ["evidence", "evaluation", "administrative", "unknown"]},
    "reason": STRING, "readable": {"type": "boolean"},
})
FACT_SCHEMA = _object({"key": STRING, "label": STRING, "value": STRING, "unit": STRING,
                       "quote": STRING, "object_ref": STRING, "period_start": STRING, "period_end": STRING})
EXTRACT_SCHEMA = _object({
    "facts": {"type": "array", "items": FACT_SCHEMA},
    "missing": {"type": "array", "items": STRING},
    "unreadable": {"type": "array", "items": STRING},
})


def _canonical_type(value: str) -> str:
    aliases = {"급여명세서":"salary", "사업자등록증":"business_registration", "소득금액증명":"tax",
               "부가가치세과세표준증명":"tax", "통장거래내역":"bank_statement", "주민등록등본":"identity",
               "주민등록초본":"identity", "가족관계증명서":"family", "부채증명서":"debt_certificate",
               "자동차등록원부":"vehicle", "등기사항증명서":"property", "사업소득자료":"business_income",
               "진술서":"statement", "bank":"bank_statement", "debt":"debt_certificate", "income":"business_income"}
    return value if value in DOCUMENT_FEATURES else aliases.get(value, "unknown")


def _safe_text_page(page: fitz.Page) -> tuple[str, str | None]:
    text = page.get_text("text")[:18000]
    # Text PDFs use text only. Scanned/garbled pages receive a page image.
    visible = re.sub(r"[\s\ufffd\x00]", "", text)
    image_url = None
    if len(visible) < 80:
        pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
        image_url = "data:image/png;base64," + base64.b64encode(pixmap.tobytes("png")).decode("ascii")
    return text, image_url


def _page_records(path: Path, document: dict[str, Any]) -> list[dict[str, Any]]:
    mapped = {int(p["page"]): p for p in document.get("pages", []) if str(p.get("page", "")).isdigit()}
    with fitz.open(path) as pdf:
        if pdf.is_pdf:
            count = len(pdf)
            records = []
            for index in range(count):
                mapping = mapped.get(index + 1, {})
                role = mapping.get("role", document.get("role", "unknown"))
                record = {"page": int(mapping.get("original_page", index + 1)), "physical_page":index+1, "role": role,
                          "document_type": _canonical_type(mapping.get("document_type", document.get("document_type", "unknown"))),
                          "text": "", "image_url": None}
                # Never even read excluded pages into generation text/image buffers.
                if role == "evidence":
                    record["text"], record["image_url"] = _safe_text_page(pdf[index])
                records.append(record)
            return records
        # PyMuPDF's image document is converted to a one-page in-memory PDF.
        role = mapped.get(1, {}).get("role", document.get("role", "unknown"))
        if role != "evidence":
            return [{"page":int(mapped.get(1,{}).get("original_page",1)),"physical_page":1,"role":role,"document_type":_canonical_type(document.get("document_type", "unknown")),"text":"","image_url":None}]
        with fitz.open("pdf", pdf.convert_to_pdf()) as converted:
            text, image_url = _safe_text_page(converted[0])
            return [{"page":int(mapped.get(1,{}).get("original_page",1)),"physical_page":1,"role":role,"document_type":_canonical_type(document.get("document_type", "unknown")),"text":text,"image_url":image_url}]


def _normalise_value(key: str, value: str, unit: str) -> Any:
    # Identifier fields remain strings, preserving initial zeros and precision.
    money_keys = {"gross_revenue", "taxable_income", "tax_amount", "arrears", "deposit_amount", "withdrawal_amount", "balance", "principal", "interest", "market_value", "secured_balance", "monthly_gross", "monthly_expense", "net_salary", "deduction_amount", "net_business_income", "gross_amount", "net_amount"}
    if key in money_keys:
        cleaned = re.sub(r"[,\s원]", "", value)
        if re.fullmatch(r"\d+", cleaned):
            return int(cleaned) * (1000 if unit in ("천원", "KRW_THOUSAND") else 1)
    return str(value)


async def extract_document(path: Path, document: dict[str, Any], case: dict[str, Any], progress_callback=None) -> dict[str, Any]:
    result: dict[str, Any] = {"facts": [], "logical_documents": [], "warnings": [], "calls": [],
                              "entities": {"incomes": [], "creditors": [], "assets": [], "transactions": []}}
    if document.get("role", "unknown") != "evidence" and not any(p.get("role") == "evidence" for p in document.get("pages", [])):
        result["warnings"].append("평가·행정·미분류 자료는 생성 입력과 추출에서 제외했습니다. 증빙 페이지를 명시적으로 매핑하세요.")
        return result
    try:
        pages = await asyncio.to_thread(_page_records, Path(path), document)
    except Exception as exc:
        result["warnings"].append(f"파일을 읽지 못했습니다 ({type(exc).__name__}). 원본을 확인하거나 다시 제출하세요.")
        return result
    if document.get("only_pages") is not None:
        selected={int(page) for page in document["only_pages"]}
        pages=[page for page in pages if page["physical_page"] in selected]
    configured = ai.status()["configured"]
    task_limit = max(1, min(8, int(os.getenv("FIRMENGINE_PAGE_CONCURRENCY", "2"))))
    page_limit = max(1, int(os.getenv("FIRMENGINE_MAX_PAGES", "200")))
    semaphore = asyncio.Semaphore(task_limit)
    # A source/prompt/model-addressed private cache reuses only successful pages.
    # It never reads other cases, evaluator data, or previously generated forms.
    source_hash = hashlib.sha256(Path(path).read_bytes()).hexdigest()
    case_key = hashlib.sha256(str(case.get("id", "unassigned")).encode()).hexdigest()[:24]
    document_key = hashlib.sha256((str(document["id"])+source_hash).encode()).hexdigest()[:32]
    cache_root = ROOT/".local"/"extraction_cache"/case_key/document_key
    cache_root.mkdir(parents=True,exist_ok=True)
    prompt_version = {name:ai.read_prompt(name)["sha256"] for name in ("classify","extract")}
    model = ai.status()["model"]

    async def process(record: dict[str, Any]):
        output = {"facts": [], "calls": [], "warnings": []}
        logical = {"document_id":document["id"],"page":record["page"],"original_page":record["page"],"physical_page":record["physical_page"],
                   "role":record["role"],"document_type":record["document_type"],"status":"excluded"}
        output["logical"] = logical
        if record["role"] != "evidence":
            return output
        if record["physical_page"] > page_limit:
            logical["status"] = "pending"
            output["warnings"].append(f"{record['page']}쪽: 실행당 페이지 한도({page_limit}) 이후이므로 처리 대기입니다. 한도를 조정해 다시 실행하세요.")
            return output
        if not configured:
            logical.update({"status":"manual_review","text_excerpt":record["text"][:2000],"features_required":DOCUMENT_FEATURES[record["document_type"]]})
            output["warnings"].append(f"{record['page']}쪽: API 키 미설정으로 문자층만 읽었습니다. AI/OCR 추출은 수행하지 않았습니다.")
            return output
        async with semaphore:
            payload = {"document_id":document["id"], "original_page":record["page"],
                       "document_type":record["document_type"],"text":record["text"],
                       "period_start":document.get("period_start", ""),"period_end":document.get("period_end", "")}
            try:
                if record["document_type"] == "unknown":
                    classification, audit = await ai.call_agent("classify", payload, CLASSIFY_SCHEMA, record["image_url"])
                    output["calls"].append(audit)
                    logical.update({"document_type":classification["document_type"], "role":classification["role"],
                                    "classification_reason":classification["reason"]})
                    if classification["role"] != "evidence":
                        logical["status"] = "mapping_review"
                        output["warnings"].append(f"{record['page']}쪽: {classification['role']}로 분류되어 생성·추출에서 제외했습니다. {classification['reason']}")
                        return output
                    if not classification["readable"]:
                        logical["status"] = "unreadable"
                        output["warnings"].append(f"{record['page']}쪽: 판독 불가. 더 선명한 원본이 필요합니다.")
                        return output
                features = DOCUMENT_FEATURES.get(logical["document_type"], [])
                logical["features_required"] = features
                if not features:
                    logical["status"] = "mapping_review"
                    output["warnings"].append(f"{record['page']}쪽: 문서 유형·추출 규칙 매핑이 필요합니다.")
                    return output
                payload.update({"document_type":logical["document_type"], "features":features})
                extracted, audit = await ai.call_agent("extract", payload, EXTRACT_SCHEMA, record["image_url"])
                output["calls"].append(audit)
                missing = extracted.get("missing", [])
                # Retry only the missing keys once, using the same page. Never inject global facts.
                if missing and len(missing) <= 5 and os.getenv("FIRMENGINE_REEXTRACT_MISSING", "1") == "1":
                    retry_payload = {**payload,"features":[key for key in missing if key in features],"retry_scope":"없는 값은 missing으로 유지; 다른 페이지나 사건 사실을 추측하지 말 것"}
                    if retry_payload["features"]:
                        retried, retry_audit = await ai.call_agent("extract", retry_payload, EXTRACT_SCHEMA, record["image_url"])
                        output["calls"].append(retry_audit)
                        known = {(f["key"],f["object_ref"],f["value"]) for f in extracted["facts"]}
                        extracted["facts"].extend(f for f in retried["facts"] if (f["key"],f["object_ref"],f["value"]) not in known)
                        found = {f["key"] for f in extracted["facts"]}
                        missing = [key for key in missing if key not in found]
                for index, item in enumerate(extracted["facts"]):
                    if item["key"] not in features or not item["value"].strip():
                        continue
                    quote = item["quote"].strip()
                    text_normal = re.sub(r"\s", "", record["text"])
                    quote_verified = bool(quote) and bool(text_normal) and re.sub(r"\s", "", quote) in text_normal
                    # Images require visual provenance confirmation. A model confidence is not legal approval.
                    status = "candidate"
                    reason = "원문 문자층 인용 대응 확인; 담당자 채택 대기" if quote_verified else "원문 위치·인용을 담당자가 대조해야 합니다."
                    object_ref = item["object_ref"] or f"page-{record['page']}-row-{index+1}"
                    identity = f"{document['id']}:{record['page']}:{object_ref}:{item['key']}:{item['value']}"
                    output["facts"].append({
                        "id":hashlib.sha256(identity.encode()).hexdigest()[:32],"key":item["key"],"label":item["label"],
                        "value":_normalise_value(item["key"],item["value"],item["unit"]),"raw_value":item["value"],"raw_unit":item["unit"],
                        "unit":"원" if item["unit"] in ("천원","KRW_THOUSAND") else item["unit"],
                        "status":status,"document_id":document["id"],"page":record["page"],"physical_page":record["physical_page"],"quote":quote,
                        "object_id":f"{document['id']}:{record['page']}:{object_ref}","period_start":item["period_start"],"period_end":item["period_end"],
                        "reason":reason,"verification":{"page_present":True,"quote_verified":quote_verified,"visual_review_required":bool(record["image_url"]),"legal_recognition":False},
                    })
                logical.update({"status":"extracted","missing_features":missing,"unreadable_features":extracted["unreadable"],"feature_count":len(output["facts"])})
                if missing:
                    output["warnings"].append(f"{record['page']}쪽 누락: {', '.join(missing)}")
                if extracted["unreadable"]:
                    output["warnings"].append(f"{record['page']}쪽 판독 불가: {', '.join(extracted['unreadable'])}")
            except Exception as exc:
                logical["status"] = "failed"
                output["warnings"].append(f"{record['page']}쪽: {str(exc) if isinstance(exc, RuntimeError) else type(exc).__name__}")
                if hasattr(exc, "audit"):
                    output["calls"].append(exc.audit)
            return output

    progress={"completed_pages":0,"total_pages":len(pages),"candidate_facts":0,"cache_hits":0}
    def notify_progress(output):
        progress["completed_pages"]+=1
        progress["candidate_facts"]+=len(output.get("facts",[]))
        progress["cache_hits"]+=int(bool(output["logical"].get("cache_hit")))
        if progress_callback:
            progress_callback({**progress,"last_status":output["logical"]["status"]})

    async def cached_process(record: dict[str,Any]):
        cache_identity = {"source":source_hash,"page":record["page"],"physical_page":record["physical_page"],"role":record["role"],"document_type":record["document_type"],"prompt":prompt_version,"model":model,"features":DOCUMENT_FEATURES,"period_start":document.get("period_start"),"period_end":document.get("period_end")}
        cache_name = hashlib.sha256(json.dumps(cache_identity,sort_keys=True,ensure_ascii=False).encode()).hexdigest()+".json"
        cache_file = cache_root/cache_name
        if cache_file.is_file():
            try:
                cached=json.loads(cache_file.read_text(encoding="utf-8"))
                cached["logical"]["cache_hit"]=True
                for call in cached.get("calls",[]):
                    call["cache_hit"]=True
                notify_progress(cached)
                return cached
            except (OSError,ValueError,KeyError):
                pass
        output=await process(record)
        if output["logical"]["status"] in ("extracted","excluded","mapping_review","unreadable"):
            temp_file=cache_file.with_suffix(".tmp")
            temp_file.write_text(json.dumps(output,ensure_ascii=False),encoding="utf-8")
            temp_file.replace(cache_file)
        notify_progress(output)
        return output

    outcomes = await asyncio.gather(*(cached_process(record) for record in pages))
    for output in outcomes:
        for key in ("facts", "calls", "warnings"):
            result[key].extend(output[key])
        result["logical_documents"].append(output["logical"])
    # Different object IDs never merge by shared creditor/employer/counterparty name.
    grouped: dict[str, dict[str, Any]] = {}
    for fact in result["facts"]:
        group = grouped.setdefault(fact["object_id"], {"_facts":[],"id":hashlib.sha256(fact["object_id"].encode()).hexdigest()[:32]})
        group[fact["key"]] = fact["value"]
        group["_facts"].append(fact)
    for group in grouped.values():
        first = group["_facts"][0]
        source = {"id":group["id"],"confirmed":False,"source_document_id":document["id"],"source_object_id":first["object_id"],"source_page":first["page"],"source_quote":first["quote"],"reason":"AI 추출 후보 — 원자료·기간·법적 인정값 확인 필요"}
        if "principal" in group or "creditor_name" in group:
            result["entities"]["creditors"].append({**source,"name":group.get("creditor_name", "채권자 확인 필요"),"contract_id":str(group.get("contract_id", group.get("account_number", ""))),"principal":group.get("principal"),"interest":group.get("interest"),"security":group.get("security", "unknown"),"priority":group.get("priority", "unknown"),"disputed":False})
        elif "monthly_gross" in group:
            result["entities"]["incomes"].append({**source,"label":group.get("business_name",group.get("employer", "소득원 확인 필요")),"kind":"salary" if "employer" in group else "business","monthly_gross":group.get("monthly_gross"),"monthly_expense":group.get("monthly_expense"),"period_start":first.get("period_start") or document.get("period_start", ""),"period_end":first.get("period_end") or document.get("period_end", "")})
        elif "market_value" in group or "vehicle_number" in group:
            result["entities"]["assets"].append({**source,"label":group.get("asset_name",group.get("vehicle_number",group.get("address", "재산 확인 필요"))),"kind":"vehicle" if "vehicle_number" in group else "property","market_value":group.get("market_value"),"secured_balance":group.get("secured_balance"),"exempt_amount":None,"valuation_source":group.get("valuation_source",document.get("filename", "업로드 원본")),"valuation_date":group.get("valuation_date", "")})
        elif "withdrawal_amount" in group or "deposit_amount" in group:
            withdrawal = group.get("withdrawal_amount")
            result["entities"]["transactions"].append({**source,"date":group.get("transaction_date", ""),"account":str(group.get("account_number", "")),"amount":withdrawal if withdrawal is not None else group.get("deposit_amount"),"direction":"withdrawal" if withdrawal is not None else "deposit","counterparty":group.get("counterparty", ""),"purpose":group.get("description", ""),"resolved":False})
    result["warnings"] = list(dict.fromkeys(result["warnings"]))
    return result


def _n8n_base() -> str:
    return os.getenv("FIRMENGINE_N8N_URL", "http://127.0.0.1:5681").rstrip("/")


async def runtime_status() -> dict[str, Any]:
    result = {"alive":False,"ready":False,"webhook_registered":False,"mode":"local-node", "url":_n8n_base()}
    try:
        async with httpx.AsyncClient(timeout=1.5, trust_env=False) as client:
            alive = await client.get(_n8n_base()+"/healthz")
            result["alive"] = alive.is_success
            ready = await client.get(_n8n_base()+"/healthz/readiness")
            result["ready"] = ready.is_success
            if result["ready"]:
                # Empty input is a pure calculation health probe. No case data is sent.
                response = await client.post(_n8n_base()+"/webhook/firmengine-retry/calculate",json={})
                result["webhook_registered"] = response.is_success and isinstance(response.json(),dict) and response.json().get("engine") == "n8n-code"
                if result["webhook_registered"]:
                    result["mode"] = "n8n-code"
    except (httpx.HTTPError, ValueError):
        pass
    return result


async def calculate(case: dict[str, Any]) -> dict[str, Any]:
    # Scope to approved numeric inputs. No entire case narrative/document content in n8n.
    fields = ("id","revision","incomes","creditors","assets","assets_declared","living_cost","deductions","repayment_months","period_start","period_end","rule_approved","rule_version","is_demo")
    payload = {key:case.get(key) for key in fields}
    state = await runtime_status()
    if state["webhook_registered"]:
        async with httpx.AsyncClient(timeout=30, trust_env=False) as client:
            response = await client.post(_n8n_base()+"/webhook/firmengine-retry/calculate",json=payload)
            response.raise_for_status()
            result = response.json()
            result["engine"] = "n8n-code"
            expected_hash = hashlib.sha256((ROOT/"workflows"/"calculators.js").read_bytes()).hexdigest()
            if result.get("code_sha256") != expected_hash:
                raise RuntimeError("n8n 계산 코드 판본이 현재 파일과 다릅니다. n8n을 중지하고 run_n8n.py로 다시 가져오기·게시하세요.")
            return result
    process = await asyncio.create_subprocess_exec("node",str(ROOT/"workflows"/"calculators.js"),stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
    try:
        stdout, stderr = await asyncio.wait_for(process.communicate(json.dumps(payload,ensure_ascii=False).encode()),timeout=15)
    except asyncio.TimeoutError:
        process.kill()
        await process.wait()
        raise RuntimeError("계산 실행 제한시간을 초과했습니다.") from None
    if process.returncode:
        raise RuntimeError("결정론적 계산을 완료하지 못했습니다. 입력 금액·기간을 확인하세요.")
    result = json.loads(stdout)
    result["engine"] = "local-node"
    result["code_sha256"] = hashlib.sha256((ROOT/"workflows"/"calculators.js").read_bytes()).hexdigest()
    result["warnings"].append("n8n Webhook 미준비: 동일 코드를 로컬 Node로 실행했습니다. n8n 실행 검증과 구분합니다.")
    return result
