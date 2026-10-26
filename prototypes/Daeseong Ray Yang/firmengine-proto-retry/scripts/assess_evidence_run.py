"""Import evidence-only candidates, attempt normal generation, render diagnostics.

Never reads evaluation PDF or frozen truth. A diagnostic is not a workflow success.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from app import store
from app.assessment import assess
from app.documents import generate_package


def write(path,value):
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2,default=str),encoding='utf-8')


def consensus(facts,key,types=None,logical=None):
    values=[]
    for fact in facts:
        if fact.get('key')!=key:
            continue
        if types and (logical or {}).get(fact.get('page'),{}).get('document_type') not in types:
            continue
        value=fact.get('value')
        if value not in (None,'') and value not in values:
            values.append(value)
    return values[0] if len(values)==1 else ''


async def run(args):
    run_dir=(ROOT/'.local'/'evaluation'/'runs'/args.run_id).resolve()
    if not run_dir.is_relative_to((ROOT/'.local'/'evaluation'/'runs').resolve()):
        raise ValueError('Invalid run id')
    extracted=json.loads((run_dir/'extraction.json').read_text(encoding='utf-8'))
    generation=json.loads((run_dir/'generation-manifest.json').read_text(encoding='utf-8'))
    manifest=json.loads((ROOT/'.local'/'sample'/'split'/'evidence-manifest.json').read_text(encoding='utf-8'))
    pdf=Path(manifest['path'])
    if manifest['role']!='evidence' or hashlib.sha256(pdf.read_bytes()).hexdigest()!=generation['input_sha256']:
        raise ValueError('Generation evidence isolation check failed')
    if any(page['role']!='evidence' for page in manifest['pages']):
        raise ValueError('Non-evidence page cannot be imported')
    store.initialize()
    facts=extracted['facts']
    logical={p.get('original_page',p.get('page')):p for p in extracted.get('logical_documents',[])}
    source_id=extracted['document_id']
    for row in facts:
        row['status']='candidate'
        row['document_id']=source_id
    fields=dict(title='[실제 샘플] 증빙 전용 독립평가 · '+args.run_id,
                applicant_name=consensus(facts,'applicant_name'),address=consensus(facts,'address',{'identity','family'},logical),
                birth_date=consensus(facts,'birth_date',{'identity'},logical),
                # Filing date, court, recognition and plan parameters are not copied
                # from the submitted evaluation answers or substituted with today/36/0.
                court='',filing_date='',period_start='',period_end='',repayment_months=None,living_cost=None,deductions=None,
                income_type='unknown',tax_type=consensus(facts,'tax_type'),assets_declared=False,
                rule_approved=False,template_approved=False,is_demo=False,
                statement=consensus(facts,'statement'),debt_cause=consensus(facts,'debt_cause'),facts=facts,
                source_bundle_sha256=extracted['source_bundle_sha256'],evaluation_run_id=args.run_id,
                _cache_case_ids=[generation.get('case_id','sample-evidence-only-'+args.run_id)])
    for collection in ('incomes','creditors','assets','transactions'):
        fields[collection]=extracted.get('entities',{}).get(collection,[])
    imported=run_dir/'imported-case.json'
    if imported.exists():
        prior_id=json.loads(imported.read_text(encoding='utf-8'))['id']
        key=store.get_case(prior_id)['documents'][0]['object_key']
    else:
        # Runs may share the same provenance document ID, but storage ownership
        # must be separate so deleting one case cannot remove another's source.
        key='originals/'+store.uid()+'.pdf'
    target=store.OBJECTS/key
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(pdf,target)
    fields['documents']=[dict(id=source_id,name='sample · 의뢰인 증빙만.pdf',role='evidence',document_type='mixed',pages=manifest['pages'],
                             page_count=manifest['page_count'],sha256=manifest['sha256'],object_key=key,status='needs_review',
                             logical_documents=extracted.get('logical_documents',[]),warnings=extracted.get('warnings',[]),
                             namespace='originals',storage_provider='local',created_at=store.now())]
    if imported.exists():
        identifier=json.loads(imported.read_text(encoding='utf-8'))['id']
        case=store.get_case(identifier)
    else:
        case=store.create_case(fields)
        write(imported,case)
        store.record_calls(case['id'],'independent-evidence-run:'+args.run_id,extracted.get('calls',[]))
    assessment=await assess(case)
    store.save_assessment(case['id'],case['revision'],assessment)
    write(run_dir/'assessment.json',assessment)
    normal=dict(case_id=case['id'],case_revision=case['revision'],generation_attempted=True,
                result='allowed' if assessment['can_generate'] else 'blocked',blocker_count=len(assessment['blockers']),
                input_role='evidence-only',evaluation_answers_read=False)
    if assessment['can_generate']:
        output=store.OBJECTS/'generated'/store.uid()
        output.mkdir(parents=True)
        generated=generate_package(case,assessment,output)
        store.add_artifacts(case['id'],case['revision'],generated)
        normal['artifact_count']=len(generated)
    else:
        normal['artifact_count']=0
    write(run_dir/'normal-generation-result.json',normal)
    diagnostic=dict(case,diagnostic_mode=True)
    output=run_dir/'diagnostic'
    output.mkdir(exist_ok=True)
    artifacts=generate_package(diagnostic,assessment,output)
    write(run_dir/'diagnostic-artifacts.json',artifacts)
    code_paths=[ROOT/'app'/'documents.py',ROOT/'app'/'assessment.py',Path(__file__)]
    write(run_dir/'render-manifest.json',dict(case_id=case['id'],case_revision=case['revision'],diagnostic=True,
                normal_workflow_result=normal['result'],truth_access=False,evidence_sha256=manifest['sha256'],
                code={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in code_paths},created_at=store.now()))
    summary=dict(run_id=args.run_id,case_id=case['id'],normal_workflow_result=normal['result'],normal_artifacts=normal['artifact_count'],
                 diagnostic_artifacts=len(artifacts),blockers=len(assessment['blockers']),candidate_facts=len(facts),
                 entities={key:len(fields[key]) for key in ('incomes','creditors','assets','transactions')},
                 diagnostic_is_not_generation_success=True,evaluation_answers_available=False)
    write(run_dir/'generation-summary.json',summary)
    print(json.dumps(summary,ensure_ascii=True,indent=2))


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--run-id',default='retry-001')
    asyncio.run(run(parser.parse_args()))
