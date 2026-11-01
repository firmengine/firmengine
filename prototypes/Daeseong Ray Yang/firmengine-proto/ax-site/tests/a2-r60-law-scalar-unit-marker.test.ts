import test from "node:test";
import assert from "node:assert/strict";
import {reviewLegalPlanArithmetic} from "../lib/legal-calculation-readiness.ts";

// Synthetic display values only; acceptance of a number is not court approval.
const codes=(formCode:string,scalars:Record<string,string>)=>
  reviewLegalPlanArithmetic(formCode,{scalars}).issues.map(item=>item.code);
const format="PLAN_SCALAR_FORMAT_UNRESOLVED";

test("A2 r60: repayment_months rejects money units, including invalid periods",()=>{
  for(const raw of ["36원","₩36","₩36원","₩61원","36개월"]){
    assert.deepEqual(codes("D5110",{repayment_months:raw}),[format],raw);
  }
  assert.deepEqual(codes("D5110",{repayment_months:"36"}),[]);
  assert.deepEqual(codes("D5111",{repayment_months:"48"}),["PLAN_OVER_THREE_YEARS_REQUIRES_SPECIAL_REVIEW"]);
  assert.deepEqual(codes("D5111",{repayment_months:"61"}),["PLAN_DURATION_OUTSIDE_STATUTORY_LIMIT"]);
});

test("A2 r60: malformed bracket prefix cannot hide unresolved rendering input",()=>{
  for(const raw of ["[미관찰]999","[검토완료]","[source-only]900"]){
    assert.deepEqual(codes("D5110",{monthly_payment:raw}),[format],raw);
  }
  for(const raw of ["[미관찰]","[검토 필요]","[미관찰: 증빙없음]","source-only"]){
    assert.deepEqual(codes("D5110",{monthly_payment:raw}),[],raw);
  }
});

test("A2 r60: 0/null and legitimate won values remain distinct",()=>{
  assert.deepEqual(codes("D5110",{monthly_payment:"0",repayment_months:"36",total_repayment:"0"}),[]);
  assert.deepEqual(codes("D5110",{monthly_payment:0 as unknown as string}),[format]);
  assert.deepEqual(codes("D5111",{monthly_payment:null as unknown as string}),[]);
  assert.deepEqual(codes("D5110",{monthly_payment:"₩ 900,000원"}),[]);
  assert.equal(reviewLegalPlanArithmetic("D5111",{scalars:{repayment_months:"36"}}).automaticLegalApproval,false);
});

test("A2 r60: existing legal calculation review remains distinct from display review",()=>{
  assert.deepEqual(codes("D5111",{present_value:"30,000,000",liquidation_value:"32,000,000"}),
    ["PLAN_LIQUIDATION_EXCEPTION_REQUIRES_REVIEW"]);
  assert.deepEqual(codes("D5110",{approved_monthly_income:"1000",recognized_living_cost:"100",monthly_disposable_income:"9,00"}),[format]);
  assert.deepEqual(codes("D5103",{repayment_months:"₩36원"}),[]);
});
