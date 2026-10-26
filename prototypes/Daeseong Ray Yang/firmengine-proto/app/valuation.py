"""Evidence-preserving asset price adapters; no implicit legal valuation approval."""
from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import json
import re
from urllib.parse import urlsplit, urlunsplit, unquote, parse_qsl, urlencode
import xml.etree.ElementTree as ET

import httpx

from . import config

CAR365_URL = 'https://www.car365.go.kr/ccpt/schdcar/avrg/schdAvrgTrddView.do'
CAR365_MODEL_URL = 'https://www.car365.go.kr/ccpt/schdcar/mkprc/schdMkprcView.do?_menuId=M630101000'
MOLIT_SOURCE = 'https://www.data.go.kr/data/15126468/openapi.do'
MOLIT_ENDPOINT = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev'
MAX_RESPONSE_BYTES = 2_000_000


def providers() -> list[dict]:
    return [
        {'id': 'manual_evidence', 'title': '시가 증빙 직접 입력', 'mode': 'manual',
         'required_inputs': ['price', 'as_of', 'source_url_or_document_id']},
        {'id': 'car365_reference', 'title': '자동차365 본인 조회', 'mode': 'human_authentication',
         'source_url': CAR365_URL, 'required_inputs': []},
        {'id': 'molit_apartment', 'title': '국토부 아파트 매매 실거래', 'mode': 'official_api',
         'source_url': MOLIT_SOURCE, 'required_inputs': ['lawd_cd', 'deal_ymd']},
        {'id': 'configured_vehicle_api', 'title': '설정된 차량 가격 API', 'mode': 'configured_api',
         'required_inputs': ['vehicle_number']},
    ]


def _now():
    return datetime.now(timezone.utc).isoformat()


def _public_url(value) -> str | None:
    """Keep document-identifying query fields while removing authentication fields."""
    if not isinstance(value, str):
        return None
    try:
        parsed = urlsplit(value)
        if parsed.scheme not in ('https', 'http') or not parsed.hostname or parsed.username or parsed.password:
            return None
        query = [(key, item) for key, item in parse_qsl(parsed.query, keep_blank_values=True)
                 if not re.search(r'key|token|auth|password|secret|credential|signature|session|^sig$', key, re.I)]
        return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), ''))
    except ValueError:
        return None


def _date(value):
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError:
        return None


def _won(value, unit='won') -> str | None:
    if value is None or isinstance(value, (bool, float)) or unit not in ('won', 'manwon'):
        return None
    text = str(value).strip().replace(',', '')
    if not re.fullmatch(r'\d+(?:\.\d+)?', text):
        return None
    try:
        amount = Decimal(text) * (10000 if unit == 'manwon' else 1)
        if not amount.is_finite() or amount != amount.to_integral_value() or amount > 10**18:
            return None
        return str(int(amount))
    except InvalidOperation:
        return None


def _redacted(value, secrets):
    if isinstance(value, dict):
        return {key: _redacted(item, secrets) for key, item in value.items()
                if not re.search(r'authorization|password|secret|service.?key|api.?key|token', str(key), re.I)}
    if isinstance(value, list):
        return [_redacted(item, secrets) for item in value]
    if isinstance(value, str):
        for secret in secrets:
            if secret:
                value = value.replace(str(secret), '[redacted]')
    return value


def _result(provider, **values):
    return {'provider': provider, 'status': 'missing_inputs', 'price': None, 'value': None,
            'currency': 'KRW', 'unit': 'won', 'as_of': None, 'source_url': None,
            'evidence_refs': [], 'raw_reference': {}, 'missing_inputs': [],
            'next_action': '', 'verified': False, 'human_verified': False,
            'legal_valuation_approved': False, **values}


def _fetch(url, *, params=None, headers=None, timeout=12):
    # Redirects are not followed: a configured provider cannot redirect credentials.
    with httpx.Client(timeout=httpx.Timeout(timeout, connect=min(4, timeout)), follow_redirects=False) as client:
        with client.stream('GET', url, params=params, headers=headers) as response:
            data = bytearray()
            for part in response.iter_bytes():
                data.extend(part)
                if len(data) > MAX_RESPONSE_BYTES:
                    raise ValueError('valuation_response_too_large')
            return {'status_code': response.status_code, 'content': bytes(data)}


class ValuationService:
    def __init__(self, env=None, fetch=None):
        self.env = config.ENV if env is None else env
        self.fetch = fetch or _fetch

    def evaluate(self, provider: str, inputs: dict) -> dict:
        result = self._evaluate(provider, inputs)
        secrets = [str(value) for key, value in self.env.items() if value and
                   re.search(r'KEY|CREDENTIAL|TOKEN|PASSWORD|SECRET', str(key), re.I)]
        return _redacted(result, secrets)

    def _evaluate(self, provider: str, inputs: dict) -> dict:
        if not isinstance(inputs, dict):
            return _result(provider, status='invalid_inputs', missing_inputs=['inputs_object'],
                           next_action='평가 입력 형식을 확인하세요.')
        if provider == 'manual_evidence':
            return self._manual(inputs)
        if provider == 'car365_reference':
            # A plate alone does not authorize authenticated owner-only retrieval.
            return _result(provider, status='human_auth_required', source_url=CAR365_URL,
                raw_reference={'model_price_reference': CAR365_MODEL_URL, 'method': 'owner_login_reference',
                               'limitation': '동일 형식·연식의 과거 평균이며 사고·주행거리·옵션을 반영하지 않습니다.'},
                next_action='소유자가 자동차365에 로그인해 조회한 결과를 저장한 뒤 수동 증빙으로 등록하세요.')
        if provider == 'molit_apartment':
            return self._molit(inputs)
        if provider == 'configured_vehicle_api':
            return self._vehicle(inputs)
        return _result(provider, status='unsupported_provider', next_action='등록된 평가자료 공급자를 선택하세요.')

    def _manual(self, inputs):
        value = _won(inputs.get('price', inputs.get('value')), inputs.get('unit', 'won'))
        as_of = _date(inputs.get('as_of'))
        source = _public_url(inputs.get('source_url'))
        document = str(inputs.get('document_id') or '').strip()
        missing = []
        if value is None:
            missing.append('price')
        if not as_of:
            missing.append('as_of')
        if not source and not document:
            missing.append('source_url_or_document_id')
        if inputs.get('currency', 'KRW') != 'KRW':
            missing.append('currency_KRW')
        if missing:
            return _result('manual_evidence', missing_inputs=missing,
                next_action='금액·평가기준일·출처 URL 또는 증빙 문서를 입력하세요.')
        ref = {'type': 'document' if document else 'public_reference', 'as_of': as_of}
        if document:
            ref['document_id'] = document
            if isinstance(inputs.get('page'), int) and not isinstance(inputs['page'], bool) and inputs['page'] > 0:
                ref['page'] = inputs['page']
        if source:
            ref['url'] = source
        return _result('manual_evidence', status='candidate', price=value, value=value, as_of=as_of,
            source_url=source, evidence_refs=[ref], price_kind='manual_evidence',
            raw_reference={'recorded_at': _now(), 'input_unit': inputs.get('unit', 'won'), 'document_id': document or None},
            next_action='담당자가 자산 동일성·평가기준일·시가 근거를 확인한 뒤 인정값으로 선택하세요.')

    def _request(self, provider, url, *, params=None, headers=None):
        try:
            response = self.fetch(url, params=params or {}, headers=headers or {}, timeout=12)
            if response['status_code'] != 200:
                return None, _result(provider, status='provider_error',
                    raw_reference={'http_status': int(response['status_code'])},
                    next_action='공급자 연결·인증·이용권한을 확인하거나 수동 증빙을 등록하세요.')
            content = response['content']
            content = content.encode('utf-8') if isinstance(content, str) else bytes(content)
            if not content or len(content) > MAX_RESPONSE_BYTES:
                raise ValueError('invalid_response_size')
            return content, None
        except (httpx.HTTPError, TimeoutError, OSError, ValueError, KeyError, TypeError):
            return None, _result(provider, status='provider_unavailable',
                next_action='조회가 완료되지 않았습니다. 잠시 후 다시 확인하거나 수동 증빙을 등록하세요.')

    def _molit(self, inputs):
        provider = 'molit_apartment'
        lawd = str(inputs.get('lawd_cd') or '')
        period = str(inputs.get('deal_ymd') or '')
        missing = []
        if not re.fullmatch(r'\d{5}', lawd):
            missing.append('lawd_cd')
        if not re.fullmatch(r'\d{6}', period) or not _date(period[:4] + '-' + period[4:] + '-01'):
            missing.append('deal_ymd')
        key = (self.env.get('MOLIT_API_KEY') or self.env.get('DATA_GO_KR_SERVICE_KEY')
               or self.env.get('PUBLIC_DATA_API_KEY') or '')
        if missing:
            return _result(provider, source_url=MOLIT_SOURCE, missing_inputs=missing,
                           next_action='법정동 코드 앞 5자리와 계약년월 YYYYMM을 입력하세요.')
        if not key:
            return _result(provider, status='credential_required', source_url=MOLIT_SOURCE,
                missing_inputs=['MOLIT_API_KEY'], next_action='공공데이터포털에서 해당 API 활용신청과 인증키 설정을 완료하거나 공식 CSV를 증빙으로 등록하세요.')
        try:
            page = int(inputs.get('page_no', 1))
            if isinstance(inputs.get('page_no'), bool) or not 1 <= page <= 10000:
                raise ValueError()
        except (ValueError, TypeError):
            return _result(provider, status='invalid_inputs', missing_inputs=['page_no'], next_action='페이지 번호를 확인하세요.')
        request = {'LAWD_CD': lawd, 'DEAL_YMD': period, 'pageNo': page, 'numOfRows': 100}
        content, error = self._request(provider, MOLIT_ENDPOINT, params={'serviceKey': unquote(str(key)), **request})
        if error:
            error['source_url'] = MOLIT_SOURCE
            return error
        try:
            root = ET.fromstring(content)
            code = root.findtext('.//resultCode', '')
            if code not in ('000', '00', '0'):
                return _result(provider, status='provider_error', source_url=MOLIT_SOURCE,
                    raw_reference={'result_code': code if re.fullmatch(r'[A-Za-z0-9_-]{1,20}', code) else 'unknown'},
                    next_action='실거래 API의 이용권한·요청조건·공급 상태를 확인하세요.')
            comparables = []
            invalid_count, cancelled_count = 0, 0
            for item in root.findall('.//item'):
                field = lambda *keys: next((item.findtext(k, '').strip() for k in keys if item.findtext(k, '').strip()), '')
                amount = _won(field('dealAmount', '거래금액'), 'manwon')
                year, month, day = field('dealYear', '년'), field('dealMonth', '월'), field('dealDay', '일')
                try:
                    traded_at = date(int(year), int(month), int(day)).isoformat()
                except (ValueError, TypeError):
                    traded_at = None
                # Cancelled contracts are retained as exclusions, never price candidates.
                cancelled = field('cdealType', '해제여부').upper() in ('O', 'Y', '1') or bool(field('cdealDay', '해제사유발생일'))
                if cancelled:
                    cancelled_count += 1
                    continue
                if amount is None or traded_at is None:
                    invalid_count += 1
                    continue
                row = {'apartment_name': field('aptNm', '아파트'), 'legal_dong': field('umdNm', '법정동'),
                    'area_m2': field('excluUseAr', '전용면적'), 'floor': field('floor', '층'),
                    'build_year': field('buildYear', '건축년도'), 'contract_date': traded_at,
                    'price_won': amount, 'reported_unit': 'manwon', 'price_kind': 'reported_transaction'}
                if inputs.get('apartment_name') and str(inputs['apartment_name']).strip() != row['apartment_name']:
                    continue
                if inputs.get('area_m2') is not None:
                    try:
                        if Decimal(str(inputs['area_m2'])) != Decimal(row['area_m2']):
                            continue
                    except InvalidOperation:
                        return _result(provider, status='invalid_inputs', missing_inputs=['area_m2'], source_url=MOLIT_SOURCE,
                                       next_action='전용면적을 숫자로 입력하세요.')
                row['reference_id'] = hashlib.sha256(json.dumps(row, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:24]
                comparables.append(row)
            total = root.findtext('.//totalCount', '')
            raw = {'response_sha256': hashlib.sha256(content).hexdigest(), 'retrieved_at': _now(),
                   'request': request, 'total_count': int(total) if total.isdigit() else None,
                   'coverage_period': period, 'returned_comparables': len(comparables),
                   'cancelled_records_excluded': cancelled_count, 'unreadable_records': invalid_count,
                   'has_more_pages': int(total) > page * 100 if total.isdigit() else None}
            if not comparables and invalid_count:
                return _result(provider, status='provider_mapping_required', source_url=MOLIT_SOURCE,
                    raw_reference=raw, next_action='응답의 거래금액·계약일 형식을 확인하세요. 누락 값을 0원으로 처리하지 않습니다.')
            selected = next((row for row in comparables if row['reference_id'] == inputs.get('selected_reference')), None)
            if inputs.get('selected_reference') and not selected:
                return _result(provider, status='selection_not_found', source_url=MOLIT_SOURCE, raw_reference=raw,
                    comparables=comparables, next_action='조회조건이나 데이터가 변경되었습니다. 비교 거래를 다시 선택하세요.')
            refs = [{'type': 'official_transaction', 'url': MOLIT_SOURCE, 'reference_id': row['reference_id'],
                     'as_of': row['contract_date']} for row in ([selected] if selected else comparables)]
            return _result(provider, status='candidate' if selected else 'comparables_found' if comparables else 'no_data',
                price=selected['price_won'] if selected else None, value=selected['price_won'] if selected else None,
                as_of=selected['contract_date'] if selected else None, source_url=MOLIT_SOURCE,
                evidence_refs=refs, raw_reference=raw, comparables=comparables, price_kind='reported_transaction',
                next_action='선택 거래는 참고자료입니다. 대상 자산과의 면적·층·시점 차이 및 권리관계를 검토하세요.' if selected else
                    '대상 자산과 비교 가능한 거래를 선택하세요. 지역 거래 평균을 해당 자산의 시가로 자동 확정하지 않습니다.' if comparables else
                    '해당 조건에서 유효 거래를 찾지 못했습니다. 기간·단지·면적을 확인하거나 다른 시가 증빙을 등록하세요.')
        except (ET.ParseError, ValueError, TypeError):
            return _result(provider, status='invalid_provider_response', source_url=MOLIT_SOURCE,
                           next_action='공급자 응답 형식을 확인하거나 공식 거래자료를 직접 등록하세요.')

    def _vehicle(self, inputs):
        provider = 'configured_vehicle_api'
        url = str(self.env.get('VEHICLE_VALUATION_API_URL') or '')
        citation = _public_url(url)
        if not citation:
            return _result(provider, status='not_configured', missing_inputs=['VEHICLE_VALUATION_API_URL'],
                next_action='승인된 공급자 API를 환경설정에 등록하거나 자동차365 조회 증빙을 사용하세요.')
        plate = str(inputs.get('vehicle_number') or '').strip()
        if not re.fullmatch(r'[A-Za-z0-9가-힣 -]{2,20}', plate):
            return _result(provider, source_url=citation, missing_inputs=['vehicle_number'],
                           next_action='차량번호를 확인하세요.')
        key = str(self.env.get('VEHICLE_VALUATION_API_KEY') or '')
        headers = {'Authorization': 'Bearer ' + key} if key else {}
        # inputs.url/source_url/provider_url are deliberately never fetch targets.
        content, error = self._request(provider, url, params={'vehicle_number': plate}, headers=headers)
        if error:
            error['source_url'] = citation
            return error
        try:
            data = json.loads(content)
            if not isinstance(data, dict):
                raise ValueError()
            value = _won(data.get('value', data.get('price')), data.get('unit'))
            as_of = _date(data.get('as_of'))
            if value is None or as_of is None or data.get('currency') != 'KRW':
                return _result(provider, status='provider_mapping_required', source_url=citation,
                    missing_inputs=['provider.value_currency_unit_as_of'],
                    next_action='공급자 응답을 value/price, KRW, won 또는 manwon, as_of 계약으로 매핑하세요.')
            source = _public_url(data.get('source_url')) or citation
            reference = str(data.get('reference_id') or hashlib.sha256(content).hexdigest())
            result = _result(provider, status='candidate', price=value, value=value, as_of=as_of,
                source_url=source, price_kind='provider_estimate', evidence_refs=[{'type': 'configured_provider',
                    'url': source, 'reference_id': reference, 'as_of': as_of}],
                raw_reference={'response_sha256': hashlib.sha256(content).hexdigest(), 'reference_id': reference,
                    'retrieved_at': _now(), 'request_fields': ['vehicle_number'], 'provider_unit': data.get('unit')},
                next_action='차량 동일성·옵션·주행거리·사고 이력과 평가기준일을 확인한 뒤 인정값으로 선택하세요.')
            return _redacted(result, [key, str(self.env.get('MOLIT_API_KEY') or '')])
        except (ValueError, TypeError, UnicodeDecodeError):
            return _result(provider, status='invalid_provider_response', source_url=citation,
                           next_action='승인된 공급자의 응답 계약을 확인하세요.')


def evaluate_valuation(provider: str, inputs: dict, *, env=None, fetch=None) -> dict:
    return ValuationService(env=env, fetch=fetch).evaluate(provider, inputs)
