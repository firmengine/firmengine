// Synthetic-only A2 r81 IT technical regression; not Fact ownership or legal approval.
import test from "node:test";
import assert from "node:assert/strict";
import {normalizeMoney} from "../lib/domain.ts";
import {buildRepaymentPlanModel} from "../lib/repayment-plan-model.ts";

function makeScenario(months, kind) {
  const debt = {
    id:"SYN-R81-DEBT", creditor:"Synthetic creditor",
    principal:normalizeMoney("100"), interest:normalizeMoney("0"),
    priority:"ordinary", classification:"ordinary", factIds:["SYN-R81-FACT"],
  };
  if(kind==="null-array") debt.factIds=null;
  if(kind==="missing-array") delete debt.factIds;
  if(kind==="number-id") debt.factIds=[42];
  if(kind==="null-id") debt.factIds=[null];
  if(kind==="blank-id") debt.factIds=[""];
  if(kind==="space-id") debt.factIds=[" SYN-R81-FACT"];
  if(kind==="duplicate-id") debt.factIds=["SYN-R81-FACT","SYN-R81-FACT"];
  if(kind==="empty-array") debt.factIds=[];
  if(kind==="foreign-id") debt.factIds=["SYN-R81-UNVERIFIED"];
  if(kind==="negative-principal") debt.principal=normalizeMoney("-5");
  if(kind==="unknown-interest") debt.interest=normalizeMoney(null);
  const debts=kind==="duplicate-debt"?[debt,{...debt,creditor:"Second creditor"}]:[debt];
  const data={
    context:{
      revision:8, planMonths:months, monthlyTrusteeFee:normalizeMoney("0"),
      paymentSchedule:{
        reviewed:true, expectedInstallments:months,
        phases:[{
          id:"SYN-R81-PHASE",firstInstallment:1,lastInstallment:months,
          firstPaymentDate:"2026-12-31",monthlyAvailableWon:"1",
          allocations:[{creditorId:"SYN-R81-DEBT",principalWon:"1",interestWon:"0"}],
        }],
      },
    },
    debts,
  };
  const calculation={caseRevision:kind==="stale-revision"?7:8,
    planTotalWon:String(months),monthlyPaymentWon:"1",allocations:[]};
  return buildRepaymentPlanModel(data,calculation);
}

for(const months of [36,48,60]) {
  test(`A2 r81 ${months}: canonical Fact ID keeps technical complete only`,()=>{
    const result=makeScenario(months,"valid");
    assert.equal(result.status,"complete");
    assert.deepEqual(result.issues,[]);
    assert.equal(result.rows.filter(r=>r.claimClass==="ordinary").length,months);
    assert.deepEqual(result.rows.find(r=>r.claimClass==="ordinary")?.sourceIds,["SYN-R81-FACT"]);
    const paid=result.rows.filter(r=>r.claimClass==="ordinary")
      .reduce((sum,r)=>sum+BigInt(r.principalWon)+BigInt(r.interestWon),0n);
    assert.equal(paid,BigInt(months));
  });
  for(const kind of ["null-array","missing-array","number-id","null-id","blank-id","space-id","duplicate-id"]) {
    test(`A2 r81 ${months}: ${kind} blocks without throw`,()=>{
      const result=makeScenario(months,kind);
      assert.equal(result.status,"blocked");
      assert.deepEqual(result.issues,["REVIEWED_SOURCE_FACT_IDS_INVALID"]);
      assert.deepEqual(result.rows,[]);
    });
  }
  for(const [kind,issue] of [
    ["negative-principal","REVIEWED_SOURCE_DEBT_COMPONENT_NEGATIVE"],
    ["unknown-interest","REVIEWED_SOURCE_DEBT_COMPONENT_UNRESOLVED"],
    ["duplicate-debt","REVIEWED_DUPLICATE_SOURCE_DEBT_ID"],
    ["stale-revision","CALCULATION_SNAPSHOT_STALE"],
  ]) {
    test(`A2 r81 ${months}: preserve prior ${kind} guard`,()=>{
      const result=makeScenario(months,kind);
      assert.equal(result.status,"blocked");
      assert.ok(result.issues.includes(issue));
    });
  }
  test(`A2 r81 ${months}: empty / foreign but syntactically valid IDs remain ownership-unverified`,()=>{
    for(const kind of ["empty-array","foreign-id"]){
      const result=makeScenario(months,kind);
      assert.equal(result.status,"complete"); // technical ledger only; NOT filing approval
    }
  });
}
test.todo("A2 r81 verify Fact ID existence, current revision and same-case producer ownership at persistence/replay");
test.todo("A2 r81 execute project Node --experimental-strip-types --test and complete CI");
test.todo("A2 r81 independently re-read generated DOCX D5110/D5111 and staging D1/R2/Cron");
