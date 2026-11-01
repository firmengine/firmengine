import test from "node:test";
import assert from "node:assert/strict";
import {classifyStoredFeatureMoney} from "../lib/case-calculation-feature-store.ts";

// Synthetic feature serialization. No court approval or customer data.
const classify=(name:string,value:unknown,engineStatus:string="calculated",reasons:string[]=[])=>
  classifyStoredFeatureMoney(name,value,engineStatus,reasons);

test("A2 r61: observed zero, missing null, explicit unknown stay distinct",()=>{
  assert.deepEqual(classify("monthlyIncomeWon","0"),{valueWon:"0",status:"computed",reasons:[]});
  assert.deepEqual(classify("monthlyIncomeWon",null),{valueWon:null,status:"missing",reasons:[]});
  assert.deepEqual(classify("monthlyIncomeWon","unknown"),{valueWon:null,status:"missing",reasons:[]});
  assert.deepEqual(classify("monthlyIncomeWon",null,"not_applicable"),{valueWon:null,status:"not_applicable",reasons:[]});
});
test("A2 r61: invalid observed Won encoding is blocked, never computed",()=>{
  for(const v of ["9,00","1 000","1.5","[미관찰]",9007199254740992]){
    const x=classify("monthlyIncomeWon",v);
    assert.equal(x.status,"blocked",String(v));
    assert.equal(x.valueWon,null,String(v));
    assert.deepEqual(x.reasons,["INVALID_MONETARY_FEATURE_VALUE"],String(v));
  }
});
test("A2 r61: legitimate monetary strings, negative, safe numeric zero unchanged",()=>{
  assert.deepEqual(classify("monthlyIncomeWon","2400000"),{valueWon:"2400000",status:"computed",reasons:[]});
  assert.deepEqual(classify("debtRows.principalWon","-100"),{valueWon:"-100",status:"computed",reasons:[]});
  assert.deepEqual(classify("monthlyIncomeWon",0),{valueWon:"0",status:"computed",reasons:[]});
});
test("A2 r61: existing source conflicts and non-monetary outputs preserved",()=>{
  assert.deepEqual(classify("monthlyIncomeWon","0","calculated",["SOURCE_CONFLICT"]),
    {valueWon:"0",status:"conflict",reasons:["SOURCE_CONFLICT"]});
  assert.deepEqual(classify("incomeRows.label","salary"),{valueWon:null,status:"computed",reasons:[]});
  assert.deepEqual(classify("incomeGroups.observedMonths",12),{valueWon:null,status:"computed",reasons:[]});
});
