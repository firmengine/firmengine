/* Fresh local prototype. Source of truth: docs/specs/양대성-feature.md, section 10. */
const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = value => value === null || value === undefined || value === '' ? '—' : Number.isFinite(Number(value)) ? Number(value).toLocaleString('ko-KR') : String(value);
const won = value => value === null || value === undefined || value === '' ? '확인 필요' : `${num(value)}원`;
const arr = value => Array.isArray(value) ? value : [];
const present = value => value !== null && value !== undefined && value !== '';
const asText = value => typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
const titleOf = value => typeof value === 'string' ? value : value?.title || value?.label || value?.name || value?.message || value?.key || value?.id || '확인 항목';
const reasonOf = value => typeof value === 'string' ? '' : value?.reason || value?.description || value?.explanation || value?.detail || '';
const actionOf = value => typeof value === 'string' ? '' : value?.next_action || value?.resolution || value?.action || value?.next_step || '';
const today = () => new Date().toLocaleDateString('sv-SE', {timeZone:'Asia/Seoul'});
const date = value => { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.valueOf()) ? String(value) : d.toLocaleString('ko-KR', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); };
const shapes = {
  cases:'<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M8 5V3h8v2M3 10h18M10 10v3h4v-3"/>',
  overview:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  documents:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6"/>',
  facts:'<path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4M16 3l5 5-10 10-6 1 1-6zM14 5l5 5"/>',
  calculations:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h1M15 11h1M8 15h1M15 15h1M8 19h1M15 19h1"/>',
  requirements:'<path d="M9 5H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4M9 2h6v6H9zM8 14l2 2 5-5"/>',
  strategy:'<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 9h1M14 9h1M9 12h1M14 12h1"/>',
  artifacts:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 15l3 3 5-6"/>',
  history:'<path d="M3 11a9 9 0 1 1 2.6 6.4M3 4v7h7M12 7v5l3 2"/>',
  knowledge:'<path d="M12 4c-3-2-7-2-10 0v16c3-2 7-2 10 0 3-2 7-2 10 0V4c-3-2-7-2-10 0zM12 4v16"/>',
  promptbook:'<path d="m8 6-6 6 6 6M16 6l6 6-6 6M14 3l-4 18"/>',
  runtime:'<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6h.01M7 17h.01M11 6h6M11 17h6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  arrow:'<path d="M4 12h16M14 6l6 6-6 6"/>',
  upload:'<path d="M12 16V3M7 8l5-5 5 5M4 15v5h16v-5"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  alert:'<path d="m12 3 10 18H2zM12 9v5M12 17h.01"/>',
  link:'<path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M13 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
  download:'<path d="M12 3v12M7 10l5 5 5-5M4 17v4h16v-4"/>',
  shield:'<path d="m12 2 9 4v6c0 5-6 9-9 10-3-1-9-5-9-10V6zM8 12l3 3 5-6"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  edit:'<path d="m15 3 6 6-11 11H4v-6zM12 6l6 6"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
};
const icon = (name, cls='') => `<svg class="${esc(cls)}" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name] || shapes.documents}</svg>`;
const views = {cases:'사건 원장',overview:'사건 개요',documents:'의뢰인 자료',facts:'사실·인정값',calculations:'계산·근거',requirements:'필요서류·위험',strategy:'자산·준비 검토',artifacts:'생성 문서·검수',history:'검수·변경 이력',knowledge:'법규·사례',promptbook:'프롬프트북',runtime:'실행 환경'};
const globalViews = ['cases','knowledge','promptbook','runtime'];
const state = {view:location.hash.slice(1) || 'cases',caseId:new URL(location.href).searchParams.get('case'),cases:[],current:null,status:null,entityTab:'incomes',knowledge:null,promptbook:null,agent:null,jobs:[],search:'',filter:'all',loading:false,polling:false};
if (!views[state.view]) state.view = 'cases';

async function api(path, options={}) {
  const headers = {...(options.body instanceof FormData ? {} : {'Content-Type':'application/json'}),...options.headers};
  let response;
  try { response = await fetch(path, {...options,headers}); } catch { throw new Error('서버에 연결할 수 없습니다. 실행 환경을 확인한 뒤 다시 시도하세요.'); }
  const isJSON = response.headers.get('content-type')?.includes('json');
  const data = isJSON ? await response.json() : await response.text();
  if (!response.ok) {
    let detail = data?.detail || data?.message || data || `요청 실패 (${response.status})`;
    if (Array.isArray(detail)) detail = detail.map(x => x.msg || titleOf(x)).join(', ');
    if (typeof detail === 'object') detail = detail.message || detail.reason || JSON.stringify(detail);
    const error = new Error(String(detail)); error.status = response.status; error.data = data; throw error;
  }
  return data;
}
function toast(message, error=false) {
  const el = document.createElement('div'); el.className = `toast${error?' error':''}`; el.textContent = message; $('#toasts').append(el); setTimeout(() => el.remove(), error ? 8500 : 4500);
}
async function task(fn, success) {
  try { const result = await fn(); if(success) toast(success); return result; }
  catch(error) { toast(error.message,true); if(error.status === 409 && state.caseId) await loadCase().catch(()=>{}); return null; }
}
function badge(label, tone='') { return `<span class="badge ${esc(tone)}">${esc(label)}</span>`; }
const statusLabels = {draft:'입력 중',DRAFT:'입력 중',ready:'생성 준비 완료',READY:'생성 준비 완료',needs_attention:'보완·확인 필요',NEEDS_REVIEW:'보완·확인 필요',blocked:'보완·확인 필요',BLOCKED:'보완·확인 필요',generated:'미검토 초안',GENERATED:'미검토 초안',staff_reviewed:'담당자 확인',STAFF_REVIEWED:'담당자 확인',reviewed:'검토 완료',REVIEWED:'검토 완료',completed:'검토 완료',archived:'보관됨',stale:'과거본',STALE:'과거본',confirmed:'확정',candidate:'추출 후보',disputed:'불일치·다툼',withdrawn:'철회',validated:'검증됨',evidence:'의뢰인 증빙',evaluation:'평가 전용',administrative:'행정자료',pending:'대기',running:'처리 중',processing:'처리 중',succeeded:'완료',completed:'완료',failed:'실패',cancelled:'취소',superseded:'최신 버전으로 대체',fulfilled:'확인됨',missing:'추가 제출',satisfied:'충족',waived:'대체 증빙',not_applicable:'해당 없음',resolved:'해소됨',warning:'확인 필요',review_required:'검토 필요',approved:'검토된 판본',unreviewed:'미검토',requires_review:'검토 필요',staff:'담당자',lawyer:'변호사',business:'사업소득',salary:'근로소득',mixed:'혼합소득',other:'기타소득'};
const label = value => statusLabels[value] || value || '입력 중';
function statusBadge(value) { const s=String(value||'').toLowerCase(); return badge(label(value), /reviewed|completed|succeeded|resolved|confirmed|satisfied|fulfilled|ready|approved|validated|검토 완료|확인 완료|계산 가능|해소됨|수취/.test(s)?'teal': /fail|disput|block|missing|보완|확인 필요|추가 제출|불가|검토 필요|미연결/.test(s)?'amber': /running|process|generat|초안|처리 중/.test(s)?'blue':''); }
function detail(title, value, full=false) { return `<div class="${full?'full':''}"><dt>${esc(title)}</dt><dd>${esc(present(value)?value:'확인 필요')}</dd></div>`; }
function button(title, action, cls='', attrs='', symbol='') { return `<button class="button ${cls}" data-action="${esc(action)}" ${attrs}>${symbol?icon(symbol):''}${esc(title)}</button>`; }
function heading(eyebrow, title, description='', actions='') { return `<div class="page-heading"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1>${description?`<p>${esc(description)}</p>`:''}</div>${actions?`<div class="heading-actions">${actions}</div>`:''}</div>`; }
function panel(title, content, options={}) { return `<section class="panel">${title?`<div class="panel-heading"><div><h2>${esc(title)}</h2>${options.description?`<p>${esc(options.description)}</p>`:''}</div>${options.action||''}</div>`:''}${options.raw?content:`<div class="panel-body">${content}</div>`}</section>`; }
function empty(title, description='', action='', compact=false, symbol='documents') { return `<div class="empty-state${compact?' compact':''}"><div class="empty-icon">${icon(symbol)}</div><h3>${esc(title)}</h3>${description?`<p>${esc(description)}</p>`:''}${action}</div>`; }
function notice(text, tone='', symbol='shield') { return `<div class="info-note ${tone}">${icon(symbol)}<span>${esc(text)}</span></div>`; }
function stat(title,value,description,symbol='cases',accent=false,unit='') { return `<div class="stat-card${accent?' accent':''}"><div class="stat-label">${esc(title)}<span class="stat-icon">${icon(symbol)}</span></div><div class="stat-value">${esc(value)}${unit?`<small>${esc(unit)}</small>`:''}</div><div class="stat-description">${esc(description)}</div></div>`; }
function updateURL() { const url = new URL(location.href); if(state.caseId) url.searchParams.set('case',state.caseId); else url.searchParams.delete('case'); url.hash=state.view; history.replaceState(null,'',url); }
function renderNav() {
  $('#main-nav').innerHTML = ['cases','knowledge','promptbook','runtime'].map(v=>`<button class="nav-item ${state.view===v?'active':''}" data-action="navigate" data-view="${v}">${icon(v)}<span>${views[v]}</span>${v==='cases'?`<span class="nav-count">${state.cases.filter(c=>!c.archived).length}</span>`:''}</button>`).join('');
  $('#case-navigation').innerHTML = state.current ? `<div class="case-nav-group"><div class="nav-label">CURRENT CASE</div><div class="active-case-label">${esc(state.current.title||state.current.applicant_name||'선택한 사건')}</div>${['overview','documents','facts','calculations','requirements','strategy','artifacts','history'].map(v=>`<button class="nav-item ${state.view===v?'active':''}" data-action="navigate" data-view="${v}">${icon(v)}<span>${views[v]}</span>${v==='requirements'&&arr(state.current.assessment?.blockers).length?`<span class="nav-count">${state.current.assessment.blockers.length}</span>`:''}</button>`).join('')}</div>` : '';
  $('#breadcrumb-title').textContent = views[state.view] || '사건 원장';
  if(state.status) { $('#connection-label').textContent = state.status.n8n?.ready ? '워크플로 연결됨' : '로컬 작업 공간'; $('#connection-dot').classList.toggle('off',!state.status.n8n?.ready); }
}
async function loadCases() { const result = await api('/api/cases'); state.cases = arr(result.cases || result); }
async function loadCase(renderAfter=true) { if(!state.caseId) return; state.current = await api(`/api/cases/${encodeURIComponent(state.caseId)}`); if(renderAfter) render(); }
async function refresh() { await loadCases(); if(state.caseId) await loadCase(false); state.status = await api('/api/status'); render(); }
async function navigate(view) {
  if(!views[view]) return;
  if(!globalViews.includes(view) && !state.current) { view='cases'; }
  state.view=view; updateURL(); $('#sidebar').classList.remove('open');
  if(view==='knowledge'&&!state.knowledge) await task(async()=>{state.knowledge=await api('/api/knowledge');});
  if(view==='promptbook'&&!state.promptbook) await task(async()=>{state.promptbook=await api('/api/promptbook');state.agent=state.promptbook.agents?.[0]?.name;});
  if(view==='runtime') await task(async()=>{const r=await api('/api/jobs');state.jobs=arr(r.jobs||r);state.status=await api('/api/status');});
  render(); window.scrollTo({top:0,behavior:'instant'});
}
async function openCase(id) { state.caseId=id; await loadCase(false); await navigate('overview'); }
function render() {
  renderNav(); const renderers={cases:renderCases,overview:renderOverview,documents:renderDocuments,facts:renderFacts,calculations:renderCalculations,requirements:renderRequirements,strategy:renderStrategy,artifacts:renderArtifacts,history:renderHistory,knowledge:renderKnowledge,promptbook:renderPromptbook,runtime:renderRuntime};
  $('#main').innerHTML = (renderers[state.view]||renderCases)();
  if(state.view==='cases') bindSearch();
  if(state.view==='documents') bindDrop();
}

function renderCases() {
  const active=state.cases.filter(c=>!c.archived); const reviewed=active.filter(c=>/reviewed|completed|검토 완료/i.test(c.status||'')); const attention=active.filter(c=>/attention|block|review_required|보완|재평가/i.test(c.status||'')); const generated=active.filter(c=>/generat|reviewed|초안|담당자 확인|검토 완료/i.test(c.status||''));
  const actions=button('데모 사건 열기','demo','','','overview')+button('새 사건 등록','new-case','primary','','plus');
  return heading('CASE OPERATIONS','좋은 검토는, 잘 정리된 사실에서.','의뢰인 자료부터 최초 신청서류까지, 한 사건의 흐름을 이어갑니다.',actions)+
    `<div class="stat-grid">${stat('진행 중인 사건',active.length,'이 기기에 저장된 사건','cases')}${stat('보완·확인 필요',attention.length,'필수 누락과 불일치 확인','requirements')}${stat('생성된 초안',generated.length,'생성본에 대한 검수 대기','artifacts')}${stat('검토 완료',reviewed.length,'담당자 · 변호사 확인','shield',true)}</div>`+
    (!state.cases.length?`<section class="welcome"><div class="eyebrow">FROM EVIDENCE TO DOCUMENTS</div><h2>흩어진 자료를 연결하고,<br>작성에 집중하세요.</h2><p>사건을 등록하고 증빙을 올리면 필요한 사실과 준비할 서류를 확인할 수 있습니다. 계산 근거를 따라 초안을 생성하고, 실제 생성본을 검토합니다.</p><div class="button-row">${button('첫 사건 등록하기','new-case','primary','','plus')}${button('합성 데모로 흐름 살펴보기','demo','','','arrow')}</div></section>`:'')+
    `<div class="section-grid"><div>${panel('사건 원장',`<div class="table-tools"><div class="search-box">${icon('search')}<input id="case-search" type="search" placeholder="사건명, 의뢰인 검색" value="${esc(state.search)}" aria-label="사건 검색"></div><select id="case-filter" aria-label="사건 상태 필터"><option value="all" ${state.filter==='all'?'selected':''}>전체 사건</option><option value="active" ${state.filter==='active'?'selected':''}>진행 중</option><option value="archived" ${state.filter==='archived'?'selected':''}>보관됨</option></select></div><div id="case-table">${caseTable()}</div>`,{raw:true,action:badge(`${state.cases.length} CASES`,'outline')})}</div><div>${panel('이어지는 업무',`<button class="quick-link" data-action="new-case"><span class="quick-link-icon">${icon('cases')}</span><div><h3>상담정보로 사건 시작하기</h3><p>관할·소득유형·기준일을 등록합니다.</p></div><span class="arrow">↗</span></button><button class="quick-link" data-action="navigate" data-view="knowledge"><span class="quick-link-icon">${icon('knowledge')}</span><div><h3>적용 규칙과 근거 살펴보기</h3><p>원문·판본·검토 범위를 구분합니다.</p></div><span class="arrow">↗</span></button><button class="quick-link" data-action="navigate" data-view="promptbook"><span class="quick-link-icon">${icon('promptbook')}</span><div><h3>작업별 프롬프트 확인하기</h3><p>분류·추출·작성의 입력을 확인합니다.</p></div><span class="arrow">↗</span></button>`,{description:'사건의 다음 단계를 준비하세요.'})}<div class="section-gap">${notice('합성 데모는 업무 흐름 확인용입니다. 법원 서식의 최종 대응 검수와 실제 사건 품질평가는 별도로 확인해야 합니다.','','shield')}</div></div></div>`;
}
function caseTable() {
  let cases=state.cases.filter(c=>`${c.title||''} ${c.applicant_name||''} ${c.id}`.toLowerCase().includes(state.search.toLowerCase()));
  if(state.filter==='active') cases=cases.filter(c=>!c.archived); if(state.filter==='archived') cases=cases.filter(c=>c.archived);
  if(!cases.length) return empty(state.search?'검색 결과가 없습니다.':'아직 등록된 사건이 없습니다.','새 사건을 등록하거나 합성 데모를 열어 업무 흐름을 확인하세요.','',true,'cases');
  return `<div class="table-wrap"><table><thead><tr><th>사건 / 의뢰인</th><th>소득 유형</th><th>진행 상태</th><th>최근 수정</th><th></th></tr></thead><tbody>${cases.map(c=>`<tr class="row-click" data-action="open-case" data-id="${esc(c.id)}"><td><div class="case-title"><span class="case-avatar">${esc((c.applicant_name||c.title||'사').slice(0,1))}</span><div><strong>${esc(c.title||'이름 없는 사건')}</strong><small>${esc(c.applicant_name||'의뢰인 미입력')} · ${esc(c.court||'관할 확인 필요')}${c.is_demo?' · 합성 데모':''}</small></div></div></td><td>${esc(label(c.income_type))}</td><td>${c.archived?badge('보관됨'):statusBadge(c.status)}</td><td><span class="tiny muted">${esc(date(c.updated_at))}</span></td><td><button class="icon-button" aria-label="${esc(c.title)} 열기">${icon('arrow')}</button></td></tr>`).join('')}</tbody></table></div><div class="table-foot"><span>${cases.length}개 사건</span><span>현재본과 변경 이력을 함께 보관합니다.</span></div>`;
}
function bindSearch() { $('#case-search')?.addEventListener('input',e=>{state.search=e.target.value;$('#case-table').innerHTML=caseTable();}); $('#case-filter')?.addEventListener('change',e=>{state.filter=e.target.value;$('#case-table').innerHTML=caseTable();}); }
function caseHeader(subtitle, actions='') { const c=state.current; return `<button class="navigation-back" data-action="navigate" data-view="cases">← 사건 원장</button>${heading(views[state.view].toUpperCase(),views[state.view],subtitle,actions)}<div class="case-banner"><div><div class="eyebrow">${c.is_demo?'SYNTHETIC DEMO · ':''}CASE ${esc((c.case_number||c.id||'').slice(0,24))}</div><h2>${esc(c.title||'새 사건')}<small>${esc(c.applicant_name||'의뢰인 미입력')}</small></h2><p>${esc(c.court||'관할 확인 필요')}<span> &nbsp; / &nbsp; </span>${esc(label(c.income_type))}<span> &nbsp; / &nbsp; </span>기준일 ${esc(c.filing_date||'미입력')}</p></div><div class="case-banner-side">${statusBadge(c.status)}<div class="tiny">사건 버전 v${esc(c.revision)} · ${esc(date(c.updated_at))}</div></div></div>`; }
function workflow() { const c=state.current; let step=0;if(c.documents?.length||c.is_demo)step=1;if(c.assessment?.can_generate)step=2;if(c.artifacts?.some(a=>a.case_revision===c.revision))step=3;if(/reviewed|completed|검토 완료|담당자 확인/.test(c.status||''))step=4; return `<div class="workflow">${[['사건 입력','상담·관할'],['자료·사실','추출·확정'],['계산·판단','근거·준비'],['서류 생성','실제 생성본'],['사람 검수','담당자·변호사']].map(([t,s],i)=>`<div class="workflow-step ${i<step?'done':i===step?'active':''}"><span>${i<step?'✓':i+1}</span><div>${t}<small>${s}</small></div></div>`).join('')}</div>`; }
function actionItem(item,good=false) { return `<div class="action-item"><span class="action-icon${good?' good':''}">${good?'✓':'!'}</span><div><h3>${esc(titleOf(item))}</h3><p>${esc(reasonOf(item))}</p>${actionOf(item)?`<p>${esc(actionOf(item))}</p>`:''}</div></div>`; }
function renderOverview() {
  const c=state.current,a=c.assessment||{},req=arr(a.requirements),blockers=arr(a.blockers),warnings=arr(a.warnings); const fulfilled=req.filter(r=>/satisfied|fulfilled|confirmed|resolved|complete|수취|충족|해소/.test(String(r.status||''))); const percent=req.length?Math.round(fulfilled.length/req.length*100):a.can_generate?100:0;
  const calc=a.calculations||{};
  return caseHeader('자료·판단·작성의 연결 상태를 한눈에 확인합니다.',button('사건 관리','manage-case','','','cases')+button('상담정보 수정','edit-case','','','edit')+button('자료 분석·재계산','analyze','','','calculations')+button('서류 초안 생성','generate','primary','','artifacts'))+workflow()+
    `<div class="stat-grid">${stat('의뢰인 자료',arr(c.documents).filter(d=>d.role!=='evaluation').length,'원본 파일과 페이지 근거','documents',false,'개')}${stat('핵심 보완 항목',blockers.length,'해소 후 제출서류 생성','requirements',blockers.length===0,'개')}${stat('생성 문서',arr(c.artifacts).filter(x=>x.case_revision===c.revision).length,'현재 사건 버전의 생성본','artifacts',false,'개')}${stat('월 가용소득',shortMoney(calc.monthly_disposable??calc.disposable_income??calc.disposable),'확정 소득 · 생계비 · 공제','calculations',true)}</div>`+
    `<div class="section-grid"><div>${panel('지금 필요한 확인',blockers.length?blockers.slice(0,5).map(x=>actionItem(x)).join(''):`${actionItem({title:a.can_generate?'초안 생성 준비가 되었습니다.':'자료와 사실을 확인해 주세요.',reason:a.can_generate?'현재 버전의 사실과 계산으로 문서를 생성하고, 생성본 검수로 이어갑니다.':'자료를 등록하고 필요한 핵심 입력값을 확인하면 다음 단계가 열립니다.'},a.can_generate)}${warnings.slice(0,2).map(x=>actionItem(x)).join('')}`,{action:button('전체 확인','navigate','small','data-view="requirements"','arrow')})}${panel('상담정보',`<dl class="detail-list">${detail('의뢰인',c.applicant_name)}${detail('생년월일',c.birth_date)}${detail('관할',c.court)}${detail('소득 유형',label(c.income_type))}${detail('자료 대상기간',`${c.period_start||'미입력'} ~ ${c.period_end||'미입력'}`)}${detail('계획 변제기간',present(c.repayment_months)?`${c.repayment_months}개월`:'확인 필요')}${detail('주소',c.address,true)}${detail('채무 발생 경위',c.debt_cause,true)}</dl>`,{action:button('수정','edit-case','small','','edit')})}</div><div>${panel('준비 현황',`<div class="readiness"><div class="progress-ring" style="--progress:${percent}"><div><strong>${percent}<small style="display:inline">%</small></strong><small>증빙 준비</small></div></div><div class="readiness-text"><h3>${a.can_generate?'문서 작성으로 이어가세요.':'필요한 사실을 연결하세요.'}</h3><p>${fulfilled.length} / ${req.length} 요구항목 확인<br>필수 보완 ${blockers.length}개 · 참고 경고 ${warnings.length}개</p></div></div><button class="quick-link" data-action="navigate" data-view="documents"><span class="quick-link-icon">${icon('upload')}</span><div><h3>증빙 자료 추가</h3><p>PDF · JPG · PNG 원본 업로드</p></div><span class="arrow">↗</span></button><button class="quick-link" data-action="navigate" data-view="facts"><span class="quick-link-icon">${icon('facts')}</span><div><h3>추출값·인정값 확인</h3><p>후보값과 원문 근거 대조</p></div><span class="arrow">↗</span></button><button class="quick-link" data-action="navigate" data-view="artifacts"><span class="quick-link-icon">${icon('artifacts')}</span><div><h3>생성본·검수 확인</h3><p>현재본의 버전과 해시 확인</p></div><span class="arrow">↗</span></button>`)}${panel('최근 변경',timeline(arr(c.events).slice(-4).reverse()),{action:button('전체 이력','navigate','small','data-view="history"')})}<div class="section-gap">${c.is_demo?notice('합성 데모 사건입니다. 표시된 금액과 법적 검토 상태는 흐름 확인을 위한 예시이며 실제 사건의 검증 결과가 아닙니다.','amber','alert'):notice('사실이나 적용 판본이 바뀌면 기존 생성본의 검수가 해제됩니다. 과거 파일과 검수 이력은 보존합니다.','','shield')}</div></div></div>`;
}
function shortMoney(v) { if(!present(v)) return '—'; return Number(v)>=10000?`${num(Math.round(Number(v)/10000))}만 원`:won(v); }

function renderDocuments() {
  const c=state.current,docs=arr(c.documents);
  return caseHeader('원본을 보관하고, 자료의 역할·기간·페이지를 추출값에 연결합니다.',button('자료 분석 시작','analyze','primary','','calculations'))+
    panel('자료 업로드',`<form id="upload-form"><div class="upload-zone" id="upload-zone"><div class="upload-icon">${icon('upload')}</div><h3>의뢰인 자료를 여기에 놓아주세요.</h3><p>PDF, JPG, PNG · 여러 파일 선택 가능 · 원본은 사건별로 보관</p><input type="file" name="files" id="upload-files" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple required aria-label="업로드할 증빙 파일"></div><div class="upload-options"><label>자료의 역할<select name="role"><option value="unknown">미분류 · 분석 전 역할 확인</option><option value="evidence">의뢰인 증빙 · 생성 입력</option><option value="evaluation">제출 완료본 · 평가 전용</option><option value="administrative">행정자료 · 생성 입력 제외</option></select></label><label>문서 유형<select name="document_type"><option value="unknown">자동 분류 / 확인 필요</option value="identity">신분·주민등록</option><option value="business_registration">사업자등록</option><option value="business_income">매출·경비·세무 자료</option><option value="tax">세금·납세 증명</option><option value="bank_statement">계좌 거래내역</option><option value="salary">급여·재직 증명</option><option value="debt">부채·대출 계약</option><option value="asset">재산·권리 증빙</option><option value="other">기타 자료</option></select></label><label>대상기간 시작<input type="date" name="period_start" value="${esc(c.period_start)}"></label><label>대상기간 종료<input type="date" name="period_end" value="${esc(c.period_end)}"></label></div><div class="upload-submit"><span class="tiny muted">평가 전용 제출본은 생성·검색·few-shot 입력에서 제외됩니다.</span><button class="button primary" type="submit">${icon('upload')}자료 보관하기</button></div></form>`)+
    panel('의뢰인 제출서류 보관함',docs.length?`<div class="table-wrap"><table><thead><tr><th>원본 파일</th><th>역할 / 유형</th><th>대상기간 / 쪽수</th><th>처리 상태</th><th>관리</th></tr></thead><tbody>${docs.map(d=>`<tr><td><div class="file-name"><span class="file-icon">${esc((d.filename||d.name||'PDF').split('.').pop().toUpperCase().slice(0,4))}</span><div><strong>${esc(d.filename||d.name||d.id)}</strong><small>${esc(date(d.created_at))}${d.sha256?` · SHA ${esc(d.sha256.slice(0,10))}`:''}</small></div></div></td><td>${statusBadge(d.role||'evidence')}<div class="tiny muted" style="margin-top:5px">${esc(d.document_type||d.type||'분류 확인 필요')}</div></td><td><span class="tiny muted">${esc(d.period_start||'미입력')} ~ ${esc(d.period_end||'미입력')}<br>${num(d.page_count??d.pages?.length)}쪽</span></td><td>${statusBadge(d.status||'pending')}${d.error?`<div class="tiny muted">${esc(d.error)}</div>`:''}</td><td><div class="entity-actions"><a class="button small" href="/api/cases/${encodeURIComponent(c.id)}/documents/${encodeURIComponent(d.id)}/file" target="_blank" rel="noopener" aria-label="${esc(d.filename||d.name)} 원본 보기">${icon('eye')}</a><button class="button small" data-action="map-document" data-id="${esc(d.id)}" aria-label="문서 역할·페이지 매핑 수정">${icon('edit')}</button><button class="button small danger" data-action="delete-document" data-id="${esc(d.id)}" aria-label="자료 삭제">${icon('trash')}</button></div></td></tr>`).join('')}</tbody></table></div>`:empty('먼저 증빙 자료를 올려주세요.','원본의 역할과 대상기간을 구분하면 추출값의 근거를 더 정확하게 확인할 수 있습니다.','',true),{raw:true,action:badge(`${docs.length} FILES`,'outline')})+
    `<div class="section-gap">${notice('증빙과 제출 완료본이 섞인 PDF는 생성 입력 전에 역할과 원본 쪽을 분리해야 합니다. 평가 전용 정답을 증빙으로 등록하지 마세요.','amber','alert')}</div>`;
}
function bindDrop() { const zone=$('#upload-zone'), input=$('#upload-files'); if(!zone||!input)return; zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('dragover');});zone.addEventListener('dragleave',()=>zone.classList.remove('dragover'));zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('dragover');input.files=e.dataTransfer.files;toast(`${input.files.length}개 파일을 선택했습니다. 자료 보관하기를 눌러 업로드하세요.`);}); }

const entityNames={incomes:'소득원',creditors:'채권 계약',assets:'재산',transactions:'거래',facts:'추출 feature'};
const entityDescriptions={incomes:'복수 사업체·직장·기타 소득을 각각 관리합니다. 같은 기간의 입금과 반복소득을 구분하세요.',creditors:'같은 은행이어도 계약 식별자가 다른 채권은 별도 행으로 유지합니다.',assets:'시가·담보·면제 인정액을 구분하고, 평가 출처와 기준일을 남깁니다.',transactions:'500,000원 이상 개별 출금은 사무소 확인 정책입니다. 법정 기각 기준으로 처리하지 않습니다.',facts:'후보값·확정값·불일치·철회를 구분합니다. 0원으로 확정할 때도 근거와 사유를 남깁니다.'};
function entityActions(collection,item) { return `<div class="entity-actions"><button class="button small" data-action="edit-entity" data-collection="${collection}" data-id="${esc(item.id)}" aria-label="항목 수정">${icon('edit')}</button><button class="button small danger" data-action="delete-entity" data-collection="${collection}" data-id="${esc(item.id)}" aria-label="항목 삭제">${icon('trash')}</button></div>`; }
function sourceLink(item) { const doc=item.source_document_id||item.document_id||item.source?.document_id, page=item.source_page||item.page||item.source?.page,quote=item.source_quote||item.quote||item.source?.quote;return `${doc?`<a class="source-link" href="/api/cases/${encodeURIComponent(state.caseId)}/documents/${encodeURIComponent(doc)}/file${page?`#page=${encodeURIComponent(page)}`:''}" target="_blank" rel="noopener">${icon('link')}원본 ${esc(page||'?')}쪽</a>`:''}${quote?`<div class="quote">${esc(quote)}</div>`:''}`; }
function renderFacts() { const c=state.current,collection=state.entityTab,items=arr(c[collection]); return caseHeader('원본 사실과 법적 인정값을 구분하고, 변경 사유를 기록합니다.',button('항목 추가','new-entity','primary',`data-collection="${collection}"`,'plus'))+`<div class="tabs" role="tablist" aria-label="사실 종류">${Object.entries(entityNames).map(([k,v])=>`<button role="tab" aria-selected="${k===collection}" class="tab ${k===collection?'active':''}" data-action="entity-tab" data-collection="${k}">${v}${badge(arr(c[k]).length)}</button>`).join('')}</div><p class="entity-summary">${entityDescriptions[collection]}</p>`+panel(`${entityNames[collection]} 목록`,items.length?entityTable(collection,items):empty(`등록된 ${entityNames[collection]}이 없습니다.`,collection==='facts'?'증빙 자료 분석을 실행하거나 근거를 남겨 직접 입력할 수 있습니다.':'서류 분석 후 후보를 확인하거나 근거를 남겨 항목을 추가하세요.',button(`${entityNames[collection]} 추가`,'new-entity','small',`data-collection="${collection}"`,'plus'),true,'facts'),{raw:true,action:badge(`${items.length} ITEMS`,'outline')})+`<div class="section-gap">${notice('인정값이나 원본을 수정하면 관련 계산과 생성본은 최신 사건 버전으로 다시 평가됩니다. 계산 결과 자체를 직접 덮어쓰지 않습니다.','','shield')}</div>`; }
function entityTable(k,items) {
  const heads={incomes:['소득원 / 종류','귀속기간','월 수입 / 경비','확인·근거','관리'],creditors:['채권자 / 계약','원금 / 이자','권리 성격','확인 상태','관리'],assets:['재산 / 유형','시가 / 담보 / 면제','평가 출처·기준일','확인 상태','관리'],transactions:['거래일 / 계좌','입출금액','상대방 / 용도','소명 상태','관리'],facts:['항목 / 단위','후보·확정값','원문 근거','검증 상태','관리']};
  return `<div class="table-wrap"><table><thead><tr>${heads[k].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${items.map(i=>`<tr>${entityRow(k,i)}<td>${entityActions(k,i)}</td></tr>`).join('')}</tbody></table></div>`;
}
function entityRow(k,i) {
  if(k==='incomes')return `<td><strong>${esc(i.label||i.name||'소득원')}</strong><div class="tiny muted">${esc(label(i.kind))}</div></td><td><span class="tiny muted">${esc(i.period_start||'미입력')}<br>~ ${esc(i.period_end||'미입력')}</span></td><td class="num">${esc(won(i.monthly_gross))}<div class="tiny muted">경비 ${esc(won(i.monthly_expense))}</div></td><td>${statusBadge(i.confirmed?'confirmed':'candidate')}${sourceLink(i)}</td>`;
  if(k==='creditors')return `<td><strong>${esc(i.name)}</strong><div class="tiny mono muted">${esc(i.contract_id||'계약 식별 필요')}</div></td><td class="num">${esc(won(i.principal))}<div class="tiny muted">이자 ${esc(won(i.interest))}</div></td><td>${badge(i.security==='secured'?'담보부':'무담보')} ${badge(i.priority==='tax'?'조세·우선 검토':'일반')}${i.disputed?`<div style="margin-top:5px">${badge('다툼 있음','amber')}</div>`:''}</td><td>${statusBadge(i.confirmed?'confirmed':'candidate')}<div class="tiny muted">${esc(i.reason||'')}</div></td>`;
  if(k==='assets')return `<td><strong>${esc(i.label)}</strong><div class="tiny muted">${esc(i.kind||'유형 미입력')}</div></td><td class="num">${esc(won(i.market_value))}<div class="tiny muted">담보 ${esc(won(i.secured_balance))}<br>면제 ${esc(won(i.exempt_amount))}</div></td><td><span class="tiny muted">${esc(i.valuation_source||'출처 확인 필요')}<br>${esc(i.valuation_date||'기준일 확인 필요')}</span></td><td>${statusBadge(i.confirmed?'confirmed':'candidate')}</td>`;
  if(k==='transactions')return `<td>${esc(i.date||'일자 확인 필요')}<div class="tiny mono muted">${esc(i.account)}</div></td><td class="num">${esc(won(i.amount))}<div class="tiny muted">${i.direction==='deposit'?'입금':'출금'}${Number(i.amount)>=500000&&i.direction==='withdrawal'?' · 확인 대상':''}</div></td><td>${esc(i.counterparty||'상대방 확인 필요')}<div class="tiny muted">${esc(i.purpose||'용도 미확인')}</div>${sourceLink(i)}</td><td>${statusBadge(i.resolved?'resolved':'warning')}</td>`;
  return `<td><strong>${esc(i.label||i.key)}</strong><div class="tiny mono muted">${esc(i.key)}${i.unit?` · ${esc(i.unit)}`:''}</div></td><td><div class="fact-value">${esc(asText(i.value))}</div>${i.normalized_value!==undefined?`<div class="tiny muted">정규화 ${esc(asText(i.normalized_value))}</div>`:''}</td><td>${sourceLink(i)||'<span class="tiny muted">원본 연결 없음</span>'}${i.reason?`<div class="tiny muted">${esc(i.reason)}</div>`:''}</td><td>${statusBadge(i.status||'candidate')}</td>`;
}

const calcLabels={monthly_income:'월 총수입',net_income:'월 순소득',monthly_payment:'월 변제예정액',final_payment:'마지막 회차 변제액',total_payment:'총 변제예정액',total_interest:'채무 이자 합계',annual_income:'연 수입',annual_expense:'연 인정경비',monthly_net_income:'월 순소득',monthly_gross:'월 총수입',monthly_expense:'월 인정경비',monthly_disposable:'월 가용소득',disposable_income:'월 가용소득',disposable:'월 가용소득',living_cost:'인정 생계비',deductions:'기타 공제',liquidation_value:'청산가치',liquidation:'청산가치',total_repayment:'총 변제예정액',repayment_total:'총 변제예정액',repayment_rate:'변제율',repayment_rate_percent:'변제율',total_debt:'채무 총액',total_principal:'채무 원금 합계',repayment_months:'변제기간',monthly_repayment:'월 변제예정액',asset_net_value:'재산 순가치'};
function calcValue(key,val){if(val&&typeof val==='object')val=val.result??val.value??val.amount;if(!present(val))return '확인 필요';if(/rate|percent/.test(key))return `${num(val)}%`;if(/months/.test(key))return `${num(val)}개월`;return Number.isFinite(Number(val))?won(val):asText(val);}
function renderCalculations() {
  const c=state.current,calc=c.assessment?.calculations||{},entries=Object.entries(calc).filter(([key,val])=>present(val)&&!Array.isArray(val)&&typeof val!=='boolean'&&!/version|engine|trace|method|round|hash|mode|source|status|rule|currency|period|error|warning|block/.test(key));
  const fallback=[['monthly_income',null],['monthly_disposable',null],['liquidation_value',null],['monthly_repayment',null],['total_repayment',null],['repayment_rate',null]];
  const data=entries.length?entries:fallback;
  const formulas={monthly_income:'동일 기간의 소득원별 (수입 − 인정경비)',monthly_disposable:'인정 월소득 − 생계비 − 확인된 공제',disposable_income:'인정 월소득 − 생계비 − 확인된 공제',liquidation_value:'확정 재산가액 − 담보 − 인정 면제액',total_repayment:'월 변제액 × 적용 변제기간',repayment_rate:'채권별 배분과 적용 채무 기준 확인'};
  const rows=arr(calc.allocations||calc.creditor_allocations||calc.payments);
  return caseHeader('확정된 입력과 적용 판본으로 계산한 결과를 확인합니다.',button('입력값 정정','navigate','','data-view="facts"','edit')+button('다시 계산','analyze','primary','','calculations'))+
    `<div class="calculation-cards">${data.map(([k,v])=>`<section class="calculation-card"><div class="stat-label">${esc(calcLabels[k]||k)}${icon('calculations')}</div><div class="calc-number">${esc(calcValue(k,v))}</div><div class="calc-formula">${esc(v?.formula||formulas[k]||'사건 입력값과 결정론적 계산 코드 기준')}</div><div class="calc-source">${esc(v?.rule_version||calc.rule_version||calc.version||'적용 판본 확인 필요')}</div></section>`).join('')}</div>`+
    panel('입력 → 계산 → 서식 연결',`<div class="rule-trail"><span>원본 증빙</span>→<span>확정 입력값</span>→<span>산식 · 매개변수</span>→<span>계산 결과</span>→<span>법원 서식 항목</span></div><div class="table-wrap"><table><thead><tr><th>소득원</th><th>기간</th><th class="num">월 수입</th><th class="num">인정경비</th><th>확인 상태</th></tr></thead><tbody>${arr(c.incomes).map(i=>`<tr><td>${esc(i.label)}</td><td><span class="tiny muted">${esc(i.period_start)} ~ ${esc(i.period_end)}</span></td><td class="num">${esc(won(i.monthly_gross))}</td><td class="num">${esc(won(i.monthly_expense))}</td><td>${statusBadge(i.confirmed?'confirmed':'candidate')}</td></tr>`).join('')||'<tr><td colspan="5" class="empty-inline">확인된 소득원을 먼저 등록하세요.</td></tr>'}</tbody></table></div>`,{raw:true,action:button('소득원 수정','entity-tab','small','data-collection="incomes"','edit')})+
    (rows.length?panel('채권별 변제 배분',`<div class="table-wrap"><table><thead><tr><th>채권자 / 계약</th><th>분류</th><th class="num">월 배분액</th><th class="num">총 변제예정액</th><th>산식·상태</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.name||r.creditor_name||r.creditor_id)}<div class="tiny muted">${esc(r.contract_id)}</div></td><td>${esc(r.priority||r.classification||'일반')}</td><td class="num">${esc(won(r.monthly_payment??r.monthly_amount??r.monthly_repayment))}</td><td class="num">${esc(won(r.total_payment??r.total??r.total_repayment))}</td><td><span class="tiny muted">${esc(r.method||r.status||'계산 내역 확인')}</span></td></tr>`).join('')}</tbody></table></div>`,{raw:true}):'')+
    `<div class="section-gap">${notice('계산은 법적 인정 판단을 대신하지 않습니다. 미확인 입력·미지원 채권 분류는 관련 결과를 보류하며, AI가 만든 숫자로 채우지 않습니다.','amber','alert')}</div><details class="state-json"><summary>전체 계산 상태와 실행 근거 보기</summary><pre class="code-block">${esc(JSON.stringify(calc,null,2))}</pre></details>`;
}
function renderRequirements() {
  const a=state.current.assessment||{},req=arr(a.requirements),risks=arr(a.risks),blockers=arr(a.blockers),warnings=arr(a.warnings);
  return caseHeader('증빙 준비 상태와 생성에 영향을 주는 위험을 구분합니다.',button('현재 자료로 재평가','analyze','primary','','calculations'))+
    `<div class="stat-grid">${stat('필수 미해결',blockers.length,'제출서류 생성 전 해결','alert',false,'개')}${stat('참고 경고',warnings.length,'후속 행동과 이력 확인','requirements',false,'개')}${stat('증빙 요구사항',req.length,'문서 보유와 사실 입증 구분','documents',false,'개')}${stat('초안 생성',a.can_generate?'가능':'보완 필요',a.can_generate?'생성 후 담당자·변호사 검수':'아래 사유와 조치 확인','artifacts',a.can_generate)}</div>`+
    panel('의뢰인에게 준비할 증빙',req.length?`<div class="table-wrap"><table><thead><tr><th>필요서류·사실</th><th>필요한 이유 / 기간</th><th>준비 상태</th><th>다음 행동</th></tr></thead><tbody>${req.map(r=>`<tr><td><strong>${esc(titleOf(r))}</strong>${r.required||r.mandatory?` <span class="badge outline">필수</span>`:''}</td><td><span class="tiny muted">${esc(reasonOf(r))}${r.period?`<br>${esc(asText(r.period))}`:''}${r.rule_id?`<br>근거 ${esc(r.rule_id)}`:''}</span></td><td>${statusBadge(r.status||'missing')}</td><td><span class="tiny muted">${esc(actionOf(r)||r.alternative||'현재 사실과 증빙을 확인하세요.')}</span></td></tr>`).join('')}</tbody></table></div>`:empty('자료를 등록하면 준비 상태를 확인합니다.','서류를 보유한 것과 해당 사실이 입증된 것을 구분해 판단합니다.','',true,'requirements'),{raw:true,action:button('자료 추가','navigate','small','data-view="documents"','plus')})+
    `<div class="section-gap">${panel('생성 전 반드시 해결할 항목',blockers.length?blockers.map(b=>actionItem(b)).join(''):actionItem({title:'현재 확인된 필수 차단 항목이 없습니다.',reason:'이 결과는 실제 법원 접수·인가 판단을 의미하지 않습니다.'},true))}</div>`+
    `<div class="section-gap"><div class="page-heading" style="margin-bottom:17px"><div><h2>보정 위험·추가 준비 검토</h2><p>자동 확인 범위와 사람의 판단이 필요한 항목을 구분합니다.</p></div></div>${risks.length?`<div class="risk-grid">${risks.map(r=>`<section class="risk-card ${r.required||r.blocking?'required':''}"><div class="risk-top"><h3>${esc(titleOf(r))}</h3>${statusBadge(r.status||'review_required')}</div><p>${esc(reasonOf(r))}</p>${r.source||r.rule_id?`<p>근거 · ${esc(asText(r.source||r.rule_id))}</p>`:''}${r.question?`<p>확인 질문 · ${esc(r.question)}</p>`:''}${actionOf(r)?`<div class="next-action">다음 행동 &nbsp; ${esc(actionOf(r))}</div>`:''}</section>`).join('')}</div>`:empty('현재 표시할 위험 항목이 없습니다.','미확인 자료까지 위험 없음으로 판단한 것은 아닙니다. 자료와 사실이 바뀌면 다시 평가하세요.','',true,'shield')}</div>`+
    `<div class="section-gap">${notice('개별 500,000원 이상 출금이나 체납 존재만으로 사건 전체를 기각·생성 차단하지 않습니다. 성격과 근거, 필요한 해소 조건을 각각 확인합니다.','','shield')}</div>`;
}

function renderStrategy() {
  const c=state.current,assets=arr(c.assets);
  return caseHeader('평가 후보와 실제 재산 상태를 분리하고, 처분 이후 자금 흐름까지 확인합니다.',button('재산 추가','new-entity','primary','data-collection="assets"','plus'))+
    (assets.length?`<div class="asset-grid">${assets.map(a=>`<section class="asset-card"><div class="risk-top"><div><div class="eyebrow">${esc(a.kind||'ASSET')}</div><h3>${esc(a.label)}</h3></div>${statusBadge(a.confirmed?'confirmed':'candidate')}</div><div class="asset-meta"><div><small>시가 후보</small><strong>${esc(won(a.market_value))}</strong></div><div><small>담보 잔액</small><strong>${esc(won(a.secured_balance))}</strong></div><div><small>면제 인정액</small><strong>${esc(won(a.exempt_amount))}</strong></div></div><div class="tiny muted">평가 출처 · ${esc(a.valuation_source||'증빙 필요')}<br>가격 기준일 · ${esc(a.valuation_date||'확인 필요')}</div><div class="button-row" style="margin-top:17px">${button('평가값 정정','edit-entity','small',`data-collection="assets" data-id="${esc(a.id)}"`,'edit')}${button('처분 시나리오','scenario','small',`data-id="${esc(a.id)}"`,'calculations')}</div></section>`).join('')}</div>`:panel('',empty('재산 평가 자료를 연결하세요.','자동차·부동산 등 자산별 가액과 담보, 출처와 기준일을 별도로 기록합니다.',button('재산 등록','new-entity','primary','data-collection="assets"','plus'),true,'strategy')))+
    panel('처분 시나리오에서 확인할 흐름',`<div class="scenario-flow">${[['매각대금','대상·시점'],['담보상환','상환 증빙'],['비용','거래·세금'],['잔여 현금','대체재산'],['계획 영향','재원·청산가치']].map(([t,s])=>`<div class="scenario-step">${t}<strong>${s}</strong></div>`).join('')}</div>${notice('재산을 목록에서 지우는 것만으로 청산가치를 낮추지 않습니다. 검토 시나리오는 실제 처분으로 확정되지 않으며, 실행 후 대금·상환·남은 자산을 다시 입증해야 합니다.','','shield')}`)+
    panel('시세 확인과 대체 증빙',`<div class="detail-list"><div><dt>차량 평가</dt><dd class="small">차종·연식·권리관계와 가격 기준일을 확인합니다. 조회 제공자의 인증·권한이 없으면 수동 평가 증빙을 사용하세요.</dd></div><div><dt>부동산 평가</dt><dd class="small">소재지·면적·지분·담보와 비교사례를 함께 확인합니다. 단일 실거래를 법적 인정가로 확정하지 않습니다.</dd></div></div><div class="spacer"></div>${notice('실제 외부 시세를 조회하지 않은 가격은 조회 결과로 표시하지 않습니다. 이 화면에서는 출처를 가진 평가값과 처분 시나리오를 직접 기록합니다.','amber','alert')}`);
}

function artifactCurrent(item) { return item.case_revision===state.current.revision && !/stale|supersed/.test(String(item.status||'')); }
function renderArtifacts() {
  const c=state.current,artifacts=arr(c.artifacts).slice().reverse(),current=artifacts.filter(artifactCurrent),old=artifacts.filter(a=>!artifactCurrent(a));
  const body=items=>`<div class="artifact-grid">${items.map(a=>`<article class="artifact-card ${artifactCurrent(a)?'':'stale'}"><div class="artifact-header"><span class="artifact-icon">${esc((a.kind||'DOCX').toUpperCase())}</span>${artifactCurrent(a)?statusBadge(a.status||'generated'):badge('과거본')}</div><h3>${esc(a.title||a.filename||'생성 문서')}</h3><div class="artifact-meta">생성본 v${esc(a.version||1)} · 사건 v${esc(a.case_revision)}<br>${esc(date(a.created_at))}<br><span class="mono" title="${esc(a.sha256)}">SHA ${esc((a.sha256||'').slice(0,18))}…</span></div><div class="artifact-actions">${button('미리보기·검수','preview-artifact','small',`data-id="${esc(a.id)}"`,'eye')}<a class="button small" href="${esc(a.url||`/api/cases/${encodeURIComponent(c.id)}/artifacts/${encodeURIComponent(a.id)}/file`)}" download>${icon('download')}내려받기</a></div><div class="review-stamp">${arr(c.reviews).filter(r=>r.artifact_id===a.id).map(r=>badge(`${label(r.role)} · ${r.reviewer||'확인'}`,r.valid===false?'':'teal')).join('')}</div></article>`).join('')}</div>`;
  return caseHeader('실제 생성본을 원본·계산근거와 대조한 뒤 담당자와 변호사가 확인합니다.',`<a class="button" href="/api/cases/${encodeURIComponent(c.id)}/review-report" download>${icon('download')}검수 기록표</a>`+button('입력 사실 정정','navigate','','data-view="facts"','edit')+button('최신 버전으로 생성','generate','primary','','artifacts'))+
    (!c.assessment?.can_generate?`${notice(`생성 전 필수 보완 ${arr(c.assessment?.blockers).length}개를 확인하세요. 구체적인 사유와 해결 방법은 필요서류·위험에서 볼 수 있습니다.`,'amber','alert')}<div class="spacer"></div>`:'')+
    (c.is_demo?`${notice('합성 데모의 작업용 생성물입니다. 공식 양식에 대한 최종 검수나 실제 법원 제출 품질 합격을 의미하지 않습니다.','amber','alert')}<div class="spacer"></div>`:'')+
    panel('현재 사건 버전의 생성물',current.length?body(current):empty('아직 최신 버전의 초안이 없습니다.','필수 입력과 적용 조건을 갖춘 뒤 서류를 생성하세요. 생성본은 미검토 상태로 시작합니다.',button('서류 초안 생성','generate','primary','','artifacts'),true,'artifacts'),{action:badge(`${current.length} FILES`,'outline')})+
    (old.length?panel('과거 생성물 보관함',body(old),{description:'과거 파일은 당시의 사건·규칙·서식 버전과 함께 보관됩니다.',action:badge(`${old.length} FILES`,'outline')}):'')+
    `<div class="section-gap">${notice('검수는 실제 파일의 해시·생성본 버전과 연결됩니다. 담당자 확인 후 변호사 최종 확인이 필요하며, 사실 변경 뒤에는 새 생성본을 다시 확인해야 합니다.','','shield')}</div>`;
}
function timeline(events) {
  if(!events.length)return '<div class="empty-inline">아직 기록된 변경이 없습니다.</div>';
  return `<div class="timeline">${events.map(e=>`<div class="timeline-event"><span class="timeline-dot"></span><div><strong>${esc(e.title||e.action||e.type||e.event_type||'사건 변경')}</strong><p>${esc(e.reason||e.description||e.actor||'')}${e.revision?` · 사건 v${esc(e.revision)}`:''}</p><time>${esc(date(e.created_at||e.timestamp))}</time></div></div>`).join('')}</div>`;
}
function renderHistory() {
  const c=state.current,reviews=arr(c.reviews),jobs=arr(c.jobs);
  return caseHeader('이전 값과 변경 사유, 실행 결과와 생성본 검수를 함께 보관합니다.',button('실제 AI 호출 기록','view-calls','','','promptbook'))+
    `<div class="section-grid"><div>${panel('사건 변경 이력',timeline(arr(c.events).slice().reverse()),{action:badge(`v${c.revision}`,'outline')})}</div><div>${panel('생성본 검수 기록',reviews.length?reviews.slice().reverse().map(r=>`<div class="action-item"><span class="action-icon ${r.valid===false?'':'good'}">${r.valid===false?'↺':'✓'}</span><div><h3>${esc(label(r.role))} · ${esc(r.reviewer||'확인자 미기록')}</h3><p>${esc(date(r.created_at||r.reviewed_at))}<br>생성본 ${esc(String(r.artifact_id||'').slice(0,18))}<br><span class="mono">SHA ${esc((r.sha256||r.artifact_sha256||'').slice(0,18))}</span></p>${r.valid===false?badge('변경 후 재검수 필요','amber'):badge('해당 생성본 확인','teal')}</div></div>`).join(''):empty('생성 후 검수 이력이 없습니다.','생성 문서에서 실제 파일을 확인한 뒤 담당자·변호사 확인을 남길 수 있습니다.','',true,'shield'))}</div></div>`+
    `<div class="section-gap">${panel('작업 실행 이력',jobs.length?jobTable(jobs):'<div class="empty-inline">현재 사건의 작업 실행 기록이 없습니다.</div>',{raw:true})}</div>`+
    `<details class="state-json"><summary>현재 사건 식별자와 버전 보기</summary><pre class="code-block">${esc(JSON.stringify({id:c.id,case_number:c.case_number,revision:c.revision,updated_at:c.updated_at,status:c.status,rule_approved:c.rule_approved,template_approved:c.template_approved},null,2))}</pre></details>`;
}
function jobTable(jobs) {return `<div class="table-wrap"><table><thead><tr><th>작업</th><th>사건 버전 / 단계</th><th>상태</th><th>시도</th><th>시각 / 결과</th></tr></thead><tbody>${jobs.slice().reverse().map(j=>`<tr><td><strong>${esc(j.kind||j.type||'분석')}</strong><div class="tiny mono muted">${esc((j.id||'').slice(0,18))}</div></td><td><span class="tiny muted">v${esc(j.case_revision??j.revision??'—')} · ${esc(j.stage||j.phase||'—')}</span></td><td>${statusBadge(j.status)}</td><td>${esc(j.attempts??j.attempt??0)}</td><td><span class="tiny muted">${esc(date(j.updated_at||j.created_at))}${j.error?`<br>${esc(j.error)}`:''}</span></td></tr>`).join('')}</tbody></table></div>`;}

function capabilityStatus(value) {
  if(value&&typeof value==='object') {
    if(value.provider&&value.model) {
      if(!value.configured)return badge('키 설정 필요','amber');
      if(!value.indexed_chunks)return badge('자료 미적재','amber');
      return badge(`${value.indexed_chunks}청크 · ${value.network_verified?'실제 임베딩':'호출 확인 필요'}`,value.network_verified?'teal':'amber');
    }
    return statusBadge(value.status||(value.available?'연결됨':'미연결'));
  }
  return statusBadge(typeof value==='boolean'?(value?'연결됨':'미연결'):value);
}
function renderKnowledge() {
  const k=state.knowledge;if(!k)return heading('LAW GRAPH','법규·사례','법적 근거와 적용 시점·판본·검토 범위를 연결합니다.')+empty('근거 자료를 불러오지 못했습니다.','실행 환경을 확인한 뒤 새로고침하세요.',button('다시 불러오기','reload-knowledge'),true,'knowledge');
  const sources=arr(k.sources),caps=k.capabilities||{};const capEntries=Array.isArray(caps)?caps.map(x=>[titleOf(x),x]):Object.entries(caps);
  return heading('LAW GRAPH','근거가 이어지는 업무.','법령·실무준칙·일반 규칙과 사건 사실을 구분해 추적합니다.',button('공식 원문 변경 조회','refresh-sources','','','history')+button('검토 판본 등록','approve-release','','','shield'))+
    `<div class="legal-map"><span>법적 근거</span><b>→</b><span>적용 조건</span><b>→</b><span>필요한 사실·증빙</span><b>→</b><span>확정 입력</span><b>→</b><span>결정론적 계산</span><b>→</b><span>문서 항목</span></div>`+
    panel('근거 자료 검색',`<form id="knowledge-search-form"><div class="button-row" style="flex-wrap:nowrap"><input name="query" required placeholder="예: 개인사업자 소득 증빙, 채권자목록 첨부" aria-label="검색할 법규·실무 내용"><button class="button primary" type="submit">${icon('search')}검색</button></div><p class="tiny muted" style="margin-top:10px">실제 적재된 자료만 검색합니다. 평가 전용·동일 자료 묶음은 제외하며 검색 방식과 적용 범위를 결과에 표시합니다.</p></form><div id="knowledge-search-result"></div>`)+
    `<div class="spacer"></div>`+
    `<div class="section-grid"><div>${panel('공식 근거·규칙 판본',sources.length?sources.map(s=>`<article class="source-card"><h3>${esc(s.title||s.name||s.id)}${statusBadge(s.status||s.review_status||'review_required')}</h3><p>${esc(s.description||s.scope||s.article||'')}<br>관할 ${esc(s.jurisdiction||s.court||'확인 필요')} · 시행일 ${esc(s.effective_date||'원문 확인')}<br>판본 ${esc(s.version||s.id||'미기록')}${s.sha256?` · 해시 ${esc(s.sha256.slice(0,16))}`:''}</p>${s.url?`<a class="source-link" href="${esc(s.url)}" target="_blank" rel="noopener">${icon('link')}공식 원문 확인</a>`:''}</article>`).join(''):empty('등록된 원문이 없습니다.','검토할 원문과 판본을 먼저 연결하세요.','',true,'knowledge'))}</div><div>${panel('연결·검증 범위',capEntries.length?`<ul class="capability-list">${capEntries.map(([key,v])=>`<li><div>${esc(typeof v==='object'?v.title||key:key)}${typeof v==='object'&&(v.description||v.reason)?`<p class="tiny muted">${esc(v.description||v.reason)}</p>`:''}</div>${capabilityStatus(v)}</li>`).join('')}</ul>`:'<p class="small muted">실제 연결 상태는 실행 환경에서 확인하세요.</p>')}${panel('사례·검색 자료 사용 원칙',`<p class="small muted" style="line-height:2">법령·실무준칙과 사례 관찰은 별도로 관리합니다. 평가 중인 동일 사건의 자료 묶음과 제출본 정답은 검색·few-shot 입력에 포함하지 않습니다.</p><div class="spacer"></div>${notice('원문 수집은 법적 해석·산식 승인과 구분합니다. 판본이 맞지 않거나 검색을 수행하지 않은 경우 검색 성공으로 표시하지 않습니다.','','shield')}`)}</div></div>`;
}
const agentNames={classify:'문서 분류',classifier:'문서 분류',extract:'feature 추출',extractor:'feature 추출',validate:'추출 검증',validator:'추출 검증',assess:'추가 준비 판단',assessment:'추가 준비 판단',judge:'추가 준비 판단',draft:'문서 작성',writer:'문서 작성',law_watch:'법령 갱신',legal_update:'법령 갱신',evaluate:'독립평가',evaluator:'독립평가'};
function renderPromptbook() {
  const agents=arr(state.promptbook?.agents),agent=agents.find(a=>a.name===state.agent)||agents[0];
  return heading('PROMPTBOOK','작은 작업, 확인 가능한 결과.','에이전트의 책임과 실제 입력·출력 범위를 직접 확인하고 수정합니다.',button('다시 불러오기','reload-prompts','','','history'))+
    (agent?panel('',`<div class="prompt-layout"><nav class="prompt-nav" aria-label="에이전트">${agents.map(a=>`<button class="prompt-agent ${a.name===agent.name?'active':''}" data-action="select-agent" data-name="${esc(a.name)}">${esc(agentNames[a.name]||a.name)}<small>${esc(a.name)}</small></button>`).join('')}</nav><div><div class="panel-heading" style="padding:0 0 18px;margin-bottom:19px"><div><h2>${esc(agentNames[agent.name]||agent.name)}</h2><p>${esc(agent.name)} · 버전 ${esc(agent.version||agent.config?.version||'파일 기준')}</p></div>${badge(agent.connected?'실제 호출 연결':'역할 정의 · 호출 미연결',agent.connected?'teal':'outline')}</div><form id="prompt-form" class="prompt-form" data-name="${esc(agent.name)}"><label>시스템 지시<textarea name="system" rows="9" required spellcheck="false">${esc(agent.system)}</textarea></label><label>작업 본문<textarea name="body" rows="7" required spellcheck="false">${esc(agent.body)}</textarea></label><div class="button-row" style="justify-content:space-between;margin-top:20px"><span class="tiny muted">비밀키나 실제 사건 원문을 예시 파일에 넣지 마세요.</span><button class="button primary" type="submit">${icon('check')}프롬프트 저장</button></div></form><details class="state-json"><summary>설정·입출력 스키마 보기</summary><pre class="code-block">${esc(JSON.stringify({config:agent.config,input_schema:agent.input_schema,output_schema:agent.output_schema},null,2))}</pre></details></div></div>`):empty('프롬프트북을 불러오지 못했습니다.','실행 환경을 확인하세요.',button('다시 불러오기','reload-prompts'),true,'promptbook'))+
    `<div class="section-gap">${notice('프롬프트 파일의 존재와 실제 호출 연결 상태를 구분합니다. 실행 입력·결과·사용량·실패는 비공개 사건 기록에서 확인하고, 내부 사고 과정을 요구하거나 저장하지 않습니다.','','shield')}</div>`;
}
function renderRuntime() {
  const s=state.status||{},ai=s.ai||{},n8n=s.n8n||{};
  return heading('RUNTIME','실행 환경을 확인하세요.','연결된 서비스와 실제 검증한 범위를 구분해 표시합니다.',button('상태 새로고침','refresh','','','history'))+
    `<div class="runtime-grid"><section class="runtime-card"><h3>추론 모델 ${badge(ai.configured?'키 설정됨':'설정 필요',ai.configured?'teal':'amber')}</h3><span class="runtime-value">${esc(ai.model||'모델 설정 확인 필요')}</span><p>${esc(ai.message||'분류·추출·검증·작성의 역할별 입력만 전달합니다. API 키는 화면에 표시하거나 브라우저에 보관하지 않습니다.')}</p></section><section class="runtime-card"><h3>n8n 워크플로 ${badge(n8n.ready?'연결됨':'준비 확인',n8n.ready?'teal':'amber')}</h3><span class="runtime-value">${esc(n8n.mode||'실행 모드 확인 필요')}</span><p>${esc(n8n.message||'서버 생존·준비 완료·Webhook 등록 상태를 확인합니다. 계산 결과의 실행 엔진과 적용 판본을 별도로 추적합니다.')}</p></section><section class="runtime-card"><h3>사건 저장소 ${badge('로컬 보관','teal')}</h3><span class="runtime-value">${esc(typeof s.storage==='string'?s.storage:s.storage?.provider||'SQLite + 파일 보관함')}</span><p>자료·원본·생성물·이력을 사건별로 보관합니다. 화면을 닫거나 서버를 재시작해도 사건을 자동 초기화하지 않습니다.</p></section></div>`+
    panel('작업 대기열·실행 기록',state.jobs.length?jobTable(state.jobs):'<div class="empty-inline">등록된 작업이 없습니다. 사건에서 자료 분석을 시작하세요.</div>',{raw:true,action:badge(`${state.jobs.length} JOBS`,'outline')})+
    `<div class="section-gap">${notice('검토자 이름 직접 입력은 로컬 프로토타입용 기록입니다. 운영 사용자 인증·역할 권한, 실제 법원 제출과 외부 서비스 동기화는 별도 검증 대상입니다.','amber','alert')}</div><details class="state-json"><summary>서비스 상태 상세 보기</summary><pre class="code-block">${esc(JSON.stringify(s,null,2))}</pre></details>`;
}

function showModal(title,subtitle,body,actions='',wide=false) { const dialog=$('#modal');dialog.classList.toggle('preview-dialog',wide);$('#modal-content').innerHTML=`<div class="modal-heading"><div><h2>${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div><button class="icon-button" data-action="close-modal" aria-label="닫기">×</button></div><div class="modal-body">${body}</div>${actions?`<div class="modal-actions">${actions}</div>`:''}`;if(!dialog.open)dialog.showModal(); }
function closeModal(){ $('#modal').close(); $('#modal-content').innerHTML=''; }
function field(name,title,value='',type='text',options={}) {
  const required=options.required?'required':'',full=options.full?'full':'';
  if(type==='checkbox')return `<label class="check-label ${full}"><input type="checkbox" name="${esc(name)}" ${value?'checked':''}>${esc(title)}</label>`;
  if(type==='select') {
    const current=String(value??''),choices=[...(options.options||[])];
    // Keep an unresolved or newly introduced value until the reviewer changes it.
    // A browser must never turn an unmatched value into the first listed option.
    if(!choices.some(([key])=>String(key)===current))choices.unshift([current,current?`현재 값: ${current} · 분류 확인 필요`:'선택·확인 필요']);
    return `<label class="${full}">${esc(title)}<select name="${esc(name)}" ${required}>${choices.map(o=>`<option value="${esc(o[0])}" ${current===String(o[0])?'selected':''}>${esc(o[1])}</option>`).join('')}</select></label>`;
  }
  if(type==='textarea')return `<label class="${full}">${esc(title)}<textarea name="${esc(name)}" rows="${options.rows||3}" ${required}>${esc(value)}</textarea>${options.help?`<div class="form-help">${esc(options.help)}</div>`:''}</label>`;
  return `<label class="${full}">${esc(title)}<input type="${type}" name="${esc(name)}" value="${esc(value)}" ${required} ${type==='number'?`step="${options.step||'any'}" min="${options.min??0}"`:''} ${options.placeholder?`placeholder="${esc(options.placeholder)}"`:''}>${options.help?`<div class="form-help">${esc(options.help)}</div>`:''}</label>`;
}
function editCase(isNew=false) {
  const c=isNew?{court:'서울회생법원',filing_date:today(),income_type:'business',repayment_months:36,period_start:`${today().slice(0,4)}-01-01`,period_end:today()}:state.current;
  const form=`<form id="case-form" data-new="${isNew}" class="form-grid">${field('title','사건명',c.title,'text',{required:true,full:true,placeholder:'예: 김OO 개인회생 신청'})}${field('applicant_name','의뢰인 성명',c.applicant_name,'text',{required:true})}${field('birth_date','생년월일',c.birth_date,'date')}${field('address','주소',c.address,'text',{full:true})}${field('court','관할',c.court,'text',{required:true})}${field('filing_date','신청 기준일',c.filing_date,'date',{required:true})}${field('income_type','소득 유형',c.income_type,'select',{options:[['business','사업소득'],['salary','근로소득'],['mixed','혼합소득'],['other','기타소득']]})}${field('tax_type','사업·과세 유형',c.tax_type,'select',{options:[['','확인 필요'],['general','일반과세'],['simplified','간이과세'],['exempt','면세'],['not_applicable','해당 없음']]})}${field('period_start','자료 대상기간 시작',c.period_start,'date')}${field('period_end','자료 대상기간 종료',c.period_end,'date')}<div class="form-section">계산 매개변수 · 인정값은 근거를 확인해 입력하세요.</div>${field('repayment_months','적용 변제기간 (개월)',c.repayment_months,'number',{min:1,step:1})}${field('living_cost','인정 월 생계비 (원)',c.living_cost,'number')}${field('deductions','월 공제액 (원)',c.deductions,'number')}${field('family_size','가구원 수',c.family_size,'number',{min:1,step:1})}${field('debt_cause','채무 발생 경위',c.debt_cause,'textarea',{full:true})}${field('statement','의뢰인 진술',c.statement,'textarea',{full:true,rows:4})}${field('assets_declared','누락된 재산 여부를 포함해 재산목록을 확인했습니다.',c.assets_declared,'checkbox',{full:true})}${!isNew?`${field('rule_approved','이 사건에 적용할 규칙·매개변수의 검토된 판본을 확인했습니다.',c.rule_approved,'checkbox',{full:true})}${field('template_approved','제공 양식과 사용 템플릿의 항목 대응을 확인했습니다.',c.template_approved,'checkbox',{full:true})}`:''}${field('reason',isNew?'입력 근거 / 상담 메모':'변경 사유',isNew?'':'','textarea',{full:true,required:!isNew,help:'입력 사실의 근거와 변경 이유를 기록합니다. 규칙·서식 확인은 실제 검토를 마친 경우에만 선택하세요.'})}</form>`;
  showModal(isNew?'새 사건 등록':'상담정보·적용 조건 수정','사건을 등록하면 원본과 변경 이력을 이 기기에 보관합니다.',form,button('취소','close-modal')+`<button class="button primary" type="submit" form="case-form">${icon('check')}${isNew?'사건 등록':'변경 저장'}</button>`);
}

const commonSource = [ ['source_document_id','원본 문서 ID','text'],['source_page','원본 쪽','number'],['source_quote','원문 발췌','textarea',{full:true}] ];
const schemas={
  incomes:[['label','소득원 이름','text',{required:true}],['kind','소득 종류','select',{options:[['business','사업소득'],['salary','근로소득'],['other','기타소득']]}],['period_start','귀속기간 시작','date'],['period_end','귀속기간 종료','date'],['monthly_gross','월 수입 (원)','number',{required:true}],['monthly_expense','월 인정경비 (원)','number',{required:true}],...commonSource,['confirmed','금액·귀속기간·인정 여부를 확인했습니다.','checkbox',{full:true}]],
  creditors:[['name','채권자명','text',{required:true}],['contract_id','계약·계좌 식별자','text',{required:true}],['principal','원금 (원)','number',{required:true}],['interest','이자 (원)','number',{required:true}],['security','담보 구분','select',{options:[['unknown','담보 여부 확인 필요'],['unsecured','무담보'],['secured','담보부']]}],['priority','채권 우선순위','select',{options:[['unknown','우선순위 확인 필요'],['ordinary','일반채권'],['tax','조세·우선 검토'],['priority','우선채권 · 전문가 확인']]}],['disputed','다툼·미확정이 있는 채권입니다.','checkbox',{full:true}],['confirmed','계약별 금액과 권리 성격을 확인했습니다.','checkbox',{full:true}]],
  assets:[['label','재산 이름','text',{required:true}],['kind','재산 종류','select',{options:[['unknown','재산 종류 확인 필요'],['property','재산 (추출 후보 · 세부 유형 확인)'],['deposit','예금'],['vehicle','자동차'],['real_estate','부동산'],['lease_deposit','임대차보증금'],['insurance','보험'],['other','기타']]}],['market_value','시가 후보 (원)','number',{required:true}],['secured_balance','담보 잔액 (원)','number',{required:true}],['exempt_amount','확인된 면제액 (원)','number',{required:true}],['valuation_date','가격 기준일','date'],['valuation_source','평가 출처 / 증빙','text',{full:true,required:true}],['confirmed','시가·담보·면제의 근거와 인정 여부를 확인했습니다.','checkbox',{full:true}]],
  transactions:[['date','거래일','date',{required:true}],['account','계좌 식별자','text',{required:true}],['amount','개별 거래금액 (원)','number',{required:true}],['direction','거래 방향','select',{options:[['withdrawal','출금'],['deposit','입금']]}],['counterparty','거래 상대방','text'],['purpose','용도 / 소명','textarea',{full:true}],...commonSource,['resolved','거래 성격과 관련 증빙을 확인·소명했습니다.','checkbox',{full:true}]],
  facts:[['key','feature 키','text',{required:true,placeholder:'예: applicant_name'}],['label','항목명','text',{required:true}],['value','원문·확정 값','textarea',{full:true,required:true}],['unit','단위','text'],['status','확인 상태','select',{options:[['candidate','추출 후보'],['confirmed','확정'],['disputed','불일치·다툼'],['withdrawn','철회']]}],['document_id','원본 문서 ID','text'],['page','원본 쪽','number'],['quote','원문 발췌','textarea',{full:true}]],
};
function editEntity(collection,id=null) {
  const item=id?arr(state.current[collection]).find(x=>x.id===id):{};if(!item)return;
  const defaults={kind:collection==='incomes'?'business':'unknown',security:'unknown',priority:'unknown',direction:'withdrawal',status:'candidate',period_start:state.current.period_start,period_end:state.current.period_end};
  const body=`<form id="entity-form" data-collection="${collection}" ${id?`data-id="${esc(id)}"`:''} class="form-grid">${schemas[collection].map(([key,title,type,options])=>field(key,title,item[key]??defaults[key]??'',type,options)).join('')}${field('reason','추가·수정·확정 사유',item.reason||'','textarea',{full:true,required:true,help:'없는 금액을 임의로 0으로 입력하지 마세요. 직접 확인한 값에는 확인한 근거를 남겨주세요.'})}</form>`;
  showModal(`${entityNames[collection]} ${id?'수정':'추가'}`,'같은 이름의 별도 계약·소득원·거래는 각각 다른 항목으로 유지합니다.',body,button('취소','close-modal')+`<button class="button primary" type="submit" form="entity-form">${icon('check')}저장하고 재평가</button>`);
}
function formData(form,schema=null) {
  const data=Object.fromEntries(new FormData(form));
  for(const el of form.elements) {if(!el.name)continue;if(el.type==='checkbox')data[el.name]=el.checked;else if(el.type==='number')data[el.name]=el.value===''?null:Number(el.value);}
  return data;
}
function confirmModal(title,description,action,attrs='') {showModal(title,'이 작업은 현재 사건 버전과 이력에 반영됩니다.',`<p class="small muted" style="line-height:1.9">${esc(description)}</p>`,button('취소','close-modal')+button(title,action,'danger',attrs));}
function previewArtifact(id) {
  const a=arr(state.current.artifacts).find(x=>x.id===id);if(!a)return;
  const isCurrent=artifactCurrent(a);const reviews=arr(state.current.reviews).filter(r=>r.artifact_id===a.id&&r.valid!==false);const staff=reviews.some(r=>r.role==='staff');
  const review=`<aside><div><h3 style="margin-bottom:11px">생성본 정보</h3><div class="review-meta">${esc(a.title)}<br>생성본 v${esc(a.version||1)} · 사건 v${esc(a.case_revision)}<br>${esc(date(a.created_at))}<br><span class="mono">SHA256<br>${esc(a.sha256||'해시 확인 필요')}</span></div><div class="spacer"></div><a class="button wide" href="${esc(a.url||`/api/cases/${encodeURIComponent(state.caseId)}/artifacts/${encodeURIComponent(a.id)}/file`)}" download>${icon('download')}실제 파일 내려받기</a></div><div><div class="spacer"></div><h3 style="margin-bottom:12px">생성 후 검수</h3>${isCurrent?`<form id="review-form" class="review-form" data-id="${esc(a.id)}"><label>검토자 이름<input name="reviewer" required placeholder="실제 확인한 검토자"></label><label>검수 역할<select name="role"><option value="staff">담당자 확인</option><option value="lawyer" ${staff?'':'disabled'}>변호사 최종 확인${staff?'':' · 담당자 확인 필요'}</option></select></label><label class="check-label"><input type="checkbox" required>원본·계산근거와 실제 생성 내용을 대조했습니다.</label><button class="button primary" type="submit">${icon('shield')}해당 생성본 확인</button><p class="review-note">로컬 검토자 이름을 기록합니다. 운영용 역할 인증은 연결되어 있지 않습니다. 파일 변경 뒤에는 검수가 다시 필요합니다.</p></form>`:notice('과거 생성본입니다. 최신 사실로 다시 생성한 뒤 검수하세요.','amber','alert')}<div class="review-stamp">${reviews.map(r=>badge(`${label(r.role)} · ${r.reviewer}`,'teal')).join('')}</div></div></aside>`;
  showModal(a.title||'생성 문서 확인','내려받는 파일과 같은 생성 데이터의 미리보기입니다.',`<div class="preview-layout"><iframe id="document-preview" class="preview-document" title="${esc(a.title||'생성 문서 미리보기')}" sandbox=""></iframe>${review}</div>`,button('닫기','close-modal'),true);
  $('#document-preview').srcdoc = a.preview_html || `<html lang="ko"><meta charset="utf-8"><body style="font-family:sans-serif;padding:40px;color:#657563"><h2>${esc(a.title||'파일 미리보기')}</h2><p>이 파일의 브라우저 미리보기가 없습니다. 실제 파일을 내려받아 확인하세요.</p></body></html>`;
}
function scenario(id) {
  const a=arr(state.current.assets).find(x=>x.id===id);if(!a)return;
  showModal('자산 처분 시나리오',`${a.label} · 실제 재산 상태는 변경하지 않습니다.`,`<form id="scenario-form" data-id="${esc(id)}" class="form-grid">${field('sale_price','예상 매각대금 (원)',a.market_value,'number',{required:true})}${field('secured_repayment','담보 상환액 (원)',a.secured_balance,'number',{required:true})}${field('costs','처분 비용 (원)','','number',{required:true})}${field('replacement_cost','대체재산 취득액 (원)','','number',{required:true})}<div class="full">${notice('예상 매각대금과 상환·비용·대체재산은 근거를 확인해 입력하세요. 시나리오 계산은 법적 청산가치의 최종 인정이 아닙니다.','','shield')}</div></form><div id="scenario-result"></div>`,button('닫기','close-modal')+`<button class="button primary" type="submit" form="scenario-form">${icon('calculations')}시나리오 계산</button>`);
}

function manageCase() {
  const c=state.current;
  showModal('사건 보관·삭제',c.title,`<div class="detail-list">${detail('사건 식별자',c.id,true)}${detail('현재 버전',`v${c.revision}`)}${detail('보관 상태',c.archived?'보관됨':'진행 중')}</div><div class="spacer"></div>${notice('보관은 자료와 이력을 유지한 상태로 사건을 구분합니다. 삭제는 원본·파생자료·생성물·검수·호출 기록을 함께 제거하며, 직접 내려받은 외부 파일은 삭제하지 않습니다.','amber','alert')}`,button('닫기','close-modal')+button(c.archived?'진행 중으로 복원':'사건 보관','archive-case')+button('사건 영구 삭제','delete-case','danger'));
}
function mapDocument(id) {
  const d=arr(state.current.documents).find(x=>x.id===id);if(!d)return;
  const pages=arr(d.pages);const evalPages=pages.filter(x=>x.role==='evaluation').map(x=>x.page).join(', '),adminPages=pages.filter(x=>x.role==='administrative').map(x=>x.page).join(', ');
  const role=d.role||'evidence';
  const body=`<form id="mapping-form" data-id="${esc(id)}" class="form-grid">${field('role','파일 기본 역할',role,'select',{options:[['evidence','의뢰인 증빙 · 생성 입력'],['evaluation','제출 완료본 · 평가 전용'],['administrative','행정자료 · 생성 제외'],['unknown','미분류 · 생성 제외']]})}${field('document_type','문서 유형',d.document_type||'unknown','text',{required:true})}${field('period_start','대상기간 시작',d.period_start,'date')}${field('period_end','대상기간 종료',d.period_end,'date')}<div class="form-section">혼합 PDF 역할 구분 · 총 ${esc(d.page_count||pages.length||1)}쪽</div>${field('evaluation_pages','평가 전용 제출본의 원본 쪽',evalPages,'text',{full:true,placeholder:'예: 1-4, 10, 20-24',help:'여기에 지정한 쪽은 생성·RAG·few-shot 입력에서 제외합니다.'})}${field('administrative_pages','행정자료의 원본 쪽',adminPages,'text',{full:true,placeholder:'예: 5, 118',help:'지정하지 않은 쪽은 파일의 기본 역할을 사용합니다. 원본 쪽 번호는 그대로 유지됩니다.'})}${field('reason','매핑 변경 사유','','textarea',{required:true,full:true})}<div class="full">${notice('역할이나 기간을 바꾸면 기존 추출 후보와 관련 인정값의 근거를 다시 확인해야 합니다. 제출 완료본을 증빙으로 섞지 마세요.','amber','alert')}</div></form>`;
  showModal('자료 역할·원본 쪽 매핑',d.filename||d.name||'원본 자료',body,button('취소','close-modal')+`<button class="button primary" type="submit" form="mapping-form">${icon('check')}매핑 저장</button>`);
}
function parseRanges(text,count) {
  const output=new Set();for(const token of String(text||'').split(/[\s,]+/).filter(Boolean)){
    const match=token.match(/^(\d+)(?:-(\d+))?$/);if(!match)throw new Error(`쪽 범위 '${token}'을 확인하세요. 예: 1-4, 10`);
    const start=Number(match[1]),end=Number(match[2]||match[1]);if(start<1||end>count||end<start)throw new Error(`원본 쪽은 1~${count} 범위로 지정하세요.`);
    for(let n=start;n<=end;n++)output.add(n);
  }return output;
}
function approveRelease() {
  showModal('검토한 규칙·서식 판본 등록','실제 검토를 마친 판본을 새 사건에서 재사용하도록 기록합니다.',`<form id="approval-form" class="form-grid">${field('reviewer','검토자','','text',{required:true,full:true})}${field('rule_approved','적용 시점·관할·산식·매개변수 판본을 검토했습니다.',false,'checkbox',{full:true})}${field('template_approved','사용자 제공 양식과 출력 템플릿의 항목 대응을 검토했습니다.',false,'checkbox',{full:true})}${field('reason','검토 범위·판본·근거','','textarea',{required:true,full:true})}<div class="full">${notice('원문 수집이나 코드의 존재는 전문가 검토 완료를 의미하지 않습니다. 실제 검토 범위 안에서만 등록하세요. 로컬 기록이며 운영용 역할 인증은 별도로 필요합니다.','amber','alert')}</div></form>`,button('취소','close-modal')+`<button class="button primary" type="submit" form="approval-form">${icon('shield')}판본 검토 기록</button>`);
}

document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-action]');if(!el||el.disabled)return;const action=el.dataset.action;
  if(action==='close-modal'){closeModal();return;}
  if(action==='toggle-menu'){$('#sidebar').classList.toggle('open');return;}
  if(action==='navigate'){await navigate(el.dataset.view);return;}
  if(action==='new-case'){editCase(true);return;}
  if(action==='edit-case'){editCase(false);return;}
  if(action==='entity-tab'){state.entityTab=el.dataset.collection;await navigate('facts');return;}
  if(action==='new-entity'){editEntity(el.dataset.collection);return;}
  if(action==='edit-entity'){editEntity(el.dataset.collection,el.dataset.id);return;}
  if(action==='preview-artifact'){previewArtifact(el.dataset.id);return;}
  if(action==='scenario'){scenario(el.dataset.id);return;}
  if(action==='manage-case'){manageCase();return;}
  if(action==='map-document'){mapDocument(el.dataset.id);return;}
  if(action==='approve-release'){approveRelease();return;}
  if(action==='delete-case'){confirmModal('사건 영구 삭제','이 사건의 원본·생성물·변경 이력·검수·호출 기록을 삭제합니다. 이 작업은 되돌릴 수 없습니다. 직접 내려받은 외부 파일은 보관됩니다.','confirm-delete-case');return;}
  if(action==='select-agent'){state.agent=el.dataset.name;render();return;}
  if(action==='delete-entity'){confirmModal('항목 삭제','현재 목록에서 이 항목을 제거하고 최신 상태로 다시 평가합니다. 이전 사건 버전과 변경 이력은 보존됩니다.','confirm-delete-entity',`data-id="${esc(el.dataset.id)}" data-collection="${esc(el.dataset.collection)}"`);return;}
  if(action==='delete-document'){confirmModal('자료 삭제','원본 자료를 현재 사건에서 제거합니다. 해당 원본에 의존하는 추출·계산·생성본은 다시 확인해야 합니다.','confirm-delete-document',`data-id="${esc(el.dataset.id)}"`);return;}
  el.classList.add('busy');
  await task(async()=>{
    if(action==='open-case')await openCase(el.dataset.id);
    if(action==='demo'){const r=await api('/api/demo',{method:'POST',body:'{}'});await loadCases();await openCase(r.id||r.case?.id);toast('합성 데모 사건을 열었습니다. 실제 법적 검증 결과와 구분해 확인하세요.');}
    if(action==='refresh'){await refresh();if(state.view==='runtime'){const r=await api('/api/jobs');state.jobs=arr(r.jobs||r);render();}toast('최신 상태를 불러왔습니다.');}
    if(action==='analyze'){await api(`/api/cases/${encodeURIComponent(state.caseId)}/analyze`,{method:'POST',body:JSON.stringify({expected_revision:state.current.revision})});await loadCase();toast('분석 작업을 요청했습니다. 처리 중에도 자료와 사실을 수정할 수 있습니다.');}
    if(action==='generate'){await api(`/api/cases/${encodeURIComponent(state.caseId)}/generate`,{method:'POST',body:JSON.stringify({expected_revision:state.current.revision})});await loadCase(false);await loadCases();await navigate('artifacts');toast('현재 사건 버전의 생성 결과를 확인하세요.');}
    if(action==='confirm-delete-entity'){await api(`/api/cases/${encodeURIComponent(state.caseId)}/entities/${el.dataset.collection}/${encodeURIComponent(el.dataset.id)}?expected_revision=${state.current.revision}`,{method:'DELETE'});closeModal();await loadCase();toast('항목을 삭제하고 현재 상태를 갱신했습니다.');}
    if(action==='confirm-delete-document'){await api(`/api/cases/${encodeURIComponent(state.caseId)}/documents/${encodeURIComponent(el.dataset.id)}?expected_revision=${state.current.revision}`,{method:'DELETE'});closeModal();await loadCase();toast('자료를 삭제했습니다. 연결된 사실의 근거를 다시 확인하세요.');}
    if(action==='reload-knowledge'){state.knowledge=await api('/api/knowledge');render();toast('근거 자료 상태를 불러왔습니다.');}
    if(action==='reload-prompts'){state.promptbook=await api('/api/promptbook');render();toast('프롬프트 파일을 다시 불러왔습니다.');}
    if(action==='archive-case'){await api(`/api/cases/${encodeURIComponent(state.caseId)}/archive`,{method:'POST',body:JSON.stringify({expected_revision:state.current.revision,reason:'사용자가 사건 보관 상태 변경'})});closeModal();await loadCases();await loadCase();toast('사건 보관 상태를 변경했습니다.');}
    if(action==='confirm-delete-case'){await api(`/api/cases/${encodeURIComponent(state.caseId)}`,{method:'DELETE'});closeModal();state.caseId=null;state.current=null;await loadCases();await navigate('cases');toast('사건과 관련 자료·이력을 삭제했습니다.');}
    if(action==='view-calls'){const r=await api(`/api/cases/${encodeURIComponent(state.caseId)}/calls`);const calls=arr(r.calls||r);showModal('실제 AI 호출 기록','비공개 사건 저장 영역의 입력·출력과 프롬프트 판본입니다.',calls.length?calls.map(c=>`<details class="state-json"><summary>${esc(c.agent||c.name||'에이전트')} · ${esc(c.status||'실행 기록')} · ${esc(date(c.created_at))}</summary><pre class="code-block">${esc(JSON.stringify(c,null,2))}</pre></details>`).join(''):empty('실제 AI 호출 기록이 없습니다.','자료 분석 중 수행한 호출만 기록합니다. 파일이 있다는 이유로 호출 성공으로 표시하지 않습니다.','',true,'promptbook'),button('닫기','close-modal'),true);}
    if(action==='refresh-sources'){const result=await api('/api/knowledge/refresh',{method:'POST',body:'{}'});state.knowledge=await api('/api/knowledge');render();showModal('공식 원문 변경 조회','원문 수집 결과이며 법적 해석·산식의 자동 승인을 의미하지 않습니다.',`<pre class="code-block">${esc(JSON.stringify(result,null,2))}</pre>`,button('닫기','close-modal'));}
  });
  el.classList.remove('busy');
});

document.addEventListener('submit',async e=>{
  const form=e.target;if(!['case-form','entity-form','upload-form','review-form','prompt-form','scenario-form','mapping-form','knowledge-search-form','approval-form'].includes(form.id))return;e.preventDefault();if(!form.reportValidity())return;
  const submitButton=document.querySelector(`[form="${form.id}"][type="submit"]`)||$('button[type=submit]',form);if(submitButton)submitButton.disabled=true;
  await task(async()=>{
    if(form.id==='case-form'){
      const payload=formData(form),isNew=form.dataset.new==='true';if(!isNew)payload.expected_revision=state.current.revision;
      const r=await api(isNew?'/api/cases':`/api/cases/${encodeURIComponent(state.caseId)}`,{method:isNew?'POST':'PATCH',body:JSON.stringify(payload)});closeModal();await loadCases();if(isNew)await openCase(r.id||r.case?.id);else await loadCase();toast(isNew?'사건을 등록했습니다.':'변경 사유와 새 사건 버전을 저장했습니다.');
    }
    if(form.id==='entity-form'){
      const payload=formData(form),collection=form.dataset.collection,id=form.dataset.id;payload.expected_revision=state.current.revision;
      await api(`/api/cases/${encodeURIComponent(state.caseId)}/entities/${collection}${id?`/${encodeURIComponent(id)}`:''}`,{method:id?'PATCH':'POST',body:JSON.stringify(payload)});closeModal();await loadCase();toast('입력과 변경 사유를 저장하고 현재 상태를 갱신했습니다.');
    }
    if(form.id==='upload-form'){
      const f=new FormData(form),files=Array.from($('#upload-files').files);if(!files.length)throw new Error('업로드할 파일을 먼저 선택하세요.');let count=0;
      for(const file of files){const payload=new FormData();payload.set('file',file);for(const key of ['role','document_type','period_start','period_end'])payload.set(key,f.get(key)||'');await api(`/api/cases/${encodeURIComponent(state.caseId)}/documents`,{method:'POST',body:payload});count++;}
      await loadCase();toast(`${count}개 원본을 보관했습니다. 자료 분석을 실행해 추출을 시작하세요.`);
    }
    if(form.id==='review-form'){
      const payload=formData(form);payload.artifact_id=form.dataset.id;payload.expected_revision=state.current.revision;await api(`/api/cases/${encodeURIComponent(state.caseId)}/reviews`,{method:'POST',body:JSON.stringify(payload)});await loadCase(false);await loadCases();render();previewArtifact(payload.artifact_id);toast('해당 생성본의 버전과 해시에 검수 기록을 연결했습니다.');
    }
    if(form.id==='prompt-form'){
      await api(`/api/promptbook/${encodeURIComponent(form.dataset.name)}`,{method:'PUT',body:JSON.stringify(formData(form))});state.promptbook=await api('/api/promptbook');render();toast('프롬프트를 저장했습니다. 다음 실행부터 적용됩니다.');
    }
    if(form.id==='scenario-form'){
      const payload=formData(form);payload.asset_id=form.dataset.id;const r=await api(`/api/cases/${encodeURIComponent(state.caseId)}/scenario`,{method:'POST',body:JSON.stringify(payload)});$('#scenario-result').innerHTML=`<div class="scenario-result"><strong>잔여 현금 ${esc(won(r.net_cash))}</strong><p style="margin-top:9px">대체재산 포함 처분 후 총액 ${esc(won(r.total_after))}</p><p class="tiny" style="margin-top:10px;line-height:1.9">${esc(r.explanation||'시나리오 결과이며 실제 재산 상태나 법적 인정가를 변경하지 않습니다.')}</p></div>`;
    }
    if(form.id==='mapping-form'){
      const payload=formData(form),d=arr(state.current.documents).find(x=>x.id===form.dataset.id),count=d.page_count||arr(d.pages).length||1;
      const excluded=parseRanges(payload.evaluation_pages,count),admin=parseRanges(payload.administrative_pages,count);
      if([...excluded].some(n=>admin.has(n)))throw new Error('평가 전용 쪽과 행정자료 쪽이 겹칩니다. 원본 쪽의 역할은 하나만 지정하세요.');
      delete payload.evaluation_pages;delete payload.administrative_pages;payload.expected_revision=state.current.revision;
      payload.pages=Array.from({length:count},(_,i)=>({page:i+1,role:excluded.has(i+1)?'evaluation':admin.has(i+1)?'administrative':payload.role,document_type:payload.document_type}));
      await api(`/api/cases/${encodeURIComponent(state.caseId)}/documents/${encodeURIComponent(d.id)}`,{method:'PATCH',body:JSON.stringify(payload)});closeModal();await loadCase();toast('원본 쪽과 자료 역할을 매핑했습니다. 최신 매핑으로 자료 분석을 다시 실행하세요.');
    }
    if(form.id==='approval-form'){
      const payload=formData(form);if(!payload.rule_approved&&!payload.template_approved)throw new Error('실제로 검토한 판본의 종류를 선택하세요.');await api('/api/approvals',{method:'POST',body:JSON.stringify(payload)});closeModal();toast('검토 판본을 기록했습니다. 새 사건에서 재사용할 수 있습니다.');
    }
    if(form.id==='knowledge-search-form'){
      const payload=formData(form);payload.jurisdiction=state.current?.court||'서울회생법원';payload.filing_date=state.current?.filing_date||today();payload.excluded_dataset_group_ids=state.current?.dataset_group_id?[state.current.dataset_group_id]:[];payload.limit=5;
      const r=await api('/api/knowledge/search',{method:'POST',body:JSON.stringify(payload)}),hits=arr(r.hits||r.results||r.matches);
      $('#knowledge-search-result').innerHTML=`<div class="spacer"></div>${notice(r.reason||r.warning||r.message||`검색 방식: ${r.mode||r.method||'실제 응답의 실행 근거 확인'} · 적용 가능한 자료 ${hits.length}건`,r.available===false?'amber':'','knowledge')}${hits.length?hits.map(h=>`<article class="source-card"><h3>${esc(h.title||h.metadata?.title||h.metadata?.source_id||h.id||'검색 근거')}</h3><p style="white-space:pre-wrap">${esc(h.text||h.content||h.chunk||'')}</p><p>출처 ${esc(h.metadata?.source_url||h.source_url||'원문 확인 필요')} · 유사도 ${esc(present(h.score)?Number(h.score).toFixed(3):'미제공')}</p></article>`).join(''):'<div class="empty-inline">현재 적재·적용 가능한 검색 자료가 없습니다. 빈 결과를 법적 판단으로 사용하지 않습니다.</div>'}`;
    }
  });
  if(submitButton?.isConnected)submitButton.disabled=false;
});
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
window.addEventListener('hashchange',()=>{const view=location.hash.slice(1);if(views[view]&&view!==state.view)task(()=>navigate(view));});
async function poll(){
  if(document.hidden||state.polling||$('#modal').open||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
  const pending=arr(state.current?.jobs).some(j=>/pending|queued|running|processing|retry/.test(j.status||''));if(!pending)return;
  state.polling=true;try{await loadCase(false);if(!globalViews.includes(state.view))render();}catch{}finally{state.polling=false;}
}
setInterval(poll,4500);
async function boot(){
  try{
    const [status,cases]=await Promise.all([api('/api/status'),api('/api/cases')]);state.status=status;state.cases=arr(cases.cases||cases);
    if(state.caseId){try{await loadCase(false);}catch{state.caseId=null;state.current=null;state.view='cases';}}
    if(!globalViews.includes(state.view)&&!state.current)state.view='cases';await navigate(state.view);
  }catch(error){renderNav();$('#main').innerHTML=`<div class="error-screen"><div class="eyebrow">CONNECTION</div><h2>워크스페이스에 연결할 수 없습니다.</h2><p>${esc(error.message)}</p><button class="button primary" onclick="location.reload()">다시 연결하기</button></div>`;}
}
boot();
