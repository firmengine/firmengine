// Synthetic-only technical regression. Candidate != attorney review or court approval.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSeoul424, type Seoul424Input, type CandidateStatus } from "../lib/seoul424-candidate.ts";
import { referenceMoney, referenceParameter, referencePositiveInteger } from "../lib/reference-parameters.ts";
function fixture(): Seoul424Input {
  const years = referencePositiveInteger("param.seoul.shortened_term.wage_history_years");
  return {
    courtId: referenceParameter<string>("param.seoul.shortened_term.court_id"),
    firstFilingDate: referenceParameter<string>("param.seoul.shortened_term.effective_from"),
    categoryRoutes: [{ id: "SYN-ROUTE", status: "no", factIds: ["SYN-ROUTE-ID"], article: "SYN", requiredProof: "SYN" }],
    wageHistory: { value: {wholeTwoYearBelowMinimum: true, reviewedPeriodYears: years, wholePeriodBelowMinimum: true, minimumWageVersion: "SYN-VERSION"}, factIds: ["SYN-WAGE", "SYN-VERSION"], sourceValidated: true, legallyRecognized: true },
    totalDebtAtMost50MillionWon: { value: true, factIds: ["SYN-DEBT"], sourceValidated: true, legallyRecognized: true },
    noIndividualCreditors: { value: true, factIds: ["SYN-CRED"], sourceValidated: true, legallyRecognized: true },
    noRecentYearDebtExceptGoodsPurchaseCard: { value: true, factIds: ["SYN-RECENT"], sourceValidated: true, legallyRecognized: true },
    totalDebtThresholdWon: referenceMoney("param.seoul.shortened_term.total_debt_max_won"),
    recentDebtPeriodYears: referencePositiveInteger("param.seoul.shortened_term.recent_debt_years"),
  };
}
const scenarios: {name:string, mutate:(v:any)=>void, status: CandidateStatus, route: string | null}[] = [
  {name:"normal seventh", mutate:v=>{;}, status:"candidate_for_human_review", route:"category_7" },
  {name:"positive first-to-six", mutate:v=>{v.categoryRoutes[0].status="yes";}, status:"candidate_for_human_review", route:"category_1_to_6" },
  {name:"court null seventh", mutate:v=>{v.courtId=null;}, status:"unknown", route:null },
  {name:"court null first-to-six", mutate:v=>{v.courtId=null;v.categoryRoutes[0].status="yes";}, status:"unknown", route:null },
  {name:"missing first-to-six source and seventh positive", mutate:v=>{v.categoryRoutes[0].status="yes";v.categoryRoutes[0].factIds=[];}, status:"candidate_for_human_review", route:"category_7" },
  {name:"missing first-to-six source and seventh absent", mutate:v=>{v.categoryRoutes[0].status="yes";v.categoryRoutes[0].factIds=[];v.wageHistory=null;}, status:"unknown", route:null },
  {name:"blank first-to-six source", mutate:v=>{v.categoryRoutes[0].status="yes";v.categoryRoutes[0].factIds=[" "];v.wageHistory=null;}, status:"unknown", route:null },
  {name:"wage whitespace ID", mutate:v=>{v.wageHistory.factIds=[" "];}, status:"unknown", route:null },
  {name:"wage duplicate IDs", mutate:v=>{v.wageHistory.factIds=["SYN-X","SYN-X"];}, status:"unknown", route:null },
  {name:"wage null value", mutate:v=>{v.wageHistory.value=null;}, status:"unknown", route:null },
  {name:"wage null version", mutate:v=>{v.wageHistory.value.minimumWageVersion=null;}, status:"unknown", route:null },
  {name:"debt string false", mutate:v=>{v.totalDebtAtMost50MillionWon.value="false";}, status:"unknown", route:null },
  {name:"creditor null", mutate:v=>{v.noIndividualCreditors.value=null;}, status:"unknown", route:null },
  {name:"creditor explicit false", mutate:v=>{v.noIndividualCreditors.value=false;}, status:"not_candidate_on_known_facts", route:null },
  {name:"debt blank ID", mutate:v=>{v.totalDebtAtMost50MillionWon.factIds=[""];}, status:"unknown", route:null },
  {name:"recent duplicate IDs", mutate:v=>{v.noRecentYearDebtExceptGoodsPurchaseCard.factIds=["SYN-Z","SYN-Z"];}, status:"unknown", route:null },
  {name:"before effective", mutate:v=>{v.firstFilingDate="2026-09-30";}, status:"unsupported_version", route:null },
  {name:"on effective", mutate:v=>{v.firstFilingDate=referenceParameter<string>("param.seoul.shortened_term.effective_from");}, status:"candidate_for_human_review", route:"category_7" },
  {name:"missing date", mutate:v=>{v.firstFilingDate=null;}, status:"unknown", route:null },
  {name:"other court", mutate:v=>{v.courtId="busan";}, status:"not_applicable", route:null },
  {name:"invalid calendar date", mutate:v=>{v.firstFilingDate="2026-02-30";}, status:"unknown", route:null },
  {name:"category positive independent seventh unknown", mutate:v=>{v.categoryRoutes[0].status="yes";v.noIndividualCreditors.value=null;}, status:"candidate_for_human_review", route:"category_1_to_6" },
];
for (const scenario of scenarios) test("A2 r110 synthetic " + scenario.name,()=>{
  const v=fixture();scenario.mutate(v);
  const result=evaluateSeoul424(v);
  assert.equal(result.status,scenario.status);
  assert.equal(result.route,scenario.route);
  assert.equal(result.courtApprovalInferred,false);
  assert.equal(result.neutralInterpretationReviewRequired,true);
});
