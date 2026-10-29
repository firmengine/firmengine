import { lazy, Suspense, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness,
  Check, CheckCheck, ChevronDown, ChevronRight, CircleAlert, CircleCheck,
  Clock3, FileCheck2, FileSearch, Files, FileText, FlaskConical, FolderOpen,
  History, LayoutDashboard, ListChecks, Menu, MessageSquareText, MoreHorizontal,
  Plus, RotateCcw, Scale, Search, Settings2, ShieldCheck, Sparkles, UploadCloud,
  UserRound, Users, Wallet, X, Calculator, Link2, Trash2,
} from 'lucide-react';
import {
  createInitialState, labReducer, requirementsFor, deriveReadiness,
  type LabState, type LabAction, type CaseRecord, type Role, type Scenario,
  type DocumentKind, type DocumentRecord, type EvidenceField, type GeneratedSnapshot,
} from './model';
import { downloadSnapshot } from './exports';
import Operations from './Operations';
import { readOperationBlockers } from './operations-model';
import FinancialWorkbench from './FinancialWorkbench';
import type { PdfWorkbenchProps } from './PdfWorkbench';
import RequirementLinks from './RequirementLinks';
import DailyBrief from './DailyBrief';
const LazyPdfWorkbench = lazy(() => import('./PdfWorkbench'));
function PdfWorkbench(props: PdfWorkbenchProps) { return <Suspense fallback={<div className="pdf-file-status">PDF 도구를 준비하고 있습니다…</div>}><LazyPdfWorkbench {...props}/></Suspense>; }

function Count({value}: {value:number}) {
  const [shown,setShown] = useState(value);
  const previous = useRef(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {setShown(value);previous.current=value;return;}
    const from=previous.current, start=performance.now();let frame=0;
    const tick=(now:number)=>{const progress=Math.min(1,(now-start)/550);setShown(Math.round(from+(value-from)*(1-(1-progress)**3)));if(progress<1)frame=requestAnimationFrame(tick);else previous.current=value;};
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[value]);
  return <span aria-label={String(value)}>{shown}</span>;
}

type Page = 'overview' | 'consultation' | 'documents' | 'verification' | 'calculation' | 'drafts' | 'activity' | 'legal' | 'tasks' | 'references' | 'procedures' | 'recovery';
type Dispatch = (action: LabAction) => void;
const STORAGE_KEY = 'firmengine.frontend-lab.v1';
const roleNames: Record<Role, string> = { client: '의뢰인', staff: '법무법인 담당자', lawyer: '검토 변호사' };
const pageNames: Record<Page, string> = { overview: '전체 사건', consultation: '상담 · 사건 정보', documents: '준비 서류', verification: '서류 · 원문 검토', calculation: '계산 · 변제계획', drafts: '문서 작성 · 검토', activity: '변경 이력', legal: '법률 검토', tasks: '업무함', references: '기준정보 관리자', procedures: '절차 기록', recovery: '운영 · 복구 테스트' };
const navItems = [
  { id: 'overview', icon: LayoutDashboard, group: 'WORKSPACE' },
  { id: 'consultation', icon: BriefcaseBusiness },
  { id: 'tasks', icon: ListChecks },
  { id: 'references', icon: Settings2, group: 'ADMINISTRATION' },
  { id: 'recovery', icon: ShieldCheck },
] as const;
const groups: { label: string; pages: Page[]; client?: boolean }[] = [
  { label: '상담 · 준비', pages: ['consultation', 'documents'], client: true },
  { label: '서류 · 원문 검토', pages: ['verification'] },
  { label: '계산 · 법률 검토', pages: ['calculation', 'legal'] },
  { label: '작성 · 최종 검토', pages: ['drafts'] },
  { label: '업무 · 절차 기록', pages: ['tasks', 'procedures', 'activity'], client: true },
];
const description: Record<Page, string> = { overview: '', consultation: '상담 내용을 준비 서류와 검토 작업으로 연결합니다.', documents: '자료를 한 번 추가하고 필요한 항목에 연결하세요.', verification: 'PDF 원문과 항목별 값을 같은 화면에서 대조합니다.', calculation: '소득·채무·재산과 월별 변제 예산을 확인합니다.', legal: '상충하는 판단과 근거를 확인하고 해결 사유를 남깁니다.', drafts: '수정한 사실과 근거를 반영해 초안을 생성하고 검토합니다.', activity: '사건별 변경 내역과 검토 기록입니다.', tasks: '담당자와 기한, 대기 사유를 관리합니다.', procedures: '실제 법원 절차와 문서 생성 상태를 구분해 기록합니다.', references: '스키마별 기준정보와 변경 판본을 관리합니다.', recovery: '실패 작업·중복 요청·동시 수정의 처리 흐름을 시험합니다.' };
const money = (value: number | null | undefined) => value == null ? '미확인' : `${value.toLocaleString('ko-KR')}원`;
const statusNames = { candidate: '확인 대기', confirmed: '확인 완료', conflict: '금액 충돌', missing: '자료 없음', uploaded: '수취 완료', withdrawn: '철회됨' };
const docNames: Record<DocumentKind, string> = { identity: '신원 자료', income: '소득 자료', debt: '채무 자료', business: '사업 자료', asset: '재산 자료' };
const stageNames = { intake: '상담 접수', evidence: '자료 검토 중', draft: '초안 검토 대기', staff_reviewed: '변호사 검토 대기', lawyer_reviewed: '모의 검토 완료' };
function documentUrl(current: CaseRecord, document: DocumentRecord, files: Record<string, string>) {
  return files[`${current.id}:${document.name}`] || (document.synthetic ? `/demo/${document.id.endsWith('debt-alt') ? 'debt-alt' : document.kind}.pdf` : undefined);
}

function loadState(): LabState {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (stored?.version === 1 && ['staff', 'client', 'lawyer'].includes(stored.state?.role) &&
      Array.isArray(stored.state.cases) && stored.state.cases.length &&
      stored.state.cases.every((c: CaseRecord) => typeof c.id === 'string' && Array.isArray(c.fields) && Array.isArray(c.documents) && Array.isArray(c.generated) && Array.isArray(c.history) && Array.isArray(c.tasks)) &&
      stored.state.cases.some((c: CaseRecord) => c.id === stored.state.activeCaseId)) return { ...stored.state, notice: null };
  } catch { /* Corrupt or unavailable browser storage starts a fresh demo. */ }
  return createInitialState();
}

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'green' | 'amber' | 'red' | 'neutral' | 'blue' }) {
  return <span className={`badge ${tone}`}><span className="badge-dot" />{children}</span>;
}
function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><FolderOpen size={30} /><h3>{title}</h3><p>{children}</p></div>;
}
function SectionHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div><div className="heading-actions">{children}</div></div>;
}
function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className={`modal ${wide ? 'wide' : ''}`} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="닫기" onClick={onClose}><X size={20} /></button></div>{children}
  </dialog>;
}

export default function App() {
  const [state, dispatch] = useReducer(labReducer, undefined, loadState);
  const [page, setPage] = useState<Page>(() => location.hash === '#/admin' ? 'references' : 'overview');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState<'new' | 'guide' | 'reset' | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const [files, setFiles] = useState<Record<string, string>>({});
  const fileUrls = useRef<string[]>([]);
  const current = state.cases.find(c => c.id === state.activeCaseId)!;
  const readiness = deriveReadiness(current);
  const isClient = state.role === 'client';
  const openTasks = state.cases.reduce((sum, c) => sum + c.tasks.filter(t => t.status === 'open').length, 0);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state: { ...state, notice: null } })); setStorageWarning(false); }
    catch { setStorageWarning(true); }
  }, [state]);
  useEffect(() => () => fileUrls.current.forEach(url => URL.revokeObjectURL(url)), []);
  useEffect(() => {
    if (!state.notice) return;
    const timer = window.setTimeout(() => dispatch({ type: 'CLEAR_NOTICE' }), 6000);
    return () => clearTimeout(timer);
  }, [state.notice]);
  const navigate = (next: Page) => {
    const update = () => { setPage(next); setMobileNav(false); window.history.replaceState(null, '', next === 'references' ? '#/admin' : `#/${next}`); };
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(update); else update();
  };
  const selectCase = (id: string, next: Page = 'consultation') => { dispatch({ type: 'SELECT_CASE', caseId: id }); navigate(next); };
  const registerFile = (name: string, file: File) => {
    const url = URL.createObjectURL(file); fileUrls.current.push(url);
    setFiles(prev => ({ ...prev, [`${current.id}:${name}`]: url }));
  };
  return <div className="app-shell">
    {mobileNav && <button className="nav-overlay" aria-label="메뉴 닫기" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}>
      <a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('overview'); }}><span className="brand-mark"><Check size={25} strokeWidth={2.3} /></span><span>빚오프<small>FIRMENGINE AX</small></span></a>
      <div className="workspace-label"><div className="workspace-avatar">F</div><span>펌엔진 법률사무소<small>개인회생 워크스페이스</small></span><Badge tone="green">데모</Badge></div>
      <nav aria-label="주 메뉴">{navItems.filter(n => !isClient || ['overview', 'consultation', 'tasks'].includes(n.id)).map(item => <div key={item.id}>
        {'group' in item && <div className="nav-group">{item.group}</div>}
        <button className={`nav-item ${(page === item.id || item.id === 'consultation' && !['overview','tasks','references','recovery'].includes(page)) ? 'active' : ''}`} onClick={() => navigate(item.id)}><item.icon size={19} strokeWidth={1.7} /><span>{item.id === 'consultation' ? '선택한 사건' : pageNames[item.id]}</span>{item.id === 'tasks' && openTasks > 0 && <span className="nav-count">{openTasks}</span>}{item.id === 'overview' && <span className="nav-count subtle">{state.cases.length}</span>}</button>
      </div>)}</nav>
      <div className="sidebar-bottom"><DailyBrief/><div className="demo-card"><FlaskConical size={20} /><strong>직접 흐름을 확인해보세요</strong><p>세 가지 예제 사건으로<br />접수부터 검토까지.</p><button onClick={() => setModal('guide')}>테스트 가이드 <ArrowUpRight size={15} /></button></div><button className="sidebar-setting" onClick={() => setModal('reset')}><RotateCcw size={16} /> 데모 데이터 초기화</button><div className="sidebar-version"><span className="online-dot" /> Local workspace <span>AX v44</span></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="메뉴 열기" onClick={() => setMobileNav(true)}><Menu size={21} /></button><span>워크스페이스</span><ChevronRight size={14} /><strong>{pageNames[page]}</strong></div><div className="topbar-right"><span className="local-chip"><span className="online-dot" /> 로컬 테스트</span><button className="icon-button notification" aria-label="미완료 업무 보기" onClick={() => navigate('activity')}><Bell size={19} />{openTasks > 0 && <i />}</button><div className="role-control"><span className="avatar">{state.role === 'client' ? '의' : state.role === 'lawyer' ? '변' : '담'}</span><label><span>화면 역할</span><select aria-label="화면 역할" value={state.role} onChange={e => { const role = e.target.value as Role; dispatch({ type: 'SET_ROLE', role }); if (role === 'client') navigate('overview'); }}>{Object.entries(roleNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div></div></header>
      <main>
        {storageWarning && <div className="notice amber"><CircleAlert size={17} /> 브라우저 저장소를 사용할 수 없어 새로고침하면 작업이 사라질 수 있습니다.</div>}
        {page === 'overview' ? <>
          <SectionHeading eyebrow="CASE WORKSPACE" title={isClient ? '차근차근, 준비를 시작해볼까요?' : '오늘도, 한 단계 앞으로.'} description={isClient ? '상담을 작성하고, 필요한 서류와 진행 상황을 한곳에서 확인하세요.' : '흩어진 자료를 연결하고, 확인이 필요한 일부터 처리하세요.'}><button className="button secondary" onClick={() => setModal('guide')}><FlaskConical size={16} /> 테스트 가이드</button><button className="button primary" onClick={() => setModal('new')}><Plus size={17} /> 새 사건 접수</button></SectionHeading>
          <div className={`forest-welcome ${isClient ? 'client-welcome' : ''}`}><div><span className="eyebrow">A NEW BEGINNING</span><h2>{isClient ? <>다시 시작하는 길,<br />함께 걷겠습니다.</> : <>복잡한 일은 덜고,<br />중요한 검토에 집중하세요.</>}</h2><p>{isClient ? '지금 필요한 준비를 한 단계씩 안내합니다.' : '상담, 증빙, 판단과 문서가 하나의 사건으로 연결됩니다.'}</p><button className="button forest-button" onClick={() => navigate(isClient ? 'documents' : 'verification')}>{isClient ? '준비 서류 확인하기' : '선택한 사건 이어서 검토'} <ArrowRight size={16}/></button></div><span className="forest-caption">CARE IN EVERY STEP.</span></div>
          <div className="metric-grid">{[
            { label: '전체 사건', value: state.cases.length, note: '이 브라우저의 테스트 사건', icon: BriefcaseBusiness, tone: 'green' },
            { label: '자료 확인 필요', value: state.cases.filter(c => !deriveReadiness(c).canGenerate).length, note: '누락 · 충돌 항목 확인', icon: FileSearch, tone: 'amber' },
            { label: '검토 대기 문서', value: state.cases.filter(c => c.generated.some(g => !g.invalidated && !g.lawyerReviewed)).length, note: '담당자 또는 변호사 확인', icon: FileCheck2, tone: 'blue' },
            { label: '모의 검토 완료', value: state.cases.filter(c => deriveReadiness(c).stage === 'lawyer_reviewed').length, note: '실제 법원 제출과 별개', icon: ShieldCheck, tone: 'neutral' },
          ].map(m => <div className="metric-card" key={m.label}><div><span>{m.label}</span><m.icon size={18} className={`text-${m.tone}`} /></div><strong><Count value={m.value}/><small>건</small></strong><p>{m.note}</p></div>)}</div>
          <div className="overview-grid"><section className="panel cases-panel"><div className="panel-heading"><div><h2>{isClient ? '내 상담과 준비 현황' : '진행 중인 사건'} <span className="count-pill">{state.cases.length}</span></h2><p>사건을 선택해 준비 상태와 다음 할 일을 확인하세요.</p></div><MoreHorizontal size={20} className="muted" /></div><div className="table-toolbar"><div className="segmented" aria-label="사건 필터">{[['all', '전체'], ['needs', '확인 필요'], ['done', '검토 완료']].map(([value, name]) => <button key={value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{name}</button>)}</div><div className="search-field"><Search size={16} /><input aria-label="사건 검색" placeholder="사건명 검색" value={search} onChange={e => setSearch(e.target.value)} /></div></div><div className="table-wrap"><table className="case-table"><thead><tr><th>사건 / 의뢰인</th><th>진행 상태</th><th>서류 준비</th><th>다음 할 일</th><th><span className="sr-only">열기</span></th></tr></thead><tbody>{state.cases.filter(c => c.title.toLowerCase().includes(search.toLowerCase())).filter(c => filter === 'all' || (filter === 'done' ? deriveReadiness(c).stage === 'lawyer_reviewed' : !deriveReadiness(c).canGenerate)).map((c, index) => {
            const r = deriveReadiness(c), requirements = requirementsFor(c).filter(r => r.required), done = requirements.filter(d => d.status === 'confirmed').length;
            return <tr key={c.id} className={c.id === current.id ? 'selected-row' : ''}><td><button className="case-link" onClick={() => selectCase(c.id)}><span className={`case-avatar palette-${index % 3}`}>{c.title.replace('[합성] ', '').slice(0, 1)}</span><span><strong>{c.title}</strong><small>{c.id} · {c.incomeType === 'business' ? '개인사업자' : '급여소득자'}</small></span></button></td><td><Badge tone={r.stage === 'lawyer_reviewed' ? 'green' : c.fields.some(f => f.status === 'conflict') ? 'amber' : 'neutral'}>{stageNames[r.stage]}</Badge></td><td><div className="mini-progress"><span>{done}<i> / {requirements.length}</i></span><div><b style={{ width: `${done / requirements.length * 100}%` }} /></div></div></td><td><button className="text-button next-task" onClick={() => selectCase(c.id, r.missingDocuments.length ? 'documents' : !r.canGenerate ? 'verification' : 'drafts')}>{r.missingDocuments.length ? '서류 보완' : !r.canGenerate ? '추출값 확인' : r.stage === 'lawyer_reviewed' ? '완료본 확인' : '문서 검토'}<ArrowRight size={14} /></button></td><td><button className="icon-button" aria-label={`${c.title} 열기`} onClick={() => selectCase(c.id)}><ChevronRight size={16} /></button></td></tr>;
          })}</tbody></table>{!state.cases.some(c => c.title.toLowerCase().includes(search.toLowerCase()) && (filter === 'all' || (filter === 'done' ? deriveReadiness(c).stage === 'lawyer_reviewed' : !deriveReadiness(c).canGenerate))) && <Empty title="표시할 사건이 없습니다">검색어나 상태 필터를 변경해보세요.</Empty>}</div><div className="table-footer"><span><span className="online-dot" /> 변경사항은 이 브라우저에 저장됩니다.</span><span>합성 예제 데이터</span></div></section>
          <aside className="focus-panel"><div className="focus-heading"><span className="eyebrow">UP NEXT</span><span className="focus-icon"><ListChecks size={20} /></span></div><h2>확인할 일이<br />명확해집니다.</h2><p>선택한 사건의 남은 항목을<br />순서대로 확인하세요.</p><div className="focus-case"><small>현재 사건</small><strong>{current.title}</strong></div><div className="focus-tasks"><button onClick={() => navigate('documents')}><span className="step-number">1</span><span>준비 서류 확인<small>{readiness.missingDocuments.length ? `${readiness.missingDocuments.length}개 항목 보완 필요` : '수취 자료의 확인 상태 점검'}</small></span><ChevronRight size={15} /></button><button onClick={() => navigate(isClient ? 'documents' : 'verification')}><span className="step-number">2</span><span>원문과 값 대조<small>{readiness.fieldIssues.length}개 값 확인 대기</small></span><ChevronRight size={15} /></button><button onClick={() => navigate(isClient ? 'consultation' : 'drafts')}><span className="step-number">3</span><span>초안 작성과 검토<small>담당자 → 변호사 순서로 확인</small></span><ChevronRight size={15} /></button></div><button className="focus-cta" onClick={() => navigate(isClient ? 'documents' : 'verification')}>이어서 검토하기 <ArrowRight size={17} /></button></aside></div>
          <div className="workflow-banner"><span className="banner-icon"><Link2 size={21} /></span><div><strong>상담에서 문서까지, 하나의 연결된 흐름</strong><p>자료를 수정하면 관련 계산과 문서의 검토 상태도 함께 갱신됩니다.</p></div><div className="flow-tags"><span>상담</span><ChevronRight size={13} /><span>증빙</span><ChevronRight size={13} /><span>계산</span><ChevronRight size={13} /><span>검토</span></div></div>
        </> : <>
          <SectionHeading eyebrow="CASE WORKSPACE" title={pageNames[page]} description={description[page]}><button className="button secondary" onClick={() => navigate('overview')}><ArrowLeft size={16} /> 사건 목록</button></SectionHeading>
          <div className="case-context"><span className="case-avatar">{current.title.replace('[합성] ', '').slice(0, 1)}</span><label><span>현재 사건</span><select aria-label="현재 사건" value={current.id} onChange={e => dispatch({ type: 'SELECT_CASE', caseId: e.target.value })}>{state.cases.map(c => <option key={c.id} value={c.id}>{c.title} · {c.id}</option>)}</select></label><Badge tone={readiness.stage === 'lawyer_reviewed' ? 'green' : 'neutral'}>{stageNames[readiness.stage]}</Badge><span className="revision">사건 버전 {current.revision}</span></div>
          <div className="case-steps" aria-label="사건 처리 단계">{groups.filter(g => !isClient || g.client).map(g => <button key={g.label} className={g.pages.includes(page) ? 'active' : ''} onClick={() => navigate(g.pages[0])}>{g.label}</button>)}</div>
          {groups.find(g => g.pages.includes(page)) && <div className="sub-tabs">{groups.find(g => g.pages.includes(page))!.pages.map(p => <button key={p} className={page === p ? 'active' : ''} onClick={() => navigate(p)}>{pageNames[p]}</button>)}</div>}
          <div key={`${current.id}:${page}`}>
            {(['legal','tasks','references','procedures','recovery'] as Page[]).includes(page) && <Operations current={current} role={state.role} mode={page as 'legal'|'tasks'|'references'|'procedures'|'recovery'} onCaseChange={reason => { (page === 'references' ? state.cases : [current]).forEach(c => dispatch({type:'EXTERNAL_CHANGE',caseId:c.id,reason})); }} />}
            {page === 'consultation' && <Consultation current={current} dispatch={dispatch} navigate={navigate} />}
            {page === 'documents' && <Documents current={current} role={state.role} dispatch={dispatch} registerFile={registerFile} files={files} navigate={navigate} />}
            {page === 'verification' && <Verification current={current} role={state.role} dispatch={dispatch} files={files} navigate={navigate} />}
            {page === 'calculation' && <><Calculation current={current} role={state.role} dispatch={dispatch} navigate={navigate} /><FinancialWorkbench current={current} role={state.role} dispatch={dispatch} /></>}
            {page === 'drafts' && <Drafts current={current} role={state.role} dispatch={dispatch} navigate={navigate} blockers={readOperationBlockers(current.id, current)} />}
            {page === 'activity' && <Activity current={current} role={state.role} navigate={navigate} />}
          </div>
        </>}
        <footer className="main-footer"><span>FirmEngine <span className="footer-dot">·</span> 검토에 집중할 수 있는 업무 공간</span><button onClick={() => setModal('guide')}>합성 데이터 · 로컬 기능 테스트 <ArrowUpRight size={12} /></button></footer>
      </main>
    </div>
    {state.notice && <div className="toast" role="status"><CircleAlert size={18} /><span>{state.notice}</span><button className="icon-button" onClick={() => dispatch({ type: 'CLEAR_NOTICE' })} aria-label="알림 닫기"><X size={16} /></button></div>}
    {modal === 'new' && <NewCase dispatch={dispatch} onClose={() => setModal(null)} onCreated={() => navigate('consultation')} />}
    {modal === 'guide' && <TestGuide dispatch={dispatch} onClose={() => setModal(null)} onScenario={() => navigate('documents')} />}
    {modal === 'reset' && <Modal title="데모 데이터를 초기화할까요?" onClose={() => setModal(null)}><p className="modal-description">이 브라우저에 저장한 상담, 추가 서류 정보, 검토 이력이 초기 예제 3건으로 바뀝니다. 내려받은 파일은 유지됩니다.</p><div className="modal-actions"><button className="button secondary" onClick={() => setModal(null)}>취소</button><button className="button danger" onClick={() => { fileUrls.current.forEach(url => URL.revokeObjectURL(url)); fileUrls.current = []; setFiles({}); Object.keys(localStorage).filter(key => key.startsWith('firmengine.lab.') || key.startsWith('firmengine-frontend-financial-demo')).forEach(key => localStorage.removeItem(key)); dispatch({ type: 'RESET_DEMO' }); setModal(null); navigate('overview'); }}>초기화</button></div></Modal>}
  </div>;
}

function Consultation({ current, dispatch, navigate }: { current: CaseRecord; dispatch: Dispatch; navigate: (page: Page) => void }) {
  const [text, setText] = useState(current.consultation);
  return <div className="content-columns"><section className="panel padded"><div className="panel-title"><MessageSquareText size={19} /><h2>상담 내용</h2><Badge tone="blue">상담 → 준비 서류</Badge></div><form onSubmit={e => { e.preventDefault(); dispatch({ type: 'UPDATE_CONSULTATION', caseId: current.id, text }); }}><label className="field"><span>사건명</span><input value={current.title} readOnly /></label><div className="form-row"><label className="field"><span>소득 유형</span><select value={current.incomeType} onChange={e => dispatch({ type: 'SET_INCOME_TYPE', caseId: current.id, incomeType: e.target.value as 'business' | 'salary' })}><option value="business">개인사업자</option><option value="salary">급여소득자</option></select></label><label className="field"><span>검토 관할 · 예제 설정</span><input value="서울회생법원 (데모)" readOnly /></label></div><label className="field"><span>상담 기록 · 보완 답변</span><textarea rows={8} value={text} onChange={e => setText(e.target.value)} placeholder="소득 형태, 자료 기간, 재산·채무 상황과 확인할 내용을 적어주세요." required /></label><p className="field-hint">테스트용 내용만 입력하세요. 변경하면 기존 문서는 다시 검토해야 합니다.</p><div className="form-actions"><button className="button primary" type="submit">상담 내용 저장 <Check size={16} /></button></div></form></section><aside className="panel padded"><div className="panel-title"><ListChecks size={19} /><h2>연결되는 준비 서류</h2></div><p className="muted body-small">소득 유형에 따라 필요한 자료가 달라집니다. 이 목록은 화면 테스트용 조건부 예제입니다.</p><div className="requirement-list">{requirementsFor(current).map(r => <div key={r.kind}><span className={`small-icon ${r.status === 'confirmed' ? 'green' : ''}`}>{r.status === 'confirmed' ? <Check size={16} /> : <FileText size={16} />}</span><div><strong>{r.label}</strong><p>{r.reason}</p></div></div>)}</div><button className="button secondary full" onClick={() => navigate('documents')}>준비 서류로 이동 <ArrowRight size={16} /></button></aside></div>;
}

function Documents({ current, role, dispatch, registerFile, files, navigate }: { current: CaseRecord; role: Role; dispatch: Dispatch; registerFile: (name: string, file: File) => void; files: Record<string, string>; navigate: (page: Page) => void }) {
  const [kind, setKind] = useState<DocumentKind>('income');
  const [pages, setPages] = useState(2);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<{ name: string; url?: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const upload = (list: FileList | null) => {
    if (!list) return;
    const errors: string[] = [];
    Array.from(list).forEach(file => {
      if (!/\.(pdf|png|jpe?g)$/i.test(file.name) || !['application/pdf', 'image/png', 'image/jpeg', ''].includes(file.type)) { errors.push(`${file.name}: PDF·JPG·PNG만 추가할 수 있습니다.`); return; }
      if (file.size > 20 * 1024 * 1024 || !file.size) { errors.push(`${file.name}: 빈 파일 또는 20MB 초과 파일입니다.`); return; }
      if (current.documents.some(d => d.name === file.name && d.status !== 'withdrawn')) { errors.push(`${file.name}: 이미 등록한 이름입니다.`); return; }
      registerFile(file.name, file); dispatch({ type: 'ADD_DOCUMENT', caseId: current.id, name: file.name, kind, pages });
    });
    setError(errors.join(' ')); if (input.current) input.current.value = '';
  };
  return <><div className="notice blue"><ShieldCheck size={18} /><span>파일은 서버로 전송하지 않습니다. 원문 미리보기는 현재 탭에서만 가능하며, 새로고침 후에는 파일명과 상태만 남습니다.</span></div><div className="content-columns documents-columns"><section className="panel padded"><div className="panel-title"><ListChecks size={19} /><h2>준비 서류 체크리스트</h2><span className="count-pill">{requirementsFor(current).length}</span></div><div className="checklist">{requirementsFor(current).map(r => <div className="checklist-item" key={r.kind}><span className={`check-circle ${r.status === 'confirmed' ? 'complete' : ''}`}>{r.status === 'confirmed' ? <Check size={16} /> : <FileText size={16} />}</span><div><strong>{r.label} <small>{r.required ? '필수' : '조건부·비해당'}</small></strong><p>{r.reason}</p><span className="metadata">대상: 신청인 · 기간: {r.kind === 'income' || r.kind === 'business' ? '최근 12개월 (예제)' : '최근 발급본 (예제)'}</span></div><Badge tone={r.status === 'confirmed' ? 'green' : r.status === 'uploaded' ? 'blue' : 'amber'}>{r.status === 'missing' ? '추가 제출' : statusNames[r.status]}</Badge></div>)}</div></section><section className="panel padded"><div className="panel-title"><UploadCloud size={19} /><h2>자료 추가</h2></div><label className="field"><span>자료 페이지 수 · 확인 후 입력</span><input type="number" min="1" max="200" value={pages} onChange={e => setPages(Number(e.target.value))} /></label><label className="field"><span>자료 종류</span><select value={kind} onChange={e => setKind(e.target.value as DocumentKind)}>{Object.entries(docNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg" multiple className="sr-only" aria-label="자료 파일 선택" onChange={e => upload(e.target.files)} /><button className={`dropzone ${dragging ? 'dragging' : ''}`} onClick={() => input.current?.click()} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); }}><span><UploadCloud size={26} /></span><strong>파일을 놓거나 클릭해 추가</strong><small>PDF, JPG, PNG · 파일당 최대 20MB</small><b>파일 선택</b></button>{error && <p className="inline-error" role="alert">{error}</p>}<div className="demo-extract"><Sparkles size={19} /><div><strong>파일 없이도 시험할 수 있어요</strong><p>합성 예제 자료와 추출 후보값을 추가합니다.<br />업로드 파일을 실제로 OCR 처리하지 않습니다.</p></div></div><button className="button secondary full" onClick={() => dispatch({ type: 'RUN_DEMO_EXTRACTION', caseId: current.id })}><Sparkles size={16} /> 예제 자료 · 추출값 불러오기</button></section></div><RequirementLinks current={current} role={role} dispatch={dispatch} /><section className="panel margin-top"><div className="panel-heading"><div><h2>수취 자료 <span className="count-pill">{current.documents.filter(d => d.status !== 'withdrawn').length}</span></h2><p>수취와 확인 완료는 서로 다른 상태입니다.</p></div>{role !== 'client' && <button className="button secondary" onClick={() => navigate('verification')}>추출값 검토 <ArrowRight size={15} /></button>}</div><div className="table-wrap"><table><thead><tr><th>파일명</th><th>종류</th><th>상태</th><th>작업</th></tr></thead><tbody>{current.documents.map(d => <tr key={d.id}><td><button className="file-link" onClick={() => setPreview({ name: d.name, url: documentUrl(current, d, files) })}><FileText size={19} /><span>{d.name}<small>{files[`${current.id}:${d.name}`] ? '로컬 원문 미리보기' : '예제 / 파일 메타데이터'}</small></span></button></td><td>{docNames[d.kind]}</td><td><Badge tone={d.status === 'confirmed' ? 'green' : 'neutral'}>{statusNames[d.status]}</Badge></td><td><div className="inline-actions">{role === 'staff' && d.status === 'uploaded' && <button className="button tiny secondary" onClick={() => dispatch({ type: 'CONFIRM_DOCUMENT', caseId: current.id, documentId: d.id })}>자료 확인</button>}{role === 'staff' && d.status !== 'withdrawn' && <button className="text-button muted" onClick={() => dispatch({ type: 'WITHDRAW_DOCUMENT', caseId: current.id, documentId: d.id })}>철회</button>}</div></td></tr>)}</tbody></table>{!current.documents.length && <Empty title="아직 추가한 자료가 없습니다">파일을 추가하거나 예제 자료를 불러오세요.</Empty>}</div></section>{preview && <Modal wide title={preview.name} onClose={() => setPreview(null)}>{preview.url ? <PdfWorkbench url={preview.url} name={preview.name} /> : <Empty title="저장된 원문 파일이 없습니다">합성 예제는 증빙 검토의 원문 발췌를 확인하세요. 직접 추가한 파일은 새로고침 후 다시 선택해야 합니다.</Empty>}</Modal>}</>;
}

function Verification({ current, role, dispatch, files, navigate }: { current: CaseRecord; role: Role; dispatch: Dispatch; files: Record<string, string>; navigate: (page: Page) => void }) {
  const [selectedKey, setSelectedKey] = useState(current.fields[0].key);
  const selected = current.fields.find(f => f.key === selectedKey)!;
  const sourceDoc = current.documents.find(d => d.id === selected.source?.documentId);
  const sourceUrl = sourceDoc && documentUrl(current, sourceDoc, files);
  const [acknowledged, setAcknowledged] = useState(false);
  return <><div className="notice amber"><CircleAlert size={18} /><span>원문을 읽을 수 없거나 값이 없으면 미확인으로 남깁니다. 0원 확정에도 사유가 필요합니다. 현재 추출값은 합성 예제입니다.</span></div>{role === 'staff' && <div className="bulk-review"><label><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} /> 정상 예제의 원문과 후보값을 대조했습니다.</label><button className="button primary" disabled={!acknowledged} onClick={() => { dispatch({type:'BULK_CONFIRM_SAFE',caseId:current.id,reason:'담당자가 합성 원문·정상 후보값을 대조하여 일괄 확인'}); setAcknowledged(false); }}><CheckCheck size={16}/> 정상 항목 한 번에 확인</button><small>충돌·누락·직접 수정한 값은 개별 확인으로 남습니다.</small></div>}<div className="verification-layout"><section className="panel"><div className="panel-heading"><h2>확인할 값 <span className="count-pill">{current.fields.filter(f => f.status !== 'confirmed').length}</span></h2><span className="muted body-small">단위: 원</span></div><div className="fact-list">{current.fields.map(field => <button key={field.key} className={`fact-row ${selectedKey === field.key ? 'selected' : ''}`} onClick={() => setSelectedKey(field.key)}><div><span>{field.label}</span><Badge tone={field.status === 'confirmed' ? 'green' : field.status === 'conflict' ? 'red' : 'amber'}>{statusNames[field.status]}</Badge></div><strong>{money(field.value)}</strong><small>{field.source ? `${current.documents.find(d => d.id === field.source?.documentId)?.name ?? '원문'} · ${field.source.page}쪽` : '연결된 원문 없음'}</small></button>)}</div></section><section className="panel padded evidence-detail"><div className="panel-title"><FileSearch size={19} /><h2>원문 대조 · {selected.label}</h2></div><div className="source-preview"><div className="source-bar"><FileText size={16} /><span>{sourceDoc?.name || '근거 자료 필요'}</span>{selected.source && <span>{selected.source.page}쪽</span>}</div>{sourceUrl ? <PdfWorkbench url={sourceUrl} name={sourceDoc!.name} initialPage={selected.source?.page} featureLabel={selected.label} onLinkPage={role === 'staff' ? page => dispatch({type:'SELECT_FIELD_SOURCE',caseId:current.id,key:selected.key,documentId:sourceDoc!.id,page,excerpt:selected.source?.excerpt || '직접 확인한 원문',reason:'PDF 뷰어에서 확인한 페이지 연결'}) : undefined} /> : <div className="source-paper"><span className="document-stamp">SYNTHETIC EVIDENCE</span><h3>{selected.label} 확인 자료</h3><div className="paper-rule" /><span className="source-caption">추출 위치의 원문 발췌 · 예시</span><blockquote>{selected.source?.excerpt || '이 항목의 근거 자료가 없습니다. 자료를 보완한 뒤 값을 확인하세요.'}</blockquote><div className="paper-lines"><i /><i /><i /></div><small>본 발췌는 화면 테스트를 위한 합성 자료입니다.</small></div>}</div>{selected.alternatives && selected.alternatives.length > 0 && <div className="conflict-box"><strong><CircleAlert size={16} /> 서로 다른 후보값이 있습니다</strong>{selected.alternatives.map((a, i) => <div key={i}><b>{money(a.value)}</b><span>{a.source.excerpt} · {a.source.page}쪽</span>{role === 'staff' && <button className="button tiny secondary" onClick={() => {dispatch({type:'SELECT_FIELD_SOURCE',caseId:current.id,key:selected.key,...a.source,reason:'상충 자료의 출처를 비교해 선택'});dispatch({type:'EDIT_FIELD',caseId:current.id,key:selected.key,value:a.value,reason:'상충 후보 중 선택한 근거의 금액. 담당자 확정 필요.'});}}>이 근거 선택</button>}</div>)}</div>}<SourceLinkEditor key={`source-${current.id}-${selected.key}-${selected.source?.documentId}-${selected.source?.page}`} current={current} field={selected} role={role} dispatch={dispatch}/><FieldEditor key={`${current.id}:${selected.key}:${selected.status}:${selected.value}:${current.revision}`} field={selected} role={role} current={current} dispatch={dispatch} /><div className="section-next"><button className="text-button" onClick={() => navigate('calculation')}>계산 상태 확인 <ArrowRight size={15} /></button></div></section></div></>;
}

function FieldEditor({ field, current, role, dispatch }: { field: EvidenceField; current: CaseRecord; role: Role; dispatch: Dispatch }) {
  const [value, setValue] = useState(field.value?.toString() ?? '');
  const [reason, setReason] = useState(field.reason || '');
  const [error, setError] = useState('');
  const changed = value !== (field.value?.toString() ?? '');
  function save(confirm: boolean) {
    const numeric = value.trim() === '' ? null : Number(value);
    if (numeric !== null && (!Number.isSafeInteger(numeric) || numeric < 0)) { setError('0 이상의 원 단위 정수를 입력하세요.'); return; }
    if (!reason.trim()) { setError('원문을 확인한 내용이나 정정 사유를 남겨주세요.'); return; }
    if (confirm && numeric === null) { setError('자료가 없으면 확정할 수 없습니다.'); return; }
    setError('');
    if (changed || !confirm || field.status === 'conflict') dispatch({ type: 'EDIT_FIELD', caseId: current.id, key: field.key, value: numeric, reason });
    if (confirm) dispatch({ type: 'CONFIRM_FIELD', caseId: current.id, key: field.key, reason });
  }
  return <div className="fact-editor"><div className="form-row"><label className="field"><span>확인 금액</span><div className="input-unit"><input aria-label={`${field.label} 확인 금액`} inputMode="numeric" value={value} onChange={e => setValue(e.target.value)} disabled={role !== 'staff'} placeholder="미확인" /><span>원</span></div></label><div className="field"><span>현재 확인 상태</span><div className="field-static"><Badge tone={field.status === 'confirmed' ? 'green' : 'amber'}>{statusNames[field.status]}</Badge></div></div></div><label className="field"><span>확인 · 정정 사유</span><textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="원문 금액과 대상 기간을 확인했습니다." disabled={role !== 'staff'} /></label>{error && <p className="inline-error" role="alert">{error}</p>}{role === 'staff' ? <div className="form-actions spread"><button className="text-button muted" onClick={() => { if (!reason.trim()) { setError('철회 사유를 입력하세요.'); return; } dispatch({ type: 'WITHDRAW_FIELD', caseId: current.id, key: field.key, reason }); }}><RotateCcw size={14} /> 값 철회</button><div className="inline-actions"><button className="button secondary" onClick={() => save(false)}>후보값 저장</button><button className="button primary" onClick={() => save(true)}><Check size={16} /> 값 확정</button></div></div> : <p className="field-hint">값 확정은 법무법인 담당자 화면에서 진행합니다.</p>}</div>;
}

function Calculation({ current, role, dispatch, navigate }: { current: CaseRecord; role: Role; dispatch: Dispatch; navigate: (page: Page) => void }) {
  const ready = deriveReadiness(current), calculation = ready.calculation;
  const val = (key: string) => current.fields.find(f => f.key === key)?.value;
  return <><div className="notice blue"><FlaskConical size={18} /><span>예시 산식 DEMO-1로 화면 흐름을 시험합니다. 실제 법률 기준·생계비·채권자 배분을 적용한 변제계획이 아닙니다.</span></div><div className="content-columns"><section className="panel padded"><div className="panel-title"><Calculator size={19} /><h2>월별 변제 예산</h2><Badge tone={ready.canCalculate ? 'green' : 'amber'}>{ready.canCalculate ? '예제 계산 가능' : '확인 대기'}</Badge></div><div className="calculation-rows">{[['월 수입', val('income'), '+'], ['인정 사업 경비', val('expenses'), '−'], ['예제 생계비', val('livingCost'), '−']].map(([name, value, sign]) => <div key={String(name)}><span><i>{String(sign)}</i>{name}</span><strong>{money(value as number | null)}</strong></div>)}<div className="sum-row"><span>월 가용소득</span><strong>{money(calculation?.disposableIncome)}</strong></div></div><label className="field"><span>변제기간 · 테스트 변수</span><select aria-label="변제기간" value={current.months} onChange={e => dispatch({ type: 'SET_MONTHS', caseId: current.id, months: Number(e.target.value) as 36 | 48 | 60 })} disabled={role !== 'staff'}><option value="36">36개월</option><option value="48">48개월</option><option value="60">60개월</option></select></label><div className="formula"><span>예제 계산식</span><code>월 가용소득 = 수입 − 경비 − 생계비</code><code>총 변제액 = min(채무, 월 가용소득 × 기간)</code><code>월 변제액 = min(max(0, 가용소득), ceil(채무 ÷ 기간))</code></div><p className="field-hint">재산은 별도 참고값입니다. 재산 청산가치·우선채권·수수료·채권자별 배분은 이 데모 계산에 포함하지 않습니다.</p></section><section className="panel padded"><div className="panel-title"><Wallet size={19} /><h2>계산 결과</h2></div>{calculation ? <><div className="result-hero"><span>예제 월 변제액</span><strong>{money(calculation.monthlyPayment)}</strong><small>{current.months}개월 기준 · 마지막 회차 정산 전 예시</small></div><div className="result-items"><div><span>총 채무</span><strong>{money(calculation.debt)}</strong></div><div><span>예제 총 변제액</span><strong>{money(calculation.totalRepayment)}</strong></div><div><span>계산상 잔여 채무</span><strong>{money(calculation.remainingDebt)}</strong></div><div><span>재산 참고값</span><strong>{money(calculation.assets)}</strong></div></div><div className="coverage"><div style={{ width: `${calculation.debt ? Math.min(100, calculation.totalRepayment / calculation.debt * 100) : 0}%` }} /></div><p className="field-hint">잔여 채무 표시는 면책 여부나 인가 가능성을 뜻하지 않습니다.</p></> : <><Empty title="확정할 값이 남아 있습니다">미확인 값을 0으로 계산하지 않습니다. 증빙 검토에서 값을 확정하면 결과가 표시됩니다.</Empty><ul className="issue-list">{ready.fieldIssues.map(issue => <li key={issue}><CircleAlert size={14} />{issue}</li>)}</ul></>}<button className="button secondary full" onClick={() => navigate(calculation ? 'drafts' : 'verification')}>{calculation ? '문서 작성 조건 확인' : '증빙 검토로 이동'}<ArrowRight size={16} /></button></section></div></>;
}

function Drafts({ current, role, dispatch, navigate, blockers }: { current: CaseRecord; role: Role; dispatch: Dispatch; navigate: (page: Page) => void; blockers: string[] }) {
  const ready = deriveReadiness(current);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const snapshot = current.generated.find(g => g.id === snapshotId) || current.generated[current.generated.length - 1];
  const [downloadError, setDownloadError] = useState('');
  const download = (format: 'html' | 'json') => { if (!snapshot) return; try { downloadSnapshot(snapshot, format); setDownloadError(''); } catch { setDownloadError('파일을 만들지 못했습니다. 브라우저 다운로드 설정을 확인하세요.'); } };
  return <><div className="content-columns draft-layout"><section className="panel padded"><div className="panel-title"><ShieldCheck size={19} /><h2>작성 · 검토 조건</h2></div><div className="gate-list">{blockers.map(b => <div key={b}><CircleAlert size={17} className="text-amber" /><span>{b}<button className="text-button" onClick={() => navigate('legal')}>검토로 이동</button></span></div>)}<div><span className={`check-circle ${!ready.missingDocuments.length ? 'complete' : ''}`}><Check size={15} /></span><span>필수 서류 확인<small>{ready.missingDocuments.length ? ready.missingDocuments.join(', ') : '자료 확인 완료'}</small></span></div><div><span className={`check-circle ${!ready.fieldIssues.length ? 'complete' : ''}`}><Check size={15} /></span><span>계산 입력값 확정<small>{ready.fieldIssues.length ? `${ready.fieldIssues.length}개 항목 확인 필요` : '필수값 확정 완료'}</small></span></div><div><span className={`check-circle ${snapshot && !snapshot.invalidated && snapshot.staffReviewed ? 'complete' : ''}`}><Check size={15} /></span><span>담당자 생성본 확인<small>생성된 내용과 근거 대조</small></span></div><div><span className={`check-circle ${snapshot && !snapshot.invalidated && snapshot.lawyerReviewed ? 'complete' : ''}`}><Check size={15} /></span><span>변호사 최종 확인<small>선택한 생성본에 대한 모의 검토</small></span></div></div><button className="button primary full" disabled={!ready.canGenerate || role !== 'staff' || blockers.length > 0} onClick={() => { setSnapshotId(null); dispatch({ type: 'GENERATE_DRAFT', caseId: current.id }); }}><Sparkles size={16} /> 새 검토용 초안 생성</button>{!ready.canGenerate && <button className="text-button margin-top" onClick={() => navigate(ready.missingDocuments.length ? 'documents' : 'verification')}>미해결 항목 확인 <ArrowRight size={14} /></button>}{role !== 'staff' && <p className="field-hint">초안 생성은 담당자 화면에서 가능합니다.</p>}<div className="version-heading"><h3>생성 이력</h3><span>{current.generated.length}개 버전</span></div><div className="version-list">{[...current.generated].reverse().map((g, index) => <button key={g.id} className={snapshot?.id === g.id ? 'selected' : ''} onClick={() => setSnapshotId(g.id)}><FileText size={17} /><span>생성본 {current.generated.length - index}<small>사건 버전 {g.revision} · {g.invalidated ? '재검토 필요' : g.lawyerReviewed ? '모의 검토 완료' : g.staffReviewed ? '변호사 확인 대기' : '미검토 초안'}</small></span><ChevronRight size={14} /></button>)}</div></section><section className="panel document-panel"><div className="panel-heading"><div><h2>검토용 보고서</h2><p>미리보기와 다운로드는 같은 생성본을 사용합니다.</p></div><Badge tone="neutral">HTML / JSON</Badge></div>{snapshot ? <><div className="document-toolbar"><Badge tone={snapshot.invalidated ? 'amber' : snapshot.lawyerReviewed ? 'green' : 'neutral'}>{snapshot.invalidated ? '변경 전 생성본 · 재검토 필요' : snapshot.lawyerReviewed ? '모의 검토 완료' : '미검토 초안'}</Badge><div className="inline-actions"><button className="button tiny secondary" onClick={() => download('html')}><ArrowDownToLine size={14} /> 보고서</button><button className="button tiny secondary" onClick={() => download('json')}>JSON</button></div></div><div className="document-preview"><div className="document-paper"><div className="doc-brand">FIRMENGINE <span>WORKING PAPER</span></div><p className="doc-kicker">개인회생 업무 · 로컬 테스트</p><h2>{snapshot.payload.title}</h2><p className="doc-subtitle">검토용 사건 요약 · 사건 버전 {snapshot.revision}</p><div className="document-watermark">합성 예제 · 법원 제출용 아님</div><h3>01. 상담 기록</h3><p className="document-consultation">{snapshot.payload.consultation}</p><h3>검토 문구</h3><p className="document-consultation">{snapshot.payload.narrative || '별도 작성한 문구가 없습니다.'}</p><h3>02. 확인한 입력값</h3><table><tbody>{snapshot.payload.fields.map(f => <tr key={f.key}><td>{f.label}</td><td>{money(f.value)}</td></tr>)}</tbody></table><h3>03. 예제 계산</h3><p>변제기간 {snapshot.payload.months}개월 · 예제 월 변제액 <strong>{money(snapshot.payload.calculation?.monthlyPayment)}</strong></p><p className="doc-footnote">DEMO-1 단순 산식. 실제 법률 기준과 공식 법원 서식을 적용하지 않았습니다. 원문 근거와 검토 사유는 다운로드 보고서에 포함됩니다.</p></div></div><DraftEditor key={snapshot.id} snapshot={snapshot} current={current} role={role} dispatch={dispatch} onSaved={() => setSnapshotId(null)}/><div className="review-actions"><p>{snapshot.invalidated ? '사건 내용이 변경되었습니다. 새 초안을 생성하고 다시 검토하세요.' : snapshot.lawyerReviewed ? '모의 검토가 완료되었습니다. 실제 제출·접수 상태는 변경되지 않습니다.' : '역할을 전환하여 담당자 확인 → 변호사 확인 순서를 시험하세요.'}</p><div className="inline-actions"><button className="button secondary" disabled={role !== 'staff' || snapshot.invalidated || snapshot.staffReviewed || blockers.length > 0} onClick={() => dispatch({ type: 'REVIEW_STAFF', caseId: current.id, snapshotId: snapshot.id })}><Check size={16} /> 담당자 확인</button><button className="button primary" disabled={role !== 'lawyer' || snapshot.invalidated || !snapshot.staffReviewed || snapshot.lawyerReviewed || blockers.length > 0} onClick={() => dispatch({ type: 'REVIEW_LAWYER', caseId: current.id, snapshotId: snapshot.id })}><CheckCheck size={16} /> 변호사 모의 확인</button></div>{downloadError && <p className="inline-error" role="alert">{downloadError}</p>}</div></> : <Empty title="아직 생성한 초안이 없습니다">필수 서류와 입력값을 확인한 뒤 검토용 초안을 생성하세요. 실제 DOCX·XLSX 생성은 기존 AX 연동 범위입니다.</Empty>}</section></div></>;
}

function Activity({ current, role, navigate }: { current: CaseRecord; role: Role; navigate: (page: Page) => void }) {
  const [tab, setTab] = useState('open');
  return <div className="content-columns"><section className="panel"><div className="panel-heading"><div><h2>담당자 작업</h2><p>자료와 확인 상태에서 연결되는 할 일입니다.</p></div><ListChecks size={20} /></div><div className="padded compact"><div className="segmented">{[['open', '미완료'], ['done', '완료']].map(([id, name]) => <button key={id} className={tab === id ? 'selected' : ''} onClick={() => setTab(id)}>{name} <span>{current.tasks.filter(t => t.status === id).length}</span></button>)}</div></div><div className="task-list">{current.tasks.filter(t => t.status === tab).map(t => <button key={t.id} onClick={() => navigate(role === 'client' ? 'documents' : ['draft','staff-review','lawyer-review'].includes(t.id) ? 'drafts' : t.label.includes('서류') || t.label.includes('자료') ? 'documents' : 'verification')}><span className={`check-circle ${t.status === 'done' ? 'complete' : ''}`}>{t.status === 'done' ? <Check size={15} /> : <Clock3 size={15} />}</span><span><strong>{t.label}</strong><small>{roleNames[t.owner]} · {t.status === 'done' ? '완료' : '확인 필요'}</small></span><ArrowUpRight size={15} /></button>)}</div>{!current.tasks.some(t => t.status === tab) && <Empty title={tab === 'open' ? '남은 작업이 없습니다' : '완료한 작업이 없습니다'}>서류와 값을 확인하면 관련 작업 상태가 갱신됩니다.</Empty>}</section><section className="panel padded"><div className="panel-title"><History size={19} /><h2>변경 이력</h2><span className="count-pill">{current.history.length}</span></div><div className="timeline">{[...current.history].reverse().map(h => <div key={h.id}><span className="timeline-dot" /><div><div className="timeline-heading"><strong>{h.action}</strong><small>v{h.revision}</small></div><p>{h.detail}</p><small>{roleNames[h.role]}</small></div></div>)}</div>{!current.history.length && <Empty title="아직 변경 이력이 없습니다">상담 저장과 자료 검토를 시작해보세요.</Empty>}</section></div>;
}

function NewCase({ dispatch, onClose, onCreated }: { dispatch: Dispatch; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState(''); const [text, setText] = useState(''); const [incomeType, setIncomeType] = useState<'business' | 'salary'>('business');
  return <Modal title="새 테스트 사건 접수" onClose={onClose}><p className="modal-description">가상의 의뢰인으로 상담과 자료 보완 흐름을 시험합니다.</p><form onSubmit={e => { e.preventDefault(); if (!title.trim()) return; dispatch({ type: 'CREATE_CASE', scenario: 'missing', title: title.trim(), text: text.trim(), incomeType }); onClose(); onCreated(); }}><label className="field"><span>사건명 <b>*</b></span><input required maxLength={50} autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 테스트 상점 · 개인회생" /></label><label className="field"><span>소득 유형</span><select value={incomeType} onChange={e => setIncomeType(e.target.value as 'salary' | 'business')}><option value="business">개인사업자</option><option value="salary">급여소득자</option></select></label><label className="field"><span>상담 내용</span><textarea rows={4} value={text} onChange={e => setText(e.target.value)} placeholder="테스트할 상황과 준비된 자료를 입력하세요." /></label><p className="field-hint">새 사건에는 누락 시나리오의 합성 값과 자료가 포함됩니다.</p><div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>취소</button><button type="submit" className="button primary">사건 만들기 <ArrowRight size={16} /></button></div></form></Modal>;
}

function SourceLinkEditor({ current, field, role, dispatch }: {current: CaseRecord; field: EvidenceField; role: Role; dispatch: Dispatch}) {
  const [doc, setDoc] = useState(field.source?.documentId || '');
  const [page, setPage] = useState(field.source?.page || 1);
  const [excerpt, setExcerpt] = useState(field.source?.excerpt || '');
  const [reason, setReason] = useState('');
  if (role !== 'staff') return null;
  return <details className="source-link-editor"><summary>다른 자료 · 페이지를 근거로 연결</summary><form onSubmit={e => {e.preventDefault(); dispatch({type:'SELECT_FIELD_SOURCE',caseId:current.id,key:field.key,documentId:doc,page,excerpt,reason});}}><div className="form-row"><label className="field"><span>원문 자료</span><select required value={doc} onChange={e => setDoc(e.target.value)}><option value="">자료 선택</option>{current.documents.filter(d => d.status !== 'withdrawn').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label className="field"><span>페이지</span><input required min={1} max={current.documents.find(d => d.id === doc)?.pages || 200} type="number" value={page} onChange={e => setPage(Number(e.target.value))}/></label></div><label className="field"><span>직접 확인한 원문 발췌</span><textarea required rows={2} value={excerpt} onChange={e => setExcerpt(e.target.value)}/></label><label className="field"><span>연결 사유</span><input required value={reason} onChange={e => setReason(e.target.value)}/></label><button className="button secondary" type="submit"><Link2 size={14}/> 근거 연결</button></form></details>;
}

function DraftEditor({snapshot,current,role,dispatch,onSaved}: {snapshot: GeneratedSnapshot; current: CaseRecord; role: Role; dispatch: Dispatch; onSaved:()=>void}) {
  const [text, setText] = useState(snapshot.payload.narrative || '');
  const [reason, setReason] = useState('');
  const previous = [...current.generated].reverse().find(g => g.id !== snapshot.id);
  return <details className="draft-editor"><summary>문구 편집 · 이전 생성본 비교</summary><div className="draft-compare"><div><strong>이전 생성본</strong><p>{previous?.payload.narrative || '이전 문구 없음'}</p></div><div><strong>선택한 생성본</strong><p>{snapshot.payload.narrative || '작성한 문구 없음'}</p></div></div>{previous && <table><thead><tr><th>금액 항목</th><th>이전 생성본</th><th>선택한 생성본</th></tr></thead><tbody>{snapshot.payload.fields.map(f => <tr key={f.key}><td>{f.label}</td><td>{money(previous.payload.fields.find(p => p.key === f.key)?.value)}</td><td>{money(f.value)}</td></tr>)}</tbody></table>}<form onSubmit={e => {e.preventDefault();dispatch({type:'EDIT_DRAFT_TEXT',caseId:current.id,snapshotId:snapshot.id,text,reason});onSaved();}}><label className="field"><span>검토용 문구 · 금액 변경은 증빙 검토에서 진행</span><textarea required rows={4} value={text} onChange={e => setText(e.target.value)} disabled={role === 'client' || snapshot.invalidated}/></label><label className="field"><span>수정 사유</span><input required value={reason} onChange={e => setReason(e.target.value)} disabled={role === 'client' || snapshot.invalidated}/></label><button className="button secondary" disabled={role === 'client' || snapshot.invalidated} type="submit">새 판본으로 저장</button></form></details>;
}

function TestGuide({ dispatch, onClose, onScenario }: { dispatch: Dispatch; onClose: () => void; onScenario: () => void }) {
  return <Modal wide title="업무 흐름 테스트 가이드" onClose={onClose}><p className="modal-description">AX v44와 기능분석서 F1–F6를 참고한 독립 프론트엔드입니다. 실제 인증·OCR·법률 판단·법원 제출은 연결하지 않습니다.</p><div className="scenario-grid">{[
    { id: 'normal', label: '정상 흐름', icon: CircleCheck, text: '자료와 값을 확인하고, 초안 생성 → 담당자 → 변호사 검토를 완료합니다.' },
    { id: 'missing', label: '자료 누락', icon: Files, text: '미확인 값을 0으로 처리하지 않고, 자료를 보완할 때까지 작성을 보류합니다.' },
    { id: 'conflict', label: '금액 충돌', icon: CircleAlert, text: '서로 다른 후보값을 대조하고, 정정 사유와 인정 금액을 확정합니다.' },
  ].map(s => <button key={s.id} className="scenario-card" onClick={() => { dispatch({ type: 'CREATE_CASE', scenario: s.id as Scenario }); onClose(); onScenario(); }}><s.icon size={23} /><strong>{s.label}</strong><p>{s.text}</p><span>예제 사건 추가 <ArrowRight size={15} /></span></button>)}</div><div className="guide-steps"><h3>이 순서로 눌러보세요</h3><ol><li>상단의 역할을 <b>의뢰인</b>으로 바꾸고 상담 내용을 저장합니다.</li><li><b>준비 서류</b>에서 예제 자료를 불러오거나 로컬 파일을 추가합니다.</li><li><b>담당자</b>로 전환하고 각 자료를 확인한 뒤, 증빙 검토에서 사유를 적고 값을 확정합니다.</li><li>계산 화면에서 기간을 변경하고 문서 화면에서 새 초안을 생성합니다.</li><li>담당자 확인 후 <b>변호사</b>로 바꾸어 모의 확인하고 보고서를 내려받습니다.</li><li>담당자로 돌아가 금액을 정정합니다. 이전 생성본이 재검토 상태가 되는지 확인합니다.</li></ol></div><div className="notice neutral"><ShieldCheck size={18} /><span>상담·메타데이터·검토 상태는 이 브라우저에 저장됩니다. 파일 원문은 현재 탭 메모리에만 남습니다. 테스트에는 가상 자료를 사용하세요.</span></div><div className="modal-actions"><button className="button primary" onClick={onClose}>시작하기 <ArrowRight size={16} /></button></div></Modal>;
}
