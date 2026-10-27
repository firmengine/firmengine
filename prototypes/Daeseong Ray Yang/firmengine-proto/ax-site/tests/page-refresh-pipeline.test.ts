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
function fixture(options: { status?: string; immutableRole?: string; archiveFailure?: boolean; concurrentChange?: boolean;sourceObjectMismatch?:boolean } = {}) {
  const data = domain.createCase("Synthetic", "case-refresh", "2026-10-27");
  const sourceBytes=new TextEncoder().encode("synthetic original PDF bytes"),sourceHash=createHash("sha256").update(sourceBytes).digest("hex");
  data.context.applicant = { name: "Manually corrected applicant" };
  data.documents.push({ id: "doc", name: "synthetic.pdf", sha256: sourceHash, pages: [1], status: "active", uploadedAt: "2026-10-27" });
  data.pages.push({ documentId: "doc", page: 1, role: "evidence", documentType: "income" });
  const original = JSON.stringify({ read: { documentType: "income", records: [] }, verifierPasses: [{ verifiedAt: "historical", promptHash: "historical" }], sourceReceiptCount: 1 });
  const pageBytes=new TextEncoder().encode("synthetic page image");
  const job = { id: "doc:1", document_id: "doc", page: 1, role: "evidence", status: options.status ?? "completed", stage:"completed", lease_until: null, image_key: `cases/case-refresh/documents/doc/pages/1/${createHash("sha256").update(pageBytes).digest("hex")}`, image_hash: createHash("sha256").update(pageBytes).digest("hex"), document_type: "income", result: original, cache_key: "prior-cache", ready: 1 };
  const archives: Array<{ key: string; raw: string }> = [], writes: unknown[][] = [], saved: domain.CaseData[] = [];
  const modules: Record<string, unknown> = {
    "./domain": domain, "./page-refresh": pageRefresh, "./retry-page-policy": retryPolicy,"./extraction":{validatePageRead:(read:unknown)=>read,PROMPT_VERSION:"luna-evidence-3.13.0"},
    "./sample-manifest": { samplePageRole: () => ({ role: options.immutableRole ?? "evidence" }) },"./legal-rules":{CURRENT_RULESET:{id:"synthetic-rules"}},
    "./server-store": {
      HttpError: TestError, now: () => "2026-10-27T12:00:00.000Z", getCase: async () => data,
      saveCase: async (next: domain.CaseData) => { saved.push(next); }, event: async () => {},
      bucket: () => ({ put: async (key: string, raw: string) => { if (options.archiveFailure) throw new Error("archive unavailable"); archives.push({ key, raw }); },head:async(key:string)=>key.includes("/original/")&&!options.sourceObjectMismatch?{key}:null,get:async(key:string)=>{const source=pageBytes;return {arrayBuffer:async()=>source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength)};}}),
      db: () => ({ prepare: (sql: string) => ({ bind: (...params: unknown[]) => ({
        first: async () => sql.includes("SELECT p.id") ? {...job,original_key:"cases/case-refresh/documents/doc/original/source.pdf",source_sha256:data.documents[0].sha256} : { n: 1 },
        run: async () => { assert.match(sql, /result IS \? AND cache_key IS \?/); writes.push(params); if(sql.includes("stage = 'reverify'")){job.stage="reverify";job.status="pending";job.result=String(params[0]);job.cache_key=String(params[1]);}return { meta: { changes: options.concurrentChange ? 0 : 1 } }; },
      }) }) }),
    },
  };
  const module = { exports: {} as { retryPage: (caseId: string, jobId: string, intent: "retry" | "refresh") => Promise<unknown>;reverifyPage:(caseId:string,jobId:string)=>Promise<unknown> } };
  new Function("require", "module", "exports", code)((name: string) => modules[name] ?? {}, module, module.exports);
  return { data, original, job, archives, writes, saved, run: (intent: "retry" | "refresh" = "refresh") => module.exports.retryPage(data.context.id, job.id, intent),reverify:()=>module.exports.reverifyPage(data.context.id,job.id) };
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

test("stored OCR reverify archives the old result and queues only a clean current-prompt verification checkpoint",async()=>{
  const f=fixture();const read={documentType:"income",records:[{category:"income",label:"row",fields:[{key:"salary",label:"salary",value:"Synthetic salary",unit:"KRW",quote:"salary Synthetic salary",confidence:"clear",bbox:null}]}],warnings:[],complete:true};
  const originalPass={model:"gpt-6-luna",promptVersion:"luna-evidence-old",promptHash:"c".repeat(64),sourceHash:f.data.documents[0].sha256,baseImageHash:f.job.image_hash,usedVariants:[],verifiedAt:"2026-10-27T00:00:00.000Z"};
  f.job.result=JSON.stringify({read,firstRead:read,extractionRead:read,extractionPasses:[originalPass],review:{checks:[{recordIndex:0,fieldIndex:0,status:"agrees"}]},verifierPasses:[{kind:"verify",model:"gpt-6-luna",promptVersion:"legacy",promptHash:"d".repeat(64),verifiedAt:"2026-10-27T00:00:00.000Z",checks:[{recordIndex:0,fieldIndex:0,status:"agrees"}]},{kind:"repair",model:"gpt-6-luna",promptVersion:"legacy",promptHash:"e".repeat(64),verifiedAt:"2026-10-27T00:00:00.000Z",checks:[]}],sourceReceiptCount:7});
  const prior=f.job.result,result=await f.reverify();assert.deepEqual(result,{remaining:1,stage:"page_reverify_queued",page:1});
  assert.equal(f.archives.length,1);assert.equal(f.archives[0].raw,prior);const digest=createHash("sha256").update(prior).digest("hex");
  const checkpoint=JSON.parse(String(f.writes[0][0]));assert.equal(f.writes[0][1],checkpoint.reverification.currentCacheKey);assert.equal(checkpoint.read.records[0].fields[0].value,"Synthetic salary");assert.deepEqual(checkpoint.extractionPasses,[originalPass]);assert.equal(checkpoint.reverification.originalReadHash,createHash("sha256").update(JSON.stringify(read)).digest("hex"));assert.equal(checkpoint.reverification.originalCacheKey,"prior-cache");assert.equal(checkpoint.reverification.verificationPromptVersion,"luna-evidence-3.13.0");
  assert.equal(checkpoint.review,undefined);assert.equal(checkpoint.verifierPasses,undefined);assert.equal(checkpoint.sourceReceiptCount,undefined);assert.equal(checkpoint.commit,undefined);assert.deepEqual(checkpoint.priorReadArchive,{key:`cases/case-refresh/documents/doc/read-history/1/${digest}.json`,sha256:digest,cacheKey:"prior-cache",archivedAt:"2026-10-27T12:00:00.000Z"});
  assert.equal(f.job.stage,"reverify");assert.equal(f.job.status,"pending");assert.equal(f.saved[0].context.revision,f.data.context.revision+1);assert.deepEqual(f.saved[0].context.applicant,f.data.context.applicant);
});

test("reverify refuses incomplete, held-out, leased, source-mismatched, or incomplete-provenance pages before archiving",async()=>{
  for(const options of [{immutableRole:"filed_form"},{status:"processing"}]){const f=fixture(options);await assert.rejects(f.reverify());assert.equal(f.archives.length,0);assert.equal(f.writes.length,0);}
  const incomplete=fixture();incomplete.job.result=JSON.stringify({read:{documentType:"income",records:[],warnings:[],complete:false},extractionPasses:[]});await assert.rejects(incomplete.reverify(),/완전하지 않습니다/);assert.equal(incomplete.archives.length,0);
  const noProvenance=fixture();noProvenance.job.result=JSON.stringify({read:{documentType:"income",records:[],warnings:[],complete:true}});await assert.rejects(noProvenance.reverify(),/provenance/);assert.equal(noProvenance.archives.length,0);
  const stale=fixture();stale.data.documents[0].sha256="f".repeat(64);const old=stale.job.result;await assert.rejects(stale.reverify());assert.equal(stale.job.result,old);assert.equal(stale.archives.length,0);
  const missingOriginal=fixture({sourceObjectMismatch:true});missingOriginal.job.result=JSON.stringify({read:{documentType:"income",records:[],warnings:[],complete:true},extractionPasses:[{model:"gpt-6-luna",promptVersion:"old",promptHash:"c".repeat(64),sourceHash:missingOriginal.data.documents[0].sha256,baseImageHash:missingOriginal.job.image_hash,verifiedAt:"2026-10-26T00:00:00.000Z"}]});await assert.rejects(missingOriginal.reverify(),/찾을 수 없어/);assert.equal(missingOriginal.archives.length,0);
});

test("reverify clears only old machine receipts for the selected source page and retains human-reviewed facts",()=>{
  const proof={source:{documentId:"doc",page:1,sha256:"a".repeat(64)}};
  const data:any={facts:[
    {id:"machine-page",state:"verified",sourceVerification:proof,validation:[{code:"MACHINE_SOURCE_VERIFIED"},{code:"OTHER"}]},
    {id:"manual-page",state:"verified",reviewer:{actor:"synthetic"},validation:[{code:"OTHER"}]},
    {id:"other-page",state:"verified",sourceVerification:{source:{documentId:"doc",page:2,sha256:"a".repeat(64)}},validation:[{code:"MACHINE_SOURCE_VERIFIED"}]},
  ]};
  const next=pageRefresh.clearAutomatedPageReceipts(data,"doc",1,"a".repeat(64));
  assert.equal(next.facts[0].state,"extracted");assert.equal(next.facts[0].sourceVerification,undefined);assert.deepEqual(next.facts[0].validation,[{code:"OTHER"}]);
  assert.equal(next.facts[1].reviewer.actor,"synthetic");assert.equal(next.facts[1].state,"verified");
  assert.ok(next.facts[2].sourceVerification);assert.notEqual(next,data);
});
