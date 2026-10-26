"""Local CRUD API for persistent case evidence, assertions and court outputs."""
from __future__ import annotations
import asyncio
from datetime import date
import hashlib
import json
from pathlib import Path
import secrets
import uuid
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, Response
from . import ai, config
from .case_engine import FLAT_FEATURES
from .repository import RevisionConflict, encode, utcnow
from .runtime import CaseRuntime, load_rule, public

router = APIRouter()
_runtime = None

def service():
    global _runtime
    if _runtime is None or _runtime.root != config.RUNTIME.resolve():
        _runtime = CaseRuntime()
    return _runtime

def case(cid):
    try:
        return service().get(cid)
    except KeyError:
        raise HTTPException(404, '사건을 찾을 수 없습니다.') from None

def guard(snapshot, body):
    if body.get('expected_revision', snapshot['revision']) != snapshot['revision']:
        raise RevisionConflict('최신 사건을 다시 불러온 뒤 수정하세요.')


def invalidate_rule_release(snapshot, reason):
    current=snapshot.get('rule_release')
    if current and current.get('status')=='APPROVED':
        history=snapshot.setdefault('rule_release_history',[])
        if not any(row['id']==current['id'] for row in history):
            history.append(json.loads(encode(current)))
        pending=load_rule('release.json')
        pending['review_invalidation']={'previous_release_id':current['id'],'reason':reason,'at':utcnow()}
        snapshot.update(rule_release=pending,rule_release_id=pending['id'])

def update_assertion(snapshot, body, aid=None):
    guard(snapshot, body)
    if aid:
        item = next((a for a in snapshot['assertions'] if a['id'] == aid), None)
        if not item:
            raise HTTPException(404, '현재 사실 후보를 찾을 수 없습니다.')
    else:
        item = {'id': uuid.uuid4().hex, 'record_id': uuid.uuid4().hex, 'state': 'REPORTED', 'precision': 'UNKNOWN', 'accepted_for_filing': False, 'normalized': False, 'evidence_refs': []}
        snapshot['assertions'].append(item)
    allowed = ('object_id','feature_key','value','unit','currency','state','precision','valid_at','period_start','period_end','measurement_period','evidence_refs','accepted_for_filing','normalized','valuation_date','basis_id')
    if 'normalized' in body and not isinstance(body['normalized'],bool):
        raise ValueError('금액 정규화 확인은 명시적인 참·거짓 값이어야 합니다.')
    if 'accepted_for_filing' in body and not isinstance(body['accepted_for_filing'],bool):
        raise ValueError('제출 채택은 명시적인 참·거짓 값이어야 합니다.')
    if body.get('valuation_date'):
        if not isinstance(body['valuation_date'],str):
            raise ValueError('평가 기준일은 YYYY-MM-DD 형식이어야 합니다.')
        date.fromisoformat(body['valuation_date'])
    if 'basis_id' in body and (not isinstance(body['basis_id'],str) or len(body['basis_id'])>1000):
        raise ValueError('평가 근거 ID는 1000자 이하 문자열이어야 합니다.')
    changed_fact=aid and any(k in body and item.get(k)!=body[k] for k in allowed if k not in ('state','accepted_for_filing'))
    if changed_fact:
        item['state']=body.get('state','REPORTED')
        item['accepted_for_filing']=body.get('accepted_for_filing',False)
        item['normalized']=body.get('normalized',False)
    elif body.get('state') and body['state']!='VERIFIED' and 'accepted_for_filing' not in body:
        item['accepted_for_filing']=False
    item.update({k: body[k] for k in allowed if k in body})
    item['object_id'] = item.get('object_id') or 'person-primary'
    if not item.get('feature_key') or len(encode(item.get('value'))) > 30000:
        raise ValueError('피처와 값 길이를 확인하세요.')
    if item['state'] not in ('REPORTED','EXTRACTED','VERIFIED','DISPUTED','RETRACTED'):
        raise ValueError('확인 상태를 확인하세요.')
    if item['state'] == 'RETRACTED':
        item['accepted_for_filing'] = False
    for ref in item['evidence_refs']:
        doc = next((d for d in snapshot['documents'] if d['id'] == ref.get('document_id')), None)
        if not doc or ref.get('page') not in doc['evidence_pages']:
            raise ValueError('현재 의뢰인 증빙 페이지에 연결된 근거만 사용할 수 있습니다.')
    if item['state'] == 'VERIFIED' and item.get('value') in (None, ''):
        raise ValueError('값이 없는 사실을 검증 완료로 표시할 수 없습니다.')
    if item['accepted_for_filing'] and item['state'] != 'VERIFIED':
        raise ValueError('검증된 사실만 제출에 채택할 수 있습니다.')
    if not str(body.get('reason', '')).strip():
        raise ValueError('추가·수정 사유가 필요합니다.')
    item.update(human_edited=True, reason=body['reason'])
    return item

@router.get('/api/health')
async def health():
    import httpx
    ready = False
    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            ready = (await client.get(config.N8N_URL + '/healthz/readiness')).status_code == 200
    except httpx.HTTPError:
        pass
    return {'model':config.MODEL,'api_key_configured':bool(config.API_KEY),'n8n_url':config.N8N_URL,'n8n_ready':ready,'storage':'persistent','database':'sqlite','queue':'durable_outbox'}

@router.get('/api/catalog')
async def catalog():
    features = load_rule('feature_catalog.json')['features'] + load_rule('extensions.json')['features']
    features += [{'key':FLAT_FEATURES.get(k,'form.'+k),'label':v,'type':'text'} for k,v in config.LABELS.items()]
    types = ai.extraction_catalog()[1]
    return {'features':features,'document_types':[{'id':key,'label':label} for key,label in sorted(types.items())],
            'rule_sources':load_rule('source_registry.json')['sources'],'rule_release':load_rule('release.json')}

@router.get('/api/cases')
async def list_cases():
    return {'cases':service().repo.list_cases()}

@router.post('/api/cases')
async def create(body:dict):
    if body.get('application_date'):
        date.fromisoformat(body['application_date'])
    return public(service().repo.create_case(body.get('name',''),body.get('income_type','business'),body.get('court_id','seoul'),body.get('application_date')))

@router.get('/api/cases/{cid}')
@router.get('/api/sessions/{cid}')
async def get_case(cid):
    snapshot=case(cid)
    for item in snapshot.get('artifact_history',[]):
        item['version_url']=f'/api/cases/{cid}/artifact-versions/{item["id"]}/download'
    return public(snapshot)

@router.patch('/api/cases/{cid}')
async def edit_case(cid,body:dict):
    snapshot=case(cid)
    guard(snapshot,body)
    if any(key in body and body[key]!=snapshot.get(key) for key in ('court_id','application_date')):
        invalidate_rule_release(snapshot,'관할 또는 신청일 변경')
    for key in ('name','income_type','court_id','application_date','evidence_periods','package_decisions','package_reviews','package_signatures','court_attachments'):
        if key in body:
            snapshot[key]=body[key]
    if not str(snapshot['name']).strip() or snapshot['income_type'] not in ('business','wage','salary','mixed','unknown'):
        raise ValueError('사건명과 소득 유형을 확인하세요.')
    if snapshot['income_type']=='salary':
        snapshot['income_type']='wage'
    if snapshot.get('application_date'):
        date.fromisoformat(snapshot['application_date'])
    return public(service().change(snapshot,'case.updated',body))

@router.delete('/api/cases/{cid}')
@router.delete('/api/sessions/{cid}')
async def delete_case(cid):
    case(cid)
    service().repo.delete_case(cid)
    return {'ok':True,'message':'사건을 삭제했습니다. 저장소 원본은 보관 정책에 따라 별도로 정리합니다.'}

@router.post('/api/sessions/{cid}/heartbeat')
async def heartbeat(cid):
    case(cid)
    return {'ok':True,'persistent':True}

async def add_files(snapshot,request):
    form=await request.form(max_files=20,max_part_size=100*1024*1024)
    try:
        uploads=form.getlist('files')+form.getlist('files[]')
        if not uploads:
            raise ValueError('서류를 선택하세요.')
        selection=str(form.get('evidence_pages',''))
        if selection and len(uploads)!=1:
            raise ValueError('페이지 지정은 단일 파일에서 사용하세요.')
        expected=form.get('expected_revision')
        if expected and int(expected)!=snapshot['revision']:
            raise RevisionConflict('사건이 변경되었습니다.')
        for file in uploads:
            if not hasattr(file,'read'):
                raise ValueError('올바른 파일을 선택하세요.')
            content=await file.read(100*1024*1024+1)
            await asyncio.to_thread(service().add_document,snapshot,file.filename,content,selection)
    finally:
        await form.close()
    return snapshot

@router.post('/api/cases/{cid}/documents')
async def upload_documents(cid,request:Request):
    snapshot=await add_files(case(cid),request)
    return public(service().change(snapshot,'documents.uploaded'))

@router.post('/api/sessions')
async def compatibility_upload(request:Request):
    snapshot=service().repo.create_case('업로드 사건')
    try:
        await add_files(snapshot,request)
        return public(service().change(snapshot,'documents.uploaded',enqueue=False))
    except BaseException:
        service().repo.delete_case(snapshot['id'])
        raise

@router.post('/api/sessions/sample')
async def sample():
    from .sample import evidence_bundle
    content,manifest,source_name=await asyncio.to_thread(evidence_bundle)
    snapshot=service().repo.create_case('독립평가 · 개인사업자 샘플')
    doc=service().add_document(snapshot,'client_evidence.pdf',content)
    pages=list(manifest['evidence_pages'])
    doc.update(evidence_pages=pages,excluded_pages=sorted(manifest['holdout_pages']+manifest['administrative_excluded_pages']),original_total_pages=manifest['total_pages'],_selected=True,_frozen_evidence_partition=True,_page_map={p:i+1 for i,p in enumerate(pages)})
    snapshot['sample_split']={'source_name':source_name,'source_sha256':manifest['source_sha256'],'evidence_pages':len(pages),'holdout_pages':len(manifest['holdout_pages']),'administrative_pages':len(manifest['administrative_excluded_pages']),'physical_evidence_only':True}
    service().knowledge.register_case_bundle(snapshot['id'],manifest['source_sha256'])
    return public(service().change(snapshot,'sample.evidence_loaded',enqueue=False))

@router.patch('/api/cases/{cid}/documents/{did}')
async def map_document(cid,did,body:dict):
    snapshot=case(cid)
    guard(snapshot,body)
    doc=next((d for d in snapshot['documents'] if d['id']==did),None)
    if not doc:
        raise HTTPException(404,'서류를 찾을 수 없습니다.')
    for key in ('document_type','name','subject_id','period_start','period_end'):
        if key in body:
            doc[key]=body[key]
    doc['mapping_status']='VERIFIED' if doc.get('document_type') else 'UNMAPPED'
    # A document-type edit cannot stand in for evidence/target page classification.
    if doc.get('processing_status') == 'extracted':
        doc['processing_status']='classified'
    return public(service().change(snapshot,'document.mapping_changed',body))

@router.delete('/api/cases/{cid}/documents/{did}')
async def delete_document(cid,did,body:dict|None=None):
    snapshot=case(cid)
    guard(snapshot,body or {})
    doc=next((d for d in snapshot['documents'] if d['id']==did),None)
    if not doc:
        raise HTTPException(404,'서류를 찾을 수 없습니다.')
    doc['deleted_at']=utcnow()
    for row in snapshot['assertions']:
        if any(ref.get('document_id')==did for ref in row.get('evidence_refs',[])):
            row.update(state='RETRACTED',accepted_for_filing=False,human_edited=True,reason='연결 원본 삭제')
    for row in snapshot['records']:
        if any(ref.get('document_id')==did for ref in row.get('sources',[])):
            row.update(state='excluded',human_edited=True)
    service().change(snapshot,'document.deleted',body)
    return public(case(cid))

@router.get('/api/cases/{cid}/documents/{did}/download')
async def download_original(cid,did):
    doc=next((d for d in case(cid)['documents'] if d['id']==did),None)
    if not doc:
        raise HTTPException(404,'서류를 찾을 수 없습니다.')
    if doc.get('source_parent_id'):
        import fitz
        with fitz.open(doc['_path']) as source, fitz.open() as output:
            for page in doc['evidence_pages']:
                physical = doc.get('_page_map', {}).get(page, page)
                output.insert_pdf(source, from_page=physical-1, to_page=physical-1)
            data = output.tobytes()
        return Response(data, media_type='application/pdf', headers={'Content-Disposition': 'attachment; filename="document-unit.pdf"'})
    return FileResponse(service().storage.local_path(doc['storage']),filename=doc['name'])

@router.get('/api/cases/{cid}/pages/{did}/{page}')
@router.get('/api/sessions/{cid}/pages/{did}/{page}')
async def preview(cid,did,page:int):
    doc=next((d for d in case(cid)['documents'] if d['id']==did),None)
    if not doc or page not in doc['evidence_pages']:
        raise HTTPException(404,'의뢰인 증빙으로 지정된 페이지에서만 확인할 수 있습니다.')
    return Response(await asyncio.to_thread(ai.page_image,doc['_path'],doc.get('_page_map',{}).get(page,page),1500),media_type='image/jpeg')

@router.post('/api/cases/{cid}/assertions')
async def add_assertion(cid,body:dict):
    snapshot=case(cid)
    update_assertion(snapshot,body)
    return public(service().change(snapshot,'assertion.added',body))

@router.patch('/api/cases/{cid}/assertions/{aid}')
async def edit_assertion(cid,aid,body:dict):
    snapshot=case(cid)
    update_assertion(snapshot,body,aid)
    return public(service().change(snapshot,'assertion.updated',body))

@router.delete('/api/cases/{cid}/assertions/{aid}')
async def retract_assertion(cid,aid,body:dict|None=None):
    return await edit_assertion(cid,aid,{**(body or {}),'state':'RETRACTED','accepted_for_filing':False,'reason':(body or {}).get('reason','담당자가 철회함')})

@router.get('/api/cases/{cid}/assertions/{aid}/history')
async def assertion_history(cid,aid):
    item=next((a for a in case(cid)['assertions'] if a['id']==aid),None)
    if not item:
        raise HTTPException(404,'현재 사실 후보를 찾을 수 없습니다.')
    return {'history':public(service().repo.assertion_history(cid,item['record_id']))}

@router.patch('/api/sessions/{cid}/records/{rid}')
async def edit_record(cid,rid,body:dict):
    snapshot=case(cid)
    guard(snapshot,body)
    record=next((r for r in snapshot['records'] if r['id']==rid),None)
    if not record:
        raise HTTPException(404,'항목을 찾을 수 없습니다.')
    if not body.get('reason'):
        raise ValueError('수정 사유를 입력하세요.')
    record.update(value=body.get('value'),state='excluded' if body.get('excluded') else 'confirmed' if body.get('confirmed',True) else 'unreviewed',human_edited=True,review_reason=body['reason'],reviewed_at=utcnow())
    service().sync_assertions(snapshot)
    return public(service().change(snapshot,'record.updated',body))

@router.post('/api/cases/{cid}/objects')
async def add_object(cid,body:dict):
    snapshot=case(cid)
    guard(snapshot,body)
    if not body.get('type') or not body.get('label'):
        raise ValueError('대상 유형과 이름이 필요합니다.')
    snapshot['objects'].append({'id':uuid.uuid4().hex,'type':body['type'],'label':body['label'],'metadata':body.get('metadata',{})})
    return public(service().change(snapshot,'object.added',body))

@router.patch('/api/cases/{cid}/objects/{oid}')
async def edit_object(cid,oid,body:dict):
    snapshot=case(cid)
    guard(snapshot,body)
    obj=next((o for o in snapshot['objects'] if o['id']==oid),None)
    if not obj:
        raise HTTPException(404,'대상을 찾을 수 없습니다.')
    obj.update({k:body[k] for k in ('type','label','metadata') if k in body})
    return public(service().change(snapshot,'object.updated',body))

@router.post('/api/cases/{cid}/assets/{oid}/valuation')
async def value_asset(cid,oid,body:dict):
    from .valuation import evaluate_valuation
    snapshot=case(cid)
    guard(snapshot,body)
    if not any(o['id']==oid for o in snapshot['objects']):
        raise HTTPException(404,'재산을 찾을 수 없습니다.')
    parameters=body.get('parameters',{})
    if not isinstance(parameters,dict):
        raise ValueError('평가 입력은 객체 형식이어야 합니다.')
    if parameters.get('document_id') and not any(d['id']==parameters['document_id'] for d in snapshot['documents']):
        raise ValueError('같은 사건의 평가 증빙을 선택하세요.')
    result=await asyncio.to_thread(evaluate_valuation,body.get('provider','manual_evidence'),parameters)
    guard(case(cid),{'expected_revision':snapshot['revision']})
    service().repo.save_valuation(cid,oid,result)
    service().change(snapshot,'asset.valuation_received',body)
    return public(case(cid))

@router.post('/api/cases/{cid}/assets/{oid}/disposition')
async def disposition(cid,oid,body:dict):
    from .engine import number
    snapshot=case(cid)
    if not any(o['id']==oid for o in snapshot['objects']):
        raise HTTPException(404,'재산을 찾을 수 없습니다.')
    amounts={k:number(body.get(k)) for k in ('sale_amount','payoff','costs')}
    if any(v is None or v<0 for v in amounts.values()):
        raise ValueError('매각대금·상환·비용을 음수가 아닌 숫자로 입력하세요.')
    cash=amounts['sale_amount']-amounts['payoff']-amounts['costs']
    result={'object_id':oid,'sale_amount':str(amounts['sale_amount']),'payoff':str(amounts['payoff']),'costs':str(amounts['costs']),'successor_cash':str(cash),'status':'PROPOSED','summary':f'매각대금 - 담보상환 - 비용 = 잔여 현금 {cash}원. 귀속·청산가치 영향은 별도 검토합니다.','changes_actual_case':False,'requires_review':True}
    service().repo.save_scenario(cid,'asset_disposition',body,result)
    service().repo.notify(cid,'strategy','재산 처분 가정 검토',result['summary'],dedup_key='scenario:'+cid+':'+oid)
    return public(case(cid))

@router.post('/api/cases/{cid}/assess')
@router.post('/api/cases/{cid}/run')
@router.post('/api/sessions/{cid}/run')
async def run_case(cid):
    case(cid)
    return public(service().queue(cid,'assess'))

@router.post('/api/cases/{cid}/generate')
@router.post('/api/sessions/{cid}/generate')
async def generate_case(cid):
    case(cid)
    return public(service().queue(cid,'generate'))

@router.get('/api/cases/{cid}/forms/{kind}')
async def form_fields(cid,kind):
    from .rendering import _render_session,_value
    snapshot=case(cid)
    catalog=json.loads((config.ROOT/'templates/catalog.json').read_text(encoding='utf-8'))
    form=next((f for f in catalog['forms'] if f['kind']==kind),None)
    if not form:
        raise HTTPException(404,'지원하지 않는 서식입니다.')
    rendered=_render_session(snapshot)
    fields=[]
    for key in form.get('record_keys',[]):
        feature=FLAT_FEATURES.get(key,'form.'+key)
        rows=[a for a in snapshot['assertions'] if a.get('feature_key')==feature and a.get('state')!='RETRACTED']
        for a in rows or [None]:
            fields.append({'key':key,'feature_key':feature,'object_id':a.get('object_id') if a else None,'label':config.LABELS.get(key,key),'value':a.get('value') if a else _value(rendered,key),'sources':a.get('evidence_refs',[]) if a else [],'derived':False,'editable':True})
    for key in form.get('calculation_keys',[]):
        fields.append({'key':key,'feature_key':key,'label':key,'value':_value(rendered,key),'derived':True,'editable':False})
    return {'kind':kind,'title':form['title'],'fields':fields,'rows':[],'revision':snapshot['revision']}

@router.patch('/api/cases/{cid}/forms/{kind}')
async def edit_form(cid,kind,body:dict):
    metadata=await form_fields(cid,kind)
    snapshot=case(cid)
    guard(snapshot,body)
    for change in body.get('fields',[]):
        field=next((f for f in metadata['fields'] if f['key']==change.get('key') and f.get('object_id')==change.get('object_id')),None)
        if not field or field['derived']:
            raise ValueError('계산 항목은 원본 사실을 수정한 후 재계산하세요.')
        current=next((a for a in snapshot['assertions'] if a['feature_key']==field['feature_key'] and a.get('object_id')==(field.get('object_id') or 'person-primary')),None)
        update_assertion(snapshot,{'feature_key':field['feature_key'],'object_id':field.get('object_id'),'value':change.get('value'),'state':'REPORTED','accepted_for_filing':False,'reason':change.get('reason','서류 필드 수정')},current['id'] if current else None)
    return public(service().change(snapshot,'form.fields_changed',body))

@router.get('/api/cases/{cid}/artifacts/{name}')
@router.get('/api/sessions/{cid}/artifacts/{name}')
async def artifact(cid,name):
    item=next((a for a in case(cid)['artifacts'] if a['name']==name),None)
    if not item or Path(name).name!=name:
        raise HTTPException(404,'현재 생성본이 없습니다. 이력을 확인하세요.')
    return FileResponse(service().storage.local_path(item['storage']),filename=name)

@router.delete('/api/cases/{cid}/artifacts/{name}')
async def archive(cid,name,body:dict|None=None):
    snapshot=case(cid)
    guard(snapshot,body or {})
    if not any(a['name']==name for a in snapshot['artifacts']):
        raise HTTPException(404,'현재 생성본을 찾을 수 없습니다.')
    service().repo.archive_artifact(cid,name,expected_revision=snapshot['revision'])
    return public(case(cid))


@router.get('/api/cases/{cid}/artifact-versions/{aid}/download')
async def download_artifact_version(cid,aid):
    item=next((row for row in case(cid).get('artifact_history',[]) if row['id']==aid),None)
    if not item:
        raise HTTPException(404,'이 사건의 보관된 생성본을 찾을 수 없습니다.')
    try:
        await asyncio.to_thread(service().storage.read,item['storage'])
        path=service().storage.local_path(item['storage'])
    except FileNotFoundError:
        raise HTTPException(404,'보관된 생성본 파일을 찾을 수 없습니다.') from None
    return FileResponse(path,filename=item['name'])

@router.post('/api/cases/{cid}/review')
@router.post('/api/sessions/{cid}/review')
async def review(cid,body:dict):
    snapshot=case(cid)
    guard(snapshot,body)
    role,actor=body.get('role'),str(body.get('name','')).strip()
    if role not in ('caseworker','lawyer') or len(actor)<2:
        raise ValueError('확인 역할과 확인자 이름이 필요합니다.')
    if 'template_approved' in body and not isinstance(body['template_approved'],bool):
        raise ValueError('법원 양식 확인은 명시적인 참·거짓 값이어야 합니다.')
    if not snapshot['artifacts'] or not snapshot.get('generation_gate',{}).get('can_generate'):
        raise HTTPException(409,'현재 버전의 법원 서류가 먼저 생성되어야 합니다.')
    hashes={a['id']:a['sha256'] for a in snapshot['artifacts']}
    previous=snapshot['reviews'].get('caseworker')
    if role=='lawyer' and (not previous or previous.get('revision')!=snapshot['revision'] or previous.get('artifact_hashes')!=hashes):
        raise HTTPException(409,'현재 생성본을 담당자가 확인한 후 변호사가 최종 확인하세요.')
    if role=='lawyer' and not (snapshot.get('template_approved') or body.get('template_approved')):
        raise HTTPException(409,'법원 양식 적합성을 먼저 확인하세요.')
    if body.get('template_approved'):
        snapshot['template_approved']=True
    for item in snapshot['artifacts']:
        service().storage.read(item['storage'])
    data={'name':actor,'at':utcnow(),'revision':snapshot['revision'],'artifact_hashes':hashes}
    snapshot['reviews'][role]=data
    snapshot['status']='reviewed' if role=='lawyer' else 'ready'
    service().repo.save(snapshot,'review.accepted',semantic=False,expected_revision=snapshot['revision'],actor=actor,payload={'role':role})
    return public(case(cid))

@router.get('/api/knowledge/status')
async def knowledge_status():
    return await asyncio.to_thread(service().knowledge.status)


def release_review_candidate(snapshot):
    release=load_rule('release.json')
    required_sources=['K01','K04','K20','K21']
    application=snapshot.get('application_date')
    sources=service().knowledge.reviewable_sources(required_sources,application,snapshot['id']) if application else []
    missing=sorted(set(required_sources)-{row['source_id'] for row in sources})
    reasons=[]
    if not application:
        reasons.append('신청 예정일이 필요합니다.')
    if snapshot.get('court_id') not in ('seoul','KR-SEOUL'):
        reasons.append('이 계산 규칙의 검토 범위는 서울회생법원입니다.')
    if application and application[:4]!='2026':
        reasons.append('현재 구현된 생계비 계산기는 2026년도 기준입니다.')
    if missing:
        reasons.append('적용일이 확인된 공식 원문 버전이 없습니다: '+', '.join(missing))
    return {'release':release,'current_release':snapshot.get('rule_release'),
            'required_rule_ids':release['implemented_numeric_rules'],'required_source_ids':required_sources,
            'source_versions':sources,'missing_sources':missing,'can_review':not reasons,
            'readiness_reasons':reasons,'revision':snapshot['revision'],'application_date':application,
            'review_scope':'구현된 7개 수치 규칙에 대한 사건별 확인입니다. 전체 인가·면책 판단을 승인하지 않습니다.',
            'reviewer_identity_mode':'local_demo_self_declared',
            'reviewer_notice':'로컬 시제품의 확인자 이름은 본인 입력입니다. 조직 로그인·권한 확인은 아직 연결되지 않았습니다.',
            'source_notice':'공식 원문과 생계비 공고의 첨부자료를 열어 계산식·기준금액·적용일·예외를 확인하세요.'}


@router.get('/api/cases/{cid}/rule-release/review')
async def get_rule_release_review(cid):
    return release_review_candidate(case(cid))


@router.post('/api/cases/{cid}/rule-release/review')
async def review_rule_release(cid,body:dict):
    snapshot=case(cid)
    if 'expected_revision' not in body:
        raise ValueError('검토한 사건 버전을 명시하세요.')
    guard(snapshot,body)
    reviewer=body.get('reviewer')
    note=body.get('review_note')
    if not isinstance(reviewer,str) or len(reviewer.strip())<2 or len(reviewer)>200:
        raise ValueError('검토자 이름을 명시하세요.')
    if not isinstance(note,str) or len(note.strip())<5 or len(note)>5000:
        raise ValueError('원문·계산식·적용 범위를 확인한 검토 메모를 남기세요.')
    candidate=release_review_candidate(snapshot)
    if not candidate['can_review']:
        raise HTTPException(409,' '.join(candidate['readiness_reasons']))
    rules=body.get('reviewed_rule_ids')
    if (not isinstance(rules,list) or any(not isinstance(row,str) for row in rules)
            or len(rules)!=len(candidate['required_rule_ids']) or set(rules)!=set(candidate['required_rule_ids'])):
        raise ValueError('구현된 7개 규칙을 각각 검토했음을 명시하세요.')
    supplied=body.get('source_versions')
    if not isinstance(supplied,list) or any(not isinstance(row,dict) for row in supplied):
        raise ValueError('검토한 공식 원문 버전과 해시를 명시하세요.')
    keys=('source_id','version_id','content_hash')
    actual=[{key:row.get(key) for key in keys} for row in supplied]
    expected=[{key:row[key] for key in keys} for row in candidate['source_versions']]
    if sorted(encode(row) for row in actual)!=sorted(encode(row) for row in expected):
        raise RevisionConflict('공식 원문 버전이 변경되었거나 해시가 다릅니다. 검토 화면을 다시 여세요.')
    release=dict(candidate['release'])
    review={'reviewer':reviewer.strip(),'review_note':note.strip(),'reviewed_at':utcnow(),
            'reviewed_rule_ids':list(candidate['required_rule_ids']),'source_versions':expected,
            'case_id':cid,'case_revision':snapshot['revision'],'application_date':snapshot['application_date'],
            'identity_mode':'local_demo_self_declared','scope':candidate['review_scope']}
    release.update(id=release['id']+'-case-'+hashlib.sha256(encode(review).encode()).hexdigest()[:16],
        calculator_release_id=candidate['release']['id'],status='APPROVED',review=review,
        source_versions=candidate['source_versions'],effective_from=max(row['valid_from'] for row in candidate['source_versions']),
        effective_to='2026-12-31',parameters={p['rule_id']:p for p in service().knowledge.active_parameters(snapshot['application_date'])})
    snapshot.update(rule_release=release,rule_release_id=release['id'])
    snapshot.setdefault('rule_release_history',[]).append(json.loads(encode(release)))
    return public(service().change(snapshot,'rule_release.reviewed',body))

@router.get('/api/knowledge/search')
async def knowledge_search(q:str,as_of:str|None=None,case_id:str|None=None):
    if case_id:
        snapshot=case(case_id)
        as_of=as_of or snapshot.get('application_date')
    if as_of:
        date.fromisoformat(as_of)
    return {'results':await asyncio.to_thread(service().knowledge.search,q[:2000],as_of=as_of,case_id=case_id,limit=3)}

async def check_knowledge():
    result=await asyncio.to_thread(service().knowledge.check_updates)
    changed=[row for row in result.get('sources',result.get('results',[])) if row.get('status')=='version_added']
    if changed:
        for item in service().repo.list_cases():
            service().repo.notify(item['id'],'law_watch','법령·준칙 갱신 확인','공식 원문 변경과 적용일을 확인했습니다. 검증된 매개변수만 자동 적용하며 새 해석은 검토가 필요합니다.',dedup_key='law-watch:'+date.today().isoformat()+':'+item['id'],data=public(result))
            snapshot=case(item['id'])
            invalidate_rule_release(snapshot,'공식 지식원 새 버전 수집')
            service().change(snapshot,'knowledge.release_changed',{'reason':'공식 지식원 새 버전 수집'})
    return public(result)

@router.post('/api/knowledge/check')
async def knowledge_check():
    return await check_knowledge()

@router.post('/internal/knowledge/check')
async def scheduled_knowledge_check(body:dict):
    from .main import internal_token
    if not secrets.compare_digest(body.get('token',''),internal_token()):
        raise HTTPException(403,'내부 실행 토큰이 필요합니다.')
    return await check_knowledge()

@router.post('/internal/stages/{stage}')
async def internal_stage(stage,body:dict):
    if stage not in ('classify','extract','prepare','validate','generate','complete'):
        raise HTTPException(404,'지원하지 않는 처리 단계입니다.')
    try:
        return await service().stage(stage,body)
    except PermissionError as exc:
        raise HTTPException(403,str(exc)) from None
