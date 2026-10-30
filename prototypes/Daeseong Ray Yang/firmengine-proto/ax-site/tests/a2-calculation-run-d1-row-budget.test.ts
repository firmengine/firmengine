import test from "node:test";
import assert from "node:assert/strict";
import {assertCalculationRunPayloadSize} from "../lib/case-calculation-feature-store.ts";

/** Synthetic-only D1 row budget tests; no real case documents or account details. */
test("small calculation snapshot remains acceptable",()=>{
 assert.doesNotThrow(()=>assertCalculationRunPayloadSize("{}",'{"source":null}'));
});
test("separate JSON columns below their own limits must not jointly exceed D1 row budget",()=>{
 assert.throws(()=>assertCalculationRunPayloadSize("x".repeat(1_600_000),"y".repeat(400_000)),
  /CALCULATION_FEATURE_RESULT_SIZE_LIMIT/);
});
test("existing per-column limits remain enforced",()=>{
 assert.throws(()=>assertCalculationRunPayloadSize("x".repeat(1_900_001),"s"),
  /CALCULATION_FEATURE_RESULT_SIZE_LIMIT/);
 assert.throws(()=>assertCalculationRunPayloadSize("x","y".repeat(1_000_001)),
  /CALCULATION_FEATURE_RESULT_SIZE_LIMIT/);
});
test("combined boundary and one-byte-over are distinct, preserving room for metadata",()=>{
 assert.doesNotThrow(()=>assertCalculationRunPayloadSize("x".repeat(1_700_000),"y".repeat(200_000)));
 assert.throws(()=>assertCalculationRunPayloadSize("x".repeat(1_700_000),"y".repeat(200_001)),
  /CALCULATION_FEATURE_RESULT_SIZE_LIMIT/);
});
test("UTF-8 multibyte Korean text is counted in bytes rather than JS string units",()=>{
 // 650,000 Hangul code points occupy 1,950,000 UTF-8 bytes.
 assert.throws(()=>assertCalculationRunPayloadSize("가".repeat(650_000),"{}"),
  /CALCULATION_FEATURE_RESULT_SIZE_LIMIT/);
 assert.doesNotThrow(()=>assertCalculationRunPayloadSize("가".repeat(100),"{}"));
});
test("missing_json and other run metadata count against the same D1 SQL row",()=>{
 assert.throws(()=>assertCalculationRunPayloadSize(
  "x".repeat(1_500_000),"y".repeat(200_000),["z".repeat(250_000)]),
  /CALCULATION_FEATURE_RESULT_SIZE_LIMIT/);
 assert.doesNotThrow(()=>assertCalculationRunPayloadSize(
  "x".repeat(1_500_000),"y".repeat(200_000),["z".repeat(100_000)]));
});
