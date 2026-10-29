import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { INTAKE_CATALOG_SEED } from "../lib/intake-catalog.ts";
import { validateIntakeCatalog } from "../lib/intake-engine.ts";
import { supplementIntakeCatalog } from "../lib/intake-catalog-snapshot.ts";

const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
test("legacy eight-key document snapshots retain exact canonical payload hashes",()=>{
  const legacy=structuredClone(INTAKE_CATALOG_SEED);
  for(const document of legacy.documents)delete document.ocr;
  const canonical=validateIntakeCatalog(legacy),before=JSON.stringify(canonical);
  const reread=validateIntakeCatalog(JSON.parse(before));
  assert.equal(JSON.stringify(reread),before);
  assert.equal(hash(reread),hash(canonical));
  assert.ok(reread.documents.every(document=>!Object.hasOwn(document,"ocr")));
});

test("OCR contract metadata validates its complete shape without accepting unsupported review states",()=>{
  const catalog=structuredClone(INTAKE_CATALOG_SEED);
  catalog.documents[0].ocr={familyIds:["identity_residence_record"],fieldContractIds:["identity:shared-document-fields-v1"],routingStatus:"ready",collectionMode:"client_evidence"};
  assert.deepEqual(validateIntakeCatalog(catalog).documents[0].ocr,catalog.documents[0].ocr);
  const malformed=structuredClone(catalog) as unknown as {documents:{ocr:Record<string,unknown>}[]};
  malformed.documents[0].ocr.routingStatus="accepted";
  assert.throws(()=>validateIntakeCatalog(malformed),/INTAKE_INVALID_ENUM/);
  malformed.documents[0].ocr={familyIds:[],fieldContractIds:[],routingStatus:"ready",collectionMode:"client_evidence"};
  assert.throws(()=>validateIntakeCatalog(malformed),/INTAKE_OCR_CONTRACT_MISSING/);
  malformed.documents[0].ocr={familyIds:[],fieldContractIds:["identity:shared-document-fields-v1"],routingStatus:"review_required",collectionMode:"generated_or_prior_form"};
  assert.equal(validateIntakeCatalog(malformed).documents[0].ocr?.routingStatus,"review_required");
});

test("registry supplementation preserves custom names, rules, source edits and existing OCR choices",()=>{
  const baseline=validateIntakeCatalog(structuredClone(INTAKE_CATALOG_SEED));
  baseline.documents[0].ocr={familyIds:["identity_residence_record"],fieldContractIds:["identity:shared-document-fields-v1"],routingStatus:"ready",collectionMode:"client_evidence"};
  const added={...structuredClone(baseline.documents[0]),id:"new_registry_doc",name:"새 공통 서류"};
  baseline.documents.push(added);
  const existing=validateIntakeCatalog(structuredClone(INTAKE_CATALOG_SEED));
  existing.version=7;
  for(const document of existing.documents)delete document.ocr;
  existing.documents[0].name="사용자가 바꾼 이름";
  existing.documents[1].ocr={familyIds:[],fieldContractIds:[],routingStatus:"review_required",collectionMode:"client_evidence"};
  existing.documents.push({...structuredClone(existing.documents[0]),id:"custom_doc",name:"사용자 추가 문서"});
  existing.rules[0].enabled=false;existing.sources[0].title="사용자 출처";
  const before=JSON.stringify(existing),result=supplementIntakeCatalog(existing,baseline);
  assert.equal(JSON.stringify(existing),before);
  assert.equal(result.catalog.version,8);
  assert.equal(result.catalog.documents[0].name,"사용자가 바꾼 이름");
  assert.deepEqual(result.catalog.documents[0].ocr,baseline.documents[0].ocr);
  assert.deepEqual(result.catalog.documents[1].ocr,existing.documents[1].ocr);
  assert.ok(result.catalog.documents.some(document=>document.id==="custom_doc"));
  assert.deepEqual(result.catalog.rules,existing.rules);assert.deepEqual(result.catalog.sources,existing.sources);
  assert.deepEqual(result.addedDocumentIds,["new_registry_doc"]);
  const again=supplementIntakeCatalog(result.catalog,baseline);
  assert.equal(again.changed,false);assert.equal(again.catalog.version,8);
});
