import test from "node:test";
import assert from "node:assert/strict";
import {auditStoredCalculationReplay} from "../lib/preapproval-calculation-replay.ts";

// Synthetic Fact identifiers only. Exact producer lineage is not legal recognition.
const income = "/assessment/calculation/monthlyIncomeWon";
const missing = "/assessment/calculation/unobserved";
const execution = {assessment:{calculation:{monthlyIncomeWon:"2400000",unobserved:null}}};
const currentFactIds = new Set(["SYN-F1","SYN-F2"]);
const make = (raw:string|undefined, outputPath=income, value:string|null="2400000", status="computed") => ({
  id:"SYN-ROW",calculationId:"income_average",outputPath,outputName:outputPath.split("/").at(-1)??"",
  valueJson:JSON.stringify(value),valueWon:outputPath.endsWith("Won")?value:null,status,
  ...(raw===undefined?{}:{sourceFactIdsJson:raw})
});
const output = (sourceFactIds?:readonly string[],outputPath=income) =>
  ({calculationId:"income_average",outputPath,...(sourceFactIds===undefined?{}:{sourceFactIds})});
const check = (raw:string|undefined, expected?:readonly string[], options?:{outputPath?:string;value?:string|null;status?:string;factIds?:ReadonlySet<string>})=>{
  const outputPath=options?.outputPath??income;
  return auditStoredCalculationReplay({
    execution, rows:[make(raw,outputPath,options?.value===undefined?"2400000":options.value,options?.status??"computed")],
    currentFactIds:options?.factIds??currentFactIds,
    expectedOutputs:[output(expected,outputPath)]
  });
};
test("same producer and same Fact identity passes data replay only",()=>{
  const r=check('["SYN-F1"]',["SYN-F1"]);
  assert.equal(r.valid,true);assert.equal(r.courtApprovalInferred,false);
});
test("different but current Fact may not replace the producer Fact",()=>{
  const r=check('["SYN-F2"]',["SYN-F1"]);
  assert.equal(r.valid,false);
  assert.equal(r.issueCountByCode.STORED_FACT_LINEAGE_MISMATCH,1);
  assert.equal(r.issueCountByCode.SOURCE_FACT_NOT_CURRENT,undefined);
});
test("adding a second current Fact changes provenance even if amount matches",()=>{
  const r=check('["SYN-F1","SYN-F2"]',["SYN-F1"]);
  assert.equal(r.valid,false);assert.equal(r.issueCountByCode.STORED_FACT_LINEAGE_MISMATCH,1);
});
test("missing producer Fact cannot be misrepresented by []",()=>{
  const r=check("[]",["SYN-F1"]);
  assert.equal(r.valid,false);assert.equal(r.issueCountByCode.STORED_FACT_LINEAGE_MISMATCH,1);
});
test("duplicated Fact ID is not an exact producer encoding",()=>{
  const r=check('["SYN-F1","SYN-F1"]',["SYN-F1"]);
  assert.equal(r.valid,false);assert.equal(r.issueCountByCode.STORED_FACT_LINEAGE_MISMATCH,1);
});
test("array order is not evidence of a different Fact set",()=>{
  const r=check('["SYN-F2","SYN-F1"]',["SYN-F1","SYN-F2"]);
  assert.equal(r.valid,true);
});
test("Fact that is not current still triggers original freshness check",()=>{
  const r=check('["SYN-OLD"]',["SYN-F1"]);
  assert.equal(r.valid,false);assert.equal(r.issueCountByCode.SOURCE_FACT_NOT_CURRENT,1);
  assert.equal(r.issueCountByCode.STORED_FACT_LINEAGE_MISMATCH,1);
});
test("empty producer provenance and empty persisted provenance are equal",()=>{
  const r=check("[]",[]);
  assert.equal(r.valid,true);assert.equal(r.courtApprovalInferred,false);
});
test("observed exact 0 is distinct from missing and still checks provenance",()=>{
  const r=auditStoredCalculationReplay({execution:{assessment:{calculation:{monthlyIncomeWon:"0"}}},
    rows:[make('["SYN-F2"]',income,"0")],currentFactIds,
    expectedOutputs:[output(["SYN-F1"])]});
  assert.equal(r.valid,false);
  assert.equal(r.issueCountByCode.STORED_FACT_LINEAGE_MISMATCH,1);
  assert.equal(r.issueCountByCode.OUTPUT_VALUE_MISMATCH,undefined);
});
test("null missing value is not converted to zero and lineage still checked",()=>{
  const r=check('["SYN-F2"]',["SYN-F1"],{outputPath:missing,value:null,status:"missing"});
  assert.equal(r.valid,false);
  assert.equal(r.issueCountByCode.STORED_FACT_LINEAGE_MISMATCH,1);
  assert.equal(r.issueCountByCode.STORED_STATUS_VALUE_CONFLICT,undefined);
});
test("absent provenance column is not an exact expected producer lineage",()=>{
  const r=check(undefined,["SYN-F1"]);
  assert.equal(r.valid,false);assert.equal(r.issueCountByCode.STORED_FACT_LINEAGE_MISMATCH,1);
});
test("malformed JSON produces both data-format and lineage findings",()=>{
  const r=check("{bad",["SYN-F1"]);
  assert.equal(r.valid,false);assert.equal(r.issueCountByCode.STORED_FACT_IDS_INVALID,1);
  assert.equal(r.issueCountByCode.STORED_FACT_LINEAGE_MISMATCH,1);
});
test("legacy pair-only caller remains deliberately weaker until wired",()=>{
  const r=check('["SYN-F2"]',undefined);
  assert.equal(r.valid,true);
});
test("unlisted persisted output remains blocked from previous round",()=>{
  const r=auditStoredCalculationReplay({execution,
    rows:[make('["SYN-F1"]')],currentFactIds,expectedOutputs:[]});
  assert.equal(r.valid,false);assert.equal(r.issueCountByCode.UNEXPECTED_OUTPUT_PERSISTED,1);
});
