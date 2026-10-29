/** Read-only, case-scoped consultation checklist vs source intake/OCR.
 * Candidate document-type matches alone never prove correct subject, period,
 * field completeness, acceptance, or legal sufficiency.
 */
import type { CaseData } from "./domain.ts";
import { listCaseDocumentRequirements } from "./case-document-requirement-store.ts";
import { getCaseDataUpdateState } from "./case-data-watch.ts";
import { parseDocumentRoute } from "./shared-document-catalog.ts";
import { buildCaseWorkflowView } from "./case-workflow-view.ts";

export const CASE_REQUIREMENT_MONITOR_VERSION="case-requirement-monitor/1" as const;
type Instance={documentId:string;page:number;documentTypeId:string|null};
type Head={documentId:string;page:number};
type Job={documentId:string;page:number;status:string;stage:string;documentType:string|null};

/** Monotone event cursor for existing DB-monitor agents; read never acknowledges events. */
export async function listCaseDocumentWorkEvents(database:D1Database,input:{caseId:string;afterEventId?:number;limit?:number}){
  const after=input.afterEventId??0,limit=input.limit??50;
  if(!input.caseId.trim()||input.caseId.length>300||!Number.isSafeInteger(after)||after<0
    ||!Number.isSafeInteger(limit)||limit<1||limit>200)throw new Error("INVALID_DOCUMENT_WORK_CURSOR");
  const rows=await database.prepare("SELECT id,case_id AS caseId,event_kind AS eventKind,source_id AS sourceId,before_state AS beforeState,after_state AS afterState,occurred_at AS occurredAt FROM case_document_work_events WHERE case_id=? AND id>? ORDER BY id LIMIT ?")
    .bind(input.caseId,after,limit+1).all<{id:number;caseId:string;eventKind:string;sourceId:string;beforeState:string|null;afterState:string|null;occurredAt:string}>();
  const events=rows.results.slice(0,limit);
  return {schemaVersion:"case-document-work-events/1",caseId:input.caseId,afterEventId:after,nextAfterEventId:events.at(-1)?.id??after,hasMore:rows.results.length>limit,events,
    cursorMeaning:"Append-only change id. Query never clears alerts or approves a filing."};
}

export async function caseRequirementMonitor(database:D1Database,caseData:CaseData){
  const caseId=caseData.context.id;
  const [checklist,instances,heads,jobs,changes,workCursor,activeIntake,catalogHead,policy]=await Promise.all([
    listCaseDocumentRequirements(database,caseId),
    database.prepare("SELECT source_document_id AS documentId,page,shared_document_type_id AS documentTypeId FROM document_instances WHERE case_id=?").bind(caseId).all<Instance>(),
    database.prepare("SELECT source_document_id AS documentId,page FROM case_extraction_heads WHERE case_id=?").bind(caseId).all<Head>(),
    database.prepare("SELECT document_id AS documentId,page,status,stage,document_type AS documentType FROM page_jobs WHERE case_id=?").bind(caseId).all<Job>(),
    getCaseDataUpdateState(database,{caseId}),
    database.prepare("SELECT COALESCE(MAX(id),0) AS id FROM case_document_work_events WHERE case_id=?").bind(caseId).first<{id:number}>(),
    database.prepare("SELECT h.active_run_id AS runId,r.catalog_version AS catalogVersion FROM consultation_heads h LEFT JOIN consultation_runs r ON r.id=h.active_run_id AND r.case_id=h.case_id AND r.status='complete' WHERE h.case_id=?").bind(caseId).first<{runId:string|null;catalogVersion:number|null}>(),
    database.prepare("SELECT version FROM intake_catalog_head WHERE id='default'").first<{version:number}>(),
    database.prepare("SELECT (SELECT COUNT(*) FROM legal_monitor_alerts WHERE acknowledged_at IS NULL) AS pending,MAX(created_at) AS latest FROM legal_monitor_alerts").first<{pending:number;latest:string|null}>()
  ]);
  const activeDocs=new Set(caseData.documents.filter(doc=>doc.status==="active").map(doc=>doc.id));
  const pageKey=(id:string,page:number)=>id+":"+page;
  const perPageTypes=new Map<string,Set<string>>();
  for(const instance of instances.results){
    if(!activeDocs.has(instance.documentId)||!instance.documentTypeId)continue;
    const key=pageKey(instance.documentId,instance.page),types=perPageTypes.get(key)??new Set<string>();
    types.add(instance.documentTypeId);perPageTypes.set(key,types);
  }
  const committed=new Set(heads.results.filter(h=>activeDocs.has(h.documentId)).map(h=>pageKey(h.documentId,h.page)));
  const requirements=checklist.requirements.map(row=>{
    const candidatePages=[...perPageTypes.entries()].filter(([,types])=>types.size===1&&types.has(row.documentTypeId)).map(([key])=>key);
    const candidateDocuments=new Set(candidatePages.map(key=>key.slice(0,key.lastIndexOf(":"))));
    const committedPages=candidatePages.filter(key=>committed.has(key));
    const relevantJobs=jobs.results.filter(job=>{
      if(!activeDocs.has(job.documentId))return false;
      const route=parseDocumentRoute(job.documentType);
      return route?.documentTypeId===row.documentTypeId || candidatePages.includes(pageKey(job.documentId,job.page));
    });
    const jobStatusCounts=Object.fromEntries([...new Set(relevantJobs.map(job=>job.status))].sort().map(status=>[status,relevantJobs.filter(job=>job.status===status).length]));
    return {
      requirementId:row.requirementId,caseId,consultationRunId:row.consultationRunId,
      documentTypeId:row.documentTypeId,documentName:row.documentName,
      subjectId:row.subjectId,subjectLabel:row.subjectLabel,period:row.period,
      requirement:row.requirement,status:row.status,
      fieldPlan:row.fieldPlan,fieldPlanStatus:row.fieldPlanStatus,
      observed:{stage:committedPages.length?"ocr_committed_candidate":candidatePages.length?"document_type_candidate":"no_classified_candidate",
        candidateDocumentCount:candidateDocuments.size,candidatePageCount:candidatePages.length,
        committedOcrPageCount:committedPages.length,jobStatusCounts,
        subjectAndPeriodVerified:false,requirementFulfilledInferred:false}
    };
  });
  // The consultation rows use intake requirement IDs; adopted workflow rows use
  // stable workflow requirement IDs. Never join them by ID or pretend that a
  // document-type match proves that the same person's duty is satisfied.
  // Reconcile substitution from CURRENT facts and court/consultation policies,
  // rather than trusting a stale materialized watcher row.
  let projected:Awaited<ReturnType<typeof buildCaseWorkflowView>>|null=null;
  let projectionError:string|null=null;
  try{
    const pageTypes=[...perPageTypes].map(([key,ids])=>({
      documentId:key.slice(0,key.lastIndexOf(":")),page:Number(key.slice(key.lastIndexOf(":")+1)),
      documentTypeId:ids.size===1?[...ids][0]:null
    }));
    projected=await buildCaseWorkflowView(caseData,{
      catalogVersion:catalogHead?.version??null,
      pendingCourtPolicyChange:!!policy?.pending,
      latestCourtPolicyAlertAt:policy?.latest??null,
      activeIntakeRunId:activeIntake?.runId??null,
      activeIntakeCatalogVersion:activeIntake?.catalogVersion??null,pageTypes
    });
  }catch(error){
    projectionError=error instanceof Error?error.message:"CASE_REQUEST_PROJECTION_FAILED";
  }
  const projectedById=new Map((projected?.requirementStates??[]).map(x=>[x.requirementId,x]));
  const workflowRequests=(caseData.workflowState?.requirements??[]).map(req=>{
    const state=projectedById.get(req.requirementId);
    const activeByPolicy=state?.substitution?.activeRequest!==false;
    const activeRequest=!req.retired&&!req.waivedByReview&&!req.notApplicableConfirmed&&activeByPolicy;
    return {
      requirementId:req.requirementId,intakeRunId:req.intakeRunId,
      documentTypeId:req.intakeDocumentTypeId,requiredPeriod:req.requiredPeriod,
      activeRequest,
      substitutionStatus:state?.substitution?.status??"review_required",
      substitutionReasons:state?.substitution?.reasonCodes??["LIVE_RECHECK_UNAVAILABLE"],
      requirementStatus:state?.requirementStatus??"legal_review",
      sourceProofFields:[...(req.sourceEvidenceFields??[])],
      statusSource:state?"live_source_and_court_projection":"fail_closed_original_required"
    };
  });
  const unclassifiedJobs=jobs.results.filter(job=>activeDocs.has(job.documentId)&&!parseDocumentRoute(job.documentType)).length;
  const workflowAdopted=!!checklist.activeRunId&&(caseData.workflowState?.requirements??[]).some(r=>r.intakeRunId===checklist.activeRunId);
  return {
    schemaVersion:CASE_REQUIREMENT_MONITOR_VERSION,caseId,caseRevision:caseData.context.revision,
    activeRunId:checklist.activeRunId,consultationChecklistMaterialized:!!checklist.activeRunId,
    consultationStatus:checklist.activeRunId?"current":checklist.pendingReanalysis?"reanalysis_pending":"not_analyzed",
    previousCompletedRunId:checklist.previousCompletedRunId,
    workflowAdopted,requirements,workflowRequests,workflowProjectionStatus:projectionError?"unavailable_fail_closed":"current",workflowProjectionError:projectionError,activeWorkflowRequestCount:workflowRequests.filter(row=>row.activeRequest).length,unclassifiedPageJobs:unclassifiedJobs,
    eventCursor:{dataVersion:changes.dataVersion,lastEventId:changes.lastEventId,isQuiet:changes.isQuiet,documentWorkEventId:workCursor?.id??0},
    legalSufficiencyInferred:false,autoApproval:false,
    notice:"상담 원본 요청과 업무 요청은 서로 다른 ID입니다. 업무 요청의 갈음 상태는 현재 자료·법원 기준으로 재검증하며, 매핑 불명확 시 원본 요청을 유지합니다. OCR 분류만으로 서류 제출이나 법률상 충족이 인정되지 않습니다."
  };
}
