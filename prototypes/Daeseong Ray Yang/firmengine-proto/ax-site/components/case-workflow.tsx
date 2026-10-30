"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, FileCheck2, FileText, Loader2, RefreshCw, ShieldCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CaseCommand, CommandType } from "@/lib/case-command-contract";
import CaseReviewActions, { type ReviewArtifact,type ReviewFieldBase,type CurrentLegalRun } from "./case-review-actions";
import type { CaseWorkflowState } from "@/lib/case-workflow-state";
import type { WorkflowHealth } from "@/lib/workflow-health";
import SubstitutionReviewForm, {type SubstitutionProofCandidate} from "./substitution-review-form";
import type { SubstitutionView } from "@/lib/document-substitution";

type RequirementState = { requirementId: string; engineFulfillment: string; staffDisposition: string; requirementStatus: string; substitution?:SubstitutionView };
type WorkflowResponse = {
  caseId: string; revision: number; stateFingerprint: string; workflow: CaseWorkflowState;
  requirementStates: RequirementState[]; intake: { runId: string; stale: boolean } | null; proofCandidates?:SubstitutionProofCandidate[];
  documents: { id: string; name: string; sha256: string; pages: number[]; status: string }[];
  entities: { id: string; label: string; kind: string }[]; formFields: { token: string; kind: string }[];
  tasks: { items: CaseWorkflowState["tasks"]; count: number; byStatus: Record<string, number> };
  roles: string[]; recomputeJobs: unknown[]; planReconciliation?: { status?: string; issues?: unknown[] } | null;
  artifacts:ReviewArtifact[];fieldBases:ReviewFieldBase[];legalRuns:CurrentLegalRun[];
  diagnostics: Record<string, unknown>;
  health?:WorkflowHealth;
  legalAutomation?:{
    status:string;completedChecks?:number;expectedChecks?:number;currentDataVersion?:number|null;lastError?:string|null;updatedAt?:string|null;
    outcome?:{summary?:string;blockers?:string[];counts?:Record<string,number>;findings?:{id:string;status:string;reason:string;nextAction:string;missingDocuments:string[]}[];drafts?:{id:string;name:string;kind:string}[];reviewPending?:boolean;humanReviewRequired?:boolean;pendingCourtPolicyChanges?:number;};
  };
};
type CommandDraft = Omit<CaseCommand, "commandId" | "payloadVersion" | "expectedRevision" | "expectedStateFingerprint">;
type Notice = { kind: "error" | "success" | "info"; text: string };
type MigrationPreview={planId:string;sourceSha256:string;migrationVersion:string;mode:string;stateFingerprint:string;changedFields:string[];error?:string};
const FORM_LABELS: Record<string, string> = { applicant_name: "신청인 성명", monthly_income: "월 소득", creditor_name: "채권자", creditor_principal: "채권 원금", bank_balance: "예금 잔액", housing_deposit: "주거 보증금", monthly_payment: "월 변제액", liquidation_value: "청산가치", repayment_months: "변제 기간" };
const STATUS: Record<string, string> = { case_editor: "사건 담당", caseworker_review: "담당자 검토", lawyer_review: "변호사 검토", incomes: "소득", debts: "채무", assets: "재산", transactions: "거래", household: "가구", missing: "자료 필요", partial: "일부 확인", complete: "자료 확인됨", conflict: "상충 확인", mapping_required: "연결 방식 검토", stale: "다시 확인 필요", eligible_for_confirmation: "담당자 확인 필요", satisfied: "확인 완료", legal_review: "법률 검토 필요", qualification_needed: "적용 범위 확인", not_applicable_confirmed: "해당 없음 확인", waived_by_review: "검토 후 제외", retired: "종료", unreviewed: "미검토", confirmed: "확인됨", rejected: "반려", candidate: "연결 후보", accepted: "연결됨", proposed: "검토 대기", open: "열림", in_progress: "진행 중", waiting: "대기", resolved: "완료", dismissed: "취소" };
const label = (value: string | null | undefined) => value ? (STATUS[value] ?? value.replaceAll("_", " ")) : "미지정";
const commaList = (value: string) => value.split(/[\n,]/).map(item => item.trim()).filter(Boolean);
function Panel({ title, icon: Icon, children, action }: { title: string; icon: LucideIcon; children: ReactNode; action?: ReactNode }) {
  return <section className="panel"><div className="panel-heading"><div className="panel-title"><Icon size={17} /><h2>{title}</h2></div>{action}</div><div className="workflow-panel-body">{children}</div></section>;
}
function FormField({ label: title, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{title}</span>{children}{hint && <small>{hint}</small>}</label>;
}
function ReasonField() {
  return <FormField label="변경 이유"><textarea name="reason" required maxLength={4000} placeholder="확인한 내용과 변경 이유를 적어 주세요." /></FormField>;
}
function RequirementMappingForm({requirement,busy,onSubmit}:{requirement:CaseWorkflowState["requirements"][number];busy:boolean;onSubmit:(event:FormEvent<HTMLFormElement>)=>void}) {
  if(!requirement.crosswalkId||!requirement.crosswalkVersion||!requirement.familyId)return <p className="workflow-caution">현재 교차표 계약을 확인할 수 없어 이 항목의 매핑 검토를 열 수 없습니다. 기준 카탈로그를 확인해 주세요.</p>;
  return <details className="workflow-details"><summary>항목 연결 기준 검토</summary><form className="workflow-form" onSubmit={onSubmit}>
    <p className="workflow-muted">계약에 등록된 필드만 선택할 수 있습니다. 선택한 각 필드는 모두 필요한 항목으로 취급합니다. 계산 데이터에 반영하지 않는 항목은 원문 확인 전용(source_only)으로 기록합니다.</p>
    <div className="workflow-map-fields">{requirement.availableFieldIds.map(fieldId=><label key={fieldId}><input type="checkbox" name="requiredFieldId" value={fieldId} /> <span>{fieldId}</span></label>)}</div>
    <label className="workflow-map-no-fields"><input type="checkbox" name="noRequiredFields" value="yes" /> 검토 결과 필수 항목 없음</label>
    <p className="workflow-muted">선택된 필드는 사건 데이터에 자동 반영되지 않습니다. 현재 검토 기록은 원문 확인 전용으로 연결합니다.</p>
    <input type="hidden" name="expectedCrosswalkId" value={requirement.crosswalkId} /><input type="hidden" name="expectedCrosswalkVersion" value={requirement.crosswalkVersion} />
    <ReasonField /><Submit busy={busy}>매핑 검토 기록</Submit>
  </form></details>;
}
function Submit({ busy, children = "기록 저장" }: { busy: boolean; children?: ReactNode }) {
  return <button className="button button-primary" type="submit" disabled={busy}>{busy ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />}{children}</button>;
}

export default function CaseWorkflow({ caseId }: { caseId: string }) {
  const [data, setData] = useState<WorkflowResponse | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState<Notice | null>(null);
  const [pendingCommand, setPendingCommand] = useState<CaseCommand | null>(null);
  const pendingRef = useRef<CaseCommand | null>(null);
  const [procedureOpen, setProcedureOpen] = useState(false);
  const [migrationPreview,setMigrationPreview]=useState<MigrationPreview|null>(null);
  const updatePending = (command: CaseCommand | null) => { pendingRef.current = command; setPendingCommand(command); };
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/workflow`, { credentials: "same-origin", cache: "no-store" });
      const body = await response.json().catch(() => ({})) as WorkflowResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || "사건 업무 흐름을 불러오지 못했습니다.");
      setData(body); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "사건 업무 흐름을 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }, [caseId]);
  useEffect(() => { void load(); }, [load]);
  // Only the lightweight derived status is polled. No model or calculation call
  // is started by opening this view or leaving the screen visible.
  useEffect(()=>{
    let mounted=true;
    const refresh=async()=>{
      if(typeof document!=="undefined"&&document.hidden)return;
      try{
        const response=await fetch("/api/cases/"+encodeURIComponent(caseId)+"/data?view=automation",
          {credentials:"same-origin",cache:"no-store"});
        if(!response.ok)return;
        const result=await response.json() as NonNullable<WorkflowResponse["legalAutomation"]>&{currentRevision?:number};
        if(!mounted)return;
        if(result.currentRevision!==undefined&&data?.revision!==undefined&&result.currentRevision!==data.revision){
          void load();return;
        }
        setData(previous=>previous?{...previous,legalAutomation:result}:previous);
      }catch{/* Network failure never mutates the legal review. */}
    };
    const timer=setInterval(()=>void refresh(),30_000);
    return ()=>{mounted=false;clearInterval(timer);};
  },[caseId,load,data?.revision]);

  const send = async (draft: CommandDraft, retry = false) => {
    if (!data || busy) return;
    if (!retry && pendingRef.current) { setError("저장 결과가 확인되지 않은 명령이 있습니다. 먼저 같은 명령을 재시도해 주세요."); return; }
    let command = retry ? pendingRef.current : null;
    if (!command) {
      command = { ...draft, commandId: crypto.randomUUID(), payloadVersion: 1, expectedRevision: data.revision, expectedStateFingerprint: data.stateFingerprint };
      updatePending(command);
    }
    setBusy(true); setNotice(null); setError("");
    try {
      const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/commands`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) });
      const body = await response.json().catch(() => ({})) as { error?: string; message?: string; receipt?: unknown };
      if (!response.ok) {
        const message = body.error || body.message || `요청을 저장하지 못했습니다. (${response.status})`;
        if (response.status < 500) {
          updatePending(null);
          await load();
          setError(message);
          setNotice({ kind: "error", text: "서버가 명령을 반영하지 않았습니다. 최신 상태를 불러왔으니 내용을 확인해 주세요." });
          return;
        }
        throw new Error(message);
      }
      updatePending(null);
      const receipt = body.receipt && typeof body.receipt === "object" ? body.receipt as Record<string, unknown> : null;
      const receiptStatus = typeof receipt?.status === "string" ? label(receipt.status) : body.receipt ? "기록 접수됨" : "응답 확인됨";
      const replayed = receipt?.replayed === true ? " · 기존 처리 결과" : "";
      setNotice({ kind: "success", text: `서버 기록 ${receiptStatus}${replayed}. 최신 상태를 다시 불러옵니다.` });
      try { await load(); } catch { /* load owns its visible error state */ }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "저장 결과를 확인하지 못했습니다.");
      setNotice({ kind: "error", text: "저장 결과가 불분명할 수 있습니다. 상태를 새로고침하거나 같은 명령을 다시 시도해 주세요." });
    } finally { setBusy(false); }
  };

  const command = (commandType: CommandType, target: Record<string, unknown>, patch: Record<string, unknown>, reason: string): CommandDraft => ({ commandType, target, patch, reason });
  const submit = (fn: (form: FormData) => CommandDraft) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const draft = fn(new FormData(event.currentTarget));
      const patch = draft.patch;
      if (draft.commandType === "subject.link" && patch.operation === "confirm" && (!String(patch.typedEntityId ?? "").trim() || !Array.isArray(patch.evidenceRefs) || patch.evidenceRefs.length === 0)) throw new Error("연결을 확인하려면 사건 항목과 근거 식별자를 지정하세요.");
      if (draft.commandType === "requirement.override") {
        if (patch.operation === "change_period" && !String(patch.period ?? "").trim()) throw new Error("기간 변경에는 요청 기간이 필요합니다.");
        if (patch.operation === "change_subject" && !String(patch.subjectLinkId ?? "").trim()) throw new Error("대상 변경에는 연결할 대상을 지정하세요.");
        if (patch.operation === "select_alternative" && !String(patch.alternativeId ?? "").trim()) throw new Error("대체 자료를 선택하세요.");
        if (["waive_with_reason", "declare_not_applicable"].includes(String(patch.operation)) && (!Array.isArray(patch.basisRefs) || patch.basisRefs.length === 0)) throw new Error("요청을 면제하거나 해당 없음으로 기록하려면 검토 근거를 지정하세요.");
        if (patch.operation === "review_mapping") { const mapping=patch.mappingReview as {requiredFieldGroups?:string[][];noRequiredFields?:boolean}|undefined;if(!mapping||(!mapping.noRequiredFields&&!mapping.requiredFieldGroups?.length)||mapping.noRequiredFields&&mapping.requiredFieldGroups?.length)throw new Error("필수 필드를 하나 이상 선택하거나 필수 항목이 없음을 명시하세요."); }
      }
      if (draft.commandType === "document.match") {
        const op = String(patch.operation);
        if (["suggest", "relink"].includes(op) && (!String(patch.subjectLinkId ?? "").trim() || !String(patch.documentId ?? "").trim() || !Array.isArray(patch.pageIds) || patch.pageIds.length === 0)) throw new Error("자료 연결에는 대상, 보관 자료와 페이지를 지정하세요.");
        if (["accept", "reject", "unlink", "relink"].includes(op) && (!String(draft.target.matchId ?? "").trim() || !Number.isSafeInteger(patch.expectedMatchVersion))) throw new Error("기존 자료 연결과 판본을 선택하세요.");
        if (!!(patch.coveredPeriod as { start?: string } | undefined)?.start !== !!(patch.coveredPeriod as { end?: string } | undefined)?.end) throw new Error("기간 범위를 기록하려면 시작일과 종료일을 모두 입력하세요.");
      }
      if (draft.commandType === "procedure.record" && ["submitted", "received", "correction_requested", "amended", "approved", "discontinued", "discharged"].includes(String(patch.state)) && (!String(patch.courtReference ?? "").trim() || !Array.isArray(patch.sourceDocumentIds) || patch.sourceDocumentIds.length === 0)) throw new Error("법원 절차 상태에는 사건 번호와 근거 문서를 지정해야 합니다.");
      void send(draft);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "입력 내용을 확인해 주세요.";
      setError(message); setNotice({ kind: "error", text: message });
    }
  };
  const requirementStates = useMemo(() => new Map((data?.requirementStates ?? []).map(item => [item.requirementId, item])), [data]);
  const allRequirements = data?.workflow.requirements ?? [];
  const groups = allRequirements.filter(req=>requirementStates.get(req.requirementId)?.substitution?.activeRequest!==false);
  const suppressedRequirements = allRequirements.filter(req=>requirementStates.get(req.requirementId)?.substitution?.activeRequest===false);
  const links = data?.workflow.subjectLinks ?? [];
  const matches = data?.workflow.documentMatches ?? [];
  const documents = data?.documents ?? [];
  const entities = data?.entities ?? [];
  const input = (name: string, type = "text", required = false, value?: string, placeholder?: string) => <input name={name} type={type} required={required} defaultValue={value} placeholder={placeholder} />;
  const option = (value: string, title: string): [string, string] => [value, title];
  const select = (name: string, options: [string, string][], required = true) => <select name={name} required={required} defaultValue="">{!required && <option value="">선택 안 함</option>}<option value="" disabled>선택하세요</option>{options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>;
  const reason = (form: FormData) => String(form.get("reason") ?? "").trim();

  return <main className="workflow-page page-content">
    <div className="page-heading"><div><div className="eyebrow">CASE WORKFLOW</div><h1>사건 업무 흐름<span className="heading-dot">.</span></h1><p>상담에서 자료 요청, 근거 확인, 담당자 작업과 절차 기록까지 이어서 관리합니다.</p></div><div className="heading-actions"><a className="button button-outline" href={`/cases/${encodeURIComponent(caseId)}`}><ArrowLeft size={15} />사건으로</a><button className="button button-outline" onClick={() => void load()} disabled={loading || busy}><RefreshCw size={15} />새로고침</button></div></div>
    {error && <div className="workflow-alert" role="alert"><AlertCircle size={16} />{error}</div>}
    {notice && <div className={`workflow-alert ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.kind === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}{notice.text}</div>}
    {pendingCommand && <div className="workflow-pending" role="status"><div><strong>저장 결과 확인 중</strong><p>연결이 끊겨 결과를 받지 못했습니다. 같은 명령 식별자를 사용해 재시도합니다.</p></div><button className="button button-outline" onClick={() => void send({ commandType: pendingCommand.commandType, target: pendingCommand.target, patch: pendingCommand.patch, reason: pendingCommand.reason }, true)} disabled={busy}><RefreshCw size={14} />같은 명령 재시도</button></div>}
    {loading && !data ? <section className="panel"><div className="workflow-panel-body"><Loader2 className="spin" size={20} /> 불러오는 중</div></section> : data && <>
      <div className="workflow-summary"><div className="workflow-summary-card"><span>사건 판본</span><strong>{data.revision}</strong></div><div className="workflow-summary-card"><span>요청 자료</span><strong>{groups.length}</strong></div><div className="workflow-summary-card"><span>담당 작업</span><strong>{data.tasks.count}</strong></div><div className="workflow-summary-card"><span>절차 기록</span><strong>{data.workflow.procedureEvents.length}</strong></div><div className="workflow-summary-card"><span>현재 참여 권한</span><strong>{data.roles.length ? data.roles.map(label).join(" · ") : "확인 중"}</strong></div></div>
      <Panel title="상담 결과 연결" icon={Users}>
        {data.intake ? <div className="workflow-intake"><div><strong>{data.intake.stale ? "새 상담 결과가 있습니다" : "연결 가능한 상담 결과"}</strong><p>{data.intake.stale ? "기존 업무 요청과 비교가 필요합니다." : "결과를 업무 요청으로 반영할 수 있습니다."}</p></div><form onSubmit={submit(form => command("intake.adopt", { runId: data.intake!.runId }, {}, reason(form)))}><ReasonField /><Submit busy={busy}>상담 결과 연결</Submit></form></div> : <p className="workflow-muted">연결할 상담 결과가 없습니다. 상담 · 서류 안내에서 먼저 상담을 완료해 주세요.</p>}
      </Panel>
      <Panel title="사람과 사건 항목 연결" icon={Users}>
        {!links.length ? <p className="workflow-muted">연결 검토가 필요한 사람이 없습니다. 새 상담 결과를 연결하면 후보가 나타납니다.</p> : <div className="workflow-list">{links.map(link => <article className="workflow-card" key={link.linkId}><div className="workflow-card-head"><div><strong>{link.subjectScope === "case" ? "사건 전체 연결" : `상담 대상 ${links.indexOf(link) + 1} 연결 검토`}</strong><p>{link.subjectScope === "case" ? "사건 범위" : "연결 후보"}</p></div><span className="badge badge-neutral">{label(link.status)}</span></div>{link.status === "candidate" ? <form className="workflow-form" onSubmit={submit(form => command("subject.link", { linkId: link.linkId }, { operation: String(form.get("operation")), typedEntityId: String(form.get("typedEntityId") ?? ""), expectedVersion: link.version, evidenceRefs: commaList(String(form.get("evidenceRefs") ?? "")) }, reason(form)))}><div className="form-grid"><FormField label="연결할 사건 항목">{select("typedEntityId", entities.map(item => option(item.id, `${item.label} · ${label(item.kind)}`)), false)}</FormField><FormField label="처리">{select("operation", [["confirm", "연결 확인"], ["reject", "후보 제외"]])}</FormField><FormField label="근거 식별자" hint="연결을 확인할 때 근거 문서나 사건 자료를 입력하세요.">{input("evidenceRefs", "text", false, undefined, "문서 ID, 사실 ID")}</FormField></div><ReasonField /><Submit busy={busy}>연결 검토 저장</Submit></form> : <p className="workflow-muted">{link.typedEntityId ? `연결 항목: ${entities.find(item => item.id === link.typedEntityId)?.label ?? link.typedEntityId}` : "사건 항목과 연결되지 않았습니다."}{link.basisRefs.length ? ` · 근거 ${link.basisRefs.join(", ")}` : ""}</p>}</article>)}</div>}
      </Panel>
      <Panel title="요청 자료와 이행 상태" icon={FileCheck2}>
        {!groups.length ? <p className="workflow-muted">아직 생성된 자료 요청이 없습니다. 상담 결과를 연결하거나 검토 후 추가해 주세요.</p> : <div className="workflow-list">{groups.map(req => { const state = requirementStates.get(req.requirementId) ?? { engineFulfillment: "missing", staffDisposition: "unreviewed", requirementStatus: "missing" }; const reqMatches = matches.filter(item => item.requirementId === req.requirementId); return <article className="workflow-card" key={req.requirementId}><div className="workflow-card-head"><div><strong>{label(req.requirement)} 요청 자료</strong><p>{req.requiredPeriod}</p></div><span className="badge badge-amber">{label(state.requirementStatus)}</span></div><div className="workflow-state-row"><span>자동 점검: {label(state.engineFulfillment)}</span><span>담당자 확인: {label(state.staffDisposition)}</span><span>연결 문서: {reqMatches.length}</span></div>{req.mappingRequired && <p className="workflow-caution">자료 유형과 필수 항목의 연결 기준을 확인해야 합니다.</p>}
        <details className="workflow-details"><summary>자료 요청 조정</summary><form className="workflow-form" onSubmit={submit(form => command("requirement.override", { requirementId: req.requirementId }, { operation: String(form.get("operation")), ...(form.get("period") ? { period: String(form.get("period")) } : {}), ...(form.get("subjectLinkId") ? { subjectLinkId: String(form.get("subjectLinkId")) } : {}), ...(form.get("alternativeId") ? { alternativeId: String(form.get("alternativeId")) } : {}), basisRefs: commaList(String(form.get("basisRefs") ?? "")) }, reason(form)))}><div className="form-grid"><FormField label="조정 유형">{select("operation", [["automatic", "기준 자동 적용"], ["add_manual", "요청 추가"], ["change_period", "기간 변경"], ["change_subject", "대상 변경"], ["select_alternative", "대체 자료 선택"], ["waive_with_reason", "사유와 근거로 면제 요청"], ["declare_not_applicable", "해당 없음 검토"], ["reopen", "다시 열기"], ["retire", "요청 종료"]])}</FormField><FormField label="요청 기간">{input("period", "text", false, req.requiredPeriod, "예: 2026-01 ~ 2026-03")}</FormField><FormField label="대상 연결">{select("subjectLinkId", links.map(item => option(item.linkId, item.subjectScope === "case" ? "사건 전체" : `상담 대상 ${links.indexOf(item) + 1}`)), false)}</FormField><FormField label="대체 자료">{select("alternativeId", req.alternatives.map((item, index) => option(item.id, item.name || `대체 자료 ${index + 1}`)), false)}</FormField><FormField label="근거 식별자">{input("basisRefs", "text", true, undefined, "검토 근거 문서·사실 ID")}</FormField></div><ReasonField /><Submit busy={busy}>요청 조정 기록</Submit></form></details>
        <SubstitutionReviewForm requirement={req} state={state.substitution} facts={data.proofCandidates??[]} busy={busy}
          onReview={(proposal,basisRefs,reviewReason)=>{void send(command("requirement.override",{requirementId:req.requirementId},{operation:"review_substitution",substitutionReview:proposal,basisRefs},reviewReason));}}/>
        {req.mappingRequired&&<RequirementMappingForm requirement={req} busy={busy} onSubmit={submit(form=>{const selected=form.getAll("requiredFieldId").map(String),noRequiredFields=form.get("noRequiredFields")==="yes";return command("requirement.override",{requirementId:req.requirementId},{operation:"review_mapping",mappingReview:{expectedCrosswalkId:String(form.get("expectedCrosswalkId")),expectedCrosswalkVersion:String(form.get("expectedCrosswalkVersion")),requiredFieldGroups:noRequiredFields?[]:selected.map(fieldId=>[fieldId]),optionalFieldIds:[],typedTargets:noRequiredFields?[]:selected.map(fieldId=>({fieldId,targetPath:"source_only"})),noRequiredFields,subjectScope:"linked_subject",periodPolicy:"requirement_period"}},reason(form));})}/>}
        <details className="workflow-details"><summary>자료 연결 · 페이지 범위</summary><form className="workflow-form" onSubmit={submit(form => command("document.match", { requirementId: req.requirementId, ...(form.get("matchId") ? { matchId: String(form.get("matchId")) } : {}) }, { operation: String(form.get("operation")), ...(form.get("subjectLinkId") ? { subjectLinkId: String(form.get("subjectLinkId")) } : {}), ...(form.get("documentId") ? { documentId: String(form.get("documentId")) } : {}), ...(commaList(String(form.get("pageIds") ?? "")).length ? { pageIds: commaList(String(form.get("pageIds") ?? "")).map(page => `${String(form.get("documentId") || reqMatches.find(item => item.matchId === String(form.get("matchId")))?.documentId || "")}:${page}`) } : {}), ...(form.get("periodStart") && form.get("periodEnd") ? { coveredPeriod: { start: String(form.get("periodStart")), end: String(form.get("periodEnd")) } } : {}), ...(form.get("matchId") ? { expectedMatchVersion: reqMatches.find(item => item.matchId === String(form.get("matchId")))?.version } : {}) }, reason(form)))}><div className="form-grid"><FormField label="처리">{select("operation", [["suggest", "자료 연결 제안"], ["accept", "제안 확인"], ["reject", "제안 반려"], ["unlink", "연결 해제"], ["relink", "다시 연결"]])}</FormField><FormField label="자료 요청 연결">{select("subjectLinkId", links.map(item => option(item.linkId, item.subjectScope === "case" ? "사건 전체" : `상담 대상 ${links.indexOf(item) + 1}`)), false)}</FormField><FormField label="보관 자료">{select("documentId", documents.filter(item => item.status === "active").map(item => option(item.id, item.name)), false)}</FormField><FormField label="페이지 번호" hint="쉼표로 구분하세요.">{input("pageIds", "text", false, undefined, "1, 2")}</FormField><FormField label="기간 시작">{input("periodStart", "date")}</FormField><FormField label="기간 종료">{input("periodEnd", "date")}</FormField><FormField label="기존 연결">{select("matchId", reqMatches.map(item => option(item.matchId, `${documents.find(doc => doc.id === item.documentId)?.name ?? "보관 자료"} · ${label(item.state)} · v${item.version}`)), false)}</FormField></div><ReasonField /><Submit busy={busy}>자료 연결 기록</Submit></form></details>
        <div className="workflow-matches">{reqMatches.map(match => <div key={match.matchId}><FileText size={14} /><span>{documents.find(item => item.id === match.documentId)?.name ?? match.documentId}</span><small>{match.pageIds.length ? `쪽 ${match.pageIds.map(id => id.split(":").at(-1)).join(", ")}` : "페이지 미지정"} · {label(match.state)}</small></div>)}</div>
        {state.requirementStatus === "eligible_for_confirmation" && <form className="workflow-confirm" onSubmit={submit(form => command("requirement.confirm", { requirementId: req.requirementId }, {}, reason(form)))}><ReasonField /><Submit busy={busy}>담당자 확인 기록</Submit><small>확인은 현재 근거 상태를 기록합니다. 법률 판단이나 법원 결정을 대신하지 않습니다.</small></form>}
        </article>; })}</div>}
      </Panel>
      {suppressedRequirements.length>0&&<Panel title="갈음 검증으로 자동 비활성화된 요청" icon={FileCheck2}>
        <p className="workflow-muted">원본 서류 목록·DB 기록·이전 추출 이력은 삭제하지 않았습니다. 갈음 근거가 변경되면 요청 자료에 자동으로 복원됩니다.</p>
        <div className="workflow-list">{suppressedRequirements.map(req=><article className="workflow-card" key={req.requirementId}>
          <strong>{req.intakeDocumentTypeId} · 갈음 충족</strong>
          <p>{req.requiredPeriod} · 증명 근거 {requirementStates.get(req.requirementId)?.substitution?.supportDocumentIds.join(", ")}</p>
          <small>원본 요청 ID: {req.requirementId}</small>
        </article>)}</div>
      </Panel>}
      <Panel title="담당 작업" icon={Clock3}>
        {data.tasks.count === 0 ? <p className="workflow-muted">열린 작업이 없습니다.</p> : <div className="workflow-list">{data.tasks.items.map(task => <article className="workflow-card" key={task.id}><div className="workflow-card-head"><div><strong>{task.title}</strong><p>{task.blockedBy.length ? `선행 항목 ${task.blockedBy.length}개` : "선행 항목 없음"}</p></div><span className="badge badge-neutral">{label(task.status)}</span></div><form className="workflow-form" onSubmit={submit(form => command("task.update", { taskId: task.id }, { status: String(form.get("status")), ownerId: String(form.get("ownerId") ?? "") || null, dueAt: String(form.get("dueAt") ?? "") || null, waitingOn: String(form.get("waitingOn") ?? "") || null }, reason(form)))}><div className="form-grid"><FormField label="진행 상태">{select("status", [["open", "열림"], ["in_progress", "진행 중"], ["waiting", "대기"], ["resolved", "완료"], ["dismissed", "취소"]])}</FormField><FormField label="담당자" hint="담당자를 지정하려면 확인된 담당자 식별자를 입력하세요.">{input("ownerId", "text", false, task.ownerId ?? "", "담당자 식별자")}</FormField><FormField label="기한">{input("dueAt", "date", false, task.dueAt ?? "")}</FormField><FormField label="대기 사유">{input("waitingOn", "text", false, task.waitingOn ?? "", "필요한 응답이나 자료")}</FormField></div><ReasonField /><Submit busy={busy}>작업 상태 저장</Submit></form></article>)}</div>}
      </Panel>
      <CaseReviewActions revision={data.revision} stateFingerprint={data.stateFingerprint} artifacts={data.artifacts??[]} fieldBases={data.fieldBases??[]} legalRuns={data.legalRuns??[]} roles={data.roles} onCommand={send} onError={setError} busy={busy} />
       {data.legalAutomation&&<Panel title="DB 변경 후 자동 법률 재판단" icon={ShieldCheck}>
         <p className="workflow-muted">마지막 변경 후 10분 안정화 → 계산 → 법률 AI 재검토 → 오류 분석 → 검토용 초안. 법원 제출·승인은 자동 처리하지 않습니다.</p>
         <div className="workflow-state-row"><span>처리 상태: {label(data.legalAutomation.status)}</span><span>검토 진행: {data.legalAutomation.completedChecks??0}/{data.legalAutomation.expectedChecks??95}</span><span>최종 검토: 사람 확인 필수</span></div>
         {data.legalAutomation.lastError&&<p className="workflow-caution">실행 오류: {data.legalAutomation.lastError}</p>}
         {data.legalAutomation.status==="failed"&&typeof data.legalAutomation.currentDataVersion==="number"&&<button className="button button-outline" disabled={busy} onClick={async()=>{
           setBusy(true);try{
             const response=await fetch("/api/cases/"+encodeURIComponent(caseId)+"/automation/retry",{
               method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
               body:JSON.stringify({expectedDataVersion:data.legalAutomation!.currentDataVersion})});
             const result=await response.json().catch(()=>({})) as {error?:string};
             if(!response.ok)throw new Error(result.error??"재시도 접수 실패");
             await load();
           }catch(cause){setError(cause instanceof Error?cause.message:"재시도 접수 실패");}
           finally{setBusy(false);}
         }}>실패한 법률 AI 단계 재시도</button>}
         {data.legalAutomation.outcome?.summary&&<p>{data.legalAutomation.outcome.summary}</p>}
         {Boolean(data.legalAutomation.outcome?.blockers?.length)&&<div className="workflow-caution"><strong>자동작성을 보류한 이유</strong>
           {data.legalAutomation.outcome!.blockers!.slice(0,12).map(reason=><p key={reason}>{reason}</p>)}</div>}
         {Boolean(data.legalAutomation.outcome?.findings?.length)&&<details className="workflow-details"><summary>법률 검토·보완 사항 ({data.legalAutomation.outcome!.findings!.length}건)</summary>
           <div className="workflow-list">{data.legalAutomation.outcome!.findings!.slice(0,20).map(item=><article className="workflow-card" key={item.id}><strong>{item.id} · {label(item.status)}</strong><p>{item.reason}</p>
           {item.missingDocuments.length>0&&<p>필요 자료: {item.missingDocuments.join(" · ")}</p>}<p>다음 조치: {item.nextAction}</p></article>)}</div></details>}
         {Boolean(data.legalAutomation.outcome?.drafts?.length)&&<div className="workflow-list"><strong>자동 생성된 검토용 서류</strong>
           {data.legalAutomation.outcome!.drafts!.map(item=><p key={item.id}><a href={"/api/cases/"+encodeURIComponent(caseId)+"/artifacts/"+encodeURIComponent(item.id)}>{item.name}</a> · 제출 전 검토 필요</p>)}</div>}
       </Panel>
      <Panel title="법률·서류 확인 기록" icon={ShieldCheck}>
        <p className="workflow-muted">이 영역은 사람이 남긴 검토 이력과 문서 변경 기록을 보여 줍니다. 자동 승인 기능은 없습니다.</p>
        <div className="workflow-audit-grid"><div><h3>검토 기록</h3>{data.workflow.legalDispositions.length ? data.workflow.legalDispositions.map((item, index) => <p key={`${item.checkId}:${index}`}>{item.checkId} · {label(item.status)} · {item.reason}</p>) : <p className="workflow-muted">기록된 검토가 없습니다.</p>}</div><div><h3>서류 수정 기록</h3>{data.workflow.documentEdits.length ? data.workflow.documentEdits.map(item => <p key={item.id}>{item.fieldId} · {item.kind === "prose" ? "문안" : "배치"} 수정 · {item.reason}</p>) : <p className="workflow-muted">기록된 수정이 없습니다.</p>}</div></div>
      </Panel>
      <Panel title="절차 진행 기록" icon={FileText}>
        <details className="workflow-details" open={procedureOpen} onToggle={event => setProcedureOpen((event.currentTarget as HTMLDetailsElement).open)}><summary>법원 절차 상태 기록</summary><form className="workflow-form" onSubmit={submit(form => command("procedure.record", {}, { state: String(form.get("state")), occurredAt: new Date(String(form.get("occurredAt"))).toISOString(), sourceDocumentIds: commaList(String(form.get("sourceDocumentIds") ?? "")), courtReference: String(form.get("courtReference") ?? ""), relatedFields: commaList(String(form.get("relatedFields") ?? "")), artifactIds: commaList(String(form.get("artifactIds") ?? "")) }, reason(form)))}><div className="form-grid"><FormField label="절차 상태">{select("state", [["generated", "초안 생성"], ["human_reviewed", "담당자 검토"], ["sent", "발송"], ["submitted", "법원 제출"], ["received", "접수"], ["correction_requested", "보정 요청"], ["amended", "보정 제출"], ["approved", "인가"], ["discontinued", "폐지"], ["discharged", "면책"]])}</FormField><FormField label="발생 일시">{input("occurredAt", "datetime-local", true)}</FormField><FormField label="법원 사건 번호">{input("courtReference", "text", false, undefined, "해당 절차에 필요한 경우 입력")}</FormField><FormField label="근거 자료 ID">{input("sourceDocumentIds", "text", false, undefined, "문서 ID, 문서 ID")}</FormField><FormField label="관련 항목">{input("relatedFields", "text", false, undefined, "관련 사실·요건 ID")}</FormField><FormField label="생성 서류 ID">{input("artifactIds", "text", false, undefined, "서류 ID")}</FormField></div><ReasonField /><Submit busy={busy}>절차 기록 저장</Submit></form></details>
        <div className="workflow-list">{data.workflow.procedureEvents.map(event => <article className="workflow-card" key={event.id}><div className="workflow-card-head"><strong>{label(event.state)}</strong><span>{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(event.occurredAt))}</span></div><p>{event.reason}</p><small>{event.courtReference || "사건 번호 없음"} · 근거 자료 {event.sourceDocumentIds.join(", ") || "없음"}</small></article>)}</div>
      </Panel>
      <Panel title="서식·계산 연결 상태" icon={FileCheck2}>
        <p className="workflow-muted">연결 가능한 서식 항목 {data.formFields.length}개 · 재계산 작업 {data.recomputeJobs.length}개</p>
        {data.formFields.length > 0 && <div className="workflow-form-fields"><strong>서식에 연결된 항목</strong><div>{data.formFields.slice(0, 16).map((field, index) => <span key={`${field.kind}:${field.token}:${index}`}>{FORM_LABELS[field.token] ?? (field.kind === "money" ? "금액 항목" : field.kind === "date" ? "기준일" : "서식 항목")}</span>)}{data.formFields.length > 16 && <small>외 {data.formFields.length - 16}개 항목</small>}</div></div>}
        {data.planReconciliation && <div className="workflow-state-row"><span>변제계획 대조: {label(data.planReconciliation.status)}</span><span>확인할 항목: {data.planReconciliation.issues?.length ?? 0}</span></div>}
        {data.workflow.projectionBlockers.length > 0 && <div className="workflow-caution"><strong>반영을 막는 항목</strong>{data.workflow.projectionBlockers.map((item, index) => <p key={`${item.code}:${index}`}>{item.reason} · 관련 사실 {item.factIds.length}개</p>)}</div>}
      </Panel>
      {data.health&&<Panel title="처리 상태와 복구" icon={Clock3}>
        <div className="workflow-state-row"><span>재계산 대기 {data.health.evaluation.pending}건 · 실패 {data.health.evaluation.failed}건</span><span>열린 작업 {data.health.tasks.open}건 · 기한 경과 {data.health.tasks.overdue}건</span><span>서류 미확정 항목 {data.health.blockers.unresolvedDocumentFields}개</span></div>
        <p className="workflow-muted">실패 작업은 <a href="/tasks">담당자 작업</a>에서 최신 사건 상태를 확인한 뒤 재시도할 수 있습니다. 이 화면을 조회해도 모델 분석을 새로 실행하지 않습니다.</p>
        {(data.health.coverage.jobsTruncated||data.health.coverage.commandsTruncated)&&<p className="workflow-caution">최근 처리 내역만 표시했습니다. 아래 건수는 전체 이력의 합계가 아닙니다.</p>}
        <details className="workflow-details"><summary>문제 확인용 처리 식별자</summary><p className="workflow-muted">현재 사건 지문: <code>{data.health.identity.stateFingerprint}</code></p><ul>{data.health.commands.map(item=><li key={item.commandId}><code>{item.commandId}</code> · 판본 {item.revision} · {item.commandType}</li>)}</ul><p className="workflow-muted">현재 산출물 {data.health.artifacts.length}개 · 자동 재시도 한도 {data.health.recovery.automaticAttemptsLimit}회</p></details>
        <details className="workflow-details"><summary>기존 사건의 업무 형식 전환</summary><p className="workflow-muted">기존 값을 보존하고 누락된 업무 목록의 기본 형식만 추가합니다. 현재 사건의 변경 항목을 먼저 확인하세요.</p><button className="button button-outline" disabled={busy||loading} onClick={async()=>{setBusy(true);setError("");try{const response=await fetch(`/api/cases/${encodeURIComponent(caseId)}/migration`,{cache:"no-store"});const body=await response.json() as MigrationPreview;if(!response.ok)throw new Error(body.error??"전환 미리보기를 불러오지 못했습니다.");if(body.stateFingerprint!==data.stateFingerprint)throw new Error("사건이 변경되었습니다. 최신 상태를 불러온 뒤 확인하세요.");setMigrationPreview(body);}catch(cause){setMigrationPreview(null);setError(cause instanceof Error?cause.message:"전환 미리보기 오류");}finally{setBusy(false);}}}>전환 내용 확인</button>{migrationPreview&&<div><p>변경 항목: {migrationPreview.changedFields.join(", ")||"없음 · 기존 전환 결과 확인"}</p><button className="button button-primary" disabled={busy||migrationPreview.stateFingerprint!==data.stateFingerprint} onClick={()=>void send({commandType:"schema.migrate",target:{},patch:{planId:migrationPreview.planId,sourceSha256:migrationPreview.sourceSha256,migrationVersion:migrationPreview.migrationVersion,mode:migrationPreview.mode},reason:"미리보기 대조 후 기존 사건 업무 형식 전환"})}>확인한 전환 기록 저장</button></div>}</details>
      </Panel>}
    </>}
    <style jsx>{`
      .workflow-page { padding-bottom: 48px; }
      .workflow-summary { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; margin:0 0 18px; }
      .workflow-summary-card { background:#fff; border:1px solid #e2e8dd; border-radius:5px; padding:15px 17px; }
      .workflow-summary-card span { display:block; color:#84917e; font-size:10px; }
      .workflow-summary-card strong { display:block; margin-top:7px; color:#43594b; font-size:14px; font-weight:600; overflow-wrap:anywhere; }
      .workflow-panel-body { padding:18px 22px 22px; }
      .workflow-page .panel { margin-bottom:17px; }
      .workflow-intake { display:grid; grid-template-columns:minmax(200px,.75fr) minmax(0,1.25fr); gap:24px; align-items:start; }
      .workflow-intake > div > strong { font-size:13px; color:#42574a; }
      .workflow-intake p,.workflow-muted { color:#7f897f; font-size:11px; line-height:1.8; }
      .workflow-form { margin-top:14px; }
      .workflow-list { display:grid; gap:12px; }
      .workflow-card { border:1px solid #e6ebe1; border-radius:5px; padding:16px 17px; background:#fff; }
      .workflow-card-head { display:flex; justify-content:space-between; align-items:flex-start; gap:15px; }
      .workflow-card-head strong { font-size:12px; color:#405748; }
      .workflow-card-head p,.workflow-card > p { margin-top:5px; color:#8a9386; font-size:10px; line-height:1.6; }
      .workflow-state-row { display:flex; gap:9px 18px; flex-wrap:wrap; margin:13px 0; color:#697b6b; font-size:10px; }
      .workflow-caution { background:#fbf7e9; border-left:2px solid #d6c58b; padding:10px 12px; color:#827446; font-size:10px; line-height:1.7; }
      .workflow-details { border-top:1px solid #edf0e9; margin-top:13px; padding-top:12px; }
      .workflow-details summary { cursor:pointer; color:#59705b; font-size:11px; font-weight:600; }
      .workflow-matches { display:grid; gap:7px; margin-top:13px; }
      .workflow-matches > div { display:flex; align-items:center; gap:7px; color:#64766a; font-size:10px; }
      .workflow-matches small { margin-left:auto; color:#929b8f; }
      .workflow-confirm { border-top:1px solid #edf0e9; margin-top:14px; padding-top:12px; }
      .workflow-confirm > small { display:block; color:#899487; font-size:9px; margin-top:8px; }
      .workflow-alert,.workflow-pending { display:flex; align-items:flex-start; gap:9px; border:1px solid #ead7cf; border-radius:5px; padding:12px 14px; margin-bottom:13px; background:#fff8f5; color:#98624d; font-size:11px; line-height:1.6; }
      .workflow-alert.success { background:#f3f8ef; color:#55744d; border-color:#d8e6cf; }
      .workflow-alert.info { background:#f5f8f8; color:#5d777c; border-color:#dce6e6; }
      .workflow-pending { justify-content:space-between; align-items:center; background:#faf7e9; color:#786a3f; border-color:#e7dfc7; }
      .workflow-pending p { font-size:10px; margin-top:3px; }
      .workflow-audit-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
      .workflow-audit-grid h3 { color:#5a705d; font-size:11px; margin-bottom:8px; }
      .workflow-audit-grid p { color:#788579; font-size:10px; line-height:1.7; padding:6px 0; border-bottom:1px solid #f0f2ed; }
      .workflow-form-fields { margin-top:12px; }
      .workflow-form-fields > strong { color:#5a705d; font-size:10px; }
      .workflow-form-fields > div { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
      .workflow-form-fields span { padding:5px 8px; border-radius:3px; background:#f2f5ef; color:#697b6b; font-size:9px; }
      .workflow-form-fields small { align-self:center; color:#8a9386; font-size:9px; }
      .workflow-map-fields { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:7px; margin:12px 0; }
      .workflow-map-fields label,.workflow-map-no-fields { display:flex; align-items:flex-start; gap:7px; color:#586b5b; font-size:10px; overflow-wrap:anywhere; }
      .workflow-map-no-fields { margin:10px 0; font-weight:600; }
      .workflow-alert + .workflow-alert { margin-top:-5px; }
      @media(max-width:900px){.workflow-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.workflow-intake{grid-template-columns:1fr}.workflow-audit-grid{grid-template-columns:1fr}}
    `}</style>
  </main>;
}
