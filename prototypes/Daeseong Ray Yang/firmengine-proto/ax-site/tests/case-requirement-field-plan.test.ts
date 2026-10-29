import test from "node:test";
import assert from "node:assert/strict";
import { INTAKE_CATALOG_SEED } from "../lib/intake-catalog.ts";
import { buildSharedDocumentCatalog } from "../lib/shared-document-catalog.ts";
import { buildCaseRequirementFieldPlan } from "../lib/case-requirement-field-plan.ts";
import type { IntakeRequirement } from "../lib/intake-types.ts";

const catalog=INTAKE_CATALOG_SEED;
const sha="a".repeat(64);
const shared=buildSharedDocumentCatalog(catalog,sha);
function source(doc:typeof catalog.documents[number]):IntakeRequirement{
 return {id:"req-"+doc.id,documentTypeId:doc.id,documentName:doc.name,subjectId:"person",subjectLabel:"Applicant",period:"requested period",requirement:"required_when_applicable",status:"requested",reason:["synthetic"],matchedRuleIds:[],workflowIds:[],sourceClaimIds:[],sourceIds:[...doc.sourceIds],alternatives:[],alternativePolicy:"review_required",fields:[...doc.fields],issuer:doc.issuer};
}
test("all 85 consultation document types have immutable case-specific proof slots and OCR candidate metadata",()=>{
  assert.equal(catalog.documents.length,85);
  assert.equal(shared.documents.length,catalog.documents.length);
  for(const doc of catalog.documents){
    const req=source(doc);
    const plan=buildCaseRequirementFieldPlan({caseId:"case-one",runId:"run-one",requirement:req,document:doc,shared:shared.documents.find(x=>x.documentTypeId===doc.id),catalogVersion:catalog.version,catalogSha256:sha});
    assert.equal(plan.caseId,"case-one");
    assert.equal(plan.requirementId,req.id);
    assert.deepEqual(plan.requiredSourceFields,doc.fields);
    assert.equal(plan.mappingStatus,"review_required");
    assert.equal(plan.catalogSha256,sha);
    assert.equal(plan.ocrCandidates.length,doc.ocr?.familyIds.length??0,"Candidate family inventory must not be silently dropped: "+doc.id);
    assert.ok(plan.ocrCandidates.every(f=>f.fields.every(field=>!!field.id&&!!field.label)));
  }
});
test("an altered or incomplete source-field inventory fails before any case DB write",()=>{
  const doc=catalog.documents[0];
  for(const fields of [doc.fields.slice(1),[...doc.fields,"unexpected"]]){
    assert.throws(()=>buildCaseRequirementFieldPlan({caseId:"case",runId:"run",requirement:{...source(doc),fields},document:doc,shared:shared.documents[0],catalogVersion:catalog.version,catalogSha256:sha}),/CASE_REQUIREMENT_FIELD_CATALOG_MISMATCH/);
  }
});
