import { useEffect, useState } from 'react';
import type { CaseRecord, Role } from './model';
import ReferenceAdmin from './ReferenceAdmin';
import { applyOperation, evidenceSignature, loadOperations, operationBlockers, operationsKey, procedureNext,
  type LegalStatus, type OperationAction, type OperationsState, type OperationTask, type ProcedureKind, type TaskStatus } from './operations-model';

export interface OperationsProps { current: CaseRecord; role: Role; onCaseChange: (reason: string) => void; mode: 'legal' | 'tasks' | 'references' | 'procedures' | 'recovery' }
const legalLabels: Record<LegalStatus, string> = { applicable: '해당 · 검토 기록', not_applicable: '비해당 · 근거 확인', uncertain: '미확정', conflict: '판단 상충' };
const taskLabels: Record<TaskStatus, string> = { open: '대기', working: '진행 중', waiting: '자료·답변 대기', done: '완료' };
const procedureLabels: Record<ProcedureKind, string> = { submitted: '모의 제출', received: '모의 접수', correction_received: '모의 보정명령', correction_submitted: '모의 보정 제출', approved: '모의 인가 기록', closed: '모의 폐지 기록', discharged: '모의 면책 기록' };
const monitorLabels = { configured: '설정됨', running: '실행 중', paused: '일시 중단', failed: '확인 실패' };
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const emptyTask = (): OperationTask => ({ id: '', title: '', assignee: '담당자', status: 'open', due: '', waitReason: '' });

/** A key boundary keeps per-case browser state isolated when the selected case changes. */
export default function Operations(props: OperationsProps) { return <CaseOperations key={props.current.id} {...props} />; }
function CaseOperations({ current, role, onCaseChange, mode }: OperationsProps) {
  const [state, setState] = useState(() => loadOperations(current));
  const [notice, setNotice] = useState(''); const [storageError, setStorageError] = useState(false);
  const [task, setTask] = useState(emptyTask);
  const [requestId, setRequestId] = useState('request-demo-1'); const [expectedRevision, setExpectedRevision] = useState(current.revision);
  const [event, setEvent] = useState({ kind: 'submitted' as ProcedureKind, date: today(), documentId: '', page: 1, reason: '' });
  const canEdit = role !== 'client';
  const persist = (next: OperationsState) => { setState(next); try { localStorage.setItem(operationsKey(current.id), JSON.stringify(next)); setStorageError(false); } catch { setStorageError(true); } };
  useEffect(() => { try { localStorage.setItem(operationsKey(current.id), JSON.stringify(state)); } catch { setStorageError(true); } }, [current.id, state]);
  useEffect(() => {
    if (state.sourceSignature !== evidenceSignature(current)) {
      try { persist(applyOperation(state, { type: 'task.source', signature: evidenceSignature(current) }, current, 'staff')); setNotice('자료가 변경되어 작업과 법률 판단을 다시 확인해야 합니다.'); }
      catch { setNotice('자료 변경 상태를 다시 확인하세요.'); }
    }
  }, [current.documents, current.fields, current.consultation, current.incomeType, current.months, current.requirementLinks, current.requirementExemptions, current.revision, current.id]);
  const run = (action: OperationAction, reason: string, affectsCase = true) => {
    try { const next = applyOperation(state, action, current, role); persist(next); setNotice(next === state ? '같은 요청·작업을 재사용했습니다. 중복 항목을 만들지 않았습니다.' : reason); if (next !== state && affectsCase) onCaseChange(reason); return true; }
    catch (error) { setNotice(error instanceof Error ? error.message : '입력과 역할을 확인하세요.'); return false; }
  };
  const blockers = operationBlockers(state);
  return <div>
    <div className="notice blue">로컬 모의 기능입니다. 실제 법률 판단·법원 제출·서버 저장·예약 점검을 실행하지 않습니다.</div>
    {role === 'client' && <div className="notice amber">의뢰인 역할에서는 법무법인 검토 이력을 조회합니다. 변경은 담당자·변호사 역할로 전환하세요.</div>}
    {notice && <div className="notice amber" role="status">{notice}</div>}
    {storageError && <div className="notice amber">로컬 저장소를 사용할 수 없어 새로고침 후 이 화면의 변경이 보존되지 않을 수 있습니다.</div>}
    {mode === 'legal' && <>
      <div className="panel padded"><h2 className="panel-title">근거가 있는 법률 검토</h2><p>담당자가 상태와 근거를 제안하고 변호사가 모의 판단을 기록합니다. 상충·미확정·미검토 제안은 검토 완료를 보류합니다.</p><div className="notice amber">{blockers.length ? `검토 보류 ${blockers.length}건: ${blockers.join(' / ')}` : '모의 검토 항목이 정리됐습니다. 실제 사건 승인이나 인가를 의미하지 않습니다.'}</div></div>
      {state.findings.map(finding => <LegalCard key={finding.id} finding={finding} role={role} onSave={value => run({ type: role === 'lawyer' ? 'legal.resolve' : 'legal.propose', id: finding.id, ...value }, `${finding.title} 모의 검토 변경`)} />)}
    </>}
    {mode === 'tasks' && <>
      <div className="panel padded"><h2 className="panel-title">담당자 작업</h2><p>이름이 같은 작업은 하나로 합칩니다. 자료가 추가·철회되면 완료·대기 작업과 이전 법률 판단을 다시 확인합니다.</p>
        <form onSubmit={e => { e.preventDefault(); if (run({ type: 'task.save', task }, '작업 저장', false)) setTask(emptyTask()); }}>
          <div className="form-row"><label className="field">작업명<input required value={task.title} disabled={!canEdit} onChange={e => setTask({ ...task, title: e.target.value })} /></label><label className="field">담당자<input required value={task.assignee} disabled={!canEdit} onChange={e => setTask({ ...task, assignee: e.target.value })} /></label></div>
          <div className="form-row"><label className="field">상태<select value={task.status} disabled={!canEdit} onChange={e => setTask({ ...task, status: e.target.value as TaskStatus })}>{Object.entries(taskLabels).map(([key, text]) => <option value={key} key={key}>{text}</option>)}</select></label><label className="field">기한<input type="date" value={task.due} disabled={!canEdit} onChange={e => setTask({ ...task, due: e.target.value })} /></label></div>
          <label className="field">대기 사유<input value={task.waitReason} required={task.status === 'waiting'} disabled={!canEdit} onChange={e => setTask({ ...task, waitReason: e.target.value })} /></label><div className="inline-actions"><button className="button primary" disabled={!canEdit}>{task.id ? '작업 수정' : '작업 추가'}</button><button type="button" className="button secondary" onClick={() => setTask(emptyTask())}>입력 초기화</button></div>
        </form></div>
      <div className="panel table-wrap"><table><thead><tr><th>작업</th><th>담당자·기한</th><th>상태·대기 사유</th><th>관리</th></tr></thead><tbody>{state.tasks.map(item => <tr key={item.id}><td>{item.title}</td><td>{item.assignee}<br />{item.due || '기한 미정'}</td><td>{taskLabels[item.status]}<br />{item.waitReason}</td><td><div className="inline-actions"><button className="button secondary" disabled={!canEdit} onClick={() => setTask({ ...item })}>편집</button><button className="button secondary" disabled={!canEdit} onClick={() => run({ type: 'task.delete', id: item.id }, '작업 삭제', false)}>삭제</button></div></td></tr>)}</tbody></table></div>
    </>}
    {mode === 'references' && <>
      <ReferenceAdmin current={current} role={role} onCaseChange={onCaseChange} />
      <div className="panel padded"><h3>변경 점검 · {monitorLabels[state.monitor.status]}</h3><p>모의 시도 {state.monitor.attempts}회. 아래 조작은 스케줄러·검색·외부 API를 실행하지 않습니다.</p><div className="inline-actions"><button className="button primary" disabled={!canEdit || state.monitor.status === 'running'} onClick={() => run({ type: 'monitor', status: 'running' }, state.monitor.status === 'failed' ? '실패 점검 모의 재시도' : '변경 점검 모의 시작', false)}>{state.monitor.status === 'failed' ? '실패 점검 재시도' : '모의 점검 시작'}</button><button className="button secondary" disabled={!canEdit || state.monitor.status !== 'running'} onClick={() => run({ type: 'monitor', status: 'configured', outcome: 'success' }, '모의 점검 완료 · 변경 없음', false)}>모의 완료</button><button className="button secondary" disabled={!canEdit || state.monitor.status !== 'running'} onClick={() => run({ type: 'monitor', status: 'failed' }, '모의 수집 실패 주입', false)}>실패 주입</button><button className="button secondary" disabled={!canEdit} onClick={() => run({ type: 'monitor', status: 'paused' }, '모의 점검 일시 중단', false)}>일시 중단</button><button className="button secondary" disabled={!canEdit || state.monitor.status === 'running'} onClick={() => run({ type: 'monitor', status: 'configured' }, '모의 점검 설정', false)}>설정 상태 복원</button></div></div>
    </>}
    {mode === 'procedures' && <>
      <div className="panel padded"><h2 className="panel-title">근거가 있는 모의 절차 이력</h2><div className="notice amber">합성 사건은 실제 제출할 수 없습니다. 문서 생성·검토 완료와 법원 절차 상태는 별개입니다.</div><p>현재 모의 단계: {state.procedures.length ? procedureLabels[state.procedures.at(-1)!.kind] : '기록 없음'}</p>
        <form onSubmit={e => { e.preventDefault(); run({ type: 'procedure.add', event }, '모의 절차 이력 추가 · 실제 법원 처리 없음', false); }}><div className="form-row"><label className="field">기록할 사건<select value={event.kind} disabled={!canEdit} onChange={e => setEvent({ ...event, kind: e.target.value as ProcedureKind })}>{Object.entries(procedureLabels).map(([key, text]) => <option key={key} value={key}>{text}{procedureNext[state.procedures.at(-1)?.kind ?? 'none'].includes(key as ProcedureKind) ? ' · 기록 가능' : ''}</option>)}</select></label><label className="field">확인 날짜<input type="date" required value={event.date} disabled={!canEdit} onChange={e => setEvent({ ...event, date: e.target.value })} /></label></div><div className="form-row"><label className="field">근거 자료<select required value={event.documentId} disabled={!canEdit} onChange={e => setEvent({ ...event, documentId: e.target.value })}><option value="">자료 선택</option>{current.documents.filter(d => d.status !== 'withdrawn').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label className="field">쪽<input type="number" min="1" step="1" value={event.page} disabled={!canEdit} onChange={e => setEvent({ ...event, page: Number(e.target.value) })} /></label></div><label className="field">기록 사유·근거 설명<textarea required value={event.reason} disabled={!canEdit} onChange={e => setEvent({ ...event, reason: e.target.value })} /></label><div className="inline-actions"><button className="button primary" disabled={!canEdit}>모의 이력 기록</button><button className="button secondary" type="button" disabled>실제 법원 제출 불가</button></div></form></div>
      <div className="panel table-wrap"><table><thead><tr><th>모의 절차</th><th>날짜</th><th>자료·쪽</th><th>기록 사유</th></tr></thead><tbody>{state.procedures.map(item => <tr key={item.id}><td>{procedureLabels[item.kind]}</td><td>{item.date}</td><td>{item.documentName} · {item.page}쪽</td><td>{item.reason}</td></tr>)}</tbody></table></div>
    </>}
    {mode === 'recovery' && <>
      <div className="panel padded"><h2 className="panel-title">저장 충돌·재시도 실험</h2><p>모의 요청은 실패 상태로 시작합니다. 동일 요청 ID를 다시 보내면 기존 기록을 재사용하고, 오래된 판본은 저장을 거부합니다. 현재 사건 판본: {current.revision}</p><form onSubmit={e => { e.preventDefault(); run({ type: 'job.send', requestId, expectedRevision }, '모의 저장 요청 · 실패 주입', false); }}><div className="form-row"><label className="field">요청 ID<input required value={requestId} disabled={!canEdit} onChange={e => setRequestId(e.target.value)} /></label><label className="field">예상 사건 판본<input type="number" min="0" step="1" value={expectedRevision} disabled={!canEdit} onChange={e => setExpectedRevision(Number(e.target.value))} /></label></div><div className="inline-actions"><button className="button primary" disabled={!canEdit}>같은 ID로 모의 저장</button><button type="button" className="button secondary" onClick={() => { setExpectedRevision(current.revision); setNotice('최신 사건 판본을 불러왔습니다. 새 요청은 새 ID로 보내세요.'); }}>최신 판본 불러오기</button><button type="button" className="button secondary" onClick={() => setExpectedRevision(Math.max(0, current.revision - 1))}>오래된 판본 주입</button></div></form></div>
      <div className="panel table-wrap"><table><thead><tr><th>요청 ID·판본</th><th>상태·시도</th><th>실패·다음 행동</th><th>복구</th></tr></thead><tbody>{state.jobs.map(job => <tr key={job.id}><td>{job.requestId}<br />판본 {job.revision}</td><td>{({ failed: '실패', retrying: '재시도 중', done: '완료', cancelled: '취소' })[job.status]} · {job.attempts}회</td><td>{job.error || '실제 서버 작업 없음'}</td><td><div className="inline-actions"><button className="button secondary" disabled={!canEdit || job.status !== 'failed'} onClick={() => run({ type: 'job.retry', id: job.id }, '실패 작업 모의 재시도', false)}>재시도</button><button className="button secondary" disabled={!canEdit || job.status !== 'retrying'} onClick={() => run({ type: 'job.complete', id: job.id }, '재시도 모의 완료', false)}>완료 주입</button><button className="button secondary" disabled={!canEdit || ['done', 'cancelled'].includes(job.status)} onClick={() => run({ type: 'job.cancel', id: job.id }, '모의 작업 취소', false)}>취소</button></div></td></tr>)}</tbody></table></div>
    </>}
    <div className="panel padded"><h3>이 화면의 변경 이력</h3>{state.history.length ? <ol>{state.history.slice(-12).reverse().map((item, index) => <li key={`${state.history.length - index}`}>{item}</li>)}</ol> : <p>아직 기록된 모의 변경이 없습니다.</p>}</div>
  </div>;
}

function LegalCard({ finding, role, onSave }: { finding: OperationsState['findings'][number]; role: Role; onSave: (value: { status: LegalStatus; source: string; reason: string }) => boolean }) {
  const [value, setValue] = useState({ status: finding.proposal?.status ?? finding.status, source: finding.proposal?.source ?? finding.source, reason: finding.proposal?.reason ?? finding.reason });
  useEffect(() => setValue({ status: finding.proposal?.status ?? finding.status, source: finding.proposal?.source ?? finding.source, reason: finding.proposal?.reason ?? finding.reason }), [finding]);
  return <div className="panel padded"><h3>{finding.title} <span className={`badge ${finding.status === 'conflict' ? 'red' : finding.status === 'uncertain' ? 'amber' : 'green'}`}>{legalLabels[finding.status]}</span></h3><p>기록 근거: {finding.source}<br />사유: {finding.reason}</p>{finding.proposal && <div className="notice blue">담당자 제안: {legalLabels[finding.proposal.status]} · {finding.proposal.source} · {finding.proposal.reason}</div>}<form onSubmit={e => { e.preventDefault(); onSave(value); }}><label className="field">판단 상태<select disabled={role === 'client'} value={value.status} onChange={e => setValue({ ...value, status: e.target.value as LegalStatus })}>{Object.entries(legalLabels).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label><div className="form-row"><label className="field">원문·규칙 근거<input required disabled={role === 'client'} value={value.source} onChange={e => setValue({ ...value, source: e.target.value })} /></label><label className="field">판단 사유<input required disabled={role === 'client'} value={value.reason} onChange={e => setValue({ ...value, reason: e.target.value })} /></label></div><button className="button primary" disabled={role === 'client'}>{role === 'lawyer' ? '변호사 모의 판단 기록' : '담당자 검토안 제안'}</button></form></div>;
}
