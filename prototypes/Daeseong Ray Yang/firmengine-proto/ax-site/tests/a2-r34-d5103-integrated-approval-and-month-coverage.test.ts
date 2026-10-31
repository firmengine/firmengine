import test from "node:test";
import assert from "node:assert/strict";
import { FORM_CONTRACTS } from "../lib/form-contracts.ts";
import { evaluateDocumentPreflight } from "../lib/document-preflight.ts";

// Synthetic amounts, identifiers and periods only; no real cases or legal recognition.
const identity={
  evaluationId:"SYN-A2-R28",evaluationResultHash:"a".repeat(64),
  referenceBundleHash:"b".repeat(64),documentEditsHash:"c".repeat(64),
  templateHash:FORM_CONTRACTS.D5103.templateHash
};
const months=Array.from({length:12},(_,i)=>({
  entity:"SYN-WAGE",period:`2026-${String(i+1).padStart(2,"0")}`,net_income:"2,400,000",
  revenue:"[확인 필요]",expense:"[확인 필요]"
}));
const evaluate=(mode:"draft"|"final",approved:string|null|undefined,monthly:string,rows:typeof months=months)=>
  evaluateDocumentPreflight({formCode:"D5103",mode,identity,bindings:{
    scalars:{client_name:"SYN-APPLICANT",monthly_income:monthly,approved_monthly_income:approved as string},
    rows:{month:rows}
  }});
const has=(rows:{code:string}[],code:string)=>rows.some(row=>row.code===code);
const code="D5103_APPROVED_MONTHLY_INCOME_UNRESOLVED";

test("A2 r28: final D5103 source-only 12-month preview is not ready for release",async()=>{
  const result=await evaluate("final","[확인 필요]","2,400,000");
  assert.equal(result.status,"blocked");
  assert.equal(has(result.blockers,code),true);
});
test("A2 r28: draft preserves source-only preview as warning",async()=>{
  const result=await evaluate("draft","[확인 필요]","2,400,000");
  assert.equal(has(result.blockers,code),false);
  assert.equal(has(result.warnings,code),true);
});
test("A2 r28: explicit approved zero is not missing",async()=>{
  const zeros=months.map(row=>({...row,net_income:"0"}));
  const result=await evaluate("final","0","0",zeros);
  assert.equal(has(result.blockers,code),false);
});
test("A2 r28: verified approved number does not trigger unresolved gate",async()=>{
  const result=await evaluate("final","2,400,000","2,400,000");
  assert.equal(has(result.blockers,code),false);
});
test("A2 r28: absent observed income is not fabricated as approval-required",async()=>{
  const result=await evaluate("final","[확인 필요]","[확인 필요]",[]);
  assert.equal(has(result.blockers,code),false);
});
test("A2 r28: SQL-style null and undefined approvals remain unresolved, not zero",async()=>{
  for(const missing of [null,undefined]){
    const result=await evaluate("final",missing,"2,400,000");
    assert.equal(has(result.blockers,code),true);
  }
});
test("A2 r28: previewed income with no month table still blocks this separate approval gate",async()=>{
  const result=await evaluate("final","[확인 필요]","2,400,000",[]);
  assert.equal(has(result.blockers,code),true);
});

test("A2 r34 integration: approved month amount with no rows blocks final",async()=>{
  const r=await evaluate("final","2,400,000","2,400,000",[]);
  assert.equal(r.status,"blocked");
  assert.equal(has(r.blockers,"D5103_MONTH_ROWS_MISSING"),true);
});
test("A2 r34 integration: missing middle month is not silently filled",async()=>{
  const rows=months.filter(row=>row.period!=="2026-06");
  const r=await evaluate("final","2,400,000","2,400,000",rows);
  assert.equal(r.status,"blocked");
  assert.equal(has(r.blockers,"D5103_MONTH_COVERAGE_GAP"),true);
});
test("A2 r34 integration: malformed grouping 2,40,000 is not numeric won",async()=>{
  const rows=months.map(row=>row.period==="2026-06"?{...row,net_income:"2,40,000"}:row);
  const r=await evaluate("final","2,400,000","2,400,000",rows);
  assert.equal(r.status,"blocked");
  assert.equal(has(r.blockers,"D5103_MONTH_EVIDENCE_UNRESOLVED"),true);
});
test("A2 r34 integration: missing observed month amount differs from explicit zero",async()=>{
  const missing=months.map(row=>row.period==="2026-06"?{...row,net_income:"[확인 필요]"}:row);
  const zero=months.map(row=>row.period==="2026-06"?{...row,net_income:"0"}:row);
  const a=await evaluate("final","2,400,000","2,400,000",missing);
  const b=await evaluate("final","2,400,000","2,400,000",zero);
  assert.equal(has(a.blockers,"D5103_MONTH_EVIDENCE_UNRESOLVED"),true);
  assert.equal(has(b.blockers,"D5103_MONTH_EVIDENCE_UNRESOLVED"),false);
});
// Deliberately NOT asserted complete: selected representative period is not
// part of these bindings. Never infer a blanket statutory 12-month period.
test.todo("A2 r34: identify missing first selected-period month via period metadata");
test.todo("A2 r34: identify missing last selected-period month via period metadata");
test.todo("A2 r34: prevent future month being treated as historical observation");
