/** Read-only, case-scoped consultation checklist vs source intake/OCR.
 * Candidate document-type matches alone never prove correct subject, period,
 * field completeness, acceptance, or legal sufficiency.
 */
import type { CaseData } from "./domain.ts";
import { listCaseDocumentRequirements } from "./case-document-requirement-store.ts";
import { getCaseDataUpdateState } from "./case-data-watch.ts";
import { parseDocumentRoute } from "./shared-document-catalog.ts";

export const CASE_REQUIREMENT_MONITOR_VERSION="case-requirement-monitor/1" as const;
type Instance={documentId:string;page:number;documentTypeId:string|null};
type Head={documentId:string;page:number};
type Job={documentId:string;page:number;status:string;stage:string;documentType:string|null};

export async function caseRequirementMonitor(database:D1Database,caseData:CaseData){
  const caseId=caseData.context.id;
  const [checklist,instances,heads,jobs,changes]=await Promise.all([
    listCaseDocumentRequirements(database,caseId),
    database.prepare("SELECT source_document_id AS documentId,page,shared_document_type_id AS documentTypeId FROM document_instances WHERE case_id=?").bind(caseId).all<Instance>(),
    database.prepare("SELECT source_document_id AS documentId,page FROM case_extraction_heads WHERE case_id=?").bind(caseId).all<Head>(),
    database.prepare("SELECT document_id AS documentId,page,status,stage,document_type AS documentType FROM page_jobs WHERE case_id=?").bind(caseId).all<Job>(),
    getCaseDataUpdateState(database,{caseId})
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
  const unclassifiedJobs=jobs.results.filter(job=>activeDocs.has(job.documentId)&&!parseDocumentRoute(job.documentType)).length;
  const workflowAdopted=!!checklist.activeRunId&&(caseData.workflowState?.requirements??[]).some(r=>r.intakeRunId===checklist.activeRunId);
  return {
    schemaVersion:CASE_REQUIREMENT_MONITOR_VERSION,caseId,caseRevision:caseData.context.revision,
    activeRunId:checklist.activeRunId,consultationChecklistMaterialized:!!checklist.activeRunId,
    workflowAdopted,requirements,unclassifiedPageJobs:unclassifiedJobs,
    eventCursor:{dataVersion:changes.dataVersion,lastEventId:changes.lastEventId,isQuiet:changes.isQuiet},
    legalSufficiencyInferred:false,autoApproval:false,
    notice:"OCR/서류종류 관측만 표시합니다. 대상자·기간·필수값·갈음·법원 제출 적합성은 별도 검토 대상입니다."
  };
}
