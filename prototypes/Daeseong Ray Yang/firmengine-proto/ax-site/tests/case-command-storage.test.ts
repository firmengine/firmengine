import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import ts from "typescript";
import * as domain from "../lib/domain.ts";
import * as processingReadiness from "../lib/processing-readiness.ts";
import * as reactiveEvaluation from "../lib/reactive-evaluation.ts";
import * as executionCatalog from "../lib/execution-catalog.ts";
import * as calculatorTools from "../lib/calculator-tools.ts";
import * as legalRules from "../lib/legal-rules.ts";
import * as referenceRuntime from "../lib/reference-runtime.ts";
import * as referenceApplication from "../lib/reference-application.ts"
import referenceRelease from "../lib/reference-release.json" with { type: "json" };
import type { CaseData } from "../lib/domain.ts";

const root=fileURLToPath(new URL("../",import.meta.url));
const load=<T>(mocks:Record<string,unknown>):T=>{
  const dependencies:Record<string,unknown>={"cloudflare:workers":{env:{DB:undefined,BUCKET:undefined}},"../app/chatgpt-auth":{getChatGPTUser:async()=>({userId:"synthetic-owner"})},"./domain":domain,"./legal-rules":legalRules,"./processing-readiness":processingReadiness,"./execution-catalog.ts":executionCatalog,"./reactive-evaluation.ts":reactiveEvaluation,"./calculator-tools.ts":calculatorTools,"./reference-runtime.ts":referenceRuntime,"./reference-application.ts":referenceApplication,"./reference-release.json":{default:referenceRelease},...mocks};
  const output=ts.transpileModule(readFileSync(root+"lib/server-store.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};new Function("require","module","exports",output)((name:string)=>{if(Object.hasOwn(dependencies,name))return dependencies[name];throw new Error(`Unexpected dependency: ${name}`);},module,module.exports);return module.exports as T;
};
type Store={getCase(id:string):Promise<CaseData>;saveCase(data:CaseData,revision:number,previous:CaseData,mutation?:any):Promise<unknown>;[key:string]:any};
export function setup(options:{loseAckAndSupersede?:boolean;derivedHooks?:Record<string,unknown>}={}){
  const sqlite=new DatabaseSync(":memory:");
  for(const name of ["0000_chunky_cardiac.sql","0001_case_storage_token.sql","0007_case_commands.sql"])sqlite.exec(readFileSync(root+"drizzle/"+name,"utf8"));
  const data=domain.createCase("Synthetic command storage",crypto.randomUUID(),"2026-10-29");
  sqlite.prepare("INSERT INTO cases (id,name,owner,revision,payload,created_at,updated_at,storage_token) VALUES (?,?,?,?,?,?,?,?)").run(data.context.id,data.context.caseName,"synthetic-owner",data.context.revision,JSON.stringify(data),"synthetic","synthetic","initial-token");
  const objects=new Map<string,Uint8Array>();
  const bucket={async put(key:string,value:ReadableStream<Uint8Array>|Uint8Array|ArrayBuffer){const bytes=value instanceof ReadableStream?new Uint8Array(await new Response(value).arrayBuffer()):new Uint8Array(value instanceof ArrayBuffer?value:value);objects.set(key,bytes);return{};},async get(key:string){const bytes=objects.get(key);return bytes?{arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}:null;},async delete(key:string){objects.delete(key);}};
  let batches=0;
  const db={prepare(sql:string){return{bind(...params:SQLInputValue[]){return{async first(){return sqlite.prepare(sql).get(...params)??null;},async run(){const result=sqlite.prepare(sql).run(...params);return{meta:{changes:Number(result.changes)}};},async all(){return{results:sqlite.prepare(sql).all(...params)};}};}};},async batch(commands:Array<{run():Promise<{meta:{changes:number}}>}>){sqlite.exec("BEGIN IMMEDIATE");try{const results=[];for(const command of commands)results.push(await command.run());sqlite.exec("COMMIT");batches++;if(options.loseAckAndSupersede&&batches===1){const row=sqlite.prepare("SELECT payload,revision FROM cases WHERE id=?").get(data.context.id) as {payload:string;revision:number};const newer=JSON.parse(row.payload);newer.context.revision=row.revision+1;newer.context.caseName="newer writer state";sqlite.prepare("UPDATE cases SET payload=?,revision=?,name=?,storage_token=? WHERE id=?").run(JSON.stringify(newer),newer.context.revision,newer.context.caseName,"newer-writer-token",data.context.id);throw new Error("synthetic acknowledgement lost after commit and newer write");}return results;}catch(error){try{sqlite.exec("ROLLBACK");}catch{}throw error;}}};
  const store=load<Store>({"cloudflare:workers":{env:{DB:db,BUCKET:bucket}},...(options.derivedHooks?{"./reactive-evaluation.ts":{...reactiveEvaluation,...options.derivedHooks}}:{})});
  return{sqlite,objects,data,store};
}

test("concurrent same-revision command saves allow exactly one CAS winner",async()=>{
  const h=setup(),[a,b]=await Promise.all([h.store.getCase(h.data.context.id),h.store.getCase(h.data.context.id)]);
  const nextA=structuredClone(a),nextB=structuredClone(b);nextA.context.caseName="winner A";nextB.context.caseName="winner B";
  const outcomes=await Promise.allSettled([h.store.saveCase(nextA,a.context.revision,a),h.store.saveCase(nextB,b.context.revision,b)]);
  assert.equal(outcomes.filter(x=>x.status==="fulfilled").length,1);assert.equal(outcomes.filter(x=>x.status==="rejected").length,1);
  const receipts=h.sqlite.prepare("SELECT COUNT(*) AS n FROM case_mutation_receipts").get() as {n:number};assert.equal(receipts.n,0);
  h.sqlite.close();
});

test("duplicate command IDs racing on the same prior token commit one receipt and one event",async()=>{
  const h=setup(),[a,b]=await Promise.all([h.store.getCase(h.data.context.id),h.store.getCase(h.data.context.id)]);
  const nextA=structuredClone(a),nextB=structuredClone(b);nextA.context.revision++;nextB.context.revision++;
  const mutation={commandId:"duplicate-command-1",requestHash:"same-request",commandType:"fact.review",actor:"synthetic-reviewer",beforeStateHash:"before",impact:{factIds:["f1"]}};
  const outcomes=await Promise.allSettled([h.store.saveCase(nextA,a.context.revision,a,mutation),h.store.saveCase(nextB,b.context.revision,b,mutation)]);
  assert.equal(outcomes.filter(x=>x.status==="fulfilled").length,1);assert.equal(outcomes.filter(x=>x.status==="rejected").length,1);
  assert.equal((h.sqlite.prepare("SELECT COUNT(*) AS n FROM case_mutation_receipts WHERE case_id=? AND command_id=?").get(h.data.context.id,mutation.commandId) as {n:number}).n,1);
  assert.equal((h.sqlite.prepare("SELECT COUNT(*) AS n FROM events WHERE case_id=? AND type='case.command_committed'").get(h.data.context.id) as {n:number}).n,1);
  h.sqlite.close();
});

test("post-commit acknowledgement loss resolves as success and retains receipt blobs after a newer write",async()=>{
  const h=setup({loseAckAndSupersede:true}),before=await h.store.getCase(h.data.context.id),next=structuredClone(before);next.context.revision++;
  const result=await h.store.saveCase(next,before.context.revision,before,{commandId:"cmd-1",requestHash:"request-hash",commandType:"fact.review",actor:"synthetic-reviewer",beforeStateHash:"before-hash",impact:{changedFactIds:["fact-1"]}});
  const receipt=h.sqlite.prepare("SELECT before_snapshot_key AS beforeKey,after_snapshot_key AS afterKey FROM case_mutation_receipts WHERE case_id=? AND command_id=?").get(h.data.context.id,"cmd-1") as {beforeKey:string;afterKey:string};
  assert.ok(result,"durable analysis marker proves commit despite the subsequently changed case token");
  assert.ok(receipt.beforeKey&&receipt.afterKey,"the transaction committed its command receipt");
  assert.ok(h.objects.has(receipt.beforeKey),"the successful command's before snapshot remains durable after a newer token appears");
  assert.ok(h.objects.has(receipt.afterKey),"the successful command's after snapshot remains durable after a newer token appears");
  const current=await h.store.getCase(h.data.context.id);assert.equal(current.context.caseName,"newer writer state");assert.equal(current.context.revision,next.context.revision+1,"acknowledgement recovery does not rewrite the later state");
  h.sqlite.close();
});

test("an expired worker lease cannot publish after a replacement lease completes",async()=>{
  let started!:()=>void,release!:()=>void;const startedPromise=new Promise<void>(resolve=>{started=resolve;});let calls=0;
  const hooks={buildDerivedExecution:()=>{calls++;if(calls===1){started();return new Promise(resolve=>{release=()=>resolve({writer:"expired-lease"});});}return {writer:"replacement-lease"};}};
  const h=setup({derivedHooks:hooks}),before=await h.store.getCase(h.data.context.id),next=structuredClone(before);next.context.revision++;
  const pending=h.store.saveCase(next,before.context.revision,before,{commandId:"lease-command-1",requestHash:"lease-request",commandType:"case.update",actor:"synthetic-reviewer",beforeStateHash:"before",impact:{}});
  await startedPromise;
  const job=h.sqlite.prepare("SELECT id FROM case_recompute_jobs WHERE case_id=? AND status='running'").get(h.data.context.id) as {id:string};
  h.sqlite.prepare("UPDATE case_recompute_jobs SET lease_until=? WHERE id=?").run("2000-01-01T00:00:00.000Z",job.id);
  await h.store.drainCaseRecomputeJobs(h.data.context.id,1);
  release();await pending;
  const analysis=JSON.parse((h.sqlite.prepare("SELECT payload FROM analyses WHERE case_id=? AND revision=? AND type='derived_evaluation' ORDER BY at DESC LIMIT 1").get(h.data.context.id,next.context.revision) as {payload:string}).payload);
  assert.equal(analysis.execution.writer,"replacement-lease");
  const state=h.sqlite.prepare("SELECT status,lease_token AS lease FROM case_recompute_jobs WHERE id=?").get(job.id) as {status:string;lease:string|null};
  assert.equal(state.status,"complete");assert.equal(state.lease,null);
  h.sqlite.close();
});
