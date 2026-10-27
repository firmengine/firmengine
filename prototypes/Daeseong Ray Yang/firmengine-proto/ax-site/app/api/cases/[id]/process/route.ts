import { caseProgress } from "../../../../../lib/case-response";
import { inspectClassificationJob } from "../../../../../lib/classification-inspection";
import { jsonResponse } from "../../../../../lib/json-response";
import { inspectStoredPageJob,reprojectCasePage } from "../../../../../lib/page-job-inspection";
import { PAGE_PROJECTION_VERSION,ReprojectionError,reprojectStoredPage } from "../../../../../lib/reprojection";
import { actor,db,errorResponse,event,HttpError,jsonBody,now,requireSameOrigin,saveCase } from "../../../../../lib/server-store";
import { processNext,reconcileCase,retryFailed,retryPage,reverifyPage,reviewLegal } from "../../../../../lib/pipeline";
const failure=(error:unknown)=>errorResponse(error instanceof ReprojectionError?new HttpError(error.status,error.message):error);
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{
  const {id}=await params,url=new URL(request.url),jobId=url.searchParams.get("jobId"),view=url.searchParams.get("view");
  if(view!==null&&view!=="classification")throw new HttpError(400,"지원하지 않는 페이지 관측 보기입니다.");
  if(view==="classification"&&!jobId)throw new HttpError(400,"분류 관측에는 페이지 작업 ID가 필요합니다.");
  const result=view==="classification"?await inspectClassificationJob(id,jobId!):jobId?await inspectStoredPageJob(id,jobId):await caseProgress(id,{stage:"status"});
  return jsonResponse(result,request,{headers:{"Cache-Control":"no-store"}});
}catch(e){return failure(e);}}
async function reprojectPage(id:string,jobId:string){
  const staged=await reprojectCasePage(id,jobId);
  if(staged.alreadyApplied)return {stage:"reprojected",alreadyApplied:true,projectionVersion:PAGE_PROJECTION_VERSION,revision:staged.data.context.revision};
  if(staged.saved.projectionClaim)throw new HttpError(409,"같은 페이지의 재투영이 이미 진행 중이거나 중단되었습니다. 중복 적용을 막기 위해 보류합니다.");
  const claimToken=crypto.randomUUID(),claim={...staged.saved,projectionClaim:{token:claimToken,startedAt:now()}},claimJson=JSON.stringify(claim);
  const claimed=await db().prepare("UPDATE page_jobs SET result = ?,updated_at = ? WHERE id = ? AND case_id = ? AND status = ? AND stage = 'completed' AND lease_until IS NULL AND cache_key = ? AND result = ? AND role = 'evidence'").bind(claimJson,now(),staged.job.id,id,staged.job.status,staged.job.cacheKey,staged.rawResult).run();
  if(!claimed.meta.changes)throw new HttpError(409,"페이지 판독 결과가 바뀌었습니다. 새로고침 후 다시 확인하세요.");
  let caseSaved=false;
  try{
    const projection=reprojectStoredPage(staged.data,staged.prepared);
    await saveCase(projection.data,staged.data.context.revision,staged.data);caseSaved=true;
    const appliedAt=now(),final={...claim,projection:{version:PAGE_PROJECTION_VERSION,appliedAt,caseRevision:projection.data.context.revision,sourceSha256:staged.provenance.documentSha256,cacheKey:staged.job.cacheKey}};Reflect.deleteProperty(final,"projectionClaim");
    const finalized=await db().prepare("UPDATE page_jobs SET result = ?,updated_at = ? WHERE id = ? AND case_id = ? AND result = ? AND status = ? AND stage = 'completed' AND lease_until IS NULL").bind(JSON.stringify(final),appliedAt,staged.job.id,id,claimJson,staged.job.status).run();
    if(!finalized.meta.changes)throw new HttpError(409,"계산 상태는 저장되었으나 재투영 영수증 갱신이 경합했습니다. 중복 재실행은 차단했습니다.");
    await event(id,"page.reprojected",{jobId:staged.job.id,documentId:staged.job.documentId,page:staged.job.page,projectionVersion:PAGE_PROJECTION_VERSION,sourceSha256:staged.provenance.documentSha256,historicalModel:staged.provenance.model,historicalPromptVersion:staged.provenance.promptVersion,verificationPasses:staged.provenance.verificationPasses,historicalReceiptCounter:staged.provenance.storedReceiptCount,retainedValidatedReceipts:projection.retainedReceipts,newReceiptsCreated:0,revision:projection.data.context.revision,actor:await actor()});
    return {stage:"reprojected",alreadyApplied:false,projectionVersion:PAGE_PROJECTION_VERSION,revision:projection.data.context.revision,retainedReceipts:projection.retainedReceipts,newReceiptsCreated:0,historicalProvenance:staged.provenance};
  }catch(error){
    if(!caseSaved)try{await db().prepare("UPDATE page_jobs SET result = ?,updated_at = ? WHERE id = ? AND case_id = ? AND result = ? AND status = ? AND stage = 'completed'").bind(staged.rawResult,now(),staged.job.id,id,claimJson,staged.job.status).run();}catch{/* Keep the durable claim if rollback cannot be confirmed. */}
    throw error;
  }
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
  requireSameOrigin(request);const {id}=await params,body=await jsonBody(request);let result;
  if(body.action==="next")result=await processNext(id);else if(body.action==="reconcile")result=await reconcileCase(id);else if(body.action==="legal")result=await reviewLegal(id);else if(body.action==="retry")result=await retryFailed(id);else if(body.action==="retry_page"){if(typeof body.jobId!=="string"||!body.jobId)throw new HttpError(400,"재판독할 페이지가 필요합니다.");result=await retryPage(id,body.jobId);}else if(body.action==="refresh_page"){if(typeof body.jobId!=="string"||!body.jobId)throw new HttpError(400,"새로 판독할 페이지가 필요합니다.");result=await retryPage(id,body.jobId,"refresh");}else if(body.action==="reverify_page"){if(typeof body.jobId!=="string"||!body.jobId)throw new HttpError(400,"재검증할 페이지가 필요합니다.");result=await reverifyPage(id,body.jobId);}else if(body.action==="reproject_page"){if(typeof body.jobId!=="string"||!body.jobId)throw new HttpError(400,"재투영할 페이지 작업 ID가 필요합니다.");result=await reprojectPage(id,body.jobId);}else throw new HttpError(400,"처리 단계를 확인하세요.");
  const progress=await caseProgress(id,result);
  return jsonResponse(body.action==="reproject_page"?{...progress,...result}:progress,request,{headers:{"Cache-Control":"no-store"}});
}catch(e){return failure(e);}}
