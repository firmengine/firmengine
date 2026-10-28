import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import type { SQLInputValue } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import * as domain from "../lib/domain.ts";
import * as readiness from "../lib/processing-readiness.ts";
import * as reactiveEvaluation from "../lib/reactive-evaluation.ts";
import { EXECUTION_CONTRACT_VERSION } from "../lib/execution-catalog.ts";
import { snapshotSha256 } from "../lib/calculator-tools.ts";

const root=fileURLToPath(new URL("../",import.meta.url));
function load<T>(path:string,mocks:Record<string,unknown>):T{
  const output=ts.transpileModule(readFileSync(root+path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,module={exports:{}};
  new Function("require","module","exports",output)((name:string)=>{if(Object.hasOwn(mocks,name))return mocks[name];throw new Error(`Unexpected dependency: ${name}`);},module,module.exports);
  return module.exports as T;
}
function setup(){
  const sqlite=new DatabaseSync(":memory:");sqlite.exec(readFileSync(root+"drizzle/0000_chunky_cardiac.sql","utf8"));sqlite.exec(readFileSync(root+"drizzle/0001_case_storage_token.sql","utf8"));
  const data=domain.createCase("Synthetic large case","synthetic-large-id","2026-10-27");
  sqlite.prepare("INSERT INTO cases (id,name,owner,revision,payload,created_at,updated_at,storage_token) VALUES (?,?,?,?,?,?,?,?)").run(data.context.id,data.context.caseName,"synthetic",data.context.revision,JSON.stringify(data),"x","x",crypto.randomUUID());
  const objects=new Map<string,Uint8Array>(),bucket={async put(key:string,value:Uint8Array){objects.set(key,new Uint8Array(value));},async get(key:string){const bytes=objects.get(key);return bytes?{arrayBuffer:async()=>bytes.slice().buffer}:null;},async delete(key:string){objects.delete(key);}};
  const db={
    async batch(commands:Array<{runNow:()=>{meta:{changes:number}}}>){sqlite.exec("BEGIN");try{const results=commands.map(command=>command.runNow());sqlite.exec("COMMIT");return results;}catch(error){sqlite.exec("ROLLBACK");throw error;}},
    prepare(sql:string){
      return {bind(...params:SQLInputValue[]){
        return {
          async first(){return sqlite.prepare(sql).get(...params)??null;},
          async run(){const result=sqlite.prepare(sql).run(...params);return {meta:{changes:Number(result.changes)}};},
          runNow(){const result=sqlite.prepare(sql).run(...params);return {meta:{changes:Number(result.changes)}};},
        };
      }};
    },
  };
  const store=load<{getCase(id:string):Promise<domain.CaseData>;saveCase(data:domain.CaseData,revision:number,previous:domain.CaseData):Promise<void>}> ("lib/server-store.ts",{"cloudflare:workers":{env:{DB:db,BUCKET:bucket}},"../app/chatgpt-auth":{getChatGPTUser:async()=>null},"./domain":domain,"./processing-readiness":readiness,"./execution-catalog.ts":{EXECUTION_CONTRACT_VERSION},"./reactive-evaluation.ts":reactiveEvaluation,"./calculator-tools.ts":{snapshotSha256}});
  return {sqlite,data,objects,store};
}
const enlarged=(data:domain.CaseData,marker="z")=>({...data,syntheticAuditTrail:marker.repeat(2_100_000)}) as domain.CaseData;

test("2MB 초과 사건은 D1에 pointer만 두고 R2에서 hash 검증 후 읽는다",async()=>{
  const h=setup(),old=await h.store.getCase(h.data.context.id),large=enlarged(old);await h.store.saveCase(large,old.context.revision,old);
  const row=h.sqlite.prepare("SELECT payload,revision FROM cases WHERE id = ?").get(h.data.context.id) as {payload:string;revision:number};
  assert.ok(new TextEncoder().encode(row.payload).byteLength<500_000);const pointer=JSON.parse(row.payload);assert.equal(pointer._storage,"r2-case-v1");assert.match(pointer.key,new RegExp(`^cases/${h.data.context.id}/state/`));assert.equal([...h.objects.keys()].filter(key=>key.includes("/state/")).length,1);
  assert.equal((await h.store.getCase(h.data.context.id) as unknown as {syntheticAuditTrail:string}).syntheticAuditTrail.length,2_100_000);h.sqlite.close();
});
test("동일 revision stale CAS 경쟁은 승자 포인터만 남기고 패자 R2 객체를 지운다",async()=>{
  const h=setup(),a=await h.store.getCase(h.data.context.id),b=await h.store.getCase(h.data.context.id),first=enlarged(a,"a"),second=enlarged(b,"b");
  const results=await Promise.allSettled([h.store.saveCase(first,a.context.revision,a),h.store.saveCase(second,b.context.revision,b)]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.equal([...h.objects.keys()].filter(key=>key.includes("/state/")).length,1);
  const saved=await h.store.getCase(h.data.context.id);assert.ok(["a","b"].includes((saved as unknown as {syntheticAuditTrail:string}).syntheticAuditTrail[0]));h.sqlite.close();
});
test("다른 사건의 R2 pointer를 참조하는 경우 거부한다",async()=>{
  const h=setup(),bytes=new TextEncoder().encode(JSON.stringify(h.data)),key=`cases/other-case/state/${crypto.randomUUID()}.json`;
  await h.store.getCase(h.data.context.id);h.objects.set(key,bytes);
  const hash=await crypto.subtle.digest("SHA-256",bytes),sha256=Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");
  h.sqlite.prepare("UPDATE cases SET payload = ? WHERE id = ?").run(JSON.stringify({_storage:"r2-case-v1",caseId:"other-case",revision:h.data.context.revision,key,sha256,summary:{documents:0,facts:0,status:"needs_evidence"}}),h.data.context.id);
  await assert.rejects(h.store.getCase(h.data.context.id),{status:409});h.sqlite.close();
});
test("작은 inline payload는 기존 D1 형식과 호환된다",async()=>{const h=setup();assert.equal((await h.store.getCase(h.data.context.id)).context.id,h.data.context.id);assert.equal(h.objects.size,0);h.sqlite.close();});
