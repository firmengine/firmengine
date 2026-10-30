import test from "node:test";
import assert from "node:assert/strict";
import {FORM_CONTRACTS} from "../lib/form-contracts.ts";
import {evaluateDocumentPreflight} from "../lib/document-preflight.ts";
import type {FormBindings} from "../lib/form-mapping.ts";

// Invented money and creditor labels. These are not OCR/customer/legal acceptance fixtures.
function fixture(code:"D5110"|"D5111",changes:Record<string,string>={}):{
  bindings:FormBindings;identity:{evaluationId:string;evaluationResultHash:string;referenceBundleHash:string;templateHash:string;documentEditsHash:string};
}{
 const scalars:Record<string,string>={client_name:"Synthetic Applicant",
  approved_monthly_income:"3000000",recognized_living_cost:"2000000",
  monthly_disposable_income:"1000000",monthly_payment:"1000000",
  monthly_trustee_fee:"0",repayment_months:"36",total_repayment:"36000000",
  liquidation_value:"10000000",present_value:"12000000",...changes};
 return {bindings:{scalars,rows:{creditor:[{number:"1",entity:"Synthetic Creditor",
   principal:"100000",monthly_payment:"100",total_payment:"3600",
   period:"2026-10",claim_type:"ordinary"}]}},
  identity:{evaluationId:"synthetic",evaluationResultHash:"a".repeat(64),
   referenceBundleHash:"b".repeat(64),documentEditsHash:"c".repeat(64),
   templateHash:FORM_CONTRACTS[code].templateHash}};
}
async function check(code:"D5110"|"D5111",mode:"draft"|"final",changes:Record<string,string>={}){
 const data=fixture(code,changes);
 return evaluateDocumentPreflight({formCode:code,mode,...data});
}
test("D5110 final valid integer-won and explicit zero remain numeric",async()=>{
 const good=await check("D5110","final");assert.equal(good.status,"ready");
 const zero=await check("D5110","final",{monthly_payment:"0"});
 assert.equal(zero.blockers.some(x=>x.code==="PLAN_SCALAR_NUMERIC_INVALID"),false);
 const large=await check("D5110","final",{monthly_payment:"900719925474099312345"});
 assert.equal(large.blockers.some(x=>x.code==="PLAN_SCALAR_NUMERIC_INVALID"),false);
});
test("D5110 final rejects malformed present monthly repayment/term/PV/total values",async()=>{
 for(const [token,raw] of [
  ["monthly_payment","oops"],["repayment_months","36oops"],["present_value","0x10"],
  ["total_repayment","12.5"],["recognized_living_cost","unknown"]
 ] as const){
  const result=await check("D5110","final",{[token]:raw});
  assert.equal(result.status,"blocked",token);
  assert.ok(result.blockers.some(x=>x.code==="PLAN_SCALAR_NUMERIC_INVALID"&&x.token===token),token);
 }
});
test("missing PV is not zero; draft invalid amount warns without document finality",async()=>{
 const missing=await check("D5110","final",{present_value:"[확인 필요]"});
 assert.equal(missing.status,"blocked");
 assert.ok(missing.blockers.some(x=>x.token==="present_value"&&x.code==="FIELD_UNRESOLVED"));
 const draft=await check("D5110","draft",{monthly_payment:"BAD"});
 assert.ok(draft.warnings.some(x=>x.code==="PLAN_SCALAR_NUMERIC_INVALID"&&x.token==="monthly_payment"));
 assert.equal(draft.blockers.some(x=>x.code==="PLAN_SCALAR_NUMERIC_INVALID"),false);
});
test("D5111 disposal scalar proposed amounts use the same numeric integrity gate",async()=>{
 for(const token of ["disposal_payment_total","disposal_present_value"]){
  const result=await check("D5111","final",{[token]:"undetermined-string"});
  assert.equal(result.status,"blocked");
  assert.ok(result.blockers.some(x=>x.code==="PLAN_SCALAR_NUMERIC_INVALID"&&x.token===token));
 }
});
