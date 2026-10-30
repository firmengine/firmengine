import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync,type SQLInputValue} from "node:sqlite";
import {readFileSync,readdirSync} from "node:fs";
import {createHash} from "node:crypto";
import {createCase} from "../lib/domain.ts";
import {CURRENT_RULESET,RISK_CATALOG} from "../lib/legal-rules.ts";
import {executeCaseNodes} from "../lib/case-execution.ts";
import {persistCaseCalculationFeatures} from "../lib/case-calculation-feature-store.ts";
import {drainCaseLegalAutomation,readCaseLegalAutomation,retryFailedCaseLegalAutomation,type LegalAutomationServices} from "../lib/case-legal-automation.ts";
import {listCaseLawgraphReview} from "../lib/case-lawgraph-store.ts";
import {caseDataQuietWindow,CASE_DATA_QUIET_PERIOD_MS} from "../lib/case-data-recompute.ts";
import {legalReviewInputFingerprint} from "../lib/legal-review-identity.ts";
import {EXECUTION_CONTRACT_VERSION} from "../lib/execution-catalog.ts";
import release from "../lib/reference-release.json" with {type:"json"};

function setup(){
 const sqlite=new DatabaseSync(":memory:");
 sqlite.exec("PRAGMA foreign_keys=ON");
 for(const name of readdirSync(new URL("../drizzle",import.meta.url)).filter(n=>/^\d+.*\.sql$/.test(n)).sort())
  sqlite.exec(readFileSync(new URL("../drizzle/"+name,import.meta.url),"utf8"));
 const db={prepare(sql:string){let args:SQLInputValue[]=[];const st={bind(...next:SQLInputValue[]){args=next;return st;},
  async first<T>(){return sqlite.prepare(sql).get(...args) as T??null;},
  async all<T>(){return {results:sqlite.prepare(sql).all(...args) as T[]};},
  async run(){const r=sqlite.prepare(sql).run(...args);return{meta:{changes:Number(r.changes)}};}};return st;},
  async batch(statements:Array<{run():Promise<unknown>}>){sqlite.exec("BEGIN IMMEDIATE");try{const out=[];for(const s of statements)out.push(await s.run());sqlite.exec("COMMIT");return out;}catch(e){sqlite.exec("ROLLBACK");throw e;}}} as unknown as D1Database;
 const initialize=async(caseId="auto-case")=>{
  const data=createCase("Synthetic only",caseId,"2026-10-30");
  data.context.ruleReleaseId=CURRENT_RULESET.id;
  sqlite.prepare("INSERT INTO cases(id,name,owner,revision,payload,created_at,updated_at,storage_token) VALUES(?,?,?,?,?,'at','at','token')").run(caseId,data.context.caseName,"owner",1,JSON.stringify(data));
  const version=(sqlite.prepare("SELECT data_version FROM case_data_change_state WHERE case_id=?").get(caseId) as {data_version:number}).data_version;
  const hash=createHash("sha256").update(JSON.stringify(data)).digest("hex");
  const result=await persistCaseCalculationFeatures(db,{caseId,dataVersion:version,caseRevision:1,inputSha256:hash,execution:executeCaseNodes(data)});
  return {caseId,data,version,hash,calculationRunId:result.runId};
 };
 const services=(data:ReturnType<typeof createCase>,reviewLegal:LegalAutomationServices["reviewLegal"]):LegalAutomationServices=>({
  loadCase:async()=>data,reviewLegal,processingComplete:async()=>true,
  // This mock isolates orchestration; independent source-preflight tests verify the production contract.
  sourceReadiness:async()=>({ready:true,retryable:false,status:"ready",blockers:[],nextAction:""}),
  generateDraft:async()=>{throw new Error("DOCUMENT_DRAFT_MUST_NOT_RUN_WITH_MISSING_CALCULATION");}
 });
 return {sqlite,db,initialize,services,close:()=>sqlite.close()};
}
test("ten-minute source quiet policy resumes exactly at the boundary",()=>{
 const start=Date.parse("2026-10-30T00:00:00Z");
 assert.equal(CASE_DATA_QUIET_PERIOD_MS,600_000);
 assert.equal(caseDataQuietWindow("2026-10-30T00:00:00Z",start+599999).isQuiet,false);
 assert.equal(caseDataQuietWindow("2026-10-30T00:00:00Z",start+600000).isQuiet,true);
});
test("one case-version AI batch is leased; immediate duplicate invocation never makes another API call",async()=>{
 const h=setup();try{
  const input=await h.initialize();let calls=0;
  const services=h.services(input.data,async()=>{calls++;return {stage:"legal_review",remaining:RISK_CATALOG.length-6};});
  const first=await drainCaseLegalAutomation(h.db,{caseId:input.caseId,services,limit:1});
  assert.equal(first.scanned,1);assert.equal(first.reviewing,1);assert.equal(calls,1);
  const second=await drainCaseLegalAutomation(h.db,{caseId:input.caseId,services,limit:1});
  assert.equal(second.scanned,0);assert.equal(calls,1);
  const state=await readCaseLegalAutomation(h.db,input.caseId);
  assert.equal(state.completedChecks,6);assert.equal(state.status,"pending");assert.equal(state.autoSubmission,false);
  assert.deepEqual(h.sqlite.prepare("PRAGMA foreign_key_check").all(),[]);
 }finally{h.close();}
});
test("AI source revision race is superseded and never persists a current legal head",async()=>{
 const h=setup();try{
  const input=await h.initialize();
  const services=h.services(input.data,async()=>{
   h.sqlite.prepare("UPDATE cases SET revision=revision+1 WHERE id=?").run(input.caseId);
   return {stage:"legal_review",remaining:0};
  });
  const result=await drainCaseLegalAutomation(h.db,{caseId:input.caseId,services});
  assert.equal(result.results[0].status,"superseded");
  assert.equal((await readCaseLegalAutomation(h.db,input.caseId)).status,"stale");
  assert.equal((h.sqlite.prepare("SELECT COUNT(*) AS n FROM case_legal_review_heads").get() as {n:number}).n,0);
 }finally{h.close();}
});
test("95 source-version-linked legal AI conditions persist as human-review-only LawGraph, not a false approval",async()=>{
 const h=setup();try{
  const input=await h.initialize();
  const fingerprint=await legalReviewInputFingerprint(input.data,release.sha256,EXECUTION_CONTRACT_VERSION);
  const checks=RISK_CATALOG.map(r=>({id:r.id,status:"legal_review",reason:"검토용 합성 조건",factIds:[],ruleIds:[],missingDocuments:[],nextAction:"담당자 확인"}));
  const payload={checks,summary:"Synthetic advisory; no legal approval",sourceDataVersion:input.version,reviewInputFingerprint:fingerprint,
    calculatorExecution:{inputSha256:input.hash,referenceRelease:{sha256:release.sha256},contractVersion:EXECUTION_CONTRACT_VERSION},
    model:"gpt-6-luna"};
  h.sqlite.prepare("INSERT INTO analyses(id,case_id,revision,type,payload,at) VALUES(?, ?,1,'legal_advisory',?,'2026-10-30')")
   .run("synthetic-legal-advisory",input.caseId,JSON.stringify(payload));
  const services=h.services(input.data,async()=>({stage:"legal_complete",remaining:0}));
  const result=await drainCaseLegalAutomation(h.db,{caseId:input.caseId,services});
  assert.equal(result.results[0].status,"review_required");
  const view=await listCaseLawgraphReview(h.db,{caseId:input.caseId});
  assert.equal(view.checks.length,RISK_CATALOG.length);
  assert.equal(view.complete,true);assert.equal(view.courtApprovalInferred,false);
  assert.ok(view.checks.every(c=>c.status==="legal_review"));
  assert.equal((await readCaseLegalAutomation(h.db,input.caseId)).outcome!==undefined,true);
 }finally{h.close();}
});

test("failed legal AI batches respect retry lease/backoff and require explicit operator recovery",async()=>{
 const h=setup();try{
  const input=await h.initialize();
  let calls=0;
  const services=h.services(input.data,async()=>{calls++;throw new Error("LEGAL_REVIEW_STAGE_UNEXPECTED");});
  const first=await drainCaseLegalAutomation(h.db,{caseId:input.caseId,services});
  assert.equal(first.results[0].status,"retry_wait");assert.equal(calls,1);
  assert.equal((await drainCaseLegalAutomation(h.db,{caseId:input.caseId,services})).scanned,0);
  h.sqlite.prepare("UPDATE case_legal_automation_jobs SET attempts=3,next_attempt_at='2000-01-01T00:00:00Z' WHERE case_id=?").run(input.caseId);
  const last=await drainCaseLegalAutomation(h.db,{caseId:input.caseId,services});
  assert.equal(last.results[0].status,"failed");assert.equal(calls,2);
  const recovered=await retryFailedCaseLegalAutomation(h.db,{caseId:input.caseId,expectedDataVersion:input.version});
  assert.equal(recovered.status,"retry_wait");
  const state=await readCaseLegalAutomation(h.db,input.caseId);
  assert.equal(state.status,"retry_wait");
  await assert.rejects(retryFailedCaseLegalAutomation(h.db,{caseId:input.caseId,expectedDataVersion:input.version}),/LEGAL_AUTOMATION_NO_CURRENT_FAILED_JOB/);
 }finally{h.close();}
});
test("source-only DB change invalidates calculator/legal head without treating prior review as current",async()=>{
 const h=setup();try{
  const input=await h.initialize();
  const services=h.services(input.data,async()=>({stage:"legal_review",remaining:89}));
  await drainCaseLegalAutomation(h.db,{caseId:input.caseId,services});
  const prior=await readCaseLegalAutomation(h.db,input.caseId);
  h.sqlite.prepare("UPDATE case_data_change_state SET data_version=data_version+1 WHERE case_id=?").run(input.caseId);
  const after=await readCaseLegalAutomation(h.db,input.caseId);
  assert.equal(prior.status,"pending");
  assert.ok(["debouncing","waiting_for_calculation"].includes(after.status));
  assert.equal((await drainCaseLegalAutomation(h.db,{caseId:input.caseId,services})).scanned,0);
 }finally{h.close();}
});

test("direct source case-payload rewrite without revision still increments SQL source change version",async()=>{
 const h=setup();try{
  const input=await h.initialize();
  const before=(h.sqlite.prepare("SELECT data_version AS v FROM case_data_change_state WHERE case_id=?").get(input.caseId) as {v:number}).v;
  h.sqlite.prepare("UPDATE cases SET payload=? WHERE id=?").run(JSON.stringify({...input.data,context:{...input.data.context,caseName:"Updated directly"}}),input.caseId);
  const after=(h.sqlite.prepare("SELECT data_version AS v FROM case_data_change_state WHERE case_id=?").get(input.caseId) as {v:number}).v;
  assert.equal(after,before+1);
  assert.ok(["debouncing","waiting_for_calculation"].includes((await readCaseLegalAutomation(h.db,input.caseId)).status));
 }finally{h.close();}
});

test("OCR still processing causes a durable wait without spending an AI call",async()=>{
 const h=setup();try{
  const input=await h.initialize();let modelCalls=0;
  const services=h.services(input.data,async()=>{modelCalls++;return{stage:"legal_review",remaining:89};});
  services.sourceReadiness=async()=>({ready:false,retryable:true,status:"waiting_evidence",
    blockers:["SOURCE_PAGE_VERIFICATION_PENDING"],nextAction:"verify source"});
  const a=await drainCaseLegalAutomation(h.db,{caseId:input.caseId,services});
  assert.equal(a.results[0].status,"waiting_evidence");
  assert.equal(modelCalls,0);
  assert.equal((await drainCaseLegalAutomation(h.db,{caseId:input.caseId,services})).scanned,0);
  assert.equal((await readCaseLegalAutomation(h.db,input.caseId)).status,"waiting_evidence");
  h.sqlite.prepare("UPDATE case_legal_automation_jobs SET next_attempt_at='2000-01-01T00:00:00Z' WHERE case_id=?").run(input.caseId);
  services.sourceReadiness=async()=>({ready:true,retryable:false,status:"ready",blockers:[],nextAction:""});
  const b=await drainCaseLegalAutomation(h.db,{caseId:input.caseId,services});
  assert.equal(b.results[0].status,"reviewing");
  assert.equal(modelCalls,1);
 }finally{h.close();}
});
test("untraceable source snapshot is a legal review blocker and cannot be auto-retried forever",async()=>{
 const h=setup();try{
  const input=await h.initialize();let modelCalls=0;
  const services=h.services(input.data,async()=>{modelCalls++;return {stage:"legal_complete",remaining:0};});
  services.sourceReadiness=async()=>({ready:false,retryable:false,status:"review_required",
   blockers:["NORMALIZED_SOURCE_FALLBACK_UNVERIFIED"],nextAction:"recheck OCR"});
  const a=await drainCaseLegalAutomation(h.db,{caseId:input.caseId,services});
  assert.equal(a.results[0].status,"review_required");
  assert.equal(modelCalls,0);
  assert.equal((await drainCaseLegalAutomation(h.db,{caseId:input.caseId,services})).scanned,0);
 }finally{h.close();}
});
