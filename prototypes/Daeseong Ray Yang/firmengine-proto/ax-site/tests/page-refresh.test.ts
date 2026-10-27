import test from "node:test";
import assert from "node:assert/strict";
import { canStartFreshPageRead, freshPageCheckpoint } from "../lib/page-refresh.ts";

test("completed evidence requires explicit refresh and all active or leased jobs stay protected", () => {
  assert.equal(canStartFreshPageRead("completed", null, "retry"), false);
  assert.equal(canStartFreshPageRead("completed", null, "refresh"), true);
  for (const status of ["review_required", "error"]) {
    assert.equal(canStartFreshPageRead(status, null, "retry"), true);
    assert.equal(canStartFreshPageRead(status, null, "refresh"), true);
  }
  for (const status of ["pending", "processing", "held", "withdrawn", "awaiting_upload"]) {
    assert.equal(canStartFreshPageRead(status, null, "refresh"), false);
  }
  for (const status of ["completed", "review_required", "error"]) {
    assert.equal(canStartFreshPageRead(status, "expired lease still must be released", "refresh"), false);
  }
});

test("fresh read checkpoints preserve historical proofs without presenting them as the new reading", () => {
  const read = { documentType: "income", records: [{ category: "income", fields: [{ key: "net", value: 2500000 }] }] };
  const verifierPasses = [{ promptHash: "historical-prompt", model: "gpt-6-luna", verifiedAt: "2025-01-01" }];
  const prior = { read, firstRead: read, verifierPasses, sourceReceiptCount: 1, commit: { stale: true }, supersededResult: { huge: "older archive" }, projectionClaim: { token: "stale" } };
  const archive = { key: "private/read-history/content-hash.json", sha256: "a".repeat(64), cacheKey: "old-cache", archivedAt: "2026-10-27" };
  const checkpoint = freshPageCheckpoint(JSON.stringify(prior), "old-cache", archive);
  assert.deepEqual(checkpoint.priorReadArchive, archive);
  assert.deepEqual(checkpoint.supersededRead, read);
  assert.deepEqual(checkpoint.supersededResult?.verifierPasses, verifierPasses);
  for (const field of ["read", "firstRead", "review", "verifierPasses", "commit", "sourceReceiptCount"]) assert.ok(!(field in checkpoint));
  assert.ok(!("supersededResult" in checkpoint.supersededResult!));
  assert.ok(!("projectionClaim" in checkpoint.supersededResult!));
  assert.deepEqual(prior.verifierPasses, verifierPasses);
});

test("an unreadable prior result is still linked to its exact immutable archive", () => {
  const archive = { key: "private/read-history/content-hash.json", sha256: "b".repeat(64), cacheKey: null, archivedAt: "2026-10-27" };
  const checkpoint = freshPageCheckpoint("invalid json that must not silently become verified", null, archive);
  assert.deepEqual(checkpoint.priorReadArchive, archive);
  assert.equal(checkpoint.supersededRead, undefined);
  assert.equal(checkpoint.supersededResult, undefined);
});
