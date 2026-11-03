/** A monetary display guard. Positive output verifies arithmetic, not legal entitlement or filing readiness. */
export type PlanFormLedgerLike = {
  status: string;
  rows: Array<{ installment: number; debtId: string; claimClass: string; principalWon: unknown; interestWon: unknown; otherComponentWon: unknown }>;
};
export type PlanFormReconciliationLike = {
  status: string;
  totals: { principalWon: unknown; interestWon: unknown; otherComponentWon: unknown; totalWon: unknown; ordinaryWon: unknown; priorityWon: unknown; estateWon: unknown; trusteeFeeWon: unknown };
  unallocatedBudgets: Record<string, unknown>;
  legalReviewTasks?: string[];
};
const validWon = (v: unknown): v is string => typeof v === "string" && /^\d+$/.test(v);

/** Return a uniform, arithmetically reconciled amount or null (unresolved); never invent zero. */
export function reconciledCreditorMonthlyWon(
  ledger: PlanFormLedgerLike | undefined,
  reconciliation: PlanFormReconciliationLike | undefined,
  debtId: string,
  expectedInstallments: number | null | undefined,
): string | null {
  if (!ledger || ledger.status !== "complete" || !reconciliation || reconciliation.status !== "reconciled" ||
      (reconciliation.legalReviewTasks?.length ?? 0) > 0 || !Number.isSafeInteger(expectedInstallments) ||
      expectedInstallments === null || expectedInstallments === undefined || expectedInstallments <= 0 || !debtId ||
      !Array.isArray(ledger.rows) || !ledger.rows.length || !reconciliation.totals || !reconciliation.unallocatedBudgets) return null;
  const allowed = new Set(["ordinary", "priority", "estate", "trustee_fee"]);
  const months = new Set<number>();
  const actual = { principalWon: 0n, interestWon: 0n, otherComponentWon: 0n, totalWon: 0n,
    ordinaryWon: 0n, priorityWon: 0n, estateWon: 0n, trusteeFeeWon: 0n };
  const byMonth = new Map<number, bigint>();
  for (const row of ledger.rows) {
    if (!Number.isSafeInteger(row.installment) || row.installment < 1 || row.installment > expectedInstallments ||
      !allowed.has(row.claimClass) || !validWon(row.principalWon) || !validWon(row.interestWon) ||
      !validWon(row.otherComponentWon)) return null;
    months.add(row.installment);
    const principal = BigInt(row.principalWon), interest = BigInt(row.interestWon), other = BigInt(row.otherComponentWon);
    const paid = principal + interest + other;
    actual.principalWon += principal; actual.interestWon += interest; actual.otherComponentWon += other;
    actual.totalWon += paid;
    const classKey = row.claimClass === "trustee_fee" ? "trusteeFeeWon" : `${row.claimClass}Won` as "ordinaryWon" | "priorityWon" | "estateWon";
    actual[classKey] += paid;
    if (row.debtId === debtId) byMonth.set(row.installment, (byMonth.get(row.installment) ?? 0n) + paid);
  }
  if (months.size !== expectedInstallments || byMonth.size !== expectedInstallments) return null;
  for (let m = 1; m <= expectedInstallments; m++) {
    if (!months.has(m) || !byMonth.has(m) || !validWon(reconciliation.unallocatedBudgets[`${m}:disposable_income`])) return null;
  }
  for (const [key, amount] of Object.entries(actual)) {
    const stated = reconciliation.totals[key as keyof typeof actual];
    if (!validWon(stated) || BigInt(stated) !== amount) return null;
  }
  const first = byMonth.get(1)!;
  for (let m = 2; m <= expectedInstallments; m++) if (byMonth.get(m) !== first) return null;
  return first.toString();
}
