import test from "node:test";
import assert from "node:assert/strict";
import { observedPeriodAndAsOf } from "../lib/observed-source-details.ts";

test("observation period and as-of date remain separate when both are present", () => {
  assert.equal(observedPeriodAndAsOf({ periodStart: "2026-01-01", periodEnd: "2026-01-31", asOf: "2026-02-10" }),
    "2026-01-01 ~ 2026-01-31 · 기준일 2026-02-10");
  assert.equal(observedPeriodAndAsOf({ periodStart: "2026-01-01", asOf: "2026-02-10" }),
    "2026-01-01 ~ ? · 기준일 2026-02-10");
  assert.equal(observedPeriodAndAsOf({ periodEnd: "2026-01-31", asOf: "2026-02-10" }),
    "? ~ 2026-01-31 · 기준일 2026-02-10");
});

test("standalone as-of, standalone period, and absent dates remain distinct", () => {
  assert.equal(observedPeriodAndAsOf({ asOf: "2026-02-10" }), "2026-02-10");
  assert.equal(observedPeriodAndAsOf({ periodStart: "2026-01-01", periodEnd: "2026-01-31" }),
    "2026-01-01 ~ 2026-01-31");
  assert.equal(observedPeriodAndAsOf({}), "[기간·기준일 미확인]");
  assert.equal(observedPeriodAndAsOf({ asOf: "  " }), "[기간·기준일 미확인]");
});
