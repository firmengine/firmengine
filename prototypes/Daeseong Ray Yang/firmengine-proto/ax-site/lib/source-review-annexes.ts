import { factSourceLineageIssues, moneyValue, normalizeMoney, validSourceRef } from "./domain.ts";
import type { CaseData, CaseReadIndex, Fact, Transaction } from "./domain.ts";

export interface SourceReviewTable { title:string; headers:string[]; rows:string[][] }

const transactionFields={
  amount:["transaction.amount","transactions.amount","transactions[].amount","transaction_amount"],
  date:["transaction.date"],
  direction:["transaction.direction"],
  kind:["transaction.kind","transaction.type"],
  account:["transaction.account_id"],
  counterparty:["transaction.counterparty"],
  memo:["transaction.memo","transaction.description"],
} as const;
const guaranteeKey=(key:string)=>/^debt\./i.test(key)&&/(?:guarantee|surety|guarant|보증|연대|recourse|구상|liability_role|claim_nature|underlying_obligation|underlying_debt_id)/iu.test(key);
const guaranteeContextKeys=new Set(["debt.creditor","debt.debtor","debt.contract_id"]);
const display=(value:unknown)=>value===null||value===undefined||value===""?"[확인 필요]":typeof value==="object"?JSON.stringify(value):String(value);
const rawMoney=(fact:Fact)=>fact.numeric?`${String(fact.numeric.rawValue??"[원문값 없음]")} ${fact.numeric.unit||"[단위 미확인]"}`.trim():display(fact.value);
const unitKey=(unit:string)=>unit.normalize("NFKC").trim().toLocaleLowerCase();

function exactSourceMoney(fact:Fact,data:CaseData,index:CaseReadIndex,directionFacts:Fact[]=[],rowContextFacts:Fact[]=[]):{amount:bigint;display:string}|null{
  const numeric=fact.numeric;
  if(!numeric||typeof fact.value!=="string"&&typeof fact.value!=="number")return null;
  const sourceUnit=Object.hasOwn(fact,"sourceUnit")?fact.sourceUnit:numeric.unit;
  if(typeof sourceUnit!=="string"||!sourceUnit.trim()||unitKey(sourceUnit)!==unitKey(numeric.unit))return null;
  const factValue=normalizeMoney(String(fact.value),sourceUnit),numericValue=normalizeMoney(numeric.rawValue,numeric.unit),normalized=moneyValue(numeric);
  if(factValue.normalizationStatus!=="exact"||numericValue.normalizationStatus!=="exact"||normalized===null||normalized<0n||factValue.amountWon!==normalized.toString()||numericValue.amountWon!==normalized.toString())return null;
  if(/^debt\./i.test(fact.key)&&!/^debt\.[A-Za-z0-9_]+$/i.test(fact.key))return null;
  const localKey=(fact.key.split(".").at(-1)??fact.key).split("_").map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("[_\\s]*");
  const labelPatterns=/transaction|transactions/i.test(fact.key)
    ?["거래\\s*금액","거래액","금액","입금액","출금액","입금","출금","amount","debit","credit"]
    :["보증\\s*한도(?:액)?","보증\\s*(?:금액|액|채무액)","한도","guarantee\\s*(?:limit|amount)","surety\\s*(?:limit|amount)","limit","amount"];
  const labels=[...new Set([localKey,...labelPatterns])].join("|");
  const labelPattern=new RegExp(`(?:${labels})`,"iu");
  const labelledAmount=new RegExp(`^\\s*(?:[:：=]\\s*)?(?:\\(\\s*(백만원|천원|만원|억원|원|KRW|won)\\s*\\)\\s*)?([+-]?\\d[\\d,]*(?:\\.\\d+)?)(?:\\s*(백만원|천원|만원|억원|원|KRW|won))?`,"iu");
  const bareAmount=/^\s*([+-]?\d[\d,]*(?:\.\d+)?)\s*(백만원|천원|만원|억원|원|KRW|won)?\s*$/iu;
  const transactionAmount=/^transactions?\./iu.test(fact.key)||fact.key==="transaction_amount";
  const sameSubjectDirections=transactionAmount?directionFacts.filter(candidate=>candidate.subjectId===fact.subjectId):[];
  const normalizedDirection=(value:unknown):"in"|"out"|null=>{
    const normalized=String(value??"").normalize("NFKC").trim().toLocaleLowerCase();
    if(["in","inflow","credit","입금","수입","입금액"].includes(normalized))return "in";
    if(["out","outflow","debit","출금","지출","출금액"].includes(normalized))return "out";
    return null;
  };
  const directionQuoteSupports=(candidate:Fact,direction:"in"|"out",amountRef:Fact["refs"][number])=>{
    const terms=direction==="in"?/(?:입금|수입|\b(?:inflow|credit|in)\b)/iu:/(?:출금|지출|\b(?:outflow|debit|out)\b)/iu;
    const opposite=direction==="in"?/(?:출금|지출|\b(?:outflow|debit|out)\b)/iu:/(?:입금|수입|\b(?:inflow|credit|in)\b)/iu;
    return candidate.refs.length>0&&candidate.refs.every(ref=>{
      const quote=ref.quote.normalize("NFKC");
      return ref.documentId===amountRef.documentId&&ref.page===amountRef.page&&ref.sourceHash===amountRef.sourceHash&&terms.test(quote)&&!opposite.test(quote);
    });
  };
  let supported=false;
  for(const ref of fact.refs){
    const quote=ref.quote.normalize("NFKC");
    if(transactionAmount){
      if(/[\r\n]/u.test(quote))return null;
      const cells=quote.split(/[|\t]/u).map(cell=>cell.trim());
      const directionCells=cells.map((cell,cellIndex)=>({direction:normalizedDirection(cell),cellIndex})).filter(item=>item.direction!==null);
      if(directionCells.length){
        if(directionCells.length!==1||!sameSubjectDirections.length)return null;
        const sourceDirections=sameSubjectDirections.map(candidate=>sourceState(data,candidate,index).displayable&&normalizedDirection(candidate.value)&&directionQuoteSupports(candidate,normalizedDirection(candidate.value)!,ref)?normalizedDirection(candidate.value):null);
        const direction=directionCells[0]!.direction;
        if(sourceDirections.some(value=>value===null||value!==direction))return null;
        const numericCells=cells.map((cell,cellIndex)=>{
          const parsed=bareAmount.exec(cell);
          if(!parsed)return null;
          const amount=normalizeMoney(parsed[1]!,parsed[2]??sourceUnit);
          return amount.normalizationStatus==="exact"&&amount.amountWon!==null?{cellIndex,amount:BigInt(amount.amountWon),explicitUnit:!!parsed[2]}:null;
        }).filter((item):item is {cellIndex:number;amount:bigint;explicitUnit:boolean}=>item!==null);
        const moneyCells=numericCells.filter(item=>item.explicitUnit);
        const amountCellIndex=moneyCells.length===1?moneyCells[0]!.cellIndex:-1;
        const rowContextMatches=(cell:string,keys:readonly string[])=>rowContextFacts.some(candidate=>keys.includes(candidate.key)&&candidate.subjectId===fact.subjectId&&sourceState(data,candidate,index).displayable&&candidate.refs.some(candidateRef=>candidateRef.documentId===ref.documentId&&candidateRef.page===ref.page&&candidateRef.sourceHash===ref.sourceHash&&candidateRef.quote.normalize("NFKC").includes(cell)));
        const dateCellPattern=/^(?:\s*\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일\s*|\s*\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s*)$/u;
        const memoCounterPattern=/\p{N}+\s*(?:회|건|개|명|차례)(?![\p{L}\p{N}])/gu;
        const extraAmountCell=cells.some((cell,cellIndex)=>{
          if(cellIndex===amountCellIndex||!/[\p{N}\p{Sc}]/u.test(cell))return false;
          if(numericCells.some(item=>item.cellIndex===cellIndex))return true;
          if(/\p{Sc}/u.test(cell)||/(?:잔액|잔고|합계|총액|금액|원금|출금액|입금액|balance|total|amount)/iu.test(cell))return true;
          if(dateCellPattern.test(cell)&&rowContextMatches(cell,transactionFields.date))return false;
          if(!/[\p{L}\p{Sc}]/u.test(cell))return /\p{N}.*(?:[.,/／\\\-−–—~〜]\s*\p{N})/u.test(cell);
          const memoSupported=rowContextMatches(cell,transactionFields.memo);
          if(memoSupported&&/[\p{L}\p{N}]/u.test(cell)){
            const withoutCounters=cell.replace(memoCounterPattern,"");
            if(!/\p{N}/u.test(withoutCounters)&&!/(?:\p{N}\s*[\p{L}]|[A-Za-z]{2,}\s*\p{N})/u.test(withoutCounters))return false;
          }
          return /[\p{L}\p{N}]/u.test(cell);
        });
        if(moneyCells.length!==1||numericCells.length!==1||extraAmountCell||moneyCells[0]!.cellIndex!==directionCells[0]!.cellIndex+1||moneyCells[0]!.amount!==normalized)return null;
        supported=true;
        continue;
      }
    }
    const found:bigint[]=[];
    for(const labelMatch of quote.matchAll(new RegExp(labels,"giu"))){
      const adjacent=labelledAmount.exec(quote.slice((labelMatch.index??0)+labelMatch[0].length));
      if(!adjacent)return null;
      // Require a complete numeric/unit token. Without a recognized unit,
      // letters after the number cannot be treated as prose. After a recognized
      // unit, allow spaced Korean prose, but reject attached letters, non-Korean
      // words, currency symbols, and numeric range/fraction continuations.
      const tokenTail=quote.slice((labelMatch.index??0)+labelMatch[0].length+adjacent[0].length);
      if(/^(?:\s*[.,/／\\\-−–—~〜]\s*\p{N}|\s*[\p{Sc}\p{N}])/u.test(tokenTail))return null;
      if(adjacent[3]){
        if(/^(?:\p{L}|\s+(?:[A-Za-z]+|[^\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3\s\p{P}][^\s\p{P}]*))/u.test(tokenTail))return null;
      }else if(/^\s*\p{L}/u.test(tokenTail)||/^\s*\p{Sc}/u.test(tokenTail))return null;
      const prefix=adjacent[1]??null,suffix=adjacent[3]??null;
      const value=adjacent[2];
      const normalizedBy=(unit:string)=>normalizeMoney(value,unit);
      if(prefix&&suffix){
        const prefixValue=normalizedBy(prefix),suffixValue=normalizedBy(suffix);
        if(prefixValue.normalizationStatus!=="exact"||suffixValue.normalizationStatus!=="exact"||prefixValue.amountWon!==suffixValue.amountWon)return null;
      }
      const quoted=normalizedBy(suffix??prefix??sourceUnit);
      if(quoted.normalizationStatus!=="exact"||quoted.amountWon===null)return null;
      found.push(BigInt(quoted.amountWon));
    }
    if(found.length){
      supported=true;
      if(found.some(value=>value!==normalized)||new Set(found.map(value=>value.toString())).size>1)return null;
      continue;
    }
    if(labelPattern.test(quote))return null;
    const bare=bareAmount.exec(quote);
    if(bare){
      const quoted=normalizeMoney(bare[1],bare[2]??sourceUnit);
      if(quoted.normalizationStatus!=="exact"||quoted.amountWon!==normalized.toString())return null;
      supported=true;
    }
  }
  return supported?{amount:normalized,display:rawMoney(fact)}:null;
}

function currentOrLatestFacts(data:CaseData,index:CaseReadIndex):Fact[]{
  const grouped=new Map<string,Fact[]>();
  for(const fact of data.facts)grouped.set(fact.logicalId,[...(grouped.get(fact.logicalId)??[]),fact]);
  return [...grouped.values()].flatMap(group=>{
    const latest=Math.max(...group.map(fact=>fact.version));
    return group.filter(fact=>fact.version===latest);
  });
}
function sourceState(data:CaseData,fact:Fact,index:CaseReadIndex):{displayable:boolean;label:string}{
  if(index.byId.get(fact.id)!==fact)return {displayable:false,label:fact.state==="retracted"?"철회·보류":"과거 버전·보류"};
  const refsValid=fact.refs.length>0&&fact.refs.every(ref=>validSourceRef(data,ref,index));
  const issues=factSourceLineageIssues(data,[fact.id],index).filter(issue=>issue!=="SOURCE_VERIFICATION_REQUIRED");
  const unresolvedValidation=fact.validation.filter(item=>item.severity==="error"||["FIELD_CONFLICT","UNCERTAIN_READING","NORMALIZATION_REVIEW","VERIFY_DISAGREEMENT"].includes(item.code));
  if(fact.state!=="verified"||!refsValid||issues.length)return {displayable:false,label:issues.includes("SOURCE_REFERENCE_INVALID")||!refsValid?"원문 연결 오류·보류":"원문 검증 필요·보류"};
  if(unresolvedValidation.length)return {displayable:false,label:unresolvedValidation.some(item=>item.code==="FIELD_CONFLICT"||item.code==="VERIFY_DISAGREEMENT")?"원문 충돌·보류":"값 검증 필요·보류"};
  if(fact.recognition==="rejected")return {displayable:false,label:"불인정·보류"};
  return fact.recognition==="accepted"?{displayable:true,label:"원문·인정 검토 완료"}:{displayable:true,label:"원문 관측·인정 전"};
}
function refs(data:CaseData,facts:Fact[],index:CaseReadIndex):string{
  const values=facts.flatMap(fact=>fact.refs.map(ref=>validSourceRef(data,ref,index)?`${index.documentsById.get(ref.documentId)?.name??ref.documentId} p.${ref.page}: ${ref.quote}`:null).filter((value):value is string=>!!value));
  return [...new Set(values)].join(" / ")||"[현재 유효한 원문 연결 없음]";
}
function fieldObservation(data:CaseData,facts:Fact[],index:CaseReadIndex,amount=false,directionFacts:Fact[]=[],rowContextFacts:Fact[]=[]):{value:string;status:string;refs:string}{
  if(!facts.length)return {value:"[관측 없음]",status:"미확인·보류",refs:"[원문 근거 필요]"};
  const current=facts.filter(fact=>index.byId.get(fact.id)===fact);
  if(!current.length)return {value:"[현재 연결 대조 필요]",status:"현재 사실이 없거나 철회·과거 버전·보류",refs:refs(data,facts,index)};
  const states=current.map(fact=>sourceState(data,fact,index));
  if(states.some(state=>!state.displayable))return {value:"[값·단위 검토 보류]",status:[...new Set(states.map(state=>state.label))].join("; "),refs:refs(data,current,index)};
  const valid=current;
  const values=valid.map(fact=>{
    if(amount)return exactSourceMoney(fact,data,index,directionFacts,rowContextFacts)?.display??null;
    return display(fact.value);
  });
  if(values.some(value=>value===null))return {value:"[값·단위 검토 보류]",status:"값 검증 필요·보류",refs:refs(data,facts,index)};
  const distinct=amount
    ?[...new Set(valid.map(fact=>exactSourceMoney(fact,data,index,directionFacts,rowContextFacts)?.amount.toString()??"invalid"))]
    :[...new Set(values)];
  if(distinct.length>1)return {value:"[상충·선택 보류]",status:"상충·보류",refs:refs(data,facts,index)};
  const observed=amount?valid.map(fact=>exactSourceMoney(fact,data,index,directionFacts,rowContextFacts)!.display).join("; "):distinct[0]??"[확인 필요]";
  return {value:observed,status:[...new Set(states.map(state=>state.label))].join("; "),refs:refs(data,facts,index)};
}

/** Source observation only. Does not change scanTransactions' acceptance or total gates. */
export function transactionSourceAnnex(data:CaseData,index:CaseReadIndex):SourceReviewTable{
  const latest=currentOrLatestFacts(data,index),latestFactIds=new Set(latest.map(fact=>fact.id)),txFacts=latest.filter(fact=>(fact.key.startsWith("transaction.")||fact.key.startsWith("transactions."))&&!/[.]coverage_complete$/.test(fact.key)&&fact.key!=="coverage.transactions_complete");
  const factsById=new Map(data.facts.map(fact=>[fact.id,fact])),txFactsBySubject=new Map<string,Fact[]>(),transactionsById=new Map<string,Transaction[]>();
  for(const fact of txFacts)txFactsBySubject.set(fact.subjectId,[...(txFactsBySubject.get(fact.subjectId)??[]),fact]);
  for(const tx of data.transactions)transactionsById.set(tx.id,[...(transactionsById.get(tx.id)??[]),tx]);
  const subjects=new Set<string>([...data.transactions.map(tx=>tx.id),...txFacts.map(fact=>fact.subjectId)]);
  const rows=[...subjects].sort().map(subjectId=>{
    const subjectFacts=txFactsBySubject.get(subjectId)??[];
    const transactions=transactionsById.get(subjectId)??[];
    const links=transactions.flatMap(tx=>tx.factIds.map(id=>factsById.get(id)).filter((fact):fact is Fact=>!!fact));
    const wrongLinked=links.some(fact=>fact.subjectId!==subjectId);
    const allFacts=[...new Map([...subjectFacts,...links.filter(fact=>fact.subjectId===subjectId)].map(fact=>[fact.id,fact])).values()];
    const directionFacts=allFacts.filter(fact=>latestFactIds.has(fact.id)&&transactionFields.direction.includes(fact.key as never));
    const rowContextFacts=allFacts.filter(fact=>latestFactIds.has(fact.id)&&(transactionFields.date.includes(fact.key as never)||transactionFields.memo.includes(fact.key as never)));
    const resolved=Object.entries(transactionFields).map(([field,keys])=>{
      const selected=allFacts.filter(fact=>(keys as readonly string[]).includes(fact.key));
      const observation=fieldObservation(data,selected,index,field==="amount",directionFacts,rowContextFacts);
      return observation;
    });
    const states=resolved.map(item=>item.status),requiredStates=states.slice(0,3);
    const overall=wrongLinked?"wrong-subject 연결·보류":!transactions.length?"원문 후보·typed 거래 연결 전; "+[...new Set(states)].join("; "):requiredStates.every(status=>status.includes("검토 완료"))?"원문·인정 검토 완료":requiredStates.some(status=>status.includes("상충")||status.includes("보류"))?"일부 필수 값 보류":"원문 관측·인정 전";
    const fieldNames=["금액","일자","방향","종류","계좌","상대방","적요"],groupedStatus=new Map<string,string[]>();
    resolved.forEach((item,fieldIndex)=>groupedStatus.set(item.status,[...(groupedStatus.get(item.status)??[]),fieldNames[fieldIndex]??"기타"]));
    const fieldStatus=wrongLinked?"다른 subject의 링크는 이 거래 값으로 사용하지 않음":[...groupedStatus].map(([status,names])=>`${names.join("·")}: ${status}`).join("; ");
    return [subjectId,transactions.length>1?"중복 typed 거래 ID":transactions.length?"typed 거래 연결":"typed 거래 미생성·원문 후보",...resolved.map(item=>item.value),overall,fieldStatus,refs(data,allFacts,index)];
  });
  return {title:"거래 원문 관측·인정 검토 (합계 미산출)",headers:["거래 subject ID","연결 상태","원문 금액 관측","거래일 관측","입출금 방향 관측","종류 관측","계좌 관측","상대방 관측","적요 관측","검토 상태","필드별 상태","동일 subject 원문 인용"],rows};
}

/** A compact printable view plus a full-width provenance table; the workbook keeps the canonical full-width annex. */
export function transactionSourcePrintTables(annex:SourceReviewTable):SourceReviewTable[]{
  const rows=annex.rows.map((row,index)=>{
    const label=`T${String(index+1).padStart(3,"0")}`;
    return {label,compact:[label,`일자: ${row[3]} / 계좌: ${row[6]}`,`방향: ${row[4]} / 원문 금액: ${row[2]}`,`종류: ${row[5]} / 상대방: ${row[7]} / 적요: ${row[8]} / 검토: ${row[9]}`],evidence:[`${label} / source ID: ${row[0]} / ${row[1]} / ${row[10]}`,row[11]??"[원문 인용 없음]"]};
  });
  return [
    {title:"거래 관측·검토 요약 (합계 미산출)",headers:["행","일자·계좌","입출금·원문 금액","종류·상대방·적요·검토"],rows:rows.map(row=>row.compact)},
    {title:"거래 원문 인용·행 연결",headers:["행·원문 ID·연결·필드 상태","전체 원문 인용"],rows:rows.map(row=>row.evidence)},
  ];
}

/** Guarantee-only source facts remain reviewable without creating a Debt or a current liability amount. */
export function guaranteeSourceAnnex(data:CaseData,index:CaseReadIndex):SourceReviewTable{
  const latest=currentOrLatestFacts(data,index),candidates=latest.filter(fact=>guaranteeKey(fact.key));
  const subjects=new Set(candidates.map(fact=>fact.subjectId)),groups=new Map<string,Fact[]>();
  for(const fact of candidates)groups.set(fact.subjectId,[...(groups.get(fact.subjectId)??[]),fact]);
  for(const fact of latest)if(subjects.has(fact.subjectId)&&guaranteeContextKeys.has(fact.key))groups.set(fact.subjectId,[...(groups.get(fact.subjectId)??[]),fact]);
  const rows=[...groups.entries()].sort(([left],[right])=>left.localeCompare(right)).flatMap(([subjectId,facts])=>{
    const slotFacts=new Map<string,Fact[]>();
    for(const fact of facts)slotFacts.set(fact.key,[...(slotFacts.get(fact.key)??[]),fact]);
    return facts.map(fact=>{
      const slot=(slotFacts.get(fact.key)??[]).filter(candidate=>index.byId.get(candidate.id)===candidate);
      const states=slot.map(candidate=>sourceState(data,candidate,index));
      const moneyKey=!!fact.numeric||/(?:guarantee_(?:limit|amount)|보증.*(?:한도|금액|액)|(?:limit|amount))/iu.test(fact.key);
      const sourceValues=slot.map(candidate=>moneyKey?exactSourceMoney(candidate,data,index)?.amount.toString()??"INVALID":JSON.stringify(candidate.value));
      const fingerprints=slot.map(candidate=>JSON.stringify([candidate.value,Object.hasOwn(candidate,"sourceUnit")?candidate.sourceUnit:null,candidate.numeric?.rawValue??null,candidate.numeric?.unit??null,candidate.numeric?.amountWon??null]));
      const conflict=new Set(fingerprints).size>1;
      const sourceInvalid=sourceValues.some(value=>value==="INVALID");
      const slotHeld=!slot.length||states.some(state=>!state.displayable)||sourceInvalid;
      const state=sourceState(data,fact,index);
      const value=conflict?"[상충·선택 보류]":slotHeld?"[값·근거 보류]":moneyKey?rawMoney(fact):display(fact.value);
      const status=conflict?"동일 subject 필드·단위 상충·보류":sourceInvalid?"단위·값 검증 필요·보류":!slot.length?"현재 사실 없음·철회·보류":slotHeld?[...new Set(states.map(item=>item.label))].join("; "):state.label;
      const manualDisposition="이 표는 원문 관측용이며 산입 판단은 채권별 명세·검토기록을 참조";
      return [subjectId,fact.key,value,manualDisposition,"[이 표에서 합계·한도 미산출]",status,refs(data,[fact],index)];
    });
  });
  return {title:"보증·연대 원문 관측 (산입 판단은 채권별 검토기록 참조)",headers:["원문 subject ID","원문 필드","관측값 (원문 단위 보존)","현재 채무 반영","합계·한도 계산","검토 상태","같은 subject 원문 인용"],rows};
}
