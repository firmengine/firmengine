import test from "node:test";
import assert from "node:assert/strict";
import { FORM_CONTRACTS } from "../lib/form-contracts.ts";
import { evaluateDocumentPreflight } from "../lib/document-preflight.ts";

// Synthetic internal review gate only: no real customers, court template bytes,
// approval evidence, source OCR or filing claims.
const forms = ["D5103", "D5110", "D5111"] as const;
const unresolved = [
  "[확인 필요] 원문", "[확인 필요]123", "[불일치]",
  "[불일치] 123", "[불일치·확인 필요] 검토", "source-only_bad",
];
const unchanged = ["[미관찰]", "[승인전]", "[상충]", "[누락]", "[검토완료]"];
async function inspect(formCode: typeof forms[number], value: string, mode: "draft" | "final") {
  const base=FORM_CONTRACTS[formCode];
  assert.ok(base, formCode);
  const fields=base.fields.filter((item)=>item.token==="client_name");
  assert.equal(fields.length,1,formCode);
  const contract={...base,fields,repeatGroups:[]};
  return evaluateDocumentPreflight({
    formCode, contract, mode,
    identity:{evaluationId:"SYN-R70",evaluationResultHash:"synthetic-evaluation",
      referenceBundleHash:"synthetic-reference",templateHash:contract.templateHash,
      documentEditsHash:"synthetic-edit"},
    bindings:{scalars:{client_name:value},rows:{}},
  });
}
test("A2-DOC r70: suffix/compound markers block all three final form codes",async()=>{
  for(const formCode of forms) for(const value of unresolved){
    const out=await inspect(formCode,value,"final");
    assert.equal(out.status,"blocked",formCode+" / "+value);
    assert.ok(out.blockers.some(x=>x.code==="FIELD_UNRESOLVED"&&x.token==="client_name"),formCode+" / "+value);
  }
});
test("A2-DOC r70: draft retains unresolved warnings without final status",async()=>{
  for(const formCode of forms) for(const value of unresolved){
    const out=await inspect(formCode,value,"draft");
    assert.equal(out.status,"draft_with_unresolved",formCode+" / "+value);
    assert.ok(out.warnings.some(x=>x.code==="FIELD_UNRESOLVED"&&x.token==="client_name"),formCode+" / "+value);
  }
});
test("A2-DOC r70: existing unresolved tokens remain fail closed",async()=>{
  for(const formCode of forms) for(const value of unchanged){
    const out=await inspect(formCode,value,"final");
    assert.equal(out.status,"blocked",formCode+" / "+value);
  }
});
test("A2-DOC r70: explicit zero does not become null or missing",async()=>{
  for(const formCode of forms){
    const out=await inspect(formCode,"0","final");
    assert.equal(out.blockers.some(x=>x.code==="FIELD_UNRESOLVED"&&x.token==="client_name"),false,formCode);
  }
});
// Tests above assert application string-status handling only. They do not
// certify applicant identity, optional field applicability or final DOCX parity.
