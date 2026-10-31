import test from "node:test";
import assert from "node:assert/strict";
import { calculateCase, monthlyIncome } from "../lib/assessment.ts";
import { createCase, normalizeMoney } from "../lib/domain.ts";

// Purely synthetic. These fixtures have no customer documents or approved legal meaning.
const source = (basis: "monthly" | "period_total", start?: string, end?: string, amount = "2400000", months = 1) => ({
  id: "SYN-R18-income", kind: "wage" as const, label: "synthetic income",
  amountBasis: basis, periodStart: start, periodEnd: end, periodMonths: months,
  net: normalizeMoney(amount), factIds: [],
});

test("A2 r18: a partial-month monthly source does not claim a complete calendar month", () => {
  const result = monthlyIncome(source("monthly", "2026-01-15", "2026-01-31"));
  assert.equal(result.value, null);
  assert.ok(result.reasons.includes("INCOME_PERIOD_NOT_COMPLETE_CALENDAR_MONTHS"));
});

test("A2 r18: an impossible monthly end date cannot validate a source period", () => {
  const result = monthlyIncome(source("monthly", "2026-02-01", "2026-02-30"));
  assert.equal(result.value, null);
  assert.ok(result.reasons.includes("INCOME_PERIOD_NOT_COMPLETE_CALENDAR_MONTHS"));
});

test("A2 r18: one-sided monthly period is missing evidence, not zero", () => {
  const result = monthlyIncome(source("monthly", "2026-01-01"));
  assert.equal(result.value, null);
  assert.ok(result.reasons.includes("INCOME_PERIOD_NOT_COMPLETE_CALENDAR_MONTHS"));
});

test("A2 r18: a complete monthly observation and explicit zero retain their numeric meaning", () => {
  assert.equal(monthlyIncome(source("monthly", "2026-01-01", "2026-01-31")).value, 2400000n);
  assert.equal(monthlyIncome(source("monthly", "2026-01-01", "2026-01-31", "0")).value, 0n);
  assert.equal(monthlyIncome(source("monthly")).value, 2400000n);
});

test("A2 r18: period-total calendar denominator still checks start, end, and month count", () => {
  assert.equal(monthlyIncome(source("period_total", "2026-01-01", "2026-02-28", "4600001", 2)).value, 2300000n);
  assert.equal(monthlyIncome(source("period_total", "2026-01-15", "2026-01-31")).value, null);
  assert.equal(monthlyIncome(source("period_total", "2026-01-01", "2026-02-28", "4600000", 1)).value, null);
});

test("A2 r18: partial month cannot become a case-wide monthly income or 36-month plan via proposed payment", () => {
  const data = createCase("SYN-A2-r18", "SYN-only", "2026-10-31");
  const quote = "SYN half-month payroll income 2400000 KRW";
  data.documents = [{ id: "SYN-doc", name: "synthetic.pdf", sha256: "8".repeat(64), status: "active", pages: [1] }];
  data.pages = [{ documentId: "SYN-doc", page: 1, role: "evidence", text: quote }];
  data.facts = [{
    id: "SYN-fact", logicalId: "SYN-fact", version: 1, subjectId: "SYN-R18-income",
    key: "income.net", value: "2400000", numeric: normalizeMoney("2400000"),
    rawValue: "2400000", sourceUnit: "KRW", state: "verified", recognition: "accepted",
    refs: [{ documentId: "SYN-doc", page: 1, quote }], validation: [],
  }];
  data.incomes = [{
    ...source("monthly", "2026-01-15", "2026-01-31"),
    recognition: "accepted", recurring: "yes", factIds: ["SYN-fact"],
  }];
  data.context.filingPeriod = { start: "2026-01-01", end: "2026-01-31" };
  data.context.incomePeriodReviewed = true;
  data.context.inventoryComplete.income = "yes";
  data.context.approvedMonthlyPayment = normalizeMoney("500000");
  data.context.planMonths = 36;
  const result = calculateCase(data, { id: "SYN-rule", status: "source_verified", sources: [] });
  assert.equal(result.incomeRows[0]?.monthlyWon, null);
  assert.equal(result.monthlyIncomeWon, null);
  assert.equal(result.monthlyPaymentWon, null);
  assert.equal(result.planTotalWon, null);
});
