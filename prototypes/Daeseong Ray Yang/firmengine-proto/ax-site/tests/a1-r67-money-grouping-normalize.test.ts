import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMoney, moneyValue } from "../lib/domain.ts";

// Synthetic-only numeric strings; no client data, OCR payloads or private keys.
test("malformed comma groups are never trusted as exact Won", () => {
  for (const raw of ["1,00", "1,,000", "12,34,567", "1,000,00", "1,0000", "1, 000"]) {
    const amount = normalizeMoney(raw, "원");
    assert.equal(amount.normalizationStatus, "invalid", raw);
    assert.equal(amount.amountWon, null, raw);
    assert.equal(moneyValue(amount), null, raw);
  }
});

test("valid grouping, scaled decimals and explicit zero keep exact Won", () => {
  for (const [raw, unit, expected] of [
    ["1,000", "원", "1000"],
    ["1,234,567", "원", "1234567"],
    ["1,000.5", "천원", "1000500"],
    ["-1,000", "원", "-1000"],
    ["+1,000", "원", "1000"],
    ["1,000원", "원", "1000"],
    ["1,000 KRW", "KRW", "1000"],
    ["1,000", "천원", "1000000"],
    ["1000", "원", "1000"],
    ["0", "원", "0"],
    ["1.5", "천원", "1500"]
  ] as const) {
    const amount = normalizeMoney(raw, unit);
    assert.equal(amount.normalizationStatus, "exact", raw + "/" + unit);
    assert.equal(amount.amountWon, expected, raw + "/" + unit);
    assert.equal(moneyValue(amount)?.toString(), expected, raw + "/" + unit);
  }
});

test("unknown, foreign, fractional Won, and internal whitespace remain distinct", () => {
  assert.equal(normalizeMoney(null, "원").normalizationStatus, "missing");
  assert.equal(normalizeMoney("1,000", "원", "USD").normalizationStatus, "review_required");
  assert.equal(normalizeMoney("1,000.01", "원").normalizationStatus, "review_required");
  assert.equal(normalizeMoney("1 0", "원").normalizationStatus, "invalid");
});
