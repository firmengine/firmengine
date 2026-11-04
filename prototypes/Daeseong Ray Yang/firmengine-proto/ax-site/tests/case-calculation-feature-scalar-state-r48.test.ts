import test from "node:test";
import assert from "node:assert/strict";
import {calculationFeatureRows} from "../lib/case-calculation-feature-store.ts";
import type {CaseExecution} from "../lib/case-agent.ts";

/** No real client data or legal acceptance: invalid synthetic engine scalars only. */
function traceFeature(value:unknown, status="calculated", reasons:string[]=[]){
  const execution={
    assessment:{calculation:{
      caseRevision:1, incomeRows:[], incomeGroups:[], debtRows:[], assetRows:[], allocations:[],
      traces:[{id:"synthetic:scalar",status,resultWon:value,formula:"synthetic fixture only",inputs:[],reasons}]
    }},
    proposals:{livingCost:null,objectionMinimum:null,termCandidate:null},
    courtApprovalInferred:false
  } as unknown as CaseExecution;
  const row=calculationFeatureRows(execution).find(f=>f.outputPath==="/assessment/calculation/traces/0/resultWon");
  assert.ok(row,"synthetic trace scalar must have a persisted feature row");
  return row;
}

test("non-finite numeric outputs cannot be marked computed or serialized as accepted values",()=>{
  for(const value of [Number.NaN,Number.POSITIVE_INFINITY,Number.NEGATIVE_INFINITY]){
    const row=traceFeature(value);
    assert.equal(row.status,"blocked");
    assert.equal(row.valueWon,null);
    assert.equal(JSON.stringify(value),"null","JSON would otherwise conceal the invalid numeric scalar");
  }
});

test("empty, unknown and absent engine values remain missing or blocked; never implicitly zero",()=>{
  for(const value of ["","  ",null,undefined,"unknown"]){
    assert.equal(traceFeature(value).status,"missing");
  }
  assert.equal(traceFeature("","blocked").status,"blocked");
  assert.equal(traceFeature(null,"blocked").status,"blocked");
});

test("observed zero and negative results keep their distinct numeric value and status",()=>{
  for(const [value,expectedWon] of [[0,"0"],["0","0"],[-12,"-12"],["-12","-12"]] as const){
    const row=traceFeature(value);
    assert.equal(row.status,"computed");
    assert.equal(row.valueWon,expectedWon);
  }
  assert.equal(traceFeature("0","calculated",["SOURCE_CONFLICT"]).status,"conflict");
  assert.equal(traceFeature(null,"not_applicable").status,"not_applicable");
});
