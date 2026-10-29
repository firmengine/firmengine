import { renderPromptPolicy } from "./reference-prompts.ts";
import { documentFieldContract, FIELD_CATALOG_RELEASE, FIELD_CATALOG_RELEASE_SHA256 } from "./document-agent-registry.ts";

export const FIELD_OBSERVATION_VERSION = "field-observation-2" as const;
export const SOURCE_STATES = ["present", "blank", "masked", "illegible", "not_seen", "conflicting", "explicit_none", "unknown"] as const;
export type SourceState = typeof SOURCE_STATES[number];
export type ApplicabilityClaim = "applicable" | "not_applicable" | "unknown";
export const VERIFICATION_STATES = ["unverified", "supported", "corrected", "wrong_field", "unreadable", "conflicting", "value_mismatch", "unclear", "missing_check"] as const;
export type VerificationState = typeof VERIFICATION_STATES[number];
export const SOURCE_BBOX_INSTRUCTIONS = renderPromptPolicy("prompt.field_observation.source_bbox_instructions");
export interface ObservationInput {
  key: string; label: string; value: string | null; unit: string | null; quote: string | null;
  bbox: number[] | null; confidence: "clear" | "uncertain" | "unreadable";
  canonicalFieldId?: string | null; sourceState?: SourceState;
  applicability?: ApplicabilityClaim; applicabilityQuote?: string | null;
  verificationState?: VerificationState;
}
export interface FieldObservation {
  version: typeof FIELD_OBSERVATION_VERSION;
  canonicalFieldId: string | null;
  familyId: string | null;
  catalogRelease: string;
  catalogSha256: string;
  binding: "explicit_id" | "exact_key" | "unbound";
  documentId: string; page: number; sourceSha256: string;
  recordIndex: number | null; fieldIndex: number | null;
  origin: "source_read" | "catalog_gap";
  supersededByHumanFactId?: string;
  label: string; rawValue: string | null; rawUnit: string | null; quote: string | null; bbox: number[] | null;
  sourceState: SourceState;
  extractionState: "value_read" | "source_empty" | "source_obscured" | "not_observed" | "conflict" | "uncertain";
  applicability: { sourceClaim: ApplicabilityClaim; quote: string | null; caseDecision: "unreviewed" };
  subjectRole: string | null; temporalRole: string | null;
  verificationState: VerificationState;
  issues: string[];
}
export interface PageFieldCoverage {
  version: typeof FIELD_OBSERVATION_VERSION;
  documentId: string; page: number; sourceSha256: string;
  familyId: string | null; catalogRelease: string; catalogSha256: string;
  completeReadClaim: boolean;
  observations: FieldObservation[];
}
const bboxValid = (v: number[] | null) => !!v && v.length === 4 && v.every(x => Number.isFinite(x) && x >= 0 && x <= 1) && v[0] < v[2] && v[1] < v[3];

/** Identity binding is exact and family-scoped. A label or value match never binds a field. */
export function observeField(type: string, field: ObservationInput, source: {documentId: string; page: number; sourceSha256: string}, recordIndex: number | null, fieldIndex: number | null): FieldObservation {
  const contract = documentFieldContract(type);
  const explicit = typeof field.canonicalFieldId === "string" && field.canonicalFieldId.length > 0;
  const candidates = (contract?.fields ?? []).filter(f => explicit ? f.global_field_id === field.canonicalFieldId : f.local_id === field.key || f.global_field_id === field.key);
  let definition = candidates.length === 1 ? candidates[0] : undefined;
  const issues: string[] = [];
  if (definition && explicit) {
    const local = definition.local_id, leaf = local.split(".").at(-1)!;
    const leafUnique = contract!.fields.filter(f => f.local_id.split(".").at(-1) === leaf).length === 1;
    const shortKey = field.key.split(".");
    const compatible = field.key === local || field.key === definition.global_field_id || leafUnique && (field.key === leaf || shortKey.length === 2 && ["person", "income", "debt", "asset", "transaction", "household", "business", "statement", "other", "bank_account", "lease", "insurance", "credit_report", "health_insurance_arrears"].includes(shortKey[0]) && shortKey[1] === leaf);
    if (!compatible) { definition = undefined; issues.push("canonical_id_key_conflict"); }
  }
  if (!definition) issues.push(explicit ? "canonical_id_outside_family" : "canonical_id_unbound");
  let state: SourceState = SOURCE_STATES.includes(field.sourceState as SourceState) ? field.sourceState! : field.value !== null ? "present" : field.confidence === "unreadable" ? "illegible" : "unknown";
  // Missing metadata is never evidence of a blank, zero, or inapplicability.
  if (state === "present" && (field.value === null || !field.value.trim())) { state = "unknown"; issues.push("present_without_value"); }
  if (["blank", "not_seen", "illegible"].includes(state) && field.value !== null) { state = "unknown"; issues.push("state_value_conflict"); }
  if (["blank", "masked", "explicit_none"].includes(state) && (!field.quote?.trim() || !bboxValid(field.bbox))) { state = "unknown"; issues.push("state_anchor_missing"); }
  if (state === "explicit_none" && field.value !== null && !field.value.trim()) { state = "unknown"; issues.push("explicit_none_without_source_token"); }
  let claim: ApplicabilityClaim = ["applicable", "not_applicable"].includes(field.applicability ?? "") ? field.applicability! : "unknown";
  const quote = field.applicabilityQuote?.trim() || null;
  // It is only a quoted source claim, never a reviewed case-level decision.
  // Require its evidence in this exact field citation, not a free-floating assertion.
  if (claim !== "unknown" && (!quote || !field.quote?.includes(quote) || !bboxValid(field.bbox))) { claim = "unknown"; issues.push("applicability_evidence_missing"); }
  if (claim === "not_applicable" && state === "present") { claim = "unknown"; issues.push("applicability_value_conflict"); }
  // A missing or empty slot does not establish that the field is inapplicable.
  // Require an explicit source-none token; case-level applicability remains a
  // separate, unreviewed decision even when the document makes that claim.
  if (claim === "not_applicable" && state !== "explicit_none") { claim = "unknown"; issues.push("not_applicable_without_explicit_none"); }
  const extractionState = recordIndex === null ? "not_observed" : state === "present" ? (field.confidence === "clear" ? "value_read" : "uncertain") : state === "blank" || state === "explicit_none" ? "source_empty" : state === "masked" || state === "illegible" ? "source_obscured" : state === "not_seen" ? "not_observed" : state === "conflicting" ? "conflict" : "uncertain";
  return { version: FIELD_OBSERVATION_VERSION, ...source, recordIndex, fieldIndex, origin: recordIndex === null ? "catalog_gap" : "source_read",
    canonicalFieldId: definition?.global_field_id ?? null, familyId: contract?.family_id ?? null,
    catalogRelease: FIELD_CATALOG_RELEASE, catalogSha256: FIELD_CATALOG_RELEASE_SHA256,
    binding: definition ? explicit ? "explicit_id" : "exact_key" : "unbound",
    label: field.label, rawValue: field.value, rawUnit: field.unit, quote: field.quote,
    bbox: bboxValid(field.bbox) ? [...field.bbox!] : null, sourceState: state, extractionState,
    applicability: { sourceClaim: claim, quote: claim === "unknown" ? null : quote, caseDecision: "unreviewed" },
    subjectRole: definition?.subject_role ?? null, temporalRole: definition?.temporal_role ?? null,
    verificationState: VERIFICATION_STATES.includes(field.verificationState as VerificationState) ? field.verificationState! : "unverified", issues };
}

export function pageFieldCoverage(read: {documentType: string; complete: boolean; records: {fields: ObservationInput[]}[]}, source: {documentId: string; page: number; sourceSha256: string}): PageFieldCoverage {
  const contract = documentFieldContract(read.documentType);
  const observations = read.records.flatMap((r, ri) => r.fields.map((f, fi) => observeField(read.documentType, f, source, ri, fi)));
  const observed = new Set(observations.map(o => o.canonicalFieldId));
  // These are catalog coverage gaps, not claims that a field actually exists in this source.
  for (const field of contract?.fields ?? []) if (!observed.has(field.global_field_id)) observations.push(observeField(read.documentType, {
    key: field.local_id, label: field.label, value: null, unit: null, quote: null, bbox: null,
    confidence: "uncertain", canonicalFieldId: field.global_field_id, sourceState: "unknown", applicability: "unknown", applicabilityQuote: null,
  }, source, null, null));
  return { version: FIELD_OBSERVATION_VERSION, ...source, familyId: contract?.family_id ?? null,
    catalogRelease: FIELD_CATALOG_RELEASE, catalogSha256: FIELD_CATALOG_RELEASE_SHA256,
    completeReadClaim: read.complete, observations };
}

export const FIELD_OBSERVATION_INSTRUCTIONS = renderPromptPolicy("prompt.field_observation.field_observation_instructions", {value1: SOURCE_BBOX_INSTRUCTIONS});
