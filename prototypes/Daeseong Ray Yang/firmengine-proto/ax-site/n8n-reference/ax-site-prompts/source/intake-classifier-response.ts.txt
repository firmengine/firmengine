import { INTAKE_LIMITS, INTAKE_NEGATIVE_SUBJECT_LABELS, validateIntakeCatalog } from "./intake-engine.ts";
import type { IntakeCatalog } from "./intake-types.ts";
import type { IntakeSourceSpan } from "./intake-source-spans.ts";

type JsonRecord = Record<string, unknown>;
const SUBJECT_ID = /^(?:case|(?:income|debt|asset|household|expense|event|procedure):[A-Za-z0-9][A-Za-z0-9_.:-]*)$/u;

function fail(code: string, detail: string): never { throw new Error(`${code}: ${detail}`); }
function isRecord(value: unknown): value is JsonRecord { return !!value && typeof value === "object" && !Array.isArray(value); }
function exactKeys(value: JsonRecord, expected: string[], where: string): void {
  const keys = Object.keys(value);
  if (keys.length !== expected.length || keys.some(key => !expected.includes(key))) fail("INTAKE_INVALID_CLASSIFIER_RESPONSE", where);
}
function list(value: unknown, max: number, where: string): unknown[] {
  if (!Array.isArray(value) || value.length > max) fail("INTAKE_INVALID_CLASSIFIER_RESPONSE", where);
  return value;
}

/** Validate nested subject claims and span inventory acknowledgement before legacy claim validation. */
export interface IntakeClassifierReceipt {
  subjects: { subjectId: string; subjectLabel: string }[];
  sourceSpanCoverage: Record<string, string[]>;
  unreferencedSubjectIds: string[];
}

export function adaptIntakeClassifierResponse(raw: unknown, sourceSpans: IntakeSourceSpan[], catalog: IntakeCatalog): { claims: unknown[]; classifierReceipt: IntakeClassifierReceipt } {
  let serialized: string;
  try { serialized = JSON.stringify(raw); } catch { return fail("INTAKE_INVALID_CLASSIFIER_RESPONSE", "unserializable response"); }
  if (typeof serialized !== "string" || serialized.length > INTAKE_LIMITS.claimChars) fail("INTAKE_INVALID_CLASSIFIER_RESPONSE", "response size");
  const checkedCatalog = validateIntakeCatalog(catalog), features = new Set(checkedCatalog.features.map(feature => feature.id));
  const spanIds = sourceSpans.map(span => span.id), spanSet = new Set(spanIds);
  if (spanSet.size !== spanIds.length) fail("INTAKE_INVALID_CLASSIFIER_RESPONSE", "duplicate source span IDs");
  if (!isRecord(raw)) fail("INTAKE_INVALID_CLASSIFIER_RESPONSE", "root");
  exactKeys(raw, ["subjects", "reviewedSourceSpanIds"], "root fields");
  const reviewedSpanIds = list(raw.reviewedSourceSpanIds, spanIds.length, "reviewedSourceSpanIds");
  if (reviewedSpanIds.length !== spanIds.length) fail("INTAKE_CLASSIFIER_SPAN_REVIEW_MISMATCH", "missing source spans");
  const reviewedSet = new Set<string>();
  for (const id of reviewedSpanIds) {
    if (typeof id !== "string" || !spanSet.has(id)) fail("INTAKE_UNKNOWN_SOURCE_SPAN", String(id));
    if (reviewedSet.has(id)) fail("INTAKE_DUPLICATE_SOURCE_SPAN_REVIEW", id);
    reviewedSet.add(id);
  }

  const subjectLabels = new Map<string, string>();
  const claims: JsonRecord[] = [];
  const subjects = list(raw.subjects, INTAKE_LIMITS.claims, "subjects");
  for (const [index, value] of subjects.entries()) {
    if (!isRecord(value)) fail("INTAKE_INVALID_CLASSIFIER_RESPONSE", `subjects[${index}]`);
    exactKeys(value, ["subjectId", "subjectLabel", "claims"], `subjects[${index}] fields`);
    const id = value.subjectId, label = value.subjectLabel;
    if (typeof id !== "string" || id.length > 120 || !SUBJECT_ID.test(id) || typeof label !== "string" || !label.trim() || label.length > 250) fail("INTAKE_INVALID_CLASSIFIER_RESPONSE", `subjects[${index}] value`);
    if (subjectLabels.has(id)) fail("INTAKE_DUPLICATE_CLASSIFIER_SUBJECT", id);
    subjectLabels.set(id, label);
    const scope = id === "case" ? "case" : id.split(":", 1)[0];
    if (!checkedCatalog.features.some(feature => feature.scope === scope)) fail("INTAKE_INVALID_CLASSIFIER_SUBJECT_SCOPE", id);
    if (scope === "case" && label !== INTAKE_NEGATIVE_SUBJECT_LABELS.case) fail("INTAKE_INVALID_CLASSIFIER_SUBJECT_LABEL", id);
    const nested = list(value.claims, INTAKE_LIMITS.claims, `subjects[${index}].claims`);
    for (const [claimIndex, claimValue] of nested.entries()) {
      if (claims.length >= INTAKE_LIMITS.claims) fail("INTAKE_INVALID_CLASSIFIER_RESPONSE", "total claims limit");
      if (!isRecord(claimValue)) fail("INTAKE_INVALID_CLASSIFIER_RESPONSE", `subjects[${index}].claims[${claimIndex}]`);
      exactKeys(claimValue, ["featureId", "state", "temporal", "refs"], `subjects[${index}].claims[${claimIndex}] fields`);
      if (typeof claimValue.featureId !== "string" || !features.has(claimValue.featureId)) fail("INTAKE_UNKNOWN_FEATURE", String(claimValue.featureId));
      const feature = checkedCatalog.features.find(item => item.id === claimValue.featureId)!;
      if (feature.scope !== scope) fail("INTAKE_SUBJECT_SCOPE_MISMATCH", `${id}:${claimValue.featureId}`);
      const refs = list(claimValue.refs, INTAKE_LIMITS.refsPerClaim, `subjects[${index}].claims[${claimIndex}].refs`);
      if (!refs.length) fail("INTAKE_UNGROUNDED_CLAIM", String(claimValue.featureId));
      const seenRefs = new Set<string>();
      const normalizedRefs = refs.map((ref, refIndex) => {
        if (!isRecord(ref)) fail("INTAKE_INVALID_CLASSIFIER_RESPONSE", `subjects[${index}].claims[${claimIndex}].refs[${refIndex}]`);
        exactKeys(ref, ["sourceSpanId"], `subjects[${index}].claims[${claimIndex}].refs[${refIndex}] fields`);
        const sourceSpanId = ref.sourceSpanId;
        if (typeof sourceSpanId !== "string" || !spanSet.has(sourceSpanId)) fail("INTAKE_UNKNOWN_SOURCE_SPAN", String(sourceSpanId));
        if (seenRefs.has(sourceSpanId)) fail("INTAKE_DUPLICATE_SOURCE_SPAN_REF", sourceSpanId);
        seenRefs.add(sourceSpanId);
        return { sourceSpanId };
      });
      claims.push({ ...claimValue, subjectId: id, subjectLabel: label, refs: normalizedRefs });
    }
  }

  const referencedBySpan = new Map<string, Set<string>>(spanIds.map(id => [id, new Set<string>()]));
  for (const claim of claims) for (const ref of claim.refs as { sourceSpanId: string }[]) {
    referencedBySpan.get(ref.sourceSpanId)!.add(claim.featureId as string);
  }

  const usedSubjects = new Set(claims.map(claim => claim.subjectId as string));
  const classifierReceipt: IntakeClassifierReceipt = {
    subjects: [...subjectLabels].map(([subjectId, subjectLabel]) => ({ subjectId, subjectLabel })),
    sourceSpanCoverage: Object.fromEntries(spanIds.map(spanId => [spanId, [...referencedBySpan.get(spanId)!].sort()])),
    unreferencedSubjectIds: [...subjectLabels.keys()].filter(id => !usedSubjects.has(id)).sort(),
  };
  return { claims, classifierReceipt };
}
