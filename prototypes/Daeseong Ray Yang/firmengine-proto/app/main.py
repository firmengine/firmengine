from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import secrets
import shutil
import time
from urllib.parse import urlparse

import fitz
import httpx
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import ai, config, engine

SESSIONS: dict[str, dict] = {}
TASKS: dict[str, asyncio.Task] = {}


def now():
    return datetime.now(timezone.utc).isoformat()


def session_dir(sid):
    target = (config.RUNTIME / 'sessions' / sid).resolve()
    root = (config.RUNTIME / 'sessions').resolve()
    if target.parent != root or not sid.isalnum():
        raise ValueError('Invalid session path')
    return target


def remove_session(sid):
    session = SESSIONS.pop(sid, None)
    if session is not None:
        session['_closed'] = True
    task = TASKS.pop(sid, None)
    if task:
        task.cancel()
    target = session_dir(sid)  # resolved and confined before recursive removal
    if target.exists():
        shutil.rmtree(target)


def get_session(sid):
    s = SESSIONS.get(sid)
    if not s:
        raise HTTPException(404, '세션이 없거나 종료되었습니다.')
    if time.monotonic() - s['_last_activity'] > config.TTL:
        remove_session(sid)
        raise HTTPException(410, '60분 미사용으로 세션이 종료되었습니다.')
    return s


def public(s):
    result = {k: v for k, v in s.items() if not k.startswith('_')}
    result['documents'] = [{k: v for k, v in d.items() if not k.startswith('_')} for d in s['documents']]
    return result


def invalidate(s):
    s['revision'] += 1
    s['reviews'] = {'caseworker': None, 'lawyer': None}
    s['artifacts'] = []
    s['status'] = 'ready'
    s['stage'] = 'edited'
    target = (session_dir(s['id']) / 'artifacts').resolve()
    if target.parent != session_dir(s['id']):
        raise ValueError('Invalid artifacts path')
    if target.exists():
        shutil.rmtree(target)


def parse_pages(value, count):
    if not value.strip():
        return None
    pages = set()
    try:
        for part in value.split(','):
            bits = part.strip().split('-')
            if len(bits) == 1:
                pages.add(int(bits[0]))
            elif len(bits) == 2:
                lo, hi = map(int, bits)
                if hi < lo or hi - lo > count:
                    raise ValueError()
                pages.update(range(lo, hi + 1))
            else:
                raise ValueError()
        if not pages or min(pages) < 1 or max(pages) > count:
            raise ValueError()
    except ValueError:
        raise HTTPException(422, '증빙 페이지 범위를 확인하세요. 예: 6-21,36-68')
    return sorted(pages)


def create_session():
    sid = secrets.token_hex(16)
    s = {'id': sid, 'status': 'uploaded', 'stage': 'uploaded', 'progress': 0,
         'message': '증빙 분석을 시작할 수 있습니다.', 'revision': 1, 'documents': [],
         'records': [], 'issues': [], 'calculations': [], 'artifacts': [],
         'reviews': {'caseworker': None, 'lawyer': None}, 'template_approved': False,
         'metrics': {}, 'created_at': now(), 'evidence_pages_used': [],
         '_last_activity': time.monotonic(), '_closed': False, '_token': '', '_completed': set(), '_lock': asyncio.Lock()}
    session_dir(sid).mkdir(parents=True, exist_ok=True)
    SESSIONS[sid] = s
    return s


def add_document(s, filename, content, selection=''):
    suffix = Path(filename or '').suffix.lower()
    if suffix not in ('.pdf', '.jpg', '.jpeg', '.png'):
        raise HTTPException(422, 'PDF·JPG·PNG 파일만 업로드할 수 있습니다.')
    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(413, '파일당 최대 100MB입니다.')
    did = secrets.token_hex(8)
    path = session_dir(s['id']) / (did + suffix)
    try:
        with fitz.open(stream=content, filetype=suffix.lstrip('.')) as source:
            if source.needs_pass:
                raise HTTPException(422, '암호를 해제한 파일을 업로드하세요.')
            if suffix != '.pdf':
                content = source.convert_to_pdf()
                path = path.with_suffix('.pdf')
                count = 1
            else:
                count = len(source)
            if count < 1 or count + sum(d['pages'] for d in s['documents']) > 180:
                raise HTTPException(422, '프로토타입은 한 세션 최대 180쪽을 처리합니다.')
        pages = parse_pages(selection, count)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(422, '파일을 읽을 수 없습니다. PDF 또는 이미지 형식을 확인하세요.')
    path.write_bytes(content)
    doc = {'id': did, 'name': Path(filename).name, 'pages': count,
           'evidence_pages': pages or [], 'excluded_pages': [], 'page_roles': [],
           '_path': str(path), '_selected': pages is not None}
    if pages is not None:
        doc['excluded_pages'] = sorted(set(range(1, count + 1)) - set(pages))
    s['documents'].append(doc)


async def reaper():
    while True:
        await asyncio.sleep(15)
        for sid, s in list(SESSIONS.items()):
            if time.monotonic() - s['_last_activity'] > config.TTL:
                remove_session(sid)


@asynccontextmanager
async def lifespan(app):
    root = config.RUNTIME / 'sessions'
    root.mkdir(parents=True, exist_ok=True)
    # No reconnect recovery: clean orphaned session directories after a process restart.
    for old in root.iterdir():
        if old.is_dir() and old.name.isalnum() and old.resolve().parent == root.resolve():
            shutil.rmtree(old)
    cleaner = asyncio.create_task(reaper())
    yield
    cleaner.cancel()
    with suppress(asyncio.CancelledError):
        await cleaner
    for sid in list(SESSIONS):
        remove_session(sid)


app = FastAPI(title='Firm Engine · n8n P0', lifespan=lifespan)


@app.middleware('http')
async def local_boundary(request: Request, call_next):
    # A local-only application; prevent cross-origin writes to unauthenticated loopback API.
    host = request.headers.get('host', '').split(':')[0]
    if host not in ('127.0.0.1', 'localhost', 'testserver'):
        return JSONResponse({'detail': 'Local access only'}, status_code=403)
    origin = request.headers.get('origin')
    if origin and urlparse(origin).netloc != request.headers.get('host'):
        return JSONResponse({'detail': 'Cross-origin access blocked'}, status_code=403)
    response = await call_next(request)
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response


@app.get('/api/health')
async def health():
    ready = False
    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            ready = (await client.get(config.N8N_URL + '/healthz')).status_code == 200
    except httpx.HTTPError:
        pass
    return {'model': config.MODEL, 'api_key_configured': bool(config.API_KEY),
            'n8n_url': config.N8N_URL, 'n8n_ready': ready}


@app.post('/api/sessions')
async def upload(request: Request):
    # Accept files or files[] to make browser and CLI clients equivalent.
    form = await request.form(max_files=20, max_part_size=100 * 1024 * 1024)
    uploads = form.getlist('files') + form.getlist('files[]')
    if not uploads:
        await form.close()
        raise HTTPException(422, '파일을 선택하세요.')
    selection = str(form.get('evidence_pages', ''))
    if selection and len(uploads) != 1:
        await form.close()
        raise HTTPException(422, '페이지 지정은 단일 PDF 업로드에서 사용하세요.')
    s = create_session()
    try:
        for file in uploads:
            if not hasattr(file, 'read'):
                raise HTTPException(422, '잘못된 업로드입니다.')
            data = await file.read(100 * 1024 * 1024 + 1)
            await asyncio.to_thread(add_document, s, file.filename, data, selection)
    except Exception:
        remove_session(s['id'])
        raise
    finally:
        await form.close()
    return public(s)


@app.post('/api/sessions/sample')
async def sample():
    source = config.ROOT.parent / 'sample.pdf'
    manifest_path = config.ROOT / 'evaluation' / 'sample_manifest.json'
    if not source.exists() or not manifest_path.exists():
        raise HTTPException(404, '../sample.pdf와 독립 분리 manifest가 필요합니다.')
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    content = await asyncio.to_thread(source.read_bytes)
    if hashlib.sha256(content).hexdigest() != manifest['source_sha256']:
        raise HTTPException(409, '샘플이 변경되어 페이지 분리를 다시 확인해야 합니다.')
    s = create_session()
    add_document(s, 'sample.pdf', content, ','.join(map(str, manifest['evidence_pages'])))
    s['message'] = '독립평가용 증빙 페이지만 입력합니다. 제출본은 생성에서 제외됩니다.'
    return public(s)


@app.get('/api/sessions/{sid}')
async def status(sid: str):
    return public(get_session(sid))  # polling must NOT prolong retention


@app.post('/api/sessions/{sid}/heartbeat')
async def heartbeat(sid: str):
    get_session(sid)['_last_activity'] = time.monotonic()
    return {'ok': True}


@app.delete('/api/sessions/{sid}')
async def close(sid: str):
    get_session(sid)
    remove_session(sid)
    return {'ok': True}


@app.get('/api/sessions/{sid}/pages/{did}/{page}')
async def page_preview(sid: str, did: str, page: int):
    s = get_session(sid)
    doc = next((d for d in s['documents'] if d['id'] == did), None)
    if not doc or page not in doc['evidence_pages']:
        raise HTTPException(404, '생성에 사용한 증빙 페이지만 열람할 수 있습니다.')
    return Response(await asyncio.to_thread(ai.page_image, doc['_path'], page, 1500), media_type='image/jpeg')


async def classify_stage(s):
    s.update(stage='classify', progress=5, message='증빙과 제출 완료본을 분류하고 있습니다.')
    for doc in s['documents']:
        if doc['_selected']:
            continue
        items = [(doc, p) for p in range(1, doc['pages'] + 1)]
        for start in range(0, len(items), 8):
            get_session(s['id'])
            result = await ai.classify(items[start:start + 8], s['metrics'])
            valid = {(d['id'], p) for d, p in items[start:start + 8]}
            roles = [p.model_dump() for p in result.pages if (p.document_id, p.page) in valid]
            doc['page_roles'].extend(roles)
        doc['evidence_pages'] = sorted({p['page'] for p in doc['page_roles'] if p['role'] == 'evidence'})
        doc['excluded_pages'] = sorted(set(range(1, doc['pages'] + 1)) - set(doc['evidence_pages']))
    s['evidence_pages_used'] = [{'document_id': d['id'], 'page': p} for d in s['documents'] for p in d['evidence_pages']]
    if not s['evidence_pages_used']:
        raise RuntimeError('추출할 증빙 페이지가 없습니다. 증빙 페이지 범위를 지정해 다시 업로드하세요.')


async def extract_stage(s):
    s.update(stage='extract', progress=12, message='GPT-6 Luna가 증빙에서 원문 근거와 값을 추출합니다.')
    items = [(d, p) for d in s['documents'] for p in d['evidence_pages']]
    batches = [items[i:i + config.BATCH_SIZE] for i in range(0, len(items), config.BATCH_SIZE)]
    semaphore = asyncio.Semaphore(config.CONCURRENCY)
    done = 0

    async def worker(batch):
        nonlocal done
        async with semaphore:
            get_session(s['id'])
            facts = await ai.extract(batch, s['metrics'])
            get_session(s['id'])
            done += 1
            s.update(progress=12 + int(65 * done / len(batches)), message=f'증빙 추출 {done}/{len(batches)} 묶음 완료')
            return facts

    tasks = [asyncio.create_task(worker(b)) for b in batches]
    try:
        results = await asyncio.gather(*tasks)
    except BaseException:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        raise
    s['records'] = engine.merge_facts([f for batch in results for f in batch])
    s['metrics']['evidence_pages'] = len(items)
    s['metrics']['extracted_records'] = len(s['records'])


async def validate_stage(s):
    s.update(stage='validate', progress=82, message='충돌·누락·기간과 계산 의존성을 확인합니다.')
    engine.validate(s)


async def generate_stage(s):
    from .rendering import render_bundle
    s.update(stage='generate', progress=90, message='법원 양식 기반 DOCX·XLSX 초안을 생성합니다.')
    out = session_dir(s['id']) / 'artifacts'
    out.mkdir(exist_ok=True)
    items = await asyncio.to_thread(render_bundle, s, out)
    # Expiry/deletion during a render must not resurrect artifacts.
    if s.get('_closed') or s['id'] not in SESSIONS:
        target = session_dir(s['id'])
        if target.exists():
            shutil.rmtree(target)
        raise RuntimeError('종료된 세션입니다.')
    for item in items:
        item['url'] = f"/api/sessions/{s['id']}/artifacts/{item['name']}"
    s['artifacts'] = items
    s.update(status='ready', stage='review', progress=100, message='초안이 생성되었습니다. 원본 대조 후 담당자·변호사 확인을 진행하세요.')
    s['metrics']['workflow_seconds'] = round(time.monotonic() - s.get('_started', time.monotonic()), 2)


STAGES = {'classify': classify_stage, 'extract': extract_stage, 'validate': validate_stage, 'generate': generate_stage}


class StageRequest(BaseModel):
    session_id: str
    run_token: str


@app.post('/internal/stages/{stage}')
async def workflow_stage(stage: str, body: StageRequest):
    s = get_session(body.session_id)
    if not s['_token'] or not secrets.compare_digest(s['_token'], body.run_token):
        raise HTTPException(403, '실행 토큰이 올바르지 않습니다.')
    if stage not in STAGES:
        raise HTTPException(404, 'Unknown stage')
    async with s['_lock']:
        get_session(body.session_id)
        if not secrets.compare_digest(s['_token'], body.run_token):
            raise HTTPException(403, '만료된 실행 토큰입니다.')
        if s['status'] == 'failed':
            return {'session_id': s['id'], 'run_token': body.run_token, 'ok': False, 'stage': stage}
        order = list(STAGES)
        if stage not in s['_completed']:
            previous = order[:order.index(stage)]
            if not all(p in s['_completed'] for p in previous):
                raise HTTPException(409, '앞 단계를 먼저 실행해야 합니다.')
            try:
                await STAGES[stage](s)
                s['_completed'].add(stage)
            except Exception as exc:
                s.update(status='failed', stage=stage, message=str(exc) if isinstance(exc, RuntimeError) else f'{stage} 처리에 실패했습니다. 다시 실행하거나 입력 파일을 확인하세요.')
    # Only opaque IDs/status cross the n8n boundary; no original text, extracted facts, or API keys.
    return {'session_id': s['id'], 'run_token': body.run_token, 'ok': s['status'] != 'failed', 'stage': stage}


@app.post('/api/sessions/{sid}/run')
async def run(sid: str):
    s = get_session(sid)
    if s['status'] == 'running' or s['_lock'].locked():
        raise HTTPException(409, '이미 실행 중입니다.')
    if s['records']:
        raise HTTPException(409, '추출 결과가 있습니다. 수정 후 문서 재생성을 사용하세요.')
    if not config.API_KEY:
        raise HTTPException(503, '상위 .env의 OpenAI API 키를 설정하세요.')
    s.update(status='running', stage='queued', progress=1, message='n8n 워크플로를 시작합니다.')
    s['_token'] = secrets.token_hex(24)
    s['_completed'] = set()
    s['_started'] = time.monotonic()
    s['_last_activity'] = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(config.N8N_URL + '/webhook/firmengine-p0', json={'session_id': sid, 'run_token': s['_token']})
            response.raise_for_status()
    except httpx.HTTPError:
        s.update(status='failed', message='n8n 연결 실패. start-local 실행 및 워크플로 활성 상태를 확인하세요.')
        s['_token'] = ''
        raise HTTPException(503, s['message'])
    return public(s)


class EditRequest(BaseModel):
    value: str | None = Field(max_length=20000)
    confirmed: bool = True
    reason: str = Field(min_length=2, max_length=1000)
    excluded: bool = False


@app.patch('/api/sessions/{sid}/records/{rid}')
async def edit(sid: str, rid: str, body: EditRequest):
    s = get_session(sid)
    if s['status'] == 'running' or s['_lock'].locked():
        raise HTTPException(409, '추출 완료 후 수정하세요.')
    record = next((r for r in s['records'] if r['id'] == rid), None)
    if not record:
        raise HTTPException(404, '항목을 찾을 수 없습니다.')
    if body.confirmed and not body.excluded and (body.value is None or not body.value.strip()):
        raise HTTPException(422, '값이 없는 항목은 확인 완료로 처리할 수 없습니다.')
    if body.confirmed and not body.excluded and record['unit'] in ('KRW', 'months'):
        value = engine.number(body.value)
        if value is None or value < 0 or (record['unit'] == 'months' and (value <= 0 or value != value.to_integral_value())):
            raise HTTPException(422, '금액·기간을 숫자로 확인하세요. 음수·불명확한 값은 사용할 수 없습니다.')
    invalidate(s)
    record.update(value=body.value, state='excluded' if body.excluded else ('confirmed' if body.confirmed else 'unreviewed'),
                  review_reason=body.reason, reviewed_at=now())
    s['_last_activity'] = time.monotonic()
    engine.validate(s)
    s['message'] = '값이 변경되었습니다. 문서를 재생성한 뒤 다시 확인하세요.'
    return public(s)


@app.post('/api/sessions/{sid}/generate')
async def regenerate(sid: str):
    s = get_session(sid)
    if s['status'] == 'running' or s['_lock'].locked() or not s['records']:
        raise HTTPException(409, '추출 완료 후 생성하세요.')
    async with s['_lock']:
        invalidate(s)
        s['_last_activity'] = time.monotonic()
        engine.validate(s)
        s['status'] = 'running'
        try:
            await generate_stage(s)
        except Exception:
            s.update(status='failed', message='문서 생성에 실패했습니다. 입력값을 확인하고 다시 생성하세요.')
            raise HTTPException(500, s['message'])
    return public(s)


class ReviewRequest(BaseModel):
    role: str
    name: str = Field(min_length=2, max_length=100)
    template_approved: bool = False


@app.post('/api/sessions/{sid}/review')
async def review(sid: str, body: ReviewRequest):
    s = get_session(sid)
    if body.role not in ('caseworker', 'lawyer'):
        raise HTTPException(422, '확인 역할을 선택하세요.')
    if len(body.name.strip()) < 2:
        raise HTTPException(422, '확인자 이름을 입력하세요.')
    if not s['artifacts'] or s['status'] == 'running' or s['_lock'].locked():
        raise HTTPException(409, '먼저 현재 입력값으로 서류를 생성하세요.')
    async with s['_lock']:
        if body.template_approved:
            s['template_approved'] = True
        engine.validate(s)
        blockers = [i for i in s['issues'] if i['severity'] == 'blocking']
        if blockers:
            raise HTTPException(409, f"미해결 항목 {len(blockers)}건이 있습니다. 원본·필수값·산식을 확인하세요.")
        if body.role == 'lawyer' and not s['reviews']['caseworker']:
            raise HTTPException(409, '담당자 확인 후 변호사 최종 확인을 진행하세요.')
        s['reviews'][body.role] = {'name': body.name.strip(), 'at': now(), 'revision': s['revision']}
        s['_last_activity'] = time.monotonic()
        s['status'] = 'running'
        try:
            await generate_stage(s)  # same content/revision; status/audit metadata only
        except Exception:
            s['reviews'][body.role] = None
            s.update(status='failed', message='확인 정보 반영 중 출력에 실패했습니다. 다시 생성하세요.')
            raise HTTPException(500, s['message'])
        if body.role == 'lawyer':
            s.update(status='reviewed', message='생성된 서류의 담당자·변호사 확인이 완료되었습니다.')
    return public(s)


@app.get('/api/sessions/{sid}/artifacts/{name}')
async def download(sid: str, name: str):
    s = get_session(sid)
    item = next((a for a in s['artifacts'] if a['name'] == name), None)
    if not item or Path(name).name != name:
        raise HTTPException(404, '파일이 없거나 이전 버전입니다.')
    path = session_dir(sid) / 'artifacts' / name
    if not path.exists():
        raise HTTPException(404, '파일이 만료되었습니다.')
    return FileResponse(path, filename=name)


static = config.ROOT / 'static'
static.mkdir(exist_ok=True)
app.mount('/', StaticFiles(directory=static, html=True), name='ui')
