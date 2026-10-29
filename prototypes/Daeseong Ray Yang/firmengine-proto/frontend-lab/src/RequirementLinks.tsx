import { useEffect, useState } from "react";
import { requirementsFor, type CaseRecord, type DocumentKind, type LabAction, type Role } from "./model";

export interface RequirementLinksProps { current: CaseRecord; role: Role; dispatch: (action: LabAction) => void }
const labels: Record<DocumentKind, string> = { identity: "상담·기본정보", income: "소득·경비", debt: "채무", business: "사업 운영", asset: "재산" };
const fieldStyle = { width: "100%", minWidth: 140, border: "1px solid #dfe4e8", borderRadius: 6, padding: 8 };

function RequirementEditor({ current, role, dispatch }: RequirementLinksProps) {
  const activeDocuments = current.documents.filter(document => document.status !== "withdrawn");
  const [kind, setKind] = useState<DocumentKind>("income");
  const [documentId, setDocumentId] = useState(activeDocuments[0]?.id ?? "");
  const [subject, setSubject] = useState("신청인 · 사건 공통");
  const [period, setPeriod] = useState("");
  const [reason, setReason] = useState("");
  const [storageWarning, setStorageWarning] = useState(false);
  const links = current.requirementLinks ?? [], exemptions = current.requirementExemptions ?? [];
  const requirements = requirementsFor(current), staff = role === "staff";
  useEffect(() => {
    // The reducer's case is authoritative; this is a local mirror, never an override.
    try { localStorage.setItem(`firmengine.lab.requirements.${current.id}`, JSON.stringify({ schema: 1, revision: current.revision, links: current.requirementLinks ?? [], exemptions: current.requirementExemptions ?? [] })); setStorageWarning(false); }
    catch { setStorageWarning(true); }
  }, [current.id, current.revision, current.requirementLinks, current.requirementExemptions]);
  const selectedDocumentActive = activeDocuments.some(document => document.id === documentId);
  const canLink = selectedDocumentActive && !!subject.trim() && !!period.trim() && !!reason.trim();
  const assetKnown = typeof current.fields.find(field => field.key === "assets")?.value === "number";
  const documentName = (id: string) => current.documents.find(document => document.id === id)?.name ?? "삭제되거나 없는 자료";
  return <details className="panel requirement-links" style={{ marginTop: 20, padding: 18 }}>
    <summary style={{ cursor: "pointer", fontWeight: 700 }}>요건별 자료 연결·대체자료·해당 없음 기록 <span style={{ fontWeight: 400 }}>({links.length}개 연결)</span></summary>
    <p>자료 한 개를 여러 요건에 연결할 수 있습니다. 연결은 자료의 대상·기간을 표시하며, 금액·사실을 추가하거나 원문·법적 인정을 대신하지 않습니다.</p>
    {storageWarning && <p role="status">브라우저의 별도 연결 사본을 저장하지 못했습니다. 현재 사건 데이터의 연결은 유지됩니다.</p>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(205px,1fr))", gap: 12 }}>
      {requirements.map(requirement => {
        const exemption = exemptions.find(item => item.kind === requirement.kind);
        const linked = links.filter(item => item.kind === requirement.kind);
        return <section key={requirement.kind} style={{ border: "1px solid #e0e5ea", borderRadius: 8, padding: 12 }}>
          <strong>{labels[requirement.kind]}</strong><p>{requirement.required ? "현재 확인 필요" : "조건상 선택·예외 기록"} · {requirement.status === "confirmed" ? "자료 확인됨" : requirement.status === "uploaded" ? "자료 연결·담당자 확인 대기" : "자료 보완 필요"}</p>
          <p>{requirement.reason}</p><small>{linked.length ? `${linked.length}개 명시 연결 · 대상·기간별로 확인` : "문서 종류에 따른 기본 연결"}</small>
          {exemption && <p><strong>담당자 해당 없음 사유:</strong> {exemption.reason}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            <button className="button secondary" onClick={() => setKind(requirement.kind)}>이 요건에 연결</button>
            {(requirement.kind === "business" || requirement.kind === "asset") && !exemption && <button className="button secondary" disabled={!staff || !reason.trim() || (requirement.kind === "asset" && !assetKnown)} onClick={() => dispatch({ type: "SET_REQUIREMENT_EXEMPT", caseId: current.id, kind: requirement.kind, reason })}>이유로 해당 없음</button>}
            {exemption && <button className="button secondary" disabled={!staff || !reason.trim()} onClick={() => dispatch({ type: "CLEAR_REQUIREMENT_EXEMPT", caseId: current.id, kind: requirement.kind, reason })}>예외 철회</button>}
          </div>
        </section>;
      })}
    </div>
    <fieldset style={{ border: "1px solid #e0e5ea", borderRadius: 8, padding: 14, marginTop: 16 }}><legend>명시적으로 연결하기</legend>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        <label>요건 종류<select aria-label="연결 요건 종류" style={fieldStyle} value={kind} onChange={event => setKind(event.target.value as DocumentKind)}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>현재 자료<select aria-label="요건 연결 자료" style={fieldStyle} value={selectedDocumentActive ? documentId : ""} onChange={event => setDocumentId(event.target.value)}><option value="">자료 선택</option>{activeDocuments.map(document => <option key={document.id} value={document.id}>{document.name}</option>)}</select></label>
        <label>대상·주체<input aria-label="요건 대상 주체" style={fieldStyle} value={subject} onChange={event => setSubject(event.target.value)} placeholder="예: 신청인 사업장 A" /></label>
        <label>대상기간·기준일<input aria-label="요건 대상기간" style={fieldStyle} value={period} onChange={event => setPeriod(event.target.value)} placeholder="예: 2026-01~09, 잔액 기준일" /></label>
      </div>
      <label style={{ display: "block", marginTop: 12 }}>연결·해당 없음·철회 이유<input aria-label="요건 연결 변경 이유" style={{ ...fieldStyle, marginTop: 5 }} value={reason} onChange={event => setReason(event.target.value)} placeholder="원문에서 확인한 대상·기간과 자료를 선택한 이유" /></label>
      <button className="button primary" style={{ marginTop: 12 }} disabled={!canLink} onClick={() => dispatch({ type: "LINK_REQUIREMENT", caseId: current.id, kind, documentId, subject, period, reason })}>요건에 자료 연결</button>
      <p>같은 요건·대상·기간에 여러 자료를 연결하면 대체자료 후보가 됩니다. 서로 다른 대상·기간은 각각 확인해야 합니다. 기본 신원·소득·채무 요건을 해당 없음으로 우회할 수 없습니다.</p>
    </fieldset>
    {links.length > 0 && <div style={{ overflowX: "auto", marginTop: 16 }}><table style={{ width: "100%" }}><thead><tr>{["요건", "주체", "기간", "연결 자료", "상태·대체자료", "선택 이유", "관리"].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{links.map(link => {
      const document = current.documents.find(item => item.id === link.documentId);
      const alternatives = links.filter(item => item.kind === link.kind && item.subject === link.subject && item.period === link.period);
      return <tr key={link.id}><td>{labels[link.kind]}</td><td>{link.subject}</td><td>{link.period}</td><td>{documentName(link.documentId)}</td><td>{document?.status === "confirmed" ? "자료 확인됨" : document?.status === "uploaded" ? "확인 대기" : "연결 자료 제외됨"}{alternatives.length > 1 && <small style={{ display: "block" }}>동일 범위 대체자료 {alternatives.length}개</small>}</td><td>{link.reason}</td><td><button className="button secondary" disabled={!staff || !reason.trim()} onClick={() => dispatch({ type: "UNLINK_REQUIREMENT", caseId: current.id, linkId: link.id, reason })}>이유로 연결 철회</button></td></tr>;
    })}</tbody></table></div>}
    <p>담당자가 명시적으로 확인한 조건부 예외만 반영합니다. 재산금액 미확인은 0원이나 해당 없음이 아닙니다. 연결·예외를 변경하면 이전 초안과 모의 검토는 무효화됩니다.</p>
  </details>;
}

export function RequirementLinks(props: RequirementLinksProps) { return <RequirementEditor key={props.current.id} {...props} />; }
export default RequirementLinks;
