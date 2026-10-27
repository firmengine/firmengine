#!/usr/bin/env python3
"""Run request-only synthetic PDFs through the private Site pipeline.

This runner deliberately has no gold/manifest argument or import. It creates
one private case per one-page PDF, submits only the original and raster page,
and exports the stored read-fields JSON for offline scoring. A process step is
one `/process` API action and the global --max-steps cap bounds model-stage
calls for the whole invocation. The Site's own secret OPENAI_API_KEY is used;
this tool never accepts or reads one.
"""
import argparse
import concurrent.futures
import threading
import getpass
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import socket
import time
from urllib.parse import urlparse, quote
import urllib.error
import urllib.request

import fitz
from PIL import Image

MODEL = 'gpt-6-luna'
MAX_PDF_BYTES = 100_000_000
MAX_PAGE_BYTES = 8_000_000

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

class StageBudget:
    def __init__(self, limit, used=0): self.limit, self.used, self.lock = limit, used, threading.Lock()
    def consume(self):
        with self.lock:
            if self.used >= self.limit: raise RuntimeError('Global process-stage budget exhausted')
            self.used += 1

class SiteClient:
    def __init__(self, origin, token):
        self.origin = origin.rstrip('/')
        self.headers = {'OAI-Sites-Authorization': 'Bearer ' + token, 'Accept-Encoding': 'gzip'}
        self.opener = urllib.request.build_opener(NoRedirect())

    def call(self, path, method='GET', payload=None, data=None, mime=None, timeout=180, extra_headers=None):
        headers = dict(self.headers)
        if extra_headers: headers.update(extra_headers)
        if payload is not None:
            data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
            mime = 'application/json'
        if mime:
            headers['Content-Type'] = mime
        if data is not None:
            headers['Content-Length'] = str(len(data))
        request = urllib.request.Request(self.origin + path, headers=headers, data=data, method=method)
        attempts = 3 if method.upper() == 'GET' else 1
        for attempt in range(attempts):
            try:
                with self.opener.open(request, timeout=timeout) as response:
                    body = response.read()
                    if response.headers.get('Content-Encoding', '').lower() == 'gzip':
                        body = gzip.decompress(body)
                    return json.loads(body) if body else {}
            except urllib.error.HTTPError as error:
                raw = error.read()
                try:
                    message = json.loads(raw).get('error', '')
                except (ValueError, AttributeError):
                    message = 'Non-JSON response'
                if method.upper() == 'GET' and 500 <= error.code < 600 and attempt + 1 < attempts:
                    time.sleep(.5 * (attempt + 1)); continue
                raise RuntimeError(f'HTTP {error.code} {method} {path}: {str(message)[:300]}') from None
            except (urllib.error.URLError, TimeoutError, socket.timeout, ConnectionError, OSError, EOFError) as error:
                if method.upper() == 'GET' and attempt + 1 < attempts:
                    time.sleep(.5 * (attempt + 1)); continue
                raise RuntimeError(f'{method} {path}: {type(error).__name__}; mutation calls are not replayed') from None
        raise RuntimeError(f'{method} {path}: safe read retry limit reached')

def request_metadata(pdf_path):
    match = re.fullmatch(r'(?P<case>.+)--(?P<variant>clean|layout|degraded)', pdf_path.stem)
    if not match:
        raise ValueError(f'Unexpected synthetic request filename: {pdf_path.name}')
    case_id = match.group('case')
    family = next((name for name in ('debt_balance','payroll','insurance','transactions') if case_id.startswith(name + '-')), None)
    if family is None:
        raise ValueError(f'Unrecognized synthetic family in request filename: {pdf_path.name}')
    return case_id, family, match.group('variant')

def source_hash(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def render_single_page(pdf_path):
    doc = fitz.open(pdf_path)
    try:
        if len(doc) != 1:
            raise ValueError(f'{pdf_path.name} must contain exactly one page')
        page = doc[0]
        scale = min(2200 / max(page.rect.width, page.rect.height), 3)
        pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), colorspace=fitz.csRGB, alpha=False)
        image = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
        encoded = io.BytesIO()
        image.save(encoded, format='JPEG', quality=88)
        content = encoded.getvalue()
        if len(content) > MAX_PAGE_BYTES:
            image.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
            encoded = io.BytesIO(); image.save(encoded, format='JPEG', quality=80); content = encoded.getvalue()
        image.close()
        if len(content) > MAX_PAGE_BYTES:
            raise ValueError(f'Rendered page exceeds the Site 8 MB limit: {pdf_path.name}')
        return content
    finally:
        doc.close()

def flatten_read(read):
    fields = []
    if not isinstance(read, dict):
        return fields
    for record_index, record in enumerate(read.get('records') or []):
        if not isinstance(record, dict):
            continue
        for field_index, field in enumerate(record.get('fields') or []):
            if not isinstance(field, dict):
                continue
            fields.append({
                'field': field.get('key'), 'value': field.get('value'),
                'unit': field.get('unit'), 'quote': field.get('quote'),
                'confidence': field.get('confidence'), 'bbox': field.get('bbox'),
                'record_category': record.get('category'),
                'record_index': record_index, 'field_index': field_index,
            })
    return fields

def write_result(out_dir, case_id, family, variant, value):
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f'{case_id}--{variant}.json'
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    return path

def run_one(client, pdf_path, out_dir, max_steps, steps_used, app_date, budget=None, source_commit=None):
    budget = budget or StageBudget(max_steps, steps_used)
    case_id_from_source, family, variant = request_metadata(pdf_path)
    digest = source_hash(pdf_path)
    if pdf_path.stat().st_size > MAX_PDF_BYTES:
        raise ValueError(f'PDF exceeds the Site 100 MB limit: {pdf_path.name}')
    page_bytes = render_single_page(pdf_path)
    created = client.call('/api/cases', 'POST', {'name': '합성 OCR 평가', 'applicationDate': app_date, 'courtId': 'seoul'})
    case_id = created['case']['context']['id']
    registered = client.call(f'/api/cases/{case_id}/documents', 'POST', {
        'name': f'synthetic-{digest[:12]}.pdf', 'sha256': digest, 'pageCount': 1,
    })
    document_id = registered['documentId']
    roles = {int(item['page']): item['role'] for item in registered.get('pageRoles', [])}
    # Preserve immutable filed-form/administrative holdouts if a request ever
    # resolves to one of those known source hashes; never upload its page image.
    if roles.get(1) in ('filed_form', 'administrative'):
        value = result_shell(case_id_from_source, family, variant, digest, case_id, document_id,
                             'held_out_by_site', steps_used, client)
        return write_result(out_dir, case_id_from_source, family, variant, value), steps_used
    client.call(f'/api/cases/{case_id}/documents/{document_id}?kind=original', 'PUT',
                data=pdf_path.read_bytes(), mime='application/pdf', timeout=240)
    client.call(f'/api/cases/{case_id}/documents/{document_id}?kind=page&page=1', 'PUT',
                data=page_bytes, mime='image/jpeg', timeout=180)

    status = 'uploaded_cost_cap'
    prepared_plans = set()
    progress = {}
    while budget.used < budget.limit:
        # Charge the budget before sending: a timed-out mutation may still have
        # reached the Site and must not be treated as free on the next run.
        budget.consume()
        steps_used = budget.used
        progress = client.call(f'/api/cases/{case_id}/process', 'POST', {'action': 'next'}, timeout=240)
        if progress.get('rescue'):
            prepare_rescue(client, pdf_path, case_id, document_id, digest, hashlib.sha256(page_bytes).hexdigest(), progress['rescue'], prepared_plans)
        if progress.get('error'):
            status = 'processing_error'; break
        if int(progress.get('remaining', 0)) <= 0:
            status = 'pipeline_idle'; break
    snapshot = client.call(f'/api/cases/{case_id}')
    job = next((j for j in snapshot.get('jobs', []) if j.get('documentId') == document_id and j.get('page') == 1), {})
    read = None
    if job.get('status') in ('completed', 'review_required') and job.get('stage') == 'completed' and job.get('role') == 'evidence':
        inspection = client.call(f'/api/cases/{case_id}/process?jobId={quote(document_id + ":1", safe="")}')
        stored = inspection.get('stored') or {}
        read = stored.get('read')
        status = job['status'] if isinstance(read, dict) else 'completed_without_read'
    elif job:
        status = str(job.get('status') or status)
        if job.get('stage'):
            status += '_' + str(job['stage'])
    value = {
        'schema_version': 'synthetic-ocr-read-v1',
        'fields': flatten_read(read), 'read': read,
        'provenance': {
            'source_case_id': case_id_from_source, 'family': family, 'variant': variant,
            'source_sha256': digest, 'source_page': 1,
            'site_case_id': case_id, 'document_id': document_id,
            'model': MODEL, 'status': status, 'role': job.get('role'),
            'job_status': job.get('status'), 'job_stage': job.get('stage'),
            'steps_used': steps_used, 'max_steps': max_steps,
            'api_model': (snapshot.get('case') or {}).get('execution', {}).get('model'),
            'source_commit': source_commit,
            'historical_provenance': inspection.get('historicalProvenance') if read is not None else None,
        },
    }
    return write_result(out_dir, case_id_from_source, family, variant, value), steps_used

def prepare_rescue(client, pdf_path, case_id, document_id, source_digest, base_image_hash, request, prepared):
    plan = request.get('planId')
    if not plan or request.get('documentId') != document_id or request.get('page') != 1 or request.get('sourceHash') != source_digest or request.get('baseImageHash') != base_image_hash:
        raise RuntimeError('Rescue request does not bind this uploaded source page')
    if plan in prepared: return
    import math
    reason = request.get('reason')
    boxes = [b for b in request.get('boxes', []) if isinstance(b, list) and len(b) == 4 and all(isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x) and 0 <= x <= 1 for x in b) and b[0] < b[2] and b[1] < b[3]][:4]
    def expand(b): return [max(0,b[0]-.035),max(0,b[1]-.035),min(1,b[2]+.035),min(1,b[3]+.035)]
    if reason == 'incomplete_extraction': specs = [([0,i*.25,1,min(1,(i+1)*.25+.025)],0) for i in range(4)]
    elif reason == 'unreadable': specs = [(expand(boxes[0] if boxes else [.03,.12,.97,.9]),r) for r in (0,90,180,-90)]
    elif reason in ('omitted_rows','field_disagreement'):
        if reason == 'omitted_rows': boxes = [[0,.08,1,.96]]
        specs = [(expand(list(b)),0) for b in dict.fromkeys(tuple(b) for b in boxes or [[.03,.12,.97,.9]])]
    else: raise RuntimeError('Unknown rescue reason')
    with fitz.open(pdf_path) as doc:
        page = doc[0]
        scale = min(3600/max(page.rect.width,page.rect.height),math.sqrt(12_000_000/(page.rect.width*page.rect.height)),4)
        pix = page.get_pixmap(matrix=fitz.Matrix(scale,scale),colorspace=fitz.csRGB,alpha=False)
        image = Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
        try:
            for index,(box,rotation) in enumerate(specs):
                variant = image.crop((math.floor(box[0]*image.width),math.floor(box[1]*image.height),math.ceil(box[2]*image.width),math.ceil(box[3]*image.height)))
                if rotation: variant = variant.rotate(-rotation,expand=True,fillcolor='white')
                variant.thumbnail((3600,3600),Image.Resampling.LANCZOS)
                encoded = io.BytesIO(); variant.save(encoded,format='JPEG',quality=92); variant.close()
                content = encoded.getvalue()
                if len(content) > MAX_PAGE_BYTES: raise RuntimeError('Rescue variant exceeds upload limit')
                client.call(f'/api/cases/{case_id}/documents/{document_id}?kind=variant&page=1','PUT',data=content,mime='image/jpeg',extra_headers={
                    'X-Rescue-Plan-Id':plan,'X-Source-Hash':source_digest,'X-Base-Image-Hash':base_image_hash,
                    'X-Variant':f'rescue-{reason}-{index+1}','X-Source-BBox':json.dumps(box),
                    'X-Transform':json.dumps({'rotation':rotation,'contrast':1,'method':'pymupdf-pillow-crop-v1'})})
        finally: image.close()
    prepared.add(plan)

def result_shell(source_id, family, variant, digest, case_id, document_id, status, steps_used, client):
    return {'schema_version':'synthetic-ocr-read-v1','fields':[],'read':None,'provenance':{
        'source_case_id':source_id,'family':family,'variant':variant,'source_sha256':digest,
        'source_page':1,'site_case_id':case_id,'document_id':document_id,'model':MODEL,
        'status':status,'role':'filed_form_or_administrative','steps_used':steps_used}}

def main():
    parser = argparse.ArgumentParser(description='Run generated request-only PDFs through the private Site evidence pipeline.')
    parser.add_argument('--request-dir', required=True, type=Path, help='The generator request-only directory. Never point this at gold/.')
    parser.add_argument('--reads-dir', required=True, type=Path, help='Private destination for saved read-fields JSON.')
    parser.add_argument('--origin', required=True, help='Verified private Site HTTPS origin, e.g. https://name.chatgpt.site')
    parser.add_argument('--max-steps', required=True, type=int, help='Global maximum number of /process stage actions; each is at most one model stage.')
    parser.add_argument('--workers', type=int, choices=[1,2,3], default=1, help='Parallel isolated cases sharing one global stage budget.')
    parser.add_argument('--source-commit', required=True, help='Exact deployed source SHA for this evaluation.')
    parser.add_argument('--application-date', default='2026-10-27')
    args = parser.parse_args()
    request_dir = args.request_dir.resolve()
    out_dir = args.reads_dir.resolve()
    origin = args.origin.rstrip('/')
    parsed = urlparse(origin)
    if request_dir.name != 'request-only' or not request_dir.is_dir():
        raise SystemExit('--request-dir must name the generator request-only directory.')
    if request_dir == out_dir or request_dir in out_dir.parents or out_dir in request_dir.parents:
        raise SystemExit('--reads-dir must be separate from request-only input.')
    if 'gold' in out_dir.parts:
        raise SystemExit('--reads-dir cannot be inside a gold directory.')
    if out_dir.exists() and any(out_dir.iterdir()):
        raise SystemExit('--reads-dir must be new or empty; use a fresh run directory.')
    if parsed.scheme != 'https' or not parsed.hostname or not parsed.hostname.endswith('.chatgpt.site') or parsed.path not in ('', '/'):
        raise SystemExit('A verified private Sites HTTPS origin is required.')
    if not re.fullmatch(r'[a-f0-9]{40}', args.source_commit):
        raise SystemExit('Exact deployed source SHA is required.')
    if not 1 <= args.max_steps <= 200:
        raise SystemExit('--max-steps must be between 1 and 200.')
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', args.application_date):
        raise SystemExit('--application-date must be YYYY-MM-DD.')
    pdfs = sorted(p for p in request_dir.glob('*.pdf') if p.is_file() and not p.is_symlink())
    if not pdfs:
        raise SystemExit('No direct-child request PDFs found.')
    for path in pdfs:
        request_metadata(path)
        if path.stat().st_size > MAX_PDF_BYTES:
            raise SystemExit(f'PDF exceeds the Site 100 MB limit: {path.name}')
    token = getpass.getpass('Ready for private Site session credential (input hidden): ')
    if not token:
        raise SystemExit('Site session credential is required.')
    client = SiteClient(origin, token)
    workspace = client.call('/api/workspace')
    connection = workspace.get('connection', {})
    if connection.get('model') != MODEL or not connection.get('apiKeyConfigured') or not connection.get('storageReady'):
        raise SystemExit('The private Site must have its gpt-6-luna model, private API key and storage configured.')
    budget = StageBudget(args.max_steps)
    def execute_pdf(pdf_path):
        steps = budget.used
        started = time.monotonic()
        if steps >= args.max_steps:
            # Write explicit no-run records without creating extra Site cases.
            source_id, family, variant = request_metadata(pdf_path)
            digest = source_hash(pdf_path)
            write_result(out_dir, source_id, family, variant, {
                'schema_version':'synthetic-ocr-read-v1','fields':[],'read':None,
                'provenance':{'source_case_id':source_id,'family':family,'variant':variant,
                    'source_sha256':digest,'source_page':1,'model':MODEL,
                    'status':'not_run_global_cost_cap','steps_used':steps,'max_steps':args.max_steps}})
            return
        try:
            path, steps = run_one(client, pdf_path, out_dir, args.max_steps, steps, args.application_date, budget, args.source_commit)
            print(json.dumps({'event':'pdf_finished','source_id':request_metadata(pdf_path)[0],
                              'status':json.loads(path.read_text())['provenance']['status'],
                              'steps_used':budget.used,'max_steps':args.max_steps,'elapsed_ms':round((time.monotonic()-started)*1000)},ensure_ascii=False),flush=True)
        except Exception as error:
            steps = budget.used
            source_id, family, variant = request_metadata(pdf_path)
            digest = source_hash(pdf_path)
            write_result(out_dir, source_id, family, variant, {
                'schema_version':'synthetic-ocr-read-v1','fields':[],'read':None,
                'provenance':{'source_case_id':source_id,'family':family,'variant':variant,
                    'source_sha256':digest,'source_page':1,'model':MODEL,
                    'status':'driver_error','safe_error':str(error)[:300],
                    'steps_used':steps,'max_steps':args.max_steps}})
            print(json.dumps({'event':'pdf_error','source_id':source_id,'error':str(error)[:300],
                              'steps_used':steps},ensure_ascii=False),flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures=[pool.submit(execute_pdf,path) for path in pdfs]
        for future in concurrent.futures.as_completed(futures): future.result()
    print(json.dumps({'event':'run_finished','process_steps':budget.used,'max_steps':budget.limit,'pdfs':len(pdfs),'workers':args.workers}),flush=True)

if __name__ == '__main__':
    main()
