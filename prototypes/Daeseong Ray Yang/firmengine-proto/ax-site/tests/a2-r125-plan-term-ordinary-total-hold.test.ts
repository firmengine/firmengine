// A2 r125: synthetic-only financial reconciliation invariants.
// Technically reconciled arithmetic is not statutory approval or official-form validation.
import test from "node:test";
import assert from "node:assert/strict";
import { reconcilePlanLedger } from "../lib/plan-reconciliation.ts";
import type { CaseData } from "../lib/domain.ts";
import type { CalculationResult } from "../lib/assessment.ts";
import type { PlanLedger } from "../lib/repayment-plan-model.ts";

type Scenario = "normal" | "observed_zero" | "mismatch" | "null_total" | "bad_total" | "zero_term" | "null_term" | "negative_term" | "fractional_term";

function fixture(months: 36|48|60, scenario:Scenario){
  const explicitZero=scenario==="observed_zero";
  const rows=Array.from({length:months},(_,idx)=>({
    installment:idx+1,paymentDate:"2026-01-01",phaseId:"SYN-phase",
    debtId:"SYN-debt",claimClass:"ordinary",
    principalWon:explicitZero?"0":"1",interestWon:"0",
    otherComponentWon:"0",fundingSourceId:"ordinary_budget",
    balanceAfter:String(explicitZero?0:months-idx-1),sourceIds:["SYN-fact"]
  }));
  const data:any={context:{
    planMonths:months,paymentSchedule:null,monthlyTrusteeFee:{amountWon:"0"},
    monthlyPriorityPayment:{amountWon:"0"},monthlyEstatePayment:{amountWon:"0"}
  },debts:[{id:"SYN-debt",principal:{amountWon:String(explicitZero?0:months)},
    interest:{amountWon:"0"},priority:"ordinary",classification:"ordinary"}]};
  const calculation:any={
    ordinaryRepaymentBudgetWon:explicitZero?"0":"1",monthlyPaymentWon:explicitZero?"0":"1",
    disposableIncomeWon:explicitZero?"0":"1",planTotalWon:String(explicitZero?0:months)
  };
  const ledger:any={status:"complete",issues:[],rows};
  if(scenario==="mismatch") calculation.planTotalWon=String(months+1);
  if(scenario==="null_total") calculation.planTotalWon=null;
  if(scenario==="bad_total") calculation.planTotalWon="1,20";
  if(["zero_term","null_term","negative_term","fractional_term"].includes(scenario)){
    data.context.planMonths=scenario==="null_term"?null:scenario==="negative_term"?-1:scenario==="fractional_term"?1.5:0;
    data.debts=[];ledger.rows=[];calculation.planTotalWon="0";
  }
  return {data:data as CaseData,calculation:calculation as CalculationResult,ledger:ledger as PlanLedger};
}

for(const months of [36,48,60] as const){
  for(const scenario of ["normal","observed_zero","mismatch","null_total","bad_total","zero_term","null_term","negative_term","fractional_term"] as const){
    test(`A2 r125 ${months} months ${scenario}`,()=>{
      const {data,calculation,ledger}=fixture(months,scenario);
      const result=reconcilePlanLedger(data,calculation,ledger);
      const normal=scenario==="normal"||scenario==="observed_zero";
      const expectedStatus=normal?"reconciled":"blocked";
      assert.equal(result.status,expectedStatus);
      if(normal){
        assert.deepEqual(result.issues,[]);
        assert.equal(result.totals.ordinaryWon,scenario==="observed_zero"?"0":String(months));
        assert.equal(result.totals.totalWon,scenario==="observed_zero"?"0":String(months));
      }else if(["zero_term","null_term","negative_term","fractional_term"].includes(scenario)){
        assert.ok(result.issues.includes("PLAN_TERM_UNVERIFIED"));
      }else if(scenario==="mismatch"){
        assert.ok(result.issues.includes("ORDINARY_PLAN_TOTAL_MISMATCH"));
        assert.ok(result.legalReviewTasks?.includes("ORDINARY_ALLOCATION_UNRESOLVED"));
      }else{
        assert.ok(result.issues.includes("ORDINARY_PLAN_TOTAL_UNVERIFIED"));
        assert.ok(result.legalReviewTasks?.includes("ORDINARY_ALLOCATION_UNRESOLVED"));
      }
    });
  }
}
test.todo("Run project Node22+ test, TypeScript check, CI, D1 SQL and official D5110/D5111 DOCX byte round-trip");
