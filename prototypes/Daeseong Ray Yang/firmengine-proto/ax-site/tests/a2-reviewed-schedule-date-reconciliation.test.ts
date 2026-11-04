import test from "node:test";
import assert from "node:assert/strict";
import {createCase,normalizeMoney} from "../lib/domain.ts";
import type {CalculationResult} from "../lib/assessment.ts";
import {buildRepaymentPlanModel} from "../lib/repayment-plan-model.ts";
import {reconcilePlanLedger} from "../lib/plan-reconciliation.ts";

/** Synthetic-only test: a date integrity guard does not establish court acceptance. */
function fixture(options:{reviewed?:boolean;startDate?:string;splitSecondDate?:string|null;zero?:boolean}={}){
 const d=createCase("Synthetic schedule date reconciliation","synthetic-a2-date","2026-10-30");
 const amount=options.zero?"0":"20",monthly=options.zero?"0":"10";
 d.context.planMonths=2;
 d.context.monthlyTrusteeFee=normalizeMoney("0");
 d.debts=[{id:"d1",creditor:"Synthetic creditor",principal:normalizeMoney(amount),
   interest:normalizeMoney("0"),secured:"no",classification:"ordinary",priority:"ordinary",
   asOf:d.context.asOf,factIds:[]}];
 const common={monthlyAvailableWon:monthly,allocations:[{creditorId:"d1",principalWon:monthly,interestWon:"0"}]};
 const phases=options.splitSecondDate===undefined
  ?[{id:"p1",firstInstallment:1,lastInstallment:2,...(options.startDate?{firstPaymentDate:options.startDate}:{}),...common}]
  :[{id:"p1",firstInstallment:1,lastInstallment:1,firstPaymentDate:options.startDate??"2026-01-31",...common},
    {id:"p2",firstInstallment:2,lastInstallment:2,...(options.splitSecondDate?{firstPaymentDate:options.splitSecondDate}:{}),...common}];
 d.context.paymentSchedule={reviewed:options.reviewed??true,reviewReason:"Synthetic internal scheduling check",
   expectedInstallments:2,phases};
 const calculation={caseRevision:d.context.revision,planTotalWon:amount,ordinaryRepaymentBudgetWon:monthly,
   monthlyPaymentWon:monthly,disposableIncomeWon:monthly,allocations:[]} as unknown as CalculationResult;
 return {d,calculation};
}

test("reviewed two-month repayment schedule without any due dates must not reconcile",()=>{
 const {d,calculation}=fixture();
 const ledger=buildRepaymentPlanModel(d,calculation);
 assert.equal(ledger.status,"complete","fixture confirms the ledger previously accepted an undated schedule");
 assert.deepEqual([...new Set(ledger.rows.map(row=>row.paymentDate))],[null]);
 const result=reconcilePlanLedger(d,calculation,ledger);
 assert.equal(result.status,"blocked");
 assert.ok(result.issues.includes("REVIEWED_PAYMENT_DATE_MISSING:1"));
 assert.ok(result.issues.includes("REVIEWED_PAYMENT_DATE_MISSING:2"));
});
test("a split plan with one missing second due date blocks only the missing installment",()=>{
 const {d,calculation}=fixture({startDate:"2026-01-31",splitSecondDate:null});
 const ledger=buildRepaymentPlanModel(d,calculation);
 assert.equal(ledger.status,"complete");
 const result=reconcilePlanLedger(d,calculation,ledger);
 assert.equal(result.status,"blocked");
 assert.ok(result.issues.includes("REVIEWED_PAYMENT_DATE_MISSING:2"));
 assert.ok(!result.issues.includes("REVIEWED_PAYMENT_DATE_MISSING:1"));
});
test("reviewed schedule with a concrete date remains reconciled",()=>{
 const {d,calculation}=fixture({startDate:"2026-01-31"});
 const ledger=buildRepaymentPlanModel(d,calculation);
 assert.equal(ledger.status,"complete");
 const result=reconcilePlanLedger(d,calculation,ledger);
 assert.equal(result.status,"reconciled",result.issues.join(","));
 assert.ok(!result.issues.some(code=>code.startsWith("REVIEWED_PAYMENT_DATE_MISSING")));
});
test("known zero claim is not confused with absent due date or missing money",()=>{
 const {d,calculation}=fixture({startDate:"2026-01-31",zero:true});
 const ledger=buildRepaymentPlanModel(d,calculation);
 assert.equal(ledger.status,"complete");
 const result=reconcilePlanLedger(d,calculation,ledger);
 assert.equal(result.status,"reconciled",result.issues.join(","));
 assert.equal(result.totals.totalWon,"0");
});
test("unreviewed schedule is not mistaken for an approved dated plan",()=>{
 const {d,calculation}=fixture({reviewed:false});
 const ledger=buildRepaymentPlanModel(d,calculation);
 assert.equal(ledger.status,"provisional");
 const result=reconcilePlanLedger(d,calculation,ledger);
 assert.ok(!result.issues.some(code=>code.startsWith("REVIEWED_PAYMENT_DATE_MISSING")));
});
