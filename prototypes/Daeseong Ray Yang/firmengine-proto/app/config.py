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
    # Factual fields present in the hash-pinned public court templates. Their
    # inclusion permits evidence extraction; it never implies legal approval.
    'application_date': '작성·신청 예정일', 'case_number': '사건번호',
    'service_address': '송달장소', 'lawyer_name': '대리인 성명',
    'lawyer_address': '대리인 사무실 주소', 'lawyer_phone': '대리인 전화',
    'lawyer_email': '대리인 이메일', 'related_cases': '관련 사건 내역',
    'refund_bank': '적립금 반환은행', 'refund_account': '적립금 반환계좌',
    'repayment_start_date': '변제 개시 예정일', 'repayment_end_date': '변제 종료 예정일',
    'repayment_day': '월 변제 예정일', 'debt_as_of': '채권 산정 기준일',
    'secured_debt_total': '자료상 담보부 회생채권 합계',
    'unsecured_debt_total': '자료상 무담보 회생채권 합계',
    'secured_claim_details': '별제권부 채권 내역', 'disputed_claim_details': '다툼 있는 채권 내역',
    'assignment_order_details': '전부명령 내역', 'other_claim_details': '기타 채권 내역',
    'creditor_number': '자료상 채권번호', 'creditor_contract_id': '채권 계약·계좌 식별자',
    'creditor_cause': '채권 발생원인', 'creditor_content': '채권 내용',
    'creditor_phone': '채권자 전화', 'creditor_fax': '채권자 팩스',
    'creditor_loan_date': '채권 발생일', 'creditor_original_principal': '최초 채권 원금',
    'creditor_principal_basis': '채권 원금 산정근거', 'creditor_interest_basis': '채권 이자 산정근거',
    'creditor_claim_type': '증빙에 명시된 채권 유형', 'creditor_priority_basis': '자료상 우선권 근거',
    'creditor_due_date': '채권 변제기', 'creditor_collateral': '담보 내용 및 목적물',
    'creditor_secured_recovery': '자료상 별제권 예상 변제액',
    'creditor_shortfall': '자료상 담보부족 예상액', 'creditor_secured_amount': '자료상 담보부 채권액',
    'creditor_disputed_amount': '채권자 주장액', 'creditor_undisputed_amount': '다툼 없는 채권액',
    'creditor_dispute_reason': '채권 다툼의 원인', 'creditor_litigation': '채권 소송 진행경과',
    'creditor_claimed_principal': '증빙상 채권자가 주장하는 원금',
    'creditor_claimed_interest': '증빙상 채권자가 주장하는 이자',
    'creditor_undisputed_interest': '증빙상 다툼 없는 이자',
    'creditor_disputed_interest': '증빙상 다툼 있는 이자 차액',
    'creditor_assignment_order': '채권 전부명령 내역', 'creditor_other_details': '기타 채권 세부내역',
    'cash': '현금', 'business_assets_value': '사업용 설비·재고·비품 가액',
    'loan_receivables': '대여금 채권', 'trade_receivables': '매출금 채권',
    'retirement_value': '예상 퇴직금', 'other_assets': '기타 재산 가액',
    'exempt_value': '면제재산 신청금액', 'exempt_details': '면제재산 신청내용',
    'asset_kind': '재산 종류', 'asset_institution': '재산 금융기관·상대방',
    'asset_account_number': '재산 계좌·증권·등록번호', 'asset_seizure': '재산 압류·가압류 여부',
    'asset_collateral': '재산 담보 설정내역', 'asset_valuation_basis': '재산 가액 산정근거',
    'asset_ownership_share': '재산 소유지분', 'asset_return_amount': '재산 반환 예상금액',
    'asset_address': '재산 소재지', 'asset_acquisition_date': '재산 취득시기',
    'housing_cost': '월 주거비', 'medical_cost': '월 의료비', 'education_cost': '월 교육비',
    'additional_living_reason': '추가 생계비 사유', 'family_details': '가족관계 내역',
    'family_relationship': '가족 관계', 'family_age': '가족 나이',
    'family_cohabitation': '가족 동거 여부', 'family_occupation': '가족 직업',
    'family_monthly_income': '가족 월수입', 'family_assets': '가족 재산',
    'family_dependent': '가족 부양 여부', 'education': '최종 학력',
    'career_history': '과거 경력', 'career_employer': '경력 직장·사업장',
    'career_business_type': '경력 업종', 'career_position': '경력 직위·자영 여부',
    'marriage_history': '과거 결혼·이혼 경력', 'residence_start': '현재 거주 시작일',
    'housing_type': '현재 거주 형태', 'housing_arrears': '임대료 연체액',
    'housing_tenant': '임차인 성명', 'housing_owner': '주거 소유자 성명',
    'housing_owner_relationship': '주거 소유자와의 관계',
    'lease_contract_date': '임대차계약일자', 'lease_period': '임대차계약기간',
    'residence_registration_date': '주민등록 전입일자', 'lease_fixed_date': '임대차 확정일자',
    'enforcement_history': '소송·압류 등 경험', 'enforcement_kind': '집행·소송 종류',
    'enforcement_creditor': '집행·소송 채권자', 'enforcement_court': '집행·소송 관할법원',
    'enforcement_case_number': '집행·소송 사건번호', 'debt_cause_categories': '진술상 채무 발생 사유',
    'prior_procedure_kind': '과거 이용 절차', 'prior_procedure_court': '과거 절차 법원·기관',
    'prior_procedure_status': '과거 절차 진행상황',
    'asset_disposal_plan': '제안된 재산 처분계획', 'estate_claim_plan': '재단채권 변제계획',
    'priority_claim_plan': '우선권 채권 변제계획', 'payment_schedule_details': '제안된 변제 일정·방법',
    'unconfirmed_claim_plan': '미확정채권 조치', 'trustee_payment_details': '회생위원 임치·지급 내역',
    'discharge_clause_review': '면책 조항 적용 검토', 'plan_other_details': '변제계획 기타 사항',
    'present_value': '검토 현재가치', 'standard_living_cost': '자료상 기준 생계비',
    'allocation_basis': '검토 변제배분 기준',
}
# These are explicit human/legal inputs, never silently inferred from an old filed plan.
REVIEW_INPUTS = ['approved_monthly_income', 'recognized_living_cost', 'repayment_months',
                 'monthly_trustee_fee', 'liquidation_value', 'household_size']

# Evidence may support proposals for these values, but only explicit review can
# turn them into approved case inputs. Extractors must not infer them from law,
# historical filed answers, or the absence of a document.
REVIEW_ONLY_KEYS = set(REVIEW_INPUTS) | {
    'repayment_start_date', 'repayment_end_date', 'repayment_day', 'allocation_basis',
    'present_value', 'asset_disposal_plan', 'estate_claim_plan', 'priority_claim_plan',
    'payment_schedule_details', 'unconfirmed_claim_plan', 'trustee_payment_details',
    'discharge_clause_review', 'plan_other_details',
}
