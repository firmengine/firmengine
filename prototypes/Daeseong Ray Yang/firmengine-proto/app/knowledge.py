"""Temporal, provenance-filtered legal retrieval and bounded official-source watch.

No customer sample, evaluation golden, or generated output is crawled implicitly.
Official text can enter retrieval automatically. Executable changes are limited to
the reviewed, numeric-only debt-cap DSL below; a language model never emits code.
"""
from __future__ import annotations

from collections import Counter
from contextlib import contextmanager
from datetime import date, datetime, timezone
from html.parser import HTMLParser
import hashlib
import json
import math
from pathlib import Path
import re
import sqlite3
import threading
from typing import Literal
from urllib.parse import urlsplit, urljoin
import uuid

import httpx
from pydantic import BaseModel, ConfigDict, Field

from . import config
from .promptbook import load_prompt

KNOWLEDGE_ROOT = config.ROOT / 'knowledge'
OFFICIAL_HOSTS = ('law.go.kr', 'scourt.go.kr', 'mohw.go.kr', 'data.go.kr', 'molit.go.kr', 'car365.go.kr')
WATCH_DEFAULTS = ('K01', 'K04', 'K19', 'K20', 'K21', 'K23')
MAX_BYTES = 2_000_000
BLOCKED_BUNDLE_FINGERPRINT = 'b11d31ffe75a07f42179715f42944391be96e42818e0cc925da484151c907409'

def is_blocked_bundle(value):
    return isinstance(value, str) and hashlib.sha256(value.encode()).hexdigest() == BLOCKED_BUNDLE_FINGERPRINT

VECTOR_COLLECTIONS = ('legal_norms', 'practice_rules', 'case_observations', 'fewshot_success')
_VECTOR_CLIENTS = {}
_VECTOR_LOCK = threading.RLock()


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def digest(value: str) -> str:
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def json_dump(value) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def iso_date(value: str | None) -> str | None:
    if value is None:
        return None
    return date.fromisoformat(str(value)[:10]).isoformat()


def utc_timestamp(value: str) -> str:
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat()


def official_url(url: str) -> bool:
    parsed = urlsplit(url)
    return (parsed.scheme == 'https' and parsed.username is None and parsed.password is None
            and parsed.port in (None, 443) and bool(parsed.hostname)
            and any(parsed.hostname == h or parsed.hostname.endswith('.' + h) for h in OFFICIAL_HOSTS))


class _Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.skip = 0
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'noscript'):
            self.skip += 1
        if tag in ('p', 'br', 'div', 'li', 'tr', 'h1', 'h2', 'h3', 'h4'):
            self.parts.append('\n')

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'noscript'):
            self.skip = max(0, self.skip - 1)

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def normalize_content(content: str) -> str:
    if re.search(r'<(?:html|div|body|p)\b', content, re.I):
        parser = _Text()
        parser.feed(content)
        content = ''.join(parser.parts)
    return '\n'.join(re.sub(r'\s+', ' ', line).strip() for line in content.splitlines()
                     if line.strip() and not re.fullmatch(r'\s*(?:조회수|조회)\s*[:：]?\s*[\d,]+\s*', line))


def decode_official_text(raw, declared_encoding=None):
    """Court notices include EUC-KR HTML; never index replacement-character OCR."""
    match=re.search(br'charset\s*=\s*["\']?([a-zA-Z0-9_-]+)',raw[:6000],re.I)
    encoding=match.group(1).decode('ascii') if match else (declared_encoding or 'utf-8')
    if encoding.lower() in ('euc-kr','euc_kr','ks_c_5601-1987'):
        encoding='cp949'
    try:
        return raw.decode(encoding)
    except (UnicodeDecodeError,LookupError) as exc:
        raise ValueError('official_source_encoding_invalid') from exc


def effective_date(content: str) -> str | None:
    # Only explicit statute-header effectiveness, not a page publication date.
    match = re.search(r'\[\s*시행\s+(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})', content)
    if not match:
        return None
    try:
        return date(*map(int, match.groups())).isoformat()
    except ValueError:
        return None


def judgment_date(content: str) -> str | None:
    match = re.search(r'\[\s*대법원\s+(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(?:자|선고)', content)
    if not match:
        return None
    try:
        return date(*map(int, match.groups())).isoformat()
    except ValueError:
        return None


def source_effective_date(source_id, content):
    """Dates from explicit applicability statements, never notice publication dates."""
    if source_id == 'K20':
        pattern=r'이\s*실무준칙은\s*(\d{4})(?:\s*년\s*|\.\s*)(\d{1,2})(?:\s*월\s*|\.\s*)(\d{1,2})(?:\s*일\s*|\.\s*)부터\s*시행한다'
        candidates=[]
        for groups in re.findall(pattern,content):
            try:
                candidates.append(date(*map(int,groups)).isoformat())
            except ValueError:
                continue
        return max(candidates) if candidates else None
    if source_id == 'K21':
        match=re.search(r'(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*부터[\s\S]{0,100}적용',content)
        if match:
            try:
                return date(*map(int,match.groups())).isoformat()
            except ValueError:
                return None
    return effective_date(content)


class LawWatchInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    source_id: str
    source_url: str
    observed_at: str
    previous_text: str
    current_text: str


class ChangePreview(BaseModel):
    model_config = ConfigDict(extra='forbid')
    summary: str
    semantic_change: bool
    effective_date: str | None
    application_date: str | None
    date_evidence: str
    affected_features: list[str]
    exception_notes: list[str]
    recommendation: Literal['reference_only', 'parameter_candidate', 'review_required']


def preview_change(source_id: str, url: str, old: str, new: str, directory: Path) -> dict:
    """Editable prompt + private call snapshot. Its result never activates a rule."""
    if not config.API_KEY:
        return {'status': 'not_configured'}
    inputs = {'source_id': source_id, 'source_url': url, 'observed_at': now(),
              'previous_text': old[:32000], 'current_text': new[:48000]}
    bundle = load_prompt('law-watch', inputs, ChangePreview, input_model=LawWatchInput)
    if bundle.model != 'gpt-6-luna':
        raise ValueError('law_watch_requires_gpt_6_luna')
    directory = directory / uuid.uuid4().hex
    directory.mkdir(parents=True)
    for filename, text in [('system.md', bundle.instructions), ('body.md', bundle.body),
                           ('input.json', bundle.input_json)]:
        (directory / filename).write_text(text, encoding='utf-8')
    metadata = {'model': bundle.model, 'store': False, 'sha256': bundle.sha256,
                'file_hashes': bundle.file_hashes, 'version': bundle.version, 'created_at': now()}
    from .ai import provider_slot_sync
    from .promptbook import runtime_config
    limits = runtime_config('law-watch')
    try:
        with provider_slot_sync('law-watch', limits) as queue_wait_ms, httpx.Client(timeout=httpx.Timeout(limits.request_timeout_seconds, connect=limits.connect_timeout_seconds)) as client:
            metadata['queue_wait_ms'] = queue_wait_ms
            response = client.post('https://api.openai.com/v1/responses',
                headers={'Authorization': 'Bearer ' + config.API_KEY},
                json={'model': bundle.model, 'store': False, 'instructions': bundle.instructions,
                      'input': [{'role': 'user', 'content': [{'type': 'input_text', 'text': bundle.body}]}],
                      'reasoning': {'effort': bundle.reasoning_effort},
                      'max_output_tokens': bundle.max_output_tokens,
                      'text': {'format': {'type': 'json_schema', 'name': 'law_watch_preview',
                                          'strict': True, 'schema': bundle.output_schema}}})
        if response.status_code != 200:
            raise ValueError('provider_http_' + str(response.status_code))
        payload = response.json()
        if payload.get('status') != 'completed':
            raise ValueError('provider_incomplete')
        text = ''.join(part.get('text', '') for item in payload.get('output', [])
                       for part in item.get('content', []) if part.get('type') == 'output_text')
        result = ChangePreview.model_validate_json(text).model_dump()
        # Model-proposed dates require an exact source citation, even for preview.
        if result['date_evidence'] and result['date_evidence'] not in new:
            result.update(effective_date=None, application_date=None, recommendation='review_required')
        metadata.update(status='completed', usage=payload.get('usage', {}))
        (directory / 'output.json').write_text(json_dump(result), encoding='utf-8')
        return {'status': 'completed', 'preview': result, 'prompt_sha256': bundle.sha256}
    except (httpx.HTTPError, ValueError, TimeoutError):
        metadata.update(status='failed', error_code='law_watch_preview_unavailable')
        return {'status': 'failed', 'error_code': 'law_watch_preview_unavailable'}
    finally:
        (directory / 'meta.json').write_text(json_dump(metadata), encoding='utf-8')


def _caps(text: str) -> dict | None:
    if '제579조' not in text or '개인회생채권' not in text:
        return None
    secured = re.findall(r'담보된\s*개인회생채권은\s*(\d+)\s*억\s*원', text)
    other = re.findall(r'가목\s*외의\s*개인회생채권은\s*(\d+)\s*억\s*원', text)
    if len(set(secured)) != 1 or len(set(other)) != 1:
        return None
    values = {'secured_cap': str(int(secured[0]) * 100_000_000),
              'unsecured_cap': str(int(other[0]) * 100_000_000)}
    return values if all(0 < int(x) <= 10**12 for x in values.values()) else None


def _cap_skeleton(text: str) -> str:
    # Only the reviewed clause's two values and formal law header may change.
    text = re.sub(r'\[(?:시행|법률)[^\]]*\]', '', text)
    text = re.sub(r'(담보된\s*개인회생채권은\s*)\d+(\s*억\s*원)', r'\1<CAP>\2', text)
    text = re.sub(r'(가목\s*외의\s*개인회생채권은\s*)\d+(\s*억\s*원)', r'\1<CAP>\2', text)
    return re.sub(r'\s+', '', text)


def validate_cap_parameters(params: dict) -> bool:
    """Boundary regressions for the existing independent <= comparisons."""
    if set(params) != {'secured_cap', 'unsecured_cap'}:
        return False
    try:
        a, b = (int(params[key]) for key in ('secured_cap', 'unsecured_cap'))
        check = lambda secured, other: secured >= 0 and other >= 0 and secured <= a and other <= b
        return (0 < a <= 10**12 and 0 < b <= 10**12 and check(a, b)
                and not check(a + 1, 0) and not check(0, b + 1)
                and check(0, 0) and not check(-1, 0))
    except (ValueError, TypeError):
        return False


class KnowledgeStore:
    def __init__(self, db_path):
        self.db_path = Path(db_path)
        self._vector_error = None
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._db() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS knowledge_sources (
                    source_id TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL,
                    authority TEXT NOT NULL, watch INTEGER NOT NULL DEFAULT 0,
                    metadata TEXT NOT NULL, etag TEXT, modified TEXT,
                    checked_at TEXT, check_status TEXT);
                CREATE TABLE IF NOT EXISTS knowledge_versions (
                    version_id TEXT PRIMARY KEY, source_id TEXT NOT NULL, title TEXT NOT NULL,
                    url TEXT NOT NULL, content TEXT NOT NULL, content_hash TEXT NOT NULL,
                    scope TEXT NOT NULL, authority TEXT NOT NULL, valid_from TEXT, valid_to TEXT,
                    recorded_at TEXT NOT NULL, source_case_id TEXT, source_bundle_hash TEXT,
                    tenant_id TEXT NOT NULL, reviewed INTEGER NOT NULL, kind TEXT NOT NULL,
                    metadata TEXT NOT NULL, UNIQUE(source_id, content_hash, valid_from, tenant_id));
                CREATE INDEX IF NOT EXISTS knowledge_temporal ON knowledge_versions(valid_from, valid_to, scope, tenant_id);
                CREATE TABLE IF NOT EXISTS knowledge_case_bundles (
                    tenant_id TEXT NOT NULL, case_id TEXT NOT NULL, bundle_hash TEXT NOT NULL,
                    PRIMARY KEY(tenant_id,case_id,bundle_hash));
                CREATE TABLE IF NOT EXISTS knowledge_changes (
                    change_id TEXT PRIMARY KEY, source_id TEXT NOT NULL, version_id TEXT NOT NULL UNIQUE,
                    previous_version_id TEXT, recorded_at TEXT NOT NULL, effective_from TEXT,
                    status TEXT NOT NULL, details TEXT NOT NULL, acknowledged INTEGER NOT NULL DEFAULT 0);
                CREATE TABLE IF NOT EXISTS knowledge_parameters (
                    version_id TEXT PRIMARY KEY, rule_id TEXT NOT NULL, effective_from TEXT NOT NULL,
                    params TEXT NOT NULL, validator_version TEXT NOT NULL, validation TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS knowledge_vector_index (
                    version_id TEXT NOT NULL, embedding_model TEXT NOT NULL,
                    collection TEXT NOT NULL, chunk_count INTEGER NOT NULL, indexed_at TEXT NOT NULL,
                    PRIMARY KEY(version_id,embedding_model));
            ''')

    @contextmanager
    def _db(self):
        db = sqlite3.connect(self.db_path, timeout=20)
        db.row_factory = sqlite3.Row
        db.create_function('is_blocked_bundle', 1, is_blocked_bundle, deterministic=True)
        db.execute('PRAGMA busy_timeout=20000')
        try:
            with db:
                yield db
        finally:
            db.close()

    def register_case_bundle(self, case_id: str, bundle_hash: str, tenant_id='local') -> None:
        if not re.fullmatch(r'[a-f0-9]{64}', bundle_hash):
            raise ValueError('bundle_hash_requires_sha256')
        with self._db() as db:
            db.execute('INSERT OR IGNORE INTO knowledge_case_bundles VALUES(?,?,?)', (tenant_id, case_id, bundle_hash))

    def ingest_source(self, *, source_id, title, url, content, authority, scope='public',
                      valid_from=None, valid_to=None, recorded_at=None, source_case_id=None,
                      source_bundle_hash=None, tenant_id='local', reviewed=False, kind='reference', metadata=None) -> dict:
        if scope not in ('public', 'tenant', 'case'):
            raise ValueError('unsupported_knowledge_scope')
        if scope == 'case' and not source_case_id:
            raise ValueError('case_scope_requires_case_id')
        if kind in ('golden', 'evaluation_target', 'heldout'):
            raise ValueError('evaluation_targets_must_never_be_indexed')
        if kind in ('case_observation', 'fewshot') and authority != 'PUBLIC_JUDGMENT' and not (metadata or {}).get('synthetic'):
            if not source_case_id or not source_bundle_hash or scope == 'public':
                raise ValueError('case_examples_require_private_provenance_and_bundle_hash')
        if source_bundle_hash and not re.fullmatch(r'[a-f0-9]{64}', source_bundle_hash):
            raise ValueError('source_bundle_hash_requires_sha256')
        if scope == 'public' and source_case_id and not (metadata or {}).get('public_judgment'):
            raise ValueError('private_case_cannot_be_public')
        if authority in ('STATUTE', 'COURT_RULE', 'DIRECTIVE', 'SEOUL_PRACTICE', 'PUBLIC_JUDGMENT') and not official_url(url):
            raise ValueError('official_authority_requires_official_https_source')
        valid_from, valid_to = iso_date(valid_from), iso_date(valid_to)
        if valid_from and valid_to and valid_to <= valid_from:
            raise ValueError('invalid_validity_interval')
        text = normalize_content(content)
        if '\ufffd' in text:
            raise ValueError('source_text_decode_failed')
        if not text or len(text) > MAX_BYTES:
            raise ValueError('empty_or_oversized_knowledge')
        stamp = utc_timestamp(recorded_at) if recorded_at else now()
        metadata = dict(metadata or {})
        if valid_from is None:
            metadata['effective_date_status'] = 'unknown_reference_only'
        version_id = digest(json_dump([source_id, digest(text), valid_from, valid_to, tenant_id, scope, source_case_id, source_bundle_hash]))
        with self._db() as db:
            db.execute('''INSERT OR IGNORE INTO knowledge_versions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                       (version_id, source_id, title, url, text, digest(text), scope, authority, valid_from,
                        valid_to, stamp, source_case_id, source_bundle_hash, tenant_id, int(reviewed), kind, json_dump(metadata)))
        return {'version_id': version_id, 'source_id': source_id, 'content_hash': digest(text),
                'valid_from': valid_from, 'recorded_at': stamp, 'kind': kind}

    def seed_from_blueprint(self, blueprint_path) -> dict:
        blueprint = Path(blueprint_path)
        rules = json.loads((blueprint / 'spec/lawgraph_rule_examples.json').read_text(encoding='utf-8'))
        feature_data = json.loads((blueprint / 'spec/feature_catalog.json').read_text(encoding='utf-8'))
        return self._seed_catalog(rules, feature_data)

    def seed_defaults(self) -> dict:
        """Self-contained startup; the original design directory is not required."""
        bootstrap = json.loads((KNOWLEDGE_ROOT / 'bootstrap.json').read_text(encoding='utf-8'))
        return self._seed_catalog(bootstrap['rules'], bootstrap['feature_metadata'])

    def _seed_catalog(self, rules, feature_data) -> dict:
        for source_id, (title, url) in rules['sources'].items():
            if not source_id.startswith('K') or not official_url(url):
                continue
            authority = ('PUBLIC_JUDGMENT' if source_id in ('K26', 'K31', 'K32') else
                         'SEOUL_PRACTICE' if source_id in ('K20', 'K21', 'K23') else
                         'DIRECTIVE' if source_id == 'K19' else
                         'STATUTE' if source_id in ('K01', 'K04') else 'OFFICIAL_REFERENCE')
            metadata = {'origin': 'blueprint_source_catalog', 'verified_on': feature_data['legal_verified_on'],
                        'design_only': True, 'allow_pdf': source_id == 'K20'}
            with self._db() as db:
                db.execute('INSERT OR IGNORE INTO knowledge_sources(source_id,title,url,authority,watch,metadata) VALUES(?,?,?,?,?,?)',
                           (source_id, title, url, authority, int(source_id in WATCH_DEFAULTS), json_dump(metadata)))
                if source_id in ('K20','K21'):
                    db.execute('UPDATE knowledge_sources SET watch=1,metadata=? WHERE source_id=?',(json_dump(metadata),source_id))
        for rule in rules['rules']:
            # Design examples are searchable with an explicit label, never activated.
            self.ingest_source(source_id='design:' + rule['id'], title=rule['id'],
                url=rules['sources'][rule['source']][1] if rule.get('source') else '', content=json_dump(rule),
                authority='DESIGN_EXAMPLE', kind='design', valid_from=feature_data['legal_verified_on'],
                metadata={'design_only': True, 'executable': False})
        seeds = json.loads((KNOWLEDGE_ROOT / 'curated_sources.json').read_text(encoding='utf-8'))
        for source in seeds:
            self.ingest_source(**source)
        with self._db() as db:
            db.execute('INSERT OR IGNORE INTO knowledge_sources(source_id,title,url,authority,watch,metadata) VALUES(?,?,?,?,?,?)',
                       ('CASE2013MA668', '대법원 2013마668 보정 시정 기회',
                        'https://www.law.go.kr/LSW/precInfoP.do?evtNo=2013%EB%A7%88668', 'PUBLIC_JUDGMENT', 0,
                        json_dump({'judgment_not_statute': True})))
            db.execute('UPDATE knowledge_sources SET url=? WHERE source_id=\'K31\'',
                       ('https://www.law.go.kr/LSW/precInfoP.do?precSeq=171784',))
            db.execute('INSERT OR IGNORE INTO knowledge_sources(source_id,title,url,authority,watch,metadata) VALUES(?,?,?,?,?,?)',
                       ('LAW_API', '현행·시행예정 법령 목록', 'https://www.law.go.kr/DRF/lawSearch.do',
                        'OFFICIAL_REFERENCE', 0, json_dump({'provider': 'law_drf'})))
        return {'source_count': self.status()['source_count'], 'feature_definitions': feature_data['feature_count'],
                'design_rules': len(rules['rules']), 'curated_entries': len(seeds), 'automatic_rule_count': len(self.active_parameters())}

    def _eligible_versions(self, as_of=None, case_id=None, exclude_bundle_hashes=None, tenant_id='local',
                           kinds=None, known_at=None) -> list[dict]:
        as_of = iso_date(as_of) or date.today().isoformat()
        excluded = set(exclude_bundle_hashes or [])
        # The mixed evaluation bundle is permanently excluded from shared RAG.
        # Match an opaque fingerprint without retaining the source PDF hash.
        with self._db() as db:
            if case_id:
                excluded.update(r[0] for r in db.execute('SELECT bundle_hash FROM knowledge_case_bundles WHERE tenant_id=? AND case_id=?', (tenant_id, case_id)))
            where = ['is_blocked_bundle(source_bundle_hash)=0','instr(content,char(65533))=0','(valid_from IS NULL OR valid_from<=?)', '(valid_to IS NULL OR valid_to>?)',
                     "(scope='public' OR (tenant_id=? AND scope='tenant') OR (tenant_id=? AND scope='case' AND source_case_id=?))"]
            args = [as_of, as_of, tenant_id, tenant_id, case_id]
            # Unknown effective dates are observable references only from their capture date onward.
            where.append('(valid_from IS NOT NULL OR substr(recorded_at,1,10)<=?)')
            args.append(as_of)
            if known_at:
                where.append('recorded_at<=?')
                args.append(utc_timestamp(known_at))
            if excluded:
                where.append('(source_bundle_hash IS NULL OR source_bundle_hash NOT IN (' + ','.join('?' for _ in excluded) + '))')
                args.extend(sorted(excluded))
            if case_id:
                # Case-derived examples must never supply the same case's answers.
                # Current evidence enters the extraction pipeline directly, not shared RAG.
                where.append('(source_case_id IS NULL OR source_case_id<>?)')
                args.append(case_id)
            if kinds:
                where.append('kind IN (' + ','.join('?' for _ in kinds) + ')')
                args.extend(kinds)
            rows = [dict(row) for row in db.execute('SELECT * FROM knowledge_versions WHERE ' + ' AND '.join(where)
                        + ' ORDER BY COALESCE(valid_from,substr(recorded_at,1,10)) DESC, recorded_at DESC', args)]
        latest = {}
        for row in rows:
            latest.setdefault((row['source_id'], row['tenant_id'], row['scope']), row)
        return list(latest.values())

    def reviewable_sources(self, source_ids, as_of, case_id=None) -> list[dict]:
        """Exact official originals available for an explicit case release review."""
        rows = self._eligible_versions(as_of=as_of, case_id=case_id,
                                       kinds=['official_snapshot'], known_at=now())
        result = []
        for row in rows:
            if (row['source_id'] not in source_ids or row['scope'] != 'public'
                    or not row['valid_from'] or not official_url(row['url'])
                    or row['content_hash'] != digest(row['content'])
                    or row['authority'] not in ('STATUTE', 'SEOUL_PRACTICE', 'COURT_RULE', 'DIRECTIVE')):
                continue
            result.append({key: row[key] for key in ('source_id','version_id','content_hash','title','url',
                                                    'authority','valid_from','valid_to','recorded_at')})
        return sorted(result, key=lambda row: row['source_id'])

    def _lexical_search(self, query, rows, limit=3) -> list[dict]:
        tokens = set(re.findall(r'[\w가-힣]+', str(query).casefold()))
        if not tokens:
            return []
        # Real lexical retrieval; temporal/scope/bundle restrictions have already run in SQL.
        chunks = []
        for row in rows:
            for start in range(0, len(row['content']), 1500):
                text = row['content'][max(0, start - 120):start + 1500]
                haystack = (row['title'] + ' ' + text).casefold()
                hits = sum(min(haystack.count(token), 8) for token in tokens)
                if not hits:
                    continue
                score = hits / (1 + math.log1p(len(text) / 800))
                chunks.append({'version_id': row['version_id'], 'source_id': row['source_id'],
                    'title': row['title'], 'url': row['url'], 'authority': row['authority'], 'kind': row['kind'],
                    'valid_from': row['valid_from'], 'valid_to': row['valid_to'], 'recorded_at': row['recorded_at'],
                    'content_hash': row['content_hash'], 'source_bundle_hash': row['source_bundle_hash'],
                    'reviewed': bool(row['reviewed']), 'text': text, 'score': round(score, 6),
                    'metadata': json.loads(row['metadata']), 'offset': max(0, start - 120),
                    'retrieval_status': 'vector_unavailable', 'retrieval_method': 'lexical_diagnostic_fallback'})
        return sorted(chunks, key=lambda item: (-item['score'], item['source_id'], item['offset']))[:max(1, min(int(limit), 30))]

    @property
    def embedding_model(self):
        return config.ENV.get('EMBEDDING_MODEL') or 'text-embedding-3-small'

    def _vector_client(self):
        from qdrant_client import QdrantClient, models
        path = str((self.db_path.parent / 'vector-db').resolve())
        with _VECTOR_LOCK:
            if path not in _VECTOR_CLIENTS:
                _VECTOR_CLIENTS[path] = QdrantClient(path=path)
            client = _VECTOR_CLIENTS[path]
            dimension = int(config.ENV.get('EMBEDDING_DIMENSIONS') or '1536')
            for collection in VECTOR_COLLECTIONS:
                if not client.collection_exists(collection):
                    client.create_collection(collection, vectors_config=models.VectorParams(size=dimension, distance=models.Distance.COSINE))
            return client

    def close_vector_client(self):
        """Explicit single-process shutdown hook; SQLite connections already close per call."""
        path = str((self.db_path.parent / 'vector-db').resolve())
        with _VECTOR_LOCK:
            client = _VECTOR_CLIENTS.pop(path, None)
            if client is not None:
                client.close()

    def _embed(self, texts: list[str]) -> list[list[float]]:
        if not config.API_KEY:
            raise ValueError('embedding_key_not_configured')
        from .ai import provider_slot_sync
        from .promptbook import runtime_config
        limits = runtime_config('law-watch')
        with provider_slot_sync('knowledge-embedding', limits), httpx.Client(timeout=httpx.Timeout(45, connect=5)) as client:
            response = client.post('https://api.openai.com/v1/embeddings',
                headers={'Authorization': 'Bearer ' + config.API_KEY},
                json={'model': self.embedding_model, 'input': texts,
                      'dimensions': int(config.ENV.get('EMBEDDING_DIMENSIONS') or '1536')})
        if response.status_code != 200:
            raise ValueError('embedding_provider_unavailable')
        payload = response.json()
        vectors = [item['embedding'] for item in sorted(payload.get('data', []), key=lambda item: item['index'])]
        dimension = int(config.ENV.get('EMBEDDING_DIMENSIONS') or '1536')
        if len(vectors) != len(texts) or any(len(vector) != dimension for vector in vectors):
            raise ValueError('embedding_dimensions_invalid')
        return vectors

    @staticmethod
    def _collection(row):
        if row['kind'] == 'case_observation' or row['authority'] == 'PUBLIC_JUDGMENT':
            return 'case_observations'
        if row['kind'] == 'fewshot':
            return 'fewshot_success' if json.loads(row['metadata']).get('successful_case') is True else 'practice_rules'
        if row['authority'] in ('SEOUL_PRACTICE', 'COURT_RULE', 'DIRECTIVE'):
            return 'practice_rules'
        return 'legal_norms'

    def index_pending(self, max_versions=12) -> dict:
        """Index approved public source text; no fabricated vectors or implicit case ingestion."""
        try:
            from qdrant_client import models
            client = self._vector_client()
            with self._db() as db:
                rows = [dict(row) for row in db.execute('''SELECT v.* FROM knowledge_versions v
                    LEFT JOIN knowledge_vector_index i ON i.version_id=v.version_id AND i.embedding_model=?
                    WHERE i.version_id IS NULL AND instr(v.content,char(65533))=0 AND is_blocked_bundle(v.source_bundle_hash)=0
                    AND (v.kind='official_snapshot' OR (v.kind IN ('case_observation','fewshot','reviewed_source_summary') AND v.reviewed=1))
                    ORDER BY v.recorded_at LIMIT ?''', (self.embedding_model, max(1, min(int(max_versions), 40))))]
            indexed = []
            for row in rows:
                collection = self._collection(row)
                chunks = [row['content'][max(0, start - 100):start + 1100] for start in range(0, len(row['content']), 1100)]
                points = []
                for batch_start in range(0, len(chunks), 32):
                    batch = chunks[batch_start:batch_start + 32]
                    vectors = self._embed(batch)
                    for offset, (text, vector) in enumerate(zip(batch, vectors), batch_start):
                        point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, row['version_id'] + ':' + self.embedding_model + ':' + str(offset)))
                        payload = {key: row[key] for key in ('version_id', 'source_id', 'title', 'url', 'authority', 'kind',
                            'valid_from', 'valid_to', 'recorded_at', 'content_hash', 'scope', 'tenant_id', 'source_case_id', 'source_bundle_hash')}
                        payload.update(text=text, chunk=offset, embedding_model=self.embedding_model,
                            effective_start=int((row['valid_from'] or row['recorded_at'][:10]).replace('-', '')),
                            effective_end=int((row['valid_to'] or '9999-12-31').replace('-', '')),
                            reviewed=bool(row['reviewed']), metadata=json.loads(row['metadata']))
                        points.append(models.PointStruct(id=point_id, vector=vector, payload=payload))
                with _VECTOR_LOCK:
                    client.upsert(collection, points=points, wait=True)
                with self._db() as db:
                    db.execute('INSERT OR REPLACE INTO knowledge_vector_index VALUES(?,?,?,?,?)',
                        (row['version_id'], self.embedding_model, collection, len(points), now()))
                indexed.append({'version_id': row['version_id'], 'collection': collection, 'chunks': len(points)})
            self._vector_error = None
            return {'status': 'indexed', 'embedding_model': self.embedding_model, 'versions': indexed}
        except (ImportError, RuntimeError, OSError, ValueError, httpx.HTTPError):
            self._vector_error = 'vector_index_unavailable'
            return {'status': 'vector_unavailable', 'reason': self._vector_error}

    def search(self, query, as_of=None, case_id=None, exclude_bundle_hashes=None, tenant_id='local',
               limit=3, kinds=None, known_at=None, allow_diagnostic_fallback=True) -> list[dict]:
        rows = self._eligible_versions(as_of, case_id, exclude_bundle_hashes, tenant_id, kinds, known_at)
        maximum = max(1, min(int(limit), 3))
        if not rows or not str(query).strip():
            return []
        try:
            from qdrant_client import models
            client = self._vector_client()
            with self._db() as db:
                indexed = {row[0] for row in db.execute('SELECT version_id FROM knowledge_vector_index WHERE embedding_model=?', (self.embedding_model,))}
            allowed = [row['version_id'] for row in rows if row['version_id'] in indexed]
            if not allowed:
                raise ValueError('no_eligible_indexed_sources')
            point_filter = models.Filter(must=[models.FieldCondition(key='version_id', match=models.MatchAny(any=allowed)),
                                              models.FieldCondition(key='embedding_model', match=models.MatchValue(value=self.embedding_model))])
            # allowed version IDs were resolved by temporal + ACL + provenance SQL
            # BEFORE Qdrant similarity ranking, including latest applicable version.
            vector = self._embed([str(query)[:3000]])[0]
            matches = []
            with _VECTOR_LOCK:
                for collection in VECTOR_COLLECTIONS:
                    response = client.query_points(collection_name=collection, query=vector,
                        query_filter=point_filter, limit=maximum, with_payload=True, with_vectors=False)
                    for point in response.points:
                        payload = dict(point.payload)
                        payload.update(score=point.score, collection=collection, retrieval_status='ready',
                                       retrieval_method='qdrant_dense', text=payload['text'][:1200])
                        matches.append(payload)
            self._vector_error = None
            return sorted(matches, key=lambda item: -item['score'])[:maximum]
        except (ImportError, RuntimeError, OSError, ValueError, httpx.HTTPError):
            self._vector_error = 'vector_search_unavailable'
            return self._lexical_search(query, rows, maximum) if allow_diagnostic_fallback else []

    def fewshots(self, query, as_of=None, case_id=None, exclude_bundle_hashes=None, tenant_id='local', limit=3) -> list[dict]:
        return self.search(query, as_of, case_id, exclude_bundle_hashes, tenant_id, limit,
                           kinds=['fewshot', 'case_observation'])

    def _fetch(self, source: dict) -> dict:
        url = source['url']
        if not official_url(url):
            raise ValueError('source_url_not_allowed')
        metadata = json.loads(source['metadata'])
        params = None
        credential = config.ENV.get('OFFICIAL_LAW_API_CREDENTIAL', '')
        if metadata.get('provider') == 'law_drf':
            if not credential:
                return {'status': 'credential_required'}
            params = {'OC': credential, 'target': 'eflaw', 'type': 'JSON', 'query': '채무자 회생 및 파산에 관한 법률',
                      'nw': '2,3', 'display': 10, 'page': 1}
        if urlsplit(url).path.lower().endswith('.pdf') and not metadata.get('allow_pdf'):
            return {'status': 'pdf_fetch_disabled'}
        headers = {'User-Agent': 'FirmEngine-LegalSourceWatch/1.0'}
        if source.get('etag'):
            headers['If-None-Match'] = source['etag']
        if source.get('modified'):
            headers['If-Modified-Since'] = source['modified']
        with httpx.Client(timeout=httpx.Timeout(12, connect=4), follow_redirects=False) as client:
            for _ in range(4):
                with client.stream('GET', url, params=params, headers=headers) as response:
                    if response.status_code == 304:
                        return {'status': 'not_modified'}
                    if response.is_redirect:
                        url = urljoin(url, response.headers.get('location', ''))
                        if not official_url(url):
                            raise ValueError('source_redirect_not_allowed')
                        params = None
                        continue
                    if response.status_code != 200:
                        return {'status': 'http_' + str(response.status_code)}
                    raw = bytearray()
                    byte_limit = 12_000_000 if metadata.get('allow_pdf') and 'application/pdf' in response.headers.get('content-type','') else MAX_BYTES
                    for part in response.iter_bytes():
                        raw.extend(part)
                        if len(raw) > byte_limit:
                            raise ValueError('source_too_large')
                    if 'application/pdf' in response.headers.get('content-type', ''):
                        import pymupdf
                        with pymupdf.open(stream=bytes(raw), filetype='pdf') as pdf:
                            content = '\n'.join(page.get_text() for page in pdf)
                    else:
                        content = decode_official_text(bytes(raw),response.encoding)
                    if credential:
                        content = content.replace(credential, '[credential-redacted]')
                    return {'status': 'ok', 'content': normalize_content(content),
                            'etag': response.headers.get('etag'), 'modified': response.headers.get('last-modified')}
        raise ValueError('too_many_source_redirects')

    def _apply_known_parameters(self, source, version, old, text, effective) -> dict:
        params = _caps(text) if source['source_id'] == 'K01' else None
        result = {'status': 'review_required', 'rule_id': None, 'regression_passed': False}
        if not params or not effective or not validate_cap_parameters(params):
            return result
        baseline = {'secured_cap': '1500000000', 'unsecured_cap': '1000000000'}
        with self._db() as db:
            old_approved = bool(old and db.execute('SELECT 1 FROM knowledge_parameters WHERE version_id=?', (old['version_id'],)).fetchone())
        safe = (not old and params == baseline) or (old_approved and _caps(old['content']) is not None
                                                  and _cap_skeleton(old['content']) == _cap_skeleton(text))
        if not safe:
            return result
        status = 'scheduled' if effective > date.today().isoformat() else 'auto_applied'
        validation = {'boundary_cases_passed': 5, 'semantic_template': 'unchanged_or_reviewed_initial_caps',
                      'official_url': source['url'], 'content_hash': version['content_hash']}
        with self._db() as db:
            db.execute('INSERT OR IGNORE INTO knowledge_parameters VALUES(?,?,?,?,?,?)',
                       (version['version_id'], 'KR.579.DEBT_LIMITS', effective, json_dump(params),
                        'debt-limits-v1', json_dump(validation)))
        return {'status': status, 'rule_id': 'KR.579.DEBT_LIMITS', 'regression_passed': True}

    def check_updates(self, source_ids=None, max_sources=4, analyze=True) -> dict:
        maximum = max(1, min(int(max_sources), 12))
        with self._db() as db:
            if source_ids:
                rows = db.execute('SELECT * FROM knowledge_sources WHERE source_id IN (' + ','.join('?' for _ in source_ids) + ') ORDER BY source_id', list(source_ids)).fetchall()
            else:
                rows = db.execute('SELECT * FROM knowledge_sources WHERE watch=1 ORDER BY COALESCE(checked_at,\'\'), source_id').fetchall()
            sources = [dict(row) for row in rows[:maximum]]
            if not source_ids and config.ENV.get('OFFICIAL_LAW_API_CREDENTIAL'):
                api = db.execute('SELECT * FROM knowledge_sources WHERE source_id=\'LAW_API\'').fetchone()
                if api:
                    sources = sources[:maximum - 1] + [dict(api)]
        results = []
        for source in sources:
            try:
                fetched = self._fetch(source)
                state = fetched['status']
                if state == 'ok':
                    text = normalize_content(fetched['content'])
                    if len(text) < 40:
                        raise ValueError('source_body_incomplete')
                    with self._db() as db:
                        old_row = db.execute('SELECT * FROM knowledge_versions WHERE source_id=? AND kind=\'official_snapshot\' ORDER BY recorded_at DESC LIMIT 1', (source['source_id'],)).fetchone()
                    old = dict(old_row) if old_row else None
                    if old and old['content_hash'] == digest(text):
                        state = 'unchanged'
                    else:
                        effective = source_effective_date(source['source_id'],text)
                        if source['authority'] == 'PUBLIC_JUDGMENT':
                            effective = judgment_date(text)
                        version = self.ingest_source(source_id=source['source_id'], title=source['title'], url=source['url'],
                            content=text, authority=source['authority'], valid_from=effective, kind='official_snapshot',
                            metadata={'snapshot': True, 'official_text': True, 'semantic_approval': False,
                                      'publication_is_not_effective_date': True,
                                      'judgment_not_statute': source['authority'] == 'PUBLIC_JUDGMENT'})
                        applied = self._apply_known_parameters(source, version, old, text, effective)
                        preview = preview_change(source['source_id'], source['url'], old['content'] if old else '',
                                                 text, self.db_path.parent / 'knowledge/traces') if analyze else {'status': 'not_requested'}
                        details = {'retrieval_indexed': True, 'automatic_application': applied, 'preview': preview,
                                   'source_url': source['url'], 'content_hash': version['content_hash'],
                                   'notification': '공식 원문 변경을 수집했습니다. 적용일과 영향 항목을 확인하세요.'}
                        with self._db() as db:
                            db.execute('INSERT OR IGNORE INTO knowledge_changes VALUES(?,?,?,?,?,?,?,?,0)',
                                (uuid.uuid4().hex, source['source_id'], version['version_id'], old['version_id'] if old else None,
                                 now(), effective, applied['status'], json_dump(details)))
                        state = 'version_added'
                with self._db() as db:
                    db.execute('UPDATE knowledge_sources SET checked_at=?,check_status=?,etag=COALESCE(?,etag),modified=COALESCE(?,modified) WHERE source_id=?',
                               (now(), state, fetched.get('etag'), fetched.get('modified'), source['source_id']))
                results.append({'source_id': source['source_id'], 'status': state})
            except (httpx.HTTPError, ValueError, OSError):
                with self._db() as db:
                    db.execute('UPDATE knowledge_sources SET checked_at=?,check_status=? WHERE source_id=?', (now(), 'check_failed', source['source_id']))
                results.append({'source_id': source['source_id'], 'status': 'check_failed'})
        vector_index = self.index_pending(max_versions=maximum + 5) if any(x['status'] == 'version_added' for x in results) else {'status': 'unchanged'}
        return {'checked_at': now(), 'sources': results, 'counts': dict(Counter(x['status'] for x in results)), 'vector_index': vector_index,
                'official_law_api_configured': bool(config.ENV.get('OFFICIAL_LAW_API_CREDENTIAL'))}

    def active_parameters(self, as_of=None, rule_id=None) -> list[dict]:
        as_of = iso_date(as_of) or date.today().isoformat()
        with self._db() as db:
            rows = db.execute('''SELECT p.*,v.url,v.content_hash,v.source_id FROM knowledge_parameters p
                JOIN knowledge_versions v ON v.version_id=p.version_id WHERE p.effective_from<=?
                ORDER BY p.effective_from DESC,v.recorded_at DESC''', (as_of,)).fetchall()
        applicable_sources = {row['source_id']: row['version_id'] for row in self._eligible_versions(as_of=as_of, kinds=['official_snapshot'])}
        chosen = {}
        for row in rows:
            if rule_id and row['rule_id'] != rule_id:
                continue
            # A newer applicable semantic change cannot leave an obsolete release
            # silently active. Previously frozen case releases remain untouched.
            if applicable_sources.get(row['source_id']) != row['version_id']:
                continue
            if row['rule_id'] not in chosen:
                item = dict(row)
                item['params'], item['validation'] = json.loads(item['params']), json.loads(item['validation'])
                chosen[item['rule_id']] = item
        return list(chosen.values())

    def list_changes(self, limit=50) -> list[dict]:
        with self._db() as db:
            rows = db.execute('SELECT * FROM knowledge_changes ORDER BY recorded_at DESC LIMIT ?', (max(1, min(int(limit), 200)),)).fetchall()
        return [dict(row) | {'details': json.loads(row['details'])} for row in rows]

    def status(self) -> dict:
        with self._db() as db:
            counts = {key: db.execute('SELECT COUNT(*) FROM ' + table).fetchone()[0] for key, table in
                      [('source_count', 'knowledge_sources'), ('version_count', 'knowledge_versions'), ('change_count', 'knowledge_changes')]}
            sources = [dict(row) for row in db.execute('SELECT source_id,title,url,authority,watch,checked_at,check_status FROM knowledge_sources ORDER BY source_id')]
            unread = db.execute('SELECT COUNT(*) FROM knowledge_changes WHERE acknowledged=0').fetchone()[0]
            vector_rows = db.execute('SELECT collection,SUM(chunk_count) AS count FROM knowledge_vector_index WHERE embedding_model=? GROUP BY collection', (self.embedding_model,)).fetchall()
        collections = {name: 0 for name in VECTOR_COLLECTIONS}
        collections.update({row['collection']: row['count'] for row in vector_rows})
        vector_ready = False
        try:
            client = self._vector_client()
            with _VECTOR_LOCK:
                for name in VECTOR_COLLECTIONS:
                    actual = client.count(name, exact=True).count
                    collections[name] = min(collections[name], actual)
            vector_ready = any(collections.values()) and self._vector_error is None
        except (ImportError, RuntimeError, OSError, ValueError):
            self._vector_error = 'qdrant_local_unavailable'
        return counts | {'sources': sources, 'unread_notifications': unread, 'retrieval': 'qdrant_dense_after_temporal_scope_bundle_filter',
                         'vector_ready': vector_ready, 'vector_status': 'ready' if vector_ready else 'vector_unavailable',
                         'vector_reason': self._vector_error or (None if vector_ready else 'no_indexed_sources'),
                         'collections': collections, 'embedding_model': self.embedding_model,
                         'official_law_api_configured': bool(config.ENV.get('OFFICIAL_LAW_API_CREDENTIAL')),
                         'automatic_parameter_rules': ['KR.579.DEBT_LIMITS'], 'schedule': 'daily_09_Asia_Seoul_via_n8n'}
