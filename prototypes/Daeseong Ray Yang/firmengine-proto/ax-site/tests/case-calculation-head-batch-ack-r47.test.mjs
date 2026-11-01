/** A4 r47: exact checked-in calculation head batch ACK boundary; source-extracted only.
 * No D1/R2 credentials, client data, AI model, or human approval.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../lib/case-calculation-feature-store.ts",import.meta.url),"utf8");
const begin=source.indexOf("  const result=await db.batch(statements);");
const end=source.indexOf("\n}\n\ninterface Head",begin);
assert.ok(begin>=0&&end>begin,"production persistence receipt boundary must remain extractable");
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const persistTail=new AsyncFunction("db","statements","error","runId","input","rows","status","missing",source.slice(begin,end));
async function run(receipts) {
  return persistTail({batch:async()=>receipts},[{},{}],code=>new Error(code),"synthetic-run",
    {dataVersion:4,caseRevision:2,inputSha256:"synthetic-input"},[],"computed",[]);
}
for (const [title,ack,code] of [
  ["exact one-row head batch receipt",[{meta:{changes:0}},{meta:{changes:1}}],null],
  ["zero-row current-head CAS",[{}, {meta:{changes:0}}],"CALCULATION_VERSION_MISMATCH"],
  ["null head ACK",[{}, {meta:{changes:null}}],"CALCULATION_HEAD_ACK_UNOBSERVED"],
  ["missing head ACK metadata",[{},{}],"CALCULATION_HEAD_ACK_UNOBSERVED"],
  ["multi-row head ACK",[{}, {meta:{changes:2}}],"CALCULATION_HEAD_ACK_UNOBSERVED"],
  ["negative head ACK",[{}, {meta:{changes:-1}}],"CALCULATION_HEAD_ACK_UNOBSERVED"],
  ["non-numeric head ACK",[{}, {meta:{changes:"1"}}],"CALCULATION_HEAD_ACK_UNOBSERVED"],
  ["short batch receipt despite success last ACK",[{meta:{changes:1}}],"CALCULATION_HEAD_ACK_UNOBSERVED"],
  ["null batch envelope",null,"CALCULATION_HEAD_ACK_UNOBSERVED"]
]) {
  test(title,async()=>{
    if(code)await assert.rejects(run(ack),{message:code});
    else {
      const out=await run(ack);
      assert.equal(out.headPromoted,true);
      assert.equal(out.runId,"synthetic-run");
      assert.equal(out.courtApprovalInferred,false);
    }
  });
}
