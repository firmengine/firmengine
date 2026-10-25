from pathlib import Path
import os
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / '.runtime'
ENV = {**dotenv_values(ROOT.parent / '.env'), **dotenv_values(ROOT / '.env'), **os.environ}
API_KEY = ENV.get('OPENAI_API_KEY') or ENV.get('OPEN_AI_API_KEY') or ''
MODEL = ENV.get('OPENAI_MODEL') or 'gpt-6-luna'
API_PORT = int(ENV.get('API_PORT', '8010'))
N8N_PORT = int(ENV.get('N8N_PORT', '5679'))
N8N_URL = f'http://127.0.0.1:{N8N_PORT}'
TTL = int(ENV.get('SESSION_TTL_SECONDS', '3600'))
CONCURRENCY = max(1, min(6, int(ENV.get('OCR_CONCURRENCY', '3'))))
BATCH_SIZE = max(1, min(6, int(ENV.get('OCR_BATCH_PAGES', '4'))))

LABELS = {
    'client_name': '신청인 성명', 'resident_id': '주민등록번호', 'address': '현주소',
    'registered_address': '주민등록상 주소', 'phone': '연락처', 'court_name': '관할 법원',
    'business_name': '사업체명', 'business_type': '업종', 'tax_type': '과세유형',
    'business_registration': '사업자등록번호', 'business_address': '사업장 주소',
    'opening_date': '개업일', 'household_size': '인정 가구원 수',
    'annual_revenue': '연간 매출', 'annual_expenses': '연간 필요경비',
    'annual_business_income': '신고 사업소득', 'income_year': '소득 귀속연도',
    'monthly_revenue': '월 매출', 'monthly_expense': '월 사업경비',
    'monthly_income': '자료상 월 소득', 'approved_monthly_income': '검토 인정 월 영업소득',
    'recognized_living_cost': '검토 인정 월 생계비', 'repayment_months': '검토 변제기간',
    'monthly_trustee_fee': '검토 월 회생위원 보수', 'liquidation_value': '검토 청산가치',
    'bank_balance': '예금 잔액', 'insurance_surrender': '보험 해약환급금',
    'housing_deposit': '임차보증금', 'vehicle_value': '차량 평가액',
    'real_estate_value': '부동산 평가액', 'assets_total': '자료상 재산 합계',
    'statement': '의뢰인 진술', 'prior_proceedings': '과거 절차 관련 진술',
    'creditor_principal': '채권 원금', 'creditor_interest': '채권 이자',
    'creditor_address': '채권자 주소', 'asset_value': '개별 재산 가액',
    'asset_description': '개별 재산 내역',
}
# These are explicit human/legal inputs, never silently inferred from an old filed plan.
REVIEW_INPUTS = ['approved_monthly_income', 'recognized_living_cost', 'repayment_months',
                 'monthly_trustee_fee', 'liquidation_value', 'household_size']
