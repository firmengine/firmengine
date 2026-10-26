"""Persistent case service and bounded, revision-aware n8n dispatch queue."""
from __future__ import annotations

import asyncio
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import secrets
import time
import uuid

import fitz
import httpx

from . import ai, config, engine
from .case_engine import evaluate_case, flat_to_assertions
from .knowledge import KnowledgeStore
from .repository import CaseRepository, RevisionConflict, encode, utcnow
from .storage import LocalStorage


def load_rule(name):
    return json.loads((config.ROOT / 'rules' / name).read_text(encoding='utf-8'))


def public(value):
    """Only API representations are redacted; originals remain in private storage."""
    if isinstance(value, list):
        return [public(x) for x in value]
    if isinstance(value, dict):
        return {k: public(v) for k, v in value.items()
                if not k.startswith('_') and k not in ('storage', 'payload_json', 'lease_owner')}
    return value


def parse_pages(value, count):
    if not value or not value.strip():
        return None
    pages = set()
    for part in value.split(','):
        bits = part.strip().split('-')
        if len(bits) == 1:
            pages.add(int(bits[0]))
        elif len(bits) == 2:
            low, high = map(int, bits)
            if high < low or high - low > count:
                raise ValueError('페이지 범위를 확인하세요.')
            pages.update(range(low, high + 1))
        else:
            raise ValueError('페이지 범위를 확인하세요.')
    if not pages or min(pages) < 1 or max(pages) > count:
        raise ValueError('페이지 범위를 확인하세요.')
    return sorted(pages)


class CaseRuntime:
    def __init__(self, root=None):
        self.root = Path(root or config.RUNTIME).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.repo = CaseRepository(self.root / 'firmengine.sqlite3')
        self.storage = LocalStorage(self.root / 'storage')
        self.knowledge = KnowledgeStore(self.repo.path)
        self.knowledge.seed_defaults()
        self.active = {}
        self.tasks = []
        self.wakeup = asyncio.Event()

    def get(self, case_id):
        snapshot = self.repo.get_case(case_id)
        for doc in snapshot['documents']:
            if doc.get('storage'):
                doc['_path'] = str(self.storage.local_path(doc.get('_ocr_storage') or doc['storage']))
            if doc.get('_page_map'):
                doc['_page_map'] = {int(k): v for k, v in doc['_page_map'].items()}
            doc['_case_id'] = case_id
            doc['_journal_root'] = str(self.root / 'sessions' / case_id)
        return snapshot

    def change(self, snapshot, event, body=None, *, enqueue=True):
        expected = (body or {}).get('expected_revision', snapshot['revision'])
        snapshot.update(status='queued', stage='reassessment_pending', progress=0,
                        message='변경된 자료와 값을 기준으로 다시 확인합니다.')
        snapshot['calculation_results'] = None
        snapshot['generation_gate'] = {'can_generate': False, 'reason': '재평가 대기 중입니다.'}
        result = self.repo.save(snapshot, event, expected_revision=expected, enqueue=enqueue,
                                payload={'reason': (body or {}).get('reason', '')})
        for run in list(self.active.values()):
            if run['case_id'] == snapshot['id'] and run['revision'] < snapshot['revision']:
                run['superseded'] = True
                run['done'].set()
                task = run.get('stage_task')
                try:
                    current_task = asyncio.current_task()
                except RuntimeError:
                    current_task = None
                if task and task is not current_task:
                    task.get_loop().call_soon_threadsafe(task.cancel)
        self.wakeup.set()
        return result

    def add_document(self, snapshot, filename, content, selection=''):
        original_content = content
        suffix = Path(filename or '').suffix.lower()
        if suffix not in ('.pdf', '.png', '.jpg', '.jpeg'):
            raise ValueError('PDF·PNG·JPG 파일을 업로드하세요.')
        if len(content) > 100 * 1024 * 1024:
            raise ValueError('파일은 최대 100MB입니다.')
        with fitz.open(stream=content, filetype=suffix.lstrip('.')) as pdf:
            if pdf.needs_pass:
                raise ValueError('암호를 해제한 파일을 업로드하세요.')
            if suffix != '.pdf':
                content = pdf.convert_to_pdf()
            count = len(pdf)
        if count < 1 or count + sum(d['pages'] for d in snapshot['documents'] if d.get('processing_status') != 'bundle') > 180:
            raise ValueError('사건당 최대 180쪽을 처리합니다.')
        pages = parse_pages(selection, count)
        ref = self.storage.put(snapshot['id'], 'incoming', filename, original_content)
        ocr_ref = self.storage.put(snapshot['id'], 'incoming', Path(filename).stem + '.pdf', content) if suffix != '.pdf' else ref
        doc = {'id': uuid.uuid4().hex, 'name': Path(filename).name, 'pages': count,
               'sha256': ref.sha256, 'storage': ref.to_dict(), 'document_type': None,
               'mapping_status': 'UNMAPPED', 'processing_status': 'uploaded',
               'evidence_pages': pages or [], 'excluded_pages': [], 'page_roles': [],
               '_path': str(self.storage.local_path(ocr_ref)), '_selected': pages is not None,
               '_case_id': snapshot['id'], '_journal_root': str(self.root / 'sessions' / snapshot['id'])}
        if ocr_ref != ref:
            doc['_ocr_storage'] = ocr_ref.to_dict()
        if pages:
            doc['excluded_pages'] = sorted(set(range(1, count + 1)) - set(pages))
        (self.root / 'sessions' / snapshot['id']).mkdir(parents=True, exist_ok=True)
        snapshot['documents'].append(doc)
        return doc

    def sync_assertions(self, snapshot):
        adapted = flat_to_assertions(snapshot['records'], snapshot['documents'], snapshot.get('objects'))
        rows = {a.get('record_id') or a['id']: a for a in snapshot.get('assertions', [])}
        for item in adapted:
            item.setdefault('record_id', item.get('legacy_record_id') or item['id'])
            prior = rows.get(item['record_id'])
            # A human revision must not be overwritten by re-running OCR.
            if prior and prior.get('human_edited'):
                continue
            rows[item['record_id']] = item
        snapshot['assertions'] = list(rows.values())
        known = {obj['id'] for obj in snapshot['objects']}
        for row in snapshot['assertions']:
            oid = row.get('object_id')
            if oid and oid not in known and row.get('object_type') != 'case':
                snapshot['objects'].append({'id': oid, 'type': row.get('object_type', 'other'),
                                            'label': row.get('object_label') or oid, 'metadata': {}})
                known.add(oid)

    def queue(self, case_id, action='assess'):
        snapshot = self.get(case_id)
        job_id = self.repo.enqueue(case_id, 'case.reassess', {'action': action, 'request_id': uuid.uuid4().hex})
        snapshot.update(status='queued', stage='queued', message='처리 대기열에 등록했습니다.')
        self.repo.save(snapshot, 'job.queued', semantic=False, expected_revision=snapshot['revision'])
        self.wakeup.set()
        return self.get(case_id)

    async def start(self):
        # A local singleton owns this DB. Process restart invalidates old callback tokens.
        with self.repo.transaction() as db:
            db.execute("UPDATE outbox_actions SET status=CASE WHEN attempts>=max_attempts THEN 'FAILED' ELSE 'RETRYING' END,lease_owner=NULL,lease_until=NULL WHERE status='RUNNING'")
        concurrency = max(1, min(4, int(config.ENV.get('CASE_CONCURRENCY', '2'))))
        self.tasks = [asyncio.create_task(self.worker('local-' + str(i))) for i in range(concurrency)]

    async def stop(self):
        for task in self.tasks:
            task.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)
        self.knowledge.close_vector_client()

    async def worker(self, worker_id):
        while True:
            # n8n exposes its liveness port before its DB/workflows are ready.
            # Waiting here must not consume a case job's finite retry budget.
            try:
                async with httpx.AsyncClient(timeout=3) as client:
                    ready = await client.get(config.N8N_URL + '/healthz/readiness')
                if ready.status_code != 200:
                    await asyncio.sleep(2)
                    continue
            except httpx.HTTPError:
                await asyncio.sleep(2)
                continue
            job = await asyncio.to_thread(self.repo.claim_job, worker_id, 1800)
            if not job:
                self.wakeup.clear()
                try:
                    await asyncio.wait_for(self.wakeup.wait(), timeout=1)
                except TimeoutError:
                    pass
                continue
            case_id = job['case_id']
            if any(r['case_id'] == case_id for r in self.active.values()):
                self.repo.finish_job(job['id'], worker_id, status='RETRYING', error='사건의 이전 처리 완료 대기')
                continue
            run = {'id': job['id'], 'case_id': case_id, 'revision': job['case_revision'],
                   'token': secrets.token_hex(24), 'completed': set(), 'lock': asyncio.Lock(),
                   'done': asyncio.Event(), 'action': job['payload'].get('action', 'assess'),
                   'worker': worker_id, 'started': time.monotonic()}
            self.active[run['id']] = run
            try:
                if self.get(case_id)['revision'] != run['revision']:
                    raise RevisionConflict('더 최신 사건 변경이 있습니다.')
                async with httpx.AsyncClient(timeout=15) as client:
                    for handshake in range(12):
                        response = await client.post(config.N8N_URL + '/webhook/firmengine-p0', json={
                            'session_id': case_id, 'run_id': run['id'], 'run_token': run['token']})
                        if response.status_code not in (404, 503) or handshake == 11:
                            break
                        await asyncio.sleep(min(8, 1 + handshake))
                    response.raise_for_status()
                await asyncio.wait_for(run['done'].wait(), timeout=1750)
                if run.get('superseded'):
                    raise RevisionConflict('최신 변경으로 이전 작업을 중단합니다.')
                if run.get('error'):
                    raise RuntimeError(run['error'])
                self.repo.finish_job(job['id'], worker_id, result={'revision': run['revision']})
            except asyncio.CancelledError:
                self.repo.finish_job(job['id'], worker_id, status='RETRYING', error='서버 재시작으로 다시 실행합니다.')
                raise
            except RevisionConflict:
                self.repo.finish_job(job['id'], worker_id, status='SUPERSEDED')
            except Exception as exc:
                error_code = f'n8n_http_{exc.response.status_code}' if isinstance(exc, httpx.HTTPStatusError) else type(exc).__name__
                self.repo.finish_job(job['id'], worker_id, status='RETRYING', error=error_code)
                try:
                    snapshot = self.get(case_id)
                    if snapshot['revision'] == run['revision']:
                        snapshot.update(status='failed', message='워크플로 연결 또는 처리 실패. 대기열에서 제한 횟수만 재시도합니다.')
                        self.repo.save(snapshot, 'job.failed', semantic=False, expected_revision=run['revision'])
                    self.repo.notify(case_id, 'workflow', '처리 확인 필요', '실패한 처리만 대기열에서 재시도합니다. n8n 연결과 작업 상태를 확인하세요.', severity='warning', dedup_key='job:' + job['id'])
                except KeyError:
                    pass
            finally:
                self.active.pop(run['id'], None)

    async def stage(self, stage, body):
        run = self.active.get(body.get('run_id'))
        if not run or run['case_id'] != body.get('session_id') or not secrets.compare_digest(run['token'], body.get('run_token', '')):
            raise PermissionError('실행 토큰이 올바르지 않거나 만료되었습니다.')
        async with run['lock']:
            run['stage_task'] = asyncio.current_task()
            snapshot = self.get(run['case_id'])
            if snapshot['revision'] != run['revision']:
                run['error'] = '새 변경으로 이전 처리 결과를 채택하지 않습니다.'
                run['done'].set()
                raise RevisionConflict(run['error'])
            order = ['classify', 'extract', 'prepare', 'validate', 'generate', 'complete']
            if stage not in order:
                raise KeyError(stage)
            if not set(order[:order.index(stage)]) <= run['completed']:
                raise RevisionConflict('이전 처리 단계가 완료되지 않았습니다.')
            try:
                if stage not in run['completed']:
                    if stage != 'complete':
                        snapshot.update(status='running', stage=stage)
                        snapshot['progress'] = {'classify': 5, 'extract': 15, 'prepare': 78, 'validate': 82, 'generate': 90}[stage]
                        self.repo.save(snapshot, 'workflow.stage_started', semantic=False, expected_revision=run['revision'], payload={'stage': stage})
                    if stage == 'classify':
                        await self.classify(snapshot)
                    elif stage == 'extract':
                        await self.extract(snapshot)
                        self.sync_assertions(snapshot)
                    elif stage == 'prepare':
                        release = snapshot.get('rule_release') or load_rule('release.json')
                        release['parameters'] = {p['rule_id']: p for p in self.knowledge.active_parameters(snapshot.get('application_date'))}
                        snapshot['rule_release'] = release
                        snapshot['rule_release_id'] = release['id']
                    elif stage == 'validate':
                        calculation = body.get('calculation_results')
                        if not isinstance(calculation, dict) or calculation.get('computed_by') != 'n8n-code' or calculation.get('case_revision') != run['revision']:
                            raise ValueError('n8n Code 노드의 현재 사건 계산 결과가 필요합니다.')
                        snapshot['calculation_results'] = calculation
                        await self.assess(snapshot)
                    elif stage == 'generate':
                        if snapshot.get('generation_gate', {}).get('can_generate'):
                            await self.generate(snapshot)
                        else:
                            snapshot.update(status='needs_action', stage='needs_action', progress=100,
                                            message='반드시 확인할 항목이 남아 법원 서류 생성을 보류했습니다. 필요서류·보정위험을 확인하세요.')
                    elif stage == 'complete':
                        snapshot['metrics']['workflow_seconds'] = round(time.monotonic() - run['started'], 2)
                        if snapshot['status'] == 'running':
                            snapshot.update(status='ready', stage='review', progress=100)
                    event = 'assessment.completed' if stage == 'validate' else 'artifacts.generated' if stage == 'generate' and snapshot['artifacts'] else 'workflow.' + stage
                    self.repo.save(snapshot, event, semantic=False, expected_revision=run['revision'])
                    run['completed'].add(stage)
                snapshot = self.get(run['case_id'])
                response = {'session_id': run['case_id'], 'run_id': run['id'], 'run_token': run['token'],
                            'ok': True, 'stage': stage, 'can_generate': bool(snapshot.get('generation_gate', {}).get('can_generate'))}
                if stage == 'prepare':
                    response['snapshot'] = {key: snapshot.get(key) for key in ('id', 'revision', 'application_date', 'court_id', 'income_type', 'rule_release_id', 'rule_release', 'objects', 'assertions')}
                    # Code gets numeric/status features and opaque object IDs, not full OCR or names.
                    response['snapshot']['objects'] = [{k: o[k] for k in ('id', 'type') if k in o} for o in snapshot['objects']]
                    response['snapshot']['assertions'] = [{k: a.get(k) for k in ('id', 'object_id', 'feature_key', 'value', 'currency', 'unit', 'state', 'valid_at', 'period_start', 'period_end', 'source_period', 'measurement_period')}
                        for a in snapshot['assertions'] if a['feature_key'].startswith(('coverage.', 'debts[].principal', 'debts[].interest', 'debts[].security_status', 'debts[].amount_as_of', 'household.recognized_count', 'court.objection_status', 'claims.total_present_value', 'plan.', 'living.', 'income.', 'income_source.'))]
                    by_id = {a['id']: a for a in snapshot['assertions']}
                    for item in response['snapshot']['assertions']:
                        item.update({k: by_id[item['id']][k] for k in ('normalized', 'valuation_date', 'basis_id') if k in by_id[item['id']]})
                if stage == 'complete':
                    run['done'].set()
                return response
            except asyncio.CancelledError:
                if run.get('superseded'):
                    raise RevisionConflict('새 변경으로 이전 처리 결과를 채택하지 않습니다.') from None
                raise
            except Exception as exc:
                run['error'] = str(exc) if isinstance(exc, (ValueError, RuntimeError)) else type(exc).__name__
                run['done'].set()
                raise
            finally:
                run.pop('stage_task', None)

    async def classify(self, snapshot):
        snapshot.update(progress=5, message='의뢰인 증빙과 법원 제출본을 분류합니다.')
        jobs = []
        for doc in snapshot['documents']:
            if doc.get('processing_status') in ('classified', 'extracted', 'bundle'):
                continue
            items = [(doc, p) for p in (doc['evidence_pages'] if doc.get('_selected') else range(1, doc['pages'] + 1))]
            async def classify_doc(document, pages):
                roles = []
                for i in range(0, len(pages), 8):
                    document['processing_status'] = 'classifying'
                    result = await ai.classify(pages[i:i + 8], snapshot['metrics'])
                    valid = {p for _, p in pages[i:i + 8]}
                    roles.extend(p.model_dump() for p in result.pages if p.document_id == document['id'] and p.page in valid)
                    document['processing_progress'] = {'completed_pages': len(roles), 'total_pages': len(pages)}
                    self.repo.save(snapshot, 'document.classification_progress', semantic=False, expected_revision=snapshot['revision'], payload={'document_id': document['id']})
                if len({r['page'] for r in roles}) != len(pages):
                    raise RuntimeError('분류에서 누락된 페이지가 있습니다.')
                document['page_roles'] = roles
                if not document.get('_frozen_evidence_partition'):
                    document['evidence_pages'] = sorted({p['page'] for p in roles if p['role'] == 'evidence'})
                    document['excluded_pages'] = sorted(set(range(1, document.get('original_total_pages', document['pages']) + 1)) - set(document['evidence_pages']))
                document_types = {p.get('document_type') for p in roles if p.get('document_type') and p.get('document_type') != 'unknown'}
                if len(document_types) == 1 and not document.get('document_type'):
                    document['document_type'] = next(iter(document_types))
                    document['mapping_status'] = 'PROPOSED'
                document['processing_status'] = 'classified'
            jobs.append(classify_doc(doc, items))
        running = [asyncio.create_task(job) for job in jobs]
        try:
            await asyncio.gather(*running)
        except BaseException:
            for task in running:
                task.cancel()
            await asyncio.gather(*running, return_exceptions=True)
            raise
        from .documents import split_document_units
        snapshot.update(split_document_units(snapshot))
        snapshot['evidence_pages_used'] = [{'document_id': d['id'], 'page': p} for d in snapshot['documents'] for p in d['evidence_pages']]

    async def extract(self, snapshot):
        snapshot.update(progress=15, message='서류별 필요한 항목과 원문 근거를 병렬 추출합니다.')
        semaphore = asyncio.Semaphore(config.CONCURRENCY)
        tasks = []
        for doc in snapshot['documents']:
            if doc.get('processing_status') == 'extracted':
                continue
            pages = doc['evidence_pages']
            for start in range(0, len(pages), config.BATCH_SIZE):
                tasks.append((doc, pages[start:start + config.BATCH_SIZE]))
        prompt_hash = hashlib.sha256(b''.join(p.read_bytes() for p in sorted((config.ROOT / 'promptbook' / 'extract').glob('*')) if p.is_file())).hexdigest()
        done = 0
        async def batch(doc, pages):
            nonlocal done
            cache = self.root / 'sessions' / snapshot['id'] / 'batches'
            cache.mkdir(parents=True, exist_ok=True)
            page_types = [(r['page'], r.get('document_type')) for r in doc.get('page_roles', []) if r['page'] in pages]
            key = hashlib.sha256(encode([doc['sha256'], pages, doc.get('document_type'), page_types, prompt_hash]).encode()).hexdigest()
            path = cache / (key + '.json')
            if path.is_file():
                output = json.loads(path.read_text(encoding='utf-8'))
            else:
                async with semaphore:
                    doc['processing_status'] = 'extracting'
                    mapped_types = sorted({row.get('document_type', '') for row in doc.get('page_roles', []) if row.get('page') in pages})
                    query = ' '.join([doc.get('document_type') or '', *mapped_types])
                    context = await asyncio.to_thread(self.knowledge.search, query, as_of=snapshot.get('application_date'), case_id=snapshot['id'], limit=3) if query.strip() else []
                    result = await ai.extract([(doc, p) for p in pages], snapshot['metrics'], rag_context=context)
                    output = {'facts': list(result), 'pages': result.pages,
                              'missing_features': getattr(result, 'missing_features', []), 'warnings': getattr(result, 'warnings', [])}
                    path.write_text(encode(output), encoding='utf-8')
            done += 1
            doc.setdefault('processing_progress', {})['completed_extraction_batches'] = doc.get('processing_progress', {}).get('completed_extraction_batches', 0) + 1
            snapshot['progress'] = 15 + int(60 * done / max(1, len(tasks)))
            snapshot['message'] = f'문서별 추출 {done}/{len(tasks)} 묶음 완료'
            self.repo.save(snapshot, 'document.extraction_progress', semantic=False, expected_revision=snapshot['revision'], payload={'document_id': doc['id']})
            return output
        running = [asyncio.create_task(batch(d, p)) for d, p in tasks]
        try:
            results = await asyncio.gather(*running)
        except BaseException:
            for task in running:
                task.cancel()
            await asyncio.gather(*running, return_exceptions=True)
            raise
        legacy, canonical = [], []
        for output in results:
            for fact in output['facts']:
                (canonical if '.' in fact['key'] else legacy).append(fact)
            for page in output['pages']:
                doc = next(d for d in snapshot['documents'] if d['id'] == page['document_id'])
                doc.setdefault('_transcripts', {})[str(page['page'])] = page
        existing = [r for r in snapshot['records'] if r.get('human_edited') or all(s.get('document_id') not in {d['id'] for d, _ in tasks} for s in r.get('sources', []))]
        records = engine.merge_facts(legacy)
        for fact in canonical:
            rid = hashlib.sha256(encode([fact['key'], fact.get('entity'), fact.get('period'), fact.get('document_id'), fact.get('page'), fact.get('value')]).encode()).hexdigest()[:24]
            records.append({'id': rid, 'key': fact['key'], 'label': fact['key'], 'entity': fact.get('entity', ''),
                            'value': fact['value'], 'unit': fact.get('unit', ''), 'period': fact.get('period', ''),
                            'state': 'unreviewed', 'sources': [{'document_id': fact['document_id'], 'page': fact['page'], 'quote': fact['quote']}],
                            'alternatives': [], 'confidence': fact.get('confidence', 'low')})
        snapshot['records'] = existing + records
        processed_ids = {d['id'] for d, _ in tasks}
        for assertion in snapshot['assertions']:
            if not assertion.get('human_edited') and any(ref.get('document_id') in processed_ids for ref in assertion.get('evidence_refs', [])):
                assertion.update(state='RETRACTED', accepted_for_filing=False)
        for doc, _ in tasks:
            doc['processing_status'] = 'extracted'
        snapshot['metrics']['extracted_records'] = len(snapshot['records'])
        snapshot['metrics']['evidence_pages'] = len(snapshot['evidence_pages_used'])

    async def assess(self, snapshot):
        snapshot.update(progress=82, message='현재 규칙·추출값·필요서류와 보정 위험을 확인합니다.')
        # Legacy arithmetic is displayed as a diagnostic, never substituted for Code results.
        engine.validate(snapshot)
        previous = {row['risk_id']: row for row in snapshot.get('risk_checklist', [])}
        result = evaluate_case(snapshot)
        snapshot.update(result)
        if config.API_KEY and snapshot.get('assertions'):
            from .guidance import propose
            snapshot['agent_guidance'] = await propose(snapshot, self.knowledge)
            snapshot['actions'].extend(snapshot['agent_guidance'])
        for check in snapshot.get('risk_checklist', []):
            before = previous.get(check['risk_id'], {}).get('outcome')
            if before != check['outcome']:
                snapshot.setdefault('risk_history', []).append({'risk_id': check['risk_id'], 'title': check['title'],
                    'previous': before, 'outcome': check['outcome'], 'case_revision': snapshot['revision'],
                    'recorded_at': utcnow(), 'finding_ids': check.get('finding_ids', [])})
        from .rendering import court_package
        snapshot['court_package'] = court_package(snapshot)
        package_blockers = [r['id'] for r in snapshot['court_package'] if r.get('pre_generation_blocker')]
        if package_blockers:
            snapshot['generation_gate']['can_generate'] = False
            snapshot['generation_gate']['package_blockers'] = package_blockers
        for finding in snapshot['findings']:
            if finding.get('blocks_generation') or finding.get('outcome') == 'FAIL':
                self.repo.notify(snapshot['id'], 'assessment', finding.get('code', '확인 필요'), finding['message'],
                                 severity='warning', dedup_key='finding:' + snapshot['id'] + ':' + finding['id'], data={'finding_id': finding['id']})

    async def generate(self, snapshot):
        from .rendering import render_bundle, court_package
        if not snapshot.get('generation_gate', {}).get('can_generate'):
            raise ValueError('필수 확인이 해결되기 전에는 법원 서류를 생성할 수 없습니다.')
        out = self.root / 'sessions' / snapshot['id'] / 'renders' / uuid.uuid4().hex
        out.mkdir(parents=True, exist_ok=False)
        artifacts = await asyncio.to_thread(render_bundle, snapshot, out)
        for item in artifacts:
            ref = self.storage.put(snapshot['id'], 'outgoing', item['name'], (out / item['name']).read_bytes())
            item.update(id=ref.version, storage=ref.to_dict(), sha256=ref.sha256, size=ref.size,
                        case_revision=snapshot['revision'], status='current', created_at=utcnow(),
                        url=f"/api/cases/{snapshot['id']}/artifacts/{item['name']}")
        snapshot['artifacts'] = artifacts
        snapshot['reviews'] = {'caseworker': None, 'lawyer': None}
        snapshot['court_package'] = court_package(snapshot)
        snapshot.update(status='ready', stage='review', progress=100,
                        message='초안이 생성되었습니다. 위험 이력과 최종 생성본을 담당자·변호사가 확인하세요.')
