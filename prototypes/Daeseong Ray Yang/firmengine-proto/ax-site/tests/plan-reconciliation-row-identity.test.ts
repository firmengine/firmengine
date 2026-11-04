import test from "node:test";
import assert from "node:assert/strict";
import { reconcilePlanLedger } from "../lib/plan-reconciliation.ts";

/** Entirely synthetic: tests bookkeeping identity only, not court recognition. */
function fixture() {
  const data = {
    context: { planMonths: 2, monthlyTrusteeFee: { amountWon: "0" } },
    debts: [{
      id: "synthetic-loan-1", principal: { amountWon: "100" },
      interest: { amountWon: "0" }, priority: "ordinary", classification: "ordinary",
    }],
  } as unknown as Parameters<typeof reconcilePlanLedger>[0];
  const calculation = {
    planTotalWon: "100", ordinaryRepaymentBudgetWon: "50",
    monthlyPaymentWon: "50", disposableIncomeWon: "50",
  } as unknown as Parameters<typeof reconcilePlanLedger>[1];
  const debtRow = (installment: number) => ({
    installment, paymentDate: "2026-11-10", phaseId: "synthetic-phase",
    debtId: "synthetic-loan-1", claimClass: "ordinary" as const,
    principalWon: "50", interestWon: "0", otherComponentWon: "0",
    fundingSourceId: "ordinary_budget", balanceAfter: installment === 1 ? "50" : "0",
    sourceIds: ["synthetic-only"],
  });
  const feeRow = (installment: number) => ({
    installment, paymentDate: "2026-11-10", phaseId: "synthetic-phase",
    debtId: "system:trustee-fee", claimClass: "trustee_fee" as const,
    principalWon: "0", interestWon: "0", otherComponentWon: "0",
    fundingSourceId: "disposable_income", balanceAfter: "0", sourceIds: [],
  });
  const ledger = {
    status: "complete" as const, issues: [],
    rows: [debtRow(1), feeRow(1), debtRow(2), feeRow(2)],
  } as Parameters<typeof reconcilePlanLedger>[2];
  return { data, calculation, ledger, feeRow };
}

test("valid two-installment synthetic ledger stays reconciled", () => {
  const { data, calculation, ledger } = fixture();
  const result = reconcilePlanLedger(data, calculation, ledger);
  assert.equal(result.status, "reconciled");
  assert.deepEqual(result.issues, []);
});

test("unknown debt IDs must not reconcile even when all money totals match", () => {
  const { data, calculation, ledger } = fixture();
  ledger.rows = ledger.rows.map(row => row.debtId === "synthetic-loan-1"
    ? { ...row, debtId: "nonexistent-creditor" } : row);
  const result = reconcilePlanLedger(data, calculation, ledger);
  assert.equal(result.status, "blocked");
  assert.ok(result.issues.includes("LEDGER_DEBT_MISSING:nonexistent-creditor"));
});

test("duplicate zero-valued trustee-fee row is a structural conflict, not 0", () => {
  const { data, calculation, ledger, feeRow } = fixture();
  ledger.rows.push(feeRow(1));
  const result = reconcilePlanLedger(data, calculation, ledger);
  assert.equal(result.status, "blocked");
  assert.ok(result.issues.includes("DUPLICATE_TRUSTEE_FEE_MONTH:1"));
});

test("ordinary claim cannot be funded by a priority-claim budget", () => {
  const { data, calculation, ledger } = fixture();
  ledger.rows = ledger.rows.map(row => row.claimClass === "ordinary"
    ? { ...row, fundingSourceId: "priority_budget" } : row);
  const result = reconcilePlanLedger(data, calculation, ledger);
  assert.equal(result.status, "blocked");
  assert.ok(result.issues.includes("INVALID_LEDGER_FUNDING_SOURCE:1:synthetic-loan-1"));
});

test("nominal total mismatch stays a separate legal-review task, not accepted", () => {
  const { data, calculation, ledger } = fixture();
  calculation.planTotalWon = "120";
  const result = reconcilePlanLedger(data, calculation, ledger);
  assert.equal(result.status, "reconciled");
  assert.ok(result.legalReviewTasks?.includes("ORDINARY_ALLOCATION_UNRESOLVED"));
});
