"""Persistent stage integration with fake AI, actual local Code JS and no network."""
import asyncio
from copy import deepcopy
from pathlib import Path
import sys
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

import pymupdf

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.runtime import CaseRuntime
from app.repository import RevisionConflict
from tests.test_code_calculator import calculate


class Page(dict):
    @property
    def document_id(self):
        return self['document_id']
    @property
    def page(self):
        return self['page']
    def model_dump(self):
        return dict(self)


class Extraction(list):
    pages=[]
    missing_features=[]
    warnings=[]


def evidence_pdf():
    with pymupdf.open() as doc:
        doc.new_page().insert_text((30,30),'Synthetic supporting evidence')
        doc.new_page().insert_text((30,30),'Synthetic excluded filed page')
        return doc.tobytes()


class RuntimeTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        asyncio.get_running_loop().set_debug(False)
        self.temp=tempfile.TemporaryDirectory()
        self.runtime=CaseRuntime(Path(self.temp.name))
        self.case=self.runtime.repo.create_case('Synthetic runtime','wage',application_date='2026-10-26')
        self.network=patch('app.runtime.httpx.AsyncClient',side_effect=AssertionError('Network forbidden in synthetic integration'))
        self.network.start()

    async def asyncTearDown(self):
        await self.runtime.stop()
        self.network.stop()
        self.temp.cleanup()

    def start_run(self):
        self.runtime.repo.enqueue(self.case['id'],'case.reassess')
        job=self.runtime.repo.claim_job('synthetic-worker')
        self.run={'id':job['id'],'case_id':self.case['id'],'revision':job['case_revision'],
            'token':'synthetic-callback-token','completed':set(),'lock':asyncio.Lock(),'done':asyncio.Event(),
            'action':'assess','worker':'synthetic-worker','started':time.monotonic()}
        self.runtime.active[self.run['id']]=self.run
        self.body={'session_id':self.case['id'],'run_id':self.run['id'],'run_token':self.run['token']}

    async def progress_to_prepare(self):
        await self.runtime.stage('classify',self.body)
        await self.runtime.stage('extract',self.body)
        return await self.runtime.stage('prepare',self.body)

    def ready_snapshot(self):
        data=self.case
        data.update(rule_release_id='synthetic-reviewed-release',rule_release={'id':'synthetic-reviewed-release',
            'status':'APPROVED','calculator_release_id':'seoul-blueprint-arithmetic-v1',
            'effective_from':'2026-01-01','effective_to':'2026-12-31'},
            income_evidence_period={'start':'2026-01-01','end':'2026-09-30'})
        data['objects']=[{'id':'person-primary','type':'person','label':'Synthetic person'},
                         {'id':'loan1','type':'debt','label':'Synthetic loan'},
                         {'id':'job1','type':'income_source','label':'Synthetic employment'}]
        values={
            'jurisdiction.residence':'Synthetic address','person.natural_person':True,
            'person.name':'Synthetic private name','income.monthly_net':'3000',
            'person.resident_id':'000000-0000000','form.court_name':'Synthetic court',
            'form.statement':'Synthetic supported circumstances','form.assets_total':'0',
            'history.proceedings[]':[],'income.recognized_monthly_net':'3000','plan.start_date':'2026-11-01',
            'income.recurring_evidence[]':'Synthetic continuing income proof',
            'household.members[]':['one synthetic person'],
            'dependents.support_evidence[]':'Reviewed household proof','household.recognized_count':'1',
            'coverage.debt_inventory':'COMPLETE','coverage.asset_inventory':'COMPLETE','coverage.income_sources':'COMPLETE',
            'court.objection_status':False,'living.additional_housing_requested':False,
            'living.recognized_total':'1000','plan.monthly_trustee_fee':'0','plan.term_months':'24',
            'plan.total_present_value':'48000','plan.liquidation_floor':'0',
        }
        debt={'debts[].origin_contract_id':'contract1','debts[].current_creditor_id':'Synthetic bank',
              'debts[].principal':'100000','debts[].interest':'0','debts[].amount_as_of':'2026-10-26',
              'form.creditor_address':'Synthetic creditor address',
              'debts[].security_status':'UNSECURED','debts[].priority_status':'NONE',
              'debts[].estate_claim_status':'NONE','debts[].dispute':False}
        income={'income_source.kind':'wage','income_source.employer':'Synthetic employer',
                'income_source.net':'3000','income_source.period':'2026-09',
                'income_source.recurring_evidence':'Synthetic recurring proof'}
        data['assertions']=[]
        for oid, group in [('person-primary',values),('loan1',debt),('job1',income)]:
            for key,value in group.items():
                row={'record_id':oid+':'+key,'object_id':oid,'feature_key':key,'value':value,
                     'state':'VERIFIED','currency':'KRW','unit':'won','accepted_for_filing':True,
                     'evidence_refs':[{'document_id':'proof-loan' if oid=='loan1' else 'proof-job' if oid=='job1' else 'proof-review',
                                       'page':1,'excerpt':'Synthetic verification'}]}
                if key in ('income.monthly_net','income_source.net'):
                    row.update(measurement_period='MONTHLY',source_period='2026-09')
                if key in ('debts[].principal','debts[].interest'):
                    row['valid_at']='2026-10-26'
                if key in ('plan.total_present_value','plan.liquidation_floor'):
                    row.update(normalized=True,valuation_date='2026-10-26',basis_id='synthetic-reviewed-pv')
                data['assertions'].append(row)
        kinds=['resident_registration','family_relationship_certificate','household_support_evidence',
               'withholding_certificate','review_evidence','debt_certificate']
        data['documents']=[{'id':'proof-loan' if kind=='debt_certificate' else 'proof-review' if kind=='review_evidence' else 'doc-'+kind,
            'name':kind+'.pdf','pages':1,'evidence_pages':[1],'excluded_pages':[],
            'processing_status':'extracted','document_type':kind,'mapping_status':'VERIFIED',
            'subject_id':'loan1' if kind=='debt_certificate' else 'job1' if kind=='withholding_certificate' else None,
            'period_start':'2026-01-01','period_end':'2026-12-31'} for kind in kinds]
        data['documents'].append({'id':'proof-job','name':'employment-proof.pdf','pages':1,'evidence_pages':[1],
            'excluded_pages':[],'processing_status':'extracted','document_type':'review_evidence','mapping_status':'VERIFIED',
            'subject_id':'job1','period_start':'2026-01-01','period_end':'2026-12-31'})
        self.runtime.repo.save(data,'synthetic.fixture',semantic=False,expected_revision=1)
        principal=next(row['id'] for row in data['assertions'] if row['feature_key']=='debts[].principal')
        data['plan_allocations']=[{'number':'1','debt_id':'loan1','creditor_name':'Synthetic bank',
            'claim_confirmed':'100000','claim_unconfirmed':'0','monthly_confirmed':'2000','monthly_reserved':'0',
            'total_confirmed':'48000','total_reserved':'0','status':'verified','case_revision':1,
            'source_assertion_ids':[principal],'basis':'Explicit synthetic reviewer allocation'}]
        self.runtime.repo.save(data,'synthetic.allocation',semantic=False,expected_revision=1)

    async def test_fake_ai_extracts_evidence_only_and_missing_requirements_hold_generation_after_complete(self):
        self.runtime.add_document(self.case,'synthetic.pdf',evidence_pdf())
        self.runtime.change(self.case,'document.added',enqueue=False)
        self.start_run()
        async def classify(items,metrics):
            return SimpleNamespace(pages=[Page(document_id=d['id'],page=p,role='evidence' if p==1 else 'submitted_form',reason='synthetic') for d,p in items])
        async def extract(items,metrics,**kwargs):
            self.assertEqual([p for _,p in items],[1])
            doc=items[0][0]
            return Extraction([{'key':'client_name','value':'Synthetic name','entity':'','period':'','unit':'',
                                'document_id':doc['id'],'page':1,'quote':'Synthetic evidence','confidence':'high'}])
        with patch('app.runtime.ai.classify',new=AsyncMock(side_effect=classify)) as classify_ai, patch('app.runtime.ai.extract',new=AsyncMock(side_effect=extract)) as extract_ai:
            prepared=await self.progress_to_prepare()
            before=len(self.runtime.repo.assertion_history(self.case['id']))
            await self.runtime.stage('extract',self.body)
            self.assertEqual(len(self.runtime.repo.assertion_history(self.case['id'])),before)
            self.assertEqual(classify_ai.await_count,1)
            self.assertEqual(extract_ai.await_count,1)
            result=calculate(prepared['snapshot'])
            await self.runtime.stage('validate',{**self.body,'calculation_results':result})
            await self.runtime.stage('generate',self.body)
            await self.runtime.stage('complete',self.body)
        reopened=CaseRuntime(Path(self.temp.name))
        try:
            stored=reopened.get(self.case['id'])
            self.assertEqual(stored['status'],'needs_action')
            self.assertFalse(stored['artifacts'])
            self.assertFalse(stored['generation_gate']['can_generate'])
            parent = next(doc for doc in stored['documents'] if doc.get('processing_status') == 'bundle')
            child = next(doc for doc in stored['documents'] if doc.get('source_parent_id') == parent['id'])
            self.assertEqual(parent['bundle_evidence_pages'],[1])
            self.assertEqual(parent['evidence_pages'],[])
            self.assertEqual(parent['excluded_pages'],[2])
            self.assertEqual(child['evidence_pages'],[1])
            name = next(row for row in stored['assertions'] if row['feature_key'] == 'person.name')
            self.assertEqual(name['evidence_refs'][0]['document_id'],child['id'])
            self.assertEqual(stored['calculation_results']['computed_by'],'n8n-code')
            self.assertTrue(self.run['done'].is_set())
            with self.assertRaises(PermissionError):
                await reopened.stage('complete',self.body)
        finally:
            await reopened.stop()

    async def test_callbacks_require_token_order_and_unchanged_revision(self):
        self.start_run()
        with self.assertRaises(PermissionError):
            await self.runtime.stage('classify',{**self.body,'run_token':'wrong'})
        with self.assertRaises(RevisionConflict):
            await self.runtime.stage('validate',self.body)
        self.runtime.change(self.runtime.get(self.case['id']),'fact.edited',enqueue=False)
        with self.assertRaises(RevisionConflict):
            await self.runtime.stage('classify',self.body)
        self.assertTrue(self.run['done'].is_set())
        self.assertEqual(self.runtime.get(self.case['id'])['revision'],2)

    async def test_prepare_preserves_pv_scope_and_persisted_assertion_ids_without_person_name(self):
        self.ready_snapshot()
        self.start_run()
        with patch('app.runtime.ai.classify',new=AsyncMock(side_effect=AssertionError('No OCR needed'))), patch('app.runtime.ai.extract',new=AsyncMock(side_effect=AssertionError('No OCR needed'))):
            prepared=await self.progress_to_prepare()
        outgoing=prepared['snapshot']['assertions']
        pv=next(row for row in outgoing if row['feature_key']=='plan.total_present_value')
        self.assertTrue(pv['normalized'])
        self.assertEqual(pv['basis_id'],'synthetic-reviewed-pv')
        self.assertEqual(pv['valuation_date'],'2026-10-26')
        self.assertFalse(any(row['feature_key']=='person.name' or 'evidence_refs' in row for row in outgoing))
        current={row['id'] for row in self.runtime.get(self.case['id'])['assertions']}
        self.assertTrue({row['id'] for row in outgoing} <= current)

    async def test_actual_code_ready_gate_generates_hash_bound_artifacts_and_repeat_callback_is_idempotent(self):
        self.ready_snapshot()
        self.start_run()
        prepared=await self.progress_to_prepare()
        result=calculate(prepared['snapshot'])
        validated=await self.runtime.stage('validate',{**self.body,'calculation_results':result})
        self.assertTrue(validated['can_generate'],self.runtime.get(self.case['id'])['findings'])
        await self.runtime.stage('generate',self.body)
        before=self.runtime.get(self.case['id'])
        self.assertTrue(before['artifacts'])
        hashes={row['id']:row['sha256'] for row in before['artifacts']}
        for item in before['artifacts']:
            self.assertTrue(self.runtime.storage.read(item['storage']))
            self.assertEqual(item['case_revision'],before['revision'])
        await self.runtime.stage('generate',self.body)
        after=self.runtime.get(self.case['id'])
        self.assertEqual({row['id']:row['sha256'] for row in after['artifacts']},hashes)
        await self.runtime.stage('complete',self.body)
        self.assertEqual(self.runtime.get(self.case['id'])['status'],'ready')
        damaged=after['artifacts'][0]
        self.runtime.storage.local_path(damaged['storage']).write_bytes(b'Synthetic corruption')
        with self.assertRaises(ValueError):
            self.runtime.storage.read(damaged['storage'])

    async def test_validate_rejects_stale_code_result_without_persisting_it(self):
        self.start_run()
        prepared=await self.progress_to_prepare()
        result=calculate(prepared['snapshot'])
        result['case_revision']=0
        with self.assertRaises(ValueError):
            await self.runtime.stage('validate',{**self.body,'calculation_results':result})
        self.assertIsNone(self.runtime.get(self.case['id'])['calculation_results'])
        self.assertTrue(self.run['done'].is_set())

    async def test_semantic_change_cancels_inflight_ai_and_queues_current_revision_without_overwrite(self):
        self.runtime.add_document(self.case,'synthetic.pdf',evidence_pdf())
        self.runtime.change(self.case,'document.added',enqueue=False)
        self.start_run()
        started, cancelled = asyncio.Event(), asyncio.Event()

        async def stalled_classify(items, metrics):
            started.set()
            try:
                await asyncio.Event().wait()
            except asyncio.CancelledError:
                cancelled.set()
                raise

        with patch('app.runtime.ai.classify',new=AsyncMock(side_effect=stalled_classify)):
            old_stage = asyncio.create_task(self.runtime.stage('classify',self.body))
            try:
                await asyncio.wait_for(started.wait(),timeout=3)
                updated = self.runtime.get(self.case['id'])
                old_revision = updated['revision']
                updated['name'] = 'Synthetic newer revision'
                self.runtime.change(updated,'case.edited',{'expected_revision':old_revision})
                self.assertTrue(self.run['superseded'])
                self.assertTrue(self.run['done'].is_set())
                # The AI coroutine receives cancellation; the callback translates
                # this into a revision conflict instead of an HTTP server error.
                with self.assertRaises(RevisionConflict):
                    await asyncio.wait_for(old_stage,timeout=3)
                self.assertTrue(cancelled.is_set())
                self.assertNotIn('stage_task',self.run)
                stored = self.runtime.get(self.case['id'])
                self.assertEqual(stored['revision'],old_revision+1)
                self.assertEqual(stored['name'],'Synthetic newer revision')
                self.assertEqual(stored['documents'][0]['processing_status'],'uploaded')
                self.assertEqual(stored['documents'][0]['page_roles'],[])
                self.assertNotIn('classify',self.run['completed'])
                self.assertTrue(any(job['status']=='QUEUED' and job['case_revision']==old_revision+1 for job in stored['jobs']))
            finally:
                if not old_stage.done():
                    old_stage.cancel()
                    await asyncio.gather(old_stage,return_exceptions=True)

    async def test_unready_n8n_waits_without_claiming_or_consuming_job_attempts(self):
        self.runtime.repo.enqueue(self.case['id'],'case.reassess')
        sleeping = asyncio.Event()
        requests = []

        class Client:
            async def __aenter__(inner):
                return inner
            async def __aexit__(inner,*args):
                return None
            async def get(inner,url):
                requests.append(url)
                return SimpleNamespace(status_code=503)

        async def sleep_until_cancelled(delay):
            self.assertEqual(delay,2)
            sleeping.set()
            await asyncio.Event().wait()

        with patch('app.runtime.httpx.AsyncClient',side_effect=lambda **kwargs: Client()), \
             patch('app.runtime.asyncio.sleep',new=sleep_until_cancelled), \
             patch.object(self.runtime.repo,'claim_job',wraps=self.runtime.repo.claim_job) as claim:
            worker = asyncio.create_task(self.runtime.worker('offline-worker'))
            try:
                await asyncio.wait_for(sleeping.wait(),timeout=3)
                worker.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await worker
                claim.assert_not_called()
                jobs = self.runtime.get(self.case['id'])['jobs']
                self.assertEqual([(job['status'],job['attempts']) for job in jobs],[('QUEUED',0)])
                self.assertEqual(len(requests),1)
                self.assertTrue(requests[0].endswith('/healthz/readiness'))
                self.assertFalse(self.runtime.active)
            finally:
                if not worker.done():
                    worker.cancel()
                    await asyncio.gather(worker,return_exceptions=True)

    async def test_initial_webhook_404_retries_inside_one_lease_then_succeeds_once(self):
        self.runtime.repo.enqueue(self.case['id'],'case.reassess')
        finished = asyncio.Event()
        gets, posts, pauses = [], [], []

        class Client:
            async def __aenter__(inner):
                return inner
            async def __aexit__(inner,*args):
                return None
            async def get(inner,url):
                gets.append(url)
                if len(gets)>1:
                    finished.set()
                    await asyncio.Event().wait()
                return SimpleNamespace(status_code=200)
            async def post(inner,url,*,json):
                posts.append((url,deepcopy(json)))
                if len(posts)==1:
                    return SimpleNamespace(status_code=404,raise_for_status=lambda: self.fail('Transient 404 should be retried within lease'))
                run = self.runtime.active[json['run_id']]
                self.assertEqual(json['run_token'],run['token'])
                run['done'].set()  # Simulated authenticated n8n completion, no AI.
                return SimpleNamespace(status_code=200,raise_for_status=lambda: None)

        async def bounded_pause(delay):
            pauses.append(delay)

        with patch('app.runtime.httpx.AsyncClient',side_effect=lambda **kwargs: Client()), \
             patch('app.runtime.asyncio.sleep',new=bounded_pause):
            worker = asyncio.create_task(self.runtime.worker('handshake-worker'))
            try:
                await asyncio.wait_for(finished.wait(),timeout=3)
                worker.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await worker
                jobs = self.runtime.get(self.case['id'])['jobs']
                self.assertEqual([(job['status'],job['attempts']) for job in jobs],[('SUCCEEDED',1)])
                self.assertEqual(len(posts),2)
                self.assertEqual(posts[0],posts[1])
                self.assertEqual(pauses,[1])
                self.assertFalse(self.runtime.active)
            finally:
                if not worker.done():
                    worker.cancel()
                    await asyncio.gather(worker,return_exceptions=True)


if __name__=='__main__':
    unittest.main()
