"""Bounded vision extraction with private, session-scoped structured call journals."""
import asyncio
import base64
from collections import defaultdict
from contextlib import asynccontextmanager, contextmanager
import json
import math
from pathlib import Path
import re
import secrets
import threading
import time
import unicodedata
from typing import Literal

import fitz
import httpx
from pydantic import BaseModel, ConfigDict, ValidationError

from . import config, promptbook


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid')


class Fact(StrictModel):
    key: str
    entity: str
    value: str | None
    unit: str
    period: str
    document_id: str
    page: int
    quote: str
    confidence: Literal['high', 'medium', 'low']


class OCRPage(StrictModel):
    document_id: str
    page: int
    title: str
    kind: str
    transcript: str


class Extraction(StrictModel):
    facts: list[Fact]
    warnings: list[str]
    pages: list[OCRPage]


class ExtractedFacts(list):
    """Remain compatible with fact-list consumers while retaining private OCR pages."""

    def __init__(self, facts, pages, *, missing_features=None, warnings=None):
        super().__init__(facts)
        self.pages = pages
        self.missing_features = missing_features or []
        self.warnings = warnings or []


class PageRole(StrictModel):
    document_id: str
    page: int
    role: Literal['evidence', 'filed_form', 'administrative', 'unknown']
    title: str
    document_type: str


class Classification(StrictModel):
    pages: list[PageRole]


class SharedCallSemaphore:
    """Process-wide counting semaphore; limits can change without replacing active slots."""

    def __init__(self):
        self.lock = threading.Lock()
        self.tickets = {}

    def register(self, agent, limits):
        token = secrets.token_hex(12)
        with self.lock:
            self.tickets[token] = {'agent': agent, 'global': limits.global_concurrency,
                                   'limit': limits.agent_concurrency, 'active': False}
        return token

    def acquire_nowait(self, token):
        with self.lock:
            entry = self.tickets[token]
            active = [item for item in self.tickets.values() if item['active']]
            global_limit = min(item['global'] for item in self.tickets.values())
            agent_limit = min(item['limit'] for item in self.tickets.values() if item['agent'] == entry['agent'])
            if len(active) >= global_limit or sum(item['agent'] == entry['agent'] for item in active) >= agent_limit:
                return False
            entry['active'] = True
            return True

    def remove(self, token):
        with self.lock:
            self.tickets.pop(token, None)


CALL_SEMAPHORE = SharedCallSemaphore()


@asynccontextmanager
async def provider_slot(agent, limits=None):
    """Other async model callers can share the same process-wide provider capacity."""
    limits = limits or promptbook.runtime_config(agent)
    token = CALL_SEMAPHORE.register(agent, limits)
    started = time.monotonic()
    try:
        while not CALL_SEMAPHORE.acquire_nowait(token):
            if time.monotonic() - started >= limits.queue_timeout_seconds:
                raise TimeoutError('model_queue_timeout')
            await asyncio.sleep(0.025)
        yield round((time.monotonic() - started) * 1000)
    finally:
        CALL_SEMAPHORE.remove(token)


@contextmanager
def provider_slot_sync(agent, limits=None):
    """Synchronous callers share exactly the same capacity as async extraction."""
    limits = limits or promptbook.runtime_config(agent)
    token = CALL_SEMAPHORE.register(agent, limits)
    started = time.monotonic()
    try:
        while not CALL_SEMAPHORE.acquire_nowait(token):
            if time.monotonic() - started >= limits.queue_timeout_seconds:
                raise TimeoutError('model_queue_timeout')
            time.sleep(0.025)
        yield round((time.monotonic() - started) * 1000)
    finally:
        CALL_SEMAPHORE.remove(token)


def estimate_input_tokens(instructions, content, schema, image_tokens):
    """Conservative planning estimate, not provider billing or a tokenizer guarantee."""
    texts = instructions + json.dumps(schema, ensure_ascii=False)
    images = 0
    for part in content:
        if part.get('type') == 'input_text':
            texts += part.get('text', '')
        elif part.get('type') == 'input_image':
            images += 1
    return math.ceil(len(texts.encode('utf-8')) / 2) + images * image_tokens + 200


def page_image(path, page: int, size: int = 1800) -> bytes:
    with fitz.open(path) as pdf:
        p = pdf[page - 1]
        scale = size / max(p.rect.width, p.rect.height)
        return p.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False).tobytes('jpeg', jpg_quality=88)


def content_for_pages(items, size=1800):
    content = []
    for doc, page in items:
        content.append({'type': 'input_text', 'text': f"DOCUMENT_ID={doc['id']} PAGE={page}"})
        physical_page = doc.get('_page_map', {}).get(page, page)
        image = page_image(doc['_path'], physical_page, size)
        content.append({'type': 'input_image', 'image_url': 'data:image/jpeg;base64,' + base64.b64encode(image).decode(), 'detail': 'high'})
    return content


async def ask_json(instructions, content, schema, metrics):
    bundle = getattr(content, 'promptbook', None)
    limits = bundle.runtime if bundle else promptbook.PromptConfig(
        version='legacy', model='configured', reasoning_effort='low', max_output_tokens=16000, image_long_edge=1800)
    journal = promptbook.start_trace(bundle, getattr(content, 'trace_context', None), instructions) if bundle else None
    estimated = estimate_input_tokens(instructions, content, bundle.output_schema if bundle else schema.model_json_schema(), limits.image_token_estimate)
    if estimated > limits.max_input_tokens:
        promptbook.trace_event(journal, 'failed', error_code='estimated_input_limit', estimated_input_tokens=estimated)
        promptbook.finish_trace(journal, status='failed', error_code='estimated_input_limit')
        raise RuntimeError('예상 입력 토큰이 에이전트 한도를 초과했습니다. 배치 페이지·참고 문맥을 줄이세요.')
    if not config.API_KEY:
        promptbook.trace_event(journal, 'failed', error_code='missing_api_key')
        promptbook.finish_trace(journal, status='failed', error_code='missing_api_key')
        raise RuntimeError('OPENAI_API_KEY 또는 OPEN_AI_API_KEY가 .env에 필요합니다.')
    if bundle is not None:
        promptbook.record_usage(metrics, bundle)
    payload = {'model': bundle.model if bundle else config.MODEL,
               'store': False, 'reasoning': {'effort': bundle.reasoning_effort if bundle else 'low'},
               'max_output_tokens': bundle.max_output_tokens if bundle else 16000, 'instructions': instructions,
               'input': [{'role': 'user', 'content': content}],
               'text': {'format': {'type': 'json_schema', 'name': schema.__name__,
                                   'strict': True, 'schema': bundle.output_schema if bundle else schema.model_json_schema()}}}
    failure_code = 'request_failed'
    http_status = None
    usage = {}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(limits.request_timeout_seconds, connect=limits.connect_timeout_seconds)) as client:
            for attempt in range(limits.http_retries + 1):
                promptbook.trace_event(journal, 'queued', attempt=attempt + 1, estimated_input_tokens=estimated)
                try:
                    async with provider_slot(bundle.agent if bundle else schema.__name__, limits) as queued_ms:
                        metrics['queue_wait_ms'] = metrics.get('queue_wait_ms', 0) + queued_ms
                        promptbook.trace_event(journal, 'running', attempt=attempt + 1, queue_wait_ms=queued_ms)
                        request_started = time.monotonic()
                        metrics['api_attempts'] = metrics.get('api_attempts', 0) + 1
                        response = await client.post('https://api.openai.com/v1/responses',
                                                     headers={'Authorization': 'Bearer ' + config.API_KEY}, json=payload)
                        request_ms = round((time.monotonic() - request_started) * 1000)
                except httpx.RequestError:
                    if attempt < limits.http_retries:
                        promptbook.trace_event(journal, 'retrying', attempt=attempt + 1, error_code='network_error')
                        await asyncio.sleep(limits.retry_backoff_seconds * (2 ** attempt))
                        continue
                    raise
                http_status = response.status_code
                if response.status_code in (429, 500, 502, 503, 504) and attempt < limits.http_retries:
                    promptbook.trace_event(journal, 'retrying', attempt=attempt + 1, http_status=http_status, request_ms=request_ms)
                    await asyncio.sleep(limits.retry_backoff_seconds * (2 ** attempt))
                    continue
                if response.status_code != 200:
                    failure_code = 'http_error'
                    # Never include API headers, full response, or document content in errors/logs.
                    raise RuntimeError(f'OpenAI 요청 실패 (HTTP {response.status_code}). 키·모델 권한과 사용량을 확인하세요.')
                try:
                    data = response.json()
                except ValueError:
                    failure_code = 'invalid_response_json'
                    raise RuntimeError('AI 응답이 유효한 JSON 형식이 아닙니다.') from None
                raw_usage = data.get('usage') or {}
                usage = {key: raw_usage[key] for key in ('input_tokens', 'output_tokens', 'total_tokens')
                         if isinstance(raw_usage.get(key), int) and not isinstance(raw_usage[key], bool)
                         and raw_usage[key] >= 0}
                for key in ('input_tokens', 'output_tokens'):
                    metrics[key] = metrics.get(key, 0) + usage.get(key, 0)
                promptbook.trace_event(journal, 'response', attempt=attempt + 1, http_status=http_status,
                                      request_ms=request_ms, **usage)
                if data.get('status') != 'completed':
                    failure_code = 'response_incomplete'
                    raise RuntimeError('AI 응답이 완료되지 않았습니다. 배치 크기를 줄여 다시 실행하세요.')
                text = ''.join(c.get('text', '') for o in data.get('output', []) for c in o.get('content', []) if c.get('type') == 'output_text')
                if not text:
                    failure_code = 'missing_output_text'
                    raise RuntimeError('AI가 구조화된 추출 결과를 반환하지 않았습니다.')
                try:
                    result = schema.model_validate_json(text)
                except ValidationError:
                    failure_code = 'output_schema_mismatch'
                    raise RuntimeError('AI 응답이 지정된 출력 스키마와 일치하지 않습니다.') from None
                metrics['api_calls'] = metrics.get('api_calls', 0) + 1
                promptbook.trace_event(journal, 'completed', attempt=attempt + 1, **usage)
                promptbook.finish_trace(journal, result=result, usage=usage, http_status=http_status)
                return result
    except asyncio.CancelledError:
        promptbook.trace_event(journal, 'cancelled', error_code='request_cancelled')
        promptbook.finish_trace(journal, status='cancelled', error_code='request_cancelled', usage=usage)
        raise
    except httpx.RequestError:
        promptbook.trace_event(journal, 'failed', error_code='network_error')
        promptbook.finish_trace(journal, status='failed', error_code='network_error', usage=usage)
        raise RuntimeError('OpenAI 연결 요청에 실패했습니다. 네트워크 상태를 확인하세요.') from None
    except TimeoutError:
        promptbook.trace_event(journal, 'failed', error_code='queue_timeout')
        promptbook.finish_trace(journal, status='failed', error_code='queue_timeout')
        raise RuntimeError('AI 호출 대기 한도를 초과했습니다. 실행 중인 작업과 동시 호출 설정을 확인하세요.') from None
    except Exception:
        promptbook.trace_event(journal, 'failed', error_code=failure_code, **usage)
        promptbook.finish_trace(journal, status='failed', error_code=failure_code,
                               http_status=http_status, usage=usage)
        raise


RULES_ROOT = config.ROOT / 'rules'
LEGAL_FEATURES = {
    'income.recognized_monthly_net', 'living.recognized_total', 'living.base_allowance',
    'living.housing_included', 'living.housing_cap', 'household.recognized_count',
    'claims.total_present_value', 'debts[].priority_status', 'debts[].estate_claim_status',
}
UNKNOWN_FEATURES = (
    'person.name', 'person.resident_id', 'jurisdiction.residence', 'jurisdiction.main_business',
    'income.monthly_net', 'income.business_revenue', 'income.necessary_cost', 'income.period',
    'annual_business_income', 'debts[].origin_contract_id', 'debts[].current_creditor_id',
    'debts[].principal', 'debts[].interest', 'debts[].amount_as_of', 'assets[].type',
    'assets[].legal_owner', 'assets[].gross_value', 'assets[].valuation_as_of',
    'assets[].secured_balance', 'assets[].ownership_share', 'household.members[]',
    'statement', 'prior_proceedings',
)
TYPE_LABELS = {
    'resident_registration': '주민등록 등본·초본',
    'withholding_certificate': '근로소득 원천징수영수증',
    'employer_signed_salary_statement': '급여명세서',
    'employer_signed_income_certificate': '고용주 소득확인서',
    'salary_bank_statement_for_required_period': '급여입금 거래내역',
    'business_registration': '사업자등록증·사업자등록증명',
    'business_contract': '사업·용역 계약서', 'platform_settlement': '플랫폼 정산자료',
    'business_tax_return': '종합소득세·부가세 신고서 또는 소득금액증명',
    'business_expense_ledger': '사업 필요경비 장부',
    'monthly_business_report': '월별 사업매출·경비 보고서',
    'business_bank_statement': '사업용 계좌 거래내역',
    'family_relationship_certificate': '가족관계 증명서',
    'household_support_evidence': '실제 부양관계 증빙',
    'debt_certificate': '부채증명서·채무확인서', 'loan_contract': '대출·차용 계약서',
    'debt_balance_statement': '대출 잔액증명·상환내역',
    'judgment': '채권 관련 판결문', 'current_debt_evidence': '현재 채무액 증빙',
    'vehicle_register': '자동차등록원부', 'vehicle_market_evidence': '차량 시세·평가 자료',
    'secured_balance_evidence': '담보대출 잔액 증빙',
    'real_estate_register': '부동산 등기사항증명서',
    'property_market_evidence': '부동산 시세·감정 자료',
    'insurance_policy': '보험증권·계약내역',
    'insurance_surrender_certificate': '보험 해약환급금 증명',
    'insurance_loan_statement': '보험계약 대출내역',
    'bank_balance_certificate': '예금 잔액증명', 'bank_statement': '일반 계좌 거래내역',
    'lease_contract': '임대차계약서', 'lease_payment_evidence': '임차보증금·임차료 납부증빙',
    'asset_ownership_evidence': '그 밖의 자산 소유 증빙',
    'asset_valuation_evidence': '그 밖의 자산 가치 증빙',
    'pension_certificate': '연금·퇴직금 증명', 'client_narrative': '의뢰인 진술·상담자료',
    'administrative': '위임·법무행정 자료', 'filed_form': '기작성·기제출 법원 서류',
    'unknown': '판독 불가 또는 분류표에 없는 자료',
}


def extraction_catalog():
    """Reload local rule mappings, never evaluation targets or customer data."""
    try:
        path = RULES_ROOT / 'document_mapping.json'
        if not path.exists():
            path = RULES_ROOT / 'document_feature_mappings.json'
        mapping = json.loads(path.read_text(encoding='utf-8'))
        labels = dict(config.LABELS)
        for filename in ('feature_catalog.json', 'extensions.json'):
            data = json.loads((RULES_ROOT / filename).read_text(encoding='utf-8'))
            labels.update({row['key']: row['label'] for row in data['features']})
        types = dict(TYPE_LABELS)
        by_type = defaultdict(set)
        for requirement in mapping['requirements']:
            for alternative in requirement.get('alternatives', []):
                names = list(alternative.get('all_of', []))
                names += [name for group in alternative.get('any_of', []) for name in group]
                for name in names:
                    types.setdefault(name, name.replace('_', ' '))
                    by_type[name].update(requirement.get('purpose_features', []))
        return labels, types, by_type
    except (OSError, ValueError, KeyError, TypeError):
        raise RuntimeError('문서별 feature 매핑 또는 feature catalog 형식을 확인하세요.') from None


def forbidden_feature(key):
    return key in config.REVIEW_ONLY_KEYS or key in LEGAL_FEATURES or key.startswith(('plan.', 'coverage.'))


def _type_features(document_type, labels, by_type):
    """Mapping purposes plus small document-specific factual details needed by forms."""
    keys = list(sorted(by_type.get(document_type, set())))
    if document_type in ('filed_form', 'administrative'):
        return []
    if document_type == 'unknown' or not keys and document_type not in TYPE_LABELS:
        keys = list(UNKNOWN_FEATURES)
    identity = ['person.name', 'person.resident_id']
    income_types = {'withholding_certificate', 'employer_signed_salary_statement',
                    'employer_signed_income_certificate', 'salary_bank_statement_for_required_period',
                    'business_contract', 'platform_settlement', 'business_tax_return',
                    'business_expense_ledger', 'monthly_business_report', 'business_bank_statement'}
    if document_type in income_types:
        keys += ['income.period', 'income_source.employer', 'income_source.business',
                 'income_source.tax_social_insurance']
    if document_type in {'business_tax_return', 'business_expense_ledger', 'monthly_business_report'}:
        keys += ['annual_business_income', 'business_name', 'business_registration', 'business_type']
    if document_type == 'business_registration':
        keys += ['business_name', 'business_registration', 'business_type', 'opening_date']
    if document_type in {'debt_certificate', 'loan_contract', 'debt_balance_statement', 'judgment', 'current_debt_evidence'}:
        keys += ['creditor_address', 'creditor_phone', 'creditor_fax', 'creditor_cause',
                 'creditor_loan_date', 'creditor_due_date', 'creditor_content',
                 'creditor_collateral', 'creditor_original_principal', 'creditor_principal_basis',
                 'creditor_interest_basis', 'creditor_litigation']
    if document_type != 'unknown' and any(key.startswith('assets[].') for key in keys):
        keys += ['assets[].type', 'asset_description', 'asset_institution', 'asset_account_number',
                 'asset_acquisition_date', 'asset_address', 'asset_seizure', 'asset_collateral']
    if document_type == 'resident_registration':
        keys += ['registered_address', 'address', 'residence_start', 'residence_registration_date']
    if document_type in {'family_relationship_certificate', 'household_support_evidence'}:
        keys += [key for key in labels if key.startswith('family_')]
    if document_type in {'lease_contract', 'lease_payment_evidence'}:
        keys += [key for key in labels if key.startswith(('housing_', 'lease_'))]
    if document_type == 'pension_certificate':
        keys += ['pension', 'retirement_value', 'income.monthly_net', 'assets[].gross_value']
    if document_type == 'client_narrative':
        keys += ['statement', 'prior_proceedings', 'education', 'career_history', 'marriage_history',
                 'person.phone', 'household.members[]', 'income.sources[]', 'housing_type']
        keys += [key for key in labels if key.startswith(('career_', 'enforcement_', 'prior_procedure_'))]
    return list(dict.fromkeys(key for key in keys + identity if key in labels and not forbidden_feature(key)))


def _page_type(doc, page, types):
    # Human-mapped whole documents override classifier suggestions, but mixed PDFs
    # route by their original-page manifest when no reviewed mapping exists.
    mapped = doc.get('document_type')
    if doc.get('mapping_status') in {'VERIFIED', 'confirmed'} and mapped in types and mapped != 'unknown':
        return mapped
    for row in doc.get('page_roles', []):
        if row.get('page') == page and row.get('document_id', doc['id']) == doc['id']:
            kind = row.get('document_type', 'unknown')
            return kind if kind in types else 'unknown'
    return mapped if mapped in types else 'unknown'


def _manifest(items):
    return [{'document_id': doc['id'], 'page': page} for doc, page in items]


def _validate_items(items):
    identities = [(doc['id'], page) for doc, page in items]
    if len(identities) != len(set(identities)) or any(not isinstance(page, int) or page < 1 for _, page in items):
        raise ValueError('Input pages must have unique document IDs and positive original-page numbers.')


def _planned_bundle(agent, items, fields, model):
    """Shrink the page batch before rendering images or making a provider request."""
    limits = promptbook.runtime_config(agent)
    count = min(len(items), limits.batch_pages)
    while count:
        batch = items[:count]
        bundle = promptbook.load_prompt(agent, {'pages': _manifest(batch), **fields}, model)
        estimated_content = [{'type': 'input_text', 'text': bundle.body}]
        for doc, page in batch:
            estimated_content.extend([{'type': 'input_text', 'text': f"DOCUMENT_ID={doc['id']} PAGE={page}"},
                                      {'type': 'input_image'}])
        estimate = estimate_input_tokens(bundle.instructions, estimated_content, bundle.output_schema,
                                         bundle.runtime.image_token_estimate)
        if estimate <= bundle.runtime.max_input_tokens:
            return batch, bundle
        count -= 1
    raise RuntimeError('단일 페이지도 예상 입력 토큰 한도를 넘습니다. 참고 문맥·feature 범위 또는 실행 한도를 확인하세요.')


async def _call_pages(items, bundle, model, metrics):
    images = await asyncio.to_thread(content_for_pages, items, bundle.image_long_edge)
    return await ask_json(bundle.instructions,
                          promptbook.PromptContent(bundle, images, promptbook.trace_context(items)), model, metrics)


async def classify(items, metrics):
    """Classify all supplied original pages, internally respecting editable batch limits."""
    items = list(items)
    _validate_items(items)
    _, types, _ = extraction_catalog()
    pages = []
    while items:
        batch, bundle = _planned_bundle('classify', items, {'document_types': types}, Classification)
        result = await _call_pages(batch, bundle, Classification, metrics)
        expected = {(doc['id'], page) for doc, page in batch}
        returned = [(page.document_id, page.page) for page in result.pages]
        if len(returned) != len(expected) or set(returned) != expected:
            raise RuntimeError('AI 문서 분류 결과의 페이지가 입력과 일치하지 않습니다.')
        for row in result.pages:
            if row.document_type not in types:
                row.document_type = 'unknown'
                metrics['classification_mapping_gaps'] = metrics.get('classification_mapping_gaps', 0) + 1
        pages.extend(result.pages)
        items = items[len(batch):]
    return Classification(pages=pages)


def _reference_context(context, limits):
    """RAG may explain terms; it is never an evidence source for a case fact."""
    rows = (context.get('results', context.get('hits', [])) if isinstance(context, dict) else context) or []
    safe = []
    for row in rows[:limits.rag_top_k]:
        if isinstance(row, str):
            row = {'text': row}
        if not isinstance(row, dict):
            continue
        row = dict(row)
        if 'text' not in row:
            row['text'] = row.get('snippet', row.get('content', ''))
        hit = {key: str(row[key])[:limits.rag_chars_per_hit if key == 'text' else 240]
               for key in ('source_id', 'title', 'text', 'url', 'version') if row.get(key) is not None}
        if hit:
            safe.append(hit)
    return safe


def _normal_quote(text):
    return re.sub(r'\s+', '', unicodedata.normalize('NFKC', text))


def _checked_extraction(result, items, allowed_keys):
    expected = {(doc['id'], page) for doc, page in items}
    returned = [(row.document_id, row.page) for row in result.pages]
    if len(returned) != len(expected) or set(returned) != expected or any(not row.transcript.strip() for row in result.pages):
        raise RuntimeError('AI 전사 결과의 페이지가 입력과 일치하지 않거나 전사문이 비어 있습니다.')
    transcripts = {(row.document_id, row.page): _normal_quote(row.transcript) for row in result.pages}
    accepted, rejected = [], 0
    for fact in result.facts:
        source = (fact.document_id, fact.page)
        quote = _normal_quote(fact.quote)
        if (fact.key not in allowed_keys or forbidden_feature(fact.key) or source not in expected
                or fact.value is None or not str(fact.value).strip() or not quote
                or len(fact.quote) > 240 or quote not in transcripts.get(source, '')):
            rejected += 1
            continue
        accepted.append(fact.model_dump())
    return accepted, rejected


async def extract(items, metrics, *, required_features=None, rag_context=None):
    """List-compatible facts + .pages/.missing_features/.warnings; no approval is implied.

    Existing extract(items, metrics) callers remain valid. Required features can
    explicitly narrow the scope; otherwise each original page uses its mapped type.
    """
    items = list(items)
    _validate_items(items)
    labels, types, by_type = extraction_catalog()
    limits = promptbook.runtime_config('extract')
    references = _reference_context(rag_context, limits)
    explicit = list(dict.fromkeys(required_features)) if required_features is not None else None
    if explicit is not None and any(key not in labels for key in explicit):
        raise ValueError('required_features contains a key outside the local feature catalog.')
    groups = defaultdict(list)
    for doc, page in items:
        groups[_page_type(doc, page, types)].append((doc, page))
    all_facts, transcripts, warnings, unresolved = [], {}, [], set()
    for document_type, group in groups.items():
        keys = [key for key in explicit if not forbidden_feature(key)] if explicit is not None else _type_features(document_type, labels, by_type)
        if document_type == 'unknown':
            warnings.append('document_mapping_gap:unknown; bounded factual fallback used')
            metrics['extraction_mapping_gaps'] = metrics.get('extraction_mapping_gaps', 0) + 1
        # Large reviewed requirements are split into bounded key tasks. No task
        # receives the full global feature catalog.
        key_batches = [keys[i:i + limits.max_features_per_task] for i in range(0, len(keys), limits.max_features_per_task)] or [[]]
        for initial_keys in key_batches:
            pending_keys = list(initial_keys)
            for pass_number in range(limits.missing_feature_retries + 1):
                if pass_number and not pending_keys:
                    break
                queue = list(group)
                found_this_scope = set()
                while queue:
                    fields = {'allowed_key_labels': {key: labels[key] for key in pending_keys},
                              'review_only_keys': sorted(config.REVIEW_ONLY_KEYS | LEGAL_FEATURES),
                              'document_type': document_type, 'reference_context': references,
                              'extraction_pass': 'missing_features' if pass_number else 'initial'}
                    batch, bundle = _planned_bundle('extract', queue, fields, Extraction)
                    result = await _call_pages(batch, bundle, Extraction, metrics)
                    facts, rejected = _checked_extraction(result, batch, set(pending_keys))
                    # Retried facts must also agree with the original preserved
                    # transcription, not only a later altered OCR response.
                    stable = []
                    for fact in facts:
                        previous = transcripts.get((fact['document_id'], fact['page']))
                        if previous and _normal_quote(fact['quote']) not in _normal_quote(previous['transcript']):
                            rejected += 1
                        else:
                            stable.append(fact)
                    facts = stable
                    metrics['rejected_source_facts'] = metrics.get('rejected_source_facts', 0) + rejected
                    if pass_number:
                        metrics['missing_feature_retry_calls'] = metrics.get('missing_feature_retry_calls', 0) + 1
                    all_facts.extend(facts)
                    found_this_scope.update(fact['key'] for fact in facts)
                    for row in result.pages:
                        transcripts.setdefault((row.document_id, row.page), row.model_dump())
                    warnings.extend(result.warnings)
                    queue = queue[len(batch):]
                pending_keys = [key for key in pending_keys if key not in found_this_scope]
            unresolved.update(pending_keys)
    unique = {}
    for fact in all_facts:
        signature = json.dumps(fact, ensure_ascii=False, sort_keys=True)
        unique.setdefault(signature, fact)
    # Preserve original requested order even if mixed document types were grouped.
    pages = [transcripts[(doc['id'], page)] for doc, page in items]
    metrics['missing_feature_count'] = metrics.get('missing_feature_count', 0) + len(unresolved)
    return ExtractedFacts(list(unique.values()), pages, missing_features=sorted(unresolved),
                          warnings=list(dict.fromkeys(warnings)))


async def extract_document(document, metrics, *, pages=None, required_features=None, rag_context=None):
    """Convenience adapter for a persisted document; pages always mean original IDs."""
    if pages is None:
        pages = document.get('evidence_pages')
        if pages is None:
            pages = list(range(1, int(document.get('pages', 0)) + 1))
    return await extract([(document, page) for page in pages], metrics,
                         required_features=required_features, rag_context=rag_context)
