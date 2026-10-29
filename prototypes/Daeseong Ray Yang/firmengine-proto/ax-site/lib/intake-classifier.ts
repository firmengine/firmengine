import { renderPromptPolicy } from "./reference-prompts.ts";
import { INTAKE_PROMPT_VERSION, type ConsultationNote, type IntakeCatalog } from "./intake-types.ts";
import { INTAKE_LIMITS, INTAKE_NEGATIVE_SUBJECT_LABELS, intakeSourceNotes, validateIntakeCatalog } from "./intake-engine.ts";
import { buildIntakeSourceSpans } from "./intake-source-spans.ts";

export function intakeClassifierInstructions(): string {
  return renderPromptPolicy("prompt.intake.classifier.instructions", { negativeSubjectLabels: JSON.stringify(INTAKE_NEGATIVE_SUBJECT_LABELS) });
}

export const INTAKE_CLASSIFIER_INSTRUCTIONS = intakeClassifierInstructions();

/** Pure request preparation. Runtime/model credentials remain in the existing server boundary. */
export function buildIntakeClassifierRequest(notes: ConsultationNote[], catalog: IntakeCatalog) {
  const checked = validateIntakeCatalog(catalog), activeNotes = intakeSourceNotes(notes);
  const sourceSpans = buildIntakeSourceSpans(activeNotes);
  if (!activeNotes.length) throw new Error("INTAKE_NO_ACTIVE_NOTES: 상담이력을 먼저 입력해 주세요.");
  if (!checked.features.length) throw new Error("INTAKE_EMPTY_FEATURE_CATALOG: 분류 기준정보를 먼저 등록해 주세요.");
  const object = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, properties, required: Object.keys(properties) });
  const scopes = [...new Set(checked.features.map(feature => feature.scope))];
  const definitions: Record<string, unknown> = {
    intakeState: { type: "string", enum: ["present", "absent", "unknown", "conflict", "legal_review"] },
    intakeTemporal: { type: "string", enum: ["current", "past", "uncertain"] },
    sourceSpanId: { type: "string", enum: sourceSpans.map(span => span.id) },
    sourceSpanRefs: { type: "array", minItems: 1, maxItems: INTAKE_LIMITS.refsPerClaim, items: object({ sourceSpanId: { $ref: "#/$defs/sourceSpanId" } }) },
  };
  for (const scope of scopes) definitions[`feature_${scope}`] = { type: "string", enum: checked.features.filter(feature => feature.scope === scope).map(feature => feature.id) };
  const subjectBranches = scopes.map(scope => object({
    subjectId: scope === "case" ? { type: "string", enum: ["case"] } : { type: "string", minLength: 1, maxLength: 120, pattern: `^${scope}:[A-Za-z0-9][A-Za-z0-9_.:-]*$` },
    subjectLabel: scope === "case" ? { type: "string", enum: [INTAKE_NEGATIVE_SUBJECT_LABELS.case] } : { type: "string", minLength: 1, maxLength: 250 },
    claims: { type: "array", maxItems: INTAKE_LIMITS.claims, items: object({
      featureId: { $ref: `#/$defs/feature_${scope}` },
      state: { $ref: "#/$defs/intakeState" },
      temporal: { $ref: "#/$defs/intakeTemporal" },
      refs: { $ref: "#/$defs/sourceSpanRefs" },
    }) },
  }));
  const schema = { ...object({
    reviewedSourceSpanIds: { type: "array", minItems: sourceSpans.length, maxItems: sourceSpans.length, items: { $ref: "#/$defs/sourceSpanId" } },
    subjects: { type: "array", maxItems: INTAKE_LIMITS.claims, items: { anyOf: subjectBranches } },
  }), $defs: definitions };
  const packet = {
    purpose: "consultation_claim_classification_only", promptVersion: INTAKE_PROMPT_VERSION, catalogVersion: checked.version,
    features: checked.features.map(feature => ({ id: feature.id, label: feature.label, scope: feature.scope, description: feature.description })),
    // The same active public ID/name inventory is supplied to OCR. Internal
    // extraction families are metadata, not a second public document list.
    documents: checked.documents.map(document=>({id:document.id,name:document.name,category:document.category,fields:document.fields,...(document.ocr?{ocr:document.ocr}:{})})),
    notes: activeNotes.map(note => ({ id: note.id, sequence: note.sequence, occurredAt: note.occurredAt })),
    sourceSpans: sourceSpans.map(({ id, noteId, start, end, text }) => ({ id, noteId, start, end, text })),
    limits: { maximumClaims: INTAKE_LIMITS.claims, noImplicitAbsence: true, noEvidenceAcceptance: true },
  };
  return { agent: "consultation_classifier", instructions: intakeClassifierInstructions(), input: [{ role: "user", content: [{ type: "input_text", text: JSON.stringify(packet) }] }], schema, maxOutput: 14_000, reasoningEffort: "medium" as const, sourceSpans };
}
