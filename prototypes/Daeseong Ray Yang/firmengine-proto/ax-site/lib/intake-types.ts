/** Consultation-only contracts. No value in this module grants evidentiary or legal acceptance. */
export const INTAKE_SCHEMA_VERSION = "consultation-checklist-v1";
export const INTAKE_ENGINE_VERSION = "intake-rules-3";
export const INTAKE_PROMPT_VERSION = "intake-classifier-5.3";
export const INTAKE_NOTE_MAX_CHARS = 16_000;
export const INTAKE_ACTIVE_MAX_CHARS = 40_000;
export type IntakeScope = "case" | "income" | "debt" | "asset" | "household" | "expense" | "event" | "procedure";
export type IntakeState = "present" | "absent" | "unknown" | "conflict" | "legal_review";
export interface IntakeFeature { id:string; label:string; scope:IntakeScope; question:string; essential:boolean; description:string }
export interface IntakeSource { id:string; title:string; url:string; jurisdiction:string; checkedAt:string; locator:string; note:string }
export interface IntakeDocumentOcr {
  familyIds:string[]; fieldContractIds:string[]; routingStatus:"ready"|"review_required";
  collectionMode:"client_evidence"|"generated_or_prior_form";
}
export interface IntakeDocumentType { id:string; name:string; category:string; issuer:string; purpose:string; fields:string[]; workflowDocumentTypes:string[]; sourceIds:string[]; ocr?:IntakeDocumentOcr }
export interface IntakeCondition { featureId:string; state:"present" | "absent" }
export interface IntakeDocumentNeed { documentTypeId:string; alternatives:string[]; alternativePolicy:"any_of" | "review_required"; period:string; requirement:"required_when_applicable" | "recommended" | "court_ordered"; reason:string }
export interface IntakeRule { id:string; title:string; enabled:boolean; scope:IntakeScope; all:IntakeCondition[]; any:IntakeCondition[]; documents:IntakeDocumentNeed[]; questions:string[]; workflowIds:string[]; sourceIds:string[]; jurisdictions:string[]; effectiveFrom:string|null; effectiveTo:string|null; legalReviewRequired:boolean }
export interface IntakeCatalog { schemaVersion:typeof INTAKE_SCHEMA_VERSION; version:number; title:string; features:IntakeFeature[]; documents:IntakeDocumentType[]; rules:IntakeRule[]; sources:IntakeSource[]; note:string }
export interface ConsultationNote { id:string; caseId:string; sequence:number; text:string; textSha256:string; occurredAt:string|null; createdAt:string; actor:string; supersedesId:string|null }
export interface IntakeQuote { noteId:string; quote:string; start:number; end:number }
export interface IntakeClaim { id:string; featureId:string; subjectId:string; subjectLabel:string; state:IntakeState; temporal:"current" | "past" | "uncertain"; basis:"client_report"; refs:IntakeQuote[] }
export interface RawIntakeClaim { featureId:string; subjectId:string; subjectLabel:string; state:IntakeState; temporal:"current" | "past" | "uncertain"; refs:{noteId:string;quote:string}[] }
export interface IntakeQuestion { id:string; featureId:string|null; subjectId:string; question:string; reason:string; ruleIds:string[] }
export interface IntakeRequirement { id:string; documentTypeId:string; documentName:string; subjectId:string; subjectLabel:string; period:string; requirement:IntakeDocumentNeed["requirement"]; status:"requested" | "qualification_needed" | "conflict" | "legal_review"; reason:string[]; matchedRuleIds:string[]; workflowIds:string[]; sourceClaimIds:string[]; sourceIds:string[]; alternatives:{id:string;name:string}[]; alternativePolicy:IntakeDocumentNeed["alternativePolicy"]; fields:string[]; issuer:string }
export interface IntakeResult { claims:IntakeClaim[]; requirements:IntakeRequirement[]; questions:IntakeQuestion[]; warnings:string[]; matchedRuleIds:string[]; counts:{requested:number;qualificationNeeded:number;conflict:number;legalReview:number;questions:number} }
export interface IntakeRun { id:string;caseId:string;caseRevision:number;caseStorageToken:string;caseInputSha256:string;consultationRevision:number;consultationSha256:string;catalogVersion:number;catalogSha256:string;catalogSnapshot:{features:Pick<IntakeFeature,"id"|"label">[];sources:IntakeSource[];rules:Pick<IntakeRule,"id"|"title">[]};engineVersion:string;promptVersion:string;model:string;createdAt:string;result:IntakeResult;usage:{inputTokens:number;outputTokens:number;durationMs:number};classifierReceipt?:{subjects:{subjectId:string;subjectLabel:string}[];sourceSpanCoverage:Record<string,string[]>;unreferencedSubjectIds:string[]};
  /** v2 semantic freshness receipt. Missing identifies immutable legacy/v1 payloads. */
  intakeInputFingerprintVersion?: "intake-input-fingerprint/2";
  intakeInputFingerprint?: string;
  semanticContext?: { courtId: string; asOf: string; outputContractVersion: string };
  stale?:boolean;staleReasons?:string[] }
export interface IntakeChecklistView { caseId:string;caseName:string;caseRevision:number;courtId:string;consultationRevision:number;notes:ConsultationNote[];run:IntakeRun|null;latestAttempt:{id:string;status:string;leaseUntil:string|null;error:string|null;updatedAt:string}|null;catalogVersion:number;model:string;apiKeyConfigured:boolean;readOnly:boolean }
