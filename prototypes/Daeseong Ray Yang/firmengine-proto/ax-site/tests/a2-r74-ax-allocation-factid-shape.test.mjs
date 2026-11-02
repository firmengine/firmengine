// A2 r74: synthetic-only shape guard. No real case facts, legal approval or filing.
// Stacked on Draft PR #173; do not treat passing shape checks as Fact-lineage verification.
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMoney } from "../lib/domain.ts";
import { buildRepaymentPlanModel } from "../lib/repayment-plan-model.ts";

function fixture(months, factIds, options={}) {
  const M=(value)=>normalizeMoney(value);
  const data={
    context:{revision:8,planMonths:months,paymentSchedule:null,monthlyTrusteeFee:M("0")},
    debts:[{id:"SYN-DEBT-A",principal:M("100"),interest:M(options.zero?"0":"20"),priority:"ordinary",classification:"ordinary",factIds:["SYN-FACT-A"]}],
  };
  const calculation={
    caseRevision:8,planTotalWon:options.zero?"50":"60",monthlyPaymentWon:"60",
    allocations:[{debtId:"SYN-DEBT-A",allocatedPrincipalWon:options.invalidWon?"05":"50",allocatedInterestWon:options.zero?"0":"10",factIds}],
  };
  return buildRepaymentPlanModel(data,calculation);
}
for (const months of [36,48,60]) {
  for (const [label,ids] of [
    ["numeric id", [42]], ["null id", [null]], ["empty id", [""]], ["whitespace id", [" \\t "]],
  ]) test(`r74 ${months} months reject ${label} before ledger generation`,()=>{
    const ledger=fixture(months,ids);
    assert.equal(ledger.status,"blocked");
    assert.deepEqual(ledger.issues,["DEFAULT_ALLOCATION_INVALID"]);
    assert.equal(ledger.rows.length,0);
  });
  test(`r74 ${months} months valid ID stays provisional, not approved`,()=>{
    const ledger=fixture(months,["SYN-FACT-A"]);
    assert.equal(ledger.status,"provisional");
    assert.equal(ledger.rows.find(r=>r.debtId==="SYN-DEBT-A")?.sourceIds[0],"SYN-FACT-A");
  });
  test(`r74 ${months} months explicit zero interest stays zero, not null`,()=>{
    const ledger=fixture(months,["SYN-FACT-A"],{zero:true});
    assert.equal(ledger.status,"provisional");
    assert.equal(ledger.rows.filter(r=>r.debtId==="SYN-DEBT-A").reduce((s,r)=>s+BigInt(r.interestWon),0n),0n);
  });
  test(`r74 ${months} months malformed Won remains blocked`,()=>{
    const ledger=fixture(months,["SYN-FACT-A"],{invalidWon:true});
    assert.equal(ledger.status,"blocked");
    assert.deepEqual(ledger.issues,["DEFAULT_ALLOCATION_INVALID"]);
  });
  // These may be legitimate for supporting observations; policy requires Fact-index and professional review.
  test(`r74 ${months} months absent Fact IDs remains unverified provisional (NOT approved)`,()=>{
    const ledger=fixture(months,[]);assert.equal(ledger.status,"provisional");
  });
}
test.todo("r74 Fact ID exists in current case Fact index and is not withdrawn");
test.todo("r74 Fact ownership/scope matches debt and allocation while supporting Fact remains legal");
test.todo("r74 sourceIds->SQL source_fact_ids_json->D5110/D5111 actual DOCX and approval readiness E2E");
