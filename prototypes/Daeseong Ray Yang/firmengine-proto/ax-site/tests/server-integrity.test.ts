import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as nodeCrypto from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import type { SQLInputValue } from "node:sqlite";
import ts from "typescript";
import * as domain from "../lib/domain.ts";
import * as processingReadiness from "../lib/processing-readiness.ts";
import * as jsonResponses from "../lib/json-response.ts";
import type { CaseData, ExportManifest } from "../lib/domain.ts";

const root=fileURLToPath(new URL("../",import.meta.url));
const load=<T>(path:string,mocks:Record<string,unknown>):T=>{
  const output=ts.transpileModule(readFileSync(root+path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  new Function("require","module","exports",output)((name:string)=>{if(Object.hasOwn(mocks,name))return mocks[name];throw new Error(`Unexpected dependency: ${name}`);},module,module.exports);
  return module.exports as T;
};
type Store={getCase(id:string):Promise<CaseData>;saveCase(data:CaseData,revision:number,previous:CaseData):Promise<void>;[key:string]:unknown};
type Route={PUT(request:Request,context:{params:Promise<{id:string;doc:string}>}):Promise<Response>};
type CaseRoute={PATCH(request:Request,context:{params:Promise<{id:string}>}):Promise<Response>};
const digest=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
const requiredKinds=[...domain.REQUIRED_ARTIFACT_KINDS,"repayment_schedule"] as domain.ArtifactKind[];
const manifest=(revision:number,tag:string):ExportManifest=>({caseRevision:revision,requiredKinds,files:requiredKinds.map(kind=>({id:`${tag}-${kind}`,kind,name:`${kind}.docx`,hash:`synthetic-${tag}-${kind}`,status:"current"})),reviews:{caseworker:null,lawyer:null}});

function setup(){
  const sqlite=new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(root+"drizzle/0000_chunky_cardiac.sql","utf8"));
  const data=domain.createCase("Synthetic server integrity",crypto.randomUUID(),"2026-10-27");
  data.exportManifest=manifest(data.context.revision,"old");
  // Migrate an existing row: its empty default token must still participate in CAS.
  sqlite.prepare("INSERT INTO cases (id,name,owner,revision,payload,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(data.context.id,data.context.caseName,"synthetic-owner",data.context.revision,JSON.stringify(data),"synthetic","synthetic");
  sqlite.exec(readFileSync(root+"drizzle/0001_case_storage_token.sql","utf8"));
  const objects=new Map<string,{bytes:Uint8Array;mime:string}>();
  const bucket={
    async put(key:string,value:ReadableStream<Uint8Array>|Uint8Array|ArrayBuffer,options?:{httpMetadata?:{contentType?:string}}){
      const bytes=value instanceof ReadableStream?new Uint8Array(await new Response(value).arrayBuffer()):new Uint8Array(value instanceof ArrayBuffer?value:value);
      objects.set(key,{bytes,mime:options?.httpMetadata?.contentType||"application/octet-stream"});return {};
    },
    async delete(key:string){objects.delete(key);},
  };
  const db={prepare(sql:string){return {bind(...params:SQLInputValue[]){return {
    async first(){return sqlite.prepare(sql).get(...params)??null;},
    async run(){const result=sqlite.prepare(sql).run(...params);return {meta:{changes:Number(result.changes)}};},
    async all(){return {results:sqlite.prepare(sql).all(...params)};},
  };}};},async batch(commands:Array<{run():Promise<unknown>}>){const results=[];for(const command of commands)results.push(await command.run());return results;}};
  const store=load<Store>("lib/server-store.ts",{"cloudflare:workers":{env:{DB:db,BUCKET:bucket}},"../app/chatgpt-auth":{getChatGPTUser:async()=>({userId:"synthetic-owner"})},"./domain":domain,"./processing-readiness":processingReadiness});
  return {sqlite,data,objects,store};
}

test("같은 사건 revision의 보관·검수 경합은 stale 저장을 거부한다",async()=>{
  const h=setup(),a=await h.store.getCase(h.data.context.id),b=await h.store.getCase(h.data.context.id);
  const archived=domain.archiveExport(a,a.exportManifest!.files[0].id);
  const staleReview=domain.reviewExport(b,"caseworker","synthetic reviewer",domain.manifestFingerprint(b.exportManifest!));
  await h.store.saveCase(archived,a.context.revision,a);
  await assert.rejects(h.store.saveCase(staleReview,b.context.revision,b),{status:409});
  const actual=await h.store.getCase(h.data.context.id);
  assert.equal(actual.context.revision,a.context.revision);assert.equal(actual.exportManifest!.files[0].status,"archived");assert.equal(actual.exportManifest!.reviews.caseworker,null);
  h.sqlite.close();
});

test("불러온 snapshot 없이 복제한 데이터는 CAS 저장을 허가하지 않는다",async()=>{
  const h=setup(),snapshot=await h.store.getCase(h.data.context.id),clone=structuredClone(snapshot);
  await assert.rejects(h.store.saveCase(clone,clone.context.revision,clone),{status:409});
  snapshot.exportManifest=manifest(snapshot.context.revision,"new");
  await h.store.saveCase(snapshot,snapshot.context.revision,snapshot);
  assert.equal((await h.store.getCase(snapshot.context.id)).exportManifest!.files[0].id,"new-application");
  h.sqlite.close();
});

test("검수 API는 지문 누락과 재생성 전의 지문을 거부하고 현재 지문만 기록한다",async()=>{
  const h=setup(),prior=await h.store.getCase(h.data.context.id),oldFingerprint=domain.manifestFingerprint(prior.exportManifest!);
  prior.exportManifest=manifest(prior.context.revision,"new");await h.store.saveCase(prior,prior.context.revision,prior);
  const route=load<CaseRoute>("app/api/cases/[id]/route.ts",{
    "../../../../lib/domain":domain,"../../../../lib/assessment":{assessCase:()=>({generationGate:{canFinalize:true}})},"../../../../lib/legal-rules":{CURRENT_RULESET:{}},"../../../../lib/case-response":{caseResponse:async(c:CaseData)=>({case:c})},"../../../../lib/server-store":h.store,"../../../../lib/object-editor":{},"../../../../lib/sample-manifest":{samplePageRole:()=>({role:"unknown"})},"../../../../lib/context-validation":{},"../../../../lib/json-response":jsonResponses,
  });
  const request=(fingerprint?:string)=>new Request("https://synthetic.invalid/api/cases/"+prior.context.id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"review_export",role:"caseworker",revision:prior.context.revision,...(fingerprint===undefined?{}:{fingerprint})})});
  const context={params:Promise.resolve({id:prior.context.id})};
  assert.equal((await route.PATCH(request(),context)).status,400);
  assert.equal((await route.PATCH(request(oldFingerprint),context)).status,409);
  assert.equal((await h.store.getCase(prior.context.id)).exportManifest!.reviews.caseworker,null);
  const fingerprint=domain.manifestFingerprint(prior.exportManifest!);
  assert.equal((await route.PATCH(request(fingerprint),context)).status,200);
  assert.equal((await h.store.getCase(prior.context.id)).exportManifest!.reviews.caseworker!.manifestFingerprint,fingerprint);
  h.sqlite.close();
});

test("같은 내용의 반복 출력과 다른 사건 출력은 독립된 파일과 검수 manifest로 저장된다",async()=>{
  const h=setup(),second=domain.createCase("Another synthetic case",crypto.randomUUID(),"2026-10-27");
  h.sqlite.prepare("INSERT INTO cases (id,name,owner,revision,payload,created_at,updated_at,storage_token) VALUES (?,?,?,?,?,?,?,?)").run(second.context.id,second.context.caseName,"synthetic-owner",second.context.revision,JSON.stringify(second),"synthetic","synthetic",crypto.randomUUID());
  const route=load<{POST(request:Request,context:{params:Promise<{id:string}>}):Promise<Response>}>("app/api/cases/[id]/export/route.ts",{
    "../../../../../lib/assessment":{assessCase:()=>({generationGate:{canGenerateDraft:true,canFinalize:true}})},
    "../../../../../lib/exports":{newExportManifest:(revision:number,files:ExportManifest["files"])=>({...manifest(revision,"test"),files})},
    "../../../../../lib/office-writer":{writeOfficePackage:async()=>[{id:"application-identical-content",kind:"application",name:"synthetic.docx",mime:"application/octet-stream",hash:"same-content-hash",bytes:new TextEncoder().encode("Identical synthetic content")}]},
    "../../../../../lib/legal-rules":{CURRENT_RULESET:{}},
    "../../../../../lib/server-store":h.store,
    "../../../../../lib/case-response":{caseResponse:async(c:CaseData)=>({case:c})},
    "../../../../../lib/json-response":jsonResponses,
  });
  const generate=(id:string)=>route.POST(new Request(`https://synthetic.invalid/api/cases/${id}/export`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"draft"})}),{params:Promise.resolve({id})});
  assert.equal((await generate(h.data.context.id)).status,200);
  const first=(await h.store.getCase(h.data.context.id)).exportManifest!.files[0].id;
  assert.equal((await generate(h.data.context.id)).status,200);
  const repeated=(await h.store.getCase(h.data.context.id)).exportManifest!.files[0].id;
  assert.equal((await generate(second.context.id)).status,200);
  const other=(await h.store.getCase(second.context.id)).exportManifest!.files[0].id;
  assert.equal(new Set([first,repeated,other]).size,3);
  assert.equal(h.sqlite.prepare("SELECT COUNT(*) AS n FROM artifacts").get()!.n,3);
  assert.equal(h.objects.size,3);
  assert.equal((await h.store.getCase(h.data.context.id)).exportManifest!.reviews.caseworker,null);
  h.sqlite.close();
});

// Cloudflare's fixed-length stream is represented by an in-memory stream here;
// the route's explicit byte-length check remains active in these synthetic tests.
Reflect.set(globalThis,"FixedLengthStream",class {readable:ReadableStream;writable:WritableStream;constructor(){const stream=new TransformStream();this.readable=stream.readable;this.writable=stream.writable;}});
function documentSetup(ready:boolean){
  const h=setup(),bytes=new TextEncoder().encode("Synthetic immutable original"),hash=digest(bytes),doc="synthetic-doc",originalKey=`cases/${h.data.context.id}/documents/${doc}/original/existing`;
  h.data.documents=[{id:doc,name:"synthetic.pdf",sha256:hash,status:"active",pages:[1]}];h.data.pages=[{documentId:doc,page:1,role:"evidence"}];
  h.sqlite.prepare("UPDATE cases SET payload = ? WHERE id = ?").run(JSON.stringify(h.data),h.data.context.id);
  h.sqlite.prepare("INSERT INTO documents (id,case_id,name,sha256,page_count,original_key,ready,created_at) VALUES (?,?,?,?,?,?,?,?)").run(doc,h.data.context.id,"synthetic.pdf",hash,1,ready?originalKey:null,ready?1:0,"synthetic");
  if(ready)h.objects.set(originalKey,{bytes,mime:"application/pdf"});
  const route=load<Route>("app/api/cases/[id]/documents/[doc]/route.ts",{"node:crypto":nodeCrypto,"../../../../../../lib/server-store":h.store,"../../../../../../lib/sample-manifest":{samplePageRole:()=>({role:"unknown"})}});
  const put=(body:Uint8Array)=>route.PUT(new Request(`https://synthetic.invalid/api/cases/${h.data.context.id}/documents/${doc}?kind=original`,{method:"PUT",headers:{"Content-Type":"application/pdf","Content-Length":String(body.byteLength)},body:new Uint8Array(body)}),{params:Promise.resolve({id:h.data.context.id,doc})});
  return {...h,bytes,doc,originalKey,put};
}

test("해시가 다른 원본 재전송은 기존 객체·ready 상태를 손상하지 않는다",async()=>{
  const h=documentSetup(true),response=await h.put(new TextEncoder().encode("Synthetic wrong original"));
  assert.equal(response.status,422);assert.deepEqual(h.objects.get(h.originalKey)!.bytes,h.bytes);assert.equal(h.objects.size,1);
  const row=h.sqlite.prepare("SELECT original_key,ready FROM documents WHERE id = ?").get(h.doc)!;assert.equal(row.ready,1);assert.equal(row.original_key,h.originalKey);
  h.sqlite.close();
});

test("같은 원본의 재전송은 idempotent이며 기존 key를 유지한다",async()=>{
  const h=documentSetup(true),response=await h.put(h.bytes);
  assert.equal(response.status,200);assert.equal((await response.json() as {idempotent?:boolean}).idempotent,true);assert.equal(h.objects.size,1);assert.deepEqual(h.objects.get(h.originalKey)!.bytes,h.bytes);
  assert.equal(h.sqlite.prepare("SELECT original_key FROM documents WHERE id = ?").get(h.doc)!.original_key,h.originalKey);
  h.sqlite.close();
});

test("동시에 도착한 같은 원본 중 하나만 등록하고 나머지 staging 객체는 제거한다",async()=>{
  const h=documentSetup(false),responses=await Promise.all([h.put(h.bytes),h.put(h.bytes)]);
  assert.ok(responses.every(r=>r.status===200));const bodies=await Promise.all(responses.map(r=>r.json() as Promise<{idempotent?:boolean}>));assert.equal(bodies.filter(b=>b.idempotent).length,1);
  const row=h.sqlite.prepare("SELECT original_key,ready FROM documents WHERE id = ?").get(h.doc)!;assert.equal(row.ready,1);assert.equal(h.objects.size,1);assert.deepEqual(h.objects.get(String(row.original_key))!.bytes,h.bytes);
  h.sqlite.close();
});

test("잘못된 최초 업로드와 정상 업로드의 경합도 정상 원본을 삭제하지 않는다",async()=>{
  const h=documentSetup(false),responses=await Promise.all([h.put(new TextEncoder().encode("Synthetic wrong bytes")),h.put(h.bytes)]);
  assert.deepEqual(responses.map(r=>r.status),[422,200]);const row=h.sqlite.prepare("SELECT original_key,ready FROM documents WHERE id = ?").get(h.doc)!;
  assert.equal(row.ready,1);assert.equal(h.objects.size,1);assert.deepEqual(h.objects.get(String(row.original_key))!.bytes,h.bytes);
  h.sqlite.close();
});
