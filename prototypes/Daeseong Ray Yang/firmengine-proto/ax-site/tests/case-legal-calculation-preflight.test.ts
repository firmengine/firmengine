import test from "node:test";
import assert from "node:assert/strict";
import {evaluateLegalCalculationPreflight} from "../lib/case-legal-calculation-preflight.ts";
const base={current:true,engineIssues:[],requiredOutputs:[],observed:[]};
test("unrelated provisional optional values may proceed to legal advisory",()=>{
 const r=evaluateLegalCalculationPreflight({...base,engineIssues:["PRESENT_VALUE_REVIEW_REQUIRED"]});
 assert.equal(r.ready,true);
});
test("deterministic material OCR mismatch/duplicate blocks avoidable legal AI",()=>{
 for(const issue of ["CALC_INPUT_UNCONNECTED_MATERIAL","CALC_INPUT_MULTIPLE_TYPED_MATCHES",
   "CALC_INPUT_AMOUNT_INVALID","CALC_INPUT_AMOUNT_MISMATCH","CALC_INPUT_SOURCE_INVALID"]){
  const r=evaluateLegalCalculationPreflight({...base,engineIssues:[issue+":field:fact"]});
  assert.equal(r.ready,false);assert.equal(r.status,"review_required");
  assert.ok(r.blockers.includes(issue));
 }
});
test("incomplete or unreviewed representative income period blocks unnecessary model cycle",()=>{
 for(const issue of ["INCOME_PERIOD_COVERAGE_INCOMPLETE",
   "INCOME_REPRESENTATIVE_PERIOD_NOT_SELECTED",
   "INCOME_REPRESENTATIVE_PERIOD_REVIEW_REQUIRED"])
   assert.equal(evaluateLegalCalculationPreflight({...base,engineIssues:[issue]}).ready,false);
});
test("approved law-specific required outputs need exactly one calculated source value",()=>{
 const requiredOutputs=["monthlyIncomeWon"];
 for(const observed of [[],[{outputName:"monthlyIncomeWon",status:"blocked",value:"0"}],
 [{outputName:"monthlyIncomeWon",status:"provisional",value:"3000000"}],
 [{outputName:"monthlyIncomeWon",status:"computed",value:null}],
 Array(2).fill({outputName:"monthlyIncomeWon",status:"computed",value:"0"})]){
  const r=evaluateLegalCalculationPreflight({...base,requiredOutputs,observed});
  assert.equal(r.ready,false);
  assert.ok(r.blockers.some(x=>x.startsWith("REQUIRED_LEGAL_CALCULATOR_OUTPUT_UNRESOLVED")));
 }
 assert.equal(evaluateLegalCalculationPreflight({...base,requiredOutputs,
   observed:[{outputName:"monthlyIncomeWon",status:"computed",value:"0"}]}).ready,true);
});
test("no latest calculate run waits; it never substitutes an old run",()=>{
 const r=evaluateLegalCalculationPreflight({...base,current:false});
 assert.equal(r.status,"waiting_evidence");assert.equal(r.retryable,true);
});
