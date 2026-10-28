import { archiveExport,currentFacts,retractDocument,reviewExport,reviewFact,touchCase,type FactState,type Recognition } from "../../../../lib/domain";
import { assessCase } from "../../../../lib/assessment";
import { CURRENT_RULESET } from "../../../../lib/legal-rules";
import { caseResponse } from "../../../../lib/case-response";
import { jsonResponse } from "../../../../lib/json-response";
import { actor,db,errorResponse,event,getCase,getProcessingReadiness,HttpError,jsonBody,requireSameOrigin,requireUploadedSource,saveCase } from "../../../../lib/server-store";
import { upsertObject,removeObject } from "../../../../lib/object-editor";
import { samplePageRole } from "../../../../lib/sample-manifest";
import { parseContextPatch,parseHouseholdPatch } from "../../../../lib/context-validation";
import { buildRestorePlan,parseRestoreInput } from "../../../../lib/history-integrity-restore";
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Context){try{const {id}=await params,url=new URL(request.url);if(url.searchParams.get("historyIntegrityRestore")==="preview"){
  const input=parseRestoreInput({expectedRevision:Number(url.searchParams.get("expectedRevision")),baselineRevision:Number(url.searchParams.get("baselineRevision")),documentId:url.searchParams.get("documentId"),page:Number(url.searchParams.get("page")),sourceSha256:url.searchParams.get("sourceSha256"),baselineFactsSha256:url.searchParams.get("baselineFactsSha256")}),result=await buildRestorePlan(id,input);
  return jsonResponse({caseId:id,documentId:input.documentId,page:input.page,baselineRevision:input.baselineRevision,currentRevision:input.expectedRevision,sourceSha256:input.sourceSha256,plan:{baselineObjectSha256:result.plan.baselineObjectSha256,baselineFactsSha256:result.plan.baselineFactsSha256,count:result.plan.count,selectedIdsSha256:result.plan.selectedIdsSha256,expectedRevision:result.plan.expectedRevision,activeExportFilesInvalidated:result.plan.activeExportFilesInvalidated,priorReviewsCleared:result.plan.priorReviewsCleared,priorReviewFingerprintsSha256:result.plan.priorReviewFingerprintsSha256},activeFactsChanged:0,humanFactReviewsChanged:0},request,{headers:{"Cache-Control":"no-store"}});
}return jsonResponse(await caseResponse(id),request,{headers:{"Cache-Control":"no-store"}});}catch(e){return errorResponse(e);}}
export async function POST(request:Request,{params}:Context){try{
  requireSameOrigin(request);const {id}=await params,body=await jsonBody(request);if(body?.action!=="restore_historical_proof_metadata")throw new HttpError(400,"지원하지 않는 변경 요청입니다.");
  const input=parseRestoreInput(body.input),result=await buildRestorePlan(id,input),plan={baselineObjectSha256:result.plan.baselineObjectSha256,baselineFactsSha256:result.plan.baselineFactsSha256,count:result.plan.count,selectedIdsSha256:result.plan.selectedIdsSha256,expectedRevision:result.plan.expectedRevision,activeExportFilesInvalidated:result.plan.activeExportFilesInvalidated,priorReviewsCleared:result.plan.priorReviewsCleared,priorReviewFingerprintsSha256:result.plan.priorReviewFingerprintsSha256};
  if(JSON.stringify(body.plan)!==JSON.stringify(plan))throw new HttpError(409,"복구 미리보기 이후 사건이나 기준 기록이 변경되었습니다. 새 미리보기가 필요합니다.");
  if(!result.candidates.length)throw new HttpError(409,"복구할 historical proof metadata가 없습니다.");
  const previous=result.current,next={...previous,context:{...previous.context,revision:previous.context.revision+1},facts:previous.facts.slice(),...(previous.exportManifest?{exportManifest:{...previous.exportManifest,files:previous.exportManifest.files.map(file=>file.status==="current"?{...file,status:"invalidated" as const}:file),reviews:{caseworker:null,lawyer:null}}}:{})};
  for(const baseline of result.candidates){const index=next.facts.findIndex(f=>f.id===baseline.id);if(index<0)throw new HttpError(409,"복구 사실이 저장 직전에 변경되었습니다.");const restored=structuredClone(next.facts[index]);restored.sourceVerification=structuredClone(baseline.sourceVerification!);restored.validation=structuredClone(baseline.validation);next.facts[index]=restored;}
  const who=await actor(),at=new Date().toISOString(),actorKind=who==="private-site-service"?"private-site-service":"human";
  const repairs=next.historyIntegrityRepairs??[];if(repairs.length>=50)throw new HttpError(409,"복구 감사 기록의 제한 수에 도달했습니다.");
  next.historyIntegrityRepairs=[...repairs,{operation:"restore_historical_source_proof_metadata_v1",reason:"Restore historical proof metadata only; no OCR or human review",baselineKey:result.baseline.key,baselineObjectSha256:result.baseline.objectSha256,baselineFactsSha256:result.baseline.factsSha256,documentId:input.documentId,page:input.page,sourceSha256:input.sourceSha256,baselineRevision:input.baselineRevision,beforeRevision:input.expectedRevision,afterRevision:next.context.revision,selectedCount:result.candidates.length,selectedIdsSha256:result.plan.selectedIdsSha256,activeFactsChanged:0,humanFactReviewsChanged:0,activeExportFilesInvalidated:result.plan.activeExportFilesInvalidated,priorReviewsCleared:result.plan.priorReviewsCleared,priorReviewFingerprintsSha256:result.plan.priorReviewFingerprintsSha256,actor:who,actorKind,at}];
  await saveCase(next,input.expectedRevision,previous);return jsonResponse({caseId:id,revision:next.context.revision,restoredCount:result.candidates.length,selectedIdsSha256:result.plan.selectedIdsSha256,activeFactsChanged:0,humanFactReviewsChanged:0,activeExportFilesInvalidated:result.plan.activeExportFilesInvalidated,priorReviewsCleared:result.plan.priorReviewsCleared,priorReviewFingerprintsSha256:result.plan.priorReviewFingerprintsSha256,actorKind},request,{headers:{"Cache-Control":"no-store"}});
}catch(e){return errorResponse(e);}}
export async function PATCH(request:Request,{params}:Context){try{
  requireSameOrigin(request);const {id}=await params,body=await jsonBody(request),previous=await getCase(id),revision=previous.context.revision;
  if(body.revision!==revision)throw new HttpError(409,"사건 버전이 바뀌었습니다. 새로고침 후 다시 확인하세요.");
  let next=previous;
  const jobMutations:D1PreparedStatement[]=[];
  if(body.action==="context"){
    if(typeof body.reason!=="string"||!body.reason.trim())throw new HttpError(400,"계산·법률 판단을 변경한 근거를 기록하세요.");
    next=touchCase(previous);
    try{const parsedContext=parseContextPatch(body.context,previous.context);Object.assign(next.context,parsedContext);if(parsedContext.shortenedTermReview===null)delete next.context.shortenedTermReview;if(body.household)next.household={...next.household,...parseHouseholdPatch(body.household,previous)};}catch(e){throw new HttpError(400,e instanceof Error?e.message:"입력 형식을 확인하세요.");}
    next.context.ruleReleaseId=CURRENT_RULESET.id;
  }else if(body.action==="upsert_object"){
    await requireUploadedSource(previous,body.source);
    next=upsertObject(previous,body.collection,body.item,body.source,String(body.reason||""),await actor());
  }else if(body.action==="delete_object"){
    next=removeObject(previous,body.collection,body.objectId,String(body.reason||""),await actor());
  }else if(body.action==="review_fact"){
    if(body.state&&!(["reported","extracted","verified","disputed","retracted"] as FactState[]).includes(body.state))throw new HttpError(400,"확인 상태가 올바르지 않습니다.");
    if(body.recognition&&!(["unreviewed","accepted","rejected"] as Recognition[]).includes(body.recognition))throw new HttpError(400,"법적 반영 상태가 올바르지 않습니다.");
    if(Object.hasOwn(body,"sourceUnit")&&body.sourceUnit!==null&&(typeof body.sourceUnit!=="string"||body.sourceUnit.length>64))throw new HttpError(400,"원문 단위 형식을 확인하세요.");
    next=reviewFact(previous,body.factId,{state:body.state,recognition:body.recognition,...(body.value!==undefined?{value:body.value}:{}),...(Object.hasOwn(body,"sourceUnit")?{sourceUnit:body.sourceUnit}:{}),actor:await actor(),reason:String(body.reason||"원문 대조 후 확인")});
  }else if(body.action==="retract_document"){
    next=retractDocument(previous,body.documentId);
    for(const doc of next.documents.filter(d=>d.status==="deleted"))jobMutations.push(db().prepare("UPDATE page_jobs SET status = 'withdrawn',lease_until = NULL WHERE document_id = ? AND case_id = ?").bind(doc.id,id));
  }else if(body.action==="set_page_role"){
    next=touchCase(previous);const p=next.pages.find(p=>p.documentId===body.documentId&&p.page===body.page);
    if(!p||!["evidence","filed_form","administrative","unknown"].includes(body.role))throw new HttpError(400,"페이지 역할을 확인하세요.");
    const source=next.documents.find(d=>d.id===p.documentId);
    const immutableRole=samplePageRole(source?.sha256||"",p.page).role;
    if((p.role==="filed_form"||immutableRole==="filed_form")&&body.role!=="filed_form")throw new HttpError(409,"평가 정답으로 분리한 페이지의 역할은 변경할 수 없습니다.");
    p.role=body.role;
    if(p.role!=="evidence")for(const f of currentFacts(next).filter(f=>f.refs.some(r=>r.documentId===p.documentId&&r.page===p.page)))next.facts.push({...f,id:crypto.randomUUID(),version:f.version+1,supersedes:f.id,state:"retracted",recognition:"rejected"});
    jobMutations.push(db().prepare("UPDATE page_jobs SET role = ?,status = CASE WHEN ? = 'evidence' AND image_key IS NOT NULL THEN 'pending' WHEN ? = 'evidence' THEN 'awaiting_upload' ELSE 'held' END,error = NULL,lease_until = NULL WHERE document_id = ? AND page = ? AND case_id = ?").bind(p.role,p.role,p.role,p.documentId,p.page,id));
  }else if(body.action==="review_export"){
    if(previous.exportManifest?.mode!=="final")throw new HttpError(409,"검수 기록을 남기려면 현재 사건 버전의 최종 검토본을 먼저 생성하세요.");
    if(!(await getProcessingReadiness(previous)).complete)throw new HttpError(409,"증빙의 업로드·추출·독립 대조를 먼저 완료하세요.");
    const assessment=assessCase(previous,CURRENT_RULESET);
    if(!assessment.generationGate.canFinalize)throw new HttpError(409,"필수 검토와 계산을 먼저 마쳐야 제출본을 확정할 수 있습니다.");
    if(!["caseworker","lawyer"].includes(body.role))throw new HttpError(400,"검토 역할을 확인하세요.");
    if(typeof body.fingerprint!=="string"||!body.fingerprint)throw new HttpError(400,"화면에서 확인한 생성물 지문이 필요합니다. 최신 생성물을 다시 열어 검토하세요.");
    try{next=reviewExport(previous,body.role,await actor(),body.fingerprint);}
    catch(error){throw new HttpError(409,error instanceof Error?error.message:"생성물 검토 상태가 변경되었습니다.");}
    next.context.revision=previous.context.revision;
  }else if(body.action==="archive_export")next=archiveExport(previous,body.fileId);
  else if(body.action==="review_object"){
    if(!["incomes","debts","assets"].includes(body.collection))throw new HttpError(400,"검토 대상을 확인하세요.");
    next=touchCase(previous);const collection=next[body.collection as "incomes"|"debts"|"assets"];
    const item=collection.find(x=>x.id===body.objectId);if(!item)throw new HttpError(404,"항목을 찾을 수 없습니다.");
    if(!(["unreviewed","accepted","rejected"] as Recognition[]).includes(body.recognition))throw new HttpError(400,"반영 상태를 확인하세요.");
    if(body.collection==="debts")(item as {legalReview:Recognition}).legalReview=body.recognition;else(item as {recognition:Recognition}).recognition=body.recognition;
  }else throw new HttpError(400,"지원하지 않는 변경 요청입니다.");
  await saveCase(next,revision,previous);
  if(jobMutations.length)await db().batch(jobMutations);
  await event(id,body.action,{revision:next.context.revision,factId:body.factId,documentId:body.documentId,reason:body.reason,...(body.action==="context"?{before:{context:previous.context,household:previous.household},after:{context:next.context,household:next.household}}:{})});
  return jsonResponse(await caseResponse(next),request,{headers:{"Cache-Control":"no-store"}});
}catch(e){return errorResponse(e);}}
