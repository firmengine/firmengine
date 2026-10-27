import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";
import * as domain from "../lib/domain.ts";
import * as pageRefresh from "../lib/page-refresh.ts";
import * as retryPolicy from "../lib/retry-page-policy.ts";

const code = ts.transpileModule(readFileSync(new URL("../lib/pipeline.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
class TestError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
function fixture(options: { status?: string; immutableRole?: string; archiveFailure?: boolean; concurrentChange?: boolean } = {}) {
  const data = domain.createCase("Synthetic", "case-refresh", "2026-10-27");
  data.context.applicant = { name: "Manually corrected applicant" };
  data.documents.push({ id: "doc", name: "synthetic.pdf", sha256: "a".repeat(64), pages: [1], status: "active", uploadedAt: "2026-10-27" });
  data.pages.push({ documentId: "doc", page: 1, role: "evidence", documentType: "income" });
  const original = JSON.stringify({ read: { documentType: "income", records: [] }, verifierPasses: [{ verifiedAt: "historical", promptHash: "historical" }], sourceReceiptCount: 1 });
  const job = { id: "doc:1", document_id: "doc", page: 1, role: "evidence", status: options.status ?? "completed", lease_until: null, image_key: "image-key", image_hash: "b".repeat(64), document_type: "income", result: original, cache_key: "prior-cache", ready: 1 };
  const archives: Array<{ key: string; raw: string }> = [], writes: unknown[][] = [], saved: domain.CaseData[] = [];
  const modules: Record<string, unknown> = {
    "./domain": domain, "./page-refresh": pageRefresh, "./retry-page-policy": retryPolicy,
    "./sample-manifest": { samplePageRole: () => ({ role: options.immutableRole ?? "evidence" }) },
    "./server-store": {
      HttpError: TestError, now: () => "2026-10-27T12:00:00.000Z", getCase: async () => data,
      saveCase: async (next: domain.CaseData) => { saved.push(next); }, event: async () => {},
      bucket: () => ({ put: async (key: string, raw: string) => { if (options.archiveFailure) throw new Error("archive unavailable"); archives.push({ key, raw }); } }),
      db: () => ({ prepare: (sql: string) => ({ bind: (...params: unknown[]) => ({
        first: async () => sql.includes("SELECT p.id") ? job : { n: 1 },
        run: async () => { assert.match(sql, /result IS \? AND cache_key IS \?/); writes.push(params); return { meta: { changes: options.concurrentChange ? 0 : 1 } }; },
      }) }) }),
    },
  };
  const module = { exports: {} as { retryPage: (caseId: string, jobId: string, intent: "retry" | "refresh") => Promise<unknown> } };
  new Function("require", "module", "exports", code)((name: string) => modules[name] ?? {}, module, module.exports);
  return { data, original, job, archives, writes, saved, run: (intent: "retry" | "refresh" = "refresh") => module.exports.retryPage(data.context.id, job.id, intent) };
}

test("fresh completed-page read archives exact bytes before resetting only the selected job", async () => {
  const f = fixture(); await f.run();
  assert.equal(f.archives.length, 1); assert.equal(f.archives[0].raw, f.original);
  const digest = createHash("sha256").update(f.original).digest("hex");
  assert.equal(f.archives[0].key, `cases/case-refresh/documents/doc/read-history/1/${digest}.json`);
  const checkpoint = JSON.parse(String(f.writes[0][0]));
  assert.equal(checkpoint.priorReadArchive.sha256, digest); assert.equal(checkpoint.read, undefined);
  assert.deepEqual(checkpoint.supersededResult.verifierPasses, JSON.parse(f.original).verifierPasses);
  assert.equal(f.writes[0][2], "doc:1"); assert.equal(f.writes[0][3], "case-refresh"); assert.equal(f.writes[0][7], f.original);
  assert.deepEqual(f.saved[0].context.applicant, f.data.context.applicant);
  assert.deepEqual(f.saved[0].facts, f.data.facts); assert.deepEqual(f.saved[0].incomes, f.data.incomes);
  assert.equal(f.saved[0].context.revision, f.data.context.revision + 1);
});

test("refresh cannot expose a held-out page, running page, or silently reset a completed page through retry", async () => {
  for (const options of [{ immutableRole: "filed_form" }, { immutableRole: "administrative" }, { status: "processing" }]) {
    const f = fixture(options); await assert.rejects(f.run(), (e: unknown) => e instanceof TestError && e.status === 409);
    assert.equal(f.archives.length, 0); assert.equal(f.saved.length, 0); assert.equal(f.writes.length, 0);
  }
  const f = fixture(); await assert.rejects(f.run("retry")); assert.equal(f.writes.length, 0);
});

test("failed archival or a changed page result prevents the fresh job reset", async () => {
  const failed = fixture({ archiveFailure: true }); await assert.rejects(failed.run(), /archive unavailable/);
  assert.equal(failed.saved.length, 0); assert.equal(failed.writes.length, 0);
  const raced = fixture({ concurrentChange: true }); await assert.rejects(raced.run(), (e: unknown) => e instanceof TestError && e.status === 409);
  assert.equal(raced.archives[0].raw, raced.original);
});
