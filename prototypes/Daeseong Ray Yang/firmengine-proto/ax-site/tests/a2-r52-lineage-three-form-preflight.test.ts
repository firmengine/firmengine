import test from "node:test";
import assert from "node:assert/strict";
import { FORM_CONTRACTS } from "../lib/form-contracts.ts";
import { evaluateDocumentPreflight } from "../lib/document-preflight.ts";

// Synthetic audit-only data. This checks application review gates, not law/court certification.
type FormCode = "D5103" | "D5110" | "D5111";
const monthRows=Array.from({length:12},(_,i)=>{
  const period="2026-"+String(i+1).padStart(2,"0");
  return {
    entity:"SYN-R52",period,revenue:"[확인 필요]",expense:"[확인 필요]",
    net_income:"2,400,000",source_id:"SRC-"+period,
    source_stream_id:"WAGE-SYN",source_fact_ids:"FACT-"+period,
    source_review_status:"accepted",source_calc_role:"period_income_observation"
  };
});
async function check(formCode:FormCode,mode:"draft"|"final",scalars:Record<string,string>,rows:Record<string,Record<string,string>[]>={}){
  return evaluateDocumentPreflight({
    formCode,mode,contract:FORM_CONTRACTS[formCode],
    identity:{evaluationId:"synthetic-r52",evaluationResultHash:"a".repeat(64),referenceBundleHash:"b".repeat(64),
      documentEditsHash:"c".repeat(64),templateHash:FORM_CONTRACTS[formCode].templateHash},
    bindings:{scalars:{client_name:"SYNTHETIC",...scalars},rows}
  });
}
const missing="[확인 필요]";
test("r52: unapproved source observations must block D5103 D5110 D5111 final independently",async()=>{
  for(const code of ["D5103","D5110","D5111"] as const){
    const out=await check(code,"final",{monthly_income:"2,400,000",monthly_payment:"900,000",approved_monthly_income:missing},
      code==="D5103"?{month:monthRows}:{});
    const expected=code==="D5103"?"D5103_APPROVED_MONTHLY_INCOME_UNRESOLVED":"PLAN_APPROVED_MONTHLY_INCOME_UNRESOLVED";
    assert.ok(out.blockers.some(x=>x.code===expected),code);
    assert.equal(out.status,"blocked",code);
  }
});
test("r52: unresolved income in a draft must keep both warning and unresolved status",async()=>{
  for(const code of ["D5103","D5110","D5111"] as const){
    const out=await check(code,"draft",{monthly_income:"2,400,000",monthly_payment:"900,000",approved_monthly_income:missing},
      code==="D5103"?{month:monthRows}:{});
    const expected=code==="D5103"?"D5103_APPROVED_MONTHLY_INCOME_UNRESOLVED":"PLAN_APPROVED_MONTHLY_INCOME_UNRESOLVED";
    assert.ok(out.warnings.some(x=>x.code===expected),code);
    assert.ok(out.unresolved.includes(expected),code);
    assert.equal(out.status,"draft_with_unresolved",code);
  }
});
test("r52: no D5103 monthly rows with nonempty income must never pass this gate",async()=>{
  const out=await check("D5103","final",{monthly_income:"2,400,000",approved_monthly_income:"2,400,000"},{month:[]});
  assert.ok(out.blockers.some(x=>x.code==="D5103_MONTH_ROWS_MISSING"));
});
test("r52: D5110/11 negative or malformed money retains plan amount integrity review",async()=>{
  for(const code of ["D5110","D5111"] as const){
    const negative=await check(code,"final",{approved_monthly_income:"2,400,000",monthly_payment:"-900,000"});
    assert.ok(negative.blockers.some(x=>x.code==="PLAN_SCALAR_NEGATIVE_INVALID"),code);
    const invalid=await check(code,"final",{approved_monthly_income:"2,400,000",monthly_payment:"9,00"});
    assert.ok(invalid.blockers.some(x=>x.code==="PLAN_SCALAR_NUMERIC_INVALID"),code);
  }
});
test("r52: D5103 provenance remains internal and an unrelated row token is still forbidden",async()=>{
  const common={monthly_income:"2,400,000",approved_monthly_income:"2,400,000"};
  const valid=await check("D5103","final",common,{month:monthRows});
  assert.ok(!valid.blockers.some(x=>x.code==="UNKNOWN_ROW_TOKEN"),"internal lineage is not a DOCX token");
  const invalid=await check("D5103","final",common,{month:[{...monthRows[0]!,unregistered:"SYNTHETIC"}]});
  assert.ok(invalid.blockers.some(x=>x.code==="UNKNOWN_ROW_TOKEN"));
});
test("r52: explicit approved zero must remain distinct from missing review",async()=>{
  for(const code of ["D5110","D5111"] as const){
    const valid=await check(code,"final",{monthly_income:"0",monthly_payment:"0",approved_monthly_income:"0"});
    assert.ok(!valid.blockers.some(x=>x.code==="PLAN_APPROVED_MONTHLY_INCOME_UNRESOLVED"),code);
    const absent=await check(code,"final",{monthly_income:"0",monthly_payment:"0",approved_monthly_income:missing});
    assert.ok(absent.blockers.some(x=>x.code==="PLAN_APPROVED_MONTHLY_INCOME_UNRESOLVED"),code);
  }
});
