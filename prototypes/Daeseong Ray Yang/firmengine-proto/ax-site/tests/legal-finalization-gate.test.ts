import test from "node:test";
import assert from "node:assert/strict";
import { createCase, normalizeMoney, type CaseData, type Fact, type RuleSet } from "../lib/domain.ts";
import { assessCase } from "../lib/assessment.ts";
import { shortenedTermBasisFingerprint } from "../lib/legal-proposals.ts";

const rules: RuleSet = { id: "synthetic-reviewed-rules", status: "source_verified", effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31", courtIds: ["seoul"], sources: [{ id: "synthetic", title: "Synthetic rule", url: "https://example.invalid/rule" }], debtCaps: { unsecuredWon: "1000000000", securedWon: "1500000000", comparison: "lte" }, term: { ordinaryMonths: 36, exceptionalMaxMonths: 60 } };

function finalizableCase(): CaseData {
  const data = createCase("Synthetic legal gate", "synthetic-legal-gate", "2026-10-27");
  data.documents = [{ id: "doc", name: "synthetic.pdf", sha256: "a".repeat(64), status: "active", pages: [1] }];
  data.pages = [{ documentId: "doc", page: 1, role: "evidence", text: "synthetic evidence" }];
  const fact = (id: string, subjectId: string, key: string, value: Fact["value"], numeric?: string) => {
    data.facts.push({ id, logicalId: id, version: 1, subjectId, key, value, ...(numeric === undefined ? {} : { numeric: normalizeMoney(numeric) }), state: "verified", recognition: "accepted", refs: [{ documentId: "doc", page: 1, quote: "synthetic evidence" }], validation: [] });
    return id;
  };
  data.incomes = [{ id: "wage", kind: "wage", label: "Synthetic wage", net: normalizeMoney("3000000"), amountBasis: "monthly", periodStart: "2025-01-01", periodEnd: "2025-12-31", recurring: "yes", recognition: "accepted", factIds: [fact("income", "wage", "income.wage", "synthetic")] }];
  data.debts = [{ id: "loan", contractId: "loan", creditor: "Synthetic creditor", principal: normalizeMoney("100000000"), interest: normalizeMoney("1000000"), secured: "no", classification: "ordinary", priority: "ordinary", legalReview: "accepted", asOf: "2026-10-27", factIds: [fact("debt", "loan", "debt.loan", "synthetic")] }];
  data.assets = [{ id: "deposit", kind: "deposit", label: "Synthetic deposit", grossValue: normalizeMoney("1000000"), securedPayoff: normalizeMoney("0"), disposalCosts: normalizeMoney("0"), protectedValue: normalizeMoney("0"), ownershipBps: 10000, asOf: "2026-10-27", valuationBasis: "Synthetic statement", recognition: "accepted", factIds: [fact("asset", "deposit", "asset.deposit", "synthetic")] }];
  data.household = { reportedMembers: 1, recognizedMembers: 1, recognizedLivingCost: normalizeMoney("1000000"), livingCostIncludesAdditional: true, recognition: "accepted", factIds: [fact("household", "applicant", "household.recognized", "synthetic")] };
  Object.assign(data.context, { ruleReleaseId: rules.id, ruleApplicationReviewed: true, inventoryComplete: { income: "yes", debt: "yes", asset: "yes" }, filingPeriod: { start: "2025-01-01", end: "2025-12-31" }, incomePeriodReviewed: true, monthlyTrusteeFee: normalizeMoney("0"), monthlyPriorityPayment: normalizeMoney("0"), monthlyEstatePayment: normalizeMoney("0"), planMonths: 36, approvedMonthlyPayment: normalizeMoney("2000000"), approvedPresentValue: normalizeMoney("120000000"), presentValueBasis: "Synthetic reviewed basis", presentValueReviewed: true, assetValuationBasisReviewed: true, allocationBasis: "principal_then_interest_pro_rata", allocationBasisReviewed: true, eligibility: { naturalPerson: "yes", insolventOrRisk: "yes", priorProceedingsReviewed: "yes" }, applicant: { name: "Synthetic applicant" }, courtObjection: "no" });
  fact("creditor-objection", "case", "objections.creditor", "no");
  fact("commissioner-objection", "case", "objections.commissioner", "no");
  return data;
}

test("finalization requires explicit reviewed negative objection facts; unknown is not treated as no", () => {
  const data = finalizableCase();
  assert.equal(assessCase(data, rules).generationGate.canFinalize, true);
  const missing = structuredClone(data); missing.facts = missing.facts.filter((fact) => fact.key !== "objections.commissioner");
  const missingResult = assessCase(missing, rules);
  assert.equal(missingResult.generationGate.canFinalize, false);
  assert.equal(missingResult.findings.find((finding) => finding.id === "objection_status")?.outcome, "unknown");
  const unreviewed = structuredClone(data); unreviewed.facts.find((fact) => fact.key === "objections.creditor")!.recognition = "unreviewed";
  assert.equal(assessCase(unreviewed, rules).generationGate.canFinalize, false, "extracted negative without legal acceptance is not no objection");
  const mismatch = structuredClone(data); mismatch.facts.find((fact) => fact.key === "objections.creditor")!.value = "yes";
  assert.equal(assessCase(mismatch, rules).generationGate.canFinalize, false, "context-level no cannot override source-backed objection facts");
});

test("objection-positive cases block until minimum, all-income, and individual recovery conditions are evidenced", () => {
  const data = finalizableCase();
  data.context.courtObjection = "yes";
  data.facts = data.facts.filter((fact) => fact.key !== "objections.creditor" && fact.key !== "objections.commissioner");
  data.facts.push({ id: "creditor-objection", logicalId: "creditor-objection", version: 1, subjectId: "case", key: "objections.creditor", value: "yes", state: "verified", recognition: "accepted", refs: [{ documentId: "doc", page: 1, quote: "synthetic evidence" }], validation: [] });
  data.facts.push({ id: "commissioner-objection", logicalId: "commissioner-objection", version: 1, subjectId: "case", key: "objections.commissioner", value: "no", state: "verified", recognition: "accepted", refs: [{ documentId: "doc", page: 1, quote: "synthetic evidence" }], validation: [] });
  const result = assessCase(data, rules);
  assert.equal(result.generationGate.canFinalize, false);
  assert.equal(result.findings.find((finding) => finding.id === "objection_minimum")?.outcome, "unknown");
  assert.equal(result.findings.find((finding) => finding.id === "objection_individual_liquidation")?.outcome, "unknown");
  assert.equal(result.findings.find((finding) => finding.id === "objection_all_disposable_income")?.outcome, "unknown");
});

test("short Seoul plan needs a candidate and a review bound to current inputs, months, and release", () => {
  const data = finalizableCase();
  data.context.planMonths = 24;
  data.context.approvedMonthlyPayment = normalizeMoney("2000000");
  data.context.applicant = { name: "Synthetic applicant" };
  data.facts.push({ id: "disability", logicalId: "disability", version: 1, subjectId: "applicant", key: "legal.seoul424.statutory_severe_disability", value: "yes", state: "verified", recognition: "accepted", refs: [{ documentId: "doc", page: 1, quote: "synthetic evidence" }], validation: [] });
  const candidate = assessCase(data, rules);
  assert.equal(candidate.findings.find((finding) => finding.id === "seoul_424_shortened_term")?.outcome, "review_required");
  assert.equal(candidate.generationGate.canFinalize, false);
  data.context.shortenedTermReview = { months: 24, ruleReleaseId: rules.id, reason: "Synthetic human review of the documented statutory category.", basisFingerprint: shortenedTermBasisFingerprint(data) };
  assert.equal(assessCase(data, rules).generationGate.canFinalize, true);
  data.facts.push({ id: "new-fact", logicalId: "new-fact", version: 1, subjectId: "applicant", key: "legal.seoul424.statutory_single_parent", value: "no", state: "verified", recognition: "accepted", refs: [{ documentId: "doc", page: 1, quote: "synthetic evidence" }], validation: [] });
  assert.equal(assessCase(data, rules).generationGate.canFinalize, false, "a changed candidate fact invalidates the prior review binding");
});

test("debt ceiling requires application-date snapshot, and later as-of cannot authorize it", () => {
  const data = finalizableCase();
  data.context.asOf = "2026-11-27";
  data.debts[0].asOf = "2026-11-27";
  const result = assessCase(data, rules);
  assert.equal(result.findings.find((finding) => finding.id === "cap_application_date")?.outcome, "unknown");
  assert.equal(result.findings.find((finding) => finding.id === "cap_담보")?.outcome, "unknown");
  assert.equal(result.findings.find((finding) => finding.id === "cap_무담보")?.outcome, "unknown");
  assert.equal(result.calculation.securedDebtWon, null);
  assert.equal(result.calculation.unsecuredDebtWon, null);
  assert.equal(result.generationGate.canFinalize, false);
});
