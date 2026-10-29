import { isProtectedCaseId } from "./protected-case.ts";
import { getCase,caseStateFingerprint,db,actor,drainCaseRecomputeJobs,caseExtras } from "./server-store";
import { caseWorkflow } from "./case-workflow-state.ts";
import { currentFacts } from "./domain.ts";
import { buildCaseWorkflowView } from "./case-workflow-view.ts";
import { scanCaseSubstitutions } from "./case-substitution-watch.ts";
import { taskSummary } from "./case-tasks.ts";
import { rolesForActor } from "./app-roles";
import { getConsultationView } from "./intake-store";
import { executeCaseNodes } from "./case-execution.ts";
import { FORM_CONTRACTS } from "./form-contracts.ts";
import { legalReviewInputFingerprint,projectLegalRunConflicts } from "./legal-review-identity.ts";
import { legalCheckCoverageComplete } from "./legal-review-packet.ts";
import { RISK_CATALOG } from "./legal-rules.ts";
import { referenceIdentity } from "./reference-runtime.ts";
import { EXECUTION_CONTRACT_VERSION } from "./execution-catalog.ts";
import referenceRelease from "./reference-release.json" with { type: "json" };
import { workflowHealth,type HealthJob,type HealthCommand } from "./workflow-health.ts";
import { commandHash } from "./case-command-contract.ts";
export async function caseWorkflowResponse(caseId:string){
  await drainCaseRecomputeJobs(caseId,1);
  const data=await getCase(caseId),workflow=caseWorkflow(data.workflowState);
  const [intake,identityRows,pendingPolicy,activeConsultation]=await Promise.all([
    getConsultationView(caseId),
    db().prepare("SELECT source_document_id AS documentId,page,shared_document_type_id AS documentTypeId FROM document_instances WHERE case_id=?").bind(caseId).all<{documentId:string;page:number;documentTypeId:string|null}>(),
    db().prepare("SELECT (SELECT COUNT(*) FROM legal_monitor_alerts WHERE acknowledged_at IS NULL) AS count,MAX(created_at) AS latest FROM legal_monitor_alerts").first<{count:number;latest:string|null}>(),
    db().prepare("SELECT h.active_run_id AS runId,r.catalog_version AS catalogVersion FROM consultation_heads h LEFT JOIN consultation_runs r ON r.id=h.active_run_id AND r.status='complete' AND r.case_id=h.case_id WHERE h.case_id=?").bind(caseId).first<{runId:string|null;catalogVersion:number|null}>()
  ]);
  const observed=new Map<string,Set<string>>();
  for(const row of identityRows.results){
    const key=row.documentId+":"+row.page,ids=observed.get(key)??new Set<string>();
    if(row.documentTypeId)ids.add(row.documentTypeId);
    observed.set(key,ids);
  }
  const pageTypes=[...observed].map(([key,ids])=>({documentId:key.slice(0,key.lastIndexOf(":")),page:Number(key.slice(key.lastIndexOf(":")+1)),
    documentTypeId:ids.size===1?[...ids][0]:null}));
  const [view,roles,recomputeJobs,extras,commandRows]=await Promise.all([
    buildCaseWorkflowView(data,{catalogVersion:intake.catalogVersion,pendingCourtPolicyChange:!!pendingPolicy?.count,latestCourtPolicyAlertAt:pendingPolicy?.latest,activeIntakeRunId:activeConsultation?.runId??null,activeIntakeCatalogVersion:activeConsultation?.catalogVersion??null,pageTypes}),rolesForActor(await actor(),caseId),
    db().prepare("SELECT id,job_kind AS kind,status,attempts,next_attempt_at AS nextAttemptAt,last_error AS lastError,created_at AS createdAt,updated_at AS updatedAt FROM case_recompute_jobs WHERE case_id=? ORDER BY created_at DESC LIMIT 51").bind(caseId).all<HealthJob>(),
    caseExtras(data),
    db().prepare("SELECT command_id AS commandId,command_type AS commandType,after_revision AS revision,created_at AS at FROM case_mutation_receipts WHERE case_id=? ORDER BY created_at DESC LIMIT 21").bind(caseId).all<HealthCommand>(),
  ]);
  // Materialize current reversible visibility on case-view read as well as on
  // external DB-agent polls. Missing migration cannot suppress a request.
  let substitutionWatch:Record<string,unknown>={status:"no_reviewed_substitutions"};
  if(workflow.requirements.some(req=>req.substitutionReview)){
    try{
      substitutionWatch=await scanCaseSubstitutions(db(),{
        caseId,source:{getCase,getCatalogVersion:async()=>intake.catalogVersion}
      });
    }catch(error){
      substitutionWatch={status:"unavailable",reason:error instanceof Error?error.message:"SUBSTITUTION_MONITOR_FAILED"};
    }
  }
  const execution=executeCaseNodes(data);
  const writerReceipt=data.exportManifest?.documentWriter;
  const currentArtifacts=(data.exportManifest?.files??[]).filter(file=>file.status==="current");
  const artifactFormCodes=new Map((writerReceipt?.formResults??[]).map(form=>[form.artifactKind,form.formCode]));
  const artifacts=currentArtifacts.map(file=>({id:file.id,name:file.name,hash:file.hash,formCode:artifactFormCodes.get(file.kind)??null,status:file.status}));
  const currentArtifactsById=new Map(currentArtifacts.map(file=>[file.id,file]));
  const fieldBases=(writerReceipt?.fieldBases??[]).filter(base=>currentArtifactsById.get(base.artifactId)?.hash===base.artifactHash);
  const legalReference=referenceIdentity()?.sha256??referenceRelease.sha256,legalFingerprint=await legalReviewInputFingerprint(data,legalReference,EXECUTION_CONTRACT_VERSION);
  const legalRows=await db().prepare("SELECT id,type,payload FROM analyses WHERE case_id=? AND type IN ('legal_review','legal_advisory') ORDER BY at DESC,id DESC LIMIT 101").bind(caseId).all<{id:string;type:string;payload:string}>();
  const legalCoverageTruncated=legalRows.results.length>100,rawLegalRuns=[] as {runId:string;id:string;checkId:string;subjectFingerprint:string;dependencyFingerprint:string;title:string;status:string;factIds:string[];truncated:boolean;coverageComplete:boolean}[];
  for(const row of legalRows.results.slice(0,100)){
    let payload:any;try{payload=JSON.parse(row.payload);}catch{continue;}
    const receipt=payload?.calculatorExecution;if(payload?.reviewInputFingerprint!==legalFingerprint||receipt?.referenceRelease?.sha256!==legalReference||receipt?.contractVersion!==EXECUTION_CONTRACT_VERSION)continue;
    const coverage=payload.evidenceCoverage??{};
    for(const check of Array.isArray(payload.checks)?payload.checks:[]){
      if(typeof check?.id!=="string"||!Array.isArray(check.factIds))continue;
      const sourceRisk=RISK_CATALOG.find(risk=>risk.id===check.id);if(!sourceRisk)continue;
      const risk={id:sourceRisk.id,title:sourceRisk.title,conditions:String(sourceRisk.conditions??""),features:sourceRisk.required_features??[],request:String(sourceRisk.evidence_request??""),legalRuleIds:sourceRisk.current_rule_ids??[],manual:!sourceRisk.implementation.may_auto_clear};
      const factIds=[...new Set(check.factIds.filter((id:unknown)=>typeof id==="string"))] as string[];
      rawLegalRuns.push({runId:row.id,id:row.id,checkId:check.id,subjectFingerprint:await commandHash({checkId:check.id,factIds}),dependencyFingerprint:await commandHash({input:legalFingerprint,reference:legalReference,contract:EXECUTION_CONTRACT_VERSION,checkId:check.id}),title:check.title??check.id,status:String(check.status??"unknown"),factIds,truncated:false,coverageComplete:legalCheckCoverageComplete(risk,coverage)});
    }
  }
  const legalRuns=projectLegalRunConflicts(rawLegalRuns).map(({id:_id,subjectFingerprint:_subject,dependencyFingerprint:_dependency,...run})=>run);
  const stateFingerprint=await caseStateFingerprint(data);
  const health=workflowHealth({data,stateFingerprint,jobs:recomputeJobs.results.slice(0,50),commands:commandRows.results.slice(0,20),jobsTruncated:recomputeJobs.results.length>50,commandsTruncated:commandRows.results.length>20,requiredUnresolved:view.requirementStates.filter(item=>!["satisfied","not_applicable_confirmed","waived_by_review","retired"].includes(item.requirementStatus)).length,reconciliationIssues:execution.planReconciliation.issues,now:new Date().toISOString()});
  return {caseId,revision:data.context.revision,stateFingerprint,workflow,...view,substitutionWatch,roles,intake:intake.run?{runId:intake.run.id,stale:!!intake.run.stale}:null,
    health,
    artifacts,fieldBases,legalRuns,legalCoverageTruncated,
    documents:data.documents.filter(d=>d.status==="active").map(d=>({id:d.id,name:d.name,sha256:d.sha256,pages:d.pages,status:d.status})),
    proofCandidates:currentFacts(data).filter(f=>f.state==="verified"&&f.recognition==="accepted"&&f.canonicalFieldId).slice(0,500).map(f=>({id:f.id,fieldId:f.canonicalFieldId,subjectId:f.subjectId,sourcePages:f.refs.map(ref=>({documentId:ref.documentId,page:ref.page}))})),
    entities:[{id:data.context.id,label:data.context.caseName,kind:"person"},...data.incomes.map(v=>({id:v.id,label:v.label,kind:"income"})),...data.debts.map(v=>({id:v.id,label:v.creditor,kind:"debt"})),...data.assets.map(v=>({id:v.id,label:v.label,kind:"asset"}))],
    formFields:[...new Map(Object.values(FORM_CONTRACTS).flatMap(form=>form.fields.map(f=>[f.token,{token:f.token,kind:f.kind}] as const))).values()],
    tasks:taskSummary(workflow.tasks),recomputeJobs:recomputeJobs.results,planReconciliation:execution.planReconciliation,
    diagnostics:{protected:await isProtectedCaseId(caseId),fixtureReadOnly:!!(data.structuredTest||data.referenceTest)&&!data.evaluationClone,projectionBlockers:workflow.projectionBlockers.length,pendingJobs:recomputeJobs.results.filter((j:{status?:unknown})=>["pending","running","retry_wait","failed"].includes(String(j.status))).length,modelCallsStarted:0},
  };
}
