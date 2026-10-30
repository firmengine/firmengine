import type {CaseData} from "./domain.ts";
import {runCaseCalculatorNode} from "./case-agent.ts";
import {getCaseDataUpdateState} from "./case-data-watch.ts";
import {persistCaseCalculationFeatures} from "./case-calculation-feature-store.ts";
import {buildCaseFeatureSnapshot} from "./case-feature-snapshot.ts";
import {referenceIdentity} from "./reference-runtime.ts";
import referenceRelease from "./reference-release.json" with {type:"json"};

export const CASE_DATA_QUIET_PERIOD_MS=600_000;
type Clock=()=>number;
const instant=(value:string|null|undefined)=>{
  if(!value)return null;
  const iso=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)?value.replace(" ","T")+"Z":value;
  const time=Date.parse(iso);return Number.isFinite(time)?time:null;
};
/** Pure clock-based policy; computed writes do not extend the source quiet time. */
export function caseDataQuietWindow(lastChangedAt:string|null|undefined,now=Date.now()){
  const changed=instant(lastChangedAt);
  if(changed===null)return {isQuiet:false,dueAt:null,remainingMs:null};
  const due=changed+CASE_DATA_QUIET_PERIOD_MS;
  return {isQuiet:now>=due,dueAt:new Date(due).toISOString(),remainingMs:Math.max(0,due-now)};
}
export async function getCaseDataRecomputeEligibility(database:D1Database,input:{caseId:string;now?:Clock}){
  const state=await getCaseDataUpdateState(database,{caseId:input.caseId});
  return {...state,...caseDataQuietWindow(state.lastChangedAt,(input.now??Date.now)())};
}

async function sourceHeads(database:D1Database,caseId:string){
  const consultation=await database.prepare("SELECT active_run_id AS activeRunId,revision FROM consultation_heads WHERE case_id = ?").bind(caseId).first<{activeRunId:string|null;revision:number}>();
  const extraction=(await database.prepare("SELECT source_document_id AS documentId,page,run_id AS runId,case_revision AS caseRevision FROM case_extraction_heads WHERE case_id = ? ORDER BY source_document_id,page").bind(caseId).all<{documentId:string;page:number;runId:string;caseRevision:number}>()).results;
  return {consultationRunId:consultation?.activeRunId??null,consultationRevision:consultation?.revision??0,extractionHeads:extraction};
}

/** Original deterministic calculator only. No OCR, advisory model or recognition transition. */
export async function recomputeCaseDataUpdate(database:D1Database,input:{caseId:string;loadCase:()=>Promise<CaseData>;now?:Clock}){
  const state=await getCaseDataRecomputeEligibility(database,input);
  if(!state.dataVersion||!state.lastChangedAt)return {caseId:input.caseId,status:"no_source_version" as const,dataVersion:state.dataVersion};
  if(!state.isQuiet)return {caseId:input.caseId,status:"debouncing" as const,dataVersion:state.dataVersion,dueAt:state.dueAt,remainingMs:state.remainingMs};
  const head=await database.prepare("SELECT h.run_id AS runId,h.data_version AS dataVersion,h.case_revision AS caseRevision,r.reference_sha256 AS referenceSha256 FROM case_calculation_heads h JOIN case_calculation_runs r ON r.id=h.run_id WHERE h.case_id = ?").bind(input.caseId).first<{runId:string;dataVersion:number;caseRevision:number;referenceSha256:string}>();
  if(head&&head.dataVersion===state.dataVersion&&head.caseRevision===state.currentCaseRevision&&head.referenceSha256===(referenceIdentity()?.sha256??referenceRelease.sha256))return {caseId:input.caseId,status:"current" as const,dataVersion:state.dataVersion,runId:head.runId};
  const loaded=await input.loadCase();
  if(loaded.context.id!==input.caseId||loaded.context.revision!==state.currentCaseRevision)return {caseId:input.caseId,status:"superseded" as const,dataVersion:state.dataVersion};
  let snapshot:Awaited<ReturnType<typeof buildCaseFeatureSnapshot>>;
  try{snapshot=await buildCaseFeatureSnapshot(database,{caseData:loaded});}
  catch(error){if(error instanceof Error&&error.message==="CASE_REVISION_MISMATCH")return {caseId:input.caseId,status:"superseded" as const,dataVersion:state.dataVersion};throw error;}
  if(snapshot.sourceDataVersion!==state.dataVersion)return {caseId:input.caseId,status:"superseded" as const,dataVersion:state.dataVersion};
  const data=snapshot.caseData;
  const sources={...await sourceHeads(database,input.caseId),featureSnapshot:{inputOrigin:snapshot.inputOrigin,legacySnapshotFallback:snapshot.legacySnapshotFallback,warnings:snapshot.warnings,sourceHeads:snapshot.sourceHeads,legalRecognition:snapshot.legalRecognition}},before=await getCaseDataRecomputeEligibility(database,input);
  if(before.dataVersion!==state.dataVersion||before.currentCaseRevision!==state.currentCaseRevision||!before.isQuiet)return {caseId:input.caseId,status:"superseded" as const,dataVersion:state.dataVersion};
  const calculator=await runCaseCalculatorNode(data);
  const after=await getCaseDataRecomputeEligibility(database,input);
  if(after.dataVersion!==state.dataVersion||after.currentCaseRevision!==data.context.revision||!after.isQuiet)return {caseId:input.caseId,status:"superseded" as const,dataVersion:state.dataVersion};
  try{
    const saved=await persistCaseCalculationFeatures(database,{caseId:input.caseId,dataVersion:state.dataVersion,caseRevision:data.context.revision,inputSha256:calculator.receipt.inputSha256,execution:calculator.execution,sourceHeads:sources,referenceRelease:calculator.receipt.referenceRelease});
    return {caseId:input.caseId,status:"computed" as const,dataVersion:state.dataVersion,caseRevision:data.context.revision,runId:saved.runId,features:saved.features,calculationStatus:saved.status,missingCount:saved.missingCount,headPromoted:saved.headPromoted,assessmentStatus:calculator.execution.assessment.status};
  }catch(error){if(error instanceof Error&&error.message.includes("CALCULATION_VERSION_MISMATCH"))return {caseId:input.caseId,status:"superseded" as const,dataVersion:state.dataVersion};throw error;}
}

/** Do not select rows before the quiet deadline: they must never occupy the
 * limited Cron window ahead of ready cases. Retry/lease state is per CASE,
 * never global, so one failure cannot starve later cases.
 * D1 remains the authority; no model is run by this calculation poller. */
export async function drainCaseDataUpdates(database:D1Database,input:{
 caseId?:string;limit?:number;loadCase:(caseId:string)=>Promise<CaseData>;now?:Clock
}){
 const limit=Math.min(10,Math.max(1,Number.isSafeInteger(input.limit)?input.limit!:3));
 const ms=(input.now??Date.now)(),at=new Date(ms).toISOString(),
   cutoff=new Date(ms-CASE_DATA_QUIET_PERIOD_MS).toISOString();
 const reference=referenceIdentity()?.sha256??referenceRelease.sha256;
 const sql=[
   "SELECT state.case_id AS caseId,state.data_version AS dataVersion,",
   "current_case.revision AS caseRevision FROM case_data_change_state state",
   "JOIN cases current_case ON current_case.id=state.case_id",
   "LEFT JOIN case_calculation_heads calculated ON calculated.case_id=state.case_id",
   "LEFT JOIN case_calculation_runs calc_run ON calc_run.id=calculated.run_id",
   "LEFT JOIN case_calculation_poll_jobs poll ON poll.case_id=state.case_id",
   "WHERE (calculated.case_id IS NULL OR calculated.data_version<state.data_version",
   "OR calculated.case_revision<>current_case.revision OR calc_run.reference_sha256 IS NULL",
   "OR calc_run.reference_sha256<>?) AND state.last_changed_at<=?",
   "AND (poll.case_id IS NULL OR poll.data_version<>state.data_version",
   "OR poll.case_revision<>current_case.revision OR poll.reference_sha256<>?",
   "OR (poll.status='retry_wait' AND poll.next_attempt_at<=?)",
   "OR (poll.status='running' AND poll.lease_until<=?))",
   input.caseId?"AND state.case_id=?":"",
   "ORDER BY state.last_changed_at,state.case_id LIMIT ?"
 ].filter(Boolean).join(" ");
 const candidates=(await database.prepare(sql)
   .bind(reference,cutoff,reference,at,at,...(input.caseId?[input.caseId]:[]),limit)
   .all<{caseId:string;dataVersion:number;caseRevision:number}>()).results??[];
 const results=[];
 for(const row of candidates){
   const lease=crypto.randomUUID(),until=new Date(ms+180_000).toISOString();
   // CAS-style UPSERT. Two workers selecting the same case cannot both claim.
   const claim=await database.prepare([
     "INSERT INTO case_calculation_poll_jobs",
     "(case_id,data_version,case_revision,reference_sha256,status,attempts,lease_token,lease_until,next_attempt_at,last_error,updated_at)",
     "SELECT ?,?,?,?,'running',1,?,?,NULL,NULL,? WHERE EXISTS", 
      "(SELECT 1 FROM cases c JOIN case_data_change_state s ON s.case_id=c.id",
      "WHERE c.id=? AND c.revision=? AND s.data_version=?)",
     "ON CONFLICT(case_id) DO UPDATE SET data_version=excluded.data_version,case_revision=excluded.case_revision,",
     "reference_sha256=excluded.reference_sha256,status='running',",
     "attempts=CASE WHEN case_calculation_poll_jobs.data_version=excluded.data_version",
     "AND case_calculation_poll_jobs.case_revision=excluded.case_revision",
     "AND case_calculation_poll_jobs.reference_sha256=excluded.reference_sha256",
     "THEN case_calculation_poll_jobs.attempts+1 ELSE 1 END,",
     "lease_token=excluded.lease_token,lease_until=excluded.lease_until,next_attempt_at=NULL,",
     "last_error=NULL,updated_at=excluded.updated_at",
     "WHERE case_calculation_poll_jobs.data_version<>excluded.data_version",
     "OR case_calculation_poll_jobs.case_revision<>excluded.case_revision",
     "OR case_calculation_poll_jobs.reference_sha256<>excluded.reference_sha256",
     "OR (case_calculation_poll_jobs.status='retry_wait'",
     "AND case_calculation_poll_jobs.next_attempt_at<=excluded.updated_at)",
     "OR (case_calculation_poll_jobs.status='running'",
     "AND case_calculation_poll_jobs.lease_until<=excluded.updated_at)"
    ].join(" ")).bind(row.caseId,row.dataVersion,row.caseRevision,reference,lease,until,at,
      row.caseId,row.caseRevision,row.dataVersion).run();
   if(!claim.meta.changes){results.push({caseId:row.caseId,dataVersion:row.dataVersion,status:"already_claimed" as const});continue;}
   try{
     const value=await recomputeCaseDataUpdate(database,{
       caseId:row.caseId,loadCase:()=>input.loadCase(row.caseId),now:input.now
     });
     // A successful or superseded attempt must NOT cool down the newer source version.
     await database.prepare("DELETE FROM case_calculation_poll_jobs WHERE case_id=? AND lease_token=?")
       .bind(row.caseId,lease).run();
     results.push(value);
   }catch(error){
     const receipt=await database.prepare("SELECT attempts FROM case_calculation_poll_jobs WHERE case_id=? AND lease_token=?")
       .bind(row.caseId,lease).first<{attempts:number}>();
     const attempts=receipt?.attempts??1,terminal=attempts>=5;
     const code=error instanceof Error&&/^[A-Z][A-Z0-9_]{5,100}$/.test(error.message)
       ?error.message:"CASE_CALCULATION_AUTOMATION_FAILED";
     const retryAt=terminal?null:new Date(ms+Math.min(900_000,30_000*2**Math.max(0,attempts-1))).toISOString();
     await database.prepare("UPDATE case_calculation_poll_jobs SET status=?,next_attempt_at=?,last_error=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE case_id=? AND lease_token=?")
       .bind(terminal?"failed":"retry_wait",retryAt,code,at,row.caseId,lease).run();
     results.push({caseId:row.caseId,dataVersion:row.dataVersion,status:terminal?"failed" as const:"retry_wait" as const,error:code,nextAttemptAt:retryAt});
   }
 }
 return {scanned:candidates.length,computed:results.filter(x=>x.status==="computed").length,
    debouncing:results.filter(x=>x.status==="debouncing").length,results};
}
export const drainDueCaseDataUpdates=drainCaseDataUpdates;

/** Human-triggered retry of a CURRENT failed calculation poll only.
 * Does not change source evidence, approvals, or the 10-minute clock. */
export async function retryFailedCaseCalculationPoll(database:D1Database,input:{caseId:string;expectedDataVersion:number}){
 if(!input.caseId||input.caseId.length>300||!Number.isSafeInteger(input.expectedDataVersion)||input.expectedDataVersion<1)
   throw new Error("CASE_CALCULATION_POLL_RETRY_INVALID_INPUT");
 const state=await getCaseDataUpdateState(database,{caseId:input.caseId});
 if(state.dataVersion!==input.expectedDataVersion)throw new Error("CASE_CALCULATION_POLL_RETRY_STALE_SOURCE");
 const ref=referenceIdentity()?.sha256??referenceRelease.sha256,at=new Date().toISOString();
 const changed=await database.prepare("UPDATE case_calculation_poll_jobs SET status='retry_wait',attempts=0,next_attempt_at=?,last_error=NULL,lease_token=NULL,lease_until=NULL,updated_at=? WHERE case_id=? AND status='failed' AND data_version=? AND case_revision=? AND reference_sha256=? AND EXISTS (SELECT 1 FROM case_data_change_state s JOIN cases c ON c.id=s.case_id WHERE s.case_id=? AND s.data_version=? AND c.revision=?)")
   .bind(at,at,input.caseId,state.dataVersion,state.currentCaseRevision,ref,input.caseId,state.dataVersion,state.currentCaseRevision).run();
 if(!changed.meta.changes)throw new Error("CASE_CALCULATION_POLL_NO_CURRENT_FAILED_JOB");
 return {caseId:input.caseId,dataVersion:state.dataVersion,status:"retry_wait" as const,nextAttemptAt:at};
}
/** Read-only operator status. No model execution or event acknowledgement. */
export async function caseCalculationPollHealth(database:D1Database,caseId:string){
 const row=await database.prepare("SELECT p.case_id AS caseId,p.data_version AS dataVersion,p.case_revision AS caseRevision,p.reference_sha256 AS referenceSha256,p.status,p.attempts,p.lease_until AS leaseUntil,p.next_attempt_at AS nextAttemptAt,p.last_error AS error,s.data_version AS currentDataVersion,c.revision AS currentRevision FROM case_calculation_poll_jobs p JOIN cases c ON c.id=p.case_id JOIN case_data_change_state s ON s.case_id=p.case_id WHERE p.case_id=?")
  .bind(caseId).first<{caseId:string;dataVersion:number;caseRevision:number;referenceSha256:string;status:string;attempts:number;leaseUntil:string|null;nextAttemptAt:string|null;error:string|null;currentDataVersion:number;currentRevision:number}>();
 if(!row)return {caseId,status:"no_poll_error" as const};
 const stale=row.dataVersion!==row.currentDataVersion||row.caseRevision!==row.currentRevision||row.referenceSha256!==(referenceIdentity()?.sha256??referenceRelease.sha256);
 return {caseId,status:stale?"superseded":row.status,attempts:row.attempts,nextAttemptAt:row.nextAttemptAt,
   leaseUntil:row.leaseUntil,errorCode:row.error,sourceDataVersion:row.dataVersion};
}
