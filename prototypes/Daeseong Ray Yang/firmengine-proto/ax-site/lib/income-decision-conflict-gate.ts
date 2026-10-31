/**
 * Keep same-Fact income decisions unresolved until a reviewer reconciles them.
 * This only guards a case-wide arithmetic value; it does not change original
 * observations or establish a legally approved monthly income.
 */
export const INCOME_SAME_FACT_REVIEW_CONFLICT = "INCOME_SAME_FACT_REVIEW_CONFLICT" as const;

export function guardIncomeTotalAgainstDecisionConflict<T>(
  candidate: T | null,
  resolutionIssues: readonly string[],
): T | null {
  const conflicted = resolutionIssues.some((issue) =>
    issue === INCOME_SAME_FACT_REVIEW_CONFLICT ||
    issue.startsWith(`${INCOME_SAME_FACT_REVIEW_CONFLICT}:`),
  );
  return conflicted ? null : candidate;
}
