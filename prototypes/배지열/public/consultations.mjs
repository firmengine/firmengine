import {createLocalReader} from './local-reader.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const channels=['전화','카카오톡','대면','온라인','기타'];
const outcomes=['추가 상담','자료 요청','수임 검토','수임 완료','상담 종결'];
let api,selected='',selectedCase='',busy=false;
const urls=new Map();
const localDate=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
function ensure(c){
 if(!Array.isArray(c.consultations))c.consultations=c.notes?[{...blank(c),id:'legacy-consultation',title:'기존 상담 메모',at:'',channel:'온라인',summary:c.notes}]:[];
 if(selectedCase!==c.id){selectedCase=c.id;selected=c.consultations[0]?.id||'';}
 return c.consultations;
}
function blank(c){return {id:crypto.randomUUID(),title:'사건 상담',at:localDate(),channel:'전화',counselor:c.owner||'배지열',counterparty:c.name,outcome:'추가 상담',nextAt:'',summary:'',conversation:'',debt:'',income:'',assets:'',household:'',urgent:'',analysis:{summary:'',issues:'',questions:'',actions:'',confirmed:false},attachments:[],tasks:[]};}
function current(){return ensure(api.getCase()).find(x=>x.id===selected);}
function audit(text,c=api.getCase()){c.logs.unshift({at:new Date().toISOString(),actor:api.actor(),text});}
function persist(record,message,c=api.getCase()){record.updatedAt=new Date().toISOString();if(message)audit(message,c);api.save();}
function input(name,label,value='',type='text'){return `<label class="field">${label}<input data-consult-field="${name}" type="${type}" value="${esc(value)}"></label>`;}
function area(name,label,value='',placeholder=''){return `<label class="field">${label}<textarea data-consult-field="${name}" placeholder="${esc(placeholder)}">${esc(value)}</textarea></label>`;}
const action=(name,label,extra='',primary=false)=>`<button type="button" class="btn ${primary?'primary':''}" data-consult-action="${name}" ${extra}>${label}</button>`;
function panel(title,body,extra=''){return `<section class="panel"><div class="panel-head"><h2>${title}</h2>${extra}</div><div class="panel-body">${body}</div></section>`;}
function displayTime(value){return value?value.replace('T',' '):'일시 미입력';}
function attachmentList(r){return r.attachments.map(file=>`<div class="consult-file"><div><strong>${esc(file.name)}</strong><p class="sub">${file.size<1048576?Math.max(1,Math.ceil(file.size/1024))+' KB':(file.size/1048576).toFixed(1)+' MB'} · ${esc(file.readStatus||(/audio|video/.test(file.mime)?'음성 전사 대기':'원본 저장됨'))}</p></div><div class="row">${action('file-open','열기',`data-id="${file.id}"`)}${action('file-remove','삭제',`data-id="${file.id}"`)}</div></div>`).join('')||'<p class="sub">아직 첨부한 자료가 없습니다.</p>';}
export function renderConsultations(c,context){
 const records=ensure(c);const r=records.find(x=>x.id===selected)||records[0];if(r){selected=r.id;r.attachments??=[];r.tasks??=[];r.analysis??={};}
 const pending=records.reduce((n,r)=>n+(r.tasks||[]).filter(t=>!t.done).length,0);
 const next=records.filter(r=>r.nextAt&&r.outcome!=='상담 종결').sort((a,b)=>a.nextAt.localeCompare(b.nextAt))[0];
 return `<div class="page-head"><div><div class="eyebrow">CASE CONSULTATION</div><h1>상담 이력</h1><p class="sub">상담 내용과 원본 자료를 모으고, 사건별 확인 사항과 다음 업무를 기록합니다.</p></div>${action('new','＋ 상담 기록 추가','',true)}</div>${context}<div class="stats consult-stats"><div class="stat"><div class="label">누적 상담</div><strong>${records.length}<small> 건</small></strong></div><div class="stat"><div class="label">남은 후속 업무</div><strong>${pending}<small> 건</small></strong></div><div class="stat"><div class="label">다음 연락</div><strong class="consult-next">${next?esc(displayTime(next.nextAt)):'일정 미정'}</strong><small>${next?esc(next.counterparty||next.title):'상담 기록에 일정을 등록하세요'}</small></div></div><div class="consult-layout"><section class="panel consult-history"><div class="panel-head"><h2>상담 기록</h2><span class="badge blue">${records.length}건</span></div>${records.map(x=>`<button class="consult-history-item ${x.id===r?.id?'active':''}" data-consult-action="select" data-id="${x.id}"><span class="sub">${esc(displayTime(x.at))} · ${esc(x.channel)}</span><strong>${esc(x.title)}</strong><span>${esc(x.summary||'상담 요약을 작성하세요').slice(0,90)}</span><small>${esc(x.counselor)} · ${esc(x.outcome)}</small></button>`).join('')||'<p class="empty">상담 기록을 추가하세요.</p>'}</section><div class="consult-detail">${r?detail(r):panel('사건 상담','<p class="empty">상담 기록 추가를 눌러 첫 상담을 등록하세요.</p>')}</div></div>`;
}
function detail(r){return panel(esc(r.title),`<div class="consult-meta"><span>${esc(displayTime(r.at))} · ${esc(r.channel)}</span><span>상담자 ${esc(r.counselor)} · 상대방 ${esc(r.counterparty)}</span><span class="badge blue">${esc(r.outcome)}</span></div><p class="sub">입력 내용은 이 브라우저에 자동 저장됩니다.</p>`,action('edit-meta','상담 정보 수정'))+
 panel('상담 내용',area('summary','상담 내용 요약',r.summary,'상담 목적, 의뢰인의 요청, 안내한 내용과 합의한 내용을 기록하세요.')+area('conversation','상세 상담 내용 · 대화 원문 · 통화 전사문',r.conversation,'카카오톡 대화를 붙여넣거나, 통화 전사 내용을 기록하세요. 녹음 원본은 아래에 첨부할 수 있습니다.')+`<div class="consult-facts">${input('debt','채무 현황',r.debt)}${input('income','소득 · 직업',r.income)}${input('assets','재산 · 주거',r.assets)}${input('household','가족 · 부양관계',r.household)}</div>${area('urgent','긴급 확인 사항 · 기한',r.urgent,'압류·추심 상황, 예정된 기일 등 확인이 필요한 내용을 기록하세요.')}<div class="row">${action('save','상담 내용 저장','',true)}<span id="consult-save-status" class="sub" role="status"></span></div>`)+
 panel('카카오톡 · 통화 · 상담 자료',`<input id="consult-files" type="file" accept=".txt,.csv,.json,.html,.pdf,.jpg,.jpeg,.png,.mp3,.m4a,.wav,.ogg,.mp4,.webm" multiple hidden><div class="consult-drop ${busy?'is-busy':''}" id="consult-drop"><strong>상담 자료를 여기에 끌어놓으세요</strong><p class="sub">카카오톡 내보내기 · 캡처 · PDF · 통화 녹음</p>${action('upload',busy?'처리 중…':'＋ 파일 선택',busy?'disabled':'',true)}<small>원본은 이 PC의 현재 브라우저에 보관됩니다. 녹음은 재생할 수 있으며 자동 음성 전사는 연결 예정입니다.</small></div><div>${attachmentList(r)}</div>`)+
 panel('분석 · 요약 검토',`<div class="notice">AI 분석·요약과 음성 전사 서비스는 연결 전입니다. 현재는 첨부된 텍스트·PDF·사진을 로컬에서 읽어 근거 문장을 정리한 초안을 만들 수 있습니다.</div><div class="row consult-analysis-actions">${action('draft','자료 읽고 정리 초안 만들기',busy?'disabled':'',true)}<button type="button" class="btn" disabled title="AI 서비스 연결 후 사용할 수 있습니다">AI 분석·요약 · 연결 예정</button><span id="consult-progress" class="sub" role="status"></span></div><div class="consult-analysis-grid">${area('analysis.summary','상담 요약 초안',r.analysis.summary,'원문을 확인한 뒤 상담 핵심 내용을 정리하세요.')}${area('analysis.issues','사건 쟁점 · 주의 사항',r.analysis.issues,'추가 검토가 필요한 사실과 서로 다른 진술을 적으세요.')}${area('analysis.questions','추가 질문 · 요청할 자료',r.analysis.questions,'다음 상담에서 확인할 질문과 요청할 서류를 적으세요.')}${area('analysis.actions','안내 내용 · 후속 조치',r.analysis.actions,'누가 무엇을 언제까지 할지 정리하세요.')}</div><div class="row between"><span class="badge ${r.analysis.confirmed?'green':'orange'}" id="consult-analysis-status">${r.analysis.confirmed?'사람 검토 완료':'사람 확인 필요'}</span><div class="row">${action('save','수정 저장')}${action('confirm-analysis','검토 완료','',true)}</div></div>`)+
 panel('후속 업무 · 다음 상담',`<div class="consult-followup">${input('nextAt','다음 연락 · 상담 일시',r.nextAt,'datetime-local')}<label class="field">상담 결과<select data-consult-field="outcome">${outcomes.map(x=>`<option ${r.outcome===x?'selected':''}>${x}</option>`).join('')}</select></label></div><div class="consult-tasks">${r.tasks.map(t=>`<div class="consult-task"><label><input type="checkbox" data-consult-task="${t.id}" ${t.done?'checked':''}><span class="${t.done?'done':''}">${esc(t.text)}</span></label><span class="sub">${esc(t.owner||'담당 미정')} · ${esc(t.due||'기한 미정')}</span>${action('remove-task','삭제',`data-id="${t.id}"`)}</div>`).join('')||'<p class="sub">요청할 자료, 추가 연락, 내부 검토 업무를 등록하세요.</p>'}</div>${action('add-task','＋ 후속 업무 추가')}`);
}

export function setupConsultations(dependencies){
 api=dependencies;
 document.addEventListener('input',e=>{
  const name=e.target.dataset.consultField;if(!name||!api.ensureEdit())return;const r=current();if(!r)return;
  if(name.startsWith('analysis.'))r.analysis[name.slice(9)]=e.target.value;else r[name]=e.target.value;
  if(r.analysis.confirmed){r.analysis.confirmed=false;audit('상담 검토 완료 후 내용 수정 · 재검토 필요');}
  persist(r);const status=document.querySelector('#consult-analysis-status');if(status){status.textContent='사람 확인 필요';status.className='badge orange';}
  const saved=document.querySelector('#consult-save-status');if(saved)saved.textContent='자동 저장됨';
 });
 document.addEventListener('change',e=>{if(e.target.id==='consult-files')upload(e.target.files).catch(error=>api.toast(error.message||'첨부파일 저장에 실패했습니다.'));if(['nextAt','outcome'].includes(e.target.dataset.consultField))api.render();if(e.target.dataset.consultTask){if(!api.ensureEdit())return;const r=current(),task=r.tasks.find(t=>t.id===e.target.dataset.consultTask);if(task){task.done=e.target.checked;persist(r,`상담 후속 업무 ${task.done?'완료':'다시 열기'}: ${task.text}`);api.render();}}});
 document.addEventListener('dragover',e=>{const zone=e.target.closest?.('#consult-drop');if(zone&&Array.from(e.dataTransfer?.types||[]).includes('Files')){e.preventDefault();e.dataTransfer.dropEffect=busy?'none':'copy';zone.classList.add('drag-active');}});
 document.addEventListener('dragleave',e=>{const zone=e.target.closest?.('#consult-drop');if(zone&&!zone.contains(e.relatedTarget))zone.classList.remove('drag-active');});
 document.addEventListener('drop',e=>{const zone=e.target.closest?.('#consult-drop');if(zone){e.preventDefault();zone.classList.remove('drag-active');upload(e.dataTransfer.files).catch(error=>api.toast(error.message||'첨부파일 저장에 실패했습니다.'));}});
 document.addEventListener('click',e=>{const b=e.target.closest('[data-consult-action]');if(!b)return;handle(b).catch(error=>api.toast(error.message||'상담 처리를 완료하지 못했습니다.'));});
}
function metaForm(r){return `<label class="field">상담 제목<input name="title" required value="${esc(r.title)}"></label><div class="consult-followup"><label class="field">상담 일시<input name="at" type="datetime-local" value="${esc(r.at)}"></label><label class="field">상담 방식<select name="channel">${channels.map(x=>`<option ${r.channel===x?'selected':''}>${x}</option>`).join('')}</select></label></div><label class="field">상담자<input name="counselor" required value="${esc(r.counselor)}"></label><label class="field">상담 상대방<input name="counterparty" required value="${esc(r.counterparty)}"></label>`;}
async function handle(b){
 const name=b.dataset.consultAction;
 if(busy&&['select','new','edit-meta','file-remove','draft'].includes(name)){api.toast('자료 처리가 끝난 뒤 이용하세요.');return;}
 if(name==='select'){selected=b.dataset.id;api.render();return;}
 if(name==='file-open'){await openFile(b.dataset.id);return;}
 if(!api.ensureEdit())return;const c=api.getCase();ensure(c);const r=current();
 if(name==='new'){const record=blank(c);api.modal('상담 기록 추가',metaForm(record),values=>{Object.assign(record,values);c.consultations.unshift(record);selected=record.id;persist(record,'상담 기록 추가: '+record.title);},'추가');return;}
 if(!r)return;
 if(name==='edit-meta'){api.modal('상담 정보 수정',metaForm(r),values=>{Object.assign(r,values);persist(r,'상담 기본정보 수정: '+r.title);});return;}
 if(name==='upload'){document.querySelector('#consult-files').click();return;}
 if(name==='save'){persist(r,'상담 내용 저장: '+r.title);api.render();api.toast('상담 내용을 저장했습니다.');return;}
 if(name==='confirm-analysis'){if(!r.analysis.summary?.trim())throw Error('상담 요약 초안을 먼저 작성하세요.');r.analysis.confirmed=true;persist(r,'상담 분석·요약 사람 검토 완료: '+r.title);api.render();return;}
 if(name==='draft'){await makeDraft(r,c);return;}
 if(name==='add-task'){api.modal('후속 업무 추가',`<label class="field">할 일<input name="text" required placeholder="예: 최근 소득자료 요청"></label><label class="field">담당자<input name="owner" required value="${esc(r.counselor)}"></label><label class="field">기한<input name="due" type="date"></label>`,values=>{r.tasks.push({id:crypto.randomUUID(),...values,done:false});persist(r,'상담 후속 업무 추가: '+values.text);},'추가');return;}
 if(name==='remove-task'){const task=r.tasks.find(t=>t.id===b.dataset.id);r.tasks=r.tasks.filter(t=>t.id!==b.dataset.id);persist(r,'상담 후속 업무 삭제: '+task?.text);api.render();return;}
 if(name==='file-remove'){const file=r.attachments.find(f=>f.id===b.dataset.id);await api.rollbackAttachments([file.id]);r.attachments=r.attachments.filter(f=>f.id!==file.id);r.analysis.confirmed=false;persist(r,'상담 첨부 삭제: '+file.name);api.render();}
}
async function upload(files){
 if(busy||!api.ensureEdit())return;const r=current(),c=api.getCase();if(!r)return;
 const list=Array.from(files||[]),accepted=list.filter(f=>/\.(txt|csv|json|html|pdf|jpe?g|png|mp3|m4a|wav|ogg|mp4|webm)$/i.test(f.name)&&f.size);
 if(!accepted.length){api.toast('텍스트·PDF·사진·통화 녹음 파일을 선택하세요.');return;}
 busy=true;
 try{const entries=accepted.map(file=>({id:crypto.randomUUID(),caseId:c.id,consultationId:r.id,name:file.name,type:mime(file),blob:file.slice(0,file.size,mime(file))}));await api.writeAttachments(entries);r.attachments.push(...entries.map((entry,i)=>({id:entry.id,name:entry.name,mime:entry.type,size:accepted[i].size,readStatus:/audio|video/.test(entry.type)?'음성 전사 대기':'원본 저장됨'})));r.analysis.confirmed=false;persist(r,`상담 자료 ${entries.length}건 첨부`,c);api.toast(`${entries.length}개 상담 자료를 첨부했습니다.${list.length>accepted.length?' 지원하지 않는 파일은 제외했습니다.':''}`);}
 finally{busy=false;api.render();}
}
function mime(file){const extension=file.name.split('.').pop().toLowerCase();return {txt:'text/plain',csv:'text/csv',json:'application/json',html:'text/html',pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',mp3:'audio/mpeg',m4a:'audio/mp4',wav:'audio/wav',ogg:'audio/ogg',mp4:'video/mp4',webm:'audio/webm'}[extension]||file.type||'application/octet-stream';}
async function openFile(id){
 const record=await api.readAttachment(id);if(!record?.blob)throw Error('저장된 원본 파일을 찾지 못했습니다.');let url=urls.get(id);if(!url){url=URL.createObjectURL(record.blob);urls.set(id,url);}
 const file=current().attachments.find(f=>f.id===id),type=file?.mime||record.type;let content='';
 if(/^(audio|video)/.test(type))content=`<audio controls src="${url}" style="width:100%"></audio><p class="sub">전사문은 상세 상담 내용에 입력할 수 있습니다.</p>`;
 else if(type.startsWith('image/'))content=`<img class="consult-preview-image" src="${url}" alt="${esc(record.name)}">`;
 else if(type==='application/pdf')content=`<iframe class="consult-preview-pdf" src="${url}" title="${esc(record.name)}"></iframe>`;
 else content=`<pre class="consult-original">${esc(await readText(record.blob))}</pre>`;
 api.modal(record.name,content+`<a class="btn" href="${url}" download="${esc(record.name)}">원본 내려받기</a>`,()=>{},'닫기');
}
async function readText(blob){const bytes=await blob.arrayBuffer();let text=new TextDecoder('utf-8').decode(bytes);if((text.match(/�/g)||[]).length>3)text=new TextDecoder('euc-kr').decode(bytes);return text.slice(0,150000);}
async function makeDraft(r,c){
 const progress=document.querySelector('#consult-progress');busy=true;document.querySelectorAll('[data-consult-action="draft"],[data-consult-action="upload"]').forEach(b=>b.disabled=true);
 const reader=createLocalReader(message=>{if(progress?.isConnected)progress.textContent=`${message.fileName} · ${message.page}/${message.total||'?'}쪽 · ${message.phase}`;});
 const sources=[];if(r.summary.trim())sources.push({name:'직접 작성한 상담 요약',text:r.summary});if(r.conversation.trim())sources.push({name:'상세 상담 내용',text:r.conversation});
 try{
  for(let i=0;i<r.attachments.length;i++){
   const file=r.attachments[i];if(/^(audio|video)/.test(file.mime)){file.readStatus='음성 전사 연결 필요 · 녹음 재생 가능';continue;}
   try{const stored=await api.readAttachment(file.id);if(!stored?.blob)throw Error('원본 없음');let text='';if(file.mime==='application/pdf'||file.mime.startsWith('image/')){const pages=await reader.read(stored,i,r.attachments.length);text=pages.map(p=>`[${p.page}쪽]\n${p.text}`).join('\n\n');}else{text=await readText(stored.blob);if(file.mime==='text/html')text=new DOMParser().parseFromString(text,'text/html').body.textContent||'';}
    if(text.trim()){sources.push({name:file.name,text});file.readStatus=`텍스트 판독 완료 · ${text.length.toLocaleString()}자`;}else file.readStatus='읽은 텍스트 없음 · 원문 확인 필요';
   }catch(error){file.readStatus='읽기 실패 · '+error.message;}
  }
  if(!sources.length){persist(r,'상담 자료 판독 · 읽을 수 있는 텍스트 없음');throw Error('읽을 수 있는 텍스트가 없습니다. 녹음은 전사문을 입력하고, 판독이 어려운 자료는 원문을 확인하세요.');}
  const lines=sources.flatMap(s=>s.text.split(/\n+/).map(text=>({name:s.name,text:text.trim()})).filter(x=>x.text.length>6));
  const snippets=(pattern,max=5)=>lines.filter(x=>pattern.test(x.text)).slice(0,max).map(x=>`• ${x.text.slice(0,260)} [${x.name}]`).join('\n');
  const draft={summary:lines.slice(0,6).map(x=>`• ${x.text.slice(0,260)} [${x.name}]`).join('\n'),issues:snippets(/채무|대출|연체|압류|추심|재산|보증|소득|기한|불일치/),questions:snippets(/확인|자료|서류|제출|요청|질문|모르|불명/),actions:snippets(/연락|예약|상담|보내|전달|안내|준비|약속|까지/),confirmed:false,method:'local-source-excerpts',generatedAt:new Date().toISOString()};
  const excluded=r.attachments.filter(f=>/^(audio|video)/.test(f.mime)).length;
  if(api.getCase()!==c||current()?.id!==r.id){api.toast('자료 판독을 마쳤습니다. 해당 상담 기록에서 다시 실행하세요.');return;}
  api.modal('원문 기반 정리 초안',`<div class="notice">로컬에서 찾은 원문 문장을 정리한 초안입니다. AI가 의미를 분석한 요약은 아닙니다.${excluded?` 녹음 ${excluded}건은 음성 전사 연결 전이라 포함되지 않았습니다.`:''}</div>${[['summary','상담 요약'],['issues','사건 쟁점 후보'],['questions','추가 확인 후보'],['actions','후속 조치 후보']].map(([key,title])=>`<h3>${title}</h3><pre class="consult-original">${esc(draft[key]||'해당 단서를 찾지 못했습니다. 직접 확인하세요.')}</pre>`).join('')}<p class="sub">적용하면 현재 분석·요약 내용이 이 초안으로 바뀌고 다시 검토가 필요합니다.</p>`,()=>{r.analysis=draft;persist(r,'상담 원문 기반 정리 초안 적용 · 사람 확인 필요',c);},'초안 적용');
 }finally{await reader.close();busy=false;api.save();api.render();}
}
