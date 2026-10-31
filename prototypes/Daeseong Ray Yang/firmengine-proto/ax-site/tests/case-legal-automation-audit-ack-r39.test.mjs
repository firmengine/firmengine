/** A4 r39. Source-extracted legal state CAS/audit receipt test. Synthetic-only, no D1/R2/LLM or legal approval. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../lib/case-legal-automation.ts",import.meta.url),"utf8");
const start=source.indexOf("async function note(");
const end=source.indexOf("async function gatherChecks(",start);
assert.ok(start>=0&&end>start,"production note/transition source must be available");
const body=source.slice(start,end)
 .replace("async function note(database:D1Database,job:Job,kind:string,value:unknown)","async function note(database,job,kind,value)")
 .replace(/async function transition\\(database:D1Database,job:Job,lease:string,status:string,fields:\\{[\\s\\S]*?\\}=\\{\\}\\)/,"async function transition(database,job,lease,status,fields={})");
const compiled=new Function("clock","decode",body+"\\nreturn {note,transition};")(
 ()=>"2026-11-01T00:00:00.000Z",(raw,fallback)=>{try{return JSON.parse(raw)}catch{return fallback}});
const job={id:"synthetic-job",caseId:"synthetic-case",dataVersion:1,caseRevision:1,calculationRunId:"synthetic-run",
 inputSha256:"a".repeat(64),completedChecks:0,expectedChecks:95,outcomeJson:"{}"};
async function runScenario(updateChanges,auditChanges,noteOnly=false){
 const events=[];
 const db={prepare(sql){const kind=sql.startsWith("UPDATE")?"update":"audit";return {bind(){return {async run(){
  events.push(kind);
  if(kind==="update")return {meta:{changes:updateChanges}};
  if(auditChanges==="throw")throw new Error("D1 503 PRIVATE_TOKEN");
  if(auditChanges==="missing")return {};
  return {meta:{changes:auditChanges}};
 }}}}}};
 let observed="resolved";
 try{
  if(noteOnly)await compiled.note(db,job,"pending",{});
  else await compiled.transition(db,job,"synthetic-lease","pending",{completedChecks:1});
 }catch(error){observed=error.message}
 return {observed,events};
}
const cases=[
 ["normal audit receipt",1,1,false,"resolved","update,audit"],
 ["audit 503 after state CAS",1,"throw",false,"LEGAL_AUTOMATION_AUDIT_ACK_UNOBSERVED","update,audit"],
 ["audit INSERT changed zero rows",1,0,false,"LEGAL_AUTOMATION_AUDIT_INSERT_ZERO","update,audit"],
 ["audit null change count",1,null,false,"LEGAL_AUTOMATION_AUDIT_ACK_UNOBSERVED","update,audit"],
 ["audit unexpected 2 rows",1,2,false,"LEGAL_AUTOMATION_AUDIT_ACK_UNOBSERVED","update,audit"],
 ["audit receipt absent",1,"missing",false,"LEGAL_AUTOMATION_AUDIT_ACK_UNOBSERVED","update,audit"],
 ["state CAS zero rows",0,1,false,"LEGAL_AUTOMATION_SUPERSEDED","update"],
 ["state CAS null ack",null,1,false,"LEGAL_AUTOMATION_TRANSITION_ACK_UNOBSERVED","update"],
 ["state CAS invalid 2",2,1,false,"LEGAL_AUTOMATION_TRANSITION_ACK_UNOBSERVED","update"],
 ["direct note zero",1,0,true,"LEGAL_AUTOMATION_AUDIT_INSERT_ZERO","audit"],
 ["direct note null",1,null,true,"LEGAL_AUTOMATION_AUDIT_ACK_UNOBSERVED","audit"],
 ["direct note success",1,1,true,"resolved","audit"]
];
for(const [name,update,audit,noteOnly,expected,steps] of cases){
 test(name,async()=>{
  const result=await runScenario(update,audit,noteOnly);
  assert.equal(result.observed,expected);
  assert.equal(result.events.join(","),steps);
  assert.ok(!JSON.stringify(result).includes("PRIVATE_TOKEN"));
 });
}
test("audit uncertainty is not converted to failure/retry after committed state CAS",()=>{
 assert.match(source,/\\["LEGAL_AUTOMATION_TRANSITION_ACK_UNOBSERVED","LEGAL_AUTOMATION_AUDIT_INSERT_ZERO","LEGAL_AUTOMATION_AUDIT_ACK_UNOBSERVED"\\]\\.includes\\(error\\.message\\)/);
});
