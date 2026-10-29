import test from "node:test";
import assert from "node:assert/strict";
import { runWithReferenceSnapshot } from "../lib/reference-context.ts";
import { REFERENCE_PARAMETER_ROWS, referenceParameter, referenceParameterDefinition, maximumPlanMonths } from "../lib/reference-parameters.ts";
import { CURRENT_RULESET } from "../lib/legal-rules.ts";
import { evaluateObjectionMinimum, OBJECTION_MINIMUM_RULE_VERSION } from "../lib/objection-minimum.ts";
import { proposeLivingCost } from "../lib/living-cost-proposal.ts";
import { evaluateSeoul424, type Seoul424Input } from "../lib/seoul424-candidate.ts";
import { buildLegalProposals, shortenedTermBasisFingerprint } from "../lib/legal-proposals.ts";
import { createCase, normalizeMoney } from "../lib/domain.ts";
import { scanTransactions } from "../lib/transaction-review.ts";
import { expandPaymentSchedule, type Phase } from "../lib/payment-schedule.ts";
import { repaymentScheduleAnnex } from "../lib/document-annexes.ts";
import { parseContextPatch } from "../lib/context-validation.ts";
import { assessCase } from "../lib/assessment.ts";

function withValues<T>(values: Record<string, unknown>, action: () => T): T {
  return runWithReferenceSnapshot({ id: "synthetic-reference-release", revision: 2, sha256: "a".repeat(64), values }, action);
}
const evidence = (amountWon: string) => ({ amountWon, factIds: ["synthetic-reviewed-input"], sourceVerified: true, legallyAccepted: true });
const objection = (claims: string, payment: string) => evaluateObjectionMinimum({ asOf: "2026-10-29", ruleVersion: OBJECTION_MINIMUM_RULE_VERSION, courtObjection: "yes", conditionFactIds: ["date-and-objection"], claimTotalPresentValue: evidence(claims), planPresentValue: evidence(payment) });
const phase = (lastInstallment: number): Phase => ({ id: "phase", firstInstallment: 1, lastInstallment, firstPaymentDate: "2026-11-01", monthlyAvailableWon: "1000", allocations: [{ creditorId: "creditor", principalWon: "1000", interestWon: "0" }] });

test("national term edits flow to calculation metadata, input validation, schedule and annex together", () => {
  assert.equal(CURRENT_RULESET.term?.exceptionalMaxMonths, 60);
  withValues({ "param.national.term.exceptional_max_months": 48, "param.national.term.ordinary_months": 24 }, () => {
    assert.equal(CURRENT_RULESET.term?.exceptionalMaxMonths, 48);
    assert.equal(CURRENT_RULESET.term?.ordinaryMonths, 24);
    assert.equal(parseContextPatch({ planMonths: 48 }).planMonths, 48);
    assert.throws(() => parseContextPatch({ planMonths: 49 }));
    assert.throws(() => parseContextPatch({ shortenedTermReview: { months: 24, ruleReleaseId: "synthetic", reason: "synthetic review", basisFingerprint: "{}" } }));
    assert.equal(expandPaymentSchedule([phase(48)], 48).status, "complete");
    assert.ok(expandPaymentSchedule([phase(49)], 49).issues.includes("INSTALLMENT_LIMIT_EXCEEDED"));
    assert.equal(repaymentScheduleAnnex([phase(49)], 49).status, "blocked");
  });
  assert.equal(CURRENT_RULESET.term?.exceptionalMaxMonths, 60);
});

test("national cap and comparison parameters are read at use time", () => {
  withValues({ "param.national.debt_caps.secured_won": "1600000000", "param.national.debt_caps.comparison": "lt" }, () => {
    assert.equal(CURRENT_RULESET.debtCaps?.securedWon, "1600000000");
    assert.equal(CURRENT_RULESET.debtCaps?.comparison, "lt");
  });
  assert.equal(CURRENT_RULESET.debtCaps?.securedWon, "1500000000");
});

test("changed objection threshold and rational rates affect exact branch arithmetic without float rounding", () => {
  withValues({ "param.national.objection_minimum.branch_threshold_won": "40000000", "param.national.objection_minimum.low_rate": { numerator: 1, denominator: 10 }, "param.national.objection_minimum.high_rate": { numerator: 1, denominator: 20 }, "param.national.objection_minimum.minimum_cap_won": "10000000" }, () => {
    const below = objection("39999999", "3999999");
    assert.equal(below.status, "comparison");
    if (below.status !== "comparison") return;
    assert.equal(below.minimumExact.ceilingWholeWon, "4000000");
    assert.equal(below.comparison, "below_minimum");
    const at = objection("40000000", "3000000");
    assert.equal(at.status, "comparison");
    if (at.status !== "comparison") return;
    assert.equal(at.minimumExact.ceilingWholeWon, "3000000");
    assert.equal(at.comparison, "meets_minimum");
  });
  const original = objection("40000000", "2000000");
  assert.equal(original.status === "comparison" && original.minimumExact.ceilingWholeWon, "2000000");
});

test("changed median table and ratio retain an exact proposal and never infer a household", () => {
  assert.equal(referenceParameterDefinition("param.seoul.living.median_income_tables").verification, "unverified");
  withValues({ "param.seoul.living.median_income_tables": { "2026": ["3000001"] }, "param.seoul.living.baseline_ratio": { numerator: 2, denominator: 5 } }, () => {
    const proposal = proposeLivingCost({ year: 2026, jurisdiction: "seoul", claimedHouseholdSize: 1 });
    assert.equal(proposal.status, "proposal");
    if (proposal.status !== "proposal") return;
    assert.equal(proposal.base60Percent.exactDecimalWon, "1200000.4");
    assert.equal(proposal.base60Percent.numeratorWon, "6000002");
    assert.equal(proposal.legalEffect, "draft_proposal_only");
    assert.equal(proposeLivingCost({ year: 2026, jurisdiction: "seoul", claimedHouseholdSize: 2 }).status, "blocked");
    assert.equal(proposeLivingCost({ year: 2026, jurisdiction: "seoul", claimedHouseholdSize: null }).status, "blocked");
  });
});

test("business outflow threshold changes review selection and remains a nonstatutory policy", () => {
  const data = createCase("synthetic-reference-transactions", "synthetic-reference-transactions", "2026-10-29");
  data.transactions = ["600000", "700000"].map((amount, i) => ({ id: `tx-${i}`, date: "2026-10-01", direction: "out", kind: "unknown", amount: normalizeMoney(amount), factIds: [] }));
  assert.equal(scanTransactions(data).items.filter(item => item.id.startsWith("policy-outflow:")).length, 2);
  withValues({ "param.policy.transaction.outflow_threshold_won": "700000" }, () => {
    const result = scanTransactions(data);
    assert.equal(result.items.filter(item => item.id.startsWith("policy-outflow:")).length, 1);
    assert.equal(result.policy.thresholdWon, "700000");
    assert.equal(result.policy.legalThreshold, false);
    assert.equal(result.policy.automaticAdjudication, false);
  });
});

test("changed age threshold changes the current-date applicant route and invalidates prior review fingerprint", () => {
  const data = createCase("synthetic-age-threshold", "synthetic-age-threshold", "2026-10-29");
  data.context.courtId = "seoul";
  data.context.applicant = { name: "Synthetic applicant" };
  data.documents = [{ id: "doc", name: "synthetic.pdf", sha256: "a".repeat(64), status: "active", pages: [1] }];
  data.pages = [{ documentId: "doc", page: 1, role: "evidence", text: "age proof" }];
  data.facts = [{ id: "age", logicalId: "age", version: 1, subjectId: "applicant", key: "applicant.age", value: 65, asOf: data.context.applicationDate, state: "verified", recognition: "unreviewed", refs: [{ documentId: "doc", page: 1, quote: "age proof" }], validation: [] }];
  const before = shortenedTermBasisFingerprint(data);
  assert.equal(buildLegalProposals(data).termCandidate.conditions.find(condition => condition.id === "age_65_or_more")?.status, "yes");
  withValues({ "param.seoul.shortened_term.senior_age_min": 70 }, () => {
    assert.equal(buildLegalProposals(data).termCandidate.conditions.find(condition => condition.id === "age_65_or_more")?.status, "no");
    assert.notEqual(shortenedTermBasisFingerprint(data), before);
  });
});

test("a changed wage review period cannot reinterpret a previously reviewed two-year boolean", () => {
  const ev = <T>(value: T) => ({ value, factIds: ["synthetic-evidence"], sourceValidated: true, legallyRecognized: true });
  const input: Seoul424Input = { courtId: "seoul", firstFilingDate: "2026-10-29", categoryRoutes: [{ id: "all-reviewed-no", status: "no", factIds: ["category"], article: "synthetic", requiredProof: "synthetic" }], wageHistory: ev({ wholeTwoYearBelowMinimum: true, minimumWageVersion: "synthetic-reviewed-tables" }), totalDebtAtMost50MillionWon: ev(true), noIndividualCreditors: ev(true), noRecentYearDebtExceptGoodsPurchaseCard: ev(true) };
  assert.equal(evaluateSeoul424(input).status, "candidate_for_human_review");
  withValues({ "param.seoul.shortened_term.wage_history_years": 3 }, () => {
    assert.equal(evaluateSeoul424(input).status, "unknown");
    assert.equal(evaluateSeoul424({ ...input, wageHistory: ev({ wholeTwoYearBelowMinimum: true, reviewedPeriodYears: 3, wholePeriodBelowMinimum: true, minimumWageVersion: "synthetic-three-year-review" }) }).status, "candidate_for_human_review");
  });
});

test("parallel request snapshots do not leak parameters and malformed values fail closed", async () => {
  const results = await Promise.all([48, 72].map(months => withValues({ "param.national.term.exceptional_max_months": months }, async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 2));
    return [maximumPlanMonths(), CURRENT_RULESET.term?.exceptionalMaxMonths];
  })));
  assert.deepEqual(results, [[48, 48], [72, 72]]);
  assert.equal(maximumPlanMonths(), 60);
  assert.throws(() => withValues({ "param.national.term.exceptional_max_months": "60" }, maximumPlanMonths));
  assert.throws(() => withValues({ "param.national.objection_minimum.low_rate": { numerator: 1, denominator: 0 } }, () => objection("10000000", "500000")));
  assert.throws(() => referenceParameter("param.nonexistent"));
  assert.throws(() => { (REFERENCE_PARAMETER_ROWS[0] as { value: unknown }).value = "mutated"; });
});

test("activated reference releases require a new case-bound review even when the old application flag is true", () => {
  const data = createCase("synthetic-release-review", "synthetic-release-review", "2026-10-29");
  data.context.ruleReleaseId = CURRENT_RULESET.id;
  data.context.ruleApplicationReviewed = true;
  assert.equal(assessCase(data, CURRENT_RULESET).findings.some(finding => finding.id === "reference_release_review"), false);
  withValues({}, () => {
    const before = assessCase(data, CURRENT_RULESET);
    assert.equal(before.findings.find(finding => finding.id === "reference_release_review")?.outcome, "review_required");
    assert.equal(before.generationGate.canFinalize, false);
    const reviewed = structuredClone(data);
    (reviewed.context as typeof reviewed.context & { referenceReviewSha256?: string }).referenceReviewSha256 = "a".repeat(64);
    const after = assessCase(reviewed, CURRENT_RULESET);
    assert.equal(after.findings.some(finding => finding.id === "reference_release_review"), false);
    assert.equal(after.generationGate.canFinalize, false, "reference review does not erase other evidence and legal gates");
  });
});
