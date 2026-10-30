import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDocumentPreflight } from "../lib/document-preflight.ts";
import { FORM_CONTRACTS } from "../lib/form-contracts.ts";

/** Synthetic document bindings only. This is internal input integrity, not legal recognition. */
const baseScalars=()=>({
  client_name:"가상 신청인",approved_monthly_income:"100",recognized_living_cost:"50",
  monthly_disposable_income:"50",monthly_payment:"5",monthly_trustee_fee:"0",
  repayment_months:"36",total_repayment:"180",present_value:"0",liquidation_value:"0"
});
const preflight=async(formCode:"D5110"|"D5111",mode:"draft"|"final",scalars:Record<string,string>,rows:Record<string,Record<string,string>[]>={})=>
  evaluateDocumentPreflight({
    formCode,mode,bindings:{scalars,rows},
    identity:{evaluationId:"synthetic-r16",evaluationResultHash:"a".repeat(64),
      referenceBundleHash:"b".repeat(64),templateHash:FORM_CONTRACTS[formCode].templateHash,
      documentEditsHash:"c".repeat(64)}
  });

test("D5110/D5111 final preflight refuses negative payment, trustee fee and repayment total",async()=>{
  for(const formCode of ["D5110","D5111"] as const){
    for(const token of ["monthly_payment","monthly_trustee_fee","total_repayment"] as const){
      const result=await preflight(formCode,"final",{...baseScalars(),[token]:"-1"});
      assert.equal(result.status,"blocked",formCode+"."+token);
      assert.ok(result.blockers.some(issue=>issue.code==="PLAN_SCALAR_NEGATIVE_INVALID"&&issue.token===token),formCode+"."+token);
    }
  }
});
test("negative creditor principal, monthly amount or total is not treated as a usable final row",async()=>{
  for(const field of ["principal","monthly_payment","total_payment"] as const){
    const row={entity:"가상 채권자 A",principal:"10",interest:"0",monthly_payment:"0",total_payment:"0",[field]:"-1"};
    const result=await preflight("D5110","final",baseScalars(),{creditor:[row]});
    assert.equal(result.status,"blocked",field);
    assert.ok(result.blockers.some(issue=>issue.code==="PLAN_CREDITOR_ROW_NEGATIVE_INVALID"&&issue.token==="creditor."+field+"[0]"),field);
  }
});
test("negative draft money stays a warning without legal approval",async()=>{
  const a=await preflight("D5110","draft",{...baseScalars(),monthly_payment:"-1"});
  assert.ok(a.warnings.some(issue=>issue.code==="PLAN_SCALAR_NEGATIVE_INVALID"));
  assert.ok(!a.blockers.some(issue=>issue.code==="PLAN_SCALAR_NEGATIVE_INVALID"));
  const b=await preflight("D5110","draft",baseScalars(),{creditor:[{entity:"가상",principal:"-1",interest:"0",monthly_payment:"0",total_payment:"0"}]});
  assert.ok(b.warnings.some(issue=>issue.code==="PLAN_CREDITOR_ROW_NEGATIVE_INVALID"));
});
test("explicit zero remains allowed; malformed numeric and missing are distinct",async()=>{
  const zero=await preflight("D5110","final",{...baseScalars(),monthly_payment:"0",monthly_trustee_fee:"0",total_repayment:"0"},
    {creditor:[{entity:"가상",principal:"0",interest:"0",monthly_payment:"0",total_payment:"0"}]});
  assert.ok(!zero.blockers.some(issue=>issue.code.includes("NEGATIVE_INVALID")));
  const bad=await preflight("D5110","final",{...baseScalars(),monthly_payment:"not-a-number"});
  assert.ok(bad.blockers.some(issue=>issue.code==="PLAN_SCALAR_NUMERIC_INVALID"));
  const missing=await preflight("D5110","final",{...baseScalars(),monthly_payment:"[확인 필요]"});
  assert.ok(!missing.blockers.some(issue=>issue.code.includes("NEGATIVE_INVALID")));
});
