import test from "node:test";
import assert from "node:assert/strict";
import { FORM_CONTRACTS } from "../lib/form-contracts.ts";
import { evaluateDocumentPreflight } from "../lib/document-preflight.ts";

// Entirely synthetic, internal final-review integrity only. No statutory certification.
const months = Array.from({length:12},(_,i)=>({
  entity:"SYN-R40", period:`2026-${String(i+1).padStart(2,"0")}`,
  revenue:"[확인 필요]", expense:"[확인 필요]", net_income:"2,400,000"
}));
async function preflight(formCode:"D5103"|"D5110"|"D5111", mode:"draft"|"final", approved:string|null, rows=months){
  return evaluateDocumentPreflight({formCode,mode,
    identity:{evaluationId:"SYN-R40",evaluationResultHash:"a".repeat(64),
      referenceBundleHash:"b".repeat(64),documentEditsHash:"c".repeat(64),
      templateHash:FORM_CONTRACTS[formCode].templateHash},
    bindings:{scalars:{client_name:"SYN-R40",monthly_income:"2,400,000",
      approved_monthly_income:approved as string},rows:formCode==="D5103"?{month:rows}:{}}
  });
}
test("A2 r40: source-only income blocks final across three form codes",async()=>{
  for(const formCode of ["D5103","D5110","D5111"] as const){
    const result=await preflight(formCode,"final","[확인 필요]");
    assert.equal(result.status,"blocked",formCode);
    const code=formCode==="D5103"?"D5103_APPROVED_MONTHLY_INCOME_UNRESOLVED":"PLAN_APPROVED_MONTHLY_INCOME_UNRESOLVED";
    assert.ok(result.blockers.some(issue=>issue.code===code),formCode);
  }
});
test("A2 r40: identical source-only evidence remains warning in draft",async()=>{
  for(const formCode of ["D5103","D5110","D5111"] as const){
    const result=await preflight(formCode,"draft",null);
    const code=formCode==="D5103"?"D5103_APPROVED_MONTHLY_INCOME_UNRESOLVED":"PLAN_APPROVED_MONTHLY_INCOME_UNRESOLVED";
    assert.ok(result.warnings.some(issue=>issue.code===code),formCode);
  }
});
test("A2 r40: an interior gap in an approved D5103 month table blocks",async()=>{
  const result=await preflight("D5103","final","2,400,000",months.filter(x=>x.period!=="2026-06"));
  assert.ok(result.blockers.some(issue=>issue.code==="D5103_MONTH_COVERAGE_GAP"));
});
test.todo("A2 r40: start/end selected-period missing month needs period metadata, not statutory 12-month guess");
test.todo("A2 r40: real calculation result → D1 SQL → DOCX output parity and lawyer sign-off");
