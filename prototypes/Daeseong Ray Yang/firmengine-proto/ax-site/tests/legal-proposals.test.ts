import test from "node:test";
import assert from "node:assert/strict";
import { createCase, normalizeMoney } from "../lib/domain.ts";
import { proposeLivingCost } from "../lib/living-cost-proposal.ts";
import { evaluateSeoul424 } from "../lib/seoul424-candidate.ts";
import { buildLegalProposals, deriveNoPrivateCreditors, deriveNoRecentDebt } from "../lib/legal-proposals.ts";

test("official median values yield exact 60% draft, never acceptance", () => {
  const p = proposeLivingCost({ year: 2026, jurisdiction: "seoul", claimedHouseholdSize: 1 });
  assert.equal(p.status, "proposal");
  if (p.status !== "proposal") return;
  assert.equal(p.medianIncomeWon, 2_564_238);
  assert.equal(p.base60Percent.exactDecimalWon, "1538542.8");
  assert.equal(p.needsRecognizedHousehold, true);
  assert.equal("accepted" in p, false);
  assert.equal(proposeLivingCost({ year: 2026, jurisdiction: "seoul", claimedHouseholdSize: null }).status, "blocked");
  assert.equal(proposeLivingCost({ year: 2026, jurisdiction: "busan", claimedHouseholdSize: 2 }).status, "blocked");
});

const ev = <T>(value: T, id: string) => ({ value, factIds: [id], sourceValidated: true, legallyRecognized: true });
function history(below = true) { return ev({ wholeTwoYearBelowMinimum: below, minimumWageVersion: "official annual tables", coverageStart: "reviewed whole two-year interval" }, "wh"); }
const noCategoryRoutes = ["age_65_or_more", "age_under_30", "statutory_severe_disability", "raising_two_or_more_minor_children", "statutory_single_parent", "qualifying_article14_rental_fraud_causing_insolvency"].map((id) => ({ id, status: "no" as const, factIds: [id], article: "synthetic §424", requiredProof: "synthetic reviewed negative" }));
const base424 = { courtId: "seoul", firstFilingDate: "2026-10-27", categoryRoutes: noCategoryRoutes, wageHistory: history(), totalDebtAtMost50MillionWon: ev(true, "debt"), noIndividualCreditors: ev(true, "creditors"), noRecentYearDebtExceptGoodsPurchaseCard: ev(true, "recent") };

test("Seoul 424 evaluates only supported release and all cumulative conditions", () => {
  const candidate = evaluateSeoul424(base424);
  assert.equal(candidate.status, "candidate_for_human_review");
  assert.equal(candidate.route, "category_7");
  assert.equal(candidate.courtApprovalInferred, false);
  assert.equal(evaluateSeoul424({ ...base424, firstFilingDate: "2026-09-30" }).status, "unsupported_version");
  assert.equal(evaluateSeoul424({ ...base424, courtId: "busan" }).status, "not_applicable");
  assert.equal(evaluateSeoul424({ ...base424, wageHistory: null }).status, "unknown");
  assert.equal(evaluateSeoul424({ ...base424, wageHistory: history(false) }).status, "not_candidate_on_known_facts");
  assert.equal(evaluateSeoul424({ ...base424, noIndividualCreditors: null }).status, "unknown");
});

test("Seoul 424 candidates require a known court even when substantive routes look positive", () => {
  const unknownCourtSeven = evaluateSeoul424({ ...base424, courtId: null });
  assert.equal(unknownCourtSeven.status, "unknown");
  assert.equal(unknownCourtSeven.route, null);
  assert.equal(unknownCourtSeven.courtApprovalInferred, false);
  assert.equal(unknownCourtSeven.conditions.find((condition) => condition.id === "court_scope")?.status, "unknown");

  const positiveCategory = noCategoryRoutes.map((route, index) =>
    index === 0 ? { ...route, status: "yes" as const } : route);
  const unknownCourtCategory = evaluateSeoul424({
    ...base424, courtId: null, categoryRoutes: positiveCategory,
  });
  assert.equal(unknownCourtCategory.status, "unknown");
  assert.equal(unknownCourtCategory.route, null);
  assert.equal(unknownCourtCategory.conditions.find((condition) => condition.id === "category_1_to_6")?.status, "yes");

  assert.equal(evaluateSeoul424({ ...base424, courtId: "seoul", categoryRoutes: positiveCategory }).route, "category_1_to_6");
  assert.equal(evaluateSeoul424({ ...base424, courtId: "busan", categoryRoutes: positiveCategory }).status, "not_applicable");
  assert.equal(evaluateSeoul424({ ...base424, courtId: "seoul", firstFilingDate: "2026-09-30" }).status, "unsupported_version");
});

test("catalog fact polarity is explicit and unknowns remain unknown", () => {
  assert.equal(deriveNoPrivateCreditors(true), false);
  assert.equal(deriveNoPrivateCreditors(false), true);
  assert.equal(deriveNoPrivateCreditors(0), true);
  assert.equal(deriveNoPrivateCreditors(3), false);
  assert.equal(deriveNoPrivateCreditors("unknown"), null);
  assert.equal(deriveNoRecentDebt(true), false);
  assert.equal(deriveNoRecentDebt(false), true);
  assert.equal(deriveNoRecentDebt(0), null);
  assert.equal(deriveNoRecentDebt("unknown"), null);
});

test("wrapper blocks household inference and routes actual case court/date", () => {
  const c = createCase("synthetic", "synthetic", "2026-10-27");
  c.context.courtId = "seoul";
  c.household.reportedMembers = 2;
  c.household.recognizedMembers = null;
  const out = buildLegalProposals(c);
  assert.equal(out.livingCost.status, "blocked");
  assert.equal(out.termCandidate.status, "unknown");
  assert.equal(out.courtApprovalInferred, false);
  c.context.applicant = { name: "Synthetic applicant" };
  c.documents = [{ id: "doc", name: "synthetic.pdf", sha256: "a".repeat(64), status: "active", pages: [1] }];
  c.pages = [{ documentId: "doc", page: 1, role: "evidence", text: "age proof" }];
  c.facts = [{ id: "age", logicalId: "age", version: 1, subjectId: "applicant", key: "applicant.age", value: 65, asOf: "2020-01-01", state: "verified", recognition: "accepted", refs: [{ documentId: "doc", page: 1, quote: "age proof" }], validation: [] }];
  assert.equal(buildLegalProposals(c).termCandidate.conditions.find((x) => x.id === "age_65_or_more")?.status, "unknown", "stale age cannot positive-trigger a route");
});

test("objective age route requires applicant identity and exact application-date source verification", () => {
  const c = createCase("synthetic", "age-case", "2026-10-27");
  c.context.courtId = "seoul";
  c.context.applicant = { name: "Synthetic applicant" };
  c.documents = [{ id: "doc", name: "synthetic.pdf", sha256: "a".repeat(64), status: "active", pages: [1] }];
  c.pages = [{ documentId: "doc", page: 1, role: "evidence", text: "age proof" }];
  const age = (id: string, subjectId: string, value: number, asOf: string) => ({ id, logicalId: id, version: 1, subjectId, key: "applicant.age", value, asOf, state: "verified" as const, recognition: "unreviewed" as const, refs: [{ documentId: "doc", page: 1, quote: "age proof" }], validation: [] });
  for (const [id, years, expected] of [["old", 65, "yes"], ["young", 29, "yes"], ["adult", 40, "no"]] as const) {
    c.facts = [age(id, "applicant", years, c.context.applicationDate)];
    const result = buildLegalProposals(c).termCandidate;
    const route = years >= 65 ? "age_65_or_more" : years < 30 ? "age_under_30" : "age_65_or_more";
    assert.equal(result.conditions.find((x) => x.id === route)?.status, expected);
    assert.equal(result.status, expected === "yes" ? "candidate_for_human_review" : "unknown", "candidate still requires review of other categories and court conditions");
  }
  c.facts = [age("wrong-subject", "unknown-person", 65, c.context.applicationDate)];
  assert.equal(buildLegalProposals(c).termCandidate.conditions.find((x) => x.id === "age_65_or_more")?.status, "unknown");
});

test("proposal wrapper requires reviewed fact aggregates and current case release for objection threshold", () => {
  const c = createCase("synthetic", "objection-case", "2026-10-27");
  c.context.ruleReleaseId = "kr-personal-rehabilitation-national-2026-10-02";
  c.context.ruleApplicationReviewed = true;
  c.context.courtObjection = "yes";
  c.context.approvedPresentValue = normalizeMoney("2500000");
  c.context.presentValueReviewed = true;
  c.context.presentValueBasis = "Synthetic plan PV basis";
  c.documents = [{ id: "doc", name: "synthetic.pdf", sha256: "b".repeat(64), status: "active", pages: [1] }];
  c.pages = [{ documentId: "doc", page: 1, role: "evidence", text: "reviewed source" }];
  const fact = (id: string, key: string, value: string, money?: string) => ({
    id, logicalId: id, version: 1, subjectId: "case", key, value,
    numeric: money === undefined ? undefined : normalizeMoney(money),
    state: "verified" as const, recognition: "accepted" as const,
    refs: [{ documentId: "doc", page: 1, quote: "reviewed source" }], validation: [],
  });
  c.facts = [
    fact("objection-creditor", "objections.creditor", "yes"),
    fact("objection-commissioner", "objections.commissioner", "no"),
    fact("approval-date", "context.planApprovalDate", "2026-10-27"),
    fact("claim-pv", "claims.presentValue", "50000000", "50000000"),
    fact("plan-pv", "plan.repaymentPresentValue", "2500000", "2500000"),
  ];
  const result = buildLegalProposals(c).objectionMinimum;
  assert.equal(result.status, "comparison");
  if (result.status === "comparison") {
    assert.equal(result.comparison, "meets_minimum");
    assert.deepEqual(result.sourceFactIds.sort(), ["approval-date", "claim-pv", "objection-commissioner", "objection-creditor", "plan-pv"]);
  }
  c.context.approvedPresentValue = normalizeMoney("2400000");
  assert.equal(buildLegalProposals(c).objectionMinimum.status, "unknown", "fact aggregate and case plan PV disagreement blocks comparison");
  c.context.approvedPresentValue = normalizeMoney("2500000");
  c.context.ruleApplicationReviewed = false;
  assert.equal(buildLegalProposals(c).objectionMinimum.status, "unsupported_version");
});
