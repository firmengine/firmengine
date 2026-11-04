// A2 r128 — entirely synthetic. Gate assertion != 법원/변호사 승인.
// Project Node22+ TypeScript runner/CI must execute these tests before merger.
import test from "node:test";
import assert from "node:assert/strict";
import { planFinalizationBlockers } from "../lib/case-execution.ts";

type Ledger=Parameters<typeof planFinalizationBlockers>[0];
type Reconciliation=Parameters<typeof planFinalizationBlockers>[1];
type Schedule=Parameters<typeof planFinalizationBlockers>[3];
function ledger(term:number, status:Ledger["status"]="provisional", amount:"0"|"1"="1"):Ledger {
  const rows=Array.from({length:term},(_,i)=>({
    installment:i+1,principalWon:amount,interestWon:"0",otherComponentWon:"0",
    balanceAfter:"0",claimClass:"ordinary",debtId:"SYN-debt",sourceIds:["SYN-fact"]
  }));
  return {status,issues:[],rows} as unknown as Ledger;
}
function recon(status:Reconciliation["status"]="reconciled",issues:string[]=[],legalReviewTasks:string[]=[]):Reconciliation {
  return {status,issues,legalReviewTasks} as unknown as Reconciliation;
}
for(const term of [36,48,60]){
  test(`r128 ${term} recorded installments with null plan total cannot silently pass`,()=>{
    const input=ledger(term,"provisional","1");
    const independent=Array.from({length:term},()=>1n).reduce((a,b)=>a+b,0n);
    assert.equal(independent,BigInt(term));
    assert.deepEqual(planFinalizationBlockers(input,recon(),null,null),["PLAN_TOTAL_UNOBSERVED"]);
  });
  test(`r128 ${term} actual zero must not be replaced by missing/null`,()=>{
    assert.deepEqual(planFinalizationBlockers(ledger(term,"complete","0"),recon(),"0",null),[]);
  });
  test(`r128 ${term} priority policy unverified remains independent hold`,()=>{
    const task="PRIORITY_COVERAGE_POLICY_REVIEW:SYN-debt";
    assert.deepEqual(planFinalizationBlockers(ledger(term),recon("reconciled",[],[task]),null,null),["PLAN_TOTAL_UNOBSERVED",task]);
  });
}
test("r128 blocked reconciliation with no asserted reason cannot silently pass",()=>{
  assert.deepEqual(planFinalizationBlockers(ledger(0,"blocked"),recon("blocked"),null,null),["PLAN_RECONCILIATION_UNVERIFIED"]);
});
test("r128 absent calculation and absent plan rows are not asserted to be zero",()=>{
  assert.deepEqual(planFinalizationBlockers(ledger(0),recon(),null,null),[]);
});
test("r128 explicit schedule review pending is a distinct finalization hold",()=>{
  const schedule={phases:[{}],reviewed:false,reviewReason:""} as unknown as Schedule;
  assert.deepEqual(planFinalizationBlockers(ledger(0,"complete"),recon(),"0",schedule),["PAYMENT_SCHEDULE_REVIEW_REQUIRED"]);
});
test.todo("Run full existing Node/TypeScript tests and staging D1 + D5110/D5111 byte round-trip");
test.todo("Lawyer/accounting approval of priority policies, first filing date, and repayment duration");
