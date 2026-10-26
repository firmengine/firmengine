'use strict';

// The server owns persisted cases. This page holds only the currently open snapshot.
const $ = (id) => document.getElementById(id);
let session = null;
let health = null;
let selectedFiles = [];
let pollTimer = null;
let toastTimer = null;
let busy = false;
let editingRecord = null;
let editingRecordRevision = null;
let lastHeartbeat = 0;
let refreshInFlight = false;
let generationChanged = false;

function node(tag, text, className) {
  const item = document.createElement(tag);
  if (text !== undefined && text !== null) item.textContent = String(text);
  if (className) item.className = className;
  return item;
}

function setText(id, text) { $(id).textContent = text ?? ''; }
function show(id, visible = true) { $(id).hidden = !visible; }
function clear(item) { item.replaceChildren(); }

function badge(text, tone = 'neutral') { return node('span', text, `badge ${tone}`); }

function safeUrl(raw, sameOrigin = true) {
  try {
    const parsed = new URL(raw, window.location.origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (sameOrigin && parsed.origin !== window.location.origin) return null;
    return parsed.href;
  } catch { return null; }
}

function displayValue(value) {
  if (value === null || value === undefined || value === '') return '미확인';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function displayUnit(unit) { return ({ KRW: '원', months: '개월', persons: '명', people: '명' })[unit] || unit || ''; }

function amount(value, unit) {
  if (value === null || value === undefined || value === '') return '확인 필요';
  const raw = String(value);
  const normalized = raw.replaceAll(',', '');
  const number = Number(normalized);
  const display = /^-?\d+$/.test(normalized) ? new Intl.NumberFormat('ko-KR').format(BigInt(normalized)) : raw.trim() !== '' && Number.isFinite(number) ? new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 3 }).format(number) : raw;
  return unit ? `${display} ${displayUnit(unit)}` : display;
}

function formatBytes(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('ko-KR', { hour12: false });
}

function toast(message, isError = false) {
  clearTimeout(toastTimer);
  setText('toast', message);
  $('toast').className = `toast${isError ? ' error' : ''}`;
  show('toast');
  toastTimer = setTimeout(() => show('toast', false), 5000);
}

function errorMessage(error) {
  const message = error?.message || '요청을 완료하지 못했습니다. 연결 상태를 확인해주세요.';
  setText('error-notice', message);
  show('error-notice');
  toast(message, true);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  let response;
  try { response = await fetch(path, { ...options, headers, cache: 'no-store' }); }
  catch { throw new Error('로컬 서버에 연결할 수 없습니다. 서버 실행 상태를 확인해주세요.'); }
  const contentType = response.headers.get('content-type') || '';
  let payload = null;
  if (contentType.includes('application/json')) payload = await response.json();
  if (!response.ok) {
    let detail = payload?.detail ?? payload?.message ?? `요청 실패 (${response.status})`;
    if (Array.isArray(detail)) detail = detail.map((item) => item.msg || item.message || String(item)).join('\n');
    if (typeof detail === 'object') detail = detail.message || JSON.stringify(detail);
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function sessionPath(suffix = '') { return `/api/sessions/${encodeURIComponent(session.id)}${suffix}`; }
function casePath(suffix = '') { return `/api/cases/${encodeURIComponent(session.id)}${suffix}`; }
function isProcessing() { return ['running', 'queued'].includes(session?.status); }

function setBusy(value) {
  busy = value;
  $('upload-button').disabled = value || !session || selectedFiles.length === 0;
  $('sample-button').disabled = value;
  $('file-input').disabled = value || !session;
  $('end-session').disabled = value;
  $('run-button').disabled = value || isProcessing();
  $('regenerate-button').disabled = value || isProcessing();
  updateReviewControls();
  window.updateCaseControls?.();
}

async function loadHealth() {
  try {
    health = await api('/api/health');
    const linked = Boolean(health.n8n_ready);
    $('n8n-dot').className = `status-dot${linked ? '' : ' pending'}`;
    setText('n8n-label', linked ? '자동화 연결됨' : '자동화 연결 대기');
    const link = safeUrl(health.n8n_url || 'http://localhost:5679', false);
    if (link) $('n8n-link').href = link;
    if (!health.api_key_configured) {
      $('service-notice').className = 'notice warning';
      setText('service-notice', 'AI 연결 설정이 필요합니다. 로컬 환경의 API 키 설정을 확인한 뒤 분석을 실행해주세요.');
    } else if (!linked) {
      $('service-notice').className = 'notice warning';
      setText('service-notice', '자료를 업로드할 수 있습니다. 자동화를 시작하려면 로컬 n8n을 실행하고 워크플로우를 활성화해주세요.');
    } else {
      $('service-notice').className = 'notice neutral';
      setText('service-notice', '작업 준비가 완료되었습니다. 자료를 분석한 뒤 원본 근거와 생성된 서류를 직접 확인할 수 있습니다.');
    }
  } catch (error) {
    $('n8n-dot').className = 'status-dot error';
    setText('n8n-label', '연결 확인 필요');
    $('service-notice').className = 'notice warning';
    setText('service-notice', error.message);
  }
}

function chooseFiles(files) {
  const accepted = Array.from(files).filter((file) => /\.(pdf|jpe?g|png)$/i.test(file.name));
  if (accepted.length !== files.length) toast('PDF·JPG·PNG 형식의 파일만 선택할 수 있습니다.', true);
  selectedFiles = accepted;
  clear($('selected-files'));
  for (const file of selectedFiles) {
    const row = node('li');
    row.append(node('span', file.name), node('small', formatBytes(file.size)));
    $('selected-files').append(row);
  }
  setBusy(busy);
}

function clearTransientUI() {
  editingRecord = null;
  editingRecordRevision = null;
  generationChanged = false;
  lastHeartbeat = 0;
  for (const id of ['record-dialog', 'page-dialog', 'editor-dialog']) if ($(id).open) $(id).close();
  for (const id of ['record-value', 'record-reason', 'caseworker-name', 'lawyer-name', 'evidence-pages', 'file-input']) $(id).value = '';
  $('page-image').removeAttribute('src');
  $('template-approved').checked = false;
  clear($('record-sources'));
  clear($('record-candidates'));
  chooseFiles([]);
}

async function closeCurrentSession() {
  if (!session) return true;
  clearTimeout(pollTimer);
  session = null;
  clearTransientUI();
  render();
  return true;
}

function acceptSession(payload) {
  if (!payload || !payload.id) throw new Error('서버가 유효한 사건 정보를 반환하지 않았습니다.');
  if (!session || payload.id !== session.id) {
    $('template-approved').checked = false;
    $('caseworker-name').value = '';
    $('lawyer-name').value = '';
    lastHeartbeat = 0;
  }
  session = payload;
  window.caseAccepted?.(payload);
  if (session.template_approved) $('template-approved').checked = true;
  render();
  schedulePoll();
}

function schedulePoll() {
  clearTimeout(pollTimer);
  if (!session) return;
  // Workflow progress and stored case changes are observed without altering review state.
  pollTimer = setTimeout(refreshSession, isProcessing() ? 2000 : 12000);
}

async function refreshSession() {
  if (!session || refreshInFlight) return;
  const currentId = session.id;
  refreshInFlight = true;
  try {
    const result = await api(casePath());
    if (session?.id === currentId && Number(result.revision || 0) >= Number(session.revision || 0)) {
      session = result;
      render();
    }
  } catch (error) {
    if (session?.id !== currentId) return;
    if ([404, 410].includes(error.status)) {
      session = null;
      clearTransientUI();
      render();
      errorMessage(new Error('이 사건을 찾을 수 없습니다. 사건 목록을 새로 확인해주세요.'));
    } else {
      setText('progress-message', '진행 상태를 다시 확인하고 있습니다.');
    }
  } finally {
    refreshInFlight = false;
    schedulePoll();
  }
}

async function runSession() {
  if (!session) return;
  await loadHealth();
  if (health && !health.api_key_configured) throw new Error('API 키를 설정한 뒤 자동화를 실행해주세요.');
  const result = await api(casePath('/run'), { method: 'POST', body: '{}' });
  generationChanged = false;
  if (result?.id) acceptSession(result);
  else await refreshSession();
}

function stageIndex() {
  if (!session) return -1;
  if (session.status === 'reviewed' || session.reviews?.lawyer) return 5;
  if (session.stage === 'edited') return 2;
  if (session.status === 'needs_action') return 2;
  if (session.status === 'ready') return 4;
  const stage = String(session.stage || '').toLowerCase();
  if (/review|ready|complete|done/.test(stage)) return 4;
  if (/generat|render|document|draft/.test(stage)) return 3;
  if (/valid|calcul|reconcil|mapping|check/.test(stage)) return 2;
  if (/extract|classif|ocr|analy/.test(stage)) return 1;
  return 0;
}

function recordState(record) {
  const labels = {
    confirmed: ['확인 완료', 'green'], conflict: ['불일치', 'orange'], missing: ['자료 필요', 'orange'],
    unreviewed: ['미확인', 'neutral'], accepted: ['확인 완료', 'green'], rejected: ['제외', 'neutral'], excluded: ['이번 작성 제외', 'neutral']
  };
  return labels[record.state] || ['미확인', 'neutral'];
}

function render() {
  const records = session?.records || [];
  const docs = session?.documents || [];
  const artifacts = session?.artifacts || [];
  const issues = session?.issues || [];
  const confirmed = records.filter((record) => ['confirmed', 'accepted'].includes(record.state)).length;
  const unresolved = records.filter((record) => !['confirmed', 'accepted', 'excluded'].includes(record.state)).length;
  const excluded = records.filter((record) => record.state === 'excluded').length;
  const blocking = issues.filter((issue) => ['error', 'blocking', 'critical'].includes(issue.severity)).length;
  const pages = docs.reduce((total, doc) => total + (Number(doc.pages) || 0), 0);
  const evidencePages = docs.reduce((total, doc) => total + (Array.isArray(doc.evidence_pages) ? doc.evidence_pages.length : 0), 0);
  const running = isProcessing();
  const statusLabels = { uploaded: ['접수 완료', 'neutral'], queued: ['처리 대기', 'neutral'], running: ['처리 중', 'green'], needs_action: ['자료·검토 보완 필요', 'orange'], ready: ['검토 대기', 'orange'], failed: ['처리 실패 · 확인 필요', 'red'], reviewed: ['검토 완료', 'green'] };
  const [statusLabel, tone] = session ? statusLabels[session.status] || ['확인 필요', 'neutral'] : ['시작 대기', 'neutral'];

  setText('session-status', statusLabel);
  $('session-status').className = `badge ${tone}`;
  show('session-section', Boolean(session));
  show('end-session', Boolean(session));
  const stage = stageIndex();
  Array.from($('pipeline').children).forEach((item, index) => {
    item.classList.toggle('done', index < stage);
    item.classList.toggle('active', index === stage);
    item.querySelector('.step-number').textContent = index < stage ? '✓' : String(index + 1);
  });
  setText('metric-documents', session ? docs.length : '—');
  setText('metric-pages', session ? `전체 ${pages}쪽${evidencePages ? ` · 분석 대상 ${evidencePages}쪽` : ' · 증빙 구분 대기'}` : '자료 업로드를 기다립니다');
  setText('metric-records', session ? records.length : '—');
  setText('metric-confirmed', session ? `${confirmed}개 확인 완료${excluded ? ` · ${excluded}개 제외` : ''}` : '원본 근거와 함께 확인');
  setText('metric-issues', session ? unresolved : '—');
  setText('metric-issues-detail', session ? `미확인 값 ${unresolved}개 · 진행 차단 ${blocking}건` : '누락·불일치·담당자 판단');
  setText('metric-artifacts', session ? artifacts.length : '—');
  setText('metric-review', session?.reviews?.lawyer ? '생성본 최종 확인 완료' : '생성 후 검토가 필요합니다');
  setText('record-count', records.length ? `${records.length}개 항목` : '대기 중');
  if (session) {
    setText('session-caption', `CURRENT CASE · ${session.id.slice(0, 8)}`);
    setText('progress-message', `${session.message || (running ? '서류를 처리하고 있습니다.' : '자료가 준비되었습니다.')}${running ? ' 처리 중에도 자료와 값을 수정할 수 있으며 변경한 버전으로 다시 평가합니다.' : ''}`);
    setText('session-detail', `버전 ${session.revision ?? 1} · ${docs.length}개 자료 · ${statusLabel}`);
    const progress = Math.max(0, Math.min(100, Number(session.progress) || 0));
    $('progress-fill').style.width = `${progress}%`;
    $('progress-track').setAttribute('aria-valuenow', String(progress));
    $('work-indicator').classList.toggle('running', running);
    $('work-indicator').textContent = running ? '↻' : session.status === 'reviewed' ? '✓' : '↗';
    show('run-button', docs.length > 0 && !running);
    setText('run-button', session.status === 'failed' ? '자동화 다시 실행' : records.length ? '새 자료 포함 다시 분석' : '서류 자동화 시작');
  }

  renderDocuments(docs);
  renderIssues(issues);
  renderRecords(records);
  renderCalculations(session?.calculations || []);
  renderArtifacts(artifacts);
  renderReviews();
  show('regenerate-bar', Boolean(session && records.length && !running));
  setText('regenerate-button', generationChanged ? '변경한 값으로 문서 다시 생성' : '확정값으로 문서 다시 생성');
  setBusy(busy);
  window.renderCaseWorkspace?.();
}

function renderDocuments(documents) {
  const root = $('source-documents');
  clear(root);
  show('source-documents', documents.length > 0);
  for (const doc of documents) {
    const chip = node('div', undefined, 'source-chip');
    const evidenceCount = Array.isArray(doc.evidence_pages) ? doc.evidence_pages.length : 0;
    const excludedCount = Array.isArray(doc.excluded_pages) ? doc.excluded_pages.length : 0;
    chip.append(node('strong', doc.name || '업로드 자료'), node('small', evidenceCount ? `분석 ${evidenceCount}페이지${excludedCount ? ` · 제외 ${excludedCount}페이지` : ''}` : `전체 ${doc.pages ?? '—'}페이지 · 증빙 구분 대기`));
    root.append(chip);
  }
}

function renderIssues(issues) {
  clear($('issue-list'));
  show('issue-list', issues.length > 0);
  for (const issue of issues) {
    const error = ['error', 'blocking', 'critical'].includes(issue.severity);
    const row = node('div', undefined, `issue-row${error ? ' error' : ''}`);
    row.append(node('span', error ? '!' : '•'), node('span', issue.message || issue.code));
    $('issue-list').append(row);
  }
}

function renderRecords(records) {
  const table = $('record-table');
  clear(table);
  show('record-empty', records.length === 0);
  show('record-table-wrap', records.length > 0);
  for (const record of records) {
    const row = node('tr');
    const label = node('td');
    label.append(node('strong', record.label || record.key), node('small', record.entity || '', 'subline'));
    const missing = record.value === null || record.value === undefined || record.value === '';
    const value = node('td', displayValue(record.value), `value-cell${missing ? ' missing' : ''}`);
    const period = node('td', [record.period, displayUnit(record.unit)].filter(Boolean).join(' · ') || '—');
    const state = node('td');
    const [stateLabel, stateTone] = recordState(record);
    state.append(badge(stateLabel, stateTone));
    const source = node('td');
    const sources = record.sources || [];
    if (sources.length) {
      const sourceButton = node('button', `${sources.length}개 근거 ↗`, 'source-button');
      sourceButton.type = 'button';
      sourceButton.addEventListener('click', () => openRecord(record.id));
      source.append(sourceButton);
    } else source.textContent = '—';
    const action = node('td');
    const button = node('button', '검토', 'button secondary small');
    button.type = 'button';
    button.disabled = busy;
    button.addEventListener('click', () => openRecord(record.id));
    action.append(button);
    row.append(label, value, period, state, source, action);
    table.append(row);
  }
}

function renderCalculations(calculations) {
  const root = $('calculation-list');
  clear(root);
  show('calculation-empty', calculations.length === 0);
  show('calculation-list', calculations.length > 0);
  for (const calculation of calculations) {
    const card = node('article', undefined, 'calculation-card');
    const heading = node('div', undefined, 'calc-heading');
    const hasValue = calculation.value !== null && calculation.value !== undefined && calculation.value !== '';
    const statusLabels = { calculated: '계산됨', confirmed: '확인됨', ready: '계산됨', computed: '계산됨', blocked: '보류', missing: '자료 필요', pending: '확인 필요', unverified: '검증 필요' };
    heading.append(node('h3', calculation.label || calculation.key), badge(statusLabels[calculation.status] || (hasValue ? '계산 후보' : '확인 필요'), hasValue ? 'green' : 'orange'));
    card.append(heading, node('p', amount(calculation.value, calculation.unit), 'calc-value'), node('p', calculation.formula || '필요한 값과 적용 기준을 확인해주세요.', 'calc-formula'));
    root.append(card);
  }
}

function renderArtifacts(artifacts) {
  const root = $('artifact-list');
  clear(root);
  show('artifact-empty', artifacts.length === 0);
  show('artifact-list', artifacts.length > 0);
  show('draft-notice', artifacts.length > 0 && !session?.reviews?.lawyer);
  const reviewed = Boolean(session?.reviews?.lawyer);
  setText('document-status', artifacts.length ? (reviewed ? '검토 완료' : '미검토 초안') : '초안 생성 전');
  $('document-status').className = `badge ${artifacts.length ? reviewed ? 'green' : 'orange' : 'neutral'}`;
  for (const artifact of artifacts) {
    const card = node('article', undefined, 'artifact-card');
    const format = (artifact.format || artifact.name?.split('.').pop() || '').toUpperCase();
    card.append(node('span', format, `artifact-icon${format === 'XLSX' ? ' xlsx' : ''}`));
    const content = node('div', undefined, 'artifact-copy');
    content.append(node('h3', artifact.title || artifact.name), node('p', artifact.name || `${format} 파일`));
    card.append(content);
    const url = safeUrl(artifact.url);
    if (url) {
      const link = node('a', '↓', 'artifact-download');
      link.href = url;
      link.setAttribute('aria-label', `${artifact.title || artifact.name} 내려받기`);
      link.download = artifact.name || '';
      link.addEventListener('click', heartbeat);
      card.append(link);
    }
    window.renderArtifactActions?.(card, artifact);
    root.append(card);
  }
}

function renderReviews() {
  const artifacts = session?.artifacts || [];
  const currentRevision = session?.revision;
  setText('review-version', artifacts.length ? `생성본 v${currentRevision ?? 1}` : '생성본 없음');
  for (const role of ['caseworker', 'lawyer']) {
    const review = session?.reviews?.[role];
    setText(`${role}-result`, review ? `${review.name} · ${formatTime(review.at)} · v${review.revision ?? currentRevision}` : '');
  }
  const unresolved = (session?.records || []).filter((record) => !['confirmed', 'accepted', 'excluded'].includes(record.state)).length;
  const blocking = (session?.issues || []).filter((issue) => ['error', 'blocking', 'critical'].includes(issue.severity)).length;
  $('review-readiness').className = 'notice neutral';
  if (!artifacts.length) setText('review-readiness', generationChanged ? '값이 변경되었습니다. 문서를 다시 생성한 뒤 최종 검토를 진행하세요.' : '문서가 생성되면 검토할 수 있습니다.');
  else if (session?.reviews?.lawyer) {
    setText('review-readiness', '이 생성본의 최종 확인이 완료되었습니다. 검토 완료 상태의 파일을 내려받을 수 있습니다.');
    $('review-readiness').className = 'notice success';
  } else if (unresolved || blocking) {
    setText('review-readiness', `미확인 항목 ${unresolved}개${blocking ? ` · 차단 사유 ${blocking}개` : ''}가 있습니다. 원본과 생성 문서를 확인하고 필요한 항목을 해결해주세요.`);
    $('review-readiness').className = 'notice warning';
  } else if (session?.reviews?.caseworker) setText('review-readiness', '담당자 확인이 완료되었습니다. 변호사의 최종 확인을 진행해주세요.');
  else setText('review-readiness', '생성된 서류를 내려받아 확인한 뒤, 양식 일치 여부와 담당자 확인을 진행해주세요.');
  updateReviewControls();
}

function updateReviewControls() {
  const hasArtifacts = Boolean(session?.artifacts?.length);
  const enabled = hasArtifacts && !busy && !isProcessing();
  $('template-approved').disabled = !enabled;
  $('caseworker-button').disabled = !enabled || !session || Boolean(session.reviews?.caseworker);
  $('lawyer-button').disabled = !enabled || !session?.reviews?.caseworker || Boolean(session?.reviews?.lawyer);
  $('caseworker-name').disabled = !enabled || Boolean(session?.reviews?.caseworker);
  $('lawyer-name').disabled = !enabled || Boolean(session?.reviews?.lawyer);
}

function openRecord(recordId) {
  const record = session?.records?.find((item) => item.id === recordId);
  if (!record) return;
  editingRecord = record.id;
  editingRecordRevision = session.revision;
  $('record-exclude').disabled = record.state === 'excluded';
  setText('record-save', record.state === 'excluded' ? '다시 포함 및 확인' : '값 확인 및 저장');
  setText('record-dialog-title', record.label || record.key);
  $('record-value').value = record.value === null || record.value === undefined ? '' : typeof record.value === 'object' ? JSON.stringify(record.value) : String(record.value);
  $('record-reason').value = '';
  clear($('record-candidates'));
  const candidates = record.candidates || [];
  show('record-candidates', candidates.length > 0);
  if (candidates.length) {
    $('record-candidates').append(node('p', '서류에서 서로 다른 값이 확인되었습니다. 근거를 대조한 뒤 선택하거나 수정하세요.'));
    for (const candidate of candidates) {
      const button = node('button', displayValue(candidate.value));
      button.type = 'button';
      button.addEventListener('click', () => { $('record-value').value = candidate.value ?? ''; });
      $('record-candidates').append(button);
    }
  }
  clear($('record-sources'));
  const sources = [...(record.sources || []), ...candidates.flatMap((candidate) => candidate.sources || [])];
  const seen = new Set();
  for (const source of sources) {
    const key = `${source.document_id}:${source.page}:${source.quote || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const doc = session.documents?.find((item) => item.id === source.document_id);
    const evidence = node('div', undefined, 'source-evidence');
    const button = node('button', `${doc?.name || '원본 자료'} · ${source.page ?? '?'}페이지 ↗`, 'source-button');
    button.type = 'button';
    button.addEventListener('click', () => openPage(source.document_id, source.page, doc?.name || '원본 자료'));
    evidence.append(button, node('blockquote', source.quote || '원본 페이지에서 확인해주세요.'));
    $('record-sources').append(evidence);
  }
  if (!seen.size) $('record-sources').append(node('p', '연결된 원본 근거가 없습니다. 확인 가능한 자료와 사유를 바탕으로 입력해주세요.', 'inline-note'));
  $('record-dialog').showModal();
}

function openPage(documentId, page, name) {
  if (!session || !documentId || !page) return;
  setText('page-dialog-title', `${name} · ${page}페이지`);
  $('page-image').alt = `${name} ${page}페이지 원본`;
  $('page-image').src = sessionPath(`/pages/${encodeURIComponent(documentId)}/${encodeURIComponent(page)}`);
  $('page-dialog').showModal();
}

async function heartbeat(event) {
  if (event && !event.isTrusted) return;
  if (!session || Date.now() - lastHeartbeat < 30000) return;
  lastHeartbeat = Date.now();
  try { await api(sessionPath('/heartbeat'), { method: 'POST' }); }
  catch { /* A later refresh will show an unavailable case. */ }
}

$('file-input').addEventListener('change', (event) => chooseFiles(event.target.files));
for (const type of ['dragenter', 'dragover']) $('drop-zone').addEventListener(type, (event) => { event.preventDefault(); if (!busy && session) $('drop-zone').classList.add('dragover'); });
for (const type of ['dragleave', 'drop']) $('drop-zone').addEventListener(type, (event) => { event.preventDefault(); $('drop-zone').classList.remove('dragover'); });
$('drop-zone').addEventListener('drop', (event) => { if (!busy && session) chooseFiles(event.dataTransfer.files); });

$('upload-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!session || !selectedFiles.length || busy) return;
  show('error-notice', false);
  setBusy(true);
  try {
    const uploadFiles = [...selectedFiles];
    const pages = $('evidence-pages').value.trim();
    const form = new FormData();
    for (const file of uploadFiles) form.append('files', file);
    if (pages) form.append('evidence_pages', pages);
    acceptSession(await api(casePath('/documents'), { method: 'POST', body: form }));
    chooseFiles([]);
    $('file-input').value = '';
    toast('자료를 저장했습니다. 변경한 사건 버전으로 자동화를 다시 확인합니다.');
  } catch (error) { errorMessage(error); }
  finally { setBusy(false); }
});

$('sample-button').addEventListener('click', async () => {
  if (busy) return;
  show('error-notice', false);
  setBusy(true);
  const originalText = $('sample-button').textContent;
  setText('sample-button', '샘플 준비 중…');
  try {
    if (!(await closeCurrentSession())) return;
    acceptSession(await api('/api/sessions/sample', { method: 'POST', body: '{}' }));
    await runSession();
    toast('의뢰인 증빙 페이지로 자동화를 시작했습니다.');
  } catch (error) { errorMessage(error); }
  finally { setText('sample-button', originalText); setBusy(false); }
});

$('run-button').addEventListener('click', async () => {
  if (busy || !session) return;
  show('error-notice', false);
  setBusy(true);
  try { await runSession(); }
  catch (error) { errorMessage(error); }
  finally { setBusy(false); }
});

$('end-session').addEventListener('click', async () => {
  setBusy(true);
  try { if (await closeCurrentSession()) toast('사건을 닫았습니다. 저장된 내용은 사건 목록에서 다시 열 수 있습니다.'); }
  catch (error) { errorMessage(error); }
  finally { setBusy(false); }
});

$('record-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!session || !editingRecord) return;
  const value = $('record-value').value.trim();
  const reason = $('record-reason').value.trim();
  if (!reason) { $('record-reason').focus(); return; }
  $('record-save').disabled = true;
  try {
    const result = await api(sessionPath(`/records/${encodeURIComponent(editingRecord)}`), { method: 'PATCH', body: JSON.stringify({ value: value === '' ? null : value, confirmed: true, reason, expected_revision: editingRecordRevision }) });
    generationChanged = true;
    $('template-approved').checked = false;
    acceptSession(result);
    $('record-dialog').close();
    toast('값을 확인했습니다. 변경한 값으로 문서를 다시 생성해주세요.');
  } catch (error) { toast(error.message, true); }
  finally { $('record-save').disabled = false; }
});

$('record-exclude').addEventListener('click', async () => {
  if (!session || !editingRecord) return;
  const record = session.records.find((item) => item.id === editingRecord);
  if (!record || record.state === 'excluded') return;
  const reason = $('record-reason').value.trim();
  if (reason.length < 2) { toast('이번 작성에서 제외할 사유를 입력해주세요.', true); $('record-reason').focus(); return; }
  $('record-exclude').disabled = true;
  $('record-save').disabled = true;
  try {
    const result = await api(sessionPath(`/records/${encodeURIComponent(editingRecord)}`), { method: 'PATCH', body: JSON.stringify({ value: record.value, confirmed: false, excluded: true, reason, expected_revision: editingRecordRevision }) });
    generationChanged = true;
    $('template-approved').checked = false;
    acceptSession(result);
    $('record-dialog').close();
    toast('이번 작성에서 제외했습니다. 필요한 항목을 확인한 뒤 문서를 다시 생성해주세요.');
  } catch (error) { toast(error.message, true); }
  finally { $('record-exclude').disabled = false; $('record-save').disabled = false; }
});

$('regenerate-button').addEventListener('click', async () => {
  if (!session || busy) return;
  show('error-notice', false);
  setBusy(true);
  try {
    acceptSession(await api(casePath('/generate'), { method: 'POST', body: '{}' }));
    generationChanged = false;
    $('template-approved').checked = false;
    render();
    toast('현재 값으로 문서 생성을 요청했습니다. 처리 상태와 생성본을 확인해주세요.');
  } catch (error) { errorMessage(error); }
  finally { setBusy(false); }
});

for (const role of ['caseworker', 'lawyer']) {
  $(`${role}-form`).addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!session || busy) return;
    if (!$('template-approved').checked) { toast('생성된 문서와 법원 양식의 일치 여부를 먼저 확인해주세요.', true); $('template-approved').focus(); return; }
    const name = $(`${role}-name`).value.trim();
    if (!name) { $(`${role}-name`).focus(); return; }
    setBusy(true);
    show('error-notice', false);
    try {
      acceptSession(await api(sessionPath('/review'), { method: 'POST', body: JSON.stringify({ role, name, template_approved: true }) }));
      toast(role === 'caseworker' ? '담당자 확인을 기록했습니다. 변호사의 최종 확인을 진행해주세요.' : '최종 확인을 기록했습니다. 검토 완료본을 내려받을 수 있습니다.');
    } catch (error) { errorMessage(error); }
    finally { setBusy(false); }
  });
}

document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => $(button.dataset.close).close()));
document.querySelectorAll('.workspace-tabs a').forEach((link) => link.addEventListener('click', () => { document.querySelectorAll('.workspace-tabs a').forEach((item) => item.classList.toggle('active', item === link)); }));
document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); }));
$('page-image').addEventListener('error', () => toast('원본 페이지를 불러오지 못했습니다. 자료와 연결 상태를 확인해주세요.', true));
document.addEventListener('pointerdown', heartbeat, { passive: true });
document.addEventListener('keydown', heartbeat, { passive: true });
document.addEventListener('wheel', heartbeat, { passive: true });
document.addEventListener('touchstart', heartbeat, { passive: true });

render();
loadHealth();
