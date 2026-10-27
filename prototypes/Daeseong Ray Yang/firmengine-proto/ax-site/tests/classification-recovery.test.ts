import test from "node:test";
import assert from "node:assert/strict";
import { canRecoverClassification, recoveredClassificationRole, observedClassificationRole, canUseRescueRole, CLASSIFICATION_SCHEMA, CLASSIFICATION_INSTRUCTIONS, type ClassificationRecoveryRead } from "../lib/classification-recovery.ts";
import { rescueSpecs } from "../lib/scan-quality.ts";
const observation:ClassificationRecoveryRead={role:"evidence",documentType:"payroll",confidence:"high",reason:"visible payroll columns",titleQuote:"임금명세서",issuerQuote:null,structureQuote:"지급총액 공제총액 실지급액",evidenceRowsQuote:"기본급 3,000,000 / 공제액 300,000",administrativeStructureQuote:null,legibility:"clear"};
test("classification recovery has a second-call budget, and suspected holdouts never enter rescue",()=>{
  assert.equal(canRecoverClassification({...observation,role:"unknown"},1),true);
  assert.equal(canRecoverClassification({...observation,confidence:"low"},1),true);
  assert.equal(canRecoverClassification({...observation,role:"unknown"},2),false);
  for(const role of ["filed_form","administrative"] as const)assert.equal(canRecoverClassification({...observation,role,confidence:"low"},1),false);
});
test("evidence recovery requires explicit structural and title/issuer observations",()=>{
  assert.equal(recoveredClassificationRole(observation),"evidence");
  assert.equal(recoveredClassificationRole({...observation,titleQuote:null,issuerQuote:"사용자: 가상회사"}),"evidence");
  assert.equal(recoveredClassificationRole({...observation,titleQuote:null}),"unknown");
  assert.equal(recoveredClassificationRole({...observation,structureQuote:" "}),"unknown");
  assert.equal(recoveredClassificationRole({...observation,confidence:"low"}),"unknown");
  assert.equal(recoveredClassificationRole({...observation,role:"filed_form"}),"filed_form");
});
test("initial classification requires source-observed structure and does not infer administration from a generic title",()=>{
  const genericHeading:ClassificationRecoveryRead={...observation,role:"administrative",documentType:"administrative",titleQuote:"급여 안내",evidenceRowsQuote:null,administrativeStructureQuote:null};
  assert.equal(observedClassificationRole(genericHeading),"unknown","a title alone is insufficient for administrative routing");
  assert.equal(observedClassificationRole({...genericHeading,evidenceRowsQuote:"지급총액 3,000,000 / 공제액 300,000"}),"evidence","concrete evidence rows override a generic 안내 title");
  assert.equal(observedClassificationRole({...genericHeading,administrativeStructureQuote:"제출 서류를 작성해 접수 창구에 제출하십시오",structureQuote:"작성방법 · 제출처 · 확인사항"}),"administrative","separate body instruction and cover structure support administrative routing");
  assert.equal(observedClassificationRole({...genericHeading,evidenceRowsQuote:"지급총액 3,000,000 / 공제액 300,000",administrativeStructureQuote:"작성방법 · 접수처 · 제출 서류 안내"}),"unknown","mixed evidence rows and a separate administrative structure stay unresolved");
  assert.equal(observedClassificationRole({...genericHeading,administrativeStructureQuote:"급여 안내"}),"unknown","repeating the heading is not a separate administrative basis");
});
test("low legibility stays unknown and filed forms never become evidence through row cues",()=>{
  assert.equal(observedClassificationRole({...observation,role:"administrative",administrativeStructureQuote:"제출처 안내",legibility:"low"}),"unknown");
  assert.equal(observedClassificationRole({...observation,role:"filed_form",evidenceRowsQuote:"급여 지급 행"}),"filed_form");
  assert.equal(canRecoverClassification({...observation,role:"filed_form",confidence:"low"},1),false);
});
test("first classifier schema requires source quotes and legibility observations",()=>{
  assert.deepEqual(CLASSIFICATION_SCHEMA.required,["role","documentType","confidence","reason","legibility","titleQuote","issuerQuote","structureQuote","evidenceRowsQuote","administrativeStructureQuote"]);
  assert.match(CLASSIFICATION_INSTRUCTIONS,/제목.*administrative가 아니다/);
  assert.match(CLASSIFICATION_INSTRUCTIONS,/legibility=low/);
});
test("unknown role permits only a bound classification rescue, never an extraction rescue",()=>{
  assert.equal(canUseRescueRole("unknown","unknown","classification_unknown"),true);
  assert.equal(canUseRescueRole("unknown","unknown","incomplete_extraction"),false);
  assert.equal(canUseRescueRole("unknown","evidence","classification_unknown"),false);
  for(const role of ["filed_form","administrative"])assert.equal(canUseRescueRole(role,role,"classification_unknown"),false);
});
test("classification rescue preserves full-page context and provides only two bounded views",()=>{
  const specs=rescueSpecs({reason:"classification_unknown",boxes:[[.3,.3,.4,.4]],sourceHash:"a",baseImageHash:"b"});
  assert.equal(specs.length,2);assert.deepEqual(specs.map(s=>s.bbox),[[0,0,1,.45],[0,0,1,1]]);
  assert.deepEqual(specs.map(s=>s.rotation),[0,90]);assert.ok(specs.every(s=>s.sourceHash==="a"&&s.baseImageHash==="b"));
});
