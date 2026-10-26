"""Synthetic file-generation smoke; expected answers live in a prewritten truth file."""
from pathlib import Path
import json
import sys
import uuid

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.documents import generate_package
from evaluation.evaluate import evaluate


def main():
    case = {
        "id":"synthetic-independent-document-smoke", "revision":1, "is_demo":True,
        "applicant_name":"가상 김보람","address":"서울시 가상구 가상로 1","court":"서울회생법원",
        "birth_date":"1990-01-01","filing_date":"2026-10-26","income_type":"business",
        "repayment_months":24,"living_cost":1000000,"deductions":0,"assets_declared":True,
        "statement":"거래처 폐업으로 매출이 줄었으며 현재 사업을 유지하고 있습니다.","debt_cause":"매출 감소에 따른 운영자금 부족",
        "rule_approved":False,"template_approved":False,
        "incomes":[{"id":"income-1","label":"가상카페","kind":"business","period_start":"2025-10-01","period_end":"2026-09-30","monthly_gross":3000000,"monthly_expense":1000000,"confirmed":True,"source_document_id":"synthetic-ledger","source_page":1,"source_quote":"가상카페 월 수입 300만원, 경비 100만원"}],
        "creditors":[{"id":"credit-1","name":"가상은행","contract_id":"LOAN-001","cause":"운영자금 대출","address":"서울시 가상은행 본점","principal":10000000,"interest":100000,"security":"unsecured","priority":"ordinary"},
                     {"id":"credit-2","name":"가상은행","contract_id":"LOAN-002","cause":"생활자금 대출","address":"서울시 가상은행 본점","principal":20000000,"interest":200000,"security":"unsecured","priority":"ordinary"}],
        "assets":[{"id":"asset-1","label":"가상 예금","kind":"deposit","market_value":2000000,"secured_balance":0,"exempt_amount":0,"valuation_source":"합성 잔액증명","valuation_date":"2026-10-26"}],
        "facts":[],"documents":[],
    }
    assessment={"can_generate":True,"warnings":[],"risks":[],"calculations":{
        "monthly_income":3000000,"monthly_expense":1000000,"net_income":2000000,"disposable_income":1000000,"liquidation_value":2000000,
        "total_principal":30000000,"total_interest":300000,"total_debt":30300000,"monthly_payment":1000000,"total_payment":24000000,"repayment_rate":79.207921,
        "rule_version":"synthetic-fixture-only","engine":"precomputed-independent-document-fixture",
        "allocations":[{"creditor_id":"credit-1","name":"가상은행","principal":10000000,"monthly_payment":333333,"total_payment":8000000},{"creditor_id":"credit-2","name":"가상은행","principal":20000000,"monthly_payment":666667,"total_payment":16000000}]}}
    out=ROOT/".local"/"document-smoke"/str(uuid.uuid4())
    artifacts=generate_package(case,assessment,out)
    report=evaluate(out,ROOT/"evaluation"/"synthetic_truth.json")
    report["generated_artifact_count"]=len(artifacts)
    (out/"evaluation_report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({"output_dir":str(out),"artifacts":len(artifacts),"summary":report["summary"]},ensure_ascii=False))
    if report["summary"]["fail"]:
        raise SystemExit(1)


if __name__=="__main__":
    main()
