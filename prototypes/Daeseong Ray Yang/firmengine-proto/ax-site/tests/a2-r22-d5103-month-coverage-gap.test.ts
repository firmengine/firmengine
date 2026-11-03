import test from "node:test";
import assert from "node:assert/strict";
import {FORM_CONTRACTS} from "../lib/form-contracts.ts";
import {evaluateDocumentPreflight} from "../lib/document-preflight.ts";

// Synthetic form bindings only. Neither income acceptance nor court requiredness is decided here.
const identity={evaluationId:"A2-R22-SYNTHETIC",evaluationResultHash:"a".repeat(64),
 referenceBundleHash:"b".repeat(64),documentEditsHash:"c".repeat(64),
 templateHash:FORM_CONTRACTS.D5103.templateHash};
const months=Array.from({length:12},(_,i)=>({entity:"SYNTH_WAGE_A",
 period:`2026-${String(i+1).padStart(2,"0")}`,net_income:"2,400,000"}));
const run=(monthRows:typeof months,mode:"draft"|"final"="final",approved=true)=>
 evaluateDocumentPreflight({formCode:"D5103",mode,identity,
  bindings:{scalars:{client_name:"SYNTH_APPLICANT",
   approved_monthly_income:approved?"2,400,000":"[확인 필요]"},rows:{month:monthRows}}});
const has=(codes:{code:string}[],code:string)=>codes.some(x=>x.code===code);

test("A2 r22: 12 complete source months have no interior-gap blocker",async()=>{
 const result=await run(months);
 assert.equal(has(result.blockers,"D5103_MONTH_COVERAGE_GAP"),false);
});
test("A2 r22: 11 of 12 months with an interior missing June block final only",async()=>{
 const sample=months.filter(x=>x.period!=="2026-06");
 const final=await run(sample,"final"),draft=await run(sample,"draft");
 assert.equal(has(final.blockers,"D5103_MONTH_COVERAGE_GAP"),true);
 assert.equal(has(draft.blockers,"D5103_MONTH_COVERAGE_GAP"),false);
 assert.equal(has(draft.warnings,"D5103_MONTH_COVERAGE_GAP"),true);
});
test("A2 r22: explicit observed zero is not a missing month",async()=>{
 const sample=months.map(x=>x.period==="2026-06"?{...x,net_income:"0"}:x);
 const result=await run(sample);
 assert.equal(has(result.blockers,"D5103_MONTH_COVERAGE_GAP"),false);
});
test("A2 r22: unapproved source-only monthly amount does not trigger this approved-value rule",async()=>{
 const result=await run(months.filter(x=>x.period!=="2026-06"),"final",false);
 assert.equal(has(result.blockers,"D5103_MONTH_COVERAGE_GAP"),false);
});
test("A2 r22: year boundary 2025-12 -> 2026-02 lacks 2026-01",async()=>{
 const result=await run([
  {entity:"SYNTH_WAGE_A",period:"2025-12",net_income:"100"},
  {entity:"SYNTH_WAGE_A",period:"2026-02",net_income:"100"}]);
 assert.equal(has(result.blockers,"D5103_MONTH_COVERAGE_GAP"),true);
});
test("A2 r22: single future month and missing terminal month have no inferred legal horizon",async()=>{
 const one=await run([{entity:"SYNTH_WAGE_A",period:"2027-02",net_income:"200"}]);
 const terminal=await run(months.slice(0,11));
 assert.equal(has(one.blockers,"D5103_MONTH_COVERAGE_GAP"),false);
 assert.equal(has(terminal.blockers,"D5103_MONTH_COVERAGE_GAP"),false);
});
test("A2 r22: zero source rows still invoke the prior no-rows preflight gate",async()=>{
 const result=await run([]);
 assert.equal(has(result.blockers,"D5103_MONTH_ROWS_MISSING"),true);
});
