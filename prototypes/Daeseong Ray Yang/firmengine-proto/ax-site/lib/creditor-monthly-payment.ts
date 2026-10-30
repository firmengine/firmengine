/** Exact per-creditor monthly amount for the public form preview.
 * This is an arithmetic consistency check, not a legal filing decision.
 */
export interface CreditorMonthLedger {
  status: "complete" | "provisional" | "blocked";
  rows: readonly {
    installment: number;
    debtId: string;
    principalWon: string;
    interestWon: string;
    otherComponentWon: string;
  }[];
}
export interface CreditorMonthReconciliation { status: "reconciled" | "blocked"; }
const exactWon = (value: unknown): value is string => typeof value === "string" && /^\d+$/.test(value);

/** Null means the monthly amount cannot be established. Literal zero is distinct. */
export function constantCreditorMonthlyWon(
  ledger: CreditorMonthLedger | undefined,
  reconciliation: CreditorMonthReconciliation | undefined,
  debtId: string,
  expectedInstallments: number | null | undefined,
): string | null {
  if (!ledger || ledger.status === "blocked" || reconciliation?.status !== "reconciled" ||
      !debtId || !Number.isSafeInteger(expectedInstallments) || expectedInstallments! < 1) return null;
  const amounts = new Map<number, bigint>();
  for (const row of ledger.rows) {
    if (row.debtId !== debtId) continue;
    if (!Number.isSafeInteger(row.installment) || row.installment < 1 || row.installment > expectedInstallments! ||
        !exactWon(row.principalWon) || !exactWon(row.interestWon) || !exactWon(row.otherComponentWon)) return null;
    const value = BigInt(row.principalWon) + BigInt(row.interestWon) + BigInt(row.otherComponentWon);
    amounts.set(row.installment, (amounts.get(row.installment) ?? 0n) + value);
  }
  if (amounts.size !== expectedInstallments) return null;
  const first = amounts.get(1);
  if (first === undefined) return null;
  for (let installment = 2; installment <= expectedInstallments; installment++) {
    if (amounts.get(installment) !== first) return null;
  }
  return first.toString();
}
