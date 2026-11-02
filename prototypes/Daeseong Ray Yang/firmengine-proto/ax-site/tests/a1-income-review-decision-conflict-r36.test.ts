import test from "node:test";
import assert from "node:assert/strict";
import { createCase, type Fact, type IncomeSource } from "../lib/domain.ts";
import { resolveIncomeRows } from "../lib/income-resolution.ts";

const hash = "a".repeat(64);
function syntheticData() {
  const data = createCase("Synthetic duplicate source decisions", "a1-r36-synthetic", "2026-10-31");
  data.documents = [{ id: "doc-synthetic", name: "synthetic.pdf", sha256: hash, status: "active", pages: [1] }];
  data.pages = [{ documentId: "doc-synthetic", page: 1, role: "evidence", text: "", imageUrl: "/synthetic/1" }];
  const amount = { rawValue: "100000", unit: "KRW", currency: "KRW", amountWon: "100000", normalizationStatus: "exact" as const };
  const fact: Fact = { id: "fact-1", logicalId: "synthetic:net", version: 1, subjectId: "synthetic-worker",
    key: "income.net", value: "100000", rawValue: "100000", numeric: amount,
    state: "verified", recognition: "accepted",
    refs: [{ documentId: "doc-synthetic", page: 1, quote: "100000", sourceHash: hash, bbox: [0.1,0.1,0.3,0.2] }],
    validation: [] };
  data.facts = [fact];
  const first: IncomeSource = { id: "income-a", kind: "wage", label: "Synthetic salary", employer: "Synthetic employer",
    net: amount, periodStart: "2026-01-01", periodEnd: "2026-01-31", periodMonths: 1,
    amountBasis: "monthly", recurring: "yes", factIds: ["fact-1"], recognition: "accepted",
    aggregationTreatment: "unknown", aggregationReviewed: false,
    sourceCalculationRole: "period_income_observation" };
  return { data, first };
}
function resolved(patch: Partial<IncomeSource>, reverse = false, distinctFacts = false) {
  const { data, first } = syntheticData();
  const second: IncomeSource = { ...first, id: "income-b", factIds: [...first.factIds], ...patch };
  if (distinctFacts) {
    data.facts.push({ ...data.facts[0], id: "fact-2", logicalId: "synthetic:net:other" });
    second.factIds = ["fact-2"];
  }
  data.incomes = reverse ? [second, first] : [first, second];
  return resolveIncomeRows(data);
}
function assertDecisionConflict(result: ReturnType<typeof resolveIncomeRows>) {
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.duplicates, []);
  assert.ok(result.issues.some((issue) => issue.startsWith("INCOME_SAME_FACT_REVIEW_CONFLICT:")));
}

test("identical evidence and identical human decision still deduplicate", () => {
  const result = resolved({});
  assert.deepEqual(result.rows.map((row) => row.id), ["income-a"]);
  assert.deepEqual(result.duplicates, ["income-b"]);
  assert.ok(!result.issues.some((issue) => issue.startsWith("INCOME_SAME_FACT_REVIEW_CONFLICT:")));
});
test("accepted vs rejected exact-fact decision cannot be silently merged", () => {
  assertDecisionConflict(resolved({ recognition: "rejected" }));
});
test("reversed rejected vs accepted exact-fact decision still exposes conflict", () => {
  assertDecisionConflict(resolved({ recognition: "rejected" }, true));
});
test("accepted vs unreviewed exact-fact decision requires explicit review", () => {
  assertDecisionConflict(resolved({ recognition: "unreviewed" }));
});
test("conflicting income aggregation treatment on same facts remains separate", () => {
  const { data, first } = syntheticData();
  const a: IncomeSource = { ...first, aggregationTreatment: "independent_source", aggregationReviewed: true, aggregationReviewReason: "synthetic separate-source decision" };
  const b: IncomeSource = { ...first, id: "income-b", aggregationTreatment: "duplicate", aggregationReviewed: true, aggregationReviewReason: "synthetic duplicate decision" };
  data.incomes = [a,b];
  assertDecisionConflict(resolveIncomeRows(data));
});
test("gross-only and net observation roles cannot be merged from the same source facts", () => {
  assertDecisionConflict(resolved({ sourceCalculationRole: "gross_turnover_only" }));
});
test("distinct fact versions are retained and do not report an exact-fact decision conflict", () => {
  const result = resolved({}, false, true);
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.duplicates, []);
  assert.ok(!result.issues.some((issue) => issue.startsWith("INCOME_SAME_FACT_REVIEW_CONFLICT:")));
});
