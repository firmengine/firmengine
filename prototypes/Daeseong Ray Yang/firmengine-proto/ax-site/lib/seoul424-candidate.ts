import { referenceMoney, referenceParameter, referenceParameterDefinition, referencePositiveInteger } from "./reference-parameters.ts";
export type Tri = "yes" | "no" | "unknown";
export type EvidenceValue<T> = { value: T; factIds: string[]; sourceValidated: boolean; legallyRecognized: boolean };
/** Monthly wage comparisons are evidence only; they cannot themselves decide the legal two-year criterion. */
export interface MonthlyWageEvidence { month: string; belowMinimumWage: boolean; factIds: string[]; sourceValidated: boolean; legallyRecognized: boolean }
export interface WageHistoryEvidence {
  wholeTwoYearBelowMinimum: boolean;
  /** Optional explicit binding when a reviewed evidence period changes. */
  reviewedPeriodYears?: number;
  wholePeriodBelowMinimum?: boolean;
  minimumWageVersion: string;
  coverageStart?: string;
  coverageEnd?: string;
  monthly?: MonthlyWageEvidence[];
}
export type CandidateStatus = "candidate_for_human_review" | "not_candidate_on_known_facts" | "unknown" | "unsupported_version" | "not_applicable";
export interface Seoul424Input {
  courtId: string | null;
  firstFilingDate: string | null;
  categoryRoutes: { id: string; status: Tri; factIds: string[]; article: string; requiredProof: string }[];
  wageHistory: EvidenceValue<WageHistoryEvidence> | null;
  totalDebtAtMost50MillionWon: EvidenceValue<boolean> | null;
  noIndividualCreditors: EvidenceValue<boolean> | null;
  noRecentYearDebtExceptGoodsPurchaseCard: EvidenceValue<boolean> | null;
  /** Legacy field names are retained; new thresholds/periods must be explicitly bound. */
  totalDebtThresholdWon?: string;
  recentDebtPeriodYears?: number;
}
export interface CandidateResult {
  status: CandidateStatus; route: "category_1_to_6" | "category_7" | null;
  conditions: { id: string; status: Tri; factIds: string[]; detail: string }[];
  reason: string; sourceUrl: string; clause: string;
  neutralInterpretationReviewRequired: true; courtApprovalInferred: false;
}
export const SEOUL_424_SOURCE_URL = referenceParameterDefinition("param.seoul.shortened_term.source_url").value as string;
export const SEOUL_424_WAGE_CLAUSE = `제424호 제2조 제2항 제7호 가목: 최근 ${referenceParameterDefinition("param.seoul.shortened_term.wage_history_years").value}년간 최저임금 미만의 급여를 받았을 것`;
function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const dt = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(dt.valueOf()) && dt.toISOString().slice(0, 10) === s;
}
function wageCriterion(history: EvidenceValue<WageHistoryEvidence> | null, applicationDate: string | null): { status: Tri; factIds: string[]; detail: string } {
  const years = referencePositiveInteger("param.seoul.shortened_term.wage_history_years");
  const contract = referenceParameter<{ periodYears: number; wholePeriodField: string }>("param.seoul.shortened_term.wage_history_fact_contract");
  if (!history || !applicationDate || !validDate(applicationDate) || !history.sourceValidated || !history.legallyRecognized || !history.factIds.length) return { status: "unknown", factIds: history?.factIds ?? [], detail: `최근 ${years}년 전체의 원문·최저임금 판본·법적 적용 검토가 완료된 급여 이력이 필요합니다.` };
  const value = history.value;
  const reviewed = value.reviewedPeriodYears === years && typeof value.wholePeriodBelowMinimum === "boolean" ? value.wholePeriodBelowMinimum : value.reviewedPeriodYears === undefined && contract.periodYears === years && contract.wholePeriodField === "wholeTwoYearBelowMinimum" ? value.wholeTwoYearBelowMinimum : undefined;
  if (!value.minimumWageVersion.trim() || typeof reviewed !== "boolean") return { status: "unknown", factIds: history.factIds, detail: `최근 ${years}년 전체에 대한 명시적 법률검토 결론이 없습니다. 기존 기간의 증거 또는 월별 자료 프록시로 새 기간의 법률요건을 추정하지 않습니다.` };
  return { status: reviewed ? "yes" : "no", factIds: history.factIds, detail: `최근 ${years}년 전체 요건에 대한 source-backed 명시적 법률검토 결론입니다. 후보경로 제안일 뿐 인가 판단은 아닙니다.` };
}
function evidenceTri<T>(e: EvidenceValue<T> | null, test: (value: T) => boolean): { status: Tri; factIds: string[] } {
  return e && e.sourceValidated && e.legallyRecognized && e.factIds.length ? { status: test(e.value) ? "yes" : "no", factIds: e.factIds } : { status: "unknown", factIds: e?.factIds ?? [] };
}
export function evaluateSeoul424(input: Seoul424Input): CandidateResult {
  const court = referenceParameter<string>("param.seoul.shortened_term.court_id");
  const effectiveFrom = referenceParameter<string>("param.seoul.shortened_term.effective_from");
  const debtThreshold = referenceMoney("param.seoul.shortened_term.total_debt_max_won");
  const wageYears = referencePositiveInteger("param.seoul.shortened_term.wage_history_years"), recentDebtYears = referencePositiveInteger("param.seoul.shortened_term.recent_debt_years");
  const base = { sourceUrl: referenceParameter<string>("param.seoul.shortened_term.source_url"), clause: `제424호 제2조 제2항 제7호 가목: 최근 ${wageYears}년간 최저임금 미만의 급여를 받았을 것`, neutralInterpretationReviewRequired: true as const, courtApprovalInferred: false as const };
  const validAppDate = input.firstFilingDate !== null && validDate(input.firstFilingDate);
  const baseConditions = [
    { id: "court_scope", status: input.courtId === null ? "unknown" as const : input.courtId === court ? "yes" as const : "no" as const, factIds: [], detail: "서울회생법원 관할" },
    { id: "effective_date", status: !validAppDate ? "unknown" as const : input.firstFilingDate! >= effectiveFrom ? "yes" as const : "no" as const, factIds: [], detail: `${effectiveFrom} 이후 최초 접수 사건` },
  ];
  if (input.courtId !== null && input.courtId !== court) return { ...base, status: "not_applicable", route: null, conditions: baseConditions, reason: "서울회생법원 준칙이므로 다른 관할에 적용하지 않습니다." };
  if (!validAppDate) return { ...base, status: "unknown", route: null, conditions: baseConditions, reason: "신청접수일이 없거나 유효하지 않아 시행 버전을 확인할 수 없습니다." };
  if (input.firstFilingDate! < effectiveFrom) return { ...base, status: "unsupported_version", route: null, conditions: baseConditions, reason: `${effectiveFrom} 시행 판본부터 지원합니다. 이전 사건을 아니오로 판단하지 않습니다.` };
  const category16: Tri = input.categoryRoutes.some((r) => r.status === "yes") ? "yes" : input.categoryRoutes.length > 0 && input.categoryRoutes.every((r) => r.status === "no") ? "no" : "unknown";
  const wage = wageCriterion(input.wageHistory, input.firstFilingDate);
  const debtBound = (input.totalDebtThresholdWon ?? referenceParameterDefinition("param.seoul.shortened_term.total_debt_max_won").value) === debtThreshold;
  const debt = evidenceTri(debtBound ? input.totalDebtAtMost50MillionWon : null, Boolean);
  const creditors = evidenceTri(input.noIndividualCreditors, Boolean);
  const recentBound = (input.recentDebtPeriodYears ?? referenceParameterDefinition("param.seoul.shortened_term.recent_debt_years").value) === recentDebtYears;
  const recentDebt = evidenceTri(recentBound ? input.noRecentYearDebtExceptGoodsPurchaseCard : null, Boolean);
  const conditions = [...baseConditions,
    { id: "category_1_to_6", status: category16, factIds: [], detail: "제2항 제1~6호 중 하나의 법률특정 요건을 직접 검토한 증거" },
    ...input.categoryRoutes.map((r) => ({ id: r.id, status: r.status, factIds: r.factIds, detail: `${r.article}: ${r.requiredProof}` })),
    { id: "wage_below_minimum_full_two_years", ...wage },
    { id: "total_debt_at_most_50m", ...debt, detail: `총채무 ${BigInt(debtThreshold).toLocaleString("ko-KR")}원 이하` },
    { id: "no_individual_creditors", ...creditors, detail: "개인채권자 없음 및 채권자목록 완전성" },
    { id: "no_recent_year_debt_except_goods_card", ...recentDebt, detail: `최근 ${recentDebtYears}년 발생 채무 없음(물품구입 신용카드채무 제외)` },
  ];
  // A positive substantive route is not a Seoul-court candidate until the
  // court scope is established. Preserve the condition details for human review.
  if (input.courtId === null) return { ...base, status: "unknown", route: null, conditions, reason: "관할법원이 확정되지 않아 서울 제424호 변제기간 단축 후보를 판정할 수 없습니다." };
  if (category16 === "yes") return { ...base, status: "candidate_for_human_review", route: "category_1_to_6", conditions, reason: "법률특정 제1~6호 요건의 별도 검토 후보입니다. §614 및 법원 판단은 남아 있습니다." };
  const seven = [wage.status, debt.status, creditors.status, recentDebt.status];
  if (seven.every((x) => x === "yes")) return { ...base, status: "candidate_for_human_review", route: "category_7", conditions, reason: "제7호 누적조건 후보입니다. §614와 법원 심사는 남아 있습니다." };
  if (category16 === "unknown" || seven.includes("unknown")) return { ...base, status: "unknown", route: null, conditions, reason: "적어도 한 후보 경로가 미확인입니다. 자료 미존재를 요건 불충족으로 간주하지 않습니다." };
  return { ...base, status: "not_candidate_on_known_facts", route: null, conditions, reason: "검토된 요건은 현재 증거상 후보가 아닙니다. 인가 판단은 아닙니다." };
}
