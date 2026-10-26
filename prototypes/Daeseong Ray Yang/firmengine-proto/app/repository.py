"""Persistent case ledger: immutable assertions/artifacts, revisions and durable jobs.

SQLite is the local relational implementation. Blob references never depend on
the web UI or local absolute paths, so Google Workspace/GCS adapters can replace
LocalStorage without changing case/object/feature identities.
"""
from __future__ import annotations

from contextlib import contextmanager
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import sqlite3
import uuid


def utcnow():
    return datetime.now(timezone.utc).isoformat()


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), default=str)


class RevisionConflict(ValueError):
    pass


class ClosingConnection(sqlite3.Connection):
    """The standard connection context commits/rolls back but does not close."""
    def __exit__(self, *args):
        try:
            return super().__exit__(*args)
        finally:
            self.close()


SCHEMA = '''
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS cases(
 id TEXT PRIMARY KEY, matter_id TEXT NOT NULL UNIQUE, tenant_id TEXT NOT NULL,
 name TEXT NOT NULL, court_id TEXT NOT NULL, income_type TEXT NOT NULL,
 application_date TEXT, stage TEXT NOT NULL, status TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>=1), created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL, projection_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS case_objects(
 case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
 id TEXT NOT NULL, type TEXT NOT NULL, label TEXT NOT NULL,
 metadata_json TEXT NOT NULL, created_at TEXT NOT NULL, deleted_at TEXT,
 PRIMARY KEY(case_id,id)
);
CREATE TABLE IF NOT EXISTS document_versions(
 case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
 id TEXT NOT NULL, logical_document_id TEXT NOT NULL, name TEXT NOT NULL,
 sha256 TEXT, storage_json TEXT, data_json TEXT NOT NULL,
 created_at TEXT NOT NULL, deleted_at TEXT,
 PRIMARY KEY(case_id,id)
);
CREATE INDEX IF NOT EXISTS document_by_case ON document_versions(case_id,logical_document_id);
CREATE TABLE IF NOT EXISTS document_mapping_history(
 id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
 document_id TEXT NOT NULL, case_revision INTEGER NOT NULL,
 document_type TEXT, data_json TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS assertions(
 case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
 id TEXT NOT NULL, record_id TEXT NOT NULL, object_id TEXT NOT NULL,
 feature_key TEXT NOT NULL, value_json TEXT, currency TEXT, unit TEXT,
 state TEXT NOT NULL, precision TEXT NOT NULL, valid_at TEXT,
 recorded_at TEXT NOT NULL, case_revision INTEGER NOT NULL,
 supersedes TEXT, accepted_for_filing INTEGER NOT NULL DEFAULT 0,
 evidence_json TEXT NOT NULL, data_json TEXT NOT NULL,
 PRIMARY KEY(case_id,id)
);
CREATE INDEX IF NOT EXISTS assertion_lookup ON assertions(case_id,object_id,feature_key,valid_at);
CREATE TABLE IF NOT EXISTS assertion_heads(
 case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
 record_id TEXT NOT NULL, assertion_id TEXT NOT NULL,
 PRIMARY KEY(case_id,record_id),
 FOREIGN KEY(case_id,assertion_id) REFERENCES assertions(case_id,id)
);
CREATE TABLE IF NOT EXISTS assessment_runs(
 id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
 case_revision INTEGER NOT NULL, rule_release_id TEXT, calculator_version TEXT,
 input_hash TEXT NOT NULL, result_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS findings(
 case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
 id TEXT NOT NULL, rule_id TEXT, object_id TEXT, case_revision INTEGER NOT NULL,
 outcome TEXT NOT NULL, data_json TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(case_id,id)
);
CREATE TABLE IF NOT EXISTS evidence_requirements(
 case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
 id TEXT NOT NULL, object_id TEXT, purpose TEXT, period_json TEXT,
 status TEXT NOT NULL, data_json TEXT NOT NULL, first_seen TEXT NOT NULL,
 updated_at TEXT NOT NULL, PRIMARY KEY(case_id,id)
);
CREATE TABLE IF NOT EXISTS issues(
 case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
 id TEXT NOT NULL, status TEXT NOT NULL, blocking INTEGER NOT NULL,
 first_seen TEXT NOT NULL, updated_at TEXT NOT NULL, data_json TEXT NOT NULL,
 PRIMARY KEY(case_id,id)
);
CREATE TABLE IF NOT EXISTS artifact_versions(
 case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
 id TEXT NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL,
 case_revision INTEGER NOT NULL, rule_release_id TEXT,
 template_version TEXT, sha256 TEXT, storage_json TEXT,
 status TEXT NOT NULL, created_at TEXT NOT NULL, data_json TEXT NOT NULL,
 PRIMARY KEY(case_id,id)
);
CREATE TABLE IF NOT EXISTS reviews(
 id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
 case_revision INTEGER NOT NULL, gate TEXT NOT NULL, actor TEXT NOT NULL,
 artifact_hashes_json TEXT NOT NULL, status TEXT NOT NULL,
 recorded_at TEXT NOT NULL, data_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS submission_snapshots(
 id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
 case_revision INTEGER NOT NULL, rule_release_id TEXT,
 artifact_hashes_json TEXT NOT NULL, snapshot_json TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS case_events(
 id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
 case_revision INTEGER NOT NULL, type TEXT NOT NULL, actor TEXT NOT NULL,
 recorded_at TEXT NOT NULL, payload_json TEXT NOT NULL,
 idempotency_key TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS event_by_case ON case_events(case_id,recorded_at);
CREATE TABLE IF NOT EXISTS outbox_actions(
 id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
 case_revision INTEGER NOT NULL, type TEXT NOT NULL, target_id TEXT,
 idempotency_key TEXT NOT NULL UNIQUE, status TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 3,
 next_action_at TEXT NOT NULL, lease_until TEXT, lease_owner TEXT,
 payload_json TEXT NOT NULL, result_json TEXT, last_error TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_due ON outbox_actions(status,next_action_at);
CREATE TABLE IF NOT EXISTS notifications(
 id TEXT PRIMARY KEY, case_id TEXT REFERENCES cases(id) ON DELETE CASCADE,
 category TEXT NOT NULL, severity TEXT NOT NULL, title TEXT NOT NULL,
 message TEXT NOT NULL, dedup_key TEXT NOT NULL UNIQUE,
 data_json TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS valuation_snapshots(
 id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
 object_id TEXT NOT NULL, provider TEXT NOT NULL, status TEXT NOT NULL,
 valuation_as_of TEXT, retrieved_at TEXT NOT NULL, source_url TEXT,
 data_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scenario_versions(
 id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
 base_revision INTEGER NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL,
 input_json TEXT NOT NULL, result_json TEXT NOT NULL, created_at TEXT NOT NULL
);
'''


class CaseRepository:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.execute('PRAGMA journal_mode=WAL')
            db.executescript(SCHEMA)

    def connect(self):
        db = sqlite3.connect(self.path, timeout=10, factory=ClosingConnection)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('PRAGMA busy_timeout=10000')
        return db

    @contextmanager
    def transaction(self):
        db = self.connect()
        try:
            db.execute('BEGIN IMMEDIATE')
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def create_case(self, name, income_type='business', court_id='seoul', application_date=None):
        income_type = 'wage' if income_type == 'salary' else income_type
        if income_type not in ('business', 'wage', 'mixed', 'unknown'):
            raise ValueError('지원하지 않는 소득 유형입니다.')
        if not str(name).strip():
            raise ValueError('사건 이름이 필요합니다.')
        cid, timestamp = uuid.uuid4().hex, utcnow()
        matter_id = 'FE-' + timestamp[:10].replace('-', '') + '-' + cid[:8].upper()
        snapshot = {'id': cid, 'matter_id': matter_id, 'tenant_id': 'local', 'name': str(name).strip(),
                    'income_type': income_type, 'court_id': court_id, 'application_date': application_date,
                    'status': 'uploaded', 'stage': 'opened', 'revision': 1, 'progress': 0,
                    'message': '사건이 저장되었습니다. 서류를 추가하세요.', 'created_at': timestamp,
                    'updated_at': timestamp, 'documents': [], 'objects': [], 'records': [],
                    'assertions': [], 'calculations': [], 'calculation_results': None,
                    'artifacts': [], 'issues': [], 'requirements': [], 'findings': [],
                    'reviews': {'caseworker': None, 'lawyer': None}, 'template_approved': False,
                    'metrics': {}, 'evidence_pages_used': [], 'risk_history': []}
        with self.transaction() as db:
            db.execute('INSERT INTO cases VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
                       (cid, matter_id, 'local', snapshot['name'], court_id, income_type, application_date,
                        'opened', 'uploaded', 1, timestamp, timestamp, encode(snapshot)))
            self._event(db, snapshot, 'case.opened', 'local', {'matter_id': matter_id})
        return snapshot

    def list_cases(self):
        with self.connect() as db:
            return [dict(row) for row in db.execute('SELECT id,matter_id,name,income_type,court_id,application_date,revision,status,stage,updated_at FROM cases ORDER BY updated_at DESC')]

    def get_case(self, case_id):
        with self.connect() as db:
            row = db.execute('SELECT projection_json FROM cases WHERE id=?', (case_id,)).fetchone()
            if row is None:
                raise KeyError(case_id)
            snapshot = json.loads(row['projection_json'])
            snapshot['objects'] = [json.loads(r['metadata_json']) for r in db.execute('SELECT metadata_json FROM case_objects WHERE case_id=? AND deleted_at IS NULL ORDER BY created_at,id', (case_id,))]
            snapshot['documents'] = [json.loads(r['data_json']) for r in db.execute('SELECT data_json FROM document_versions WHERE case_id=? AND deleted_at IS NULL ORDER BY created_at,id', (case_id,))]
            snapshot['assertions'] = [json.loads(r['data_json']) for r in db.execute('SELECT a.data_json FROM assertions a JOIN assertion_heads h ON a.case_id=h.case_id AND a.id=h.assertion_id WHERE a.case_id=? ORDER BY a.recorded_at,a.id', (case_id,))]
            snapshot['artifact_history'] = [json.loads(r['data_json']) | {'status': r['status']} for r in db.execute('SELECT data_json,status FROM artifact_versions WHERE case_id=? ORDER BY created_at DESC', (case_id,))]
            snapshot['artifacts'] = [a for a in snapshot['artifact_history'] if a['status'] == 'current']
            snapshot['events'] = [dict(r) | {'payload': json.loads(r['payload_json'])} for r in db.execute('SELECT id,case_revision,type,actor,recorded_at,payload_json FROM case_events WHERE case_id=? ORDER BY recorded_at DESC LIMIT 150', (case_id,))]
            snapshot['notifications'] = [dict(r) for r in db.execute('SELECT id,category,severity,title,message,read_at,created_at,updated_at FROM notifications WHERE case_id=? ORDER BY updated_at DESC LIMIT 100', (case_id,))]
            snapshot['valuations'] = [json.loads(r['data_json']) for r in db.execute('SELECT data_json FROM valuation_snapshots WHERE case_id=? ORDER BY retrieved_at DESC', (case_id,))]
            snapshot['scenarios'] = [json.loads(r['result_json']) | {'id': r['id'], 'base_revision': r['base_revision']} for r in db.execute('SELECT id,base_revision,result_json FROM scenario_versions WHERE case_id=? ORDER BY created_at DESC', (case_id,))]
            snapshot['jobs'] = [dict(r) for r in db.execute('SELECT id,case_revision,type,target_id,status,attempts,max_attempts,next_action_at,last_error,updated_at FROM outbox_actions WHERE case_id=? ORDER BY created_at DESC LIMIT 100', (case_id,))]
            return snapshot

    @staticmethod
    def _event(db, snapshot, event_type, actor, payload, idempotency_key=None):
        db.execute('INSERT INTO case_events VALUES(?,?,?,?,?,?,?,?)',
                   (uuid.uuid4().hex, snapshot['id'], snapshot['revision'], event_type, actor,
                    utcnow(), encode(payload or {}), idempotency_key))

    @staticmethod
    def _projection(snapshot):
        return {k: v for k, v in snapshot.items() if not k.startswith('_')
                and k not in ('events', 'notifications', 'valuations', 'scenarios', 'jobs', 'artifact_history', 'assertion_history')}

    def save(self, snapshot, event_type, *, actor='system', expected_revision=None,
             semantic=True, payload=None, enqueue=False):
        timestamp = utcnow()
        with self.transaction() as db:
            old = db.execute('SELECT revision,projection_json FROM cases WHERE id=?', (snapshot['id'],)).fetchone()
            if old is None:
                raise KeyError(snapshot['id'])
            if expected_revision is not None and old['revision'] != expected_revision:
                raise RevisionConflict('사건이 이미 변경되었습니다. 최신 내용을 다시 불러오세요.')
            snapshot['revision'] = old['revision'] + (1 if semantic else 0)
            snapshot['updated_at'] = timestamp
            for obj in snapshot.get('objects', []):
                oid = obj.get('id') or obj.get('object_id')
                if not oid:
                    raise ValueError('object_id is required')
                obj['id'] = oid
                db.execute('INSERT INTO case_objects VALUES(?,?,?,?,?,?,?) ON CONFLICT(case_id,id) DO UPDATE SET type=excluded.type,label=excluded.label,metadata_json=excluded.metadata_json,deleted_at=excluded.deleted_at',
                           (snapshot['id'], oid, obj.get('type', 'other'), obj.get('label', oid), encode(obj),
                            obj.get('created_at', timestamp), obj.get('deleted_at')))
            for doc in snapshot.get('documents', []):
                previous = db.execute('SELECT data_json FROM document_versions WHERE case_id=? AND id=?', (snapshot['id'], doc['id'])).fetchone()
                data = encode(doc)
                if previous is not None:
                    old_doc = json.loads(previous['data_json'])
                    if any(old_doc.get(key) != doc.get(key) for key in ('sha256', 'storage')):
                        raise ValueError('문서 본문을 교체하려면 새 문서 버전 ID가 필요합니다.')
                if previous is not None and previous['data_json'] != data:
                    db.execute('INSERT INTO document_mapping_history VALUES(?,?,?,?,?,?,?)',
                               (uuid.uuid4().hex, snapshot['id'], doc['id'], snapshot['revision'], doc.get('document_type'), previous['data_json'], timestamp))
                db.execute('INSERT INTO document_versions VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(case_id,id) DO UPDATE SET name=excluded.name,data_json=excluded.data_json,deleted_at=excluded.deleted_at',
                           (snapshot['id'], doc['id'], doc.get('logical_document_id', doc['id']), doc['name'],
                            doc.get('sha256'), encode(doc.get('storage')) if doc.get('storage') else None, data,
                            doc.get('created_at', timestamp), doc.get('deleted_at')))
            snapshot['assertions'] = self._assertions(db, snapshot)
            if semantic:
                db.execute("UPDATE artifact_versions SET status='invalidated' WHERE case_id=? AND status='current'", (snapshot['id'],))
                db.execute("UPDATE reviews SET status='invalidated' WHERE case_id=? AND status='accepted'", (snapshot['id'],))
                snapshot['artifacts'] = []
                snapshot['reviews'] = {'caseworker': None, 'lawyer': None}
            elif event_type == 'artifacts.generated':
                incoming_ids = [item['id'] for item in snapshot.get('artifacts', []) if item.get('id')]
                if incoming_ids:
                    marks = ','.join('?' for _ in incoming_ids)
                    db.execute(f"UPDATE artifact_versions SET status='superseded' WHERE case_id=? AND status='current' AND id NOT IN ({marks})", (snapshot['id'], *incoming_ids))
                else:
                    db.execute("UPDATE artifact_versions SET status='superseded' WHERE case_id=? AND status='current'", (snapshot['id'],))
            for artifact in snapshot.get('artifacts', []):
                artifact.setdefault('id', uuid.uuid4().hex)
                artifact.setdefault('case_revision', snapshot['revision'])
                artifact.setdefault('created_at', timestamp)
                if artifact.get('status', 'current') == 'current' and artifact['case_revision'] != snapshot['revision']:
                    raise ValueError('현재 사건 버전과 다른 출력물을 현재 문서로 저장할 수 없습니다.')
                existing = db.execute('SELECT data_json,status FROM artifact_versions WHERE case_id=? AND id=?',
                                      (snapshot['id'], artifact['id'])).fetchone()
                if existing is not None:
                    old_artifact = json.loads(existing['data_json'])
                    if any(old_artifact.get(key) != artifact.get(key) for key in ('name','sha256','storage','case_revision')):
                        raise ValueError('기존 출력물 버전의 본문·참조는 변경할 수 없습니다.')
                    if existing['status'] != artifact.get('status', 'current'):
                        raise ValueError('무효화·보관된 출력물 버전을 새 현재 문서로 재사용할 수 없습니다.')
                db.execute('INSERT OR IGNORE INTO artifact_versions VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
                           (snapshot['id'], artifact['id'], artifact.get('kind', 'other'), artifact['name'],
                            artifact['case_revision'], snapshot.get('rule_release_id'), artifact.get('template_version'),
                            artifact.get('sha256'), encode(artifact.get('storage')) if artifact.get('storage') else None,
                            artifact.get('status', 'current'), artifact['created_at'], encode(artifact)))
            for finding in snapshot.get('findings', []):
                fid = finding.get('id') or hashlib.sha256(encode(finding).encode()).hexdigest()[:24]
                db.execute('INSERT OR REPLACE INTO findings VALUES(?,?,?,?,?,?,?,?)',
                           (snapshot['id'], fid, finding.get('rule_id'), finding.get('object_id'), snapshot['revision'],
                            finding.get('outcome', 'UNKNOWN'), encode(finding), timestamp))
            for item in snapshot.get('requirements', []):
                rid = item.get('requirement_id') or hashlib.sha256(encode([
                    item.get('id'), item.get('object_id') or item.get('subject_id'), item.get('period'),
                    item.get('purpose_features', [])]).encode()).hexdigest()[:24]
                db.execute('INSERT INTO evidence_requirements VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(case_id,id) DO UPDATE SET status=excluded.status,data_json=excluded.data_json,updated_at=excluded.updated_at',
                           (snapshot['id'], rid, item.get('object_id') or item.get('subject_id'),
                            encode(item.get('purpose_features', [])), encode(item.get('period')),
                            item.get('status', 'UNKNOWN'), encode(item), timestamp, timestamp))
            for issue in snapshot.get('issues', []):
                iid = issue.get('id') or hashlib.sha256(encode([issue.get('code'), issue.get('record_id'), issue.get('object_id'), issue.get('message')]).encode()).hexdigest()[:24]
                db.execute('INSERT INTO issues VALUES(?,?,?,?,?,?,?) ON CONFLICT(case_id,id) DO UPDATE SET status=excluded.status,blocking=excluded.blocking,updated_at=excluded.updated_at,data_json=excluded.data_json',
                           (snapshot['id'], iid, issue.get('status', 'OPEN'),
                            int(bool(issue.get('blocks_generation') or issue.get('severity') == 'blocking')),
                            timestamp, timestamp, encode(issue)))
            if event_type == 'review.accepted':
                role = (payload or {}).get('role')
                data = (snapshot.get('reviews') or {}).get(role) or {}
                reviewer = str(data.get('name') or data.get('reviewer') or data.get('actor') or '').strip()
                if semantic or role not in ('caseworker', 'lawyer') or not reviewer or reviewer != str(actor).strip():
                    raise ValueError('검토 역할·확인자와 현재 버전의 비변경 저장이 필요합니다.')
                if data.get('revision') != snapshot['revision']:
                    raise ValueError('검토 버전이 현재 사건과 다릅니다.')
                current_hashes = {row['id']: row['sha256'] for row in db.execute(
                    "SELECT id,sha256 FROM artifact_versions WHERE case_id=? AND case_revision=? AND status='current'",
                    (snapshot['id'], snapshot['revision']))}
                if not current_hashes or data.get('artifact_hashes') != current_hashes:
                    raise ValueError('확인한 출력물 집합·해시가 현재 생성본과 다릅니다.')
                previous_snapshot = json.loads(old['projection_json'])
                if not (previous_snapshot.get('generation_gate') or {}).get('can_generate'):
                    raise ValueError('필수 조건을 통과한 현재 사건의 생성본만 검토할 수 있습니다.')
                if role == 'lawyer':
                    prior = db.execute("SELECT id FROM reviews WHERE case_id=? AND case_revision=? AND gate='caseworker' AND status='accepted' AND artifact_hashes_json=?",
                                       (snapshot['id'], snapshot['revision'], encode(current_hashes))).fetchone()
                    if not prior or not snapshot.get('template_approved'):
                        raise ValueError('현재 생성본의 담당자 확인과 양식 적합성 확인이 먼저 필요합니다.')
                else:
                    db.execute("UPDATE reviews SET status='invalidated' WHERE case_id=? AND gate='lawyer' AND status='accepted'", (snapshot['id'],))
                    snapshot['reviews']['lawyer'] = None
                db.execute("UPDATE reviews SET status='superseded' WHERE case_id=? AND gate=? AND status='accepted'", (snapshot['id'], role))
                db.execute('INSERT INTO reviews VALUES(?,?,?,?,?,?,?,?,?)',
                           (uuid.uuid4().hex, snapshot['id'], snapshot['revision'], role, reviewer,
                            encode(current_hashes), 'accepted', timestamp, encode(data)))
                snapshot['status'] = 'reviewed' if role == 'lawyer' else 'ready'
            if event_type == 'assessment.completed':
                assessed = {k: snapshot.get(k) for k in ('assessment', 'findings', 'requirements', 'generation_gate', 'risk_checklist', 'calculation_results')}
                db.execute('INSERT INTO assessment_runs VALUES(?,?,?,?,?,?,?,?)',
                           (uuid.uuid4().hex, snapshot['id'], snapshot['revision'], snapshot.get('rule_release_id'),
                            (snapshot.get('calculation_results') or {}).get('calculator_version'),
                            hashlib.sha256(encode(snapshot.get('assertions', [])).encode()).hexdigest(), encode(assessed), timestamp))
            db.execute('UPDATE cases SET name=?,court_id=?,income_type=?,application_date=?,stage=?,status=?,revision=?,updated_at=?,projection_json=? WHERE id=?',
                       (snapshot['name'], snapshot.get('court_id', 'seoul'), snapshot.get('income_type', 'unknown'),
                        snapshot.get('application_date'), snapshot.get('stage', 'opened'), snapshot.get('status', 'uploaded'),
                        snapshot['revision'], timestamp, encode(self._projection(snapshot)), snapshot['id']))
            self._event(db, snapshot, event_type, actor, payload or {})
            if enqueue:
                self._enqueue(db, snapshot['id'], snapshot['revision'], 'case.reassess', {}, None)
        return snapshot

    def _assertions(self, db, snapshot):
        results = []
        for source in snapshot.get('assertions', []):
            item = deepcopy(source)
            record_id = item.get('record_id') or item.get('source_record_id') or item.get('id') or uuid.uuid4().hex
            head = db.execute('SELECT a.data_json FROM assertions a JOIN assertion_heads h ON a.case_id=h.case_id AND a.id=h.assertion_id WHERE h.case_id=? AND h.record_id=?', (snapshot['id'], record_id)).fetchone()
            prior = json.loads(head['data_json']) if head else None
            def fingerprint(value):
                return encode({k: v for k, v in value.items() if k not in ('id', 'assertion_id', 'recorded_at', 'case_revision', 'supersedes', 'case_id', 'is_current')})
            item['record_id'] = record_id
            item['object_id'] = item.get('object_id') or 'person-primary'
            item['state'] = item.get('state', 'EXTRACTED')
            item.setdefault('precision', 'UNKNOWN')
            item.setdefault('accepted_for_filing', False)
            item.setdefault('evidence_refs', [])
            if item['accepted_for_filing'] and item['state'] != 'VERIFIED':
                raise ValueError('검증되지 않은 feature는 제출 채택 상태로 저장할 수 없습니다.')
            if prior is not None and fingerprint(prior) == fingerprint(item):
                results.append(prior)
                continue
            item.update(id=uuid.uuid4().hex, case_id=snapshot['id'], case_revision=snapshot['revision'],
                        recorded_at=utcnow(), supersedes=prior['id'] if prior else item.get('supersedes'))
            db.execute('INSERT INTO assertions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                       (snapshot['id'], item['id'], record_id, item['object_id'], item['feature_key'],
                        encode(item.get('value')), item.get('currency'), item.get('unit'), item['state'],
                        item['precision'], item.get('valid_at'), item['recorded_at'], snapshot['revision'],
                        item.get('supersedes'), int(item['accepted_for_filing']), encode(item['evidence_refs']), encode(item)))
            db.execute('INSERT INTO assertion_heads VALUES(?,?,?) ON CONFLICT(case_id,record_id) DO UPDATE SET assertion_id=excluded.assertion_id', (snapshot['id'], record_id, item['id']))
            results.append(item)
        return results

    def assertion_history(self, case_id, record_id=None):
        with self.connect() as db:
            query, args = 'SELECT data_json FROM assertions WHERE case_id=?', [case_id]
            if record_id:
                query += ' AND record_id=?'
                args.append(record_id)
            return [json.loads(r['data_json']) for r in db.execute(query + ' ORDER BY recorded_at,id', args)]

    def _enqueue(self, db, case_id, revision, kind, payload, target_id):
        timestamp = utcnow()
        key = hashlib.sha256(encode([case_id, revision, kind, target_id, payload]).encode()).hexdigest()
        job_id = uuid.uuid4().hex
        db.execute('INSERT OR IGNORE INTO outbox_actions(id,case_id,case_revision,type,target_id,idempotency_key,status,next_action_at,payload_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
                   (job_id, case_id, revision, kind, target_id, key, 'QUEUED', timestamp, encode(payload), timestamp, timestamp))
        row = db.execute('SELECT id FROM outbox_actions WHERE idempotency_key=?', (key,)).fetchone()
        return row['id']

    def enqueue(self, case_id, kind, payload=None, target_id=None):
        with self.transaction() as db:
            row = db.execute('SELECT revision FROM cases WHERE id=?', (case_id,)).fetchone()
            if not row:
                raise KeyError(case_id)
            return self._enqueue(db, case_id, row['revision'], kind, payload or {}, target_id)

    def claim_job(self, worker_id, lease_seconds=900):
        timestamp = utcnow()
        lease = (datetime.now(timezone.utc) + timedelta(seconds=lease_seconds)).isoformat()
        with self.transaction() as db:
            db.execute("UPDATE outbox_actions SET status=CASE WHEN attempts>=max_attempts THEN 'FAILED' ELSE 'RETRYING' END,lease_owner=NULL,lease_until=NULL,updated_at=? WHERE status='RUNNING' AND lease_until<?", (timestamp, timestamp))
            db.execute("UPDATE outbox_actions SET status='SUPERSEDED',updated_at=? WHERE status IN ('QUEUED','RETRYING') AND type='case.reassess' AND case_revision < (SELECT revision FROM cases WHERE cases.id=outbox_actions.case_id)", (timestamp,))
            row = db.execute("SELECT * FROM outbox_actions WHERE status IN ('QUEUED','RETRYING') AND next_action_at<=? AND attempts<max_attempts ORDER BY created_at LIMIT 1", (timestamp,)).fetchone()
            if not row:
                return None
            db.execute("UPDATE outbox_actions SET status='RUNNING',attempts=attempts+1,lease_owner=?,lease_until=?,updated_at=? WHERE id=?", (worker_id, lease, timestamp, row['id']))
            return dict(row) | {'payload': json.loads(row['payload_json']), 'lease_owner': worker_id, 'attempts': row['attempts'] + 1}

    def finish_job(self, job_id, worker_id, *, status='SUCCEEDED', result=None, error=None):
        with self.transaction() as db:
            row = db.execute("SELECT * FROM outbox_actions WHERE id=? AND lease_owner=? AND status='RUNNING' AND lease_until>=?", (job_id, worker_id, utcnow())).fetchone()
            if row is None:
                return False
            if status == 'RETRYING' and row['attempts'] >= row['max_attempts']:
                status = 'FAILED'
            delay = min(60, 2 ** row['attempts']) if status == 'RETRYING' else 0
            next_at = (datetime.now(timezone.utc) + timedelta(seconds=delay)).isoformat()
            db.execute('UPDATE outbox_actions SET status=?,result_json=?,last_error=?,lease_owner=NULL,lease_until=NULL,next_action_at=?,updated_at=? WHERE id=?',
                       (status, encode(result) if result else None, str(error)[:300] if error else None, next_at, utcnow(), job_id))
            return True

    def notify(self, case_id, category, title, message, *, severity='info', dedup_key=None, data=None):
        timestamp = utcnow()
        key = dedup_key or hashlib.sha256(encode([case_id, category, title]).encode()).hexdigest()
        with self.transaction() as db:
            db.execute('INSERT INTO notifications VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(dedup_key) DO UPDATE SET severity=excluded.severity,message=excluded.message,data_json=excluded.data_json,updated_at=excluded.updated_at',
                       (uuid.uuid4().hex, case_id, category, severity, title, message, key, encode(data or {}), None, timestamp, timestamp))

    def save_valuation(self, case_id, object_id, value):
        value = deepcopy(value)
        value.setdefault('id', uuid.uuid4().hex)
        value.setdefault('retrieved_at', utcnow())
        with self.transaction() as db:
            db.execute('INSERT INTO valuation_snapshots VALUES(?,?,?,?,?,?,?,?,?)',
                       (value['id'], case_id, object_id, value.get('provider', 'manual_evidence'),
                        value.get('status', 'needs_review'), value.get('as_of'), value['retrieved_at'],
                        value.get('source_url'), encode(value)))
        return value

    def save_scenario(self, case_id, kind, inputs, result):
        snapshot = self.get_case(case_id)
        sid = uuid.uuid4().hex
        with self.transaction() as db:
            db.execute('INSERT INTO scenario_versions VALUES(?,?,?,?,?,?,?,?)',
                       (sid, case_id, snapshot['revision'], kind, 'PROPOSED', encode(inputs), encode(result), utcnow()))
        return result | {'id': sid, 'base_revision': snapshot['revision']}

    def archive_artifact(self, case_id, name, expected_revision=None):
        with self.transaction() as db:
            case = db.execute('SELECT revision,projection_json FROM cases WHERE id=?', (case_id,)).fetchone()
            if not case:
                raise KeyError(case_id)
            if expected_revision is not None and case['revision'] != expected_revision:
                raise RevisionConflict('사건이 이미 변경되었습니다. 최신 내용을 다시 불러오세요.')
            changed = db.execute("UPDATE artifact_versions SET status='archived' WHERE case_id=? AND name=? AND status='current'", (case_id, name)).rowcount
            if not changed:
                raise KeyError(name)
            db.execute("UPDATE reviews SET status='invalidated' WHERE case_id=? AND status='accepted'", (case_id,))
            snapshot = json.loads(case['projection_json'])
            snapshot['artifacts'] = [row for row in snapshot.get('artifacts', []) if row['name'] != name]
            snapshot['reviews'] = {'caseworker': None, 'lawyer': None}
            snapshot['template_approved'] = False
            snapshot['status'] = 'ready' if snapshot['artifacts'] else 'needs_action'
            snapshot['updated_at'] = utcnow()
            db.execute('UPDATE cases SET status=?,updated_at=?,projection_json=? WHERE id=?',
                       (snapshot['status'], snapshot['updated_at'], encode(self._projection(snapshot)), case_id))
            self._event(db, snapshot, 'artifact.archived', 'local', {'name': name})
        return snapshot

    def delete_case(self, case_id):
        with self.transaction() as db:
            if not db.execute('DELETE FROM cases WHERE id=?', (case_id,)).rowcount:
                raise KeyError(case_id)
