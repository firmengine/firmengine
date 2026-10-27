import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDocumentGeneration, type CorpusSample } from "../lib/document-generation-metrics.ts";

function sample(overrides: Partial<CorpusSample> = {}): CorpusSample {
  return {
    sampleId:"synth-1", underlyingCaseId:"synthetic-case-a", variantId:"scan-a", split:"test", origin:"synthetic",
    inputFactIds:["fact-name","fact-income"],
    expectedDocuments:[{id:"petition",fields:[
      {key:"name",value:"가상인",critical:true,requiresSourceRef:true},
      {key:"income",value:100,critical:true,requiresSourceRef:true},
    ]}],
    generatedDocuments:[{id:"petition",officeCheck:"valid",fields:[
      {key:"name",status:"value",value:"가상인",sourceFactIds:["fact-name"]},
      {key:"income",status:"value",value:100,sourceFactIds:["fact-income"]},
    ]}],
    ...overrides,
  };
}

test("synthetic perfect single-case scores stay corpus-local and cannot claim universal 99%",()=>{
  const m=evaluateDocumentGeneration([sample()]);
  assert.equal(m.documentExactSuccess.value,1);
  assert.equal(m.qualifiedDocumentSuccess.value,1);
  assert.equal(m.observed99ThresholdMet,true);
  assert.equal(m.wholeCaseCompleteness.value,1);
  assert.equal(m.fieldAccuracy.value,1);
  assert.equal(m.inputProvenance.rateAmongRequired.value,1);
  assert.equal(m.officeValidation.passRateAmongExpected.value,1);
  assert.equal(m.singleCaseEvidenceOnly,true);
  assert.equal(m.universal99ClaimAllowed,false);
  assert.match(m.claimNote,/One underlying case/);
  assert.equal(m.originBreakdown.synthetic.cases,1);
  assert.equal(m.originBreakdown.real_case.samples,0);
});

test("fixed expected manifest keeps missing docs and abstentions in denominators",()=>{
  const s=sample({generatedDocuments:[{id:"petition",officeCheck:"not_run",fields:[
    {key:"name",status:"abstained",sourceFactIds:[]},
  ]}]});
  const m=evaluateDocumentGeneration([s]);
  assert.equal(m.expectedDocuments,1); assert.equal(m.exactDocuments,0); assert.equal(m.documentExactSuccess.value,0);
  assert.equal(m.expectedFields,2); assert.equal(m.exactFields,0); assert.equal(m.fieldAccuracy.value,0);
  assert.equal(m.abstainedFields,1); assert.equal(m.missingFields,1); assert.equal(m.criticalErrors,2);
  assert.equal(m.wholeCaseCompleteness.value,0); assert.equal(m.officeValidation.notRun,1);
  assert.equal(m.officeValidation.passRateAmongExpected.value,0);
  assert.equal(m.inputProvenance.invalidFields,2);
  assert.equal(m.qualifiedDocumentSuccess.value,0);
  assert.equal(m.observed99ThresholdMet,false);
  const absent=evaluateDocumentGeneration([sample({generatedDocuments:[]})]);
  assert.equal(absent.missingDocuments,1); assert.equal(absent.missingFields,2); assert.equal(absent.officeValidation.notRun,1);
  assert.equal(absent.documentExactSuccess.value,0);
});

test("wrong provenance and Office validation are independent of exact text scoring",()=>{
  const s=sample({generatedDocuments:[{id:"petition",officeCheck:"invalid",fields:[
    {key:"name",status:"value",value:"가상인",sourceFactIds:["not-an-input"]},
    {key:"income",status:"value",value:100,sourceFactIds:["fact-income"]},
  ]}]});
  const m=evaluateDocumentGeneration([s]);
  assert.equal(m.documentExactSuccess.value,1);
  assert.equal(m.inputProvenance.invalidFields,1);
  assert.equal(m.officeValidation.invalid,1);
  assert.equal(m.officeValidation.passRateAmongExpected.value,0);
  assert.equal(m.qualifiedDocumentSuccess.value,0);
  assert.equal(m.observed99ThresholdMet,false);
});

test("scan/template variants share one case split and split leakage is flagged",()=>{
  const variant=sample({sampleId:"synth-1-b",variantId:"template-b"});
  let m=evaluateDocumentGeneration([sample(),variant]);
  assert.equal(m.uniqueUnderlyingCaseCount,1); assert.equal(m.expectedCases,1); assert.equal(m.completeCases,1);
  assert.equal(m.documentExactSuccess.denominator,2);
  m=evaluateDocumentGeneration([sample(),sample({sampleId:"synth-1-val",variantId:"scan-val",split:"validation"})]);
  assert.ok(m.validationErrors.some(e=>e.includes("overlaps corpus splits")));
  assert.equal(m.uniqueUnderlyingCaseCount,1);
  assert.equal(m.observed99ThresholdMet,false);
});

test("correct text with unrun physical verification cannot pass the generation threshold",()=>{
  const s=sample(); s.generatedDocuments[0].officeCheck="not_run";
  const m=evaluateDocumentGeneration([s]);
  assert.equal(m.documentExactSuccess.value,1);
  assert.equal(m.qualifiedDocumentSuccess.value,0);
  assert.equal(m.observed99ThresholdMet,false);
});

test("duplicate sample identities invalidate a superficially perfect threshold",()=>{
  const m=evaluateDocumentGeneration([sample(),sample()]);
  assert.equal(m.documentExactSuccess.value,1);
  assert.ok(m.validationErrors.length);
  assert.equal(m.observed99ThresholdMet,false);
});

test("empty manifests, duplicate keys, unexpected output, and changed denominators are reported",()=>{
  const invalid=sample({expectedDocuments:[{id:"blank",fields:[]}],generatedDocuments:[{id:"extra",officeCheck:"valid",fields:[]}]});
  const m=evaluateDocumentGeneration([invalid]);
  assert.equal(m.expectedDocuments,1); assert.equal(m.missingDocuments,1); assert.equal(m.unexpectedDocuments,1);
  assert.ok(m.validationErrors.some(e=>e.includes("empty expected field manifest")));
  assert.ok(m.validationErrors.some(e=>e.includes("unexpected generated document")));
  assert.equal(m.documentExactSuccess.value,0);
  assert.equal(m.wholeCaseCompleteness.value,0);
  const noManifest=evaluateDocumentGeneration([sample({expectedDocuments:[],generatedDocuments:[]})]);
  assert.equal(noManifest.documentExactSuccess.value,null);
  assert.equal(noManifest.wholeCaseCompleteness.value,0);
});
