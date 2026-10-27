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
    try: budget.consume()
    except RuntimeError: pass
    else: raise AssertionError('no further process calls allowed')
print('PASS: failed mutation consumes the shared global stage budget.')
