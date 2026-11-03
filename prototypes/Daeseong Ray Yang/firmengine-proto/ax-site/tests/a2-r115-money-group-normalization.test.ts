import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMoney } from "../lib/domain.ts";

// Synthetic lexical checks: this does not recognize the amount as admissible income, debt or evidence.
const cases: Array<[string | null, string, "exact" | "invalid" | "missing" | "review_required", string | null]> = [
  ["1,20원", "KRW", "invalid", null],
  ["1,,2원", "KRW", "invalid", null],
  ["1,2345", "KRW", "invalid", null],
  ["1,23,456", "KRW", "invalid", null],
  ["1,234,56", "KRW", "invalid", null],
  ["1,234원", "KRW", "exact", "1234"],
  ["1,234,567원", "KRW", "exact", "1234567"],
  ["+1,234", "KRW", "exact", "1234"],
  ["-1,234", "KRW", "exact", "-1234"],
  ["1,234.5", "만원", "exact", "12345000"],
  ["1,234.5", "KRW", "review_required", null],
  ["1234", "KRW", "exact", "1234"],
  ["0", "KRW", "exact", "0"],
  [null, "KRW", "missing", null],
  ["1e3", "KRW", "invalid", null],
  ["1,000.00", "KRW", "exact", "1000"],
  ["12,345.0001", "만원", "exact", "123450001"],
  ["1,234.5", "만 원", "invalid", null],
];
for (const [raw, unit, expectedStatus, expectedWon] of cases) {
  test(`raw comma normalization: ${String(raw)} (${unit})`, () => {
    const actual = normalizeMoney(raw, unit);
    assert.equal(actual.normalizationStatus, expectedStatus);
    assert.equal(actual.amountWon, expectedWon);
    assert.equal(actual.rawValue, raw, "preserve raw source text rather than repairing it");
  });
}
