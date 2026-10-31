/** A4 r38: source-extracted drain loop only. No D1/R2, client data, AI calls or legal approval. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../lib/case-legal-automation.ts",import.meta.url),"utf8");
const begin=source.indexOf(' const results=[];\n for(const c of candidates)');
const end=source.indexOf('\n}\n/** Explicit operator recovery',begin);
assert.ok(begin>=0&&end>begin,"exact production drain loop must remain extractable");
const body=source.slice(begin,end);
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const production=new AsyncFunction("candidates","processJob","database","input","safeCode",body);
const safeMatch=source.match(/const safeCode=\(e:unknown\)=>[^\n]+;/);
assert.ok(safeMatch,"production safeCode sanitizer missing");
const safeCode=new Function(safeMatch[0].replace("(e:unknown)","(e)")+"\nreturn safeCode;")();

async function inspect(ids,entries){
 const seen=[],calls=new Map();
 const processJob=async(_db,c)=>{
  seen.push(c.caseId);calls.set(c.caseId,(calls.get(c.caseId)??0)+1);
  const value=entries[c.caseId];
  if(value instanceof Error)throw value;
  return {caseId:c.caseId,...value};
 };
 const result=await production(ids.map(caseId=>({caseId})),processJob,{}, {services:{}},safeCode);
 assert.deepEqual(seen,ids,"error in one case must not prevent later candidates");
 assert.ok([...calls.values()].every(n=>n===1),"drain must never replay an uncertain case in-place");
 assert.equal(result.results.length,ids.length);
 return result;
}
const legal=code=>new Error(code);
for(const [title,ids,values,expected] of [
 ["transition ACK lost; next case continues",["a","b"],{a:legal("LEGAL_AUTOMATION_TRANSITION_ACK_UNOBSERVED"),b:{status:"reviewing"}},{unobserved:1,reviewing:1,draftReady:0,attention:0}],
 ["claim ACK lost; next case continues",["a","b"],{a:legal("LEGAL_AUTOMATION_CLAIM_ACK_UNOBSERVED"),b:{status:"draft_ready"}},{unobserved:1,reviewing:0,draftReady:1,attention:0}],
 ["failure ACK lost; no false failed state",["a","b"],{a:legal("LEGAL_AUTOMATION_FAILURE_ACK_UNOBSERVED"),b:{status:"review_required"}},{unobserved:1,reviewing:0,draftReady:0,attention:1}],
 ["retry ACK lost; next case continues",["a","b"],{a:legal("LEGAL_AUTOMATION_RETRY_ACK_UNOBSERVED"),b:{status:"reviewing"}},{unobserved:1,reviewing:1,draftReady:0,attention:0}],
 ["audit event 503 after state commit",["a","b"],{a:new Error("D1 503 private-secret"),b:{status:"reviewing"}},{unobserved:1,reviewing:1,draftReady:0,attention:0}],
 ["model 429 generic message",["a","b"],{a:new Error("429 model key private-secret"),b:{status:"draft_ready"}},{unobserved:1,reviewing:0,draftReady:1,attention:0}],
 ["model timeout generic message",["a","b"],{a:new Error("ETIMEDOUT private-secret"),b:{status:"reviewing"}},{unobserved:1,reviewing:1,draftReady:0,attention:0}],
 ["multiple failures independently observed",["a","b"],{a:legal("LEGAL_AUTOMATION_CLAIM_ACK_UNOBSERVED"),b:legal("LEGAL_AUTOMATION_FAILURE_ACK_UNOBSERVED")},{unobserved:2,reviewing:0,draftReady:0,attention:0}],
 ["mixed normal statuses keep counts",["a","b","c"],{a:{status:"reviewing"},b:{status:"failed"},c:{status:"draft_ready"}},{unobserved:0,reviewing:1,draftReady:1,attention:1}],
 ["no candidates",[],{},{unobserved:0,reviewing:0,draftReady:0,attention:0}],
 ["single success remains unchanged",["a"],{a:{status:"reviewing"}},{unobserved:0,reviewing:1,draftReady:0,attention:0}],
 ["invalid non-Legal error is sanitized",["a"],{a:new Error("https://internal.invalid?token=private-secret")},{unobserved:1,reviewing:0,draftReady:0,attention:0}]
]){
 test(title,async()=>{
  const result=await inspect(ids,values);
  assert.equal(result.scanned,ids.length);
  for(const [field,value]of Object.entries(expected))assert.equal(result[field],value,field);
  assert.ok(!JSON.stringify(result).includes("private-secret"),"raw exception message must not leak");
  for(const row of result.results.filter(r=>r.status==="unobserved")){
   assert.equal(row.persistence,"unobserved");
   assert.equal(row.needsReconciliation,true);
   assert.ok(/^LEGAL_[A-Z0-9_]+$/.test(row.errorCode));
   assert.notEqual(row.status,"failed");
  }
 });
}
