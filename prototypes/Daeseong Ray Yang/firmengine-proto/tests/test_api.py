"""Persistent API contracts with synthetic evidence and no workers/network."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import tempfile
import threading
import time
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

import fitz
from fastapi.testclient import TestClient
from app import api, config, main
from app.repository import RevisionConflict
from app.runtime import CaseRuntime


def fixture_pdf():
    document = fitz.open()
    document.new_page().insert_text((50, 50), 'Synthetic client evidence')
    document.new_page().insert_text((50, 50), 'Synthetic filed form target')
    data = document.tobytes()
    document.close()
    return data


class APITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.old_runtime, api._runtime = api._runtime, None
        self.patches = [patch.object(config, 'RUNTIME', Path(self.temp.name)),
            patch.object(CaseRuntime, 'start', new_callable=AsyncMock),
            patch('httpx.AsyncClient.request', new=AsyncMock(side_effect=AssertionError('Unexpected external request')))]
        for item in self.patches:
            item.start()
        self.client = TestClient(main.app)
        self.client.__enter__()
        response = self.client.post('/api/cases', json={'name': 'Synthetic case', 'income_type': 'business', 'application_date': '2026-10-26'})
        self.assertEqual(response.status_code, 200, response.text)
        self.cid, self.runtime = response.json()['id'], api.service()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        for item in reversed(self.patches):
            item.stop()
        api._runtime = self.old_runtime
        self.temp.cleanup()

    def snapshot(self):
        response = self.client.get(f'/api/cases/{self.cid}')
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def upload(self, cid=None, selected='1'):
        response = self.client.post(f'/api/cases/{cid or self.cid}/documents',
            files={'files': ('synthetic.pdf', fixture_pdf(), 'application/pdf')}, data={'evidence_pages': selected})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()['documents'][-1]

    def assertion(self, **values):
        return {'feature_key': 'person.name', 'value': 'Synthetic Person', 'reason': 'Synthetic evidence checked', **values}

    def seed_artifact(self, name='draft.docx', content=b'Synthetic generated document'):
        snapshot = self.runtime.get(self.cid)
        ref = self.runtime.storage.put(self.cid, 'outgoing', name, content)
        artifact = {'id': ref.version, 'name': name, 'kind': 'application', 'format': 'docx',
            'storage': ref.to_dict(), 'sha256': ref.sha256, 'size': ref.size,
            'case_revision': snapshot['revision'], 'status': 'current'}
        snapshot.update(artifacts=[artifact], generation_gate={'can_generate': True}, status='ready',
                        reviews={'caseworker': None, 'lawyer': None})
        self.runtime.repo.save(snapshot, 'artifacts.generated', semantic=False, expected_revision=snapshot['revision'])
        return artifact

    def active_run(self):
        run = {'id': 'synthetic-run', 'case_id': self.cid, 'revision': self.snapshot()['revision'],
            'token': 'synthetic-private-token', 'completed': set(), 'lock': asyncio.Lock(),
            'done': asyncio.Event(), 'action': 'assess', 'started': time.monotonic()}
        self.runtime.active[run['id']] = run
        return run

    def callback(self, run, stage='classify', **body):
        return self.client.post('/internal/stages/' + stage,
            json={'session_id': self.cid, 'run_id': run['id'], 'run_token': run['token'], **body})

    def review(self, role='caseworker', **body):
        return self.client.post(f'/api/cases/{self.cid}/review', json={'role': role, 'name': 'Synthetic Reviewer', **body})

    def test_crud_reopen_cas_and_persistent_heartbeat(self):
        initial = self.snapshot()
        changed = self.client.patch(f'/api/cases/{self.cid}', json={'name': 'Changed synthetic case', 'expected_revision': initial['revision']})
        self.assertEqual(changed.status_code, 200)
        self.assertEqual(changed.json()['revision'], initial['revision'] + 1)
        self.assertEqual(self.client.patch(f'/api/cases/{self.cid}', json={'name': 'Stale overwrite', 'expected_revision': initial['revision']}).status_code, 409)
        api._runtime = None
        reopened = self.snapshot()
        self.runtime = api.service()
        self.assertEqual(reopened['name'], 'Changed synthetic case')
        self.assertEqual(self.client.post(f'/api/sessions/{self.cid}/heartbeat').json(), {'ok': True, 'persistent': True})
        self.assertIn(self.cid, [r['id'] for r in self.client.get('/api/cases').json()['cases']])
        self.assertEqual(self.client.delete(f'/api/cases/{self.cid}').status_code, 200)
        self.assertEqual(self.client.get(f'/api/cases/{self.cid}').status_code, 404)

    def test_original_cabinet_preview_partition_and_private_state_boundary(self):
        doc = self.upload()
        self.active_run()
        response = self.client.get(f'/api/cases/{self.cid}')
        for private in ('synthetic-private-token', '_path', '_journal_root', '"storage"', str(Path(self.temp.name))):
            self.assertNotIn(private, response.text)
        self.assertEqual(self.client.get(f'/api/cases/{self.cid}/pages/{doc["id"]}/1').status_code, 200)
        self.assertEqual(self.client.get(f'/api/cases/{self.cid}/pages/{doc["id"]}/2').status_code, 404)
        original = self.client.get(f'/api/cases/{self.cid}/documents/{doc["id"]}/download')
        self.assertEqual(original.status_code, 200)
        with fitz.open(stream=original.content, filetype='pdf') as document:
            self.assertEqual(len(document), 2)

    def test_same_case_and_evidence_page_guards_and_no_automatic_hitl(self):
        doc = self.upload()
        other = self.client.post('/api/cases', json={'name': 'Other synthetic case'}).json()['id']
        foreign = self.upload(other)
        for reference in ({'document_id': foreign['id'], 'page': 1}, {'document_id': doc['id'], 'page': 2}):
            response = self.client.post(f'/api/cases/{self.cid}/assertions', json=self.assertion(evidence_refs=[reference]))
            self.assertEqual(response.status_code, 422)
        self.assertEqual(self.snapshot()['assertions'], [])
        added = self.client.post(f'/api/cases/{self.cid}/assertions', json=self.assertion(evidence_refs=[{'document_id': doc['id'], 'page': 1}]))
        row = added.json()['assertions'][0]
        self.assertEqual(row['state'], 'REPORTED')
        self.assertFalse(row['accepted_for_filing'])
        self.assertEqual(self.review().status_code, 409)
        invalid = self.client.patch(f'/api/cases/{self.cid}/assertions/{row["id"]}', json={'accepted_for_filing': True, 'reason': 'Unverified cannot be adopted'})
        self.assertEqual(invalid.status_code, 422)
        self.assertFalse(self.snapshot()['assertions'][0]['accepted_for_filing'])

    def test_assertion_revisions_are_immutable(self):
        added = self.client.post(f'/api/cases/{self.cid}/assertions', json=self.assertion()).json()
        first = added['assertions'][0]
        edited = self.client.patch(f'/api/cases/{self.cid}/assertions/{first["id"]}', json={'value': 'Synthetic Changed', 'reason': 'Correction', 'expected_revision': added['revision']})
        self.assertEqual(edited.status_code, 200, edited.text)
        second = edited.json()['assertions'][0]
        self.assertNotEqual(second['id'], first['id'])
        self.assertEqual(second['supersedes'], first['id'])
        history = self.client.get(f'/api/cases/{self.cid}/assertions/{second["id"]}/history').json()['history']
        self.assertEqual({row['value'] for row in history}, {'Synthetic Person', 'Synthetic Changed'})
        self.assertEqual(next(row for row in history if row['id'] == first['id'])['value'], 'Synthetic Person')

    def test_changed_value_requires_fresh_explicit_verification_and_adoption(self):
        added = self.client.post(f'/api/cases/{self.cid}/assertions', json=self.assertion(state='VERIFIED', accepted_for_filing=True)).json()
        previous = added['assertions'][0]
        edited = self.client.patch(f'/api/cases/{self.cid}/assertions/{previous["id"]}', json={'value': 'Changed after verification', 'reason': 'New fact'})
        self.assertEqual(edited.status_code, 200)
        current = edited.json()['assertions'][0]
        self.assertEqual(current['state'], 'REPORTED')
        self.assertFalse(current['accepted_for_filing'])

    def test_normalization_proof_is_explicit_typed_and_persistent(self):
        for values in ({'normalized': 'true'}, {'valuation_date': 'not-a-date'}, {'basis_id': 123}, {'accepted_for_filing': 'false'}):
            response = self.client.post(f'/api/cases/{self.cid}/assertions', json=self.assertion(**values))
            self.assertEqual(response.status_code, 422)
        response = self.client.post(f'/api/cases/{self.cid}/assertions', json=self.assertion(
            feature_key='assets[].gross_value', value='1230000', unit='won', currency='KRW',
            state='VERIFIED', accepted_for_filing=True, normalized=True, valuation_date='2026-10-01', basis_id='synthetic-manual-proof'))
        self.assertEqual(response.status_code, 200, response.text)
        row = self.snapshot()['assertions'][0]
        self.assertTrue(row['normalized'])
        self.assertEqual(row['valuation_date'], '2026-10-01')
        self.assertEqual(row['basis_id'], 'synthetic-manual-proof')
        edited = self.client.patch(f'/api/cases/{self.cid}/assertions/{row["id"]}', json={'value': '1230001', 'reason': 'Changed amount'})
        self.assertFalse(edited.json()['assertions'][0]['normalized'])

    def test_mapping_unclassified_document_does_not_skip_target_classification(self):
        doc = self.upload(selected='')
        mapped = self.client.patch(f'/api/cases/{self.cid}/documents/{doc["id"]}', json={'document_type': 'salary_certificate'})
        self.assertEqual(mapped.status_code, 200)
        self.assertEqual(mapped.json()['documents'][0]['processing_status'], 'uploaded')
        self.assertEqual(mapped.json()['documents'][0]['evidence_pages'], [])

    def test_form_editor_exposes_sources_and_refuses_derived_value_overrides(self):
        doc = self.upload()
        added = self.client.post(f'/api/cases/{self.cid}/assertions', json=self.assertion(evidence_refs=[{'document_id': doc['id'], 'page': 1}]))
        self.assertEqual(added.status_code, 200)
        form = self.client.get(f'/api/cases/{self.cid}/forms/application')
        self.assertEqual(form.status_code, 200, form.text)
        fields = form.json()['fields']
        name = next(row for row in fields if row['key']=='client_name')
        self.assertEqual(name['value'], 'Synthetic Person')
        self.assertEqual(name['sources'][0]['document_id'], doc['id'])
        derived = next(row for row in fields if row['derived'])
        denied = self.client.patch(f'/api/cases/{self.cid}/forms/application', json={'fields': [{'key': derived['key'], 'value': '999999'}]})
        self.assertEqual(denied.status_code, 422)
        changed = self.client.patch(f'/api/cases/{self.cid}/forms/application', json={'fields': [{'key': name['key'], 'object_id': name['object_id'], 'value': 'Edited through form', 'reason': 'Synthetic correction'}]})
        self.assertEqual(changed.status_code, 200, changed.text)
        self.assertEqual(changed.json()['assertions'][0]['value'], 'Edited through form')
        self.assertFalse(changed.json()['assertions'][0]['accepted_for_filing'])

    def test_valuation_uses_same_case_proof_and_never_adopts_its_candidate(self):
        doc = self.upload()
        other = self.client.post('/api/cases', json={'name': 'Other valuation case'}).json()['id']
        foreign = self.upload(other)
        created = self.client.post(f'/api/cases/{self.cid}/objects', json={'type': 'vehicle', 'label': 'Synthetic vehicle'})
        oid = created.json()['objects'][0]['id']
        endpoint = f'/api/cases/{self.cid}/assets/{oid}/valuation'
        body = {'provider': 'manual_evidence', 'parameters': {'price': '1230000', 'as_of': '2026-10-01', 'document_id': foreign['id']}}
        self.assertEqual(self.client.post(endpoint, json=body).status_code, 422)
        body['parameters']['document_id'] = doc['id']
        self.assertEqual(self.client.post(endpoint, json={**body, 'expected_revision': 1}).status_code, 409)
        response = self.client.post(endpoint, json=body)
        self.assertEqual(response.status_code, 200, response.text)
        value = response.json()['valuations'][0]
        self.assertEqual(value['value'], '1230000')
        self.assertFalse(value['human_verified'])
        self.assertFalse(value['legal_valuation_approved'])
        self.assertEqual(response.json()['assertions'], [])

    def test_case_rag_uses_case_date_and_minimal_context_contract(self):
        with patch.object(self.runtime.knowledge, 'search', return_value=[]) as search:
            response = self.client.get('/api/knowledge/search', params={'q': 'income evidence', 'case_id': self.cid})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(search.call_args.kwargs, {'as_of': '2026-10-26', 'case_id': self.cid, 'limit': 3})
        self.assertEqual(self.client.get('/api/knowledge/search', params={'q': 'income', 'case_id': 'unknown'}).status_code, 404)
        self.assertEqual(self.client.get('/api/knowledge/search', params={'q': 'income', 'as_of': 'not-a-date'}).status_code, 422)

    def test_knowledge_change_invalidates_outputs_but_unchanged_check_does_not(self):
        self.seed_review_sources()
        reviewed=self.client.post(f'/api/cases/{self.cid}/rule-release/review',json=self.release_review_body())
        self.assertEqual(reviewed.status_code,200)
        approved_release=reviewed.json()['rule_release']
        self.seed_artifact()
        self.assertEqual(self.review().status_code, 200)
        revision = self.snapshot()['revision']
        with patch.object(self.runtime.knowledge, 'check_updates', return_value={'sources': [{'source_id': 'synthetic', 'status': 'unchanged'}]}):
            self.assertEqual(self.client.post('/api/knowledge/check').status_code, 200)
        unchanged = self.snapshot()
        self.assertEqual(unchanged['revision'], revision)
        self.assertEqual(len(unchanged['artifacts']), 1)
        self.assertIsNotNone(unchanged['reviews']['caseworker'])
        self.assertEqual(unchanged['rule_release'],approved_release)
        with patch.object(self.runtime.knowledge, 'check_updates', return_value={'sources': [{'source_id': 'synthetic', 'status': 'version_added'}]}):
            self.assertEqual(self.client.post('/api/knowledge/check').status_code, 200)
        changed = self.snapshot()
        self.assertEqual(changed['revision'], revision+1)
        self.assertEqual(changed['artifacts'], [])
        self.assertIsNone(changed['reviews']['caseworker'])
        self.assertEqual(changed['jobs'][0]['case_revision'], revision+1)
        self.assertEqual(changed['rule_release']['status'],'REVIEW_REQUIRED')
        self.assertEqual(changed['rule_release_history'][0],approved_release)

    def test_ui_catalog_has_classifier_types_and_rule_release(self):
        response = self.client.get('/api/catalog')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['rule_release']['id'])
        self.assertEqual({r['id']: r['label'] for r in data['document_types']}, api.ai.extraction_catalog()[1])

    def seed_review_sources(self):
        with self.runtime.knowledge._db() as db:
            rows=[dict(row) for row in db.execute("SELECT * FROM knowledge_sources WHERE source_id IN ('K01','K04','K20','K21')")]
        for row in rows:
            self.runtime.knowledge.ingest_source(source_id=row['source_id'],title=row['title'],url=row['url'],
                content='Synthetic official source fixture '+row['source_id'],authority=row['authority'],
                valid_from='2026-01-01',valid_to='2027-01-01',kind='official_snapshot',metadata={'synthetic_fixture':True})

    def release_review_body(self):
        candidate=self.client.get(f'/api/cases/{self.cid}/rule-release/review').json()
        return {'reviewer':'Synthetic Lawyer','review_note':'Synthetic explicit source and numeric rule review',
            'expected_revision':candidate['revision'],'reviewed_rule_ids':candidate['required_rule_ids'],
            'source_versions':candidate['source_versions']}

    def test_legal_release_stays_blocked_without_applicable_official_originals(self):
        from app.case_engine import evaluate_case
        snapshot=self.runtime.get(self.cid)
        self.assertIn('RULE_RELEASE_REVIEW',[row['code'] for row in evaluate_case(snapshot)['findings']])
        candidate=self.client.get(f'/api/cases/{self.cid}/rule-release/review').json()
        self.assertFalse(candidate['can_review'])
        self.assertEqual(candidate['missing_sources'],['K01','K04','K20','K21'])
        self.assertEqual(self.client.post(f'/api/cases/{self.cid}/rule-release/review',json=self.release_review_body()).status_code,409)

    def test_legal_release_requires_exact_rules_hashes_actor_note_and_case_revision(self):
        self.seed_review_sources()
        body=self.release_review_body()
        endpoint=f'/api/cases/{self.cid}/rule-release/review'
        for bad in ({**body,'reviewer':''},{**body,'review_note':''},{**body,'reviewed_rule_ids':body['reviewed_rule_ids'][:-1]}):
            self.assertEqual(self.client.post(endpoint,json=bad).status_code,422)
        without_revision={k:v for k,v in body.items() if k!='expected_revision'}
        self.assertEqual(self.client.post(endpoint,json=without_revision).status_code,422)
        tampered=[{**row,'content_hash':'0'*64} for row in body['source_versions']]
        self.assertEqual(self.client.post(endpoint,json={**body,'source_versions':tampered}).status_code,409)
        self.assertEqual(self.client.post(endpoint,json={**body,'expected_revision':0}).status_code,409)
        self.assertNotIn('rule_release',self.snapshot())

    def test_explicit_case_legal_approval_is_frozen_and_date_edit_requires_new_review(self):
        from app.case_engine import evaluate_case
        self.seed_review_sources()
        body=self.release_review_body()
        response=self.client.post(f'/api/cases/{self.cid}/rule-release/review',json=body)
        self.assertEqual(response.status_code,200,response.text)
        approved=response.json()
        release=approved['rule_release']
        self.assertEqual(release['status'],'APPROVED')
        self.assertEqual(release['calculator_release_id'],'seoul-blueprint-arithmetic-v1')
        self.assertEqual(len(release['review']['reviewed_rule_ids']),7)
        self.assertNotIn('RULE_RELEASE_REVIEW',[row['code'] for row in evaluate_case(self.runtime.get(self.cid))['findings']])
        self.assertEqual(approved['reviews'],{'caseworker':None,'lawyer':None})
        self.assertFalse(approved['generation_gate']['can_generate'])
        edited=self.client.patch(f'/api/cases/{self.cid}',json={'application_date':'2026-10-27','expected_revision':approved['revision']})
        self.assertEqual(edited.status_code,200)
        self.assertEqual(edited.json()['rule_release']['status'],'REVIEW_REQUIRED')
        self.assertEqual(edited.json()['rule_release_history'][0],release)

    def test_future_or_unknown_date_source_cannot_satisfy_legal_review(self):
        self.seed_review_sources()
        with self.runtime.knowledge._db() as db:
            db.execute("UPDATE knowledge_versions SET valid_from='2027-01-01',valid_to=NULL WHERE source_id='K20'")
        candidate=self.client.get(f'/api/cases/{self.cid}/rule-release/review').json()
        self.assertFalse(candidate['can_review'])
        self.assertIn('K20',candidate['missing_sources'])

    def test_classifier_excludes_targets_and_never_self_verifies_mapping(self):
        doc = self.upload(selected='1-2')
        rows = [{'document_id': doc['id'], 'page': 1, 'role': 'evidence', 'document_type': 'salary_certificate'},
                {'document_id': doc['id'], 'page': 2, 'role': 'filed_form', 'document_type': 'salary_certificate'}]
        result = SimpleNamespace(pages=[SimpleNamespace(**row, model_dump=lambda row=row: row) for row in rows])
        run = self.active_run()
        with patch('app.runtime.ai.classify', new=AsyncMock(return_value=result)):
            response = self.callback(run)
        self.assertEqual(response.status_code, 200, response.text)
        classified = self.snapshot()['documents'][0]
        self.assertEqual(classified['evidence_pages'], [1])
        self.assertIn(2, classified['excluded_pages'])
        self.assertEqual(classified['mapping_status'], 'PROPOSED')
        self.assertEqual(self.client.get(f'/api/cases/{self.cid}/pages/{doc["id"]}/2').status_code, 404)

    def test_edits_during_run_succeed_but_inflight_old_result_is_discarded(self):
        run = self.active_run()
        started, release = threading.Event(), threading.Event()
        async def slow_classification(snapshot):
            started.set()
            if not await asyncio.to_thread(release.wait, 5):
                raise RuntimeError('Synthetic test synchronization timeout')
            snapshot['message'] = 'STALE RESULT MUST NOT COMMIT'
        with patch.object(self.runtime, 'classify', side_effect=slow_classification), ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(self.callback, run)
            self.assertTrue(started.wait(5))
            try:
                edited = self.client.patch(f'/api/cases/{self.cid}', json={'name': 'Changed during active run', 'expected_revision': run['revision']})
                self.assertEqual(edited.status_code, 200, edited.text)
            finally:
                release.set()
            stale = future.result(timeout=5)
        self.assertEqual(stale.status_code, 409, stale.text)
        self.assertEqual(self.snapshot()['name'], 'Changed during active run')
        self.assertNotEqual(self.snapshot()['message'], 'STALE RESULT MUST NOT COMMIT')
        self.assertEqual(self.snapshot()['revision'], run['revision'] + 1)

    def test_internal_stage_requires_run_case_token_and_predecessors(self):
        run = self.active_run()
        self.assertEqual(self.callback(run, run_token='wrong').status_code, 403)
        self.assertEqual(self.callback(run, session_id='other-case').status_code, 403)
        self.assertEqual(self.callback(run, stage='generate').status_code, 409)
        self.assertEqual(self.callback(run, stage='unknown').status_code, 404)

    def test_generation_enqueue_is_durable_and_never_implies_approval(self):
        queued = self.client.post(f'/api/cases/{self.cid}/generate')
        self.assertEqual(queued.status_code, 200)
        state = queued.json()
        self.assertEqual(state['artifacts'], [])
        self.assertEqual(state['reviews'], {'caseworker': None, 'lawyer': None})
        self.assertEqual(len(state['jobs']), 1)
        self.assertEqual(state['jobs'][0]['status'], 'QUEUED')
        self.assertEqual(self.review().status_code, 409)

    def test_hash_bound_review_edit_invalidation_and_retained_history(self):
        artifact = self.seed_artifact()
        self.assertEqual(self.review(template_approved='false').status_code, 422)
        self.assertEqual(self.review('lawyer', template_approved=True).status_code, 409)
        accepted = self.review()
        self.assertEqual(accepted.status_code, 200, accepted.text)
        self.assertEqual(accepted.json()['reviews']['caseworker']['artifact_hashes'], {artifact['id']: artifact['sha256']})
        final = self.review('lawyer', template_approved=True)
        self.assertEqual(final.status_code, 200, final.text)
        self.assertEqual(final.json()['status'], 'reviewed')
        edited = self.client.patch(f'/api/cases/{self.cid}', json={'name': 'After review edit', 'expected_revision': final.json()['revision']})
        self.assertEqual(edited.status_code, 200)
        self.assertEqual(edited.json()['artifacts'], [])
        self.assertEqual(edited.json()['reviews'], {'caseworker': None, 'lawyer': None})
        self.assertEqual(self.snapshot()['artifact_history'][0]['status'], 'invalidated')
        self.assertEqual(self.runtime.storage.read(artifact['storage']), b'Synthetic generated document')
        self.assertEqual(self.client.get(f'/api/cases/{self.cid}/artifacts/draft.docx').status_code, 404)
        with self.runtime.repo.connect() as db:
            self.assertEqual([row[0] for row in db.execute('SELECT status FROM reviews WHERE case_id=?', (self.cid,))], ['invalidated', 'invalidated'])

    def test_corrupted_output_never_gets_reviewed(self):
        artifact = self.seed_artifact()
        self.runtime.storage.local_path(artifact['storage']).write_bytes(b'Altered after generation')
        self.assertEqual(self.review().status_code, 422)
        self.assertIsNone(self.snapshot()['reviews']['caseworker'])
        with self.runtime.repo.connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM reviews WHERE case_id=?', (self.cid,)).fetchone()[0], 0)

    def test_review_cas_failure_leaves_no_accepted_audit_row(self):
        self.seed_artifact()
        with patch.object(self.runtime.repo, 'save', side_effect=RevisionConflict('Synthetic concurrent edit')):
            self.assertEqual(self.review().status_code, 409)
        with self.runtime.repo.connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM reviews WHERE case_id=?', (self.cid,)).fetchone()[0], 0)

    def test_lawyer_cannot_accept_caseworker_review_for_other_hashes(self):
        self.seed_artifact()
        snapshot = self.runtime.get(self.cid)
        snapshot['reviews']['caseworker'] = {'name': 'Synthetic Reviewer', 'revision': snapshot['revision'], 'artifact_hashes': {'wrong-id': '0' * 64}}
        self.runtime.repo.save(snapshot, 'synthetic.fixture', semantic=False, expected_revision=snapshot['revision'])
        self.assertEqual(self.review('lawyer', template_approved=True).status_code, 409)

    def test_archive_preserves_blob_and_invalidates_review(self):
        artifact = self.seed_artifact()
        self.assertEqual(self.review().status_code, 200)
        archived = self.client.request('DELETE', f'/api/cases/{self.cid}/artifacts/draft.docx', json={'expected_revision': self.snapshot()['revision']})
        self.assertEqual(archived.status_code, 200, archived.text)
        self.assertEqual(archived.json()['artifacts'], [])
        self.assertEqual(archived.json()['artifact_history'][0]['status'], 'archived')
        self.assertIsNone(archived.json()['reviews']['caseworker'])
        self.assertEqual(self.client.get(f'/api/cases/{self.cid}/artifacts/draft.docx').status_code, 404)
        self.assertTrue(self.runtime.storage.local_path(artifact['storage']).is_file())
        historical=self.snapshot()['artifact_history'][0]
        self.assertEqual(self.client.get(historical['version_url']).content,b'Synthetic generated document')
        other=self.client.post('/api/cases',json={'name':'Other artifact case'}).json()['id']
        self.assertEqual(self.client.get(f'/api/cases/{other}/artifact-versions/{artifact["id"]}/download').status_code,404)
        with self.runtime.repo.connect() as db:
            self.assertEqual(db.execute('SELECT status FROM reviews WHERE case_id=?', (self.cid,)).fetchone()[0], 'invalidated')
        self.assertEqual(self.client.delete(f'/api/cases/{self.cid}/artifacts/missing.docx').status_code, 404)

    def test_document_tombstone_retracts_assertions_and_preserves_original(self):
        doc = self.upload()
        private_doc = self.runtime.get(self.cid)['documents'][0]
        added = self.client.post(f'/api/cases/{self.cid}/assertions', json=self.assertion(state='VERIFIED', accepted_for_filing=True, evidence_refs=[{'document_id': doc['id'], 'page': 1}]))
        self.assertEqual(added.status_code, 200)
        deleted = self.client.request('DELETE', f'/api/cases/{self.cid}/documents/{doc["id"]}', json={'expected_revision': added.json()['revision']})
        self.assertEqual(deleted.status_code, 200, deleted.text)
        self.assertEqual(deleted.json()['documents'], [])
        self.assertEqual(deleted.json()['assertions'][0]['state'], 'RETRACTED')
        self.assertFalse(deleted.json()['assertions'][0]['accepted_for_filing'])
        self.assertTrue(self.runtime.storage.local_path(private_doc['storage']).is_file())
        self.assertEqual(self.client.get(f'/api/cases/{self.cid}/documents/{doc["id"]}/download').status_code, 404)
        with self.runtime.repo.connect() as db:
            self.assertIsNotNone(db.execute('SELECT deleted_at FROM document_versions WHERE case_id=? AND id=?', (self.cid, doc['id'])).fetchone()[0])

    def test_cross_origin_mutations_rejected_and_local_api_not_cached(self):
        denied = self.client.patch(f'/api/cases/{self.cid}', json={'name': 'Untrusted'}, headers={'Origin': 'https://untrusted.example'})
        self.assertEqual(denied.status_code, 403)
        self.assertEqual(self.snapshot()['name'], 'Synthetic case')
        self.assertEqual(self.client.get('/api/cases').headers['cache-control'], 'no-store')


if __name__ == '__main__':
    unittest.main()
