import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/classification-inspection.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture(saved: unknown = {}, edit?: (row: any, data: any) => void) {
  const sourceHash = "a".repeat(64), imageHash = "b".repeat(64);
  const row = { id: "doc-1:1", case_id: "case-1", document_id: "doc-1", page: 1, role: "unknown", document_type: "payroll", status: "review_required", stage: "extract", attempts: 1, result: JSON.stringify(saved), ready: 1, image_key: `cases/case-1/documents/doc-1/pages/1/${imageHash}`, image_hash: imageHash, original_key: "cases/case-1/documents/doc-1/original/immutable-object", document_sha256: sourceHash };
  const data = { context: { id: "case-1" }, documents: [{ id: "doc-1", status: "active", sha256: sourceHash, pages: [1] }], pages: [{ documentId: "doc-1", page: 1, role: "unknown" }] };
  edit?.(row, data);
  let imageReads = 0, originalHeads = 0, writes = 0;
  class TestHttpError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
  const failWrite = () => { writes++; throw new Error("read-only inspection attempted a mutation"); };
  const store = {
    db: () => ({ prepare: () => ({ bind: () => ({ first: async () => row, run: failWrite }) }) }),
    bucket: () => ({
      head: async (key: string) => { assert.equal(key, row.original_key); originalHeads++; return { size: 63_000_000 }; },
      get: async (key: string) => { assert.equal(key, row.image_key, "inspection must not read the large original body"); imageReads++; return { arrayBuffer: async () => new ArrayBuffer(1) }; },
      put: failWrite, delete: failWrite,
    }),
    getCase: async () => data, HttpError: TestHttpError, sha256: async () => imageHash,
  };
  const mod = { exports: {} as Record<string, any> };
  new Function("require", "module", "exports", compiled)((name: string) => {
    assert.equal(name, "./server-store"); return store;
  }, mod, mod.exports);
  return { inspect: (jobId = row.id) => mod.exports.inspectClassificationJob("case-1", jobId), counts: () => ({ imageReads, originalHeads, writes }) };
}

test("unknown-role classification is inspectable without an OCR read or mutation", async () => {
  const saved = {
    classificationAttempts: 2,
    classification: { role: "unknown", documentType: "payroll", confidence: "low", legibility: "low", reason: "faint source", unsafeExtra: "must not escape" },
    classificationRecovery: { sourceHash: "a".repeat(64), baseImageHash: "b".repeat(64), imageHashes: ["c".repeat(64)], plan: { planId: "plan-1", documentId: "doc-1", page: 1, sourceHash: "a".repeat(64), baseImageHash: "b".repeat(64), reason: "classification_unknown", recipeVersion: "versioned-test-recipe" }, read: { role: "unknown", confidence: "low", legibility: "low", reason: "still unresolved" } },
    read: null, verifierPasses: [{ privatePayload: true }], credentials: "must not escape",
  };
  const f = fixture(saved), out = await f.inspect();
  assert.equal(out.mode, "classification_diagnostic");
  assert.equal(out.job.role, "unknown"); assert.equal(out.job.claimAttempts, 1);
  assert.equal(out.provenance.storedClassificationAttempts, 2);
  assert.equal(out.provenance.hasStoredExtraction, false);
  assert.equal(out.provenance.recoverySourceBound, true);
  assert.equal(out.rescuePlan.recipeVersion, "versioned-test-recipe");
  assert.equal(out.modelCalls, 0); assert.equal(out.mutatesState, false);
  assert.deepEqual(f.counts(), { imageReads: 1, originalHeads: 1, writes: 0 });
  assert.doesNotMatch(JSON.stringify(out), /unsafeExtra|credentials|verifierPasses|privatePayload/);
});

test("classification observations never create missing historical attempt or model metadata", async () => {
  for (const attempts of [undefined, null, -1, "2", 1.5]) {
    const out = await fixture({ classificationAttempts: attempts }).inspect();
    assert.equal(out.provenance.storedClassificationAttempts, null);
    assert.equal(out.provenance.initialObservationBinding, "stored_job_only");
    assert.equal(out.classification, null); assert.equal(out.recovery, null);
    assert.equal(out.provenance.recoverySourceBound, false);
  }
});
test("classification diagnostics retain catalog identity and source nature independently", async () => {
  const out=await fixture({classification:{role:"evidence",familyId:"payroll_payslip",catalogRelease:"catalog-release-v2.2.0",boundaryObservation:"single_page",boundaryQuote:null,sourceNature:"synthetic_example",sourceNatureQuote:"예시 자료",confidence:"high",legibility:"clear"}}).inspect();
  assert.equal(out.classification.familyId,"payroll_payslip");
  assert.equal(out.classification.catalogRelease,"catalog-release-v2.2.0");
  assert.equal(out.classification.sourceNature,"synthetic_example");
  assert.equal(out.classification.sourceNatureQuote,"예시 자료");
  assert.equal(out.classification.boundaryObservation,"single_page");
  assert.equal(out.mutatesState,false);
  assert.equal(out.modelCalls,0);
});

test("inactive or mismatched source, page, image, and recovery bindings block diagnostics", async () => {
  const edits = [
    (_row: any, data: any) => { data.documents[0].status = "withdrawn"; },
    (row: any) => { row.document_sha256 = "c".repeat(64); },
    (_row: any, data: any) => { data.documents[0].pages = [2]; },
    (_row: any, data: any) => { data.pages[0].role = "evidence"; },
    (row: any) => { row.original_key = "cases/other/documents/doc-1/original/object"; },
    (row: any) => { row.image_key = "cases/other/image"; },
    (row: any) => { row.image_hash = "c".repeat(64); row.image_key = `cases/case-1/documents/doc-1/pages/1/${row.image_hash}`; },
    (row: any) => { row.result = "{"; },
  ];
  for (const edit of edits) await assert.rejects(fixture({}, edit).inspect(), (error: any) => error.status === 409);
  await assert.rejects(fixture({ classificationRecovery: { sourceHash: "c".repeat(64), baseImageHash: "b".repeat(64) } }).inspect(), (error: any) => error.status === 409);
  await assert.rejects(fixture({ rescuePlan: { documentId: "doc-1", page: 2, sourceHash: "a".repeat(64), baseImageHash: "b".repeat(64) } }).inspect(), (error: any) => error.status === 409);
});

test("diagnostic payloads are bounded and invalid job identifiers are rejected", async () => {
  const out = await fixture({ classification: { reason: "x".repeat(5000) } }).inspect();
  assert.equal(out.classification.reason.length, 4000); assert.equal(out.classification.truncated, true);
  await assert.rejects(fixture().inspect(" "), (error: any) => error.status === 400);
  await assert.rejects(fixture().inspect("other-job"), (error: any) => error.status === 404);
});
