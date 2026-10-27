#!/usr/bin/env python3
"""Small deterministic denominator and private-boundary checks."""
import json, os, subprocess, sys, tempfile
from pathlib import Path

HERE=Path(__file__).resolve().parent
font_candidates=[Path(os.environ.get('FIRMENGINE_TEST_FONT','/usr/share/fonts/truetype/nanum/NanumGothic.ttf'))]
font=next((x for x in font_candidates if x.is_file()),None)
if font is None: raise SystemExit('Install Nanum Gothic and pass its TTF path to the generator before running this test.')
with tempfile.TemporaryDirectory(prefix='synthetic-ocr-test-') as td:
    root=Path(td)
    subprocess.run([sys.executable,str(HERE/'generate-synthetic-ocr.py'),'--seed','7319','--out-root',str(root),'--font',str(font)],check=True,capture_output=True,text=True)
    req=root/'request-only'; gold=root/'gold'; manifest=json.loads((gold/'manifest.json').read_text())
    assert manifest['seed']==7319
    assert manifest['independent_cases']==4
    assert len(manifest['pages'])==12
    assert all(sum(p['case_id']==case for p in manifest['pages'])==3 for case in {p['case_id'] for p in manifest['pages']})
    assert {p['variant'] for p in manifest['pages']}=={'clean','layout','degraded'}
    assert len(list(req.glob('*.pdf')))==12
    assert not list(req.glob('*.json')) and not list(req.glob('*gold*'))
    assert len(list(gold.glob('*.json')))==5
    reads=root/'reads'; reads.mkdir()
    for g in gold.glob('*.json'):
        if g.name=='manifest.json': continue
        payload=json.loads(g.read_text())
        for field in payload['fields']:
            b=field['source_bbox']; assert len(b)==4 and 0<=b[0]<b[2]<=1 and 0<=b[1]<b[3]<=1
            for variant_box in field['source_bbox_by_variant'].values():
                assert len(variant_box)==4 and 0<=variant_box[0]<variant_box[2]<=1 and 0<=variant_box[1]<variant_box[3]<=1

        for page in manifest['pages']:
            if page['case_id']==payload['case_id']:
                (reads/f"{page['case_id']}--{page['variant']}.json").write_text(json.dumps({'provenance':{'source_sha256':page['sha256']},'fields':[{'field':f['field'],'value':f['expected'],'unit':'KRW','confidence':'clear','quote':'synthetic source '+str(f['expected']),'bbox':f['source_bbox_by_variant'][page['variant']]} for f in payload['fields']]},ensure_ascii=False))
    result=root/'score.json'
    subprocess.run([sys.executable,str(HERE/'score-synthetic-ocr.py'),'--gold-dir',str(gold),'--reads-dir',str(reads),'--out',str(result)],check=True,capture_output=True,text=True)
    scored=json.loads(result.read_text())
    assert scored['independent_case_denominator']==4
    assert all(x['independent_cases_expected']==4 and x['independent_cases_scored']==4 and x['exact_match_accuracy']==1 for x in scored['variants'].values())
    removed=next(reads.glob('*--clean.json')); removed.unlink()
    subprocess.run([sys.executable,str(HERE/'score-synthetic-ocr.py'),'--gold-dir',str(gold),'--reads-dir',str(reads),'--out',str(result)],check=True,capture_output=True,text=True)
    partial=json.loads(result.read_text())['variants']['clean']
    assert partial['independent_cases_evaluated']==4 and partial['independent_cases_scored']==3 and partial['exact_match_accuracy']<1
    assert partial['fields']==scored['variants']['clean']['fields']
    print('PASS: 4 independent cases, 12 paired variant pages; request/gold trees are separate; all gold boxes valid.')

# Monetary scale, source citation, and ambiguity must not disappear in normalization.
import importlib.util
spec=importlib.util.spec_from_file_location('synthetic_scorer',HERE/'score-synthetic-ocr.py')
scorer=importlib.util.module_from_spec(spec); spec.loader.exec_module(scorer)
expected={'field':'principal','expected':'1000','source_bbox':[0,0,1,1],'row_critical':True}
observed={'key':'debt.principal','value':'1000','unit':'KRW','confidence':'clear','quote':'원금 1000원','bbox':[.1,.1,.5,.3]}
assert scorer.matched(expected,[observed],set(),'clean')
for change in ({'unit':'만원'},{'unit':None},{'quote':None},{'confidence':'uncertain'},{'bbox':None}):
    assert not scorer.matched(expected,[{**observed,**change}],set(),'clean')
assert scorer.norm(0)=='0'
print('PASS: wrong/missing money units, absent citation/box and uncertain readings never score as correct.')
