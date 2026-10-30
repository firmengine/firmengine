import test from "node:test";
import assert from "node:assert/strict";
import {createCase, normalizeMoney} from "../lib/domain.ts";
import {reconcilePlanLedger} from "../lib/plan-reconciliation.ts";
import type {CalculationResult} from "../lib/assessment.ts";
import type {PlanLedger, PlanClaimClass} from "../lib/repayment-plan-model.ts";

/** Synthetic-only input: a code-integrity test, not a court or legal approval. */
function fixture(){
 const data=createCase("Synthetic ledger integrity","synthetic-a2-ledger-r08","2026-10-30");
 data.context.planMonths=1;
 data.context.monthlyTrusteeFee=normalizeMoney("0");
 data.debts=[{id:"d1",creditor:"Synthetic creditor",principal:normalizeMoney("10"),
   interest:normalizeMoney("0"),secured:"no",classification:"ordinary",priority:"ordinary",
   asOf:data.context.asOf,factIds:[]}];
 const calculation={
   caseRevision:data.context.revision,planTotalWon:"1",
   ordinaryRepaymentBudgetWon:"10",monthlyPaymentWon:"10",disposableIncomeWon:"10",
   allocations:[]
 } as unknown as CalculationResult;
 const ledger:PlanLedger={status:"complete",issues:[],rows:[{
   installment:1,paymentDate:"2026-11-30",phaseId:"synthetic-phase",debtId:"d1",
   claimClass:"ordinary",principalWon:"1",interestWon:"0",otherComponentWon:"0",
   balanceAfter:"9",fundingSourceId:"ordinary_budget",sourceIds:[]
 }]};
 return {data,calculation,ledger};
}
test("a consistent 1-Won claim allocation still reconciles",()=>{
 const {data,calculation,ledger}=fixture();
 const result=reconcilePlanLedger(data,calculation,ledger);
 assert.equal(result.status,"reconciled",result.issues.join(","));
 assert.equal(result.totals.totalWon,"1");
});
test("malformed principal stops without throwing on BigInt",()=>{
 const {data,calculation,ledger}=fixture();
 ledger.rows[0]!.principalWon="oops";
 const result=reconcilePlanLedger(data,calculation,ledger);
 assert.equal(result.status,"blocked");
 assert.ok(result.issues.includes("INVALID_LEDGER_ROW:1"));
 assert.deepEqual(result.legalReviewTasks,["LEDGER_INPUT_STRUCTURAL_FAILURE"]);
});
test("an absent principal is not an observed zero",()=>{
 const {data,calculation,ledger}=fixture();
 ledger.rows[0]!.principalWon=null as unknown as typeof ledger.rows[number]["principalWon"];
 const result=reconcilePlanLedger(data,calculation,ledger);
 assert.equal(result.status,"blocked");
 assert.ok(result.issues.includes("INVALID_LEDGER_ROW:1"));
});
test("an unknown interest value stops rather than throwing",()=>{
 const {data,calculation,ledger}=fixture();
 ledger.rows[0]!.interestWon="unknown";
 const result=reconcilePlanLedger(data,calculation,ledger);
 assert.equal(result.status,"blocked");
});
test("unknown claim class cannot silently enter trustee-fee totals",()=>{
 const {data,calculation,ledger}=fixture();
 ledger.rows[0]!.claimClass="invented" as PlanClaimClass;
 const result=reconcilePlanLedger(data,calculation,ledger);
 assert.equal(result.status,"blocked");
 assert.ok(result.issues.includes("INVALID_LEDGER_ROW:1"));
 assert.deepEqual(result.priorityCoverage,{});
});
test("claim funding identity must match the ledger class",()=>{
 const {data,calculation,ledger}=fixture();
 ledger.rows[0]!.fundingSourceId="priority_budget";
 const result=reconcilePlanLedger(data,calculation,ledger);
 assert.equal(result.status,"blocked");
 assert.ok(result.issues.includes("INVALID_LEDGER_ROW:1"));
});
test("numeric yet inflated after-payment balance fails conservation",()=>{
 const {data,calculation,ledger}=fixture();
 ledger.rows[0]!.balanceAfter="999";
 const result=reconcilePlanLedger(data,calculation,ledger);
 assert.equal(result.status,"blocked");
 assert.ok(result.issues.includes("BALANCE_AFTER_MISMATCH:d1:1"));
});
test("a verified zero is not treated as missing money",()=>{
 const {data,calculation,ledger}=fixture();
 ledger.rows[0]!.principalWon="0";
 ledger.rows[0]!.balanceAfter="10";
 calculation.planTotalWon="0";
 const result=reconcilePlanLedger(data,calculation,ledger);
 assert.equal(result.status,"reconciled",result.issues.join(","));
 assert.equal(result.totals.totalWon,"0");
});
test("a malformed row never masks an already-blocked upstream ledger",()=>{
 const {data,calculation,ledger}=fixture();
 ledger.status="blocked";
 ledger.issues=["SOURCE_MISSING"];
 ledger.rows[0]!.principalWon="oops";
 const result=reconcilePlanLedger(data,calculation,ledger);
 assert.equal(result.status,"blocked");
 assert.ok(result.issues.includes("SOURCE_MISSING"));
 assert.ok(result.issues.includes("INVALID_LEDGER_ROW:1"));
});
