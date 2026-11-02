import test from "node:test";
import assert from "node:assert/strict";
import {createCase} from "../lib/domain.ts";
import {executeCaseNodes} from "../lib/case-execution.ts";
import {CURRENT_RULESET} from "../lib/legal-rules.ts";
import {calculationFeatureRows} from "../lib/case-calculation-feature-store.ts";

/** Synthetic engine trace only; not a source document or an approved Fact. */
function syntheticExecution(ids:unknown) {
  const data=createCase("Synthetic lineage review","synthetic-a1-r75","2026-11-02");
  data.context.ruleReleaseId=CURRENT_RULESET.id;
  const execution=executeCaseNodes(data);
  execution.assessment.calculation.traces.push({
    id:"income_group:synthetic",status:"calculated",resultWon:"0",
    inputs:[{factIds:ids}],formula:"synthetic zero observation",reasons:[],
  } as unknown as (typeof execution.assessment.calculation.traces)[number]);
  return execution;
}

test("malformed Fact-ID array elements fail closed before calculation feature rows can be persisted",()=>{
  for(const invalid of [[""],["  "],[" synthetic-fact-1 "],[null],[42]]) {
    const execution=syntheticExecution(invalid);
    assert.throws(()=>calculationFeatureRows(execution),
      (error:unknown)=>(error as {code?:string}).code==="CALCULATION_FEATURE_INVALID_FACT_ID");
  }
});

test("valid repeated Fact IDs deduplicate without modifying the original engine result",()=>{
  const execution=syntheticExecution(["synthetic-fact-1","synthetic-fact-1","synthetic-fact-2"]);
  const before=JSON.stringify(execution);
  const rows=calculationFeatureRows(execution);
  assert.equal(JSON.stringify(execution),before);
  const row=rows.find(x=>x.outputName==="traces.resultWon"&&x.subjectId==="synthetic");
  assert.ok(row);
  assert.equal(row.value,"0");
  assert.equal(row.valueWon,"0");
  assert.deepEqual(row.sourceFactIds,["synthetic-fact-1","synthetic-fact-2"]);
});

test("unobserved source fact IDs are not fabricated and zero remains distinct from missing",()=>{
  const rows=calculationFeatureRows(syntheticExecution(null));
  const row=rows.find(x=>x.outputName==="traces.resultWon"&&x.subjectId==="synthetic");
  assert.ok(row);
  assert.equal(row.value,"0");
  assert.equal(row.valueWon,"0");
  assert.deepEqual(row.sourceFactIds,[]);
});
