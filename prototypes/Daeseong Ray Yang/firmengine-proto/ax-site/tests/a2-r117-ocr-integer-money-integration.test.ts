import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMoney, moneyValue } from "../lib/domain.ts";
import { calculationSourceCellIssues } from "../lib/ocr-calculation-input.ts";

// SYNTHETIC ONLY. Tests lexical consistency; never proves OCR truth, tax recognition, or court approval.
const issues = (value: string | null, datatype: string, unit: string | null = null, sourceState = "present") =>
  calculationSourceCellIssues(
    { value, unit, quote: "SYN-EXCERPT", confidence: "clear", sourceState },
    { datatype },
  );

for (const raw of ["1,,2", "1,2", ",12", "12,", "12,34", "1,234", "+12", "-12", " 12 ", "12.0", "1e3"]) {
  test(`SYN typed integer rejects noncanonical source ${JSON.stringify(raw)}`, () => {
    assert.ok(issues(raw, "integer").includes("SOURCE_INTEGER_FORMAT_REVIEW"));
  });
}
for (const raw of ["9007199254740992", "9007199254740993", "999999999999999999999999999999"]) {
  test(`SYN typed integer blocks unsafe range ${raw}`, () => {
    assert.ok(issues(raw, "integer").includes("SOURCE_INTEGER_UNSAFE_RANGE"));
  });
}
for (const raw of ["0", "12", "00012", "9007199254740991"]) {
  test(`SYN typed integer retains explicit safe value ${raw}`, () => {
    assert.deepEqual(issues(raw, "integer"), []);
  });
}

const moneyCases: Array<[string, string, string, string | null, boolean]> = [
  ["1,234원", "만원", "invalid", null, true],
  ["0원", "만원", "invalid", null, true],
  ["1,234원", "KRW", "exact", "1234", false],
  ["1,20원", "KRW", "invalid", null, true],
  ["1,,2원", "KRW", "invalid", null, true],
  ["1,234", "만원", "exact", "12340000", false],
  ["0원", "KRW", "exact", "0", false],
  ["1,234.5원", "KRW", "review_required", null, true],
  ["1,234.5", "천원", "exact", "1234500", false],
];
for (const [raw, unit, status, won, blocked] of moneyCases) {
  test(`SYN OCR source-to-money contract ${JSON.stringify(raw)} ${unit}`, () => {
    const parsed = normalizeMoney(raw, unit);
    assert.equal(parsed.normalizationStatus, status);
    assert.equal(parsed.amountWon, won);
    assert.equal(parsed.rawValue, raw);
    const reasons = issues(raw, "money", unit);
    assert.equal(reasons.includes("SOURCE_MONEY_NOT_EXACT_KRW"), blocked);
    assert.equal(moneyValue(parsed)?.toString() ?? null, status === "exact" ? won : null);
  });
}
test("SYN explicit zero, missing, and source-only remain distinct", () => {
  assert.equal(normalizeMoney("0원", "KRW").amountWon, "0");
  assert.equal(normalizeMoney(null, "KRW").normalizationStatus, "missing");
  assert.deepEqual(issues(null, "money", "KRW", "unknown"), []);
  assert.deepEqual(issues("1,20원", "money", "KRW", "not_applicable"), []);
});
test("SYN raw/typed amount mismatch is never silently accepted", () => {
  const parsed = normalizeMoney("1,234원", "KRW");
  assert.equal(moneyValue({ ...parsed, amountWon: "12340000" }), null);
});
test("SYN malformed comma grouping reports independent source issue", () => {
  assert.ok(issues("1,20원", "money", "KRW").includes("SOURCE_MONEY_GROUPING_INVALID"));
  assert.deepEqual(issues("1,234원", "money", "KRW"), []);
});
