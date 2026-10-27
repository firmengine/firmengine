import { currentFacts, factSourceLineageIssues, moneyValue, type CaseData, type Fact } from "./domain.ts";
import { proposeLivingCost } from "./living-cost-proposal.ts";
import { evaluateSeoul424, type EvidenceValue, type Tri, type WageHistoryEvidence } from "./seoul424-candidate.ts";
import { evaluateObjectionMinimum, OBJECTION_MINIMUM_RULE_VERSION, type ObjectionPresence, type ReviewedWonEvidence } from "./objection-minimum.ts";
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
  const f = single(data, "vulnerable.wageHistory"), version = single(data, "vulnerable.minimumWageVersion");
  if (!f || !version || !sourceChecked(data, f) || !sourceChecked(data, version) || typeof f.value !== "object" || f.value === null || Array.isArray(f.value) || typeof version.value !== "string") return null;
  const raw = f.value as Record<string, unknown>;
  if (typeof raw.wholeTwoYearBelowMinimum !== "boolean") return null;
  return { value: { wholeTwoYearBelowMinimum: raw.wholeTwoYearBelowMinimum, coverageStart: typeof raw.coverageStart === "string" ? raw.coverageStart : undefined, coverageEnd: typeof raw.coverageEnd === "string" ? raw.coverageEnd : undefined, minimumWageVersion: version.value }, factIds: [f.id, version.id], sourceValidated: true, legallyRecognized: true };
}

const CATEGORY_PREDICATES = [
  { id: "statutory_severe_disability", key: "legal.seoul424.statutory_severe_disability", article: "§424 제2조 제2항 제2호", requiredProof: "장애인복지법 제2조상 장애인 및 장애 정도가 심한 장애인에 대한 공식 증명 + 법률검토" },
  { id: "raising_two_or_more_minor_children", key: "legal.seoul424.raising_two_or_more_minor_children", article: "§424 제2조 제2항 제4호", requiredProof: "신청인이 2명 이상의 미성년 자녀를 실제 양육한다는 증명 + 법률검토" },
  { id: "statutory_single_parent", key: "legal.seoul424.statutory_single_parent", article: "§424 제2조 제2항 제5호", requiredProof: "한부모가족지원법상 한부모가족의 부 또는 모에 해당한다는 공식 증명 + 법률검토" },
  { id: "qualifying_article14_rental_fraud_causing_insolvency", key: "legal.seoul424.qualifying_article14_rental_fraud_causing_insolvency", article: "§424 제2조 제2항 제6호", requiredProof: "특별법 제14조에 따라 제2조 제4호 피해자등으로 결정된 사실과 전세사기로 인한 지급불능 또는 그 염려의 인과관계에 대한 증명 + 법률검토" },
] as const;
function categoryRoutes(data: CaseData) {
  const applicantIdentityResolved = Boolean(data.context.applicant?.name?.trim() || data.context.applicant?.residentIdMasked?.trim());
  const appDate = data.context.applicationDate;
  const ageFact = single(data, "applicant.age");
  const ageKnown = applicantIdentityResolved && ageFact?.subjectId === "applicant" && ageFact.asOf === appDate && sourceVerified(data, ageFact) ? nonnegativeInteger(ageFact) : null;
  const ageSourceIds = ageKnown === null ? ageFact ? [ageFact.id] : [] : [ageFact!.id];
  const routes = [
    { id: "age_65_or_more", status: ageKnown === null ? "unknown" as const : ageKnown >= 65 ? "yes" as const : "no" as const, factIds: ageSourceIds, article: "§424 제2조 제2항 제1호", requiredProof: "신청인과 연결되고 신청일 기준으로 확인된 만 65세 이상 연령" },
    { id: "age_under_30", status: ageKnown === null ? "unknown" as const : ageKnown < 30 ? "yes" as const : "no" as const, factIds: ageSourceIds, article: "§424 제2조 제2항 제3호", requiredProof: "신청인과 연결되고 신청일 기준으로 확인된 30세 미만 연령" },
  ];
  for (const rule of CATEGORY_PREDICATES) {
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
  const totalDebt = evidence(data, "debts.total", (f) => { const n = nonnegativeInteger(f); return n === null ? null : n <= 50_000_000; });
  const noPrivate = data.context.inventoryComplete.debt === "yes"
    ? evidence(data, "debts.privateCreditors", (f) => deriveNoPrivateCreditors(f.value))
    : null;
  const noRecentDebt = evidence(data, "debts.lastYearDebt", (f) => deriveNoRecentDebt(f.value));
  const term = evaluateSeoul424({ courtId: data.context.courtId || null, firstFilingDate: appDate || null, categoryRoutes: routes, wageHistory: wageHistory(data), totalDebtAtMost50MillionWon: totalDebt, noIndividualCreditors: noPrivate, noRecentYearDebtExceptGoodsPurchaseCard: noRecentDebt });
  const approvalDateFact = single(data, "context.planApprovalDate");
  const approvalDate = approvalDateFact && sourceChecked(data, approvalDateFact) && typeof approvalDateFact.value === "string" ? approvalDateFact.value : null;
  const objection = objectionStatus(data);
  const statuteVersionCurrent = CURRENT_RULESET.status === "source_verified" && CURRENT_RULESET.effectiveFrom === "2026-10-02" && data.context.ruleReleaseId === CURRENT_RULESET.id && data.context.ruleApplicationReviewed;
  const proposedPlanPV = exactReviewedWon(data, "plan.repaymentPresentValue");
  const contextPlanPV = moneyValue(data.context.approvedPresentValue);
  const planPVConsistent = proposedPlanPV && contextPlanPV !== null && proposedPlanPV.amountWon === contextPlanPV.toString() && data.context.presentValueReviewed === true && !!data.context.presentValueBasis?.trim();
  const objectionMinimum = evaluateObjectionMinimum({ asOf: approvalDate, ruleVersion: statuteVersionCurrent ? OBJECTION_MINIMUM_RULE_VERSION : null, courtObjection: objection.value, conditionFactIds: [...(approvalDateFact && approvalDate ? [approvalDateFact.id] : []), ...objection.factIds], claimTotalPresentValue: exactReviewedWon(data, "claims.presentValue"), planPresentValue: planPVConsistent ? proposedPlanPV : null });
  return { livingCost, termCandidate: term, objectionMinimum, currentPlanMonths: Number.isInteger(data.context.planMonths) ? data.context.planMonths : null, categoryEvidence: categoryFacts.map(({ k, f }) => ({ key: k, factId: f?.id ?? null, status: k === "applicant.age" && f && f.asOf !== appDate ? "stale_or_unbound_age" as const : f && sourceChecked(data, f) ? "source_and_recognition_checked_but_legal_specificity_unverified" as const : "unknown_or_unreviewed" as const })), courtApprovalInferred: false as const };
}
