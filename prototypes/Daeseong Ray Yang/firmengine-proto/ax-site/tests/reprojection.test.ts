import test from "node:test";
import assert from "node:assert/strict";
import { createCase, currentFacts, reviewFact } from "../lib/domain.ts";
import { hasCurrentProjection, PAGE_PROJECTION_VERSION, prepareStoredReadReprojection, reprojectStoredPage, type StoredPageJobForReprojection, type StoredReadResult } from "../lib/reprojection.ts";
import type { PageRead } from "../lib/extraction.ts";

const hash = "d".repeat(64), imageHash = "e".repeat(64);
const read: PageRead = { documentType: "synthetic_income", complete: true, warnings: [], records: [{ category: "income", label: "synthetic salary row", fields: [
  { key: "label", label: "income source", value: "monthly salary", unit: null, quote: "synthetic source monthly salary", confidence: "clear", bbox: null },
  { key: "employer", label: "employer", value: "Synthetic Co", unit: null, quote: "synthetic source Synthetic Co", confidence: "clear", bbox: null },
  { key: "net", label: "net", value: "3000000", unit: "KRW", quote: "synthetic source net 3000000 KRW", confidence: "clear", bbox: null },
  { key: "period_start", label: "start", value: "2026-01-01", unit: null, quote: "synthetic start 2026-01-01", confidence: "clear", bbox: null },
  { key: "period_end", label: "end", value: "2026-01-31", unit: null, quote: "synthetic end 2026-01-31", confidence: "clear", bbox: null },
  { key: "amount_basis", label: "basis", value: "monthly", unit: null, quote: "synthetic monthly", confidence: "clear", bbox: null },
] }] };
function fixture(role: "evidence" | "filed_form" | "administrative" = "evidence") {
  const data = createCase("Synthetic reprojection", "synthetic-case", "2026-10-27");
  data.documents = [{ id: "doc-1", name: "synthetic.pdf", sha256: hash, status: "active", pages: [1] }];
  data.pages = [{ documentId: "doc-1", page: 1, role, documentType: "synthetic_income", text: read.records.flatMap(record => record.fields.map(field => field.quote ?? "")).join("\n"), imageUrl: "/synthetic" }];
  const job: StoredPageJobForReprojection = { id: "job-1", caseId: data.context.id, documentId: "doc-1", page: 1, role, status: "completed", stage: "completed", leaseUntil: null, imageKey: "synthetic/image", imageHash, cacheKey: JSON.stringify(["doc-1", hash, [1], "income", "historical-prompt-1.0", "gpt-6-luna", "rules-previous"]), result: "{}" };
  const saved: StoredReadResult = { read, firstRead: read, extractionRead: read, review: { checks: [], warnings: [] }, verifierPasses: [], sourceReceiptCount: 0 };
  const prepare = (changes: Partial<Parameters<typeof prepareStoredReadReprojection>[0]> = {}) => prepareStoredReadReprojection({ data, job, saved, originalReady: true, imageReady: true, activeProcessingJobs: 0, ...changes });
  return { data, job, saved, prepare };
}

test("stored historical read reprojects deterministically without a model call or new proof", () => {
  const f = fixture(), prepared = f.prepare(), result = reprojectStoredPage(f.data, prepared);
  assert.equal(prepared.provenance.promptVersion, "historical-prompt-1.0");
  assert.equal(prepared.provenance.model, "gpt-6-luna");
  assert.equal(currentFacts(result.data).length, 6);
  assert.ok(currentFacts(result.data).every(fact => fact.state === "extracted" && !fact.sourceVerification));
  assert.equal(result.newReceiptsCreated, 0);
});

test("reprojection is idempotent for facts and records that historical prompts remain historical", () => {
  const f = fixture(), first = reprojectStoredPage(f.data, f.prepare());
  const second = reprojectStoredPage(first.data, f.prepare({ data: first.data }));
  assert.equal(currentFacts(second.data).length, currentFacts(first.data).length);
  assert.deepEqual(currentFacts(second.data).map(x => x.logicalId), currentFacts(first.data).map(x => x.logicalId));
  assert.equal(f.prepare().provenance.promptVersion, "historical-prompt-1.0");
});

test("matching projection version, source hash and cache key make a repeated action a no-op", () => {
  const f = fixture();
  f.saved.projection = { version: PAGE_PROJECTION_VERSION, appliedAt: "2026-10-27T00:00:00.000Z", caseRevision: 2, sourceSha256: hash, cacheKey: f.job.cacheKey };
  assert.equal(hasCurrentProjection(f.saved, f.job, hash), true);
  assert.equal(hasCurrentProjection(f.saved, f.job, "f".repeat(64)), false);
  assert.equal(hasCurrentProjection(f.saved, { ...f.job, cacheKey: "changed" }, hash), false);
});

test("existing human-reviewed facts and typed object decisions survive reprojection", () => {
  const f = fixture(), first = reprojectStoredPage(f.data, f.prepare());
  const fact = currentFacts(first.data).find(x => x.key === "income.net")!;
  const reviewed = reviewFact(first.data, fact.id, { state: "verified", recognition: "accepted", actor: "synthetic-reviewer", reason: "synthetic source comparison" });
  const income = reviewed.incomes[0]; income.recognition = "accepted"; income.label = "human-reviewed name";
  const next = reprojectStoredPage(reviewed, f.prepare({ data: reviewed }));
  assert.ok(currentFacts(next.data).some(x => x.id === currentFacts(reviewed).find(y => y.logicalId === fact.logicalId)?.id && x.state === "verified" && x.recognition === "accepted"));
  assert.equal(next.data.incomes[0].label, "human-reviewed name");
  assert.equal(next.newReceiptsCreated, 0);
});

test("held-out/admin jobs, source hash mismatch, missing uploads and active processing are rejected", () => {
  const held = fixture("filed_form"); assert.throws(() => held.prepare(), /분리 페이지/);
  const admin = fixture("administrative"); assert.throws(() => admin.prepare(), /분리 페이지/);
  const mismatch = fixture(); assert.throws(() => mismatch.prepare({ job: { ...mismatch.job, cacheKey: JSON.stringify(["doc-1", "f".repeat(64), [1], "income", "p", "gpt-6-luna", "rules"]) } }), /출처/);
  const pending = fixture(); assert.throws(() => pending.prepare({ job: { ...pending.job, status: "pending", stage: "extract" } }), /판독이 완료/);
  const missingOriginal = fixture(); assert.throws(() => missingOriginal.prepare({ originalReady: false }), /원본 파일/);
  const missingImage = fixture(); assert.throws(() => missingImage.prepare({ imageReady: false }), /원본 파일/);
  const busy = fixture(); assert.throws(() => busy.prepare({ activeProcessingJobs: 1 }), /다른 페이지 처리/);
});

test("legacy stored reads without verification passes stay unverified", () => {
  const f = fixture(); delete f.saved.verifierPasses; f.saved.sourceReceiptCount = 99;
  const prepared = f.prepare();
  assert.equal(prepared.provenance.verificationPasses, 0);
  assert.equal(prepared.provenance.storedReceiptCount, 99);
  const result = reprojectStoredPage(f.data, prepared);
  assert.ok(currentFacts(result.data).every(fact => fact.state !== "verified" && !fact.sourceVerification));
});

test("invalid stored read and malformed historical cache provenance are rejected", () => {
  const invalid = fixture(); invalid.saved.read = { nope: true };
  assert.throws(() => invalid.prepare(), /형식/);
  const badCache = fixture(); assert.throws(() => badCache.prepare({ job: { ...badCache.job, cacheKey: "not-json" } }), /출처/);
});
