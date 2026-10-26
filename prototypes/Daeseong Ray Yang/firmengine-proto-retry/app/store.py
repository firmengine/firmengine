"""Private local SQLite ledger; mutation, history and work outbox commit together."""
from __future__ import annotations

import copy
import hashlib
import json
import os
import shutil
import sqlite3
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCAL = Path(os.environ.get('FIRMENGINE_DATA_DIR', ROOT / '.local')).resolve()
OBJECTS = LOCAL / 'objects'
DB_PATH = LOCAL / 'ledger.sqlite3'
LOCK = threading.RLock()


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def uid():
    return str(uuid.uuid4())


class Conflict(Exception):
    pass


@contextmanager
def db():
    LOCAL.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=30)
    con.row_factory = sqlite3.Row
    con.execute('PRAGMA foreign_keys=ON')
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def initialize():
    OBJECTS.mkdir(parents=True, exist_ok=True)
    with db() as con:
        con.execute('PRAGMA journal_mode=WAL')
        con.executescript('''
        CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, case_id TEXT NOT NULL, revision INTEGER NOT NULL, kind TEXT NOT NULL, actor TEXT NOT NULL, reason TEXT NOT NULL, before_json TEXT, after_json TEXT, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, case_id TEXT NOT NULL, revision INTEGER NOT NULL, kind TEXT NOT NULL, target_id TEXT, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, dedup_key TEXT UNIQUE, payload TEXT NOT NULL, result TEXT, next_run_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS artifacts(id TEXT PRIMARY KEY, case_id TEXT NOT NULL, case_revision INTEGER NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY, case_id TEXT NOT NULL, artifact_id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS calls(id TEXT PRIMARY KEY, case_id TEXT NOT NULL, job_id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, payload TEXT NOT NULL);
        ''')
        # A process interruption must not silently lose claimed tasks.
        con.execute("UPDATE jobs SET status='queued',updated_at=? WHERE status='running'", (now(),))


def _load(con, case_id):
    row = con.execute('SELECT payload FROM cases WHERE id=?', (case_id,)).fetchone()
    if not row:
        raise KeyError(case_id)
    return json.loads(row['payload'])


def get_case(case_id):
    with db() as con:
        return _load(con, case_id)


def list_cases():
    with db() as con:
        rows = con.execute('SELECT payload FROM cases ORDER BY updated_at DESC').fetchall()
    return [json.loads(r['payload']) for r in rows]


def _event(con, case, kind, reason, before=None, actor='local-user'):
    con.execute('INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?)', (
        uid(), case['id'], case['revision'], kind, actor, reason,
        json.dumps(before, ensure_ascii=False) if before else None,
        json.dumps(case, ensure_ascii=False), now(),
    ))


def _enqueue(con, case, kind='reassess', target_id=None, payload=None):
    stamp = now()
    key = f"{case['id']}:{case['revision']}:{kind}:{target_id or ''}"
    identifier = uid()
    con.execute('INSERT OR IGNORE INTO jobs(id,case_id,revision,kind,target_id,status,dedup_key,payload,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
                (identifier, case['id'], case['revision'], kind, target_id, 'queued', key, json.dumps(payload or {}), stamp, stamp))
    row = con.execute('SELECT id FROM jobs WHERE dedup_key=?', (key,)).fetchone()
    return row['id']


def create_case(values):
    stamp = now()
    case = dict(id=uid(), revision=1, case_number=f"FE-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:5].upper()}",
                title='새 개인회생 사건', applicant_name='', address='', birth_date='', court='서울회생법원',
                filing_date=datetime.now().date().isoformat(), income_type='business', tax_type='unknown',
                period_start='', period_end='', repayment_months=None, living_cost=None, deductions=0,
                statement='', debt_cause='', assets_declared=False, rule_approved=False, template_approved=False,
                is_demo=False, archived=False, incomes=[], creditors=[], assets=[], transactions=[], facts=[],
                documents=[], status='입력 중', created_at=stamp, updated_at=stamp)
    case.update(copy.deepcopy(values))
    case['id'], case['revision'] = uid(), 1
    with LOCK, db() as con:
        con.execute('INSERT INTO cases VALUES(?,?,?,?)', (case['id'], 1, json.dumps(case, ensure_ascii=False), stamp))
        _event(con, case, 'case.created', '사건 생성')
        _enqueue(con, case)
    return case


def mutate(case_id, expected_revision, transform, kind, reason, actor='local-user', preserve_job_id=None):
    with LOCK, db() as con:
        con.execute('BEGIN IMMEDIATE')
        case = _load(con, case_id)
        if expected_revision is not None and int(expected_revision) != case['revision']:
            raise Conflict(f"다른 변경이 저장되었습니다. 현재 버전 {case['revision']}을 다시 불러오세요.")
        before = copy.deepcopy(case)
        transform(case)
        case['revision'] += 1
        case['updated_at'] = now()
        case['status'] = '재평가 필요'
        case.pop('_assessment', None)
        con.execute('UPDATE cases SET revision=?,payload=?,updated_at=? WHERE id=?',
                    (case['revision'], json.dumps(case, ensure_ascii=False), case['updated_at'], case_id))
        _event(con, case, kind, reason, before, actor)
        con.execute("UPDATE jobs SET status='superseded',updated_at=? WHERE case_id=? AND revision<? AND id!=? AND status IN ('queued','running','retry')", (now(), case_id, case['revision'], preserve_job_id or ''))
        _enqueue(con, case)
    return case


def save_assessment(case_id, revision, assessment):
    with LOCK, db() as con:
        con.execute('BEGIN IMMEDIATE')
        case = _load(con, case_id)
        if case['revision'] != revision:
            return False
        case['_assessment'] = assessment
        if case.get('status') not in ('미검토 초안 생성','담당자 확인 중','검토 완료'):
            case['status'] = '계산 가능' if assessment['can_generate'] else '보완·확인 필요'
        con.execute('UPDATE cases SET payload=? WHERE id=?', (json.dumps(case, ensure_ascii=False), case_id))
    return True


def enqueue(case_id, revision, kind, target_id=None, payload=None):
    with LOCK, db() as con:
        case = _load(con, case_id)
        if case['revision'] != revision:
            raise Conflict('작업 대상 버전이 변경되었습니다.')
        return _enqueue(con, case, kind, target_id, payload)


def claim_job():
    with LOCK, db() as con:
        con.execute('BEGIN IMMEDIATE')
        row = con.execute("SELECT * FROM jobs WHERE status IN ('queued','retry') AND (next_run_at IS NULL OR next_run_at<=?) ORDER BY created_at LIMIT 1", (now(),)).fetchone()
        if not row:
            return None
        con.execute("UPDATE jobs SET status='running',attempts=attempts+1,updated_at=? WHERE id=?", (now(), row['id']))
        item = dict(row)
        item['payload'] = json.loads(item['payload'])
        item['attempts'] += 1
        return item


def finish_job(job_id, status, result=None, next_run_at=None):
    with db() as con:
        con.execute("UPDATE jobs SET status=?,result=?,next_run_at=?,updated_at=? WHERE id=? AND status!='superseded'", (status, json.dumps(result or {}, ensure_ascii=False), next_run_at, now(), job_id))


def rows(table, case_id=None):
    if table not in ('jobs', 'events', 'artifacts', 'reviews', 'calls'):
        raise ValueError('Unknown table')
    with db() as con:
        query = f'SELECT * FROM {table}' + (' WHERE case_id=?' if case_id else '') + ' ORDER BY created_at DESC'
        results = con.execute(query, (case_id,) if case_id else ()).fetchall()
    output = []
    for row in results:
        item = dict(row)
        for key in ('payload', 'result'):
            if item.get(key):
                value = json.loads(item.pop(key))
                if key == 'payload' and table in ('artifacts', 'reviews', 'calls'):
                    item.update(value)
                else:
                    item[key] = value
        if table == 'events':
            # Complete snapshots remain in SQLite; don't send private bulky copies to every screen.
            item.pop('before_json', None)
            item.pop('after_json', None)
        output.append(item)
    return output


def record_calls(case_id, job_id, calls):
    with LOCK, db() as con:
        con.execute('BEGIN IMMEDIATE')
        _load(con,case_id)
        for call in calls:
            con.execute('INSERT INTO calls VALUES(?,?,?,?,?)', (uid(), case_id, job_id, json.dumps(call, ensure_ascii=False), now()))


def artifact(artifact_id):
    with db() as con:
        row = con.execute('SELECT * FROM artifacts WHERE id=?', (artifact_id,)).fetchone()
    if not row:
        raise KeyError(artifact_id)
    result = dict(row)
    result.update(json.loads(result.pop('payload')))
    return result


def add_artifacts(case_id, revision, generated):
    with LOCK, db() as con:
        con.execute('BEGIN IMMEDIATE')
        case = _load(con, case_id)
        if case['revision'] != revision:
            raise Conflict('생성 중 사건이 변경되어 이전 결과를 채택하지 않았습니다.')
        count = con.execute('SELECT COUNT(*) FROM artifacts WHERE case_id=?', (case_id,)).fetchone()[0]
        for index, item in enumerate(generated):
            item = dict(item)
            path = Path(item.pop('path')).resolve()
            if not path.is_relative_to(OBJECTS):
                raise ValueError('Artifact outside object storage')
            identifier = uid()
            item.update(id=identifier, version=count + index + 1, case_revision=revision, status='미검토 초안',
                        object_key=str(path.relative_to(OBJECTS)), storage_provider='local', namespace='generated',
                        url=f'/api/artifacts/{identifier}/file', created_at=now(),
                        sha256=hashlib.sha256(path.read_bytes()).hexdigest())
            con.execute('INSERT INTO artifacts VALUES(?,?,?,?,?)', (identifier, case_id, revision, json.dumps(item, ensure_ascii=False), now()))
        case['status'] = '미검토 초안 생성'
        con.execute('UPDATE cases SET payload=? WHERE id=?', (json.dumps(case, ensure_ascii=False), case_id))
        _event(con, case, 'artifacts.generated', f'{len(generated)}개 파일 생성; 사건 버전 {revision}')


def add_review(case_id, artifact_id, role, reviewer, revision):
    with LOCK, db() as con:
        con.execute('BEGIN IMMEDIATE')
        case = _load(con, case_id)
        item = artifact(artifact_id)
        if item['case_id'] != case_id or item['case_revision'] != case['revision'] or revision != case['revision']:
            raise Conflict('현재 사건 버전으로 다시 생성한 파일만 검수할 수 있습니다.')
        artifact_path = OBJECTS / item['object_key']
        if hashlib.sha256(artifact_path.read_bytes()).hexdigest() != item['sha256']:
            raise Conflict('파일 해시가 달라 검수를 진행할 수 없습니다.')
        if role == 'lawyer':
            prior = con.execute('SELECT payload FROM reviews WHERE artifact_id=?', (artifact_id,)).fetchall()
            if not any(json.loads(r['payload'])['role'] == 'staff' for r in prior):
                raise Conflict('이 생성본의 담당자 확인을 먼저 완료하세요.')
        record = dict(id=uid(), artifact_id=artifact_id, role=role, reviewer=reviewer.strip(), sha256=item['sha256'],
                      case_revision=revision, rule_version=item.get('rule_version', 'retry-v1'),
                      template_version=item.get('template_version', 'retry-v1'), created_at=now())
        con.execute('INSERT INTO reviews VALUES(?,?,?,?,?)', (record['id'], case_id, artifact_id, json.dumps(record, ensure_ascii=False), now()))
        item['status'] = '검토 완료' if role == 'lawyer' else '담당자 확인 완료'
        # Original generated bytes never change during review. Review metadata is a separate immutable file.
        con.execute('UPDATE artifacts SET payload=? WHERE id=?', (json.dumps({k:v for k,v in item.items() if k not in ('case_id',)}, ensure_ascii=False), artifact_id))
        all_items = con.execute('SELECT payload FROM artifacts WHERE case_id=? AND case_revision=?', (case_id, revision)).fetchall()
        if all_items and all(json.loads(r['payload']).get('status') == '검토 완료' for r in all_items):
            case['status'] = '검토 완료'
        elif role == 'staff':
            case['status'] = '담당자 확인 중'
        con.execute('UPDATE cases SET payload=? WHERE id=?', (json.dumps(case, ensure_ascii=False), case_id))
        _event(con, case, 'artifact.reviewed', f"{reviewer}: {role}; {artifact_id}; {item['sha256']}", actor=reviewer)
    return record


def delete_case(case_id):
    with LOCK, db() as con:
        existing = _load(con, case_id)
        cache_case_ids = [case_id,*existing.get('_cache_case_ids',[])]
        keys = [r['object_key'] for r in existing['documents']]
        keys += [json.loads(r['payload'])['object_key'] for r in con.execute('SELECT payload FROM artifacts WHERE case_id=?', (case_id,))]
        for table in ('events','jobs','artifacts','reviews','calls','cases'):
            con.execute(f"DELETE FROM {table} WHERE {'id' if table == 'cases' else 'case_id'}=?", (case_id,))
    for key in keys:
        path = (OBJECTS / key).resolve()
        if path.is_relative_to(OBJECTS) and path.is_file():
            path.unlink(missing_ok=True)
    # Generated manifests/content models share a known artifact directory. Remove
    # those owned directories too, after checking their resolved storage boundary.
    generated_root = (OBJECTS/'generated').resolve()
    directories = {(OBJECTS/key).resolve().parent for key in keys if str(key).replace('\\','/').startswith('generated/')}
    for directory in directories:
        if directory != generated_root and directory.is_relative_to(generated_root) and directory.is_dir():
            shutil.rmtree(directory)
    # Both locations cover the early cache implementation and relocated stores.
    for linked_case_id in cache_case_ids:
        purge_case_cache(linked_case_id)


def purge_case_cache(case_id):
    """Called again after a delayed extraction finishes for an already-deleted case."""
    for linked_case_id in (case_id,):
        case_cache_key = hashlib.sha256(linked_case_id.encode()).hexdigest()[:24]
        for data_root in {LOCAL,ROOT/'.local'}:
            cache_root = (data_root/'extraction_cache').resolve()
            target = (cache_root/case_cache_key).resolve()
            if target != cache_root and target.is_relative_to(cache_root) and target.is_dir():
                shutil.rmtree(target)


def get_setting(key, default=None):
    with db() as con:
        row = con.execute('SELECT payload FROM settings WHERE key=?', (key,)).fetchone()
    return json.loads(row['payload']) if row else default


def set_setting(key, value):
    with db() as con:
        con.execute('INSERT OR REPLACE INTO settings VALUES(?,?)', (key, json.dumps(value, ensure_ascii=False)))
