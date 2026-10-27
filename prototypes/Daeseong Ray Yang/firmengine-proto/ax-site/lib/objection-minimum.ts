export type ObjectionPresence = "yes" | "no" | "unknown";
export type ObjectionMinimumStatus = "comparison" | "unknown" | "not_applicable" | "unsupported_version";

export const OBJECTION_MINIMUM_SOURCE_URL = "https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR";
export const OBJECTION_MINIMUM_CLAUSE = "채무자 회생 및 파산에 관한 법률 제614조 제2항 제3호";
export const OBJECTION_MINIMUM_SOURCE_TEXT = "3. 변제계획의 인가결정일을 기준일로 하여 평가한 개인회생채권에 대한 총변제액이 3천만원을 초과하지 아니하는 범위 안에서 다음 각목의 금액보다 적지 아니할 것. 가. 변제계획의 인가결정일을 기준일로 하여 평가한 개인회생채권의 총금액이 5천만원 미만인 경우에는 위 총금액에 100분의 5를 곱한 금액. 나. 변제계획의 인가결정일을 기준일로 하여 평가한 개인회생채권의 총금액이 5천만원 이상인 경우에는 위 총금액에 100분의 3을 곱한 금액에 1백만원을 더한 금액.";
export const OBJECTION_MINIMUM_RULE_VERSION = "law-21490-effective-2026-10-02";
export const OBJECTION_MINIMUM_EFFECTIVE_FROM = "2026-10-02";

export interface ReviewedWonEvidence {
  amountWon: string | null;
  factIds: string[];
  sourceVerified: boolean;
  legallyAccepted: boolean;
}
export interface ObjectionMinimumInput {
  /** Date at which the court would evaluate the plan and claims; never defaulted to application date. */
  asOf: string | null;
  ruleVersion: string | null;
  courtObjection: ObjectionPresence;
  /** Source fact IDs supporting the approval-date and objection-gate evidence. */
  conditionFactIds: string[];
  /** Present value of total claims, distinct from the proposed plan's present value. */
  claimTotalPresentValue: ReviewedWonEvidence | null;
  /** Present value of proposed repayments, distinct from total claim value. */
  planPresentValue: ReviewedWonEvidence | null;
}
export type ObjectionMinimumResult =
  | { status: "unknown" | "not_applicable" | "unsupported_version"; comparison: null; reason: string; sourceUrl: string; clause: string; sourceText: string; ruleVersion: string; courtApprovalInferred: false }
  | { status: "comparison"; comparison: "meets_minimum" | "below_minimum"; asOf: string; ruleVersion: string; courtObjection: "yes"; claimTotalPresentValueWon: string; planPresentValueWon: string; minimumExact: { numeratorWon: string; denominator: string; ceilingWholeWon: string; capApplied: boolean; calculationNote: string }; sourceFactIds: string[]; reason: string; sourceUrl: string; clause: string; sourceText: string; courtApprovalInferred: false };

function validDate(value: string | null): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
function unknown(status: "unknown" | "not_applicable" | "unsupported_version", reason: string, ruleVersion: string | null): ObjectionMinimumResult {
  return { status, comparison: null, reason, sourceUrl: OBJECTION_MINIMUM_SOURCE_URL, clause: OBJECTION_MINIMUM_CLAUSE, sourceText: OBJECTION_MINIMUM_SOURCE_TEXT, ruleVersion: ruleVersion ?? "unknown", courtApprovalInferred: false };
}
function validEvidence(e: ReviewedWonEvidence | null): e is ReviewedWonEvidence & { amountWon: string } {
  return !!e && typeof e.amountWon === "string" && /^\d+$/.test(e.amountWon) && e.factIds.length > 0 && e.sourceVerified && e.legallyAccepted;
}
function ceilRatio(numerator: bigint, denominator: bigint): bigint { return (numerator + denominator - BigInt(1)) / denominator; }

/** Exact §614(2)(3) comparison only. This is an additional objection-case threshold, not approval. */
export function evaluateObjectionMinimum(input: ObjectionMinimumInput): ObjectionMinimumResult {
  if (input.courtObjection === "no") return unknown("not_applicable", "채권자 또는 회생위원의 이의가 없으면 제614조 제2항 추가 최소변제 요건은 적용하지 않습니다.", input.ruleVersion);
  if (input.courtObjection !== "yes") return unknown("unknown", "이의 여부가 source-backed 검토 상태로 확정되지 않았습니다.", input.ruleVersion);
  if (!validDate(input.asOf)) return unknown("unknown", "인가결정일 기준일이 확인되지 않아 해당 시점의 규칙을 적용할 수 없습니다.", input.ruleVersion);
  if (input.ruleVersion !== OBJECTION_MINIMUM_RULE_VERSION || input.asOf! < OBJECTION_MINIMUM_EFFECTIVE_FROM) return unknown("unsupported_version", "인가결정일 기준일과 해당 일자에 적용되는 제614조 판본이 확인되지 않았습니다.", input.ruleVersion);
  if (!input.conditionFactIds.length || !validEvidence(input.claimTotalPresentValue) || !validEvidence(input.planPresentValue)) return unknown("unknown", "이의 여부·인가결정일과 채권 총액 PV·계획 총변제 PV가 각 source-verified·legally-accepted 근거 ID를 가진 별도 집계로 필요합니다. 결손을 0원으로 대체하지 않습니다.", input.ruleVersion);

  const claims = BigInt(input.claimTotalPresentValue.amountWon);
  const proposed = BigInt(input.planPresentValue.amountWon);
  let numerator = claims < BigInt(50_000_000) ? claims * BigInt(5) : claims * BigInt(3) + BigInt(100_000_000);
  const denominator = BigInt(100);
  const capNumerator = BigInt(30_000_000) * denominator;
  const capApplied = numerator > capNumerator;
  if (capApplied) numerator = capNumerator;
  const ceiling = ceilRatio(numerator, denominator);
  const comparison = proposed * denominator >= numerator ? "meets_minimum" : "below_minimum";
  return {
    status: "comparison", comparison, asOf: input.asOf!, ruleVersion: input.ruleVersion!, courtObjection: "yes",
    claimTotalPresentValueWon: input.claimTotalPresentValue.amountWon,
    planPresentValueWon: input.planPresentValue.amountWon,
    minimumExact: { numeratorWon: numerator.toString(), denominator: denominator.toString(), ceilingWholeWon: ceiling.toString(), capApplied, calculationNote: "정확분수 기준으로 비교합니다. 원 단위 표시용 ceiling은 산술상 최소 충족 정수일 뿐 법원의 법률상 반올림 규칙을 가정하지 않습니다." },
    sourceFactIds: [...new Set([...input.conditionFactIds, ...input.claimTotalPresentValue.factIds, ...input.planPresentValue.factIds])],
    reason: comparison === "meets_minimum" ? "이의 사건 §614(2)(3) 최소변제 기준과 입력된 PV를 수학적으로 비교했습니다. 인가 판단은 아닙니다." : "입력된 계획 PV가 이의 사건 §614(2)(3) 최소변제 기준보다 낮습니다. 이는 법원 인가 거절 또는 결론이 아닙니다.",
    sourceUrl: OBJECTION_MINIMUM_SOURCE_URL, clause: OBJECTION_MINIMUM_CLAUSE, sourceText: OBJECTION_MINIMUM_SOURCE_TEXT, courtApprovalInferred: false,
  };
}
