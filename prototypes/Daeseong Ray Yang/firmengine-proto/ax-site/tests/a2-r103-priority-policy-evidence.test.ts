import test from "node:test";
import assert from "node:assert/strict";
import { createCase, normalizeMoney } from "../lib/domain.ts";
import type { CalculationResult } from "../lib/assessment.ts";
import { reconcilePlanLedger, type PriorityCoveragePolicy } from "../lib/plan-reconciliation.ts";
import type { PlanLedger, PlanLedgerRow } from "../lib/repayment-plan-model.ts";

// Purely synthetic technical contract data: never legal acceptance or validated source facts.
function fixture(term:36|48|60, monthly:"0"|"1", principalWon:string) {
 const data=createCase("SYN priority coverage", "SYN-A2-R103-"+term, "2026-11-03");
 data.context.planMonths=term;
 data.context.monthlyPriorityPayment=normalizeMoney(monthly);
 data.context.monthlyEstatePayment=normalizeMoney("0");
 data.context.monthlyTrusteeFee=normalizeMoney("0");
 data.debts=[{
  id:"SYN-D1", creditor:"SYN creditor", secured:"no", classification:"tax", priority:"priority",
  principal:normalizeMoney(principalWon), interest:normalizeMoney("0"), factIds:[],
 }];
 const calculation={
  ordinaryRepaymentBudgetWon:"0", monthlyPaymentWon:monthly,
  disposableIncomeWon:monthly, planTotalWon:"0",
 } as CalculationResult;
 const rows:PlanLedgerRow[]=Array.from({length:term},(_,index)=>({
  installment:index+1,paymentDate:null,phaseId:"SYN-PHASE",debtId:"SYN-D1",
  claimClass:"priority",principalWon:monthly,interestWon:"0",
  otherComponentWon:"0",fundingSourceId:"priority_budget",
  balanceAfter:principalWon==="0"?"0":String(Math.max(0,Number(principalWon)-(index+1)*Number(monthly))),
  sourceIds:[],
 }));
 const ledger:PlanLedger={status:"complete",issues:[],rows};
 return {data,calculation,ledger};
}
type Scenario={
 name:string; monthly:"0"|"1"; zeroDebt?:boolean;
 policy:"omitted"|"empty"|"null"|"unknown"|"invalid"|"confirmed"|"bad_deadline";
 expected:"unknown"|"covered"|"blocked";
};
const scenarios:Scenario[]=[
 {name:"absent options",monthly:"1",policy:"omitted",expected:"unknown"},
 {name:"empty policy record",monthly:"1",policy:"empty",expected:"unknown"},
 {name:"null policy",monthly:"1",policy:"null",expected:"unknown"},
 {name:"unreviewed policy",monthly:"1",policy:"unknown",expected:"unknown"},
 {name:"unrecognized applicability",monthly:"1",policy:"invalid",expected:"unknown"},
 {name:"invalid deadline",monthly:"1",policy:"bad_deadline",expected:"unknown"},
 {name:"explicit confirmed full payment",monthly:"1",policy:"confirmed",expected:"covered"},
 {name:"unobserved policy with explicit zero debt",monthly:"0",zeroDebt:true,policy:"omitted",expected:"unknown"},
 {name:"confirmed explicit zero debt",monthly:"0",zeroDebt:true,policy:"confirmed",expected:"covered"},
 {name:"confirmed full nonpayment",monthly:"0",policy:"confirmed",expected:"blocked"},
];
for(const term of [36,48,60] as const)for(const scenario of scenarios){
 test(`A2-DATA-r103: ${term} installments / ${scenario.name}`,()=>{
  const {data,calculation,ledger}=fixture(term,scenario.monthly,scenario.zeroDebt?"0":String(term));
  const p=scenario.policy;
  const policy=p==="null"?null:p==="unknown"?{deadlineInstallment:term,applicability:"unknown"}:
   p==="invalid"?{deadlineInstallment:term,applicability:"unreviewed"}:
   p==="bad_deadline"?{deadlineInstallment:0,applicability:"confirmed"}:
   {deadlineInstallment:term,applicability:"confirmed"};
  const opts=p==="omitted"?undefined:{priorityPolicies:p==="empty"?{}:{"SYN-D1":policy as PriorityCoveragePolicy}};
  const result=opts===undefined?reconcilePlanLedger(data,calculation,ledger):reconcilePlanLedger(data,calculation,ledger,opts);
  const coverage=result.priorityCoverage["SYN-D1"];
  assert.equal(coverage?.status,scenario.expected);
  assert.equal(result.totals.priorityWon,scenario.monthly==="0"?"0":String(term));
  assert.equal(result.totals.ordinaryWon,"0");
  if(scenario.expected==="unknown"){
   assert.equal(result.status,"reconciled"); // technical sum, never legal approval
   assert.ok(result.legalReviewTasks?.includes("PRIORITY_COVERAGE_POLICY_REVIEW:SYN-D1"));
  }else if(scenario.expected==="covered"){
   assert.ok(!result.legalReviewTasks?.includes("PRIORITY_COVERAGE_POLICY_REVIEW:SYN-D1"));
   assert.equal(result.status,"reconciled");
  }else{
   assert.equal(result.status,"blocked");
   assert.ok(result.issues.includes("PRIORITY_ESTATE_NOT_FULLY_PAID_BY_DEADLINE:SYN-D1"));
  }
 });
}
