"use client";
import { useState } from "react";
import type { CaseData } from "../lib/domain";
import contracts from "../lib/field-applicability-contracts.json";
import type { FieldObservation, SourceState, VerificationState } from "../lib/field-observation";

const stateLabels: Record<SourceState, string> = { present: "값 기재", blank: "원문 빈칸", masked: "마스킹", illegible: "판독 불가", not_seen: "관찰되지 않음", conflicting: "상충", explicit_none: "원문에 없음 명시", unknown: "상태 미확정" };
const verificationLabels: Record<VerificationState, string> = { unverified: "대조 전", supported: "원문 대조 일치", corrected: "재판독 교정 일치", wrong_field: "다른 항목으로 오추출", unreadable: "대조 판독 불가", conflicting: "대조 결과 상충", value_mismatch: "값·단위 불일치", unclear: "의미 확인 필요", missing_check: "검증 응답 누락" };
const extractionIssues = new Set<VerificationState>(["wrong_field", "value_mismatch", "conflicting", "missing_check", "unclear"]);
const families = contracts.families as Record<string, {caseCondition: string; sourceAvailability: string; fields: {id: string; sourceCondition: string; subjectRole: string; temporalRole: string}[]}>;
export function FieldCoveragePanel({ data }: {data: CaseData}) {
  const [filter, setFilter] = useState("all");
  const pages = data.pages.filter(p => p.fieldCoverage && p.role === "evidence" && data.documents.some(d => d.id === p.documentId && d.status === "active" && d.sha256 === p.fieldCoverage!.sourceSha256));
  if (!pages.length) return null;
  const rows = pages.flatMap(p => p.fieldCoverage!.observations.map((observation, index) => ({observation, index, page: p.page, documentId: p.documentId})));
  const shown = rows.filter(r => filter === "all" || filter === "missing" && r.observation.origin === "catalog_gap" || filter === "source" && r.observation.origin === "source_read" && r.observation.sourceState !== "present" || filter === "applicability" && r.observation.applicability.sourceClaim !== "unknown" || filter === "verification" && extractionIssues.has(r.observation.verificationState));
  const hint = (o: FieldObservation) => o.supersededByHumanFactId ? "수동 정정 이전의 기계 판독 기록입니다. 현재 값은 추출 원장의 최신 수동 버전을 확인하세요." : o.origin === "catalog_gap" ? "현재 출력에 없음. 원문 미기재인지 추출 누락인지는 아직 확인되지 않았습니다." : o.sourceState === "blank" ? "빈칸을 확인한 원문 주장입니다. 비대상·0원으로 처리하지 않습니다." : o.sourceState === "masked" || o.sourceState === "illegible" ? "대상 여부와 별개로 원문 가독성을 확인해야 합니다." : o.sourceState === "conflicting" ? "값이 상충합니다. 원문 대조가 필요합니다." : "기계가 읽은 원문 주장입니다. 사건 적용 여부는 별도 검토합니다.";
  return <details className="panel" style={{marginTop: 16, padding: 16}}>
    <summary style={{cursor: "pointer", fontWeight: 600}}>피처 기재 상태 · 적용 근거 ({rows.length}개)</summary>
    <p style={{margin: "12px 0"}}>관찰되지 않은 항목을 비대상이나 OCR 오류로 단정하지 않습니다. 원문 기재 상태와 사건 적용 여부를 따로 확인하세요.</p>
    <label>표시 범위 <select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">전체</option><option value="missing">출력에 없는 피처</option><option value="verification">오추출·불일치·검증 누락</option><option value="source">빈칸·가림·불확실한 원문</option><option value="applicability">원문의 적용·비해당 주장</option></select></label>
    <div style={{maxHeight: 500, overflow: "auto", marginTop: 12}}><table style={{width: "100%", textAlign: "left"}}><thead><tr><th>문서·페이지</th><th>피처</th><th>기재 상태</th><th>원문 대조</th><th>적용 여부</th><th>조건·확인사항</th></tr></thead><tbody>
      {shown.map(({observation: o, index, page, documentId}) => {
        const family = o.familyId ? families[o.familyId] : undefined;
        const definition = family?.fields.find(f => f.id === o.canonicalFieldId);
        return <tr key={`${documentId}:${page}:${index}`}><td>{data.documents.find(d => d.id === documentId)?.name}<br/>{page}쪽</td><td>{o.label}<br/><small>{o.rawValue ?? "값 없음"}</small></td><td>{stateLabels[o.sourceState]}<br/><small>{o.supersededByHumanFactId ? "수동 정정 이전 판독" : o.origin === "catalog_gap" ? "목록 대비 미관찰" : "원문 판독 주장"}</small></td><td>{verificationLabels[o.verificationState] ?? "대조 전"}<br/><small>{o.sourceState === "explicit_none" ? "없음 문구에 대한 대조 · 값 추출 아님" : o.rawValue === null || o.sourceState === "blank" || o.sourceState === "masked" || o.sourceState === "illegible" ? "기재·가독 상태에 대한 대조" : "값·의미에 대한 기계 대조"}</small>{!o.bbox && o.origin === "source_read" && <small style={{display:"block"}}>근거 좌표 확인 필요</small>}</td><td>{o.applicability.sourceClaim === "not_applicable" ? "원문에 비해당 주장" : o.applicability.sourceClaim === "applicable" ? "원문에 적용 주장" : "미확정"}<br/><small>사건 적용: 검토 전</small></td><td><details><summary>조건·근거 보기</summary><p>{hint(o)}</p><p>필드 의미: {definition?.sourceCondition ?? "식별자 연결 확인 필요"}</p><p>대상 조건: {family?.caseCondition ?? "문서 유형 확인 필요"}</p><p>주체·시점: {definition?.subjectRole ?? "미확정"} / {definition?.temporalRole ?? "미확정"}</p>{o.quote && <blockquote>{o.quote}</blockquote>}{o.applicability.quote && <p>적용 주장 근거: {o.applicability.quote}</p>}</details></td></tr>;
      })}
    </tbody></table></div>
  </details>;
}
