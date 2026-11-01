import test from "node:test";
import assert from "node:assert/strict";
import {classifyPublicFormToken, MISSING_FORM_VALUE} from "../lib/form-mapping.ts";

// Purely synthetic display tokens; this is NOT court-template/Word verification.
test("A2 r58: a displayed observed amount, explicit zero and not-applicable stay distinct",()=>{
  for(const value of ["2,400,000","0","[해당없음]"]){
    assert.deepEqual(classifyPublicFormToken(value),{displayValue:value,unresolved:false},value);
  }
});

test("A2 r58: unobserved, conflicting, source-only and unapproved values are listed as unresolved",()=>{
  for(const value of ["[미관찰]","source-only","[source-only]","[상충]","[불일치·확인 필요]",
    "[누락]","[검토 필요]","[판독 불가]","[미확정]","[승인전]","[원천만]"]){
    assert.deepEqual(classifyPublicFormToken(value),{displayValue:value,unresolved:true},value);
  }
});

test("A2 r58: malformed runtime scalar/row values fail closed instead of throwing",()=>{
  for(const value of [null,undefined,0,[],{},false,"","  "]){
    assert.deepEqual(classifyPublicFormToken(value),{displayValue:MISSING_FORM_VALUE,unresolved:true},
      String(value));
  }
});

test("A2 r58: visible marked values are not silently converted to verified legal amounts",()=>{
  const shown=classifyPublicFormToken("[상충] ");
  assert.equal(shown.unresolved,true);
  assert.equal(shown.displayValue,"[상충] ");
  assert.equal(classifyPublicFormToken("0").unresolved,false);
  assert.equal(classifyPublicFormToken(null).unresolved,true);
});
