// Synthetic A2 r65 regression only. No real person, case, OCR, or legal approval.
// Run from ax-site: node --experimental-strip-types --test tests/a2-r65-default-plan-snapshot-stale.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {normalizeMoney} from "../lib/domain.ts";
import {buildRepaymentPlanModel} from "../lib/repayment-plan-model.ts";

function syntheticDefault(term, revision=8, caseRevision=revision, proposed="2", split=true) {
  const data={
    context:{revision,planMonths:term,paymentSchedule:null,monthlyTrusteeFee:normalizeMoney("0")},
    debts:[{id:"SYN-DEBT",principal:normalizeMoney("1000"),interest:normalizeMoney("1000"),
      classification:"ordinary",priority:"ordinary",factIds:["SYN-FACT"]}]
  };
  const p=split?term:0, i=split?term:0;
  const calculation={caseRevision,planTotalWon:String(p+i),monthlyPaymentWon:proposed,
    ordinaryRepaymentBudgetWon:proposed,disposableIncomeWon:proposed,
    allocations:[{debtId:"SYN-DEBT",allocatedPrincipalWon:String(p),
      allocatedInterestWon:String(i),factIds:["SYN-FACT"]}]};
  return buildRepaymentPlanModel(data,calculation);
}

for(const term of [36,48,60]){
  test(`A2 r65 ${term} months: unchanged revision remains provisional, not legally approved`,()=>{
    const ledger=syntheticDefault(term,8,8);
    assert.equal(ledger.status,"provisional");
    assert.ok(!ledger.issues.includes("CALCULATION_SNAPSHOT_STALE"));
    const ordinary=ledger.rows.filter(r=>r.claimClass==="ordinary");
    assert.equal(ordinary.length,term);
    assert.equal(ordinary.reduce((s,r)=>s+BigInt(r.principalWon)+BigInt(r.interestWon),0n),BigInt(2*term));
    assert.deepEqual(ordinary[0].sourceIds,["SYN-FACT"]);
  });
  test(`A2 r65 ${term} months: old calculation cannot be reused after case revision`,()=>{
    const ledger=syntheticDefault(term,8,7);
    assert.equal(ledger.status,"blocked");
    assert.ok(ledger.issues.includes("CALCULATION_SNAPSHOT_STALE"));
    assert.equal(ledger.rows.filter(r=>r.claimClass==="ordinary").length,term);
  });
}

test("A2 r65: null proposal must not mask stale calculation",()=>{
  const ledger=syntheticDefault(36,8,7,null);
  assert.equal(ledger.status,"blocked");
  assert.ok(ledger.issues.includes("CALCULATION_SNAPSHOT_STALE"));
  assert.ok(!ledger.issues.includes("DEFAULT_ORDINARY_MONTHLY_PROPOSAL_INVALID"));
});

test("A2 r65: explicit 0 proposal and 0 allocation still cannot legitimize stale snapshot",()=>{
  const ledger=syntheticDefault(36,8,7,"0",false);
  assert.equal(ledger.status,"blocked");
  assert.ok(ledger.issues.includes("CALCULATION_SNAPSHOT_STALE"));
  assert.ok(!ledger.issues.some(x=>x.startsWith("DEFAULT_ORDINARY_MONTHLY_PROPOSAL_EXCEEDED")));
});
