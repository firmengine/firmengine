import test from "node:test";
import assert from "node:assert/strict";
import {auditStoredCalculationReplay} from "../lib/preapproval-calculation-replay.ts";

// Synthetic, not customer data. A replay PASS never implies legal recognition or court approval.
const income = "/assessment/calculation/monthlyIncomeWon";
const interest = "/assessment/calculation/debtInterestWon";
const unobserved = "/assessment/calculation/unobserved";
const execution = {assessment:{calculation:{monthlyIncomeWon:"2400000",debtInterestWon:"0",unobserved:null}}};
const expected = [{calculationId:"income_average",outputPath:income}];
const row = (calculationId:string,id:string,outputPath=income,value:string|null="2400000",status="computed") => ({
  id,calculationId,outputPath,outputName:outputPath.split("/").at(-1)??"",
  valueJson:JSON.stringify(value),valueWon:outputPath.endsWith("Won")?value:null,status,
  sourceFactIdsJson:'["SYN-F1"]'
});
const normal = row("income_average","SYN-R1");
const extraZero = row("unlisted_calculation","SYN-R2",interest,"0");
const extraNull = row("unlisted_calculation","SYN-R3",unobserved,null,"missing");
const audit = (rows:ReturnType<typeof row>[],contract?:typeof expected) =>
  auditStoredCalculationReplay({execution,rows,currentFactIds:new Set(["SYN-F1"]),
    ...(contract===undefined?{}:{expectedOutputs:contract})});

test("exact producer set remains valid without legal approval inferred",()=>{
  const r=audit([normal],expected);
  assert.equal(r.valid,true); assert.equal(r.courtApprovalInferred,false);
  assert.equal(r.replayedPaths,1);
});
test("independent nonzero producer with an extra observed-zero pointer is rejected",()=>{
  const r=audit([normal,extraZero],expected);
  assert.equal(r.valid,false); assert.equal(r.issueCountByCode.UNEXPECTED_OUTPUT_PERSISTED,1);
});
test("missing/null extra pointer is not silently promoted to the producer set",()=>{
  const r=audit([normal,extraNull],expected);
  assert.equal(r.valid,false); assert.equal(r.issueCountByCode.UNEXPECTED_OUTPUT_PERSISTED,1);
});
test("empty expected set does not permit nonempty persisted rows",()=>{
  const r=audit([normal],[]);
  assert.equal(r.valid,false); assert.equal(r.issueCountByCode.UNEXPECTED_OUTPUT_PERSISTED,1);
});
test("wrong producer at an existing pointer reports unexpected and missing",()=>{
  const r=audit([row("wrong_calculation","SYN-R4")],expected);
  assert.equal(r.valid,false);assert.equal(r.issueCountByCode.UNEXPECTED_OUTPUT_PERSISTED,1);
  assert.equal(r.issueCountByCode.EXPECTED_OUTPUT_NOT_PERSISTED,1);
});
test("backward-compatible no-contract replay remains an explicitly weaker check",()=>{
  const r=audit([normal,extraZero]);
  assert.equal(r.valid,true); assert.equal(r.replayedPaths,2);
});
test("empty replay and missing required producer remain blocked",()=>{
  const r=audit([],expected);
  assert.equal(r.valid,false); assert.equal(r.issueCountByCode.EMPTY_STORED_OUTPUTS,1);
  assert.equal(r.issueCountByCode.EXPECTED_OUTPUT_NOT_PERSISTED,1);
});
test("extra row and absent required producer both surface independent issues",()=>{
  const r=audit([extraZero],expected);
  assert.equal(r.valid,false);assert.equal(r.issueCountByCode.UNEXPECTED_OUTPUT_PERSISTED,1);
  assert.equal(r.issueCountByCode.EXPECTED_OUTPUT_NOT_PERSISTED,1);
});
test("extra pointer classification does not depend on SQL row order",()=>{
  const r=audit([extraZero,normal],expected);
  assert.equal(r.valid,false);assert.equal(r.issueCountByCode.UNEXPECTED_OUTPUT_PERSISTED,1);
});
test("physical collision regression stays blocked without changing amounts",()=>{
  const r=audit([normal,row("another_producer","SYN-R5")],expected);
  assert.equal(r.valid,false);assert.equal(r.issueCountByCode.DUPLICATE_OUTPUT_PATH,1);
  assert.equal(r.issueCountByCode.UNEXPECTED_OUTPUT_PERSISTED,1);
  assert.equal(r.storedRows,2);
});
