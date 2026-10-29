import test from 'node:test';
import assert from 'node:assert/strict';
import { approveAdminVersion, deleteAdminRow, importAdminRows, initialReferenceAdmin, newAdminRecord, proposeAdminVersion,
  restoreAdminVersion, saveAdminRow, validateAdminRow, validateAdminRows } from '../src/reference-admin-model.ts';

test('the curated v44 seed spans all six schemas and contains valid source records', () => {
  const state = initialReferenceAdmin('synthetic-admin'); assert.ok(state.draftRows.length > 40);
  for (const kind of ['legal_rule', 'parameter', 'document_family', 'form', 'prompt', 'court']) assert.ok(state.draftRows.some(row => row.kind === kind));
  assert.equal(validateAdminRows(state.draftRows).length, state.draftRows.length);
});

test('parameter, prompt, duplicate-ID and foreign-reference contracts reject malformed records', () => {
  const parameter = newAdminRecord('parameters');
  assert.throws(() => validateAdminRow({ ...parameter, value: -1 }));
  assert.throws(() => validateAdminRow({ ...parameter, unit: 'KRW', value: 1000 }));
  assert.throws(() => validateAdminRow({ ...parameter, unit: 'rational', value: { numerator: 1, denominator: 0 } }));
  assert.throws(() => validateAdminRow({ ...newAdminRecord('policies'), value: '{{missing}}', placeholders: [] }));
  assert.throws(() => validateAdminRows([parameter, parameter]));
  assert.throws(() => validateAdminRows([{ ...parameter, labReferences: ['does-not-exist'] }]));
});

test('CRUD preserves unique IDs and blocks dangling deletion', () => {
  let state = initialReferenceAdmin('synthetic-admin'); const parameter = newAdminRecord('parameters');
  state = saveAdminRow(state, parameter);
  assert.throws(() => saveAdminRow(state, parameter));
  const linked = { ...newAdminRecord('rules'), labReferences: [parameter.id] }; state = saveAdminRow(state, linked);
  assert.throws(() => deleteAdminRow(state, parameter.id));
  state = deleteAdminRow(state, linked.id); state = deleteAdminRow(state, parameter.id);
  assert.equal(state.draftRows.some(row => row.id === parameter.id), false);
});

test('read-only safety records cannot be rewritten or removed by JSON import', () => {
  const state = initialReferenceAdmin('synthetic-admin'), locked = state.draftRows.find(row => row.lockedSafetyInvariant || !row.editable)!;
  assert.throws(() => saveAdminRow(state, { ...locked, title: 'Changed', editable: true }, locked.id));
  assert.throws(() => importAdminRows(state, state.draftRows.map(row => row.id === locked.id ? { ...row, editable: true, lockedSafetyInvariant: false } : row)));
  const protectedRow = { ...locked, value: { nested: { sha256: 'a'.repeat(64) } } };
  const protectedState = { ...state, draftRows: state.draftRows.map(row => row.id === locked.id ? protectedRow : row), versions: [{ ...state.versions[0], rows: state.versions[0].rows.map(row => row.id === locked.id ? protectedRow : row) }] };
  assert.throws(() => importAdminRows(protectedState, protectedState.draftRows.map(row => row.id === locked.id ? { ...row, value: { nested: { sha256: 'b'.repeat(64) } } } : row)), /읽기 전용 원본/);
  const copy = { ...locked, id: 'lab.locked-copy', editable: true, lockedSafetyInvariant: false };
  assert.ok(saveAdminRow(state, copy).draftRows.some(row => row.id === copy.id));
});

test('a proposal remains inactive until reviewer confirmation; rollback adds an immutable version', async () => {
  let state = initialReferenceAdmin('synthetic-admin'); state = saveAdminRow(state, newAdminRecord('parameters'));
  const proposal = await proposeAdminVersion(state, '합성 기준 추가 검토', 'staff');
  assert.equal(proposal.activeVersion, 1); assert.equal(proposal.versions[0].rows.length + 1, proposal.proposal?.rows.length);
  assert.match(proposal.proposal!.fingerprint, /^[a-f0-9]{64}$/);
  assert.throws(() => approveAdminVersion(proposal, 'staff', true)); assert.throws(() => approveAdminVersion(proposal, 'lawyer', false));
  const approved = approveAdminVersion(proposal, 'lawyer', true); assert.equal(approved.activeVersion, 2); assert.ok(approved.impactPending);
  const restored = restoreAdminVersion(approved, 1, '이전 합성 기준 복원', 'lawyer', true);
  assert.equal(restored.activeVersion, 3); assert.equal(restored.versions.length, 3);
  assert.equal(restored.versions[2].rows.length, state.versions[0].rows.length); assert.ok(restored.impactPending);
  assert.equal(approved.versions[0].rows.length, state.versions[0].rows.length);
});
