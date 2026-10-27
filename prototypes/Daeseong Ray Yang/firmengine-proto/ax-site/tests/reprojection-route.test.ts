import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
class MockHttpError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
function loadRoute(overrides: Record<string, unknown> = {}) {
  const code = readFileSync(root + "app/api/cases/[id]/process/route.ts", "utf8");
  const output = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loadedModule = { exports: {} as Record<string, unknown> };
  const mocks: Record<string, unknown> = {
    "../../../../../lib/case-response": { caseProgress: async (_id: string, result: { stage?: string }) => ({ caseId: "case-1", remaining: 0, stage: result.stage }) },
    "../../../../../lib/json-response": { jsonResponse: (body: unknown, _request: Request, init?: ResponseInit) => Response.json(body, init) },
    "../../../../../lib/page-job-inspection": { inspectStoredPageJob: async (_id: string, jobId: string) => ({ stored: true, jobId }), reprojectCasePage: async () => ({}) },
    "../../../../../lib/classification-inspection": { inspectClassificationJob: async (_id: string, jobId: string) => ({ classification: true, jobId, modelCalls: 0, mutatesState: false }) },
    "../../../../../lib/reprojection": { PAGE_PROJECTION_VERSION: "synthetic-projection-v1", ReprojectionError: class extends Error { status = 409; }, reprojectStoredPage: () => ({}) },
    "../../../../../lib/server-store": { actor: async () => "synthetic-actor", db: () => ({ prepare: () => ({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) }) }), errorResponse: (error: unknown) => Response.json({ error: error instanceof Error ? error.message : "error" }, { status: 409 }), event: async () => {}, HttpError: MockHttpError, jsonBody: async (request: Request) => request.json(), now: () => "2026-10-27T00:00:00.000Z", requireSameOrigin: () => {}, saveCase: async () => {} },
    "../../../../../lib/pipeline": { processNext: async () => { throw new Error("paid process path must not run"); }, reconcileCase: async () => ({}), retryFailed: async () => ({}), retryPage: async () => ({}), reverifyPage:async()=>({}),reviewLegal: async () => ({}) },
    ...overrides,
  };
  new Function("require", "module", "exports", output)((name: string) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, loadedModule, loadedModule.exports);
  return loadedModule.exports as { GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response>; POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> };
}

test("GET job inspection returns only the selected page inspection result", async () => {
  const received: string[] = [];
  const route = loadRoute({ "../../../../../lib/page-job-inspection": { inspectStoredPageJob: async (caseId: string, jobId: string) => { received.push(caseId, jobId); return { jobId, rawRead: "synthetic" }; }, reprojectCasePage: async () => ({}) } });
  const response = await route.GET(new Request("https://synthetic.invalid/api/cases/case-1/process?jobId=job-7"), { params: Promise.resolve({ id: "case-1" }) });
  assert.deepEqual(received, ["case-1", "job-7"]);
  assert.deepEqual(await response.json(), { jobId: "job-7", rawRead: "synthetic" });
});

test("reproject action persists deterministic result without invoking processNext", async () => {
  const original = { context: { id: "case-1", revision: 1 } } as never;
  const next = { context: { id: "case-1", revision: 2 } } as never;
  let saved = 0, events = 0, updates = 0, projectionCalls = 0;
  const staged = { alreadyApplied: false, data: original, job: { id: "job-7", documentId: "doc-1", page: 4, status: "review_required", cacheKey: "historical-cache" }, saved: { read: { records: [] }, verifierPasses: [] }, prepared: {}, rawResult: "{\"read\":{\"records\":[]}}", provenance: { documentSha256: "d".repeat(64), model: "gpt-6-luna", promptVersion: "historical-prompt", verificationPasses: 0, storedReceiptCount: 0 } };
  const route = loadRoute({
    "../../../../../lib/page-job-inspection": { inspectStoredPageJob: async () => ({}), reprojectCasePage: async () => staged },
    "../../../../../lib/reprojection": { PAGE_PROJECTION_VERSION: "synthetic-projection-v1", ReprojectionError: class extends Error { status = 409; }, reprojectStoredPage: () => { projectionCalls++; return { data: next, retainedReceipts: 0, newReceiptsCreated: 0 }; } },
    "../../../../../lib/server-store": { actor: async () => "synthetic-actor", db: () => ({ prepare: () => ({ bind: () => ({ run: async () => { updates++; return { meta: { changes: 1 } }; } }) }) }), errorResponse: (error: unknown) => Response.json({ error: error instanceof Error ? error.message : "error" }, { status: 409 }), event: async () => { events++; }, HttpError: MockHttpError, jsonBody: async (request: Request) => request.json(), now: () => "2026-10-27T00:00:00.000Z", requireSameOrigin: () => {}, saveCase: async () => { saved++; } },
  });
  const response = await route.POST(new Request("https://synthetic.invalid/api/cases/case-1/process", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reproject_page", jobId: "job-7" }) }), { params: Promise.resolve({ id: "case-1" }) });
  const payload = await response.json() as { stage: string; alreadyApplied: boolean; newReceiptsCreated: number; historicalProvenance: { promptVersion: string } };
  assert.equal(response.status, 200); assert.equal(payload.stage, "reprojected"); assert.equal(payload.alreadyApplied, false); assert.equal(payload.newReceiptsCreated, 0); assert.equal(payload.historicalProvenance.promptVersion, "historical-prompt");
  assert.equal(saved, 1); assert.equal(events, 1); assert.equal(updates, 2); assert.equal(projectionCalls, 1);
});

test("an already-applied version/source/cache marker makes route replay a no-op", async () => {
  const staged = { alreadyApplied: true, data: { context: { revision: 8 } }, job: {}, saved: {}, prepared: {}, rawResult: "{}", provenance: {} };
  let saves = 0, projections = 0;
  const route = loadRoute({
    "../../../../../lib/page-job-inspection": { inspectStoredPageJob: async () => ({}), reprojectCasePage: async () => staged },
    "../../../../../lib/reprojection": { PAGE_PROJECTION_VERSION: "synthetic-projection-v1", ReprojectionError: class extends Error { status = 409; }, reprojectStoredPage: () => { projections++; return {}; } },
    "../../../../../lib/server-store": { actor: async () => "synthetic", db: () => ({ prepare: () => ({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) }) }), errorResponse: (e: unknown) => Response.json({ error: String(e) }, { status: 409 }), event: async () => {}, HttpError: MockHttpError, jsonBody: async (request: Request) => request.json(), now: () => "2026-10-27T00:00:00.000Z", requireSameOrigin: () => {}, saveCase: async () => { saves++; } },
  });
  const response = await route.POST(new Request("https://synthetic.invalid/api/cases/case-1/process", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reproject_page", jobId: "job-7" }) }), { params: Promise.resolve({ id: "case-1" }) });
  const payload = await response.json() as { alreadyApplied: boolean };
  assert.equal(response.status, 200); assert.equal(payload.alreadyApplied, true); assert.equal(saves, 0); assert.equal(projections, 0);
});

test("explicit refresh action requests a new read without taking the cached reprojection path", async () => {
  const calls: unknown[][] = [];
  const route = loadRoute({
    "../../../../../lib/pipeline": { retryPage: async (...args: unknown[]) => { calls.push(args); return { stage: "page_retry_queued" }; } },
    "../../../../../lib/reprojection": { ReprojectionError: class extends Error {}, reprojectStoredPage: () => { throw new Error("refresh must not reuse a cached read"); } },
  });
  const response = await route.POST(new Request("https://synthetic.invalid/api/cases/case-1/process", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "refresh_page", jobId: "job-7" }) }), { params: Promise.resolve({ id: "case-1" }) });
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [["case-1", "job-7", "refresh"]]);
});

test("explicit reverify action sends only the selected job id and never accepts a client-supplied read",async()=>{
  const calls:unknown[][]=[];
  const route=loadRoute({"../../../../../lib/pipeline":{processNext:async()=>({}),reconcileCase:async()=>({}),retryFailed:async()=>({}),retryPage:async()=>({}),reverifyPage:async(...args:unknown[])=>{calls.push(args);return {stage:"page_reverify_queued"};},reviewLegal:async()=>({})}});
  const response=await route.POST(new Request("https://synthetic.invalid/api/cases/case-1/process",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"reverify_page",jobId:"job-7",read:{records:[{value:"untrusted"}]}})}),{params:Promise.resolve({id:"case-1"})});
  assert.equal(response.status,200);assert.deepEqual(calls,[["case-1","job-7"]]);
});

test("classification view reads only routing diagnostics and cannot fall through to OCR inspection", async () => {
  const calls: string[] = [];
  const route = loadRoute({
    "../../../../../lib/classification-inspection": { inspectClassificationJob: async (caseId: string, jobId: string) => { calls.push(caseId, jobId); return { mode: "classification_diagnostic", modelCalls: 0, mutatesState: false }; } },
    "../../../../../lib/page-job-inspection": { inspectStoredPageJob: async () => { throw new Error("classification must not request a completed OCR read"); } },
  });
  const response = await route.GET(new Request("https://synthetic.invalid/api/cases/case-1/process?jobId=job-7&view=classification"), { params: Promise.resolve({ id: "case-1" }) });
  assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(calls, ["case-1", "job-7"]);
  assert.deepEqual(await response.json(), { mode: "classification_diagnostic", modelCalls: 0, mutatesState: false });
  for (const query of ["view=classification", "jobId=job-7&view=unsupported"]) {
    const invalid = await route.GET(new Request("https://synthetic.invalid/api/cases/case-1/process?" + query), { params: Promise.resolve({ id: "case-1" }) });
    assert.equal(invalid.ok, false);
  }
  assert.deepEqual(calls, ["case-1", "job-7"]);
});
