/** Durable source-version-based reassessment orchestration.
 * One bounded AI batch per lease. Never grants a human legal decision or files a document.
 * Source case rows are NEVER mutated by this derived-results processor.
 */
import type {CaseData} from "./domain.ts";
import {RISK_CATALOG} from "./legal-rules.ts";
import {EXECUTION_CONTRACT_VERSION} from "./execution-catalog.ts";
import {legalReviewInputFingerprint} from "./legal-review-identity.ts";
import {referenceIdentity} from "./reference-runtime.ts";
import referenceRelease from "./reference-release.json" with {type:"json"};
import {executeCaseNodes} from "./case-execution.ts";
import {buildCaseWorkflowView} from "./case-workflow-view.ts";
import {AUTOMATIC_DRAFT_REQUIRED_OUTPUTS,automatedDraftEligibility,persistCaseLawgraphReview,type StoredLegalCheck} from "./case-lawgraph-store.ts";
import {summarizeAutomaticLegalReview} from "./case-legal-automation-policy.ts";
import {buildStoredLawgraphDocumentFields} from "./lawgraph-document-field-projection.ts";

export const LEGAL_AUTOMATION_VERSION="case-legal-reassessment/1" as const;
export const LEGAL_AUTOMATION_LEASE_MS=180_000;
const RETRIES=4;
type Live={caseId:string;caseRevision:number;dataVersion:number;calculationRunId:string;inputSha256:string;referenceSha256:string};
type Candidate=Live&{jobId:string|null;jobStatus:string|null;jobLeaseUntil:string|null;nextAttemptAt:string|null};
type Job=Live&{id:string;status:string;attempts:number;completedChecks:number;expectedChecks:number;leaseToken:string|null;leaseUntil:string|null;nextAttemptAt:string|null;legalReviewRunId:string|null;documentRunId:string|null;outcomeJson:string;lastError:string|null};
export interface LegalAutomationServices{
 loadCase:(caseId:string)=>Promise<CaseData>;
 reviewLegal:(caseId:string)=>Promise<{stage:string;remaining?:number;checks?:unknown[]}>;
 processingComplete:(data:CaseData)=>Promise<boolean>;
 generateDraft:(input:{caseId:string;caseRevision:number;dataVersion:number;calculationRunId:string;legalReviewRunId:string;jobId:string;leaseToken:string})=>Promise<{documentRunId:string;artifacts:{id:string;name:string;kind:string}[]}>;
}
const clock=()=>new Date().toISOString();
const later=(seconds:number)=>new Date(Date.now()+seconds*1000).toISOString();
const id=(snapshot:Live)=>"legal-auto:"+snapshot.calculationRunId;
const checkIds=RISK_CATALOG.map(x=>x.id);
const safeCode=(e:unknown)=>e instanceof Error&&/^(?:LEGAL_|CASE_|CALCULATION_|SOURCE_|DOCUMENT_|AUTO_|EXTRACTION_)[A-Z0-9_:]+$/.test(e.message)?e.message.slice(0,160):"LEGAL_AUTOMATION_STAGE_FAILED";
function decode<T>(raw:string,fallback:T):T{try{return JSON.parse(raw) as T}catch{return fallback;}}
async function latest(database:D1Database,caseId:string):Promise<Live|null>{
 return database.prepare("SELECT c.id AS caseId,c.revision AS caseRevision,s.data_version AS dataVersion,h.run_id AS calculationRunId,r.input_sha256 AS inputSha256,r.reference_sha256 AS referenceSha256 FROM cases c JOIN case_data_change_state s ON s.case_id=c.id JOIN case_calculation_heads h ON h.case_id=c.id JOIN case_calculation_runs r ON r.id=h.run_id WHERE c.id=? AND h.data_version=s.data_version AND h.case_revision=c.revision AND r.data_version=s.data_version AND r.case_revision=c.revision AND r.input_sha256=h.input_sha256")
  .bind(caseId).first<Live>();
}
function sameVersion(a:Live|null,b:Live):boolean{
 return !!a&&a.caseRevision===b.caseRevision&&a.dataVersion===b.dataVersion&&a.calculationRunId===b.calculationRunId&&a.inputSha256===b.inputSha256&&a.referenceSha256===b.referenceSha256;
}
async function assertCurrent(database:D1Database,version:Live){
 const current=await latest(database,version.caseId),expectedRef=referenceIdentity()?.sha256??referenceRelease.sha256;
 if(!sameVersion(current,version)||version.referenceSha256!==expectedRef)throw new Error("LEGAL_AUTOMATION_SUPERSEDED");
}
async function note(database:D1Database,job:Job,kind:string,value:unknown){
 await database.prepare("INSERT INTO case_legal_automation_events(case_id,job_id,data_version,event_kind,payload_json,created_at) VALUES(?,?,?,?,?,?)")
  .bind(job.caseId,job.id,job.dataVersion,kind,JSON.stringify(value),clock()).run();
}
async function transition(database:D1Database,job:Job,lease:string,status:string,fields:{
 completedChecks?:number;expectedChecks?:number;legalReviewRunId?:string|null;
 documentRunId?:string|null;outcome?:unknown;nextAttemptAt?:string|null;error?:string|null;
 }={}){
 const now=clock(),updated=await database.prepare(
   "UPDATE case_legal_automation_jobs SET status=?,attempts=0,lease_token=NULL,lease_until=NULL,next_attempt_at=?,completed_checks=?,expected_checks=?,legal_review_run_id=COALESCE(?,legal_review_run_id),document_run_id=COALESCE(?,document_run_id),outcome_json=?,last_error=?,updated_at=? WHERE id=? AND lease_token=? AND status='running' AND lease_until>? AND EXISTS (SELECT 1 FROM cases c JOIN case_data_change_state s ON s.case_id=c.id JOIN case_calculation_heads h ON h.case_id=c.id WHERE c.id=? AND c.revision=? AND s.data_version=? AND h.run_id=? AND h.input_sha256=?)")
   .bind(status,fields.nextAttemptAt??null,fields.completedChecks??job.completedChecks,fields.expectedChecks??job.expectedChecks,
     fields.legalReviewRunId??null,fields.documentRunId??null,JSON.stringify(fields.outcome??decode(job.outcomeJson,{})),fields.error??null,
     now,job.id,lease,now,job.caseId,job.caseRevision,job.dataVersion,job.calculationRunId,job.inputSha256).run();
 if(!updated.meta.changes)throw new Error("LEGAL_AUTOMATION_SUPERSEDED");
 await note(database,job,status,{status,checks:fields.completedChecks??job.completedChecks}).catch(()=>{});
}
async function gatherChecks(database:D1Database,job:Job,data:CaseData){
 const exactFingerprint=await legalReviewInputFingerprint(data,job.referenceSha256,EXECUTION_CONTRACT_VERSION);
 const result=await database.prepare("SELECT payload FROM analyses WHERE case_id=? AND revision=? AND type='legal_advisory' AND json_valid(payload)=1 AND json_extract(payload,'$.calculatorExecution.inputSha256')=? AND json_extract(payload,'$.calculatorExecution.referenceRelease.sha256')=? AND json_extract(payload,'$.calculatorExecution.contractVersion')=? ORDER BY at,id LIMIT 300")
  .bind(job.caseId,job.caseRevision,job.inputSha256,job.referenceSha256,EXECUTION_CONTRACT_VERSION).all<{payload:string}>();
 const found=new Map<string,StoredLegalCheck>(),summaries:string[]=[],models=new Set<string>(),known=new Set(checkIds);
 for(const row of result.results??[]){
  const payload=decode<Record<string,any>|null>(row.payload,null);
  if(!payload||payload.sourceDataVersion!==job.dataVersion||payload.reviewInputFingerprint!==exactFingerprint)continue;
  if(typeof payload.model==="string")models.add(payload.model);
  if(typeof payload.summary==="string"&&payload.summary.trim())summaries.push(payload.summary.slice(0,2000));
  for(const item of Array.isArray(payload.checks)?payload.checks:[]){
   if(!item||!known.has(item.id)||!["pass","fail","missing","conflict","not_applicable","legal_review"].includes(item.status))continue;
   if(![item.factIds,item.ruleIds,item.missingDocuments].every(v=>Array.isArray(v)&&v.every(x=>typeof x==="string")))continue;
   found.set(item.id,{id:item.id,status:item.status,reason:String(item.reason??""),factIds:item.factIds,ruleIds:item.ruleIds,
      missingDocuments:item.missingDocuments,nextAction:String(item.nextAction??"")});
  }
 }
 return {checks:checkIds.flatMap(key=>found.has(key)?[found.get(key)!]:[]),
  summary:[...new Set(summaries)].join("\n").slice(0,12_000),
  model:models.size===1?[...models][0]:null};
}
async function calculationFields(database:D1Database,runId:string){
 const names=[...AUTOMATIC_DRAFT_REQUIRED_OUTPUTS],sql=names.map(()=>"?").join(",");
 const rows=(await database.prepare("SELECT output_name AS outputName,value_json AS valueJson,status FROM case_calculation_features WHERE run_id=? AND output_name IN ("+sql+")")
  .bind(runId,...names).all<{outputName:string;valueJson:string;status:string}>()).results??[];
 return rows.map(row=>({outputName:row.outputName,value:decode(row.valueJson,null),status:row.status}));
}
async function finalizeReview(database:D1Database,job:Job,lease:string,service:LegalAutomationServices){
 await assertCurrent(database,job);
 const data=await service.loadCase(job.caseId);
 if(data.context.revision!==job.caseRevision)throw new Error("LEGAL_AUTOMATION_SUPERSEDED");
 const collected=await gatherChecks(database,job,data),count=collected.checks.length;
 if(count!==checkIds.length){
  const report={error:"LEGAL_REVIEW_COVERAGE_MISMATCH",completed:count,total:checkIds.length,courtApprovalInferred:false};
  await transition(database,job,lease,"attention_required",{completedChecks:count,expectedChecks:checkIds.length,outcome:report});
  return {caseId:job.caseId,status:"attention_required",...report};
 }
 if(!collected.model||!["gpt-6-luna","gpt-6.1-terra"].includes(collected.model))throw new Error("LEGAL_REVIEW_MODEL_CONTRACT_MISMATCH");
 // A missing/invalid draft projection is a separate review deficiency;
 // it must not discard the completed and still useful legal findings.
 const execution=executeCaseNodes(data);
 let documentFields:Awaited<ReturnType<typeof buildStoredLawgraphDocumentFields>>=[];
 let documentFieldProjectionError:string|null=null;
 try{
  const forForms=executeCaseNodes(data,{includeDocumentBindings:true});
  if(!forForms.formBindings)throw new Error("FORM_BINDINGS_UNAVAILABLE");
  documentFields=await buildStoredLawgraphDocumentFields(database,{
    caseData:data,calculationRunId:job.calculationRunId,bindings:forForms.formBindings,
    calculation:forForms.assessment.calculation
  });
 }catch(error){documentFieldProjectionError=error instanceof Error?error.message:"FORM_PROJECTION_UNAVAILABLE";}
 const review=await persistCaseLawgraphReview(database,{caseId:job.caseId,dataVersion:job.dataVersion,
  caseRevision:job.caseRevision,calculationRunId:job.calculationRunId,inputSha256:job.inputSha256,
  model:collected.model,checks:collected.checks,summary:collected.summary,
  documentFields,complete:true,expectedCheckIds:checkIds});
 await assertCurrent(database,job);
 const processingComplete=await service.processingComplete(data);
 const workflow=data.workflowState?await buildCaseWorkflowView(data):null;
 const unresolvedRequired=(workflow?.requirementStates??[]).filter(r=>r.required&&!["satisfied","not_applicable_confirmed","waived_by_review","retired"].includes(r.requirementStatus));
 const projectionBlockers=data.workflowState?.projectionBlockers.length??0;
 const needed=await calculationFields(database,job.calculationRunId);
 // Current saved OCR amounts not reconciled into typed calculator values block
 // unattended draft generation, irrespective of AI check statuses.
 const materialGaps=execution.assessment.calculation.issues.filter(
   issue=>/^CALC_INPUT_(?:UNCONNECTED_MATERIAL|AMOUNT_INVALID|AMOUNT_MISMATCH|SOURCE_INVALID):/.test(issue));
 const pendingCourtPolicy=await database.prepare("SELECT COUNT(*) AS n FROM legal_monitor_alerts WHERE acknowledged_at IS NULL").first<{n:number}>();
 const eligible=automatedDraftEligibility({checks:collected.checks,expectedCheckIds:checkIds,
  complete:true,calculationHeadCurrent:true,
  engineCanGenerateDraft:execution.assessment.generationGate.canGenerateDraft&&processingComplete&&!(pendingCourtPolicy?.n??0),
  requiredCalculationFields:needed,allowHumanReviewPendingForDraft:true,
  explicitFailures:[...(unresolvedRequired.length?["REQUIRED_DOCUMENTS_UNRESOLVED"]:[]),
    ...(projectionBlockers?["SOURCE_PROJECTION_BLOCKED"]:[]),
    ...materialGaps]});
 const report=summarizeAutomaticLegalReview({
  checks:collected.checks,expectedCount:checkIds.length,draftEligibility:eligible,
  calculationIssues:execution.assessment.calculation.issues});
 const outcome={...report,reviewRunId:review.runId,sourceVersion:job.dataVersion,
  processingComplete,pendingCourtPolicyChanges:pendingCourtPolicy?.n??0,
  unresolvedRequiredDocuments:unresolvedRequired.map(r=>({requirementId:r.requirementId,status:r.requirementStatus,missingFields:r.requiredFieldCoverage.missing})),
  projectionBlockers,documentFieldCount:documentFields.length,documentFieldProjectionError,
  summary:collected.summary,
  reviewScope:"Legal advisory and REVIEW DRAFT ONLY. Official forms and human approval are separate.",
  findings:report.findings.slice(0,95)};
 const status=report.draftCandidate?"draft_pending":report.disposition;
 await transition(database,job,lease,status,{
  legalReviewRunId:review.runId,completedChecks:count,expectedChecks:checkIds.length,
  outcome,nextAttemptAt:report.draftCandidate?clock():null});
 return {caseId:job.caseId,status,reviewRunId:review.runId,
  completedChecks:count,findings:report.findings.length,blockers:report.blockers};
}
async function processDraft(database:D1Database,job:Job,lease:string,service:LegalAutomationServices){
 await assertCurrent(database,job);
 if(!job.legalReviewRunId)throw new Error("LEGAL_REVIEW_RUN_MISSING");
 const head=await database.prepare("SELECT review_run_id AS runId,data_version AS dataVersion,case_revision AS caseRevision,calculation_run_id AS calculationRunId FROM case_legal_review_heads WHERE case_id=?")
  .bind(job.caseId).first<{runId:string;dataVersion:number;caseRevision:number;calculationRunId:string}>();
 if(!head||head.runId!==job.legalReviewRunId||head.dataVersion!==job.dataVersion||head.caseRevision!==job.caseRevision||head.calculationRunId!==job.calculationRunId)throw new Error("LEGAL_AUTOMATION_SUPERSEDED");
 const generated=await service.generateDraft({caseId:job.caseId,dataVersion:job.dataVersion,
  caseRevision:job.caseRevision,calculationRunId:job.calculationRunId,legalReviewRunId:job.legalReviewRunId,jobId:job.id,leaseToken:lease});
 await assertCurrent(database,job);
 await transition(database,job,lease,"draft_ready",{
  documentRunId:generated.documentRunId,
  outcome:{...decode<Record<string,unknown>>(job.outcomeJson,{}),drafts:generated.artifacts,
   documentRunId:generated.documentRunId,autoSubmission:false,requiresHumanFinalReview:true}});
 return {caseId:job.caseId,status:"draft_ready",drafts:generated.artifacts.length};
}
async function processJob(database:D1Database,candidate:Candidate,services:LegalAutomationServices){
 const currentRef=referenceIdentity()?.sha256??referenceRelease.sha256;
 if(candidate.referenceSha256!==currentRef)return {caseId:candidate.caseId,status:"stale_reference",reason:"CALCULATION_REFERENCE_STALE"};
 const jobId=id(candidate),now=clock();
 await database.prepare("INSERT OR IGNORE INTO case_legal_automation_jobs(id,case_id,data_version,case_revision,calculation_run_id,input_sha256,reference_sha256,status,expected_checks,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'pending',?,?,?)")
  .bind(jobId,candidate.caseId,candidate.dataVersion,candidate.caseRevision,candidate.calculationRunId,candidate.inputSha256,candidate.referenceSha256,checkIds.length,now,now).run();
 const lease=crypto.randomUUID(),until=new Date(Date.now()+LEGAL_AUTOMATION_LEASE_MS).toISOString();
 const claimed=await database.prepare("UPDATE case_legal_automation_jobs SET status='running',attempts=attempts+1,lease_token=?,lease_until=?,updated_at=? WHERE id=? AND (status IN ('pending','retry_wait','draft_pending') OR (status='running' AND lease_until<?)) AND (next_attempt_at IS NULL OR next_attempt_at<=?) AND EXISTS(SELECT 1 FROM cases c JOIN case_data_change_state s ON s.case_id=c.id JOIN case_calculation_heads h ON h.case_id=c.id WHERE c.id=? AND c.revision=? AND s.data_version=? AND h.run_id=? AND h.input_sha256=?)")
   .bind(lease,until,now,jobId,now,now,candidate.caseId,candidate.caseRevision,candidate.dataVersion,candidate.calculationRunId,candidate.inputSha256).run();
 if(!claimed.meta.changes)return {caseId:candidate.caseId,status:"already_claimed_or_complete"};
 const job=await database.prepare("SELECT id,case_id AS caseId,case_revision AS caseRevision,data_version AS dataVersion,calculation_run_id AS calculationRunId,input_sha256 AS inputSha256,reference_sha256 AS referenceSha256,status,attempts,completed_checks AS completedChecks,expected_checks AS expectedChecks,lease_token AS leaseToken,lease_until AS leaseUntil,next_attempt_at AS nextAttemptAt,legal_review_run_id AS legalReviewRunId,document_run_id AS documentRunId,outcome_json AS outcomeJson,last_error AS lastError FROM case_legal_automation_jobs WHERE id=?")
  .bind(jobId).first<Job>();
 if(!job||job.leaseToken!==lease)throw new Error("LEGAL_AUTOMATION_CLAIM_LOST");
 try{
  await assertCurrent(database,job);
  const source=await services.loadCase(job.caseId);
  if((source.referenceTest||source.structuredTest)&&!source.evaluationClone){
    const report={state:"skipped_fixture",reason:"Protected synthetic/reference case: unattended AI work disabled",courtApprovalInferred:false};
    await transition(database,job,lease,"skipped_fixture",{outcome:report});
    return {caseId:job.caseId,status:"skipped_fixture"};
  }
  if(job.legalReviewRunId&&["draft_pending","retry_wait","running"].includes(candidate.jobStatus??""))return await processDraft(database,job,lease,services);
  const response=await services.reviewLegal(job.caseId);
  await assertCurrent(database,job);
  if(response.stage==="legal_snapshot_changed")throw new Error("LEGAL_AUTOMATION_SUPERSEDED");
  if(response.stage!=="legal_review"&&response.stage!=="legal_complete")throw new Error("LEGAL_REVIEW_STAGE_UNEXPECTED");
  if(response.remaining!==undefined&&(!Number.isSafeInteger(response.remaining)||response.remaining<0||response.remaining>checkIds.length))throw new Error("LEGAL_REVIEW_INVALID_REMAINING");
  if((response.remaining??0)>0){
   const completed=checkIds.length-response.remaining!;
   await transition(database,job,lease,"pending",{completedChecks:completed,expectedChecks:checkIds.length,
    nextAttemptAt:later(8),outcome:{state:"reviewing",completed,total:checkIds.length,courtApprovalInferred:false}});
   return {caseId:job.caseId,status:"reviewing",completedChecks:completed,expectedChecks:checkIds.length};
  }
  return await finalizeReview(database,job,lease,services);
 }catch(error){
  const code=safeCode(error),stale=code==="LEGAL_AUTOMATION_SUPERSEDED";
  const attempts=job.attempts,terminal=!stale&&attempts>=RETRIES;
  const status=stale?"superseded":terminal?"failed":"retry_wait";
  const delay=stale?null:terminal?null:later(Math.min(900,30*2**Math.max(0,attempts-1)));
  const at=clock();
  await database.prepare("UPDATE case_legal_automation_jobs SET status=?,lease_token=NULL,lease_until=NULL,next_attempt_at=?,last_error=?,updated_at=? WHERE id=? AND lease_token=? AND status='running'")
   .bind(status,delay,code,at,job.id,lease).run();
  await note(database,job,status,{code,retryAfter:delay});
  return {caseId:job.caseId,status,errorCode:code,retryAfter:delay};
 }
}
export async function drainCaseLegalAutomation(database:D1Database,input:{
 caseId?:string;limit?:number;services:LegalAutomationServices
}){
 const limit=input.limit??1;
 if(!Number.isSafeInteger(limit)||limit<1||limit>5||input.caseId!==undefined&&(!input.caseId.trim()||input.caseId.length>300))
  throw new Error("LEGAL_AUTOMATION_INVALID_QUERY");
 const now=clock(),ref=referenceIdentity()?.sha256??referenceRelease.sha256;
 const filter=input.caseId?" AND c.id=?":"";
 const sql="SELECT c.id AS caseId,c.revision AS caseRevision,s.data_version AS dataVersion,h.run_id AS calculationRunId,r.input_sha256 AS inputSha256,r.reference_sha256 AS referenceSha256,j.id AS jobId,j.status AS jobStatus,j.lease_until AS jobLeaseUntil,j.next_attempt_at AS nextAttemptAt FROM cases c JOIN case_data_change_state s ON s.case_id=c.id JOIN case_calculation_heads h ON h.case_id=c.id JOIN case_calculation_runs r ON r.id=h.run_id LEFT JOIN case_legal_automation_jobs j ON j.case_id=c.id AND j.data_version=s.data_version AND j.calculation_run_id=h.run_id WHERE h.data_version=s.data_version AND h.case_revision=c.revision AND r.reference_sha256=? AND (j.id IS NULL OR ((j.status IN ('pending','retry_wait','draft_pending') OR j.status='running' AND j.lease_until<?) AND (j.next_attempt_at IS NULL OR j.next_attempt_at<=?)))"+filter+" ORDER BY COALESCE(j.updated_at,s.last_changed_at),c.id LIMIT ?";
 const candidates=(await database.prepare(sql).bind(ref,now,now,...(input.caseId?[input.caseId]:[]),limit).all<Candidate>()).results??[];
 const results=[];
 for(const c of candidates)results.push(await processJob(database,c,input.services));
 return {scanned:candidates.length,reviewing:results.filter(x=>x.status==="reviewing").length,
  draftReady:results.filter(x=>x.status==="draft_ready").length,
  attention:results.filter(x=>["attention_required","review_required","failed"].includes(x.status)).length,results};
}
/** Explicit operator recovery for a failed AI or drafting stage.
 * Only the same current source+calculation version may be retried. */
export async function retryFailedCaseLegalAutomation(database:D1Database,input:{caseId:string;expectedDataVersion:number}){
 if(!input.caseId||!Number.isSafeInteger(input.expectedDataVersion)||input.expectedDataVersion<1)throw new Error("LEGAL_AUTOMATION_RETRY_INVALID_INPUT");
 const current=await latest(database,input.caseId);
 if(!current||current.dataVersion!==input.expectedDataVersion)throw new Error("LEGAL_AUTOMATION_RETRY_STALE_VERSION");
 const row=await database.prepare("SELECT id,status,attempts,data_version AS dataVersion,case_revision AS caseRevision,calculation_run_id AS calculationRunId FROM case_legal_automation_jobs WHERE case_id=? AND data_version=? AND calculation_run_id=?")
  .bind(input.caseId,current.dataVersion,current.calculationRunId).first<{id:string;status:string;attempts:number;dataVersion:number;caseRevision:number;calculationRunId:string}>();
 if(!row||row.status!=="failed"||row.caseRevision!==current.caseRevision)throw new Error("LEGAL_AUTOMATION_NO_CURRENT_FAILED_JOB");
 const updated=await database.prepare("UPDATE case_legal_automation_jobs SET status='retry_wait',attempts=0,next_attempt_at=?,last_error=NULL,updated_at=? WHERE id=? AND status='failed' AND case_revision=? AND data_version=?")
  .bind(clock(),clock(),row.id,current.caseRevision,current.dataVersion).run();
 if(!updated.meta.changes)throw new Error("LEGAL_AUTOMATION_RETRY_CONFLICT");
 await database.prepare("INSERT INTO case_legal_automation_events(case_id,job_id,data_version,event_kind,payload_json,created_at) VALUES(?,?,?,?,?,?)")
  .bind(input.caseId,row.id,current.dataVersion,"manual_retry_requested",JSON.stringify({previousStatus:"failed",newStatus:"retry_wait",courtApprovalInferred:false}),clock()).run();
 return {caseId:input.caseId,dataVersion:current.dataVersion,status:"retry_wait",jobId:row.id,automaticCourtApproval:false};
}
export async function readCaseLegalAutomation(database:D1Database,caseId:string){
 const row=await database.prepare("SELECT c.revision AS currentRevision,s.data_version AS currentDataVersion,s.last_changed_at AS lastChangedAt,h.run_id AS currentCalculationRunId,j.id AS jobId,j.status,j.reference_sha256 AS referenceSha256,j.data_version AS dataVersion,j.case_revision AS caseRevision,j.calculation_run_id AS calculationRunId,j.completed_checks AS completedChecks,j.expected_checks AS expectedChecks,j.lease_until AS leaseUntil,j.next_attempt_at AS nextAttemptAt,j.outcome_json AS outcomeJson,j.last_error AS lastError,j.legal_review_run_id AS reviewRunId,j.document_run_id AS documentRunId,j.updated_at AS updatedAt FROM cases c LEFT JOIN case_data_change_state s ON s.case_id=c.id LEFT JOIN case_calculation_heads h ON h.case_id=c.id LEFT JOIN case_legal_automation_jobs j ON j.case_id=c.id AND j.calculation_run_id=h.run_id AND j.data_version=s.data_version WHERE c.id=?")
  .bind(caseId).first<{currentRevision:number;currentDataVersion:number|null;lastChangedAt:string|null;currentCalculationRunId:string|null;jobId:string|null;status:string|null;referenceSha256:string|null;dataVersion:number|null;caseRevision:number|null;calculationRunId:string|null;completedChecks:number|null;expectedChecks:number|null;leaseUntil:string|null;nextAttemptAt:string|null;outcomeJson:string|null;lastError:string|null;reviewRunId:string|null;documentRunId:string|null;updatedAt:string|null}>();
 if(!row)throw new Error("LEGAL_AUTOMATION_CASE_NOT_FOUND");
 const expectedReference=referenceIdentity()?.sha256??referenceRelease.sha256;
 const stale=!!row.jobId&&(row.currentRevision!==row.caseRevision||row.currentCalculationRunId!==row.calculationRunId||row.currentDataVersion!==row.dataVersion||row.referenceSha256!==expectedReference);
 const dueAt=row.lastChangedAt&&Number.isFinite(Date.parse(row.lastChangedAt))
   ?new Date(Date.parse(row.lastChangedAt)+600_000).toISOString():null;
 const remainingMs=dueAt?Math.max(0,Date.parse(dueAt)-Date.now()):null;
 const rawOutcome=decode<Record<string,unknown>>(row.outcomeJson??"{}",{});
 const outcome=stale?{...rawOutcome,drafts:[],previousDraftArchived:true,
  staleWarning:"법률기준 또는 사건 데이터 변경으로 기존 자동작성본을 최신 검토본으로 제시하지 않습니다."}:rawOutcome;
 const events=row.jobId?(await database.prepare("SELECT id,event_kind AS kind,payload_json AS payload,created_at AS createdAt FROM case_legal_automation_events WHERE case_id=? AND job_id=? ORDER BY id DESC LIMIT 30")
  .bind(caseId,row.jobId).all<{id:number;kind:string;payload:string;createdAt:string}>()).results??[]:[];
 return {version:LEGAL_AUTOMATION_VERSION,caseId,currentDataVersion:row.currentDataVersion,currentRevision:row.currentRevision,quietDueAt:dueAt,remainingMs,
  calculationRunId:row.currentCalculationRunId,jobId:row.jobId,status:stale?"stale":row.status??(remainingMs!==null&&remainingMs>0?"debouncing":"waiting_for_calculation"),
  completedChecks:row.completedChecks??0,expectedChecks:row.expectedChecks??checkIds.length,
  leaseUntil:row.leaseUntil,nextAttemptAt:row.nextAttemptAt,reviewRunId:row.reviewRunId,
  documentRunId:row.documentRunId,lastError:row.lastError,updatedAt:row.updatedAt,
  outcome,events:events.map(e=>({id:e.id,kind:e.kind,at:e.createdAt,details:decode(e.payload,{})})),
  autoSubmission:false,automaticCourtApproval:false,humanFinalReviewRequired:true};
}
