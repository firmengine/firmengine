import {catalog} from './catalog.mjs';
export {catalog};
export function hydrate(c){
 c.checklist??={};c.documents??=[];c.fields??=[];
 for(const item of catalog)c.checklist[item.id]??={status:'미제출',reason:''};
 c.documents.forEach((d,i)=>{d.id??=`legacy-${i}`;if(d.type==='부채증명서·채무확인서·채무잔액 확인서'){const n=d.name.replace(/[\s_·()（）.\-]/g,'').replace(/\.[^.]+$/,'');const target=n.includes('채무잔액확인서')?'채무잔액 확인서':n.includes('채무확인서')?'채무확인서':n.includes('부채증명서')?'부채증명서':null;const found=target&&catalog.find(x=>x.name===target);if(found){d.catalogId=found.id;d.type=found.name;}else{d.catalogId=undefined;d.type='미분류';d.classificationMethod='filename';d.classificationNote='기존 통합 분류 · 파일명만으로 세부 종류 확인 필요';}}if(!d.catalogId){const found=(d.type==='진술서'&&d.name.includes('손글씨')?catalog.find(x=>x.name==='진술서(손글씨)'):null)||catalog.find(x=>x.name===d.type)||catalog.find(x=>x.name.startsWith(d.type)&&d.type!=='미분류');if(found)d.catalogId=found.id;}d.summary??='';d.summaryApproved??=false;});
 // Preserve existing values, notes and statuses; bind only recognized legacy fields.
 for(const f of c.fields){if(!f.docId){const d=c.documents.find(x=>f.source?.startsWith(x.type));if(d)f.docId=d.id;}}
}
export function linked(c,id){return c.documents.filter(d=>d.catalogId===id);}
export function itemStatus(c,id){const entry=c.checklist[id];if(entry.status==='해당 없음')return '해당 없음';const docs=linked(c,id);if(!docs.length)return '미제출';if(['일부 제출','추가 검수 필요'].includes(entry.status)||docs.some(d=>d.classificationMethod==='filename'))return '추가 검수 필요';const fields=c.fields.filter(f=>docs.some(d=>d.id===f.docId));if(docs.every(d=>d.summaryApproved)&&fields.length&&fields.every(f=>f.status==='confirmed'||f.status==='exception'))return '검수 완료';if(fields.some(f=>f.status==='pending'&&/판독|불일치|누락|재확인/.test(f.reason||'')))return '추가 검수 필요';return '검수중';}
export function autoClassify(doc){
 const compact=v=>v.replace(/[\s_·()（）.\-]/g,'');const name=compact(doc.name.replace(/\.[^.]+$/,''));
 const candidates=catalog.filter(x=>x.name.split('·').some(part=>name.includes(compact(part)))||compact(x.name).includes(name));
 const unique=candidates.filter(x=>!candidates.some(y=>y!==x&&compact(y.name).length>compact(x.name).length&&name.includes(compact(y.name))));
 let found=unique.length===1?unique[0]:null;
 if(name.includes('진술서'))found=catalog.find(x=>x.name===(name.includes('손글씨')?'진술서(손글씨)':'진술서(정형 양식)'));
 doc.classificationMethod='filename';doc.classificationNote=found?'파일명 기반 잠정 분류 · 본문 OCR 미실행':'분류 불확실 · 본문 OCR 연결 필요';
 if(found){doc.catalogId=found.id;doc.type=found.name;}return doc;
}
export function invalidate(c){c.version++;c.approved=false;c.summaryApproved=false;}
export function bind(c,doc,itemId,reason){if(!reason?.trim())throw Error('분류 사유가 필요합니다.');const item=catalog.find(x=>x.id===itemId);if(!item)throw Error('목록에서 서류를 선택하세요.');doc.catalogId=itemId;doc.type=item.name;doc.classificationMethod='manual';doc.classificationNote='사람이 분류 수정·확인';doc.summaryApproved=false;c.checklist[itemId]={status:'등록됨',reason};c.fields.filter(f=>f.docId===doc.id).forEach(f=>{f.status='pending';f.reason='분류 변경 후 재확인 필요';});invalidate(c);}
export function mark(c,id,status,reason){if(!reason?.trim())throw Error('상태 변경 사유가 필요합니다.');if(status==='해당 없음'&&linked(c,id).length)throw Error('연결된 자료가 있습니다. 분류를 먼저 변경하세요.');if(['일부 제출','추가 검수 필요'].includes(status)&&!linked(c,id).length)throw Error('파일명을 먼저 등록하세요.');c.checklist[id]={status,reason};invalidate(c);}
export function addField(c,doc,label,value){if(!label.trim())throw Error('항목명이 필요합니다.');c.fields.push({label,value,docId:doc.id,status:'pending',source:`${doc.type} · ${doc.pages}쪽`,reason:'수동 입력 · 원문 확인 필요'});doc.summaryApproved=false;invalidate(c);}
export function docPending(c){return c.documents.some(d=>!d.catalogId||!d.summaryApproved||!c.fields.some(f=>f.docId===d.id));}
