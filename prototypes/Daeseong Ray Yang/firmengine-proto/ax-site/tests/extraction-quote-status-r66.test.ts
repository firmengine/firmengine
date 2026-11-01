import test from "node:test";
import assert from "node:assert/strict";
import { applyFirstVerification, applyTargetedRepair, type FieldReviewCheck, type PageRead } from "../lib/extraction.ts";

// Synthetic-only amounts/quotes. No actual OCR, D1/R2 or court approval.
const bbox = [0.1, 0.2, 0.3, 0.3];
const read = (): PageRead => ({
  documentType: "salary_statement",
  complete: true,
  warnings: [],
  records: [{
    category: "income",
    label: "합성 급여명세서",
    fields: [{
      key: "net_pay",
      label: "실수령액",
      value: "2000000",
      unit: "원",
      quote: "기본급 2000000원",
      bbox,
      confidence: "clear",
      sourceState: "present",
    }],
  }],
});
const check = (overrides: Partial<FieldReviewCheck> = {}): FieldReviewCheck => ({
  recordIndex: 0,
  fieldIndex: 0,
  categoryStatus: "supported",
  meaningStatus: "supported",
  status: "agrees",
  value: "2000000",
  unit: "원",
  quote: "기본급 2000000원",
  bbox,
  reason: "합성 독립 대조",
  ...overrides,
});
const status = (checks: FieldReviewCheck[]) => applyFirstVerification(read(), checks);

test("matching quote/value/unit/bbox remains supported", () => {
  const result = status([check()]);
  assert.equal(result.read.records[0]?.fields[0]?.verificationState, "supported");
  assert.equal(result.targets.length, 0);
});

for (const quote of ["성과급 2000000원", "임대료 2000000원"]) {
  test(`unrelated literal source quote cannot be supported: ${quote}`, () => {
    const result = status([check({ quote })]);
    assert.equal(result.read.records[0]?.fields[0]?.verificationState, "unclear");
    assert.equal(result.read.records[0]?.fields[0]?.confidence, "uncertain");
    assert.equal(result.targets.length, 1);
  });
}

for (const override of [{ value: "3000000" }, { unit: "만원" }]) {
  test(`agrees flag cannot override value or unit mismatch: ${JSON.stringify(override)}`, () => {
    const result = status([check(override)]);
    assert.equal(result.read.records[0]?.fields[0]?.verificationState, "unclear");
    assert.equal(result.targets.length, 1);
  });
}

test("missing independent check stays missing_check", () => {
  assert.equal(status([]).read.records[0]?.fields[0]?.verificationState, "missing_check");
});

test("disjoint verifier bbox stays conflicting", () => {
  assert.equal(status([check({bbox: [0.6, 0.6, 0.8, 0.8]})]).read.records[0]?.fields[0]?.verificationState, "conflicting");
});

test("unicode-normalized equivalent quotes remain accepted", () => {
  assert.equal(status([check({quote: "기본급 ２００００００원"})]).read.records[0]?.fields[0]?.verificationState, "supported");
});

test("unresolved repair cannot restore supported for an unrelated quote", () => {
  const first = [check({ quote: "성과급 2000000원" })];
  const primary = status(first);
  const repaired = applyTargetedRepair(primary.read, first, []);
  assert.notEqual(repaired.read.records[0]?.fields[0]?.verificationState, "supported");
  assert.equal(repaired.disagreements, 1);
});
