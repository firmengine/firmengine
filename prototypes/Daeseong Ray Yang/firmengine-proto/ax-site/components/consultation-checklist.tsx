"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, Check, ClipboardList, Copy, FileText, History, Loader2, MessageSquare, Plus, RefreshCw, Sparkles } from "lucide-react";
import type { ConsultationNote, IntakeCatalog, IntakeChecklistView, IntakeRequirement, IntakeState } from "../lib/intake-types";
import { INTAKE_NOTE_MAX_CHARS } from "../lib/intake-types";

const stateLabel: Record<IntakeState, string> = { present: "해당", absent: "비해당", unknown: "미확정", conflict: "충돌", legal_review: "검토 필요" };
const statusLabel: Record<IntakeRequirement["status"], string> = { requested: "준비 안내", qualification_needed: "조건 확인", conflict: "내용 대조", legal_review: "담당자 검토" };
const requirementLabel = { required_when_applicable: "해당 시 필요", recommended: "권장 자료", court_ordered: "법원 명령 확인" };
const temporalLabel = { current: "현재", past: "과거", uncertain: "시점 확인" };

class IntakeRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...init });
  const body = await response.json().catch(() => { throw new IntakeRequestError("서버 응답을 확인하지 못했습니다. 저장 상태를 새로고침해 주세요.", response.status); }) as Record<string, unknown>;
  if (!response.ok) throw new IntakeRequestError(typeof body.error === "string" ? body.error : typeof body.message === "string" ? body.message : `요청을 완료하지 못했습니다. (${response.status})`, response.status);
  return body as T;
}
function displayDate(value: string | null | undefined) {
  if (!value) return "상담일 미기재";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
function inputDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "요청을 완료하지 못했습니다.";
  return error instanceof IntakeRequestError && error.status === 409 ? `${message} 최신 내용을 새로고침한 뒤 다시 실행해 주세요. 작성 중인 상담 내용은 유지됩니다.` : message;
}

export default function ConsultationChecklist({ caseId }: { caseId: string }) {
  const [view, setView] = useState<IntakeChecklistView | null>(null);
  const [catalog, setCatalog] = useState<IntakeCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"" | "save" | "analyze">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [text, setText] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [correction, setCorrection] = useState<ConsultationNote | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const sequence = useRef(0);
  const inFlight = useRef(false);
  const activeCase = useRef(caseId);
  activeCase.current = caseId;
  const endpoint = `/api/cases/${encodeURIComponent(caseId)}/consultations`;

  const refresh = useCallback(async () => {
    const requestId = ++sequence.current;
    setLoading(true); setError("");
    const results = await Promise.allSettled([
      getJson<IntakeChecklistView>(`/api/cases/${encodeURIComponent(caseId)}/consultations`),
      getJson<{ catalog: IntakeCatalog }>("/api/checklist-catalog"),
    ]);
    if (requestId !== sequence.current || activeCase.current !== caseId) return;
    if (results[0].status === "fulfilled") setView(results[0].value);
    else setError(errorMessage(results[0].reason));
    if (results[1].status === "fulfilled") setCatalog(results[1].value.catalog);
    else setNotice("서류 기준의 상세 이름을 불러오지 못했습니다. 새로고침하면 다시 확인합니다.");
    setLoading(false);
  }, [caseId]);

  useEffect(() => {
    setView(null); setCatalog(null); setText(""); setOccurredAt(""); setCorrection(null); setNotice("");
    void refresh();
    return () => { sequence.current++; };
  }, [refresh]);
  useEffect(() => {
    if (!text.trim()) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [text]);

  const superseded = useMemo(() => new Set(view?.notes.map(note => note.supersedesId).filter(Boolean)), [view]);
  const currentNotes = view?.notes.filter(note => !superseded.has(note.id)) ?? [];
  const sourceCatalog = view?.run?.catalogSnapshot ?? catalog;
  const featureNames = useMemo(() => new Map(sourceCatalog?.features.map(feature => [feature.id, feature.label]) ?? []), [sourceCatalog]);
  const sourceMap = useMemo(() => new Map(sourceCatalog?.sources.map(source => [source.id, source]) ?? []), [sourceCatalog]);
  const attemptPending = view?.latestAttempt?.status === "pending" && !!view.latestAttempt.leaseUntil && Date.parse(view.latestAttempt.leaseUntil) > Date.now();
  const result = view?.run?.result;
  const requirements = result?.requirements ?? [];
  const filteredRequirements = requirements.filter(requirement => (statusFilter === "all" || requirement.status === statusFilter) && [requirement.documentName, requirement.subjectLabel, requirement.issuer, ...requirement.reason].join(" ").toLowerCase().includes(query.toLowerCase()));
  const locked = loading || !!busy || !view || view.readOnly;
  const stale = Boolean(view?.run?.stale || (view?.run && view.run.catalogVersion !== view.catalogVersion));

  async function saveNote(event: FormEvent) {
    event.preventDefault();
    if (!view || locked || !text.trim() || inFlight.current) return;
    inFlight.current = true; setBusy("save"); setError(""); setNotice("");
    const operationCase = caseId;
    try {
      const updated = await getJson<IntakeChecklistView>(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "append", expectedConsultationRevision: view.consultationRevision, text: text.trim(), occurredAt: occurredAt ? new Date(`${occurredAt}T00:00:00+09:00`).toISOString() : null, supersedesId: correction?.id ?? null }) });
      if (activeCase.current !== operationCase) return;
      setView(updated); setText(""); setOccurredAt(""); setCorrection(null);
      setNotice("상담이력을 저장했습니다. 서류 안내를 갱신하려면 아래 분류 버튼을 눌러 주세요.");
    } catch (error) { if (activeCase.current === operationCase) setError(errorMessage(error)); }
    finally { inFlight.current = false; if (activeCase.current === operationCase) setBusy(""); }
  }

  async function analyze() {
    if (!view || locked || attemptPending || !currentNotes.length || text.trim() || inFlight.current) return;
    inFlight.current = true; setBusy("analyze"); setError(""); setNotice("");
    const operationCase = caseId;
    try {
      const updated = await getJson<IntakeChecklistView>(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "analyze", expectedConsultationRevision: view.consultationRevision, expectedCaseRevision: view.caseRevision, expectedCatalogVersion: view.catalogVersion }) });
      if (activeCase.current !== operationCase) return;
      setView(updated); setNotice("상담 분류와 필요한 서류 안내를 저장했습니다.");
    } catch (error) { if (activeCase.current === operationCase) setError(errorMessage(error)); }
    finally { inFlight.current = false; if (activeCase.current === operationCase) setBusy(""); }
  }

  async function copyChecklist() {
    if (!view?.run || stale) return;
    const lines = [`${view.caseName} · 상담에 따른 서류 준비 안내`, "상담에서 확인한 내용을 바탕으로 한 1차 안내이며, 추가 상담과 담당자 검토에 따라 달라질 수 있습니다.", ""];
    const staffAuthored = new Set(["applicant_statement", "application_form_input", "plan_funding_statement", ...(catalog?.documents.filter(document => document.ocr?.collectionMode === "generated_or_prior_form").map(document => document.id) ?? [])]);
    for (const item of requirements) {
      // Client-facing clipboard must not request a new court form that staff author.
      if (staffAuthored.has(item.documentTypeId)) continue;
      lines.push(`[${statusLabel[item.status]}] ${item.documentName} — ${item.subjectLabel}`, `대상 기간: ${item.period}`, `발급·준비처: ${item.issuer}`, `요청 이유: ${item.reason.join(" / ")}`);
      if (item.alternatives.length) lines.push(`${item.alternativePolicy === "any_of" ? "대체 가능 자료" : "담당자 확인 후 대체할 자료"}: ${item.alternatives.map(alternative => alternative.name).join(", ")}`);
      lines.push("");
    }
    if (result?.questions.length) lines.push("추가로 확인할 내용", ...result.questions.map(question => `• ${question.question}`));
    try { await navigator.clipboard.writeText(lines.join("\n")); setNotice("의뢰인 안내문을 복사했습니다. 전달 전 대상과 기간을 확인해 주세요."); }
    catch { setError("클립보드에 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해 주세요."); }
  }

  return <div className="ic-root">
    <header className="ic-top"><a href={`/cases/${encodeURIComponent(caseId)}`}><ArrowLeft size={17} />사건 작업공간</a><a className="ic-brand" href="/">Firm Engine<span>.</span></a><a href="/data/checklist"><BookOpen size={16} />서류 안내 기준 <ArrowUpRight size={13} /></a></header>
    <main className="ic-main">
      <div className="ic-heading"><div><p className="ic-eyebrow">CONSULTATION & DOCUMENTS</p><h1>상담 기반 서류 체크리스트<span>.</span></h1><p>상담에서 사건의 특성을 찾고, 해당하는 조건에 맞춰 준비할 서류를 안내합니다.</p></div><button onClick={() => void refresh()} disabled={!!busy || loading}><RefreshCw size={15} className={loading ? "ic-spin" : ""} />새로고침</button></div>
      {view && <div className="ic-case-line"><strong>{view.caseName}</strong><span>상담 기록 {view.consultationRevision}건</span><span>적용 기준 v{view.catalogVersion}</span><a href={`/cases/${encodeURIComponent(caseId)}/documents`}>자료함 열기 <ArrowUpRight size={12} /></a></div>}
      {error && <div className="ic-alert ic-alert-error" role="alert">{error}</div>}
      {notice && <div className="ic-alert ic-alert-info" role="status">{notice}</div>}
      {view?.latestAttempt?.status === "pending" && <div className="ic-alert ic-alert-info" role="status">{attemptPending ? "저장된 상담 분석이 진행 중입니다. 잠시 후 새로고침하면 결과를 확인할 수 있습니다." : "이전 분석의 응답 대기시간이 지났습니다. 저장된 상담으로 다시 실행할 수 있습니다."}</div>}
      {view?.latestAttempt?.status === "failed" && <div className="ic-alert" role="alert">이전 분석을 완료하지 못했습니다. {view.latestAttempt.error} 상담 원문과 이전 완료 결과는 보존되어 있습니다.</div>}
      {view?.readOnly && <div className="ic-alert">이 사건은 보호된 조회 전용 사건입니다. 상담 추가와 분류 실행을 사용할 수 없습니다.</div>}
      {!view ? <div className="ic-empty">{loading ? <Loader2 size={28} className="ic-spin" /> : <MessageSquare size={28} />}<h2>{loading ? "상담이력을 불러오는 중입니다" : "상담이력을 불러오지 못했습니다"}</h2>{!loading && <button onClick={() => void refresh()}>다시 시도</button>}</div> : <>
        <div className="ic-intake-grid">
          <section className="ic-card ic-compose"><div className="ic-section-title"><span className="ic-step">01</span><div><h2>{correction ? "상담 내용 정정" : "상담이력 추가"}</h2><p>의뢰인의 설명을 그대로 남겨 주세요.</p></div><MessageSquare size={20} /></div>
            <form onSubmit={saveNote}>
              {correction && <div className="ic-correction">상담 #{correction.sequence}의 정정 기록입니다. 기존 내용은 이력으로 보존합니다.<button type="button" onClick={() => { setCorrection(null); setText(""); setOccurredAt(""); }} disabled={!!busy}>정정 취소</button></div>}
              <label className="ic-field">상담 내용<textarea rows={8} maxLength={INTAKE_NOTE_MAX_CHARS} required value={text} onChange={event => setText(event.target.value)} disabled={locked} placeholder={"예: 개인사업자로 카페를 운영하고 있습니다. 은행 대출 두 건과 카드 채무가 있고, 본인 명의 차량 한 대는 할부가 남아 있습니다. 가게는 임차 중이며 배우자와 자녀 한 명이 함께 살고 있습니다."} /><small>한 번에 16,000자, 분석할 활성 상담 합계 40,000자까지 저장할 수 있습니다.</small></label>
              <div className="ic-form-bottom"><label className="ic-field">상담일 <span>선택 사항 · 한국 시간</span><input type="date" value={occurredAt} onChange={event => setOccurredAt(event.target.value)} disabled={locked} /></label><button type="submit" className="ic-primary" disabled={locked || !text.trim()}>{busy === "save" ? <Loader2 size={16} className="ic-spin" /> : <Plus size={16} />}{busy === "save" ? "저장 중…" : correction ? "정정 기록 저장" : "상담이력 저장"}</button></div>
            </form><p className="ic-helper">상담 진술의 근거를 남기는 단계입니다. 제출 자료 확인과 법률 검토는 이후에 진행합니다.</p>
          </section>
          <section className="ic-card ic-history"><div className="ic-section-title"><span className="ic-step">02</span><div><h2>저장된 상담이력</h2><p>현재 기록 {currentNotes.length}건 · 전체 이력 {view.notes.length}건</p></div><History size={20} /></div>
            <div className="ic-note-list">{!view.notes.length ? <div className="ic-small-empty"><MessageSquare size={26} /><p>첫 상담이력을 저장하면<br />조건 분류를 시작할 수 있습니다.</p></div> : [...view.notes].reverse().map(note => <article className={`ic-note ${superseded.has(note.id) ? "ic-note-old" : ""}`} key={note.id}><header><strong>상담 #{note.sequence}</strong><span>{superseded.has(note.id) ? "정정 이전 기록" : note.supersedesId ? "정정 기록" : "상담 기록"}</span>{!superseded.has(note.id) && <button disabled={locked} onClick={() => { if (text.trim() && !window.confirm("작성 중인 내용을 정정할 상담 내용으로 바꾸시겠습니까?")) return; setCorrection(note); setText(note.text); setOccurredAt(inputDate(note.occurredAt)); }}>정정</button>}</header><small>{note.occurredAt ? displayDate(note.occurredAt) : "상담일 미기재"} · 저장 {displayDate(note.createdAt)}</small><details><summary>{note.text.slice(0, 110)}{note.text.length > 110 ? "…" : ""}</summary><p>{note.text}</p></details></article>)}</div>
            <div className="ic-analyze"><p>{text.trim() ? "작성 중인 상담을 먼저 저장해 주세요." : !view.apiKeyConfigured ? "기존 모델 연결을 확인한 후 분류를 실행할 수 있습니다." : "저장된 상담 전체를 읽고, 조건별 규칙으로 서류 목록을 만듭니다."}</p><button className="ic-primary" disabled={locked || attemptPending || !currentNotes.length || !!text.trim() || !view.apiKeyConfigured} onClick={() => void analyze()}>{busy === "analyze" ? <Loader2 size={17} className="ic-spin" /> : <Sparkles size={17} />}{busy === "analyze" ? "상담 분류 · 서류 매칭 중…" : view.run ? "다시 분류하고 서류 매칭" : "상담 분류 · 서류 매칭"}</button></div>
          </section>
        </div>
        {view.run && result ? <>
          {stale && <div className="ic-alert ic-stale" role="status"><RefreshCw size={18} /><div><strong>변경된 내용으로 다시 분류해 주세요.</strong><p>아래는 이전 결과입니다. 상담·사건 정보 또는 서류 안내 기준이 변경되었습니다.</p>{view.run.staleReasons?.length ? <small>{view.run.staleReasons.join(" · ")}</small> : null}</div></div>}
          <section className="ic-card ic-results"><div className="ic-section-title"><span className="ic-step">03</span><div><h2>1차 사건 분류</h2><p>여러 특성이 동시에 적용됩니다. 분류 결과에서 상담 근거를 확인할 수 있습니다.</p></div><span className="ic-run-date">{displayDate(view.run.createdAt)}</span></div>
            {result.claims.length ? <div className="ic-claims">{result.claims.map(claim => <details className={`ic-claim ic-state-${claim.state}`} key={claim.id}><summary><span className={`ic-tag ic-state-${claim.state}`}>{stateLabel[claim.state]}</span><strong>{featureNames.get(claim.featureId) ?? claim.featureId}</strong><small>{claim.subjectLabel} · {temporalLabel[claim.temporal]}</small></summary><div className="ic-claim-quotes">{claim.refs.map((ref, index) => <blockquote key={`${ref.noteId}-${index}`}><p>“{ref.quote}”</p><small>상담 #{view.notes.find(note => note.id === ref.noteId)?.sequence ?? "—"} · 의뢰인 진술</small></blockquote>)}</div></details>)}</div> : <p className="ic-helper">확정적으로 분류할 수 있는 진술이 없습니다. 아래 추가 질문을 확인해 주세요.</p>}
            {!!result.warnings.length && <details className="ic-warnings"><summary>분류 시 확인할 사항 {result.warnings.length}건</summary><ul>{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
          </section>
          <section className="ic-card ic-results"><div className="ic-section-title"><span className="ic-step">04</span><div><h2>준비할 서류 <span className="ic-count">{requirements.length}</span></h2><p>서류별 대상과 기간을 구분하고, 확인이 필요한 조건은 별도로 표시합니다.</p></div><button onClick={() => void copyChecklist()} disabled={stale || !!busy || !requirements.length}><Copy size={15} />안내문 복사</button></div>
            <div className="ic-metrics">{Object.entries(statusLabel).map(([key, label]) => <button key={key} className={statusFilter === key ? "active" : ""} onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}><span>{label}</span><strong>{requirements.filter(item => item.status === key).length}</strong></button>)}</div>
            <div className="ic-filter"><label className="ic-field"><span className="ic-visually-hidden">서류 또는 대상 검색</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="서류명, 대상, 발급처 검색" /></label><select aria-label="서류 상태" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">전체 상태</option>{Object.entries(statusLabel).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></div>
            {filteredRequirements.length ? <div className="ic-table-wrap"><table><thead><tr><th>서류 · 준비 상태</th><th>대상 · 기간</th><th>요청 이유 · 상담 근거</th><th>발급처 · 대체 자료</th></tr></thead><tbody>{filteredRequirements.map(item => <tr key={item.id}><td><span className={`ic-tag ic-request-${item.status}`}>{statusLabel[item.status]}</span><strong>{item.documentName}</strong><small>{requirementLabel[item.requirement]}</small>{item.fields.length > 0 && <details><summary>확인할 항목 {item.fields.length}개</summary><ul>{item.fields.map((field, index) => <li key={index}>{field}</li>)}</ul></details>}</td><td><strong>{item.subjectLabel}</strong><p>{item.period}</p></td><td>{item.reason.map((reason, index) => <p key={index}>{reason}</p>)}<details><summary>상담·규칙 근거 보기</summary>{result.claims.filter(claim => item.sourceClaimIds.includes(claim.id)).flatMap(claim => claim.refs).map((ref, index) => <blockquote key={`${ref.noteId}-${index}`}>“{ref.quote}”</blockquote>)}<small>적용 규칙: {item.matchedRuleIds.map(id => sourceCatalog?.rules.find(rule => rule.id === id)?.title ?? id).join(" · ")}</small>{item.sourceIds.map(id => { const source = sourceMap.get(id); return source ? <div className="ic-source" key={id}>{/^https?:\/\//.test(source.url) ? <a href={source.url} target="_blank" rel="noreferrer">{source.title} <ArrowUpRight size={11} /></a> : source.title}<small>{source.locator}</small></div> : null; })}</details></td><td><p>{item.issuer || "담당자와 발급처 확인"}</p>{item.alternatives.length > 0 && <div className="ic-alternatives"><small>{item.alternativePolicy === "any_of" ? "다음 자료 중 하나로 대체 가능" : "대체 가능 여부는 담당자 확인"}</small><ul>{item.alternatives.map(alternative => <li key={alternative.id}>{alternative.name}</li>)}</ul></div>}</td></tr>)}</tbody></table></div> : <div className="ic-small-empty"><FileText size={26} /><p>{requirements.length ? "검색 조건에 맞는 서류가 없습니다." : "현재 상담으로 매칭된 서류가 없습니다. 추가 확인 질문을 검토해 주세요."}</p></div>}
          </section>
          <section className="ic-card ic-results"><div className="ic-section-title"><span className="ic-step">05</span><div><h2>추가로 물어볼 내용 <span className="ic-count">{result.questions.length}</span></h2><p>답변은 새 상담이력으로 저장하고 다시 분류하면 됩니다.</p></div><ClipboardList size={22} /></div><div className="ic-questions">{result.questions.length ? result.questions.map((question, index) => <article key={question.id}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{question.question}</h3><p>{question.reason}</p></div></article>) : <p className="ic-helper"><Check size={15} />현재 분류에서 생성된 추가 질문은 없습니다. 실제 자료의 충족 여부는 별도로 확인합니다.</p>}</div></section>
          <details className="ic-audit"><summary>분류 기록 · 적용 기준</summary><p>상담 버전 {view.run.consultationRevision} · 사건 버전 {view.run.caseRevision} · 서류 기준 v{view.run.catalogVersion} · {view.run.model}</p><p>생성 {displayDate(view.run.createdAt)} · 규칙 엔진 {view.run.engineVersion} · 분류 기준 {view.run.promptVersion}</p><a href="/data/checklist">서류 안내 기준 열기 →</a></details>
        </> : <section className="ic-empty ic-ready"><ClipboardList size={32} /><h2>상담이력에서 서류 준비를 시작하세요</h2><p>상담을 저장한 후 ‘상담 분류 · 서류 매칭’을 실행하면<br />사건 특성, 필요한 서류와 추가 확인 질문이 이곳에 표시됩니다.</p></section>}
      </>}
    </main>
    <style>{styles}</style>
  </div>;
}

const styles = `
.ic-root{min-height:100vh;background:#f4f6f3;color:#233a32;font-family:Inter,"Noto Sans KR",Arial,sans-serif;font-size:14px}.ic-root *{box-sizing:border-box}.ic-root a{color:#286f5d;text-decoration:none}.ic-root button,.ic-root input,.ic-root textarea,.ic-root select{font:inherit}.ic-root button{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid #d5e0d8;border-radius:7px;padding:10px 14px;background:white;color:#345a49;font-size:12px;cursor:pointer}.ic-root button:hover{background:#edf5ee}.ic-root button:disabled{opacity:.5;cursor:not-allowed}.ic-root .ic-primary{background:#215e4f;border-color:#215e4f;color:white}.ic-root .ic-primary:hover{background:#174a3d}.ic-top{height:74px;border-bottom:1px solid #dfe6df;background:white;display:flex;justify-content:space-between;align-items:center;padding:0 38px;gap:16px;font-size:12px}.ic-top a{display:inline-flex;align-items:center;gap:7px}.ic-brand{font-size:21px;font-weight:800;letter-spacing:-.6px;color:#233a32!important}.ic-brand span,.ic-heading h1>span{color:#42886b}.ic-main{max-width:1460px;margin:auto;padding:40px 38px 60px}.ic-heading{display:flex;justify-content:space-between;align-items:center;gap:22px;margin-bottom:24px}.ic-eyebrow{font-size:10px!important;font-weight:800;letter-spacing:.17em;color:#51856c!important;margin:0 0 12px!important}.ic-heading h1{font-size:30px;letter-spacing:-1.2px;margin:0 0 10px}.ic-heading p,.ic-section-title p{font-size:13px;line-height:1.7;color:#78877c;margin:0}.ic-heading>button{flex-shrink:0}.ic-case-line{display:flex;align-items:center;gap:18px;font-size:11px;border-top:1px solid #dce5dd;border-bottom:1px solid #dce5dd;padding:16px 0;margin-bottom:26px;color:#798b7e;flex-wrap:wrap}.ic-case-line strong{font-size:13px;color:#355543}.ic-case-line a{margin-left:auto;display:flex;align-items:center;gap:5px}.ic-alert{margin:0 0 20px;padding:15px 18px;border:1px solid #e9d5b2;background:#fff8eb;border-radius:8px;color:#826027;font-size:12px;line-height:1.8;overflow-wrap:anywhere}.ic-alert-error{background:#fff1ec;border-color:#ebcfc1;color:#97543d}.ic-alert-info{background:#eff7f0;border-color:#d1e4d3;color:#426d4d}.ic-intake-grid{display:grid;grid-template-columns:1.05fr 1fr;gap:22px}.ic-card{background:white;border:1px solid #dce5dd;border-radius:11px;overflow:hidden;box-shadow:0 2px 5px #243c2c02}.ic-section-title{display:flex;align-items:center;gap:13px;padding:24px;border-bottom:1px solid #e7ece5}.ic-section-title h2{font-size:17px;letter-spacing:-.3px;margin:0 0 4px}.ic-section-title>svg{margin-left:auto;flex-shrink:0;color:#6f917e}.ic-section-title>button,.ic-run-date{margin-left:auto;flex-shrink:0}.ic-step{width:31px;height:31px;border-radius:8px;background:#edf4ed;color:#4c7c60;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}.ic-compose form{padding:22px 24px 0}.ic-field{display:block;font-size:12px;font-weight:600;color:#506756}.ic-field>span{font-size:10px;font-weight:400;color:#8a978e}.ic-root input,.ic-root select,.ic-root textarea{border:1px solid #d6e2d7;background:white;border-radius:7px;padding:11px 12px;color:#2b4837;outline-color:#4f8b67}.ic-field input,.ic-field textarea{width:100%;display:block;margin-top:9px}.ic-root textarea{resize:vertical;min-height:120px;font-size:13px;line-height:1.9}.ic-root textarea::placeholder,.ic-root input::placeholder{color:#97a69a}.ic-form-bottom{display:flex;gap:16px;align-items:flex-end;justify-content:space-between;margin:18px 0}.ic-form-bottom .ic-field{max-width:240px}.ic-form-bottom button{min-height:41px}.ic-helper{font-size:11px;color:#7d8b81;line-height:1.9;display:flex;align-items:flex-start;gap:7px}.ic-compose>.ic-helper{padding:0 24px 16px}.ic-correction{padding:12px;background:#f5f7ed;border:1px solid #dde6c9;border-radius:7px;font-size:11px;line-height:1.8;margin-bottom:16px}.ic-correction button{padding:3px 8px;margin-left:8px;font-size:10px}.ic-history{display:flex;flex-direction:column}.ic-note-list{max-height:310px;overflow:auto;padding:6px 22px;flex:1}.ic-note{padding:16px 0;border-bottom:1px solid #e9eee8}.ic-note:last-child{border-bottom:0}.ic-note header{display:flex;align-items:center;gap:10px;font-size:11px}.ic-note header>span{font-size:10px;color:#7b8b7f;background:#f1f5ef;border-radius:4px;padding:3px 5px}.ic-note header button{margin-left:auto;font-size:10px;padding:4px 8px}.ic-note>small{display:block;color:#8b998e;font-size:10px;margin:9px 0}.ic-note details{font-size:12px;line-height:1.9;color:#56705b}.ic-note summary{cursor:pointer;overflow-wrap:anywhere}.ic-note details p{white-space:pre-wrap;margin:12px 0 0;padding:12px;background:#f6f8f3;border-radius:6px;overflow-wrap:anywhere}.ic-note-old{opacity:.65}.ic-analyze{border-top:1px solid #e7eee5;padding:18px 24px}.ic-analyze p{font-size:11px;color:#7e8e80;line-height:1.8;margin:0 0 12px}.ic-analyze button{width:100%;padding:13px}.ic-empty{background:white;border:1px solid #dce5dd;border-radius:11px;padding:50px 24px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px;color:#7f9785}.ic-empty h2{font-size:18px;margin:4px 0;color:#486550}.ic-empty p{font-size:13px;line-height:1.9;margin:0}.ic-ready{margin-top:24px;min-height:230px}.ic-small-empty{padding:28px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;text-align:center;color:#8a9b8d;min-height:170px;font-size:12px;line-height:1.9}.ic-small-empty p{margin:0}.ic-results{margin-top:24px}.ic-stale{margin-top:24px;display:flex;align-items:flex-start;gap:12px}.ic-stale p{margin:4px 0 0}.ic-stale svg{flex-shrink:0;margin-top:3px}.ic-run-date{font-size:10px;color:#94a095}.ic-claims{padding:20px 24px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.ic-claim{border:1px solid #e0e7dc;border-radius:8px;padding:12px;align-self:start}.ic-claim summary{list-style:none;cursor:pointer;display:flex;gap:7px;align-items:center;flex-wrap:wrap}.ic-claim summary::-webkit-details-marker{display:none}.ic-claim summary strong{font-size:12px}.ic-claim summary small{width:100%;color:#849484;font-size:10px;line-height:1.7;margin-left:2px}.ic-tag{display:inline-flex;align-items:center;justify-content:center;font-size:10px;white-space:nowrap;border-radius:4px;padding:4px 6px;background:#eff3ed;color:#6b7e6e;font-weight:600}.ic-tag.ic-state-present,.ic-tag.ic-request-requested{background:#e7f2e8;color:#407548}.ic-tag.ic-state-absent{background:#f0f1ef;color:#8b9589}.ic-tag.ic-state-unknown,.ic-tag.ic-request-qualification_needed{background:#faf1d9;color:#94752d}.ic-tag.ic-state-conflict,.ic-tag.ic-request-conflict{background:#fae8df;color:#a56747}.ic-tag.ic-state-legal_review,.ic-tag.ic-request-legal_review{background:#e9edf7;color:#6376a0}.ic-claim-quotes{border-top:1px solid #e5ebe1;margin-top:11px;padding-top:9px}.ic-root blockquote{margin:7px 0;padding:8px 10px;border-left:2px solid #b9d2b9;background:#f7f9f4;color:#6a806b;font-size:11px;line-height:1.8;overflow-wrap:anywhere}.ic-root blockquote p{margin:0}.ic-root blockquote small{font-size:9px;color:#94a390}.ic-warnings{padding:0 24px 20px;font-size:11px;color:#917c4f;line-height:1.9}.ic-warnings summary{cursor:pointer}.ic-root ul{padding-left:19px;margin:9px 0}.ic-count{font-size:12px;color:#7b977c;font-weight:600;margin-left:6px}.ic-metrics{padding:20px 24px 0;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.ic-metrics button{justify-content:space-between;padding:12px 15px;background:#f7f9f4;border-color:#e4eadf}.ic-metrics button.active{border-color:#86b18b;background:#eef6ec}.ic-metrics span{font-size:11px;color:#829280}.ic-metrics strong{font-size:20px;color:#4f7552}.ic-filter{display:flex;gap:12px;padding:18px 24px}.ic-filter .ic-field{flex:1}.ic-filter input{margin:0;font-weight:400}.ic-filter select{font-size:11px}.ic-table-wrap{overflow:auto}.ic-table-wrap table{min-width:930px;width:100%;border-collapse:collapse;table-layout:fixed}.ic-table-wrap th{text-align:left;background:#f2f6ef;font-size:10px;letter-spacing:.02em;color:#7a907b;font-weight:600;padding:13px 22px}.ic-table-wrap th:nth-child(1){width:23%}.ic-table-wrap th:nth-child(2){width:19%}.ic-table-wrap th:nth-child(3){width:33%}.ic-table-wrap th:nth-child(4){width:25%}.ic-table-wrap td{padding:20px 22px;vertical-align:top;border-top:1px solid #e7ede2;font-size:12px;line-height:1.85;overflow-wrap:anywhere}.ic-table-wrap td>strong{display:block;font-size:12px;color:#375c3e;margin:6px 0 2px}.ic-table-wrap td>small{font-size:10px;color:#8e9d87;display:block}.ic-table-wrap td p{margin:0 0 7px;color:#6f846a;font-size:11px}.ic-table-wrap details{margin-top:10px;font-size:10px;color:#7b9372}.ic-table-wrap summary{cursor:pointer;color:#5f8453}.ic-source{margin-top:9px}.ic-source a{display:inline;line-height:1.8;color:#5e8550}.ic-source svg{display:inline;vertical-align:middle}.ic-source small{display:block;font-size:9px}.ic-alternatives{border-top:1px solid #e6eddf;padding-top:8px;margin-top:10px}.ic-alternatives>small{font-size:10px;color:#8c9977}.ic-alternatives ul{font-size:10px;color:#6d815e}.ic-questions{padding:8px 24px}.ic-questions article{display:flex;gap:15px;padding:17px 0;border-bottom:1px solid #e6eddf}.ic-questions article:last-child{border:0}.ic-questions article>span{font-size:11px;color:#95ad89;font-weight:700;padding-top:2px}.ic-questions h3{font-size:13px;margin:0 0 5px;font-weight:600}.ic-questions p{font-size:11px;color:#85957a;line-height:1.8;margin:0}.ic-questions>.ic-helper{padding:15px 0}.ic-audit{font-size:10px;color:#90a086;line-height:1.9;margin-top:20px}.ic-audit summary{cursor:pointer}.ic-audit p{margin:6px 0}.ic-visually-hidden{position:absolute;clip:rect(0,0,0,0);width:1px;height:1px;overflow:hidden}.ic-spin{animation:ic-spin 1s linear infinite}@keyframes ic-spin{to{transform:rotate(360deg)}}@media(max-width:1050px){.ic-intake-grid{grid-template-columns:1fr}.ic-claims{grid-template-columns:repeat(2,minmax(0,1fr))}.ic-note-list{max-height:300px}.ic-run-date{display:none}}@media(max-width:650px){.ic-top{padding:0 18px;height:64px;font-size:10px}.ic-brand{display:none!important}.ic-main{padding:28px 16px 45px}.ic-heading{align-items:flex-start}.ic-heading h1{font-size:23px}.ic-heading p{font-size:11px}.ic-heading>button{padding:8px;font-size:0;gap:0}.ic-heading>button svg{width:16px}.ic-case-line{gap:10px}.ic-case-line a{margin-left:0}.ic-section-title{padding:19px 16px;gap:10px}.ic-section-title h2{font-size:15px}.ic-section-title p{font-size:11px}.ic-section-title>button{font-size:10px;padding:8px;gap:4px}.ic-compose form{padding:18px 16px 0}.ic-compose>.ic-helper{padding:0 16px 16px}.ic-form-bottom{align-items:stretch;flex-direction:column;gap:12px}.ic-form-bottom .ic-field{max-width:none}.ic-claims{grid-template-columns:1fr;padding:16px}.ic-metrics{grid-template-columns:repeat(2,1fr);padding:16px 16px 0}.ic-filter{padding:16px}.ic-filter select{max-width:110px}.ic-questions{padding:5px 16px}.ic-intake-grid{gap:16px}.ic-results{margin-top:18px}.ic-warnings{padding:0 16px 16px}.ic-analyze{padding:16px}.ic-note-list{padding:5px 16px}}
`;
