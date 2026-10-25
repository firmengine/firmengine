"""Rebuild editable template assets using this directory's public reference forms.

Development-time utility only. No external project is needed for rebuilding.
Changing a template changes its hash and requires a new review of the mapping.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt


ROOT = Path(__file__).resolve().parent
VERSION = "public-form-editable-reconstruction-v1"


def token(key):
    return "{{" + key + "}}"


def start(code, title):
    doc = Document()
    section = doc.sections[0]
    section.page_width, section.page_height = Cm(21), Cm(29.7)
    section.top_margin = section.bottom_margin = Cm(1.8)
    section.left_margin = section.right_margin = Cm(1.9)
    for name in ["Normal", "Heading 1", "Heading 2", "Heading 3"]:
        style = doc.styles[name]
        style.font.name = "맑은 고딕"
        style.font.size = Pt(10 if name == "Normal" else 12)
        style.element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), "맑은 고딕")
    doc.styles["Normal"].paragraph_format.space_after = Pt(5)
    section.header.paragraphs[0].text = f"{code}  |  {token('review_status')}  |  버전 {token('revision')}"
    section.header.paragraphs[0].runs[0].font.size = Pt(8)
    footer = section.footer.paragraphs[0]
    footer.text = "공식 양식 항목의 편집형 재구성 · 서명·동의 별도 확인  |  "
    field = OxmlElement("w:fldSimple")
    field.set(qn("w:instr"), "PAGE")
    footer._p.append(field)
    footer.runs[0].font.size = Pt(8)
    heading = doc.add_heading(title, level=0)
    heading.alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph("공식 원본의 구역·항목을 DOCX로 재구성한 초안입니다. 원본과 동일한 페이지 배치는 아니며, 제공 양식과의 대응 검토가 필요합니다.")
    return doc


def table(doc, headers, rows):
    tab = doc.add_table(rows=1, cols=len(headers))
    tab.style = "Table Grid"
    for cell, value in zip(tab.rows[0].cells, headers):
        cell.text = value
    props = tab.rows[0]._tr.get_or_add_trPr()
    props.append(OxmlElement("w:tblHeader"))
    for values in rows:
        for cell, value in zip(tab.add_row().cells, values):
            cell.text = value
    doc.add_paragraph("")
    return tab


def fields(doc, rows):
    return table(doc, ["항목", "기재 내용"], [[label, token(key)] for label, key in rows])


def section(doc, title, rows):
    doc.add_heading(title, level=1)
    fields(doc, rows)


def sign(doc):
    doc.add_paragraph("작성일: " + token("application_date"))
    doc.add_paragraph("신청인 / 채무자: " + token("client_name") + "    (서명 또는 날인: __________________)")
    doc.add_paragraph(token("court_name") + " 귀중")


def application():
    doc = start("D5100", "개인회생절차 개시신청서")
    section(doc, "신청인", [("성명", "client_name"), ("주민등록번호", "resident_id"),
        ("주민등록상 주소", "registered_address"), ("현주소", "address"),
        ("송달장소", "service_address"), ("휴대전화", "phone")])
    section(doc, "대리인", [("성명", "lawyer_name"), ("사무실 주소", "lawyer_address"),
        ("전화번호", "lawyer_phone"), ("이메일", "lawyer_email")])
    section(doc, "관련 사건", [("주채무자·보증인·연대채무자·배우자의 관련 사건", "related_cases")])
    doc.add_heading("신청취지", level=1)
    doc.add_paragraph("「신청인에 대하여 개인회생절차를 개시한다.」라는 결정을 구합니다.")
    section(doc, "신청이유 및 수입 상황", [("사업장명", "business_name"), ("업종", "business_type"),
        ("사업자등록번호", "business_registration"), ("사건 경위", "statement")])
    doc.add_paragraph("정기·반복 수입, 지급곤란 및 기각사유 해당 여부는 담당자·변호사가 검토합니다. 해당 선택란을 자동으로 확인하지 않습니다.")
    section(doc, "변제예정 및 적립금 반환계좌", [("변제기간(개월)", "repayment_months"),
        ("월 변제예정액", "monthly_payment"), ("첫 납입일", "repayment_start_date"),
        ("매월 납입일", "repayment_day"), ("반환은행", "refund_bank"), ("반환계좌", "refund_account")])
    doc.add_heading("첨부서류", level=1)
    for label in ["개인회생채권자목록", "재산목록", "수입 및 지출에 관한 목록", "진술서", "예금계좌 사본", "위임장 및 비용납부 관련 자료"]:
        doc.add_paragraph("☐ " + label + " (실제 첨부 여부 확인)")
    sign(doc)
    doc.add_heading("휴대전화를 통한 정보수신 신청", level=1)
    doc.add_paragraph("☐ 신청 여부 별도 확인    휴대전화: " + token("phone"))
    doc.add_paragraph("신청인: __________________ (서명 또는 날인)")
    return doc


def creditors():
    doc = start("D5106", "개인회생채권자목록")
    section(doc, "작성 기준", [("채권현재액 산정기준일", "debt_as_of"), ("목록 작성일", "application_date"),
        ("원금 합계", "total_principal"), ("이자 합계", "total_interest"),
        ("담보부 회생채권액 합계", "secured_debt_total"), ("무담보 회생채권액 합계", "unsecured_debt_total")])
    doc.add_heading("채권자별 내역", level=1)
    table(doc, ["채권자 / 기준기간", "원금", "이자", "주소 / 발생원인"], [[
        "{{creditor.entity}}\n{{creditor.period}}", "{{creditor.principal}}", "{{creditor.interest}}",
        "{{creditor.address}}\n발생원인: {{creditor.cause}}"]])
    doc.add_paragraph("동일 채권자의 서로 다른 기간·계약은 자동 합산하지 않습니다. 채권 순위·동일성·담보 분류는 별도 검토합니다.")
    section(doc, "부속서류 1. 별제권부채권 및 이에 준하는 채권", [("해당 여부·목적물·예상 변제액·담보부족액", "secured_claim_details")])
    section(doc, "부속서류 2. 다툼이 있거나 예상되는 채권", [("채권번호·주장액·다툼 없는 부분·차이·소송경과", "disputed_claim_details")])
    section(doc, "부속서류 3. 전부명령", [("채권자·채권내용·전부명령 내역", "assignment_order_details")])
    section(doc, "부속서류 4. 기타", [("보증채무·제3자 담보 등 기타 내역", "other_claim_details")])
    sign(doc)
    return doc


def assets():
    doc = start("D5101", "재산목록")
    fields(doc, [("현금", "cash"), ("예금", "bank_balance"), ("보험 해약환급금", "insurance_surrender"),
        ("자동차", "vehicle_value"), ("임차보증금 반환채권", "housing_deposit"), ("부동산", "real_estate_value"),
        ("대여금 채권", "loan_receivables"), ("매출금 채권", "trade_receivables"), ("예상퇴직금", "retirement_value"),
        ("기타 재산", "other_assets"), ("재산 합계", "assets_total"), ("면제재산 신청금액", "exempt_value"),
        ("청산가치", "liquidation_value")])
    doc.add_heading("재산별 명세", level=1)
    table(doc, ["재산 / 기준기간", "가액", "상세명세"], [["{{asset.entity}}\n{{asset.period}}", "{{asset.value}}", "{{asset.description}}"]])
    doc.add_paragraph("증빙의 원금·가액을 청산가치로 자동 인정하지 않습니다. 평가기준일, 담보, 면제·공제 및 중복 계상을 확인해야 합니다.")
    sign(doc)
    return doc


def income():
    doc = start("D5103", "수입 및 지출에 관한 목록")
    section(doc, "I. 현재의 수입 목록 — 영업소득", [("상호 / 사업장명", "business_name"), ("업종", "business_type"),
        ("과세유형", "tax_type"), ("사업자등록번호", "business_registration"), ("사업장 주소", "business_address"),
        ("개업일", "opening_date"), ("소득 귀속연도", "income_year"), ("연간 매출(증빙)", "annual_revenue"),
        ("연간 경비(증빙)", "annual_expenses"), ("연간 사업소득(증빙)", "annual_business_income"),
        ("월평균 소득(담당자 인정값)", "approved_monthly_income"), ("검토된 사업소득 계산", "monthly_business_income")])
    doc.add_heading("월별 매출 및 사업경비 근거", level=2)
    table(doc, ["대상 월 / 자료기간", "매출", "사업경비"], [["{{month.entity}}\n{{month.period}}", "{{month.revenue}}", "{{month.expense}}"]])
    section(doc, "II. 변제계획 수행 시의 예상 지출 목록", [("인정 가구원수", "household_size"),
        ("인정 생계비", "recognized_living_cost"), ("주거비", "housing_cost"), ("의료비", "medical_cost"),
        ("교육비", "education_cost"), ("추가 생계비 사유", "additional_living_reason")])
    doc.add_paragraph("생계비 비율과 추가 인정 여부의 선택란은 자동 선택하지 않습니다.")
    section(doc, "III. 가족관계", [("관계·동거·직업·월수입·재산·부양 여부", "family_details")])
    sign(doc)
    return doc


def statement():
    doc = start("D5105", "진술서")
    section(doc, "I. 경력", [("최종 학력", "education"), ("사업장명", "business_name"),
        ("업종", "business_type"), ("개업일", "opening_date"), ("과거 경력", "career_history"),
        ("과거 결혼·이혼 경력", "marriage_history")])
    section(doc, "II. 현재 주거 상황", [("주소", "address"), ("거주 시작일", "residence_start"),
        ("거주 형태", "housing_type"), ("임차보증금", "housing_deposit"), ("월 임대료", "housing_cost")])
    section(doc, "III. 부채 상황", [("소송·지급명령·전부명령·압류 등", "enforcement_history")])
    doc.add_heading("많은 채무를 부담하게 된 사정 및 신청에 이르게 된 사정", level=2)
    doc.add_paragraph(token("statement"))
    doc.add_paragraph("위 문장은 연결된 진술·증빙 범위에서 작성된 초안입니다. 확인되지 않은 생활·사업 경위는 담당자가 보완합니다.")
    section(doc, "IV. 과거 면책절차 등의 이용 상황", [("절차·법원 또는 기관·신청시기·진행상황", "prior_proceedings")])
    sign(doc)
    return doc


def plan():
    doc = start("D5110", "변제계획안")
    doc.add_paragraph("원본 유형: 가용소득만으로 변제하는 경우. 해당 유형의 적합성은 변호사가 확인합니다.")
    section(doc, "변제계획안 제출서", [("사건번호", "case_number"), ("채무자", "client_name"), ("대리인", "lawyer_name")])
    doc.add_paragraph("채무자는 별지와 같이 변제계획안을 작성하여 제출하니 인가하여 주시기 바랍니다.")
    section(doc, "1. 변제기간", [("시작일", "repayment_start_date"), ("종료일", "repayment_end_date"), ("변제 개월 수", "repayment_months")])
    section(doc, "2. 변제에 제공되는 소득 또는 재산", [("운영 사업장", "business_name"),
        ("월평균 수입(인정값)", "approved_monthly_income"), ("채무자 및 피부양자 수", "household_size"),
        ("인정 생계비", "recognized_living_cost"), ("월평균 가용소득", "monthly_disposable_income"),
        ("월 회생위원 보수", "monthly_trustee_fee"), ("월 실제 변제예정액", "monthly_payment"),
        ("총 변제예정액", "total_repayment"), ("재산 처분 여부·내역", "asset_disposal_plan")])
    section(doc, "3. 개인회생재단채권에 대한 변제", [("회생위원 보수·비용 및 기타 재단채권", "estate_claim_plan")])
    section(doc, "4. 일반의 우선권 있는 개인회생채권", [("채권내용·우선권 근거·변제방법", "priority_claim_plan")])
    section(doc, "5. 별제권부 채권 및 이에 준하는 채권", [("채권내용·별제권 목적물·변제방법", "secured_claim_details")])
    section(doc, "6. 일반 개인회생채권에 대한 변제", [("월 변제예정액", "monthly_payment"),
        ("총 변제예정액", "total_repayment"), ("변제일·회차·방법", "payment_schedule_details")])
    section(doc, "7. 미확정 개인회생채권에 대한 조치", [("유보·확정 후 변제방법", "unconfirmed_claim_plan")])
    section(doc, "8. 변제금원의 회생위원에 대한 임치 및 지급", [("회생위원 예금계좌·지급방법", "trustee_payment_details")])
    doc.add_paragraph("회생위원 계좌는 확인된 경우에만 기재합니다. 임의의 계좌를 생성하지 않습니다.")
    section(doc, "9. 면책의 범위 및 효력발생시기", [("해당 법률·예외·개별 조건 검토", "discharge_clause_review")])
    section(doc, "10. 기타 사항", [("별도 기재사항", "plan_other_details")])
    doc.add_heading("개인회생채권 변제예정액표", level=1)
    table(doc, ["채권자 / 기준기간", "확인 원금", "월 변제예정액", "총 변제예정액"], [[
        "{{creditor.entity}}\n{{creditor.period}}", "{{creditor.principal}}", "{{creditor.monthly_payment}}", "{{creditor.total_payment}}"]])
    doc.add_paragraph("채권자별 배분·우선권·미확정채권 유보는 별도 확인이 필요합니다. 총액만으로 임의 안분하지 않습니다.")
    fields(doc, [("변제율(%)", "repayment_rate"), ("청산가치", "liquidation_value"),
        ("총 변제예정액", "total_repayment"), ("현재가치(동일 기준일 검토)", "present_value")])
    sign(doc)
    return doc


def build():
    ROOT.mkdir(exist_ok=True)
    (ROOT / "originals").mkdir(exist_ok=True)
    # The copied, hash-pinned public originals and catalog are the authoring
    # source. Rebuilding remains possible after the external references are removed.
    existing = json.loads((ROOT / "catalog.json").read_text(encoding="utf-8"))
    sources = {(form["code"], Path(source["path"]).suffix.lstrip(".")): source
               for form in existing["forms"] for source in form["originals"]}
    constructors = [
        ("D5100", "application", "개인회생절차 개시신청서", application),
        ("D5106", "creditors", "개인회생채권자목록", creditors),
        ("D5101", "assets", "재산목록", assets),
        ("D5103", "income_expense", "수입 및 지출에 관한 목록", income),
        ("D5105", "statement", "진술서", statement),
        ("D5110", "repayment_plan", "변제계획안", plan),
    ]
    import re
    forms = []
    for code, kind, title, constructor in constructors:
        original_rows = []
        for extension in ["pdf", "hwp"]:
            source = sources[(code, extension)]
            data = (ROOT / source["path"]).read_bytes()
            digest = hashlib.sha256(data).hexdigest()
            if digest != source["sha256"]:
                raise ValueError("Original source hash mismatch: " + code)
            relative = f"originals/{code}.{extension}"
            (ROOT / relative).write_bytes(data)
            original_rows.append({"path": relative, "title": source["title"], "sha256": digest,
                "url": source["url"], "retrieved_at": source["retrieved_at"]})
        doc = constructor()
        filename = code + ".docx"
        doc.save(ROOT / filename)
        texts = [p.text for p in doc.paragraphs]
        texts.extend(cell.text for table in doc.tables for row in table.rows for cell in row.cells)
        tokens = sorted(set(re.findall(r"\{\{([a-zA-Z0-9_.-]+)\}\}", "\n".join(texts))))
        record_keys = [key for key in tokens if "." not in key]
        group_keys = {
            "creditor": ["creditor_principal", "creditor_interest", "creditor_address", "creditor_cause", "creditor_phone"],
            "asset": ["asset_value", "asset_description"], "month": ["monthly_revenue", "monthly_expense"],
        }
        for prefix, keys in group_keys.items():
            if any(key.startswith(prefix + ".") for key in tokens):
                record_keys.extend(keys)
        # Provenance includes the extraction candidates used for recognized income.
        if code in ["D5103", "D5110"]:
            record_keys.extend(["monthly_income", "monthly_revenue", "monthly_expense"])
        calc_keys = ["debt_principal_total", "debt_interest_total", "monthly_business_income",
                     "monthly_disposable_income", "monthly_payment", "total_repayment", "repayment_rate"]
        forms.append({"code": code, "kind": kind, "title": title, "template_version": VERSION,
            "template": {"path": filename, "sha256": hashlib.sha256((ROOT / filename).read_bytes()).hexdigest()},
            "originals": original_rows, "record_keys": sorted(set(record_keys)),
            "calculation_keys": calc_keys, "mapped_tokens": tokens,
            "approval_status": "reviewer_pending", "reconstruction": True,
            "limitations": "Editable reconstruction of official section/field structure, not a pixel-exact HWP conversion. Missing and unsupported fields remain explicit. Court/date applicability and field mapping require expert approval."})
    catalog = {"version": VERSION, "created_on": "2026-10-26", "jurisdiction": "national_common_reference",
        "source_snapshot": "2026-10-03", "approval_status": "reviewer_pending", "forms": forms}
    (ROOT / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Built 6 editable templates; verified and copied 12 public originals.")


if __name__ == "__main__":
    build()
