// Synthetic, no customer facts. Run: node --experimental-strip-types --test tests/a2-r53-default-monthly-remainder.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {normalizeMoney} from "../lib/domain.ts";
import {buildRepaymentPlanModel} from "../lib/repayment-plan-model.ts";

const modes=["split-remainder","even","explicit-zero","proposal-unobserved","proposal-invalid"];
for(const term of [36,48,60])for(const mode of modes){
 test(`A2 r53 generated-default ${term} months ${mode}: no approved monthly amount inferred`,()=>{
  const principal=mode==="split-remainder"?term+1:mode==="even"?term:0;
  const interest=mode==="split-remainder"?term-1:mode==="even"?term:0;
  const amount=mode==="split-remainder"||mode==="even"?"2":mode==="proposal-invalid"?"9,00":mode==="proposal-unobserved"?null:"0";
  const data={
   context:{planMonths:term,paymentSchedule:null,monthlyTrusteeFee:normalizeMoney("0")},
   debts:[{id:"SYN-D1",principal:normalizeMoney("10000"),interest:normalizeMoney("10000"),classification:"ordinary",priority:"ordinary",factIds:["SYN-F1"]}],
  };
  const calculation={
   planTotalWon:String((mode==="split-remainder"||mode==="even"?2:0)*term),
   monthlyPaymentWon:amount,ordinaryRepaymentBudgetWon:"2",
   allocations:[{debtId:"SYN-D1",allocatedPrincipalWon:String(principal),allocatedInterestWon:String(interest),factIds:["SYN-F1"]}],
  };
  const ledger=buildRepaymentPlanModel(data,calculation);
  const ordinary=ledger.rows.filter(r=>r.claimClass==="ordinary");
  const installments=ordinary.map(r=>BigInt(r.principalWon)+BigInt(r.interestWon));
  assert.equal(ordinary.length,term);
  assert.equal(installments.reduce((a,b)=>a+b,0n).toString(),String(principal+interest));
  if(mode==="split-remainder"){
   assert.equal(installments[0],3n);
   assert.equal(installments.at(-1),1n);
   assert.equal(ledger.status,"blocked");
   assert.ok(ledger.issues.includes("DEFAULT_ORDINARY_MONTHLY_PROPOSAL_EXCEEDED:1"));
  }else if(mode==="proposal-invalid"){
   assert.equal(ledger.status,"blocked");
   assert.ok(ledger.issues.includes("DEFAULT_ORDINARY_MONTHLY_PROPOSAL_INVALID"));
  }else{
   assert.equal(ledger.status,"provisional");
   assert.ok(!ledger.issues.some(x=>x.startsWith("DEFAULT_ORDINARY_MONTHLY_PROPOSAL")));
  }
 });
}
