import { REFERENCE_PARAMETER_ROWS, referenceMoney, referenceParameter, referencePositiveInteger } from "./reference-parameters.ts";
import { currentFacts, factSourceLineageIssues, moneyValue, type CaseData, type Fact } from "./domain.ts";
import { proposeLivingCost } from "./living-cost-proposal.ts";
import { evaluateSeoul424, type EvidenceValue, type Tri, type WageHistoryEvidence } from "./seoul424-candidate.ts";
import { evaluateObjectionMinimum, currentObjectionMinimumRuleVersion, currentObjectionMinimumEffectiveFrom, type ObjectionPresence, type ReviewedWonEvidence } from "./objection-minimum.ts";
import { CURRENT_RULESET } from "./legal-rules.ts";

function sourceChecked(data: CaseData, fact: Fact): boolean {
  return fact.state === "verified" && fact.recognition === "accepted" && fact.validation.every((v) => v.severity !== "error") && factSourceLineageIssues(data, [fact.id]).length === 0;
}
function sourceVerified(data: CaseData, fact: Fact): boolean {
  return fact.state === "verified" && fact.validation.every((v) => v.severity !== "error") && factSourceLineageIssues(data, [fact.id]).length === 0;
}
function factsFor(data: CaseData, key: string): Fact[] { return currentFacts(data).filter((f) => f.key === key); }
function single(data: CaseData, key: string): Fact | null {
  const xs = factsFor(data, key);
  return xs.length === 1 ? xs[0] : null;
}
function triFact(data: CaseData, key: string): { value: Tri; ids: string[] } {
  const f = single(data, key);
  if (!f || !sourceChecked(data, f)) return { value: "unknown", ids: f ? [f.id] : [] };
  const v = f.value;
  if (v === true || v === "yes" || v === "예") return { value: "yes", ids: [f.id] };
  if (v === false || v === "no" || v === "아니오") return { value: "no", ids: [f.id] };
  return { value: "unknown", ids: [f.id] };
}
function evidence<T>(data: CaseData, key: string, parse: (f: Fact) => T | null): EvidenceValue<T> | null {
  const f = single(data, key);
  if (!f || !sourceChecked(data, f)) return null;
  const value = parse(f);
  return value === null ? null : { value, factIds: [f.id], sourceValidated: true, legallyRecognized: true };
}
function nonnegativeInteger(f: Fact): number | null {
  const x = typeof f.value === "number" ? f.value : typeof f.value === "string" && /^\d+$/.test(f.value) ? Number(f.value) : NaN;
  return Number.isSafeInteger(x) && x >= 0 ? x : null;
}
function exactReviewedWon(data: CaseData, key: string): ReviewedWonEvidence | null {
  const f = single(data, key);
  if (!f || !sourceChecked(data, f) || !f.numeric) return null;
  const value = moneyValue(f.numeric);
  return value === null || value < 0 ? null : { amountWon: value.toString(), factIds: [f.id], sourceVerified: true, legallyAccepted: true };
}
function objectionStatus(data: CaseData): { value: ObjectionPresence; factIds: string[] } {
  const contextStatus = data.context.courtObjection ?? "unknown";
  const creditor = triFact(data, "objections.creditor");
  const commissioner = triFact(data, "objections.commissioner");
  const creditorStatus = creditor.value;
  const commissionerStatus = commissioner.value;
  const derived: ObjectionPresence = creditorStatus === "yes" || commissionerStatus === "yes" ? "yes" : creditorStatus === "no" && commissionerStatus === "no" ? "no" : "unknown";
  if ((contextStatus === "yes" || contextStatus === "no") && derived !== "unknown" && contextStatus !== derived) return { value: "unknown", factIds: [...creditor.ids, ...commissioner.ids] };
  return { value: derived, factIds: [...creditor.ids, ...commissioner.ids] };
}
/** Catalog semantic: `debts.privateCreditors` means existence/count of private creditors. */
export function deriveNoPrivateCreditors(value: unknown): boolean | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value === 0;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value) === 0;
  if (value === true || value === "yes" || value === "예") return false;
  if (value === false || value === "no" || value === "아니오") return true;
  return null;
}
/** Catalog semantic: `debts.lastYearDebt` means existence of non-exempt recent debt. */
export function deriveNoRecentDebt(value: unknown): boolean | null {
  if (value === true || value === "yes" || value === "예") return false;
  if (value === false || value === "no" || value === "아니오") return true;
  return null;
}
function wageHistory(data: CaseData): EvidenceValue<WageHistoryEvidence> | null {
  const contract = referenceParameter<{ key: string; minimumWageVersionKey: string }>("param.seoul.shortened_term.wage_history_fact_contract");
  const f = single(data, contract.key), version = single(data, contract.minimumWageVersionKey);
  if (!f || !version || !sourceChecked(data, f) || !sourceChecked(data, version) || typeof f.value !== "object" || f.value === null || Array.isArray(f.value) || typeof version.value !== "string") return null;
  const raw = f.value as Record<string, unknown>;
  const explicitPeriod = typeof raw.reviewedPeriodYears === "number" && Number.isSafeInteger(raw.reviewedPeriodYears) && raw.reviewedPeriodYears > 0 && typeof raw.wholePeriodBelowMinimum === "boolean";
  if (typeof raw.wholeTwoYearBelowMinimum !== "boolean" && !explicitPeriod) return null;
  return { value: { wholeTwoYearBelowMinimum: raw.wholeTwoYearBelowMinimum === true, ...(explicitPeriod ? { reviewedPeriodYears: raw.reviewedPeriodYears as number, wholePeriodBelowMinimum: raw.wholePeriodBelowMinimum as boolean } : {}), coverageStart: typeof raw.coverageStart === "string" ? raw.coverageStart : undefined, coverageEnd: typeof raw.coverageEnd === "string" ? raw.coverageEnd : undefined, minimumWageVersion: version.value }, factIds: [f.id, version.id], sourceValidated: true, legallyRecognized: true };
}

type CategoryPredicate = { id: string; key: string; article: string; requiredProof: string };
const categoryPredicates = () => referenceParameter<readonly CategoryPredicate[]>("param.seoul.shortened_term.category_predicates");
function categoryRoutes(data: CaseData) {
  const applicantIdentityResolved = Boolean(data.context.applicant?.name?.trim() || data.context.applicant?.residentIdMasked?.trim());
  const appDate = data.context.applicationDate;
  const ageFact = single(data, "applicant.age");
  const ageKnown = applicantIdentityResolved && ageFact?.subjectId === "applicant" && ageFact.asOf === appDate && sourceVerified(data, ageFact) ? nonnegativeInteger(ageFact) : null;
  const seniorAge = referencePositiveInteger("param.seoul.shortened_term.senior_age_min"), youthAge = referencePositiveInteger("param.seoul.shortened_term.youth_age_exclusive_max");
  const ageSourceIds = ageKnown === null ? ageFact ? [ageFact.id] : [] : [ageFact!.id];
  const routes = [
    { id: "age_65_or_more", status: ageKnown === null ? "unknown" as const : ageKnown >= seniorAge ? "yes" as const : "no" as const, factIds: ageSourceIds, article: "§424 제2조 제2항 제1호", requiredProof: `신청인과 연결되고 신청일 기준으로 확인된 만 ${seniorAge}세 이상 연령` },
    { id: "age_under_30", status: ageKnown === null ? "unknown" as const : ageKnown < youthAge ? "yes" as const : "no" as const, factIds: ageSourceIds, article: "§424 제2조 제2항 제3호", requiredProof: `신청인과 연결되고 신청일 기준으로 확인된 ${youthAge}세 미만 연령` },
  ];
  for (const rule of categoryPredicates()) {
    const matches = factsFor(data, rule.key);
    const fact = matches.length === 1 ? matches[0] : null;
    let status: Tri = "unknown";
    if (applicantIdentityResolved && fact?.subjectId === "applicant" && sourceChecked(data, fact)) {
      const v = fact.value;
      if (v === true || v === "yes" || v === "예") status = "yes";
      else if (v === false || v === "no" || v === "아니오") status = "no";
    }
    routes.push({ id: rule.id, status, factIds: fact ? [fact.id] : [], article: rule.article, requiredProof: rule.requiredProof });
  }
  return routes;
}

/** Read-only proposals derived only from current, source-validated, accepted facts and explicit case fields. */
export function buildLegalProposals(data: CaseData) {
  const appDate = data.context.applicationDate;
  const year = /^\d{4}-\d{2}-\d{2}$/.test(appDate) ? Number(appDate.slice(0, 4)) : NaN;
  const additional = data.household.additionalLivingCost?.amountWon;
  const additionalIds = data.household.factIds.filter((id) => currentFacts(data).some((f) => f.id === id && f.key === "household.additionalLivingCost" && sourceChecked(data, f)));
  const livingCost = proposeLivingCost({ year, jurisdiction: data.context.courtId, claimedHouseholdSize: data.household.recognizedMembers ?? null, additionalExpenseWon: additional && /^\d+$/.test(additional) && additionalIds.length ? additional : null, additionalExpenseFactIds: additionalIds });

  const categoryFacts = ["applicant.age", "applicant.severeDisability", "household.minorChildren", "household.singleParent", "rentalFraud.officialDecision"].map((k) => ({ k, f: single(data, k) }));
  const routes = categoryRoutes(data);
  const totalDebtThresholdWon = referenceMoney("param.seoul.shortened_term.total_debt_max_won");
  const totalDebt = evidence(data, "debts.total", (f) => { const n = nonnegativeInteger(f); return n === null ? null : BigInt(n) <= BigInt(totalDebtThresholdWon); });
  const noPrivate = data.context.inventoryComplete.debt === "yes"
    ? evidence(data, "debts.privateCreditors", (f) => deriveNoPrivateCreditors(f.value))
    : null;
  const recentDebtPeriodYears = referencePositiveInteger("param.seoul.shortened_term.recent_debt_years");
  const recentContract = referenceParameter<{ key: string; periodYears: number }>("param.seoul.shortened_term.recent_debt_fact_contract");
  const noRecentDebt = recentContract.periodYears === recentDebtPeriodYears ? evidence(data, recentContract.key, (f) => deriveNoRecentDebt(f.value)) : null;
  const term = evaluateSeoul424({ courtId: data.context.courtId || null, firstFilingDate: appDate || null, categoryRoutes: routes, wageHistory: wageHistory(data), totalDebtAtMost50MillionWon: totalDebt, noIndividualCreditors: noPrivate, noRecentYearDebtExceptGoodsPurchaseCard: noRecentDebt, totalDebtThresholdWon, recentDebtPeriodYears });
  const approvalDateFact = single(data, "context.planApprovalDate");
  const approvalDate = approvalDateFact && sourceChecked(data, approvalDateFact) && typeof approvalDateFact.value === "string" ? approvalDateFact.value : null;
  const objection = objectionStatus(data);
  const statuteVersionCurrent = CURRENT_RULESET.status === "source_verified" && CURRENT_RULESET.effectiveFrom === currentObjectionMinimumEffectiveFrom() && data.context.ruleReleaseId === CURRENT_RULESET.id && data.context.ruleApplicationReviewed;
  const proposedPlanPV = exactReviewedWon(data, "plan.repaymentPresentValue");
  const contextPlanPV = moneyValue(data.context.approvedPresentValue);
  const planPVConsistent = proposedPlanPV && contextPlanPV !== null && proposedPlanPV.amountWon === contextPlanPV.toString() && data.context.presentValueReviewed === true && !!data.context.presentValueBasis?.trim();
  const objectionMinimum = evaluateObjectionMinimum({ asOf: approvalDate, ruleVersion: statuteVersionCurrent ? currentObjectionMinimumRuleVersion() : null, courtObjection: objection.value, conditionFactIds: [...(approvalDateFact && approvalDate ? [approvalDateFact.id] : []), ...objection.factIds], claimTotalPresentValue: exactReviewedWon(data, "claims.presentValue"), planPresentValue: planPVConsistent ? proposedPlanPV : null });
  return { livingCost, termCandidate: term, objection, objectionMinimum, currentPlanMonths: Number.isInteger(data.context.planMonths) ? data.context.planMonths : null, categoryEvidence: categoryFacts.map(({ k, f }) => ({ key: k, factId: f?.id ?? null, status: k === "applicant.age" && f && f.asOf !== appDate ? "stale_or_unbound_age" as const : f && sourceChecked(data, f) ? "source_and_recognition_checked_but_legal_specificity_unverified" as const : "unknown_or_unreviewed" as const })), courtApprovalInferred: false as const };
}

/**
 * Binds a human shortened-term review to the current case inputs that can support
 * a §424 candidate route. This is a deterministic change detector, not a signature.
 */
export function shortenedTermBasisFingerprint(data: CaseData): string {
  const wageContract = referenceParameter<{ key: string; minimumWageVersionKey: string }>("param.seoul.shortened_term.wage_history_fact_contract");
  const recentContract = referenceParameter<{ key: string }>("param.seoul.shortened_term.recent_debt_fact_contract");
  const relevantFactKeys = new Set([
    ...categoryPredicates().map(rule => rule.key), wageContract.key, wageContract.minimumWageVersionKey, recentContract.key,
    "applicant.age", "legal.seoul424.statutory_severe_disability",
    "legal.seoul424.raising_two_or_more_minor_children", "legal.seoul424.statutory_single_parent",
    "legal.seoul424.qualifying_article14_rental_fraud_causing_insolvency",
    "vulnerable.wageHistory", "vulnerable.minimumWageVersion", "debts.total",
    "debts.privateCreditors", "debts.lastYearDebt",
  ]);
  const facts = currentFacts(data).filter((fact) => relevantFactKeys.has(fact.key)).map((fact) => ({
    id: fact.id, key: fact.key, value: fact.value, numeric: fact.numeric, asOf: fact.asOf,
    subjectId: fact.subjectId, state: fact.state, recognition: fact.recognition,
    refs: fact.refs.map((ref) => [ref.documentId, ref.page]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  })).sort((a, b) => a.key.localeCompare(b.key) || a.id.localeCompare(b.id));
  const basis = {
    referenceParameters: Object.fromEntries(REFERENCE_PARAMETER_ROWS.filter(row => row.id.startsWith("param.seoul.shortened_term.") || row.id.startsWith("param.national.term.")).map(row => [row.id, referenceParameter(row.id)])),
    courtId: data.context.courtId,
    applicationDate: data.context.applicationDate,
    planMonths: data.context.planMonths,
    ruleReleaseId: data.context.ruleReleaseId,
    applicant: data.context.applicant,
    paymentInputs: {
      approvedMonthlyPayment: data.context.approvedMonthlyPayment,
      approvedPresentValue: data.context.approvedPresentValue,
      monthlyTrusteeFee: data.context.monthlyTrusteeFee,
      monthlyPriorityPayment: data.context.monthlyPriorityPayment,
      monthlyEstatePayment: data.context.monthlyEstatePayment,
      householdRecognizedMembers: data.household.recognizedMembers,
      householdRecognizedLivingCost: data.household.recognizedLivingCost,
      householdAdditionalLivingCost: data.household.additionalLivingCost,
      householdIncludesAdditional: data.household.livingCostIncludesAdditional,
    },
    facts,
    debts: data.debts.map((debt) => ({ id: debt.id, principal: debt.principal, interest: debt.interest, asOf: debt.asOf, secured: debt.secured, classification: debt.classification, priority: debt.priority, legalReview: debt.legalReview, factIds: [...debt.factIds].sort() })).sort((a,b)=>a.id.localeCompare(b.id)),
    incomes: data.incomes.map((income) => ({ id: income.id, net: income.net, gross: income.gross, expenses: income.expenses, recurring: income.recurring, recognition: income.recognition, factIds: [...income.factIds].sort() })).sort((a,b)=>a.id.localeCompare(b.id)),
  };
  return JSON.stringify(basis);
}
