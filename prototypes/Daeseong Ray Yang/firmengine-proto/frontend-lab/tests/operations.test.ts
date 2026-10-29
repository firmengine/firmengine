import test from 'node:test';
import assert from 'node:assert/strict';
import { createScenarioCase } from '../src/model.ts';
import { applyOperation, evidenceSignature, initialOperations, operationBlockers, operationsKey, readOperationBlockers, type OperationsState } from '../src/operations-model.ts';

const data = createScenarioCase('normal');
const legal = { id: 'finding-0', status: 'not_applicable' as const, source: '합성 원문 1쪽', reason: '합성 대상에 대한 명시적 부재 확인' };

test('unmounted legal pages cannot reuse approval after source or reference version changes', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null } });
  try {
    const state = initialOperations(data); state.findings = state.findings.map(f => ({ ...f, status: 'applicable' }));
    storage.set(operationsKey(data.id), JSON.stringify(state)); assert.deepEqual(readOperationBlockers(data.id, data), []);
    const changed = { ...data, consultation: `${data.consultation} 추가 원문` };
    assert.deepEqual(readOperationBlockers(data.id, changed), ['자료 변경 후 법률 재검토 필요']);
    assert.deepEqual(readOperationBlockers(data.id, { ...data, incomeType: data.incomeType === 'salary' ? 'business' : 'salary' }), ['자료 변경 후 법률 재검토 필요']);
    assert.deepEqual(readOperationBlockers(data.id, { ...data, requirementExemptions: [{ kind: 'business', reason: '합성 비해당 근거' }] }), ['자료 변경 후 법률 재검토 필요']);
    assert.deepEqual(readOperationBlockers(data.id, { ...data, requirementLinks: [{ id: 'link-test', kind: 'income', documentId: data.documents[0].id, subject: '신청인', period: '2026년', reason: '대상기간 재연결' }] }), ['자료 변경 후 법률 재검토 필요']);
    storage.set(`firmengine-frontend-financial-demo-v1:${data.id}`, JSON.stringify({ schema: 1, livingCost: 1000 }));
    assert.deepEqual(readOperationBlockers(data.id, data), ['자료 변경 후 법률 재검토 필요']);
    storage.delete(`firmengine-frontend-financial-demo-v1:${data.id}`);
    assert.deepEqual(readOperationBlockers(data.id, { ...data, revision: data.revision + 1 }), [], 'review callbacks alone must not reopen legal findings');
    storage.set(`firmengine.lab.references.${data.id}`, JSON.stringify({ activeVersion: 2, impactPending: false }));
    assert.deepEqual(readOperationBlockers(data.id, data), ['자료 변경 후 법률 재검토 필요']);
    assert.equal(state.findings[0].status, 'applicable', 'reading blockers does not silently rewrite historical approval');
  } finally { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else Reflect.deleteProperty(globalThis, 'localStorage'); }
});

test('staff proposals remain pending; only a lawyer resolves a finding with source and reason', () => {
  const original = initialOperations(data), proposed = applyOperation(original, { type: 'legal.propose', ...legal }, data, 'staff');
  assert.equal(original.findings[0].proposal, undefined);
  assert.equal(proposed.findings[0].status, 'uncertain');
  assert.ok(operationBlockers(proposed).some(value => value.includes('제안')));
  assert.throws(() => applyOperation(proposed, { type: 'legal.resolve', ...legal }, data, 'staff'));
  assert.throws(() => applyOperation(proposed, { type: 'legal.resolve', ...legal, source: '' }, data, 'lawyer'));
  const resolved = applyOperation(proposed, { type: 'legal.resolve', ...legal }, data, 'lawyer');
  assert.equal(resolved.findings[0].status, 'not_applicable'); assert.equal(resolved.findings[0].proposal, undefined);
});

test('client roles cannot write operational state', () => {
  assert.throws(() => applyOperation(initialOperations(data), { type: 'job.send', requestId: 'new', expectedRevision: data.revision }, data, 'client'));
});

test('tasks deduplicate by normalized title and require a waiting reason', () => {
  const initial = initialOperations(data), task = { id: '', title: '소득 자료 확인', assignee: '직원 A', status: 'done' as const, due: '', waitReason: '' };
  const once = applyOperation(initial, { type: 'task.save', task }, data, 'staff');
  const twice = applyOperation(once, { type: 'task.save', task: { ...task, title: '소득자료확인', assignee: '직원 B' } }, data, 'staff');
  assert.equal(twice.tasks.length, once.tasks.length); assert.equal(twice.tasks.at(-1)?.assignee, '직원 B');
  assert.throws(() => applyOperation(twice, { type: 'task.save', task: { ...task, status: 'waiting' } }, data, 'staff'));
  const changed = { ...data, consultation: `${data.consultation} 새 근거` };
  const reopened = applyOperation(twice, { type: 'task.source', signature: evidenceSignature(changed) }, changed, 'staff');
  assert.equal(reopened.tasks.at(-1)?.status, 'open'); assert.ok(reopened.findings.every(f => f.status === 'uncertain'));
  assert.equal(applyOperation(reopened, { type: 'task.source', signature: evidenceSignature(changed) }, changed, 'staff'), reopened);
});

test('reference approval and restoration preserve prior versions and require impact confirmation', () => {
  const initial = initialOperations(data), proposed = applyOperation(initial, { type: 'reference.propose', value: { title: '새 기준', value: '합성 변경 기준', effective: '2026-10-29', court: '모의', source: '가상 출처', reason: '모의 개정' } }, data, 'staff');
  assert.equal(proposed.activeReferenceId, initial.activeReferenceId);
  assert.throws(() => applyOperation(proposed, { type: 'reference.approve' }, data, 'staff'));
  const approved = applyOperation(proposed, { type: 'reference.approve' }, data, 'lawyer');
  assert.notEqual(approved.activeReferenceId, initial.activeReferenceId); assert.equal(approved.references.length, 2);
  assert.ok(approved.impactPending); assert.ok(operationBlockers(approved).some(value => value.includes('영향')));
  const checked = applyOperation(approved, { type: 'reference.impact', note: '자료·계산·문서를 다시 확인함' }, data, 'staff');
  assert.equal(checked.impactPending, false);
  const restored = applyOperation(checked, { type: 'reference.restore', id: initial.activeReferenceId, reason: '이전 기준 재검토' }, data, 'lawyer');
  assert.equal(restored.references.length, 3); assert.equal(restored.references.at(-1)?.value, initial.references[0].value); assert.ok(restored.impactPending);
});

test('procedure records need an active document, date, reason and predecessor; all records stay synthetic', () => {
  const initial = initialOperations(data), event = { kind: 'received' as const, date: '2026-10-29', documentId: data.documents[0].id, page: 1, reason: '합성 접수 증빙' };
  assert.throws(() => applyOperation(initial, { type: 'procedure.add', event }, data, 'staff'));
  assert.throws(() => applyOperation(initial, { type: 'procedure.add', event: { ...event, kind: 'submitted', documentId: 'missing' } }, data, 'staff'));
  const submitted = applyOperation(initial, { type: 'procedure.add', event: { ...event, kind: 'submitted' } }, data, 'staff');
  const received = applyOperation(submitted, { type: 'procedure.add', event }, data, 'staff');
  assert.equal(received.procedures.length, 2); assert.ok(received.procedures.every(item => item.synthetic));
  assert.throws(() => applyOperation(received, { type: 'procedure.add', event: { ...event, kind: 'correction_submitted' } }, data, 'staff'));
});

test('same recovery request is idempotent; changed payload and stale revisions are rejected', () => {
  const initial = initialOperations(data), action = { type: 'job.send' as const, requestId: 'request-new', expectedRevision: data.revision };
  const sent = applyOperation(initial, action, data, 'staff');
  assert.equal(applyOperation(sent, action, data, 'staff'), sent);
  assert.throws(() => applyOperation(sent, { ...action, expectedRevision: data.revision + 1 }, data, 'staff'));
  assert.throws(() => applyOperation(sent, { ...action, requestId: 'stale', expectedRevision: 0 }, data, 'staff'), /STALE_REVISION/);
  const job = sent.jobs.at(-1)!, retry = applyOperation(sent, { type: 'job.retry', id: job.id }, data, 'staff');
  assert.equal(retry.jobs.at(-1)?.attempts, 2);
  assert.throws(() => applyOperation(retry, { type: 'job.complete', id: job.id }, { ...data, revision: data.revision + 1 }, 'staff'), /STALE_REVISION/);
  const complete = applyOperation(retry, { type: 'job.complete', id: job.id }, data, 'staff'); assert.equal(complete.jobs.at(-1)?.status, 'done');
  const cancelled = applyOperation(sent, { type: 'job.cancel', id: job.id }, data, 'staff'); assert.equal(cancelled.jobs.at(-1)?.status, 'cancelled');
});

test('monitor state transitions record a simulated failure and retry without a provider', () => {
  let state: OperationsState = initialOperations(data);
  state = applyOperation(state, { type: 'monitor', status: 'running' }, data, 'staff');
  state = applyOperation(state, { type: 'monitor', status: 'failed' }, data, 'staff');
  state = applyOperation(state, { type: 'monitor', status: 'running' }, data, 'staff');
  assert.equal(state.monitor.attempts, 2);
  state = applyOperation(state, { type: 'monitor', status: 'configured', outcome: 'success' }, data, 'staff');
  assert.equal(state.monitor.status, 'configured'); assert.equal(state.references.length, 1);
});
