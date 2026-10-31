/** A4 r36: source-extracted calculation poll D1 acknowledgement test.
 * Synthetic return envelopes only. No D1/R2/HTTP/actual calculation/approval.
 * Read live repository source; fail if expected production body was refactored.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../lib/case-data-recompute.ts",import.meta.url),"utf8");
const AF=Object.getPrototypeOf(async function(){}).constructor;
const catchMarker="}catch(error){\n     const receipt=";
const catchStart=source.indexOf(catchMarker);
const catchEnd=source.indexOf("\n   }\n }\n return {scanned:",catchStart);
assert.ok(catchStart>=0&&catchEnd>catchStart,"production poll catch must exist");
assert.equal(source.indexOf(catchMarker,catchStart+catchMarker.length),-1,"single poll catch");
const catchBody=source.slice(catchStart+"}catch(error){".length,catchEnd)
  .replace(/\\.first<\\{attempts:number\\}>/g,".first").replace(/ as const\\b/g,"");
const handleFailure=new AF("error","database","row","lease","ms","at","results",
  `for(let once=0;once<1;once++){${catchBody}}return results;`);

const claimStart=source.indexOf("if(claim.meta?.changes===0)");
const claimEnd=source.indexOf("\n   try{",claimStart);
assert.ok(claimStart>=0&&claimEnd>claimStart,"production poll claim guard must exist");
const claimBody=source.slice(claimStart,claimEnd).replace(/ as const\\b/g,"");
const handleClaim=new AF("claim","results","row",
  `for(let once=0;once<1;once++){${claimBody}}return results;`);

const retryStart=source.indexOf("if(changed.meta?.changes===0)");
const retryEnd=source.indexOf("\n return {caseId:input.caseId",retryStart);
assert.ok(retryStart>=0&&retryEnd>retryStart,"production manual retry acknowledgement guard must exist");
const retryBody=source.slice(retryStart,retryEnd);
const handleRetry=new AF("changed",`${retryBody}\n return "retry_wait";`);
const row={caseId:"case-synthetic",dataVersion:7},now=Date.parse("2026-11-01T00:40:00Z");
const envelope=changes=>({meta:changes===undefined?{}:{changes}});

for(const attempts of [1,5]){
  for(const changes of [0,1,null,undefined,2]){
    const expected=changes===0?"superseded":changes===1?(attempts===5?"failed":"retry_wait"):"CASE_CALCULATION_POLL_FAILURE_ACK_UNOBSERVED";
    test(`failure receipt changes=${String(changes)} attempts=${attempts} -> ${expected}`,async()=>{
      const sqls=[];
      const database={prepare(sql){
        sqls.push(sql);
        return {bind(){return {async first(){return {attempts}},async run(){return envelope(changes)}}}};
      }};
      let result=null,failure=null;
      try{result=await handleFailure(new Error("CALC_SYNTHETIC_503"),database,row,"lease-A",now,"2026-11-01T00:40:00Z",[])}
      catch(error){failure=error;}
      assert.equal(sqls.length,2,"SELECT attempts then one failure UPDATE");
      assert.match(sqls[1],/WHERE case_id=\\? AND lease_token=\\?/);
      if(changes!==0&&changes!==1){
        assert.equal(result,null);
        assert.equal(failure?.message,expected);
      }else{
        assert.equal(failure,null);
        assert.equal(result.length,1);
        assert.equal(result[0].status,expected);
      }
    });
  }
}
for(const changes of [0,1,null,undefined,2]){
  const expected=changes===0?"already_claimed":changes===1?"claimed":"CASE_CALCULATION_POLL_CLAIM_ACK_UNOBSERVED";
  test(`claim receipt changes=${String(changes)} -> ${expected}`,async()=>{
    let rows=null,failure=null;
    try{rows=await handleClaim(envelope(changes),[],row);}catch(error){failure=error;}
    if(changes!==0&&changes!==1)assert.equal(failure?.message,expected);
    else {assert.equal(failure,null);assert.equal(rows?.[0]?.status??"claimed",expected);}
  });
}
for(const changes of [0,1,null,undefined,2]){
  const expected=changes===0?"CASE_CALCULATION_POLL_NO_CURRENT_FAILED_JOB":
    changes===1?"retry_wait":"CASE_CALCULATION_POLL_RETRY_ACK_UNOBSERVED";
  test(`manual retry receipt changes=${String(changes)} -> ${expected}`,async()=>{
    let value=null,failure=null;
    try{value=await handleRetry(envelope(changes));}catch(error){failure=error;}
    if(changes===1){assert.equal(failure,null);assert.equal(value,expected);}
    else {assert.equal(value,null);assert.equal(failure?.message,expected);}
  });
}
