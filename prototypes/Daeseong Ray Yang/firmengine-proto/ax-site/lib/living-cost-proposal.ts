/** Official median-income table and Seoul Rule 405's 60% baseline as a draft proposal. */
export const MEDIAN_INCOME_SOURCE_URL = "https://www.mohw.go.kr/menu.es?mid=a10708010900";
export const SEOUL_RULE_405_SOURCE_URL = "https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2";

const MEDIAN_WON: Record<number, readonly number[]> = {
  2024: [2_228_445, 3_682_609, 4_714_657, 5_729_913, 6_695_735, 7_618_369, 8_514_994],
  2025: [2_392_013, 3_932_658, 5_025_353, 6_097_773, 7_108_192, 8_064_805, 8_988_428],
  2026: [2_564_238, 4_199_292, 5_359_036, 6_494_738, 7_556_719, 8_555_952, 9_515_150],
  2027: [2_736_042, 4_480_645, 5_718_091, 6_929_885, 8_063_019, 9_129_201, 10_152_665],
};

export type LivingCostProposal =
  | { status: "proposal"; year: number; jurisdiction: "seoul"; claimedHouseholdSize: number; medianIncomeWon: number; base60Percent: { numeratorWon: string; denominator: 5; exactDecimalWon: string; rounding: "none specified by source; exact fraction retained" }; needsRecognizedHousehold: true; additionalExpenseWon: string | null; additionalExpenseFactIds: string[]; needsAdditionalExpenseRecognition: true; sources: { title: string; url: string; proposition: string }[]; legalEffect: "draft_proposal_only" }
  | { status: "blocked"; reason: string; sources: { title: string; url: string }[] };

function decimalRatio(numerator: bigint, denominator: bigint): string {
  const whole = numerator / BigInt(denominator);
  const remainder = numerator % BigInt(denominator);
  if (remainder === BigInt(0)) return whole.toString();
  // The only permitted denominator here is 5, so the exact decimal terminates.
  const tenth = remainder * BigInt(10) / BigInt(denominator);
  return `${whole}.${tenth}`;
}

/** No inferred household size, no legal acceptance flag, no extra-cost default. */
export function proposeLivingCost(input: { year: number; jurisdiction: string; claimedHouseholdSize: number | null; additionalExpenseWon?: string | null; additionalExpenseFactIds?: string[] }): LivingCostProposal {
  const sources = [
    { title: "보건복지부 연도별 기준중위소득", url: MEDIAN_INCOME_SOURCE_URL },
    { title: "서울회생법원 실무준칙 제405호 §§2–4", url: SEOUL_RULE_405_SOURCE_URL },
  ];
  if (input.jurisdiction !== "seoul") return { status: "blocked", reason: "서울회생법원 제405호 기준만 연결되어 있습니다. 다른 관할의 생계비 산식을 추정하지 않습니다.", sources };
  const medians = MEDIAN_WON[input.year];
  if (!medians) return { status: "blocked", reason: "공식 중위소득 표가 확인된 연도(2024–2027)가 아닙니다.", sources };
  const size = input.claimedHouseholdSize;
  if (size === null || !Number.isInteger(size) || size < 1 || size > 7) return { status: "blocked", reason: "명시된 가구원 수 1–7명이 필요합니다. 신고/인정 수를 추정하지 않습니다.", sources };
  const median = medians[size - 1];
  const numerator = BigInt(median) * BigInt(3);
  const additionalExpenseWon = input.additionalExpenseWon && /^\d+$/.test(input.additionalExpenseWon) ? input.additionalExpenseWon : null;
  return {
    status: "proposal", year: input.year, jurisdiction: "seoul", claimedHouseholdSize: size, medianIncomeWon: median,
    base60Percent: { numeratorWon: numerator.toString(), denominator: 5, exactDecimalWon: decimalRatio(numerator, BigInt(5)), rounding: "none specified by source; exact fraction retained" },
    needsRecognizedHousehold: true,
    additionalExpenseWon, additionalExpenseFactIds: input.additionalExpenseFactIds ?? [], needsAdditionalExpenseRecognition: true,
    sources: [
      { title: "보건복지부 연도별 기준중위소득", url: MEDIAN_INCOME_SOURCE_URL, proposition: `${input.year}년 ${size}인가구 기준중위소득 ${median.toLocaleString("ko-KR")}원/월` },
      { title: "서울회생법원 실무준칙 제405호 §§2–4", url: SEOUL_RULE_405_SOURCE_URL, proposition: "신청 당시 기준중위소득의 60%를 기초로 한 생계비와 합리적인 지속 주거·의료·미성년자 교육비 추가 가능. 추가비용은 별도 법원 인정 필요." },
    ],
    legalEffect: "draft_proposal_only",
  };
}
