import test from "node:test";
import assert from "node:assert/strict";
import {auditStoredCalculationReplay} from "../lib/preapproval-calculation-replay.ts";

/** Synthetic persistence rows only. This does not infer legal or court approval. */
function row(name:string, value:unknown, won:string|null, calculationId="synthetic_calc") {
  return {calculationId,outputName:name,outputPath:`/assessment/calculation/${name}`,
    valueJson:JSON.stringify(value),valueWon:won,status:value===null?"missing":"provisional",sourceFactIdsJson:"[]"};
}
function replay(values:Record<string,unknown>, rows:ReturnType<typeof row>[], expectedNames=Object.keys(values)) {
  const expectedOutputs=expectedNames.map(name=>({calculationId:"synthetic_calc",outputPath:`/assessment/calculation/${name}`}));
  return auditStoredCalculationReplay({execution:{assessment:{calculation:values}},rows,currentFactIds:new Set<string>(),expectedOutputs});
}
test("missing all SQL rows and one of two expected rows are not valid",()=>{
  assert.equal(replay({monthlyIncomeWon:"2400000"},[]).issueCountByCode.EMPTY_STORED_OUTPUTS,1);
  const partial=replay({monthlyIncomeWon:"2400000",debtInterestWon:"0"},[row("monthlyIncomeWon","2400000","2400000")]);
  assert.equal(partial.valid,false);
  assert.equal(partial.issueCountByCode.EXPECTED_OUTPUT_NOT_PERSISTED,1);
});
test("numeric JSON safe integer and explicit numeric zero match SQL text Won",()=>{
  assert.equal(replay({monthlyIncomeWon:1200000},[row("monthlyIncomeWon",1200000,"1200000")]).valid,true);
  assert.equal(replay({monthlyIncomeWon:0},[row("monthlyIncomeWon",0,"0")]).valid,true);
});
test("numeric JSON safe integer with SQL NULL is not complete or zero",()=>{
  for(const amount of [0,1200000,-1]) {
    const audit=replay({monthlyIncomeWon:amount},[row("monthlyIncomeWon",amount,null)]);
    assert.equal(audit.valid,false);
    assert.equal(audit.issueCountByCode.STORED_WON_MISMATCH,1);
  }
});
test("integer-string Won, including larger than JS safe integer, remains exact",()=>{
  const big="9007199254740993";
  assert.equal(replay({monthlyIncomeWon:big},[row("monthlyIncomeWon",big,big)]).valid,true);
  assert.equal(replay({monthlyIncomeWon:big},[row("monthlyIncomeWon",big,null)]).issueCountByCode.STORED_WON_MISMATCH,1);
  assert.equal(replay({monthlyIncomeWon:"0"},[row("monthlyIncomeWon","0","0")]).valid,true);
});
test("unknown, JSON null and non-money numbers remain unpromoted",()=>{
  assert.equal(replay({monthlyIncomeWon:null},[row("monthlyIncomeWon",null,null)]).valid,true);
  assert.equal(replay({monthlyIncomeWon:"unknown"},[row("monthlyIncomeWon","unknown",null)]).valid,true);
  assert.equal(replay({monthCount:36},[row("monthCount",36,null)]).valid,true);
  assert.equal(replay({monthlyIncomeWon:12.5},[row("monthlyIncomeWon",12.5,null)]).valid,true);
});
test("stale source fact and mismatched SQL integer are separately rejected",()=>{
  const base=row("monthlyIncomeWon","2400000","2400001");
  const out=auditStoredCalculationReplay({execution:{assessment:{calculation:{monthlyIncomeWon:"2400000"}}},
    rows:[{...base,sourceFactIdsJson:'["stale"]'}],currentFactIds:new Set<string>(),
    expectedOutputs:[{calculationId:"synthetic_calc",outputPath:base.outputPath}]});
  assert.equal(out.issueCountByCode.STORED_WON_MISMATCH,1);
  assert.equal(out.issueCountByCode.SOURCE_FACT_NOT_CURRENT,1);
  assert.equal(out.courtApprovalInferred,false);
});
test("two expected outputs complete with correct SQL statuses and values",()=>{
  const out=replay({monthlyIncomeWon:1200000,debtInterestWon:"0"},
    [row("monthlyIncomeWon",1200000,"1200000"),row("debtInterestWon","0","0")]);
  assert.equal(out.valid,true);
  assert.equal(out.storedRows,2);
});
