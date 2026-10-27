#!/usr/bin/env python3
"""Offline synthetic OCR v3 policy, geometry, date, and metric tests."""
import datetime
import hashlib
import importlib.util
import json
import math
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('synthetic_score_v3',HERE/'score-synthetic-ocr.py')
scorer=importlib.util.module_from_spec(spec); spec.loader.exec_module(scorer)
font_candidates=[Path(os.environ.get('FIRMENGINE_TEST_FONT','/usr/share/fonts/truetype/nanum/NanumGothic.ttf'))]
font=next((path for path in font_candidates if path.is_file()),None)
if font is None:
    raise SystemExit('Install Nanum Gothic and pass its TTF path to the generator before running this test.')

with tempfile.TemporaryDirectory(prefix='synthetic-ocr-v3-test-') as td:
    root=Path(td); req=root/'request-only'; gold_dir=root/'gold'
    subprocess.run([sys.executable,str(HERE/'generate-synthetic-ocr.py'),'--seed','20261029','--out-root',str(root),'--font',str(font)],check=True,capture_output=True,text=True)
    manifest=json.loads((gold_dir/'manifest.json').read_text())
    assert manifest['version']=='v3' and manifest['seed']==20261029
    assert manifest['independent_cases']==4 and len(manifest['pages'])==12
    assert manifest['positive_variants']==['clean','layout','degraded'] and manifest['safety_variants']==[]
    assert manifest['v3_policy_sha256']==hashlib.sha256(json.dumps(manifest['v3_policy'],ensure_ascii=False,sort_keys=True,separators=(',',':')).encode('utf-8')).hexdigest()
    assert len({page['sha256'] for page in manifest['pages']})==12
    assert len(list(req.glob('*.pdf')))==12 and len(list(gold_dir.glob('*.json')))==5
    for gold_path in gold_dir.glob('*.json'):
        if gold_path.name=='manifest.json': continue
        gold=json.loads(gold_path.read_text())
        assert gold['version']=='v3'
        for field in gold['fields']:
            assert scorer.valid_bbox(field['source_bbox'])
            for bbox in field['source_bbox_by_variant'].values(): assert scorer.valid_bbox(bbox)
        if gold['family']=='debt_balance':
            assert 'overdue_interest' in {field['field'] for field in gold['fields']}
            assert 'interest' not in {field['field'] for field in gold['fields']}
        if gold['family']=='transactions':
            dates=[field for field in gold['fields'] if field['field']=='repeat_date']
            assert len(dates)==3
            assert [field['transaction_row_index'] for field in dates]==[0,1,2]

    # V3 layout boxes cover complete drawn cards; each required row value must
    # have an actual PDF text rectangle overlapping the row's gold rectangle.
    import fitz
    for page_meta in manifest['pages']:
        if page_meta['variant']!='layout': continue
        gold=json.loads((gold_dir/f"{page_meta['case_id']}.json").read_text())
        with fitz.open(req/page_meta['path']) as document:
            page=document[0]; width,height=page.rect.width,page.rect.height
            words=page.get_text('words')
            for field in gold['fields']:
                x0,y0,x1,y1=field['source_bbox_by_variant']['layout']
                source=fitz.Rect(x0*width,y0*height,x1*width,y1*height)
                needle=str(field['expected'])
                hits=[fitz.Rect(word[:4]) for word in words if needle in word[4]]
                # Values may span multiple PDF words, so a line-level search is
                # used as a second route when a single word does not contain it.
                if not hits:
                    hits=[rect for rect in page.search_for(needle) if source.intersects(rect)]
                assert any(source.intersects(hit) for hit in hits), (page_meta['case_id'],field['field'],field.get('row_index'))
                assert source.y0 < source.y1 and source.x0 < source.x1

    # V3 semantic key boundaries are family-specific.
    box=[.1,.1,.9,.4]
    def obs(key,value,record_category=None,record_index=None,bbox=box):
        return {'key':key,'value':value,'unit':'원','quote':'synthetic cited row','confidence':'clear','bbox':bbox,'record_category':record_category,'record_index':record_index}
    def match(field,key,family):
        expected={'field':field,'expected':'12000','expected_unit':'원','source_bbox_by_variant':{'clean':box},'row_critical':True}
        return scorer.matched(expected,[obs(key,'12,000',bbox=box)],set(),'clean','v3',family)
    assert match('overdue_interest','overdue_interest','debt_balance')
    assert not match('overdue_interest','interest','debt_balance')
    assert match('coverage_amount','main_contract_coverage','insurance')
    assert not match('coverage_amount','main_contract_coverage','payroll')
    assert match('subtotal','daily_approval_subtotal','transactions')
    assert not match('subtotal','daily_approval_subtotal','debt_balance')

    # Date precision preserves the source's written calendar day and never
    # converts its date through a timezone offset.
    assert scorer.iso_calendar_date('2025-02-01')==datetime.date(2025,2,1)
    assert scorer.iso_calendar_date('2025-02-01T00:30:00+14:00')==datetime.date(2025,2,1)
    assert scorer.iso_calendar_date('2025-01-31T23:30:00-05:00')==datetime.date(2025,1,31)
    assert scorer.iso_calendar_date('2025-02-30') is None
    assert scorer.iso_calendar_date('2025/02/01') is None

    # Three dates must bind to three distinct transaction-category records.
    date_gold={'field':'repeat_date','expected':'2025-02-01','source_bbox_by_variant':{'clean':box},'row_critical':True}
    row_boxes=[[.08,.12,.31,.20],[.38,.12,.61,.20],[.68,.12,.91,.20]]
    def date_read(dates,categories=None,boxes=None,extra_fields=None):
        categories=categories or ['transaction']*len(dates)
        boxes=boxes or row_boxes[:len(dates)]
        records=[]
        for index,(category,date,bbox) in enumerate(zip(categories,dates,boxes)):
            fields=[{'key':'date','value':date,'unit':None,'quote':'synthetic transaction date','confidence':'clear','bbox':bbox}]
            if extra_fields and index in extra_fields: fields.extend(extra_fields[index])
            records.append({'category':category,'fields':fields})
        return scorer.candidates({'read':{'records':records}},'v3')
    expected_dates=[{**date_gold,'source_bbox_by_variant':{'clean':row_boxes[i]},'transaction_row_index':i} for i in range(3)]
    def all_three(dates,categories=None,boxes=None,extra_fields=None):
        observed=date_read(dates,categories,boxes,extra_fields); used=set()
        return [scorer.matched(field,observed,used,'clean','v3','transactions') for field in expected_dates]
    assert all(all_three(['2025-02-01T01:00:00-04:00','2025-02-01','2025-02-01T23:59:59Z']))
    assert sum(all_three(['2025-02-01','2025-02-01'],['transaction','transaction']))==2
    assert sum(all_three(['2025-02-01','2025-02-01','2025-02-02']))==2
    assert sum(all_three(['2025-02-01','2025-02-01','not-a-date']))==2
    assert sum(all_three(['2025-02-01','2025-02-01','2025-02-01'],['transaction','transaction','summary']))==2
    # A key such as an account ID cannot satisfy a date merely because its
    # value parses as ISO. Conflicting or invalid explicit dates poison that row.
    id_read=scorer.candidates({'read':{'records':[{'category':'transaction','fields':[{'key':'record_id','value':'2025-02-01','quote':'synthetic ID','confidence':'clear','bbox':row_boxes[0]}]}]}},'v3')
    assert not scorer.matched(expected_dates[0],id_read,set(),'clean','v3','transactions')
    assert sum(all_three(['2025-02-01','2025-02-01','2025-02-01'],extra_fields={0:[{'key':'date','value':'2025-02-02','quote':'conflicting synthetic date','confidence':'clear','bbox':row_boxes[0]}]}))==2
    assert sum(all_three(['2025-02-01','2025-02-01','2025-02-01'],extra_fields={0:[{'key':'date','value':'not-a-date','quote':'invalid synthetic date','confidence':'clear','bbox':row_boxes[0]}]}))==2
    # Distinct record indices do not turn duplicate observations at one exact
    # source box/quote into three independent transaction occurrences.
    dup=date_read(['2025-02-01','2025-02-01','2025-02-01'],boxes=[box,box,box])
    assert len(dup)==1
    duplicate_occurrences=set()
    assert sum(scorer.matched(field,dup,duplicate_occurrences,'clean','v3','transactions') for field in expected_dates)<3
    # V1/V2 retain the legacy observation dedup identity, which omitted record
    # category/index metadata.
    legacy={'read':{'records':[{'category':'transaction','fields':[{'key':'date','value':'2025-02-01','quote':'same source observation','confidence':'clear','bbox':box}]},{'category':'transaction','fields':[{'key':'date','value':'2025-02-01','quote':'same source observation','confidence':'clear','bbox':box}]}]}}
    assert len(scorer.candidates(legacy,'v2'))==1
    assert len(scorer.candidates(legacy,'v3'))==1
    boolean_index=[obs('date','2025-02-01',record_category='transaction',record_index=True)]
    assert not scorer.matched(expected_dates[0],boolean_index,set(),'clean','v3','transactions')
    assert not scorer.matched(date_gold,[obs('date','2025-02-01',record_category='transaction',record_index=0,bbox=[float('nan'),0,.5,.5])],set(),'clean','v3','transactions')
    assert not scorer.matched({**date_gold,'source_bbox_by_variant':{'clean':[0,0,0,1]}},[obs('date','2025-02-01',record_category='transaction',record_index=0)],set(),'clean','v3','transactions')

    # Synthetic, source-bound observations exercise field and page-complete
    # metrics separately. No OCR service or model is called.
    reads=root/'reads'; reads.mkdir(); out=root/'score.json'
    for page in manifest['pages']:
        gold=json.loads((gold_dir/f"{page['case_id']}.json").read_text())
        family=gold['family']; records=[]
        if family=='transactions':
            date_fields=[field for field in gold['fields'] if field['field']=='repeat_date']
            amount_fields=[field for field in gold['fields'] if field['field'] in ('repeated_transaction_row','transaction_row')]
            by_row={field['row_index']:field for field in amount_fields}
            for row_index in range(3):
                row_fields=[]
                date_field=next(field for field in date_fields if field['transaction_row_index']==row_index)
                row_fields.append({'key':'date','value':date_field['expected'],'unit':None,'quote':'synthetic date','confidence':'clear','bbox':date_field['source_bbox_by_variant'][page['variant']]})
                amount=by_row[row_index]
                row_fields.append({'key':amount['field'],'value':amount['expected'],'unit':amount.get('expected_unit_by_variant',{}).get(page['variant']),'quote':'synthetic amount','confidence':'clear','bbox':amount['source_bbox_by_variant'][page['variant']]})
                records.append({'category':'transaction','fields':row_fields})
            subtotal=next(field for field in gold['fields'] if field['field']=='subtotal')
            records.append({'category':'summary','fields':[{'key':'daily_approval_subtotal','value':subtotal['expected'],'unit':subtotal.get('expected_unit_by_variant',{}).get(page['variant']),'quote':'synthetic subtotal','confidence':'clear','bbox':subtotal['source_bbox_by_variant'][page['variant']]}]})
        else:
            category={'payroll':'income','debt_balance':'debt','insurance':'asset'}[family]
            for field in gold['fields']:
                unit=field.get('expected_unit_by_variant',{}).get(page['variant'])
                records.append({'category':category,'fields':[{'key':field['field'],'value':field['expected'],'unit':unit,'quote':'synthetic source field','confidence':'clear','bbox':field['source_bbox_by_variant'][page['variant']]}]})
        status='review_required' if page['variant']=='clean' and page['case_id'].startswith('payroll-') else 'completed'
        payload={'read':{'complete':True,'records':records},'provenance':{'source_sha256':page['sha256'],'job_status':status,'status':status,'api_model':'gpt-6-luna'}}
        (reads/f"{page['case_id']}--{page['variant']}.json").write_text(json.dumps(payload,ensure_ascii=False))
    subprocess.run([sys.executable,str(HERE/'score-synthetic-ocr.py'),'--gold-dir',str(gold_dir),'--reads-dir',str(reads),'--out',str(out)],check=True,capture_output=True,text=True)
    scored=json.loads(out.read_text())
    assert scored['scorer_version']=='source-bound-clear-field-v4'
    assert scored['independent_case_denominator']==4
    assert scored['v3_policy_sha256']==manifest['v3_policy_sha256']
    assert all(metric['field_match_accuracy']==1 and metric['field_count']>0 for metric in scored['variants'].values())
    assert all(metric['page_complete_accuracy']==1 for metric in scored['variants'].values()) is False
    assert scored['variants']['clean']['page_complete_accuracy']==.75
    assert 'document_accuracy' not in json.dumps(scored)

# V3 requires finite, positive, normalized source boxes.
for invalid in ([0,0,0,1],[0,0,1,1.1],[0,0,math.nan,1],[.5,.5,.4,.6],[0,0,math.inf,1],None):
    assert not scorer.valid_bbox(invalid)
assert scorer.valid_bbox([0,0,1,1])
print('PASS: v3 source geometry, debt semantics, family-bounded aliases, three-row date coverage, strict boxes, and separate field/page-complete metrics.')
