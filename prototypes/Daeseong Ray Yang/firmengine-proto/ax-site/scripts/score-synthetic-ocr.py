#!/usr/bin/env python3
"""Score saved read-fields JSON against private gold; gold is never sent to APIs."""
import argparse, datetime, hashlib, json, math, re, unicodedata
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
 'overdue_interest':('overdue_interest','overdue_interest_amount','past_due_interest','연체이자'),
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
MONEY_FIELDS={'gross_pay','deductions','net_pay','principal','interest','overdue_interest','surrender_value','premium','coverage_amount','repeated_transaction_row','transaction_row','subtotal'}
def key_norm(value):
    text=unicodedata.normalize('NFKC',str(value or ''))
    text=re.sub(r'(?<=[a-z0-9])(?=[A-Z])','_',text).lower()
    text=re.sub(r'^(income|asset|debt|transaction|bank_account)\.','',text)
    return re.sub(r'[\s_.-]+','',text)
def candidates(obj,version='v1'):
    out=[]
    def visit(node, record_category=None, record_index=None):
        if isinstance(node,dict):
            record_category=node.get('record_category',node.get('category',record_category))
            record_index=node.get('record_index',record_index)
            name=node.get('field') or node.get('key') or node.get('type') or node.get('label') or ''
            values=[(k,node[k]) for k in ('value','text','normalizedValue','amount','date') if node.get(k) is not None]
            if name and values:
                for _,value in values:
                    if isinstance(value,(str,int,float)):
                        item={'key':str(name),'value':str(value),'bbox':node.get('bbox'),'quote':node.get('quote'),'unit':node.get('unit'),'confidence':node.get('confidence'),'record_category':record_category,'record_index':record_index}
                        if key_norm(name)=='expenses' and re.search('공제',str(node.get('quote') or '')): item['key']='deductions'
                        if key_norm(name) in ('amount','total') and re.match(r'^\s*(당일\s*승인\s*소계|합계|소계|총계)',str(node.get('quote') or '')): item['key']='subtotal'
                        out.append(item)
            for key,child in node.items():
                if key=='records' and isinstance(child,list):
                    for index,record in enumerate(child):
                        category=record.get('category') if isinstance(record,dict) else None
                        visit(record,category,index)
                else: visit(child,record_category,record_index)
        elif isinstance(node,list):
            for child in node: visit(child,record_category,record_index)
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
        # V1/V2 preserve their original dedup contract. V3 carries category
        # boundaries but intentionally excludes record_index: duplicated
        # content at one source location is not multiple source occurrences.
        stamp=(key_norm(item['key']),norm(item['value']),json.dumps(item['bbox'],sort_keys=True),item.get('quote'),item.get('unit'),item.get('confidence'))
        if version=='v3': stamp=(*stamp,item.get('record_category'))
        if stamp not in seen: seen.add(stamp); unique.append(item)
    return unique
def aliases(field,family=None,version='v1'):
    values=set(ALIASES.get(field,()))
    if version=='v3':
        if field=='coverage_amount' and family=='insurance': values.add('main_contract_coverage')
        if field=='subtotal' and family=='transactions': values.add('daily_approval_subtotal')
    return {key_norm(field),*(key_norm(v) for v in values)}
def boxes_overlap(a,b):
    if not isinstance(a,list) or not isinstance(b,list) or len(a)!=4 or len(b)!=4: return False
    return max(a[0],b[0])<min(a[2],b[2]) and max(a[1],b[1])<min(a[3],b[3])
def valid_bbox(box):
    return isinstance(box,list) and len(box)==4 and all(isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v) and 0<=v<=1 for v in box) and box[0]<box[2] and box[1]<box[3]
def iso_calendar_date(value):
    if not isinstance(value,str): return None
    value=value.strip()
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}(?:[Tt ].+)?',value): return None
    try:
        if len(value)==10: return datetime.date.fromisoformat(value)
        stamp=value.replace('Z','+00:00').replace('z','+00:00')
        parsed=datetime.datetime.fromisoformat(stamp)
        return parsed.date()  # preserve the source's written calendar date; never shift by offset.
    except (ValueError,OverflowError): return None
def normalized_unit(value):
    unit=key_norm(value)
    return {'원':'krw','krw':'krw','₩':'krw'}.get(unit,unit)
def matched(expected, observed, used_occurrences, variant, version='v1',family=None):
    expected_value=norm(expected['expected']); valid=[]
    field_aliases=aliases(expected['field'],family,version)
    invalid_date_records=set(); conflicting_date_records=set()
    if version=='v3' and expected['field']=='repeat_date':
        dates_by_record={}
        for item in observed:
            record_index=item.get('record_index')
            if key_norm(item.get('record_category'))!='transaction' or not isinstance(record_index,int) or isinstance(record_index,bool): continue
            if key_norm(item.get('key')) not in field_aliases: continue
            parsed=iso_calendar_date(item.get('value'))
            if parsed is None: invalid_date_records.add(record_index)
            else: dates_by_record.setdefault(record_index,set()).add(parsed)
        conflicting_date_records={record_index for record_index,dates in dates_by_record.items() if len(dates)>1}
    for index,actual in enumerate(observed):
        if actual.get('confidence')!='clear' or not actual.get('quote'): continue
        expected_box=expected.get('source_bbox_by_variant',{}).get(variant,expected.get('source_bbox'))
        if version=='v3':
            if not valid_bbox(expected_box) or not valid_bbox(actual.get('bbox')): continue
            if expected.get('row_critical') and not boxes_overlap(expected_box,actual.get('bbox')): continue
        if version=='v3' and expected['field']=='repeat_date':
            record_index=actual.get('record_index')
            if key_norm(actual.get('record_category'))!='transaction' or not isinstance(record_index,int) or isinstance(record_index,bool): continue
            if key_norm(actual.get('key')) not in field_aliases: continue
            if record_index in invalid_date_records or record_index in conflicting_date_records: continue
            calendar_date=iso_calendar_date(actual.get('value'))
            expected_date=iso_calendar_date(expected.get('expected'))
            occurrence=('repeat_date',record_index)
            if calendar_date is None or expected_date is None or calendar_date!=expected_date or occurrence in used_occurrences: continue
            valid.append((index,actual,occurrence))
            continue
        if expected['field'] in MONEY_FIELDS:
            actual_unit=normalized_unit(actual.get('unit'))
            if version=='v2':
                expected_unit=normalized_unit(expected.get('expected_unit'))
                if not expected_unit or actual_unit!=expected_unit: continue
            elif version=='v3':
                expected_unit=normalized_unit(expected.get('expected_unit'))
                if not expected_unit or actual_unit!=expected_unit: continue
            elif actual_unit not in ('krw','원','₩'): continue
        if key_norm(actual['key']) not in field_aliases or norm(actual['value'])!=expected_value: continue
        if expected['field'] in ROW_OCCURRENCE_FIELDS and index in used_occurrences: continue
        if expected.get('row_critical') and expected_box and not boxes_overlap(expected_box,actual.get('bbox')): continue
        valid.append((index,actual,None))
    if not valid: return False
    index,_,occurrence=valid[0]
    if occurrence is not None: used_occurrences.add(occurrence); return True
    if expected['field'] in ROW_OCCURRENCE_FIELDS: used_occurrences.add(index)
    return True
def unitless_blocking(gold, observed, read, source_bound, variant,version='v1',family=None):
    """Separate safety metric for an explicitly unitless source variant."""
    if not source_bound: return False
    for expected in gold.get('fields',[]):
        if expected['field'] not in MONEY_FIELDS: continue
        if expected.get('expected_unit_by_variant',{}).get(variant,'not-declared') is not None: return False
        value=norm(expected['expected']); keyset=aliases(expected['field'],family,version)
        matches=[actual for actual in observed if key_norm(actual['key']) in keyset and norm(actual['value'])==value and actual.get('confidence')=='clear' and actual.get('quote')]
        if not matches or any(actual.get('unit') is not None and str(actual.get('unit')).strip() for actual in matches): return False
    provenance=read.get('provenance',{})
    return provenance.get('job_status')=='review_required' or provenance.get('status')=='review_required'
def main():
    p=argparse.ArgumentParser(); p.add_argument('--gold-dir',type=Path,required=True); p.add_argument('--reads-dir',type=Path,required=True); p.add_argument('--out',type=Path,required=True); a=p.parse_args()
    manifest=json.loads((a.gold_dir/'manifest.json').read_text()); cases={}; version=manifest.get('version','v1')
    if version=='v3':
        policy=manifest.get('v3_policy')
        policy_hash=hashlib.sha256(json.dumps(policy,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode('utf-8')).hexdigest() if isinstance(policy,dict) else None
        if not policy_hash or policy_hash!=manifest.get('v3_policy_sha256'):
            raise SystemExit('v3 policy hash is missing or invalid')
    for page in manifest['pages']:
        read_path=a.reads_dir/f"{page['case_id']}--{page['variant']}.json"
        read=json.loads(read_path.read_text()) if read_path.exists() else {}; has_read=read_path.exists()
        source_bound=bool(page.get('sha256')) and read.get('provenance',{}).get('source_sha256')==page['sha256']
        g=json.loads((a.gold_dir/f"{page['case_id']}.json").read_text())
        if version=='v3':
            for field in g.get('fields',[]):
                boxes=[field.get('source_bbox'),*(field.get('source_bbox_by_variant') or {}).values()]
                if any(not valid_bbox(box) for box in boxes):
                    raise SystemExit(f"invalid v3 gold bbox in {page['case_id']}")
        case=cases.setdefault(page['case_id'],{'family':page['family'],'variant_results':{}})
        scores=[]; observed=candidates(read,version) if source_bound else []; used_occurrences=set()
        for f in g['fields']:
            variant_expected={**f,'expected_unit':f.get('expected_unit_by_variant',{}).get(page['variant'],f.get('expected_unit'))}
            hit=matched(variant_expected,observed,used_occurrences,page['variant'],version,g.get('family'))
            scores.append({'field':f['field'],'expected':f['expected'],'matched':hit,'critical':f['row_critical']})
        positive=page['variant'] in manifest.get('positive_variants',manifest['variants_per_case'])
        safety_pass=unitless_blocking(g,observed,read,source_bound,page['variant'],version,g.get('family')) if page['variant'] in manifest.get('safety_variants',[]) else None
        page_complete=positive and all(x['matched'] for x in scores) and bool(scores) and read.get('provenance',{}).get('job_status')=='completed' and read.get('provenance',{}).get('api_model')=='gpt-6-luna' and (read.get('read') or {}).get('complete') is True
        case['variant_results'][page['variant']]={'field_count':len(scores),'correct':sum(x['matched'] for x in scores),'scores':scores,'read_present':has_read,'source_bound':source_bound,'page_correct':page_complete,'page_complete':page_complete,'job_completed':read.get('provenance',{}).get('job_status')=='completed','read_complete':(read.get('read') or {}).get('complete') is True,'unitless_safety_pass':safety_pass}
    results={'scorer_version':'source-bound-clear-field-v4' if version=='v3' else ('source-bound-clear-field-v3' if version=='v2' else 'source-bound-clear-field-v2'),'independent_case_denominator':manifest['independent_cases'],'variants':{},'cases':cases}
    for variant in manifest.get('positive_variants',manifest['variants_per_case']):
        included=[c['variant_results'][variant] for c in cases.values() if variant in c['variant_results']]
        n=sum(r['field_count'] for r in included); correct=sum(r['correct'] for r in included)
        critical_n=sum(sum(s['critical'] for s in r['scores']) for r in included); critical_correct=sum(sum(s['critical'] and s['matched'] for s in r['scores']) for r in included)
        if version=='v3':
            complete_pages=sum(r['page_complete'] for r in included)
            results['variants'][variant]={'independent_cases_expected':manifest['independent_cases'],'independent_cases_scored':sum(r['read_present'] for r in included),'independent_cases_evaluated':len(included),'page_complete_count':complete_pages,'page_complete_accuracy':complete_pages/manifest['independent_cases'],'field_count':n,'field_correct':correct,'field_match_accuracy':correct/n if n else None,'critical_fields':critical_n,'critical_correct':critical_correct,'critical_field_match_accuracy':critical_correct/critical_n if critical_n else None}
        else:
            results['variants'][variant]={'independent_cases_expected':manifest['independent_cases'],'independent_cases_scored':sum(r['read_present'] for r in included),'independent_cases_evaluated':len(included),'exact_pages':sum(r['page_correct'] for r in included),'page_exact_accuracy':sum(r['page_correct'] for r in included)/manifest['independent_cases'],'fields':n,'correct':correct,'exact_match_accuracy':correct/n if n else None,'critical_fields':critical_n,'critical_correct':critical_correct,'critical_exact_match_accuracy':critical_correct/critical_n if critical_n else None}
    if manifest.get('safety_variants'):
        results['unitless_safety']={}
        for variant in manifest['safety_variants']:
            included=[c['variant_results'][variant] for c in cases.values() if variant in c['variant_results']]
            results['unitless_safety'][variant]={'independent_cases_expected':manifest['independent_cases'],'independent_cases_evaluated':len(included),'blocked_as_review_required':sum(r['unitless_safety_pass'] is True for r in included),'all_cases_blocked':len(included)==manifest['independent_cases'] and all(r['unitless_safety_pass'] is True for r in included)}
    if version=='v3': results['v3_policy_sha256']=manifest['v3_policy_sha256']
    a.out.parent.mkdir(parents=True,exist_ok=True); a.out.write_text(json.dumps(results,ensure_ascii=False,indent=2)); print(json.dumps(results['variants'],ensure_ascii=False))
if __name__=='__main__': main()
