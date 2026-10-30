import test from "node:test";
import assert from "node:assert/strict";
import {createCase,normalizeMoney,currentFacts,type CaseData,type Fact} from "../lib/domain.ts";
import {CURRENT_RULESET,RISK_CATALOG} from "../lib/legal-rules.ts";
import exceptions from "../lib/legal-exceptions.json" with {type:"json"};
import {calculateCase} from "../lib/assessment.ts";
import {executeCaseNodes} from "../lib/case-execution.ts";
import {calculationFeatureRows} from "../lib/case-calculation-feature-store.ts";
import {getCalculationSpecs} from "../lib/execution-catalog.ts";
import {auditFivePreapprovalStages} from "../lib/preapproval-stage-audit.ts";
import {simulatePreapprovalCase} from "../lib/preapproval-simulation.ts";

const sourceHash="c".repeat(64),asOf="2026-10-27";
function goldenCase():CaseData{
 const d=createCase("Synthetic approval regression","synthetic-approval-case",asOf);
 d.documents=[{id:"pdf",name:"synthetic-only.pdf",sha256:sourceHash,status:"active",pages:[1]}];
 d.pages=[{documentId:"pdf",page:1,role:"evidence",text:"synthetic verified evidence for regression test"}];
 const fact=(id:string,subjectId:string,key:string,amount:string)=>{
  const item:Fact={id,logicalId:id,version:1,subjectId,key,value:amount,
   numeric:normalizeMoney(amount),rawValue:amount,sourceUnit:"KRW",state:"verified",recognition:"accepted",
   refs:[{documentId:"pdf",page:1,quote:"synthetic verified evidence for regression test",sourceHash}],
   validation:[]};
  d.facts.push(item);
  return id;
 };
 const incomeId=fact("income-net","income-1","income.net","3000000");
 d.incomes=[{id:"income-1",kind:"wage",label:"Employer A",employer:"Employer A",net:normalizeMoney("3000000"),
  amountBasis:"period_total",periodStart:"2026-10-01",periodEnd:"2026-10-31",recurring:"yes",recognition:"accepted",
  factIds:[incomeId]}];
 const principal=fact("debt-principal","debt-1","debt.principal_balance","100000000");
 const interest=fact("debt-interest","debt-1","debt.interest","0");
 d.debts=[{id:"debt-1",creditor:"Bank A",contractId:"A-1",principal:normalizeMoney("100000000"),
  interest:normalizeMoney("0"),secured:"no",classification:"ordinary",priority:"ordinary",asOf,legalReview:"accepted",
  factIds:[principal,interest]}];
 const gross=fact("asset-gross","asset-1","asset.gross_value","1000000"),
   payoff=fact("asset-payoff","asset-1","asset.secured_payoff","0"),
   costs=fact("asset-cost","asset-1","asset.disposal_costs","0"),
   protectedValue=fact("asset-protection","asset-1","asset.protected_value","0");
 d.assets=[{id:"asset-1",kind:"deposit",label:"Synthetic deposit",grossValue:normalizeMoney("1000000"),
  securedPayoff:normalizeMoney("0"),disposalCosts:normalizeMoney("0"),protectedValue:normalizeMoney("0"),
  ownershipBps:10000,asOf,valuationBasis:"source-reviewed valuation",recognition:"accepted",
  factIds:[gross,payoff,costs,protectedValue]}];
 const living=fact("household-living","household","household.recognizedLivingCost","1500000");
 d.household={reportedMembers:1,recognizedMembers:1,recognizedLivingCost:normalizeMoney("1500000"),
  livingCostIncludesAdditional:true,recognition:"accepted",factIds:[living]};
 Object.assign(d.context,{
  ruleReleaseId:CURRENT_RULESET.id,ruleApplicationReviewed:true,
  inventoryComplete:{income:"yes",debt:"yes",asset:"yes"},
  filingPeriod:{start:"2026-10-01",end:"2026-10-31"},incomePeriodReviewed:true,
  monthlyTrusteeFee:normalizeMoney("0"),monthlyPriorityPayment:normalizeMoney("0"),
  monthlyEstatePayment:normalizeMoney("0"),planMonths:36,
  approvedMonthlyPayment:normalizeMoney("1000000"),approvedPresentValue:normalizeMoney("30000000"),
  presentValueBasis:"reviewed synthetic present value",presentValueReviewed:true,assetValuationBasisReviewed:true,
  allocationBasis:"principal_then_interest_pro_rata",allocationBasisReviewed:true,
  eligibility:{naturalPerson:"yes",insolventOrRisk:"yes",priorProceedingsReviewed:"yes"}
 });
 return d;
}
test("live calculator emits documented 18 modules, 91 declared inputs and traceable persisted feature values",()=>{
 const data=goldenCase(),execution=executeCaseNodes(data),specs=getCalculationSpecs();
 const rows=calculationFeatureRows(execution);
 assert.equal(specs.length,18);assert.equal(specs.reduce((n,s)=>n+s.inputs.length,0),91);
 const audit=auditFivePreapprovalStages({
  data,facts:currentFacts(data),assessment:execution.assessment,
  calculationSpecs:specs,selectedCalculationIds:execution.plan.calculationTasks.map(x=>x.id),
  persistedCalculationFeatures:rows.map(row=>({calculationId:row.calculationId,outputName:row.outputName,
   outputPath:row.outputPath,status:row.status,valueJson:JSON.stringify(row.value),
   sourceFactIdsJson:JSON.stringify(row.sourceFactIds),formula:row.formula})),
  persistedCalculationComplete:true,calculationHeadCurrent:true,
  risks:RISK_CATALOG,exceptions:exceptions.scenarios,legalChecks:[],legalCurrent:false,
  documents:null,validSourceFactIds:new Set(data.facts.map(x=>x.id)),
 });
 assert.equal(audit.coverage.declaredCalculations,18);
 assert.equal(audit.coverage.declaredCalculationInputs,91);
 assert.equal(audit.coverage.expectedRiskChecks,95);
 assert.equal(audit.coverage.registeredExceptionScenarios,46);
 assert.equal(execution.assessment.calculation.monthlyIncomeWon,"3000000");
 assert.equal(execution.assessment.calculation.ordinaryRepaymentBudgetWon,"1500000");
 assert.equal(execution.assessment.calculation.planTotalWon,"36000000");
 const source=audit.stages[2].allModules.find(x=>x.id==="income_aggregation")!;
 assert.equal(source.declaredOutputs.find(x=>x.output==="monthlyIncomeWon")?.storedRows[0].value,"3000000");
 assert.equal(source.declaredInputs.length,5);
 assert.ok(audit.stages[2].allModules.some(x=>x.declaredOutputs.some(o=>o.state==="not_persisted")),
  "some declared modules are not persisted as equal-named physical rows and must remain visible gaps");
 assert.equal(audit.courtApprovalInferred,false);
});
test("real deterministic calculator is reused for hypothetical priority cost without saving client source",()=>{
 const data=goldenCase(),before=JSON.stringify(data);
 const result=simulatePreapprovalCase(data,[{path:"context.monthlyPriorityPayment",candidateWon:"250000",
  basisFactIds:[],reason:"synthetic creditor priority budget branch"}],executeCaseNodes);
 assert.equal(JSON.stringify(data),before);
 const delta=result.differences.find(x=>x.outputName==="ordinaryRepaymentBudgetWon")!;
 assert.deepEqual([delta.original,delta.hypothetical],["1500000","1250000"]);
 assert.equal(result.sourceMutationPerformed,false);
 assert.equal(result.humanLegalAcceptanceGranted,false);
 assert.equal(result.courtApprovalInferred,false);
});
test("source-typed asset contradiction blocks liquidation instead of silently using changed typed amount",()=>{
 const data=goldenCase(),altered=structuredClone(data);
 altered.assets[0].grossValue=normalizeMoney("2000000");
 const calculation=calculateCase(altered,CURRENT_RULESET);
 assert.equal(calculation.assetRows[0].liquidationWon,null);
 assert.ok(calculation.issues.some(x=>x.includes("ASSET_OBJECT_FACT_CONFLICT")));
 assert.equal(data.assets[0].grossValue?.amountWon,"1000000");
});
test("unverified source fact blocks a paid income calculation despite a number in the typed row",()=>{
 const data=goldenCase();data.facts.find(f=>f.id==="income-net")!.state="disputed";
 const result=calculateCase(data,CURRENT_RULESET);
 assert.equal(result.monthlyIncomeWon,null);
 assert.ok(result.issues.some(x=>x.includes("DISPUTED_OR_REJECTED_FACT")));
});
