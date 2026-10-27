import test from "node:test";
import assert from "node:assert/strict";
import { canRecoverClassification, recoveredClassificationRole, canUseRescueRole, type ClassificationRecoveryRead } from "../lib/classification-recovery.ts";
import { rescueSpecs } from "../lib/scan-quality.ts";
const observation:ClassificationRecoveryRead={role:"evidence",documentType:"payroll",confidence:"high",reason:"visible payroll columns",titleQuote:"임금명세서",issuerQuote:null,structureQuote:"지급총액 공제총액 실지급액"};
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
