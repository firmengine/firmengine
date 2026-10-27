#!/usr/bin/env python3
"""Score saved read-fields JSON against private gold; gold is never sent to APIs."""
import argparse, json, re, unicodedata
from pathlib import Path

def norm(value):
    s=unicodedata.normalize('NFKC',str('' if value is None else value)).lower().replace(',','').replace('원','').replace('₩','')
    return re.sub(r'\s+','',s)
ALIASES={
 'gross_pay':('gross','gross_pay','total_pay','gross_salary','gross_amount','payroll_gross','총급여','지급총액','지급합계'),
 'deductions':('deductions','total_deductions','total_deduction','deduction_total','withheld_amount','공제합계','공제총액'),
 'net_pay':('net','net_pay','take_home_pay','actual_pay','net_amount','실수령액','차인지급액'),
 'period':('period','pay_period','payroll_period','salary_period','payment_period','급여기간'),
 'principal':('principal','principal_balance','outstanding_principal','잔여원금','원금잔액'),
 'interest':('interest','accrued_interest','unpaid_interest','미납이자','미수이자'),
 'as_of_date':('as_of_date','balance_date','as_of','잔액기준일','기준일'),
 'surrender_value':('surrender_value','gross_value','refund_value','해약환급금','해지환급금'),
 'premium':('premium','premium_amount','monthly_premium','납입보험료','월보험료'),
 'coverage_amount':('coverage_amount','insured_amount','insurance_amount','가입금액','보장금액','보험금액'),
 'repeat_date':('repeat_date','transaction_date','transaction.date','date','거래일자','거래일'),
 'repeated_transaction_row':('amount','transaction.amount','transaction_amount','withdrawal_amount','deposit_amount','거래금액','출금액','입금액'),
 'transaction_row':('amount','transaction.amount','transaction_amount','withdrawal_amount','deposit_amount','거래금액','출금액','입금액'),
 'subtotal':('subtotal','daily_subtotal','daily_total','transaction_subtotal','day_total','transaction.total','당일승인소계','거래소계','합계'),
}
ROW_OCCURRENCE_FIELDS={'repeated_transaction_row','transaction_row'}
MONEY_FIELDS={'gross_pay','deductions','net_pay','principal','interest','surrender_value','premium','coverage_amount','repeated_transaction_row','transaction_row','subtotal'}
def key_norm(value):
    text=unicodedata.normalize('NFKC',str(value or ''))
    text=re.sub(r'(?<=[a-z0-9])(?=[A-Z])','_',text).lower()
    text=re.sub(r'^(income|asset|debt|transaction|bank_account)\.','',text)
    return re.sub(r'[\s_.-]+','',text)
def candidates(obj):
    out=[]
    def visit(node):
        if isinstance(node,dict):
            name=node.get('field') or node.get('key') or node.get('type') or node.get('label') or ''
            values=[(k,node[k]) for k in ('value','text','normalizedValue','amount','date') if node.get(k) is not None]
            if name and values:
                for _,value in values:
                    if isinstance(value,(str,int,float)):
                        item={'key':str(name),'value':str(value),'bbox':node.get('bbox'),'quote':node.get('quote'),'unit':node.get('unit'),'confidence':node.get('confidence')}
                        if key_norm(name)=='expenses' and re.search('공제',str(node.get('quote') or '')): item['key']='deductions'
                        if key_norm(name) in ('amount','total') and re.match(r'^\s*(당일\s*승인\s*소계|합계|소계|총계)',str(node.get('quote') or '')): item['key']='subtotal'
                        out.append(item)
            for child in node.values(): visit(child)
        elif isinstance(node,list):
            for child in node: visit(child)
    visit(obj)
    # A printed period may be returned as explicit start and end fields. Combine
    # only a unique pair in the same source record; never infer a missing bound.
    for record in (obj.get('read') or {}).get('records',[]):
        fields=record.get('fields') or []
        starts=[f for f in fields if key_norm(f.get('key'))=='periodstart']
        ends=[f for f in fields if key_norm(f.get('key'))=='periodend']
        if len(starts)==len(ends)==1 and all(f.get('confidence')=='clear' and f.get('quote') and f.get('bbox') for f in starts+ends):
            a,b=starts[0],ends[0]; ab,bb=a['bbox'],b['bbox']
            out.append({'key':'period','value':str(a.get('value'))+' ~ '+str(b.get('value')),'bbox':[min(ab[0],bb[0]),min(ab[1],bb[1]),max(ab[2],bb[2]),max(ab[3],bb[3])],'quote':a['quote']+' / '+b['quote'],'unit':None,'confidence':'clear'})
    unique=[]; seen=set()
    for item in out:
        stamp=(key_norm(item['key']),norm(item['value']),json.dumps(item['bbox'],sort_keys=True),item.get('quote'),item.get('unit'),item.get('confidence'))
        if stamp not in seen: seen.add(stamp); unique.append(item)
    return unique
def aliases(field): return {key_norm(field),*(key_norm(v) for v in ALIASES.get(field,()))}
def boxes_overlap(a,b):
    if not isinstance(a,list) or not isinstance(b,list) or len(a)!=4 or len(b)!=4: return False
    return max(a[0],b[0])<min(a[2],b[2]) and max(a[1],b[1])<min(a[3],b[3])
def matched(expected, observed, used_occurrences, variant):
    expected_value=norm(expected['expected']); valid=[]
    for index,actual in enumerate(observed):
        if actual.get('confidence')!='clear' or not actual.get('quote'): continue
        if expected['field'] in MONEY_FIELDS and key_norm(actual.get('unit')) not in ('krw','원','₩'): continue
        if key_norm(actual['key']) not in aliases(expected['field']) or norm(actual['value'])!=expected_value: continue
        if expected['field'] in ROW_OCCURRENCE_FIELDS and index in used_occurrences: continue
        expected_box=expected.get('source_bbox_by_variant',{}).get(variant,expected.get('source_bbox'))
        if expected.get('row_critical') and expected_box and not boxes_overlap(expected_box,actual.get('bbox')): continue
        valid.append((index,actual))
    if not valid: return False
    index,_=valid[0]
    if expected['field'] in ROW_OCCURRENCE_FIELDS: used_occurrences.add(index)
    return True
def main():
    p=argparse.ArgumentParser(); p.add_argument('--gold-dir',type=Path,required=True); p.add_argument('--reads-dir',type=Path,required=True); p.add_argument('--out',type=Path,required=True); a=p.parse_args()
    manifest=json.loads((a.gold_dir/'manifest.json').read_text()); cases={}
    for page in manifest['pages']:
        read_path=a.reads_dir/f"{page['case_id']}--{page['variant']}.json"
        read=json.loads(read_path.read_text()) if read_path.exists() else {}; has_read=read_path.exists()
        source_bound=bool(page.get('sha256')) and read.get('provenance',{}).get('source_sha256')==page['sha256']
        g=json.loads((a.gold_dir/f"{page['case_id']}.json").read_text())
        case=cases.setdefault(page['case_id'],{'family':page['family'],'variant_results':{}})
        scores=[]; observed=candidates(read) if source_bound else []; used_occurrences=set()
        for f in g['fields']:
            hit=matched(f,observed,used_occurrences,page['variant'])
            scores.append({'field':f['field'],'expected':f['expected'],'matched':hit,'critical':f['row_critical']})
        case['variant_results'][page['variant']]={'field_count':len(scores),'correct':sum(x['matched'] for x in scores),'scores':scores,'read_present':has_read,'source_bound':source_bound,'page_correct':all(x['matched'] for x in scores) and bool(scores) and read.get('provenance',{}).get('job_status')=='completed' and read.get('provenance',{}).get('api_model')=='gpt-6-luna' and (read.get('read') or {}).get('complete') is True}
    results={'scorer_version':'source-bound-clear-field-v2','independent_case_denominator':manifest['independent_cases'],'variants':{},'cases':cases}
    for variant in manifest['variants_per_case']:
        included=[c['variant_results'][variant] for c in cases.values() if variant in c['variant_results']]
        n=sum(r['field_count'] for r in included); correct=sum(r['correct'] for r in included)
        critical_n=sum(sum(s['critical'] for s in r['scores']) for r in included); critical_correct=sum(sum(s['critical'] and s['matched'] for s in r['scores']) for r in included)
        results['variants'][variant]={'independent_cases_expected':manifest['independent_cases'],'independent_cases_scored':sum(r['read_present'] for r in included),'independent_cases_evaluated':len(included),'exact_pages':sum(r['page_correct'] for r in included),'page_exact_accuracy':sum(r['page_correct'] for r in included)/manifest['independent_cases'],'fields':n,'correct':correct,'exact_match_accuracy':correct/n if n else None,'critical_fields':critical_n,'critical_correct':critical_correct,'critical_exact_match_accuracy':critical_correct/critical_n if critical_n else None}
    a.out.parent.mkdir(parents=True,exist_ok=True); a.out.write_text(json.dumps(results,ensure_ascii=False,indent=2)); print(json.dumps(results['variants'],ensure_ascii=False))
if __name__=='__main__': main()
