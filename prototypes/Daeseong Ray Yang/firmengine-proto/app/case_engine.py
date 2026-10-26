"""Pure blueprint case assessment and legacy-to-Assertion adapter.

The 84-feature reference catalog is not an implementation claim. This module
evaluates evidence requirements; exact numeric rules run in the n8n Code node.
No court decision, approval probability, or silent case mutation is produced.
"""
from __future__ import annotations

from copy import deepcopy
from collections import Counter, defaultdict
from datetime import date
from decimal import Decimal, InvalidOperation
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
RULES = ROOT / 'rules'
AXES = ('eligibility', 'evidence_completeness', 'repayment_plan', 'procedure', 'discharge_liability')
ASSET_TYPES = {'asset', 'vehicle', 'real_estate', 'insurance', 'bank_account', 'lease',
               'business_asset', 'receivable', 'securities', 'crypto', 'retirement'}
TYPE_ALIASES = {'creditor': 'debt', 'car': 'vehicle', 'property': 'real_estate',
                'bank': 'bank_account', 'deposit': 'bank_account', 'housing_deposit': 'lease'}
FLAT_FEATURES = {
    'client_name': 'person.name', 'resident_id': 'person.resident_id', 'phone': 'person.phone',
    'application_date': 'case.application_date', 'address': 'jurisdiction.residence',
    'business_address': 'jurisdiction.main_business', 'monthly_income': 'income.monthly_net',
    'approved_monthly_income': 'income.recognized_monthly_net',
    'monthly_revenue': 'income.business_revenue', 'annual_revenue': 'income.business_revenue',
    'monthly_expense': 'income.necessary_cost', 'annual_expenses': 'income.necessary_cost',
    'household_size': 'household.recognized_count', 'family_details': 'household.members[]',
    'recognized_living_cost': 'living.recognized_total', 'standard_living_cost': 'living.base_allowance',
    'housing_cost': 'living.housing_actual', 'medical_cost': 'living.medical_net',
    'education_cost': 'living.education_actual', 'repayment_months': 'plan.term_months',
    'repayment_start_date': 'plan.start_date', 'monthly_trustee_fee': 'plan.monthly_trustee_fee',
    'liquidation_value': 'plan.liquidation_floor', 'present_value': 'plan.total_present_value',
    'prior_proceedings': 'history.proceedings[]',
    'creditor_contract_id': 'debts[].origin_contract_id', 'creditor_cause': 'debts[].cause',
    'creditor_loan_date': 'debts[].incurred_at', 'creditor_principal': 'debts[].principal',
    'creditor_interest': 'debts[].interest', 'creditor_due_date': 'debts[].due_date',
    'creditor_priority_basis': 'debts[].priority_status', 'creditor_dispute_reason': 'debts[].dispute',
    'asset_kind': 'assets[].type', 'asset_value': 'assets[].gross_value',
    'asset_ownership_share': 'assets[].ownership_share', 'asset_valuation_basis': 'assets[].valuation_method',
    'asset_acquisition_date': 'assets[].acquisition_date',
}


def _read(name):
    return json.loads((RULES / name).read_text(encoding='utf-8'))


def _id(*parts):
    raw = json.dumps(parts, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:24]


def _normal(value):
    return re.sub(r'\s+', '', str(value or '')).casefold()


def _date(value):
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def _current(snapshot):
    rows = snapshot.get('assertions') or []
    superseded = {row.get('supersedes') for row in rows if row.get('supersedes')}
    return [row for row in rows if row.get('state') != 'RETRACTED'
            and (row.get('id') or row.get('assertion_id')) not in superseded]


def _selected(rows, feature, object_id=None):
    aliases = {'income.monthly_net': 'income_source.net', 'income.business_revenue': 'income_source.revenue',
               'income.necessary_cost': 'income_source.necessary_cost', 'income.period': 'income_source.period',
               'income.recurring_evidence[]': 'income_source.recurring_evidence',
               'income.sources[]': 'income_source.kind', 'jurisdiction.main_business': 'income_source.business_address'}
    keys = {feature, aliases.get(feature, feature)} if object_id else {feature}
    matches = [row for row in rows if row.get('feature_key') in keys
               and (object_id is None or row.get('object_id') == object_id)]
    if any(row.get('state') == 'DISPUTED' or row.get('identity_resolution') == 'UNRESOLVED' for row in matches):
        return None
    verified = [row for row in matches if row.get('state') == 'VERIFIED'
                and row.get('value') is not None and row.get('value') != '']
    if not verified:
        return None
    signatures = {json.dumps([row.get('value'), row.get('valid_at'), row.get('period_start'), row.get('period_end'),
                              row.get('source_period'), row.get('measurement_period'), row.get('currency'), row.get('unit')],
                             sort_keys=True, default=str) for row in verified}
    return verified[0] if len(signatures) == 1 else None


def _flat_category(key):
    return ('debt' if key.startswith(('creditor_', 'debts[].')) else 'asset' if key.startswith(('asset_', 'assets[].'))
            else 'income_source' if key.startswith('income_source.') else 'transaction' if key.startswith('transactions[].')
            else 'tax_arrears' if key.startswith('tax_arrears.') else 'case')


def _source_scope(row):
    """Field quotes and amounts are not object identifiers; source coordinates are."""
    sources = row.get('sources') or [{'document_id': row.get('document_id'), 'page': row.get('page')}]
    return tuple(sorted({(str(source.get('document_id') or ''), str(source.get('page') or ''))
                         for source in sources}))


def _entity_tags(entity):
    return {key.strip().casefold(): value.strip() for part in str(entity).split('|')
            if '=' in part for key, value in [part.split('=', 1)] if value.strip()}


def _repeat_identity(row, peers, category):
    """Prefer explicit contracts/statement rows; never equate a name with a row.

    Fact's public schema intentionally remains unchanged. The editable prompt
    carries stable row coordinates in entity; reviewed adapters may also supply
    source_row/contract_id directly. Ambiguous old records remain separate and
    cannot be silently accepted for filing.
    """
    entity = str(row.get('entity') or '').strip()
    tags = _entity_tags(entity)
    scope = _source_scope(row)
    field = FLAT_FEATURES.get(row.get('key'), row.get('key'))

    def unique_value(keys):
        values = {str(peer.get('value')).strip() for peer in peers
                  if peer.get('key') in keys and peer.get('value') not in (None, '')
                  and peer.get('state') not in ('excluded', 'rejected', 'superseded')}
        return next(iter(values)) if len(values) == 1 else None

    row_marker = row.get('source_row') or row.get('row_id') or tags.get('row')
    if category == 'transaction':
        row_marker = row_marker or (row.get('value') if field == 'transactions[].source_row' else None)
        row_marker = row_marker or unique_value({'transactions[].source_row'})
        account = row.get('account_id') or tags.get('account') or unique_value({'transactions[].account_id'})
        explicit_transaction = row.get('transaction_id') or tags.get('transaction')
        if explicit_transaction and account:
            return category + '-' + _id('transaction', account, explicit_transaction), 'EXPLICIT_TRANSACTION'
        # A row ordinal is local to its document and page, not to its counterparty.
        if row_marker and len(scope) == 1 and all(scope[0]):
            return category + '-' + _id('source-row', scope, str(row_marker)), 'SOURCE_ROW'
    else:
        contract = row.get('contract_id') or tags.get('contract')
        contract = contract or (row.get('value') if field == 'debts[].origin_contract_id' else None)
        contract = contract or unique_value({'creditor_contract_id', 'debts[].origin_contract_id'})
        creditor = tags.get('creditor') or entity
        if contract and creditor:
            return category + '-' + _id('contract', _normal(creditor), str(contract), row_marker), 'EXPLICIT_CONTRACT'
        if row_marker and len(scope) == 1 and all(scope[0]):
            return category + '-' + _id('source-row', scope, str(row_marker)), 'SOURCE_ROW'

    counts = Counter(FLAT_FEATURES.get(peer.get('key'), peer.get('key')) for peer in peers
                     if peer.get('state') not in ('excluded', 'rejected', 'superseded'))
    ambiguous = any(count > 1 for count in counts.values()) or len(row.get('candidates', [])) > 1
    # With no row marker, repeating fields cannot safely be paired by list order.
    # Retain each record, even when two same-day amounts happen to be identical.
    identity = ('unresolved', scope, _normal(entity), row.get('period') or '', row.get('id') if ambiguous else None)
    return category + '-' + _id(identity), 'UNRESOLVED'


def flat_to_assertions(records, documents, objects=None):
    """Adapt facts without merging contracts, dates, currencies, or legal axes.

    Returned IDs are stable for the same source record/value/state. A change
    creates a new Assertion ID; persistence owns supersession and review events.
    Missing legal classifications are never inferred from a creditor name.
    """
    objects = objects or []
    peer_groups = defaultdict(list)
    for row in records:
        peer_groups[(_flat_category(row.get('key', '')), _normal(row.get('entity')),
                     _source_scope(row), row.get('period') or '')].append(row)
    result = []
    for row in records:
        key = row.get('key', '')
        entity = str(row.get('entity') or '').strip()
        category = _flat_category(key)
        identity_resolution = None
        explicit = row.get('object_id')
        matched = next((obj for obj in objects if _normal(obj.get('label')) == _normal(entity)
                        and (obj.get('type') == category or category == 'asset' and obj.get('type') in ASSET_TYPES)), None) if entity else None
        if explicit:
            object_id = explicit
        elif category in ('transaction', 'debt'):
            peers = peer_groups[(category, _normal(entity), _source_scope(row), row.get('period') or '')]
            object_id, identity_resolution = _repeat_identity(row, peers, category)
        elif matched:
            object_id, category = matched['id'], matched['type']
        elif category != 'case':
            identity = row.get('contract_id') or entity or ('unidentified:' + str(row.get('id')))
            object_id = category + '-' + _id(identity)
        else:
            object_id = None
        state = {'confirmed': 'VERIFIED', 'conflict': 'DISPUTED', 'excluded': 'RETRACTED',
                 'rejected': 'RETRACTED', 'superseded': 'RETRACTED', 'unreviewed': 'EXTRACTED'}.get(row.get('state'), 'REPORTED')
        period = row.get('period') or ''
        feature = FLAT_FEATURES.get(key, key if '.' in key else 'form.' + key)
        assertion = {'id': 'assertion-' + _id(row.get('id'), feature, row.get('value'), state, period),
            'record_id': 'legacy-' + _id(row.get('id'), feature),
            'object_id': object_id, 'object_type': category, 'object_label': entity,
            'feature_key': feature, 'value': row.get('value'),
            'currency': 'KRW' if row.get('unit') in ('KRW', '원', 'won') else row.get('currency'),
            'unit': row.get('unit') or '', 'state': state, 'precision': row.get('precision', 'UNSPECIFIED'),
            'valid_at': _date(period).isoformat() if _date(period) else None,
            'source_period': period, 'recorded_at': row.get('reviewed_at') or row.get('recorded_at'),
            'evidence_refs': [{'document_id': source.get('document_id'), 'page': source.get('page'),
                               'excerpt': source.get('quote') or source.get('excerpt') or ''}
                              for source in row.get('sources', [])],
            'supersedes': row.get('supersedes'), 'accepted_for_filing': state == 'VERIFIED' and identity_resolution != 'UNRESOLVED',
            'legacy_record_id': row.get('id'), 'legacy_key': key}
        if identity_resolution:
            assertion['identity_resolution'] = identity_resolution
        if key.startswith('monthly_'):
            assertion['measurement_period'] = 'MONTHLY'
        elif key.startswith('annual_'):
            assertion['measurement_period'] = 'ANNUAL'
        result.append(assertion)
        if category == 'debt' and entity and feature != 'debts[].current_creditor_id':
            creditor_name = _entity_tags(entity).get('creditor') or entity
            result.append({**assertion, 'id': assertion['id'] + '-creditor',
                           'record_id': assertion['record_id'] + '-creditor',
                           'feature_key': 'debts[].current_creditor_id', 'value': creditor_name, 'unit': ''})
        if category == 'debt' and key in ('creditor_principal', 'creditor_interest') and _date(period):
            result.append({**assertion, 'id': assertion['id'] + '-date',
                           'record_id': assertion['record_id'] + '-date',
                           'feature_key': 'debts[].amount_as_of', 'value': period, 'unit': ''})
    return result


def _objects(snapshot, rows):
    objects = {obj['id']: deepcopy(obj) for obj in snapshot.get('objects', [])}
    for row in rows:
        oid = row.get('object_id')
        if not oid or oid in objects:
            continue
        feature = row.get('feature_key', '')
        kind = ('debt' if feature.startswith('debts[]') else 'asset' if feature.startswith('assets[]')
                else 'income_source' if feature.startswith('income_source.')
                else 'transaction' if feature.startswith('transactions[]')
                else 'tax_arrears' if feature.startswith('tax_arrears.') else row.get('object_type'))
        if kind and kind != 'case':
            objects[oid] = {'id': oid, 'type': kind, 'label': row.get('object_label') or oid, 'metadata': {}}
    for obj in objects.values():
        obj['type'] = TYPE_ALIASES.get(obj.get('type'), obj.get('type'))
    return list(objects.values())


def _period(snapshot, obj, rule):
    policy = rule['period_policy']
    if policy == 'income_evidence_period':
        value = (obj.get('metadata') or {}).get('income_evidence_period') or snapshot.get('income_evidence_period') or {}
        start, end = _date(value.get('start')), _date(value.get('end'))
        return {'start': value.get('start'), 'end': value.get('end'), 'resolved': bool(start and end and start <= end)}
    as_of = (obj.get('metadata') or {}).get('valuation_as_of') if policy == 'valuation_as_of' else None
    as_of = as_of or snapshot.get('application_date')
    return {'start': None, 'end': None, 'as_of': as_of, 'resolved': bool(_date(as_of))}


def _document_matches(document, subject, period):
    if subject and document.get('subject_id') != subject:
        return False
    if str(document.get('mapping_status', '')).upper() not in ('VERIFIED', 'MAPPED', 'REVIEWED'):
        return False
    if period.get('start') and (not document.get('period_start') or document['period_start'] > period['start']):
        return False
    if period.get('end') and (not document.get('period_end') or document['period_end'] < period['end']):
        return False
    return True


def _alternatives_met(alternatives, available, unavailable):
    for alternative in alternatives:
        condition = alternative.get('condition')
        if condition == 'primary_unavoidably_unavailable' and not unavailable:
            continue
        if condition == 'primary_available' and unavailable:
            continue
        if alternative.get('all_of') and set(alternative['all_of']) <= available:
            return True
        if any(({group} if isinstance(group, str) else set(group)) <= available for group in alternative.get('any_of', [])):
            return True
    return False


def evaluate_case(snapshot):
    """Return a revision-bound assessment, requirements, RuleGaps and next actions."""
    release = snapshot.get('rule_release') or _read('release.json')
    mapping = _read('document_feature_mappings.json')
    rows = _current(snapshot)
    objects = _objects(snapshot, rows)
    income_type = {'salary': 'wage', 'salaried': 'wage'}.get(snapshot.get('income_type'), snapshot.get('income_type') or 'unknown')
    findings, requirements, actions = [], [], []

    def finding(code, message, *, features=(), object_id=None, outcome='UNKNOWN', severity='review', rule_id=None, blocking=True, period=None):
        item = {'id': 'finding-' + _id(snapshot.get('id'), code, rule_id, object_id, period, list(features)),
                'kind': 'RuleGap' if outcome == 'UNKNOWN' else 'RuleFinding', 'code': code,
                'rule_id': rule_id or code, 'rule_release_id': release['id'], 'case_revision': snapshot.get('revision'),
                'object_id': object_id, 'feature_keys': list(features), 'outcome': outcome,
                'severity': severity, 'message': message, 'not_a_denial_rule': True,
                'blocks_generation': blocking, 'period': period}
        findings.append(item)
        return item

    application = _date(snapshot.get('application_date'))
    if not application:
        finding('APPLICATION_DATE_UNKNOWN', '신청일·예정일을 확인하여 적용 규칙과 자료 기준일을 정하세요.', features=['case.application_date'])
    if snapshot.get('court_id') not in ('seoul', 'KR-SEOUL'):
        finding('JURISDICTION_UNSUPPORTED', '현재 규칙은 서울 관할 참고 범위입니다. 해당 관할 규칙 검토가 필요합니다.')
    if snapshot.get('rule_release_id') and snapshot['rule_release_id'] != release['id']:
        finding('RULE_VERSION_UNSUPPORTED', '지정한 규칙 버전이 로드된 규칙과 다릅니다. 적용 버전을 확인하세요.')
    start, end = _date(release.get('effective_from')), _date(release.get('effective_to'))
    if application and ((start and application < start) or (end and application > end)):
        finding('RULE_DATE_UNSUPPORTED', '신청일이 선택한 규칙 버전의 적용기간 밖에 있습니다.')
    if str(release.get('status', '')).upper() not in ('ACTIVE', 'VERIFIED', 'APPROVED'):
        finding('RULE_RELEASE_REVIEW', '현재 규칙은 설계 참고 판본입니다. 공식 원문·시행일·예외를 확인한 배포판이 필요합니다.')
    if income_type not in ('business', 'wage', 'mixed'):
        finding('INCOME_TYPE_UNKNOWN', '급여·사업·혼합 소득 유형을 확인하세요.', features=['income.sources[]'])

    for obj in objects:
        ambiguous = [row for row in rows if row.get('object_id') == obj['id']
                     and row.get('identity_resolution') == 'UNRESOLVED']
        if not ambiguous:
            continue
        flag = finding('REPEATED_ENTITY_IDENTITY_UNKNOWN',
            '이름만으로 거래·대출을 합치지 않았습니다. 원본의 거래 행·일시 또는 계약 식별자로 대상 연결을 확인하세요.',
            features=sorted({row['feature_key'] for row in ambiguous}), object_id=obj['id'],
            blocking=obj.get('type') == 'debt', severity='review' if obj.get('type') == 'debt' else 'warning')
        actions.append({'type': 'VERIFY_OBJECT_IDENTITY', 'object_id': obj['id'], 'status': 'OPEN',
                        'issue_id': flag['id'], 'message': flag['message'], 'continues_extraction': True})

    for rule in mapping['requirements']:
        scope = rule['scope']
        subjects = [{'id': None, 'metadata': {}}] if scope == 'case' and income_type in rule.get('income_types', []) else []
        source_objects = [obj for obj in objects if obj.get('type') == 'income_source']
        if rule['id'] in ('salary_income', 'business_registration', 'business_income') and source_objects:
            allowed = {'wage', 'salary'} if rule['id'] == 'salary_income' else {'business'}
            subjects = [obj for obj in source_objects if any(row.get('object_id') == obj['id']
                        and row.get('feature_key') == 'income_source.kind' and str(row.get('value')).lower() in allowed for row in rows)]
        subjects += [obj for obj in objects if obj.get('type') == scope or scope == 'asset'
                     and obj.get('type') in ASSET_TYPES - {'vehicle', 'real_estate', 'insurance', 'bank_account', 'lease'}]
        if rule.get('source_kinds'):
            subjects = [obj for obj in subjects if any(row.get('object_id') == obj['id']
                        and row.get('feature_key') == 'income_source.kind' and str(row.get('value')).lower() in rule['source_kinds'] for row in rows)]
        for obj in subjects:
            subject, period = obj.get('id'), _period(snapshot, obj, rule)
            missing = [feature for feature in rule['purpose_features'] if _selected(rows, feature, subject) is None]
            available_docs = [doc for doc in snapshot.get('documents', []) if _document_matches(doc, subject, period)]
            available_types = {doc.get('document_type') for doc in available_docs}
            unavailable = bool((obj.get('metadata') or {}).get('primary_unavoidably_unavailable')
                               or snapshot.get('primary_income_document_unavailable'))
            doc_ok = _alternatives_met(rule['alternatives'], available_types, unavailable)
            available_ids = {doc['id'] for doc in available_docs}
            evidence_missing = [feature for feature in rule['purpose_features']
                                if (selected := _selected(rows, feature, subject)) and not any(
                                    ref.get('document_id') in available_ids for ref in selected.get('evidence_refs', []))]
            status = 'SATISFIED' if doc_ok and not missing and not evidence_missing and period['resolved'] else (
                'NEEDS_VERIFICATION' if doc_ok else 'MISSING_EVIDENCE')
            requirement = {**deepcopy(rule), 'requirement_id': 'requirement-' + _id(snapshot.get('id'), rule['id'], subject, period),
                           'subject_id': subject, 'period': period, 'status': status,
                           'missing_features': missing, 'features_without_evidence': evidence_missing,
                           'matched_document_ids': [doc['id'] for doc in available_docs],
                           'request_again': not doc_ok, 'case_revision': snapshot.get('revision')}
            requirements.append(requirement)
            if status != 'SATISFIED':
                gap = finding('EVIDENCE_REQUIREMENT', rule['label'] + ': 자료 범위·필수 내용·검증 상태를 확인하세요.',
                              features=missing or evidence_missing, object_id=subject, rule_id=rule['id'], period=period)
                gap['requirement_id'] = requirement['requirement_id']
                actions.append({'type': 'VERIFY_EXISTING_EVIDENCE' if doc_ok else 'REQUEST_EVIDENCE',
                                'requirement_id': requirement['requirement_id'], 'object_id': subject,
                                'message': gap['message'], 'status': 'OPEN'})

    for feature in ('coverage.debt_inventory', 'coverage.asset_inventory'):
        item = _selected(rows, feature)
        if item is None or str(item['value']).upper() not in ('COMPLETE', 'VERIFIED_COMPLETE'):
            finding('INVENTORY_COVERAGE_UNKNOWN', '채무·재산 조사의 완전성과 조회범위를 확인하세요.', features=[feature])
    source_objects = [obj for obj in objects if obj.get('type') == 'income_source']
    if source_objects:
        coverage = _selected(rows, 'coverage.income_sources')
        if not coverage or str(coverage['value']).upper() not in ('COMPLETE', 'VERIFIED_COMPLETE'):
            finding('INCOME_SOURCE_COVERAGE_UNKNOWN', '여러 직장·사업·임대·금융·연금·급여 등 소득원의 누락 여부를 확인하세요.', features=['coverage.income_sources'])
        for obj in source_objects:
            kind = _selected(rows, 'income_source.kind', obj['id'])
            if not kind:
                finding('INCOME_SOURCE_KIND_UNKNOWN', '입금의 출처와 소득 성질을 확인하세요. 신규대출·본인 계좌이체를 소득으로 합산하지 않습니다.',
                        object_id=obj['id'], features=['income_source.kind'])
    for obj in objects:
        if obj.get('type') != 'tax_arrears':
            continue
        needed = ['tax_arrears.authority', 'tax_arrears.tax_type', 'tax_arrears.period', 'tax_arrears.amount',
                  'tax_arrears.due_date', 'tax_arrears.collection_status', 'tax_arrears.deferral_status',
                  'tax_arrears.priority_status', 'tax_arrears.estate_claim_status', 'tax_arrears.non_discharge_ground']
        missing = [key for key in needed if not _selected(rows, key, obj['id'])]
        tax_docs = [doc for doc in snapshot.get('documents', []) if doc.get('subject_id') == obj['id']
                    and str(doc.get('mapping_status', '')).upper() in ('VERIFIED', 'MAPPED', 'REVIEWED')]
        doc_types = {doc.get('document_type') for doc in tax_docs}
        needed_docs = {'tax_certificate', 'tax_arrears_detail'}
        deferral = _selected(rows, 'tax_arrears.deferral_status', obj['id'])
        if deferral and str(deferral['value']).upper() not in ('NONE', 'FALSE', 'NO', '없음', '해당없음'):
            needed_docs.add('tax_deferral_decision')
        doc_ok = needed_docs <= doc_types
        requirement_id = 'requirement-' + _id(snapshot.get('id'), obj['id'], 'tax-arrears-classification')
        requirements.append({'id': 'tax_arrears', 'requirement_id': requirement_id, 'subject_id': obj['id'],
            'label': '세목·귀속기간·납부기한·징수·유예 및 법적 분류 확인', 'purpose_features': needed,
            'period': {'as_of': snapshot.get('application_date')}, 'alternatives': [{'all_of': sorted(needed_docs)}],
            'legal_basis': ['K10', 'K19', 'K20'], 'document_basis': 'CONDITIONAL_ATTACHMENT',
            'status': 'SATISFIED' if doc_ok and not missing else 'NEEDS_VERIFICATION' if doc_ok else 'MISSING_EVIDENCE',
            'missing_features': missing, 'request_again': not doc_ok, 'matched_document_ids': [doc['id'] for doc in tax_docs]})
        if missing or not doc_ok:
            finding('TAX_ARREARS_CLASSIFICATION', '체납을 일괄 기각·전액납부 조건으로 처리하지 않습니다. 세목·기한·징수·유예 자료와 재단/우선/비면책을 각각 확인하세요.',
                    features=missing, object_id=obj['id'])
            actions.append({'type': 'VERIFY_EXISTING_EVIDENCE' if doc_ok else 'REQUEST_EVIDENCE', 'status': 'OPEN',
                            'object_id': obj['id'], 'requirement_id': requirement_id,
                            'message': '납세증명·체납상세를 확인하고 유예 주장 시 유예결정·납부계획 증빙을 추가하세요.'})
    for obj in objects:
        if obj.get('type') != 'transaction':
            continue
        outflows = [row for row in rows if row.get('object_id') == obj['id'] and row.get('feature_key') == 'transactions[].outflow']
        for outflow in outflows:
            try:
                raw = outflow.get('value')
                amount = Decimal(raw) if isinstance(raw, str) and re.fullmatch(r'\d+(?:\.\d+)?', raw) and len(raw) <= 65 else None
            except InvalidOperation:
                amount = None
            if amount is None or amount < Decimal('500000'):
                continue
            explained = all(_selected(rows, feature, obj['id']) for feature in ('transactions[].counterparty', 'transactions[].purpose'))
            if explained:
                continue
            flag = finding('LARGE_OUTFLOW_INQUIRY', '50만원 이상 출금의 상대방·용도·관련 증빙을 확인하세요. 법원 기각 조건이 아닌 사무소 사전검토 경고입니다.',
                           features=['transactions[].counterparty', 'transactions[].purpose'], object_id=obj['id'],
                           severity='warning', rule_id='FIRM.OUTFLOW_GE_500000', blocking=False)
            flag.update(authority='FIRM_POLICY', source_ids=['USER_REQUIREMENT'], evidence_refs=outflow.get('evidence_refs', []))
            actions.append({'type': 'TRANSACTION_INQUIRY', 'object_id': obj['id'], 'status': 'OPEN',
                            'issue_id': flag['id'], 'message': flag['message'], 'continues_extraction': True})
    for row in rows:
        if row.get('state') == 'DISPUTED':
            finding('ASSERTION_DISPUTED', '상충하는 주장의 근거와 적용 시점을 대조하세요.',
                    features=[row['feature_key']], object_id=row.get('object_id'))
    for obj in objects:
        if obj.get('type') not in ASSET_TYPES:
            continue
        oid = obj['id']
        if obj.get('type') in ('vehicle', 'real_estate') and any(_selected(rows, key, oid) is None for key in (
                'assets[].gross_value', 'assets[].valuation_as_of', 'assets[].valuation_method')):
            actions.append({'type': 'VALUATION_LOOKUP', 'object_id': oid, 'asset_type': obj['type'],
                            'status': 'OPEN', 'requires_source_url_and_date': True,
                            'message': '동일 물건 조건의 시세 근거를 조회하고 평가 후보로 등록하세요. 자동 법적 가액 인정은 하지 않습니다.'})
        disposal = (obj.get('metadata') or {}).get('disposal_proposed')
        if disposal or any(row.get('object_id') == oid and row.get('feature_key') == 'assets[].disposal_history[]' for row in rows):
            actions.append({'type': 'DISPOSAL_STRATEGY_REVIEW', 'object_id': oid, 'status': 'OPEN',
                            'required_features': ['assets[].disposal_history[]', 'assets[].successor_asset_ids'],
                            'required_details': ['sale_price', 'secured_debt_paid', 'costs', 'net_proceeds', 'successor_asset_ids', 'funding_use'],
                            'message': '처분 전후 자산·담보상환·대금·대체재산·변제재원을 함께 비교하세요. 자산 삭제만으로 청산가치를 낮추지 않습니다.'})

    calculation = snapshot.get('calculation_results') or {}
    results = calculation.get('results', []) if isinstance(calculation, dict) else calculation
    if isinstance(calculation, dict) and calculation and calculation.get('case_revision') != snapshot.get('revision'):
        finding('CALCULATION_STALE', '계산이 현재 사건 버전과 다릅니다. n8n 계산을 다시 실행하세요.')
        results = []
    if isinstance(calculation, dict) and calculation and calculation.get('rule_release_id') != release['id']:
        finding('CALCULATION_RULE_VERSION_MISMATCH', '계산 결과의 규칙 버전과 현재 사건의 적용 버전이 다릅니다.')
        results = []
    if isinstance(calculation, dict) and calculation and calculation.get('computed_by') != 'n8n-code':
        finding('CALCULATION_EXECUTOR_UNVERIFIED', 'n8n Code 계산 단계의 결과인지 확인하세요.')
        results = []
    current_ids = {row.get('id') or row.get('assertion_id') for row in rows}
    if any(set(result.get('input_assertion_ids') or []) - current_ids for result in results):
        finding('CALCULATION_SOURCE_STALE', '계산에 사용한 주장 ID가 현재 사건의 검증 자료와 다릅니다. 저장 후 n8n 계산을 다시 실행하세요.')
        results = []
    required_rules = set(_read('release.json')['implemented_numeric_rules'])
    absent_rules = required_rules - {item.get('rule_id') for item in results}
    if results and absent_rules:
        finding('CALCULATION_INCOMPLETE', '필수 계산 항목의 결과가 빠졌습니다. 해당 조건의 비적용 여부도 명시해야 합니다.', features=sorted(absent_rules))
    for result in results:
        if result.get('outcome') in ('UNKNOWN', 'FAIL'):
            finding(result.get('reason_code', 'CALCULATION_REVIEW'),
                    '계산 요건의 입력·적용범위 또는 부족액을 검토하세요.',
                    features=result.get('missing_features', []), outcome=result['outcome'],
                    severity='strategy' if result['outcome'] == 'FAIL' else 'review', rule_id=result.get('rule_id'))
    if not results:
        finding('CALCULATION_REQUIRED', '현재 사건 스냅샷으로 n8n 결정론적 계산을 실행하세요.')
    checklist = _risk_checklist(snapshot, rows, objects, findings, requirements)
    for check in checklist:
        if check['blocks_generation'] and not check['finding_ids']:
            gap = finding('CATALOG_CONDITION_UNRESOLVED', check['title'] + ': 필수 항목의 해당성과 근거를 확인하세요.',
                          features=check['required_features'], rule_id=check['risk_id'])
            gap.update(authority=check['authority'], source_ids=check['source_ids'])
            check['finding_ids'] = [gap['id']]
            actions.append({'type': 'VERIFY_REQUIRED_CONDITION', 'status': 'OPEN', 'issue_id': gap['id'],
                            'risk_id': check['risk_id'], 'message': gap['message']})
    failed = [row for row in findings if row['outcome'] == 'FAIL' and row.get('blocks_generation')]
    unresolved = [row for row in findings if row['outcome'] == 'UNKNOWN' and row.get('blocks_generation')]
    route = 'STRATEGY_REVIEW' if failed else 'SUPPLEMENT' if unresolved else 'DRAFT'
    if failed:
        actions.append({'type': 'STRATEGY_REVIEW', 'status': 'OPEN',
                        'message': '수치 부족·위험의 근거를 안내하고 추가증빙·평가 정정·실제 재원·허용기간을 검토하세요. 인가 가능성 수치로 표현하지 않습니다.',
                        'finding_ids': [row['id'] for row in failed]})
    assessment = {
        'eligibility': {'status': 'NUMERIC_REVIEW_REQUIRED' if failed else 'PARTIAL_CHECK_ONLY', 'not_court_decision': True},
        'evidence_completeness': {'status': 'DISPUTED' if any(row.get('state') == 'DISPUTED' for row in rows) else 'MISSING' if unresolved else 'CHECKED',
                                  'satisfied_requirements': sum(row['status'] == 'SATISFIED' for row in requirements), 'total_requirements': len(requirements)},
        'repayment_plan': {'status': 'MODIFICATION_REQUIRED' if failed else 'UNDETERMINED' if unresolved else 'DRAFT_READY'},
        'procedure': {'status': 'OPEN_ACTIONS' if actions else 'PARTIAL_CHECK_ONLY'},
        'discharge_liability': {'status': 'LEGAL_REVIEW_REQUIRED', 'note': '비면책·보증·담보·누락 책임의 종합판단은 자동화하지 않습니다.'},
    }
    dependencies = {'case_revision': snapshot.get('revision'), 'rule_release_id': release['id'],
                    'assertion_ids': [row.get('id') for row in rows],
                    'feature_keys': sorted({key for row in requirements for key in row['purpose_features']}),
                    'missing_feature_keys': sorted({key for row in requirements for key in row['missing_features']}),
                    'collections': ['debts', 'assets', 'documents', 'assertions'],
                    'collection_revisions': snapshot.get('collection_revisions', {}),
                    'object_ids': [obj['id'] for obj in objects]}
    blocking = [row['id'] for row in findings if row.get('blocks_generation')]
    warning = [row['id'] for row in findings if not row.get('blocks_generation')]
    warning += [row['risk_id'] for row in checklist if not row['blocks_generation'] and row['outcome'] in ('risk', 'needs_review')]
    gate = {'can_generate': not blocking, 'blocking_issue_ids': blocking, 'warning_issue_ids': warning,
            'reason': '필수 조건의 확인이 필요합니다.' if blocking else '필수 조건 확인됨. 미해결 경고와 검토 이력을 함께 제공하는 초안을 생성할 수 있습니다.',
            'rule_release_id': release['id'], 'case_revision': snapshot.get('revision')}
    return {'assessment': assessment, 'findings': findings, 'requirements': requirements,
            'issues': findings, 'actions': actions, 'route': route, 'dependencies': dependencies,
            'generation_gate': gate, 'risk_checklist': checklist, 'risk_history': deepcopy(snapshot.get('risk_history', [])),
            'implemented_numeric_rules': _read('release.json')['implemented_numeric_rules'], 'reference_feature_count': 84}


def _risk_checklist(snapshot, rows, objects, findings, requirements):
    """Account for every published catalog entry, including unimplemented/manual checks."""
    path = ROOT / 'knowledge' / 'bootstrap' / 'correction_catalog.json'
    if not path.exists():
        return [{'risk_id': 'CATALOG_PENDING', 'title': '보정·이상 징후 카탈로그 준비',
                 'outcome': 'needs_review', 'applicability': 'unknown', 'severity': 'warning',
                 'blocks_generation': True, 'authority': 'FIRM_POLICY', 'source_ids': [],
                 'finding_ids': [], 'required_features': [],
                 'note': '카탈로그가 아직 등록되지 않아 전체 점검 완료로 표시하지 않습니다.'}]
    catalog = json.loads(path.read_text(encoding='utf-8'))
    entries = catalog if isinstance(catalog, list) else catalog.get('entries') or catalog.get('checks') or catalog.get('risks') or []
    output = []
    for entry in entries:
        rid = entry.get('id') or entry.get('risk_id')
        features = entry.get('required_features') or []
        condition = entry.get('applicability') or {}
        condition = condition if isinstance(condition, dict) else {}
        check = entry.get('check_type', 'manual')
        applicable = 'unknown'
        if condition.get('income_types'):
            income = {'salary': 'wage', 'salaried': 'wage'}.get(snapshot.get('income_type'), snapshot.get('income_type'))
            applicable = income in condition['income_types'] if income in ('wage', 'business', 'mixed') else 'unknown'
        if condition.get('object_types'):
            kinds = set(condition['object_types'])
            if 'asset' in kinds:
                kinds |= ASSET_TYPES
            applicable = any(obj.get('type') in kinds for obj in objects)
        if condition.get('feature_present'):
            applicable = any(row.get('feature_key') == condition['feature_present'] for row in rows)
        linked = [item for item in findings if item.get('rule_id') == rid or item.get('code') == rid
                  or features and set(features).intersection(item.get('feature_keys', []))]
        if check == 'transaction_outflow':
            applicable = any(obj.get('type') == 'transaction' for obj in objects)
            linked = [item for item in findings if item['code'] == 'LARGE_OUTFLOW_INQUIRY']
        elif check == 'tax_arrears':
            applicable = any(obj.get('type') == 'tax_arrears' for obj in objects)
            linked = [item for item in findings if item['code'] == 'TAX_ARREARS_CLASSIFICATION']
        elif check == 'income_sources':
            applicable = True
            linked = [item for item in findings if item['code'].startswith('INCOME_')]
            if not any(obj.get('type') == 'income_source' for obj in objects) and not _selected(rows, 'income.sources[]'):
                applicable = 'unknown'
        elif check == 'document_requirement':
            rule_ids = {'DOC-15': {'salary_income'}, 'DOC-16': {'business_registration', 'business_income'}}.get(rid, set())
            related = [req for req in requirements if req['id'] in rule_ids or features and set(features).intersection(req['purpose_features'])]
            related_ids = {req['requirement_id'] for req in related}
            linked = [item for item in findings if item.get('requirement_id') in related_ids]
        elif check == 'asset_valuation':
            applicable = any(obj.get('type') in ASSET_TYPES for obj in objects)
            asset_ids = {obj['id'] for obj in objects if obj.get('type') in ASSET_TYPES}
            linked = [item for item in findings if item.get('object_id') in asset_ids and set(features).intersection(item.get('feature_keys', []))]
        elif check == 'asset_disposal':
            applicable = any((obj.get('metadata') or {}).get('disposal_proposed') for obj in objects) or any(row['feature_key'] == 'assets[].disposal_history[]' for row in rows)
        def feature_verified(feature):
            if feature.startswith('income_source.'):
                subjects = [obj['id'] for obj in objects if obj.get('type') == 'income_source']
                if feature == 'income_source.employer':
                    subjects = [oid for oid in subjects if (kind := _selected(rows, 'income_source.kind', oid)) and str(kind['value']).lower() in ('wage', 'salary')]
                return all(_selected(rows, feature, oid) for oid in subjects) if subjects else bool(_selected(rows, feature))
            if feature.startswith('assets[].'):
                subjects = [obj['id'] for obj in objects if obj.get('type') in ASSET_TYPES]
                return bool(subjects) and all(_selected(rows, feature, oid) for oid in subjects)
            return bool(_selected(rows, feature))
        if applicable is False:
            outcome = 'not_applicable'
        elif linked:
            outcome = 'risk' if any(item['outcome'] == 'FAIL' or item['code'] == 'LARGE_OUTFLOW_INQUIRY' for item in linked) else 'needs_review'
            applicable = True
        elif check in ('transaction_outflow', 'tax_arrears', 'income_sources') and applicable is True:
            outcome = 'clear'
        elif check == 'document_requirement' and applicable is True and related and all(req['status'] == 'SATISFIED' for req in related):
            outcome = 'clear'
        elif features and all(feature_verified(feature) for feature in features) and applicable is True and check != 'manual':
            outcome = 'clear'
        else:
            outcome = 'needs_review'
        history = [item for item in snapshot.get('risk_history', []) if item.get('risk_id') == rid]
        if outcome == 'clear' and any(item.get('outcome') in ('risk', 'needs_review') for item in history):
            outcome = 'resolved'
        output.append({'risk_id': rid, 'title': entry.get('title') or entry.get('label') or rid,
            'outcome': outcome, 'applicability': applicable, 'severity': entry.get('severity', 'warning'),
            'blocks_generation': any(item.get('blocks_generation') for item in linked) or (
                entry.get('blocking_policy') == 'mandatory_when_applicable' and applicable is not False and outcome in ('risk', 'needs_review')),
            'authority': entry.get('authority'), 'source_ids': entry.get('source_ids') or entry.get('legal_source_ids') or [],
            'finding_ids': [item['id'] for item in linked], 'required_features': features,
            'check_type': check, 'catalog_status': entry.get('status', 'REVIEW_REQUIRED'),
            'note': '미구현·재량 조건은 검토 필요로 남기며 자동으로 안전하다고 판단하지 않습니다.' if check == 'manual' else ''})
    return output


def n8n_code_source():
    """Return the exact shared calculator code plus the n8n item adapter."""
    source = (ROOT / 'workflows' / 'calculators.js').read_text(encoding='utf-8')
    return source + '\nreturn $input.all().map(item => ({json: {...item.json, calculation_results: calculateCase(item.json.snapshot || item.json)}}));\n'
