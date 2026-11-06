import test from "node:test";
import assert from "node:assert/strict";
import {adaptCalculationInput} from "../lib/calculation-adapter.ts";
import type {CaseData} from "../lib/domain.ts";
import type {CalculationResult} from "../lib/assessment.ts";

function makeCase(recognition:string|undefined="accepted",recognizedMembers:number|null=3,reportedMembers:number|null=3,planMonths:number|null=36):CaseData{
 return {context:{revision:8,planMonths},household:{recognition,recognizedMembers,reportedMembers,recognizedLivingCost:{amountWon:"1800000"},factIds:[]},incomes:[]} as unknown as CaseData;
}
function makeResult(patch:Record<string,unknown>={}):CalculationResult{
 return {caseRevision:8,monthlyIncomeWon:"3600000",recognizedLivingCostWon:"1800000",ordinaryRepaymentBudgetWon:"1800000",issues:[],traces:[{status:"calculated"}],...patch} as unknown as CalculationResult;
}
for(const [label,recognition,members,reported,expected] of [
 ["accepted complete","accepted",3,3,"ready"],
 ["unreviewed numeric","unreviewed",3,3,"provisional"],
 ["rejected numeric","rejected",3,3,"provisional"],
 ["missing accepted member count","accepted",null,3,"provisional"],
 ["zero accepted member count","accepted",0,3,"provisional"],
 ["reported/recognized difference may be reviewed","accepted",1,3,"ready"],
] as const){
 test(`A1 r82 adapter ${label}`,()=>{
   const x=adaptCalculationInput(makeCase(recognition,members,reported),makeResult());
   assert.equal(x.status,expected);
   assert.equal(x.inputs[1].value,"1800000");
 });
}
test("A1 r82 explicit numeric 0 is not missing evidence",()=>{
 const x=adaptCalculationInput(makeCase(),makeResult({recognizedLivingCostWon:"0",ordinaryRepaymentBudgetWon:"0"}));
 assert.equal(x.status,"ready");
 assert.equal(x.inputs[1].value,"0");
});
test("A1 r82 stale and missing numeric data remain blocked",()=>{
 assert.equal(adaptCalculationInput(makeCase(),makeResult({caseRevision:7})).status,"blocked");
 assert.equal(adaptCalculationInput(makeCase(),makeResult({recognizedLivingCostWon:null})).status,"blocked");
});
test("A1 r82 trace provisional stays provisional, no plan remains not applicable",()=>{
 assert.equal(adaptCalculationInput(makeCase(),makeResult({traces:[{status:"provisional"}]})).status,"provisional");
 assert.equal(adaptCalculationInput(makeCase("unreviewed",null,3,null),makeResult()).status,"not_applicable");
});
