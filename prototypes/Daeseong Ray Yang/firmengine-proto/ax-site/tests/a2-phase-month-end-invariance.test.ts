import test from "node:test";
import assert from "node:assert/strict";
import { expandPaymentSchedule, type Phase } from "../lib/payment-schedule.ts";
import { CONTEXT_PATCH_SCHEMA } from "../lib/context-validation.ts";
import { buildRepaymentPlanModel } from "../lib/repayment-plan-model.ts";
import { createCase, normalizeMoney, DRAFT_RULESET } from "../lib/domain.ts";
import { calculateCase } from "../lib/assessment.ts";

/** All dates, amounts and identities below are synthetic. A date integrity test is not court approval. */
const allocation = [{ creditorId:"synthetic-debt", principalWon:"1", interestWon:"0" }];
const phase = (id:string, first:number, last:number, date:string):Phase => ({
  id, firstInstallment:first, lastInstallment:last, firstPaymentDate:date,
  monthlyAvailableWon:"1", allocations:allocation,
});
const one:Phase[] = [phase("whole",1,3,"2026-01-31")];
const split:Phase[] = [phase("p1",1,1,"2026-01-31"),phase("p2",2,3,"2026-02-28")];
const dates = (phases:Phase[]) => expandPaymentSchedule(phases,3).rows.map(row=>row.paymentDate);

test("AT-A2: monthly installment dates are invariant under a phase split at February month end",()=>{
  const expected=["2026-01-31","2026-02-28","2026-03-31"];
  assert.equal(expandPaymentSchedule(one,3).status,"complete");
  assert.equal(expandPaymentSchedule(split,3).status,"complete");
  assert.deepEqual(dates(one),expected);
  assert.deepEqual(dates(split),expected);
  assert.deepEqual(expandPaymentSchedule(split,3).totals,expandPaymentSchedule(one,3).totals);
});

test("AT-A2: context schema accepts a split anchored to the first January due date",()=>{
  const obj = {
    paymentSchedule: { reviewed:true, reviewReason:"Synthetic unit date reconciliation",
      expectedInstallments:3,
      phases:[phase("p1",1,1,"2026-01-31"),phase("p2",2,2,"2026-02-28"),phase("p3",3,3,"2026-03-31")] },
  };
  assert.equal(CONTEXT_PATCH_SCHEMA.parse(obj).paymentSchedule?.phases.length,3);
  assert.throws(
    ()=>CONTEXT_PATCH_SCHEMA.parse({paymentSchedule:{...obj.paymentSchedule,phases:[
      phase("p1",1,1,"2026-01-31"),phase("p2",2,2,"2026-02-28"),phase("p3",3,3,"2026-03-28") ]}}),
    /다음 단계의 첫 변제일/,
  );
});

test("AT-A2: plan ledger dates match annex schedule dates after splitting a phase",()=>{
  const d=createCase("Synthetic installment calendar","synthetic-a2-calendar","2026-10-30");
  d.context.planMonths=3;
  d.context.monthlyTrusteeFee=normalizeMoney("0");
  d.debts=[{id:"synthetic-debt",creditor:"Synthetic creditor",
    principal:normalizeMoney("10"),interest:normalizeMoney("0"),
    secured:"no",classification:"ordinary",priority:"ordinary",
    asOf:d.context.asOf,factIds:[]}];
  d.context.paymentSchedule={reviewed:true,reviewReason:"Synthetic due date validation",
    expectedInstallments:3,phases:split};
  const calc=calculateCase(d,DRAFT_RULESET);
  const ledger=buildRepaymentPlanModel(d,calc);
  assert.equal(ledger.status,"complete",ledger.issues.join(","));
  assert.deepEqual(ledger.rows.filter(row=>row.claimClass==="ordinary").map(row=>row.paymentDate),
    dates(split));
  assert.deepEqual(ledger.rows.filter(row=>row.claimClass==="trustee_fee").map(row=>row.paymentDate),
    dates(split));
});

test("AT-A2: leap year and ordinary 15th-of-month dates remain deterministic",()=>{
  const leap=[phase("leap1",1,1,"2024-01-31"),phase("leap2",2,3,"2024-02-29")];
  assert.deepEqual(dates(leap),["2024-01-31","2024-02-29","2024-03-31"]);
  assert.deepEqual(dates([phase("regular",1,3,"2026-01-15")]),
    ["2026-01-15","2026-02-15","2026-03-15"]);
});

test("AT-A2: changing the monthly payment amount does not change the date anchor",()=>{
  const p=split.map((p,i)=>({...p,
    monthlyAvailableWon:i===0?"100":"200",
    allocations:[{creditorId:"synthetic-debt",principalWon:i===0?"99":"199",interestWon:"0"}]}));
  assert.deepEqual(dates(p),["2026-01-31","2026-02-28","2026-03-31"]);
});
