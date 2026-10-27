import { currentFacts,type CaseData } from "./domain.ts";

export interface ExportPageReceipt {
  documentId:string;page:number;role:string;status:string;stage:string;hasStoredRead:boolean;
}
export interface ExportProvenance {
  source_sha256:string|null;
  evidence_pages_used:number[];
  receipt_basis:"server-page-result-ledger"|"unavailable";
  model:string;
  case_revision:number;
  sources:{documentId:string;sha256:string;evidencePages:number[];readPages:number[];completedPages:number[];reviewRequiredPages:number[];heldOutPages:number[];referencedPages:number[]}[];
  page_receipts:ExportPageReceipt[];
  evidence_pages_expected:number;
  evidence_pages_read:number;
  evidence_pages_completed:number;
  note:string;
}

/** Only persisted successful extraction reads establish page-input receipts.
 * A role assignment, an uploaded image, or a queued job is not an extraction.
 */
export function buildExportProvenance(data:CaseData,receipts?:ExportPageReceipt[]):ExportProvenance{
  const active=data.documents.filter(d=>d.status==="active"),facts=currentFacts(data);
  const valid=(receipts??[]).filter(r=>Number.isInteger(r.page)&&r.page>0&&active.some(d=>d.id===r.documentId)&&data.pages.some(p=>p.documentId===r.documentId&&p.page===r.page&&p.role==="evidence")&&r.role==="evidence");
  const unique=[...new Map(valid.map(r=>[r.documentId+":"+r.page,r])).values()];
  const sorted=(values:number[])=>[...new Set(values)].sort((a,b)=>a-b);
  const sources=active.map(d=>{
    const pages=data.pages.filter(p=>p.documentId===d.id),read=unique.filter(r=>r.documentId===d.id&&r.hasStoredRead);
    return {documentId:d.id,sha256:d.sha256,evidencePages:sorted(pages.filter(p=>p.role==="evidence").map(p=>p.page)),readPages:sorted(read.map(r=>r.page)),completedPages:sorted(read.filter(r=>r.status==="completed").map(r=>r.page)),reviewRequiredPages:sorted(read.filter(r=>r.status==="review_required").map(r=>r.page)),heldOutPages:sorted(pages.filter(p=>p.role==="filed_form"||p.role==="administrative").map(p=>p.page)),referencedPages:sorted(facts.flatMap(f=>f.refs.filter(r=>r.documentId===d.id).map(r=>r.page)))};
  });
  return {source_sha256:sources.length===1?sources[0].sha256:null,evidence_pages_used:sources.length===1?sources[0].readPages:[],receipt_basis:receipts?"server-page-result-ledger":"unavailable",model:data.execution?.model??"gpt-6-luna",case_revision:data.context.revision,sources,page_receipts:unique,evidence_pages_expected:sources.reduce((sum,s)=>sum+s.evidencePages.length,0),evidence_pages_read:sources.reduce((sum,s)=>sum+s.readPages.length,0),evidence_pages_completed:sources.reduce((sum,s)=>sum+s.completedPages.length,0),note:"서버에 저장된 페이지 판독 결과의 입력 범위 기록입니다. 원문 정확도·독립 검증 통과·법적 인정·법원 제출 완료를 의미하지 않습니다."};
}
