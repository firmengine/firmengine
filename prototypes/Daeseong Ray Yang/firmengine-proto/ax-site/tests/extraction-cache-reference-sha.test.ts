import test from "node:test";
import assert from "node:assert/strict";
import { extractionCacheKey } from "../lib/domain.ts";

/**
 * Synthetic identity-only regression: never loads actual case documents,
 * secrets or model outputs. A changed reviewed reference snapshot must force
 * OCR source reread/reverification even when the rules release ID stays stable.
 */
const request = {
  documentId: "synthetic-document",
  documentHash: "a".repeat(64),
  pages: [1, 3],
  mappingVersion: "family-v1",
  promptVersion: "prompt-v1",
  model: "ocr-model-v1",
  ruleReleaseId: "rules-v1",
  referenceSha256: "b".repeat(64),
};

test("different approved reference SHA cannot reuse earlier OCR checkpoint key", () => {
  const previous = extractionCacheKey(request);
  const next = extractionCacheKey({ ...request, referenceSha256: "c".repeat(64) });
  assert.notEqual(next, previous);
  assert.notEqual(extractionCacheKey({ ...request, referenceSha256: undefined }), previous,
    "missing request-scoped reference identity must not equal a known snapshot");
});

test("unchanged identity and page set reuse the same cache key", () => {
  assert.equal(extractionCacheKey(request), extractionCacheKey({ ...request, pages: [3, 1] }));
  assert.equal(extractionCacheKey(request), extractionCacheKey({ ...request }));
});

test("source, mapping, prompt, model, and static rules still independently invalidate", () => {
  for (const variant of [
    { documentHash: "d".repeat(64) },
    { documentId: "synthetic-document-2" },
    { mappingVersion: "family-v2" },
    { promptVersion: "prompt-v2" },
    { model: "ocr-model-v2" },
    { ruleReleaseId: "rules-v2" },
    { pages: [1, 2, 3] },
  ]) assert.notEqual(extractionCacheKey(request), extractionCacheKey({ ...request, ...variant }));
});
