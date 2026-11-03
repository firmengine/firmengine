// A2 r113b synthetic-only regression: malformed rows must HOLD, not throw.
// Monetary equality is technical only; no statutory or court approval inferred.
import test from "node:test";
import assert from "node:assert/strict";
import { reconciledCreditorMonthlyWon } from "../lib/plan-form-monthly-guard.ts";

function fixture(months: number, kind: string) {
  const rows: any[] = Array.from({length: months}, (_, i) => ({
    installment: i + 1, debtId: "SYN-D", claimClass: "ordinary",
    principalWon: "1", interestWon: "0", otherComponentWon: "0"
  }));
  const totals: Record<string,string> = {
    principalWon: String(months), interestWon: "0", otherComponentWon: "0",
    totalWon: String(months), ordinaryWon: String(months),
    priorityWon: "0", estateWon: "0", trusteeFeeWon: "0"
  };
  const ledger: any = {status: "complete", issues: [], rows};
  const reconciliation: any = {
    status: "reconciled", issues: [], legalReviewTasks: [], totals,
    unallocatedBudgets: Object.fromEntries(
      Array.from({length: months}, (_, i) => [`${i + 1}:disposable_income`, "0"])
    )
  };
  switch (kind) {
    case "observed_zero":
      for (const row of rows) row.principalWon = "0";
      totals.principalWon = totals.ordinaryWon = totals.totalWon = "0";
      break;
    case "interest_fee":
      for (const row of rows) row.interestWon = "1";
      totals.interestWon = String(months);
      totals.totalWon = totals.ordinaryWon = String(months * 2);
      for (let i = 1; i <= months; i++) rows.push({
        installment: i, debtId: "SYN-FEE", claimClass: "trustee_fee",
        principalWon: "0", interestWon: "0", otherComponentWon: "1"
      });
      totals.otherComponentWon = totals.trusteeFeeWon = String(months);
      totals.totalWon = String(months * 3);
      break;
    case "null_row": rows.push(null); break;
    case "undefined_row": rows.push(undefined); break;
    case "number_row": rows.push(7); break;
    case "boolean_row": rows.push(false); break;
    case "string_row": rows.push("junk"); break;
    case "array_row": rows.push([]); break;
    case "empty_object_row": rows.push({}); break;
    case "duplicate_zero_row": rows.push({...rows[0], principalWon: "0"}); break;
    case "ledger_issue": ledger.issues = ["STALE_SOURCE_VERSION"]; break;
    case "reconciliation_issue": reconciliation.issues = ["STALE_RECONCILIATION"]; break;
    case "stale_total": totals.totalWon = "0"; break;
    case "bad_money": rows[0].principalWon = "1,20"; break;
    case "missing_month": rows.pop(); break;
    case "changed_class":
      rows[0].claimClass = "priority";
      totals.ordinaryWon = String(months - 1);
      totals.priorityWon = "1";
      break;
  }
  return {ledger, reconciliation};
}
const samples: Array<[string, string | null]> = [
  ["normal", "1"], ["observed_zero", "0"], ["interest_fee", "2"],
  ["null_row", null], ["undefined_row", null], ["number_row", null],
  ["boolean_row", null], ["string_row", null], ["array_row", null],
  ["empty_object_row", null], ["duplicate_zero_row", null],
  ["ledger_issue", null], ["reconciliation_issue", null],
  ["stale_total", null], ["bad_money", null], ["missing_month", null],
  ["changed_class", null]
];
for (const months of [36,48,60]) for (const [kind, expected] of samples) {
  test(`A2 r113b ${months}-month ${kind}`, () => {
    const {ledger, reconciliation} = fixture(months, kind);
    assert.equal(reconciledCreditorMonthlyWon(ledger, reconciliation, "SYN-D", months), expected);
  });
}
