import test from "node:test";
import assert from "node:assert/strict";
import {createCase,normalizeMoney,type CaseData,type Fact} from "../lib/domain.ts";
import {CURRENT_RULESET} from "../lib/legal-rules.ts";
import {calculateCase,assessCase} from "../lib/assessment.ts";
import {buildRepaymentPlanModel} from "../lib/repayment-plan-model.ts";
import {reconcilePlanLedger} from "../lib/plan-reconciliation.ts";
import {buildFormBindings} from "../lib/form-mapping.ts";
import {getCalculationSpecs} from "../lib/execution-catalog.ts";
import {buildLegalProposals} from "../lib/legal-proposals.ts";
import {scanTransactions} from "../lib/transaction-review.ts";
import {executeCaseNodes} from "../lib/case-execution.ts";
import {calculationFeatureRows} from "../lib/case-calculation-feature-store.ts";

const sourceHash="c".repeat(64),asOf="2026-10-27";
function goldenFixture():CaseData{
 const d=createCase("Synthetic 18-output golden","synthetic-18",asOf);
 d.documents=[{id:"pdf",name:"synthetic-only.pdf",sha256:sourceHash,status:"active",pages:[1]}];
 d.pages=[{documentId:"pdf",page:1,role:"evidence",text:"synthetic verified evidence for 18 golden calculations"}];
 const ids:string[]=[];
 const fact=(id:string,subjectId:string,key:string,amount?:string):string=>{
  ids.push(id);
  const item:Fact={id,logicalId:id,version:1,subjectId,key,value:amount??"synthetic verified evidence",
   ...(amount!==undefined?{numeric:normalizeMoney(amount),rawValue:amount,sourceUnit:"KRW"}:{}),
   state:"verified",recognition:"accepted",
   refs:[{documentId:"pdf",page:1,quote:"synthetic verified evidence for 18 golden calculations",sourceHash}],
   validation:[]};
  d.facts.push(item);
  return id;
 };
 const wage=fact("income-net","income-1","income.net","3000000");
 d.incomes=[{id:"income-1",kind:"wage",label:"Employer A",employer:"Employer A",net:normalizeMoney("3000000"),
  amountBasis:"period_total",periodStart:"2026-10-01",periodEnd:"2026-10-31",recurring:"yes",
  recognition:"accepted",factIds:[wage]}];
 const principal=fact("debt-principal","debt-1","debt.principal_balance","100000000");
 const interest=fact("debt-interest","debt-1","debt.interest","0");
 d.debts=[{id:"debt-1",creditor:"Bank A",contractId:"A-1",principal:normalizeMoney("100000000"),
  interest:normalizeMoney("0"),secured:"no",classification:"ordinary",priority:"ordinary",asOf,
  legalReview:"accepted",factIds:[principal,interest]}];
 const gross=fact("asset-gross","asset-1","asset.gross_value","1000000");
 const payoff=fact("asset-payoff","asset-1","asset.secured_payoff","0");
 const costs=fact("asset-cost","asset-1","asset.disposal_costs","0");
 const protection=fact("asset-protection","asset-1","asset.protected_value","0");
 d.assets=[{id:"asset-1",kind:"deposit",label:"Synthetic deposit",grossValue:normalizeMoney("1000000"),
  securedPayoff:normalizeMoney("0"),disposalCosts:normalizeMoney("0"),protectedValue:normalizeMoney("0"),
  ownershipBps:10000,asOf,valuationBasis:"source-reviewed valuation",recognition:"accepted",
  factIds:[gross,payoff,costs,protection]}];
 const living=fact("household-living","household","household.recognizedLivingCost","1500000");
 d.household={reportedMembers:1,recognizedMembers:1,recognizedLivingCost:normalizeMoney("1500000"),
  livingCostIncludesAdditional:true,recognition:"accepted",factIds:[living]};
 Object.assign(d.context,{
  ruleReleaseId:CURRENT_RULESET.id,ruleApplicationReviewed:true,inventoryComplete:{income:"yes",debt:"yes",asset:"yes"},
  filingPeriod:{start:"2026-10-01",end:"2026-10-31"},incomePeriodReviewed:true,
  monthlyTrusteeFee:normalizeMoney("0"),monthlyPriorityPayment:normalizeMoney("0"),monthlyEstatePayment:normalizeMoney("0"),
  planMonths:36,approvedMonthlyPayment:normalizeMoney("1000000"),approvedPresentValue:normalizeMoney("30000000"),
  presentValueBasis:"Source-reviewed present value of plan payments",presentValueReviewed:true,assetValuationBasisReviewed:true,
  allocationBasis:"principal_then_interest_pro_rata",allocationBasisReviewed:true,
  eligibility:{naturalPerson:"yes",insolventOrRisk:"yes",priorProceedingsReviewed:"yes"}
 });
 return d;
}

const contracts=getCalculationSpecs();
test("all 18 calculation contracts have stable inputs and outputs without silent implicit field fallback",()=>{
 assert.equal(contracts.length,18);
 assert.equal(new Set(contracts.map(spec=>spec.id)).size,18);
 assert.ok(contracts.every(spec=>spec.inputs.length&&spec.outputs.length&&spec.resultPaths.length));
});

test("income_average + income_aggregation: 3m single complete month yields 3m, one observed month",()=>{
 const result=calculateCase(goldenFixture(),CURRENT_RULESET);
 assert.equal(result.incomeRows.length,1);
 assert.equal(result.incomeRows[0].monthlyWon,"3000000");
 assert.equal(result.incomeGroups[0].monthlyObservedAverageWon,"3000000");
 assert.equal(result.incomeGroups[0].observedMonths,1);
 assert.equal(result.monthlyIncomeWon,"3000000");
});
test("debt_total + debt_cap: one 100m unsecured claim with zero interest yields a verified component trace",()=>{
 const result=calculateCase(goldenFixture(),CURRENT_RULESET);
 assert.equal(result.debtRows[0].principalWon,"100000000");
 assert.equal(result.debtRows[0].interestWon,"0");
 assert.equal(result.debtRows[0].totalWon,"100000000");
 assert.equal(result.totalDebtWon,"100000000");
 assert.equal(result.debtPrincipalWon,"100000000");
 assert.equal(result.debtInterestWon,"0");
 assert.equal(result.securedDebtWon,"0");
 assert.equal(result.unsecuredDebtWon,"100000000");
});
test("asset_liquidation: current source-backed deposit with explicit 100% share -> 1m",()=>{
 const result=calculateCase(goldenFixture(),CURRENT_RULESET);
 assert.equal(result.assetRows[0].liquidationWon,"1000000");
 assert.equal(result.liquidationValueWon,"1000000");
});
test("available_income + ordinary_budget: 3m-1.5m-0fee-0priority-0estate -> 1.5m",()=>{
 const result=calculateCase(goldenFixture(),CURRENT_RULESET);
 assert.equal(result.recognizedLivingCostWon,"1500000");
 assert.equal(result.disposableIncomeWon,"1500000");
 assert.equal(result.ordinaryRepaymentBudgetWon,"1500000");
});
test("nominal_plan + allocation: reviewed 1m x 36 -> 36m; principal-first allocation conserves",()=>{
 const result=calculateCase(goldenFixture(),CURRENT_RULESET);
 assert.equal(result.monthlyPaymentWon,"1000000");
 assert.equal(result.planTotalWon,"36000000");
 assert.equal(result.allocations.length,1);
 assert.equal(result.allocations[0].allocatedPrincipalWon,"36000000");
 assert.equal(result.allocations[0].allocatedInterestWon,"0");
 assert.equal(result.allocations.reduce((s,row)=>s+BigInt(row.totalWon),0n),36000000n);
 assert.ok(!result.issues.includes("ALLOCATION_BUDGET_UNRECONCILED"));
});
test("liquidation_comparison: independently reviewed PV 30m - liquidation 1m is met (not court approval)",()=>{
 const result=calculateCase(goldenFixture(),CURRENT_RULESET);
 assert.equal(result.presentValueWon,"30000000");
 assert.equal(result.liquidationComparison,"met");
 assert.equal(result.traces.find(v=>v.id==="liquidation_comparison")?.resultWon,"29000000");
});
test("liquidation_comparison: pending PV or asset review never becomes eligibility PASS",()=>{
 for(const flag of ["presentValueReviewed","assetValuationBasisReviewed"] as const){
  const data=goldenFixture();
  data.context[flag]=false;
  const assessment=assessCase(data,CURRENT_RULESET);
  assert.equal(assessment.calculation.presentValueWon,"30000000","numeric PV remains a preview");
  assert.equal(assessment.calculation.liquidationValueWon,"1000000");
  assert.equal(assessment.calculation.liquidationComparison,"unknown");
  assert.equal(assessment.calculation.traces.find(v=>v.id==="liquidation_comparison")?.status,"provisional");
  assert.equal(assessment.findings.find(v=>v.id==="liquidation")?.outcome,"unknown");
 }
 const data=goldenFixture();
 data.assets[0].recognition="unreviewed";
 const assessment=assessCase(data,CURRENT_RULESET);
 assert.equal(assessment.calculation.liquidationValueWon,"1000000","unreviewed asset arithmetic is not erased");
 assert.equal(assessment.calculation.liquidationComparison,"unknown");
 assert.equal(assessment.calculation.traces.find(v=>v.id==="liquidation_comparison")?.status,"provisional");
 assert.equal(assessment.findings.find(v=>v.id==="liquidation")?.outcome,"unknown");
});
test("liquidation_comparison: a fully reviewed numerical shortfall remains not_met without inferring court decision",()=>{
 const data=goldenFixture();
 data.context.approvedPresentValue=normalizeMoney("500000");
 const assessment=assessCase(data,CURRENT_RULESET);
 assert.equal(assessment.calculation.presentValueWon,"500000");
 assert.equal(assessment.calculation.liquidationComparison,"not_met");
 assert.equal(assessment.calculation.traces.find(v=>v.id==="liquidation_comparison")?.resultWon,"-500000");
 assert.equal(assessment.findings.find(v=>v.id==="liquidation")?.outcome,"fail");
 assert.equal(assessment.generationGate.canFinalize,false);
});

test("payment_schedule + installment_distribution: source-derived plan to 36 months reconciles exactly",()=>{
 const data=goldenFixture(),calculation=calculateCase(data,CURRENT_RULESET);
 const ledger=buildRepaymentPlanModel(data,calculation);
 const review=reconcilePlanLedger(data,calculation,ledger);
 assert.equal(ledger.rows.filter(v=>v.claimClass==="ordinary").length,36);
 assert.equal(ledger.rows.filter(v=>v.claimClass==="trustee_fee").length,36);
 assert.equal(review.status,"reconciled");
 assert.equal(review.totals.ordinaryWon,"36000000");
 assert.equal(review.totals.trusteeFeeWon,"0");
 assert.equal(review.unallocatedBudgets["1:ordinary"],"500000");
});
test("living_cost_proposal: Seoul 2026 1-person baseline is separate from household judicial recognition",()=>{
 const legal=buildLegalProposals(goldenFixture());
 assert.equal(legal.livingCost.status,"proposal");
 if(legal.livingCost.status==="proposal")assert.equal(legal.livingCost.base60Percent.exactDecimalWon,"1538542.8");
});
test("objection_minimum + seoul_short_term: incomplete dated court evidence never becomes legal approval",()=>{
 const legal=buildLegalProposals(goldenFixture());
 assert.equal(legal.objection.value,"unknown");
 assert.equal(legal.objectionMinimum.status,"unknown");
 assert.ok(["unknown","not_candidate_on_known_facts","candidate_for_human_review"].includes(legal.termCandidate.status));
 assert.equal(legal.courtApprovalInferred,false);
});
test("transaction_review: no statement inventory must never imply zero transfers proven",()=>{
 const review=scanTransactions(goldenFixture());
 assert.ok(review.coverage.completePeriodProven!==true);
});
test("form_projection: D5103 monthly row, D5106 unsecured amount and D5110 scalar all map from same calculation snapshot",()=>{
 const data=goldenFixture(),calculation=calculateCase(data,CURRENT_RULESET);
 const ledger=buildRepaymentPlanModel(data,calculation),review=reconcilePlanLedger(data,calculation,ledger);
 const bindings=buildFormBindings(data,calculation,undefined,ledger,review);
 assert.equal(bindings.scalars.monthly_income,"3,000,000");
 assert.equal(bindings.scalars.total_principal,"100,000,000");
 assert.equal(bindings.scalars.monthly_payment,"1,000,000");
 assert.equal(bindings.scalars.total_repayment,"36,000,000");
 assert.equal(bindings.rows.month.length,1);
 assert.equal(bindings.rows.month[0].period,"2026-10");
 assert.equal(bindings.rows.month[0].net_income,"3,000,000");
});

test("serialized SQL calculation feature outputs preserve golden amounts, names, source IDs and row ordinals",()=>{
 const execution=executeCaseNodes(goldenFixture());
 const rows=calculationFeatureRows(execution);
 const expected:Record<string,string>={
  monthlyIncomeWon:"3000000",debtPrincipalWon:"100000000",debtInterestWon:"0",
  totalDebtWon:"100000000",securedDebtWon:"0",unsecuredDebtWon:"100000000",
  liquidationValueWon:"1000000",recognizedLivingCostWon:"1500000",
  disposableIncomeWon:"1500000",ordinaryRepaymentBudgetWon:"1500000",
  monthlyPaymentWon:"1000000",planTotalWon:"36000000",presentValueWon:"30000000"
 };
 for(const [key,amount]of Object.entries(expected)){
  const matches=rows.filter(row=>row.outputName===key);
  assert.equal(matches.length,1,key+": each top-level calculation must have one feature output");
  assert.equal(matches[0].value,amount,key);
  assert.equal(matches[0].valueWon,amount,key);
  assert.ok(matches[0].outputPath.startsWith("/assessment/calculation/"),key);
  assert.ok(matches[0].formula.length>0,key);
 }
 const allocation=rows.find(row=>row.outputName==="allocations.allocatedPrincipalWon");
 assert.equal(allocation?.subjectId,"debt-1");
 assert.equal(allocation?.rowOrdinal,0);
 assert.equal(allocation?.value,"36000000");
 assert.ok(rows.find(row=>row.outputName==="monthlyIncomeWon")?.sourceFactIds.includes("income-net"));
 assert.ok(rows.find(row=>row.outputName==="debtPrincipalWon")?.sourceFactIds.includes("debt-principal"));
});
