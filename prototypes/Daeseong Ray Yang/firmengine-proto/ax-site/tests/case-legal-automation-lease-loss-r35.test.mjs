/** A4 r35: source-extracted legal-worker failure acknowledgement contract.
 * Synthetic stubs only: no D1/R2, model call, legal judgment or user data.
 * The production catch body is executed directly after removing a TypeScript-only
 * "as const" assertion; no separate copy of business logic is maintained.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../lib/case-legal-automation.ts",import.meta.url),"utf8");
const marker="}catch(error){\n  const code=safeCode(error),stale=";
const start=source.indexOf(marker);
const end=source.indexOf("\n }\n}\nexport async function drainCaseLegalAutomation",start);
assert.ok(start>=0&&end>start,"production legal worker catch body must be found uniquely");
assert.equal(source.indexOf(marker,start+marker.length),-1,"only one legal worker catch body");
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const catchBody=source.slice(start+"}catch(error){".length,end).replace(/ as const\b/g,"");
const handleFailure=new AsyncFunction("error","database","job","lease","safeCode",
  "RETRIES","later","clock","note",catchBody);

async function syntheticAttempt({changes,attempts=1,errorCode="LEGAL_SYNTHETIC_503"}){
  const audits=[];
  const statements=[];
  const database={prepare(sql){
    statements.push(sql);
    return {bind(...args){
      assert.equal(args.at(-2),"job-synthetic");
      assert.equal(args.at(-1),"lease-A");
      return {async run(){return {meta:changes===undefined?{}:{changes}};}};
    }};
  }};
  const args=[new Error(errorCode),database,
    {caseId:"case-synthetic",id:"job-synthetic",attempts},"lease-A",
    (e)=>e.message,4,()=> "future-retry",()=> "synthetic-now",
    async (_job,kind,payload)=>audits.push({kind,payload})];
  let value=null,failure=null;
  try{value=await handleFailure(...args);}catch(error){failure=error;}
  assert.equal(statements.length,1);
  assert.match(statements[0],/WHERE id=\? AND lease_token=\? AND status='running'/);
  return {value,failure,audits};
}

const cases=[
 ["replaced worker cannot report retry_wait",0,1,"LEGAL_SYNTHETIC_503","superseded",0],
 ["replaced worker cannot report failed",0,4,"LEGAL_SYNTHETIC_429","superseded",0],
 ["replaced worker cannot issue a false superseded audit event",0,2,"LEGAL_AUTOMATION_SUPERSEDED","superseded",0],
 ["owned retry still records once",1,1,"LEGAL_SYNTHETIC_TIMEOUT","retry_wait",1],
 ["owned terminal failure still records once",1,4,"LEGAL_SYNTHETIC_503","failed",1],
 ["owned stale transition still records once",1,1,"LEGAL_AUTOMATION_SUPERSEDED","superseded",1]
];
for(const [name,changes,attempts,errorCode,status,auditCount] of cases){
 test(name,async()=>{
  const result=await syntheticAttempt({changes,attempts,errorCode});
  assert.equal(result.failure,null);
  assert.equal(result.value.status,status);
  assert.equal(result.audits.length,auditCount);
  if(changes===0){
   assert.equal(result.value.errorCode,"LEGAL_AUTOMATION_LEASE_LOST");
   assert.equal(result.value.retryAfter,null);
  }else assert.equal(result.audits[0].kind,status);
 });
}
for(const [name,changes] of [["missing response changes",undefined],["null response changes",null],["invalid multiple-row response",2]]){
 test(name+" remains unobserved, not a committed status",async()=>{
  const result=await syntheticAttempt({changes});
  assert.equal(result.value,null);
  assert.equal(result.failure?.message,"LEGAL_AUTOMATION_FAILURE_ACK_UNOBSERVED");
  assert.equal(result.audits.length,0);
 });
}
