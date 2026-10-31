import test from "node:test";
import assert from "node:assert/strict";
import {FORM_CONTRACTS} from "../lib/form-contracts.ts";
import {evaluateDocumentPreflight} from "../lib/document-preflight.ts";

// Standalone synthetic data, never an actual customer/OCR record or approved legal rule.
const identity=(code:string)=>({evaluationId:"A2-R13-SYNTHETIC",evaluationResultHash:"a".repeat(64),
 referenceBundleHash:"b".repeat(64),documentEditsHash:"c".repeat(64),
 templateHash:FORM_CONTRACTS[code].templateHash});
const run=(formCode:string,mode:"draft"|"final",scalars:Record<string,string>,
 rows:Record<string,Array<Record<string,string>>>)=>
 evaluateDocumentPreflight({formCode,mode,identity:identity(formCode),bindings:{scalars:{client_name:"Synthetic applicant",...scalars},rows}});

const plan={approved_monthly_income:"3000000",recognized_living_cost:"2000000",
 monthly_disposable_income:"1000000",monthly_payment:"1000000",repayment_months:"36",
 total_repayment:"36000000",liquidation_value:"10000000",present_value:"12000000",
 monthly_trustee_fee:"0"};
const creditor={number:"1",entity:"Synthetic creditor",principal:"100000",
 monthly_payment:"100",total_payment:"3600",period:"2026-10",claim_type:"ordinary"};

test("r13 integration: D5103 final with monthly amount and zero month evidence rows is blocked",async()=>{
 const res=await run("D5103","final",{approved_monthly_income:"2,400,000"},{month:[]});
 assert.equal(res.status,"blocked");
 assert.ok(res.blockers.some(x=>x.code==="D5103_MONTH_ROWS_MISSING"));
});
test("r13 integration: D5103 draft has warning, not final-month blocker",async()=>{
 const res=await run("D5103","draft",{approved_monthly_income:"2,400,000"},{month:[]});
 assert.ok(res.warnings.some(x=>x.code==="D5103_MONTH_ROWS_MISSING"));
 assert.equal(res.blockers.some(x=>x.code==="D5103_MONTH_ROWS_MISSING"),false);
});
test("r13 integration: D5103 one valid synthetic month does not trigger empty-row gate",async()=>{
 const res=await run("D5103","final",{approved_monthly_income:"2,400,000"},
  {month:[{entity:"Synthetic",period:"2026-10",net_income:"2,400,000"}]});
 assert.equal(res.blockers.some(x=>x.code==="D5103_MONTH_ROWS_MISSING"),false);
});
test("r13 integration: D5110 invalid scalar/commas and creditor rows are blocked",async()=>{
 for(const raw of ["BAD","1,00,0000"]){
  const res=await run("D5110","final",{...plan,monthly_payment:raw},{creditor:[creditor]});
  assert.ok(res.blockers.some(x=>x.code==="PLAN_SCALAR_NUMERIC_INVALID"&&x.token==="monthly_payment"),raw);
 }
 const res=await run("D5110","final",plan,{creditor:[{...creditor,principal:"BAD"}]});
 assert.ok(res.blockers.some(x=>x.code==="PLAN_CREDITOR_ROW_NUMERIC_INVALID"&&x.token==="creditor.principal[0]"));
});
test("r13 integration: D5110 known zero and valid integer amounts remain parseable",async()=>{
 const zero=await run("D5110","final",plan,{creditor:[{...creditor,principal:"0"}]});
 assert.equal(zero.blockers.some(x=>x.code==="PLAN_CREDITOR_ROW_NUMERIC_INVALID"),false);
 const valid=await run("D5110","final",plan,{creditor:[creditor]});
 assert.equal(valid.blockers.some(x=>x.code==="PLAN_SCALAR_NUMERIC_INVALID"||x.code==="PLAN_CREDITOR_ROW_NUMERIC_INVALID"),false);
});
test("r13 integration: D5111 invalid disposal amount is blocked",async()=>{
 const res=await run("D5111","final",{...plan,disposal_payment_total:"bad"},{creditor:[creditor]});
 assert.ok(res.blockers.some(x=>x.code==="PLAN_SCALAR_NUMERIC_INVALID"&&x.token==="disposal_payment_total"));
});
