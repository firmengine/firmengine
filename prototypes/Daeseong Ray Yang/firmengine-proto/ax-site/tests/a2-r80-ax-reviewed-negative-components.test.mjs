// A2 r80 AX: synthetic data ONLY; technical ledger consistency, not legal recognition.
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMoney } from "../lib/domain.ts";
import { buildRepaymentPlanModel } from "../lib/repayment-plan-model.ts";

function scenario(months, kind) {
  const principal = kind === "negative-principal" ? "-5"
    : kind === "zero-principal" ? "0"
    : kind === "malformed-principal" ? "1..2" : "100";
  const interest = kind === "negative-interest" ? "-1" : "0";
  const debt = {
    id: "SYN-R80-D1", creditor: "Synthetic creditor",
    principal: normalizeMoney(principal), interest: normalizeMoney(interest),
    secured: "no", classification: "ordinary", priority: "ordinary",
    factIds: ["SYN-R80-F1"],
  };
  if (kind === "null-principal") debt.principal = normalizeMoney(null);
  if (kind === "null-interest") debt.interest = normalizeMoney(null);
  const debts = kind === "duplicate-debt" ? [debt, { ...debt, creditor: "Second synthetic creditor" }] : [debt];
  const payment = kind === "zero-principal" ? "0" : "1";
  const data = {
    context: {
      revision: 8, planMonths: months, monthlyTrusteeFee: normalizeMoney("0"),
      paymentSchedule: {
        reviewed: true, expectedInstallments: months,
        phases: [{
          id: "SYN-R80-P1", firstInstallment: 1, lastInstallment: months,
          firstPaymentDate: "2026-12-31", monthlyAvailableWon: payment,
          allocations: [{ creditorId: debt.id, principalWon: payment, interestWon: "0" }],
        }],
      },
    },
    debts,
  };
  const calc = {
    caseRevision: 8, planTotalWon: kind === "zero-principal" ? "0" : String(months),
    monthlyPaymentWon: payment, ordinaryRepaymentBudgetWon: payment,
    disposableIncomeWon: payment, allocations: [],
  };
  return buildRepaymentPlanModel(data, calc);
}

for (const months of [36, 48, 60]) {
  for (const kind of ["negative-principal", "negative-interest"]) {
    test(`A2 r80 ${months} months: reviewed ${kind} is not technical complete`, () => {
      const result = scenario(months, kind);
      assert.equal(result.status, "blocked");
      assert.deepEqual(result.issues, ["REVIEWED_SOURCE_DEBT_COMPONENT_NEGATIVE"]);
      assert.equal(result.rows.length, 0);
    });
  }
  for (const kind of ["null-principal", "null-interest", "malformed-principal"]) {
    test(`A2 r80 ${months} months: ${kind} preserves unknown not zero`, () => {
      const result = scenario(months, kind);
      assert.equal(result.status, "blocked");
      assert.ok(result.issues.includes("REVIEWED_SOURCE_DEBT_COMPONENT_UNRESOLVED"));
      assert.equal(result.rows.length, 0);
    });
  }
  test(`A2 r80 ${months} months: observed source and explicit zero remain distinct`, () => {
    for (const kind of ["valid", "zero-principal"]) {
      const result = scenario(months, kind);
      assert.equal(result.status, "complete"); // ledger technical status ONLY
      assert.deepEqual(result.issues, []);
      assert.equal(result.rows.filter(row => row.claimClass === "ordinary").length, months);
      const paid = result.rows.filter(row => row.claimClass === "ordinary")
        .reduce((sum, row) => sum + BigInt(row.principalWon) + BigInt(row.interestWon), 0n);
      assert.equal(paid, kind === "zero-principal" ? 0n : BigInt(months));
    }
  });
  test(`A2 r80 ${months} months: duplicate source debt remains blocked`, () => {
    const result = scenario(months, "duplicate-debt");
    assert.equal(result.status, "blocked");
    assert.ok(result.issues.includes("REVIEWED_DUPLICATE_SOURCE_DEBT_ID"));
  });
}

test.todo("A2 r80: explicit tax/priority treatment needs lawyer confirmation, never auto-approve");
test.todo("A2 r80: orphan Fact ID and D5110/D5111 render readback need same-case lineage verification");
test.todo("A2 r80: execute Node project runner, full CI and staging D1 separately");
