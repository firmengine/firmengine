/** A4 r37 — actual source-extracted legal-worker D1 acknowledgement guards.
 * Synthetic D1 receipts only: no real customer records, D1/R2, AI model,
 * legal decision, Word output, staff or attorney approval.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../lib/case-legal-automation.ts",import.meta.url),"utf8");
const AF=Object.getPrototypeOf(async function(){}).constructor;
function span(first,last){
 const from=source.indexOf(first);
 assert.ok(from>=0,"production start marker missing: "+first);
 assert.equal(source.indexOf(first,from+first.length),-1,"production start marker must be unique");
 const to=source.indexOf(last,from+first.length);
 assert.ok(to>from,"production end marker missing: "+last);
 return source.slice(from,to);
}
const transition=new AF("updated","database","job","status","fields","note",
 span('if(updated.meta?.changes===0)throw new Error("LEGAL_AUTOMATION_SUPERSEDED");',
 '\n}\nasync function gatherChecks')+"\nreturn 'accepted';");
const claim=new AF("claimed","candidate",
 span('if(claimed.meta?.changes===0)return',
 '\n const job=await database.prepare("SELECT id,case_id')+"\nreturn 'claimed';");
const retry=new AF("updated",
 span('if(updated.meta?.changes===0)throw new Error("LEGAL_AUTOMATION_RETRY_CONFLICT");',
 '\n await database.prepare("INSERT INTO case_legal_automation_events')+"\nreturn 'accepted';");
const cases=[
 ["transition",transition,"LEGAL_AUTOMATION_SUPERSEDED","LEGAL_AUTOMATION_TRANSITION_ACK_UNOBSERVED","accepted"],
 ["claim",claim,"already_claimed_or_complete","LEGAL_AUTOMATION_CLAIM_ACK_UNOBSERVED","claimed"],
 ["retry",retry,"LEGAL_AUTOMATION_RETRY_CONFLICT","LEGAL_AUTOMATION_RETRY_ACK_UNOBSERVED","accepted"]
];
for(const [kind,fn,zero,unobserved,one] of cases){
 for(const changes of [0,1,null,undefined,2]){
  test(kind+" D1 changes="+String(changes)+" retains the exact acknowledgement contract",async()=>{
   const envelope={meta:changes===undefined?{}:{changes}};
   const audit=[];
   const args=kind==="transition"
    ?[envelope,{}, {completedChecks:0},"pending",{},async()=>audit.push("written")]
    :kind==="claim"?[envelope,{caseId:"case-synthetic"}]:[envelope];
   let result=null,error=null;
   try{result=await fn(...args);}catch(e){error=e;}
   const expected=changes===0?zero:changes===1?one:unobserved;
   const observed=error?.message??(typeof result==="object"?result?.status:result);
   assert.equal(observed,expected);
   if(kind==="transition")assert.equal(audit.length,changes===1?1:0,
    "only exactly one acknowledged row may append an audit event");
  });
 }
}
test("unknown transition ACK cannot become a false retry or superseded status",async()=>{
 const catchText=span('}catch(error){\n  const code=safeCode(error),stale=',
 '\n }\n}\nexport async function drainCaseLegalAutomation');
 const catchBody=catchText.slice("}catch(error){".length).replace(/ as const\b/g,"");
 const failure=new AF("error","database","job","lease","safeCode","RETRIES",
  "later","clock","note",catchBody);
 let attempts=0;
 const database={prepare(){attempts++;throw new Error("unexpected write");}};
 await assert.rejects(()=>failure(
  new Error("LEGAL_AUTOMATION_TRANSITION_ACK_UNOBSERVED"),
  database,{},"lease-synthetic",e=>e.message,4,()=>null,()=>null,async()=>{}),
  /LEGAL_AUTOMATION_TRANSITION_ACK_UNOBSERVED/);
 assert.equal(attempts,0,"uncertain previous commit must not trigger a second mutation");
});
