import type { FieldObservation, PageFieldCoverage } from "./field-observation.ts";
import type { MissingFieldCue } from "./coverage-review.ts";
import type { RequirementStatus } from "./document-fulfillment.ts";

/** Read-only diagnostics. Neither cross-reading nor N/A source text grants legal acceptance. */
export const OCR_TRIAGE_VERSION = "ocr-triage/1" as const;
export type OcrTriageStatus =
  | "read_supported" | "pending_verification" | "source_omitted" | "suspected_omission"
  | "misrecognized" | "not_applicable_source_claim" | "explicit_none_unreviewed"
  | "unreadable" | "conflict" | "source_blank" | "not_observed";
export interface OcrTriageFinding {
  origin: "source_read" | "catalog_gap" | "source_omission_cue" | "page_gap";
  canonicalFieldId: string | null;
  recordIndex: number | null; fieldIndex: number | null;
  status: OcrTriageStatus; reasonCode: string;
  sourceState: string; verificationState: string | null;
  correctionCandidate: boolean;
  hasSourceAnchor: boolean; quote: string | null; bbox: number[] | null;
  requiresReview: boolean; legalRecognition: "unreviewed";
}
export interface PageOcrTriage {
  version: typeof OCR_TRIAGE_VERSION;
  kind: "read_only_diagnostic_no_case_mutation";
  documentId: string; page: number; sourceSha256: string;
  completeReadClaim: boolean; findings: OcrTriageFinding[];
  counts: Record<OcrTriageStatus, number>;
  caseNotApplicableConfirmed: false;
  legalRecognition: "unreviewed";
}
const anchor = (quote: string | null, bbox: number[] | null) =>
  typeof quote === "string" && !!quote.trim() && Array.isArray(bbox) && bbox.length === 4 &&
  bbox.every(value => Number.isFinite(value) && value >= 0 && value <= 1) && bbox[0] < bbox[2] && bbox[1] < bbox[3];
const statuses: readonly OcrTriageStatus[] = [
  "read_supported", "pending_verification", "source_omitted", "suspected_omission", "misrecognized",
  "not_applicable_source_claim", "explicit_none_unreviewed", "unreadable", "conflict", "source_blank", "not_observed",
];
function observationDisposition(o: FieldObservation): {status: OcrTriageStatus; reasonCode: string; correctionCandidate: boolean} {
  if (o.origin === "catalog_gap") return {status:"not_observed",reasonCode:"CATALOG_FIELD_UNOBSERVED_NOT_PROOF_OF_OMISSION",correctionCandidate:false};
  if (o.sourceState === "conflicting" || o.verificationState === "conflicting") return {status:"conflict",reasonCode:"SOURCE_OR_VERIFIER_CONFLICT",correctionCandidate:false};
  if (["wrong_field","value_mismatch","corrected"].includes(o.verificationState)) return {
    status:"misrecognized",reasonCode:o.verificationState === "corrected" ? "VERIFIER_CORRECTION_CANDIDATE" : "VERIFIER_DISAGREEMENT",
    correctionCandidate:o.verificationState === "corrected",
  };
  if (o.sourceState === "masked" || o.sourceState === "illegible" || o.verificationState === "unreadable")
    return {status:"unreadable",reasonCode:"SOURCE_MASKED_OR_ILLEGIBLE",correctionCandidate:false};
  if (o.sourceState === "explicit_none") {
    if (o.applicability.sourceClaim === "not_applicable" && o.applicability.caseDecision === "unreviewed" && anchor(o.quote,o.bbox))
      return {status:"not_applicable_source_claim",reasonCode:"EXPLICIT_NONE_QUOTED_CASE_UNREVIEWED",correctionCandidate:false};
    return {status:"explicit_none_unreviewed",reasonCode:"SOURCE_NONE_IS_NOT_CASE_NA",correctionCandidate:false};
  }
  if (o.sourceState === "blank") return {status:"source_blank",reasonCode:"EMPTY_SOURCE_SLOT_NOT_NA",correctionCandidate:false};
  if (o.sourceState === "present") {
    if (o.verificationState === "supported" && anchor(o.quote,o.bbox))
      return {status:"read_supported",reasonCode:"SOURCE_CROSS_READ_SUPPORTED_NOT_LEGAL_RECOGNITION",correctionCandidate:false};
    return {status:"pending_verification",reasonCode:"READ_VALUE_NEEDS_SOURCE_VERIFICATION",correctionCandidate:false};
  }
  return {status:"not_observed",reasonCode:"NO_GROUNDED_VALUE_OR_APPLICABILITY",correctionCandidate:false};
}
function cueDisposition(cue: MissingFieldCue): {status:OcrTriageStatus; reasonCode:string} {
  switch(cue.sourceState){
    case "present": return {status:"source_omitted",reasonCode:"VERIFIER_SAW_UNEXTRACTED_SOURCE_FIELD"};
    case "masked": case "illegible": return {status:"unreadable",reasonCode:"VERIFIER_SAW_OBSCURED_SOURCE_FIELD"};
    case "blank": return {status:"source_blank",reasonCode:"VERIFIER_SAW_EMPTY_SLOT_NOT_NA"};
    case "explicit_none": return {status:"explicit_none_unreviewed",reasonCode:"VERIFIER_SAW_NONE_WITHOUT_CASE_APPLICABILITY"};
  }
}
/** Accept only separately validated family-bound source omissions, never all catalog gaps. */
export function summarizePageOcrTriage(input: {
  coverage: PageFieldCoverage; validatedMissingCues?: readonly MissingFieldCue[]; omittedRows?: boolean;
}): PageOcrTriage {
  const {coverage}=input;
  const findings: OcrTriageFinding[] = coverage.observations.map(o => {
    const disposition = observationDisposition(o);
    return {origin:o.origin,canonicalFieldId:o.canonicalFieldId,recordIndex:o.recordIndex,fieldIndex:o.fieldIndex,
      ...disposition,sourceState:o.sourceState,verificationState:o.verificationState,
      hasSourceAnchor:anchor(o.quote,o.bbox),quote:o.quote,bbox:o.bbox,
      requiresReview:disposition.status !== "read_supported",legalRecognition:"unreviewed" as const};
  });
  for (const cue of input.validatedMissingCues ?? []) {
    if (!cue.canonicalFieldId || !anchor(cue.quote,cue.bbox)) continue;
    const disposition=cueDisposition(cue);
    findings.push({origin:"source_omission_cue",canonicalFieldId:cue.canonicalFieldId,recordIndex:null,fieldIndex:null,
      ...disposition,sourceState:cue.sourceState,verificationState:null,correctionCandidate:false,
      hasSourceAnchor:true,quote:cue.quote,bbox:cue.bbox,requiresReview:true,legalRecognition:"unreviewed"});
  }
  // An unlocated row can only become a suspicion, never a specific missing-field fact.
  if (input.omittedRows && !coverage.completeReadClaim) findings.push({
    origin:"page_gap",canonicalFieldId:null,recordIndex:null,fieldIndex:null,
    status:"suspected_omission",reasonCode:"UNLOCATED_ROW_OMISSION_REQUIRES_REREAD",sourceState:"unknown",
    verificationState:null,correctionCandidate:false,hasSourceAnchor:false,quote:null,bbox:null,
    requiresReview:true,legalRecognition:"unreviewed"});
  const counts=Object.fromEntries(statuses.map(status=>[status,findings.filter(f=>f.status===status).length])) as Record<OcrTriageStatus,number>;
  return {version:OCR_TRIAGE_VERSION,kind:"read_only_diagnostic_no_case_mutation",documentId:coverage.documentId,page:coverage.page,
    sourceSha256:coverage.sourceSha256,completeReadClaim:coverage.completeReadClaim,findings,counts,
    caseNotApplicableConfirmed:false,legalRecognition:"unreviewed"};
}

/** Only a separately reviewed requirement can be truly marked not applicable. */
export type RequirementTriageStatus = "missing_document" | "partial_document" | "not_applicable_confirmed" | "satisfied" | "waived" | "unresolved";
export function requirementTriageStatus(status:RequirementStatus):RequirementTriageStatus{
  switch(status){
    case "missing": return "missing_document";
    case "partial": return "partial_document";
    case "not_applicable_confirmed": return "not_applicable_confirmed";
    case "satisfied": return "satisfied";
    case "waived_by_review": return "waived";
    default: return "unresolved";
  }
}
