import { requireCaseReadAccess } from "../../../../lib/case-read-access.ts";
import { executeLegacyCaseCommand } from "../../../../lib/case-command-store";
import { caseResponse } from "../../../../lib/case-response";
import { jsonResponse } from "../../../../lib/json-response";
import { actor,db,errorResponse,event,getCase,HttpError,jsonBody,requireSameOrigin,saveCase } from "../../../../lib/server-store";
import { buildRestorePlan,parseRestoreInput } from "../../../../lib/history-integrity-restore";
import { prepareReferenceCaseImport,ReferenceImportError,type ReferenceTestDataset } from "../../../../lib/reference-case-import";
type Context={params:Promise<{id:string}>};
async function assertReferenceImportJobsStopped(id:string){
  const active=await db().prepare("SELECT COUNT(*) AS count FROM page_jobs WHERE case_id = ? AND (status = 'processing' OR lease_until IS NOT NULL)").bind(id).first<{count:number}>();
  if((active?.count??0)>0)throw new HttpError(409,"OCR jobs must be terminal and lease-free before importing reference data.");
}
export async function GET(request:Request,{params}:Context){try{const {id}=await params;await requireCaseReadAccess(id);const url=new URL(request.url);if(url.searchParams.get("historyIntegrityRestore")==="preview"){
  const input=parseRestoreInput({expectedRevision:Number(url.searchParams.get("expectedRevision")),baselineRevision:Number(url.searchParams.get("baselineRevision")),documentId:url.searchParams.get("documentId"),page:Number(url.searchParams.get("page")),sourceSha256:url.searchParams.get("sourceSha256"),baselineFactsSha256:url.searchParams.get("baselineFactsSha256")}),result=await buildRestorePlan(id,input);
  return jsonResponse({caseId:id,documentId:input.documentId,page:input.page,baselineRevision:input.baselineRevision,currentRevision:input.expectedRevision,sourceSha256:input.sourceSha256,plan:{baselineObjectSha256:result.plan.baselineObjectSha256,baselineFactsSha256:result.plan.baselineFactsSha256,count:result.plan.count,selectedIdsSha256:result.plan.selectedIdsSha256,expectedRevision:result.plan.expectedRevision,activeExportFilesInvalidated:result.plan.activeExportFilesInvalidated,priorReviewsCleared:result.plan.priorReviewsCleared,priorReviewFingerprintsSha256:result.plan.priorReviewFingerprintsSha256},activeFactsChanged:0,humanFactReviewsChanged:0},request,{headers:{"Cache-Control":"no-store"}});
}return jsonResponse(await caseResponse(id),request,{headers:{"Cache-Control":"no-store"}});}catch(e){return errorResponse(e);}}
export async function POST(request:Request,{params}:Context){try{
  requireSameOrigin(request);const {id}=await params,body=await jsonBody(request);
  if(body?.action==="preview_reference_test_dataset"){
    if(body.targetCaseId!==id)throw new HttpError(400,"Target case ID does not match this route.");
    await assertReferenceImportJobsStopped(id);
    const data=await getCase(id),plan=await prepareReferenceCaseImport({data,targetCaseId:id,expectedRevision:Number(body.expectedRevision),dataset:body.dataset as ReferenceTestDataset,datasetSha256:String(body.datasetSha256??""),importReason:String(body.importReason??""),actor:"preview-only"});
    return jsonResponse({valid:true,noOp:plan.noOp,summary:plan.summary},request,{headers:{"Cache-Control":"no-store"}});
  }
  if(body?.action!=="restore_historical_proof_metadata")throw new HttpError(400,"지원하지 않는 변경 요청입니다.");
  const input=parseRestoreInput(body.input),result=await buildRestorePlan(id,input),plan={baselineObjectSha256:result.plan.baselineObjectSha256,baselineFactsSha256:result.plan.baselineFactsSha256,count:result.plan.count,selectedIdsSha256:result.plan.selectedIdsSha256,expectedRevision:result.plan.expectedRevision,activeExportFilesInvalidated:result.plan.activeExportFilesInvalidated,priorReviewsCleared:result.plan.priorReviewsCleared,priorReviewFingerprintsSha256:result.plan.priorReviewFingerprintsSha256};
  if(JSON.stringify(body.plan)!==JSON.stringify(plan))throw new HttpError(409,"복구 미리보기 이후 사건이나 기준 기록이 변경되었습니다. 새 미리보기가 필요합니다.");
  if(!result.candidates.length)throw new HttpError(409,"복구할 historical proof metadata가 없습니다.");
  const previous=result.current,next={...previous,context:{...previous.context,revision:previous.context.revision+1},facts:previous.facts.slice(),...(previous.exportManifest?{exportManifest:{...previous.exportManifest,files:previous.exportManifest.files.map(file=>file.status==="current"?{...file,status:"invalidated" as const}:file),reviews:{caseworker:null,lawyer:null}}}:{})};
  for(const baseline of result.candidates){const index=next.facts.findIndex(f=>f.id===baseline.id);if(index<0)throw new HttpError(409,"복구 사실이 저장 직전에 변경되었습니다.");const restored=structuredClone(next.facts[index]);restored.sourceVerification=structuredClone(baseline.sourceVerification!);restored.validation=structuredClone(baseline.validation);next.facts[index]=restored;}
  const who=await actor(),at=new Date().toISOString(),actorKind=who==="private-site-service"?"private-site-service":"human";
  const repairs=next.historyIntegrityRepairs??[];if(repairs.length>=50)throw new HttpError(409,"복구 감사 기록의 제한 수에 도달했습니다.");
  next.historyIntegrityRepairs=[...repairs,{operation:"restore_historical_source_proof_metadata_v1",reason:"Restore historical proof metadata only; no OCR or human review",baselineKey:result.baseline.key,baselineObjectSha256:result.baseline.objectSha256,baselineFactsSha256:result.baseline.factsSha256,documentId:input.documentId,page:input.page,sourceSha256:input.sourceSha256,baselineRevision:input.baselineRevision,beforeRevision:input.expectedRevision,afterRevision:next.context.revision,selectedCount:result.candidates.length,selectedIdsSha256:result.plan.selectedIdsSha256,activeFactsChanged:0,humanFactReviewsChanged:0,activeExportFilesInvalidated:result.plan.activeExportFilesInvalidated,priorReviewsCleared:result.plan.priorReviewsCleared,priorReviewFingerprintsSha256:result.plan.priorReviewFingerprintsSha256,actor:who,actorKind,at}];
  await saveCase(next,input.expectedRevision,previous);return jsonResponse({caseId:id,revision:next.context.revision,restoredCount:result.candidates.length,selectedIdsSha256:result.plan.selectedIdsSha256,activeFactsChanged:0,humanFactReviewsChanged:0,activeExportFilesInvalidated:result.plan.activeExportFilesInvalidated,priorReviewsCleared:result.plan.priorReviewsCleared,priorReviewFingerprintsSha256:result.plan.priorReviewFingerprintsSha256,actorKind},request,{headers:{"Cache-Control":"no-store"}});
}catch(e){return errorResponse(e instanceof ReferenceImportError?new HttpError(e.status,e.message):e);}}
export async function PATCH(request:Request,{params}:Context){try{
  requireSameOrigin(request);const {id}=await params,body=await jsonBody(request);
  if(body.action!=="import_reference_test_dataset"){
    const result=await executeLegacyCaseCommand(id,body);
    return jsonResponse(result,request,{status:"pending" in result&&result.pending?202:200,headers:{"Cache-Control":"no-store"}});
  }
  const previous=await getCase(id),revision=previous.context.revision;
  const expectedRevision=body.action==="import_reference_test_dataset"?body.expectedRevision:body.revision;
  if(expectedRevision!==revision)throw new HttpError(409,"사건 버전이 바뀌었습니다. 새로고침 후 다시 확인하세요.");
  if(body.action==="import_reference_test_dataset"){
    if(body.targetCaseId!==id)throw new HttpError(400,"Target case ID does not match this route.");
    await assertReferenceImportJobsStopped(id);
    // Importing synthetic observations is a data operation, not a human source/legal review.
    // The existing owner-private Site authenticates this actor; every imported fact remains unreviewed.
    const importingActor=await actor();
    const plan=await prepareReferenceCaseImport({data:previous,targetCaseId:id,expectedRevision:revision,dataset:body.dataset as ReferenceTestDataset,datasetSha256:String(body.datasetSha256??""),importReason:String(body.importReason??""),actor:importingActor});
    if(!plan.noOp){
      await saveCase(plan.data,revision,previous);
      await event(id,"reference_test.dataset_imported",{revision:plan.data.context.revision,sourceCaseId:plan.data.referenceTest?.sourceCaseId,datasetVersion:plan.data.referenceTest?.datasetVersion,datasetSha256:plan.data.referenceTest?.datasetSha256,importReason:String(body.importReason),actor:importingActor,actorKind:importingActor==="private-site-service"?"private-site-service":"human",humanReviewPerformed:false,fieldCount:(plan.summary.fieldCount as number),retiredFactCount:(plan.summary.retiredFactCount as number),objectCounts:plan.summary.objectCounts});
    }
    return jsonResponse({imported:!plan.noOp,noOp:plan.noOp,summary:plan.summary,...(!plan.noOp?{response:await caseResponse(plan.data)}:{})},request,{headers:{"Cache-Control":"no-store"}});
  }
  throw new HttpError(400,"지원하지 않는 변경 요청입니다.");
}catch(e){return errorResponse(e instanceof ReferenceImportError?new HttpError(e.status,e.message):e);}}
