import { requireAppRole } from "../../../../../lib/app-roles.ts";
import { EXECUTION_CONTRACT_VERSION } from "../../../../../lib/execution-catalog.ts";
import { referenceIdentity } from "../../../../../lib/reference-runtime.ts";
import referenceRelease from "../../../../../lib/reference-release.json" with { type: "json" };
import { caseStateFingerprint, db, errorResponse, getCase, HttpError, jsonBody, now, requireSameOrigin } from "../../../../../lib/server-store.ts";

interface RecomputeJob {id:string;caseId:string;jobKind:string;inputFingerprint:string;contractFingerprint:string;status:string;leaseToken:string|null;leaseUntil:string|null;attempts:number;resultRef:string|null}
interface ResultRef {revision:number;storageToken:string;evaluationId:string;inputSha256:string}
function parseResultRef(raw:string|null):ResultRef|undefined{
  try{const value=JSON.parse(raw??"null");if(value&&Number.isSafeInteger(value.revision)&&typeof value.storageToken==="string"&&typeof value.evaluationId==="string"&&typeof value.inputSha256==="string")return value as ResultRef;}catch{}
  return undefined;
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    requireSameOrigin(request);
    const {id:caseId}=await params,who=await requireAppRole("case_editor",caseId),body=await jsonBody(request);
    if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some(key=>!['jobId','expectedFingerprint','cause'].includes(key)))throw new HttpError(400,"요청 항목을 확인하세요.");
    if(typeof body.jobId!=="string"||!/^[-a-zA-Z0-9_]{1,128}$/.test(body.jobId)||typeof body.expectedFingerprint!=="string"||body.expectedFingerprint.length>160||typeof body.cause!=="string"||!body.cause.trim()||body.cause.trim().length>500)throw new HttpError(400,"재시도 대상·최신 지문·사유를 확인하세요.");
    const data=await getCase(caseId),fingerprint=await caseStateFingerprint(data);
    if(body.expectedFingerprint!==fingerprint)throw new HttpError(409,"사건 내용이 변경되었습니다. 최신 상태를 불러오세요.");
    const [job,storedCase]=await Promise.all([
      db().prepare("SELECT id,case_id AS caseId,job_kind AS jobKind,input_fingerprint AS inputFingerprint,contract_fingerprint AS contractFingerprint,status,lease_token AS leaseToken,lease_until AS leaseUntil,attempts,result_ref AS resultRef FROM case_recompute_jobs WHERE id=? AND case_id=?").bind(body.jobId,caseId).first<RecomputeJob>(),
      db().prepare("SELECT revision,storage_token AS storageToken FROM cases WHERE id=?").bind(caseId).first<{revision:number;storageToken:string}>(),
    ]);
    if(!job||!storedCase)throw new HttpError(404,"재시도 작업을 찾을 수 없습니다.");
    const currentContract=`${EXECUTION_CONTRACT_VERSION}:${referenceIdentity()?.sha256??referenceRelease.sha256}`;
    const resultRef=parseResultRef(job.resultRef),at=now();
    if(job.jobKind!=="deterministic_evaluation"||!['failed','retry_wait'].includes(job.status)||job.inputFingerprint!==fingerprint||job.contractFingerprint!==currentContract||!resultRef||resultRef.revision!==data.context.revision||resultRef.storageToken!==storedCase.storageToken||storedCase.revision!==data.context.revision)throw new HttpError(409,"이 작업은 현재 사건 상태에서 다시 시도할 수 없습니다.");
    if(job.leaseToken&&job.leaseUntil&&job.leaseUntil>at)throw new HttpError(409,"작업이 현재 처리 중입니다. 잠시 후 다시 확인하세요.");
    const changed=await db().batch([
      db().prepare(`UPDATE case_recompute_jobs SET status='pending',attempts=0,last_error=NULL,next_attempt_at=NULL,lease_token=NULL,lease_until=NULL,updated_at=?
        WHERE id=? AND case_id=? AND job_kind='deterministic_evaluation' AND status IN ('failed','retry_wait')
        AND input_fingerprint=? AND contract_fingerprint=? AND (lease_token IS NULL OR lease_until IS NULL OR lease_until<=?)
        AND EXISTS (SELECT 1 FROM cases WHERE id=? AND revision=? AND storage_token=?)`)
        .bind(at,job.id,caseId,fingerprint,currentContract,at,caseId,data.context.revision,storedCase.storageToken),
      db().prepare(`INSERT INTO events (id,case_id,actor,type,detail,at)
        SELECT ?,?,?,?,?,? WHERE changes()=1`)
        .bind(crypto.randomUUID(),caseId,who,"case.recompute.retry_requested",JSON.stringify({jobId:job.id,inputFingerprint:fingerprint,priorStatus:job.status,cause:body.cause.trim().slice(0,500)}),at),
    ]);
    if(!changed[0].meta.changes)throw new HttpError(409,"작업이나 사건 상태가 변경되었습니다. 다시 불러오세요.");
    return Response.json({jobId:job.id,status:"pending",attempts:0,drainStatus:"queued"},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return errorResponse(error);}
}
