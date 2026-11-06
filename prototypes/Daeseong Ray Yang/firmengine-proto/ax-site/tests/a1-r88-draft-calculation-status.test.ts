import test from "node:test";
import assert from "node:assert/strict";
import {automatedDraftEligibility,type AutomatedDraftEligibilityInput,type StoredLegalCheck} from "../lib/case-lawgraph-store.ts";

/** Synthetic gate-only regressions. No real legal conclusions, client data or filings. */
function fixture():AutomatedDraftEligibilityInput {
 const checks:StoredLegalCheck[]=[{
  id:"R-SYNTH",status:"pass",reason:"synthetic condition",factIds:[],ruleIds:[],missingDocuments:[],nextAction:""
 }];
 return {checks,expectedCheckIds:["R-SYNTH"],complete:true,calculationHeadCurrent:true,
  engineCanGenerateDraft:true,requiredCalculationOutputNames:["monthlyIncomeWon"],
  requiredCalculationFields:[{outputName:"monthlyIncomeWon",value:"0",status:"computed"}],
  allowHumanReviewPendingForDraft:true};
}

test("mandatory Won field keeps observed zero distinct from non-applicability and malformed values",()=>{
 const scenarios:{name:string;value:unknown;status:string|undefined;eligible:boolean;reason?:string}[]=[
  {name:"observed zero",value:"0",status:"computed",eligible:true},
  {name:"provisional numeric draft",value:"10",status:"provisional",eligible:true},
  {name:"negative observed amount remains structurally numeric",value:"-500",status:"computed",eligible:true},
  {name:"not applicable numeric placeholder",value:"0",status:"not_applicable",eligible:false,reason:"CALCULATION_VALUE_UNRESOLVED:monthlyIncomeWon"},
  {name:"unrecognized status",value:"0",status:"unexpected",eligible:false,reason:"CALCULATION_VALUE_UNRESOLVED:monthlyIncomeWon"},
  {name:"absent status",value:"0",status:undefined,eligible:false,reason:"CALCULATION_VALUE_UNRESOLVED:monthlyIncomeWon"},
  {name:"blocked",value:"0",status:"blocked",eligible:false},
  {name:"missing",value:"0",status:"missing",eligible:false},
  {name:"conflict",value:"0",status:"conflict",eligible:false},
  {name:"explicit null",value:null,status:"computed",eligible:false},
  {name:"empty string",value:"",status:"computed",eligible:false},
  {name:"NaN",value:NaN,status:"computed",eligible:false},
  {name:"infinity",value:Infinity,status:"computed",eligible:false},
  {name:"numeric rather than exact Won string",value:0,status:"computed",eligible:false},
  {name:"invalid monetary string",value:"abc",status:"computed",eligible:false},
 ];
 for(const scenario of scenarios){
  const input=fixture();
  input.requiredCalculationFields=[{outputName:"monthlyIncomeWon",value:scenario.value,status:scenario.status}];
  const result=automatedDraftEligibility(input);
  assert.equal(result.eligible,scenario.eligible,scenario.name);
  if(scenario.reason)assert.ok(result.reasons.includes(scenario.reason),scenario.name);
  assert.equal(result.mode,"draft");
  assert.equal(result.canFinalize,false);
  assert.equal(result.courtApprovalInferred,false);
 }
});

test("legal review may remain pending for an internal draft but never final approval",()=>{
 const input=fixture();
 input.checks=[{...input.checks[0]!,status:"legal_review"}];
 const draft=automatedDraftEligibility(input);
 assert.equal(draft.eligible,true);
 assert.equal(draft.canFinalize,false);
 assert.equal(draft.courtApprovalInferred,false);
 assert.equal(automatedDraftEligibility({...input,allowHumanReviewPendingForDraft:false}).eligible,false);
 assert.equal(automatedDraftEligibility({...input,calculationHeadCurrent:false}).eligible,false);
 assert.equal(automatedDraftEligibility({...input,explicitFailures:["SYNTHETIC_SOURCE_CONFLICT"]}).eligible,false);
});
