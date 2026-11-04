// A2 r124 synthetic-only D5106 total invariant: no customer/OCR/live database.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDocumentPreflight } from "../lib/document-preflight.ts";
import { FORM_CONTRACTS } from "../lib/form-contracts.ts";
const code="D5106";
const contract={...FORM_CONTRACTS[code],fields:[]}; // isolate numeric/repeat-row contract
const identity={
  evaluationId:"SYN-r124",evaluationResultHash:"a".repeat(64),
  referenceBundleHash:"b".repeat(64),documentEditsHash:"c".repeat(64),
  templateHash:contract.templateHash
};
async function check(principalTotal,principalRows,mode="final",interestTotal="0"){
  return evaluateDocumentPreflight({
    formCode:code,mode,identity,contract,
    bindings:{scalars:{total_principal:principalTotal,total_interest:interestTotal},
      rows:{creditor:principalRows.map(principal=>({principal,interest:"0"}))}}
  });
}
for(const [label,total,rows,expected] of [
  ["valid zero","0",["0"],null],
  ["valid integer","120",["120"],null],
  ["valid canonical grouping","1,234",["1,234"],null],
  ["2 rows reconcile","300",["100","200"],null],
  ["arithmetic mismatch","121",["120"],"REPEAT_ROW_TOTAL_MISMATCH"],
  ["bad total comma","1,20",["120"],"REPEAT_TOTAL_AMOUNT_UNVERIFIED"],
  ["bad total spaces","0 0",["0"],"REPEAT_TOTAL_AMOUNT_UNVERIFIED"],
  ["embedded suffix","1원2",["12"],"REPEAT_TOTAL_AMOUNT_UNVERIFIED"],
  ["source missing",null,["100"],"REPEAT_TOTAL_AMOUNT_UNVERIFIED"],
  ["unobserved marker","[확인 필요]",["100"],"REPEAT_TOTAL_AMOUNT_UNVERIFIED"],
  ["two valid rows invalid total","3,00",["100","200"],"REPEAT_TOTAL_AMOUNT_UNVERIFIED"],
  ["bad source row","120",["1,20"],"REPEAT_ROW_AMOUNT_FORMAT_INVALID"]
]){
  test("r124 "+label,async()=>{
    const result=await check(total,rows);
    assert.equal(result.blockers.some(x=>x.code===expected),expected!==null);
    if(expected) assert.ok(result.blockers.some(x=>x.code===expected),JSON.stringify(result.blockers));
    else assert.ok(!result.blockers.some(x=>["REPEAT_TOTAL_AMOUNT_UNVERIFIED","REPEAT_ROW_TOTAL_MISMATCH","REPEAT_ROW_AMOUNT_FORMAT_INVALID"].includes(x.code)));
  });
}
test("invalid interest total is independently held",async()=>{
  const r=await check("100",["100"],"final","BAD");
  assert.ok(r.blockers.some(x=>x.token==="total_interest"&&x.code==="REPEAT_TOTAL_AMOUNT_UNVERIFIED"));
});
test("draft emits warning, not final blocker, for unverified total",async()=>{
  const r=await check("1,20",["120"],"draft");
  assert.ok(r.warnings.some(x=>x.code==="REPEAT_TOTAL_AMOUNT_UNVERIFIED"));
  assert.ok(!r.blockers.some(x=>x.code==="REPEAT_TOTAL_AMOUNT_UNVERIFIED"));
});
test("zero creditor rows remains separate coverage gate",async()=>{
  const r=await check(null,[],"final");
  assert.ok(!r.blockers.some(x=>x.code==="REPEAT_TOTAL_AMOUNT_UNVERIFIED"));
});
test.todo("Project full Node/TS test runner, CI and D5106/D5110/D5111 DOCX readback");
