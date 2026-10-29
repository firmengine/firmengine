import test from "node:test";
import assert from "node:assert/strict";
import { INTAKE_CATALOG_SEED } from "../lib/intake-catalog.ts";
import { auditSubstitutionCatalog, reconcileDocumentSubstitution, type SubstitutionContext } from "../lib/document-substitution.ts";
import { makeCaseRequirement, type CaseRequirement, type SubstitutionReview } from "../lib/case-requirements.ts";
import type { IntakeRequirement } from "../lib/intake-types.ts";
import type { DocumentMatch } from "../lib/document-fulfillment.ts";
import type { EvidenceDocument, EvidencePage, Fact } from "../lib/domain.ts";

const documentIds=new Map(INTAKE_CATALOG_SEED.documents.map(d=>[d.id,d]));
const rule=INTAKE_CATALOG_SEED.rules.find(r=>r.id==="INTAKE-053")!;
const need=rule.documents.find(r=>r.documentTypeId==="salary_withholding")!;
const source:IntakeRequirement={
 id:"consultation-test-request",documentTypeId:"salary_withholding",documentName:documentIds.get("salary_withholding")!.name,
 subjectId:"income:salary",subjectLabel:"Applicant salary",period:"2026-04-01 to 2026-09-30",
 requirement:"required_when_applicable",status:"requested",reason:["Seoul court §402(2)(3)(a)"],matchedRuleIds:[rule.id],
 workflowIds:["WF-04"],sourceClaimIds:["claim-1"],sourceIds:[...rule.sourceIds],
 alternatives:need.alternatives.map(id=>({id,name:documentIds.get(id)!.name})),
 alternativePolicy:"review_required",fields:[...documentIds.get("salary_withholding")!.fields],issuer:"Test",
};
const orig=()=>makeCaseRequirement({source,intakeRunId:"run-one",subjectLinkId:"subject-link-one",scopeKey:"salary-one",idFactory:()=>"requirement-one"});
const H="a".repeat(64);
const docs:EvidenceDocument[]=[{id:"doc-bank",name:"Synthetic payroll bank",sha256:H,status:"active",pages:[1]}];
const pages:EvidencePage[]=[{documentId:"doc-bank",page:1,role:"evidence",documentType:"shared-document:salary_bank_statement@bank_transactions",text:"Synthetic payroll evidence"}];
const m:DocumentMatch={matchId:"m-one",requirementId:"requirement-one",subjectLinkId:"subject-link-one",documentId:"doc-bank",pageIds:["doc-bank:1"],coveredPeriod:{start:"2026-04-01",end:"2026-09-30"},sourceDocumentHash:H,state:"accepted",version:2,reason:"Synthetic",staffReviewer:"tester",dispositionFingerprint:"same"};
const f=(id:string):Fact=>({id,logicalId:id,version:1,subjectId:"income-one",key:id,canonicalFieldId:id,value:1000,state:"verified",recognition:"accepted",
 refs:[{documentId:"doc-bank",page:1,quote:"Synthetic",sourceHash:H}],validation:[]});
const factRows=source.fields.map((_,i)=>f("field_"+i));
const review:SubstitutionReview={
 originalDocumentTypeId:"salary_withholding",alternativeDocumentTypeIds:["salary_bank_statement"],
 proofs:source.fields.map((label,i)=>({requiredField:label,factIds:[factRows[i].id]})),
 periodStart:"2026-04-01",periodEnd:"2026-09-30",
 courtId:"seoul",catalogVersion:INTAKE_CATALOG_SEED.version,
 exceptionReason:"원천징수영수증 발급이 불가피하게 어려운 사정이 확인됐습니다",employerSigned:false,
 reviewer:"human-caseworker",reviewedAt:"2026-10-30T01:00:00Z",reason:"Official salary fallback §402 and exact field mapping",basisRefs:["field_0"]
};
function input(patch:Partial<SubstitutionContext>={},r:CaseRequirement=orig()):SubstitutionContext {
 return {requirement:{...r,substitutionReview:structuredClone(review)},matches:[m],facts:factRows,documents:docs,pages,
  subjectLink:{linkId:"subject-link-one",typedEntityId:"income-one",status:"confirmed"},
  courtId:"seoul",asOf:"2026-10-30",catalogVersion:INTAKE_CATALOG_SEED.version,pendingCourtPolicyChange:false,...patch};
}
const state=(patch:Partial<SubstitutionContext>={})=>reconcileDocumentSubstitution(input(patch));
test("audit indexes every registered document and refuses unregistered/undocumented alternatives",()=>{
 const a=auditSubstitutionCatalog(INTAKE_CATALOG_SEED);
 assert.equal(a.documentCount,85);
 assert.equal(a.evaluatedCount,a.documentCount);
 assert.deepEqual(a.orphanedRequestTypes,[]);
 assert.equal(a.entries.length,new Set(a.entries.map(x=>x.documentTypeId)).size);
 const activeAlts=a.entries.filter(e=>e.alternatives.length>0);
 assert.ok(activeAlts.length>0);
 assert.equal(a.entries.find(e=>e.documentTypeId==="credit_information_report")?.policy,"original_required");
});
test("full signed-reviewed six-month source-backed substitute is derived inactive, not deleted",()=>{
 const x=state();assert.equal(x.status,"inactive_by_substitution");assert.equal(x.activeRequest,false);
 assert.equal(x.coveredFields.length,source.fields.length);assert.deepEqual(x.missingFields,[]);
 assert.deepEqual(x.supportDocumentIds,["doc-bank"]);
});
test("absence of review or declared alternatives retains original request",()=>{
 assert.equal(reconcileDocumentSubstitution({...input(),requirement:orig()}).status,"review_required");
 const never=orig();never.alternatives=[];
 assert.equal(reconcileDocumentSubstitution({...input(),requirement:never}).status,"original_required");
});
test("any source evidence drift immediately restores original request",()=>{
 const scenarios:Partial<SubstitutionContext>[]=[
  {documents:[{...docs[0],sha256:"b".repeat(64)}]},
  {documents:[{...docs[0],status:"deleted"}]},
  {matches:[{...m,state:"stale"}]},
  {matches:[{...m,coveredPeriod:{start:"2026-05-01",end:"2026-09-30"}}]},
  {facts:factRows.slice(1)},
  {facts:[{...factRows[0],state:"extracted"},...factRows.slice(1)]},
  {facts:[{...factRows[0],recognition:"unreviewed"},...factRows.slice(1)]},
  {facts:[{...factRows[0],subjectId:"other-person"},...factRows.slice(1)]},
  {facts:[{...factRows[0],refs:[{...factRows[0].refs[0],sourceHash:"b".repeat(64)}]},...factRows.slice(1)]},
  {pages:[{...pages[0],role:"filed_form"}]},
  {pages:[{...pages[0],documentType:"shared-document:unknown@bank_transactions"}]},
  {subjectLink:{linkId:"subject-link-one",typedEntityId:"income-one",status:"candidate"}},
  {courtId:"busan"},{courtId:"unknown"},{catalogVersion:INTAKE_CATALOG_SEED.version+1},
  {pendingCourtPolicyChange:true},{asOf:"2026-03-01"},
 ];
 for(const [i,patch] of scenarios.entries()){
  const outcome=state(patch);
  assert.equal(outcome.activeRequest,true,"drift scenario "+i);
  assert.equal(outcome.status,"restored","drift scenario "+i);
 }
});
test("incomplete proof slots, signature exception, or insufficient months never auto-waive",()=>{
 for(const change of [
  {proofs:review.proofs.slice(1)},
  {exceptionReason:""},
  {periodStart:"2026-06-01"},
  {reviewer:""},
  {alternativeDocumentTypeIds:["creditor_request_copy"]},
 ]){
  const modified={...review,...change};
  const original=orig();original.substitutionReview=modified;
  const outcome=reconcileDocumentSubstitution(input({requirement:original}));
  assert.equal(outcome.activeRequest,true,JSON.stringify(change));
 }
});
test("nonexplicit court alternative cannot auto retire a debt certificate",()=>{
 const debtDoc=documentIds.get("debt_certificate")!;
 const debtNeed=INTAKE_CATALOG_SEED.rules.find(r=>r.id==="INTAKE-015")!.documents[0];
 const debtSource={...source,documentTypeId:"debt_certificate",fields:[...debtDoc.fields],
  alternatives:debtNeed.alternatives.map(id=>({id,name:documentIds.get(id)!.name}))};
 const req=makeCaseRequirement({source:debtSource,intakeRunId:"run",subjectLinkId:"subject-link-one",idFactory:()=>"requirement-one"});
 req.substitutionReview={...review,originalDocumentTypeId:"debt_certificate",alternativeDocumentTypeIds:["creditor_request_copy"],
  proofs:debtDoc.fields.map((label,i)=>({requiredField:label,factIds:[factRows[i%factRows.length].id]}))};
 const view=reconcileDocumentSubstitution(input({requirement:req}));
 assert.equal(view.activeRequest,true);
 assert.ok(view.reasonCodes.includes("PUBLISHED_SUBSTITUTION_POLICY_NOT_CONFIRMED"));
});
test("two substitutes can jointly cover distinct proof slots without overwriting the primary",()=>{
 const original=orig();
 original.substitutionReview={...review,alternativeDocumentTypeIds:["salary_bank_statement","salary_statement"],employerSigned:true};
 const withTwo=[
  ...docs,{id:"doc-paystub",name:"Synthetic signed payroll",sha256:"b".repeat(64),status:"active" as const,pages:[1]}
 ];
 const withPages=[...pages,{documentId:"doc-paystub",page:1,role:"evidence" as const,documentType:"shared-document:salary_statement@payroll_payslip",text:"verified"}];
 const withMatches=[...input().matches,{...m,matchId:"m-two",documentId:"doc-paystub",pageIds:["doc-paystub:1"],sourceDocumentHash:"b".repeat(64)}];
 // First two of five proof slots now come from the second alternative.
 const facts=factRows.map((item,i)=>i<2?{...item,refs:[{documentId:"doc-paystub",page:1,quote:"synthetic",sourceHash:"b".repeat(64)}]}:item);
 const a=reconcileDocumentSubstitution(input({requirement:original,documents:withTwo,pages:withPages,matches:withMatches,facts}));
 assert.equal(a.status,"inactive_by_substitution");
 assert.deepEqual(a.supportDocumentIds,["doc-bank","doc-paystub"]);
});
