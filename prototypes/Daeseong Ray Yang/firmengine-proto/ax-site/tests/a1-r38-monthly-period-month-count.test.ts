import test from "node:test";
import assert from "node:assert/strict";
import { monthlyIncome, calculateCase } from "../lib/assessment.ts";
import { createCase, normalizeMoney } from "../lib/domain.ts";

/** A1-CALC-005: only synthetic money and periods, never a customer/OCR source. */
function monthlyObservation(start: string, end: string, months: number | undefined, amount = "1000000") {
  return {
    id: "synthetic-income", kind: "wage" as const, label: "합성 월소득",
    employer: "합성 지급자", payerIdentityId: "synthetic-payer",
    net: normalizeMoney(amount), amountBasis: "monthly" as const,
    periodStart: start, periodEnd: end, periodMonths: months,
    recurring: "yes" as const, recognition: "accepted" as const, factIds: ["synthetic-fact"],
  };
}
const rules = { id: "synthetic", status: "source_verified" as const, sources: [] };

test("A1-CALC-005: a claimed one-month observation spanning 12 calendar months is not an approved monthly amount", () => {
  const result = monthlyIncome(monthlyObservation("2025-01-01", "2025-12-31", 1));
  assert.equal(result.value, null);
  assert.ok(result.reasons.includes("INCOME_PERIOD_DENOMINATOR_CONFLICT"));
  const zero = monthlyIncome(monthlyObservation("2025-01-01", "2025-12-31", 1, "0"));
  assert.equal(zero.value, null, "an explicitly observed zero cannot erase a contradictory period");
  assert.ok(zero.reasons.includes("INCOME_PERIOD_DENOMINATOR_CONFLICT"));
});

test("A1-CALC-005: a valid one-month observation and a consistent multi-month monthly rate remain calculable", () => {
  assert.equal(monthlyIncome(monthlyObservation("2025-01-01", "2025-01-31", 1)).value, 1000000n);
  assert.equal(monthlyIncome(monthlyObservation("2025-01-01", "2025-12-31", 12)).value, 1000000n);
  assert.equal(monthlyIncome(monthlyObservation("2025-01-01", "2025-01-31", undefined, "0")).value, 0n);
});

test("A1-CALC-005: a conflicting monthly period cannot feed case-wide income or proposed plan arithmetic", () => {
  const data = createCase("합성 기간 충돌", "synthetic-a1-r38", "2026-11-01");
  data.documents = [{ id: "synthetic-doc", name: "synthetic.pdf", sha256: "a".repeat(64), status: "active", pages: [1] }];
  data.pages = [{ documentId: "synthetic-doc", page: 1, role: "evidence", text: "Synthetic amount 1000000" }];
  data.facts = [{
    id: "synthetic-fact", logicalId: "synthetic-fact", version: 1, subjectId: "synthetic-income",
    key: "income.net", value: "1000000", rawValue: "1000000", numeric: normalizeMoney("1000000"),
    sourceUnit: "KRW", state: "verified", recognition: "accepted",
    refs: [{ documentId: "synthetic-doc", page: 1, quote: "Synthetic amount 1000000" }], validation: [],
  }];
  data.incomes = [monthlyObservation("2025-01-01", "2025-12-31", 1)];
  data.context.filingPeriod = { start: "2025-01-01", end: "2025-12-31" };
  data.context.incomePeriodReviewed = true;
  data.context.inventoryComplete.income = "yes";
  data.context.approvedMonthlyPayment = normalizeMoney("500000");
  data.context.planMonths = 36;
  const result = calculateCase(data, rules);
  assert.equal(result.incomeRows[0]?.monthlyWon, null);
  assert.equal(result.incomeGroups[0]?.monthlyObservedAverageWon, null);
  assert.equal(result.monthlyIncomeWon, null);
  assert.equal(result.monthlyPaymentWon, null);
  assert.equal(result.planTotalWon, null);
  assert.ok(result.issues.some(issue => issue.startsWith("INCOME_PERIOD_DENOMINATOR_CONFLICT:")));
});

test("A1-CALC-005: eleven genuinely missing months remain a coverage blocker", () => {
  const data = createCase("합성 단월 관측", "synthetic-a1-r38-single-month", "2026-11-01");
  data.documents = [{ id: "synthetic-doc", name: "synthetic.pdf", sha256: "b".repeat(64), status: "active", pages: [1] }];
  data.pages = [{ documentId: "synthetic-doc", page: 1, role: "evidence", text: "Synthetic amount 1000000" }];
  data.facts = [{
    id: "synthetic-fact", logicalId: "synthetic-fact", version: 1, subjectId: "synthetic-income",
    key: "income.net", value: "1000000", rawValue: "1000000", numeric: normalizeMoney("1000000"),
    sourceUnit: "KRW", state: "verified", recognition: "accepted",
    refs: [{ documentId: "synthetic-doc", page: 1, quote: "Synthetic amount 1000000" }], validation: [],
  }];
  data.incomes = [monthlyObservation("2025-01-01", "2025-01-31", 1)];
  data.context.filingPeriod = { start: "2025-01-01", end: "2025-12-31" };
  data.context.incomePeriodReviewed = true;
  data.context.inventoryComplete.income = "yes";
  const result = calculateCase(data, rules);
  assert.equal(result.incomeGroups[0]?.observedMonths, 1);
  assert.equal(result.incomeGroups[0]?.monthlyObservedAverageWon, "1000000");
  assert.equal(result.monthlyIncomeWon, null);
  assert.ok(result.issues.includes("INCOME_PERIOD_COVERAGE_INCOMPLETE"));
});
