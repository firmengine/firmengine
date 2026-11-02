// Synthetic review-only preflight cases: no customer, OCR, legal approval, or live D1.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDocumentPreflight } from "../lib/document-preflight.ts";
import { FORM_CONTRACTS } from "../lib/form-contracts.ts";

const ID = code => ({
  evaluationId: "SYN-r88", evaluationResultHash: "a".repeat(64),
  referenceBundleHash: "b".repeat(64), documentEditsHash: "c".repeat(64),
  templateHash: FORM_CONTRACTS[code].templateHash
});
function inspect(code,mode,bindings) {
  const contract={...FORM_CONTRACTS[code],fields:[]};
  return evaluateDocumentPreflight({formCode:code,mode,bindings,identity:ID(code),contract});
}
for (const period of ["2026-01","2026-06","2026-12"]) {
  for (const [amount,invalid] of [["1,000원",false],["0원",false],["₩ 1,234",false],["1,00",true],["0 0",true],["1원2",true],["[미관찰]",true]]) {
    test(`A2 r88 D5103 ${period} amount ${amount} does not auto-repair`,async()=>{
      const result=await inspect("D5103","final",{scalars:{client_name:"SYN"},rows:{month:[{period,net_income:amount}]}});
      assert.equal(result.blockers.some(x=>x.code==="D5103_MONTH_EVIDENCE_UNRESOLVED"),invalid);
    });
  }
}
for (const [amount,invalid] of [["100",false],["0",false],["1,00",true],["1원2",true],["0 0",true],["[미관찰]",true]]) {
  test(`A2 r88 creditor source component ${amount} prevents false total check`,async()=>{
    const result=await inspect("D5106","final",{
      scalars:{client_name:"SYN",total_principal:invalid?"100":amount,total_interest:"0"},
      rows:{creditor:[{principal:amount,interest:"0"}]}
    });
    assert.equal(result.blockers.some(x=>x.code==="REPEAT_ROW_AMOUNT_FORMAT_INVALID"),invalid);
  });
}
test("A2 r88 exact creditor sum still blocks mismatches",async()=>{
  const z=await inspect("D5106","final",{
    scalars:{client_name:"SYN",total_principal:"301",total_interest:"0"},
    rows:{creditor:[{principal:"100",interest:"0"},{principal:"200",interest:"0"}]}
  });
  assert.ok(z.blockers.some(x=>x.code==="REPEAT_ROW_TOTAL_MISMATCH"));
});
test("A2 r88 draft malformed amount warns instead of final blocker",async()=>{
  const z=await inspect("D5106","draft",{
    scalars:{client_name:"SYN",total_principal:"100",total_interest:"0"},
    rows:{creditor:[{principal:"1,00",interest:"0"}]}
  });
  assert.ok(z.warnings.some(x=>x.code==="REPEAT_ROW_AMOUNT_FORMAT_INVALID"));
  assert.ok(!z.blockers.some(x=>x.code==="REPEAT_ROW_AMOUNT_FORMAT_INVALID"));
});
test.todo("Project-installed Node full suite and CI including stacked review Drafts");
test.todo("Real D1/R2 API roundtrip and authenticated same-case Fact/revision/approval lineage");
test.todo("Generated D5103/D5106/D5110/D5111 DOCX ZIP/XML value and official form parity");
