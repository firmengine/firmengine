import { useState } from 'react';
import type { CaseRecord, Role } from './model';
import { approveAdminVersion, collectionKinds, collectionLabels, deleteAdminRow, importAdminRows, loadReferenceAdmin,
  newAdminRecord, proposeAdminVersion, referenceAdminKey, referencedBy, restoreAdminVersion, saveAdminRow, sourceReferenceRelease, sourceReferenceCount,
  validateAdminRows, type AdminRecord, type ReferenceAdminState, type ReferenceCollection } from './reference-admin-model';

interface Props { current: CaseRecord; role: Role; onCaseChange: (reason: string) => void }
const collections = Object.keys(collectionLabels) as ReferenceCollection[];
const split = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);
const json = (value: unknown) => JSON.stringify(value, null, 2);
const summarize = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value);

export default function ReferenceAdmin({ current, role, onCaseChange }: Props) {
  const [state, setState] = useState(() => loadReferenceAdmin(current.id));
  const [collection, setCollection] = useState<ReferenceCollection>('parameters'); const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null), [form, setForm] = useState<AdminRecord>(() => newAdminRecord('parameters'));
  const [valueText, setValueText] = useState('1'), [rawText, setRawText] = useState(() => json(newAdminRecord('parameters')));
  const [reason, setReason] = useState(''), [confirmed, setConfirmed] = useState(false), [notice, setNotice] = useState(''), [pending, setPending] = useState(false);
  const active = state.versions.find(version => version.number === state.activeVersion)!;
  const canEdit = role !== 'client', selected = state.draftRows.find(row => row.id === selectedId);
  const readOnly = !canEdit || !!selected && (!selected.editable || !!selected.lockedSafetyInvariant);
  const rows = state.draftRows.filter(row => collectionKinds[collection].includes(row.kind) && [row.id, row.title, row.category].join(' ').toLowerCase().includes(query.toLowerCase()));
  const save = (next: ReferenceAdminState, message: string, affectsCase = false) => {
    setState(next); setConfirmed(false);
    try { localStorage.setItem(referenceAdminKey(current.id), JSON.stringify(next)); setNotice(message); }
    catch { setNotice(`${message} · 저장 공간이 부족해 이 변경은 현재 화면에만 남습니다.`); }
    if (affectsCase) onCaseChange(message);
  };
  const attempt = (work: () => void) => { try { work(); } catch (error) { setNotice(error instanceof Error ? error.message : '스키마와 역할을 확인하세요.'); } };
  const select = (row: AdminRecord, originalId: string | null = row.id) => { setSelectedId(originalId); setForm(structuredClone(row)); setValueText(json(row.value)); setRawText(json(row)); setNotice(''); };
  const create = () => select(newAdminRecord(collection), null);
  const writeRow = (raw: unknown) => { if (!canEdit) throw new Error('법무법인 역할에서 편집하세요.'); const next = saveAdminRow(state, raw, selectedId ?? undefined); save(next, '편집본에 저장했습니다. 현재 적용 판본은 바뀌지 않았습니다.'); select(raw as AdminRecord); };
  const exportJson = () => {
    const file = new Blob([json({ schemaVersion: state.schemaVersion, sourceRelease: sourceReferenceRelease, rows: state.draftRows })], { type: 'application/json' });
    const url = URL.createObjectURL(file), anchor = document.createElement('a'); anchor.href = url; anchor.download = `reference-draft-${current.id}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('현재 편집본 JSON을 내려받았습니다. 운영 기준이나 법적 승인 데이터가 아닙니다.');
  };
  const importJson = async (file: File) => {
    try {
      if (!canEdit) throw new Error('법무법인 역할에서 가져오세요.'); if (file.size > 2_000_000) throw new Error('JSON 파일은 2 MB 이내여야 합니다.');
      const imported = JSON.parse(await file.text()); if (imported?.schemaVersion !== state.schemaVersion) throw new Error('firmengine-reference-lab/v1 스키마 파일이 필요합니다.');
      const next = importAdminRows(state, imported.rows); save(next, `${next.draftRows.length}개 행을 편집본으로 가져왔습니다. 제안·검토 후 적용하세요.`); setSelectedId(null);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'JSON 파일을 확인하세요.'); }
  };
  return <>
    <section className="panel padded"><h2 className="panel-title">스키마 기반 기준정보 관리</h2>
      <p>AX v44의 <code>ReferenceRecord</code> 구조를 사용합니다. 전체 {sourceReferenceRelease.recordCount.toLocaleString()}개 중 공개 기준 {sourceReferenceCount}개를 골라 로컬 편집을 확인합니다. 관할 행은 원본 <code>courtIds</code>에서 만든 관리용 확장입니다.</p>
      <div className="notice blue">원본 {sourceReferenceRelease.id} · {sourceReferenceRelease.sha256.slice(0, 16)}…<br />로컬 적용 v{state.activeVersion} / 편집본 {state.draftRows.length}개 / {state.versions.length}개 판본. 변경은 현재 모의 사건의 검토를 무효화하며 실제 AX 산식·기준 DB를 수정하지 않습니다.</div>
      {notice && <div className="notice amber" role="status">{notice}</div>}
      <div className="form-row"><label className="field">관리 스키마<select value={collection} onChange={e => { const next = e.target.value as ReferenceCollection; setCollection(next); select(newAdminRecord(next), null); }}>{collections.map(key => <option key={key} value={key}>{collectionLabels[key]}</option>)}</select></label><label className="field">ID·이름 검색<input value={query} onChange={e => setQuery(e.target.value)} placeholder="예: param, 소득, 서식" /></label></div>
      <div className="inline-actions"><button className="button primary" disabled={!canEdit} onClick={create}>새 항목</button><button className="button secondary" onClick={exportJson}>편집본 JSON 내보내기</button><label className="button secondary">JSON 가져오기<input type="file" accept="application/json,.json" disabled={!canEdit} onChange={e => { const file = e.target.files?.[0]; if (file) void importJson(file); e.target.value = ''; }} /></label></div>
    </section>
    <section className="panel table-wrap"><table><thead><tr><th>기준 ID / kind</th><th>명칭·값</th><th>원본 편집 계약</th><th>관리</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.id}<br /><small>{row.kind}</small></td><td>{row.title}<br /><small>{summarize(row.value).slice(0, 115)}</small></td><td>{row.editable && !row.lockedSafetyInvariant ? '검토 후 로컬 편집 가능' : '코드·안전 계약 읽기 전용'}<br />{row.unit || '단위 없음'}</td><td><div className="inline-actions"><button className="button secondary" onClick={() => select(row)}>조회·편집</button><button className="button secondary" disabled={!canEdit} onClick={() => select({ ...structuredClone(row), id: `lab.${row.id}`.slice(0, 140) + `.${Date.now().toString(36)}`, editable: true, lockedSafetyInvariant: false, runtimeMode: 'local_simulation', verification: 'local_copy_unreviewed', labSourceId: row.id }, null)}>로컬 사본 추가</button><button className="button secondary" disabled={!canEdit} onClick={() => attempt(() => save(deleteAdminRow(state, row.id), '편집본에서 삭제했습니다. 적용 판본의 이전 행은 보존됩니다.'))}>삭제</button></div></td></tr>)}</tbody></table><p>{rows.length}개 표시. 참조 중인 규칙·관할·연결 ID는 삭제할 수 없습니다.</p></section>
    <section className="panel padded"><h3>{selectedId ? '항목 조회·편집' : '새 로컬 항목 작성'}</h3>
      {readOnly && <div className="notice amber">읽기 전용 원본입니다. 내용은 확인할 수 있으며 ‘로컬 사본 추가’로 새 ID의 모의 정의를 만들 수 있습니다.</div>}
      <form onSubmit={e => { e.preventDefault(); attempt(() => writeRow({ ...form, value: JSON.parse(valueText) })); }}>
        <div className="form-row"><label className="field">고유 ID<input required disabled={readOnly || !!selectedId} value={form.id} onChange={e => setForm({ ...form, id: e.target.value })} /></label><label className="field">kind<select value={form.kind} disabled={readOnly || !!selectedId} onChange={e => setForm({ ...form, kind: e.target.value })}>{[...new Set([...collectionKinds[collection], form.kind])].map(kind => <option key={kind}>{kind}</option>)}</select></label><label className="field">명칭<input required disabled={readOnly} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label></div>
        <div className="form-row"><label className="field">단위<input disabled={readOnly} value={form.unit ?? ''} onChange={e => setForm({ ...form, unit: e.target.value || null })} /></label><label className="field">적용 시작일<input type="date" disabled={readOnly} value={form.effectiveFrom ?? ''} onChange={e => setForm({ ...form, effectiveFrom: e.target.value || null })} /></label><label className="field">적용 종료일<input type="date" disabled={readOnly} value={form.effectiveTo ?? ''} onChange={e => setForm({ ...form, effectiveTo: e.target.value || null })} /></label></div>
        <label className="field">value JSON<textarea rows={7} disabled={readOnly} value={valueText} onChange={e => setValueText(e.target.value)} spellCheck={false} /></label>
        <div className="form-row"><label className="field">출처 URL (쉼표 구분)<input disabled={readOnly} value={form.sourceUrls.join(', ')} onChange={e => setForm({ ...form, sourceUrls: split(e.target.value) })} /></label><label className="field">관할 코드 (쉼표 구분)<input disabled={readOnly} value={form.courtIds.join(', ')} onChange={e => setForm({ ...form, courtIds: split(e.target.value) })} /></label></div>
        <label className="field">연결 기준 ID · labReferences (쉼표 구분)<input disabled={readOnly} value={form.labReferences?.join(', ') ?? ''} onChange={e => setForm({ ...form, labReferences: split(e.target.value) })} /></label>
        {selectedId && <p>현재 참조하는 행: {referencedBy(state.draftRows, selectedId).map(row => row.id).join(', ') || '없음'}<br />원본 소비 위치: {form.consumers.slice(0, 3).map(item => `${item.path} / ${item.symbol}`).join(', ') || '로컬 확장 정의'}</p>}
        <button className="button primary" disabled={readOnly}>스키마 검사 후 편집본 저장</button>
      </form>
      <details><summary>전체 ReferenceRecord JSON 편집</summary><p>폼과 별개의 전체 JSON 편집기입니다. 필수 키·ID·형식·참조를 검증하며 원본 잠금을 우회하지 않습니다.</p><label className="field">전체 레코드 JSON<textarea rows={14} disabled={readOnly} value={rawText} onChange={e => setRawText(e.target.value)} spellCheck={false} /></label><button className="button secondary" disabled={readOnly} onClick={() => attempt(() => writeRow(JSON.parse(rawText)))}>전체 JSON 검사·저장</button></details>
    </section>
    <section className="panel padded"><h3>편집본 제안 · 검토 후 적용</h3><p>현재 적용 {active.rows.length}개 / 편집본 {state.draftRows.length}개. 저장만으로 적용하지 않습니다. 제안은 그 시점의 편집본을 고정합니다.</p>
      <label className="field">변경·복원 사유<textarea value={reason} disabled={!canEdit} onChange={e => setReason(e.target.value)} /></label>
      <button className="button primary" disabled={role !== 'staff' || pending} onClick={async () => { setPending(true); try { save(await proposeAdminVersion(state, reason, role), '편집본 변경안을 고정했습니다. 변호사 검토 후 적용하세요.'); } catch (error) { setNotice(error instanceof Error ? error.message : '변경안을 확인하세요.'); } finally { setPending(false); } }}>담당자 변경안 제안</button>
      {state.proposal && <div className="notice blue">제안 묶음 {state.proposal.rows.length}개 · 기준 v{state.proposal.base} · 지문 {state.proposal.fingerprint.slice(0, 16)}…<br />사유: {state.proposal.reason}</div>}
      <label className="field"><span><input type="checkbox" checked={confirmed} disabled={role !== 'lawyer'} onChange={e => setConfirmed(e.target.checked)} /> 제안 묶음 또는 선택한 이전 판본과 영향 범위를 모의 검토했습니다.</span></label><button className="button primary" disabled={role !== 'lawyer' || !confirmed || !state.proposal} onClick={() => attempt(() => save(approveAdminVersion(state, role, confirmed), '기준 편집본 모의 적용 · 현재 사건 재검토', true))}>변호사 확인 후 모의 적용</button>
      <div className="notice amber">{state.impactPending ? '새 판본의 필요서류·계산·문서 영향을 확인하기 전에는 현재 사건의 검토 완료를 보류합니다.' : state.impactNote || '미확인 변경 영향이 없습니다.'}</div>
      <button className="button secondary" disabled={!canEdit || !state.impactPending} onClick={() => attempt(() => { if (reason.trim().length < 5) throw new Error('확인한 영향과 후속 조치를 사유에 5자 이상 적으세요.'); save({ ...state, impactPending: false, impactNote: reason.trim() }, '기준 변경의 사건 영향 확인', true); })}>작성한 사유로 영향 확인 기록</button>
      <div className="table-wrap"><table><thead><tr><th>로컬 판본</th><th>기록</th><th>복원</th></tr></thead><tbody>{state.versions.slice().reverse().map(version => <tr key={version.number}><td>v{version.number} {version.number === state.activeVersion ? '· 현재 적용' : ''}<br />{version.rows.length}개</td><td>{version.actor} · {version.at}<br />{version.reason}</td><td><button className="button secondary" disabled={role !== 'lawyer' || !confirmed || version.number === state.activeVersion} onClick={() => attempt(() => save(restoreAdminVersion(state, version.number, reason, role, confirmed), '이전 기준을 새 판본으로 모의 복원 · 사건 재검토', true))}>확인 후 새 판본으로 복원</button></td></tr>)}</tbody></table></div>
    </section>
  </>;
}
