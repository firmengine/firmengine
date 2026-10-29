import type { CaseRecord, Role } from './model.ts';
import { readReferenceAdminBlockers, readReferenceAdminRevision } from './reference-admin-model.ts';

export type LegalStatus = 'applicable' | 'not_applicable' | 'uncertain' | 'conflict';
export type TaskStatus = 'open' | 'working' | 'waiting' | 'done';
export type ProcedureKind = 'submitted' | 'received' | 'correction_received' | 'correction_submitted' | 'approved' | 'closed' | 'discharged';
export interface Finding { id: string; title: string; status: LegalStatus; source: string; reason: string; proposal?: { status: LegalStatus; source: string; reason: string }; resolvedBy?: Role }
export interface OperationTask { id: string; title: string; assignee: string; status: TaskStatus; due: string; waitReason: string }
export interface ReferenceVersion { id: string; title: string; value: string; effective: string; court: string; source: string; reason: string }
export interface ProcedureEvent { id: string; kind: ProcedureKind; date: string; documentId: string; documentName: string; page: number; reason: string; synthetic: true }
export interface RecoveryJob { id: string; requestId: string; revision: number; status: 'failed' | 'retrying' | 'done' | 'cancelled'; attempts: number; error: string }
export interface OperationsState {
  version: 1; caseId: string; sequence: number; sourceSignature: string; findings: Finding[]; tasks: OperationTask[];
  references: ReferenceVersion[]; activeReferenceId: string; proposal?: Omit<ReferenceVersion, 'id'> & { baseId: string };
  impactPending: boolean; impactNote: string; monitor: { status: 'configured' | 'running' | 'paused' | 'failed'; attempts: number };
  procedures: ProcedureEvent[]; jobs: RecoveryJob[]; history: string[];
}
export type OperationAction =
  | { type: 'legal.propose' | 'legal.resolve'; id: string; status: LegalStatus; source: string; reason: string }
  | { type: 'task.save'; task: OperationTask } | { type: 'task.delete'; id: string }
  | { type: 'task.source'; signature: string }
  | { type: 'reference.propose'; value: Omit<ReferenceVersion, 'id'> }
  | { type: 'reference.approve' } | { type: 'reference.restore'; id: string; reason: string }
  | { type: 'reference.impact'; note: string }
  | { type: 'monitor'; status: OperationsState['monitor']['status']; outcome?: 'success' }
  | { type: 'procedure.add'; event: Omit<ProcedureEvent, 'id' | 'documentName' | 'synthetic'> }
  | { type: 'job.send'; requestId: string; expectedRevision: number }
  | { type: 'job.retry' | 'job.complete' | 'job.cancel'; id: string };

export const operationsKey = (caseId: string) => `firmengine.lab.operations.${caseId}`;
function financialSignature(caseId: string): string | null {
  try { return localStorage.getItem(`firmengine-frontend-financial-demo-v1:${caseId}`); } catch { return null; }
}
export const evidenceSignature = (data: CaseRecord) => JSON.stringify({
  documents: data.documents, fields: data.fields, consultation: data.consultation, incomeType: data.incomeType, months: data.months,
  requirementLinks: data.requirementLinks ?? [], requirementExemptions: data.requirementExemptions ?? [],
  financial: financialSignature(data.id), referenceVersion: readReferenceAdminRevision(data.id),
});
const required = (value: string, label: string) => { if (!value.trim()) throw new Error(`${label}을 입력하세요.`); return value.trim(); };
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const taskKey = (value: string) => value.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
const allowedLegal: LegalStatus[] = ['applicable', 'not_applicable', 'uncertain', 'conflict'];
const allowedTasks: TaskStatus[] = ['open', 'working', 'waiting', 'done'];
export const procedureNext: Record<ProcedureKind | 'none', ProcedureKind[]> = {
  none: ['submitted'], submitted: ['received'], received: ['correction_received', 'approved', 'closed'],
  correction_received: ['correction_submitted', 'closed'], correction_submitted: ['correction_received', 'approved', 'closed'],
  approved: ['discharged', 'closed'], closed: [], discharged: [],
};

export function initialOperations(data: CaseRecord): OperationsState {
  return { version: 1, caseId: data.id, sequence: 1, sourceSignature: evidenceSignature(data),
    findings: ['부양·생계비 적용', '채권 성격·우선순위', '필수 자료·관할 확인'].map((title, i) => ({ id: `finding-${i}`, title, status: data.scenario === 'conflict' && i === 1 ? 'conflict' : 'uncertain', source: '합성 검토 항목', reason: '현재 사건의 근거를 확인하고 제안·검토하세요.' })),
    tasks: [{ id: 'task-initial', title: '대상·기간 및 필수 자료 확인', assignee: '담당자', status: 'open', due: '', waitReason: '' }],
    references: [{ id: 'reference-1', title: '합성 업무 검토 기준', value: '자료의 대상·기간·원문을 확인한 뒤 검토한다.', effective: '2026-10-29', court: '모의 공통', source: '로컬 기능 테스트 fixture', reason: '초기 합성 기준' }],
    activeReferenceId: 'reference-1', impactPending: false, impactNote: '', monitor: { status: 'configured', attempts: 0 }, procedures: [],
    jobs: [{ id: 'job-initial', requestId: 'demo-failed-request', revision: data.revision, status: 'failed', attempts: 1, error: '합성 저장 실패. 실제 서버 요청은 없습니다.' }], history: [] };
}

export function operationBlockers(state: OperationsState): string[] {
  return [...state.findings.filter(f => f.status === 'conflict' || f.status === 'uncertain' || !!f.proposal).map(f => `${f.title}: ${f.proposal ? '제안 검토 대기' : f.status === 'conflict' ? '판단 상충' : '미확정'}`), ...(state.impactPending ? ['변경 기준의 사건 영향 확인 필요'] : [])];
}
export function readOperationBlockers(caseId: string, current?: CaseRecord): string[] {
  try { const raw = localStorage.getItem(operationsKey(caseId)), state = raw ? JSON.parse(raw) as OperationsState : null;
    return [...(state ? current && state.sourceSignature !== evidenceSignature(current) ? ['자료 변경 후 법률 재검토 필요'] : operationBlockers(state) : ['법률 검토 항목을 확인하세요.']), ...readReferenceAdminBlockers(caseId)]; }
  catch { return ['로컬 검토 상태를 확인할 수 없습니다.']; }
}
export function loadOperations(data: CaseRecord): OperationsState {
  try {
    const saved = JSON.parse(localStorage.getItem(operationsKey(data.id)) || 'null');
    if (saved?.version === 1 && saved.caseId === data.id && Number.isSafeInteger(saved.sequence) && typeof saved.sourceSignature === 'string' &&
      [saved.findings, saved.tasks, saved.references, saved.procedures, saved.jobs, saved.history].every(Array.isArray) &&
      saved.findings.every((f: Finding) => typeof f.title === 'string' && allowedLegal.includes(f.status)) &&
      saved.tasks.every((t: OperationTask) => typeof t.title === 'string' && allowedTasks.includes(t.status)) &&
      ['configured', 'running', 'paused', 'failed'].includes(saved.monitor?.status) &&
      saved.references.some((v: ReferenceVersion) => v.id === saved.activeReferenceId)) return saved;
  } catch { /* Start a local fixture when storage is unavailable or corrupt. */ }
  return initialOperations(data);
}

/** Pure local transition; it never calls an API or grants a real legal approval. */
export function applyOperation(original: OperationsState, action: OperationAction, data: CaseRecord, role: Role): OperationsState {
  if (original.caseId !== data.id) throw new Error('사건을 다시 선택하세요.');
  if (role === 'client') throw new Error('법무법인 역할에서 처리하는 모의 업무입니다.');
  const next = structuredClone(original); const id = (prefix: string) => `${prefix}-${++next.sequence}`;
  const log = (text: string) => { next.history = [...next.history, `${role === 'lawyer' ? '변호사' : '담당자'} · ${text}`].slice(-100); };
  switch (action.type) {
    case 'legal.propose': case 'legal.resolve': {
      if (action.type === 'legal.propose' && role !== 'staff' || action.type === 'legal.resolve' && role !== 'lawyer') throw new Error('담당자는 제안하고 변호사는 근거를 확인해 결정합니다.');
      const finding = next.findings.find(f => f.id === action.id); if (!finding || !allowedLegal.includes(action.status)) throw new Error('검토 항목과 상태를 확인하세요.');
      const value = { status: action.status, source: required(action.source, '근거'), reason: required(action.reason, '판단 사유') };
      if (action.type === 'legal.propose') finding.proposal = value;
      else { Object.assign(finding, value, { resolvedBy: role }); delete finding.proposal; }
      log(`${finding.title} ${action.type === 'legal.propose' ? '검토안 제안' : '모의 판단 기록'}`); break;
    }
    case 'task.save': {
      const task = { ...action.task, title: required(action.task.title, '작업명'), assignee: required(action.task.assignee, '담당자') };
      if (!allowedTasks.includes(task.status) || task.due && !validDate(task.due)) throw new Error('작업 상태·기한을 확인하세요.');
      if (task.status === 'waiting') required(task.waitReason, '대기 사유');
      const existing = next.tasks.find(t => t.id === task.id) ?? next.tasks.find(t => taskKey(t.title) === taskKey(task.title));
      if (next.tasks.some(t => t.id !== existing?.id && taskKey(t.title) === taskKey(task.title))) throw new Error('같은 이름의 작업이 있습니다. 해당 작업을 수정하세요.');
      if (existing) Object.assign(existing, task, { id: existing.id }); else next.tasks.push({ ...task, id: id('task') });
      log(`작업 ${existing ? '수정·중복 병합' : '추가'}: ${task.title}`); break;
    }
    case 'task.delete': next.tasks = next.tasks.filter(t => t.id !== action.id); log('작업 삭제'); break;
    case 'task.source': {
      if (next.sourceSignature === action.signature) return original;
      next.sourceSignature = action.signature;
      for (const task of next.tasks) if (task.status === 'done' || task.status === 'waiting') { task.status = 'open'; task.waitReason = '자료가 변경되어 다시 확인해야 합니다.'; }
      for (const finding of next.findings) { finding.status = 'uncertain'; delete finding.proposal; delete finding.resolvedBy; finding.reason = '자료가 변경되어 이전 판단을 다시 확인해야 합니다.'; }
      log('새 자료·철회 상태 감지: 작업·법률 판단 재확인'); break;
    }
    case 'reference.propose': {
      if (role !== 'staff') throw new Error('담당자 역할에서 개정안을 제안하세요.');
      for (const field of ['title', 'value', 'court', 'source', 'reason'] as const) required(action.value[field], field);
      if (!validDate(action.value.effective)) throw new Error('적용일을 확인하세요.');
      next.proposal = { ...action.value, baseId: next.activeReferenceId }; log('기준 개정안 제안: 현재 판본은 유지'); break;
    }
    case 'reference.approve': {
      if (role !== 'lawyer') throw new Error('변호사 역할에서 개정안을 검토하세요.');
      if (!next.proposal || next.proposal.baseId !== next.activeReferenceId) throw new Error('최신 기준을 바탕으로 개정안을 다시 확인하세요.');
      const { baseId: _base, ...value } = next.proposal; const version = { ...value, id: id('reference') }; next.references.push(version); next.activeReferenceId = version.id; delete next.proposal; next.impactPending = true; next.impactNote = ''; log('기준 모의 승인: 사건 영향 확인 필요'); break;
    }
    case 'reference.restore': {
      if (role !== 'lawyer') throw new Error('변호사 역할에서 이전 기준을 복원하세요.');
      const previous = next.references.find(v => v.id === action.id); if (!previous) throw new Error('이전 판본을 찾을 수 없습니다.');
      const version = { ...previous, id: id('reference'), reason: `이전 판본 ${previous.id} 복원: ${required(action.reason, '복원 사유')}` }; next.references.push(version); next.activeReferenceId = version.id; next.impactPending = true; delete next.proposal; log('기준 복원: 새 판본과 영향 확인 기록 생성'); break;
    }
    case 'reference.impact': next.impactNote = required(action.note, '확인한 영향과 후속 조치'); next.impactPending = false; log('필요서류·계산·문서 영향 확인 기록'); break;
    case 'monitor': {
      const prior = next.monitor.status;
      if (action.status === 'running') { if (prior === 'running') throw new Error('이미 모의 점검이 진행 중입니다.'); next.monitor.attempts++; }
      if (action.outcome === 'success' && prior !== 'running') throw new Error('모의 점검을 먼저 시작하세요.');
      next.monitor.status = action.status; log(`모의 변경 점검: ${action.outcome === 'success' ? '완료·변경 없음' : action.status}`); break;
    }
    case 'procedure.add': {
      const event = action.event, previous = next.procedures.at(-1), allowed = procedureNext[previous?.kind ?? 'none'];
      if (!allowed.includes(event.kind)) throw new Error('선행 절차를 먼저 근거와 함께 기록하세요.');
      if (!validDate(event.date) || previous && event.date < previous.date) throw new Error('유효한 날짜와 절차 순서를 확인하세요.');
      const document = data.documents.find(d => d.id === event.documentId && d.status !== 'withdrawn');
      if (!document || !Number.isInteger(event.page) || event.page < 1 || event.page > document.pages) throw new Error('현재 자료와 실제 존재하는 쪽을 선택하세요.');
      next.procedures.push({ ...event, reason: required(event.reason, '기록 사유·근거 설명'), id: id('procedure'), documentName: document.name, synthetic: true }); log('모의 절차 기록 추가 · 실제 제출 없음'); break;
    }
    case 'job.send': {
      const requestId = required(action.requestId, '요청 ID');
      const previous = next.jobs.find(j => j.requestId === requestId);
      if (previous) { if (previous.revision !== action.expectedRevision) throw new Error('같은 요청 ID의 판본이 달라졌습니다. 새 요청 ID를 사용하세요.'); return original; }
      if (action.expectedRevision !== data.revision) throw new Error('STALE_REVISION: 다른 변경이 먼저 저장됐습니다. 최신 판본을 불러오세요.');
      next.jobs.push({ id: id('job'), requestId, revision: data.revision, status: 'failed', attempts: 1, error: '합성 실패를 주입했습니다. 아래 재시도로 복구를 확인하세요.' }); log('모의 요청 1회 저장 · 실패 주입'); break;
    }
    case 'job.retry': case 'job.complete': case 'job.cancel': {
      const job = next.jobs.find(j => j.id === action.id); if (!job) throw new Error('작업을 찾을 수 없습니다.');
      if (action.type === 'job.retry') { if (job.status !== 'failed') throw new Error('실패한 작업만 재시도할 수 있습니다.'); if (job.revision !== data.revision) throw new Error('STALE_REVISION: 최신 사건 판본으로 새 요청 ID를 사용하세요.'); job.status = 'retrying'; job.attempts++; job.error = ''; }
      else if (action.type === 'job.complete') { if (job.status !== 'retrying') throw new Error('재시도 중인 작업만 완료할 수 있습니다.'); if (job.revision !== data.revision) throw new Error('STALE_REVISION: 사건이 변경되어 이전 작업 결과를 채택하지 않습니다.'); job.status = 'done'; }
      else { if (job.status === 'done') throw new Error('완료된 작업은 취소하지 않습니다.'); job.status = 'cancelled'; }
      log(`모의 복구 작업: ${action.type}`); break;
    }
  }
  return next;
}
