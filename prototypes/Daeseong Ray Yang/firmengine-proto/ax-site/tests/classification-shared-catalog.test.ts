import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSharedClassificationSchema, sharedClassificationCatalogInput,
  hasValidSharedClassification, hasValidClassificationCatalog, observedClassificationRole,
  CLASSIFICATION_CATALOG_RELEASE, SHARED_DOCUMENT_CLASSIFICATION_INSTRUCTIONS,
  type ClassificationRead, type SharedClassificationCatalog,
} from "../lib/classification-recovery.ts";

const snapshot:SharedClassificationCatalog={catalogVersion:7,catalogSha256:"a".repeat(64),documents:[
  {documentTypeId:"salary_statement",name:"급여명세서·사용자 소득증명",allowedFamilyIds:["payroll_payslip"],collectionMode:"requested",routingStatus:"mapped",fieldContracts:[{familyId:"payroll_payslip",fields:[{id:"payroll_payslip::income.payroll.net_pay",key:"income.payroll.net_pay",label:"Net pay"}]}]},
  {documentTypeId:"debt_certificate",name:"채권자별 부채증명·채무잔액 확인자료",allowedFamilyIds:["debt_certificate"],collectionMode:"requested",routingStatus:"mapped",fieldContracts:[]},
]};
const reading:ClassificationRead={role:"evidence",familyId:"payroll_payslip",catalogRelease:CLASSIFICATION_CATALOG_RELEASE,boundaryObservation:"single_page",boundaryQuote:null,confidence:"high",reason:"visible payroll columns",titleQuote:"임금명세서",issuerQuote:null,structureQuote:"지급총액 공제총액 실지급액",evidenceRowsQuote:"실지급액 1,000,000원",administrativeStructureQuote:null,legibility:"clear",documentTypeId:"salary_statement",documentCatalogVersion:7,documentCatalogSha256:"a".repeat(64)};

test("OCR public choices and names come from the supplied active shared catalogue",()=>{
  const input=sharedClassificationCatalogInput(snapshot),schema=buildSharedClassificationSchema(snapshot);
  assert.deepEqual(input.documents.map(d=>({id:d.documentTypeId,name:d.name})),snapshot.documents.map(d=>({id:d.documentTypeId,name:d.name})));
  assert.deepEqual(schema.properties.documentTypeId.enum,["salary_statement","debt_certificate",null]);
  assert.ok(!schema.properties.documentTypeId.enum.includes("payroll_payslip"),"internal extraction family is not a second public document choice");
  assert.deepEqual(input.documents[0].fieldContracts[0].sourceFields,snapshot.documents[0].fieldContracts[0].fields);
  assert.match(SHARED_DOCUMENT_CLASSIFICATION_INSTRUCTIONS,/상담 에이전트와 동일한 documentTypeId와 name/);
});

test("active catalogue additions and renamed labels reach OCR without rebuilding a seed enum",()=>{
  const changed:SharedClassificationCatalog={...snapshot,catalogVersion:8,catalogSha256:"b".repeat(64),documents:[{...snapshot.documents[0],name:"변경된 급여 자료"},...snapshot.documents.slice(1),{documentTypeId:"custom_current_debt",name:"새 현재채무 확인자료",allowedFamilyIds:["debt_certificate"],collectionMode:"requested",routingStatus:"mapped",fieldContracts:[]}]};
  const input=sharedClassificationCatalogInput(changed),schema=buildSharedClassificationSchema(changed);
  assert.equal(input.documents[0].name,"변경된 급여 자료");
  assert.ok(schema.properties.documentTypeId.enum.includes("custom_current_debt"));
  assert.deepEqual(schema.properties.documentCatalogVersion.enum,[8]);
  assert.deepEqual(schema.properties.documentCatalogSha256.enum,["b".repeat(64)]);
  assert.equal(hasValidSharedClassification({...reading,familyId:"debt_certificate",documentTypeId:"custom_current_debt",documentCatalogVersion:8,documentCatalogSha256:"b".repeat(64)},changed),true);
});

test("a valid family cannot authorize a different public document or catalogue snapshot",()=>{
  assert.equal(hasValidSharedClassification(reading,snapshot),true);
  assert.equal(hasValidSharedClassification({...reading,familyId:"debt_certificate"},snapshot),false,"shared ID/family pair must be registered");
  assert.equal(hasValidSharedClassification({...reading,documentTypeId:"made_up_document"},snapshot),false);
  assert.equal(hasValidSharedClassification({...reading,documentCatalogVersion:6},snapshot),false);
  assert.equal(hasValidSharedClassification({...reading,documentCatalogSha256:"b".repeat(64)},snapshot),false);
  assert.equal(hasValidSharedClassification({...reading,documentTypeName:"another name"},snapshot),false);
  assert.equal(hasValidSharedClassification({...reading,documentTypeName:snapshot.documents[0].name},snapshot),true);
  assert.equal(hasValidSharedClassification({...reading,catalogRelease:"stale-field-contract"},snapshot),false);
});

test("unrecognized documents and identified documents without extraction routes stay unresolved",()=>{
  assert.equal(hasValidSharedClassification({...reading,role:"unknown",documentTypeId:null,familyId:null},snapshot),true);
  assert.equal(hasValidSharedClassification({...reading,documentTypeId:null},snapshot),false,"family alone must not bypass the shared public list");
  const noRoute:SharedClassificationCatalog={...snapshot,documents:[...snapshot.documents,{documentTypeId:"unmapped_source",name:"미연결 자료",allowedFamilyIds:[],collectionMode:"requested",routingStatus:"review_required",fieldContracts:[]}]};
  const unresolved={...reading,documentTypeId:"unmapped_source",familyId:null};
  assert.equal(hasValidSharedClassification(unresolved,noRoute),true,"the document identity may be retained without inventing a family");
  assert.equal(observedClassificationRole(unresolved),"unknown");
  assert.equal(hasValidSharedClassification({...unresolved,familyId:"payroll_payslip"},noRoute),false);
});

test("historical family-only receipts remain inspectable but cannot validate a new shared call",()=>{
  const legacy={...reading};
  delete legacy.documentTypeId;delete legacy.documentCatalogVersion;delete legacy.documentCatalogSha256;
  assert.equal(hasValidClassificationCatalog(legacy),true);
  assert.equal(observedClassificationRole(legacy),"evidence");
  assert.equal(hasValidSharedClassification(legacy,snapshot),false);
});

test("ambiguous IDs and missing catalogue identity fail before a model request",()=>{
  assert.throws(()=>buildSharedClassificationSchema({...snapshot,documents:[...snapshot.documents,snapshot.documents[0]]}),/Invalid shared document catalogue/);
  assert.throws(()=>buildSharedClassificationSchema({...snapshot,catalogSha256:""}),/Invalid shared document catalogue/);
});
