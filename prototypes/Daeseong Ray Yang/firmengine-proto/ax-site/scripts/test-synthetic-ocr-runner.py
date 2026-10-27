#!/usr/bin/env python3
"""No-network contract test for request-only upload and read-fields export."""
import importlib.util, json, sys, tempfile
from pathlib import Path
from reportlab.pdfgen import canvas

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('synthetic_runner',HERE/'run-synthetic-ocr-evaluation.py')
runner=importlib.util.module_from_spec(spec); spec.loader.exec_module(runner)
run_one=runner.run_one

class FakeSite:
    def __init__(self,finish=True): self.calls=[]; self.finished=False; self.finish=finish
    def call(self,path,method='GET',payload=None,data=None,mime=None,timeout=180,extra_headers=None):
        self.calls.append({'path':path,'method':method,'payload':payload,'mime':mime,'bytes':len(data) if data is not None else 0})
        if path=='/api/cases' and method=='POST': return {'case':{'context':{'id':'site-case-1'}}}
        if path.endswith('/documents') and method=='POST': return {'documentId':'site-doc-1','pageRoles':[{'page':1,'role':'unknown'}]}
        if path.endswith('/process') and method=='POST':
            self.finished=self.finish
            return {'stage':'completed' if self.finish else 'extract','remaining':0 if self.finish else 1}
        if path=='/api/cases/site-case-1':
            return {'case':{'execution':{'model':'gpt-6-luna'}},'jobs':[{'documentId':'site-doc-1','page':1,'role':'evidence','status':'completed' if self.finished else 'pending','stage':'completed' if self.finished else 'extract'}]}
        if '/process?jobId=' in path:
            return {'stored':{'read':{'documentType':'payroll','complete':True,'records':[{'category':'payroll','fields':[{'key':'gross_pay','value':'4,250,000','unit':'KRW','quote':'총급여 4,250,000','confidence':'clear','bbox':[.1,.2,.9,.3]}]}]}}}
        if method=='PUT': return {'stored':True}
        raise AssertionError(f'Unexpected API call: {method} {path}')

with tempfile.TemporaryDirectory(prefix='synthetic-ocr-runner-') as td:
    root=Path(td); pdf=root/'payroll-01-SYN-123-01--clean.pdf'; out=root/'reads'
    c=canvas.Canvas(str(pdf)); c.drawString(40,760,'Synthetic OCR test'); c.showPage(); c.save()
    api=FakeSite(); result_path,steps=run_one(api,pdf,out,1,0,'2026-10-27')
    result=json.loads(result_path.read_text())
    assert steps==1 and result['provenance']['status']=='completed'
    assert result['provenance']['model']=='gpt-6-luna' and result['provenance']['variant']=='clean'
    assert result['fields'][0]['field']=='gross_pay' and result['fields'][0]['value']=='4,250,000'
    assert result['provenance']['source_sha256']
    process_calls=[x for x in api.calls if x['path'].endswith('/process') and x['method']=='POST']
    assert len(process_calls)==1 and process_calls[0]['payload']=={'action':'next'}
    assert all('gold' not in x['path'].lower() for x in api.calls)
    assert not any(isinstance(x['payload'],dict) and ('expected' in x['payload'] or 'gold' in x['payload']) for x in api.calls)
    assert runner.request_metadata(root/'debt_balance-01-SYN-123-01--layout.pdf')[1:]==('debt_balance','layout')
    capped=FakeSite(finish=False); _,capped_steps=run_one(capped,pdf,root/'reads-capped',1,0,'2026-10-27')
    assert capped_steps==1 and len([x for x in capped.calls if x['method']=='POST' and x['path'].endswith('/process')])==1
print('PASS: one request-only page, no gold payload/path, one bounded process step, Luna provenance and fields exported.')

class TimeoutSite(FakeSite):
    def call(self,path,method='GET',*args,**kwargs):
        if path.endswith('/process') and method=='POST': raise TimeoutError('synthetic timed-out mutation')
        return super().call(path,method,*args,**kwargs)

with tempfile.TemporaryDirectory(prefix='synthetic-ocr-budget-') as td:
    root=Path(td); pdf=root/'payroll-01-SYN-123-01--clean.pdf'
    c=canvas.Canvas(str(pdf)); c.drawString(40,760,'Synthetic OCR test'); c.showPage(); c.save()
    budget=runner.StageBudget(1)
    try: run_one(TimeoutSite(),pdf,root/'reads',1,0,'2026-10-27',budget)
    except TimeoutError: pass
    else: raise AssertionError('timeout expected')
    assert budget.used==1, 'timed-out mutation must remain charged globally'
    checkpoint=json.loads((root/'reads/checkpoints/payroll-01-SYN-123-01--clean.json').read_text())
    assert checkpoint['site_case_id']=='site-case-1' and checkpoint['document_id']=='site-doc-1'
    assert checkpoint['case_process_steps']==1 and checkpoint['steps_used']==1
    assert checkpoint['last_attempted_stage']=='process_request'
    try: budget.consume()
    except RuntimeError: pass
    else: raise AssertionError('no further process calls allowed')
print('PASS: failed mutation consumes the shared global stage budget.')

import concurrent.futures
budget=runner.StageBudget(7)
def attempt(_):
    try: budget.consume(); return True
    except RuntimeError: return False
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    outcomes=list(pool.map(attempt,range(40)))
assert sum(outcomes)==7 and budget.used==7
print('PASS: concurrent cases cannot exceed the shared budget.')

from http.client import IncompleteRead
from unittest.mock import patch
class TruncatedThenComplete:
    def __init__(self): self.calls=0
    def open(self,request,timeout):
        self.calls+=1
        if self.calls==1: raise IncompleteRead(b'partial response')
        class Response:
            headers={}
            def __enter__(self): return self
            def __exit__(self,*args): pass
            def read(self): return b'{"readable":true}'
        return Response()

for method,expected_calls in [('GET',2),('POST',1)]:
    api=runner.SiteClient('https://synthetic.chatgpt.site','non-secret-fixture')
    opener=TruncatedThenComplete();api.opener=opener
    with patch.object(runner.time,'sleep'):
        if method=='GET': assert api.call('/api/cases/example',method)=={'readable':True}
        else:
            try: api.call('/api/cases/example/process',method,payload={'action':'next'})
            except RuntimeError: pass
            else: raise AssertionError('an uncertain mutation response must not be replayed')
    assert opener.calls==expected_calls
print('PASS: truncated safe reads retry; truncated mutations are never replayed.')

class CreatedButTruncated:
    def __init__(self,location): self.location=location;self.requests=[]
    def open(self,request,timeout):
        self.requests.append((request.get_method(),request.full_url))
        creation=request.get_method()=='POST'
        location=self.location
        class Response:
            status=201 if creation else 200
            headers={'Location':location} if creation else {}
            def __enter__(self): return self
            def __exit__(self,*args): pass
            def read(self):
                if creation: raise IncompleteRead(b'partial creation response')
                return b'{"case":{"context":{"id":"12345678-1234-1234-1234-123456789abc"}}}'
        return Response()

for location,success in [('/api/cases/12345678-1234-1234-1234-123456789abc',True),('https://elsewhere.invalid/collect',False),('/api/workspace',False)]:
    api=runner.SiteClient('https://synthetic.chatgpt.site','non-secret-fixture')
    opener=CreatedButTruncated(location);api.opener=opener
    try: result=api.call('/api/cases','POST',payload={'name':'synthetic'})
    except RuntimeError: assert not success
    else: assert success and result['case']['context']['id']=='12345678-1234-1234-1234-123456789abc'
    assert [method for method,_ in opener.requests]==(['POST','GET'] if success else ['POST'])
    assert all(url.startswith('https://synthetic.chatgpt.site/') for _,url in opener.requests)
print('PASS: truncated creation recovers its exact same-site Location by GET without repeating creation.')
