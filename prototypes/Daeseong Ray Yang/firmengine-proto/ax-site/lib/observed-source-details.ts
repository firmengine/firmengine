import { currentFacts, describeStructuredSourceRefs, factHasValidStructuredRefs, factSourceLineageIssues, moneyValue, validSourceRef } from "./domain.ts";
import type { CaseData, CaseReadIndex, Fact } from "./domain.ts";
import { conflictingObservedFactIds } from "./observed-period-collision.ts";

export interface ObservedDetailTable { title: string; headers: string[]; rows: string[][] }

const value = (data: CaseData, fact: Fact) => {
  if (fact.numeric) {
    const normalized = moneyValue(fact.numeric);
    return normalized === null
      ? `${String(fact.numeric.rawValue ?? "[값 없음]")} ${fact.numeric.unit || "[단위 미확인]"} · ${fact.numeric.currency || ""}`.trim()
      : `${normalized}원 (원문: ${String(fact.numeric.rawValue ?? "")} ${fact.numeric.unit || "[단위 미확인]"})`;
  }
  return typeof fact.value === "string" ? fact.value : JSON.stringify(fact.value);
};

function usable(data: CaseData, fact: Fact,index?:CaseReadIndex): boolean {
  const linked = fact.structuredRefs !== undefined ? factHasValidStructuredRefs(data, fact) : fact.refs.length > 0 && fact.refs.every(ref => validSourceRef(data, ref,index));
  return fact.state !== "disputed" && fact.recognition !== "rejected" &&
    linked &&
    !fact.validation.some(item => item.severity === "error" ||
      ["UNCERTAIN_READING", "NORMALIZATION_REVIEW"].includes(item.code)) &&
    !factSourceLineageIssues(data, [fact.id],index).some(issue => issue !== "SOURCE_VERIFICATION_REQUIRED");
}

/** Evidence observations for draft schedules. Values are never upgraded to legal ownership or recognition. */
export function observedSourceDetails(data: CaseData, kinds: string[],index?:CaseReadIndex): ObservedDetailTable {
  const selected = currentFacts(data,index).filter(fact => usable(data, fact,index) &&
    kinds.some(kind => kind === "*" || fact.key.toLowerCase().startsWith(kind.toLowerCase())));
  const conflictingIds = conflictingObservedFactIds(selected, fact => value(data, fact));
  const rows = selected.map(fact => {
    const refs = fact.refs.filter(ref => validSourceRef(data, ref,index))
      .map(ref => `${data.documents.find(doc => doc.id === ref.documentId)?.name ?? ref.documentId}, p.${ref.page}: “${ref.quote}”`).concat(describeStructuredSourceRefs(data,fact)).join(" / ");
    const conflict = conflictingIds.has(fact.id);
    const paragraphSource = fact.key === "statement.text" && fact.logicalId.includes(":paragraph:")
      ? fact.logicalId.split(":paragraph:").at(-1) ?? ""
      : "";
    const ownershipHint = /(?:owner|ownership|tenant|landlord|lessor|lessee|applicant_role|attribution|share)/i.test(fact.key)
      ? "역할·귀속 원문 관측; 신청인 소유·법적 인정 아님"
      : "원문 관측; 법적 인정 아님";
    return [fact.subjectId, fact.key, value(data, fact), paragraphSource || "[해당 없음]", fact.periodStart ?? fact.periodEnd ? `${fact.periodStart ?? "?"} ~ ${fact.periodEnd ?? "?"}` : fact.asOf ?? "[기간·기준일 미확인]",
      fact.state, fact.recognition, conflict ? "상충 · 선택 보류" : ownershipHint, refs];
  });
  return {
    title: "출처 기반 원문 관측 (귀속·법적 인정과 분리)",
    headers: ["대상 ID", "원문 필드", "관측값·단위", "문단 출처 위치", "기간·기준일", "원문 확인 상태", "법적 인정 상태", "해석 상태", "인용"],
    rows,
  };
}
