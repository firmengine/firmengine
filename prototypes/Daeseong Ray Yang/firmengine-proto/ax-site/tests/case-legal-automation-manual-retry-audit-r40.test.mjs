/** FirmEngine A4 r40: manual legal retry ACK and post-CAS audit observability.
 * Source-extracted synthetic unit test; does not run Cloudflare D1, models or human approval.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../lib/case-legal-automation.ts",import.meta.url),"utf8");
const start=source.indexOf("export async function retryFailedCaseLegalAutomation");
const end=source.indexOf("export async function readCaseLegalAutomation",start);
assert.ok(start>=0&&end>start,"real manual-retry implementation must be present");
const body=source.slice(start,end)
 .replace("export async function","async function")
 .replace("database:D1Database,input:{caseId:string;expectedDataVersion:number}","database,input")
 .replace(/\.first<\{[\s\S]*?\}>\(\)/g,".first()")
 .replace("let auditChanges:unknown;","let auditChanges;");
const makeRetry=(current,projectionRepair=false)=>new Function(
 "latest","projectionRepairRequired","decode","clock",body+"\nreturn retryFailedCaseLegalAutomation;"
)(
 async()=>current,()=>projectionRepair,()=>({}),()=>"2026-11-01T04:45:00.000Z"
);
const scenarios=[
 {name:"normal failed-job manual retry",updated:1,audit:1,expected:"retry_wait",steps:"update,audit"},
 {name:"audit explicitly changed zero",updated:1,audit:0,expected:"LEGAL_AUTOMATION_AUDIT_INSERT_ZERO",steps:"update,audit"},
 {name:"audit null ACK",updated:1,audit:null,expected:"LEGAL_AUTOMATION_AUDIT_ACK_UNOBSERVED",steps:"update,audit"},
 {name:"audit result missing",updated:1,audit:"missing",expected:"LEGAL_AUTOMATION_AUDIT_ACK_UNOBSERVED",steps:"update,audit"},
 {name:"audit ACK unexpectedly two",updated:1,audit:2,expected:"LEGAL_AUTOMATION_AUDIT_ACK_UNOBSERVED",steps:"update,audit"},
 {name:"audit D1 503 exception sanitized",updated:1,audit:"throw",expected:"LEGAL_AUTOMATION_AUDIT_ACK_UNOBSERVED",steps:"update,audit"},
 {name:"retry CAS zero never inserts audit",updated:0,audit:1,expected:"LEGAL_AUTOMATION_RETRY_CONFLICT",steps:"update"},
 {name:"retry CAS null never inserts audit",updated:null,audit:1,expected:"LEGAL_AUTOMATION_RETRY_ACK_UNOBSERVED",steps:"update"},
 {name:"retry CAS two never inserts audit",updated:2,audit:1,expected:"LEGAL_AUTOMATION_RETRY_ACK_UNOBSERVED",steps:"update"},
 {name:"eligible projection rework is a human-only retry",updated:1,audit:1,status:"review_required",repair:true,expected:"retry_wait",steps:"update,audit"},
 {name:"ineligible projection rework is blocked",status:"review_required",repair:false,expected:"LEGAL_AUTOMATION_NO_CURRENT_FAILED_JOB",steps:""},
 {name:"stale data-version retry is blocked",version:2,expected:"LEGAL_AUTOMATION_RETRY_STALE_VERSION",steps:""},
 {name:"invalid retry query is blocked",caseId:"",expected:"LEGAL_AUTOMATION_RETRY_INVALID_INPUT",steps:""}
];
for(const scenario of scenarios){
 test(scenario.name,async()=>{
  const current={dataVersion:scenario.version??1,caseRevision:1,calculationRunId:"synthetic-run"};
  const row={id:"synthetic-job",status:scenario.status??"failed",caseRevision:1,
   dataVersion:current.dataVersion,calculationRunId:current.calculationRunId,
   legalReviewRunId:"synthetic-review",outcomeJson:"{}"};
  const calls=[],auditPayloads=[];
  const database={prepare(sql){
   const step=sql.startsWith("SELECT")?"select":sql.startsWith("UPDATE")?"update":"audit";
   return {bind(...args){if(step==="audit")auditPayloads.push(args[4]);return this;},
    async first(){return row;},
    async run(){
     calls.push(step);
     if(step==="update")return {meta:{changes:scenario.updated}};
     if(scenario.audit==="throw")throw new Error("D1 503 PRIVATE_KEY");
     if(scenario.audit==="missing")return {};
     return {meta:{changes:scenario.audit}};
    }};
  }};
  const retry=makeRetry(current,scenario.repair===true);
  let observed;
  try{
   const result=await retry(database,{caseId:scenario.caseId??"synthetic-case",expectedDataVersion:1});
   observed=result.status;
   assert.equal(result.automaticCourtApproval,false);
  }catch(e){observed=e.message;}
  assert.equal(observed,scenario.expected);
  assert.equal(calls.join(","),scenario.steps);
  assert.equal(observed.includes("PRIVATE_KEY"),false);
  if(auditPayloads.length){
   const payload=JSON.parse(auditPayloads[0]);
   assert.equal(payload.newStatus,"retry_wait");
   assert.equal(payload.courtApprovalInferred,false);
  }
 });
}
test("the audit receipt does not pretend to make two D1 writes atomic",()=>{
 assert.ok(source.includes("LEGAL_AUTOMATION_AUDIT_INSERT_ZERO"));
 assert.ok(source.includes("LEGAL_AUTOMATION_AUDIT_ACK_UNOBSERVED"));
 const retrySection=source.slice(start,end);
 assert.ok(retrySection.indexOf("UPDATE case_legal_automation_jobs")<
   retrySection.indexOf("INSERT INTO case_legal_automation_events"));
});
