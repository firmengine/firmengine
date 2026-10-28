import {catalog,hydrate,linked,itemStatus,invalidate,bind,mark,addField,docPending} from './review.mjs';
import {stages,demo,approve,revise,canEdit,needsReview} from './domain.mjs';
import {classifyPage,extractFieldValue,groupClassifiedPages} from './local-analysis.mjs';
import {createLocalReader} from './local-reader.mjs';
import {renderConsultations,setupConsultations} from './consultations.mjs';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key='jiyeol-office-ui-v1';let state={cases:[demo()],selected:'DEMO-001',role:'staff'};
try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&Array.isArray(saved.cases))state=saved;}catch{}
state.cases.forEach(hydrate);
const initialReview=state.cases.find(x=>x.id===state.selected)?.reviewSelection;
let selectedType=initialReview?.type||'D06',selectedDoc=initialReview?.doc||'',docSearch='',docGroup='all',docStatus='all',expandedStatus='';
let view=location.hash.slice(1)||'dashboard',query='',uploading=false,replacementDocId='';
let attachmentDb,pdfLibrary,sharedPdfWorker;const previewUrls=new Map(),pdfViews=new Map();
const nav=[['dashboard','▦','업무 현황'],['cases','☷','전체 사건'],['workflow','⇄','상담 이력'],['documents','▤','자료·OCR 검수'],['approvals','✓','문서·승인'],['corrections','◷','보정·기한'],['audit','≡','변경 이력'],['runtime','⚙','운영 상태']];
const c=()=>state.cases.find(x=>x.id===state.selected)||state.cases[0];
function save(){try{localStorage.setItem(key,JSON.stringify(state));return true;}catch{toast('브라우저 저장 실패. 저장 공간과 설정을 확인하세요.');return false;}}
function toast(t){$('#toast').textContent=t;$('#toast').hidden=false;clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').hidden=true,4200);}
function log(text){c().logs.unshift({at:new Date().toISOString(),actor:actor(),text});save();}
function actor(){return state.role==='master'?'대표 변호사':'배지열';}
function ensureEdit(){if(!c()||!canEdit(c(),state.role)){toast('배정된 사건만 수정할 수 있습니다.');return false;}return true;}
function modal(title,body,submit,label='저장'){ $('#dialog-content').innerHTML=`<h2>${esc(title)}</h2><form>${body}<p id="form-error" class="reason" role="alert"></p><div class="actions"><button type="button" class="btn" id="cancel">취소</button><button class="btn primary">${esc(label)}</button></div></form>`;$('#dialog').showModal();$('#cancel').onclick=()=>$('#dialog').close();$('#dialog form').onsubmit=e=>{e.preventDefault();try{const values=Object.fromEntries(new FormData(e.target));for(const element of e.target.querySelectorAll('[required]')){if(typeof element.value==='string'&&!element.value.trim())throw Error('필수 항목을 입력하세요.');}submit(values);$('#dialog').close();save();render();}catch(err){$('#form-error').textContent=err.message;}};}
const field=(name,label,value='',type='text')=>`<label class="field">${esc(label)}${type==='textarea'?`<textarea name="${name}" required>${esc(value)}</textarea>`:`<input name="${name}" type="${type}" value="${esc(value)}" required>`}</label>`;
const badge=(text,cls='blue')=>`<span class="badge ${cls}">${esc(text)}</span>`;
const button=(act,text,primary=false,extra='')=>`<button class="btn ${primary?'primary':''}" data-action="${act}" ${extra}>${text}</button>`;
function head(title,sub,actions=''){return `<div class="page-head"><div><div class="eyebrow">OFFICE WORKSPACE</div><h1>${title}</h1><p class="sub">${sub}</p></div><div class="row">${actions}</div></div>`;}
function panel(title,body,extra=''){return `<section class="panel"><div class="panel-head"><h2>${title}</h2>${extra}</div>${body}</section>`;}
function context(){return `<div class="panel"><div class="panel-body row between"><div><strong>${esc(c().name)}</strong><span class="sub"> &nbsp; ${esc(c().id)} · 담당 ${esc(c().owner)} · v${c().version}</span>${c().birthDate||c().phone?`<div class="sub">${esc(c().birthDate||'생년월일 미입력')} · ${esc(c().phone||'전화번호 미입력')}</div>`:''}</div><select class="input" id="case-select" aria-label="사건 선택">${state.cases.map(x=>`<option value="${esc(x.id)}" ${x.id===c().id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div></div>`;}
function steps(){return `<div class="steps">${stages.map((s,i)=>`<button class="step ${i===c().stage?'active':i<c().stage?'done':''}" data-action="stage" data-index="${i}"><span>${i<c().stage?'✓':String(i+1).padStart(2,'0')}</span>${s}</button>`).join('')}</div>`;}
function caseTable(){const rows=state.cases.filter(x=>`${x.name} ${x.id} ${x.owner} ${x.birthDate||''} ${x.phone||''}`.includes(query));return `<div class="table-scroll"><table><thead><tr><th>사건 / 의뢰인</th><th>현재 단계</th><th>담당자</th><th>서류</th><th>확인 상태</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr class="clickable" data-case="${esc(x.id)}"><td><strong>${esc(x.name)}</strong><div class="sub">${esc(x.id)}</div>${x.birthDate||x.phone?`<div class="sub">${esc(x.birthDate||'생년월일 미입력')} · ${esc(x.phone||'전화번호 미입력')}</div>`:''}</td><td>${badge(stages[x.stage])}</td><td>${esc(x.owner)}</td><td>${x.documents.length}건</td><td>${badge(x.approved?'검수 확정':`${x.fields.filter(f=>f.status==='pending').length}항목 확인`,x.approved?'green':'orange')}</td><td>열기 ›</td></tr>`).join('')||'<tr><td colspan="6" class="empty">검색 결과가 없습니다.</td></tr>'}</tbody></table></div>`;}
function dashboard(){const pending=state.cases.reduce((n,x)=>n+x.fields.filter(f=>f.status==='pending').length,0);return head('업무 현황','사건별 진행 상황과 지금 확인할 일을 한곳에서 관리합니다.',button('new','＋ 새 사건',true))+`<div class="stats">${[['전체 사건',state.cases.length,'등록된 사건'],['진행 중',state.cases.filter(x=>x.stage<7).length,'업무 단계 진행'],['확인 필요',pending,'추출 항목 검수'],['검수 확정',state.cases.filter(x=>x.approved).length,'담당자 확인 완료']].map(([a,b,d])=>`<div class="stat"><div class="label">${a}</div><strong>${b}<small> 건</small></strong><small>${d}</small></div>`).join('')}</div><div class="hero"><div><div class="eyebrow">NEXT ACTION</div><h2>${pending?'원문 대조가 필요한 항목을 확인하세요.':'사건 자료를 등록하고 다음 업무를 시작하세요.'}</h2><p>추출값과 요약을 검토하고, 미해결 항목은 사유를 남긴 뒤 확정합니다.</p></div><a class="btn primary" href="#documents">자료 검수 열기 →</a></div><div class="columns"><div>${panel('최근 사건',caseTable(),'<a class="sub" href="#cases">전체 보기 →</a>')}</div><div>${panel('업무 진행 순서',`<div class="panel-body workflow-list">${stages.map((s,i)=>`<div class="list-item"><span class="num">${String(i+1).padStart(2,'0')}</span><div><strong>${s}</strong><p>${['신청정보 저장 · 담당 배정','상담 기록 · 계약 · 사건 개설','필요서류 · 업로드 · 분류 · OCR','원문 대조 · 사실 확정 · 계산','신청서 초안 · 검수 · 승인','사람이 직접 제출 · 접수 기록','요구사항 · 자료 보완 · 답변 검토','기한 · 개시 · 인가 · 변제'][i]}</p></div></div>`).join('')}</div>`)}</div></div>`;}
function workflow(){return renderConsultations(c(),context());}
function documents(){
 hydrate(c());const current=catalog.find(x=>x.id===selectedType)||catalog[0];
 const docs=linked(c(),current.id);const d=docs.find(x=>x.id===selectedDoc)||docs[0];selectedDoc=d?.id||'';c().reviewSelection={type:current.id,doc:selectedDoc};save();
 const visible=catalog.filter(x=>(docGroup==='all'||x.group===docGroup)&&(docStatus==='all'||itemStatus(c(),x.id)===docStatus)&&`${x.name} ${x.group} ${x.fields.join(' ')}`.includes(docSearch));
 const opts=(values,selected)=>values.map(x=>`<option value="${esc(x)}" ${x===selected?'selected':''}>${esc(x==='all'?'전체':x)}</option>`).join('');
 const fieldRows=d?c().fields.map((f,i)=>({f,i})).filter(({f})=>f.docId===d.id):[];
 return head('자료 수집 · OCR 검수','전체 서류 체크리스트에서 누락을 확인하고 문서별로 검수합니다.')+context()+
 `<div class="notice">시험자료 기반 입력 증빙 ${catalog.filter(x=>x.role==='evidence').length}종 · 대조용 자료 ${catalog.filter(x=>x.role==='reference').length}종. 모든 사건의 법정 필수서류를 뜻하지 않습니다. 추출 항목은 설계 후보입니다.</div>`+
 `<div class="stats">${['미제출','검수중','추가 검수 필요','검수 완료'].map(status=>`<div class="stat ${expandedStatus===status?'stat-open':''}"><div class="label">${status}</div><button class="stat-count" data-action="status-list" data-status="${status}" aria-label="${status} 서류 목록" aria-expanded="${expandedStatus===status}" aria-controls="status-document-list"><strong>${catalog.filter(x=>itemStatus(c(),x.id)===status).length}<small> 종</small></strong></button></div>`).join('')}</div>`+
 (expandedStatus?`<section id="status-document-list" class="panel status-document-list"><div class="panel-head"><h2>${esc(expandedStatus)} 서류</h2>${button('close-status-list','닫기')}</div><div class="status-items">${catalog.filter(x=>itemStatus(c(),x.id)===expandedStatus).map(x=>`<button class="status-document-item" data-action="jump-checklist" data-id="${x.id}"><span><small>${esc(x.group)}</small><strong>${esc(x.name)}</strong></span><span>${linked(c(),x.id).length}건 · 체크리스트로 이동 →</span></button>`).join('')||'<p class="empty">해당 상태의 서류가 없습니다.</p>'}</div></section>`:'')+
 `<input id="files" type="file" accept=".pdf,.jpg,.jpeg,.png" multiple hidden><div id="file-drop" class="drop file-drop"><span class="drop-symbol" aria-hidden="true">＋</span><strong>여기에 파일을 끌어놓으세요</strong><span>여러 파일을 한 번에 등록하거나 아래 버튼으로 선택하세요</span><button type="button" class="btn primary" data-action="upload" ${uploading?'disabled':''}>${uploading?'첨부파일 저장 중…':'＋ 자료 추가'}</button><small>파일과 한글 OCR은 이 PC에서 처리 · 외부 전송 없음</small>${attachmentList()}</div>`+
 panel('전체 서류 체크리스트',`<div class="toolbar"><input id="doc-search" placeholder="서류명·추출 항목 검색" aria-label="서류 검색" value="${esc(docSearch)}"><select id="doc-group" class="input" aria-label="서류 분류 필터">${opts(['all',...new Set(catalog.map(x=>x.group))],docGroup)}</select><select id="doc-status" class="input" aria-label="서류 상태 필터">${opts(['all','미제출','검수중','추가 검수 필요','검수 완료'],docStatus)}</select>${button('auto-classify','자동 분류 실행',true)}</div><div class="checklist-scroll"><table><thead><tr><th>구분</th><th>서류 종류</th><th>파일 수</th><th>제출·검수 상태</th><th></th></tr></thead><tbody>${visible.map(x=>`<tr data-catalog-id="${x.id}" class="${x.id===current.id?'selected-row':''}"><td>${esc(x.group)}<div class="sub">${x.role==='reference'?'기존 작성본 · 대조용':'입력 증빙'}</div>${itemStatus(c(),x.id)==='해당 없음'?badge('적용 제외'):''}</td><td><strong>${esc(x.name)}</strong><div class="sub">시험자료 ${esc(x.pages)}쪽</div>${c().checklist[x.id].reason?`<div class="sub">사유: ${esc(c().checklist[x.id].reason)}</div>`:''}</td><td>${linked(c(),x.id).length}건</td><td>${badge(itemStatus(c(),x.id)==='해당 없음'?'—':itemStatus(c(),x.id),itemStatus(c(),x.id)==='검수 완료'?'green':itemStatus(c(),x.id)==='미제출'?'orange':'blue')}</td><td class="checklist-actions">${button('select-type','열기',false,`data-id="${x.id}"`)} ${button('item-status','상태',false,`data-id="${x.id}"`)} ${button('reclassify','재분류',false,`data-id="${x.id}" ${linked(c(),x.id).length?'':'disabled'}`)} ${button('edit-document','수정',false,`data-id="${x.id}" ${linked(c(),x.id).length?'':'disabled'}`)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">검색 결과가 없습니다.</td></tr>'}</tbody></table></div>`,badge(`${visible.length} / ${catalog.length}종`))+
 c().documents.filter(x=>x.catalogId).map(documentDetail).join('')+
 `<div class="summary-comparison">${panel('신청 사연 원문',`<div class="panel-body">${c().documents.filter(x=>x.type?.includes('진술서')).map(x=>`<p><strong>${esc(x.name)}</strong></p>${sourcePreview(x)}`).join('')||'<div class="empty">신청 사연 원문이 없습니다. 진술서를 등록하면 이곳에서 확인할 수 있습니다.</div>'}</div>`)}${panel('신청 사연 · 사건 정리문',`<div class="panel-body"><p class="sub">문서별 요약과 별도로 Word에 반영할 사건 정리문입니다.</p><textarea id="summary" aria-label="사건 정리문">${esc(c().summary)}</textarea><div class="row between" style="margin-top:12px">${badge(c().summaryApproved?'정리문 확인 완료':'정리문 확인 필요')}<div class="row">${button('summary-save','수정 저장')}${button('summary-confirm','정리문 확인',true)}</div></div></div>`)}</div>`;
}
function documentDetail(d){
 const item=catalog.find(x=>x.id===d.catalogId);
 const fields=c().fields.map((f,i)=>({f,i})).filter(({f})=>f.docId===d.id);
 return `<section class="document-review" data-doc-id="${esc(d.id)}" id="document-${esc(d.id)}">${panel(esc(item.name),`<div class="panel-body row between"><div><strong>${esc(d.name)}</strong><p class="sub">${esc(d.type)} · ${esc(d.pages)}쪽</p></div>${badge(itemStatus(c(),item.id))}</div>`)}
 <div class="document-comparison">${panel(esc(item.name)+' 원문',`<div class="panel-body"><p><strong>${esc(d.name)}</strong></p><p class="sub">${esc(d.type)} · ${esc(d.pages)}쪽</p>${sourcePreview(d)}</div>`)}<div class="document-results">${panel('추출 항목',`<div class="panel-body">${fields.map(({f,i})=>`<div class="field-review"><div class="row between"><strong>${esc(f.label)}</strong>${badge(f.status==='confirmed'?'확인 완료':f.status==='exception'?'예외 승인':'확인 필요',f.status==='confirmed'?'green':'orange')}</div><input readonly value="${esc(f.value)}" aria-label="${esc(f.label)}"><p class="sub">${esc(f.source)}</p><p class="reason">${esc(f.reason)}</p><div class="row">${button('edit','수정',false,`data-index="${i}"`)}${button('confirm','확인',false,`data-index="${i}"`)}${button('exception','예외 승인',false,`data-index="${i}"`)}</div></div>`).join('')||'<div class="empty">추출값이 없습니다. 자동 추출 연결 전이며 수동 항목을 입력할 수 있습니다.</div>'}${button('add-doc-field','＋ 수동 항목 입력')}</div>`)}${panel(esc(item.name)+' 요약',`<div class="panel-body"><p class="sub">문서별 요약 · AI 연결 전. 원문에 없는 사실을 추가하지 마세요.</p><textarea class="doc-summary" aria-label="${esc(item.name)} 문서별 요약">${esc(d.summary)}</textarea><div class="row between" style="margin-top:12px">${badge(d.summaryApproved?'요약 확인 완료':'요약 확인 필요',d.summaryApproved?'green':'orange')}<div class="row">${button('doc-summary-save','요약 수정 저장')}${button('doc-summary-confirm','요약 확인',true)}</div></div></div>`)}</div></div></section>`;
}
function approvals(){return head('문서 · 승인','확정한 데이터와 문서 버전을 연결해 관리합니다.')+context()+panel('검수 확정',`<div class="panel-body"><dl class="kv"><dt>자료 버전</dt><dd>v${c().version}</dd><dt>미확인 항목</dt><dd>${c().fields.filter(f=>f.status==='pending').length}건</dd><dt>요약 확인</dt><dd>${c().summaryApproved?'완료':'대기'}</dd><dt>확정 상태</dt><dd>${c().approved?'v'+c().approvedVersion+' 확정':'검수 대기'}</dd></dl><div class="notice" style="margin-top:20px">미해결 항목은 사유를 적어 예외 승인할 수 있습니다. 확정 후 수정하면 재승인이 필요합니다.</div><div class="row">${button('approve','검수 확정',true)}<a class="btn" href="#documents">검수 화면으로</a>${button('preview','신청서 화면 미리보기',false,c().approved?'':'disabled')}</div></div>`)+panel('신청서 구성',`<div class="panel-body"><div class="workflow-list">${['신청자 기본정보','채권자 및 채무','재산','수입과 지출','신청 사연','검수 부록 · 예외 승인 사유'].map((x,i)=>`<div class="list-item"><span class="num">${i+1}</span><strong>${x}</strong></div>`).join('')}</div><div class="notice warn">Word 파일 생성은 아직 연결하지 않았습니다. 미리보기는 승인 흐름을 확인하는 화면입니다.</div></div>`);}
function corrections(){return head('보정 대응 · 기한','직원이 법원 문서를 확인하고 요구사항과 기한을 등록합니다.',button('correction','＋ 보정 요구 등록',true))+context()+panel('보정 항목',`<div class="table-scroll"><table><thead><tr><th>요구사항</th><th>확인된 기한</th><th>상태</th><th>처리</th></tr></thead><tbody>${c().corrections.map((x,i)=>`<tr><td>${esc(x.title)}</td><td>${esc(x.due)}</td><td>${badge(x.done?'확인 완료':'대응 중',x.done?'green':'orange')}</td><td>${button('correction-done',x.done?'다시 열기':'확인 완료',false,`data-index="${i}"`)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">등록된 보정 요구가 없습니다. 기한은 원문 확인 후 직접 입력하세요.</td></tr>'}</tbody></table></div>`)+panel('보정 대응 순서',`<div class="panel-body workflow-list">${['법원 문서 등록','요구사항 구분','기한·원문 확인','추가 자료 수집','답변·관련 서류 검토','사람 승인·직접 제출'].map((s,i)=>`<div class="list-item"><span class="num">${i+1}</span><strong>${s}</strong></div>`).join('')}</div>`);}
function audit(){return head('변경 이력','확정·수정·예외 승인과 대상 버전을 확인합니다.')+context()+panel('사건 기록',`<div class="panel-body">${c().logs.map(l=>`<div class="audit"><time>${esc(new Date(l.at).toLocaleString('ko-KR'))} · ${esc(l.actor)}</time>${esc(l.text)}</div>`).join('')||'<div class="empty">아직 기록된 변경이 없습니다.</div>'}</div>`);}
function runtime(){return head('운영 상태','화면 프로토타입과 실제 처리 기능의 연결 상태를 구분합니다.')+panel('현재 실행 환경',`<div class="panel-body"><dl class="kv"><dt>실행 위치</dt><dd>사무실 PC · 로컬 서버</dd><dt>데이터 저장</dt><dd>이 브라우저에 화면 입력값과 첨부 원본 보관 · 다른 브라우저와 공유되지 않음</dd><dt>역할 선택</dt><dd>권한 흐름 체험용 · 실제 로그인 인증 아님</dd><dt>외부 전송</dt><dd>이 프로토타입에서 외부 API 호출 없음</dd></dl></div>`)+panel('기능 연결 상태',`<table><thead><tr><th>기능</th><th>상태</th></tr></thead><tbody>${[['상담 기록·첨부·후속 업무','화면 동작'],['상담 원문 정리 초안','이 PC에서 로컬 처리'],['통화 자동 음성 전사·상담 AI 분석','API 연결 전'],['사건 등록·검색·메모','화면 동작'],['검수·예외 승인·재확인·이력','화면 동작'],['PDF·사진 원본 보관·뷰어','화면 동작'],['PDF 텍스트·한글 OCR·본문 분류·항목 추출','이 PC에서 로컬 처리'],['AI 요약·상위 AI 재분류','API 연결 전'],['Word 신청서 생성','연결 전'],['SQLite·서버 권한·인증','연결 전'],['외부 API·클라우드','P1 · 연결 전']].map(([a,b])=>`<tr><td>${a}</td><td>${badge(b,b==='화면 동작'||b==='이 PC에서 로컬 처리'?'green':'orange')}</td></tr>`).join('')}</tbody></table>`)+panel('화면 자료 관리',`<div class="panel-body"><p class="sub">개인정보를 넣지 말고 합성 정보로 사용하세요. 화면 데이터는 이 브라우저에 남습니다.</p><div class="row" style="margin-top:15px">${button('export','화면 데이터 JSON 내려받기')}${button('reset','합성 데모로 초기화')}</div></div>`);}
function render(){state.cases.forEach(hydrate);if(!nav.some(n=>n[0]===view))view='dashboard';$('#role').value=state.role;$('#breadcrumb').textContent=nav.find(n=>n[0]===view)[2];$('#nav').innerHTML=nav.map(([v,i,t])=>`<a href="#${v}" class="${view===v?'active':''}"><b>${i}</b>${t}</a>`).join('');$('#app').innerHTML=view==='dashboard'?dashboard():view==='cases'?head('전체 사건','모든 사건을 조회하고 배정된 사건을 처리합니다.',button('new','＋ 새 사건',true))+panel('사건 목록',`<div class="toolbar"><input id="search" placeholder="이름 · 생년월일 · 전화번호 · 담당자 검색" value="${esc(query)}" aria-label="사건 검색"></div><div id="case-table">${caseTable()}</div>`):!c()?head('선택한 사건 없음','먼저 사건을 등록하세요.',button('new','새 사건',true)):({workflow,documents,approvals,corrections,audit,runtime}[view])();mountFilePreviews();}
window.addEventListener('hashchange',()=>{view=location.hash.slice(1);render();});
$('#role').onchange=e=>{state.role=e.target.value;save();render();toast('역할 체험 전환 · 실제 인증은 연결 전입니다.');};
document.addEventListener('input',e=>{if(e.target.id==='doc-search'){const pos=e.target.selectionStart;docSearch=e.target.value;render();$('#doc-search').focus();$('#doc-search').setSelectionRange(pos,pos);}if(e.target.id==='search'){query=e.target.value;$('#case-table').innerHTML=caseTable();}});
function openReclassification(docs,item){
 const stored=docs.filter(d=>d.stored||d.sourceFileId);
 if(!stored.length){modal('재분류 진행 미리보기',`<p><strong>${esc(item.name)}</strong></p><div class="notice warn">이 서류에 저장된 원본 파일이 없습니다. 실제 파일을 첨부하면 이 PC에서 원문을 읽고 한글 OCR을 진행합니다. 상위 AI 재분류 기능은 API 연결 후 사용할 수 있습니다.</div>`,()=>{},'닫기');return;}
 $('#dialog-content').innerHTML=`<div class="reclass-modal"><div class="row between"><div><h2>재분류 · OCR 다시 읽기</h2><p class="sub">실제 원문과 텍스트 추출 진행 상황</p></div><button type="button" class="btn primary" id="reclass-close">닫기</button></div><label class="field">대상 파일<select id="reclass-file" class="input">${stored.map(d=>`<option value="${esc(d.id)}">${esc(d.name)}${d.sourceFileId?` · ${esc(d.pages)}쪽`:''}</option>`).join('')}</select></label><div class="reclass-notice notice warn">PDF 텍스트와 스캔·사진의 한글 OCR을 이 PC에서 처리합니다. 파일은 외부로 전송되지 않습니다. 상위 AI 재분류 API는 아직 연결 전입니다.</div><div class="reclass-grid"><section class="reclass-source"><h3>원본</h3><div class="reclass-file-info sub"></div><div class="reclass-preview source-preview">원문을 여는 중입니다.</div><div class="reclass-pages row between"><button type="button" class="btn small" data-page="prev" disabled>이전 쪽</button><span class="sub" aria-live="polite"></span><button type="button" class="btn small" data-page="next" disabled>다음 쪽</button></div></section><section class="reclass-result"><h3>텍스트 추출 과정</h3><ol class="reclass-steps"><li data-step="0">원본 파일 열기</li><li data-step="1">PDF 텍스트 / 한글 OCR 읽기</li><li data-step="2">추출 결과 확인</li><li data-step="3">상위 AI 재분류 · API 연결 대기</li></ol><progress class="reclass-progress" max="100" value="0"></progress><p class="reclass-progress-label sub" aria-live="polite">준비 중</p><label class="field">추출 텍스트<textarea class="reclass-text" readonly placeholder="원문을 불러오면 진행 과정과 결과가 여기에 표시됩니다."></textarea></label><p class="sub reclass-result-note">추출값과 서류 분류는 자동 확정하지 않습니다. 원문 대조 후 검수 화면에서 확인하세요.</p></section></div></div>`;
 const dialog=$('#dialog');dialog.showModal();$('#reclass-close').onclick=()=>dialog.close();
 let activeTask=null,currentPage=1,pdf=null,activeReader=null,runToken=0,visiblePages=[];
 const els={preview:dialog.querySelector('.reclass-preview'),file:dialog.querySelector('.reclass-file-info'),steps:[...dialog.querySelectorAll('[data-step]')],progress:dialog.querySelector('.reclass-progress'),label:dialog.querySelector('.reclass-progress-label'),text:dialog.querySelector('.reclass-text'),note:dialog.querySelector('.reclass-result-note'),pageLabel:dialog.querySelector('.reclass-pages span'),prev:dialog.querySelector('[data-page="prev"]'),next:dialog.querySelector('[data-page="next"]')};
 const step=(index,message)=>{els.steps.forEach((node,i)=>node.classList.toggle('complete',i<index));els.steps.forEach((node,i)=>node.classList.toggle('active',i===index));els.label.textContent=message;};
 const renderPage=async()=>{if(!pdf)return;els.prev.disabled=els.next.disabled=true;const page=await pdf.getPage(currentPage);const base=page.getViewport({scale:1}),scale=Math.min(1.35,Math.max(.25,(els.preview.clientWidth-20)/base.width)),ratio=Math.min(1.5,window.devicePixelRatio||1),viewport=page.getViewport({scale:scale*ratio});els.preview.replaceChildren();const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;canvas.style.width='100%';canvas.style.height='auto';els.preview.append(canvas);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;els.pageLabel.textContent=`${currentPage} / ${pdf.numPages}쪽`;const position=visiblePages.indexOf(currentPage);els.prev.disabled=position<=0;els.next.disabled=position>=visiblePages.length-1;};
 els.prev.onclick=()=>{const position=visiblePages.indexOf(currentPage);if(pdf&&position>0){currentPage=visiblePages[position-1];renderPage();}};els.next.onclick=()=>{const position=visiblePages.indexOf(currentPage);if(pdf&&position<visiblePages.length-1){currentPage=visiblePages[position+1];renderPage();}};
 async function run(doc){
  const token=++runToken;if(activeReader){activeReader.stop();await activeReader.close().catch(()=>{});}if(activeTask){await activeTask.destroy().catch(()=>{});activeTask=null;}pdf=null;visiblePages=[];currentPage=1;els.text.value='';els.progress.value=0;els.note.textContent='추출값과 서류 분류는 자동 확정하지 않습니다. 원문 대조 후 검수 화면에서 확인하세요.';els.steps.forEach(x=>x.classList.remove('complete','active','blocked'));els.prev.disabled=els.next.disabled=true;els.preview.replaceChildren();step(0,'원본 파일을 여는 중입니다.');
  try{
   const sourceId=doc.sourceFileId||doc.id,record=await readAttachment(sourceId);if(!record?.blob)throw Error('저장된 원본 파일을 찾을 수 없습니다.');
   els.file.textContent=`${record.name} · ${fileSize(record.blob.size)} · 현재 PC에서 처리`;
   let url=previewUrls.get(sourceId);if(!url){url=URL.createObjectURL(record.blob);previewUrls.set(sourceId,url);}step(1,'원본을 열었습니다. 텍스트와 OCR을 확인합니다.');
   if(record.type==='application/pdf'){
    const lib=await(pdfLibrary??=import('/vendor/pdf.mjs'));lib.GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.mjs';sharedPdfWorker??=new lib.PDFWorker();activeTask=lib.getDocument({data:new Uint8Array(await record.blob.arrayBuffer()),worker:sharedPdfWorker,cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/',isEvalSupported:false});pdf=await activeTask.promise;if(token!==runToken)return;visiblePages=parsePageRange(doc.sourceFileId?doc.pages:'',pdf.numPages);currentPage=visiblePages[0]||1;els.steps[0].classList.add('complete');await renderPage();
   }else{const image=document.createElement('img');image.src=url;image.alt=record.name+' 원본';els.preview.replaceChildren(image);els.pageLabel.textContent='사진 원본';visiblePages=[1];els.steps[0].classList.add('complete');}
   activeReader=createLocalReader(message=>{if(token!==runToken)return;const fraction=message.total?message.page/message.total:0;els.progress.value=Math.max(0,Math.min(99,Math.round(fraction*100)));els.label.textContent=`${message.page}/${message.total}쪽 · ${message.phase}${message.detail?' · '+message.detail:''}`;});
   const pages=await activeReader.read(record,0,1,doc.sourceFileId?doc.pages:'');if(token!==runToken)return;const characters=pages.reduce((sum,page)=>sum+page.text.length,0);els.text.value=pages.map(page=>`--- ${page.page}쪽 · ${page.method} · 신뢰도 ${page.confidence}% ---\n${page.text||'읽힌 텍스트가 없습니다.'}`).join('\n\n');
   els.steps[1].classList.add('complete');els.steps[2].classList.add(characters?'complete':'blocked');els.steps[3].classList.add('blocked');els.progress.value=100;els.label.textContent=`${pages.length}쪽 확인 완료 · 텍스트 ${characters.toLocaleString()}자`;
   els.note.textContent=`로컬 텍스트/OCR만 실행했습니다. 상위 AI 재분류 API는 미연결 상태이며, ${pages.filter(page=>page.method==='로컬 한글 OCR').length}쪽은 한글 OCR로 읽었습니다.`;
  }catch(error){if(token===runToken){els.progress.value=0;els.label.textContent='원문을 처리하지 못했습니다.';els.steps[0].classList.add('blocked');els.note.textContent=error.message||'원본 파일을 열 수 없습니다.';}}
 }
 const fileSelect=dialog.querySelector('#reclass-file');fileSelect.addEventListener('change',()=>run(stored.find(d=>d.id===fileSelect.value)));
 dialog.addEventListener('close',()=>{runToken++;if(activeReader)activeReader.close().catch(()=>{});if(activeTask)activeTask.destroy().catch(()=>{});},{once:true});run(stored[0]);
}
function openClassification(docs){
 if(!docs.length)throw Error('분류를 수정할 파일이 없습니다.');
 const first=docs[0];
 modal('서류 종류 지정',`<label class="field">수정할 파일<select name="docId" class="input">${docs.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></label><label class="field">서류 종류<select name="catalogId" class="input">${catalog.map(x=>`<option value="${x.id}" ${x.id===first.catalogId?'selected':''}>${esc(x.group)} · ${esc(x.name)}</option>`).join('')}</select></label>`+field('pages','페이지 범위',first.pages)+field('reason','분류 사유'),values=>{const doc=docs.find(x=>x.id===values.docId);if(!doc)throw Error('수정할 파일을 선택하세요.');doc.pages=values.pages;bind(c(),doc,values.catalogId,values.reason);selectedType=values.catalogId;selectedDoc=doc.id;log(`분류 수정: ${doc.name} → ${doc.type} · ${values.reason}`);});
 $('#dialog [name="docId"]').onchange=e=>{const doc=docs.find(x=>x.id===e.target.value);$('#dialog [name="catalogId"]').value=doc.catalogId||catalog[0].id;$('#dialog [name="pages"]').value=doc.pages;};
}
function fileDatabase(){
 if(!attachmentDb)attachmentDb=new Promise((resolve,reject)=>{const req=indexedDB.open('jiyeol-office-attachments',1);req.onupgradeneeded=()=>req.result.createObjectStore('files',{keyPath:'id'});req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>{db.close();attachmentDb=undefined;};resolve(db);};req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('다른 창에서 첨부 저장소를 사용 중입니다.'));}).catch(error=>{attachmentDb=undefined;throw error;});
 return attachmentDb;
}
async function writeAttachments(entries){const db=await fileDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');for(const entry of entries)tx.objectStore('files').put(entry);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('첨부 저장이 취소됐습니다.'));});}
async function readAttachment(id){const db=await fileDatabase();return new Promise((resolve,reject)=>{const req=db.transaction('files').objectStore('files').get(id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function saveAttachmentAnalysis(id,analysis){const db=await fileDatabase(),record=await readAttachment(id);if(!record)throw Error('원본 파일을 찾을 수 없습니다.');record.analysis=analysis;return new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('추출 결과 저장이 취소됐습니다.'));});}
async function rollbackAttachments(ids){const db=await fileDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');for(const id of ids)tx.objectStore('files').delete(id);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});}
function fileSize(bytes){return bytes>=1048576?(bytes/1048576).toFixed(1)+' MB':Math.max(1,Math.ceil(bytes/1024))+' KB';}
function parsePageRange(range,total){if(!range)return Array.from({length:total},(_,i)=>i+1);const pages=new Set();for(const match of String(range).matchAll(/(\d+)\s*(?:[-–—]\s*(\d+))?/g)){const start=Number(match[1]),end=Number(match[2]||match[1]);for(let page=start;page<=Math.min(end,total);page++)if(page>0)pages.add(page);}return pages.size?[...pages].sort((a,b)=>a-b):Array.from({length:total},(_,i)=>i+1);}
function pageRangeLabel(start,end){return start===end?`${start}`:`${start}–${end}`;}
function extractedFields(item,text,docName,pages,confidence){return item.fields.map(label=>{const found=extractFieldValue(label,text);return {label,value:found.value,docId:'',status:'pending',source:`${docName} · ${pages}쪽`,reason:confidence<72?`OCR 신뢰도 낮음(${confidence}%) · 원문 확인 필요`:found.reason};});}
function documentSummaryDraft(fields){const lines=fields.filter(field=>field.value&&field.label!=='원문').slice(0,8).map(field=>`• ${field.label}: ${field.value.replace(/\s+/g,' ').slice(0,220)}`);return lines.length?`자동 추출 요약 초안 · 원문 확인 필요\n${lines.join('\n')}`:'자동 추출한 요약 항목이 없습니다. 원문을 확인해 요약을 작성하세요.';}
function showAutoClassification(){
 if(!ensureEdit())return;const sources=c().documents.filter(doc=>doc.stored&&!doc.sourceFileId);if(!sources.length)throw Error('먼저 원본 파일을 첨부하세요.');
 const dialog=$('#dialog');$('#dialog-content').innerHTML=`<div class="auto-ocr-modal"><div class="row between"><div><h2>원문 읽기 · 자동 분류</h2><p class="sub">파일명 대신 PDF·사진 내용을 이 PC에서 확인합니다.</p></div><button type="button" class="btn" id="auto-close">중지하고 닫기</button></div><div class="notice">외부로 파일을 전송하지 않습니다. 추출값은 모두 확인 필요 상태로 등록되어, 사람이 원문과 대조해야 합니다.</div><progress id="auto-progress" max="100" value="0"></progress><p id="auto-progress-label" class="sub" aria-live="polite">처리를 준비하는 중입니다.</p><div id="auto-results" class="auto-results"></div></div>`;dialog.showModal();
 let cancelled=false,finished=false;const target=c(),reader=createLocalReader(message=>{if(cancelled)return;const fraction=message.total?message.page/message.total:0;const progress=Math.round(((message.fileIndex+fraction)/message.totalFiles)*100);$('#auto-progress').value=Math.max(0,Math.min(99,progress));$('#auto-progress-label').textContent=`${message.fileName} · ${message.page}/${message.total}쪽 · ${message.phase}${message.detail?' · '+message.detail:''}`;});
 const closeButton=dialog.querySelector('#auto-close');closeButton.onclick=()=>{if(finished){dialog.close();return;}cancelled=true;reader.stop();closeButton.textContent='중지 중…';closeButton.disabled=true;$('#auto-progress-label').textContent='현재 페이지 처리를 마친 뒤 중단합니다.';};
 dialog.addEventListener('close',()=>{cancelled=true;reader.stop();},{once:true});
 const rows=[];const startVersion=target.version;const renderResults=()=>{$('#auto-results').innerHTML=rows.map(row=>{const recognized=row.groups.map(group=>`${group.item.name} ${pageRangeLabel(group.start,group.end)}쪽`).join(' · ')||'분류된 서류 없음';const unresolved=row.classified.filter(page=>!page.item).map(page=>`<p class="auto-result-detail">${page.page}쪽 · ${page.reason} · ${page.method} ${page.text.length}자${page.text?` · ${page.text.slice(0,100)}`:''}</p>`).join('');return `<div class="auto-result-row"><strong>${esc(row.source.name)}</strong><div><span>${esc(row.error||recognized)}</span>${unresolved}</div></div>`;}).join('');};
 (async()=>{
  let recognizedPages=0,unclassifiedPages=0,fieldCount=0,needsCheck=0,processedFiles=0;
  try{
   for(let index=0;index<sources.length;index++){
    if(cancelled)break;const source=sources[index];
    try{
     const record=await readAttachment(source.id);if(!record?.blob)throw Error('저장된 원본을 찾지 못했습니다.');
     const pages=await reader.read(record,index,sources.length);if(cancelled)break;
     const classified=pages.map(page=>({...page,...classifyPage(page.text)}));
     const groups=groupClassifiedPages(classified);recognizedPages+=groups.reduce((sum,group)=>sum+group.pages.length,0);unclassifiedPages+=classified.filter(page=>!page.item).length;processedFiles++;
     await saveAttachmentAnalysis(source.id,{processedAt:new Date().toISOString(),pages:classified.map(page=>({page:page.page,text:page.text,confidence:page.confidence,method:page.method,itemId:page.item?.id||'',reason:page.reason||''}))});
     rows.push({source,classified,groups,error:''});
     const result=groups.length?groups.map(group=>`${group.item.name} ${pageRangeLabel(group.start,group.end)}쪽`).join(' · '):'서류 제목을 찾지 못함';
     renderResults();
     $('#auto-progress-label').textContent=`${source.name} 처리 완료 · ${result}`;
    }catch(error){if(cancelled)break;rows.push({source,classified:[],groups:[],error:error.message||'파일을 읽지 못했습니다.'});renderResults();}
   }
   if(target.version!==startVersion)throw Error('처리 중 사건 자료가 변경되어 결과를 반영하지 않았습니다. 다시 실행하세요.');
  const affectedCatalogIds=new Set();
  for(const row of rows){if(row.error)continue;const source=row.source;for(const old of target.documents.filter(doc=>doc.autoGeneratedFrom===source.id)){if(old.catalogId)affectedCatalogIds.add(old.catalogId);}if(source.catalogId)affectedCatalogIds.add(source.catalogId);target.documents=target.documents.filter(doc=>doc.autoGeneratedFrom!==source.id);target.fields=target.fields.filter(field=>field.autoGeneratedFrom!==source.id&&field.docId!==source.id);source.catalogId=undefined;source.type=row.groups.length>1?'통합 자료':'미분류';source.classificationMethod=row.groups.length>1?'bundle':'local-ocr';source.classificationNote=row.groups.length?'본문 분석 후 사람 확인 필요':'본문에서 서류 제목을 찾지 못했습니다. 페이지별 판독 결과를 확인하세요.';source.pages=row.classified.length>1?`1–${row.classified.length}`:row.classified[0]?.page||'—';
    const oneComplete=row.groups.length===1&&row.groups[0].start===1&&row.groups[0].end===row.classified.length&&row.classified.every(page=>page.item?.id===row.groups[0].item.id);
    for(const group of row.groups){const item=group.item,pages=pageRangeLabel(group.start,group.end),text=group.pages.map(page=>`--- ${page.page}쪽 ---\n${page.text}`).join('\n\n'),confidence=Math.min(...group.pages.map(page=>page.confidence||0));affectedCatalogIds.add(item.id);const doc=oneComplete?source:{id:crypto.randomUUID(),name:`${source.name} · ${item.name}`,type:item.name,catalogId:item.id,pages,summary:'',summaryApproved:false,status:'검수중',sample:false,stored:false,size:source.size,mime:source.mime,sourceFileId:source.id,sourceName:source.name,classificationMethod:'local-ocr',classificationNote:`본문에서 서류 제목 확인 · OCR 신뢰도 ${confidence}%`,autoGeneratedFrom:source.id};
     if(oneComplete){doc.type=item.name;doc.catalogId=item.id;doc.pages=pages;doc.classificationMethod='local-ocr';doc.classificationNote=`본문에서 서류 제목 확인 · OCR 신뢰도 ${confidence}%`;doc.summaryApproved=false;}
     const fields=extractedFields(item,text,source.name,pages,confidence);doc.summary=documentSummaryDraft(fields);doc.summaryApproved=false;for(const field of fields){field.docId=doc.id;field.autoGeneratedFrom=source.id;}target.fields.push(...fields);fieldCount+=fields.filter(field=>field.value).length;
     if(['D32','D33'].includes(item.id)&&!target.summaryManuallyEdited){target.summary=doc.summary;target.summaryApproved=false;}
     const missing=fields.filter(field=>!field.value).length;const uncertain=confidence<72||missing>0;needsCheck+=uncertain?1:0;const previousCheck=target.checklist[item.id];target.checklist[item.id]={status:uncertain||previousCheck?.status==='추가 검수 필요'?'추가 검수 필요':'등록됨',reason:`로컬 자동 추출 ${fields.length-missing}/${fields.length}개 항목 · 원문 확인 필요`};
     if(!oneComplete)target.documents.push(doc);
    }
    if(row.groups.length>1)source.classificationNote=`한 원본에서 ${row.groups.length}종의 서류를 찾았습니다. 아래 체크리스트에서 페이지별 결과를 확인하세요.`;
   }
   for(const id of affectedCatalogIds){const stillLinked=target.documents.some(doc=>doc.catalogId===id&&(doc.stored||doc.sourceFileId));if(!stillLinked&&target.checklist[id]?.status!=='해당 없음')target.checklist[id]={status:'미제출',reason:''};}
   if(rows.some(row=>!row.error)){
    target.version++;target.approved=false;target.summaryApproved=false;target.logs.unshift({at:new Date().toISOString(),actor:actor(),text:`로컬 문서 읽기·자동 분류: 파일 ${processedFiles}건 · 서류 ${rows.reduce((sum,row)=>sum+row.groups.length,0)}종 · 원문 확인 필요`});if(!save())throw Error('분류 결과를 화면 저장소에 반영하지 못했습니다.');render();
   }
   $('#auto-progress').value=100;$('#auto-progress-label').textContent=cancelled?'중단했습니다. 완료된 파일의 분류 결과를 확인하세요.':`완료 · 서류 ${rows.reduce((sum,row)=>sum+row.groups.length,0)}종 · 채운 항목 ${fieldCount}개 · 추가 확인 ${needsCheck}종 · 분류 못한 쪽 ${unclassifiedPages}쪽`;
   closeButton.disabled=false;closeButton.textContent='닫기';finished=true;if(!cancelled)toast(`원문을 읽어 ${rows.reduce((sum,row)=>sum+row.groups.length,0)}종의 서류를 분류했습니다. 추출값은 사람 확인 전입니다.`);
  }catch(error){$('#auto-progress-label').textContent=error.message||'분류 결과를 저장하지 못했습니다.';closeButton.disabled=false;closeButton.textContent='닫기';finished=true;}
  finally{await reader.close();}
 })();
}
function attachmentList(){
 const docs=c().documents.map((doc,index)=>({doc,index})).filter(({doc})=>(doc.stored||(!doc.sample&&!doc.sourceFileId)));
 return `<div class="drop-attachments"><div class="drop-attachments-head">등록한 자료 <span>${c().documents.filter(doc=>doc.stored).length}개</span></div>${docs.map(({doc,index})=>`<div class="attachment-item"><div class="attachment-info"><strong>${esc(doc.name)}</strong><p class="sub">${doc.stored?`${fileSize(doc.size)} · 원본 저장됨`: '원본 없음 · 다시 첨부 필요'} · ${esc(doc.classificationMethod==='bundle'?'통합 자료 · 서류별 분류 결과는 체크리스트에서 확인':doc.catalogId?doc.type:'분류 확인 필요')}</p></div><div class="row">${doc.stored?button('attachment-preview','원문 보기',false,`data-attachment-id="${esc(doc.id)}"`):button('reattach','다시 첨부',false,`data-attachment-id="${esc(doc.id)}"`)}${!doc.catalogId&&doc.classificationMethod!=='bundle'?button('classify','서류 종류 지정',false,`data-index="${index}"`):''}</div></div>`).join('')||'<p class="drop-attachments-empty">아직 등록한 파일이 없습니다.</p>'}</div>`;
}
function sourcePreview(doc){
 if(doc.stored||doc.sourceFileId)return `<div class="stored-preview" data-file-preview="${esc(doc.sourceFileId||doc.id)}" ${doc.sourceFileId?`data-page-range="${esc(doc.pages)}"`:''}><p class="sub">원문을 불러오는 중입니다.</p></div>`;
 if(doc.originalText)return `<div class="original-text">${esc(doc.originalText)}</div>`;
 return `<div class="source-preview"><p>${doc.sample?'합성 화면 예시 · 실제 원본 없음':'원본이 없습니다. 첨부파일 목록에서 다시 첨부하세요.'}</p></div>`;
}
async function renderPdf(el,record,pageRange=''){
 const status=document.createElement('p');status.className='sub';status.textContent='PDF를 불러오는 중입니다.';el.append(status);
 let task;
 try{
  const pdfjs=await (pdfLibrary??=import('/vendor/pdf.mjs'));if(!el.isConnected)return;
  pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.mjs';sharedPdfWorker??=new pdfjs.PDFWorker();
  task=pdfjs.getDocument({data:new Uint8Array(await record.blob.arrayBuffer()),worker:sharedPdfWorker,cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/',isEvalSupported:false});
  pdfViews.set(el,task);task.onPassword=()=>{status.textContent='암호가 설정된 PDF입니다. 암호를 해제한 파일을 첨부하세요.';task.destroy();};
  const pdf=await task.promise;if(!el.isConnected){await task.destroy();pdfViews.delete(el);return;}
  const pages=parsePageRange(pageRange,pdf.numPages);let pageIndex=0,pageNumber=pages[pageIndex];const controls=document.createElement('div');controls.className='row pdf-controls';const prev=document.createElement('button'),next=document.createElement('button'),label=document.createElement('span'),canvas=document.createElement('canvas');prev.type=next.type='button';prev.className=next.className='btn small';prev.textContent='이전 쪽';next.textContent='다음 쪽';label.className='sub';controls.append(prev,label,next);el.append(controls,canvas);
  const showPage=async()=>{prev.disabled=next.disabled=true;status.textContent='페이지를 표시하는 중입니다.';try{const page=await pdf.getPage(pageNumber);if(!el.isConnected)return;const base=page.getViewport({scale:1}),width=Math.max(200,el.clientWidth-2),scale=Math.min(2,width/base.width),ratio=Math.min(window.devicePixelRatio||1,2),viewport=page.getViewport({scale:scale*ratio});canvas.width=viewport.width;canvas.height=viewport.height;canvas.style.width='100%';canvas.style.height='auto';await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;label.textContent=`${pageNumber} / ${pdf.numPages}쪽`;status.textContent='';}catch(error){status.textContent='페이지를 표시하지 못했습니다. 원본 내려받기를 이용하세요.';}finally{prev.disabled=pageIndex<=0;next.disabled=pageIndex>=pages.length-1;}};
  prev.onclick=()=>{pageIndex--;pageNumber=pages[pageIndex];showPage();};next.onclick=()=>{pageIndex++;pageNumber=pages[pageIndex];showPage();};await showPage();
 }catch(error){if(el.isConnected&&status.textContent!=='암호가 설정된 PDF입니다. 암호를 해제한 파일을 첨부하세요.')status.textContent='PDF를 표시하지 못했습니다. 원본 내려받기를 이용하세요.';}
}
async function mountFilePreviews(){
 for(const [el,task] of pdfViews)if(!el.isConnected){task.destroy().catch(()=>{});pdfViews.delete(el);}
 for(const el of document.querySelectorAll('[data-file-preview]')){
  if(el.dataset.previewMounted)continue;el.dataset.previewMounted='true';const id=el.dataset.filePreview;
  try{const record=await readAttachment(id);if(!el.isConnected)continue;if(!record?.blob)throw Error('원본 파일이 저장소에 없습니다.');let url=previewUrls.get(id);if(!url){url=URL.createObjectURL(record.blob);previewUrls.set(id,url);}
   el.replaceChildren();
   const link=document.createElement('a');link.href=url;link.download=record.name;link.className='btn';link.textContent='원본 내려받기';
   if(record.type==='application/pdf'){const viewer=document.createElement('div');viewer.className='pdf-pages';el.append(viewer,link);renderPdf(viewer,record,el.dataset.pageRange||'');}else{const media=document.createElement('img');media.src=url;media.alt=record.name+' 원문';el.append(media,link);}
  }catch(error){if(el.isConnected){el.textContent='원문을 불러오지 못했습니다. 첨부파일 목록에서 다시 첨부하세요.';el.classList.add('notice','warn');}}
 }
}
async function registerFiles(files){
 if(!ensureEdit()||uploading)return;
 const target=c(),uploadedBy=actor(),replaceId=replacementDocId;replacementDocId='';
 const selected=Array.from(files||[]),valid=selected.filter(f=>/\.(pdf|jpe?g|png)$/i.test(f.name)&&f.size>0);
 if(!valid.length){toast('내용이 있는 PDF·JPG·PNG 파일을 선택해주세요.');return;}
 if(replaceId&&valid.length!==1){toast('다시 첨부할 파일 하나를 선택하세요.');return;}
 const entries=[],updates=[],used=new Set();
 for(const file of valid){const previous=replaceId?target.documents.find(d=>d.id===replaceId):target.documents.find(d=>!d.sample&&!d.stored&&d.name===file.name&&!used.has(d.id));if(previous)used.add(previous.id);const id=previous?.id||crypto.randomUUID(),type=/\.pdf$/i.test(file.name)?'application/pdf':/\.png$/i.test(file.name)?'image/png':'image/jpeg';const doc=previous?{...previous,name:file.name,summaryApproved:false}:{id,name:file.name,type:'미분류',pages:'—',summary:'',summaryApproved:false,status:'자동 분류 대기',sample:false,classificationMethod:'pending',classificationNote:'자동 분류 실행 전'};Object.assign(doc,{stored:true,size:file.size,mime:type,attachedAt:new Date().toISOString()});entries.push({id,caseId:target.id,name:file.name,type,blob:file.slice(0,file.size,type)});updates.push({doc,previous});}
 uploading=true;render();
 let written=false;const before={documents:target.documents,fields:target.fields,approved:target.approved,summaryApproved:target.summaryApproved,version:target.version,logs:target.logs};
 try{
  await writeAttachments(entries);written=true;
  const ids=new Set(updates.map(x=>x.doc.id));target.documents=target.documents.map(old=>updates.find(x=>x.doc.id===old.id)?.doc||old);for(const {doc,previous} of updates)if(!previous)target.documents.push(doc);
  target.fields=target.fields.map(f=>ids.has(f.docId)?{...f,status:'pending',reason:'원본 첨부 후 재확인 필요'}:f);target.approved=false;target.summaryApproved=false;target.version++;
  target.logs=[{at:new Date().toISOString(),actor:uploadedBy,text:`자료 ${updates.length}건 원본 첨부 · 현재 브라우저 저장 · 외부 전송 없음 · 본문 OCR 미실행`},...target.logs];
  if(!save())throw Error('첨부 정보를 저장할 공간이 부족합니다.');
  for(const id of ids){if(previewUrls.has(id)){URL.revokeObjectURL(previewUrls.get(id));previewUrls.delete(id);}}
  toast(`${updates.length}개 파일을 첨부했습니다.${valid.length<selected.length?' 지원하지 않거나 비어 있는 파일은 제외했습니다.':''}`);
 }catch(error){Object.assign(target,before);if(written)await rollbackAttachments(entries.map(x=>x.id)).catch(()=>{});toast('파일을 첨부하지 못했습니다. 브라우저 저장 공간과 설정을 확인하세요.');}
 finally{uploading=false;render();}
}
document.addEventListener('cancel',e=>{if(e.target.id==='files')replacementDocId='';},true);
// Both the picker and drag-and-drop use the same validation and registration path.
const draggingFiles=e=>Array.from(e.dataTransfer?.types||[]).includes('Files');
document.addEventListener('dragover',e=>{if(!draggingFiles(e))return;e.preventDefault();const zone=e.target.closest?.('#file-drop');if(zone){e.dataTransfer.dropEffect='copy';zone.classList.add('drag-active');}else e.dataTransfer.dropEffect='none';});
document.addEventListener('dragleave',e=>{const zone=e.target.closest?.('#file-drop');if(zone&&!zone.contains(e.relatedTarget))zone.classList.remove('drag-active');});
document.addEventListener('drop',e=>{if(!draggingFiles(e))return;e.preventDefault();const zone=e.target.closest?.('#file-drop');$('#file-drop')?.classList.remove('drag-active');if(zone){replacementDocId='';registerFiles(e.dataTransfer.files);}else if(view==='documents')toast('파일을 점선으로 표시된 영역 안에 놓아주세요.');});
document.addEventListener('change',e=>{if(e.target.id==='case-select'){state.selected=e.target.value;selectedType=c().reviewSelection?.type||'D06';selectedDoc=c().reviewSelection?.doc||'';save();render();}if(e.target.id==='doc-group'){docGroup=e.target.value;render();}if(e.target.id==='doc-status'){docStatus=e.target.value;render();}if(e.target.id==='review-doc'){selectedDoc=e.target.value;render();}if(e.target.id==='files'){registerFiles(e.target.files);}});
document.addEventListener('click',e=>{const row=e.target.closest('[data-case]');if(row&&!e.target.closest('button')){state.selected=row.dataset.case;save();location.hash='workflow';return;}const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action,i=Number(b.dataset.index);
try{
if(a==='new'){const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});modal('새 사건 등록',field('name','이름')+field('birthDate','생년월일','','date').replace('type="date"',`type="date" max="${today}"`)+field('phone','전화번호','','tel').replace('type="tel"','type="tel" autocomplete="tel" placeholder="010-1234-5678"')+field('owner','담당자','배지열'),d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d.birthDate)||d.birthDate>today)throw Error('생년월일은 오늘을 포함한 과거 날짜로 입력하세요.');const phone=d.phone.replace(/\D/g,'');if(phone.length<9||phone.length>15||!/^[+\d\s()-]+$/.test(d.phone))throw Error('전화번호를 확인하세요. 숫자 9~15자리로 입력할 수 있습니다.');const x=demo();Object.assign(x,{id:'CASE-'+Date.now(),name:d.name.trim(),birthDate:d.birthDate,phone:d.phone.trim(),owner:d.owner.trim(),stage:0,documents:[],fields:[],summary:'',notes:'',logs:[]});state.cases.unshift(x);state.selected=x.id;hydrate(x);view='workflow';location.hash='workflow';log('사건 등록 · 이름·생년월일·전화번호 저장');},'저장');return;}
if(a==='export'){const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='빚오프_화면데이터.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
if(a==='reset'){modal('합성 데모로 초기화','<p>이 브라우저에 저장된 모든 화면 입력값과 이력을 삭제하고 합성 예시로 바꿉니다.</p>',()=>{state={cases:[demo()],selected:'DEMO-001',role:'staff'};},'초기화');return;}
if(a==='stage'){c().stage=i;save();render();return;}
if(a==='preview'){if(!c().approved||needsReview(c())||docPending(c()))throw Error('검수 확정 후 열 수 있습니다.');modal('신청서 화면 미리보기',`<div class="notice">Word 생성 전 · 승인 버전 v${c().approvedVersion}의 화면 예시</div><h3>${esc(c().name)}</h3>${c().fields.map(f=>`<p>${esc(f.label)}: ${esc(f.value||'[확인 필요]')} ${f.status==='exception'?'(예외 승인)':''}</p>`).join('')}<p>${esc(c().summary)}</p>`,()=>{},'닫기');return;}
if(a==='status-list'){expandedStatus=expandedStatus===b.dataset.status?'':b.dataset.status;render();return;}
if(a==='close-status-list'){expandedStatus='';render();return;}
if(a==='jump-checklist'){
 selectedType=b.dataset.id;docSearch='';docGroup='all';docStatus='all';render();
 const scroller=$('.checklist-scroll'),row=scroller.querySelector(`[data-catalog-id="${selectedType}"]`),header=scroller.querySelector('thead');
 const tail=document.createElement('tr');tail.setAttribute('aria-hidden','true');tail.innerHTML='<td colspan="5" style="padding:0;border:0"></td>';tail.style.height=Math.max(0,scroller.clientHeight-header.offsetHeight-row.offsetHeight)+'px';scroller.querySelector('tbody').append(tail);
 scroller.scrollTop=row.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop-header.offsetHeight;
 scroller.closest('.panel').scrollIntoView({behavior:'smooth',block:'start'});return;
}
if(a==='select-type'||a==='edit-document'){
 selectedType=b.dataset.id;const doc=linked(c(),selectedType)[0];if(!doc){toast('이 서류는 아직 제출되지 않았습니다.');return;}selectedDoc=doc.id;render();
 const section=document.getElementById('document-'+doc.id);const target=a==='edit-document'?(section?.querySelector('.field-review [data-action="edit"]')||section):section;
 target?.scrollIntoView({behavior:'smooth',block:a==='edit-document'?'center':'start'});if(a==='edit-document')target?.focus({preventScroll:true});return;
}
if(a==='reclassify'){openReclassification(linked(c(),b.dataset.id),catalog.find(x=>x.id===b.dataset.id));return;}
if(a==='attachment-preview'){const doc=c().documents.find(x=>x.id===b.dataset.attachmentId);if(!doc?.stored)throw Error('첨부된 원본이 없습니다.');modal(doc.name,sourcePreview(doc),()=>{},'닫기');mountFilePreviews();return;}
if(!ensureEdit())return;
if(a==='reattach'){replacementDocId=b.dataset.attachmentId;$('#files').value='';$('#files').multiple=false;$('#files').click();return;}
if(a==='auto-classify'){
 showAutoClassification();return;
}
if(a==='item-status'){
 const id=b.dataset.id,item=catalog.find(x=>x.id===id),entry=c().checklist[id],docs=linked(c(),id),status=itemStatus(c(),id);
 const reasons=[];
 if(entry.reason)reasons.push(`담당자 판단: ${entry.reason}`);
 if(!docs.length&&status!=='해당 없음')reasons.push('등록된 파일이 없습니다.');
 for(const doc of docs){
  if(doc.classificationMethod==='filename')reasons.push(`${doc.name}: 파일명으로만 잠정 분류되어 서류 종류 확인이 필요합니다.`);
  for(const f of c().fields.filter(f=>f.docId===doc.id&&f.status==='pending'))reasons.push(`${doc.name} · ${f.label}: ${f.reason||'원문 대조와 확인이 필요합니다.'}`);
  if(!c().fields.some(f=>f.docId===doc.id))reasons.push(`${doc.name}: 추출 항목이 아직 없습니다.`);
  if(!doc.summaryApproved)reasons.push(`${doc.name}: 문서 요약 확인이 필요합니다.`);
 }
 if(status==='검수 완료')reasons.push('추출 항목과 문서별 요약의 확인이 완료되었습니다.');
 const manual=['추가 검수 필요','해당 없음'].includes(status)?status:'등록됨';
 modal('검수 상태 · 판단 사유',`<p><strong>${esc(item.name)}</strong> · ${esc(status)}</p><div class="notice" style="margin-top:12px"><strong>현재 상태의 판단 근거</strong>${[...new Set(reasons)].map(r=>`<p>${esc(r)}</p>`).join('')||'<p>등록된 자료의 검수를 진행 중입니다.</p>'}</div><label class="field">상태<select name="status" class="input"><option value="등록됨" ${manual==='등록됨'?'selected':''}>${manual==='등록됨'?esc(status):'자동 판단 적용'}</option><option ${manual==='추가 검수 필요'?'selected':''}>추가 검수 필요</option><option ${manual==='해당 없음'?'selected':''}>해당 없음</option></select></label>`+field('reason','담당자 판단·변경 사유',entry.reason),v=>{mark(c(),id,v.status,v.reason);log(`서류 상태: ${id} · ${v.status} · ${v.reason}`);});
}
const docSection=b.closest('[data-doc-id]');
const activeDoc=()=>c().documents.find(x=>x.id===docSection?.dataset.docId);
const summaryInput=()=>docSection?.querySelector('.doc-summary');
if(a==='add-doc-field'){const doc=activeDoc();if(!doc)throw Error('파일을 먼저 연결하세요.');const item=catalog.find(x=>x.id===doc.catalogId);modal('수동 추출 항목 입력',`<p class="sub">항목 후보: ${esc(item.fields.join(' / '))}</p>`+field('label','항목명',item.fields[0])+field('value','원문에서 확인한 값'),v=>{addField(c(),doc,v.label,v.value);log(`수동 항목 입력: ${doc.name} · ${v.label}`);});}
if(a==='doc-summary-save'){const doc=activeDoc(),value=summaryInput().value;if(!value.trim())throw Error('문서 요약을 입력하세요.');modal('문서 요약 수정',field('reason','수정 사유'),v=>{const old=doc.summary;doc.summary=value;doc.summaryManuallyEdited=true;doc.summaryApproved=false;invalidate(c());log(`문서 요약 수정: ${doc.name} · ${old} → ${value} · ${v.reason}`);});}
if(a==='doc-summary-confirm'){const doc=activeDoc();if(!doc.summary.trim()||doc.summary!==summaryInput().value)throw Error('문서 요약을 먼저 입력·저장하세요.');doc.summaryApproved=true;log(`문서별 요약 확인: ${doc.name}`);}
if(a==='upload'){replacementDocId='';$('#files').value='';$('#files').multiple=true;$('#files').click();return;}
if(a==='notes'){c().notes=$('[name="notes"]').value;log('업무 메모 저장');toast('메모를 저장했습니다.');}
if(a==='classify')openClassification([c().documents[i]]);
if(a==='classify-type')openClassification(linked(c(),b.dataset.id));
if(a==='edit')modal('추출값 수정',field('value',c().fields[i].label,c().fields[i].value)+field('reason','수정 사유'),d=>{revise(c(),i,d.value,d.reason,actor());const doc=c().documents.find(x=>x.id===c().fields[i].docId);if(doc)doc.summaryApproved=false;});
if(a==='confirm'){if(!String(c().fields[i].value).trim())throw Error('빈 값은 입력하거나 사유를 적어 예외 승인하세요.');c().fields[i].status='confirmed';c().fields[i].reason='사람 확인 완료 (화면 체험)';log(`${c().fields[i].label} 확인`);}
if(a==='exception')modal('미해결 항목 예외 승인',`<p class="sub">${esc(c().fields[i].label)} · 미해결 상태를 검수 부록에 남깁니다.</p>`+field('reason','예외 승인 사유'),d=>{c().fields[i].status='exception';c().fields[i].reason=d.reason;log(`예외 승인: ${c().fields[i].label} · ${d.reason}`);},'예외 승인');
if(a==='summary-save'){const value=$('#summary').value;if(!value.trim())throw Error('요약 내용을 입력하세요.');modal('요약 수정 사유',field('reason','수정 사유'),d=>{const old=c().summary;c().summary=value;c().summaryManuallyEdited=true;c().summaryApproved=false;c().approved=false;c().version++;log(`요약 수정: ${old} → ${value} · ${d.reason}`);});}
if(a==='summary-confirm'){if($('#summary').value!==c().summary)throw Error('변경한 요약을 먼저 저장하세요.');if(!c().summary.trim())throw Error('요약을 입력하고 저장하세요.');c().summaryApproved=true;log('요약 확인 완료');}
if(a==='approve'){if(docPending(c()))throw Error('등록 파일의 분류·추출 항목·문서별 요약을 확인하세요.');approve(c(),actor());save();toast('검수 확정 완료. Word 생성은 연결 전입니다.');}
if(a==='correction')modal('보정 요구 등록',field('title','원문에서 확인한 요구사항')+field('due','원문에서 확인한 기한','','date'),d=>{c().corrections.push({...d,done:false});log(`보정 요구 등록: ${d.title} · ${d.due}`);});
if(a==='correction-done'){c().corrections[i].done=!c().corrections[i].done;log(`보정 항목 상태 변경: ${c().corrections[i].title}`);}
render();
}catch(err){toast(err.message);}});
setupConsultations({getCase:c,save,actor,ensureEdit,render,writeAttachments,readAttachment,rollbackAttachments,modal,toast});
render();
