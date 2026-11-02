// A2 r77 synthetic-only: source claim identity integrity in generated-default ledgers.
// Data integrity tests do not certify the legal allocation policy or a court form.
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMoney } from "../lib/domain.ts";
import { buildRepaymentPlanModel } from "../lib/repayment-plan-model.ts";

const M = value => normalizeMoney(value);
function fixture(months, duplicate = null, options = {}) {
  const first = {
    id: "SYN-DEBT-A", creditor: "Synthetic creditor A", principal: M(options.zero ? "0" : "100"),
    interest: options.nullInterest ? {amountWon:null} : M(options.zero ? "0" : "20"),
    priority: "ordinary", classification: "ordinary", factIds: ["SYN-FACT-A"],
  };
  const other = {
    ...first, creditor: "Synthetic creditor B", factIds: ["SYN-FACT-B"],
    principal: M(duplicate === "different-balance" ? "500" : "100"),
  };
  const data = {
    context: {revision: options.stale ? 9 : 8, planMonths: months, paymentSchedule:null, monthlyTrusteeFee:M("0")},
    debts: duplicate ? [first, other] : [first],
  };
  const calculation = {
    caseRevision:8, planTotalWon:options.zero ? "0" : "60", monthlyPaymentWon:"60",
    allocations:[{
      debtId:"SYN-DEBT-A", allocatedPrincipalWon:options.zero ? "0" : "50",
      allocatedInterestWon:options.zero ? "0" : "10",
      factIds: options.paddedId ? [" SYN-FACT-A"] : ["SYN-FACT-A"],
    }],
  };
  return buildRepaymentPlanModel(data,calculation);
}

for (const months of [36,48,60]) {
  for (const duplicate of ["different-balance","same-balance"]) {
    test(`r77 ${months} months blocks duplicate source debt identity (${duplicate})`, () => {
      const result = fixture(months,duplicate);
      assert.equal(result.status,"blocked");
      assert.deepEqual(result.issues,["DEFAULT_DUPLICATE_SOURCE_DEBT_ID"]);
      assert.equal(result.rows.length,0);
    });
  }
  test(`r77 ${months} months unique observed debt remains provisional`,()=>{
    const result=fixture(months);
    assert.equal(result.status,"provisional");
    assert.equal(result.issues.length,0);
    assert.equal(result.rows.filter(row=>row.claimClass==="ordinary").length,months);
    assert.equal(result.rows.filter(row=>row.claimClass==="ordinary").reduce(
      (sum,row)=>sum+BigInt(row.principalWon)+BigInt(row.interestWon),0n),60n);
  });
  test(`r77 ${months} months explicit zero stays zero`,()=>{
    const result=fixture(months,null,{zero:true});
    assert.equal(result.status,"provisional");
    assert.equal(result.rows.filter(row=>row.claimClass==="ordinary").reduce(
      (sum,row)=>sum+BigInt(row.principalWon)+BigInt(row.interestWon),0n),0n);
  });
  test(`r77 ${months} months unknown interest must not become zero`,()=>{
    const result=fixture(months,null,{nullInterest:true});
    assert.equal(result.status,"blocked");
    assert.deepEqual(result.issues,["DEFAULT_ALLOCATION_SOURCE_BALANCE_MISSING"]);
  });
  test(`r77 ${months} months stale revision remains blocked`,()=>{
    const result=fixture(months,null,{stale:true});
    assert.equal(result.status,"blocked");
    assert.ok(result.issues.includes("CALCULATION_SNAPSHOT_STALE"));
  });
  test(`r77 ${months} months noncanonical Fact ID remains blocked`,()=>{
    const result=fixture(months,null,{paddedId:true});
    assert.equal(result.status,"blocked");
    assert.deepEqual(result.issues,["DEFAULT_ALLOCATION_INVALID"]);
  });
}

test.todo("r77 canonical-but-foreign, empty, or withdrawn Fact references require real case Fact-index and approval checks");
test.todo("r77 integration with SQL source_fact_ids_json, approval-readiness, D5110/D5111 DOCX readback");
test.todo("r77 actual Node runner, CI, staging D1/R2/Cron, lawyer/accounting review");
