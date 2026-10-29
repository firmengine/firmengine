import { referenceParameter, referenceParameterDefinition, referenceRatio } from "./reference-parameters.ts";

/** Compatibility source links; proposal values and links are resolved at use time. */
export const MEDIAN_INCOME_SOURCE_URL = referenceParameterDefinition("param.seoul.living.median_income_source_url").value as string;
export const SEOUL_RULE_405_SOURCE_URL = referenceParameterDefinition("param.seoul.living.practice_source_url").value as string;

export type LivingCostProposal =
  | { status: "proposal"; year: number; jurisdiction: string; claimedHouseholdSize: number; medianIncomeWon: number; base60Percent: { numeratorWon: string; denominator: number; exactDecimalWon: string; rounding: "none specified by source; exact fraction retained" }; needsRecognizedHousehold: true; additionalExpenseWon: string | null; additionalExpenseFactIds: string[]; needsAdditionalExpenseRecognition: true; sources: { title: string; url: string; proposition: string }[]; legalEffect: "draft_proposal_only" }
  | { status: "blocked"; reason: string; sources: { title: string; url: string }[] };

/** Only exact terminating decimals are emitted; never truncate a changed ratio. */
function decimalRatio(numerator: bigint, denominator: bigint): string | null {
  let finite = denominator;
  while (finite % 2n === 0n) finite /= 2n;
  while (finite % 5n === 0n) finite /= 5n;
  if (finite !== 1n) return null;
  const whole = numerator / denominator;
  let remainder = numerator % denominator;
  if (remainder === 0n) return whole.toString();
  let fractional = "";
  while (remainder !== 0n) {
    remainder *= 10n;
    fractional += (remainder / denominator).toString();
    remainder %= denominator;
  }
  return `${whole}.${fractional}`;
}

/** No inferred household size, legal acceptance flag, or extra-cost default. */
export function proposeLivingCost(input: { year: number; jurisdiction: string; claimedHouseholdSize: number | null; additionalExpenseWon?: string | null; additionalExpenseFactIds?: string[] }): LivingCostProposal {
  const medianSource = referenceParameter<string>("param.seoul.living.median_income_source_url");
  const practiceSource = referenceParameter<string>("param.seoul.living.practice_source_url");
  const court = referenceParameter<string>("param.seoul.living.court_id");
  const sources = [
    { title: "보건복지부 연도별 기준중위소득", url: medianSource },
    { title: "서울회생법원 실무준칙 제405호 §§2–4", url: practiceSource },
  ];
  if (input.jurisdiction !== court) return { status: "blocked", reason: "기준정보에 연결된 관할의 생계비 산식만 지원합니다. 다른 관할의 생계비 산식을 추정하지 않습니다.", sources };
  const tables = referenceParameter<Record<string, readonly string[]>>("param.seoul.living.median_income_tables");
  const medians = tables[String(input.year)];
  if (!Array.isArray(medians)) return { status: "blocked", reason: "기준정보에 이관된 중위소득 표의 지원 연도가 아닙니다. 새 표의 출처와 적용일 검토가 필요합니다.", sources };
  const size = input.claimedHouseholdSize;
  if (size === null || !Number.isInteger(size) || size < 1 || size > medians.length) return { status: "blocked", reason: `명시된 가구원 수 1–${medians.length}명이 필요합니다. 신고/인정 수를 추정하지 않습니다.`, sources };
  const rawMedian = medians[size - 1];
  if (typeof rawMedian !== "string" || !/^\d+$/.test(rawMedian) || !Number.isSafeInteger(Number(rawMedian))) return { status: "blocked", reason: "중위소득 기준정보의 정수 원화 금액을 확인해야 합니다.", sources };
  const median = Number(rawMedian), ratio = referenceRatio("param.seoul.living.baseline_ratio");
  const numerator = BigInt(rawMedian) * BigInt(ratio.numerator);
  const exactDecimalWon = decimalRatio(numerator, BigInt(ratio.denominator));
  if (exactDecimalWon === null) return { status: "blocked", reason: "변경된 비율은 현재 서식의 정확 소수 표시를 지원하지 않습니다. 반올림하지 않고 분수·표시 계약 검토를 요청합니다.", sources };
  const additionalExpenseWon = input.additionalExpenseWon && /^\d+$/.test(input.additionalExpenseWon) ? input.additionalExpenseWon : null;
  const percentage = decimalRatio(BigInt(ratio.numerator) * 100n, BigInt(ratio.denominator));
  return {
    status: "proposal", year: input.year, jurisdiction: court, claimedHouseholdSize: size, medianIncomeWon: median,
    base60Percent: { numeratorWon: numerator.toString(), denominator: ratio.denominator, exactDecimalWon, rounding: "none specified by source; exact fraction retained" },
    needsRecognizedHousehold: true,
    additionalExpenseWon, additionalExpenseFactIds: input.additionalExpenseFactIds ?? [], needsAdditionalExpenseRecognition: true,
    sources: [
      { title: "보건복지부 연도별 기준중위소득", url: medianSource, proposition: `${input.year}년 ${size}인가구 기준중위소득 ${median.toLocaleString("ko-KR")}원/월 (기존 구현 이관값; 적용 판본·출처 재검토 필요)` },
      { title: "서울회생법원 실무준칙 제405호 §§2–4", url: practiceSource, proposition: `신청 당시 기준중위소득의 ${percentage}%를 기초로 한 생계비와 합리적인 지속 주거·의료·미성년자 교육비 추가 가능. 추가비용은 별도 법원 인정 필요.` },
    ],
    legalEffect: "draft_proposal_only",
  };
}
