import { referenceMoney, referenceParameter, referenceParameterDefinition, referenceRatio } from "./reference-parameters.ts";
export type ObjectionPresence = "yes" | "no" | "unknown";
export type ObjectionMinimumStatus = "comparison" | "unknown" | "not_applicable" | "unsupported_version";

export const OBJECTION_MINIMUM_SOURCE_URL = referenceParameterDefinition("param.national.objection_minimum.source_url").value as string;
export const OBJECTION_MINIMUM_CLAUSE = referenceParameterDefinition("param.national.objection_minimum.clause").value as string;
export const OBJECTION_MINIMUM_SOURCE_TEXT = referenceParameterDefinition("param.national.objection_minimum.source_text").value as string;
export const OBJECTION_MINIMUM_RULE_VERSION = referenceParameterDefinition("param.national.objection_minimum.rule_version").value as string;
export const OBJECTION_MINIMUM_EFFECTIVE_FROM = referenceParameterDefinition("param.national.objection_minimum.effective_from").value as string;

/** Compatibility exports above describe the seed; live calculations resolve the request snapshot here. */
export const currentObjectionMinimumRuleVersion = () => referenceParameter<string>("param.national.objection_minimum.rule_version");
export const currentObjectionMinimumEffectiveFrom = () => referenceParameter<string>("param.national.objection_minimum.effective_from");
function currentSource() {
  return { sourceUrl: referenceParameter<string>("param.national.objection_minimum.source_url"), clause: referenceParameter<string>("param.national.objection_minimum.clause"), sourceText: referenceParameter<string>("param.national.objection_minimum.source_text") };
}

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
  return { status, comparison: null, reason, ...currentSource(), ruleVersion: ruleVersion ?? "unknown", courtApprovalInferred: false };
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
  if (input.ruleVersion !== currentObjectionMinimumRuleVersion() || input.asOf! < currentObjectionMinimumEffectiveFrom()) return unknown("unsupported_version", "인가결정일 기준일과 해당 일자에 적용되는 제614조 판본이 확인되지 않았습니다.", input.ruleVersion);
  if (!input.conditionFactIds.length || !validEvidence(input.claimTotalPresentValue) || !validEvidence(input.planPresentValue)) return unknown("unknown", "이의 여부·인가결정일과 채권 총액 PV·계획 총변제 PV가 각 source-verified·legally-accepted 근거 ID를 가진 별도 집계로 필요합니다. 결손을 0원으로 대체하지 않습니다.", input.ruleVersion);

  const claims = BigInt(input.claimTotalPresentValue.amountWon);
  const proposed = BigInt(input.planPresentValue.amountWon);
  const threshold = BigInt(referenceMoney("param.national.objection_minimum.branch_threshold_won"));
  const low = referenceRatio("param.national.objection_minimum.low_rate"), high = referenceRatio("param.national.objection_minimum.high_rate");
  const lowDenominator = BigInt(low.denominator), highDenominator = BigInt(high.denominator);
  const gcd = (a: bigint, b: bigint): bigint => { while (b !== 0n) { const next = a % b; a = b; b = next; } return a; };
  const denominator = lowDenominator / gcd(lowDenominator, highDenominator) * highDenominator;
  const highAdd = BigInt(referenceMoney("param.national.objection_minimum.high_add_won"));
  let numerator = claims < threshold ? claims * BigInt(low.numerator) * (denominator / lowDenominator) : claims * BigInt(high.numerator) * (denominator / highDenominator) + highAdd * denominator;
  const capNumerator = BigInt(referenceMoney("param.national.objection_minimum.minimum_cap_won")) * denominator;
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
    ...currentSource(), courtApprovalInferred: false,
  };
}
