// A2 r108: synthetic-only evidence identity regression. These assertions are
// technical candidate gates, NOT legal recognition / attorney or court approval.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSeoul424, type Seoul424Input, type CandidateStatus } from "../lib/seoul424-candidate.ts";
import { referenceMoney, referenceParameter, referencePositiveInteger } from "../lib/reference-parameters.ts";

function fixture(): Seoul424Input {
  const years = referencePositiveInteger("param.seoul.shortened_term.wage_history_years");
  return {
    courtId: referenceParameter<string>("param.seoul.shortened_term.court_id"),
    firstFilingDate: referenceParameter<string>("param.seoul.shortened_term.effective_from"),
    categoryRoutes: [{ id: "SYN-AGE", status: "no", factIds: ["SYN-AGE-1"], article: "SYN", requiredProof: "SYN" }],
    wageHistory: {
      value: {
        wholeTwoYearBelowMinimum: true, reviewedPeriodYears: years,
        wholePeriodBelowMinimum: true, minimumWageVersion: "SYN-MIN-WAGE-V1",
      },
      factIds: ["SYN-WAGE", "SYN-WAGE-VERSION"],
      sourceValidated: true, legallyRecognized: true,
    },
    totalDebtAtMost50MillionWon: { value: true, factIds: ["SYN-DEBT"], sourceValidated: true, legallyRecognized: true },
    noIndividualCreditors: { value: true, factIds: ["SYN-CREDITOR"], sourceValidated: true, legallyRecognized: true },
    noRecentYearDebtExceptGoodsPurchaseCard: { value: true, factIds: ["SYN-RECENT"], sourceValidated: true, legallyRecognized: true },
    totalDebtThresholdWon: referenceMoney("param.seoul.shortened_term.total_debt_max_won"),
    recentDebtPeriodYears: referencePositiveInteger("param.seoul.shortened_term.recent_debt_years"),
  };
}
type Scenario = { name:string; mutate:(v:Seoul424Input)=>void; expected:CandidateStatus; condition?:string };
const cases:Scenario[] = [
  { name:"positive valid all Fact IDs", mutate:()=>{}, expected:"candidate_for_human_review" },
  { name:"wage whitespace ID", mutate:v=>{v.wageHistory!.factIds=[" "];}, expected:"unknown",condition:"wage_below_minimum_full_two_years" },
  { name:"wage duplicate Fact IDs", mutate:v=>{v.wageHistory!.factIds=["SYN-WAGE","SYN-WAGE"];}, expected:"unknown",condition:"wage_below_minimum_full_two_years" },
  { name:"wage missing array entries", mutate:v=>{v.wageHistory!.factIds=[];}, expected:"unknown",condition:"wage_below_minimum_full_two_years" },
  { name:"debt blank ID", mutate:v=>{v.totalDebtAtMost50MillionWon!.factIds=[""];}, expected:"unknown",condition:"total_debt_at_most_50m" },
  { name:"debt duplicate Fact IDs", mutate:v=>{v.totalDebtAtMost50MillionWon!.factIds=["SYN-D","SYN-D"];}, expected:"unknown",condition:"total_debt_at_most_50m" },
  { name:"creditor whitespace ID", mutate:v=>{v.noIndividualCreditors!.factIds=[" \t"];}, expected:"unknown",condition:"no_individual_creditors" },
  { name:"recent debt empty Fact IDs", mutate:v=>{v.noRecentYearDebtExceptGoodsPurchaseCard!.factIds=[];}, expected:"unknown",condition:"no_recent_year_debt_except_goods_card" },
  { name:"recent debt non-array Fact IDs", mutate:v=>{v.noRecentYearDebtExceptGoodsPurchaseCard!.factIds="SYN-FAKE" as unknown as string[];}, expected:"unknown",condition:"no_recent_year_debt_except_goods_card" },
  { name:"unrecognized source", mutate:v=>{v.noIndividualCreditors!.legallyRecognized=false;}, expected:"unknown",condition:"no_individual_creditors" },
  { name:"explicitly not met", mutate:v=>{v.noIndividualCreditors!.value=false;}, expected:"not_candidate_on_known_facts" },
  { name:"before 2026 October Seoul commencement", mutate:v=>{v.firstFilingDate="2026-09-30";}, expected:"unsupported_version" },
  { name:"different court", mutate:v=>{v.courtId="busan";}, expected:"not_applicable" },
  { name:"wage source-only", mutate:v=>{v.wageHistory!.sourceValidated=false;}, expected:"unknown",condition:"wage_below_minimum_full_two_years" },
];
for (const c of cases) test("A2-LAW-r108 SYN " + c.name,()=>{
  const input=fixture(); c.mutate(input);
  const actual=evaluateSeoul424(input);
  assert.equal(actual.status,c.expected);
  assert.equal(actual.courtApprovalInferred,false);
  assert.equal(actual.neutralInterpretationReviewRequired,true);
  if(c.condition) assert.equal(actual.conditions.find(row=>row.id===c.condition)?.status,"unknown");
  if(c.expected==="candidate_for_human_review") assert.equal(actual.route,"category_7");
  if(c.expected==="unknown") assert.equal(actual.route,null);
});
