import {catalog} from './catalog.mjs';

const aliases={
 D01:['신용정보조회서','신용정보 조회서'],D02:['채권자변동정보','채권자 변동 정보'],D03:['보험료 미납내역서'],
 D04:['지방 및 장기요양보험료 미납 안내','장기요양보험료 미납 안내'],D05:['매각채권 내역','채권 매각 내역'],
 D06:['부채증명서'],D49:['채무확인서'],D50:['채무잔액 확인서','채무잔액확인서'],D07:['금융거래확인서'],
 D08:['예금 보유 현황','예금 잔액 증명'],D09:['임차보증금 현황'],D10:['보험내역 조회결과','보험가입내역 조회'],
 D11:['미청구보험금 조회결과'],D12:['휴면보험금 조회결과'],D13:['미회신 회원사'],D14:['예상해약환급금 안내서'],
 D15:['중고차 시세'],D16:['자동차등록원부'],D17:['오피스텔 임대차 계약서'],D18:['부동산 임대차 계약서'],
 D19:['지방세 세목별 과세증명서'],D20:['지적전산자료 조회결과','토지 소유 현황'],D21:['사업자등록증명'],
 D22:['은행 거래내역'],D23:['회원 거래계좌별 내역 증명서'],D24:['건강보험자격득실확인서'],
 D25:['건강·장기요양보험료 납부확인서','건강보험료 납부확인서'],D26:['국민연금 가입자 가입증명'],
 D27:['연금산정용 가입내역 확인서'],D28:['개인회생 신청용 확인서'],D29:['납세증명서'],D30:['소득금액증명'],
 D31:['납부내역증명'],D32:['진술서'],D33:['진술서'],D34:['출입국에 관한 사실증명'],
 D35:['가족관계증명서'],D36:['혼인관계증명서'],D37:['주민등록표 등본','주민등록등본'],D38:['주민등록표 초본','주민등록초본'],
 D39:['계좌개설확인서'],D40:['소송위임장'],D41:['경유확인서'],D42:['개인회생절차 개시신청서'],
 D43:['개인회생 채권자 목록'],D44:['변제계획안 제출서'],D45:['변제계획(안)'],D46:['개인회생채권 변제예정액표'],
 D47:['재산목록'],D48:['수입 및 지출에 관한 목록']
};

const compact=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[\s\p{P}\p{S}]+/gu,'');
const normalizedLines=text=>String(text??'').split(/\n+/).map(line=>line.replace(/\s+/g,' ').trim()).filter(Boolean);

export function classifyPage(text){
 const all=compact(text);if(all.length<8)return {item:null,confidence:0,reason:'읽을 수 있는 글자가 부족합니다.'};
 const candidates=[];
 for(const item of catalog){
  const terms=[item.name,...(aliases[item.id]||[])].map(compact).filter(term=>term.length>=4);
  const matches=terms.filter(term=>all.includes(term));if(!matches.length)continue;
  const topLine=normalizedLines(text).slice(0,8).map(compact).join(' ');
  const titleHit=matches.some(term=>topLine.includes(term));
  const bestLength=Math.max(...matches.map(x=>x.length));
  let score=bestLength+(titleHit?40:0);
  if(['D32','D33'].includes(item.id)&&matches.some(x=>x==='진술서'))score+=text.includes('경력')||text.includes('채무 발생')?14:0;
  candidates.push({item,score,confidence:Math.min(99,Math.round(52+score*0.55)),titleHit});
 }
 candidates.sort((a,b)=>b.score-a.score);
 const first=candidates[0],second=candidates[1];
 const statementHits=candidates.filter(x=>['D32','D33'].includes(x.item.id));
 if(statementHits.length===2&&all.includes('진술서')){
  const structured=/경력|가족관계|과거절차|채무발생원인|정형양식|진술내용/.test(all);
  const handwritten=/손글씨|자필|수기/.test(all);
  if(structured!==handwritten){const item=catalog.find(x=>x.id===(structured?'D32':'D33'));return {item,confidence:structured?72:68,reason:'진술서 형식 단서 · 사람 확인 필요'};}
  return {item:null,confidence:statementHits[0].confidence,reason:'정형 양식과 손글씨 진술서를 구분할 단서가 부족합니다.'};
 }
 if(!first)return {item:null,confidence:0,reason:'서류 제목을 찾지 못했습니다.'};
 if(candidates.length>2&&!first.titleHit)return {item:null,confidence:first.confidence,reason:'여러 서류명이 본문에 함께 있어 제목 페이지인지 확인이 필요합니다.'};
 if(second&&first.score-second.score<8)return {item:null,confidence:first.confidence,reason:'여러 서류 제목이 함께 나와 분류가 모호합니다.'};
 if(first.score<8)return {item:null,confidence:first.confidence,reason:'제목 단서가 부족합니다.'};
 if(['D32','D33'].includes(first.item.id)){
  if(text.includes('경력')||text.includes('주거')||text.includes('과거 절차'))first.item=catalog.find(x=>x.id==='D32');
  else if(/손글씨|자필/.test(text))first.item=catalog.find(x=>x.id==='D33');
 }
 return {item:first.item,confidence:first.confidence,reason:first.titleHit?'본문 제목 일치':'본문 키워드 일치'};
}

const fieldAliases={
 '원금':['원금','대출원금'], '이자·연체금':['이자','연체금','지연손해금'], '합계':['합계','총액','총계'],
 '금액':['금액','잔액','합계'], '미납액':['미납액','미납금'], '미납기간':['미납기간','체납기간'],
 '보증금':['보증금','임차보증금'], '월세':['월세','차임'], '소득금액':['소득금액'], '수입금액':['수입금액'],
 '대출 잔액':['대출잔액','대출 잔액','잔액'], '예상해약환급금':['예상해약환급금','해약환급금'],
 '채권자':['채권자','금융기관','채권기관'], '채무자':['채무자','성명'], '발급일':['발급일','발급 일자'],
 '기준일':['기준일','기준 일자','조회일'], '귀속연도':['귀속연도','과세연도','연도'],
 '신청 경위':['신청 경위','신청하게 된 경위','신청 사유'], '채무 증가 원인':['채무 증가 원인','채무 발생 원인','채무가 증가한 이유'],
 '현재 상황':['현재 상황','현재 소득','현재 수입'], '향후 계획':['향후 계획','변제 계획'], '경력':['경력','직업·경력'],
 '가족관계':['가족관계','가족 관계','가족 구성']
};

export function extractFieldValue(label,text){
 const lines=normalizedLines(text);if(label==='원문')return String(text).trim().slice(0,4000);
 const terms=(fieldAliases[label]||[label]).map(compact).filter(term=>term.length>=2);
 const exact=lines.filter(line=>{const normalized=compact(line);return terms.some(term=>normalized.includes(term));});
 const amount=/\d[\d,]*(?:\.\d+)?\s*(?:원|만원|억원)?/;
 const ranked=exact.map(line=>({line,score:(terms.some(term=>compact(line).startsWith(term))?3:1)+(amount.test(line)?2:0)})).sort((a,b)=>b.score-a.score);
 const selected=ranked.slice(0,3).map(x=>x.line);
 if(!selected.length)return {value:'',reason:'본문에서 항목을 특정하지 못함 · 원문 확인 필요'};
 const value=selected.join('\n').slice(0,1200);
 const numeric=/원|금액|액|잔액|소득|환급|보증금|월세|차임|합계/.test(label);
 const numbers=[...value.matchAll(/\d[\d,]*(?:\.\d+)?\s*(?:원|만원|억원)?/g)].map(x=>x[0]);
 return {value,reason:numeric?(numbers.length>1?'숫자 후보가 여러 개 · 기준과 단위 확인 필요':numbers.length?'숫자 후보 추출 · 단위와 원문 확인 필요':'금액 후보 없음 · 원문 확인 필요'):'본문에서 후보 문구 추출 · 원문 확인 필요'};
}

export function groupClassifiedPages(pages){
 const groups=[];let current=null;
 for(const page of pages){
  if(!page.item){current=null;continue;}
  if(current&&current.item.id===page.item.id&&current.end+1===page.page){current.end=page.page;current.pages.push(page);current.confidence=Math.min(current.confidence,page.confidence);}
  else{current={item:page.item,start:page.page,end:page.page,pages:[page],confidence:page.confidence};groups.push(current);}
 }
 return groups;
}
