// Synthetic inputs only. These 42 standalone tests are not full project CI, D1 or DOCX parity.
import test from "node:test";
import assert from "node:assert/strict";
import { reconciledCreditorMonthlyWon } from "../lib/plan-form-monthly-guard.ts";

function fixture(months: number, type: string) {
  const principal = type === "explicit_zero" ? "0" : "1";
  const rows = Array.from({length:months},(_,i)=>({installment:i+1,debtId:"SYN-D",claimClass:"ordinary",principalWon:principal,interestWon:"0",otherComponentWon:"0"}));
  const expected = type === "explicit_zero" ? 0n : BigInt(months);
  const totals = {principalWon:expected.toString(),interestWon:"0",otherComponentWon:"0",totalWon:expected.toString(),ordinaryWon:expected.toString(),priorityWon:"0",estateWon:"0",trusteeFeeWon:"0"};
  const ledger = {status:"complete",rows};
  const reconciliation = {status:"reconciled",totals,unallocatedBudgets:Object.fromEntries(Array.from({length:months},(_,i)=>[`${i+1}:disposable_income`,"0"])) as Record<string,unknown>,legalReviewTasks:[] as string[]};
  switch (type) {
    case "blocked_ledger": ledger.status="blocked";break;
    case "blocked_reconciliation": reconciliation.status="blocked";break;
    case "stale_total_zero": totals.totalWon="0";totals.principalWon="0";totals.ordinaryWon="0";break;
    case "missing_period": rows.pop();break;
    case "malformed_money": rows[0].principalWon="1,20";break;
    case "null_money": (rows[0] as any).interestWon=null;break;
    case "unverified_policy": reconciliation.legalReviewTasks.push("SYN-REVIEW");break;
    case "missing_budget": delete reconciliation.unallocatedBudgets["1:disposable_income"];break;
    case "unbalanced_month": rows[0].principalWon="2";totals.principalWon=(expected+1n).toString();totals.totalWon=(expected+1n).toString();totals.ordinaryWon=(expected+1n).toString();break;
    case "wrong_claim_class": rows[0].claimClass="unknown";break;
    case "trustee_fee": for(let i=1;i<=months;i++)rows.push({installment:i,debtId:"SYN-FEE",claimClass:"trustee_fee",principalWon:"0",interestWon:"0",otherComponentWon:"2"});totals.otherComponentWon=String(BigInt(months)*2n);totals.trusteeFeeWon=String(BigInt(months)*2n);totals.totalWon=String(BigInt(months)*3n);break;
    case "multiple_creditors": for(let i=1;i<=months;i++)rows.push({installment:i,debtId:"SYN-SECOND",claimClass:"ordinary",principalWon:"3",interestWon:"0",otherComponentWon:"0"});totals.principalWon=String(BigInt(months)*4n);totals.ordinaryWon=String(BigInt(months)*4n);totals.totalWon=String(BigInt(months)*4n);break;
  }
  return {ledger,reconciliation};
}
for (const months of [36,48,60]) for (const [type,expected] of [
  ["baseline","1"],["explicit_zero","0"],["blocked_ledger",null],["blocked_reconciliation",null],
  ["stale_total_zero",null],["missing_period",null],["malformed_money",null],["null_money",null],
  ["unverified_policy",null],["missing_budget",null],["unbalanced_month",null],["wrong_claim_class",null],
  ["trustee_fee","1"],["multiple_creditors","1"]
] as const) test(`A2 r112 synthetic form monthly ${months} ${type}`,()=>{
  const {ledger,reconciliation}=fixture(months,type);
  assert.equal(reconciledCreditorMonthlyWon(ledger,reconciliation,"SYN-D",months),expected);
});
