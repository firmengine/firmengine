import seed from './reference-admin-seed.json' with { type: 'json' };
import type { Role } from './model.ts';

/** Native AX ReferenceRecord shape, plus labReferences for explicit local links. */
export interface AdminRecord {
  id: string; kind: string; category: string; title: string; value: unknown; unit?: string | null;
  sourceIds: string[]; sourceUrls: string[]; effectiveFrom: string | null; effectiveTo: string | null; courtIds: string[];
  verification: string; runtimeMode: string; editable: boolean; consumers: { path: string; symbol: string }[];
  condition: unknown; consequence: unknown; requiresHumanReview: boolean; sha256: string;
  lockedSafetyInvariant?: boolean; placeholders?: string[]; ruleIds?: string[]; labReferences?: string[]; [key: string]: unknown;
}
export type ReferenceCollection = 'rules' | 'parameters' | 'documentKinds' | 'templates' | 'policies' | 'courts';
export const collectionKinds: Record<ReferenceCollection, string[]> = { rules: ['legal_rule', 'workflow', 'document_rule'], parameters: ['parameter'], documentKinds: ['document_family', 'intake_document'], templates: ['form'], policies: ['prompt', 'application_policy'], courts: ['court'] };
export const collectionLabels: Record<ReferenceCollection, string> = { rules: '규칙·업무 조건', parameters: '산식 매개변수', documentKinds: '문서 종류', templates: '서식 명세', policies: '프롬프트·정책', courts: '관할 목록' };
export interface AdminVersion { number: number; rows: AdminRecord[]; reason: string; actor: string; at: string }
export interface ReferenceAdminState {
  schemaVersion: 'firmengine-reference-lab/v1'; caseId: string; activeVersion: number; versions: AdminVersion[];
  draftRows: AdminRecord[]; proposal?: { base: number; rows: AdminRecord[]; reason: string; fingerprint: string };
  impactPending: boolean; impactNote: string;
}
export const referenceAdminKey = (caseId: string) => `firmengine.lab.references.${caseId}`;
export function readReferenceAdminRevision(caseId: string): number {
  try { const state = JSON.parse(localStorage.getItem(referenceAdminKey(caseId)) || 'null'); return Number.isSafeInteger(state?.activeVersion) ? state.activeVersion : 1; } catch { return 1; }
}
export const sourceReferenceRelease = seed.sourceRelease;
export const sourceReferenceCount = seed.rows.length;
const stringArray = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 2000 && value.every(item => typeof item === 'string' && item.length <= 1000);
const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const validDate = (value: unknown) => value === null || typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const requireReason = (reason: string) => { if (reason.trim().length < 5) throw new Error('변경·검토 사유를 5자 이상 입력하세요.'); return reason.trim(); };
function safeJson(value: unknown, depth = 0): boolean {
  if (depth > 25) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(item => safeJson(item, depth + 1));
  if (plain(value)) return Object.keys(value).every(key => !['__proto__', 'prototype', 'constructor'].includes(key) && safeJson(value[key], depth + 1));
  return value === null || ['string', 'boolean'].includes(typeof value);
}
export function validateAdminRow(value: unknown): asserts value is AdminRecord {
  if (!plain(value) || !safeJson(value)) throw new Error('레코드는 안전한 JSON 객체여야 합니다.');
  if (typeof value.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{1,159}$/.test(value.id)) throw new Error('ID는 영문·숫자·점·밑줄·콜론·하이픈으로 입력하세요.');
  if (typeof value.kind !== 'string' || !Object.values(collectionKinds).flat().includes(value.kind)) throw new Error('지원하는 kind를 선택하세요.');
  for (const key of ['category', 'title', 'verification', 'runtimeMode'] as const) if (typeof value[key] !== 'string' || !value[key].trim()) throw new Error(`${key}는 필수 문자열입니다.`);
  for (const key of ['sourceIds', 'sourceUrls', 'courtIds'] as const) if (!stringArray(value[key])) throw new Error(`${key}는 문자열 배열이어야 합니다.`);
  if (!['editable', 'requiresHumanReview'].every(key => typeof value[key] === 'boolean') || !Array.isArray(value.consumers) || value.consumers.some(row => !plain(row) || typeof row.path !== 'string' || typeof row.symbol !== 'string')) throw new Error('editable·requiresHumanReview와 consumers 스키마를 확인하세요.');
  if (!Object.hasOwn(value, 'value') || !Object.hasOwn(value, 'condition') || !Object.hasOwn(value, 'consequence') || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)) throw new Error('value·condition·consequence·sha256 필드를 확인하세요.');
  if (!validDate(value.effectiveFrom) || !validDate(value.effectiveTo) || value.effectiveFrom && value.effectiveTo && String(value.effectiveFrom) > String(value.effectiveTo)) throw new Error('적용 시작·종료일을 확인하세요.');
  for (const url of value.sourceUrls as string[]) { try { const parsed = new URL(url); if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error(); } catch { throw new Error('출처 URL은 인증정보 없는 HTTPS 주소여야 합니다.'); } }
  for (const key of ['labReferences', 'ruleIds', 'placeholders']) if (value[key] !== undefined && !stringArray(value[key])) throw new Error(`${key}는 문자열 배열이어야 합니다.`);
  if (value.kind === 'parameter') {
    if (['KRW', 'KRW/month'].includes(String(value.unit)) && !(typeof value.value === 'string' && /^\d{1,30}$/.test(value.value))) throw new Error('원 단위 금액은 0 이상의 정수 문자열이어야 합니다.');
    if (['months', 'years', 'basis_points'].includes(String(value.unit)) && !(typeof value.value === 'number' && Number.isSafeInteger(value.value) && value.value > 0 && value.value <= 12000)) throw new Error('기간·비율 값은 양의 안전한 정수여야 합니다.');
    if (value.unit === 'rational' && !(plain(value.value) && Number.isSafeInteger(value.value.numerator) && Number(value.value.numerator) >= 0 && Number.isSafeInteger(value.value.denominator) && Number(value.value.denominator) > 0)) throw new Error('분수는 0 이상 numerator와 양의 denominator가 필요합니다.');
    if (value.unit === 'ISO-8601-date' && (value.value === null || !validDate(value.value))) throw new Error('날짜 매개변수는 YYYY-MM-DD 날짜여야 합니다.');
  }
  if (value.kind === 'prompt') {
    if (typeof value.value !== 'string' || !value.value.trim() || value.value.length > 20000) throw new Error('프롬프트 value는 비어 있지 않은 문자열이어야 합니다.');
    const tokens = [...new Set([...value.value.matchAll(/\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g)].map(match => match[1]))].sort();
    if (JSON.stringify(tokens) !== JSON.stringify([...(value.placeholders as string[] ?? [])].sort())) throw new Error('프롬프트 자리표시자와 placeholders가 다릅니다.');
  }
  if (['legal_rule', 'workflow', 'document_rule', 'document_family', 'intake_document', 'form', 'court'].includes(value.kind) && !plain(value.value)) throw new Error('이 kind의 value는 JSON 객체여야 합니다.');
  if (value.kind === 'form' && (!plain(value.value) || typeof value.value.code !== 'string' || !value.value.code.trim())) throw new Error('서식 value.code가 필요합니다.');
  if (value.kind === 'court' && (!plain(value.value) || typeof value.value.code !== 'string' || !/^[a-z][a-z0-9_-]+$/.test(value.value.code))) throw new Error('관할 value.code를 확인하세요.');
}
export function referencedBy(rows: AdminRecord[], id: string): AdminRecord[] {
  const target = rows.find(row => row.id === id), code = target?.kind === 'court' && plain(target.value) ? target.value.code : null;
  return rows.filter(row => row.id !== id && (referenceIds(row).includes(id) || code !== null && row.courtIds.includes(String(code))));
}
const referenceIds = (row: AdminRecord): string[] => [...row.labReferences ?? [], ...row.ruleIds ?? [], ...(plain(row.value) && stringArray(row.value.ruleIds) ? row.value.ruleIds : [])];
export function validateAdminRows(value: unknown): AdminRecord[] {
  if (!Array.isArray(value) || !value.length || value.length > 500) throw new Error('편집 묶음은 1~500개 레코드여야 합니다.');
  value.forEach(validateAdminRow); const rows = value as AdminRecord[], ids = new Set(rows.map(row => row.id));
  if (ids.size !== rows.length) throw new Error('중복 ID가 있습니다.');
  const courts = new Set(rows.filter(row => row.kind === 'court').map(row => String((row.value as Record<string, unknown>).code)));
  if (courts.size !== rows.filter(row => row.kind === 'court').length) throw new Error('동일 관할 code가 중복됐습니다.');
  for (const row of rows) {
    for (const id of referenceIds(row)) if (!ids.has(id)) throw new Error(`${row.id}: 연결 기준 ${id}가 없습니다.`);
    for (const code of row.courtIds) if (!courts.has(code)) throw new Error(`${row.id}: 관할 ${code}가 없습니다.`);
  }
  return structuredClone(rows);
}
export function initialReferenceAdmin(caseId: string): ReferenceAdminState {
  const rows = validateAdminRows(seed.rows); return { schemaVersion: 'firmengine-reference-lab/v1', caseId, activeVersion: 1, versions: [{ number: 1, rows, reason: `AX v44 공개 기준 중 ${sourceReferenceCount}개 행을 가져온 로컬 부분집합. 최신성·법적 승인 아님.`, actor: '공개 seed', at: new Date().toISOString() }], draftRows: structuredClone(rows), impactPending: false, impactNote: '' };
}
function comparable(value: unknown, root = true): string {
  if (Array.isArray(value)) return `[${value.map(item => comparable(item, false)).join(',')}]`;
  if (plain(value)) return `{${Object.keys(value).filter(key => !root || key !== 'sha256').sort().map(key => `${JSON.stringify(key)}:${comparable(value[key], false)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function importAdminRows(state: ReferenceAdminState, raw: unknown): ReferenceAdminState {
  const draftRows = validateAdminRows(raw), active = state.versions.find(version => version.number === state.activeVersion)!;
  for (const row of active.rows.filter(item => !item.editable || item.lockedSafetyInvariant)) {
    const replacement = draftRows.find(item => item.id === row.id);
    if (!replacement || comparable(replacement) !== comparable(row)) throw new Error(`읽기 전용 원본 ${row.id}를 바꿀 수 없습니다. 새 ID의 로컬 사본을 사용하세요.`);
  }
  return { ...state, draftRows };
}
export function loadReferenceAdmin(caseId: string): ReferenceAdminState {
  try { const state = JSON.parse(localStorage.getItem(referenceAdminKey(caseId)) || 'null') as ReferenceAdminState; if (state?.schemaVersion === 'firmengine-reference-lab/v1' && state.caseId === caseId && Array.isArray(state.versions) && state.versions.some(v => v.number === state.activeVersion)) { validateAdminRows(state.draftRows); state.versions.forEach(v => validateAdminRows(v.rows)); return state; } } catch { /* Fall back to the public local subset. */ }
  return initialReferenceAdmin(caseId);
}
export function readReferenceAdminBlockers(caseId: string): string[] {
  try { const state = JSON.parse(localStorage.getItem(referenceAdminKey(caseId)) || 'null'); return state?.impactPending ? ['기준 편집본 적용 후 사건 영향 확인 필요'] : []; } catch { return ['기준 편집 상태 확인 필요']; }
}
export function saveAdminRow(state: ReferenceAdminState, raw: unknown, originalId?: string): ReferenceAdminState {
  validateAdminRow(raw); const original = originalId ? state.draftRows.find(row => row.id === originalId) : null;
  if (original && (!original.editable || original.lockedSafetyInvariant)) throw new Error('원본의 코드·안전 불변조건은 읽기 전용입니다. 로컬 사본으로 복사해 편집하세요.');
  if (originalId && (!original || raw.id !== originalId)) throw new Error('기존 ID는 바꾸지 않습니다. 새 ID로 복사해 추가하세요.');
  if (!originalId && state.draftRows.some(row => row.id === raw.id)) throw new Error('동일 ID가 이미 있습니다.');
  const draftRows = validateAdminRows(original ? state.draftRows.map(row => row.id === originalId ? raw : row) : [...state.draftRows, raw]);
  return { ...state, draftRows };
}
export function deleteAdminRow(state: ReferenceAdminState, id: string): ReferenceAdminState {
  const row = state.draftRows.find(item => item.id === id); if (!row) throw new Error('항목을 찾을 수 없습니다.');
  const users = referencedBy(state.draftRows, id); if (users.length) throw new Error(`다른 기준에서 참조 중입니다: ${users.map(r => r.id).join(', ')}`);
  if (!row.editable || row.lockedSafetyInvariant) throw new Error('읽기 전용 원본은 삭제하지 않습니다.');
  return { ...state, draftRows: validateAdminRows(state.draftRows.filter(item => item.id !== id)) };
}
const hash = async (value: unknown) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))].map(byte => byte.toString(16).padStart(2, '0')).join('');
export async function proposeAdminVersion(state: ReferenceAdminState, reason: string, role: Role): Promise<ReferenceAdminState> {
  if (role !== 'staff') throw new Error('담당자 역할에서 변경안을 제안하세요.');
  const rows = importAdminRows(state, state.draftRows).draftRows; for (const row of rows) { const { sha256: _hash, ...content } = row; row.sha256 = await hash(content); }
  return { ...state, proposal: { base: state.activeVersion, rows, reason: requireReason(reason), fingerprint: await hash(rows) } };
}
export function approveAdminVersion(state: ReferenceAdminState, role: Role, confirmed: boolean): ReferenceAdminState {
  if (role !== 'lawyer' || !confirmed) throw new Error('변호사 역할에서 변경 묶음 확인에 체크한 뒤 적용하세요.');
  if (!state.proposal || state.proposal.base !== state.activeVersion) throw new Error('현재 판본에서 변경안을 다시 제안하세요.');
  const version = { number: Math.max(...state.versions.map(v => v.number)) + 1, rows: validateAdminRows(state.proposal.rows), reason: state.proposal.reason, actor: '모의 검토 변호사', at: new Date().toISOString() };
  return { ...state, activeVersion: version.number, versions: [...state.versions, version], draftRows: structuredClone(version.rows), proposal: undefined, impactPending: true, impactNote: '' };
}
export function restoreAdminVersion(state: ReferenceAdminState, number: number, reason: string, role: Role, confirmed: boolean): ReferenceAdminState {
  if (role !== 'lawyer' || !confirmed) throw new Error('변호사 역할에서 복원할 기준 확인에 체크하세요.');
  const target = state.versions.find(v => v.number === number); if (!target) throw new Error('복원 판본을 찾을 수 없습니다.');
  const version = { number: Math.max(...state.versions.map(v => v.number)) + 1, rows: structuredClone(target.rows), reason: `v${number} 복원: ${requireReason(reason)}`, actor: '모의 검토 변호사', at: new Date().toISOString() };
  return { ...state, activeVersion: version.number, versions: [...state.versions, version], draftRows: structuredClone(version.rows), proposal: undefined, impactPending: true, impactNote: '' };
}
export function newAdminRecord(collection: ReferenceCollection): AdminRecord {
  const kind = collectionKinds[collection][0]; return { id: `lab.${collection}.new`, kind, category: 'local_simulation', title: '새 로컬 기준', value: kind === 'parameter' ? 1 : kind === 'prompt' ? '새 모의 정책' : kind === 'form' ? { code: 'LOCAL_FORM', reconstruction: true } : kind === 'court' ? { code: 'custom', name: '새 관할', jurisdiction: '모의' } : { description: '로컬 검토용 정의' }, unit: kind === 'parameter' ? 'months' : null, sourceIds: [], sourceUrls: [], effectiveFrom: null, effectiveTo: null, courtIds: [], verification: 'local_simulation_unreviewed', runtimeMode: 'local_simulation', editable: true, consumers: [], condition: null, consequence: null, requiresHumanReview: true, sha256: '0'.repeat(64), labReferences: [], ...(kind === 'prompt' ? { placeholders: [] } : {}) };
}
