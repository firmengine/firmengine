/** A4 r89 independent negative-control audit: event write vs document registration. This is NOT a product safety pass.
 * Execute explicitly with node --test <this file>; the default is current main baseline.
 * Candidate #201 comparison requires A4_EXPECT_BASELINE=0 and A4_POST_ROUTE_PATH.
 * Based on the r88 POST body harness; synthetic D1 adapters only.
 */
/** A4 r88: executes the actual document-registration POST function body after
 * removing its TypeScript signature/imports and supplying synthetic in-memory
 * D1/R2 adapters. Does not execute Next runtime, Cloudflare D1/R2 or secrets.
 * The project version reads ../app/api/cases/[id]/documents/route.ts.
 * To run against an isolated candidate file, set A4_POST_ROUTE_PATH.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
const path=process.env.A4_POST_ROUTE_PATH||resolve(dirname(fileURLToPath(import.meta.url)),'../../../app/api/cases/[id]/documents/route.ts');
const code=readFileSync(path,'utf8').replace(/^import .*;\s*$/gm,'').replace('export async function POST(request:Request,{params}:{params:Promise<{id:string}>})','async function POST(request,{params})');
if(!code.includes('async function POST(request,{params})'))throw new Error('route function shape changed; inspect source');
const baseline=process.env.A4_EXPECT_BASELINE!=='0';
const sha='a'.repeat(64);
function harness(scenario){
 const state={caseData:{context:{id:'SYNTH-CASE',revision:0},documents:[],pages:[]},docs:new Map(),jobs:new Map(),r2:new Set(),events:[]};
 const db=()=>({prepare(sql){let values=[];const stmt={sql,bind(...args){values=args;return stmt;},async run(){let changes=0;
 if(sql.startsWith('INSERT INTO documents')){const [docId,caseId,name,hash,pageCount]=values;state.docs.set(docId,{id:docId,caseId,name,sha256:hash,pageCount,ready:0,originalKey:null});changes=1}
 else if(sql.startsWith('INSERT INTO page_jobs')){const [jobId,caseId,docId,page]=values;state.jobs.set(jobId,{caseId,docId,page});changes=1}
 else if(sql.startsWith('DELETE FROM page_jobs')){const [docId,caseId]=values;for(const [id,j] of state.jobs)if(j.caseId===caseId&&j.docId===docId){state.jobs.delete(id);changes++}}
 else if(sql.startsWith('DELETE FROM documents')){const [docId,caseId]=values;const d=state.docs.get(docId);if(d?.caseId===caseId&&d.ready===0){state.docs.delete(docId);changes=1}}
 else throw new Error('UNHANDLED_SQL:'+sql);
 return {meta:{changes}}}};return stmt;},async batch(stmts){const out=[];for(const s of stmts){out.push(await s.run());if(scenario==='page-batch-error'&&s.sql.startsWith('INSERT INTO page_jobs')&&!state.pageBatchErrorRaised){state.pageBatchErrorRaised=true;throw new Error('PAGE_BATCH_FAIL')}}return out;}});
 const ctx={db,crypto:{randomUUID},Response,now:()=>new Date('2026-11-03T04:40:00+09:00').toISOString(),
 touchCase:(c)=>{const n=structuredClone(c);n.context.revision++;return n},
 samplePageRole:(_,page)=>({page,role:'evidence',documentType:null}),SAMPLE_SHA256:'0'.repeat(64),
 getCase:async()=>structuredClone(state.caseData),jsonBody:async(request)=>request.json(),requireSameOrigin:()=>{},
 async saveCase(n){if(scenario==='no-commit')throw new Error('SAVE_CASE_PRECOMMIT_FAIL');
  state.caseData=structuredClone(n);
  if(scenario==='postcommit-r2-ready'){
   const d=[...state.docs.values()][0];assert.ok(d);d.ready=1;d.originalKey='cases/SYNTH-CASE/documents/'+d.id+'/original/synthetic';state.r2.add(d.originalKey);
  }
  if(scenario.startsWith('postcommit'))throw new Error('SAVE_CASE_COMMITTED_POSTCOMMIT_FAIL');
  return {saved:true};},
 async event(id,type,detail){if(scenario==='event-precommit-503')throw new Error('EVENT_D1_503_BEFORE_COMMIT');state.events.push({id,type,detail});if(scenario==='event-ack-lost')throw new Error('EVENT_D1_ACK_LOST_AFTER_COMMIT');},
 errorResponse:e=>Response.json({error:e.message},{status:500}),HttpError:class HttpError extends Error{constructor(status,msg){super(msg);this.status=status}}};
 const POST=vm.runInNewContext(code+'; POST',ctx);
 const request=()=>new Request('https://example.invalid/api/cases/SYNTH-CASE/documents',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sha256:sha,pageCount:2,name:'synthetic-document.pdf'})});
 return {POST,state,request,call:async()=>POST(request(),{params:Promise.resolve({id:'SYNTH-CASE'})})};
}
test('source-level route normal upload: 1 registered SQL doc, two OCR jobs, one event',async()=>{const h=harness('normal');const r=await h.call();assert.equal(r.status,201);assert.deepEqual([h.state.docs.size,h.state.jobs.size,h.state.events.length,h.state.caseData.documents.length],[1,2,1,1])});
test('source-level route pre-saveCase page batch error cleans SQL doc and partial page jobs',async()=>{const h=harness('page-batch-error');const r=await h.call();assert.equal(r.status,500);assert.deepEqual([h.state.docs.size,h.state.jobs.size,h.state.caseData.documents.length],[0,0,0])});
test('saveCase definite precommit rejection is conservatively retained by candidate (cleanup unresolved)',async()=>{const h=harness('no-commit');const r=await h.call();assert.equal(r.status,500);assert.equal(h.state.caseData.documents.length,0);assert.equal(h.state.docs.size,baseline?0:1);assert.equal(h.state.jobs.size,baseline?0:2)});
test('source-level route postcommit failure must preserve committed SQL doc and all OCR jobs',async()=>{const h=harness('postcommit');const r=await h.call();assert.equal(r.status,500);assert.equal(h.state.caseData.documents.length,1);assert.equal(h.state.docs.size,baseline?0:1);assert.equal(h.state.jobs.size,baseline?0:2)});
test('source-level route B original upload before A postcommit failure must preserve ready=1 document and OCR jobs',async()=>{const h=harness('postcommit-r2-ready');const r=await h.call();assert.equal(r.status,500);assert.equal(h.state.docs.size,1);assert.equal([...h.state.docs.values()][0].ready,1);assert.equal(h.state.r2.size,1);assert.equal(h.state.jobs.size,baseline?0:2)});
test('idempotent subsequent POST cannot repair deleted jobs in old route but candidate retains them',async()=>{const h=harness('postcommit-r2-ready');await h.call();const next=await h.call();assert.equal(next.status,200);const j=await next.json();assert.equal(j.idempotent,true);assert.equal(h.state.jobs.size,baseline?0:2)});

test('r89 NEGATIVE CONTROL: event D1 503 after case save returns 500; document, jobs survive; event missing',async()=>{
 const h=harness('event-precommit-503'),r=await h.call();assert.equal(r.status,500);
 assert.deepEqual([h.state.caseData.documents.length,h.state.docs.size,h.state.jobs.size,h.state.events.length],[1,1,2,0]);
});
test('r89 NEGATIVE CONTROL: same SHA registration retry after audit 503 returns 200 without recreating event',async()=>{
 const h=harness('event-precommit-503'),first=await h.call(),again=await h.call(),body=await again.json();
 assert.equal(first.status,500);assert.equal(again.status,200);assert.equal(body.idempotent,true);
 assert.deepEqual([h.state.caseData.documents.length,h.state.docs.size,h.state.jobs.size,h.state.events.length],[1,1,2,0]);
});
test('r89 NEGATIVE CONTROL: audit INSERT committed but ACK lost returns 500 with one persisted event',async()=>{
 const h=harness('event-ack-lost'),first=await h.call(),second=await h.call();
 assert.equal(first.status,500);assert.equal(second.status,200);
 assert.deepEqual([h.state.caseData.documents.length,h.state.docs.size,h.state.jobs.size,h.state.events.length],[1,1,2,1]);
});
test('r89: distinguish audit row zero/one for identical 500 response; no legal approval inferred',async()=>{
 const missing=harness('event-precommit-503'),committed=harness('event-ack-lost');
 const first=await missing.call(),second=await committed.call();
 assert.equal(first.status,500);assert.equal(second.status,500);
 assert.equal(missing.state.events.length,0);assert.equal(committed.state.events.length,1);
});
