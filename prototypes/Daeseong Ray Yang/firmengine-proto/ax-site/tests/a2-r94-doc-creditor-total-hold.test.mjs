// Synthetic-only A2 r94 test; court form, legal approval, D1 and real DOCX unverified.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDocumentPreflight } from "../lib/document-preflight.ts";
import { FORM_CONTRACTS } from "../lib/form-contracts.ts";

const identity = formCode => ({
  evaluationId:"SYN-r94",evaluationResultHash:"a".repeat(64),
  referenceBundleHash:"b".repeat(64),documentEditsHash:"c".repeat(64),
  templateHash:FORM_CONTRACTS[formCode].templateHash
});
const inspect=(formCode,mode,rows,scalars)=>evaluateDocumentPreflight({
  formCode,mode,bindings:{rows:{creditor:rows},scalars},identity:identity(formCode),
  contract:{...FORM_CONTRACTS[formCode],fields:[]}
});
const lines=[{principal:"100",interest:"30"},{principal:"200",interest:"20"}];
for(const [name,scalars,invalid] of [
  ["full exact",{total_principal:"300",total_interest:"50"},false],
  ["principal unresolved",{total_principal:"[확인 필요]",total_interest:"50"},true],
  ["principal missing",{total_interest:"50"},true],
  ["principal null",{total_principal:null,total_interest:"50"},true],
  ["principal malformed",{total_principal:"3,00",total_interest:"50"},true],
  ["interest pending",{total_principal:"300",total_interest:"[승인전]"},true],
  ["both totals missing",{},true],
  ["principal mismatch",{total_principal:"299",total_interest:"50"},true],
]) test(`A2 r94 D5106 ${name}`,async()=>{
 const r=await inspect("D5106","final",lines,scalars);
 assert.equal(r.blockers.length>0,invalid);
 if(name.includes("unresolved")||name.includes("missing")||name.includes("null")||name.includes("malformed")||name.includes("pending"))
  assert.ok(r.blockers.some(i=>i.code==="REPEAT_ROW_TOTAL_UNVERIFIED"));
});
test("A2 r94 explicit reviewed zero remains zero",async()=>{
 const r=await inspect("D5106","final",[{principal:"0",interest:"0"}],{total_principal:"0",total_interest:"0"});
 assert.ok(!r.blockers.some(i=>i.code.startsWith("REPEAT_ROW_")));
});
test("A2 r94 D5106 invalid row does not certify header total",async()=>{
 const r=await inspect("D5106","final",[{principal:"1,00",interest:"0"}],{total_principal:"100",total_interest:"0"});
 assert.ok(r.blockers.some(i=>i.code==="REPEAT_ROW_AMOUNT_FORMAT_INVALID"));
});
for(const code of ["D5110","D5111"])test(`A2 r94 ${code} has no D5106 totals`,async()=>{
 const r=await inspect(code,"final",[{principal:"100",interest:"0"}],{});
 assert.ok(!r.blockers.some(i=>i.code==="REPEAT_ROW_TOTAL_UNVERIFIED"));
});
test("A2 r94 draft missing header is warning not final blocker",async()=>{
 const r=await inspect("D5106","draft",lines,{total_interest:"50"});
 assert.ok(r.warnings.some(i=>i.code==="REPEAT_ROW_TOTAL_UNVERIFIED"));
 assert.ok(!r.blockers.some(i=>i.code==="REPEAT_ROW_TOTAL_UNVERIFIED"));
});
test.todo("Full project Node/TypeScript test suite and CI against merged draft chain");
test.todo("Actual current-case typed/SQL features to D5106 DOCX ZIP/XML readback");
test.todo("Official court form parity and employee/attorney approval before release");
