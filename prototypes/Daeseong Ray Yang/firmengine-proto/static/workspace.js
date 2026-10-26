'use strict';

// Persisted case views share the safe DOM helpers and current snapshot in app.js.
let caseSummaries = [];
let catalogue = { features: [], document_types: [], rule_sources: [] };
let activeView = 'overview';
let editorSubmit = null;
let editorCaseId = null;
let editorRevision = null;
let editorSaving = false;
let knowledgeState = null;

const incomeNames = { business: '사업소득', wage: '급여소득', salary: '급여소득', mixed: '복합소득', unknown: '소득유형 확인 중' };
const stateNames = { REPORTED: '신고·입력', EXTRACTED: '문서 추출', VERIFIED: '근거 확인', DISPUTED: '상충', SUPERSEDED: '이전 버전', RETRACTED: '철회', REJECTED: '제외',
  PASS: '조건 충족', FAIL: '검토 필요', UNKNOWN: '자료 부족', NOT_APPLICABLE: '해당 없음', satisfied: '충족', missing: '자료 필요', partial: '일부 충족',
  matched: '조회 후보 수신', unmatched: '일치 결과 없음', needs_information: '조회 정보 필요', credential_required: '조회 연결 설정 필요', human_auth_required: '본인 인증 자료 필요', failed: '처리 확인 필요',
  active: '적용 중', approved: '검토 완료', candidate: '변경 후보', pending: '확인 대기', requesting: '확인 중', completed: '처리 완료', calculated: '계산 완료', stale: '재계산 필요' };
const axisNames = { eligibility: '신청요건', evidence: '증거 완전성', evidence_completeness: '증거 완전성', plan: '변제계획', repayment_plan: '변제계획', procedure: '절차·기한', procedural_compliance: '절차·기한', discharge: '면책·잔존책임', residual_liability: '면책·잔존책임' };
axisNames.discharge_liability = '면책·잔존책임';
Object.assign(stateNames, { NEEDS_VERIFICATION: '받은 자료 검토 필요', MISSING_EVIDENCE: '증빙 필요', NUMERIC_REVIEW_REQUIRED: '수치 조건 검토 필요', PARTIAL_CHECK_ONLY: '일부 조건 확인', MISSING: '자료 부족', CHECKED: '현재 요건 확인', MODIFICATION_REQUIRED: '계획 수정 검토', UNDETERMINED: '조건 미확정', DRAFT_READY: '초안 작성 가능', OPEN_ACTIONS: '진행할 업무 있음', LEGAL_REVIEW_REQUIRED: '법률 검토 필요', risk: '위험 확인', needs_review: '확인 필요', clear: '현재 확인됨', resolved: '해소됨', not_applicable: '해당 없음', not_configured: '연결 설정 필요', not_modified: '변경 없음', review_required: '검토 필요' });
const objectNames = { vehicle: '차량', real_estate: '부동산', asset: '기타 재산', debt: '채무', person: '사람', household: '가구', business: '사업체', income: '소득', lease: '임대차', insurance: '보험', account: '계좌' };
const eventNames = { 'case.opened': '사건 생성', 'case.updated': '사건 정보 수정', 'document.registered': '자료 접수', 'document.updated': '자료 연결 수정', 'document.deleted': '자료 삭제', 'assertion.recorded': '사실 후보 추가', 'assertion.superseded': '사실 정정', 'assertion.disputed': '상충 기록', 'assertion.retracted': '사실 철회', 'assessment.completed': '요건·계산 평가', 'assessment.invalidated': '기존 판단 재검토', 'artifact.created': '문서 생성', 'artifact.archived': '생성본 보관 처리', 'review.recorded': '검토 기록', 'review.invalidated': '기존 검토 해제' };

function listOf(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.entries(value).map(([key, item]) => typeof item === 'object' && item !== null ? { key, ...item } : { key, label: item });
  return [];
}
function objectId(item) { return item?.id || item?.object_id || ''; }
function assertionId(item) { return item?.id || item?.assertion_id || ''; }
function featureLabel(key) { const feature = listOf(catalogue.features).find((item) => (item.key || item.feature_key) === key); return feature?.label || key || '항목'; }
function documentLabel(key) { const doc = listOf(catalogue.document_types).find((item) => (item.id || item.key || item.document_type) === key); return doc?.label || doc?.name || key || '유형 미지정'; }
function stateLabel(value) { return stateNames[value] || stateNames[String(value).toUpperCase()] || stateNames[String(value).toLowerCase()] || value || '확인 전'; }
function objectLabel(id) { const item = listOf(session?.objects).find((entry) => objectId(entry) === id); return item?.label || item?.name || id || '사건 전체'; }
function stateBadge(value) { return badge(stateLabel(value), /verified|pass|satisfied|matched|approved|calculated/i.test(value || '') && !/unmatched/i.test(value || '') ? 'green' : /fail|missing|partial|disputed|unknown|required|stale/i.test(value || '') ? 'orange' : 'neutral'); }
function emptyBox(text) { const box = node('div', undefined, 'empty-state compact'); box.append(node('strong', text)); return box; }
function action(text, handler, tone = 'secondary') { const button = node('button', text, `button ${tone} small`); button.type = 'button'; button.addEventListener('click', handler); return button; }
function detailLine(label, value) { const p = node('p', undefined, 'detail-line'); p.append(node('span', label), node('strong', displayValue(value))); return p; }
function addSafeLink(parent, title, url) { const safe = safeUrl(url, false); if (!safe) return; const link = node('a', title, 'source-button'); link.href = safe; link.target = '_blank'; link.rel = 'noopener noreferrer'; parent.append(link); }
function addDownloadLink(parent, title, url, filename) { const safe = safeUrl(url); if (!safe) return; const link = node('a', title, 'button secondary small'); link.href = safe; link.download = filename || ''; link.addEventListener('click', heartbeat); parent.append(link); }
function addSourceLinks(parent, refs) { for (const ref of refs || []) { let source = typeof ref === 'object' ? ref : catalogue.rule_sources?.[ref] || listOf(catalogue.rule_sources).find((item) => (item.id || item.key || item.source_id) === ref); if (Array.isArray(source)) source = { title: source[0], url: source[1] }; if (source) addSafeLink(parent, source.title || source.label || '적용 근거 ↗', source.url || source.source_url); } }
function readable(value) { if (Array.isArray(value)) return value.map(readable).filter(Boolean).join(' · '); if (value && typeof value === 'object') return value.label || value.message || value.title || value.description || value.reason || value.id || value.key || Object.entries(value).map(([key, item]) => `${featureLabel(key)}: ${readable(item)}`).join(' · '); return value === undefined || value === null ? '' : String(value); }

function showView(view) {
  activeView = view;
  document.querySelectorAll('[data-view-panel]').forEach((panel) => { panel.hidden = panel.dataset.viewPanel !== view; });
  document.querySelectorAll('[data-view]').forEach((link) => { link.classList.toggle('active', link.dataset.view === view); if (link.dataset.view === view) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  if (view === 'knowledge' && !knowledgeState) loadKnowledge();
}

window.updateCaseControls = function () {
  const locked = busy || !session;
  document.querySelectorAll('[data-case-write]').forEach((button) => { button.disabled = locked; });
  $('case-edit').disabled = locked;
  $('case-delete').disabled = locked;
  $('case-select').disabled = busy;
  $('case-new').disabled = busy;
  $('generate-case').disabled = locked || isProcessing() || session?.generation_gate?.can_generate === false;
  $('regenerate-button').disabled = locked || isProcessing() || session?.generation_gate?.can_generate === false;
};

function renderCaseSelector() {
  const selector = $('case-select');
  clear(selector);
  const placeholder = node('option', caseSummaries.length ? '저장된 사건 선택' : '저장된 사건이 없습니다'); placeholder.value = ''; selector.append(placeholder);
  for (const item of caseSummaries) { const option = node('option', `${item.name || '이름 없는 사건'} · ${incomeNames[item.income_type] || '유형 확인'} · v${item.revision || 1}`); option.value = item.id; selector.append(option); }
  selector.value = session?.id || '';
}

window.caseAccepted = function (snapshot) {
  const index = caseSummaries.findIndex((item) => item.id === snapshot.id);
  const summary = { id: snapshot.id, name: snapshot.name || '개인회생 사건', income_type: snapshot.income_type, revision: snapshot.revision, updated_at: snapshot.updated_at };
  if (index < 0) caseSummaries.unshift(summary); else caseSummaries[index] = { ...caseSummaries[index], ...summary };
  renderCaseSelector();
};

async function loadCases() {
  try { const result = await api('/api/cases'); caseSummaries = result.cases || []; renderCaseSelector(); }
  catch (error) { clear($('case-select')); const option = node('option', '사건 목록 연결 확인 필요'); option.value = ''; $('case-select').append(option); setText('case-save-status', error.message); }
}
async function loadCatalogue() {
  try { catalogue = await api('/api/catalog'); renderCaseWorkspace(); }
  catch { /* Case-level API feedback stays available while a new backend starts. */ }
}

async function mutateCase(suffix, method, body, message) {
  if (!session || busy) return null;
  const id = session.id;
  setBusy(true); show('error-notice', false);
  try { const result = await api(casePath(suffix), { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); if (session?.id === id && result?.id) acceptSession(result); if (message) toast(message); return result; }
  catch (error) { errorMessage(error); if (error.status === 409) await refreshSession(); throw error; }
  finally { setBusy(false); }
}

function beginEditor(title, description, submit, saveLabel = '저장') {
  editorSubmit = submit; editorCaseId = session?.id || null; editorRevision = session?.revision;
  setText('editor-title', title); setText('editor-description', description); setText('editor-save', saveLabel);
  clear($('editor-fields')); show('editor-error', false); $('editor-save').disabled = false;
}
function editorField(label, key, value = '', options = {}) {
  const wrapper = node('label', undefined, 'field'); wrapper.htmlFor = `edit-${key}`; wrapper.append(node('span', label));
  const control = node(options.choices ? 'select' : options.multiline ? 'textarea' : 'input'); control.id = `edit-${key}`; control.name = key;
  if (options.choices) { for (const choice of options.choices) { const option = node('option', choice.label); option.value = choice.value; control.append(option); } }
  else if (!options.multiline) control.type = options.type || 'text';
  if (options.multiline) control.rows = options.rows || 3;
  control.value = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  control.required = Boolean(options.required); control.disabled = Boolean(options.disabled);
  if (options.min !== undefined) control.min = options.min;
  if (options.placeholder) control.placeholder = options.placeholder;
  wrapper.append(control); if (options.note) wrapper.append(node('small', options.note, 'muted-note'));
  (options.parent || $('editor-fields')).append(wrapper); return control;
}
function editValue(key) { return $(`edit-${key}`).value.trim(); }
function editorOpen() { $('editor-dialog').showModal(); }
function revisionBody(body) { return { ...body, ...(body.object_id === '' ? { object_id: null } : {}), ...(body.subject_id === '' ? { subject_id: null } : {}), expected_revision: editorRevision }; }
function assertEditorCase() { if (editorCaseId && session?.id !== editorCaseId) throw new Error('열어둔 사건이 바뀌었습니다. 현재 사건에서 다시 편집해주세요.'); }

function openCaseEditor(edit = false) {
  beginEditor(edit ? '사건 정보 수정' : '새 사건 만들기', '사건과 자료는 로컬에 저장되며 목록에서 다시 열 수 있습니다.', async () => {
    const body = { name: editValue('case-name'), income_type: editValue('income-type'), application_date: editValue('application-date') || null };
    if (!edit) body.court_id = 'seoul';
    const result = await api(edit ? casePath() : '/api/cases', { method: edit ? 'PATCH' : 'POST', body: JSON.stringify(edit ? revisionBody(body) : body) });
    clearTransientUI(); acceptSession(result); showView(edit ? activeView : 'documents'); toast(edit ? '사건 정보를 저장했습니다.' : '사건을 만들었습니다. 자료를 추가해주세요.');
  });
  editorField('사건명', 'case-name', edit ? session.name : '', { required: true, placeholder: '내부에서 구분할 사건명' });
  editorField('소득유형', 'income-type', edit ? (session.income_type === 'salary' ? 'wage' : session.income_type || 'unknown') : 'business', { choices: ['business', 'wage', 'mixed', 'unknown'].map((value) => ({ value, label: incomeNames[value] })) });
  editorField('신청 예정일·신청일', 'application-date', edit ? session.application_date : '', { type: 'date' });
  $('editor-fields').append(node('p', '현재 적용 관할: 서울회생법원', 'muted-note')); editorOpen();
}

function documentChoices() {
  const choices = listOf(catalogue.document_types).map((item) => ({ value: item.id || item.key || item.document_type, label: item.label || item.name || item.id || item.key }));
  return [{ value: '', label: '서류 유형 선택' }, ...choices];
}
function openDocumentEditor(doc, requirement = null) {
  beginEditor('자료의 종류·대상·기간', '이 자료가 누구의 어떤 기간을 증명하는지 연결합니다.', async () => {
    const id = doc?.id || editValue('document-id');
    const result = await api(casePath(`/documents/${encodeURIComponent(id)}`), { method: 'PATCH', body: JSON.stringify(revisionBody({ document_type: editValue('document-type'), subject_id: editValue('subject-id'), period_start: editValue('period-start') || null, period_end: editValue('period-end') || null })) });
    acceptSession(result); toast('자료 연결을 저장했습니다. 필요서류 상태를 확인해주세요.');
  });
  if (!doc) editorField('연결할 자료', 'document-id', '', { required: true, choices: [{ value: '', label: '접수 자료 선택' }, ...(session.documents || []).map((item) => ({ value: item.id, label: item.name }))] });
  else $('editor-fields').append(node('p', doc.name, 'editor-source-name'));
  const firstAlternative = requirement?.alternatives?.[0];
  const type = requirement?.document_type || doc?.document_type || firstAlternative?.all_of?.[0] || firstAlternative?.any_of?.[0]?.[0] || '';
  const choices = documentChoices(); if (type && !choices.some((item) => item.value === type)) choices.push({ value: type, label: documentLabel(type) });
  editorField('서류 유형', 'document-type', type, { choices, required: true });
  const subject = requirement ? requirement.subject_id : doc?.subject_id;
  const subjects = [{ value: '', label: '신청인 · 사건 전체' }, ...listOf(session.objects).map((item) => ({ value: objectId(item), label: item.label || objectId(item) }))];
  if (subject && !subjects.some((item) => item.value === subject)) subjects.push({ value: subject, label: objectLabel(subject) });
  editorField('증명 대상', 'subject-id', subject || '', { choices: subjects });
  const period = requirement?.period || {};
  editorField('자료 기간 시작', 'period-start', doc?.period_start || period.start || period.from || '', { type: 'date' });
  editorField('자료 기간 종료', 'period-end', doc?.period_end || period.end || period.to || '', { type: 'date' }); editorOpen();
}

function evidenceEditor(refs) {
  const area = node('div', undefined, 'evidence-editor'); area.append(node('h3', '원본 근거'));
  const rows = node('div', undefined, 'evidence-edit-rows'); area.append(rows);
  function append(ref = {}) {
    const row = node('div', undefined, 'evidence-edit-row');
    const doc = node('select'); doc.setAttribute('aria-label', '근거 문서');
    const blank = node('option', '근거 문서 선택'); blank.value = ''; doc.append(blank);
    for (const item of session.documents || []) { const option = node('option', item.name); option.value = item.id; doc.append(option); }
    doc.value = ref.document_id || '';
    const page = node('input'); page.type = 'number'; page.min = '1'; page.placeholder = '페이지'; page.setAttribute('aria-label', '원본 페이지'); page.value = ref.page || '';
    const excerpt = node('textarea'); excerpt.rows = 2; excerpt.placeholder = '값을 입증하는 원문'; excerpt.setAttribute('aria-label', '원문 근거'); excerpt.value = ref.excerpt || ref.quote || '';
    const location = node('input'); location.dataset.location = 'true'; location.placeholder = '원문 위치(예: 문단 7, 표 2)'; location.setAttribute('aria-label', '원문 상세 위치'); location.value = ref.location || '';
    row.append(doc, page, location, excerpt, action('근거 제거', () => row.remove(), 'text-button')); rows.append(row);
  }
  (refs.length ? refs : [{}]).forEach(append); area.append(action('근거 추가', () => append())); $('editor-fields').append(area);
  return () => [...rows.children].map((row) => ({ document_id: row.querySelector('select').value, page: Number(row.querySelector('input').value) || null, location: row.querySelector('[data-location]').value.trim(), excerpt: row.querySelector('textarea').value.trim() })).filter((ref) => ref.document_id || ref.excerpt || ref.location);
}

function parseFeatureValue(raw, key) {
  if (raw === '') return null;
  const feature = listOf(catalogue.features).find((item) => (item.key || item.feature_key) === key);
  if (feature?.type === 'boolean' && ['true', 'false'].includes(raw)) return raw === 'true';
  if (/^[\[{]/.test(raw)) { try { return JSON.parse(raw); } catch { throw new Error('여러 값·객체를 입력한 경우 JSON 형식을 확인해주세요. 일반 값은 그대로 입력할 수 있습니다.'); } }
  return raw;
}

async function openRuleReleaseReview() {
  if (!session || busy) return;
  const caseId = session.id;
  try {
    const candidate = await api(casePath('/rule-release/review'));
    if (session?.id !== caseId) return;
    const rules = Array.isArray(candidate.required_rule_ids) ? candidate.required_rule_ids : [];
    const sources = Array.isArray(candidate.source_versions) ? candidate.source_versions : [];
    const checks = [];
    beginEditor('사건 적용 규칙 검토', '공식 근거의 시행일·버전과 각 산식의 적용 조건·예외를 직접 확인한 후 기록하세요.', async () => {
      if (candidate.can_review !== true) throw new Error('현재 적용일에 맞는 공식 근거가 준비되지 않았습니다. 누락된 근거를 먼저 확인해주세요.');
      if (!rules.length || checks.some((check) => !check.checked) || !$('edit-rule-confirmation').checked) throw new Error('각 산식과 적용일·예외를 실제 검토한 후 확인란을 선택해주세요.');
      const result = await api(casePath('/rule-release/review'), { method: 'POST', body: JSON.stringify(revisionBody({
        reviewer: editValue('rule-reviewer'), review_note: editValue('rule-review-note'),
        reviewed_rule_ids: [...rules], source_versions: sources.map((source) => ({ source_id: source.source_id, version_id: source.version_id, content_hash: source.content_hash }))
      })) });
      acceptSession(result); toast('현재 사건의 적용 규칙 검토를 기록했습니다. 변경된 조건으로 다시 평가합니다.');
    }, '검토 내용 기록');
    if (Number.isInteger(candidate.revision)) editorRevision = candidate.revision;
    const release = candidate.release || {};
    $('editor-fields').append(detailLine('적용본 · 상태', `${release.id || release.version || '미확인'} · ${release.status || '미확인'}`),
      detailLine('사건 적용 기준일', session.application_date || '미지정'),
      node('p', '이 기록은 현재 사건·적용본·공식 근거 버전에 한정됩니다. 사실 검토나 최종 제출 승인과는 별도로 보존됩니다.', 'muted-note'));
    if (candidate.reviewer_notice) $('editor-fields').append(node('p', candidate.reviewer_notice, 'muted-note'));
    if (candidate.source_notice) $('editor-fields').append(node('p', candidate.source_notice, 'notice neutral'));
    const names = { 'KR.579.DEBT_LIMITS': '담보·무담보 채무 한도', 'SEOUL.405.BASIC_LIVING_2026': '가구별 기본 생계비',
      'KR.614.MINIMUM_REPAYMENT': '최저 변제액 조건', 'KR.614.LIQUIDATION_COMPARISON': '청산가치와 변제 현재가치 비교',
      'SEOUL.405.ADDITIONAL_HOUSING': '추가 주거비 조건', 'INCOME.MONTHLY_NET': '월 소득과 필요경비 산정', 'PLAN.NOMINAL_PAYMENTS': '기간별 명목 변제액' };
    const rulesArea = node('div', undefined, 'evidence-editor'); rulesArea.append(node('h3', '산식별 확인'));
    for (const id of rules) { const label = node('label', undefined, 'check-field'); const check = node('input'); check.type = 'checkbox'; check.dataset.ruleId = id; check.checked = false; checks.push(check); label.append(check, node('span', `${names[id] || id} · ${id}`)); rulesArea.append(label); }
    $('editor-fields').append(rulesArea);
    const sourceArea = node('div', undefined, 'evidence-editor'); sourceArea.append(node('h3', '연결되는 공식 근거 버전'));
    for (const source of sources) {
      const known = listOf(catalogue.rule_sources).find((item) => (item.id || item.source_id || item.key) === source.source_id) || {};
      const row = node('div', undefined, 'workspace-row'); row.append(node('strong', source.title || known.title || known.label || source.source_id),
        detailLine('버전', source.version_id || '미확인'), detailLine('내용 해시', source.content_hash || '미확인'),
        detailLine('시행·종료일', `${source.valid_from || source.effective_from || source.effective_date || '자료에서 확인'} ~ ${source.valid_to || source.effective_to || '종료일 미지정'}`));
      addSafeLink(row, '공식 원문 확인 ↗', source.url || source.source_url || known.url || known.source_url); sourceArea.append(row);
    }
    if (!sources.length) sourceArea.append(node('p', '검토에 연결할 공식 근거 버전이 아직 없습니다.', 'notice warning'));
    $('editor-fields').append(sourceArea);
    if (candidate.missing_sources?.length) $('editor-fields').append(node('p', `준비가 필요한 근거: ${readable(candidate.missing_sources)}`, 'notice warning'));
    if (candidate.readiness_reasons?.length) $('editor-fields').append(node('p', readable(candidate.readiness_reasons), 'notice warning'));
    const confirmation = node('label', undefined, 'check-field'); const consent = node('input'); consent.type = 'checkbox'; consent.id = 'edit-rule-confirmation'; consent.checked = false;
    confirmation.append(consent, node('span', `${rules.length}개 산식의 적용일·조건·예외와 위 공식 근거를 검토했습니다.`)); $('editor-fields').append(confirmation);
    editorField('검토자', 'rule-reviewer', '', { required: true }); editorField('검토 내용·판단 근거', 'rule-review-note', '', { required: true, multiline: true });
    $('editor-save').disabled = candidate.can_review !== true; editorOpen();
  } catch (error) { errorMessage(error); }
}
function openAssertionEditor(assertion = null) {
  let readEvidence;
  beginEditor(assertion ? '사실 정정·채택' : '사실 후보 추가', '값·시점·근거를 검토하세요. 수정은 이전 기록을 보존하는 새 버전으로 저장됩니다.', async () => {
    const key = editValue('feature-key'); const accepted = assertion ? $('edit-accepted').checked : false;
    const pv = /present_value|liquidation_floor/.test(key);
    const normalized = pv && $('edit-normalized').checked;
    if (normalized && (!editValue('valuation-date') || !editValue('basis-id'))) throw new Error('현재가치 비교 기준을 확인한 경우 평가 기준일과 산정 근거를 함께 입력해주세요.');
    const body = revisionBody({ object_id: editValue('object-id'), feature_key: key, value: parseFeatureValue(editValue('fact-value'), key), unit: editValue('unit'), currency: editValue('currency'), state: editValue('fact-state'), precision: editValue('precision'), valid_at: editValue('valid-at') || null, measurement_period: editValue('measurement-period'), period_start: editValue('fact-period-start') || null, period_end: editValue('fact-period-end') || null, ...(pv ? { normalized, valuation_date: editValue('valuation-date') || null, basis_id: editValue('basis-id') || null } : {}), evidence_refs: readEvidence(), accepted_for_filing: accepted, reason: editValue('fact-reason') });
    const result = await api(casePath('/assertions' + (assertion ? `/${encodeURIComponent(assertionId(assertion))}` : '')), { method: assertion ? 'PATCH' : 'POST', body: JSON.stringify(body) });
    generationChanged = true; acceptSession(result); toast('사실 후보의 새 버전을 저장했습니다. 영향을 받는 계산과 검토를 확인해주세요.');
  });
  const featureChoices = listOf(catalogue.features).map((item) => ({ value: item.key || item.feature_key, label: `${item.label || item.key} · ${item.key || item.feature_key}` }));
  const key = assertion?.feature_key || assertion?.key || '';
  if (key && !featureChoices.some((item) => item.value === key)) featureChoices.push({ value: key, label: featureLabel(key) });
  const featureSelect = editorField('피처·항목', 'feature-key', key, { required: true, choices: [{ value: '', label: '검토할 항목 선택' }, ...featureChoices] });
  const objects = [{ value: '', label: '신청인 · 사건 전체' }, ...listOf(session.objects).map((item) => ({ value: objectId(item), label: item.label || objectId(item) }))];
  const currentObject = assertion?.object_id || ''; if (!objects.some((item) => item.value === currentObject)) objects.push({ value: currentObject, label: objectLabel(currentObject) });
  editorField('사실의 대상', 'object-id', currentObject, { choices: objects });
  editorField('값', 'fact-value', assertion?.value ?? '', { multiline: true, note: '미확인 값은 비워두세요. 금액은 정확한 숫자 문자열로 입력합니다.' });
  const pair = node('div', undefined, 'editor-grid'); $('editor-fields').append(pair);
  editorField('단위', 'unit', assertion?.unit || '', { parent: pair, placeholder: 'won, month 등' }); editorField('통화', 'currency', assertion?.currency || '', { parent: pair, placeholder: 'KRW' });
  editorField('값의 기준일', 'valid-at', assertion?.valid_at || '', { type: 'date' });
  editorField('금액·값의 산정 단위', 'measurement-period', assertion?.measurement_period || 'UNKNOWN', { choices: [{ value: 'UNKNOWN', label: '자료에서 확인 필요' }, { value: 'MONTHLY', label: '월 기준' }, { value: 'ANNUAL', label: '연 기준' }, { value: 'ONE_TIME', label: '일회·특정 시점' }], note: '연간 금액은 월 금액으로 자동 전환하지 않습니다. 원문과 검토된 산정 기준을 확인하세요.' });
  const periods = node('div', undefined, 'editor-grid'); $('editor-fields').append(periods);
  editorField('값의 대상기간 시작', 'fact-period-start', assertion?.period_start || '', { type: 'date', parent: periods });
  editorField('값의 대상기간 종료', 'fact-period-end', assertion?.period_end || '', { type: 'date', parent: periods });
  const pvFields = node('div', undefined, 'evidence-editor'); pvFields.id = 'pv-review-fields'; pvFields.append(node('h3', '현재가치 비교 기준'));
  const normalizedLabel = node('label', undefined, 'check-field'); const normalizedCheck = node('input'); normalizedCheck.type = 'checkbox'; normalizedCheck.id = 'edit-normalized'; normalizedCheck.checked = assertion?.normalized === true;
  normalizedLabel.append(normalizedCheck, node('span', '같은 평가시점·산정 기준으로 환산된 값임을 근거로 확인했습니다.')); pvFields.append(normalizedLabel);
  editorField('평가 기준일', 'valuation-date', assertion?.valuation_date || '', { type: 'date', parent: pvFields });
  editorField('현재가치 산정 근거·기준 ID', 'basis-id', assertion?.basis_id || '', { parent: pvFields, note: '검토한 기준을 입력하세요. 빈 값을 임의로 채우지 않습니다.' });
  $('editor-fields').append(pvFields);
  const showPV = () => { pvFields.hidden = !/present_value|liquidation_floor/.test(featureSelect.value); }; featureSelect.addEventListener('change', showPV); showPV();
  editorField('근거 확인 상태', 'fact-state', assertion?.state || 'REPORTED', { choices: ['REPORTED', 'EXTRACTED', 'VERIFIED', 'DISPUTED'].map((value) => ({ value, label: stateLabel(value) })) });
  editorField('정확도', 'precision', assertion?.precision || 'UNSPECIFIED', { choices: [{ value: 'EXACT', label: '정확한 값' }, { value: 'APPROXIMATE', label: '대략적인 값' }, { value: 'UNSPECIFIED', label: '자료에 명시되지 않음' }, { value: 'UNKNOWN', label: '확인 필요' }] });
  if (assertion) { const label = node('label', undefined, 'check-field'); const check = node('input'); check.type = 'checkbox'; check.id = 'edit-accepted'; check.checked = Boolean(assertion.accepted_for_filing); label.append(check, node('span', '이 후보의 근거를 검토하고 이번 작성에 채택합니다.')); $('editor-fields').append(label); }
  readEvidence = evidenceEditor(assertion?.evidence_refs || []);
  editorField('추가·정정·채택 사유', 'fact-reason', '', { multiline: true, required: true }); editorOpen();
}

function renderEvidence(parent, refs) {
  for (const ref of refs || []) {
    const doc = session?.documents?.find((item) => item.id === ref.document_id);
    const box = node('div', undefined, 'source-evidence');
    if (ref.document_id && ref.page) box.append(action(`${doc?.name || '원본 자료'} · ${ref.page}쪽 ↗`, () => openPage(ref.document_id, ref.page, doc?.name || '원본 자료'), 'text-button'));
    else box.append(node('strong', doc?.name || ref.location || '연결 근거'));
    box.append(node('blockquote', ref.excerpt || ref.quote || ref.location || '원문에서 확인해주세요.')); parent.append(box);
  }
}

function renderAssertions() {
  const root = $('assertion-grid'); clear(root);
  const search = $('assertion-search').value.trim().toLocaleLowerCase(); const filter = $('assertion-filter').value;
  const all = listOf(session?.assertions).map((item) => ({ ...item }));
  const superseded = new Set(all.flatMap((item) => Array.isArray(item.supersedes) ? item.supersedes : item.supersedes ? [item.supersedes] : []));
  for (const item of all) if (superseded.has(assertionId(item)) || item.superseded_by) { item.state = 'SUPERSEDED'; item.accepted_for_filing = false; }
  const rows = all.filter((item) => { const state = String(item.state || '').toUpperCase(); const historic = ['SUPERSEDED', 'RETRACTED', 'REJECTED'].includes(state) || Boolean(item.superseded_by); return (filter === 'all' || !historic) && (filter !== 'accepted' || item.accepted_for_filing) && (filter !== 'review' || !item.accepted_for_filing || state === 'DISPUTED') && (!search || [item.feature_key, featureLabel(item.feature_key), objectLabel(item.object_id), displayValue(item.value)].join(' ').toLocaleLowerCase().includes(search)); });
  if (!rows.length) { root.append(emptyBox(session ? '조건에 맞는 사실 후보가 없습니다. 자료를 분석하거나 필요한 사실을 추가하세요.' : '사건을 선택하면 사실 후보와 변경 이력이 표시됩니다.')); return; }
  for (const item of rows) {
    const card = node('article', undefined, 'workspace-row'); const top = node('div', undefined, 'row-heading');
    top.append(node('h3', featureLabel(item.feature_key)), stateBadge(item.state)); if (item.accepted_for_filing) top.append(badge('작성에 채택', 'green'));
    card.append(top, node('p', displayValue(item.value), 'assertion-value'), node('p', `${objectLabel(item.object_id)} · ${item.valid_at || '기준일 미확인'} · ${displayUnit(item.unit)} ${item.currency || ''}`, 'muted-note'));
    const details = node('details'); details.append(node('summary', '원본 근거 · 항목과 이력')); details.append(node('p', `${item.feature_key} · 대상 ${item.object_id || '—'} · 기록 ${formatTime(item.recorded_at || item.created_at) || '—'}`, 'muted-note'));
    if (item.supersedes) details.append(node('p', `이전 후보 ${item.supersedes}를 정정한 기록`, 'muted-note')); renderEvidence(details, item.evidence_refs || []); card.append(details);
    if (item.measurement_period || item.period_start || item.period_end) details.append(detailLine('산정 단위 · 대상기간', `${({ MONTHLY: '월 기준', ANNUAL: '연 기준', ONE_TIME: '일회·특정 시점', UNKNOWN: '확인 필요' })[item.measurement_period] || item.measurement_period || '확인 필요'} · ${item.period_start || '시작 미확인'} ~ ${item.period_end || '종료 미확인'}`));
    if (/present_value|liquidation_floor/.test(item.feature_key || '')) details.append(detailLine('현재가치 비교 기준', `${item.normalized === true ? '근거 확인' : '확인 필요'} · ${item.valuation_date || '평가일 미확인'} · ${item.basis_id || '산정 근거 미확인'}`));
    const actions = node('div', undefined, 'row-actions'); actions.append(action('정정 · 채택', () => openAssertionEditor(item)));
    actions.append(action('철회', async () => { if (!confirm('이 사실 후보를 철회할까요? 이전 이력은 보존됩니다.')) return; try { await mutateCase(`/assertions/${encodeURIComponent(assertionId(item))}`, 'DELETE', { expected_revision: session.revision, reason: '담당자가 사실 후보 철회' }, '사실 후보를 철회했습니다.'); } catch {} }, 'quiet-danger'));
    card.append(actions); root.append(card);
  }
}

function renderDocumentRegister() {
  const root = $('document-register'); clear(root); const docs = session?.documents || [];
  if (!docs.length) { root.append(emptyBox('접수한 자료가 없습니다. 사건을 선택하고 위에서 자료를 추가하세요.')); return; }
  for (const doc of docs) { const card = node('article', undefined, 'workspace-row'); const top = node('div', undefined, 'row-heading'); top.append(node('h3', doc.name), badge(documentLabel(doc.document_type))); card.append(top, node('p', `${doc.pages || 0}쪽 · 대상 ${objectLabel(doc.subject_id)} · ${doc.period_start || '시작 미지정'} ~ ${doc.period_end || '종료 미지정'}`, 'muted-note'));
    const actions = node('div', undefined, 'row-actions'); actions.append(action('원본 미리보기', () => openPage(doc.id, doc.evidence_pages?.[0] || 1, doc.name))); addDownloadLink(actions, '원본 내려받기', casePath(`/documents/${encodeURIComponent(doc.id)}/download`), doc.name); actions.append(action('종류 · 대상 · 기간 수정', () => openDocumentEditor(doc)), action('자료 삭제', async () => { if (!confirm('이 자료를 삭제할까요? 연결된 사실과 검토 상태에 영향을 줄 수 있습니다.')) return; try { await mutateCase(`/documents/${encodeURIComponent(doc.id)}`, 'DELETE', { expected_revision: session.revision }, '자료를 삭제했습니다. 영향받은 항목을 확인해주세요.'); } catch {} }, 'quiet-danger')); card.append(actions); root.append(card); }
}

function alternativesText(value) {
  if (Array.isArray(value)) return value.map(alternativesText).filter(Boolean).join(' 또는 ');
  if (value && typeof value === 'object') { if (value.any_of) return alternativesText(value.any_of); if (value.all_of) return value.all_of.map(alternativesText).join(' + '); return readable(value); }
  return documentLabel(value);
}
function renderRequirements() {
  const root = $('requirement-list'); clear(root); const rows = listOf(session?.requirements); const missing = rows.filter((item) => !['satisfied', 'SATISFIED', 'NOT_APPLICABLE'].includes(item.status)).length;
  setText('requirement-count', rows.length ? `${rows.length}개 요건 · ${missing}개 확인 필요` : '평가 전');
  if (!rows.length) { root.append(emptyBox('사건 유형과 현재 자료를 저장한 뒤 필요서류·판단 갱신을 실행하세요.')); return; }
  for (const item of rows) { const card = node('article', undefined, 'workspace-row'); const top = node('div', undefined, 'row-heading'); top.append(node('h3', item.label || documentLabel(item.document_type)), stateBadge(item.status)); card.append(top);
    card.append(detailLine('대상 · 기간', `${objectLabel(item.subject_id)} · ${readable(item.period) || '기간 확인 필요'}`), detailLine('증명할 사실', (item.purpose_features || []).map(featureLabel).join(' · ') || '요구 조건 확인'), detailLine('요구 이유', readable(item.basis) || ({ COMMON_ATTACHMENT: '공통 첨부자료', CONDITIONAL_ATTACHMENT: '사건 조건에 따른 증빙', INTERNAL_VERIFICATION: '내부 사실 확인' })[item.document_basis] || '근거 확인 필요'));
    if (item.alternatives?.length) card.append(detailLine('허용 대체자료', alternativesText(item.alternatives)));
    if (item.missing_features?.length) card.append(detailLine('남은 항목', item.missing_features.map(featureLabel).join(' · ')));
    addSourceLinks(card, item.source_refs || item.legal_basis || []);
    const actions = node('div', undefined, 'row-actions'); const link = action('받은 자료 연결', () => openDocumentEditor(null, item)); link.disabled = !session?.documents?.length || busy; actions.append(link, action('추가 자료 올리기', () => { showView('documents'); $('file-input').click(); })); card.append(actions); root.append(card); }
}

function assetObjects() {
  const merged = new Map(); for (const item of [...listOf(session?.objects), ...listOf(session?.assets)]) { const id = objectId(item); if (id) merged.set(id, { ...(merged.get(id) || {}), ...item }); } return [...merged.values()];
}
function openObjectEditor(item = null) {
  beginEditor(item ? '대상 정보 수정' : '채무·재산 등 대상 추가', '같은 자산·채무는 하나의 대상으로 관리하고, 각 값의 근거는 사실 후보에 연결하세요.', async () => {
    const metadata = { ...(item?.metadata || {}) }; for (const key of ['make', 'model', 'year', 'mileage', 'address', 'area', 'ownership_share', 'note']) { const value = editValue(`object-${key}`); if (value) metadata[key] = value; else delete metadata[key]; }
    const result = await api(casePath('/objects' + (item ? `/${encodeURIComponent(objectId(item))}` : '')), { method: item ? 'PATCH' : 'POST', body: JSON.stringify(revisionBody({ type: editValue('object-type'), label: editValue('object-label'), metadata })) }); acceptSession(result); toast('대상 정보를 저장했습니다.');
  });
  editorField('대상 종류', 'object-type', item?.type || 'vehicle', { choices: Object.entries(objectNames).map(([value, label]) => ({ value, label })) });
  editorField('대상 이름', 'object-label', item?.label || '', { required: true, placeholder: '차량·부동산·채권자를 구분할 이름' });
  const grid = node('div', undefined, 'editor-grid'); $('editor-fields').append(grid);
  for (const [key, label] of Object.entries({ make: '차량 제조사', model: '차량 모델·등급', year: '연식', mileage: '주행거리(km)', address: '부동산 주소', area: '전용면적(㎡)', ownership_share: '소유 지분', note: '추가 정보' })) editorField(label, `object-${key}`, item?.metadata?.[key] || '', { parent: grid }); editorOpen();
}
function openValuationEditor(item) {
  beginEditor('시세·평가 근거 확인', '조회값은 평가 후보입니다. 조회 조건·출처·기준일을 확인한 뒤 별도 사실 후보로 검토하세요.', async () => {
    const parameters = { ...(item.metadata || {}), as_of: editValue('valuation-date'), query: editValue('valuation-query'), source_url: editValue('valuation-source'), document_id: editValue('valuation-document'), price: editValue('valuation-price') || null };
    const result = await api(casePath(`/assets/${encodeURIComponent(objectId(item))}/valuation`), { method: 'POST', body: JSON.stringify({ provider: editValue('valuation-provider'), parameters }) }); acceptSession(result); toast('시세 조회·자료 확인 상태를 갱신했습니다.');
  }, '조회 · 근거 등록');
  editorField('조회·평가 방식', 'valuation-provider', item.type === 'real_estate' ? 'molit_apartment' : item.type === 'vehicle' ? 'car365_reference' : 'manual_evidence', { choices: [{ value: 'car365_reference', label: '자동차365 자료 확인 · 본인 인증 필요' }, { value: 'configured_vehicle_api', label: '연결된 차량 시세 제공처' }, { value: 'molit_apartment', label: '국토부 아파트 실거래 · 연결 설정 필요' }, { value: 'manual_evidence', label: '보유 평가자료·출처 직접 등록' }] });
  editorField('평가 기준일', 'valuation-date', '', { type: 'date', required: true });
  editorField('조회 조건·설명', 'valuation-query', item.label || '', { multiline: true, note: '저장된 모델·연식·주소·면적 정보도 함께 전달합니다.' });
  editorField('근거 URL', 'valuation-source', '', { type: 'url', placeholder: 'https://…' });
  editorField('보유 근거 자료', 'valuation-document', '', { choices: [{ value: '', label: '자료 선택(선택사항)' }, ...(session.documents || []).map((doc) => ({ value: doc.id, label: doc.name }))] });
  editorField('자료에 명시된 평가액(원)', 'valuation-price', '', { note: '직접 등록할 때만 기재합니다. 조회 결과를 임의로 채우지 않습니다.' }); editorOpen();
}
function openDisposition(item) {
  beginEditor('처분 시나리오 비교', '실제 처분으로 기록하지 않는 가정입니다. 매각대금·상환·비용·대체재산을 함께 계산합니다.', async () => {
    const result = await api(casePath(`/assets/${encodeURIComponent(objectId(item))}/disposition`), { method: 'POST', body: JSON.stringify({ sale_amount: editValue('sale-amount'), payoff: editValue('payoff'), costs: editValue('costs'), successor_kind: editValue('successor-kind'), reason: editValue('scenario-reason') }) }); acceptSession(result); toast('처분 시나리오를 계산했습니다. 실제 재산 상태는 자동 변경하지 않습니다.');
  }, '가정으로 계산');
  editorField('예상 매각대금(원)', 'sale-amount', '', { required: true }); editorField('담보 등 상환금(원)', 'payoff', '', { required: true }); editorField('실제 처분비용(원)', 'costs', '', { required: true }); editorField('잔여대금의 형태', 'successor-kind', 'cash', { choices: [{ value: 'cash', label: '현금' }, { value: 'bank_deposit', label: '예금' }, { value: 'replacement_asset', label: '대체재산' }] }); editorField('가정과 검토 사유', 'scenario-reason', '', { required: true, multiline: true }); editorOpen();
}

function renderAssets() {
  const root = $('asset-list'); clear(root); const objects = assetObjects();
  if (!objects.length) { root.append(emptyBox('아직 연결된 대상이 없습니다. 채무·자산을 추가하거나 자료를 분석하세요.')); return; }
  for (const item of objects) { const card = node('article', undefined, 'asset-card'); const top = node('div', undefined, 'row-heading'); top.append(node('h3', item.label || '대상'), badge(objectNames[item.type] || item.type || '대상')); card.append(top, node('p', objectId(item), 'muted-note'));
    const values = listOf(session?.assertions).filter((row) => row.object_id === objectId(item) && !['SUPERSEDED', 'RETRACTED'].includes(row.state));
    for (const row of values.slice(0, 5)) card.append(detailLine(featureLabel(row.feature_key), `${displayValue(row.value)}${row.accepted_for_filing ? ' · 채택' : ' · 미채택'}`));
    for (const valuation of listOf(item.valuations || item.valuation)) { const box = node('div', undefined, 'valuation-result'); box.append(stateBadge(valuation.status), node('p', valuation.price !== null && valuation.price !== undefined ? amount(valuation.price, 'KRW') : '확정된 조회 금액 없음', 'assertion-value'), node('p', `${valuation.provider || '출처'} · ${valuation.as_of || '기준일 확인'}${valuation.reason ? ` · ${valuation.reason}` : ''}`, 'muted-note')); if (valuation.range) box.append(detailLine('조회 범위', readable(valuation.range))); addSafeLink(box, '평가 근거 ↗', valuation.source_url); card.append(box); }
    for (const scenario of listOf(item.scenarios || item.dispositions)) { const box = node('div', undefined, 'valuation-result'); box.append(badge('처분 가정', 'orange'), node('p', readable(scenario.summary || scenario.result || scenario), 'muted-note')); card.append(box); }
    const actions = node('div', undefined, 'row-actions'); actions.append(action('대상 수정', () => openObjectEditor(item)));
    if (['vehicle', 'real_estate', 'asset', 'lease', 'insurance'].includes(item.type)) actions.append(action('시세 · 평가 근거', () => openValuationEditor(item)), action('처분 가정 비교', () => openDisposition(item))); card.append(actions); root.append(card); }
}

function renderAssessment() {
  clear($('case-route')); clear($('assessment-axes')); clear($('notification-list')); clear($('finding-list'));
  const assessment = session?.assessment || {}; const route = assessment.route || session?.route;
  const routeNames = { DRAFT: ['초안 작성 단계', '현재 자료와 검토값으로 작성할 서류를 확인하세요.', 'outputs'], SUPPLEMENT: ['자료 보완이 필요합니다', '어떤 사실·기간이 부족한지 확인하고 보유자료를 연결하세요.', 'documents'], STRATEGY_REVIEW: ['조건과 가정을 검토하세요', '재산 평가·소득·변제 조건의 근거를 대조하세요.', 'assets'] };
  const selected = routeNames[route];
  if (selected) $('case-route').append(node('div', undefined, 'route-indicator'), node('div', undefined, 'route-copy')); else $('case-route').append(node('div', undefined, 'route-copy'));
  const copy = $('case-route').querySelector('.route-copy'); copy.append(node('h3', selected?.[0] || (session ? '현재 사건의 다음 작업을 확인하세요' : '새 사건을 만들거나 저장된 사건을 여세요')), node('p', selected?.[1] || '자료와 사실을 저장한 뒤 필요서류·판단 갱신을 실행하면 다음 작업이 표시됩니다.'));
  if (selected) $('case-route').append(action('확인하러 가기 →', () => showView(selected[2])));
  let axes = listOf(assessment.axes || assessment.dimensions);
  if (!axes.length) axes = Object.entries(assessment).filter(([key]) => axisNames[key]).map(([key, value]) => typeof value === 'object' ? { key, ...value } : { key, status: value });
  for (const axis of axes) { const box = node('article', undefined, 'axis-card'); box.append(node('h3', axis.label || axisNames[axis.key || axis.id] || axis.key || '판단'), stateBadge(axis.status || axis.result), node('p', axis.message || axis.reason || axis.note || readable(axis.summary) || (axis.total_requirements !== undefined ? `${axis.total_requirements}개 중 ${axis.satisfied_requirements || 0}개 증빙요건 확인` : '근거를 확인해주세요.'), 'muted-note')); $('assessment-axes').append(box); }
  for (const item of listOf(session?.notifications)) { const row = node('div', undefined, 'notification-row'); row.append(node('strong', item.title || item.label || '확인할 일'), node('p', item.message || item.description || '', 'muted-note')); $('notification-list').append(row); }
  const findings = listOf(session?.findings || assessment.findings);
  for (const finding of findings) { const card = node('article', undefined, 'workspace-row'); const head = node('div', undefined, 'row-heading'); head.append(node('h3', finding.label || finding.title || '확인할 조건'), stateBadge(finding.outcome || finding.result || finding.status)); card.append(head, node('p', finding.message || finding.reason || '', 'muted-note')); const features = finding.missing_features || finding.feature_keys || []; if (features.length) card.append(detailLine('확인할 사실', features.map(featureLabel).join(' · '))); if (finding.inputs) card.append(detailLine('사용한 입력', readable(finding.inputs))); if (finding.rule_version || finding.rule_release_id || finding.version) card.append(detailLine('적용 버전', finding.rule_version || finding.rule_release_id || finding.version)); addSafeLink(card, '적용 근거 ↗', finding.source_url); addSourceLinks(card, finding.source_ids); $('finding-list').append(card); }
  const risks = $('risk-checklist'); clear(risks);
  for (const item of listOf(session?.risk_checklist)) { const card = node('article', undefined, 'workspace-row'); const head = node('div', undefined, 'row-heading'); head.append(node('h3', item.title || '확인 조건'), stateBadge(item.outcome)); if (item.blocks_generation) head.append(badge('생성 전 확인', 'orange')); card.append(head); if (item.required_features?.length) card.append(detailLine('확인할 사실', item.required_features.map(featureLabel).join(' · '))); if (item.note) card.append(node('p', item.note, 'muted-note')); addSourceLinks(card, item.source_ids); risks.append(card); }
  if (!risks.children.length) risks.append(emptyBox('사건 평가 후 적용 조건과 보정·확인 항목이 표시됩니다.'));
  const gate = session?.generation_gate;
  setText('generation-gate', gate?.reason || '필수 사실과 검토 조건을 확인한 뒤 초안을 생성합니다.');
  $('generation-gate').className = `notice ${gate?.can_generate === false ? 'warning' : 'neutral'} gate-notice`;
}

function renderCaseCalculations() {
  const calculation = session?.calculation_results;
  const results = listOf(calculation?.results || (Array.isArray(calculation) ? calculation : []));
  if (!results.length) return;
  const stale = calculation.case_revision !== undefined && calculation.case_revision !== session.revision;
  const names = { 'KR.579.DEBT_LIMITS': '채무 구분별 합계·조건', 'SEOUL.405.BASIC_LIVING_2026': '가구 기준 생계비 산술', 'KR.614.MINIMUM_REPAYMENT': '적용 조건별 최저변제 검토', 'KR.614.LIQUIDATION_COMPARISON': '동일 기준 현재가치 비교', 'SEOUL.405.ADDITIONAL_HOUSING': '추가 주거비 산술', 'INCOME.MONTHLY_NET': '소득원별 월 소득 합계', 'PLAN.NOMINAL_PAYMENTS': '월 납부액과 명목 변제총액' };
  const labels = { secured_total: '담보채무 합계', other_total: '그 밖의 채무 합계', monthly_net: '월 소득', monthly_income: '인정 월 소득', monthly_disposable_income: '월 가용소득', monthly_payment: '월 납부액', repayment_months: '개월 수', total_nominal_repayment: '명목 변제총액', plan_total_pv: '계획 현재가치', liquidation_value_pv: '청산가치 기준액', margin_pv: '현재가치 차이', additional_housing_review: '주거비 검토 산술액', basic_living_arithmetic: '기본생계 산술액' };
  clear($('calculation-list')); show('calculation-empty', false); show('calculation-list');
  for (const item of results) { const card = node('article', undefined, 'calculation-card'); const head = node('div', undefined, 'row-heading'); head.append(node('h3', item.label || names[item.rule_id] || '수치 조건 계산'), stateBadge(stale ? 'stale' : item.outcome)); card.append(head);
    if (stale) card.append(node('p', '이전 사건 버전의 계산입니다. 현재 사실로 재계산해야 합니다.', 'muted-note'));
    for (const [key, value] of Object.entries(item.values || {})) card.append(detailLine(labels[key] || featureLabel(key), amount(value, /months|count/.test(key) ? '' : 'KRW')));
    const used = (item.input_assertion_ids || []).map((id) => session.assertions?.find((assertion) => assertionId(assertion) === id)).filter(Boolean);
    if (used.length) { const details = node('details'); details.append(node('summary', `계산에 사용한 사실 ${used.length}개`)); for (const assertion of used) { const line = node('div', undefined, 'calculation-input'); line.append(detailLine(featureLabel(assertion.feature_key), displayValue(assertion.value)), action('근거 · 수정', () => { showView('assertions'); openAssertionEditor(assertion); }, 'text-button')); details.append(line); } card.append(details); }
    if (item.missing_features?.length) card.append(detailLine('보류된 입력', item.missing_features.map(featureLabel).join(' · ')));
    for (const note of item.notes || []) card.append(node('p', note, 'muted-note'));
    card.append(node('p', `적용 판본 ${item.rule_version || item.rule_release_id || '확인 필요'} · 사건 v${calculation.case_revision || session.revision}`, 'muted-note')); $('calculation-list').append(card);
  }
}

function renderEvents() {
  const root = $('event-list'); clear(root); const events = listOf(session?.events); const versions = listOf(session?.artifact_history);
  if (!events.length && !versions.length) { root.append(emptyBox('사건의 변경 이력이 이곳에 표시됩니다.')); return; }
  for (const event of [...events].reverse()) { const row = node('article', undefined, 'event-row'); row.append(node('span', '•', 'event-mark'), node('div', undefined, 'event-copy')); const copy = row.lastChild; copy.append(node('h3', event.label || eventNames[event.type] || event.type || '변경 기록'), node('p', event.message || event.reason || event.summary || '', 'muted-note'), node('small', [formatTime(event.recorded_at || event.at || event.created_at), event.actor_id || event.actor, event.revision ? `v${event.revision}` : ''].filter(Boolean).join(' · '))); root.append(row); }
  for (const artifact of versions) {
    const row = node('article', undefined, 'event-row'); const content = node('div', undefined, 'event-copy');
    const current = artifact.status === 'current'; const version = artifact.case_revision || artifact.revision;
    content.append(node('h3', artifact.title || artifact.name), badge(current ? '현재 생성 버전' : '이전 생성 버전', 'neutral'),
      node('p', `${version ? `사건 v${version} · ` : ''}${formatTime(artifact.created_at) || '생성일 미확인'} · ${current ? '현재 자료와 검토 상태를 확인하세요.' : '보관된 파일입니다. 현재 사건의 최종 검토 상태를 의미하지 않습니다.'}`, 'muted-note'));
    const id = artifact.id || artifact.artifact_version_id; const url = artifact.version_url || (id ? casePath(`/artifact-versions/${encodeURIComponent(id)}/download`) : null);
    if (url) addDownloadLink(content, current ? '이 생성 버전 내려받기' : '이전 생성본 내려받기', url, artifact.name);
    row.append(content); root.append(row);
  }
}

window.renderArtifactActions = function (card, artifact) {
  const controls = node('div', undefined, 'artifact-tools');
  if (String(artifact.format || '').toUpperCase() === 'DOCX') controls.append(action('미리보기 · 수정', () => openFormEditor(artifact)));
  controls.append(action('현재 생성본 삭제', async () => { if (!confirm('현재 목록에서 이 생성본을 삭제할까요? 보관된 버전 이력은 유지됩니다.')) return; try { await mutateCase(`/artifacts/${encodeURIComponent(artifact.name)}`, 'DELETE', { expected_revision: session.revision }, '현재 생성본을 삭제했습니다.'); } catch {} }, 'quiet-danger'));
  card.append(controls);
};
async function openFormEditor(artifact) {
  if (!session) return;
  const caseId = session.id;
  try {
    const data = await api(casePath(`/forms/${encodeURIComponent(artifact.kind)}`));
    if (session?.id !== caseId) return;
    const changed = []; beginEditor(data.title || artifact.title, '내려받을 서류에 대응하는 값을 확인합니다. 계산값은 원본 사실을 수정한 뒤 다시 계산하세요.', async () => {
      const fields = changed.filter((entry) => entry.input.value !== entry.original).map((entry) => ({ key: entry.field.key, object_id: entry.field.object_id, value: parseFeatureValue(entry.input.value.trim(), entry.field.feature_key), reason: editValue('form-reason') }));
      if (!fields.length) throw new Error('수정한 값이 없습니다.');
      const result = await api(casePath(`/forms/${encodeURIComponent(data.kind || artifact.kind)}`), { method: 'PATCH', body: JSON.stringify(revisionBody({ fields })) }); acceptSession(result); generationChanged = true; toast('서류 필드에 연결된 사실을 수정했습니다. 다시 생성한 파일을 검토해주세요.');
    }, '변경값 저장');
    for (const field of data.fields || []) { const input = editorField(field.label || field.key, `form-${changed.length}`, field.value, { multiline: true, disabled: field.derived || field.editable === false }); const original = input.value; changed.push({ input, original, field });
      if (field.derived || field.editable === false) $('editor-fields').append(action('원본 사실 확인 후 재계산', () => { $('editor-dialog').close(); $('assertion-search').value = field.feature_key || ''; showView('assertions'); renderAssertions(); }, 'text-button'));
      else if (field.feature_key) $('editor-fields').append(node('p', `연결 항목: ${featureLabel(field.feature_key)}${field.object_id ? ` · ${objectLabel(field.object_id)}` : ''}`, 'muted-note'));
      renderEvidence($('editor-fields'), field.sources || []);
    }
    if (data.rows?.length) { const details = node('details'); details.append(node('summary', '반복 행의 현재 내용')); for (const row of data.rows) details.append(node('p', readable(row), 'muted-note')); $('editor-fields').append(details); }
    editorField('변경 사유', 'form-reason', '', { multiline: true, required: true }); editorOpen();
  } catch (error) { errorMessage(error); }
}

async function loadKnowledge() {
  try { knowledgeState = await api('/api/knowledge/status'); renderKnowledge(); }
  catch (error) { clear($('knowledge-status')); $('knowledge-status').append(node('p', error.message, 'muted-note')); }
}
function renderKnowledge() {
  const root = $('knowledge-status'); clear(root); const data = knowledgeState || {};
  const checked = listOf(data.sources).map((source) => source.checked_at).filter(Boolean).sort().at(-1);
  const top = node('div', undefined, 'workspace-row'); top.append(detailLine('최근 변경 확인', formatTime(data.last_check?.at || data.last_check?.checked_at || (typeof data.last_check === 'string' ? data.last_check : null) || checked) || '아직 확인하지 않음'));
  if (data.vector_ready === false) top.append(node('p', '검토된 근거 검색은 준비 중입니다. 자료와 검색 연결 상태를 확인하세요.', 'muted-note'));
  if (data.last_check?.status) top.append(stateBadge(data.last_check.status)); root.append(top);
  for (const release of listOf(data.releases)) { const card = node('article', undefined, 'workspace-row'); card.append(node('h3', release.label || release.title || release.id || release.version || '법규 적용본'), stateBadge(release.status), node('p', `버전 ${release.version || '확인 필요'} · 시행 ${release.effective_from || release.effective_date || '확인 필요'}`, 'muted-note')); root.append(card); }
  for (const change of listOf(data.changes)) { const row = node('article', undefined, 'workspace-row'); row.append(badge('변경 후보', 'orange'), node('h3', change.title || change.label || change.source_id || '근거 변경'), node('p', change.summary || change.message || change.reason || '', 'muted-note')); addSafeLink(row, '공식 근거 확인 ↗', change.source_url || change.url); root.append(row); }
  for (const source of listOf(data.sources)) { const row = node('div', undefined, 'knowledge-source'); row.append(node('strong', source.title || source.label || source.id || '법규 출처'), node('span', `${stateLabel(source.status || source.check_status)}${source.effective_from ? ` · 시행 ${source.effective_from}` : ''}`, 'muted-note')); addSafeLink(row, '원문 ↗', source.url || source.source_url); root.append(row); }
  for (const notification of listOf(data.notifications)) root.append(node('p', readable(notification), 'notice neutral'));
}

window.renderCaseWorkspace = function () {
  setText('workspace-title', session?.name || '사건의 다음 단계를, 함께.');
  setText('workspace-subtitle', session ? '자료·사실·계산·검토의 근거를 같은 사건에서 이어갑니다.' : '저장된 사건을 다시 열거나 새 사건을 시작하세요.');
  setText('income-type-caption', session ? incomeNames[session.income_type] || '소득유형 확인 중' : '사건을 선택하세요');
  setText('case-save-status', session ? `저장된 사건 · v${session.revision || 1}${session.updated_at ? ` · 마지막 저장 ${formatTime(session.updated_at)}` : ''}` : '사건을 닫아도 자료는 유지됩니다. 목록에서 다시 열 수 있습니다.');
  setText('case-branch-note', ['wage', 'salary'].includes(session?.income_type) ? '급여·재직·공제 자료와 이직 시점을 대조합니다. 증빙기간과 평균 산정기간을 구분하세요.' : session?.income_type === 'business' ? '매출·필요경비·세무·사업계좌를 대조합니다. 거래내역 합계를 곧바로 소득으로 확정하지 않습니다.' : '각 소득원과 자료 기간을 구분하고 반복성·인정값을 검토합니다.');
  const release = session?.rule_release || catalogue.rule_release;
  const releaseReviewed = ['ACTIVE', 'VERIFIED', 'APPROVED'].includes(release?.status);
  $('case-rule-status').className = `notice ${releaseReviewed ? 'neutral' : 'warning'}`;
  setText('case-rule-status', release ? `적용 규칙: ${release.id || release.version || '버전 확인 필요'} · ${release.status || '상태 미확인'}. ${releaseReviewed ? '시행일과 사건 적용 범위를 원문 근거와 함께 확인하세요.' : '법률 근거·시행일·계산 규칙의 검토가 필요합니다. 검토되지 않은 적용본은 문서 생성을 보류합니다.'}` : '적용 규칙의 검토 상태를 확인해야 합니다. 법률 근거와 시행일이 확인되기 전에는 생성 가능 여부를 확정하지 않습니다.');
  $('case-select').value = session?.id || '';
  if (session?.assertions?.length) {
    const replaced = new Set(session.assertions.flatMap((item) => item.supersedes ? [item.supersedes] : []));
    const current = session.assertions.filter((item) => !replaced.has(assertionId(item)) && !item.superseded_by && !['RETRACTED', 'SUPERSEDED', 'REJECTED'].includes(item.state));
    const accepted = current.filter((item) => item.accepted_for_filing).length;
    const blockers = session.generation_gate?.blocking_issue_ids?.length || (session.findings || []).filter((item) => item.blocks_generation).length;
    setText('metric-records', current.length); setText('metric-confirmed', `${accepted}개 작성에 채택 · 이전 버전 제외`);
    setText('metric-issues', current.length - accepted); setText('metric-issues-detail', `미채택 후보 ${current.length - accepted}개 · 생성 전 확인 ${blockers}건`);
  }
  renderAssessment(); renderCaseCalculations(); renderDocumentRegister(); renderRequirements(); renderAssertions(); renderAssets(); renderEvents(); updateCaseControls(); showView(activeView);
};

document.querySelectorAll('[data-view]').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); showView(link.dataset.view); }));
$('case-new').addEventListener('click', () => openCaseEditor());
$('case-edit').addEventListener('click', () => session && openCaseEditor(true));
$('case-select').addEventListener('change', async () => { const id = $('case-select').value; if (!id) { await closeCurrentSession(); return; } setBusy(true); try { const result = await api(`/api/cases/${encodeURIComponent(id)}`); clearTransientUI(); acceptSession(result); showView('overview'); } catch (error) { errorMessage(error); } finally { setBusy(false); } });
$('case-delete').addEventListener('click', async () => { if (!session || !confirm('이 사건과 연결된 자료를 삭제할까요? 이 작업은 사건 닫기와 다르며 복원할 수 없습니다.')) return; const id = session.id; try { await mutateCase('', 'DELETE', undefined); await closeCurrentSession(); caseSummaries = caseSummaries.filter((item) => item.id !== id); renderCaseSelector(); toast('사건을 삭제했습니다.'); } catch {} });
$('editor-form').addEventListener('submit', async (event) => { event.preventDefault(); if (!editorSubmit || busy || editorSaving) return; editorSaving = true; $('editor-save').disabled = true; show('editor-error', false); try { assertEditorCase(); await editorSubmit(); $('editor-dialog').close(); } catch (error) { setText('editor-error', error.message); show('editor-error'); if (error.status === 409) { await refreshSession(); setText('editor-error', '다른 변경이 먼저 저장되었습니다. 창을 닫고 최신 내용으로 다시 편집해주세요.'); } } finally { editorSaving = false; $('editor-save').disabled = false; } });
$('assertion-new').addEventListener('click', () => session && openAssertionEditor());
$('assertion-filter').addEventListener('change', renderAssertions); $('assertion-search').addEventListener('input', renderAssertions);
$('object-new').addEventListener('click', () => session && openObjectEditor());
$('assess-button').addEventListener('click', async () => { try { await mutateCase('/assess', 'POST', {}, '필요서류와 판단 갱신을 요청했습니다. 처리 상태를 확인해주세요.'); } catch {} });
$('generate-case').addEventListener('click', async () => { try { await mutateCase('/generate', 'POST', {}, '초안 생성을 요청했습니다. 완료 후 생성본을 검토해주세요.'); } catch {} });
$('knowledge-check').addEventListener('click', async () => { $('knowledge-check').disabled = true; try { await api('/api/knowledge/check', { method: 'POST', body: '{}' }); await loadKnowledge(); toast('법규 변경 확인 결과를 갱신했습니다. 새 후보는 검토 상태를 확인하세요.'); } catch (error) { errorMessage(error); } finally { $('knowledge-check').disabled = false; } });
$('rule-release-review').addEventListener('click', openRuleReleaseReview);
$('knowledge-search').addEventListener('submit', async (event) => { event.preventDefault(); const query = $('knowledge-query').value.trim(); if (!query) return; const params = new URLSearchParams({ q: query, as_of: $('knowledge-asof').value }); if (session) params.set('case_id', session.id); try { const data = await api(`/api/knowledge/search?${params}`); const results = Array.isArray(data) ? data : data.results || data.items || []; clear($('knowledge-results')); if (!results.length) $('knowledge-results').append(emptyBox('조건에 맞는 검토된 근거·사례가 없습니다.')); for (const result of results) { const card = node('article', undefined, 'workspace-row'); card.append(node('h3', result.title || result.label || '검색 결과'), node('p', result.excerpt || result.text || result.content || result.summary || '', 'knowledge-excerpt'), node('p', `${result.authority_type || result.authority || result.kind || '근거'} · ${result.effective_from || result.valid_from || result.as_of || '기준일 확인 필요'}${result.version ? ` · v${result.version}` : ''}`, 'muted-note')); addSafeLink(card, '출처 ↗', result.source_url || result.url); $('knowledge-results').append(card); } } catch (error) { errorMessage(error); } });

render();
loadCases();
loadCatalogue();
