#!/usr/bin/env python3
"""Offline source-unit contract tests for synthetic OCR v2."""
import hashlib, importlib.util, json, os, subprocess, sys, tempfile
from pathlib import Path

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('synthetic_score_v2',HERE/'score-synthetic-ocr.py')
scorer=importlib.util.module_from_spec(spec); spec.loader.exec_module(scorer)
font_candidates=[Path(os.environ.get('FIRMENGINE_TEST_FONT','/usr/share/fonts/truetype/nanum/NanumGothic.ttf'))]
font=next((x for x in font_candidates if x.is_file()),None)
if font is None: raise SystemExit('Install Nanum Gothic and pass its TTF path to the generator before running this test.')

with tempfile.TemporaryDirectory(prefix='synthetic-ocr-v2-test-') as td:
    root=Path(td)
    subprocess.run([sys.executable,str(HERE/'generate-synthetic-ocr.py'),'--version','v2','--seed','20261028','--include-missing-unit','--out-root',str(root),'--font',str(font)],check=True,capture_output=True,text=True)
    req=root/'request-only'; gold_dir=root/'gold'; manifest=json.loads((gold_dir/'manifest.json').read_text())
    assert manifest['version']=='v2' and manifest['seed']==20261028
    assert manifest['independent_cases']==4
    assert len(manifest['pages'])==16
    assert len(manifest['positive_variants'])==3 and len(manifest['safety_variants'])==1
    assert len([p for p in manifest['pages'] if p['variant'] in manifest['positive_variants']])==12
    assert all(p['sha256'] and p['expected_money_unit']==('원' if p['variant']!='missing_unit' else None) for p in manifest['pages'])
    import fitz
    for page in manifest['pages']:
        pdf_path=req/page['path']; assert hashlib.sha256(pdf_path.read_bytes()).hexdigest()==page['sha256']
        pdf=fitz.open(pdf_path)
        text=' '.join(pdf[0].get_text().split())
        gold=json.loads((gold_dir/f"{page['case_id']}.json").read_text())
        if page['variant'] in manifest['positive_variants'] and page['variant']!='degraded':
            assert any(f.get('expected_unit')=='원' and f['expected']+'원' in text for f in gold['fields'])
            assert all(f['expected']+'원' not in text for f in gold['fields'] if f['field'] not in scorer.MONEY_FIELDS)
        elif page['variant']=='missing_unit':
            assert all(f.get('expected_unit')=='원' and f['expected']+'원' not in text for f in gold['fields'] if f['field'] in scorer.MONEY_FIELDS)
            assert all(f.get('expected_unit_by_variant',{}).get('missing_unit') is None for f in gold['fields'] if f['field'] in scorer.MONEY_FIELDS)
        elif page['variant']=='degraded':
            pix=pdf[0].get_pixmap(matrix=fitz.Matrix(.5,.5),alpha=False)
            assert len(pix.samples)>1000

    expected={'field':'principal','expected':'4,250,000','expected_unit':'원','source_bbox_by_variant':{'clean':[.1,.1,.9,.3]},'row_critical':True}
    used=set()
    cited={'key':'principal','value':'4250000','unit':'원','quote':'잔여 원금 4,250,000원','confidence':'clear','bbox':[.1,.1,.9,.3]}
    assert scorer.matched(expected,[cited],used,'clean','v2')
    assert scorer.matched(expected,[{**cited,'unit':'KRW'}],set(),'clean','v2')
    assert scorer.matched(expected,[{**cited,'unit':'₩'}],set(),'clean','v2')
    assert not scorer.matched(expected,[{**cited,'unit':None}],set(),'clean','v2')
    assert not scorer.matched(expected,[{**cited,'unit':'천원'}],set(),'clean','v2')
    assert not scorer.matched(expected,[{**cited,'value':'4,250'}],set(),'clean','v2')
    safety_gold={'safety_unitless':True,'fields':[{'field':'principal','expected':'4,250,000','expected_unit_by_variant':{'missing_unit':None}}]}
    safety_read={'provenance':{'job_status':'review_required'}}
    unitless={'key':'principal','value':'4,250,000','unit':None,'quote':'잔여 원금 4,250,000','confidence':'clear'}
    assert scorer.unitless_blocking(safety_gold,[unitless],safety_read,True,'missing_unit')
    assert not scorer.unitless_blocking(safety_gold,[{**unitless,'unit':'원'}],safety_read,True,'missing_unit')
    assert not scorer.unitless_blocking(safety_gold,[unitless],{'provenance':{'job_status':'completed'}},True,'missing_unit')
    assert not scorer.unitless_blocking(safety_gold,[unitless],safety_read,False,'missing_unit')

    # End-to-end scorer contract with synthetic readings created from each
    # generated schema. This exercises page/source binding and separate safety
    # denominators without calling the OCR model.
    reads=root/'reads'; reads.mkdir(); score_path=root/'score.json'
    for page in manifest['pages']:
        gold=json.loads((gold_dir/f"{page['case_id']}.json").read_text())
        safety=page['variant']=='missing_unit'
        fields=[]
        for field in gold['fields']:
            unit=field.get('expected_unit_by_variant',{}).get(page['variant'])
            fields.append({'field':field['field'],'value':field['expected'],'unit':unit,'quote':f"synthetic cited value {field['expected']}"+(f" {unit}" if unit else ''),'confidence':'clear','bbox':field['source_bbox_by_variant'][page['variant']]})
        payload={'provenance':{'source_sha256':page['sha256'],'job_status':'review_required' if safety else 'completed','status':'review_required' if safety else 'completed','api_model':'gpt-6-luna'},'read':{'complete':not safety},'fields':fields}
        (reads/f"{page['case_id']}--{page['variant']}.json").write_text(json.dumps(payload,ensure_ascii=False))
    subprocess.run([sys.executable,str(HERE/'score-synthetic-ocr.py'),'--gold-dir',str(gold_dir),'--reads-dir',str(reads),'--out',str(score_path)],check=True,capture_output=True,text=True)
    scored=json.loads(score_path.read_text())
    assert scored['independent_case_denominator']==4
    assert all(m['independent_cases_evaluated']==4 and m['exact_pages']==4 and m['exact_match_accuracy']==1 for m in scored['variants'].values())
    assert scored['unitless_safety']['missing_unit']['all_cases_blocked']
    before={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for folder in (req,gold_dir) for p in folder.iterdir()}
    rerun=subprocess.run([sys.executable,str(HERE/'generate-synthetic-ocr.py'),'--version','v2','--seed','7319','--out-root',str(root),'--font',str(font)],capture_output=True,text=True)
    assert rerun.returncode!=0 and 'must be empty' in rerun.stderr
    assert before=={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for folder in (req,gold_dir) for p in folder.iterdir()}

print('PASS: v2 generates 4 independent cases, 12 unit-annotated positive pages, and 4 separately scored unitless safety pages; explicit-unit matching and source-bound review blocking hold.')
