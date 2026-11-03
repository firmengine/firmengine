import test from "node:test";
import assert from "node:assert/strict";
import { repaymentPlanLedgerAnnex } from "../lib/document-annexes.ts";
import type { CaseData } from "../lib/domain.ts";
import type { CalculationResult } from "../lib/assessment.ts";
import type { PlanLedger } from "../lib/repayment-plan-model.ts";
import type { PlanReconciliation } from "../lib/plan-reconciliation.ts";

const UNKNOWN = "[확인 필요]";

// Entirely synthetic. Source row money is observed; reconciliation totals may be a
// fail-closed placeholder ("0"), which is NOT an observed or approved zero Won.
function sample(months: 36 | 48 | 60, options: {
  reconciliationStatus?: "reconciled" | "blocked";
  ledgerStatus?: "complete" | "blocked";
  zeroRows?: boolean;
  placeholderTotals?: boolean;
} = {}) {
  const amount = options.zeroRows ? "0" : "1";
  const expected = options.zeroRows ? "0" : String(months);
  const total = options.placeholderTotals ? "0" : expected;
  const rows = Array.from({ length: months }, (_, index) => ({
    installment: index + 1,
    paymentDate: "2026-12-01",
    phaseId: "SYN-P",
    debtId: "SYN-D",
    claimClass: "ordinary",
    principalWon: amount,
    interestWon: "0",
    otherComponentWon: "0",
    balanceAfter: options.zeroRows ? "0" : String(months - index - 1),
    fundingSourceId: "ordinary_budget",
    sourceIds: ["SYN-F"],
  }));
  const data = { context: { planMonths: months } } as unknown as CaseData;
  const calculation = { monthlyPaymentWon: "1" } as unknown as CalculationResult;
  const ledger = {
    status: options.ledgerStatus ?? "complete",
    rows,
    issues: options.ledgerStatus === "blocked" ? ["PLAN_LEDGER_BLOCKED"] : [],
  } as unknown as PlanLedger;
  const reconciliation = {
    status: options.reconciliationStatus ?? "reconciled",
    issues: options.reconciliationStatus === "blocked" ? ["INVALID_LEDGER_MONEY"] : [],
    totals: {
      principalWon: total, interestWon: "0", otherComponentWon: "0", totalWon: total,
      ordinaryWon: total, priorityWon: "0", estateWon: "0", trusteeFeeWon: "0",
    },
    unallocatedBudgets: Object.fromEntries(
      Array.from({ length: months }, (_, i) => [`${i + 1}:disposable_income`, "0"])
    ),
    priorityPayoffInstallment: {},
    priorityCoverage: {},
  } as unknown as PlanReconciliation;
  return repaymentPlanLedgerAnnex(data, calculation, ledger, reconciliation);
}

for (const months of [36, 48, 60] as const) {
  test(`blocked placeholder totals are not shown as 0 Won (${months} months)`, () => {
    const annex = sample(months, { reconciliationStatus: "blocked", placeholderTotals: true });
    assert.equal(annex.status, "blocked");
    assert.equal(annex.rows[0]?.[3], "1"); // Observed source row is preserved.
    assert.equal(annex.summary?.rows.at(-1)?.[3], String(months)); // Raw row principal.
    assert.equal(annex.summary?.rows.at(-1)?.[6], UNKNOWN); // Unapproved total.
    assert.equal(annex.summary?.rows.at(-1)?.[7], UNKNOWN); // Not a 0 Won result.
    assert.equal(annex.summary?.rows.at(-1)?.[9], "대조 보류");
  });
  test(`stale reconciled totals cannot pass source-backed (${months} months)`, () => {
    const annex = sample(months, { placeholderTotals: true });
    assert.equal(annex.status, "blocked");
    assert.equal(annex.summary?.rows.at(-1)?.[7], UNKNOWN);
  });
  test(`blocked ledger cannot show a verified summary (${months} months)`, () => {
    const annex = sample(months, { ledgerStatus: "blocked" });
    assert.equal(annex.status, "blocked");
    assert.equal(annex.summary?.rows.at(-1)?.[7], UNKNOWN);
  });
  test(`verified amount and explicit zero remain distinguishable (${months} months)`, () => {
    const valid = sample(months);
    assert.equal(valid.status, "source_backed");
    assert.equal(valid.summary?.rows.at(-1)?.[7], String(months));
    const zero = sample(months, { zeroRows: true });
    assert.equal(zero.status, "source_backed");
    assert.equal(zero.rows[0]?.[3], "0");
    assert.equal(zero.summary?.rows.at(-1)?.[7], "0");
  });
}

test.todo("Staging D1 -> full 18-module calculation -> official DOCX byte readback + reviewer signoff");
