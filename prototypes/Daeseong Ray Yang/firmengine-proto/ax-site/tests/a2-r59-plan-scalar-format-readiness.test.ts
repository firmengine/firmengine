import test from "node:test";
import assert from "node:assert/strict";
import {reviewLegalPlanArithmetic} from "../lib/legal-calculation-readiness.ts";

// Synthetic display values only; these tests do not certify official court forms.
const codes=(formCode:string,scalars:Record<string,string>)=>
  reviewLegalPlanArithmetic(formCode,{scalars}).issues.map(issue=>issue.code);

test("A2 r59: valid digits, comma groups, KRW suffix and explicit zero are preserved",()=>{
  const valid=[
    {approved_monthly_income:"1000",recognized_living_cost:"100",monthly_disposable_income:"900"},
    {approved_monthly_income:"1,000",recognized_living_cost:"100",monthly_disposable_income:"900"},
    {approved_monthly_income:"₩ 1,000원",recognized_living_cost:"100원",monthly_disposable_income:"900"},
    {monthly_payment:"0",repayment_months:"36",total_repayment:"0"},
  ];
  for(const scalars of valid)assert.deepEqual(codes("D5110",scalars),[],JSON.stringify(scalars));
});
test("A2 r59: malformed grouping and formats must not bypass arithmetic checks",()=>{
  const bad=[
    {approved_monthly_income:"1000",recognized_living_cost:"100",monthly_disposable_income:"9,00"},
    {approved_monthly_income:"1 0 0 0",recognized_living_cost:"100",monthly_disposable_income:"900"},
    {repayment_months:"3,6"},
    {repayment_months:"36.5"},
    {total_repayment:"1,,000"},
    {present_value:",100"},
    {liquidation_value:"1원00"},
    {monthly_payment:0 as unknown as string},
  ];
  for(const scalars of bad)assert.deepEqual(codes("D5110",scalars),
    ["PLAN_SCALAR_FORMAT_UNRESOLVED"],JSON.stringify(scalars));
});
test("A2 r59: null, missing and source-only markers remain distinct from observed zero",()=>{
  for(const raw of [null,undefined,"[미관찰]","[해당없음]","source-only"]){
    assert.deepEqual(codes("D5111",{monthly_payment:raw as unknown as string}),[]);
  }
  assert.deepEqual(codes("D5110",{monthly_payment:"0"}),[]);
  assert.equal(reviewLegalPlanArithmetic("D5111",{scalars:{monthly_payment:"0"}}).automaticLegalApproval,false);
});
test("A2 r59: 36, 48 and 60-month arithmetic is not legal term approval",()=>{
  for(const months of [36,48,60]){
    const total=BigInt(months)*900000n;
    const issues=codes("D5110",{repayment_months:String(months),monthly_payment:"900,000",total_repayment:total.toLocaleString("en-US")});
    assert.deepEqual(issues,months===36?[]:["PLAN_OVER_THREE_YEARS_REQUIRES_SPECIAL_REVIEW"]);
  }
});
test("A2 r59: liquidation and income arithmetic retain pre-existing review gates",()=>{
  assert.deepEqual(codes("D5111",{present_value:"30,000,000",liquidation_value:"32,000,000"}),
    ["PLAN_LIQUIDATION_EXCEPTION_REQUIRES_REVIEW"]);
  assert.deepEqual(codes("D5110",{approved_monthly_income:"1000",recognized_living_cost:"100",monthly_disposable_income:"800"}),
    ["PLAN_DISPOSABLE_FORMULA_MISMATCH"]);
});
test("A2 r59: D5103 is not silently given a new D5110/D5111-only money rule",()=>{
  assert.deepEqual(codes("D5103",{monthly_disposable_income:"9,00"}),[]);
});
