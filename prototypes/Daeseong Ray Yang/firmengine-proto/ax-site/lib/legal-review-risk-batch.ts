/** Preserve the approved, version-scoped legal evidence contract across a
 * review batch. This is advisory routing metadata, NOT court/legal approval.
 * In particular, no legacy risk without an approved contract may auto-pass.
 */
import type { LegalReviewRisk } from "./legal-review-packet.ts";

export type LegalReviewRiskCandidate =
  Omit<LegalReviewRisk, "conditions"|"features"|"request"|"legalRuleIds"> & {
    conditions?: string|null;
    features?: string[]|null;
    request?: string|null;
    legalRuleIds?: string[]|null;
  };

export function selectLegalReviewRiskBatch(
  catalog: readonly LegalReviewRiskCandidate[],
  completed: ReadonlySet<string>,
  limit: number,
): LegalReviewRisk[] {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error("INVALID_LEGAL_REVIEW_BATCH_LIMIT");
  return catalog.filter(row => !completed.has(row.id)).slice(0, limit).map(row => ({
    ...row,
    conditions: row.conditions ?? "",
    features: [...(row.features ?? [])],
    request: row.request ?? "",
    legalRuleIds: [...(row.legalRuleIds ?? [])],
    canonicalFieldGroups: (row.canonicalFieldGroups ?? []).map(group => [...group]),
    requiredCalculationOutputs: [...(row.requiredCalculationOutputs ?? [])],
    evidenceContractStatus: row.evidenceContractStatus ?? "unmapped",
  }));
}
