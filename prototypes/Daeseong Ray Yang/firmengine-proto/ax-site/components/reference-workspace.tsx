"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Bell, BookOpen, Check, ChevronLeft, ChevronRight, Clock3, Code2, Database, FileSearch, Link2, Loader2, Play, RefreshCw, Save, Scale, Search, ShieldCheck, Square, X } from "lucide-react";
import { installBrowserReferenceSnapshot, type ReferenceSnapshot } from "../lib/reference-runtime";

type ReferenceRecord = {
  id: string; kind: string; category: string; title: string; value: unknown; unit?: string | null;
  sourceIds: string[]; sourceUrls: string[]; verification: string; effectiveFrom: string | null; effectiveTo: string | null;
  courtIds: string[]; consumers: { path: string; symbol: string; line?: number; jsonPointer?: string }[];
  condition: unknown; consequence: unknown; runtimeMode: string; editable: boolean; sha256: string;
};
type ReferenceProposal = { id:string; referenceId:string; oldValue:unknown; value:unknown; reason:string; sourceUrls:string[]; effectiveFrom:string|null; baseSha256:string; status:string; createdAt:string; actor:string; proposalFingerprint?:string };
type ReferenceData = {
  release: { id: string; revision: number; sha256: string; recordCount: number; byKind: Record<string, number>; sourceFileCount?: number };
  active: ReferenceSnapshot; history?: {id:string;revision:number;sha256:string;status:string;createdAt:string;actor:string;reason:string}[]; bundleInspection?: {compatibility:string;artifactCount:number;missingDateBasisIds:string[];unknownTransitionIds:string[];missingJurisdictionIds:string[]}; storage: { seeded: number | boolean; total: number; complete?: boolean };
  items: ReferenceRecord[]; proposals: ReferenceProposal[]; total: number; nextOffset: number | null;
  inventory?: { files?: unknown[] | number; scope?: string };
};
type MonitorSource = { id: string; title: string; agent: string; kind: string; url: string; enabled: boolean; disabledReason?: string };
type MonitorAlert = { id: string; agent: string; title: string; summary: string; status: string; kind: string; affectedRuleIds: string[]; sourceUrls: string[]; createdAt: string; acknowledgedAt?: string | null; requiresHumanReview: true };
type MonitorData = { sources: MonitorSource[]; states: Record<string, unknown>[]; runs: Record<string, unknown>[]; alerts: MonitorAlert[]; counts: { unread: number; total: number }; schedule: { cadence: string; timezone?: string; hour?: number; notification: string; configured: boolean; desiredConfigured?:boolean; runtimeStatus?:string; schedulerEnabled?:boolean|null; lastSuccessAt?:string|null; lastFailure?:{status:string;at:string|null}|null } };
type Agent = "all" | "legislation" | "court_documents";
type SourceHealth = { sourceId: string; status: string; message: string; checkedAt: string };
type RunResult = { runId: string; status: string; nextCursor: number | null; pendingDiscoveryCount?: number; newAlerts: number | unknown[]; sourceHealth?: SourceHealth[]; processedSources?: number; totalSources?: number; discoveryStatus?: string; analysisStatus?: string };
type RunProgress = { agent: Agent; status: "running" | "complete" | "partial" | "stopped" | "failed"; slices: number; cursor: number | null; pendingDiscoveryCount?: number; newAlerts: number; health: SourceHealth[]; issues: string[]; message: string };

const KIND_LABELS: Record<string, string> = {
  intake_feature: "상담 분류 피처", intake_document: "상담 서류 종류", intake_rule: "상담 서류 조건", intake_source: "상담 근거 자료", parameter: "매개변수", legal_rule: "법률 기준", legal: "법률 기준", rule: "법률 기준", workflow: "업무 조건", workflow_rule: "업무 조건",
  risk: "검토 항목", exception: "예외 조건", calculation: "계산식", formula: "계산식", source: "근거 자료", legal_source: "근거 자료",
  document_family: "문서 종류", document_field: "문서 항목", field: "문서 항목", field_contract: "필드 계약", applicability: "적용 조건",
  document_requirement: "제출 문서", document_map: "문서 연결", document_feature_map: "문서 연결", form: "공식 서식", template: "서식",
  prompt: "프롬프트 규약", prompt_policy: "프롬프트 규약", policy: "운영 규약", application_policy: "운영 규약", decision_table: "판단 조건표",
  code_rule: "코드 조건", source_code: "코드 조건", code_inventory: "코드 조사", source_observation: "원문 계약", agent: "에이전트 계약", monitor_source: "감시 출처",
  agent_contract: "에이전트 규약", code_criterion: "코드 내 조건", document_rule: "문서 선택 기준", catalog_metadata: "기준표 설명", legacy_vocabulary: "기존 용어", workflow_calculation: "업무 계산 기준",
};
const CATEGORY_LABELS: Record<string, string> = { statute: "법령", national_statute: "전국 법령", court_practice: "법원 실무준칙", application_policy: "앱 운영 규약", compiled_application_policy: "코드 내 운영 규약", arithmetic_policy: "산술 규약", prompt_policy: "프롬프트 규약", extraction_contract: "원문 추출 계약", implementation: "구현 기준", legal_research: "법률 검토 사양", form_guidance: "서식 안내", supreme_court_case: "대법원 판례", presidential_decree: "대통령령", supreme_court_directive: "대법원 예규", supreme_court_rule: "대법원 규칙", seoul_court_annual_standard: "서울회생법원 연간 기준", seoul_court_practice: "서울회생법원 실무준칙" };
const VERIFY_LABELS: Record<string, string> = { inherited_intake_catalog: "서류 기준표 초기 판본", source_verified: "출처 확인 기록", inherited: "기존 기준 인계", unverified: "추가 검증 필요", source_review_required: "출처 검토 필요", review_required: "검토 필요", reviewer_pending: "검토 대기", implementation_review_required: "구현 검토 필요", human_reviewed_reference_change: "사람이 검토한 개정" };
const STATUS_LABELS: Record<string, string> = { proposed: "법안·개정안", promulgated: "공포", scheduled_effective: "시행 예정", effective: "시행", practice_notice: "실무 공고", form_notice: "서식 공고", unconfirmed_change: "변경 확인 필요", newly_discovered: "새 공고 발견", source_changed: "원문 변경", attachment_changed: "첨부 변경", new_publication: "새 게시물", ok: "확인됨", partial: "일부 확인", blocked: "접근 차단", failed: "확인 실패", disabled: "사용 중지", deferred: "다음 확인 대기", complete: "확인 완료", pending: "대기", acknowledged: "확인 기록 있음", baseline: "최초 비교본 저장", initialized: "최초 비교본 저장" };
const RUNTIME_LABELS: Record<string, string> = { separate_reference_table: "별도 기준정보 테이블", parameter: "실행 매개변수", runtime_parameter: "실행 매개변수", active_parameter: "실행 매개변수", prompt: "프롬프트 주입", prompt_template: "프롬프트 주입", runtime_prompt: "프롬프트 주입", decision_table: "조건표 실행", compiled_code: "코드에서 실행", compiled_guard: "코드에 고정된 조건", engine_guard: "계산기 보호 조건", legal_review: "법률 검토 필요", deterministic_after_review: "검토 후 결정 계산", evidence_check: "증빙 확인", arithmetic_after_review: "검토 후 산술 계산", warning_only: "주의 안내", metadata_only: "검토용 명세", catalog: "기준표 참조", specification: "검토용 명세", locked: "고정 계약", reference_only: "참조 기준" };
const UNIT_LABELS: Record<string, string> = { KRW: "원", "KRW/month": "원/월", months: "개월", years: "년", count: "개", rational: "분수 비율", basis_points: "만분율", "ISO-8601-date": "날짜", compiled_condition: "코드 조건", compiled_formula_description: "산식 설명", comparison: "비교 연산", citation: "근거 조항", version: "판본", source_text: "원문", URL: "출처 주소", court_id: "법원 식별자", structured_table: "구조화 표", reviewed_predicates: "검토한 조건", evidence_contract: "증빙 규약" };
const ERROR_LABELS: Record<string, string> = { REFERENCE_RELEASE_CONFLICT: "기준정보 판본이 변경되었습니다. 최신 값을 다시 불러온 뒤 변경안을 검토해 주세요.", REFERENCE_RECORD_REQUIRES_CODE_RELEASE: "고정된 기준은 구현 검토와 코드 배포가 필요합니다.", REFERENCE_CHANGE_REASON_REQUIRED: "변경 이유와 확인한 근거를 5자 이상 입력해 주세요.", OFFICIAL_REFERENCE_SOURCE_REQUIRED: "법원 또는 정부 기관의 공식 HTTPS 출처 주소를 입력해 주세요.", INVALID_REFERENCE_VALUE: "변경 값의 자료형이나 구조를 확인해 주세요. 현재 기준과 같은 JSON 구조를 사용합니다.", INVALID_REFERENCE_EFFECTIVE_DATE: "제안 시행일을 확인해 주세요.", INVALID_REFERENCE_MONEY: "금액은 현재 기준과 같은 형식의 정수 문자열로 입력해 주세요.", INVALID_REFERENCE_RATIO: "비율의 분모는 0보다 커야 합니다.", INVALID_REFERENCE_PERIOD: "변제기간의 입력 범위를 확인해 주세요.", REFERENCE_PROMPT_PLACEHOLDERS_CHANGED: "프롬프트에 필요한 변수 이름과 개수를 유지해 주세요." };
const AGENT_LABELS: Record<string, string> = { all: "두 에이전트 전체", legislation: "법령 개정 감시", court_documents: "법원 공고·서식 감시" };
const PAGE_SIZE = 50;
const todayKst=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const MAX_RUN_SLICES = 8;
const serial = (value: unknown) => value === undefined ? "[미확정]" : typeof value === "string" ? value : JSON.stringify(value, null, 2);
const shortValue = (value: unknown) => { const text = serial(value); return text.length > 150 ? text.slice(0, 150) + "…" : text; };
const numberText = (value: number | undefined) => typeof value === "number" ? value.toLocaleString("ko-KR") : "—";
const label = (labels: Record<string, string>, value: string | undefined, fallback = "확인 필요") => value ? labels[value] ?? value : fallback;
const safeUrl = (value: string) => { try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; } };
const timeLabel = (value: unknown) => { if (typeof value !== "string" || !value) return "확인 기록 없음"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(date) + " KST"; };
const needsAttention = (status: string) => ["failed", "blocked", "partial", "disabled", "deferred"].includes(status);
function runOutcome(alerts: number, health: SourceHealth[], complete: boolean, issues: string[] = []): string {
  const failed = health.filter(item => needsAttention(item.status)).length;
  if (alerts > 0) return `변경 후보 ${numberText(alerts)}건을 발견했습니다.${failed ? ` ${numberText(failed)}개 출처는 추가 확인이 필요합니다.` : ""}`;
  if (failed) return `새 변경 후보는 없지만 ${numberText(failed)}개 출처를 끝까지 확인하지 못했습니다. 출처 상태를 확인해 주세요.`;
  if (issues.length) return "새 변경 후보는 없지만 웹검색·분석 중 완료되지 않은 작업이 있어 변경 여부를 모두 확인하지 못했습니다.";
  if (!complete) return "아직 확인하지 않은 출처가 있습니다. 남은 구간의 확인이 필요합니다.";
  return health.length ? "확인한 출처에서 새 변경 후보가 발견되지 않았습니다. 최초 비교본 저장은 변경으로 집계하지 않습니다." : "확인 응답이 없어 변경 여부를 판단할 수 없습니다.";
}
function monitorIssues(result: { discoveryStatus?: unknown; analysisStatus?: unknown }): string[] {
  return [result.discoveryStatus === "failed" ? "공식 도메인 웹검색 확인 실패" : result.discoveryStatus === "deferred" ? "공식 도메인 웹검색 미완료" : "", result.analysisStatus === "partial" ? "변경 후보 분석 일부 미완료" : ""].filter(Boolean);
}
function runDetails(item: Record<string, unknown>) { return item.payload && typeof item.payload === "object" && !Array.isArray(item.payload) ? { ...item, ...item.payload as Record<string, unknown> } : item; }
function savedRunOutcome(item: Record<string, unknown>): string {
  const result = runDetails(item);
  if (result.status === "failed") return "이번 확인을 완료하지 못했습니다. 수집 실패 내용을 확인해 주세요.";
  if (result.status === "running") return "현재 공식 출처를 확인하고 있습니다.";
  const alerts = Array.isArray(result.newAlerts) ? result.newAlerts.length : typeof result.newAlertCount === "number" ? result.newAlertCount : typeof result.newAlerts === "number" ? result.newAlerts : undefined;
  const health = Array.isArray(result.sourceHealth) ? result.sourceHealth as SourceHealth[] : [];
  return alerts === undefined ? "변경 후보와 출처 응답은 기록 상세에서 확인해 주세요." : runOutcome(alerts, health, result.status === "complete", monitorIssues(result));
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (typeof options.body === "string") headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...options, headers, credentials: "same-origin", cache: "no-store" });
  const data = await response.json().catch(() => { throw new Error("응답을 끝까지 받지 못했습니다. 다시 불러와 주세요."); }) as Record<string, unknown>;
  if (!response.ok) { const message = typeof data.error === "string" ? data.error : typeof data.message === "string" ? data.message : `요청을 처리하지 못했습니다. (${response.status})`; throw new Error(ERROR_LABELS[message] ?? message); }
  return data as T;
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "amber" | "red" }) { return <span className={`ref-badge ref-badge-${tone}`}>{children}</span>; }
function SourceLink({ url, children }: { url: string; children?: ReactNode }) { const href = safeUrl(url); return href ? <a className="ref-source-link" href={href} target="_blank" rel="noreferrer"><Link2 size={13} /><span>{children ?? url}</span><ArrowUpRight size={13} /></a> : <span className="ref-muted">출처 주소 검토 필요</span>; }
function ValueInspector({ value }: { value: unknown }) {
  if (Array.isArray(value) && value.length && value.every(item => item && typeof item === "object" && !Array.isArray(item))) {
    const keys = [...new Set(value.flatMap(item => Object.keys(item as object)))].slice(0, 6);
    return <><div className="ref-value-table"><table><thead><tr>{keys.map(key => <th key={key}>{key}</th>)}</tr></thead><tbody>{value.slice(0, 20).map((item, index) => <tr key={index}>{keys.map(key => <td key={key}>{shortValue((item as Record<string, unknown>)[key])}</td>)}</tr>)}</tbody></table></div><details className="ref-raw"><summary>전체 값 보기 · {numberText(value.length)}행</summary><pre>{serial(value)}</pre></details></>;
  }
  return <pre className="ref-value">{serial(value)}</pre>;
}

export default function ReferenceWorkspace() {
  const [tab, setTab] = useState<"references" | "monitor">("references");
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const [monitor, setMonitor] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true), [monitorLoading, setMonitorLoading] = useState(true);
  const [referenceError, setReferenceError] = useState(""), [monitorError, setMonitorError] = useState("");
  const [searchDraft, setSearchDraft] = useState(""), [query, setQuery] = useState(""), [kind, setKind] = useState(""), [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<ReferenceRecord | null>(null);
  const [canApproveReference,setCanApproveReference]=useState(false);
  const [activatingProposal,setActivatingProposal]=useState("");
  const [bundleArtifacts,setBundleArtifacts]=useState(""),[bundleReason,setBundleReason]=useState(""),[bundleReviewing,setBundleReviewing]=useState(false);
  const [impactCaseIds,setImpactCaseIds]=useState(""),[impactLoading,setImpactLoading]=useState(""),[impactPreview,setImpactPreview]=useState<{proposalId:string;impact:{affected:string[];unknown:string[];unaffected:string[];tasks:{key:string;caseId:string}[]};details:{caseId:string;dependencyStatus:string;matchingArtifactIds:string[];currentArtifactIds:string[]}[]}|null>(null);
  const [restoreTarget,setRestoreTarget]=useState(""),[restoreReason,setRestoreReason]=useState(""),[restorePreview,setRestorePreview]=useState<{targetRelease:{id:string;revision:number;sha256:string};activeRelease:{id:string;revision:number;sha256:string};changedReferenceIds:string[];invalidatesBundleReview:boolean;caseWrites:number;caseReviewsCarried:boolean}|null>(null),[restoreLoading,setRestoreLoading]=useState(false);
  const [proposal, setProposal] = useState({ value: "", reason: "", urls: "", effectiveFrom: "", effectiveTo:"", dateBasis:"", jurisdiction:"", transitionStatus:"unknown" as "declared"|"unknown", transitionConditions:"" });
  const [proposing, setProposing] = useState(false), [proposalMessage, setProposalMessage] = useState(""), [proposalError, setProposalError] = useState("");
  const [agent, setAgent] = useState<Agent>("all"), [run, setRun] = useState<RunProgress | null>(null), [running, setRunning] = useState(false);
  const [acknowledging, setAcknowledging] = useState(""), [alertFilter, setAlertFilter] = useState<"unread" | "all">("unread");
  const [sourceFilter, setSourceFilter] = useState<"all" | "attention">("all");
  const referenceRequest = useRef(0), cancelled = useRef(false), mounted = useRef(true);

  const loadReference = useCallback(async () => {
    const sequence = ++referenceRequest.current;
    setLoading(true); setReferenceError("");
    try {
      const params = new URLSearchParams({ offset: String(offset), limit: String(PAGE_SIZE) });
      if (query) params.set("q", query); if (kind) params.set("kind", kind);
      const result = await request<ReferenceData>("/api/reference-data?" + params);
      if (!mounted.current || sequence !== referenceRequest.current) return;
      if (result.active?.values) installBrowserReferenceSnapshot(result.active);
      setReference(result);
    } catch (error) { if (mounted.current && sequence === referenceRequest.current) setReferenceError(error instanceof Error ? error.message : "기준정보를 불러오지 못했습니다."); }
    finally { if (mounted.current && sequence === referenceRequest.current) setLoading(false); }
  }, [kind, offset, query]);
  const loadMonitor = useCallback(async () => {
    setMonitorLoading(true); setMonitorError("");
    try { const result = await request<MonitorData>("/api/legal-monitor"); if (mounted.current) setMonitor(result); }
    catch (error) { if (mounted.current) setMonitorError(error instanceof Error ? error.message : "변경 감시 현황을 불러오지 못했습니다."); }
    finally { if (mounted.current) setMonitorLoading(false); }
  }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; cancelled.current = true; }; }, []);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void loadReference(); }); return () => { active = false; }; }, [loadReference]);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void loadMonitor(); }); return () => { active = false; }; }, [loadMonitor]);
  useEffect(() => { let active=true; void request<{roles:string[]}> ("/api/roles").then(result=>{if(active)setCanApproveReference(result.roles.includes("reference_approve"));}).catch(()=>{if(active)setCanApproveReference(false);}); return ()=>{active=false;}; }, []);

  const activeValue = selected && reference?.active?.values && Object.hasOwn(reference.active.values, selected.id) ? reference.active.values[selected.id] : selected?.value;
  function chooseRecord(record: ReferenceRecord) {
    setSelected(record); setProposalError(""); setProposalMessage("");
    const value = reference?.active?.values && Object.hasOwn(reference.active.values, record.id) ? reference.active.values[record.id] : record.value;
    setProposal({ value: JSON.stringify(value, null, 2) ?? "null", reason: "", urls: (record.sourceUrls ?? []).join("\n"), effectiveFrom: record.effectiveFrom ?? "", effectiveTo:"",dateBasis:"",jurisdiction:"",transitionStatus:"unknown",transitionConditions:"" });
  }
  function search(event: FormEvent) { event.preventDefault(); setOffset(0); setSelected(null); setQuery(searchDraft.trim()); }
  function inspectRule(id: string) { setTab("references"); setSearchDraft(id); setQuery(id); setKind(""); setOffset(0); setSelected(null); }
  function prepareProposalFromAlert(alert:MonitorAlert){
    if(alert.affectedRuleIds?.length!==1)return;
    const id=alert.affectedRuleIds[0],record=reference?.items.find(item=>item.id===id);
    const source=alert.sourceUrls?.find(url=>/^https:\/\//i.test(url)&&safeUrl(url));
    setTab("references");
    if(record){setSelected(record);setProposal({value:record.editable?JSON.stringify(reference?.active.values?.[id]??record.value,null,2):"",reason:`모니터 후보: ${alert.title} — ${alert.summary}`,urls:source??(record.sourceUrls??[]).join("\n"),effectiveFrom:record.effectiveFrom??"",effectiveTo:"",dateBasis:"",jurisdiction:"",transitionStatus:"unknown",transitionConditions:""});}
    else {setProposal({value:"",reason:`모니터 후보: ${alert.title} — ${alert.summary}`,urls:source??"",effectiveFrom:"",effectiveTo:"",dateBasis:"",jurisdiction:"",transitionStatus:"unknown",transitionConditions:""});inspectRule(id);}
  }
  async function propose(event: FormEvent) {
    event.preventDefault(); if (!selected?.editable || proposing) return;
    setProposing(true); setProposalError(""); setProposalMessage("");
    try {
      const value: unknown = JSON.parse(proposal.value);
      const sourceUrls = proposal.urls.split(/\r?\n/).map(url => url.trim()).filter(Boolean);
      if (proposal.reason.trim().length < 5) throw new Error("변경 이유와 확인한 근거를 5자 이상 입력해 주세요.");
      if (sourceUrls.some(url => !safeUrl(url))) throw new Error("출처는 전체 HTTP 또는 HTTPS 주소로 입력해 주세요.");
      const result = await request<{ id?: string; candidate?: { id?: string } }>("/api/reference-data", { method: "POST", body: JSON.stringify({ action: "propose", id: selected.id, value, reason: proposal.reason.trim(), sourceUrls, expectedActiveSha256: reference?.active.sha256, ...(proposal.effectiveFrom ? { effectiveFrom: proposal.effectiveFrom } : {}), ...(proposal.dateBasis ? { applicationContract:{dateBasis:proposal.dateBasis,jurisdiction:proposal.jurisdiction||null,effectiveTo:proposal.effectiveTo||null,transition:{status:proposal.transitionStatus,conditions:proposal.transitionConditions.split(/\r?\n/).map(value=>value.trim()).filter(Boolean)}} } : {}) }) });
      const id = result.candidate?.id ?? result.id;
      setProposalMessage("개정 후보를 저장했습니다. 현재 적용값은 별도 검토 후 변경됩니다." + (id ? " 후보 " + id : "")); await loadReference();
    } catch (error) { setProposalError(error instanceof SyntaxError ? "변경 값을 유효한 JSON으로 입력해 주세요. 문자열은 큰따옴표로 감쌉니다." : error instanceof Error ? error.message : "개정 후보를 저장하지 못했습니다."); }
    finally { setProposing(false); }
  }

  async function runMonitor() {
    if (running) return;
    cancelled.current = false; setRunning(true); setMonitorError("");
    let cursor = run?.agent === agent && run.cursor !== null && run.status !== "complete" ? run.cursor : 0;
    let alerts = 0; const health = new Map<string, SourceHealth>(); const issues = new Set<string>();
    let progress: RunProgress = { agent, status: "running", slices: 0, cursor, newAlerts: 0, health: [], issues: [], message: "공식 출처를 확인하고 있습니다." };
    setRun(progress);
    try {
      for (let slice = 0; slice < MAX_RUN_SLICES && !cancelled.current; slice++) {
        const result = await request<RunResult>("/api/legal-monitor", { method: "POST", signal: AbortSignal.timeout(100_000), body: JSON.stringify({ action: "run", agent, cursor }) });
        alerts += Array.isArray(result.newAlerts) ? result.newAlerts.length : typeof result.newAlerts === "number" ? result.newAlerts : 0;
        for (const item of result.sourceHealth ?? []) health.set(item.sourceId, item);
        for (const issue of monitorIssues(result)) issues.add(issue);
        const next = typeof result.nextCursor === "number" ? result.nextCursor : null;
        if (next !== null && (!Number.isSafeInteger(next) || next < 0)) throw new Error("다음 확인 구간을 검증하지 못해 중단했습니다.");
        const pendingDiscoveryCount = typeof result.pendingDiscoveryCount === "number" && Number.isSafeInteger(result.pendingDiscoveryCount) && result.pendingDiscoveryCount >= 0 ? result.pendingDiscoveryCount : undefined;
        const complete = result.status === "complete" && next === null && !pendingDiscoveryCount && !issues.size && ![...health.values()].some(item => needsAttention(item.status));
        progress = { agent, status: complete ? "complete" : "partial", slices: slice + 1, cursor: next, pendingDiscoveryCount, newAlerts: alerts, health: [...health.values()], issues: [...issues], message: complete ? "이번 확인을 완료했습니다." : pendingDiscoveryCount ? `발견한 공식 자료 ${numberText(pendingDiscoveryCount)}건의 원문 확인이 남아 있습니다.` : "일부 출처를 확인했습니다. 남은 구간을 이어서 확인합니다." };
        if (mounted.current) setRun({ ...progress, status: complete ? "complete" : "running" });
        if (complete || next === null) break;
        // The pinned-source cursor can stay unchanged while discoveries drain.
        // Only the server's null cursor, cancellation or slice bound ends work.
        cursor = next;
      }
      if (cancelled.current && progress.status !== "complete") progress = { ...progress, status: "stopped", message: "다음 구간 확인을 중지했습니다. 저장된 위치에서 이어갈 수 있습니다." };
      else if (progress.status !== "complete") progress = { ...progress, status: "partial", message: progress.cursor !== null ? "이번 확인 범위에 도달했습니다. 이어서 확인하면 남은 출처와 발견한 자료를 살펴봅니다." : progress.pendingDiscoveryCount ? `미수집 공식 자료 ${numberText(progress.pendingDiscoveryCount)}건은 다음 정기 확인에서 다시 시도합니다. 출처 상태를 확인해 주세요.` : "확인은 종료되었지만 일부 출처를 확인하지 못했습니다. 출처 상태를 확인해 주세요." };
      if (mounted.current) setRun(progress);
    } catch (error) { if (mounted.current) { const message = error instanceof Error && error.name === "TimeoutError" ? "응답이 지연되어 이번 요청의 대기를 종료했습니다. 저장된 실행 결과를 새로고침한 뒤 이어서 확인해 주세요." : error instanceof Error ? error.message : "변경 확인을 완료하지 못했습니다."; setRun({ ...progress, status: "failed", cursor, message }); setMonitorError(message); } }
    finally { if (mounted.current) { setRunning(false); await loadMonitor(); } }
  }
  async function previewRestore(item:{sha256:string}){
    if(!reference||restoreLoading)return;setRestoreLoading(true);setRestoreTarget(item.sha256);setRestorePreview(null);setReferenceError("");
    try{const params=new URLSearchParams({action:"restore_preview",targetSha256:item.sha256,expectedActiveSha256:reference.active.sha256});setRestorePreview(await request<typeof restorePreview>("/api/reference-data?"+params));}
    catch(error){setReferenceError(error instanceof Error?error.message:"기준 복원 미리보기를 불러오지 못했습니다.");setRestoreTarget("");}
    finally{setRestoreLoading(false);}
  }
  async function restoreRelease(){
    if(!reference||!restorePreview||restoreReason.trim().length<5||restoreLoading)return;setRestoreLoading(true);setReferenceError("");
    try{await request("/api/reference-data",{method:"POST",body:JSON.stringify({action:"restore_release",targetSha256:restorePreview.targetRelease.sha256,expectedActiveSha256:reference.active.sha256,reason:restoreReason.trim()})});setRestorePreview(null);setRestoreTarget("");setRestoreReason("");await loadReference();}
    catch(error){setReferenceError(error instanceof Error?error.message:"기준 판본을 복원하지 못했습니다.");}
    finally{setRestoreLoading(false);}
  }

  async function previewImpact(proposal:ReferenceProposal){
    if(impactLoading)return;const ids=[...new Set(impactCaseIds.split(/[\n,]/).map(id=>id.trim()).filter(Boolean))];
    if(!ids.length||ids.length>52){setReferenceError("사건 ID 1~52개를 입력하세요.");return;}
    setImpactLoading(proposal.id);setReferenceError("");
    try{const params=new URLSearchParams({action:"impact",proposalId:proposal.id});for(const id of ids)params.append("caseId",id);setImpactPreview(await request<typeof impactPreview>("/api/reference-data?"+params));}
    catch(error){setReferenceError(error instanceof Error?error.message:"영향 범위를 확인하지 못했습니다.");}
    finally{setImpactLoading("");}
  }

  async function approveBundle(event:FormEvent){
    event.preventDefault();if(!canApproveReference||!reference||bundleReviewing)return;
    const artifactIds=[...new Set(bundleArtifacts.split(/[\n,]/).map(id=>id.trim()).filter(Boolean))];
    setBundleReviewing(true);setReferenceError("");
    try{await request("/api/reference-data",{method:"POST",body:JSON.stringify({action:"approve_bundle",artifactIds,expectedActiveSha256:reference.active.sha256,reason:bundleReason.trim()})});setBundleArtifacts("");setBundleReason("");await loadReference();}
    catch(error){setReferenceError(error instanceof Error?error.message:"기준 묶음 검토를 저장하지 못했습니다.");}
    finally{setBundleReviewing(false);}
  }

  async function activateProposal(proposal:ReferenceProposal){
    if(activatingProposal)return;
    setActivatingProposal(proposal.id);setReferenceError("");
    try { await request("/api/reference-data",{method:"POST",body:JSON.stringify({action:"activate",proposalId:proposal.id,expectedActiveSha256:reference?.active.sha256,expectedProposalFingerprint:proposal.proposalFingerprint})}); await loadReference(); }
    catch(error){setReferenceError(error instanceof Error?error.message:"기준 후보를 적용하지 못했습니다.");}
    finally{setActivatingProposal("");}
  }

  async function acknowledge(id: string) {
    if (acknowledging) return;
    setAcknowledging(id); setMonitorError("");
    try { await request("/api/legal-monitor", { method: "POST", body: JSON.stringify({ action: "acknowledge", id }) }); await loadMonitor(); }
    catch (error) { setMonitorError(error instanceof Error ? error.message : "확인 기록을 저장하지 못했습니다."); }
    finally { setAcknowledging(""); }
  }

  const sourceStates = useMemo(() => {
    const states = new Map<string, { status: string; message: string; checkedAt: unknown }>();
    const add = (id: string, item: { status: string; message: string; checkedAt: unknown }) => {
      const before = states.get(id);
      if (before && typeof before.checkedAt === "string" && typeof item.checkedAt === "string" && Date.parse(before.checkedAt) > Date.parse(item.checkedAt)) return;
      states.set(id, item);
    };
    for (const row of monitor?.states ?? []) {
      if (Array.isArray(row.sourceHealth)) for (const item of row.sourceHealth as SourceHealth[]) add(item.sourceId, item);
      const id = row.sourceId ?? row.source_id ?? row.id;
      if (typeof id !== "string") continue;
      const health = row.health && typeof row.health === "object" ? row.health as Record<string, unknown> : row;
      if (health.status || row.lastStatus) add(id, { status: String(health.status ?? row.lastStatus ?? ""), message: String(health.message ?? row.error ?? row.lastError ?? ""), checkedAt: health.checkedAt ?? row.checkedAt ?? row.lastCheckedAt ?? row.checked_at });
    }
    for (const item of run?.health ?? []) add(item.sourceId, item);
    return states;
  }, [monitor, run]);
  const knownSourceIds = new Set((monitor?.sources ?? []).map(source => source.id));
  const allSources: MonitorSource[] = [...monitor?.sources ?? [], ...[...sourceStates.keys()].filter(id => !knownSourceIds.has(id)).map(id => ({ id, title: "추가 검색·첨부 출처", agent: id.includes(":legislation:") ? "legislation" : id.includes(":court_documents:") ? "court_documents" : "all", kind: "discovery", url: "", enabled: true }))];
  const sourceRows = allSources.filter(source => sourceFilter === "all" || source.enabled === false || needsAttention(sourceStates.get(source.id)?.status ?? ""));
  const alerts = (monitor?.alerts ?? []).filter(alert => alertFilter === "all" || !alert.acknowledgedAt);
  const sourceAttention = allSources.filter(source => source.enabled === false || needsAttention(sourceStates.get(source.id)?.status ?? "")).length;
  const searchWarnings = (monitor?.states ?? []).filter(row => typeof row.lastSearchAttemptAt === "string" && (!row.lastSearchSucceededAt || typeof row.lastSearchSucceededAt === "string" && Date.parse(row.lastSearchSucceededAt) < Date.parse(row.lastSearchAttemptAt)));
  const kinds = Object.entries(reference?.release.byKind ?? {}).sort((a, b) => b[1] - a[1]);
  const inventoryFiles = Array.isArray(reference?.inventory?.files) ? reference.inventory.files.length : typeof reference?.inventory?.files === "number" ? reference.inventory.files : reference?.release.sourceFileCount;

  return <main className="reference-page">
    <header className="ref-header"><Link className="ref-back" href="/" prefetch={false}><ArrowLeft size={16} />사건 작업공간</Link><Link className="ref-brand" href="/" prefetch={false}>Firm Engine<span>기준정보 관리</span></Link><span className="ref-private"><ShieldCheck size={14} />내부 검토</span></header>
    <div className="ref-wrap">
      <section className="ref-heading"><div><div className="ref-eyebrow"><Database size={13} />기준정보 · 개정 이력</div><h1>법적 기준정보</h1><p>계산·판단·프롬프트의 적용 기준을 확인하고, 법령과 법원 공고의 변경을 검토합니다. 상담 서류의 현재 기준표는 <a href="/data/checklist">서류 기준정보</a>에서 관리합니다.</p></div><div><Link className="ref-button" href="/roles"><ShieldCheck size={15}/>담당자 권한</Link><button className="ref-button" onClick={() => { void loadReference(); void loadMonitor(); }} disabled={loading || monitorLoading}><RefreshCw size={15} className={loading || monitorLoading ? "ref-spin" : ""} />새로고침</button></div></section>
      <section className="ref-metrics" aria-label="기준정보와 감시 현황">
        <div><span><Database size={15} />등록된 기준</span><strong>{numberText(reference?.release.recordCount)}<small>개</small></strong><p>{reference ? typeof reference.storage.seeded === "number" ? `저장 ${numberText(reference.storage.seeded)} / ${numberText(reference.storage.total)}개${reference.storage.complete ? " · 완료" : " · 저장 확인 필요"}` : reference.storage.seeded ? "저장된 기준정보" : "저장 상태 확인 필요" : "불러오는 중"}</p></div>
        <div><span><BookOpen size={15} />현재 적용 판본</span><strong>{reference?.active ? `v${reference.active.revision}` : "—"}</strong><p title={reference?.active?.id}>{reference?.active?.id ?? "판본 확인 중"}</p></div>
        <div><span><Bell size={15} />미확인 변경</span><strong>{numberText(monitor?.counts.unread)}<small>건</small></strong><p>사람의 검토가 필요한 변경 후보</p></div>
        <div><span><FileSearch size={15} />감시 출처</span><strong>{monitor ? numberText(allSources.length) : "—"}<small>개</small></strong><p>{monitor ? `주의가 필요한 출처 ${sourceAttention.toLocaleString("ko-KR")}개` : "연결 상태 확인 중"}</p></div>
      </section>
      {reference?.bundleInspection && <section className="ref-bundle-inspection" aria-label="기준 적용 계약 상태"><strong>활성 판본 묶음 호환성: {reference.active.bundleReview?"승인됨":"미확인"}</strong><p>등록 기준 {numberText(reference.bundleInspection.artifactCount)}개 · 날짜 기준 미선언 {numberText(reference.bundleInspection.missingDateBasisIds.length)}개 · 경과조치 미확인 {numberText(reference.bundleInspection.unknownTransitionIds.length)}개 · 관할 미선언 {numberText(reference.bundleInspection.missingJurisdictionIds.length)}개</p><small>이 상태는 저장 판본의 무결성·승인 상태와 별도입니다. 날짜·관할·경과조치 조합이 확인되지 않으면 사건 적용 기준을 확정하지 않습니다.</small></section>}
      <section className="ref-release-history" aria-label="기준 판본 이력"><h2>기준 판본 이력 · 복원</h2><p>복원은 선택한 과거 값과 출처 기록으로 새 활성 판본을 만듭니다. 사건 생성본은 수정하지 않으며, 묶음 호환성 승인은 초기화되어 다시 검토해야 합니다.</p>{reference?.history?.map(item=><article key={item.id}><div><strong>r{item.revision} · {item.status}</strong><small>{item.sha256} · {item.actor} · {item.createdAt}</small><p>{item.reason}</p></div>{canApproveReference&&item.status==="superseded"&&<button className="ref-button" disabled={restoreLoading} onClick={()=>void previewRestore(item)}>{restoreLoading&&restoreTarget===item.sha256?"미리보기 중":"복원 미리보기"}</button>}</article>)}{restorePreview&&<div className="ref-restore-preview"><strong>r{restorePreview.targetRelease.revision} 복원 미리보기</strong><p>변경 기준 {restorePreview.changedReferenceIds.length}개 · {restorePreview.changedReferenceIds.slice(0,20).join(", ")||"기준 값 차이 없음"}{restorePreview.changedReferenceIds.length>20?" …":""}</p><p>새 판본은 묶음 호환성 승인을 갖지 않습니다. 사건별 적용은 다시 확인해야 합니다. 보존 중인 사건 파일은 수정하지 않습니다.</p><label>복원 이유<textarea value={restoreReason} onChange={event=>setRestoreReason(event.target.value)} minLength={5} maxLength={4000} rows={3}/></label><button className="ref-button ref-button-primary" disabled={restoreLoading||restoreReason.trim().length<5} onClick={()=>void restoreRelease()}>{restoreLoading?"복원 중":"새 판본으로 복원 확정"}</button></div>}</section><section className="ref-bundle-review" aria-label="기준 묶음 호환성 검토"><h2>기준 묶음 호환성 검토</h2><p>기준 항목의 개별 개정 승인과 별도로, 동일한 활성 판본의 항목 집합이 함께 적용될 수 있는지 검토합니다. 날짜·관할·경과조치는 항목별 선언이 없으면 미확정으로 남습니다.</p><p>현재 묶음 승인: {reference?.active.bundleReview?`승인됨 · ${reference.active.bundleReview.artifactIds.length}개 항목 · ${reference.active.bundleReview.reviewedBy}`:"승인 기록 없음"} · 기반 SHA {reference?.active.bundleReview?.basedOnSha256??"—"}</p>{canApproveReference&&<form onSubmit={approveBundle}><label>검토할 기준 ID (쉼표 또는 줄바꿈으로 구분)<textarea value={bundleArtifacts} onChange={event=>setBundleArtifacts(event.target.value)} rows={3} required/></label><label>호환성 검토 이유<textarea value={bundleReason} onChange={event=>setBundleReason(event.target.value)} minLength={5} maxLength={4000} rows={3} required/></label><button className="ref-button ref-button-primary" disabled={bundleReviewing||!bundleArtifacts.trim()||bundleReason.trim().length<5}>{bundleReviewing?"저장 중":"현재 판본의 묶음 검토 승인"}</button></form>}</section>
      {!!reference?.proposals?.length && <label className="ref-impact-case-ids">영향 미리보기 사건 ID (쉼표 또는 줄바꿈 · 최대 52건)<textarea value={impactCaseIds} onChange={event=>setImpactCaseIds(event.target.value)} rows={2} placeholder="영향을 확인할 사건 ID만 입력" /></label>}{!!reference?.proposals?.length && <section className="ref-pending-proposals" aria-label="기준 개정 후보"><h2>검토 대기 기준 후보</h2>{reference.proposals.map(p=><article key={p.id}><div><strong>{reference.items.find(item=>item.id===p.referenceId)?.title??p.referenceId}</strong><Badge>{p.status}</Badge><p>{p.reason}</p><small>제안자 {p.actor} · 기준판 SHA {p.baseSha256.slice(0,12)}… · 지문 {(p.proposalFingerprint||"지문 없음").slice(0,12)}…</small>{p.effectiveFrom&&<p>제안 시행일 {p.effectiveFrom}; 시행 전에는 현재값에 적용되지 않습니다.</p>}{p.sourceUrls.map(url=><SourceLink key={url} url={url}/>)}</div><div className="ref-proposal-actions">{canApproveReference&&<button className="ref-button" disabled={!!impactLoading} onClick={()=>void previewImpact(p)}>{impactLoading===p.id?"영향 확인 중":"영향 미리보기"}</button>}{canApproveReference&&<button className="ref-button ref-button-primary" disabled={!!activatingProposal||!p.proposalFingerprint||p.baseSha256!==reference.active.sha256||!!(p.effectiveFrom&&p.effectiveFrom>todayKst())} onClick={()=>void activateProposal(p)}>{activatingProposal===p.id?"적용 중":"검토 승인 · 적용"}</button>}</div>{impactPreview?.proposalId===p.id&&<div className="ref-impact-preview"><strong>요청한 사건 {impactPreview.details.length}건 · 영향 확인 {impactPreview.impact.affected.length}건 · 미확정 {impactPreview.impact.unknown.length}건 · 비영향 {impactPreview.impact.unaffected.length}건</strong><p>영향 확인: {impactPreview.impact.affected.join(", ")||"없음"} · 미확정: {impactPreview.impact.unknown.join(", ")||"없음"}</p><small>현재 생성 파일은 수정하지 않았습니다. 사건 상태는 자동 판정하지 않으며, 미확정 의존성은 별도 표시합니다.</small></div>}</article>)}</section>}
      <div className="ref-tabs" role="tablist" aria-label="기준정보 메뉴"><button role="tab" aria-selected={tab === "references"} className={tab === "references" ? "active" : ""} onClick={() => setTab("references")}><Database size={16} />기준정보 테이블</button><button role="tab" aria-selected={tab === "monitor"} className={tab === "monitor" ? "active" : ""} onClick={() => setTab("monitor")}><Bell size={16} />법령·서식 변경{monitor && monitor.counts.unread > 0 && <b>{monitor.counts.unread}</b>}</button></div>

      {tab === "references" && <section className="ref-tab-panel" aria-label="기준정보 테이블">
        <form className="ref-search" onSubmit={search}><label><Search size={17} /><input aria-label="기준정보 검색" value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="기준명, 규칙 ID, 출처, 연결 파일 검색" /></label><select aria-label="기준 분류" value={kind} onChange={event => { setKind(event.target.value); setOffset(0); setSelected(null); }}><option value="">전체 분류</option>{kinds.map(([key, value]) => <option key={key} value={key}>{label(KIND_LABELS, key)} ({value})</option>)}</select><button className="ref-button ref-button-primary" type="submit">검색</button></form>
        {referenceError && <div className="ref-message ref-message-error" role="alert">{referenceError}<button onClick={() => void loadReference()}>다시 불러오기</button></div>}
        <div className={`ref-record-layout ${selected ? "has-detail" : ""}`}>
          <section className="ref-card ref-record-card"><div className="ref-card-heading"><h2>등록 기준 <span>{numberText(reference?.total)}개</span></h2>{loading && <Loader2 size={17} className="ref-spin" />}</div><div className="ref-record-scroll"><table className="ref-record-table"><thead><tr><th>기준 · 적용 범위</th><th>현재 값</th><th>검증 · 실행</th><th><span className="ref-sr-only">상세</span></th></tr></thead><tbody>{reference?.items.map(record => {
            const value = reference.active?.values && Object.hasOwn(reference.active.values, record.id) ? reference.active.values[record.id] : record.value;
            return <tr key={record.id} className={selected?.id === record.id ? "selected" : ""}><td><button className="ref-record-select" onClick={() => chooseRecord(record)}><span className="ref-record-kind">{label(KIND_LABELS, record.kind)}</span><strong>{record.title}</strong><code>{record.id}</code><span className="ref-record-scope">{label(CATEGORY_LABELS, record.category)} · {record.courtIds?.length ? record.courtIds.join(", ") : "적용 관할 확인"}</span></button></td><td><span className="ref-current-preview">{shortValue(value)}</span>{record.unit && <small className="ref-unit">{label(UNIT_LABELS, record.unit)}</small>}</td><td><Badge tone={record.verification === "source_verified" ? "green" : "amber"}>{record.sourceUrls?.length ? label(VERIFY_LABELS, record.verification) : "추가 검증 필요"}</Badge><small className="ref-runtime">{label(RUNTIME_LABELS, record.runtimeMode, "실행 연결 확인")}</small></td><td><button className="ref-icon-button" aria-label={`${record.title} 상세 보기`} onClick={() => chooseRecord(record)}><ChevronRight size={16} /></button></td></tr>;
          })}</tbody></table>{!loading && !reference?.items.length && <div className="ref-empty"><Search size={25} /><h3>{referenceError ? "기준정보를 확인할 수 없습니다." : "검색 결과가 없습니다."}</h3><p>{referenceError ? "연결이 복구되면 다시 불러와 주세요." : "검색어 또는 분류를 바꿔 주세요."}</p></div>}{loading && !reference && <div className="ref-empty"><Loader2 size={25} className="ref-spin" /><p>기준정보를 불러오고 있습니다.</p></div>}</div><div className="ref-pagination"><span>{reference?.total ? `${offset + 1}–${Math.min(offset + reference.items.length, reference.total)} / ${reference.total.toLocaleString("ko-KR")}` : "—"}</span><div><button className="ref-icon-button" aria-label="이전 기준 목록" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}><ChevronLeft size={16} /></button><button className="ref-icon-button" aria-label="다음 기준 목록" disabled={reference?.nextOffset == null || loading} onClick={() => { if (reference?.nextOffset != null) setOffset(reference.nextOffset); }}><ChevronRight size={16} /></button></div></div></section>
          {selected && <aside className="ref-card ref-detail" aria-label="기준 상세"><div className="ref-card-heading"><span className="ref-record-kind">{label(KIND_LABELS, selected.kind)}</span><button className="ref-icon-button" aria-label="상세 닫기" onClick={() => setSelected(null)}><X size={16} /></button></div><div className="ref-detail-body"><h2>{selected.title}</h2><code className="ref-id">{selected.id}</code><div className="ref-detail-badges"><Badge tone={selected.editable ? "green" : "neutral"}>{selected.editable ? "개정 후보 입력 가능" : "검토용 고정 기준"}</Badge><Badge>{label(RUNTIME_LABELS, selected.runtimeMode, "실행 연결 확인")}</Badge></div><dl className="ref-detail-meta"><div><dt>시행일</dt><dd>{selected.effectiveFrom || "추가 검증 필요"}</dd></div><div><dt>적용 종료일</dt><dd>{selected.effectiveTo || "등록되지 않음"}</dd></div><div><dt>관할</dt><dd>{selected.courtIds?.join(", ") || "추가 검증 필요"}</dd></div><div><dt>검증 상태</dt><dd>{label(VERIFY_LABELS, selected.verification)}</dd></div></dl><section className="ref-detail-section"><h3>현재 적용 값{selected.unit && <small>{label(UNIT_LABELS, selected.unit)}</small>}</h3><ValueInspector value={activeValue} /></section><section className="ref-detail-section"><h3>적용 조건</h3><ValueInspector value={selected.condition ?? "등록된 조건을 추가 확인해 주세요."} /></section><section className="ref-detail-section"><h3>결과 · 후속 조치</h3><ValueInspector value={selected.consequence ?? "등록된 후속 조치를 추가 확인해 주세요."} /></section><section className="ref-detail-section"><h3>근거 자료</h3>{selected.sourceUrls?.length ? selected.sourceUrls.map(url => <SourceLink key={url} url={url} />) : <p className="ref-warning-copy">추가 검증 필요 · 연결된 공식 출처가 없습니다.</p>}{!!selected.sourceIds?.length && <p className="ref-source-ids">{selected.sourceIds.join(" · ")}</p>}</section><details className="ref-raw"><summary><Code2 size={14} />연결 코드 · 판본 정보</summary><ul className="ref-consumers">{selected.consumers?.map((consumer, index) => <li key={`${consumer.path}:${consumer.symbol}:${index}`}><code>{consumer.path}</code><span>{consumer.symbol}{consumer.line ? ` · ${consumer.line}행` : ""}</span>{consumer.jsonPointer && <code>{consumer.jsonPointer}</code>}</li>)}</ul><p className="ref-hash">기준 SHA-256<br />{selected.sha256}</p><p className="ref-hash">활성 판본 SHA-256<br />{reference?.active?.sha256 || "판본 확인 필요"}</p></details>
            {selected.editable && <form className="ref-proposal" onSubmit={propose}><h3><Save size={15} />개정 후보 등록</h3><p>원문과 적용일을 대조한 뒤 변경안을 남깁니다. 검토된 후보를 별도로 적용합니다.</p><label>변경 값 (JSON)<textarea className="ref-code-input" value={proposal.value} onChange={event => setProposal({ ...proposal, value: event.target.value })} rows={6} required /></label><label>변경 이유 · 검토 근거<textarea minLength={5} maxLength={4000} value={proposal.reason} onChange={event => setProposal({ ...proposal, reason: event.target.value })} rows={3} placeholder="변경된 조문·공고와 적용 대상, 비교한 내용을 적어 주세요." required /></label><label>공식 출처 주소 <small>한 줄에 하나씩</small><textarea value={proposal.urls} onChange={event => setProposal({ ...proposal, urls: event.target.value })} rows={3} placeholder="https://…" /></label><label>제안 시행일<input type="date" value={proposal.effectiveFrom} onChange={event => setProposal({ ...proposal, effectiveFrom: event.target.value })} /></label><details className="ref-application-contract"><summary>사건 적용 조건 선언 (선택)</summary><p>공식 근거에서 확인한 값을 기록합니다. 비워 두면 적용 날짜·관할·경과조치는 미확정으로 남습니다.</p><label>날짜 기준<select value={proposal.dateBasis} onChange={event=>setProposal({...proposal,dateBasis:event.target.value})}><option value="">미선언</option><option value="applicationDate">신청일 (applicationDate)</option><option value="asOf">평가기준일 (asOf)</option></select></label><label>관할 ID<input value={proposal.jurisdiction} onChange={event=>setProposal({...proposal,jurisdiction:event.target.value})} placeholder="원문에서 확인한 관할 ID" /></label><label>적용 종료일<input type="date" value={proposal.effectiveTo} onChange={event=>setProposal({...proposal,effectiveTo:event.target.value})} /></label><label>경과조치 확인<select value={proposal.transitionStatus} onChange={event=>setProposal({...proposal,transitionStatus:event.target.value as "declared"|"unknown"})}><option value="unknown">미확정</option><option value="declared">원문 확인 완료</option></select></label><label>경과조치 조건 (줄마다 하나)<textarea value={proposal.transitionConditions} onChange={event=>setProposal({...proposal,transitionConditions:event.target.value})} rows={2} placeholder="조건이 없다고 확인한 경우 빈칸으로 둡니다." /></label></details>{proposalError && <div className="ref-message ref-message-error" role="alert">{proposalError}</div>}{proposalMessage && <div className="ref-message ref-message-success" role="status">{proposalMessage}</div>}<button className="ref-button ref-button-primary" disabled={proposing}>{proposing ? <Loader2 size={15} className="ref-spin" /> : <Save size={15} />}{proposing ? "저장 중" : "개정 후보 저장"}</button></form>}
          </div></aside>}
        </div><div className="ref-inventory-note"><ShieldCheck size={14} /><p>{inventoryFiles !== undefined ? `조사 대상 ${inventoryFiles.toLocaleString("ko-KR")}개 파일. ` : ""}{reference?.inventory?.scope || "등록 수는 기준정보의 수이며, 자동 법률 판단의 검증률을 뜻하지 않습니다."}</p></div>
      </section>}

      {tab === "monitor" && <section className="ref-tab-panel" aria-label="법령과 법원 문서 변경 감시">
        {monitorError && <div className="ref-message ref-message-error" role="alert">{monitorError}<button onClick={() => void loadMonitor()}>상태 다시 불러오기</button></div>}
        {searchWarnings.length > 0 && <div className="ref-message ref-message-error" role="status">{searchWarnings.map(row => <p key={String(row.id)}>{label(AGENT_LABELS, String(row.id), "변경 감시")}: 최근 공식 웹검색의 완료 기록이 없습니다. 마지막 시도 {timeLabel(row.lastSearchAttemptAt)}</p>)}</div>}
        <div className="ref-monitor-top"><section className="ref-card ref-schedule"><div className="ref-card-heading"><h2><Clock3 size={17} />정기 확인</h2><Badge tone={monitor?.schedule.runtimeStatus === "enabled" ? "green" : "amber"}>{monitor?.schedule.runtimeStatus === "enabled" ? "실행 상태 확인됨" : monitor?.schedule.configured ? "설정됨 · 실행 상태 미확인" : "예약 설정 확인 필요"}</Badge></div><div className="ref-schedule-body"><strong>{monitor?.schedule.cadence === "daily" ? `하루 1회${typeof monitor.schedule.hour === "number" ? ` · ${String(monitor.schedule.hour).padStart(2, "0")}:00` : ""}` : "주기 확인 중"}</strong><p>{monitor?.schedule.notification === "chatgpt_and_in_app" ? "예약 의도는 저장되어 있습니다. 실제 스케줄러 실행 여부는 연결된 실행 상태 확인 전까지 미확인으로 표시합니다." : "알림 경로를 확인하고 있습니다."}{monitor?.schedule.timezone && <span className="ref-timezone">{monitor.schedule.timezone === "Asia/Seoul" ? "한국 표준시 (KST)" : monitor.schedule.timezone}</span>}</p><small>실제 스케줄러: {monitor?.schedule.runtimeStatus === "enabled" ? "실행 확인" : "미확인"} · 마지막 전체 성공: {timeLabel(monitor?.schedule.lastSuccessAt)} · 최근 실패: {monitor?.schedule.lastFailure ? `${monitor.schedule.lastFailure.status} · ${timeLabel(monitor.schedule.lastFailure.at)}` : "기록 없음"}. 최초 비교본은 변경 알림으로 계산하지 않습니다.</small></div></section><section className="ref-card ref-run-card"><div className="ref-card-heading"><h2><FileSearch size={17} />지금 변경 확인</h2></div><div className="ref-run-body"><label className="ref-sr-only" htmlFor="monitor-agent">확인할 에이전트</label><select id="monitor-agent" value={agent} disabled={running} onChange={event => { setAgent(event.target.value as Agent); setRun(null); }}>{Object.entries(AGENT_LABELS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><button className="ref-button ref-button-primary" onClick={() => void runMonitor()} disabled={running || !monitor}>{running ? <Loader2 size={15} className="ref-spin" /> : <Play size={15} />}{running ? "확인 중" : run?.cursor != null && run.status !== "complete" ? "이어서 확인" : "변경 확인"}</button>{running && <button className="ref-button" onClick={() => { cancelled.current = true; }}><Square size={13} />다음 구간 중지</button>}<p>한 번에 제한된 구간을 확인하고 진행 위치를 남깁니다.</p></div></section></div>
        {run && <div className={`ref-run-progress ref-run-${run.status}`} role="status"><div>{running ? <Loader2 size={17} className="ref-spin" /> : run.status === "complete" ? <Check size={17} /> : <Clock3 size={17} />}<strong>{run.message}</strong></div><span>확인 구간 {run.slices}회 · 이번 변경 후보 {run.newAlerts}건 · 출처 응답 {run.health.length}개{run.pendingDiscoveryCount !== undefined && ` · 원문 확인 대기 ${numberText(run.pendingDiscoveryCount)}건`}</span>{!running && <p>{runOutcome(run.newAlerts, run.health, run.status === "complete", run.issues)}</p>}{run.issues.length > 0 && <ul>{run.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}</div>}
        {!run && monitor?.runs[0] && <section className="ref-card ref-latest-report"><div className="ref-card-heading"><h2><FileSearch size={17} />최근 확인 결과</h2><span>{timeLabel(monitor.runs[0].completedAt ?? monitor.runs[0].startedAt)}</span></div><div><p>{savedRunOutcome(monitor.runs[0])}</p>{monitorIssues(runDetails(monitor.runs[0])).map(issue => <p className="ref-source-error" key={issue}>{issue}</p>)}<small>최근 실행 구간의 결과입니다. 전체 출처의 상태와 실행 이력은 아래에서 확인합니다.</small></div></section>}
        <div className="ref-agents">{(["legislation", "court_documents"] as const).map(id => { const sources = monitor?.sources.filter(source => source.agent === id) ?? []; const enabled = sources.filter(source => source.enabled !== false).length; return <section className="ref-agent" key={id}><span className="ref-agent-icon">{id === "legislation" ? <Scale size={22} /> : <FileSearch size={22} />}</span><div><h3>{AGENT_LABELS[id]}</h3><p>{id === "legislation" ? "법률안·공포·시행 예정·시행을 구분하고 관련 기준을 연결합니다." : "실무준칙·생계비·제출목록·서식과 공식 첨부의 변경을 확인합니다."}</p><small>{monitor ? `등록 ${sources.length}개 · 확인 대상 ${enabled}개` : "출처 확인 중"}</small></div></section>; })}</div>
        <section className="ref-card ref-alerts"><div className="ref-card-heading"><h2><Bell size={17} />변경 알림 <span>{monitor ? numberText(monitor.counts.total) : "—"}건</span></h2><div className="ref-segment"><button className={alertFilter === "unread" ? "active" : ""} onClick={() => setAlertFilter("unread")}>미확인</button><button className={alertFilter === "all" ? "active" : ""} onClick={() => setAlertFilter("all")}>전체</button></div></div>{monitorLoading && !monitor ? <div className="ref-empty"><Loader2 size={24} className="ref-spin" /><p>감시 기록을 불러오고 있습니다.</p></div> : alerts.length ? <div className="ref-alert-list">{alerts.map(alert => <article className={`ref-alert ${alert.acknowledgedAt ? "acknowledged" : ""}`} key={alert.id}><div className="ref-alert-meta"><Badge tone={alert.acknowledgedAt ? "neutral" : "amber"}>{label(STATUS_LABELS, alert.status, "변경 검토 필요")}</Badge><span>{label(AGENT_LABELS, alert.agent)} · {timeLabel(alert.createdAt)}</span></div><h3>{alert.title}</h3><p>{alert.summary}</p>{!!alert.affectedRuleIds?.length && <div className="ref-affected"><span>영향 기준</span>{alert.affectedRuleIds.map(id => <button key={id} onClick={() => inspectRule(id)}>{id}<ChevronRight size={12} /></button>)}</div>}<div className="ref-alert-sources">{alert.sourceUrls?.map(url => <SourceLink key={url} url={url} />)}</div>{alert.affectedRuleIds?.length===1&&reference?.items.some(item=>item.id===alert.affectedRuleIds[0]&&item.editable)&&alert.sourceUrls?.some(url=>/^https:\/\//i.test(url)&&!!safeUrl(url))&&<button className="ref-button" onClick={()=>prepareProposalFromAlert(alert)}>기준 개정 후보 입력 준비</button>}<div className="ref-alert-actions"><span>{alert.acknowledgedAt ? `확인 기록 · ${timeLabel(alert.acknowledgedAt)}` : "기준 적용 전 사람의 검토가 필요합니다."}</span>{!alert.acknowledgedAt && <button className="ref-button" disabled={!!acknowledging} onClick={() => void acknowledge(alert.id)}>{acknowledging === alert.id ? <Loader2 size={14} className="ref-spin" /> : <Check size={14} />}확인 기록 남기기</button>}</div></article>)}</div> : <div className="ref-empty"><Bell size={25} /><h3>{alertFilter === "unread" ? "미확인 변경 알림이 없습니다." : "저장된 변경 알림이 없습니다."}</h3><p>{monitor?.runs.length ? "아래 출처별 확인 상태와 최근 실행 기록을 함께 확인해 주세요." : "첫 확인 후 비교본이 만들어집니다. 이후 변경을 발견하면 알림을 남깁니다."}</p></div>}</section>
        <section className="ref-card ref-sources"><div className="ref-card-heading"><h2><Link2 size={17} />출처별 확인 상태</h2><div className="ref-segment"><button className={sourceFilter === "all" ? "active" : ""} onClick={() => setSourceFilter("all")}>전체</button><button className={sourceFilter === "attention" ? "active" : ""} onClick={() => setSourceFilter("attention")}>확인 필요</button></div></div><div className="ref-source-table"><table><thead><tr><th>공식 출처</th><th>확인 상태</th><th>최근 확인</th></tr></thead><tbody>{sourceRows.map(source => { const state = sourceStates.get(source.id); const status = source.enabled === false ? "disabled" : state?.status; const attention = needsAttention(status ?? ""); return <tr key={source.id}><td><>{source.url ? <SourceLink url={source.url}>{source.title}</SourceLink> : <><strong className="ref-discovered-source">{source.title}</strong><code className="ref-discovered-id">{source.id}</code></>}<small>{label(AGENT_LABELS, source.agent)}</small></></td><td><Badge tone={attention ? "red" : status === "ok" ? "green" : "amber"}>{label(STATUS_LABELS, status, "확인 전")}</Badge>{(source.disabledReason || state?.message) && <p className={attention ? "ref-source-error" : "ref-muted"}>{source.disabledReason || state?.message}</p>}</td><td>{timeLabel(state?.checkedAt)}</td></tr>; })}</tbody></table>{!sourceRows.length && <div className="ref-empty"><p>{monitor ? "해당 출처가 없습니다." : "감시 출처를 불러오는 중입니다."}</p></div>}</div></section>
        <details className="ref-card ref-run-history"><summary><Clock3 size={16} />최근 실행 기록{monitor && <span>{monitor.runs.length}건</span>}</summary><div>{monitor?.runs.length ? monitor.runs.slice(0, 10).map((item, index) => <div className="ref-history-row" key={String(item.id ?? item.runId ?? index)}><div><strong>{label(AGENT_LABELS, typeof item.agent === "string" ? item.agent : undefined, "변경 감시")}</strong><span>{timeLabel(item.completedAt ?? item.finishedAt ?? item.createdAt ?? item.startedAt)}</span><p>{savedRunOutcome(item)}</p></div><Badge tone={item.status === "complete" ? "green" : "amber"}>{label(STATUS_LABELS, typeof item.status === "string" ? item.status : undefined)}</Badge><details><summary>기록 상세</summary><pre>{serial(item)}</pre></details></div>) : <p className="ref-muted">저장된 실행 기록이 없습니다.</p>}</div></details>
      </section>}
    </div>
  </main>;
}
