import test from "node:test";
import assert from "node:assert/strict";
import { FORM_CONTRACTS } from "../lib/form-contracts.ts";
import { evaluateDocumentPreflight } from "../lib/document-preflight.ts";
import { reviewLegalPlanArithmetic } from "../lib/legal-calculation-readiness.ts";
const identity=(code:string)=>({evaluationId:"eval",evaluationResultHash:"a".repeat(64),referenceBundleHash:"b".repeat(64),templateHash:FORM_CONTRACTS[code].templateHash,documentEditsHash:"c".repeat(64)});
test("statutory minimum is distinct from unverified court portal fields",()=>{
 assert.equal(FORM_CONTRACTS.D5100.fields.find(x=>x.token==="resident_id")?.requiredness,"required");
 assert.equal(FORM_CONTRACTS.D5100.fields.find(x=>x.token==="address")?.authorityBasis,"statutory_minimum");
 assert.equal(FORM_CONTRACTS.D5106.fields.find(x=>x.token==="creditor.address")?.requiredness,"conditional");
 assert.equal(FORM_CONTRACTS.D5106.fields.find(x=>x.token==="creditor.cause")?.authorityBasis,"statutory_minimum");
 assert.equal(FORM_CONTRACTS.D5106.fields.find(x=>x.token==="creditor.interest")?.requiredness,"unverified");
});
test("final creditor-list generation blocks missing name, address, cause and total checks",async()=>{
 const result=await evaluateDocumentPreflight({formCode:"D5106",mode:"final",identity:identity("D5106"),
  bindings:{scalars:{client_name:"신청인",total_principal:"1000"},rows:{creditor:[{number:"1",entity:"채권자",principal:"1000"}]}}});
 assert.equal(result.status,"blocked");
 assert.ok(result.blockers.some(x=>x.token==="creditor.address"));
 assert.ok(result.blockers.some(x=>x.token==="creditor.cause"));
});
test("masked resident ID does not qualify for final application",async()=>{
 const result=await evaluateDocumentPreflight({formCode:"D5100",mode:"final",identity:identity("D5100"),
  bindings:{scalars:{client_name:"신청인",address:"서울",resident_id:"900101-1******"},rows:{}}});
 assert.ok(result.blockers.some(x=>x.token==="resident_id"));
});
test("liquidation safeguard uses independently supplied PV not undiscounted installments",()=>{
 const scalars={approved_monthly_income:"3000000",recognized_living_cost:"2000000",monthly_disposable_income:"1000000",
  repayment_months:"36",monthly_payment:"1000000",total_repayment:"36000000",present_value:"9000000",liquidation_value:"10000000"};
 assert.ok(reviewLegalPlanArithmetic("D5110",{scalars}).issues.some(x=>x.code==="PLAN_LIQUIDATION_EXCEPTION_REQUIRES_REVIEW"));
 const good={...scalars,present_value:"11000000"};
 assert.ok(!reviewLegalPlanArithmetic("D5110",{scalars:good}).issues.some(x=>x.code==="PLAN_LIQUIDATION_EXCEPTION_REQUIRES_REVIEW"));
 assert.ok(reviewLegalPlanArithmetic("D5110",{scalars:{...good,monthly_disposable_income:"999999"}}).issues.some(x=>x.code==="PLAN_DISPOSABLE_FORMULA_MISMATCH"));
 assert.ok(reviewLegalPlanArithmetic("D5110",{scalars:{...good,repayment_months:"61"}}).issues.some(x=>x.code==="PLAN_DURATION_OUTSIDE_STATUTORY_LIMIT"));
});
