// A2 r126: synthetic-only verification of ledger review state, not legal approval.
// Actual tests require the project's Node/TypeScript test runner.
import test from "node:test";
import assert from "node:assert/strict";
import { reconcilePlanLedger } from "../lib/plan-reconciliation.ts";
import type { CaseData } from "../lib/domain.ts";
import type { CalculationResult } from "../lib/assessment.ts";
import type { PlanLedger } from "../lib/repayment-plan-model.ts";

function fixture(months:36|48|60, status:PlanLedger["status"], observedZero=false) {
  const value=observedZero?"0":"1";
  const rows=Array.from({length:months},(_,i)=>({
    installment:i+1,paymentDate:null,phaseId:"SYN",debtId:"SYN-debt",
    claimClass:"ordinary" as const,principalWon:value,interestWon:"0",
    otherComponentWon:"0",balanceAfter:observedZero?"0":String(months-i-1),
    fundingSourceId:"ordinary_budget",sourceIds:["SYN-fact"]
  }));
  const data={
    context:{planMonths:months,paymentSchedule:null,monthlyTrusteeFee:{amountWon:"0"},
      monthlyPriorityPayment:{amountWon:"0"},monthlyEstatePayment:{amountWon:"0"}},
    debts:[{id:"SYN-debt",principal:{amountWon:observedZero?"0":String(months)},
      interest:{amountWon:"0"},priority:"ordinary",classification:"ordinary"}]
  } as unknown as CaseData;
  const calculation={
    ordinaryRepaymentBudgetWon:value,monthlyPaymentWon:value,
    disposableIncomeWon:value,planTotalWon:observedZero?"0":String(months)
  } as unknown as CalculationResult;
  const ledger={status,issues:[],rows} as unknown as PlanLedger;
  return {data,calculation,ledger};
}
for(const months of [36,48,60] as const) {
  test(`r126 ${months} reviewed complete may reconcile`,()=>{
    const f=fixture(months,"complete");
    const r=reconcilePlanLedger(f.data,f.calculation,f.ledger);
    assert.equal(r.status,"reconciled");
    assert.deepEqual(r.issues,[]);
    assert.equal(r.totals.ordinaryWon,String(months));
  });
  test(`r126 ${months} provisional arithmetic cannot be final reconciled`,()=>{
    const f=fixture(months,"provisional");
    const r=reconcilePlanLedger(f.data,f.calculation,f.ledger);
    assert.equal(r.status,"blocked");
    assert.ok(r.issues.includes("PLAN_LEDGER_NOT_REVIEWED"));
    assert.equal(r.totals.ordinaryWon,String(months));
  });
  test(`r126 ${months} original blocked status remains blocked`,()=>{
    const f=fixture(months,"blocked");
    const r=reconcilePlanLedger(f.data,f.calculation,f.ledger);
    assert.equal(r.status,"blocked");
    assert.ok(r.issues.includes("PLAN_LEDGER_BLOCKED"));
  });
  test(`r126 ${months} explicit zero provisional stays distinct from accepted zero`,()=>{
    const f=fixture(months,"provisional",true);
    const r=reconcilePlanLedger(f.data,f.calculation,f.ledger);
    assert.equal(r.totals.ordinaryWon,"0");
    assert.equal(r.status,"blocked");
    assert.ok(r.issues.includes("PLAN_LEDGER_NOT_REVIEWED"));
  });
}
test("r126 unexpected status is held, never treated as complete",()=>{
  const f=fixture(36,"complete");
  const corrupted={...f.ledger,status:"unknown"} as unknown as PlanLedger;
  const r=reconcilePlanLedger(f.data,f.calculation,corrupted);
  assert.equal(r.status,"blocked");
  assert.ok(r.issues.includes("PLAN_LEDGER_NOT_REVIEWED"));
});
test.todo("Actual integrated Node22/TS, SQL D1 and D5110/D5111 DOCX verification");
test.todo("Priority policy absence, null amounts and legal period exception need joint review");
