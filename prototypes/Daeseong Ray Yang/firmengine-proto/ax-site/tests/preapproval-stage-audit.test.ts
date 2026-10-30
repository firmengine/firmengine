import test from "node:test";
import assert from "node:assert/strict";
import {auditFivePreapprovalStages,type StageAuditInput} from "../lib/preapproval-stage-audit.ts";
function sample():StageAuditInput {
 const specs=[
  {id:"income_aggregation",inputs:["income.net","context.inventoryComplete.income"],outputs:["monthlyIncomeWon"],dependsOn:[]},
  {id:"available_income",inputs:["household.recognizedLivingCost"],outputs:["disposableIncomeWon"],dependsOn:["income_aggregation"]},
 ];
 return {data:{context:{id:"synthetic",revision:2,inventoryComplete:{income:"yes"}},
   incomes:[{id:"income-1",net:{amountWon:"3200000",normalizationStatus:"exact"},factIds:["w1"]}],
   debts:[],assets:[],transactions:[],household:{recognizedLivingCost:{amountWon:"1600000",normalizationStatus:"exact"},factIds:["h1"]},
   workflowState:{procedureEvents:[]}},
  facts:[{id:"w1",key:"income.net",subjectId:"income-1",state:"verified",recognition:"accepted",numeric:{amountWon:"3200000"}},
    {id:"h1",key:"household.recognizedLivingCost",subjectId:"household",state:"verified",recognition:"accepted",numeric:{amountWon:"1600000"}}],
  assessment:{calculation:{monthlyIncomeWon:"3200000",disposableIncomeWon:"1600000",ordinaryRepaymentBudgetWon:"1450000",
   monthlyPaymentWon:"1450000",planTotalWon:"52200000",liquidationValueWon:"40000000",presentValueWon:null,liquidationComparison:"unknown"},
   findings:[]},
  calculationSpecs:specs,selectedCalculationIds:["income_aggregation","available_income"],
  persistedCalculationFeatures:[{calculationId:"income_aggregation",outputName:"monthlyIncomeWon",outputPath:"/assessment/calculation/monthlyIncomeWon",
    valueJson:'"3200000"',status:"computed",sourceFactIdsJson:'["w1"]',formula:"observed mean"}],
  persistedCalculationComplete:true,calculationHeadCurrent:true,
  risks:[{id:"R-1",current_rule_ids:["KR-PR-043"]},{id:"R-2",current_rule_ids:["KR-PR-045"]}],
  exceptions:[{id:"EL-35"},{id:"EL-40"},{id:"EL-46"}],legalChecks:[{id:"R-1",status:"missing"}],legalCurrent:true,
  documents:{consultationStatus:"current",workflowAdopted:true,workflowProjectionStatus:"current",requirements:[],
    workflowRequests:[{requirementId:"r1",documentTypeId:"bank_statement",requiredPeriod:"2026-01",
      activeRequest:true,requirementStatus:"missing"}]},
  validSourceFactIds:new Set(["w1"])} as unknown as StageAuditInput;
}
test("five phases are always explicit and preserve the sources consulted by each stage",()=>{
 const a=auditFivePreapprovalStages(sample());
 assert.deepEqual(a.stages.map(x=>x.stage),["P1_DOCUMENTS","P2_EVIDENCE","P3_CALCULATIONS","P4_LEGAL","P5_CORRECTIONS"]);
 assert.ok(a.stages[0].storedResources.includes("case_requirement_field_plans"));
 assert.ok(a.stages[2].storedResources.includes("case_calculation_features"));
 assert.equal(a.coverage.inferredCourtApproval,false);
});
test("typed and verified facts are different; exact amounts and fact IDs remain visible",()=>{
 const a=auditFivePreapprovalStages(sample());
 assert.equal(a.stages[1].sourceVerifiedAndAcceptedCount,1);
 assert.deepEqual(a.stages[1].unverifiedFactIds,["h1"]);
 const calc=a.stages[2].allModules.find(x=>x.id==="income_aggregation")!;
 const row=calc.declaredInputs[0];
 assert.equal((row.values[0].value as {amountWon:string}).amountWon,"3200000");
 assert.deepEqual(row.values[0].factIds,["w1"]);
 assert.equal(calc.declaredOutputs[0].storedRows[0].value,"3200000");
});
test("selected calculation with absent persisted output never passes silently",()=>{
 const a=auditFivePreapprovalStages(sample());
 assert.equal(a.stages[2].state,"calculation_audit_required");
 assert.deepEqual(a.stages[2].missingSelectedModuleIds,["available_income"]);
 assert.equal(a.stages[2].allModules[1].declaredOutputs[0].state,"not_persisted");
});
test("unknown or duplicate declared calculation ids remain a review gap",()=>{
 const d=sample();d.selectedCalculationIds=[...d.selectedCalculationIds,"invented-calc"];
 d.calculationSpecs=[...d.calculationSpecs,d.calculationSpecs[0]];
 const a=auditFivePreapprovalStages(d);
 assert.ok(a.coverage.unlinkedSelectedCalculations.includes("invented-calc"));
 assert.ok(a.stages[2].duplicateModuleIds.includes("income_aggregation"));
});
test("all registered legal risks and exceptions are counted; postapproval scope is explicitly deferred",()=>{
 const a=auditFivePreapprovalStages(sample());
 assert.equal(a.coverage.expectedRiskChecks,2);
 assert.equal(a.stages[3].currentRiskCount,1);
 assert.deepEqual(a.stages[3].notCurrentRiskIds,["R-2"]);
 assert.deepEqual(a.stages[3].deferredPostapprovalExceptionIds,["EL-40","EL-46"]);
 assert.equal(a.stages[3].statutoryPreflight.find(x=>x.id==="KR-614-1-4")?.state,"calculation_input_missing");
});
test("liquidation shortfall is numerical warning, never court rejection prediction",()=>{
 const d=sample();d.assessment.calculation.liquidationComparison="not_met";
 const a=auditFivePreapprovalStages(d);
 assert.equal(a.stages[3].statutoryPreflight.find(x=>x.id==="KR-614-1-4")?.state,"numerical_shortfall_requires_review");
 assert.equal(a.courtApprovalInferred,false);
});
test("court correction event is real only with original recorded document; deadline stays unknown",()=>{
 const d=sample();d.data.workflowState!.procedureEvents.push({id:"cor-1",state:"correction_requested",sourceDocumentIds:["court.pdf"],
  courtReference:"synthetic-2026",reason:"additional records",occurredAt:"2026-10-29",recordedAt:"2026-10-29",
  actor:"court",relatedFields:["income.net"],artifactIds:[]});
 const a=auditFivePreapprovalStages(d);
 assert.equal(a.stages[4].courtOrderEvents[0].itemLevelDeadlineAndResponseVerified,false);
 assert.deepEqual(a.stages[4].correctionDeadlineFactIds,[]);
 assert.equal(a.stages[4].expectedCourtOrderItemizationMissing,true);
});
test("approval event disables pre-approval stage five but does not delete historical facts",()=>{
 const d=sample();d.data.workflowState!.procedureEvents.push({id:"approved-1",state:"approved",sourceDocumentIds:["order.pdf"],
  courtReference:"synthetic-2026",reason:"approved",occurredAt:"2026-10-30",recordedAt:"2026-10-30",
  actor:"court",relatedFields:[],artifactIds:[]});
 const a=auditFivePreapprovalStages(d);
 assert.equal(a.stages[4].state,"outside_preapproval_scope");
 assert.equal(a.stages[1].activeFactCount,2);
});
test("missing monitor and raw storage cause explicit unknown rather than pass",()=>{
 const d=sample();d.documents=null;d.persistedCalculationFeatures=null;d.persistedCalculationComplete=false;d.legalCurrent=false;
 const a=auditFivePreapprovalStages(d);
 assert.equal(a.stages[0].state,"unavailable");
 assert.equal(a.stages[2].state,"calculation_audit_required");
 assert.equal(a.stages[3].currentRiskCount,0);
 assert.equal(a.coverage.unresolvedDocuments,null);
});

test("existing persisted proposal outputs use physical proposals.* field names without losing their module link",()=>{
 const d=sample();
 d.calculationSpecs=[
  {id:"living_cost_proposal",inputs:["household.recognizedLivingCost"],outputs:["livingCost"],dependsOn:[]},
  {id:"objection_minimum",inputs:["context.courtObjection"],outputs:["objectionMinimum"],dependsOn:[]},
  {id:"seoul_short_term",inputs:["context.planMonths"],outputs:["termCandidate"],dependsOn:[]},
 ];
 d.selectedCalculationIds=d.calculationSpecs.map(x=>x.id);
 d.persistedCalculationFeatures=[
  {calculationId:"living_cost_proposal",outputName:"proposals.livingCost.status",outputPath:"/proposals/livingCost/status",valueJson:'"proposal"',status:"provisional"},
  {calculationId:"objection_minimum",outputName:"proposals.objectionMinimum.status",outputPath:"/proposals/objectionMinimum/status",valueJson:'"unknown"',status:"provisional"},
  {calculationId:"seoul_short_term",outputName:"proposals.termCandidate.status",outputPath:"/proposals/termCandidate/status",valueJson:'"unknown"',status:"provisional"},
 ];
 const output=auditFivePreapprovalStages(d);
 assert.deepEqual(output.stages[2].missingSelectedModuleIds,[]);
 assert.ok(output.stages[2].allModules.every(x=>x.declaredOutputs[0].storedRows.length===1));
});

test("all 46 registered exceptions remain visible even though unimplemented legal applicability cannot be auto-cleared",()=>{
 const d=sample();
 d.exceptions=[{id:"EL-35",trigger:"synthetic preapproval",ruleRefs:["KR-PR-042"],features:["applicant.age"]},
  {id:"EL-40",trigger:"synthetic after approval",ruleRefs:[],features:[]},
  {id:"EL-46",trigger:"synthetic after discharge",ruleRefs:[],features:[]}];
 const state=auditFivePreapprovalStages(d).stages[3];
 assert.equal(state.exceptionCoverage.length,3);
 assert.equal(state.exceptionCoverage[0].stageDisposition,"requires_case_specific_lawyer_review");
 assert.equal(state.exceptionCoverage[1].stageDisposition,"deferred_postapproval");
 assert.ok(state.exceptionCoverage.every(x=>!x.automaticallySatisfied&&!x.ruleApplicabilityApproved));
});
