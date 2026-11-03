// A2 r113 synthetic-only regression. This is a technical display invariant, not legal approval.
import test from "node:test";
import assert from "node:assert/strict";
import { reconciledCreditorMonthlyWon } from "../lib/plan-form-monthly-guard.ts";

function fixture(months: number, kind: string) {
  const rows: any[] = Array.from({length: months}, (_, i) => ({
    installment: i + 1, debtId: "SYN-D", claimClass: "ordinary",
    principalWon: "1", interestWon: "0", otherComponentWon: "0"
  }));
  const totals: Record<string, string> = {
    principalWon: String(months), interestWon: "0", otherComponentWon: "0",
    totalWon: String(months), ordinaryWon: String(months), priorityWon: "0",
    estateWon: "0", trusteeFeeWon: "0"
  };
  const ledger: any = { status: "complete", issues: [] as string[], rows };
  const reconciliation: any = {
    status: "reconciled", issues: [] as string[], legalReviewTasks: [] as string[],
    totals, unallocatedBudgets: Object.fromEntries(
      Array.from({length: months}, (_, i) => [`${i + 1}:disposable_income`, "0"])
    )
  };
  switch (kind) {
    case "real_zero":
      for (const r of rows) r.principalWon = "0";
      totals.principalWon = totals.totalWon = totals.ordinaryWon = "0";
      break;
    case "with_fee_and_interest":
      for (const r of rows) r.interestWon = "1";
      totals.interestWon = String(months);
      totals.totalWon = totals.ordinaryWon = String(months * 2);
      for (let month = 1; month <= months; month++)
        rows.push({installment: month, debtId: "SYN-FEE", claimClass: "trustee_fee",
          principalWon: "0", interestWon: "0", otherComponentWon: "1"});
      totals.otherComponentWon = totals.trusteeFeeWon = String(months);
      totals.totalWon = String(months * 3);
      break;
    case "duplicate_zero_row":
      rows.push({...rows[0], principalWon: "0"}); // zero does not change totals, but violates row identity
      break;
    case "stale_reconciliation_issue":
      reconciliation.issues = ["CLAIM_CLASS_MISMATCH"];
      break;
    case "stale_ledger_issue":
      ledger.issues = ["STALE_SOURCE_VERSION"];
      break;
    case "mixed_class":
      rows[0].claimClass = "priority";
      totals.priorityWon = "1";
      totals.ordinaryWon = String(months - 1);
      break;
    case "malformed_money":
      rows[0].principalWon = "1,20";
      break;
    case "missing_month":
      rows.pop();
      break;
    case "legal_review":
      reconciliation.legalReviewTasks = ["PRIORITY_POLICY_UNAPPROVED"];
      break;
  }
  return {ledger, reconciliation};
}

const oracles: Array<[string, string | null]> = [
  ["normal", "1"],
  ["real_zero", "0"],
  ["with_fee_and_interest", "2"],
  ["duplicate_zero_row", null],
  ["stale_reconciliation_issue", null],
  ["stale_ledger_issue", null],
  ["mixed_class", null],
  ["malformed_money", null],
  ["missing_month", null],
  ["legal_review", null]
];
for (const months of [36, 48, 60]) for (const [kind, expected] of oracles) {
  test(`A2 r113 / ${months} months / ${kind}`, () => {
    const {ledger, reconciliation} = fixture(months, kind);
    assert.equal(reconciledCreditorMonthlyWon(ledger, reconciliation, "SYN-D", months), expected);
  });
}
