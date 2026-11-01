import test from "node:test";
import assert from "node:assert/strict";
import type { CaseExecution } from "../lib/case-agent.ts";
import { classifyStoredFeatureMoney, calculationFeatureRows } from "../lib/case-calculation-feature-store.ts";

// Synthetic-only; no customer OCR, private data, or legal recognition.
const classify = (v:unknown) => classifyStoredFeatureMoney("monthlyIncomeWon",v,"calculated");
function row(v:unknown) {
  const e={assessment:{calculation:{caseRevision:1,computedBy:"deterministic-bigint",monthlyIncomeWon:v,
    incomeRows:[],incomeGroups:[],debtRows:[],assetRows:[],allocations:[],
    traces:[{id:"income_group:SYN",status:"calculated",reasons:[],
      inputs:[{factIds:["SYN-F1"]}],resultWon:v}]}},
    proposals:{livingCost:null,objectionMinimum:null,termCandidate:null},
    courtApprovalInferred:false} as unknown as CaseExecution;
  return calculationFeatureRows(e).find(f=>f.outputName==="monthlyIncomeWon");
}
test("A2 r67 noncanonical Won strings fail closed without rewriting raw or Fact",()=>{
  for(const raw of ["00","-0","-00","00100","-01"]){
    assert.deepEqual(classify(raw),{status:"blocked",valueWon:null,reasons:["INVALID_MONETARY_FEATURE_VALUE"]});
    const f=row(raw);assert.ok(f);assert.equal(f.value,raw);assert.equal(f.valueWon,null);
    assert.equal(f.status,"blocked");assert.deepEqual(f.sourceFactIds,["SYN-F1"]);
  }
});
test("A2 r67 canonical large, negative, and explicit zero remain computed",()=>{
  for(const raw of ["0","-1","2400000","9007199254740992"])
    assert.deepEqual(classify(raw),{status:"computed",valueWon:raw,reasons:[]});
});
test("A2 r67 null, unknown, source conflicts, and legal approval are distinct",()=>{
  assert.deepEqual(classify(null),{status:"missing",valueWon:null,reasons:[]});
  assert.deepEqual(classify("unknown"),{status:"missing",valueWon:null,reasons:[]});
  assert.deepEqual(classifyStoredFeatureMoney("monthlyIncomeWon","0","calculated",["SOURCE_CONFLICT"]),
    {status:"conflict",valueWon:"0",reasons:["SOURCE_CONFLICT"]});
  assert.equal(row("0")?.status,"computed");
  assert.equal(classifyStoredFeatureMoney("courtApprovalInferred",false,"not_applicable").status,"not_applicable");
});
