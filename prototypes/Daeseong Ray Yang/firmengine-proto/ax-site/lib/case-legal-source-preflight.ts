/** P0/F04: an advisory AI must never run on an unfinished or untraceable
 * source snapshot. This does not infer legal acceptance or court approval. */
import type {CaseData} from "./domain.ts";

export type LegalSourceReadiness={
 ready:boolean;retryable:boolean;status:"ready"|"waiting_evidence"|"review_required";
 blockers:string[];nextAction:string;
};
export function evaluateLegalSourceReadiness(input:{
 activeDocumentCount:number;evidencePages:readonly string[];
 processingComplete:boolean;normalizedPages:readonly string[];
 legacySnapshotFallback:boolean;consultationPending:boolean;workflowIntakeMismatch:boolean;
}):LegalSourceReadiness{
 const blockers:string[]=[];
 const wait=()=>{
  if(!input.activeDocumentCount)blockers.push("SOURCE_DOCUMENT_REQUIRED");
  if(!input.evidencePages.length)blockers.push("EVIDENCE_PAGES_REQUIRED");
  if(!input.processingComplete)blockers.push("SOURCE_PAGE_VERIFICATION_PENDING");
  return blockers.length>0;
 };
 const pending=wait();
 if(input.consultationPending)blockers.push("CONSULTATION_REANALYSIS_REQUIRED");
 if(input.workflowIntakeMismatch)blockers.push("WORKFLOW_INTAKE_RUN_STALE");
 if(input.legacySnapshotFallback&&input.evidencePages.length)blockers.push("NORMALIZED_SOURCE_FALLBACK_UNVERIFIED");
 const known=new Set(input.normalizedPages);
 if(input.evidencePages.some(page=>!known.has(page)))blockers.push("CURRENT_EVIDENCE_PAGE_HEAD_MISSING");
 if(!blockers.length)return {ready:true,retryable:false,status:"ready",blockers:[],nextAction:""};
 const recoverable=pending&&!input.consultationPending&&!input.workflowIntakeMismatch
   &&!input.legacySnapshotFallback; // An OCR job can complete without a case command.
 return {ready:false,retryable:recoverable,
  status:recoverable?"waiting_evidence":"review_required",
  blockers:[...new Set(blockers)],
  nextAction:input.consultationPending?"최신 상담 이력을 다시 분석하고 필요서류를 확정하세요."
   :input.workflowIntakeMismatch?"현재 상담 결과를 사건 업무에 다시 연결하세요."
   :input.legacySnapshotFallback?"현재 증빙을 정규화 OCR 원문·피처 저장소에 다시 연결하고 검증하세요."
   :"증빙 원문 등록·독립 재판독·필드 연결을 완료하세요."};
}
type CaseCalculationSourceHeads={
 featureSnapshot?:{legacySnapshotFallback?:boolean;sourceHeads?:{documentId:string;page:number}[]};
};
export async function inspectLegalAutomationSourceReadiness(database:D1Database,data:CaseData,processingComplete:boolean)
 :Promise<LegalSourceReadiness>{
 const caseId=data.context.id;
 const [calculation,consultation]=await Promise.all([
  database.prepare("SELECT r.source_heads_json AS sourceHeadsJson FROM case_calculation_heads h JOIN case_calculation_runs r ON r.id=h.run_id WHERE h.case_id=?").bind(caseId).first<{sourceHeadsJson:string}>(),
  database.prepare("SELECT h.active_run_id AS activeRunId,h.revision,r.consultation_revision AS analyzedRevision,r.status AS runStatus FROM consultation_heads h LEFT JOIN consultation_runs r ON r.id=h.active_run_id AND r.case_id=h.case_id WHERE h.case_id=?")
   .bind(caseId).first<{activeRunId:string|null;revision:number;analyzedRevision:number|null;runStatus:string|null}>(),
 ]);
 let source:CaseCalculationSourceHeads={};
 try{source=JSON.parse(calculation?.sourceHeadsJson??"{}") as CaseCalculationSourceHeads;}catch{}
 const activeDocs=new Set(data.documents.filter(d=>d.status==="active").map(d=>d.id));
 const evidencePages=data.pages.filter(p=>activeDocs.has(p.documentId)&&p.role==="evidence").map(p=>p.documentId+":"+p.page);
 const normalizedPages=(source.featureSnapshot?.sourceHeads??[]).map(p=>p.documentId+":"+p.page);
 const workflow=data.workflowState;
 const adopted=workflow?.requirements?.filter(r=>!r.retired)??[];
 const workflowIntakeMismatch=adopted.length>0&&(!consultation?.activeRunId||adopted.some(r=>r.intakeRunId!==consultation.activeRunId));
 return evaluateLegalSourceReadiness({
  activeDocumentCount:activeDocs.size,evidencePages,normalizedPages,
  processingComplete,legacySnapshotFallback:source.featureSnapshot?.legacySnapshotFallback!==false,
  consultationPending:!!consultation&&consultation.revision>0&&(!consultation.activeRunId||consultation.analyzedRevision!==consultation.revision||consultation.runStatus!=="complete"),
  workflowIntakeMismatch
 });
}
