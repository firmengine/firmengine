"""Evidence grouping and deterministic arithmetic; unknown never becomes zero."""
from collections import defaultdict
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP, localcontext
import re
import uuid

from .config import LABELS, REVIEW_INPUTS


INACTIVE = {'excluded', 'rejected', 'superseded'}
REQUIRED_KEYS = ['client_name', 'resident_id', 'address', 'business_name', 'court_name', *REVIEW_INPUTS]
IDENTITY_KEYS = {'client_name', 'resident_id', 'address', 'registered_address', 'phone',
                 'court_name', 'business_name', 'business_type', 'tax_type', 'business_registration',
                 'business_address', 'opening_date', 'statement', 'prior_proceedings',
                 'application_date', 'case_number', 'service_address', 'lawyer_name',
                 'lawyer_address', 'lawyer_phone', 'lawyer_email', 'related_cases',
                 'refund_bank', 'refund_account', 'repayment_start_date', 'repayment_end_date',
                 'repayment_day', 'debt_as_of', 'secured_claim_details', 'disputed_claim_details',
                 'assignment_order_details', 'other_claim_details', 'exempt_details',
                 'additional_living_reason', 'family_details', 'education', 'career_history',
                 'marriage_history', 'residence_start', 'housing_type', 'housing_tenant',
                 'housing_owner', 'housing_owner_relationship', 'enforcement_history',
                 'debt_cause_categories', 'asset_disposal_plan', 'estate_claim_plan',
                 'priority_claim_plan', 'payment_schedule_details', 'unconfirmed_claim_plan',
                 'trustee_payment_details', 'discharge_clause_review', 'plan_other_details',
                 'allocation_basis'}
MONEY_KEYS = {'annual_revenue', 'annual_expenses', 'annual_business_income', 'monthly_revenue',
              'monthly_expense', 'monthly_income', 'approved_monthly_income', 'recognized_living_cost',
              'monthly_trustee_fee', 'liquidation_value', 'bank_balance', 'insurance_surrender',
              'housing_deposit', 'vehicle_value', 'real_estate_value', 'assets_total',
              'creditor_principal', 'creditor_interest', 'asset_value',
              'secured_debt_total', 'unsecured_debt_total', 'creditor_original_principal',
              'creditor_secured_recovery', 'creditor_shortfall', 'creditor_secured_amount',
              'creditor_disputed_amount', 'creditor_undisputed_amount', 'cash',
              'business_assets_value', 'loan_receivables', 'trade_receivables', 'retirement_value',
              'other_assets', 'exempt_value', 'asset_return_amount', 'housing_cost', 'medical_cost',
              'education_cost', 'family_monthly_income', 'family_assets', 'housing_arrears',
              'present_value', 'standard_living_cost'}
INTEGER_KEYS = {'repayment_months', 'household_size'}


def number(value):
    """Parse bounded plain decimal input, preserving precision and rejecting guesses."""
    if value is None or isinstance(value, (bool, float)):
        return None
    if isinstance(value, Decimal):
        return value if value.is_finite() and len(value.as_tuple().digits) <= 64 and abs(value.adjusted()) <= 64 else None
    text = str(value).strip()
    match = re.fullmatch(r'([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(?:원|개월|명)?', text)
    if not match:
        return None
    cleaned = match.group(1).replace(',', '')
    if sum(character.isdigit() for character in cleaned) > 64:
        return None
    try:
        result = Decimal(cleaned)
        return result if result.is_finite() else None
    except (InvalidOperation, ValueError):
        return None


def normalize(value):
    return re.sub(r'\s+', '', '' if value is None else str(value)).casefold()


def _period(value):
    """Normalize explicit dates only; a year, month and day remain distinct scopes."""
    text = str(value or '').strip()
    matched = re.fullmatch(r'(\d{4})\s*[년./-]\s*(\d{1,2})\s*[월./-]\s*(\d{1,2})\s*[일.]?', text)
    if matched:
        try:
            return date(*(int(part) for part in matched.groups())).isoformat()
        except ValueError:
            return text
    matched = re.fullmatch(r'(\d{4})\s*[년./-]\s*(\d{1,2})\s*[월.]?', text)
    if matched and 1 <= int(matched[2]) <= 12:
        return f'{int(matched[1]):04d}-{int(matched[2]):02d}'
    return text


def _unit(key, unit=''):
    text = str(unit or '').strip()
    if key in MONEY_KEYS and text.casefold() in ('', 'krw', 'won', '원'):
        return 'KRW'
    if key == 'repayment_months' and text.casefold() in ('', 'month', 'months', '개월'):
        return 'months'
    if key == 'household_size' and text.casefold() in ('', 'person', 'persons', 'people', '명'):
        return 'persons'
    return text


def _numeric(row):
    key, value = row.get('key'), row.get('value')
    expected = 'KRW' if key in MONEY_KEYS else ('months' if key == 'repayment_months' else 'persons')
    if _unit(key, row.get('unit')) != expected:
        return None
    raw = str(value or '').strip()
    if (key in MONEY_KEYS and raw.endswith(('개월', '명'))) or (key in INTEGER_KEYS and raw.endswith('원')):
        return None
    parsed = number(value)
    if parsed is None or parsed < 0:
        return None
    if key in INTEGER_KEYS and (parsed <= 0 or parsed != parsed.to_integral_value()):
        return None
    return parsed


def _active(records):
    return [record for record in records if record.get('state') not in INACTIVE]


def merge_facts(facts):
    groups = defaultdict(list)
    for fact in facts:
        key = fact.get('key')
        if key not in LABELS:
            continue
        entity = str(fact.get('entity') or '').strip()
        period = _period(fact.get('period'))
        if key in IDENTITY_KEYS:
            entity, period = '', ''
        unit = _unit(key, fact.get('unit'))
        groups[(key, normalize(entity), period, unit)].append({**fact, 'entity': entity, 'period': period, 'unit': unit})
    records = []
    for (key, _, period, unit), values in groups.items():
        choices = {}
        for fact in values:
            if fact.get('value') is None or not str(fact['value']).strip():
                continue
            marker = ('text', normalize(fact['value']))
            parsed = number(fact['value'])
            if unit == 'KRW' and parsed is not None:
                marker = ('number', parsed)
            candidate = choices.setdefault(marker, {'value': fact['value'], 'sources': []})
            source = {'document_id': fact.get('document_id', ''), 'page': fact.get('page'), 'quote': fact.get('quote', '')}
            if source not in candidate['sources']:
                candidate['sources'].append(source)
        candidates = list(choices.values())
        confidences = [fact.get('confidence', 'low') for fact in values]
        confidence = min(confidences, key=lambda item: {'low': 0, 'medium': 1, 'high': 2}.get(item, 0))
        state = 'conflict' if len(candidates) > 1 else ('unreviewed' if candidates else 'missing')
        records.append({'id': uuid.uuid4().hex[:12], 'key': key, 'entity': values[0]['entity'],
                        'label': LABELS[key], 'value': candidates[0]['value'] if len(candidates) == 1 else None,
                        'unit': unit, 'period': period, 'confidence': confidence, 'state': state,
                        'sources': [source for candidate in candidates for source in candidate['sources']], 'candidates': candidates})
    for key in REQUIRED_KEYS:
        if not any(record['key'] == key for record in records):
            records.append({'id': uuid.uuid4().hex[:12], 'key': key, 'label': LABELS[key], 'entity': '',
                            'value': None, 'unit': _unit(key), 'period': '', 'confidence': 'low',
                            'state': 'missing', 'sources': [], 'candidates': []})
    return records


def _creditor_problem(records):
    principals = [row for row in records if row.get('key') == 'creditor_principal']
    interests = [row for row in records if row.get('key') == 'creditor_interest']
    if any(not normalize(row.get('entity')) for row in principals + interests):
        return '채권자를 식별할 수 없는 금액이 있습니다.'
    p_entities = [normalize(row['entity']) for row in principals]
    i_entities = [normalize(row['entity']) for row in interests]
    if len(set(p_entities)) != len(p_entities) or len(set(i_entities)) != len(i_entities):
        return '동일 채권자의 여러 금액·시점이 있습니다. 적용할 증빙을 선택하세요.'
    if set(p_entities) != set(i_entities):
        return '채권자별 원금과 이자의 적용 범위가 다릅니다. 없는 이자를 자동으로 0원 처리하지 않습니다.'
    interest_by_entity = {normalize(row['entity']): row for row in interests}
    for row in principals:
        other = interest_by_entity.get(normalize(row['entity']))
        left, right = _period(row.get('period')), _period(other.get('period')) if other else ''
        if left and right and left != right:
            return '같은 채권자의 원금·이자 기준기간이 다릅니다. 동일 기준 증빙을 확인하세요.'
    return ''


def calculate(records, *, proposal=False):
    records = _active(records)
    accepted_states = {'confirmed', 'proposed'} if proposal else {'confirmed'}

    def scalar(key):
        rows = [row for row in records if row.get('key') == key]
        return _numeric(rows[0]) if len(rows) == 1 and rows[0].get('state') in accepted_states else None

    calculations = []

    def emit(key, label, value, formula, sources, unit='KRW'):
        calculations.append({'key': key, 'label': label, 'value': format(value, 'f') if value is not None else None,
                             'unit': unit, 'formula': formula,
                             'status': ('proposed' if proposal else 'calculated') if value is not None else 'pending', 'sources': sources})

    with localcontext() as context:
        context.prec = 256
        totals = {}
        scope_problem = _creditor_problem(records)
        for key, name in [('creditor_principal', '채권 원금 합계'), ('creditor_interest', '채권 이자 합계')]:
            rows = [row for row in records if row.get('key') == key]
            unique = len({normalize(row.get('entity')) for row in rows}) == len(rows)
            same_scope = not scope_problem if key == 'creditor_interest' else True
            ok = rows and unique and same_scope and all(
                normalize(row.get('entity')) and row.get('state') in accepted_states and _numeric(row) is not None for row in rows)
            value = sum((_numeric(row) for row in rows), Decimal(0)) if ok else None
            totals[key] = value
            emit('debt_principal_total' if key.endswith('principal') else 'debt_interest_total', name, value,
                 '선택·확인한 채권별 금액의 합계 (다중 시점 중복 합산 안 함)', [row['id'] for row in rows])
        income, cost, fee, months = (scalar(key) for key in ('approved_monthly_income', 'recognized_living_cost', 'monthly_trustee_fee', 'repayment_months'))
        emit('monthly_business_income', '확인된 월 영업소득', income, '담당자가 증빙·기간·인정항목을 확인한 값', ['approved_monthly_income'])
        disposable = income - cost if income is not None and cost is not None and income >= cost else None
        payment = disposable - fee if disposable is not None and fee is not None and disposable >= fee else None
        total = payment * months if payment is not None and months is not None else None
        emit('monthly_disposable_income', '월 가용소득', disposable, '인정 월 영업소득 - 인정 월 생계비', ['approved_monthly_income', 'recognized_living_cost'])
        emit('monthly_payment', '월 변제예정액', payment, '월 가용소득 - 명시적으로 확인한 월 보수', ['monthly_disposable_income', 'monthly_trustee_fee'])
        emit('total_repayment', '총 변제예정액', total, '월 변제예정액 × 확인된 변제개월', ['monthly_payment', 'repayment_months'])
        principal = totals['creditor_principal']
        rate = (total / principal * 100).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP) if total is not None and principal is not None and principal > 0 else None
        emit('repayment_rate', '원금 대비 변제비율(산술 참고)', rate,
             '총 변제예정액 / 확인한 원금 합계 × 100 (소수 둘째 자리 ROUND_HALF_UP 표기)', ['total_repayment', 'debt_principal_total'], '%')
    return calculations


def propose_calculations(session):
    """Compute a separate draft view from explicit source-backed selections.

    This view never mutates records, resolves a conflict, or satisfies validate's
    confirmed-only gate. A missing fee, repayment term, or amount stays pending.
    """
    active = _active(session.get('records', []))
    record_ids = {row['id'] for row in active}
    fields = session.get('draft_fields') or {}
    if not fields and not session.get('draft_creditors'):
        return []
    inputs, provenance = [], []

    def supported(candidate):
        if not isinstance(candidate, dict) or candidate.get('status') != 'proposed':
            return False
        return bool(set(candidate.get('source_record_ids') or []).intersection(record_ids)
                    or candidate.get('source_pages'))

    def proposed_row(key, value, candidate, entity='', period=''):
        provenance.append(candidate)
        return {'id': f'draft:{key}:{entity}:{period}', 'key': key, 'value': value,
                'entity': entity, 'period': period, 'unit': _unit(key, candidate.get('unit')),
                'state': 'proposed'}

    for key in ('approved_monthly_income', 'recognized_living_cost', 'monthly_trustee_fee', 'repayment_months'):
        reviewed = [row for row in active if row.get('key') == key and row.get('state') == 'confirmed']
        if len(reviewed) == 1:
            inputs.append(reviewed[0])
            continue
        candidate = fields.get(key)
        if supported(candidate):
            inputs.append(proposed_row(key, candidate.get('value'), candidate))
    debt_rows = [row for row in active if row.get('key') in ('creditor_principal', 'creditor_interest')]
    if debt_rows and all(row.get('state') == 'confirmed' for row in debt_rows) and not _creditor_problem(debt_rows):
        inputs.extend(debt_rows)
    else:
        for creditor in session.get('draft_creditors') or []:
            if not supported(creditor):
                continue
            name = str(creditor.get('name') or creditor.get('entity') or '').strip()
            contract = str(creditor.get('contract_id') or '').strip()
            entity = f'{name} / {contract}' if contract else name
            for suffix in ('principal', 'interest'):
                inputs.append(proposed_row('creditor_' + suffix, creditor.get(suffix), creditor,
                                           entity, _period(creditor.get('period'))))
    result = calculate(inputs, proposal=True)
    for calculation in result:
        calculation['review_required'] = True
        calculation['source_record_ids'] = sorted({identifier for candidate in provenance
            for identifier in candidate.get('source_record_ids', []) if identifier in record_ids})
        calculation['source_pages'] = [page for candidate in provenance for page in candidate.get('source_pages', [])]
        calculation['formula'] += ' · 미승인 제안 입력에 대한 산술이며 사건 승인·법적 판단이 아님'
    return result


def validate(session):
    records = _active(session.get('records', []))
    session['calculations'] = calculate(records)
    session['draft_calculations'] = propose_calculations(session)
    issues = []

    def issue(code, message, record=None):
        row = {'code': code, 'severity': 'blocking', 'message': message}
        if record:
            row['record_id'] = record['id']
        issues.append(row)

    for key in REQUIRED_KEYS:
        rows = [record for record in records if record.get('key') == key]
        if not rows:
            issue('REQUIRED_MISSING', f'{LABELS[key]}: 필수 항목이 없거나 제외되었습니다. 값을 확인하세요.')
        elif len(rows) > 1:
            issue('REQUIRED_AMBIGUOUS', f'{LABELS[key]}: 하나의 적용값·기간을 선택해야 합니다.')
    for record in records:
        label = record.get('label') or LABELS.get(record.get('key'), record.get('key', '항목'))
        if record.get('state') != 'confirmed':
            issue('UNCONFIRMED', f"{label}: {'상충하는 근거 중 적용값을 확인하세요.' if record.get('state') == 'conflict' else '원본과 인정 여부를 확인하세요.'}", record)
        elif record.get('value') is None or not str(record['value']).strip():
            issue('INVALID_VALUE', f'{label}: 비어 있는 값은 확인 완료로 처리할 수 없습니다.', record)
        elif record.get('key') in MONEY_KEYS | INTEGER_KEYS and _numeric(record) is None:
            issue('INVALID_NUMBER', f'{label}: 단위가 맞는 음수 아닌 금액 또는 양의 정수 인원을 확인하세요.', record)
    creditor_problem = _creditor_problem(records)
    if creditor_problem:
        issue('CREDITOR_SCOPE', creditor_problem)
    for calculation in session['calculations']:
        if calculation['status'] == 'pending':
            issue('CALC_PENDING', calculation['label'] + ': 필요한 확정값 또는 자료 범위가 부족합니다.')
    if not session.get('template_approved'):
        issue('TEMPLATE_REVIEW', '출력 양식의 관할·버전·원본 대응과 미매핑 별지·배분 항목의 보완 여부를 확인해야 합니다.')
    rate = next((Decimal(row['value']) if row['value'] is not None else None
                 for row in session['calculations'] if row['key'] == 'repayment_rate'), None)
    if rate is not None and rate > 100:
        issue('REPAYMENT_REVIEW', '산술 변제총액이 원금을 초과합니다. 적용 범위·계획을 검토하세요.')
    session['issues'] = issues
    return session
