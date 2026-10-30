import test from "node:test";
import assert from "node:assert/strict";
import {SUBSTITUTION_POLICY_REFERENCE_ID,SUBSTITUTION_POLICY_SEED,matchPublishedSubstitutionRoute,validateSubstitutionPolicy} from "../lib/substitution-policy.ts";
import {referenceRecord,validateReferenceValue} from "../lib/reference-registry.ts";
const sample=(overrides:Record<string,unknown>={})=>({
 policy:SUBSTITUTION_POLICY_SEED,courtId:"seoul",applicationDate:"2026-10-30",
 sourceIds:["SRC-INTAKE-SEOUL-402"],originalDocumentTypeId:"salary_withholding",
 alternativeDocumentTypeIds:["salary_statement"],periodStart:"2026-01-01",periodEnd:"2026-06-30",
 employerSigned:true,exceptionReason:"불가피한 발급 곤란 사유 원문 확인",...overrides
});
test("approved reference registry exposes court substitution policy",()=>{
 const record=referenceRecord(SUBSTITUTION_POLICY_REFERENCE_ID);
 assert.equal(record?.editable,true);assert.equal(record?.kind,"parameter");
 validateReferenceValue(record!,SUBSTITUTION_POLICY_SEED);
 assert.equal(SUBSTITUTION_POLICY_SEED.routes.length,8);
});
test("exact official route, court, period and exception required",()=>{
 assert.ok(matchPublishedSubstitutionRoute(sample()));
 for(const patch of [{courtId:"unreviewed_court"},{sourceIds:[]},{alternativeDocumentTypeIds:["employment_contract"]},{employerSigned:false},{exceptionReason:""},{applicationDate:"invalid"}])
   assert.equal(matchPublishedSubstitutionRoute(sample(patch)),null);
});
test("source-backed single and all-of document groups cannot be silently waived",()=>{
 assert.ok(matchPublishedSubstitutionRoute(sample({alternativeDocumentTypeIds:["salary_statement","salary_bank_statement"]})));
 assert.ok(matchPublishedSubstitutionRoute(sample({alternativeDocumentTypeIds:["salary_bank_statement"],employerSigned:false})));
 assert.equal(matchPublishedSubstitutionRoute(sample({alternativeDocumentTypeIds:["salary_bank_statement"],periodEnd:"2026-02-28"})),null);
 assert.equal(matchPublishedSubstitutionRoute(sample({alternativeDocumentTypeIds:["salary_statement","salary_bank_statement"],employerSigned:false})),null);
});
test("policy changes reject untrusted sources and duplicate or unknown structural fields",()=>{
 const changed=structuredClone(SUBSTITUTION_POLICY_SEED);changed.routes[0].sourceUrl="https://example.com/fiction";
 assert.throws(()=>validateSubstitutionPolicy(changed),/INVALID_/);
 const copy=structuredClone(SUBSTITUTION_POLICY_SEED);copy.routes.push({...copy.routes[0],id:"new-id"});
 assert.throws(()=>validateSubstitutionPolicy(copy),/DUPLICATE_/);
 const relaxing=structuredClone(SUBSTITUTION_POLICY_SEED);(relaxing.routes[0] as any).arbitraryAutomaticApproval=true;
 assert.throws(()=>validateSubstitutionPolicy(relaxing),/INVALID_/);
});
