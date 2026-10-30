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

test("an unconnected material OCR amount blocks unattended drafts despite AI pass",()=>{
 const issue="CALC_INPUT_UNCONNECTED_MATERIAL:bank_account_balance::balance:f1";
 const r=summarizeAutomaticLegalReview({checks:[c("pass")],expectedCount:1,
  draftEligibility:{eligible:true,reasons:[]},calculationIssues:[issue]});
 assert.equal(r.draftCandidate,false);assert.equal(r.disposition,"attention_required");
 assert.equal(r.humanReviewRequired,true);
 assert.ok(r.blockers.includes("CALCULATION_SOURCE_RECONCILIATION_REQUIRED"));
});
test("source amount mismatch, invalid money and invalid source link block unattended drafting",()=>{
 for(const code of ["CALC_INPUT_AMOUNT_INVALID","CALC_INPUT_AMOUNT_MISMATCH","CALC_INPUT_SOURCE_INVALID"]){
  const r=summarizeAutomaticLegalReview({checks:[c("pass")],expectedCount:1,
   draftEligibility:{eligible:true,reasons:[]},calculationIssues:[code+":debt_certificate::principal_balance:f1"]});
  assert.equal(r.draftCandidate,false,code);
 }
});
test("nonmaterial calculation notes do not create a false mismatch blocker",()=>{
 const r=summarizeAutomaticLegalReview({checks:[c("pass")],expectedCount:1,
  draftEligibility:{eligible:true,reasons:[]},calculationIssues:["INCOME_REPRESENTATIVE_PERIOD_NOT_SELECTED"]});
 assert.equal(r.draftCandidate,true);
});

test("LawGraph document-field projection failures always block a review draft",()=>{
 const checks=[c("legal_review")];
 for(const failure of ["LAWGRAPH_FORM_FIELD_PROJECTION_FAILED","LAWGRAPH_FORM_FIELD_PROJECTION_EMPTY"]){
  const eligibility=automatedDraftEligibility({checks,expectedCheckIds:["R1"],complete:true,
   calculationHeadCurrent:true,engineCanGenerateDraft:true,
   requiredCalculationFields:[{outputName:"monthlyIncomeWon",value:"1000",status:"computed"}],
   requiredCalculationOutputNames:["monthlyIncomeWon"],allowHumanReviewPendingForDraft:true,
   explicitFailures:[failure]});
  assert.equal(eligibility.eligible,false,failure);
  assert.ok(eligibility.reasons.includes("EXPLICIT_FAILURE_PRESENT"),failure);
  const report=summarizeAutomaticLegalReview({checks,expectedCount:1,draftEligibility:eligibility});
  assert.equal(report.draftCandidate,false,failure);
  assert.equal(report.canFinalize,false);
  assert.equal(report.courtApprovalInferred,false);
 }
});
