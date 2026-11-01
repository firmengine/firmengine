import test from "node:test";
import assert from "node:assert/strict";
import {structuredModelJsonMatchesSchema as matches} from "../lib/structured-model-json.ts";

// These are synthetic model outputs, not customer OCR values or legal findings.
test("explicitly nullable object does not require object-only properties when null", () => {
  const schema = {type: ["object", "null"], required: ["v"],
    additionalProperties: false, properties: {v: {type: "integer"}}};
  assert.equal(matches(null, schema), true);
  assert.equal(matches({v: 3}, schema), true);
  assert.equal(matches({}, schema), false);
  assert.equal(matches({v: "3"}, schema), false);
  assert.equal(matches("3", schema), false);
});

test("explicitly nullable array accepts null but still validates real array elements", () => {
  const schema = {type: ["array", "null"], minItems: 1, items: {type: "integer"}};
  assert.equal(matches(null, schema), true);
  assert.equal(matches([3], schema), true);
  assert.equal(matches(["3"], schema), false);
  assert.equal(matches([], schema), false);
});

test("non-nullable object/array and untyped property constraints stay fail-closed", () => {
  assert.equal(matches(null, {type: "object", required: ["v"], properties: {v: {type: "integer"}}}), false);
  assert.equal(matches(null, {type: "array", items: {type: "integer"}}), false);
  assert.equal(matches(null, {properties: {v: {type: "integer"}}}), false);
  assert.equal(matches(null, {type: ["number", "null"]}), true);
  assert.equal(matches("unseen", {type: ["number", "null"]}), false);
});
