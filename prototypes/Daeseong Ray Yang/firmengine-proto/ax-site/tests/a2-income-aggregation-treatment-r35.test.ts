import test from "node:test";
import assert from "node:assert/strict";
import { createCase, normalizeMoney } from "../lib/domain.ts";
import { calculateCase } from "../lib/assessment.ts";

const rules = { id: "synthetic-r35", status: "source_verified" as const, sources: [] };
type Treatment = "series_observation" | "independent_source" | "component" | "duplicate" | "unknown";
type Row = { id: string; amount: string; treatment: Treatment; reviewed: boolean; reason?: string };
function fixture(rows: Row[]) {
  const data = createCase("Synthetic aggregation audit", "synthetic-only-r35", "2026-10-20");
  const quotes = rows.map(row => "Synthetic observed salary " + row.id);
  data.documents = [{ id: "doc", name: "synthetic-only.pdf", sha256: "7".repeat(64), status: "active", pages: [1] }];
  data.pages = [{ documentId: "doc", page: 1, role: "evidence", text: quotes.join(" | ") }];
  data.facts = rows.map((row, i) => ({
    id: "fact-" + row.id, logicalId: "fact-" + row.id, version: 1,
    subjectId: row.id, key: "income.net", value: row.amount, rawValue: row.amount,
    sourceUnit: "KRW", numeric: normalizeMoney(row.amount),
    state: "verified" as const, recognition: "accepted" as const,
    refs: [{ documentId: "doc", page: 1, quote: quotes[i] }], validation: [],
  }));
  data.incomes = rows.map(row => ({
    id: row.id, kind: "wage" as const, label: row.id, payerIdentityId: "payer-" + row.id,
    net: normalizeMoney(row.amount), amountBasis: "period_total" as const,
    periodStart: "2025-01-01", periodEnd: "2025-12-31", periodMonths: 12,
    aggregationTreatment: row.treatment, aggregationReviewed: row.reviewed,
    aggregationReviewReason: row.reason, recurring: "yes" as const,
    recognition: "accepted" as const, factIds: ["fact-" + row.id],
  }));
  data.context.inventoryComplete.income = "yes";
  data.context.filingPeriod = { start: "2025-01-01", end: "2025-12-31" };
  data.context.incomePeriodReviewed = true;
  return data;
}
const row = (treatment: Treatment, reviewed: boolean, reason?: string, amount = "28800000"): Row =>
  ({ id: "one", amount, treatment, reviewed, reason });

test("explicit non-unknown income treatment without review never yields a case-wide final number", () => {
  for (const treatment of ["independent_source", "series_observation"] as const) {
    const calculation = calculateCase(fixture([row(treatment, false)]), rules);
    assert.equal(calculation.incomeRows[0].monthlyWon, "2400000"); // observational preview remains
    assert.equal(calculation.monthlyIncomeWon, null);
    assert.equal(calculation.incomeGroups[0].monthlyObservedAverageWon, null);
    assert.ok(calculation.issues.some(issue => issue.includes("INCOME_AGGREGATION_REVIEW_REQUIRED")));
  }
});

test("review flag without an explicit reason is not a completed review", () => {
  const calculation = calculateCase(fixture([row("independent_source", true, "")]), rules);
  assert.equal(calculation.monthlyIncomeWon, null);
  assert.ok(calculation.issues.some(issue => issue.includes("INCOME_AGGREGATION_REVIEW_REQUIRED")));
});

test("completed independent-source review retains arithmetic; unknown remains an observation", () => {
  const approved = calculateCase(fixture([row("independent_source", true, "independence reviewed against source")]), rules);
  assert.equal(approved.monthlyIncomeWon, "2400000");
  assert.equal(approved.incomeGroups[0].observedMonths, 12);
  const unspecified = calculateCase(fixture([row("unknown", false)]), rules);
  assert.equal(unspecified.monthlyIncomeWon, "2400000"); // unchanged contract, NOT court approval
});

test("explicit reviewed zero is not treated as unobserved or null", () => {
  const calculation = calculateCase(fixture([row("series_observation", true, "verified zero", "0")]), rules);
  assert.equal(calculation.monthlyIncomeWon, "0");
  assert.equal(calculation.incomeRows[0].monthlyWon, "0");
});

test("one unreviewed source blocks case-wide sum without deleting reviewed source preview", () => {
  const data = fixture([
    { id: "one", amount: "28800000", treatment: "independent_source", reviewed: true, reason: "distinct payer" },
    { id: "two", amount: "12000000", treatment: "independent_source", reviewed: false },
  ]);
  const calculation = calculateCase(data, rules);
  assert.equal(calculation.monthlyIncomeWon, null);
  assert.deepEqual(calculation.incomeRows.map(x => x.monthlyWon), ["2400000", "1000000"]);
  assert.ok(calculation.issues.some(issue => issue.includes("INCOME_AGGREGATION_REVIEW_REQUIRED:two")));
});

// Integration boundary remains open: PR #67/#79 change assessment.ts, while PR #93
// changes D5103 preflight. These MUST be combined on a fresh base and run in CI.
// This test does not certify legal income, tax reconciliation, D1, or DOCX.
