import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync,type SQLInputValue} from "node:sqlite";
import {readFileSync,readdirSync} from "node:fs";
import {createHash} from "node:crypto";
import {createCase} from "../lib/domain.ts";
import {CURRENT_RULESET,RISK_CATALOG} from "../lib/legal-rules.ts";
import {executeCaseNodes} from "../lib/case-execution.ts";
import {persistCaseCalculationFeatures} from "../lib/case-calculation-feature-store.ts";
import {drainCaseLegalAutomation,readCaseLegalAutomation,type LegalAutomationServices} from "../lib/case-legal-automation.ts";
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
