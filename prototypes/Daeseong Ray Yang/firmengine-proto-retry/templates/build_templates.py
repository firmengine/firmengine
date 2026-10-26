"""Rebuild editable blank mapping drafts from the same generator used by the app."""
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.documents import content_models, write_docx, TEMPLATE_VERSION, FORM_IDS


def main():
    out = ROOT / "templates" / "editable"
    out.mkdir(exist_ok=True)
    originals = {item["id"]:item for item in json.loads((ROOT/"templates"/"originals.json").read_text(encoding="utf-8"))}
    fields = {
        "D5100": ["applicant_name", "resident_number", "address", "service_address", "phone", "representative", "debt_cause", "repayment_months", "calculations.monthly_payment", "refund_account"],
        "D5106": ["creditors[].name", "creditors[].contract_id", "creditors[].cause", "creditors[].address", "creditors[].principal", "creditors[].interest", "creditors[].security", "creditors[].priority", "creditors[].disputed"],
        "D5101": ["assets[].label", "assets[].kind", "assets[].market_value", "assets[].secured_balance", "assets[].exempt_amount", "assets[].valuation_source", "assets[].valuation_date", "calculations.liquidation_value"],
        "D5103": ["incomes[].label", "incomes[].kind", "incomes[].period_start", "incomes[].period_end", "incomes[].monthly_gross", "incomes[].monthly_expense", "living_cost", "deductions", "family[]"],
        "D5105": ["education", "incomes[]", "marital_history", "housing_details", "enforcement_details", "debt_cause", "statement", "past_proceedings"],
        "D5110": ["repayment_months", "first_payment_date", "last_payment_date", "payment_day", "calculations.net_income", "living_cost", "deductions", "calculations.monthly_payment", "calculations.total_payment", "calculations.allocations[]", "calculations.liquidation_value", "commissioner_fee_details"],
    }
    catalog = []
    for model in content_models({}, {"calculations": {}}):
        if model["code"] not in FORM_IDS:
            continue
        filename = model["code"] + ".docx"
        write_docx(model, out / filename)
        catalog.append({"id":model["code"],"title":model["title"],"path":"editable/"+filename,"version":TEMPLATE_VERSION,
                        "source":originals[model["code"]],"jurisdiction":"서울회생법원 참고 공개 양식",
                        "mapping_status":"RECONSTRUCTED_REVIEW_REQUIRED","expert_approved":False,
                        "original_layout_preserved":False,"mapped_fields":fields[model["code"]],
                        "note":"원본의 항목·절 구조를 반영한 편집형 초안. 원본 HWP 서식의 픽셀 동일 변환이 아니며 실제 제공 양식과 최종 대응 검수가 필요합니다."})
    (ROOT/"templates"/"catalog.json").write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding="utf-8")
    print(f"Generated {len(catalog)} editable field-mapping templates")


if __name__ == "__main__":
    main()
