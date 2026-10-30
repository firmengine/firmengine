import test from "node:test";
import assert from "node:assert/strict";
import {createCase, normalizeMoney} from "../lib/domain.ts";
import {buildRepaymentPlanModel} from "../lib/repayment-plan-model.ts";
import type {CalculationResult} from "../lib/assessment.ts";

/** Strictly synthetic typed-money/ledger inputs. No OCR, court approval, or personal facts. */
function fixture(months=2, reviewedSchedule=true) {
  const data=createCase("Synthetic debt balance integrity","synthetic-a2-debt-balance","2026-10-30");
  data.debts=[{
    id:"synthetic-debt",creditor:"synthetic creditor",secured:"no",
    classification:"ordinary",priority:"ordinary",factIds:[],
    principal:normalizeMoney(String(months)),interest:normalizeMoney("0")
  }];
  data.context.planMonths=months;
  data.context.monthlyTrusteeFee=normalizeMoney("0");
  if(reviewedSchedule){
    data.context.paymentSchedule={
      reviewed:true,reviewReason:"synthetic unit scenario only",
      expectedInstallments:months,phases:[{
        id:"synthetic-phase",firstInstallment:1,lastInstallment:months,
        firstPaymentDate:"2026-01-31",monthlyAvailableWon:"1",
        allocations:[{creditorId:"synthetic-debt",principalWon:"1",interestWon:"0"}]
      }]
    };
  } else delete data.context.paymentSchedule;
  // The ledger receives an existing deterministic calculation snapshot.  It
  // must reject missing debt money independently even when another aggregate
  // in that snapshot has a known value.
  const calculation={
    caseRevision:data.context.revision,planTotalWon:String(months),
    allocations:[{
      debtId:"synthetic-debt",creditor:"synthetic creditor",
      allocatedPrincipalWon:String(months),allocatedInterestWon:"0",
      factIds:[],principalWon:String(months),interestWon:"0",
      totalWon:String(months),basis:"principal_then_interest_pro_rata",status:"provisional"
    }]
  } as unknown as CalculationResult;
  return {data,calculation};
}
function expectBlocked(data:ReturnType<typeof fixture>["data"],calculation:CalculationResult){
  const ledger=buildRepaymentPlanModel(data,calculation);
  assert.equal(ledger.status,"blocked");
  assert.deepEqual(ledger.rows,[],"unknown debt must not produce fictitious zero-balance rows");
  assert.deepEqual(ledger.issues,["CLAIM_BALANCE_MISSING:synthetic-debt"]);
}

test("reviewed two-month payment schedule cannot treat absent principal as zero",()=>{
  const {data,calculation}=fixture();
  data.debts[0]!.principal=null;
  expectBlocked(data,calculation);
});
test("reviewed two-month payment schedule cannot treat absent interest as zero",()=>{
  const {data,calculation}=fixture();
  data.debts[0]!.interest=null;
  expectBlocked(data,calculation);
});
test("invalid numeric input returns a blocked receipt instead of throwing BigInt",()=>{
  for(const field of ["principal","interest"] as const){
    const {data,calculation}=fixture();
    data.debts[0]![field]={...normalizeMoney("2"),amountWon:"oops",normalizationStatus:"invalid"};
    expectBlocked(data,calculation);
  }
});
test("generated plan 36/48/60 months remains fail-closed on an absent component",()=>{
  for(const months of [36,48,60]){
    for(const field of ["principal","interest"] as const){
      const {data,calculation}=fixture(months,false);
      data.debts[0]![field]=null;
      expectBlocked(data,calculation);
    }
  }
});
test("true documented zero is not confused with an absent creditor balance",()=>{
  const {data,calculation}=fixture();
  data.debts[0]!.principal=normalizeMoney("0");
  data.debts[0]!.interest=normalizeMoney("0");
  data.context.paymentSchedule!.phases[0]!.allocations[0]!.principalWon="0";
  const ledger=buildRepaymentPlanModel(data,calculation);
  assert.equal(ledger.status,"complete");
  assert.deepEqual(ledger.issues,[]);
  assert.ok(ledger.rows.some(row=>row.debtId==="synthetic-debt"&&row.principalWon==="0"&&row.balanceAfter==="0"));
});
test("valid principal, explicitly zero interest preserve known running balance",()=>{
  const {data,calculation}=fixture();
  const ledger=buildRepaymentPlanModel(data,calculation);
  assert.equal(ledger.status,"complete");
  assert.deepEqual(ledger.rows.filter(row=>row.debtId==="synthetic-debt").map(row=>row.balanceAfter),["1","0"]);
});
test("BigInt > Number.MAX_SAFE_INTEGER is retained as a decimal string",()=>{
  const {data,calculation}=fixture(48,false);
  const balance="9007199254740993";
  data.debts[0]!.principal=normalizeMoney(balance);
  const ledger=buildRepaymentPlanModel(data,calculation);
  assert.equal(ledger.status,"provisional");
  assert.ok(!ledger.issues.includes("CLAIM_BALANCE_MISSING:synthetic-debt"));
  assert.equal(ledger.rows.filter(row=>row.debtId==="synthetic-debt").at(-1)?.balanceAfter,(BigInt(balance)-48n).toString());
});
