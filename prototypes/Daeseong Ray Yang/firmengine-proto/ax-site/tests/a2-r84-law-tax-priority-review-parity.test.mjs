// A2 r84 SYNTHETIC ONLY. Tax is already mapped to "priority" on ledger rows.
// This tests technical parity of reviewed coverage gates, NOT tax debt's legal priority
// or court recognition; attorney/calculation practitioner approval is still required.
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMoney } from "../lib/domain.ts";
import { buildRepaymentPlanModel } from "../lib/repayment-plan-model.ts";
import { reconcilePlanLedger } from "../lib/plan-reconciliation.ts";

const CASES = [
  {
    "id": "tax-no-payment",
    "classification": "tax",
    "priority": "ordinary",
    "perMonth": 0,
    "principalKind": "fixed",
    "expectedLedger": "blocked",
    "expectedReconciliation": "blocked",
    "coverage": "blocked",
    "ledgerIssue": "PRIORITY_CLAIM_ZERO_PAYMENT:SYN-DEBT"
  },
  {
    "id": "tax-partial",
    "classification": "tax",
    "priority": "ordinary",
    "perMonth": 1,
    "principalKind": "term+1",
    "expectedLedger": "complete",
    "expectedReconciliation": "blocked",
    "coverage": "blocked",
    "recIssue": "PRIORITY_ESTATE_NOT_FULLY_PAID_BY_DEADLINE:SYN-DEBT"
  },
  {
    "id": "tax-full",
    "classification": "tax",
    "priority": "ordinary",
    "perMonth": 1,
    "principalKind": "term",
    "expectedLedger": "complete",
    "expectedReconciliation": "reconciled",
    "coverage": "covered"
  },
  {
    "id": "tax-explicit-zero",
    "classification": "tax",
    "priority": "ordinary",
    "perMonth": 0,
    "principalKind": "zero",
    "expectedLedger": "complete",
    "expectedReconciliation": "reconciled",
    "coverage": "covered"
  },
  {
    "id": "ordinary-no-payment",
    "classification": "ordinary",
    "priority": "ordinary",
    "perMonth": 0,
    "principalKind": "fixed",
    "expectedLedger": "complete",
    "expectedReconciliation": "reconciled",
    "coverage": null
  },
  {
    "id": "priority-no-payment",
    "classification": "ordinary",
    "priority": "priority",
    "perMonth": 0,
    "principalKind": "fixed",
    "expectedLedger": "blocked",
    "expectedReconciliation": "blocked",
    "coverage": "blocked",
    "ledgerIssue": "PRIORITY_CLAIM_ZERO_PAYMENT:SYN-DEBT"
  },
  {
    "id": "estate-no-payment",
    "classification": "estate",
    "priority": "estate",
    "perMonth": 0,
    "principalKind": "fixed",
    "expectedLedger": "blocked",
    "expectedReconciliation": "blocked",
    "coverage": "blocked",
    "ledgerIssue": "PRIORITY_CLAIM_ZERO_PAYMENT:SYN-DEBT"
  },
  {
    "id": "tax-interest-null",
    "classification": "tax",
    "priority": "ordinary",
    "perMonth": 0,
    "principalKind": "fixed",
    "nullInterest": true,
    "expectedLedger": "blocked",
    "expectedReconciliation": "blocked",
    "coverage": "unknown",
    "ledgerIssue": "REVIEWED_SOURCE_DEBT_COMPONENT_UNRESOLVED"
  }
];

function fixture(months, c) {
  const principal = c.principalKind === "zero" ? 0
    : c.principalKind === "term" ? months
    : c.principalKind === "term+1" ? months + 1 : 100;
  const money = n => normalizeMoney(String(n));
  const allocations = c.perMonth > 0 || c.principalKind === "zero"
    ? [{ creditorId: "SYN-DEBT", principalWon: String(c.perMonth), interestWon: "0" }] : [];
  const data = {
    context: {
      revision: 8, planMonths: months, monthlyTrusteeFee: money(0),
      monthlyPriorityPayment: money(1), monthlyEstatePayment: money(1),
      paymentSchedule: { reviewed: true, reviewReason: "SYN review only",
        expectedInstallments: months,
        phases: [{ id: "SYN-PHASE", firstInstallment: 1, lastInstallment: months,
          firstPaymentDate: "2026-12-31", monthlyAvailableWon: String(c.perMonth),
          allocations }] },
    },
    debts: [{ id: "SYN-DEBT", creditor: "SYN CREDITOR", classification: c.classification,
      priority: c.priority, principal: money(principal),
      interest: c.nullInterest ? null : money(0), factIds: ["SYN-FACT-1"] }],
  };
  const calculation = { caseRevision: 8, planTotalWon: "0",
    ordinaryRepaymentBudgetWon: "1", monthlyPaymentWon: String(c.perMonth),
    disposableIncomeWon: "1", allocations: [] };
  return { data, calculation };
}

for (const months of [36, 48, 60]) {
  for (const c of CASES) {
    test(`A2 LAW r84 ${months} months / ${c.id}: technical source coverage only`, () => {
      const { data, calculation } = fixture(months, c);
      const ledger = buildRepaymentPlanModel(data, calculation);
      const checked = reconcilePlanLedger(data, calculation, ledger);
      assert.equal(ledger.status, c.expectedLedger, JSON.stringify(ledger.issues));
      assert.equal(checked.status, c.expectedReconciliation, JSON.stringify(checked.issues));
      if (c.ledgerIssue) assert.ok(ledger.issues.includes(c.ledgerIssue), JSON.stringify(ledger.issues));
      if (c.recIssue) assert.ok(checked.issues.includes(c.recIssue), JSON.stringify(checked.issues));
      assert.equal(checked.priorityCoverage["SYN-DEBT"]?.status ?? null, c.coverage);
      const due = BigInt(data.debts[0].principal.amountWon)
        + BigInt(data.debts[0].interest?.amountWon ?? "0");
      const total = ledger.rows.filter(row => row.debtId === "SYN-DEBT")
        .reduce((n,row) => n + BigInt(row.principalWon) + BigInt(row.interestWon),0n);
      assert.equal(total, BigInt(c.perMonth) * BigInt(
        c.nullInterest || (c.perMonth === 0 && c.principalKind !== "zero") ? 0 : months));
      if (c.id === "tax-partial") {
        assert.equal(due - total, 1n, "independent uncovered source balance");
        assert.equal(checked.priorityCoverage["SYN-DEBT"]?.uncoveredWon,"1");
      }
      if (c.id === "tax-full") assert.equal(total,due);
      if (c.id === "tax-explicit-zero") assert.equal(total,0n);
      if (c.classification === "tax" && !c.nullInterest && c.perMonth > 0)
        assert.ok(ledger.rows.filter(x => x.debtId === "SYN-DEBT").every(x => x.claimClass === "priority"));
    });
  }
}
test.todo("A2 LAW r84 attorney/practitioner: prove priority of each individual tax claim, exceptions, due dates and periods");
test.todo("A2 LAW r84 verify same-case Fact existence/revision and SQL feature → ledger → actual D5110/D5111 DOCX parity");
test.todo("A2 LAW r84 run project Node/CI and staging D1/R2/Cron separately; do not infer filing approval");
