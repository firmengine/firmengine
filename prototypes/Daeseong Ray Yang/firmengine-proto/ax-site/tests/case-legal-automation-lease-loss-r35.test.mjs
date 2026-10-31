/** A4 r35 / r44: execute the actual legal processJob catch body with D1 receipt stubs.
 * Synthetic-only. Batch atomicity and transaction behavior require Cloudflare staging.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../lib/case-legal-automation.ts",import.meta.url),"utf8");
const marker="}catch(error){\n  const code=safeCode(error),stale=";
const start=source.indexOf(marker);
const end=source.indexOf("\n }\n}\nexport async function drainCaseLegalAutomation",start);
assert.ok(start>=0&&end>start,"production catch body must be uniquely available");
assert.equal(source.indexOf(marker,start+marker.length),-1);
const body=source.slice(start+"}catch(error){".length,end).replace(/ as const\b/g,"")
 .replace("let receipts:Array<{meta?:{changes?:number}}>;","let receipts;");
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const handleFailure=new AsyncFunction("error","database","job","lease","safeCode",
 "RETRIES","later","clock","note",body);

async function synthetic({changes=1,audit=1,attempts=1,err="LEGAL_SYNTHETIC_503",batchThrows=false}={}){
 const prepared=[],batched=[];
 const db={
  prepare(sql){return {bind(...args){const statement={sql,args};prepared.push(statement);return statement;}}},
  async batch(statements){
   batched.push(statements);
   if(batchThrows)throw new Error("503 PRIVATE_TOKEN");
   return [{meta:changes===undefined?{}:{changes}},
    {meta:audit===undefined?{}:{changes:audit}}];
  }
 };
 let observed,returned;
 try{returned=await handleFailure(new Error(err),db,
  {caseId:"case-synthetic",id:"job-synthetic",dataVersion:1,attempts},"lease-A",
  e=>e.message,4,()=> "future-retry",()=> "2026-11-01T08:00:00.000Z",async()=>{throw Error("legacy note must not run");});
  observed=returned.status;
 }catch(e){observed=e.message;}
 assert.equal(prepared.length,2);
 assert.equal(batched.length,1);
 assert.match(prepared[0].sql,/lease_until>\?/);
 assert.match(prepared[1].sql,/WHERE changes\(\)=1/);
 assert.equal(prepared[0].args.at(-3),"job-synthetic");
 assert.equal(prepared[0].args.at(-2),"lease-A");
 assert.equal(prepared[1].args[1],"job-synthetic");
 assert.ok(!observed.includes("PRIVATE_TOKEN"));
 return {observed,returned,prepared};
}
for(const [name,settings,expected]of [
 ["lost lease", {changes:0}, "superseded"],
 ["owned retry", {changes:1}, "retry_wait"],
 ["owned terminal", {changes:1,attempts:4}, "failed"],
 ["owned superseded", {changes:1,err:"LEGAL_AUTOMATION_SUPERSEDED"}, "superseded"],
 ["status receipt zero", {changes:0}, "superseded"],
 ["null status change", {changes:null}, "LEGAL_AUTOMATION_FAILURE_BATCH_ACK_UNOBSERVED"],
 ["invalid status two", {changes:2}, "LEGAL_AUTOMATION_FAILURE_BATCH_ACK_UNOBSERVED"],
 ["normal audit", {changes:1,audit:1}, "retry_wait"],
 ["null audit", {changes:1,audit:null}, "LEGAL_AUTOMATION_FAILURE_AUDIT_ACK_UNOBSERVED"],
 ["zero audit", {changes:1,audit:0}, "LEGAL_AUTOMATION_FAILURE_AUDIT_ACK_UNOBSERVED"],
 ["two audit", {changes:1,audit:2}, "LEGAL_AUTOMATION_FAILURE_AUDIT_ACK_UNOBSERVED"],
 ["D1 503", {batchThrows:true}, "LEGAL_AUTOMATION_FAILURE_BATCH_ACK_UNOBSERVED"],
 ]){
 test(name,async()=>{const s=await synthetic(settings);assert.equal(s.observed,expected);
  if(settings.changes===0)assert.equal(s.returned.errorCode,"LEGAL_AUTOMATION_LEASE_LOST");
 });
}
