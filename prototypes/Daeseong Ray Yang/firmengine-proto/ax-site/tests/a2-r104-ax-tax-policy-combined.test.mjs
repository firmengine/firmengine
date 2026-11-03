// A2 r104 SYNTHETIC ONLY. Technical policy presence is not legal recognition.
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMoney } from "../lib/domain.ts";
import { reconcilePlanLedger } from "../lib/plan-reconciliation.ts";

const terms=[36,48,60];
const classes=["priority","tax","estate"];
const scenarios=["no_policy","empty_policy","confirmed","unknown","unpaid_confirmed","zero_without_policy"];
for(const term of terms) for(const cls of classes) for(const scenario of scenarios) {
  test(`A2-AX-r104 SYN ${term}m/${cls}/${scenario} policy and amount separation`,()=>{
    const zero=scenario==="zero_without_policy", paid=scenario!=="unpaid_confirmed";
    const rows=Array.from({length:term},(_,i)=>({
      installment:i+1,paymentDate:null,phaseId:"SYN-PHASE",debtId:"SYN-DEBT",
      claimClass:cls==="tax"?"priority":cls,
      principalWon:paid&&!zero?"1":"0",interestWon:"0",otherComponentWon:"0",
      balanceAfter:zero?"0":String(Math.max(term-i-1,0)),
      fundingSourceId:cls==="estate"?"estate_budget":"priority_budget",sourceIds:["SYN-FACT"]
    }));
    const money=amountWon=>normalizeMoney(amountWon);
    const data={
      context:{planMonths:term,monthlyPriorityPayment:money("1"),monthlyEstatePayment:money("1"),monthlyTrusteeFee:money("0")},
      debts:[{id:"SYN-DEBT",classification:cls,priority:cls==="tax"?"ordinary":cls,
        principal:money(zero?"0":String(term)),interest:money("0"),factIds:["SYN-FACT"]}]
    };
    const calc={ordinaryRepaymentBudgetWon:"0",monthlyPaymentWon:"1",disposableIncomeWon:"1",planTotalWon:"0"};
    const priorityPolicies=scenario==="no_policy"||scenario==="zero_without_policy"?undefined
      :scenario==="empty_policy"?{}
      :{"SYN-DEBT":{deadlineInstallment:term,applicability:scenario==="unknown"?"unknown":"confirmed"}};
    const actual=reconcilePlanLedger(data,calc,{status:"complete",rows,issues:[]},{priorityPolicies});
    const expected=["no_policy","empty_policy","unknown","zero_without_policy"].includes(scenario)
      ?"unknown":scenario==="unpaid_confirmed"?"blocked":"covered";
    assert.equal(actual.priorityCoverage["SYN-DEBT"]?.status,expected);
    assert.equal(actual.totals.totalWon,String(zero||!paid?0:term),"independent BigInt 1won/month sum");
    assert.equal(actual.totals.principalWon,String(zero||!paid?0:term));
    assert.equal(actual.legalReviewTasks?.some(s=>s==="PRIORITY_COVERAGE_POLICY_REVIEW:SYN-DEBT")??false,expected==="unknown");
    assert.equal(actual.status,scenario==="unpaid_confirmed"?"blocked":"reconciled",
      "reconciled is only a technical sum state; legalReviewTasks remains an independent final gate");
    if(scenario==="unpaid_confirmed")assert.ok(actual.issues.includes("PRIORITY_ESTATE_NOT_FULLY_PAID_BY_DEADLINE:SYN-DEBT"));
  });
}
test.todo("A2 r104: policy confirmed requires real reviewed Fact, date, court, approval identity");
test.todo("A2 r104: integrate PR #194 + #203 + #215 + #221 with malformed Won errors and API final gates");
test.todo("A2 r104: full project Node/CI, staging D1/R2/Cron and actual D5103/D5106/D5110/D5111 DOCX re-read");
