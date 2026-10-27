import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { createCase, DRAFT_RULESET, type Fact, type IncomeSource } from "../lib/domain.ts";
import { calculateCase } from "../lib/assessment.ts";
import { resolveIncomeRows } from "../lib/income-resolution.ts";

const hash = "a".repeat(64);
function fixture() {
  const data = createCase("Synthetic income resolution", "synthetic-income-resolution", "2026-10-27");
  data.documents = [{ id: "doc", name: "synthetic.pdf", sha256: hash, status: "active", pages: [1, 2] }];
  data.pages = [1, 2].map(page => ({ documentId: "doc", page, role: "evidence" as const, text: "", imageUrl: `/synthetic/${page}` }));
  return data;
}
function source(data: ReturnType<typeof fixture>, opts: { id: string; factPrefix: string; page: number; payer?: string; label?: string; periodStart?: string; periodEnd?: string; amountBasis?: IncomeSource["amountBasis"]; amount?: string; sameQuote?: boolean; rowY?: number }): IncomeSource {
  const quote = opts.sameQuote === false ? `synthetic quote ${opts.id}` : "same synthetic source observation";
  const fields: [string,string][] = [["income.label", opts.label ?? "Synthetic payroll"], ["income.employer", "Synthetic Employer"], ["income.net", opts.amount ?? "1000000"], ["income.period_start", opts.periodStart ?? "2026-01-01"], ["income.period_end", opts.periodEnd ?? "2026-01-31"], ["income.amount_basis", opts.amountBasis ?? "monthly"]];
  if (opts.payer) fields.push(["income.payer_identity_id", opts.payer]);
  const factIds = fields.map(([key,value],index) => {
    const id = `${opts.factPrefix}-${index}`;
    const evidenceQuote = key === "income.payer_identity_id" ? `synthetic payer identity ${value}` : quote;
    const x = index * 0.05, y = opts.rowY;
    const fact: Fact = { id, logicalId: `${opts.factPrefix}:${key}`, version: 1, subjectId: opts.factPrefix, key, value, rawValue: value, ...(key === "income.net" ? { numeric: { rawValue: value, unit: "KRW", currency: "KRW", amountWon: value, normalizationStatus: "exact" as const } } : {}), state: "extracted", recognition: "unreviewed", refs: [{ documentId: "doc", page: opts.page, quote: evidenceQuote, sourceHash: hash, ...(y !== undefined ? { bbox: [x, y, Math.min(x + 0.04, 1), y + 0.03] as [number,number,number,number] } : {}) }], validation: [] };
    data.facts.push(fact); return id;
  });
  return { id: opts.id, kind: "wage", label: opts.label ?? "Synthetic payroll", employer: "Synthetic Employer", ...(opts.payer ? { payerIdentityId: opts.payer } : {}), aggregationTreatment: "unknown", aggregationReviewed: false, net: { rawValue: opts.amount ?? "1000000", unit: "KRW", currency: "KRW", amountWon: opts.amount ?? "1000000", normalizationStatus: "exact" }, periodStart: opts.periodStart ?? "2026-01-01", periodEnd: opts.periodEnd ?? "2026-01-31", amountBasis: opts.amountBasis ?? "monthly", periodMonths: 1, recurring: "yes", recognition: "unreviewed", factIds };
}

test("same employer name, dates, and amount do not merge distinct payer IDs", () => {
  const data = fixture();
  data.incomes = [source(data, { id: "one", factPrefix: "f1", page: 1, payer: "1234567890" }), source(data, { id: "two", factPrefix: "f2", page: 1, payer: "9876543210" })];
  const result = resolveIncomeRows(data);
  assert.deepEqual(result.rows.map(row => row.id), ["one", "two"]);
  assert.deepEqual(result.duplicates, []);
  const calculation = calculateCase(data, DRAFT_RULESET);
  assert.equal(calculation.incomeGroups.length, 2); assert.equal(calculation.monthlyIncomeWon, "2000000");
});

test("complete payer plus same row occurrence boxes permits one duplicate merge", () => {
  const data = fixture();
  data.incomes = [source(data, { id: "copy-a", factPrefix: "a", page: 1, payer: "1234567890", rowY: 0.1 }), source(data, { id: "copy-b", factPrefix: "b", page: 1, payer: "1234567890", rowY: 0.1 })];
  const result = resolveIncomeRows(data);
  assert.equal(result.rows.length, 1); assert.deepEqual(result.duplicates, ["copy-b"]);
  assert.equal(new Set(result.rows[0].factIds).size, 14);
});

test("same payer and repeated same-page row text with different boxes are retained", () => {
  const data = fixture();
  data.incomes = [source(data, { id: "january-source", factPrefix: "a", page: 1, payer: "1234567890", rowY: 0.1 }), source(data, { id: "second-row", factPrefix: "b", page: 1, payer: "1234567890", rowY: 0.3 })];
  const result = resolveIncomeRows(data);
  assert.equal(result.rows.length, 2); assert.deepEqual(result.duplicates, []);
  assert.ok(result.issues.some(issue => issue.startsWith("INCOME_SAME_PAYER_PERIOD_OBSERVATIONS_REVIEW_REQUIRED")));
});

test("cross-fact income rows without occurrence boxes remain separate even with identical quotes", () => {
  const data = fixture();
  data.incomes = [source(data, { id: "unlocated-a", factPrefix: "a", page: 1, payer: "1234567890" }), source(data, { id: "unlocated-b", factPrefix: "b", page: 1, payer: "1234567890" })];
  const result = resolveIncomeRows(data);
  assert.equal(result.rows.length, 2); assert.deepEqual(result.duplicates, []);
});

test("masked payer IDs, same-name-only rows, and amount-only matches never merge", () => {
  const data = fixture();
  data.incomes = [source(data, { id: "masked-a", factPrefix: "a", page: 1, payer: "1234-****-90" }), source(data, { id: "masked-b", factPrefix: "b", page: 1, payer: "1234-XXXX-90" })];
  const result = resolveIncomeRows(data);
  assert.equal(result.rows.length, 2); assert.deepEqual(result.duplicates, []);
  assert.ok(result.issues.some(issue => issue.startsWith("INCOME_NAME_MATCH_IS_NOT_IDENTITY")));
});

test("embedded repeated X tokens remain masked", () => {
  const data = fixture();
  data.incomes = [source(data, { id: "masked-a", factPrefix: "a", page: 1, payer: "ABXX1234" }), source(data, { id: "masked-b", factPrefix: "b", page: 1, payer: "ABXX1234" })];
  assert.equal(resolveIncomeRows(data).rows.length, 2);
});

test("exact current fact-version IDs are a stable duplicate key even without payer identity", () => {
  const data = fixture();
  const first = source(data, { id: "one", factPrefix: "same-facts", page: 1 });
  const second = { ...first, id: "two", factIds: [...first.factIds] };
  data.incomes = [first, second];
  const result = resolveIncomeRows(data);
  assert.deepEqual(result.rows.map(row => row.id), ["one"]); assert.deepEqual(result.duplicates, ["two"]);
});

test("map-based resolution visits N sources with bounded lookup work", (t) => {
  const data = fixture(), count = 8000;
  data.facts = Array.from({ length: count }, (_, i): Fact => ({ id: `perf-${i}`, logicalId: `perf-logical-${i}`, version: 1, subjectId: `perf-${i}`, key: "income.net", value: "100", rawValue: "100", state: "extracted", recognition: "unreviewed", refs: [{ documentId: "doc", page: 1, quote: "synthetic", sourceHash: hash }], validation: [] }));
  const rows: IncomeSource[] = data.facts.map((fact, i) => ({ id: `income-${i}`, kind: "wage", label: "", net: { rawValue: "100", unit: "KRW", currency: "KRW", amountWon: "100", normalizationStatus: "exact" }, factIds: [fact.id] }));
  const started = performance.now(), result = resolveIncomeRows(data, rows), elapsedMs = performance.now() - started;
  assert.equal(result.rows.length, count); assert.equal(result.metrics.rowsVisited, count); assert.ok(result.metrics.mapLookups <= count * 3);
  t.diagnostic(`synthetic income resolution: ${count} rows, ${result.metrics.mapLookups} map lookups, ${elapsedMs.toFixed(1)} ms`);
});
