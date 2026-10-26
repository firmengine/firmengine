"""One-time design import. Runtime uses the self-contained resulting JSON."""
from html.parser import HTMLParser
import hashlib
import json
from pathlib import Path
import sys


class Tables(HTMLParser):
    def __init__(self):
        super().__init__()
        self.section, self.tables, self.table, self.row, self.cell = '', [], None, None, None

    def handle_starttag(self, tag, attrs):
        if tag == 'h2':
            self.section = dict(attrs).get('id', '')
        if tag == 'table':
            self.table = {'section': self.section, 'rows': []}
        if tag == 'tr':
            self.row = []
        if tag in ('td', 'th'):
            self.cell = []

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.cell is not None:
            self.row.append(' '.join(''.join(self.cell).split()))
            self.cell = None
        if tag == 'tr' and self.row is not None and self.table is not None:
            self.table['rows'].append(self.row)
            self.row = None
        if tag == 'table' and self.table is not None:
            self.tables.append(self.table)
            self.table = None

    def handle_data(self, text):
        if self.cell is not None:
            self.cell.append(text)


def build(path: Path):
    raw = path.read_bytes()
    parsed = Tables()
    parsed.feed(raw.decode('utf-8'))
    entries = []
    counts = {}
    for table in parsed.tables:
        header = table['rows'][0]
        section = table['section']
        if section == 'documents':
            group, prefix = 'common_documents', 'DOC'
        elif section == 'conditional' and len(header) == 3:
            group, prefix = 'conditional_evidence', 'COND'
        elif section == 'conditional' and len(header) == 2:
            group, prefix = 'additional_court_orders', 'ORDER'
        elif section == 'detection' and len(header) == 4:
            group, prefix = 'omission_detection', 'DETECT'
        else:
            continue
        counts[group] = len(table['rows']) - 1
        for index, row in enumerate(table['rows'][1:], 1):
            title = row[1] if group == 'common_documents' else row[0]
            source_ids = ['K18', 'K19', 'K20'] if group != 'omission_detection' else ['K09', 'K20', 'K27']
            authority = ('SEOUL_PRACTICE' if group in ('common_documents', 'additional_court_orders') else
                         'MIXED_SOURCE_REVIEW' if group == 'conditional_evidence' else 'FIRM_POLICY')
            document_basis = {'common_documents': 'baseline_or_case_conditioned',
                'conditional_evidence': 'fact_conditioned_evidence', 'additional_court_orders': 'court_order_only',
                'omission_detection': 'firm_screening'}[group]
            if group == 'common_documents' and row[0] == 'D10':
                authority = 'FIRM_POLICY'
            applicability, required, alternatives = {}, [], []
            check = 'manual'
            policy = 'manual_review' if group != 'omission_detection' else 'warning'
            status = 'source_review_required'
            # Only explicitly verified income branches become executable document checks.
            if group == 'common_documents' and row[0] == 'D14':
                applicability, required, check = {'income_types': ['wage', 'mixed']}, ['income_source.employer'], 'required_features'
                alternatives = [{'any_of': ['employment_certificate', 'employer_confirmation_with_business_registration', 'equivalent_employment_evidence']}]
                policy, status = 'mandatory_when_applicable', 'official_source_verified'
            elif group == 'common_documents' and row[0] == 'D15':
                applicability, check = {'income_types': ['wage', 'mixed']}, 'document_requirement'
                required = ['income.monthly_net', 'income.period', 'income.recurring_evidence[]']
                alternatives = [{'all_of': ['withholding_certificate']}, {'condition': 'primary_unavoidably_unavailable',
                    'any_of': ['employer_signed_salary_statement', 'employer_signed_income_certificate', 'six_month_salary_bank_statement']}]
                policy, status = 'mandatory_when_applicable', 'official_source_verified'
            elif group == 'common_documents' and row[0] == 'D16':
                applicability, check = {'income_types': ['business', 'mixed']}, 'document_requirement'
                required = ['income.business_revenue', 'income.necessary_cost', 'income.period']
                alternatives = [{'purpose': 'income_amount', 'condition': 'applicable_business_reporting_path_reviewed',
                    'any_of': ['profit_loss_statement', 'monthly_business_income_report_previous_year']}]
                policy, status = 'mandatory_when_applicable', 'official_source_verified'
            entries.append({'id': prefix + '-' + str(index).zfill(2), 'title': title, 'group': group,
                'authority': authority, 'source_ids': source_ids, 'check_type': check, 'applicability': applicability,
                'conditions': row[2] if group == 'common_documents' else row[0], 'required_features': required,
                'document_basis': document_basis,
                'alternatives': alternatives, 'blocking_policy': policy, 'status': status,
                'evidence_request': row[2] if group == 'omission_detection' else row[1] if group != 'common_documents' else row[3],
                'original_cells': dict(zip(header, row)), 'jurisdiction': 'KR-SEOUL',
                'source_verified_on': '2026-10-26' if status == 'official_source_verified' else None,
                'note': '해당성·자료 대상자·기간·목적을 검증한다. 목록 존재만으로 모든 사건의 필수 항목이 되지 않는다.'})
    extras = [
        ('POLICY-OUTFLOW-500K', '50만원 이상 출금·이체 사용처', 'FIRM_POLICY', 'transaction_outflow', {}, [], 'warning', ['USER_POLICY']),
        ('TAX-CLASSIFICATION', '조세·사회보험 체납의 개별 법적 분류', 'STATUTE', 'tax_arrears', {'object_types': ['tax_arrears']},
         ['tax_arrears.tax_type', 'tax_arrears.period', 'tax_arrears.due_date', 'tax_arrears.priority_status', 'tax_arrears.estate_claim_status', 'tax_arrears.non_discharge_ground'], 'manual_review', ['K10', 'K08']),
        ('INCOME-MULTIPLE', '복수 직장·영업·부수입 누락 확인', 'FIRM_POLICY', 'income_sources', {}, ['income.sources[]'], 'warning', ['K01']),
        ('ASSET-VALUATION', '재산별 기준일·지분·시가·담보·보호근거', 'SEOUL_PRACTICE', 'asset_valuation',
         {'object_types': ['asset']}, ['assets[].ownership_share', 'assets[].gross_value', 'assets[].valuation_as_of', 'assets[].valuation_method'], 'manual_review', ['K09', 'K20']),
        ('ASSET-DISPOSAL', '처분재산의 대금과 대체재산 중복 검토', 'FIRM_POLICY', 'asset_disposal', {},
         ['assets[].disposal_history[]', 'assets[].successor_asset_ids'], 'warning', ['K09', 'K32'])
    ]
    for key, title, authority, check, condition, features, policy, sources in extras:
        entry = {'id': key, 'title': title, 'group': 'explicit_product_extensions', 'authority': authority,
                 'source_ids': sources, 'check_type': check, 'applicability': condition, 'required_features': features,
                 'alternatives': [], 'blocking_policy': policy, 'status': 'review_required'}
        if key == 'POLICY-OUTFLOW-500K':
            entry.update(threshold_won='500000', status='user_policy', note='사용자 지정 업무정책이다. 법정 기준액이나 자동 부인·기각 규칙이 아니다. 본인 계좌 간 이체·중복을 먼저 구분한다.')
        if key == 'TAX-CLASSIFICATION':
            entry.update(note='세목·발생원인·납부기한·절차시점·징수유예·쟁송별 분류. 체납만으로 일괄 기각 또는 전액 선납을 요구하지 않는다.')
        if key == 'INCOME-MULTIPLE':
            entry.update(questions=['직장 또는 지급자가 둘 이상인가?', '근로·사업·임대소득이 함께 있는가?', '이자·배당·연금·복지급여·플랫폼 정산·해외수입이 있는가?', '일시 수입과 장래 반복 수입, 사업 필요비와 생활비가 구분되는가?'],
                         income_categories=['wage', 'business', 'rent', 'interest', 'dividend', 'pension', 'welfare', 'platform', 'foreign', 'other'],
                         note='모든 입금을 가용소득으로 자동 인정하지 않는다. 급여의 종류·반복성·보호 법률·중복 공제는 별도 검토한다.')
        entries.append(entry)
    for key, title, sources in [('CASE-2013MA668', '보정 응답과 해소 구분', ['CASE2013MA668']),
                                ('CASE-2013MA101', '최근 채무 비율만으로 자동 기각 금지', ['K31']),
                                ('CASE-2010MA1179', '편파변제의 회복·계획수정 검토', ['K32']),
                                ('CASE-2024DA221042', '인가 후 전액 대위변제의 누락 보증인 예외', ['K26'])]:
        entries.append({'id': key, 'title': title, 'group': 'public_case_observations', 'authority': 'PUBLIC_JUDGMENT',
            'source_ids': sources, 'check_type': 'manual', 'applicability': {}, 'required_features': [],
            'alternatives': [], 'blocking_policy': 'manual_review', 'status': 'official_source_verified',
            'note': '판례의 전제 사실·절차시점·특별사정을 확인하는 검토 항목이다. 모든 사건의 일반 산식·자동 승인 조건이 아니다.'})
    return {'version': '1.0.0', 'source_design_sha256': hashlib.sha256(raw).hexdigest(),
            'source_checked_on': '2026-10-26', 'coverage': counts, 'entries': entries,
            'limits': ['확인한 설계 항목을 보존한 목록이며 모든 법률·거래·세무 예외를 망라한다는 주장이 아니다.',
                       '수동 검토 항목은 해소로 자동 판정하지 않는다. 계산·서류 핵심요건의 미확인과 보완 경고를 분리한다.',
                       '2022년 자료제출목록·2024년 직무편람의 구 금액과 기간을 현행 법정 상수로 승격하지 않는다.']}


if __name__ == '__main__':
    source = Path(sys.argv[1])
    target = Path(__file__).parent / 'bootstrap/correction_catalog.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    result = build(source)
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'entries': len(result['entries']), 'coverage': result['coverage']}))
