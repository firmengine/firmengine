import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMoney } from "../lib/domain.ts";
import { calculationSourceCellIssues } from "../lib/ocr-calculation-input.ts";

// All input values are synthetic. Structural/lexical review only, not legal acceptance.
const fixtures: Array<[string | null, string, string, string | null]> = [
  ["1,234원", "만원", "invalid", null],
  ["1,234원", "천원", "invalid", null],
  ["1,234KRW", "million_won", "invalid", null],
  ["1,234KRW", "천원", "invalid", null],
  ["0원", "만원", "invalid", null],
  ["1,234원", "원", "exact", "1234"],
  ["1,234원", "won", "exact", "1234"],
  ["1,234원", "KRW", "exact", "1234"],
  ["1,234 KRW", "KRW", "exact", "1234"],
  ["1,234", "만원", "exact", "12340000"],
  ["1,234.5", "천원", "exact", "1234500"],
  ["1,20원", "KRW", "invalid", null],
  ["1,,2원", "KRW", "invalid", null],
  ["0원", "KRW", "exact", "0"],
  [null, "KRW", "missing", null],
  ["1,234.5원", "KRW", "review_required", null],
  ["1,234", "million_won", "exact", "1234000000"],
  ["1,234,567원", "KRW", "exact", "1234567"],
];
for (const [raw, unit, expectedStatus, expectedWon] of fixtures) {
  test(`SYN money source/unit: ${String(raw)} ${unit}`, () => {
    const actual = normalizeMoney(raw, unit);
    assert.equal(actual.normalizationStatus, expectedStatus);
    assert.equal(actual.amountWon, expectedWon);
    assert.equal(actual.rawValue, raw, "original source must not be repaired");
  });
  test(`SYN money OCR gate: ${String(raw)} ${unit}`, () => {
    const issues = calculationSourceCellIssues(
      { value: raw, unit, quote: "synthetic-source-quote", confidence: "clear", sourceState: raw === null ? "unknown" : "present" },
      { datatype: "money" },
    );
    assert.equal(issues.includes("SOURCE_MONEY_NOT_EXACT_KRW"), raw !== null && expectedStatus !== "exact");
  });
}
