"""Editable court-form drafts with explicit provenance and review state.

This module consumes the application contract, never the held-out submitted
answers.  It renders version-pinned reconstructed DOCX templates whose sections
are mapped to the public court originals distributed in ``templates/originals``.
It does not make legal findings, infer missing amounts, sign, or select consent.
"""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import json
from pathlib import Path
import re
from typing import Any

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter


TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "templates"
MISSING = "[확인 필요]"
CONFLICT = "[불일치·확인 필요]"
PERIOD = "[기간 선택 필요]"
TOKEN = re.compile(r"\{\{([a-zA-Z0-9_.-]+)\}\}")
XML_CONTROLS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
STATES = {
    "confirmed": "담당자 확인", "unreviewed": "미확인 추출값",
    "conflict": "불일치", "missing": "확인 필요", "calculated": "산술 계산",
    "pending": "계산 보류", "excluded": "검토 제외", "rejected": "제외", "superseded": "대체됨",
}
CALC_ALIASES = {
    "total_principal": "debt_principal_total",
    "total_interest": "debt_interest_total",
    "monthly_business_income": "monthly_business_income",
    "monthly_disposable_income": "monthly_disposable_income",
    "monthly_payment": "monthly_payment",
    "total_repayment": "total_repayment",
    "repayment_rate": "repayment_rate",
}


def clean(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False, default=str)
    return XML_CONTROLS.sub("", str(value))


def _amount(value: Any) -> str:
    """Format only unambiguous plain numeric strings; never coerce unknown to 0."""
    text = clean(value).strip()
    if not re.fullmatch(r"-?\d+(?:\.\d+)?", text):
        return text
    try:
        number = Decimal(text)
        if number.is_finite():
            return format(number, ",f")
    except InvalidOperation:
        pass
    return text


def _records(session: dict, key: str | None = None) -> list[dict]:
    return [row for row in session.get("records", [])
            if (key is None or row.get("key") == key)
            and row.get("state") not in ("excluded", "rejected", "superseded")]


def _resolve_rows(rows: list[dict]) -> str:
    if not rows:
        return MISSING
    if any(row.get("state") == "conflict" for row in rows):
        return CONFLICT
    usable = [row for row in rows if row.get("value") is not None
              and clean(row.get("value")).strip() and row.get("state") != "missing"]
    if not usable:
        return MISSING
    confirmed = [row for row in usable if row.get("state") == "confirmed"]
    selected = confirmed or usable
    periods = {clean(row.get("period")).strip() for row in selected}
    if len(periods) > 1:
        return PERIOD
    values = {clean(row["value"]).strip() for row in selected}
    if len(values) != 1:
        return CONFLICT
    return _amount(selected[0]["value"])


def _calculation(session: dict, key: str) -> str:
    rows = [row for row in session.get("calculations", []) if row.get("key") == key]
    if not rows:
        return MISSING
    if any(row.get("status") != "calculated" or row.get("value") is None for row in rows):
        return "[계산 보류]"
    values = {clean(row["value"]) for row in rows}
    return _amount(rows[0]["value"]) if len(values) == 1 else CONFLICT


def _review(session: dict, role: str) -> dict:
    value = session.get("reviews", {}).get(role)
    return value if isinstance(value, dict) else {}


def _review_valid(session: dict, role: str) -> bool:
    row = _review(session, role)
    return bool((row.get("name") or row.get("reviewer") or row.get("actor"))
                and row.get("revision") == session.get("revision"))


def review_status(session: dict) -> str:
    if (session.get("template_approved") is True
            and _review_valid(session, "caseworker") and _review_valid(session, "lawyer")):
        return "검토 완료본 · 실제 법원 제출 전"
    return "미검토 초안 · 담당자 및 변호사 확인 필요"


def _value(session: dict, key: str) -> str:
    if key == "review_status":
        return review_status(session)
    if key == "revision":
        return clean(session.get("revision", 0))
    if key == "session_id":
        return clean(session.get("id"))
    if key in CALC_ALIASES:
        return _calculation(session, CALC_ALIASES[key])
    return _resolve_rows(_records(session, key))


def _grouped(session: dict, prefix: str) -> list[dict]:
    keys = {
        "creditor": {"creditor_principal": "principal", "creditor_interest": "interest",
                     "creditor_address": "address", "creditor_cause": "cause",
                     "creditor_phone": "phone"},
        "asset": {"asset_value": "value", "asset_description": "description"},
        "month": {"monthly_revenue": "revenue", "monthly_expense": "expense"},
    }[prefix]
    grouped: dict[tuple[str, str], dict[str, list]] = {}
    for record in _records(session):
        if record.get("key") not in keys:
            continue
        identity = (clean(record.get("entity")).strip(), clean(record.get("period")).strip())
        group = grouped.setdefault(identity, {})
        group.setdefault(keys[record["key"]], []).append(record)
    output = []
    for (entity, period), fields in grouped.items():
        row = {"entity": entity or MISSING, "period": period or MISSING}
        row.update({name: _resolve_rows(fields.get(name, [])) for name in keys.values()})
        # Allocation is a separate reviewed calculation, not proportional guessing.
        row.update(monthly_payment=MISSING, total_payment=MISSING)
        output.append(row)
    return output


def _paragraphs(document):
    def table_paragraphs(table):
        seen = set()
        for row in table.rows:
            for cell in row.cells:
                if cell._tc in seen:
                    continue
                seen.add(cell._tc)
                yield from cell.paragraphs
                for nested in cell.tables:
                    yield from table_paragraphs(nested)
    yield from document.paragraphs
    for table in document.tables:
        yield from table_paragraphs(table)
    for section in document.sections:
        yield from section.header.paragraphs
        yield from section.footer.paragraphs


def _replace_paragraph(paragraph, resolver):
    previous = paragraph.text
    replaced = TOKEN.sub(lambda match: clean(resolver(match.group(1))), previous)
    if replaced == previous:
        return
    if paragraph.runs:
        paragraph.runs[0].text = replaced
        for run in paragraph.runs[1:]:
            run.text = ""
    else:
        paragraph.add_run(replaced)


def _expand_tables(document, session):
    for table in document.tables:
        for row in list(table.rows):
            text = " ".join(cell.text for cell in row.cells)
            prefix = next((p for p in ("creditor", "asset", "month") if "{{" + p + "." in text), None)
            if not prefix:
                continue
            groups = _grouped(session, prefix) or [{"entity": MISSING, "period": MISSING}]
            index = table._tbl.index(row._tr)
            for offset, group in enumerate(groups):
                new_tr = deepcopy(row._tr)
                table._tbl.insert(index + offset, new_tr)
                for paragraph in new_tr.iter(qn("w:p")):
                    # Run fragments are joined so an edited Word template may split tokens.
                    texts = list(paragraph.iter(qn("w:t")))
                    whole = "".join(item.text or "" for item in texts)
                    replaced = TOKEN.sub(
                        lambda match: clean(group.get(match.group(1).split(".", 1)[1], MISSING))
                        if match.group(1).startswith(prefix + ".") else match.group(0), whole)
                    if texts and whole != replaced:
                        texts[0].text = replaced
                        for item in texts[1:]:
                            item.text = ""
            table._tbl.remove(row._tr)


def _template_catalog() -> dict:
    catalog = json.loads((TEMPLATE_DIR / "catalog.json").read_text(encoding="utf-8"))
    for entry in catalog["forms"]:
        for asset in [entry["template"], *entry["originals"]]:
            path = TEMPLATE_DIR / asset["path"]
            if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != asset["sha256"]:
                raise ValueError(f"Template asset changed; update mapping and approval: {asset['path']}")
    return catalog


def _set_cell(cell, value):
    cell.text = clean(value)


def _add_appendix(document, session: dict, form: dict, generated_at: str):
    document.add_page_break()
    document.add_heading("검토·출처 대조표 (법원 서식과 분리)", level=1)
    metadata = [
        ("상태", review_status(session)), ("생성시각", generated_at),
        ("사건 세션 / 입력 버전", f"{session.get('id', '')} / {session.get('revision', 0)}"),
        ("서식", f"{form['code']} / {form['template_version']}"),
        ("원본 대응", "공식 원본의 항목·구역을 편집형으로 재구성. 동일한 페이지 배치가 아니며 양식 검토가 필요합니다."),
        ("서식 확인", "이 세션에서 확인됨" if session.get("template_approved") else "검토 대기"),
    ]
    for role, label in [("caseworker", "담당자"), ("lawyer", "변호사")]:
        row = _review(session, role)
        actor = row.get("name") or row.get("reviewer") or row.get("actor") or "확인 전"
        metadata.append((label, f"{actor} / {row.get('at', '')} / 확인 버전 {row.get('revision', '없음')}"))
    table = document.add_table(rows=0, cols=2)
    table.style = "Table Grid"
    for label, value in metadata:
        cells = table.add_row().cells
        _set_cell(cells[0], label)
        _set_cell(cells[1], value)
    document.add_paragraph("서명·날인·동의 선택은 자동 작성하지 않습니다. 외부에서 편집한 파일은 앱의 확인 기록과 자동 동기화되지 않습니다.")
    document.add_heading("원본 양식 출처", level=2)
    for source in form["originals"]:
        document.add_paragraph(f"{source['title']}\n{source['url']}\nSHA-256: {source['sha256']}\n수집일: {source['retrieved_at']} (서식 시행일과 구분)")
    keys = set(form["record_keys"])
    relevant = [row for row in _records(session) if row.get("key") in keys]
    document.add_heading("작성 항목과 원문 근거", level=2)
    if not relevant:
        document.add_paragraph("연결된 증빙 항목이 없습니다. 빈칸을 임의의 0이나 사실로 채우지 않았습니다.")
    for row in relevant:
        label = row.get("label") or row.get("key")
        document.add_paragraph(f"{label} / {row.get('entity', '')} / {row.get('period', '')}", style="Heading 3")
        document.add_paragraph(f"값: {_resolve_rows([row])} · 상태: {STATES.get(row.get('state'), row.get('state', ''))} · 항목 ID: {row.get('id', '')}")
        for source in row.get("sources", []):
            excerpt = clean(source.get("quote"))
            if len(excerpt) > 700:
                excerpt = excerpt[:700] + " … [긴 인용은 앱 원문에서 확인]"
            document.add_paragraph(f"{source.get('document_id', '')} / {source.get('page', '쪽 미상')}쪽\n{excerpt}")
    document.add_heading("계산근거", level=2)
    for row in session.get("calculations", []):
        if row.get("key") not in form.get("calculation_keys", []):
            continue
        document.add_paragraph(f"{row.get('label') or row.get('key')}: {_calculation(session, row['key'])} {row.get('unit', '')}\n산식: {clean(row.get('formula'))}\n상태: {STATES.get(row.get('status'), row.get('status', ''))}")


def _sheet(workbook, title: str, headers: list[str], rows: list[list]):
    sheet = workbook.create_sheet(title)
    for row in [headers, *rows]:
        index = sheet.max_row + 1 if sheet.max_row > 1 or sheet.cell(1, 1).value is not None else 1
        for column, value in enumerate(row, 1):
            # Explicit text prevents formula injection and preserves monetary precision.
            cell = sheet.cell(index, column)
            cell.value = clean(value)[:32767]
            cell.data_type = "s"
            cell.alignment = Alignment(vertical="top", wrap_text=True)
    for cell in sheet[1]:
        cell.fill = PatternFill("solid", fgColor="183E35")
        cell.font = Font(name="맑은 고딕", bold=True, color="FFFFFF")
    for index in range(1, len(headers) + 1):
        sheet.column_dimensions[get_column_letter(index)].width = 25 if index < len(headers) else 55
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions
    for row in sheet.iter_rows(min_row=2):
        for cell in row:
            cell.font = Font(name="맑은 고딕", size=10)
    return sheet


def _workbook(session: dict, catalog: dict, generated_at: str) -> Workbook:
    workbook = Workbook()
    workbook.remove(workbook.active)
    _sheet(workbook, "요약", ["항목", "내용"], [
        ["상태", review_status(session)], ["세션", session.get("id")],
        ["입력 버전", session.get("revision")], ["생성시각", generated_at],
        ["금액 형식", "정밀도 보존을 위해 원 단위 값을 텍스트로 저장. 산식은 실행 수식이 아닌 계산엔진의 근거 표현입니다."],
        ["편집 안내", "외부 편집 결과는 앱 확인 기록과 자동 동기화되지 않습니다."],
        ["기간", "동일 항목의 여러 기간은 개별 행으로 유지하며 합산하지 않습니다."],
    ])
    _sheet(workbook, "계산근거", ["키", "항목", "값", "단위", "상태", "산식", "출처"], [
        [row.get("key"), row.get("label"), row.get("value") if row.get("status") == "calculated" else MISSING,
         row.get("unit"), STATES.get(row.get("status"), row.get("status")), row.get("formula"), row.get("sources")]
        for row in session.get("calculations", [])
    ])
    _sheet(workbook, "추출값", ["ID", "키", "대상", "항목", "값", "단위", "기간", "상태", "신뢰도"], [
        [row.get("id"), row.get("key"), row.get("entity"), row.get("label"),
         row.get("value") if row.get("value") is not None else MISSING, row.get("unit"), row.get("period"),
         STATES.get(row.get("state"), row.get("state")), row.get("confidence")]
        for row in session.get("records", [])
    ])
    _sheet(workbook, "출처", ["항목 ID", "키", "문서", "페이지", "원문 발췌"], [
        [row.get("id"), row.get("key"), source.get("document_id"), source.get("page"), source.get("quote")]
        for row in session.get("records", []) for source in row.get("sources", [])
    ])
    _sheet(workbook, "채권자", ["채권자", "기준기간", "원금", "이자", "주소", "발생원인"], [
        [row.get(k, MISSING) for k in ["entity", "period", "principal", "interest", "address", "cause"]]
        for row in _grouped(session, "creditor")
    ])
    _sheet(workbook, "월별매출경비", ["대상 월", "자료 기간", "매출", "사업경비", "검토"], [
        [row["entity"], row["period"], row.get("revenue", MISSING), row.get("expense", MISSING), "인정값·대상기간은 담당자 확인 필요"]
        for row in _grouped(session, "month")
    ])
    _sheet(workbook, "재산", ["재산", "기준기간", "가액", "명세"], [
        [row.get(k, MISSING) for k in ["entity", "period", "value", "description"]]
        for row in _grouped(session, "asset")
    ])
    _sheet(workbook, "검토", ["역할", "확인자", "시각", "확인 버전", "현재 버전과 일치"], [
        [label, _review(session, role).get("name") or _review(session, role).get("reviewer"),
         _review(session, role).get("at"), _review(session, role).get("revision"),
         "예" if _review_valid(session, role) else "아니오"]
        for role, label in [("caseworker", "담당자"), ("lawyer", "변호사")]
    ])
    _sheet(workbook, "서식정보", ["코드", "서식명", "템플릿 버전", "상태", "원본 파일", "SHA-256", "출처 URL"], [
        [form["code"], form["title"], form["template_version"], "편집형 재구성·전문가 확인 필요",
         source["path"], source["sha256"], source["url"]]
        for form in catalog["forms"] for source in form["originals"]
    ])
    return workbook


def render_bundle(session: dict, output_dir: Path) -> list[dict]:
    """Write six editable drafts and their evidence workbook; return file metadata."""
    catalog = _template_catalog()
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now(timezone.utc).isoformat()
    revision = int(session.get("revision", 0))
    artifacts = []
    for index, form in enumerate(catalog["forms"], 1):
        document = Document(TEMPLATE_DIR / form["template"]["path"])
        for paragraph in _paragraphs(document):
            _replace_paragraph(paragraph, lambda key: "{{" + key + "}}"
                               if key.startswith(("creditor.", "asset.", "month.")) else _value(session, key))
        # Expand user-provided repeat values last; literal {{...}} in evidence
        # must never be interpreted as another template instruction.
        _expand_tables(document, session)
        _add_appendix(document, session, form, generated_at)
        document.core_properties.title = form["title"]
        document.core_properties.subject = review_status(session)
        document.core_properties.author = "Firm Engine local document workflow"
        name = f"{index:02d}_{form['title'].replace(' ', '')}_r{revision}.docx"
        document.save(output_dir / name)
        artifacts.append({"name": name, "title": form["title"], "kind": form["kind"], "format": "docx"})
    name = f"07_계산근거와검토대조표_r{revision}.xlsx"
    _workbook(session, catalog, generated_at).save(output_dir / name)
    artifacts.append({"name": name, "title": "계산근거와 검토 대조표", "kind": "workbook", "format": "xlsx"})
    return artifacts
