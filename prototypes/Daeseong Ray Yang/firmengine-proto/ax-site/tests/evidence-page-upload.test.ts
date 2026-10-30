import test from "node:test";
import assert from "node:assert/strict";
import { MAX_EVIDENCE_PAGE_IMAGE_BYTES, validEvidencePageImageLength } from "../lib/evidence-page-upload.ts";

test("empty original page and empty rescue crop are never valid OCR images", () => {
  assert.equal(validEvidencePageImageLength(new ArrayBuffer(0).byteLength), false);
});

test("a single byte and the 8MB boundary are accepted", () => {
  assert.equal(validEvidencePageImageLength(1), true);
  assert.equal(validEvidencePageImageLength(MAX_EVIDENCE_PAGE_IMAGE_BYTES), true);
});

test("oversize and impossible byte lengths are rejected", () => {
  for (const bad of [MAX_EVIDENCE_PAGE_IMAGE_BYTES + 1, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(validEvidencePageImageLength(bad), false);
  }
});
