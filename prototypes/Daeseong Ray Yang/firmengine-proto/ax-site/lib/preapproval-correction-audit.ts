/** Court-requested corrections are source-backed procedural facts, NOT model-generated requests.
 * Read-only per-item triage. A matching fact and submitted file never prove legal adequacy.
 */
import type {CaseData,Fact} from "./domain.ts";
export const PREAPPROVAL_CORRECTION_AUDIT_VERSION="preapproval-correction-audit/1" as const;
type CorrectionEvent=NonNullable<CaseData["workflowState"]>["procedureEvents"][number];
const exactDay=(raw:unknown):raw is string=>typeof raw==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(raw)&&!Number.isNaN(Date.parse(raw+"T00:00:00Z"))&&new Date(raw+"T00:00:00Z").toISOString().slice(0,10)===raw;
const uniq=(a:readonly string[])=>[...new Set(a)];
export function auditPreapprovalCourtCorrections(data:CaseData,facts:readonly Fact[],acceptedValidFactIds:ReadonlySet<string>){
 const courtOrders=(data.workflowState?.procedureEvents??[]).filter(e=>e.state==="correction_requested");
 const recordedAmendments=(data.workflowState?.procedureEvents??[]).filter(e=>e.state==="amended");
 const active=new Set(data.documents.filter(d=>d.status==="active").map(d=>d.id));
 const deadlines=facts.filter(f=>["court.correctionDeadline","corrections.deadline"].includes(f.key));
 const orders=courtOrders.map(order=>{
  const orderSourceDocumentIds=uniq(order.sourceDocumentIds??[]);
  const missingCourtDocuments=orderSourceDocumentIds.filter(id=>!active.has(id));
  const items=uniq(order.relatedFields??[]).map(field=>{
   // Exact key or canonical field only, never free-text semantic 'similarity'.
   const matched=facts.filter(f=>f.key===field||f.canonicalFieldId===field||f.fieldObservation?.canonicalFieldId===field);
   const accepted=matched.filter(f=>acceptedValidFactIds.has(f.id));
   const status=accepted.length?"verified_evidence_candidate"
      :matched.length?"unreviewed_or_conflicting_evidence":"source_not_observed";
   return {fieldKey:field,status,matchingFactIds:matched.map(f=>f.id),
      acceptedSourceFactIds:accepted.map(f=>f.id),humanLegalAdequacyApproved:false as const,
      nextAction:accepted.length?"제출자료가 보정명령 항목을 실제 충족하는지 담당 변호사가 검토":
       matched.length?"원문 대조·상충 해소 및 담당자 검수":"보정명령 원문에 지정된 대상·기간의 자료 확인"};
  });
  const dateEvidence=deadlines.filter(f=>acceptedValidFactIds.has(f.id)&&exactDay(f.value))
    .map(f=>({factId:f.id,date:f.value,sourceDocumentIds:f.refs.map(ref=>ref.documentId)}));
  return {
   eventId:order.id,courtReference:order.courtReference,requestDate:order.occurredAt,
   orderSourceDocumentIds,missingCourtDocuments,
   itemizationState:items.length?"itemized_candidate_needs_human_mapping":"unitemized_court_order",
   requestedFields:items,
   deadlineEvidenceCandidates:dateEvidence,
   deadlineAssignedToThisOrder:false as const,
   responseToThisOrderConfirmed:false as const,
   unrelatedAmendmentEvents:recordedAmendments.map(e=>e.id),
   disposition:missingCourtDocuments.length||!items.length?"court_order_source_or_itemization_missing":
     items.some(i=>i.status!=="verified_evidence_candidate")?"missing_or_unreviewed_correction_evidence":"lawyer_review_and_filing_receipt_required",
   courtOrderSatisfied:false as const,
  };
 });
 return {schemaVersion:PREAPPROVAL_CORRECTION_AUDIT_VERSION,caseId:data.context.id,
  courtOrderCount:orders.length,orders,
  unboundAmendmentCount:recordedAmendments.length,
  hasUnresolvedOrders:orders.some(order=>!order.courtOrderSatisfied),
  sourceOfLegalDeadline:"actual_court_order_document_only",
  rule:"The existence of an uploaded file or verified field is not proof of service, deadline compliance or court acceptance."};
}
