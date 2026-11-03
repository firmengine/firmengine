// Synthetic-only input-contract test: neither these flags nor candidate status prove court approval.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSeoul424 } from "../lib/seoul424-candidate.ts";
import { referenceMoney, referenceParameter, referencePositiveInteger } from "../lib/reference-parameters.ts";

function syntheticCase(): any {
  const years = referencePositiveInteger("param.seoul.shortened_term.wage_history_years");
  return {
    courtId: referenceParameter<string>("param.seoul.shortened_term.court_id"),
    firstFilingDate: "2026-10-03",
    categoryRoutes: [{ id: "SYN-ROUTE", status: "no", factIds: ["SYN-R"], article: "SYN", requiredProof: "SYN" }],
    wageHistory: { value: { wholeTwoYearBelowMinimum: true, reviewedPeriodYears: years, wholePeriodBelowMinimum: true, minimumWageVersion: "SYN-V" }, factIds: ["SYN-W"], sourceValidated: true, legallyRecognized: true },
    totalDebtAtMost50MillionWon: { value: true, factIds: ["SYN-D"], sourceValidated: true, legallyRecognized: true },
    noIndividualCreditors: { value: true, factIds: ["SYN-C"], sourceValidated: true, legallyRecognized: true },
    noRecentYearDebtExceptGoodsPurchaseCard: { value: true, factIds: ["SYN-Y"], sourceValidated: true, legallyRecognized: true },
    totalDebtThresholdWon: referenceMoney("param.seoul.shortened_term.total_debt_max_won"),
    recentDebtPeriodYears: referencePositiveInteger("param.seoul.shortened_term.recent_debt_years"),
  };
}

const scenarios: Array<{ name: string; mutate: (input: any) => void; expected: string }> = [
  { name: "baseline synthetic candidate", mutate: () => {}, expected: "candidate_for_human_review" },
  { name: "wage sourceValidated string false", mutate: x => { x.wageHistory.sourceValidated = "false"; }, expected: "unknown" },
  { name: "wage legallyRecognized string false", mutate: x => { x.wageHistory.legallyRecognized = "false"; }, expected: "unknown" },
  { name: "debt sourceValidated string false", mutate: x => { x.totalDebtAtMost50MillionWon.sourceValidated = "false"; }, expected: "unknown" },
  { name: "creditors legallyRecognized string false", mutate: x => { x.noIndividualCreditors.legallyRecognized = "false"; }, expected: "unknown" },
  { name: "recent sourceValidated numeric one", mutate: x => { x.noRecentYearDebtExceptGoodsPurchaseCard.sourceValidated = 1; }, expected: "unknown" },
  { name: "wage sourceValidated numeric one", mutate: x => { x.wageHistory.sourceValidated = 1; }, expected: "unknown" },
  { name: "routes null", mutate: x => { x.categoryRoutes = null; }, expected: "unknown" },
  { name: "route element null", mutate: x => { x.categoryRoutes = [null]; }, expected: "unknown" },
  { name: "route status invalid string", mutate: x => { x.categoryRoutes[0].status = "YES"; }, expected: "unknown" },
  { name: "route factIds wrong type", mutate: x => { x.categoryRoutes[0].factIds = "SYN-R"; }, expected: "unknown" },
  { name: "pre-effective date", mutate: x => { x.firstFilingDate = "2026-09-30"; }, expected: "unsupported_version" },
  { name: "missing date", mutate: x => { x.firstFilingDate = null; }, expected: "unknown" },
  { name: "missing court", mutate: x => { x.courtId = null; }, expected: "unknown" },
  { name: "wage blank Fact ID", mutate: x => { x.wageHistory.factIds = [" "]; }, expected: "unknown" },
];

for (const s of scenarios) test("A2 r111 runtime flag/shape " + s.name, () => {
  const input = syntheticCase();
  s.mutate(input);
  const actual = evaluateSeoul424(input);
  assert.equal(actual.status, s.expected);
  assert.equal(actual.courtApprovalInferred, false);
  assert.equal(actual.neutralInterpretationReviewRequired, true);
});
