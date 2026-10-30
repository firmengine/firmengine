import { currentReferenceSnapshot, referenceIdentity } from "./reference-runtime.ts";
import {assertNonSourceCaseChange,REVIEW_ONLY_COMMANDS,type NonSourceMutationCategory} from "./case-mutation-classifier.ts";
import { resolveReferenceApplicationForCase } from "./reference-application.ts";
import referenceRelease from "./reference-release.json" with { type: "json" };
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { AI_MODEL, type CaseData } from "./domain";
import { RISK_CATALOG } from "./legal-rules";
import { inspectProcessingReadiness,type StoredDocumentState,type StoredPageState } from "./processing-readiness";
import { EXECUTION_CONTRACT_VERSION } from "./execution-catalog.ts";
import { snapshotSha256 } from "./calculator-tools.ts";
import { buildDerivedExecution, completeDerivedEvaluation, DERIVED_EVALUATION_INLINE_LIMIT, isDerivedEvaluation, pendingDerivedEvaluation, type DerivedEvaluationEnvelope, type ExecutionSnapshot } from "./reactive-evaluation.ts";
import { getCaseDataRecomputeEligibility, recomputeCaseDataUpdate } from "./case-data-recompute.ts";

export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
export const now=()=>new Date().toISOString();
export function db():D1Database { if(!env.DB)throw new HttpError(503,"사건 저장소가 준비되지 않았습니다.");return env.DB; }
export function bucket():R2Bucket { if(!env.BUCKET)throw new HttpError(503,"문서 저장소가 준비되지 않았습니다.");return env.BUCKET; }
export function connection(){return {model:AI_MODEL,apiKeyConfigured:!!env.OPENAI_API_KEY,storageReady:!!env.DB&&!!env.BUCKET};}
export async function actor(){const user=await getChatGPTUser();return user?.userId??"private-site-service";}
/** Human-review transitions require the authenticated Site user identity. Site's
 * service fallback remains valid for operational actions, but cannot stand in
 * for a person making factual, legal, or export-recognition decisions. */
export async function requireHumanActor():Promise<string>{
  const user=await getChatGPTUser();
  if(!user?.userId||user.userId==="private-site-service")throw new HttpError(403,"이 검토에는 인증된 사용자 계정이 필요합니다.");
  return user.userId;
}
/** This deployment is owner-private. Sites dispatch authenticates browser and service access.
 * Do not make public without replacing this shared-workspace boundary with per-record ACLs. */
export function requireSameOrigin(request:Request){
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)throw new HttpError(403,"다른 사이트에서 보낸 변경 요청입니다.");
  if(request.headers.get("sec-fetch-site")==="cross-site")throw new HttpError(403,"교차 사이트 요청은 허용하지 않습니다.");
}
export async function jsonBody(request:Request){
  if(!request.headers.get("content-type")?.includes("application/json"))throw new HttpError(415,"JSON 형식이 필요합니다.");
  const text=await request.text();if(text.length>2_000_000)throw new HttpError(413,"요청이 너무 큽니다.");
  try{return JSON.parse(text);}catch{throw new HttpError(400,"JSON을 읽을 수 없습니다.");}
}
// A case revision tracks evidence changes. Manifest/review writes also need their
// own CAS token so a stale export cannot overwrite a newer review or archive.
const caseSnapshots=new WeakMap<CaseData,{id:string;revision:number;token:string}>();
const CASE_INLINE_LIMIT=500_000;
type CaseSummary={documents:number;facts:number;status:"review_required"|"needs_evidence"};
type CasePointer={_storage:"r2-case-v1";caseId:string;revision:number;key:string;sha256:string;summary:CaseSummary};
export function caseSummary(data:CaseData):CaseSummary{const facts=data.facts.length;return {documents:data.documents.filter(d=>d.status==="active").length,facts,status:facts?"review_required":"needs_evidence"};}
function casePointer(value:unknown):value is CasePointer{return !!value&&typeof value==="object"&&(value as CasePointer)._storage==="r2-case-v1";}
function validPointer(pointer:CasePointer,id:string,revision:number){return pointer.caseId===id&&pointer.revision===revision&&typeof pointer.key==="string"&&pointer.key.startsWith(`cases/${id}/state/`)&&pointer.key.endsWith(".json")&&/^[a-f0-9]{64}$/.test(pointer.sha256)&&!!pointer.summary&&Number.isSafeInteger(pointer.summary.facts)&&Number.isSafeInteger(pointer.summary.documents);}
export async function getCase(id:string):Promise<CaseData>{
  const row=await db().prepare("SELECT payload,revision,storage_token AS storageToken FROM cases WHERE id = ?").bind(id).first<{payload:string;revision:number;storageToken:string}>();
  if(!row)throw new HttpError(404,"사건을 찾을 수 없습니다.");
  let stored:unknown;try{stored=JSON.parse(row.payload);}catch{throw new HttpError(409,"사건 저장 상태를 확인한 뒤 다시 불러오세요.");}
  let data:CaseData;
  if(casePointer(stored)){
    if(!validPointer(stored,id,row.revision))throw new HttpError(409,"사건 저장 상태를 확인한 뒤 다시 불러오세요.");
    const object=await bucket().get(stored.key);if(!object)throw new HttpError(409,"사건 저장 상태를 확인한 뒤 다시 불러오세요.");
    const bytes=await object.arrayBuffer();if(await sha256(bytes)!==stored.sha256)throw new HttpError(409,"사건 저장 상태를 확인한 뒤 다시 불러오세요.");
    try{data=JSON.parse(new TextDecoder().decode(bytes)) as CaseData;}catch{throw new HttpError(409,"사건 저장 상태를 확인한 뒤 다시 불러오세요.");}
  }else data=stored as CaseData;
  if(typeof row.storageToken!=="string"||data.context.id!==id||data.context.revision!==row.revision)throw new HttpError(409,"사건 저장 상태를 확인한 뒤 다시 불러오세요.");
  caseSnapshots.set(data,{id,revision:row.revision,token:row.storageToken});return data;
}
export interface CaseMutationContext {
  commandId:string;requestHash:string;commandType:string;actor:string;beforeStateHash:string;impact:unknown;
  authorization?:{sql:string;params:unknown[]};
  guardedStatements?:(token:string)=>D1PreparedStatement[];
}
export async function caseStateFingerprint(data:CaseData):Promise<string>{
  const snapshot=caseSnapshots.get(data);
  if(!snapshot)throw new HttpError(409,"현재 사건을 다시 불러오세요.");
  const inputHash=await sha256(new TextEncoder().encode(JSON.stringify(data)));
  return `case-state/1:${await sha256(new TextEncoder().encode(JSON.stringify(["case-state/1",data.context.id,data.context.revision,snapshot.token,inputHash])))}`;
}
export async function readCommandReceipt(caseId:string,commandId:string){
  return db().prepare("SELECT id,case_id AS caseId,command_id AS commandId,request_hash AS requestHash,command_type AS commandType,actor,before_revision AS beforeRevision,after_revision AS afterRevision,before_state_hash AS beforeStateHash,after_state_hash AS afterStateHash,impact_payload AS impact,created_at AS createdAt FROM case_mutation_receipts WHERE case_id = ? AND command_id = ?").bind(caseId,commandId).first<Record<string,unknown>>();
}
export async function saveCase(data:CaseData,expected:number,previous:CaseData,mutation?:CaseMutationContext,options?:{mutationCategory?:"artifact_only";expectedHeads?:{dataVersion:number;calculationRunId:string;legalReviewRunId:string;referenceSha256:string}}){
  if(options?.mutationCategory&&mutation)throw new HttpError(409,"단순 생성물 저장과 사건 변경 명령은 혼합할 수 없습니다.");
  const category:NonSourceMutationCategory|"source"=
    mutation&&REVIEW_ONLY_COMMANDS.has(mutation.commandType)?"review_only":options?.mutationCategory??"source";
  if(options?.expectedHeads&&category!=="artifact_only")throw new HttpError(409,"AUTODRAFT_HANDOFF_GUARD_REQUIRES_ARTIFACT_ONLY");
  if(category!=="source"){
    try{assertNonSourceCaseChange(previous,data,category,category==="review_only"?mutation?.commandType:undefined);}
    catch(error){throw new HttpError(409,error instanceof Error?error.message:"NON_SOURCE_CHANGE_INVALID");}
  }
  for(const snapshot of [previous,data])if(snapshot.workflowState&&(snapshot.workflowState.schema!=="case-workflow/1"||snapshot.workflowState.version!==undefined&&(!Number.isSafeInteger(snapshot.workflowState.version)||snapshot.workflowState.version<1)))throw new HttpError(409,"지원하지 않는 사건 업무 스키마입니다. 호환 판본에서 확인하세요.");
  if(data.workflowState&&data.workflowState.version===undefined)throw new HttpError(409,"사건 업무 형식 전환을 먼저 완료하세요.");
  const snapshot=caseSnapshots.get(previous);
  if(!snapshot||snapshot.id!==data.context.id||snapshot.revision!==expected||!Number.isSafeInteger(data.context.revision)||data.context.revision<expected)throw new HttpError(409,"원래 불러온 사건 버전이 필요합니다. 최신 내용을 불러온 뒤 다시 시도하세요.");
  // Response-only identity must never become part of the persisted input.
  if(Object.hasOwn(data,"clientStateFingerprint"))throw new HttpError(400,"응답용 지문을 저장할 수 없습니다.");
  const token=crypto.randomUUID(),serialized=JSON.stringify(data),bytes=new TextEncoder().encode(serialized),inputSha256=await sha256(bytes);
  const afterStateHash=`case-state/1:${await sha256(new TextEncoder().encode(JSON.stringify(["case-state/1",data.context.id,data.context.revision,token,inputSha256])))}`;
  const ownedKeys:string[]=[];let payload=serialized;
  const at=now(),evaluationId=crypto.randomUUID(),receiptId=crypto.randomUUID(),jobId=crypto.randomUUID();
  const pending=pendingDerivedEvaluation({revision:data.context.revision,storageToken:token,inputSha256,generatedAt:at,referenceApplication:resolveReferenceApplicationForCase(data)});
  let beforeKey="",afterKey="";
  const putSnapshot=async(content:Uint8Array,suffix:string)=>{const key=`cases/${data.context.id}/state/${crypto.randomUUID()}-${suffix}.json`;await bucket().put(key,content,{httpMetadata:{contentType:"application/json"}});ownedKeys.push(key);return key;};
  try{
    if(mutation){beforeKey=await putSnapshot(new TextEncoder().encode(JSON.stringify(previous)),"before");afterKey=await putSnapshot(bytes,"after");}
    if(bytes.byteLength>=CASE_INLINE_LIMIT){const key=afterKey||await putSnapshot(bytes,"case");const pointer:CasePointer={_storage:"r2-case-v1",caseId:data.context.id,revision:data.context.revision,key,sha256:inputSha256,summary:caseSummary(data)};payload=JSON.stringify(pointer);}
  }catch(error){await Promise.all(ownedKeys.map(key=>bucket().delete(key).catch(()=>{})));throw error;}
  const guard="EXISTS (SELECT 1 FROM cases WHERE id = ? AND revision = ? AND storage_token = ?)";
  // A review draft from the AI pipeline may be linked to the staff workbench
  // only while the exact OCR/calculation/LawGraph heads still match. This
  // predicate participates in the same D1 batch as the artifact-only CAS.
  const expectedHeads=options?.expectedHeads;
  const headGuard=expectedHeads?(
    " AND EXISTS (SELECT 1 FROM case_data_change_state s "+
    "JOIN case_calculation_heads c ON c.case_id=s.case_id AND c.data_version=s.data_version "+
    "JOIN case_calculation_runs cr ON cr.id=c.run_id AND cr.reference_sha256=? "+
    "JOIN case_legal_review_heads l ON l.case_id=s.case_id AND l.data_version=s.data_version "+
    "AND l.calculation_run_id=c.run_id WHERE s.case_id=? AND s.data_version=? "+
    "AND c.run_id=? AND l.review_run_id=? AND c.case_revision=? AND l.case_revision=?)"
  ):"";
  const headParams=expectedHeads?[expectedHeads.referenceSha256,data.context.id,
    expectedHeads.dataVersion,expectedHeads.calculationRunId,expectedHeads.legalReviewRunId,
    expected,expected]:[];
  const batch:D1PreparedStatement[]=[
    db().prepare("UPDATE cases SET payload = ?, revision = ?, name = ?, updated_at = ?, storage_token = ?, mutation_category = ? WHERE id = ? AND revision = ? AND storage_token = ?"+(mutation?.authorization?` AND (${mutation.authorization.sql})`:"")+headGuard).bind(payload,data.context.revision,data.context.caseName,at,token,category,data.context.id,expected,snapshot.token,...(mutation?.authorization?.params??[]),...headParams),
    db().prepare(`INSERT INTO analyses (id,case_id,revision,type,payload,at) SELECT ?,?,?,?,?,? WHERE ${guard}`).bind(evaluationId,data.context.id,data.context.revision,"derived_evaluation",JSON.stringify(pending),at,data.context.id,data.context.revision,token),
  ];
  if(mutation){
    batch.push(db().prepare(`INSERT INTO case_mutation_receipts (id,case_id,command_id,request_hash,command_type,actor,before_revision,after_revision,before_state_hash,after_state_hash,before_snapshot_key,after_snapshot_key,impact_payload,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${guard}`).bind(receiptId,data.context.id,mutation.commandId,mutation.requestHash,mutation.commandType,mutation.actor,expected,data.context.revision,mutation.beforeStateHash,afterStateHash,beforeKey,afterKey,JSON.stringify({...mutation.impact as Record<string,unknown>,snapshotHashes:{before:await sha256(new TextEncoder().encode(JSON.stringify(previous))),after:inputSha256}}),at,data.context.id,data.context.revision,token));
    batch.push(db().prepare(`INSERT INTO events (id,case_id,actor,type,detail,at) SELECT ?,?,?,?,?,? WHERE ${guard}`).bind(crypto.randomUUID(),data.context.id,mutation.actor,"case.command_committed",JSON.stringify({commandId:mutation.commandId,commandType:mutation.commandType,receiptId,before:mutation.beforeStateHash,after:afterStateHash}),at,data.context.id,data.context.revision,token));
    batch.push(db().prepare(`UPDATE case_recompute_jobs SET status='superseded',lease_token=NULL,lease_until=NULL,updated_at=? WHERE case_id=? AND status IN ('pending','running','retry_wait') AND ${guard}`).bind(at,data.context.id,data.context.id,data.context.revision,token));
    batch.push(db().prepare(`INSERT INTO case_recompute_jobs (id,case_id,job_kind,input_fingerprint,contract_fingerprint,status,result_ref,created_at,updated_at) SELECT ?,?,?,?,?,'pending',?,?,? WHERE ${guard}`).bind(jobId,data.context.id,"deterministic_evaluation",afterStateHash,`${EXECUTION_CONTRACT_VERSION}:${pending.referenceSha256}`,JSON.stringify({evaluationId,storageToken:token,inputSha256,revision:data.context.revision}),at,at,data.context.id,data.context.revision,token));
    for(const task of data.workflowState?.tasks??[])batch.push(db().prepare(`INSERT INTO case_tasks (id,case_id,dedupe_key,type,owner_id,due_at,waiting_on,blocked_by,status,dependency_fingerprint,payload,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${guard} ON CONFLICT(case_id,dedupe_key) DO UPDATE SET owner_id=excluded.owner_id,due_at=excluded.due_at,waiting_on=excluded.waiting_on,blocked_by=excluded.blocked_by,status=excluded.status,dependency_fingerprint=excluded.dependency_fingerprint,payload=excluded.payload,updated_at=excluded.updated_at`).bind(task.id,data.context.id,task.dedupeKey,task.type,task.ownerId,task.dueAt,task.waitingOn,JSON.stringify(task.blockedBy),task.status,task.dependencyFingerprint,JSON.stringify(task),task.createdAt,task.updatedAt,data.context.id,data.context.revision,token));
    batch.push(...(mutation.guardedStatements?.(token)??[]));
  }
  if(category!=="source"){
    // The trigger sees review_only/artifact_only once; clear the marker in the
    // same atomic D1 batch so later direct SQL changes remain source-watched.
    batch.push(db().prepare("UPDATE cases SET mutation_category='source' WHERE id=? AND revision=? AND storage_token=? AND mutation_category=?")
      .bind(data.context.id,data.context.revision,token,category));
  }
  let committed=false;
  try{const results=await db().batch(batch);committed=!!results[0].meta.changes;}
  catch(error){
    // A transport failure may occur AFTER commit. Never delete referenced snapshots on an ambiguous acknowledgement.
    let row:{token:string}|null;
    try{row=await db().prepare("SELECT storage_token AS token FROM cases WHERE id = ?").bind(data.context.id).first<{token:string}>();}
    catch{throw new HttpError(503,"저장 확인이 지연되었습니다. 같은 명령 식별자로 영수증을 조회한 뒤 재시도하세요.");}
    const proof=await db().prepare("SELECT id FROM analyses WHERE id=? AND case_id=?").bind(evaluationId,data.context.id).first().catch(()=>undefined);
    if(row?.token===token||proof)committed=true;
    else if(proof===undefined)throw new HttpError(503,"저장 영수증 확인이 지연되었습니다. 같은 명령 식별자로 조회해 주세요.");
    else {await Promise.all(ownedKeys.map(key=>bucket().delete(key).catch(()=>{})));throw error;}
  }
  if(!committed){await Promise.all(ownedKeys.map(key=>bucket().delete(key).catch(()=>{})));throw new HttpError(409,"사건이 변경되었습니다. 최신 내용을 불러온 뒤 다시 시도하세요.");}
  caseSnapshots.delete(previous);caseSnapshots.set(data,{id:data.context.id,revision:data.context.revision,token});
  if(mutation)await drainCaseRecomputeJobs(data.context.id,1).catch(()=>{});
  else await finishDerivedEvaluation(data,evaluationId,pending);
  await recomputeCaseDataUpdate(db(),{caseId:data.context.id,loadCase:()=>getCase(data.context.id)}).catch(()=>{});
  return {stateFingerprint:afterStateHash,receiptId:mutation?receiptId:undefined,evaluationId};
}

/** Explicit, bounded deterministic drain. No model or OCR work can enter this queue. */
export async function drainCaseRecomputeJobs(caseId:string,limit=2){
  const at=now(),rows=(await db().prepare("SELECT id,status,attempts,result_ref AS resultRef,input_fingerprint AS inputFingerprint,contract_fingerprint AS contractFingerprint FROM case_recompute_jobs WHERE case_id=? AND ((status IN ('pending','retry_wait') AND (next_attempt_at IS NULL OR next_attempt_at<=?)) OR (status='running' AND lease_until<=?)) ORDER BY created_at LIMIT ?").bind(caseId,at,at,Math.min(5,Math.max(1,limit))).all<{id:string;status:string;attempts:number;resultRef:string;inputFingerprint:string;contractFingerprint:string}>()).results;
  for(const row of rows){
    const lease=crypto.randomUUID(),until=new Date(Date.now()+60_000).toISOString();
    const claim=await db().prepare("UPDATE case_recompute_jobs SET status='running',lease_token=?,lease_until=?,attempts=attempts+1,updated_at=? WHERE id=? AND ((status IN ('pending','retry_wait') AND (next_attempt_at IS NULL OR next_attempt_at<=?)) OR (status='running' AND lease_until<=?))").bind(lease,until,at,row.id,at,at).run();if(!claim.meta.changes)continue;
    try{
      const ref=JSON.parse(row.resultRef),data=await getCase(caseId);
      if(await caseStateFingerprint(data)!==row.inputFingerprint||row.contractFingerprint!==`${EXECUTION_CONTRACT_VERSION}:${referenceIdentity()?.sha256??referenceRelease.sha256}`){await db().prepare("UPDATE case_recompute_jobs SET status='superseded',lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND lease_token=?").bind(now(),row.id,lease).run();continue;}
      await finishDerivedEvaluation(data,ref.evaluationId,pendingDerivedEvaluation({revision:ref.revision,storageToken:ref.storageToken,inputSha256:ref.inputSha256,generatedAt:at,referenceApplication:resolveReferenceApplicationForCase(data)}),{jobId:row.id,token:lease});
      const result=await db().prepare("SELECT payload FROM analyses WHERE id=? AND type='derived_evaluation'").bind(ref.evaluationId).first<{payload:string}>();
      if(!result||JSON.parse(result.payload).status!=="complete")throw new Error("Evaluation pending");
      await db().prepare("UPDATE case_recompute_jobs SET status='complete',lease_token=NULL,lease_until=NULL,last_error=NULL,updated_at=? WHERE id=? AND lease_token=? AND lease_until>? AND EXISTS (SELECT 1 FROM cases WHERE id=? AND revision=? AND storage_token=?)").bind(now(),row.id,lease,now(),caseId,ref.revision,ref.storageToken).run();
    }catch{
      const failed=row.attempts+1>=5;
      await db().prepare("UPDATE case_recompute_jobs SET status=?,lease_token=NULL,lease_until=NULL,last_error='deterministic_evaluation_failed',next_attempt_at=?,updated_at=? WHERE id=? AND lease_token=?").bind(failed?"failed":"retry_wait",new Date(Date.now()+Math.min(300_000,1000*2**row.attempts)).toISOString(),now(),row.id,lease).run();
    }
  }
  return {attempted:rows.length};
}

async function finishDerivedEvaluation(data:CaseData,id:string,pending:DerivedEvaluationEnvelope,lease?:{jobId:string;token:string}){
  let key:string|undefined;
  try{
    // Source data must stay unchanged for ten minutes before any legacy cache
    // path performs arithmetic. A read or a computed write does not reset it.
    if(!(await getCaseDataRecomputeEligibility(db(),{caseId:data.context.id})).isQuiet)return;
    const execution=buildDerivedExecution(data),bytes=new TextEncoder().encode(JSON.stringify(execution)),evaluationSha256=await sha256(bytes);
    let completed:DerivedEvaluationEnvelope;
    if(bytes.byteLength<=DERIVED_EVALUATION_INLINE_LIMIT)completed=completeDerivedEvaluation(pending,execution,evaluationSha256);
    else{
      key=`cases/${data.context.id}/evaluations/${pending.revision}-${pending.storageToken}-${crypto.randomUUID()}.json`;
      await bucket().put(key,bytes,{httpMetadata:{contentType:"application/json"}});
      completed={...pending,status:"complete",evaluationSha256,executionPointer:{key,sha256:evaluationSha256}};
    }
    const leaseGuard=lease?" AND EXISTS (SELECT 1 FROM case_recompute_jobs j WHERE j.id=? AND j.lease_token=? AND j.status='running' AND j.lease_until>?)":"";
    const values:unknown[]=[JSON.stringify(completed),id,data.context.id,data.context.revision,pending.storageToken,pending.inputSha256,pending.storageToken,...(lease?[lease.jobId,lease.token,now()]:[])];
    const result=await db().prepare("UPDATE analyses SET payload = ? WHERE id = ? AND case_id = ? AND revision = ? AND type = 'derived_evaluation' AND json_extract(payload,'$.status') = 'pending' AND json_extract(payload,'$.storageToken') = ? AND json_extract(payload,'$.inputSha256') = ? AND EXISTS (SELECT 1 FROM cases c WHERE c.id = analyses.case_id AND c.revision = analyses.revision AND c.storage_token = ?)"+leaseGuard).bind(...values).run();
    if(!result.meta.changes&&key)await bucket().delete(key);
  }catch{
    // The CAS batch durably inserted a pending marker. Reads can retry this exact
    // token/input pair; a prior revision's successful evaluation is never reused.
    if(key)await bucket().delete(key).catch(()=>{});
  }
}

type DerivedEvaluationRead={status:"pending";revision:number;inputSha256:string;storageToken?:string}|(DerivedEvaluationEnvelope&{status:"complete";execution:ExecutionSnapshot});
async function resetAndRetryDerivedEvaluation(data:CaseData,id:string,identity:{id:string;revision:number;token:string},inputSha256:string):Promise<DerivedEvaluationRead|undefined>{
  const pending=pendingDerivedEvaluation({revision:identity.revision,storageToken:identity.token,inputSha256,generatedAt:now(),referenceApplication:resolveReferenceApplicationForCase(data)});
  const reset=await db().prepare("UPDATE analyses SET payload = ? WHERE id = ? AND case_id = ? AND revision = ? AND type = 'derived_evaluation' AND json_extract(payload,'$.storageToken') = ? AND json_extract(payload,'$.inputSha256') = ? AND EXISTS (SELECT 1 FROM cases c WHERE c.id = analyses.case_id AND c.revision = analyses.revision AND c.storage_token = ?)")
    .bind(JSON.stringify(pending),id,data.context.id,identity.revision,identity.token,inputSha256,identity.token).run();
  if(!reset.meta.changes)return {status:"pending" as const,revision:identity.revision,inputSha256,storageToken:identity.token};
  await finishDerivedEvaluation(data,id,pending);
  return readDerivedEvaluation(data,identity,inputSha256,false);
}

async function readDerivedEvaluation(data:CaseData,identity:{id:string;revision:number;token:string}|undefined,inputSha256:string,retryPending=true):Promise<DerivedEvaluationRead|undefined>{
  if(!identity||identity.id!==data.context.id||identity.revision!==data.context.revision)return undefined;
  const rows=(await db().prepare("SELECT a.id,a.payload FROM analyses a JOIN cases c ON c.id = a.case_id AND c.revision = a.revision WHERE a.case_id = ? AND a.revision = ? AND a.type = 'derived_evaluation' AND c.storage_token = ? AND json_valid(a.payload) = 1 AND json_extract(a.payload,'$.storageToken') = ? AND json_extract(a.payload,'$.inputSha256') = ? ORDER BY a.at DESC LIMIT 1")
    .bind(data.context.id,data.context.revision,identity.token,identity.token,inputSha256).all<{id:string;payload:string}>()).results;
  if(!rows.length){
    const id=crypto.randomUUID(),pending=pendingDerivedEvaluation({revision:identity.revision,storageToken:identity.token,inputSha256,generatedAt:now(),referenceApplication:resolveReferenceApplicationForCase(data)});
    const inserted=await db().prepare("INSERT INTO analyses (id,case_id,revision,type,payload,at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM cases WHERE id = ? AND revision = ? AND storage_token = ?)")
      .bind(id,data.context.id,data.context.revision,"derived_evaluation",JSON.stringify(pending),now(),data.context.id,identity.revision,identity.token).run();
    if(!inserted.meta.changes)return {status:"pending" as const,revision:identity.revision,inputSha256};
    await finishDerivedEvaluation(data,id,pending);
    return readDerivedEvaluation(data,identity,inputSha256,false);
  }
  let envelope:unknown;try{envelope=JSON.parse(rows[0].payload);}catch{return resetAndRetryDerivedEvaluation(data,rows[0].id,identity,inputSha256);}
  if(!isDerivedEvaluation(envelope)||envelope.storageToken!==identity.token||envelope.inputSha256!==inputSha256||envelope.revision!==identity.revision||envelope.engineVersion!==EXECUTION_CONTRACT_VERSION||envelope.referenceSha256!==(referenceIdentity()?.sha256??referenceRelease.sha256))return resetAndRetryDerivedEvaluation(data,rows[0].id,identity,inputSha256);
  if(envelope.status==="pending"){
    if(!retryPending)return {status:"pending" as const,revision:identity.revision,inputSha256,storageToken:identity.token};
    await finishDerivedEvaluation(data,rows[0].id,envelope);
    return readDerivedEvaluation(data,identity,inputSha256,false);
  }
  if(envelope.execution){
    const bytes=new TextEncoder().encode(JSON.stringify(envelope.execution));
    if(!envelope.evaluationSha256||await sha256(bytes)!==envelope.evaluationSha256)return resetAndRetryDerivedEvaluation(data,rows[0].id,identity,inputSha256);
    return {...envelope,status:"complete" as const,execution:envelope.execution};
  }
  if(envelope.executionPointer){
    const prefix=`cases/${data.context.id}/evaluations/${identity.revision}-${identity.token}-`;
    if(!envelope.executionPointer.key.startsWith(prefix)||!/^[a-f0-9-]{36}\.json$/.test(envelope.executionPointer.key.slice(prefix.length)))return resetAndRetryDerivedEvaluation(data,rows[0].id,identity,inputSha256);
    const object=await bucket().get(envelope.executionPointer.key);if(!object)return resetAndRetryDerivedEvaluation(data,rows[0].id,identity,inputSha256);
    const bytes=new Uint8Array(await object.arrayBuffer()),hash=await sha256(bytes);if(hash!==envelope.executionPointer.sha256||hash!==envelope.evaluationSha256)return resetAndRetryDerivedEvaluation(data,rows[0].id,identity,inputSha256);
    try{return {...envelope,status:"complete" as const,execution:JSON.parse(new TextDecoder().decode(bytes))};}catch{return resetAndRetryDerivedEvaluation(data,rows[0].id,identity,inputSha256);}
  }
  return {status:"pending" as const,revision:identity.revision,inputSha256};
}
export async function event(caseId:string,type:string,detail:unknown){
  await db().prepare("INSERT INTO events (id,case_id,actor,type,detail,at) VALUES (?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),caseId,await actor(),type,JSON.stringify(detail),now()).run();
}
export async function jobs(caseId:string){
  return (await db().prepare("SELECT id,document_id AS documentId,page,role,document_type AS documentType,status,stage,attempts,error,updated_at AS updatedAt FROM page_jobs WHERE case_id = ? ORDER BY document_id,page").bind(caseId).all()).results;
}
export async function persistedRescuePlans(caseId:string){return (await db().prepare("SELECT result FROM page_jobs WHERE case_id = ? AND status = 'pending'").bind(caseId).all<{result:string|null}>()).results?.map(row=>{try{return JSON.parse(row.result??"{}").rescuePlan;}catch{return null;}}).filter(Boolean)??[];}
export async function getProcessingReadiness(data:CaseData){
  const [documents,pages]=await Promise.all([
    db().prepare("SELECT id,ready FROM documents WHERE case_id = ?").bind(data.context.id).all<StoredDocumentState>(),
    db().prepare("SELECT document_id AS documentId,page,role,status,CASE WHEN image_key IS NOT NULL THEN 1 ELSE 0 END AS imageReady FROM page_jobs WHERE case_id = ?").bind(data.context.id).all<StoredPageState>(),
  ]);
  return inspectProcessingReadiness(data,documents.results,pages.results);
}
const ANALYSIS_PAGE_MAX=100,ANALYSIS_PAGE_DEFAULT=50;
export interface AnalysisPageOptions {revision:number;limit?:number;cursor?:string|null;includeHistorical?:boolean;inputSha256?:string}
function analysisCursor(value:string|null|undefined):{at:string;id:string}|null{
  if(!value)return null;try{const decoded=JSON.parse(atob(value.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(value.length/4)*4,"=")));if(!decoded||typeof decoded.at!=="string"||typeof decoded.id!=="string"||!decoded.id||decoded.at.length>64||decoded.id.length>100)throw new Error();return {at:decoded.at,id:decoded.id};}catch{throw new HttpError(400,"분석 페이지 cursor 형식이 올바르지 않습니다.");}
}
const encodeAnalysisCursor=(row:{at:string;id:string})=>btoa(JSON.stringify({at:row.at,id:row.id})).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
export async function readCaseAnalyses(data:CaseData,options:AnalysisPageOptions){
  const {revision}=options;if(!Number.isSafeInteger(revision)||revision<1||revision>data.context.revision)throw new HttpError(400,"분석 판본을 확인하세요.");
  if(options.inputSha256!==undefined&&!/^[a-f0-9]{64}$/i.test(options.inputSha256))throw new HttpError(400,"분석 입력 지문 형식이 올바르지 않습니다.");
  const limit=options.limit??ANALYSIS_PAGE_DEFAULT;if(!Number.isSafeInteger(limit)||limit<1||limit>ANALYSIS_PAGE_MAX)throw new HttpError(400,`분석 페이지 크기는 1부터 ${ANALYSIS_PAGE_MAX}까지여야 합니다.`);
  const cursor=analysisCursor(options.cursor),includeHistorical=options.includeHistorical===true;
  const params:any[]=[data.context.id,revision];let sql="SELECT id,revision,type,payload,at FROM analyses WHERE case_id = ? AND revision = ? AND type <> 'derived_evaluation'";
  if(options.inputSha256){sql+=" AND json_valid(payload) = 1 AND json_extract(payload,'$.calculatorExecution.inputSha256') = ?";params.push(options.inputSha256);}
  const currentHash=revision===data.context.revision?await snapshotSha256(data):null,currentReference=referenceIdentity()?.sha256??referenceRelease.sha256;
  if(!includeHistorical){sql+=" AND (type <> 'legal_advisory' AND type <> 'legal_review' OR (json_valid(payload) = 1 AND json_extract(payload,'$.calculatorExecution.inputSha256') = ? AND json_extract(payload,'$.calculatorExecution.referenceRelease.sha256') = ? AND json_extract(payload,'$.calculatorExecution.contractVersion') = ?))";params.push(currentHash??"",currentReference,EXECUTION_CONTRACT_VERSION);}
  if(cursor){sql+=" AND (at < ? OR (at = ? AND id < ?))";params.push(cursor.at,cursor.at,cursor.id);}
  sql+=" ORDER BY at DESC,id DESC LIMIT ?";params.push(limit+1);
  const result=await db().prepare(sql).bind(...params).all<{id:string;revision:number;type:string;payload:string;at:string}>(),hasMore=result.results.length>limit,rows=result.results.slice(0,limit);
  const analyses=rows.map(row=>{let payload:any,parseError=false;try{payload=JSON.parse(row.payload);}catch{payload=null;parseError=true;}const legal=row.type==="legal_advisory"||row.type==="legal_review";let current=revision===data.context.revision,staleReason:string|undefined;
    if(parseError&&legal){current=false;staleReason="payload_invalid";}
    if(legal&&!parseError){const receipt=payload?.calculatorExecution;if(revision!==data.context.revision)staleReason="case_revision_is_historical";else if(receipt?.inputSha256!==currentHash)staleReason="calculator_input_hash_mismatch";else if(receipt?.referenceRelease?.sha256!==currentReference)staleReason="reference_release_hash_mismatch";else if(receipt?.contractVersion!==EXECUTION_CONTRACT_VERSION)staleReason="engine_version_mismatch";current=!staleReason;}
    return {...row,payload,...(parseError?{payloadParseError:true}:{}),...(legal?{current,staleReason:staleReason??null}: {})};});
  const last=rows.at(-1);return {caseId:data.context.id,revision,inputSha256:options.inputSha256??(revision===data.context.revision?currentHash:undefined),includeHistorical,limit,analyses,complete:!hasMore,nextCursor:hasMore&&last?encodeAnalysisCursor(last):null};
}
export async function requireUploadedSource(data:CaseData,source:{documentId?:string;page?:number}|null|undefined){
  if(!source||typeof source.documentId!=="string"||!Number.isInteger(source.page))throw new HttpError(400,"원본 문서와 페이지가 필요합니다.");
  if(!data.documents.some(d=>d.id===source.documentId&&d.status==="active")||!data.pages.some(p=>p.documentId===source.documentId&&p.page===source.page&&p.role==="evidence"))throw new HttpError(409,"현재 생성용 증빙 페이지를 선택하세요.");
  const row=await db().prepare("SELECT d.id FROM documents d JOIN page_jobs p ON p.document_id = d.id AND p.case_id = d.case_id WHERE d.id = ? AND d.case_id = ? AND d.ready = 1 AND p.page = ? AND p.image_key IS NOT NULL").bind(source.documentId,data.context.id,source.page).first();
  if(!row)throw new HttpError(409,"원본과 해당 페이지의 업로드가 끝난 뒤 데이터를 등록하세요.");
}
export async function caseExtras(data:CaseData){
  const id=data.context.id;
  const identity=caseSnapshots.get(data),inputSha256=await sha256(new TextEncoder().encode(JSON.stringify(data))),calculatorInputSha256=await snapshotSha256(data);
  const currentFiles=new Set((data.exportManifest?.files??[]).filter(f=>f.status==="current").map(f=>f.id));
  const [j,a,otherAnalyses,legalAnalyses,processingReadiness,usage,derivedEvaluation]=await Promise.all([
    jobs(id),db().prepare("SELECT id,revision,name,kind,hash,mime FROM artifacts WHERE case_id = ? ORDER BY created_at DESC").bind(id).all(),
    db().prepare("SELECT id,revision,type,payload,at FROM analyses WHERE case_id = ? AND revision = ? AND type NOT IN ('derived_evaluation','legal_advisory','legal_review') ORDER BY at DESC LIMIT 10").bind(id,data.context.revision).all<{id:string,revision:number,type:string,payload:string,at:string}>(),
    db().prepare("SELECT id,revision,type,payload,at FROM analyses WHERE case_id = ? AND revision = ? AND type IN ('legal_advisory','legal_review') AND json_valid(payload) = 1 AND json_extract(payload,'$.calculatorExecution.inputSha256') = ? AND json_extract(payload,'$.calculatorExecution.referenceRelease.sha256') = ? AND json_extract(payload,'$.calculatorExecution.contractVersion') = ? ORDER BY at DESC,id DESC LIMIT 101").bind(id,data.context.revision,calculatorInputSha256,referenceIdentity()?.sha256??referenceRelease.sha256,EXECUTION_CONTRACT_VERSION).all<{id:string,revision:number,type:string,payload:string,at:string}>(),
    getProcessingReadiness(data),
    db().prepare("SELECT COUNT(*) AS attempts,COALESCE(SUM(CAST(json_extract(detail,'$.inputTokens') AS INTEGER)),0) AS inputTokens,COALESCE(SUM(CAST(json_extract(detail,'$.outputTokens') AS INTEGER)),0) AS outputTokens,MIN(at) AS startedAt,MAX(at) AS completedAt FROM events WHERE case_id = ? AND type = 'model.call' AND json_extract(detail,'$.model') = ?").bind(id,AI_MODEL).first<{attempts:number,inputTokens:number,outputTokens:number,startedAt:string|null,completedAt:string|null}>(),
    readDerivedEvaluation(data,identity,inputSha256),
  ]);
  const execution:CaseData["execution"]=usage&&usage.attempts>0?{model:AI_MODEL,attempts:usage.attempts,inputTokens:usage.inputTokens,outputTokens:usage.outputTokens,...(usage.startedAt?{startedAt:usage.startedAt}:{}),...(usage.completedAt?{completedAt:usage.completedAt}:{})}:data.execution;
  const legalPageHasMore=legalAnalyses.results.length>100,legalRows=legalAnalyses.results.slice(0,100).flatMap(x=>{try{return [{...x,payload:JSON.parse(x.payload)}];}catch{return [];}});
  const analyses=[...otherAnalyses.results.flatMap(x=>{try{return [{...x,payload:JSON.parse(x.payload)}];}catch{return [];}}),...legalRows].sort((x,y)=>String(y.at).localeCompare(String(x.at)));
  const expectedCheckIds=new Set(RISK_CATALOG.map(check=>check.id)),checkIds=new Set<string>(),checkStatuses=new Set(["pass","fail","missing","conflict","not_applicable","legal_review"]);for(const row of legalRows){const checks=(row.payload as any)?.checks;if(Array.isArray(checks))for(const check of checks)if(check&&typeof check.id==="string"&&expectedCheckIds.has(check.id)&&checkStatuses.has(check.status)&&typeof check.reason==="string"&&typeof check.nextAction==="string"&&[check.factIds,check.ruleIds,check.missingDocuments].every(values=>Array.isArray(values)&&values.every((value:unknown)=>typeof value==="string")))checkIds.add(check.id);}
  const missingCheckIds=[...expectedCheckIds].filter(checkId=>!checkIds.has(checkId));
  const legalReviewCoverage={currentAnalysisCount:legalRows.length,currentCheckCount:checkIds.size,expectedCheckCount:expectedCheckIds.size,missingCheckIds,complete:!legalPageHasMore&&missingCheckIds.length===0,truncated:legalPageHasMore,nextCursor:legalPageHasMore&&legalRows.length?encodeAnalysisCursor(legalRows.at(-1) as {at:string;id:string}):null};
  return {referenceSnapshot:currentReferenceSnapshot(),jobs:j,processingReadiness,execution,derivedEvaluation,inputIdentity:{stateFingerprint:identity?await caseStateFingerprint(data):undefined,storageInputSha256:inputSha256,storageHashScheme:"json-stringify-sha256/v1",canonicalInputSha256:calculatorInputSha256,canonicalHashScheme:"canonical-json-sha256/v1"},legalReviewCoverage,files:a.results.filter(x=>currentFiles.has(String(x.id))).map(x=>({...x,url:`/api/cases/${id}/artifacts/${x.id}`})),analyses};
}
export function errorResponse(error:unknown){
  const status=error instanceof HttpError?error.status:error instanceof Error&&"status" in error&&[400,403,404,409,422,503].includes(Number(error.status))?Number(error.status):500;
  let message=error instanceof Error?error.message:"처리 중 오류가 발생했습니다.";
  if(/no such table/i.test(message))message="저장소 마이그레이션이 아직 적용되지 않았습니다. 배포 상태를 확인하세요.";
  // Never expose upstream payloads, authorization headers, or credentials.
  message=message.replace(/sk-[\w-]+/g,"[비공개]").slice(0,500);
  return Response.json({error:message,...(status===409&&error instanceof Error&&"details" in error&&error.details?{conflict:error.details}:{}),...(error instanceof Error&&"code" in error&&typeof error.code==="string"?{code:error.code}: {})},{status,headers:{"Cache-Control":"no-store"}});
}
export async function sha256(bytes:ArrayBuffer|Uint8Array):Promise<string>{
  const data=bytes instanceof Uint8Array?new Uint8Array(bytes).buffer:bytes;
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",data))).map(b=>b.toString(16).padStart(2,"0")).join("");
}
