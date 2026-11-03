// Synthetic-only source-boundary regression. Candidate does not establish legal eligibility.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSeoul424 } from "../lib/seoul424-candidate.ts";
import { referenceMoney, referenceParameter, referencePositiveInteger } from "../lib/reference-parameters.ts";

function sample(): any {
  const years = referencePositiveInteger("param.seoul.shortened_term.wage_history_years");
  const ev = (value: unknown) => ({ value, factIds: ["SYN-A"], sourceValidated: true, legallyRecognized: true });
  return {
    courtId: referenceParameter<string>("param.seoul.shortened_term.court_id"),
    firstFilingDate: "2026-10-03",
    categoryRoutes: [{ id: "SYN-C", status: "no", factIds: ["SYN-C"], article: "SYN", requiredProof: "SYN" }],
    wageHistory: ev({ wholeTwoYearBelowMinimum: true, reviewedPeriodYears: years, wholePeriodBelowMinimum: true, minimumWageVersion: "SYN-2026" }),
    totalDebtAtMost50MillionWon: ev(true),
    noIndividualCreditors: ev(true),
    noRecentYearDebtExceptGoodsPurchaseCard: ev(true),
    totalDebtThresholdWon: referenceMoney("param.seoul.shortened_term.total_debt_max_won"),
    recentDebtPeriodYears: referencePositiveInteger("param.seoul.shortened_term.recent_debt_years"),
  };
}
const cases: Array<{ name: string; change: (x: any) => void; expected: string }> = [
  { name: "baseline", change: () => {}, expected: "candidate_for_human_review" },
  { name: "court null", change: x => { x.courtId = null; }, expected: "unknown" },
  { name: "court empty", change: x => { x.courtId = ""; }, expected: "unknown" },
  { name: "court spaces", change: x => { x.courtId = " "; }, expected: "unknown" },
  { name: "court padding", change: x => { x.courtId = " seoul "; }, expected: "unknown" },
  { name: "court wrong type", change: x => { x.courtId = 123; }, expected: "unknown" },
  { name: "other confirmed court", change: x => { x.courtId = "busan"; }, expected: "not_applicable" },
  { name: "pre-effective date", change: x => { x.firstFilingDate = "2026-09-30"; }, expected: "unsupported_version" },
  { name: "effective date", change: x => { x.firstFilingDate = "2026-10-01"; }, expected: "candidate_for_human_review" },
  { name: "source false string", change: x => { x.wageHistory.sourceValidated = "false"; }, expected: "unknown" },
  { name: "wage blank Fact ID", change: x => { x.wageHistory.factIds = [" "]; }, expected: "unknown" },
  { name: "wage repeated Fact ID", change: x => { x.wageHistory.factIds = ["SYN-A", "SYN-A"]; }, expected: "unknown" },
  { name: "wage whitespace duplicate Fact ID", change: x => { x.wageHistory.factIds = ["SYN-A", " SYN-A "]; }, expected: "unknown" },
  { name: "wage padded Fact ID", change: x => { x.wageHistory.factIds = [" SYN-A "]; }, expected: "unknown" },
  { name: "missing minimum wage version", change: x => { x.wageHistory.value.minimumWageVersion = null; }, expected: "unknown" },
  { name: "null wage value", change: x => { x.wageHistory.value = null; }, expected: "unknown" },
  { name: "null category routes", change: x => { x.categoryRoutes = null; }, expected: "unknown" },
  { name: "blank category source", change: x => { x.categoryRoutes[0].status = "yes"; x.categoryRoutes[0].factIds = [""]; x.wageHistory = null; }, expected: "unknown" },
  { name: "category padded duplicate source", change: x => { x.categoryRoutes[0].status = "yes"; x.categoryRoutes[0].factIds = ["SYN-C", " SYN-C "]; x.wageHistory = null; }, expected: "unknown" },
  { name: "numeric bool", change: x => { x.totalDebtAtMost50MillionWon.value = 1; }, expected: "unknown" },
  { name: "known failed recent debt condition", change: x => { x.noRecentYearDebtExceptGoodsPurchaseCard.value = false; }, expected: "not_candidate_on_known_facts" },
  { name: "documented category 1-6 candidate", change: x => { x.categoryRoutes[0].status = "yes"; x.wageHistory = null; }, expected: "candidate_for_human_review" },
];
for (const s of cases) test("A2 r114 malformed court/Fact ID: " + s.name, () => {
  const input = sample();
  s.change(input);
  const result = evaluateSeoul424(input);
  assert.equal(result.status, s.expected);
  assert.equal(result.courtApprovalInferred, false);
  assert.equal(result.neutralInterpretationReviewRequired, true);
  if (result.status === "unknown" || result.status === "not_applicable") assert.equal(result.route, null);
});
