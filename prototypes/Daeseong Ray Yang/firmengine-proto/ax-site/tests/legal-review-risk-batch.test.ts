import test from "node:test";
import assert from "node:assert/strict";
import { selectLegalReviewRiskBatch, type LegalReviewRiskCandidate } from "../lib/legal-review-risk-batch.ts";

const synthetic = (id: string, options: Partial<LegalReviewRiskCandidate> = {}): LegalReviewRiskCandidate => ({
  id, title: "Synthetic legal evidence routing", manual: true,
  conditions: "Not a legal finding", features: ["income.net"],
  request: "Additional source proof", legalRuleIds: ["KR-PR-014"],
  ...options,
});

test("approved evidence route and its exact canonical + calculation requirements reach the reviewer", () => {
  const original = synthetic("DOC-01", {
    canonicalFieldGroups: [["salary_statement::gross_total", "payroll_payslip::income.payroll.net_pay"]],
    requiredCalculationOutputs: ["monthlyIncomeWon"],
    evidenceContractStatus: "approved_evidence_route",
  });
  const batch = selectLegalReviewRiskBatch([original], new Set(), 10);
  assert.equal(batch.length, 1);
  assert.equal(batch[0]?.evidenceContractStatus, "approved_evidence_route");
  assert.deepEqual(batch[0]?.canonicalFieldGroups, original.canonicalFieldGroups);
  assert.deepEqual(batch[0]?.requiredCalculationOutputs, ["monthlyIncomeWon"]);
  assert.equal(batch[0]?.manual, true, "approved routing must not become court approval");
  batch[0]!.canonicalFieldGroups![0]!.push("synthetic::changed");
  batch[0]!.requiredCalculationOutputs!.push("other");
  assert.equal(original.canonicalFieldGroups?.[0]?.length, 2, "original reference policy remains immutable");
  assert.equal(original.requiredCalculationOutputs?.length, 1);
});

test("unmapped or inapplicable reference contracts remain explicit non-approved evidence routes", () => {
  const batch = selectLegalReviewRiskBatch([
    synthetic("DOC-02"),
    synthetic("DOC-03", {evidenceContractStatus: "outside_or_unresolved_applicability"}),
  ], new Set(), 10);
  assert.deepEqual(batch.map(x => x.evidenceContractStatus), ["unmapped", "outside_or_unresolved_applicability"]);
  assert.ok(batch.every(row => row.manual));
  assert.ok(batch.every(row => row.canonicalFieldGroups?.length === 0));
  assert.ok(batch.every(row => row.requiredCalculationOutputs?.length === 0));
});

test("completed checks are omitted; capacity and source order remain unchanged", () => {
  const rows = [synthetic("DOC-01"), synthetic("DOC-02"), synthetic("DOC-03")];
  assert.deepEqual(selectLegalReviewRiskBatch(rows, new Set(["DOC-01"]), 1).map(row => row.id), ["DOC-02"]);
  assert.deepEqual(selectLegalReviewRiskBatch(rows, new Set(["DOC-03"]), 0), []);
  assert.deepEqual(rows.map(row => row.id), ["DOC-01", "DOC-02", "DOC-03"]);
});

test("legacy nullish packet fields are normalized without losing the legal evidence contract", () => {
  const result = selectLegalReviewRiskBatch([synthetic("DOC-04", {
    conditions: null, request: null, features: null, legalRuleIds: null,
    evidenceContractStatus: "approved_evidence_route",
    canonicalFieldGroups: [["salary_statement::gross_total"]],
    requiredCalculationOutputs: ["monthlyIncomeWon"],
  })], new Set(), 5)[0]!;
  assert.equal(result.conditions, "");
  assert.equal(result.request, "");
  assert.deepEqual(result.features, []);
  assert.deepEqual(result.legalRuleIds, []);
  assert.deepEqual(result.canonicalFieldGroups, [["salary_statement::gross_total"]]);
  assert.deepEqual(result.requiredCalculationOutputs, ["monthlyIncomeWon"]);
});

test("invalid batch size is rejected deterministically", () => {
  for (const value of [-1, 0.5, NaN, Infinity])
    assert.throws(() => selectLegalReviewRiskBatch([synthetic("DOC-05")], new Set(), value), /INVALID_LEGAL_REVIEW_BATCH_LIMIT/);
});
