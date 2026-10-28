import test from "node:test";
import assert from "node:assert/strict";
import { canRecoverClassification, recoveredClassificationRole, observedClassificationRole, canUseRescueRole, hasValidClassificationCatalog, CLASSIFICATION_CATALOG_RELEASE, CLASSIFICATION_FAMILY_IDS, CLASSIFICATION_FAMILY_CATALOG, CLASSIFICATION_SCHEMA, CLASSIFICATION_INSTRUCTIONS, CLASSIFICATION_RECOVERY_INSTRUCTIONS, type ClassificationRecoveryRead } from "../lib/classification-recovery.ts";
import contracts from "../lib/document-agent-field-contracts.json" with { type: "json" };
import { rescueSpecs } from "../lib/scan-quality.ts";
const observation:ClassificationRecoveryRead={role:"evidence",familyId:"payroll_payslip",catalogRelease:"catalog-release-v2.2.0",boundaryObservation:"single_page",boundaryQuote:null,confidence:"high",reason:"visible payroll columns",titleQuote:"임금명세서",issuerQuote:null,structureQuote:"지급총액 공제총액 실지급액",evidenceRowsQuote:"기본급 3,000,000 / 공제액 300,000",administrativeStructureQuote:null,legibility:"clear"};
test("classifier runtime gate requires exact catalog release and family membership",()=>{
  assert.equal(hasValidClassificationCatalog({catalogRelease:CLASSIFICATION_CATALOG_RELEASE,familyId:CLASSIFICATION_FAMILY_IDS[0]}),true);
  assert.equal(hasValidClassificationCatalog({catalogRelease:CLASSIFICATION_CATALOG_RELEASE,familyId:null}),true);
  assert.equal(hasValidClassificationCatalog({catalogRelease:"old-catalog",familyId:CLASSIFICATION_FAMILY_IDS[0]}),false);
  assert.equal(hasValidClassificationCatalog({catalogRelease:CLASSIFICATION_CATALOG_RELEASE,familyId:"not_a_family"}),false);
});
test("classification recovery has a second-call budget, and suspected holdouts never enter rescue",()=>{
  assert.equal(canRecoverClassification({...observation,role:"unknown"},1),true);
  assert.equal(canRecoverClassification({...observation,confidence:"low"},1),true);
  assert.equal(canRecoverClassification({...observation,legibility:"low"},1),true,"effective unknown from low legibility can be rescued even if raw role/confidence look strong");
  assert.equal(canRecoverClassification({...observation,structureQuote:null},1),true,"missing source structure leaves the role unresolved and permits one bounded look");
  assert.equal(canRecoverClassification({...observation,role:"unknown"},2),false);
  for(const attempts of [-1,0.5,Number.NaN,Number.POSITIVE_INFINITY])assert.equal(canRecoverClassification({...observation,role:"unknown"},attempts),false);
  for(const role of ["filed_form","administrative"] as const)assert.equal(canRecoverClassification({...observation,role,confidence:"low"},1),false);
  assert.equal(canRecoverClassification({...observation,role:"administrative",legibility:"low"},1),false,"raw administrative classification remains excluded even when effective role is unknown");
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
  const genericHeading:ClassificationRecoveryRead={...observation,role:"administrative",familyId:"payroll_payslip",catalogRelease:"catalog-release-v2.2.0",boundaryObservation:"single_page",boundaryQuote:null,titleQuote:"급여 안내",evidenceRowsQuote:null,administrativeStructureQuote:null};
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
  assert.deepEqual(CLASSIFICATION_SCHEMA.required,["role","familyId","catalogRelease","boundaryObservation","boundaryQuote","confidence","reason","legibility","titleQuote","issuerQuote","structureQuote","evidenceRowsQuote","administrativeStructureQuote","sourceNature","sourceNatureQuote"]);
  assert.match(CLASSIFICATION_INSTRUCTIONS,/구체 증빙 구조는 administrative 제목보다 우선한다/);
  assert.match(CLASSIFICATION_INSTRUCTIONS,/legibility=low/);
  assert.equal(CLASSIFICATION_SCHEMA.properties.familyId.enum.length,49);
  assert.match(CLASSIFICATION_INSTRUCTIONS,/페이지 결합이나 사실 병합을 하지 않는다/);
});
test("family signatures are exact contract-derived keys and labels, used only as routing cues",()=>{
  assert.equal(CLASSIFICATION_FAMILY_CATALOG.length,48);
  assert.equal(CLASSIFICATION_FAMILY_CATALOG.reduce((n,f)=>n+f.sourceFields.length,0),524);
  for(const entry of CLASSIFICATION_FAMILY_CATALOG){
    const contract=contracts.families[entry.familyId as keyof typeof contracts.families];
    assert.ok(contract,"catalog family must exist in the public field contract");
    assert.deepEqual(entry.sourceFields,contract.fields.map(field=>({key:field.local_id,label:field.label})));
    assert.ok(entry.sourceFields.every(field=>field.key&&field.label));
  }
  for(const instructions of [CLASSIFICATION_INSTRUCTIONS,CLASSIFICATION_RECOVERY_INSTRUCTIONS]){
    assert.match(instructions,/여러 필드\/열의 조합/);
    assert.match(instructions,/주체·기간·단위/);
    assert.match(instructions,/보이지 않는 필드의 존재·값·단위·주체·기간을 추정/);
    assert.match(instructions,/값 추출 체크리스트가 아니다/);
    assert.match(instructions,/합성·예시 표시가 있어도 표제와 필드\/행 구조가 명확하면/);
    assert.match(instructions,/official_record_claim도 발급·진위 검증 완료가 아니다/);
    assert.match(instructions,/법원 제출용 원본 서식|제출용 법원 서식/);
  }
});
test("source nature never substitutes for structural evidence or legal recognition",()=>{
  for(const sourceNature of ["copy","self_report","synthetic_example","official_record_claim","unknown"] as const){
    const source={...observation,sourceNature,sourceNatureQuote:"자료의 출처에 대한 원문 표시"};
    assert.equal(observedClassificationRole(source),"evidence","readable observations remain routable irrespective of an authenticity claim");
    assert.equal(observedClassificationRole({...source,structureQuote:null}),"unknown","source nature cannot supply missing structural evidence");
    assert.equal(observedClassificationRole({...source,familyId:null}),"unknown","source nature cannot manufacture a catalog family");
    assert.equal(observedClassificationRole({...source,legibility:"low"}),"unknown");
    assert.equal(observedClassificationRole({...source,role:"filed_form"}),"filed_form","source nature never releases a protected filed form");
  }
  assert.match(CLASSIFICATION_INSTRUCTIONS,/공식 발급 여부가 확인되지 않았다는 이유만으로 보이는 구조를 unknown으로 바꾸지 않는다/);
  assert.match(CLASSIFICATION_INSTRUCTIONS,/official_record_claim도 발급·진위 검증 완료가 아니다/);
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
