"""Reload editable prompts and journal private call data within live sessions only."""
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import secrets
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from . import config


PROMPTBOOK_ROOT = config.ROOT / 'promptbook'
RUNTIME_FILES = ('config.json', 'system.md', 'body.md', 'input.schema.json', 'output.schema.json')
PLACEHOLDER = re.compile(r'\{\{\s*([a-z][a-z0-9_]*)\s*\}\}')


class PromptbookError(RuntimeError):
    """A prompt file needs correction before any provider call is made."""


class StrictInput(BaseModel):
    model_config = ConfigDict(extra='forbid')


class InputPage(StrictInput):
    document_id: str = Field(min_length=1)
    page: int = Field(ge=1)


class PageManifest(StrictInput):
    pages: list[InputPage] = Field(min_length=1)


class ClassificationInput(PageManifest):
    document_types: dict[str, str] = Field(default_factory=dict)


class ExtractionInput(PageManifest):
    allowed_key_labels: dict[str, str]
    review_only_keys: list[str]
    document_type: str = 'unknown'
    reference_context: list[dict[str, str]] = Field(default_factory=list)
    extraction_pass: Literal['initial', 'missing_features'] = 'initial'


class PromptConfig(StrictInput):
    version: str = Field(min_length=1, max_length=64, pattern=r'^\S+$')
    model: str = Field(min_length=1, max_length=128, pattern=r'^[a-zA-Z0-9_.:/-]+$')
    reasoning_effort: Literal['low', 'medium', 'high']
    max_output_tokens: int = Field(ge=256, le=64000)
    image_long_edge: int = Field(ge=256, le=4000)
    batch_pages: int = Field(default=4, ge=1, le=16)
    max_input_tokens: int = Field(default=24000, ge=512, le=128000)
    image_token_estimate: int = Field(default=2400, ge=128, le=16000)
    global_concurrency: int = Field(default=3, ge=1, le=12)
    agent_concurrency: int = Field(default=2, ge=1, le=12)
    http_retries: int = Field(default=2, ge=0, le=4)
    missing_feature_retries: int = Field(default=1, ge=0, le=2)
    request_timeout_seconds: int = Field(default=240, ge=5, le=600)
    connect_timeout_seconds: int = Field(default=20, ge=1, le=60)
    queue_timeout_seconds: int = Field(default=300, ge=1, le=1800)
    retry_backoff_seconds: float = Field(default=2, ge=0, le=30)
    rag_top_k: int = Field(default=3, ge=0, le=3)
    rag_chars_per_hit: int = Field(default=900, ge=100, le=2000)
    max_features_per_task: int = Field(default=48, ge=8, le=96)


INPUT_MODELS = {'classify': ClassificationInput, 'extract': ExtractionInput}


def runtime_config(agent: str) -> PromptConfig:
    """Read limits before planning a batch; load_prompt takes a fresh request snapshot."""
    if not re.fullmatch(r'[a-z][a-z0-9_-]{0,63}', agent):
        raise PromptbookError('잘못된 에이전트 이름입니다.')
    path = PROMPTBOOK_ROOT / agent / 'config.json'
    try:
        text = path.read_text(encoding='utf-8')
    except (OSError, UnicodeDecodeError):
        raise PromptbookError(f'promptbook/{agent}/config.json: UTF-8 설정 파일을 읽을 수 없습니다.') from None
    return _validate(PromptConfig, _json(text, path), f'promptbook/{agent}/config.json')


@dataclass(frozen=True)
class PromptBundle:
    agent: str
    version: str
    instructions: str
    body: str
    output_schema: dict
    model: str
    reasoning_effort: str
    max_output_tokens: int
    image_long_edge: int
    sha256: str
    file_hashes: dict[str, str]
    input_json: str
    runtime: PromptConfig


@dataclass(frozen=True)
class TraceContext:
    session_directory: Path
    session_identity: tuple[int, int]
    sources_json: str


@dataclass(frozen=True)
class TraceJournal:
    directory: Path
    context: TraceContext
    bundle: PromptBundle
    started_at: str
    call_id: str


class PromptContent(list):
    """A list-compatible request body with its own immutable prompt snapshot."""

    def __init__(self, bundle: PromptBundle, image_parts: list, trace_context: TraceContext | None = None):
        super().__init__([{'type': 'input_text', 'text': bundle.body}, *image_parts])
        self.promptbook = bundle
        self.trace_context = trace_context


def _json(text: str, path: Path) -> dict:
    try:
        value = json.loads(text)
    except json.JSONDecodeError as exc:
        raise PromptbookError(f'{path.name}: JSON 문법 오류 (줄 {exc.lineno}, 열 {exc.colno}).') from None
    if not isinstance(value, dict):
        raise PromptbookError(f'{path.name}: JSON 객체가 필요합니다.')
    return value


def _validate(model, data, label):
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        # Pydantic's normal message can contain full input values. Report locations only.
        fields = ', '.join('.'.join(str(part) for part in error['loc']) or '(root)'
                           for error in exc.errors(include_input=False, include_url=False))
        raise PromptbookError(f'{label}: 입력 형식을 확인하세요 ({fields}).') from None


def _schema(text, path, model):
    actual = _json(text, path)
    expected = model.model_json_schema()
    if actual != expected:
        raise PromptbookError(
            f'{path.parent.name}/{path.name}: {model.__name__} Pydantic 계약과 일치하지 않습니다. '
            '스키마 구조를 바꾸려면 Python 모델과 스키마 파일을 함께 수정하세요.')
    return actual


def _render(template: str, variables: dict[str, str], label: str) -> tuple[str, set[str]]:
    if not template.strip():
        raise PromptbookError(f'{label}: 비어 있는 프롬프트입니다.')
    # Inspect template syntax before insertion: input containing braces is always literal data.
    remainder = PLACEHOLDER.sub('', template)
    if '{{' in remainder or '}}' in remainder:
        raise PromptbookError(f'{label}: 잘못된 자리표시자입니다. {{{{identifier}}}} 형식을 사용하세요.')
    names = set(PLACEHOLDER.findall(template))
    unknown = names - variables.keys()
    if unknown:
        raise PromptbookError(f'{label}: 알 수 없는 자리표시자: {", ".join(sorted(unknown))}.')
    return PLACEHOLDER.sub(lambda match: variables[match.group(1)], template), names


def load_prompt(agent: str, input_data: dict, output_model, *, input_model=None) -> PromptBundle:
    """No cache: editing a file affects the next call, including concurrent batches."""
    if not isinstance(agent, str) or not re.fullmatch(r'[a-z][a-z0-9_-]{0,63}', agent):
        raise PromptbookError('promptbook 에이전트 이름에 사용할 수 없는 문자가 있습니다.')
    input_model = input_model or INPUT_MODELS.get(agent)
    if input_model is None:
        raise PromptbookError('지원하지 않는 promptbook 에이전트입니다.')
    directory = PROMPTBOOK_ROOT / agent
    raw = {}
    texts = {}
    for name in RUNTIME_FILES:
        try:
            raw[name] = (directory / name).read_bytes()
            texts[name] = raw[name].decode('utf-8')
        except OSError:
            raise PromptbookError(f'promptbook/{agent}/{name}: 파일을 읽을 수 없습니다.') from None
        except UnicodeDecodeError:
            raise PromptbookError(f'promptbook/{agent}/{name}: UTF-8로 저장하세요.') from None
    settings = _validate(PromptConfig, _json(texts['config.json'], directory / 'config.json'),
                         f'promptbook/{agent}/config.json')
    _schema(texts['input.schema.json'], directory / 'input.schema.json', input_model)
    output_schema = _schema(texts['output.schema.json'], directory / 'output.schema.json', output_model)
    validated = _validate(input_model, input_data, f'promptbook/{agent} 입력').model_dump()
    aliases = {'allowed_key_labels': 'allowed_keys'}
    variables = {aliases.get(key, key) + '_json': json.dumps(value, ensure_ascii=False)
                 for key, value in validated.items()}
    system, system_names = _render(texts['system.md'], variables, f'{agent}/system.md')
    body, body_names = _render(texts['body.md'], variables, f'{agent}/body.md')
    missing = variables.keys() - (system_names | body_names)
    if missing:
        raise PromptbookError(f'{agent}/body.md: 필수 자리표시자가 없습니다: {", ".join(sorted(missing))}.')
    hashes = {name: hashlib.sha256(raw[name]).hexdigest() for name in RUNTIME_FILES}
    digest = hashlib.sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest()
    return PromptBundle(agent=agent, version=settings.version, instructions=system, body=body,
                        output_schema=output_schema,
                        model=config.MODEL if settings.model == 'configured' else settings.model,
                        reasoning_effort=settings.reasoning_effort,
                        max_output_tokens=settings.max_output_tokens, image_long_edge=settings.image_long_edge,
                        sha256=digest, file_hashes=hashes,
                        input_json=json.dumps(validated, ensure_ascii=False, indent=2), runtime=settings)


def record_usage(metrics: dict, bundle: PromptBundle) -> None:
    """Record provenance per attempted call, not prompt text, pages, names, or API keys."""
    versions = metrics.setdefault('promptbook', [])
    row = next((item for item in versions if item['agent'] == bundle.agent
                and item['sha256'] == bundle.sha256 and item['model'] == bundle.model), None)
    if row is None:
        row = {'agent': bundle.agent, 'version': bundle.version, 'sha256': bundle.sha256,
               'file_hashes': dict(bundle.file_hashes), 'model': bundle.model, 'calls': 0}
        versions.append(row)
    row['calls'] += 1


def trace_context(items) -> TraceContext | None:
    """Only existing documents directly inside a legitimate local session can journal."""
    if not items:
        return None
    try:
        root = (config.RUNTIME / 'sessions').resolve(strict=True)
        first_doc = items[0][0]
        first = Path(first_doc['_path']).resolve(strict=True)
        case_id = first_doc.get('_case_id')
        if case_id is not None:
            if not re.fullmatch(r'[0-9a-f]{32}', str(case_id)):
                return None
            session = Path(first_doc.get('_journal_root', '')).resolve(strict=True)
            if session != root / case_id:
                return None
        else:
            session = first.parent
        if session.parent != root or not re.fullmatch(r'[0-9a-f]{32}', session.name):
            return None
        stat = session.stat()
        sources = []
        for doc, page in items:
            source = Path(doc['_path']).resolve(strict=True)
            storage_case = (config.RUNTIME / 'storage' / 'cases' / session.name).resolve()
            in_storage = doc.get('_case_id') == session.name and source.is_relative_to(storage_case)
            if (source.parent != session and not in_storage) or not source.is_file():
                return None
            if case_id and (doc.get('_case_id') != case_id or Path(doc.get('_journal_root', '')).resolve() != session):
                return None
            sources.append({'document_id': doc['id'], 'document_name': str(doc.get('name', '')),
                            'page': page, 'physical_page': doc.get('_page_map', {}).get(page, page),
                            'label': f"DOCUMENT_ID={doc['id']} PAGE={page}"})
        return TraceContext(session, (stat.st_dev, stat.st_ino),
                            json.dumps(sources, ensure_ascii=False, indent=2))
    except (OSError, ValueError, KeyError, TypeError):
        return None


def _session_alive(context: TraceContext) -> bool:
    try:
        session = context.session_directory
        stat = session.stat()
        return (session.is_dir() and session.resolve(strict=True) == session
                and (stat.st_dev, stat.st_ino) == context.session_identity)
    except OSError:
        return False


def _trace_meta(journal: TraceJournal, status: str, **details) -> dict:
    bundle = journal.bundle
    return {'call_id': journal.call_id, 'agent': bundle.agent, 'status': status,
            'started_at': journal.started_at, 'updated_at': datetime.now(timezone.utc).isoformat(),
            'model': bundle.model, 'version': bundle.version, 'sha256': bundle.sha256,
            'file_hashes': dict(bundle.file_hashes), 'reasoning_effort': bundle.reasoning_effort,
            'max_output_tokens': bundle.max_output_tokens, 'image_long_edge': bundle.image_long_edge,
            'runtime_limits': {name: getattr(bundle.runtime, name) for name in
                               ('batch_pages', 'max_input_tokens', 'image_token_estimate', 'global_concurrency',
                                'agent_concurrency', 'http_retries', 'missing_feature_retries',
                                'request_timeout_seconds', 'connect_timeout_seconds', 'queue_timeout_seconds')},
            'case_id': journal.context.session_directory.name, 'store': False, **details}


def start_trace(bundle: PromptBundle, context: TraceContext | None, instructions: str) -> TraceJournal | None:
    if context is None or not _session_alive(context):
        return None
    try:
        call_id = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '-' + secrets.token_hex(6)
        directory = context.session_directory
        for name in ('promptbook', bundle.agent, call_id):
            if not _session_alive(context):
                return None
            directory = directory / name
            # Never use parents=True: a completed/cancelled request cannot recreate a session.
            directory.mkdir(exist_ok=True)
            if directory.resolve(strict=True) != directory or not directory.is_dir():
                return None
        journal = TraceJournal(directory, context, bundle, datetime.now(timezone.utc).isoformat(), call_id)
        data = {'logical_input': json.loads(bundle.input_json), 'sources': json.loads(context.sources_json)}
        files = {'system.md': instructions, 'body.md': bundle.body,
                 'input.json': json.dumps(data, ensure_ascii=False, indent=2),
                 'meta.json': json.dumps(_trace_meta(journal, 'queued'), ensure_ascii=False, indent=2)}
        for name, text in files.items():
            if not _session_alive(context):
                return None
            with (directory / name).open('x', encoding='utf-8') as handle:
                handle.write(text if name.endswith('.md') else text + '\n')
        return journal
    except OSError:
        # Optional audit I/O must not expose source paths or recreate expired storage.
        return None


def finish_trace(journal: TraceJournal | None, *, result=None, usage=None,
                 status='completed', error_code=None, http_status=None) -> None:
    if journal is None or not _session_alive(journal.context):
        return
    try:
        directory = journal.directory
        if directory.resolve(strict=True) != directory or not directory.is_dir():
            return
        details = {'usage': usage or {}}
        if error_code is not None:
            details['error_code'] = error_code
        if http_status is not None:
            details['http_status'] = http_status
        if result is not None:
            # This is the complete validated structured output, before application filtering.
            with (directory / 'output.json').open('x', encoding='utf-8') as handle:
                handle.write(json.dumps(result.model_dump(), ensure_ascii=False, indent=2) + '\n')
        # No mkdir here: session removal wins even if the provider responds later.
        (directory / 'meta.json').write_text(
            json.dumps(_trace_meta(journal, status, **details), ensure_ascii=False, indent=2) + '\n',
            encoding='utf-8')
    except OSError:
        return


def trace_event(journal: TraceJournal | None, status: str, **details) -> None:
    """Per-call JSONL contains queue/timing/counts only, never prompts or provider errors."""
    if journal is None or not _session_alive(journal.context):
        return
    allowed = {'attempt', 'queue_wait_ms', 'request_ms', 'estimated_input_tokens', 'input_tokens',
               'output_tokens', 'total_tokens', 'error_code', 'http_status', 'queue_depth'}
    safe = {key: value for key, value in details.items() if key in allowed and isinstance(value, (int, float, str))}
    row = {'at': datetime.now(timezone.utc).isoformat(), 'call_id': journal.call_id,
           'agent': journal.bundle.agent, 'model': journal.bundle.model,
           'version': journal.bundle.version, 'sha256': journal.bundle.sha256, 'status': status, **safe}
    try:
        if journal.directory.resolve(strict=True) != journal.directory:
            return
        with (journal.directory / 'usage.jsonl').open('a', encoding='utf-8') as handle:
            handle.write(json.dumps(row, ensure_ascii=False) + '\n')
    except OSError:
        return
