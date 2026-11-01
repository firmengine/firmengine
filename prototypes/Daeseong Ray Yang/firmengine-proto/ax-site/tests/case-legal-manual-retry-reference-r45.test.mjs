/** A4 r45 Draft PR-only: source-extracted legal retry active-reference guard.
 * Synthetic D1 ACKs; this test is NOT Cloudflare D1, model, court, or approval evidence.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const src=readFileSync(new URL("../lib/case-legal-automation.ts",import.meta.url),"utf8");
const begin=src.indexOf("export async function retryFailedCaseLegalAutomation(");
const end=src.indexOf("export async function readCaseLegalAutomation(",begin);
assert.ok(begin>=0&&end>begin,"legal retry function must exist");
let region=src.slice(begin,end);
assert.match(region,/LEGAL_AUTOMATION_RETRY_STALE_REFERENCE/);
region=region
 .replace("export async function retryFailedCaseLegalAutomation(database:D1Database,input:{caseId:string;expectedDataVersion:number})",
  "async function retryFailedCaseLegalAutomation(database,input)")
 .replace(/\.first<\{[^>]+\}>\(\)/g,".first()")
 .replace("let receipts:Array<{meta?:{changes?:number}}>;","let receipts;");
const make=new Function("latest","referenceIdentity","referenceRelease",
 "projectionRepairRequired","decode","clock",
 region+"\nreturn retryFailedCaseLegalAutomation;");

const version={caseId:"synthetic-case",caseRevision:1,dataVersion:1,
 calculationRunId:"synthetic-calc",inputSha256:"synthetic-input",referenceSha256:"reference-A"};
const job={id:"synthetic-job",status:"failed",attempts:2,dataVersion:1,caseRevision:1,
 calculationRunId:"synthetic-calc",legalReviewRunId:null,outcomeJson:"{}"};

async function execute(current,activeReference,row){
 let writes=0,reads=0;
 const database={
  prepare(){return {bind(){return {async first(){reads++;return row;}}}};},
  async batch(){writes++;return [{meta:{changes:1}},{meta:{changes:1}}];}
 };
 const handler=make(async()=>current,()=>({sha256:activeReference}),
  {sha256:"reference-default"},()=>false,x=>JSON.parse(x||"{}"),
  ()=>new Date("2026-11-01T00:45:00Z").toISOString());
 try{
  const value=await handler(database,{caseId:"synthetic-case",expectedDataVersion:1});
  return {value,writes,reads};
 }catch(error){return {error:error.message,writes,reads};}
}

test("active reference B rejects stale calculation/job reference A before any DB write",async()=>{
 const r=await execute(version,"reference-B",job);
 assert.equal(r.error,"LEGAL_AUTOMATION_RETRY_STALE_REFERENCE");
 assert.equal(r.writes,0);
 assert.equal(r.reads,0);
});
test("matching active reference A preserves a permitted manual retry",async()=>{
 const r=await execute(version,"reference-A",job);
 assert.equal(r.value?.status,"retry_wait");
 assert.equal(r.value?.automaticCourtApproval,false);
 assert.equal(r.writes,1);
});
test("stale dataVersion is rejected before any DB write",async()=>{
 const r=await execute({...version,dataVersion:2},"reference-A",job);
 assert.equal(r.error,"LEGAL_AUTOMATION_RETRY_STALE_VERSION");
 assert.equal(r.writes,0);
});
test("missing current calculation head is not accepted",async()=>{
 const r=await execute(null,"reference-A",job);
 assert.equal(r.error,"LEGAL_AUTOMATION_RETRY_STALE_VERSION");
 assert.equal(r.writes,0);
});
test("missing failed job cannot be promoted to due queue",async()=>{
 const r=await execute(version,"reference-A",null);
 assert.equal(r.error,"LEGAL_AUTOMATION_NO_CURRENT_FAILED_JOB");
 assert.equal(r.writes,0);
});