/** A reference fixture or evaluation copy must not gain real OCR evidence through document registration.
 * Human review, court acceptance, and legal/financial recognition are separate gates.
 */
import type { CaseData } from "./domain.ts";

type EvidenceRegistrationIdentity = Pick<CaseData, "structuredTest" | "referenceTest" | "evaluationClone">;

export function canRegisterCaseEvidence(data: EvidenceRegistrationIdentity): boolean {
  return !Boolean(data.structuredTest || data.referenceTest || data.evaluationClone);
}
