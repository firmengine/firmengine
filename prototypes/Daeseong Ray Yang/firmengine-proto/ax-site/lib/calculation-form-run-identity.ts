/** Calculation-to-form binding is not a legal approval or an active-head assertion. */
export interface CalculationFormRunIdentity {
  caseId: string;
  caseRevision: number;
  dataVersion: number;
}
export function assertCalculationFormRunIdentity(
  run: CalculationFormRunIdentity | null,
  expected: CalculationFormRunIdentity,
): void {
  if (!run || typeof run.caseId !== "string" || !run.caseId.trim()
    || typeof expected.caseId !== "string" || !expected.caseId.trim()
    || !Number.isSafeInteger(run.caseRevision) || run.caseRevision < 0
    || !Number.isSafeInteger(run.dataVersion) || run.dataVersion < 0
    || !Number.isSafeInteger(expected.caseRevision) || expected.caseRevision < 0
    || !Number.isSafeInteger(expected.dataVersion) || expected.dataVersion < 0
    || run.caseId !== expected.caseId
    || run.caseRevision !== expected.caseRevision
    || run.dataVersion !== expected.dataVersion) {
    throw new Error("DOCUMENT_CALCULATION_RUN_CONTEXT_MISMATCH");
  }
}
