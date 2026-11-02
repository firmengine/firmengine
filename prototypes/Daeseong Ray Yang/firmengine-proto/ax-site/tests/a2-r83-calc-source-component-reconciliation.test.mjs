// Synthetic-only A2 r83: technical principal/interest conservation, NOT legal recognition.
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMoney } from "../lib/domain.ts";
import { buildRepaymentPlanModel } from "../lib/repayment-plan-model.ts";
import { reconcilePlanLedger } from "../lib/plan-reconciliation.ts";

const CASES = [
  { id: "normal-principal", principal: "100", interest: "0", monthlyPrincipal: "1", monthlyInterest: "0", expected: "reconciled" },
  { id: "interest-with-zero-source", principal: "100", interest: "0", monthlyPrincipal: "0", monthlyInterest: "1", expected: "blocked", issue: "PAYMENT_EXCEEDS_SOURCE_INTEREST:SYN-D" },
  { id: "interest-exceeds-source", principal: "100", interest: "20", monthlyPrincipal: "0", monthlyInterest: "1", expected: "blocked", issue: "PAYMENT_EXCEEDS_SOURCE_INTEREST:SYN-D" },
  { id: "principal-with-zero-source", principal: "0", interest: "100", monthlyPrincipal: "1", monthlyInterest: "0", expected: "blocked", issue: "PAYMENT_EXCEEDS_SOURCE_PRINCIPAL:SYN-D" },
  { id: "explicit-all-zero", principal: "0", interest: "0", monthlyPrincipal: "0", monthlyInterest: "0", expected: "reconciled" },
  { id: "total-overpayment", principal: "20", interest: "0", monthlyPrincipal: "1", monthlyInterest: "0", expected: "blocked", issue: "PAYMENT_EXCEEDS_CLAIM:SYN-D" },
];

function makeResult(months, item) {
  const perMonth = BigInt(item.monthlyPrincipal) + BigInt(item.monthlyInterest);
  const data = {
    context: {
      revision: 8,
      planMonths: months,
      monthlyTrusteeFee: normalizeMoney("0"),
      paymentSchedule: {
        reviewed: true,
        expectedInstallments: months,
        phases: [{
          id: "SYN-PHASE",
          firstInstallment: 1,
          lastInstallment: months,
          firstPaymentDate: "2026-12-31",
          monthlyAvailableWon: perMonth.toString(),
          allocations: [{
            creditorId: "SYN-D",
            principalWon: item.monthlyPrincipal,
            interestWon: item.monthlyInterest,
          }],
        }],
      },
    },
    debts: [{
      id: "SYN-D",
      creditor: "Synthetic creditor",
      principal: normalizeMoney(item.principal),
      interest: normalizeMoney(item.interest),
      priority: "ordinary",
      classification: "ordinary",
      factIds: ["SYN-F-1"],
    }],
  };
  const calculation = {
    caseRevision: 8,
    planTotalWon: (perMonth * BigInt(months)).toString(),
    ordinaryRepaymentBudgetWon: perMonth.toString(),
    monthlyPaymentWon: perMonth.toString(),
    disposableIncomeWon: perMonth.toString(),
    allocations: [],
  };
  const ledger = buildRepaymentPlanModel(data, calculation);
  const reconciliation = reconcilePlanLedger(data, calculation, ledger);
  return { ledger, reconciliation };
}

for (const months of [36, 48, 60]) {
  for (const item of CASES) {
    test(`A2 r83 ${months}-month ${item.id}: independent source component bound`, () => {
      const { ledger, reconciliation } = makeResult(months, item);
      assert.equal(ledger.status, "complete", "reviewed ledger alone is not final reconciliation");
      assert.deepEqual(ledger.issues, []);
      assert.equal(reconciliation.status, item.expected);
      if (item.issue) assert.ok(reconciliation.issues.includes(item.issue), JSON.stringify(reconciliation.issues));
      const debtRows = ledger.rows.filter(row => row.debtId === "SYN-D");
      assert.equal(debtRows.length, months);
      const principal = debtRows.reduce((n, row) => n + BigInt(row.principalWon), 0n);
      const interest = debtRows.reduce((n, row) => n + BigInt(row.interestWon), 0n);
      assert.equal(principal, BigInt(item.monthlyPrincipal) * BigInt(months));
      assert.equal(interest, BigInt(item.monthlyInterest) * BigInt(months));
      assert.equal(reconciliation.totals.principalWon, principal.toString());
      assert.equal(reconciliation.totals.interestWon, interest.toString());
    });
  }
}
test.todo("A2 r83 verify source Fact identity, same case, producer/revision and SQL source_fact_ids_json against ledger sourceIds");
test.todo("A2 r83 verify tax/priority/post-petition-interest legal treatment with lawyer and calculation practitioner");
test.todo("A2 r83 run full Node project regression/CI and actual DOCX ZIP/XML output readback with staging D1/R2/Cron");
