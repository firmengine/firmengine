import test from "node:test";
import assert from "node:assert/strict";
import { createCase, DRAFT_RULESET, type CaseData, type Fact, type IncomeSource } from "../lib/domain.ts";
import { calculateCase } from "../lib/assessment.ts";
import { resolveIncomeRows } from "../lib/income-resolution.ts";

const HASH = "d".repeat(64);
function fixture(): CaseData {
  const data = createCase("Synthetic shared-net Fact", "synthetic-shared-net", "2026-11-01");
  data.documents = [{ id: "doc", name: "synthetic.pdf", sha256: HASH, status: "active", pages: [1] }];
  data.pages = [{ documentId: "doc", page: 1, role: "evidence", text: "", imageUrl: "/synthetic/1" }];
  data.context.inventoryComplete = { income: "yes", debt: "yes", asset: "yes" };
  data.context.filingPeriod = { start: "2025-01-01", end: "2025-12-31" };
  return data;
}
function addFact(data: CaseData, id: string, key = "income.net") {
  const fact: Fact = {
    id, logicalId: id, version: 1, subjectId: "synthetic-source-row",
    key, value: "1000000", rawValue: "1000000",
    state: "verified", recognition: "accepted", validation: [],
    refs: [{ documentId: "doc", page: 1, quote: "1000000", sourceHash: HASH }],
  };
  data.facts.push(fact);
}
function income(id: string, label: string, factIds: string[], grossOnly = false): IncomeSource {
  return {
    id, kind: "wage", label, employer: label,
    net: { rawValue: "1000000", unit: "KRW", currency: "KRW", amountWon: "1000000", normalizationStatus: "exact" },
    periodStart: "2025-01-01", periodEnd: "2025-12-31",
    amountBasis: "monthly", periodMonths: 12, recurring: "yes",
    recognition: "accepted", factIds,
    ...(grossOnly ? { sourceCalculationRole: "gross_turnover_only" as const } : {}),
  };
}
function reuseIssue(result: ReturnType<typeof resolveIncomeRows>) {
  return result.issues.find(issue => issue.startsWith("INCOME_SAME_NET_FACT_MULTIPLE_ROWS_REVIEW_REQUIRED:"));
}

test("one current net Fact in two independently labeled incomes blocks case-wide aggregation", () => {
  const data = fixture();
  addFact(data, "net-F1");
  data.incomes = [income("salary-A", "Employer A", ["net-F1"]), income("salary-B", "Employer B", ["net-F1"])];
  const resolution = resolveIncomeRows(data);
  assert.deepEqual(resolution.rows.map(row => row.id), ["salary-A", "salary-B"]);
  assert.deepEqual(resolution.duplicates, []);
  assert.equal(reuseIssue(resolution), "INCOME_SAME_NET_FACT_MULTIPLE_ROWS_REVIEW_REQUIRED:net-F1:salary-A,salary-B");
  const calculation = calculateCase(data, DRAFT_RULESET);
  assert.equal(calculation.monthlyIncomeWon, null);
  assert.ok(calculation.issues.some(issue => issue.includes("INCOME_SAME_NET_FACT_MULTIPLE_ROWS_REVIEW_REQUIRED")));
});

test("exact repeated current net Fact and identical typed observation is still deduplicated", () => {
  const data = fixture();
  addFact(data, "net-F1");
  data.incomes = [income("salary-A", "Employer A", ["net-F1"]), income("salary-copy", "Employer A", ["net-F1"])];
  const result = resolveIncomeRows(data);
  assert.deepEqual(result.rows.map(row => row.id), ["salary-A"]);
  assert.deepEqual(result.duplicates, ["salary-copy"]);
  assert.equal(reuseIssue(result), undefined);
});

test("distinct current net Facts do not create a shared-Fact conflict", () => {
  const data = fixture();
  addFact(data, "net-F1");
  addFact(data, "net-F2");
  data.incomes = [income("salary-A", "Employer A", ["net-F1"]), income("salary-B", "Employer B", ["net-F2"])];
  const result = resolveIncomeRows(data);
  assert.equal(result.rows.length, 2);
  assert.equal(reuseIssue(result), undefined);
});

test("one row with a repeated reference ID is not a second income observation", () => {
  const data = fixture();
  addFact(data, "net-F1");
  data.incomes = [income("salary-A", "Employer A", ["net-F1", "net-F1"])];
  assert.equal(reuseIssue(resolveIncomeRows(data)), undefined);
});

test("gross-only material may support a separate row without being a duplicated net Fact", () => {
  const data = fixture();
  addFact(data, "gross-F1", "income.gross");
  data.incomes = [income("gross", "Business gross", ["gross-F1"], true), income("net", "Reviewed net candidate", ["gross-F1"])];
  assert.equal(reuseIssue(resolveIncomeRows(data)), undefined);
});

test("a current income.monthly_net Fact is also protected from reuse", () => {
  const data = fixture();
  addFact(data, "net-F2", "income.monthly_net");
  data.incomes = [income("salary-A", "Employer A", ["net-F2"]), income("salary-B", "Employer B", ["net-F2"])];
  assert.ok(reuseIssue(resolveIncomeRows(data)));
});
