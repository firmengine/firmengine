import test from "node:test";
import assert from "node:assert/strict";
import {calculateCase} from "../lib/assessment.ts";
import {createCase,normalizeMoney} from "../lib/domain.ts";
import {buildFormBindings} from "../lib/form-mapping.ts";

const rules={id:"synthetic",status:"source_verified" as const,sources:[]};
function fixture(){
 const data=createCase("synthetic reviewed income","synthetic-budget-guard","2026-10-30");
 const sha="e".repeat(64),quote="2026 October net earnings KRW 3000000";
 data.documents=[{id:"doc",name:"synthetic.pdf",sha256:sha,status:"active",pages:[1]}];
 data.pages=[{documentId:"doc",page:1,role:"evidence",text:quote}];
 data.facts=[{id:"net-1",logicalId:"net-1",version:1,subjectId:"business-1",key:"income.net",
  value:"3000000",rawValue:"3000000",sourceUnit:"KRW",numeric:normalizeMoney("3000000"),
  state:"verified",recognition:"accepted",
  refs:[{documentId:"doc",page:1,quote,sourceHash:sha}],validation:[]}];
 data.incomes=[{id:"business-1",kind:"business",label:"synthetic business",payerIdentityId:"biz-synthetic",
  amountBasis:"monthly",net:normalizeMoney("3000000"),periodStart:"2026-10-01",periodEnd:"2026-10-31",
  recurring:"yes",recognition:"accepted",factIds:["net-1"]}];
 data.household={recognizedMembers:1,recognizedLivingCost:normalizeMoney("1500000"),
  livingCostIncludesAdditional:true,recognition:"accepted",factIds:[]};
 Object.assign(data.context,{inventoryComplete:{income:"yes",debt:"yes",asset:"yes"},
  filingPeriod:{start:"2026-10-01",end:"2026-10-31"},incomePeriodReviewed:true,
  monthlyTrusteeFee:normalizeMoney("0"),monthlyPriorityPayment:normalizeMoney("0"),
  monthlyEstatePayment:normalizeMoney("0"),approvedMonthlyPayment:normalizeMoney("1000000"),planMonths:36});
 return data;
}
test("reviewed affordable payment still projects into 36-month plan",()=>{
 const c=calculateCase(fixture(),rules);
 assert.equal(c.monthlyIncomeWon,"3000000");
 assert.equal(c.ordinaryRepaymentBudgetWon,"1500000");
 assert.equal(c.monthlyPaymentWon,"1000000");
 assert.equal(c.planTotalWon,"36000000");
});
test("unknown living cost never allows approved payment to invent a plan total",()=>{
 const d=fixture();d.household.recognizedLivingCost=null;
 const c=calculateCase(d,rules);
 assert.equal(c.ordinaryRepaymentBudgetWon,null);
 assert.equal(c.monthlyPaymentWon,null);
 assert.equal(c.planTotalWon,null);
});
test("unknown priority or estate payment blocks proposed monthly payment",()=>{
 for(const field of ["monthlyPriorityPayment","monthlyEstatePayment","monthlyTrusteeFee"] as const){
  const d=fixture();d.context[field]=null;
  const c=calculateCase(d,rules);
  assert.equal(c.ordinaryRepaymentBudgetWon,null,field);
  assert.equal(c.monthlyPaymentWon,null,field);
  assert.equal(c.planTotalWon,null,field);
 }
});
test("payment proposal above ordinary budget remains an issue, not a computed amount or form value",()=>{
 const d=fixture();d.context.approvedMonthlyPayment=normalizeMoney("1600000");
 const c=calculateCase(d,rules);
 assert.equal(c.ordinaryRepaymentBudgetWon,"1500000");
 assert.equal(c.monthlyPaymentWon,null);
 assert.equal(c.planTotalWon,null);
 assert.ok(c.issues.includes("PAYMENT_EXCEEDS_DISPOSABLE_INCOME"));
 assert.notEqual(buildFormBindings(d,c).scalars.monthly_payment,"1,600,000");
});
test("negative ordinary budget cannot be overridden by a positive proposed installment",()=>{
 const d=fixture();d.household.recognizedLivingCost=normalizeMoney("3100000");
 const c=calculateCase(d,rules);
 assert.equal(c.ordinaryRepaymentBudgetWon,"-100000");
 assert.equal(c.monthlyPaymentWon,null);
 assert.equal(c.planTotalWon,null);
});
