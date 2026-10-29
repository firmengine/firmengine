/** Immutable consultation-time source proof slots and candidate OCR contracts.
 * A candidate OCR field is NEVER automatically a legally mandatory proof or
 * approved mapping. Legal and staff decisions remain separate, versioned reviews.
 * Alternative documents and substitution policy are intentionally out of scope.
 */
import type { IntakeDocumentType, IntakeRequirement } from "./intake-types.ts";
import type { SharedDocumentCatalogEntry } from "./shared-document-catalog.ts";

export const CASE_REQUIREMENT_FIELD_PLAN_VERSION = "case-requirement-field-plan/1" as const;
export interface CaseRequirementFieldPlan {
  schemaVersion:typeof CASE_REQUIREMENT_FIELD_PLAN_VERSION;
  caseId:string;consultationRunId:string;requirementId:string;documentTypeId:string;
  subjectId:string;period:string;catalogVersion:number;catalogSha256:string;
  /** Explicitly requested from the consultation catalogue; exact original wording. */
  requiredSourceFields:string[];
  /** Extraction candidates only, never inferred required-field mappings. */
  ocrCandidates:{familyId:string;fields:{id:string;key:string;label:string}[]}[];
  routingStatus:"ready"|"review_required";
  mappingStatus:"review_required";
}
export function buildCaseRequirementFieldPlan(input:{
  caseId:string;runId:string;requirement:IntakeRequirement;document:IntakeDocumentType;
  shared:SharedDocumentCatalogEntry|undefined;catalogVersion:number;catalogSha256:string;
}):CaseRequirementFieldPlan {
  const {requirement,document,shared}=input;
  if(requirement.documentTypeId!==document.id||requirement.documentName!==document.name
    ||JSON.stringify(requirement.fields)!==JSON.stringify(document.fields))throw new Error("CASE_REQUIREMENT_FIELD_CATALOG_MISMATCH");
  if(!requirement.fields.length||requirement.fields.some(field=>!field.trim())||new Set(requirement.fields).size!==requirement.fields.length)
    throw new Error("CASE_REQUIREMENT_SOURCE_FIELDS_INVALID");
  const ocrCandidates=(shared?.fieldContracts??[]).map(contract=>({
    familyId:contract.familyId,
    fields:contract.fields.map(field=>({id:field.id,key:field.key,label:field.label}))
  }));
  const routingStatus=shared?.routingStatus==="ready"&&ocrCandidates.length>0?"ready":"review_required";
  return {
    schemaVersion:CASE_REQUIREMENT_FIELD_PLAN_VERSION,caseId:input.caseId,consultationRunId:input.runId,
    requirementId:requirement.id,documentTypeId:document.id,subjectId:requirement.subjectId,
    period:requirement.period,catalogVersion:input.catalogVersion,catalogSha256:input.catalogSha256,
    requiredSourceFields:[...document.fields],ocrCandidates,routingStatus,mappingStatus:"review_required"
  };
}
