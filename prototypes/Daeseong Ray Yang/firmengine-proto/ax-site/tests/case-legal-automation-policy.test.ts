import test from "node:test";
import assert from "node:assert/strict";
import {summarizeAutomaticLegalReview,type AutoLegalCondition} from "../lib/case-legal-automation-policy.ts";
import {automatedDraftEligibility} from "../lib/case-lawgraph-store.ts";
const c=(status:AutoLegalCondition["status"],id="R1"):AutoLegalCondition=>({
 id,status,reason:"synthetic",factIds:[],ruleIds:[],missingDocuments:[],nextAction:"review"});
test("manual legal review is permitted ONLY for a clearly labeled draft",()=>{
 const checks=[c("legal_review")];
 const eligible=automatedDraftEligibility({checks,expectedCheckIds:["R1"],complete:true,
  calculationHeadCurrent:true,engineCanGenerateDraft:true,requiredCalculationFields:[{outputName:"monthlyIncomeWon",value:"1000",status:"computed"}],
  requiredCalculationOutputNames:["monthlyIncomeWon"],allowHumanReviewPendingForDraft:true});
 assert.equal(eligible.eligible,true);assert.equal(eligible.canFinalize,false);
 const result=summarizeAutomaticLegalReview({checks,expectedCount:1,draftEligibility:eligible});
 assert.equal(result.draftCandidate,true);assert.equal(result.humanReviewRequired,true);
 assert.equal(result.courtApprovalInferred,false);assert.equal(result.canFinalize,false);
});
test("missing, conflicting, or failing legal checks block automatic drafting",()=>{
 for(const status of ["missing","conflict","fail"] as const){
  const result=summarizeAutomaticLegalReview({checks:[c(status)],expectedCount:1,draftEligibility:{eligible:true,reasons:[]}});
  assert.equal(result.draftCandidate,false,status);assert.equal(result.disposition,"attention_required",status);
 }
});
test("incomplete AI batch and missing calculation never authorize draft",()=>{
 const result=summarizeAutomaticLegalReview({checks:[c("legal_review")],expectedCount:95,
  draftEligibility:{eligible:false,reasons:["CALCULATION_VALUE_MISSING:presentValueWon"]}});
 assert.equal(result.disposition,"incomplete");assert.ok(result.blockers.includes("LEGAL_REVIEW_INCOMPLETE"));
});
