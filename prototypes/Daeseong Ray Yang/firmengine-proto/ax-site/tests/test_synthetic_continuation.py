"""Execute real PDF rescue preparation and preserve interrupted-run accounting."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

from PIL import Image
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('continuation_runner', ROOT/'scripts/run-synthetic-ocr-evaluation.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)
CASE = '12345678-1234-1234-1234-123456789abc'
DOC = '23456789-1234-1234-1234-123456789abc'
COMMIT = 'a'*40

class ContinuationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.pdf = self.root/'payroll-01-SYN-123-01--clean.pdf'
        c = canvas.Canvas(str(self.pdf), pagesize=(400, 600))
        c.setFillColorRGB(.85, .85, .85)
        c.drawString(40, 520, 'Synthetic source, rescue branch')
        c.showPage(); c.save()
        self.digest = runner.source_hash(self.pdf)
        self.image_hash = hashlib.sha256(runner.render_single_page(self.pdf)).hexdigest()
        self.context = {'source_case_id':self.pdf.stem.split('--')[0], 'family':'payroll', 'variant':'clean',
            'source_sha256':self.digest, 'source_page':1, 'model':runner.MODEL,
            'source_commit':COMMIT, 'case_process_steps':3, 'steps_used':3, 'max_steps':6,
            'site_case_id':CASE, 'document_id':DOC, 'last_attempted_stage':'process_request'}
        self.plan = {'planId':'fixture-plan', 'documentId':DOC, 'page':1, 'sourceHash':self.digest,
            'baseImageHash':self.image_hash, 'reason':'classification_unknown',
            'recipeVersion':'luma-levels-v2', 'boxes':[[0,0,1,.45]]}

    def tearDown(self):
        self.temp.cleanup()

    def snapshot(self, status):
        return {'case':{'context':{'id':CASE}, 'execution':{'model':runner.MODEL},
            'documents':[{'id':DOC, 'sha256':self.digest, 'status':'active', 'pages':[1]}],
            'pages':[{'documentId':DOC, 'page':1, 'role':'evidence'}]},
            'jobs':[{'documentId':DOC, 'page':1, 'role':'evidence', 'status':status,
                     'stage':'completed' if status=='completed' else 'classify'}],
            'processingReadiness':{'issues':[]}}

    def diagnostic(self):
        return {'source':{'sha256':self.digest,'imageHash':self.image_hash},
                'job':{'documentId':DOC,'page':1,'role':'evidence'}}

    def test_real_rescue_render_uploads_both_views_once(self):
        calls = []
        class API:
            def call(_, path, method='GET', **kwargs):
                calls.append((path, method, kwargs))
        prepared = set()
        for _ in range(2):
            runner.prepare_rescue(API(), self.pdf, CASE, DOC, self.digest, self.image_hash, self.plan, prepared)
        self.assertEqual(len(calls), 2)
        for index, (path, method, values) in enumerate(calls):
            self.assertEqual(method, 'PUT')
            self.assertIn('kind=variant', path)
            transform = json.loads(values['extra_headers']['X-Transform'])
            self.assertEqual(transform['tone'], ['neutral','luma-levels-v2'][index])
            self.assertEqual(transform['rotation'], [0,90][index])
            with Image.open(io.BytesIO(values['data'])) as image:
                self.assertGreater(image.width, image.height)
                self.assertEqual(image.format, 'JPEG')
        self.assertEqual(prepared, {'fixture-plan'})

    def test_continuation_gets_plan_before_next_and_keeps_charged_stages(self):
        calls = []; test = self
        class API:
            finished = False
            def call(api, path, method='GET', payload=None, **kwargs):
                calls.append((method,path))
                if '&view=classification' in path: return test.diagnostic()
                if method=='PUT':
                    self.assertIn('kind=variant',path); return {}
                if path==f'/api/cases/{CASE}/process':
                    if method=='GET': return {'rescue':test.plan,'remaining':1}
                    api.finished=True; return {'remaining':0,'stage':'completed'}
                if path==f'/api/cases/{CASE}': return test.snapshot('completed' if api.finished else 'pending')
                if '/process?jobId=' in path: return {'stored':{'read':{'records':[]}}}
                raise AssertionError('Creation or original upload must never replay')
        budget = runner.StageBudget(6,3)
        result_path, _ = runner.run_one(API(), self.pdf, self.root/'continued',6,3,'2026-10-27',budget,COMMIT,dict(self.context))
        result = json.loads(result_path.read_text())
        self.assertEqual(budget.used,4)
        self.assertEqual(result['provenance']['case_process_steps'],4)
        self.assertEqual(result['provenance']['site_case_id'],CASE)
        self.assertEqual([m for m,p in calls if p.endswith('/process')],['GET','POST'])
        self.assertEqual(len([m for m,p in calls if m=='PUT']),2)

    def test_completed_or_held_case_is_read_without_new_stage(self):
        for status in ('completed','held'):
            calls = []; test=self
            class API:
                def call(_,path,method='GET',**kwargs):
                    calls.append((method,path))
                    if '&view=classification' in path:return test.diagnostic()
                    if '/process?jobId=' in path:return {'stored':{'read':{'records':[]}}}
                    return test.snapshot(status)
            budget=runner.StageBudget(6,3)
            runner.run_one(API(),self.pdf,self.root/status,6,3,'2026-10-27',budget,COMMIT,dict(self.context))
            self.assertEqual(budget.used,3)
            self.assertTrue(all(m=='GET' for m,p in calls))

    def test_source_and_busy_changes_fail_before_any_mutation(self):
        for kind in ('source','busy','other_document'):
            snapshot=self.snapshot('processing' if kind=='busy' else 'pending')
            if kind=='source': snapshot['case']['documents'][0]['sha256']='b'*64
            if kind=='other_document': snapshot['case']['documents'].append({'id':'another','status':'active'})
            calls=[]
            class API:
                def call(_,path,method='GET',**kwargs): calls.append(method);return snapshot
            with self.assertRaises(ValueError):
                runner.run_one(API(),self.pdf,self.root/kind,6,3,'2026-10-27',runner.StageBudget(6,3),COMMIT,dict(self.context))
            self.assertEqual(calls,['GET'])

    def test_changed_page_raster_fails_even_without_a_rescue_plan(self):
        calls=[]; test=self
        class API:
            def call(_,path,method='GET',**kwargs):
                calls.append(method)
                if '&view=classification' in path:
                    value=test.diagnostic(); value['source']['imageHash']='b'*64; return value
                return test.snapshot('pending')
        with self.assertRaises(ValueError):
            runner.run_one(API(),self.pdf,self.root/'changed-raster',6,3,'2026-10-27',runner.StageBudget(6,3),COMMIT,dict(self.context))
        self.assertEqual(calls,['GET','GET'])

    def test_loader_freezes_set_release_budget_and_failure_history(self):
        previous=self.root/'previous'; (previous/'checkpoints').mkdir(parents=True)
        result={'provenance':{**self.context,'status':'driver_error','safe_error':"name 'math' is not defined"}}
        result_path=previous/(self.pdf.stem+'.json')
        result_path.write_text(json.dumps(result))
        (previous/'checkpoints'/result_path.name).write_text(json.dumps(self.context))
        old_bytes=result_path.read_bytes()
        contexts,used=runner.load_continuation(previous,[self.pdf],COMMIT,6)
        self.assertEqual(used,3)
        self.assertEqual(contexts[self.pdf.stem]['continuation']['previous_status'],'driver_error')
        self.assertEqual(result_path.read_bytes(),old_bytes)
        seeded=self.root/'interrupted-continuation'
        runner.seed_continuation(seeded,contexts)
        # Crash after a stage was charged but before its result was written.
        checkpoint=seeded/'checkpoints'/result_path.name
        saved=json.loads(checkpoint.read_text());saved['case_process_steps']=4;saved['steps_used']=4
        runner.write_json(checkpoint,saved)
        resumed,spent=runner.load_continuation(seeded,[self.pdf],COMMIT,6)
        self.assertEqual(spent,4)
        self.assertEqual(resumed[self.pdf.stem]['case_process_steps'],4)
        for commit,limit in [('b'*40,6),(COMMIT,7)]:
            with self.assertRaises(ValueError):runner.load_continuation(previous,[self.pdf],commit,limit)
        (previous/'additional-case.json').write_text('{}')
        with self.assertRaises(ValueError):runner.load_continuation(previous,[self.pdf],COMMIT,6)

if __name__ == '__main__':
    unittest.main()
