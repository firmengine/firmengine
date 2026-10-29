import type { ConsultationNote } from "./intake-types.ts";

/** Semantic identity for classifier input. Case storage identity is audit-only. */
export const INTAKE_FINGERPRINT_SCHEMA = "intake-input-fingerprint/2" as const;
export const INTAKE_CLASSIFIER_OUTPUT_CONTRACT_VERSION = "intake-classifier-response/1" as const;
export interface IntakeSemanticInput {
  /** Entire immutable consultation history. Active notes are sent to the classifier separately. */
  notes: readonly Pick<ConsultationNote, "id" | "textSha256" | "occurredAt" | "supersedesId" | "sequence">[];
  catalogHash: string;
  courtId: string;
  asOf: string;
  engineVersion: string;
  promptVersion: string;
  model: string;
  outputContractVersion: string;
}
export interface IntakeAuditIdentity { caseRevision: number; caseStorageToken: string; caseInputSha256: string }

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value as object).sort().map(k => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function intakeSemanticPayload(input: IntakeSemanticInput) {
  return {
    schema: INTAKE_FINGERPRINT_SCHEMA,
    consultationHistory: [...input.notes].sort((a, b) => a.sequence - b.sequence).map(n => ({ id: n.id, textSha256: n.textSha256, occurredAt: n.occurredAt, supersedesId: n.supersedesId })),
    catalogHash: input.catalogHash, courtId: input.courtId, asOf: input.asOf,
    engineVersion: input.engineVersion, promptVersion: input.promptVersion,
    model: input.model, outputContractVersion: input.outputContractVersion,
  };
}
export async function intakeInputFingerprint(input: IntakeSemanticInput): Promise<string> {
  const bytes = new TextEncoder().encode(stable(intakeSemanticPayload(input)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `${INTAKE_FINGERPRINT_SCHEMA}:${[...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("")}`;
}
/** Workflow adoption and document edits deliberately do not enter semantic input. */
export function intakeAuditIdentity(identity: IntakeAuditIdentity): IntakeAuditIdentity { return { ...identity }; }
