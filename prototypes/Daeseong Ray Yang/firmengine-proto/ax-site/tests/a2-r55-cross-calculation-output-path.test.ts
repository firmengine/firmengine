import test from "node:test";
import assert from "node:assert/strict";
import { auditStoredCalculationReplay } from "../lib/preapproval-calculation-replay.ts";

// Synthetic rows only. A valid replay is not legal or court approval.
const path = "/assessment/calculation/monthlyIncomeWon";
const execution = {assessment:{calculation:{monthlyIncomeWon:"2400000",debtInterestWon:"0",unobserved:null}}};
const mk = (calculationId:string, id:string, outputPath=path, value:string|null="2400000", status="computed") => ({
  id, calculationId, outputPath, outputName:outputPath.split("/").at(-1)??"",
  valueJson:JSON.stringify(value), valueWon:value, status, sourceFactIdsJson:'["SYN-F1"]'
});
const audit = (rows:ReturnType<typeof mk>[], expectedOutputs: {calculationId:string,outputPath:string}[]=[
  {calculationId:"income_average",outputPath:path}
], runtime:unknown=execution) =>
  auditStoredCalculationReplay({execution:runtime,rows,currentFactIds:new Set(["SYN-F1"]),expectedOutputs});

test("one correct physical path is replayed once",()=>{
  const result=audit([mk("income_average","SYN-R1")]);
  assert.equal(result.valid,true);
  assert.equal(result.replayedPaths,1);
});
test("same calculation ID and path duplicates remain blocked",()=>{
  const result=audit([mk("income_average","SYN-R1"),mk("income_average","SYN-R2")]);
  assert.equal(result.valid,false);
  assert.equal(result.issueCountByCode.DUPLICATE_OUTPUT_PATH,1);
});
test("two calculation IDs cannot both claim one persisted JSON pointer",()=>{
  const result=audit([mk("income_average","SYN-R1"),mk("income_aggregation","SYN-R2")]);
  assert.equal(result.valid,false);
  assert.equal(result.issueCountByCode.DUPLICATE_OUTPUT_PATH,1);
  assert.equal(result.replayedPaths,1);
});
test("cross-calculation collision is independent of SQL row order",()=>{
  const result=audit([mk("income_aggregation","SYN-R2"),mk("income_average","SYN-R1")]);
  assert.equal(result.valid,false);
  assert.equal(result.issueCountByCode.DUPLICATE_OUTPUT_PATH,1);
});
test("different physical paths from different calculations stay valid",()=>{
  const other="/assessment/calculation/debtInterestWon";
  const result=audit([mk("income_average","SYN-R1"),mk("debt_total","SYN-R2",other,"0")],[
    {calculationId:"income_average",outputPath:path},{calculationId:"debt_total",outputPath:other}
  ]);
  assert.equal(result.valid,true);
  assert.equal(result.replayedPaths,2);
});
test("observed zero does not excuse a cross-calculation path collision",()=>{
  const result=audit([mk("income_average","SYN-R1",path,"0"),mk("income_aggregation","SYN-R2",path,"0")],
    [{calculationId:"income_average",outputPath:path}],
    {assessment:{calculation:{monthlyIncomeWon:"0"}}});
  assert.equal(result.valid,false);
  assert.equal(result.issueCountByCode.DUPLICATE_OUTPUT_PATH,1);
});
test("one source-only null remains missing, never inferred zero",()=>{
  const missing="/assessment/calculation/unobserved";
  const result=audit([mk("income_average","SYN-R1",missing,null,"missing")],
    [{calculationId:"income_average",outputPath:missing}]);
  assert.equal(result.valid,true);
});
test("cross-calculation collision and stored amount mismatch both remain visible",()=>{
  const result=audit([mk("income_average","SYN-R1"),mk("income_aggregation","SYN-R2",path,"0")]);
  assert.equal(result.valid,false);
  assert.equal(result.issueCountByCode.DUPLICATE_OUTPUT_PATH,1);
  assert.equal(result.issueCountByCode.OUTPUT_VALUE_MISMATCH,1);
});
