"""Independent persistence/storage regressions; isolated synthetic local state only."""
from copy import deepcopy
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.case_engine import flat_to_assertions
from app.repository import CaseRepository, RevisionConflict
from app.storage import LocalStorage


class RepositoryTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.path=Path(self.temp.name)/'cases.sqlite'
        self.repo=CaseRepository(self.path)
        self.case=self.repo.create_case('Synthetic case', 'mixed', application_date='2026-10-26')

    def tearDown(self):
        self.temp.cleanup()

    def test_assertion_replacement_is_immutable_and_survives_reopen(self):
        raw={'id':'fact1','key':'client_name','value':'Synthetic A','state':'unreviewed'}
        self.case['assertions']=flat_to_assertions([raw], [])
        self.repo.save(self.case,'facts.extracted',expected_revision=1)
        old=deepcopy(self.case['assertions'][0])
        raw.update(value='Synthetic B',state='confirmed')
        self.case['assertions']=flat_to_assertions([raw], [])
        self.repo.save(self.case,'facts.reviewed',expected_revision=2)
        reopened=CaseRepository(self.path).get_case(self.case['id'])
        self.assertEqual(len(reopened['assertions']),1)
        current=reopened['assertions'][0]
        self.assertEqual(current['value'],'Synthetic B')
        self.assertEqual(current['supersedes'],old['id'])
        history=self.repo.assertion_history(self.case['id'],old['record_id'])
        self.assertEqual(len(history),2)
        self.assertEqual(next(row for row in history if row['id']==old['id']),old)

    def test_identical_nonsubstantive_save_does_not_create_duplicate_assertions(self):
        self.case['assertions']=flat_to_assertions([{'id':'fact1','key':'client_name','value':'Synthetic','state':'unreviewed'}],[])
        self.repo.save(self.case,'facts.extracted',expected_revision=1)
        original_id=self.case['assertions'][0]['id']
        self.repo.save(self.case,'progress.updated',semantic=False,expected_revision=2)
        self.assertEqual(len(self.repo.assertion_history(self.case['id'])),1)
        self.assertEqual(self.repo.get_case(self.case['id'])['assertions'][0]['id'],original_id)

    def test_cas_conflict_and_failed_assertion_leave_no_partial_objects_events_or_jobs(self):
        stale=deepcopy(self.case)
        self.case['name']='New name'
        self.repo.save(self.case,'case.edited',expected_revision=1,enqueue=True)
        before=self.repo.get_case(self.case['id'])
        with self.assertRaises(RevisionConflict):
            self.repo.save(stale,'case.edited',expected_revision=1,enqueue=True)
        broken=deepcopy(before)
        broken['objects']=[{'id':'temporary-object','type':'asset','label':'Synthetic'}]
        broken['assertions']=[{'record_id':'bad','feature_key':'assets[].gross_value','value':'10',
                               'state':'EXTRACTED','accepted_for_filing':True}]
        with self.assertRaises(ValueError):
            self.repo.save(broken,'invalid.review',expected_revision=2,enqueue=True)
        after=self.repo.get_case(self.case['id'])
        self.assertEqual(after['revision'],before['revision'])
        self.assertEqual(after['objects'],before['objects'])
        self.assertEqual(after['events'],before['events'])
        self.assertEqual(after['jobs'],before['jobs'])

    def test_outbox_idempotency_and_stale_revision_supersession(self):
        first=self.repo.enqueue(self.case['id'],'case.reassess',{'reason':'synthetic'})
        self.assertEqual(first,self.repo.enqueue(self.case['id'],'case.reassess',{'reason':'synthetic'}))
        self.repo.save(self.case,'case.edited',expected_revision=1,enqueue=True)
        job=self.repo.claim_job('worker')
        self.assertEqual(job['case_revision'],2)
        jobs={row['id']:row for row in self.repo.get_case(self.case['id'])['jobs']}
        self.assertEqual(jobs[first]['status'],'SUPERSEDED')
        self.assertEqual(len(jobs),2)

    def test_lease_reclaim_rejects_original_worker_completion(self):
        self.repo.enqueue(self.case['id'],'case.reassess')
        first=self.repo.claim_job('worker-a',lease_seconds=-1)
        second=self.repo.claim_job('worker-b')
        self.assertEqual(first['id'],second['id'])
        self.assertEqual(second['attempts'],2)
        self.assertFalse(self.repo.finish_job(first['id'],'worker-a',result={'stale':True}))
        self.assertTrue(self.repo.finish_job(second['id'],'worker-b',result={'done':True}))

    def test_expired_lease_cannot_finish_before_another_worker_reclaims(self):
        self.repo.enqueue(self.case['id'],'case.reassess')
        job=self.repo.claim_job('expired-worker',lease_seconds=-1)
        self.assertFalse(self.repo.finish_job(job['id'],'expired-worker',result={'late':True}))

    def test_retry_exhaustion_becomes_failed_without_sleeping(self):
        self.repo.enqueue(self.case['id'],'case.reassess')
        for attempt in range(1,4):
            job=self.repo.claim_job('worker-'+str(attempt),lease_seconds=-1)
            self.assertEqual(job['attempts'],attempt)
        self.assertIsNone(self.repo.claim_job('worker-4'))
        self.assertEqual(self.repo.get_case(self.case['id'])['jobs'][0]['status'],'FAILED')

    def test_artifact_replacement_semantic_invalidation_archive_and_history(self):
        self.case['artifacts']=[{'name':'first.docx','kind':'application','sha256':'a'*64,'revision':1}]
        self.repo.save(self.case,'artifacts.generated',semantic=False,expected_revision=1)
        first_id=self.case['artifacts'][0]['id']
        self.case['artifacts']=[{'name':'second.docx','kind':'application','sha256':'b'*64,'revision':1}]
        self.repo.save(self.case,'artifacts.generated',semantic=False,expected_revision=1)
        current=self.repo.get_case(self.case['id'])
        self.assertEqual([a['name'] for a in current['artifacts']],['second.docx'])
        self.assertEqual(next(a['status'] for a in current['artifact_history'] if a['id']==first_id),'superseded')
        self.repo.archive_artifact(self.case['id'],'second.docx')
        self.assertFalse(self.repo.get_case(self.case['id'])['artifacts'])
        self.case['artifacts']=[{'name':'third.docx','kind':'application','sha256':'c'*64,'revision':1}]
        self.repo.save(self.case,'artifacts.generated',semantic=False,expected_revision=1)
        self.repo.save(self.case,'fact.changed',semantic=True,expected_revision=1)
        current=self.repo.get_case(self.case['id'])
        self.assertFalse(current['artifacts'])
        self.assertEqual(len(current['artifact_history']),3)
        self.assertEqual(next(a['status'] for a in current['artifact_history'] if a['name']=='third.docx'),'invalidated')

    def test_replaying_same_generated_artifact_does_not_erase_current_projection(self):
        self.case['artifacts']=[{'name':'same.docx','kind':'application','sha256':'a'*64,'revision':1}]
        self.repo.save(self.case,'artifacts.generated',semantic=False,expected_revision=1)
        self.repo.save(self.case,'artifacts.generated',semantic=False,expected_revision=1)
        self.assertEqual(len(self.repo.get_case(self.case['id'])['artifacts']),1)

    def test_requirements_for_two_subjects_remain_distinct_in_normalized_storage(self):
        self.case['requirements']=[{'id':'salary_income','requirement_id':'req-'+oid,'subject_id':oid,
            'purpose_features':['income_source.net'],'period':{'start':'2026-01-01','end':'2026-09-30'},
            'status':'MISSING_EVIDENCE'} for oid in ('job-a','job-b')]
        self.repo.save(self.case,'assessment.completed',semantic=False,expected_revision=1)
        with self.repo.connect() as db:
            rows=db.execute('SELECT id,object_id FROM evidence_requirements WHERE case_id=?',(self.case['id'],)).fetchall()
        self.assertEqual({row['id'] for row in rows},{'req-job-a','req-job-b'})
        self.assertEqual({row['object_id'] for row in rows},{'job-a','job-b'})

    def test_case_delete_does_not_delete_other_case(self):
        other=self.repo.create_case('Other synthetic case')
        self.repo.enqueue(self.case['id'],'case.reassess')
        self.repo.delete_case(self.case['id'])
        with self.assertRaises(KeyError):
            self.repo.get_case(self.case['id'])
        self.assertEqual(self.repo.get_case(other['id'])['name'],'Other synthetic case')
        self.assertIsNone(self.repo.claim_job('worker'))

    def test_document_mapping_history_and_tombstone_survive_reopen(self):
        self.case['documents']=[{'id':'doc1','logical_document_id':'logical1','name':'proof.pdf','sha256':'a'*64,
                                'storage':{'provider':'synthetic','key':'version1'},'mapping_status':'UNMAPPED'}]
        self.repo.save(self.case,'document.added',expected_revision=1)
        self.case['documents'][0]['mapping_status']='VERIFIED'
        self.repo.save(self.case,'document.mapped',expected_revision=2)
        with self.repo.connect() as db:
            count=db.execute('SELECT COUNT(*) FROM document_mapping_history WHERE case_id=?',(self.case['id'],)).fetchone()[0]
        self.assertEqual(count,1)
        self.case['documents'][0]['deleted_at']='2026-10-26T00:00:00+00:00'
        self.repo.save(self.case,'document.deleted',expected_revision=3)
        self.assertFalse(CaseRepository(self.path).get_case(self.case['id'])['documents'])
        with self.repo.connect() as db:
            stored=db.execute('SELECT deleted_at FROM document_versions WHERE case_id=? AND id=?',(self.case['id'],'doc1')).fetchone()
        self.assertIsNotNone(stored['deleted_at'])

    def test_document_content_cannot_change_under_same_version_id(self):
        self.case['documents']=[{'id':'doc1','name':'proof.pdf','sha256':'a'*64,'storage':{'provider':'synthetic','key':'version1'}}]
        self.repo.save(self.case,'document.added',expected_revision=1)
        changed=deepcopy(self.case)
        changed['documents'][0].update(sha256='b'*64,storage={'provider':'synthetic','key':'version2'})
        with self.assertRaises(ValueError):
            self.repo.save(changed,'document.replaced',expected_revision=2)
        self.assertEqual(self.repo.get_case(self.case['id'])['documents'][0]['sha256'],'a'*64)

    def test_current_artifact_cannot_be_published_for_stale_case_revision(self):
        self.repo.save(self.case,'case.edited',expected_revision=1)
        self.case['artifacts']=[{'name':'stale.docx','kind':'application','sha256':'a'*64,'case_revision':1}]
        with self.assertRaises(ValueError):
            self.repo.save(self.case,'artifacts.generated',semantic=False,expected_revision=2)
        self.assertFalse(self.repo.get_case(self.case['id'])['artifacts'])

    def publish_for_review(self):
        self.case['generation_gate']={'can_generate':True}
        self.case['template_approved']=True
        self.case['artifacts']=[{'name':'review.docx','kind':'application','sha256':'a'*64,'revision':self.case['revision']}]
        self.repo.save(self.case,'artifacts.generated',semantic=False,expected_revision=self.case['revision'])

    def accept_review(self, role, snapshot=None):
        target=snapshot if snapshot is not None else self.case
        hashes={row['id']:row['sha256'] for row in target['artifacts']}
        target['reviews'][role]={'name':'Synthetic '+role,'at':'2026-10-26T00:00:00+00:00',
                                 'revision':target['revision'],'artifact_hashes':hashes}
        return self.repo.save(target,'review.accepted',semantic=False,expected_revision=target['revision'],
                              actor='Synthetic '+role,payload={'role':role})

    def test_review_insert_and_case_projection_share_compare_and_swap(self):
        self.publish_for_review()
        stale=deepcopy(self.case)
        self.repo.save(self.case,'fact.changed',expected_revision=1)
        with self.assertRaises(RevisionConflict):
            self.accept_review('caseworker',stale)
        with self.repo.connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM reviews').fetchone()[0],0)

    def test_lawyer_requires_database_caseworker_approval_for_exact_artifacts(self):
        self.publish_for_review()
        hashes={row['id']:row['sha256'] for row in self.case['artifacts']}
        self.case['reviews']['caseworker']={'name':'not stored','revision':1,'artifact_hashes':hashes}
        with self.assertRaises(ValueError):
            self.accept_review('lawyer')
        self.accept_review('caseworker')
        self.accept_review('lawyer')
        with self.repo.connect() as db:
            roles={row[0] for row in db.execute("SELECT gate FROM reviews WHERE status='accepted'")}
        self.assertEqual(roles,{'caseworker','lawyer'})

    def test_regenerated_same_revision_artifacts_reject_stale_review_hashes(self):
        self.publish_for_review()
        stale=deepcopy(self.case)
        self.case['artifacts']=[{'name':'new.docx','kind':'application','sha256':'b'*64,'revision':1}]
        self.repo.save(self.case,'artifacts.generated',semantic=False,expected_revision=1)
        with self.assertRaises(ValueError):
            self.accept_review('caseworker',stale)
        with self.repo.connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM reviews').fetchone()[0],0)

    def test_archive_checks_revision_and_atomically_invalidates_reviews(self):
        self.publish_for_review()
        self.accept_review('caseworker')
        self.accept_review('lawyer')
        with self.assertRaises(RevisionConflict):
            self.repo.archive_artifact(self.case['id'],'review.docx',expected_revision=0)
        self.assertTrue(self.repo.get_case(self.case['id'])['artifacts'])
        self.repo.archive_artifact(self.case['id'],'review.docx',expected_revision=1)
        reopened=self.repo.get_case(self.case['id'])
        self.assertEqual(reopened['reviews'],{'caseworker':None,'lawyer':None})
        self.assertFalse(reopened['artifacts'])
        with self.repo.connect() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM reviews WHERE status='accepted'").fetchone()[0],0)


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.store=LocalStorage(Path(self.temp.name)/'blobs')

    def tearDown(self):
        self.temp.cleanup()

    def test_versions_case_namespaces_and_filename_sanitization_are_distinct(self):
        first=self.store.put('casea','incoming','../../proof.pdf',b'synthetic a')
        repeated=self.store.put('casea','incoming','proof.pdf',b'synthetic a')
        other=self.store.put('caseb','outgoing','proof.pdf',b'synthetic b')
        self.assertNotEqual(first.key,repeated.key)
        self.assertEqual(first.filename,'proof.pdf')
        self.assertTrue(first.key.startswith('cases/casea/incoming/'))
        self.assertTrue(other.key.startswith('cases/caseb/outgoing/'))
        self.assertEqual(self.store.read(first),b'synthetic a')
        self.assertEqual(self.store.read(other),b'synthetic b')
        self.store.delete(first)
        self.assertEqual(self.store.read(repeated),b'synthetic a')
        with self.assertRaises(FileNotFoundError):
            self.store.read(first)

    def test_traversal_and_bad_namespace_are_rejected(self):
        ref=self.store.put('casea','incoming','proof.pdf',b'synthetic').to_dict()
        for key in ('../outside.pdf','/outside.pdf','C:/outside.pdf','cases\\casea\\outside.pdf'):
            with self.subTest(key=key),self.assertRaises(ValueError):
                self.store.read({**ref,'key':key})
        with self.assertRaises(ValueError):
            self.store.put('../casea','incoming','proof.pdf',b'synthetic')
        with self.assertRaises(ValueError):
            self.store.put('casea','arbitrary','proof.pdf',b'synthetic')

    def test_hash_verification_detects_changed_blob(self):
        ref=self.store.put('casea','incoming','proof.pdf',b'synthetic')
        self.store.local_path(ref).write_bytes(b'changed')
        with self.assertRaises(ValueError):
            self.store.read(ref)

    def test_reference_namespace_must_match_its_storage_key(self):
        ref=self.store.put('casea','incoming','proof.pdf',b'synthetic').to_dict()
        with self.assertRaises(ValueError):
            self.store.read({**ref,'namespace':'outgoing'})

    def test_wrong_hash_reference_cannot_delete_blob(self):
        ref=self.store.put('casea','incoming','proof.pdf',b'synthetic').to_dict()
        with self.assertRaises(ValueError):
            self.store.delete({**ref,'sha256':'0'*64})
        self.assertEqual(self.store.read(ref),b'synthetic')


if __name__ == '__main__':
    unittest.main()
