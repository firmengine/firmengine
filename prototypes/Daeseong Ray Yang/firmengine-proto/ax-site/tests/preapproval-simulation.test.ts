import test from "node:test";
import assert from "node:assert/strict";
import {simulatePreapprovalCase} from "../lib/preapproval-simulation.ts";
function testCase(){return {context:{id:"synthetic",revision:10,planMonths:36,monthlyPriorityPayment:{amountWon:"100000",normalizationStatus:"exact"}},
  household:{additionalLivingCost:{amountWon:"0",normalizationStatus:"exact"}},facts:[{id:"original",value:"keep"}],incomes:[],debts:[],assets:[],transactions:[]};}
const engine=(d:any)=>{const cash=BigInt(2000000)-BigInt(d.context.monthlyPriorityPayment?.amountWon??"0")-BigInt(d.household.additionalLivingCost?.amountWon??"0");
 return {assessment:{calculation:{ordinaryRepaymentBudgetWon:cash.toString(),planTotalWon:(cash*BigInt(d.context.planMonths)).toString(),
  monthlyIncomeWon:"2500000",issues:[]}},courtApprovalInferred:false as const};};
test("what-if scenarios use only a cloned case, preserve original recognized facts and never imply approval",()=>{
 const d=testCase(),before=JSON.stringify(d);
 const r=simulatePreapprovalCase(d as any,[{path:"household.additionalLivingCost",candidateWon:"250000",basisFactIds:["receipt-1"],reason:"hypothetical cost recognition"}],engine);
 assert.equal(JSON.stringify(d),before);
 assert.deepEqual(r.differences.map(x=>x.outputName),["ordinaryRepaymentBudgetWon","planTotalWon"]);
 assert.equal(r.differences[0].original,"1900000");assert.equal(r.differences[0].hypothetical,"1650000");
 assert.equal(r.humanLegalAcceptanceGranted,false);assert.equal(r.courtApprovalInferred,false);
});
test("future plan months are deliberately not a determination of shortened term eligibility",()=>{
 const r=simulatePreapprovalCase(testCase() as any,[{path:"context.planMonths",candidateMonths:24,basisFactIds:[],reason:"test-only"}],engine);
 assert.equal(r.differences.find(x=>x.outputName==="planTotalWon")?.hypothetical,"45600000");
 assert.equal(r.legallyRecognizedAmounts,false);
});
test("no duplicates, nonnumbers, negative amounts, arbitrary new fields or unreviewed automatic approvals",()=>{
 const d=testCase();
 const e=(path:string,value:string)=>[{path,candidateWon:value,basisFactIds:[],reason:"synthetic"}];
 assert.throws(()=>simulatePreapprovalCase(d as any,e("household.additionalLivingCost","-1") as any,engine),/INVALID_SCENARIO_AMOUNT/);
 assert.throws(()=>simulatePreapprovalCase(d as any,e("context.adminPassword","100") as any,engine),/INVALID_SCENARIO_FIELD/);
 assert.throws(()=>simulatePreapprovalCase(d as any,[...e("context.monthlyPriorityPayment","10"),...e("context.monthlyPriorityPayment","20")] as any,engine),/INVALID_SCENARIO_EDIT_SET/);
});
