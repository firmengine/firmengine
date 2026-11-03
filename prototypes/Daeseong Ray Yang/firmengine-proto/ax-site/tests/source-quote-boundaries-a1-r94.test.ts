import test from "node:test";
import assert from "node:assert/strict";
import { sourceQuotesOverlap } from "../lib/source-verification-identity.ts";

/** A1-AX-005: synthetic quotes only; no private OCR/customer content. */
test("partial numeric and Korean word matches do not count as independent source overlap", () => {
  for (const [a,b] of [
    ["100","1100"],
    ["급여 100만원","급여 1000만원"],
    ["가처분소득 100","소득 100"],
    ["금액 1,000원","1,000"],
    ["소득 100","소득 1000"],
    ["입금 0","입금 00"],
    ["급여 100만원","식비 100만원"],
  ]) assert.equal(sourceQuotesOverlap(a,b), false, JSON.stringify([a,b]));
});
test("complete literal fragments and whitespace-normalized quotations remain valid", () => {
  for (const [a,b] of [
    ["급여 100만원","급여 100만원"],
    ["월소득 0원","월소득 0원"],
    ["2026-10-01","2026-10-01"],
    ["급여   100만원","급여 100만원"],
    ["원문: 금액 100만원","금액 100만원"],
    ["2026-10-01 법원 확인","2026-10-01"],
    ["원문 [급여 100]","급여 100"],
    ["금액 1,000원","1,000원"],
    ["금액 100 만원","금액 100   만원"],
  ]) assert.equal(sourceQuotesOverlap(a,b), true, JSON.stringify([a,b]));
});
test("empty quotations and nonmatching dates are not overlapping", () => {
  assert.equal(sourceQuotesOverlap("","급여 100만원"), false);
  assert.equal(sourceQuotesOverlap("2026-10-01","2026-10-02"), false);
});
