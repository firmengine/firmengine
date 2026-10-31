import test from "node:test";
import assert from "node:assert/strict";
import {auditStoredCalculationReplay} from "../lib/preapproval-calculation-replay.ts";

/** Synthetic-only read-only replay; these fixtures never claim court approval. */
function replay(outputName:string, value:unknown, valueWon:string|null, path= `/assessment/calculation/${outputName}`) {
  const execution={assessment:{calculation:{[outputName]:value}},courtApprovalInferred:false};
  const row={calculationId:"a2-r19-synthetic",outputName,outputPath:path,
    valueJson:JSON.stringify(value),valueWon,status:value===null?"missing":"provisional",
    sourceFactIdsJson:"[]"};
  return auditStoredCalculationReplay({execution,rows:[row],currentFactIds:new Set<string>()});
}
test("exact integer-Won JSON with SQL NULL numeric column is invalid",()=>{
  const r=replay("monthlyIncomeWon","2400000",null);
  assert.equal(r.valid,false); assert.equal(r.issueCountByCode.STORED_WON_MISMATCH,1);
});
test("explicit zero string also requires SQL value_won '0', not NULL",()=>{
  assert.equal(replay("debtInterestWon","0",null).issueCountByCode.STORED_WON_MISMATCH,1);
  assert.equal(replay("debtInterestWon","0","0").valid,true);
});
test("large integer Won keeps exact string, never converts to JS Number",()=>{
  assert.equal(replay("presentValueWon","9007199254740993",null).issueCountByCode.STORED_WON_MISMATCH,1);
  assert.equal(replay("presentValueWon","9007199254740993","9007199254740993").valid,true);
});
test("missing source value and nonmoney boolean remain distinct",()=>{
  assert.equal(replay("presentValueWon",null,null).valid,true);
  const execution={courtApprovalInferred:false};
  const row={calculationId:"scope",outputName:"courtApprovalInferred",outputPath:"/courtApprovalInferred",
    valueJson:"false",valueWon:null,status:"not_applicable",sourceFactIdsJson:"[]"};
  assert.equal(auditStoredCalculationReplay({execution,rows:[row],currentFactIds:new Set<string>()}).valid,true);
});
test("ordinary mismatched numeric column remains an explicit error",()=>{
  assert.equal(replay("monthlyIncomeWon","2400000","2400001").issueCountByCode.STORED_WON_MISMATCH,1);
  assert.equal(replay("monthlyIncomeWon","2400000","2400000").valid,true);
});
