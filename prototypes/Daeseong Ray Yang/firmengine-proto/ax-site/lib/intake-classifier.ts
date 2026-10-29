import { renderPromptPolicy } from "./reference-prompts.ts";
import { INTAKE_PROMPT_VERSION, type ConsultationNote, type IntakeCatalog } from "./intake-types.ts";
import { INTAKE_LIMITS, INTAKE_NEGATIVE_SUBJECT_LABELS, intakeSourceNotes, validateIntakeCatalog } from "./intake-engine.ts";

export function intakeClassifierInstructions(): string {
  return renderPromptPolicy("prompt.intake.classifier.instructions", { negativeSubjectLabels: JSON.stringify(INTAKE_NEGATIVE_SUBJECT_LABELS) });
}

export const INTAKE_CLASSIFIER_INSTRUCTIONS = intakeClassifierInstructions();

/** Pure request preparation. Runtime/model credentials remain in the existing server boundary. */
export function buildIntakeClassifierRequest(notes: ConsultationNote[], catalog: IntakeCatalog) {
  const checked = validateIntakeCatalog(catalog), activeNotes = intakeSourceNotes(notes);
  if (!activeNotes.length) throw new Error("INTAKE_NO_ACTIVE_NOTES: 상담이력을 먼저 입력해 주세요.");
  if (!checked.features.length) throw new Error("INTAKE_EMPTY_FEATURE_CATALOG: 분류 기준정보를 먼저 등록해 주세요.");
  const object = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, properties, required: Object.keys(properties) });
  const schema = object({ claims: { type: "array", maxItems: INTAKE_LIMITS.claims, items: object({
    featureId: { type: "string", enum: checked.features.map(feature => feature.id) },
    subjectId: { type: "string", minLength: 1, maxLength: 120, pattern: "^(case|(income|debt|asset|household|expense|event|procedure):[A-Za-z0-9][A-Za-z0-9_.:-]*)$" }, subjectLabel: { type: "string", minLength: 1, maxLength: 250 },
    state: { type: "string", enum: ["present", "absent", "unknown", "conflict", "legal_review"] },
    temporal: { type: "string", enum: ["current", "past", "uncertain"] },
    refs: { type: "array", minItems: 1, maxItems: INTAKE_LIMITS.refsPerClaim, items: object({ noteId: { type: "string", enum: activeNotes.map(note => note.id) }, quote: { type: "string", minLength: 2, maxLength: INTAKE_LIMITS.quoteChars } }) },
  }) } });
  const packet = {
    purpose: "consultation_claim_classification_only", promptVersion: INTAKE_PROMPT_VERSION, catalogVersion: checked.version,
    features: checked.features.map(feature => ({ id: feature.id, label: feature.label, scope: feature.scope, description: feature.description })),
    notes: activeNotes.map(note => ({ id: note.id, sequence: note.sequence, occurredAt: note.occurredAt, text: note.text })),
    limits: { maximumClaims: INTAKE_LIMITS.claims, noImplicitAbsence: true, noEvidenceAcceptance: true },
  };
  return { agent: "consultation_classifier", instructions: intakeClassifierInstructions(), input: [{ role: "user", content: [{ type: "input_text", text: JSON.stringify(packet) }] }], schema, maxOutput: 14_000 };
}
