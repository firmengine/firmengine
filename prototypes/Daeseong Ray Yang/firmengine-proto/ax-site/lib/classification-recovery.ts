import { renderPromptPolicy } from "./reference-prompts.ts";
import contracts from "./document-agent-field-contracts.json" with { type: "json" };
export const CLASSIFICATION_FAMILY_IDS = Object.keys(contracts.families) as Array<keyof typeof contracts.families>;
/** Definitions only: no case values, corpus labels or expected answers. The
 * compact source-field signature helps distinguish generic headings by the
 * visible combination of fields; it is not a checklist or evidence of presence. */
export const CLASSIFICATION_FAMILY_CATALOG = Object.values(contracts.families).map(family => ({
  familyId:family.family_id,
  label:family.label,
  aliases:family.aliases,
  sourceFields:family.fields.map(field => ({key:field.local_id,label:field.label})),
}));
export const CLASSIFICATION_CATALOG_RELEASE = contracts.catalog_release;
export type ClassificationFamilyId = typeof CLASSIFICATION_FAMILY_IDS[number];
const familyIdSet = new Set<string>(CLASSIFICATION_FAMILY_IDS);
export function hasValidClassificationCatalog(read: {familyId?: unknown; catalogRelease?: unknown}): boolean {
  return read.catalogRelease === CLASSIFICATION_CATALOG_RELEASE && (read.familyId === null || typeof read.familyId === "string" && familyIdSet.has(read.familyId));
}
/** Routing observations never establish a fact, identity, legal recognition, or
 * source-verification receipt. Recovery has one additional model call at most. */
export const MAX_CLASSIFICATION_ATTEMPTS = 2;
export const SOURCE_NATURES = ["official_record_claim", "copy", "self_report", "synthetic_example", "unknown"] as const;
export type SourceNature = typeof SOURCE_NATURES[number];
/** A source's own description is separate from structural routing and authenticity. */
export const SOURCE_NATURE_INSTRUCTIONS = renderPromptPolicy("prompt.classification_recovery.source_nature_instructions");
export type ClassifiedBoundary = "single_page" | "continuation_candidate" | "mixed_or_unknown";
export interface ClassificationRead {
  role: "evidence" | "filed_form" | "administrative" | "unknown";
  familyId: ClassificationFamilyId | null;
  catalogRelease: string;
  boundaryObservation: ClassifiedBoundary;
  boundaryQuote: string | null;
  confidence: "high" | "low";
  reason: string;
  titleQuote?: string | null;
  issuerQuote?: string | null;
  structureQuote?: string | null;
  evidenceRowsQuote?: string | null;
  administrativeStructureQuote?: string | null;
  legibility?: "clear" | "low";
  sourceNature?: SourceNature;
  sourceNatureQuote?: string | null;
}
export interface ClassificationRecoveryRead extends ClassificationRead {
  titleQuote: string | null; issuerQuote: string | null; structureQuote: string | null;
  evidenceRowsQuote: string | null; administrativeStructureQuote: string | null; legibility: "clear" | "low";
}
export function canRecoverClassification(read: ClassificationRead, attempts: number): boolean {
  return Number.isSafeInteger(attempts) && attempts >= 0 && attempts < MAX_CLASSIFICATION_ATTEMPTS
    && !["filed_form", "administrative"].includes(read.role)
    && (read.role === "unknown" || !read.familyId || observedClassificationRole(read) === "unknown");
}
export function recoveredClassificationRole(read: ClassificationRecoveryRead): ClassificationRead["role"] { return observedClassificationRole(read); }
export function observedClassificationRole(read: ClassificationRead): ClassificationRead["role"] {
  if (read.role === "filed_form") return read.confidence === "high" ? "filed_form" : "unknown";
  if (!hasValidClassificationCatalog(read)) return "unknown";
  if (read.confidence !== "high" || read.legibility !== "clear" || !read.familyId) return "unknown";
  const titleOrIssuer = !!(read.titleQuote?.trim() || read.issuerQuote?.trim()), hasStructure = !!read.structureQuote?.trim();
  const hasEvidenceRows = !!read.evidenceRowsQuote?.trim(), adminQuote = read.administrativeStructureQuote?.trim(), title = read.titleQuote?.trim();
  if (hasEvidenceRows && adminQuote && adminQuote !== title) return "unknown";
  if (hasEvidenceRows && titleOrIssuer && hasStructure) return "evidence";
  if (read.role === "administrative") return titleOrIssuer && hasStructure && adminQuote && adminQuote !== title && !hasEvidenceRows ? "administrative" : "unknown";
  if (read.role === "evidence" && titleOrIssuer && hasStructure) return "evidence";
  return "unknown";
}
export function canUseRescueRole(jobRole: string, pageRole: string | undefined, reason: string | undefined): boolean {
  return jobRole === pageRole && (jobRole === "evidence" || jobRole === "unknown" && reason === "classification_unknown");
}
const properties = {
  role: { type: "string", enum: ["evidence", "filed_form", "administrative", "unknown"] },
  familyId: { type: ["string", "null"], enum: [...CLASSIFICATION_FAMILY_IDS, null] },
  catalogRelease: { type: "string", enum: [CLASSIFICATION_CATALOG_RELEASE] },
  boundaryObservation: { type: "string", enum: ["single_page", "continuation_candidate", "mixed_or_unknown"] },
  boundaryQuote: { type: ["string", "null"] },
  confidence: { type: "string", enum: ["high", "low"] }, reason: { type: "string" },
  legibility: { type: "string", enum: ["clear", "low"] },
  titleQuote: { type: ["string", "null"] }, issuerQuote: { type: ["string", "null"] },
  structureQuote: { type: ["string", "null"] }, evidenceRowsQuote: { type: ["string", "null"] },
  administrativeStructureQuote: { type: ["string", "null"] },
  sourceNature: { type: "string", enum: SOURCE_NATURES },
  sourceNatureQuote: { type: ["string", "null"] },
};
export const CLASSIFICATION_SCHEMA = { type: "object", additionalProperties: false, properties, required: Object.keys(properties) };
export const CLASSIFICATION_RECOVERY_SCHEMA = { type: "object", additionalProperties: false, properties, required: Object.keys(properties) };
const FAMILY_SIGNATURE_GUIDANCE = renderPromptPolicy("prompt.classification_recovery.family_signature_guidance");
export const CLASSIFICATION_INSTRUCTIONS = SOURCE_NATURE_INSTRUCTIONS + "\n" + FAMILY_SIGNATURE_GUIDANCE + "\n" + renderPromptPolicy("prompt.classification_recovery.classification_instructions", {value1: CLASSIFICATION_CATALOG_RELEASE});
export const CLASSIFICATION_RECOVERY_INSTRUCTIONS = SOURCE_NATURE_INSTRUCTIONS + "\n" + FAMILY_SIGNATURE_GUIDANCE + "\n" + renderPromptPolicy("prompt.classification_recovery.classification_recovery_instructions", {value1: CLASSIFICATION_CATALOG_RELEASE});
