/** Source-backed annex rows; facts remain separate from reviewed legal aggregates. */
import { currentFacts, factSourceLineageIssues, moneyValue, validSourceRef } from "./domain.ts";
import type { CaseData, Fact } from "./domain.ts";
import { expandPaymentSchedule, type Phase } from "./payment-schedule.ts";
import type { CalculationResult } from "./assessment.ts";
const missing="[확인 필요]";
const norm=(s:string)=>s.replace(/([a-z0-9])([A-Z])/g,"$1_$2").toLowerCase();
const aliases:Record<string,string[]>={institution:["institution","bank","financial_institution"],owner:["owner","account_holder"],account_number:["account_number"],balance:["balance"],active:["active","active_status","status"],as_of:["as_of","balance_as_of"],tenant:["tenant","lessee"],landlord:["landlord","lessor"],applicant_role:["applicant_role","applicant_is_tenant","applicant_is_landlord"],use:["use"],deposit:["deposit"],monthly_rent:["monthly_rent"],secured_balance:["secured_balance"],arrears_deduction:["arrears_deduction"],start_date:["start_date","period_start"],end_date:["end_date","period_end"]};
function accountOrLeaseKey(f:Fact,kind:"bank_account"|"lease"):string|null{const key=norm(f.key),parts=key.split("."),local=parts.at(-1)??"",prefix=parts.slice(0,-1).join(".");for(const [field,vs] of Object.entries(aliases)){if(!vs.map(norm).includes(local))continue;const valid=kind==="bank_account"?["institution","owner","account_number","balance","active","as_of"].includes(field):["tenant","landlord","applicant_role","use","deposit","monthly_rent","secured_balance","arrears_deduction","start_date","end_date"].includes(field);if(valid&&[kind,"other."+kind,"asset","other","account"].includes(prefix))return field;}return null;}
function value(data:CaseData,f:Fact|undefined):string{if(!f||f.state==="disputed"||f.state==="retracted"||f.recognition==="rejected"||!f.refs.length||f.refs.some(r=>!validSourceRef(data,r))||f.validation.some(v=>v.severity==="error"||["UNCERTAIN_READING","NORMALIZATION_REVIEW","FIELD_CONFLICT"].includes(v.code))||factSourceLineageIssues(data,[f.id]).some(issue=>issue!=="SOURCE_VERIFICATION_REQUIRED"))return missing;if(f.numeric){const n=moneyValue(f.numeric);return n===null?(String(f.numeric.rawValue??missing)+" [원문 단위 확인: "+(f.numeric.unit||"미확인")+"]"):n.toString();}return typeof f.value==="string"?f.value:JSON.stringify(f.value);}
function sourceVerified(data:CaseData,f:Fact|undefined):boolean{return !!f&&factSourceLineageIssues(data,[f.id]).length===0;}
function refs(data:CaseData,fs:Fact[]):string{return [...new Set(fs.flatMap(f=>f.refs.filter(r=>validSourceRef(data,r)).map(r=>r.documentId+" p."+r.page+": "+r.quote)))].join(" | ")||missing;}
function reviewState(fs:Fact[]):[string,string]{const source=[...new Set(fs.map(f=>f.state))].join(" / ")||missing,legal=[...new Set(fs.map(f=>f.recognition))].join(" / ")||missing;return [source,legal];}
function fieldValue(data:CaseData,fs:Fact[],kind:"bank_account"|"lease",name:string):string{const found=fs.filter(f=>accountOrLeaseKey(f,kind)===name&&value(data,f)!==missing),vals=[...new Set(found.map(f=>value(data,f)))];return vals.length===1?vals[0]:vals.length>1?"[상충·선택 보류]":missing;}
function field(data:CaseData,fs:Fact[],kind:"bank_account"|"lease",name:string):Fact|undefined{const found=fs.filter(f=>accountOrLeaseKey(f,kind)===name&&value(data,f)!==missing);return new Set(found.map(f=>value(data,f))).size===1?found[0]:undefined;}
export type AnnexTable={title:string;headers:string[];rows:string[][];summary?:{title:string;headers:string[];rows:string[][]};status:"source_backed"|"blocked";notes:string[]};
function subjects(data:CaseData,kind:"bank_account"|"lease"):string[]{const facts=currentFacts(data),groups=new Map<string,Fact[]>();for(const f of facts){if(accountOrLeaseKey(f,kind))groups.set(f.subjectId,[...(groups.get(f.subjectId)??[]),f]);}return [...groups].filter(([id,fs])=>{const ref=fs[0]?.refs[0],doc=data.documents.find(d=>d.id===ref?.documentId),page=data.pages.find(p=>p.documentId===doc?.id&&p.page===ref?.page),type=norm((doc?.type??"")+" "+(page?.documentType??"")),explicit=fs.some(f=>norm(f.key).startsWith(kind+".")||norm(f.key).startsWith("other."+kind+".")),cat=id.split(":").at(-2),docMatch=kind==="bank_account"?/bank.?account|account.?statement|예금|계좌/.test(type):/lease|임대차|임대계약/.test(type);return explicit||(docMatch&&(cat==="other"||cat==="asset"));}).map(x=>x[0]);}
function rowFacts(data:CaseData,id:string,kind:"bank_account"|"lease"){return currentFacts(data).filter(f=>f.subjectId===id&&accountOrLeaseKey(f,kind));}
function aggregate(data:CaseData,key:string){const all=currentFacts(data).filter(f=>f.key===key&&f.state==="verified"&&f.recognition==="accepted"&&sourceVerified(data,f)&&!!f.numeric&&moneyValue(f.numeric)!==null&&value(data,f)!==missing),unique=[...new Set(all.map(f=>value(data,f)))];return unique.length===1?all[0]:undefined;}
export function bankAccountsAnnex(data:CaseData):AnnexTable{const ids=subjects(data,"bank_account"),rows=ids.map(id=>{const fs=rowFacts(data,id,"bank_account"),get=(k:string)=>fieldValue(data,fs,"bank_account",k);return [id,get("institution"),get("owner"),get("account_number"),get("balance"),get("active"),get("as_of"),...reviewState(fs),refs(data,fs)];}),total=aggregate(data,"bank_accounts.recognized_total"),limit=aggregate(data,"bank_accounts.exempt_limit"),usable=ids.length>0&&ids.every(id=>{const fs=rowFacts(data,id,"bank_account"),required=["institution","owner","account_number","balance","active","as_of"].map(k=>field(data,fs,"bank_account",k));return required.every(f=>sourceVerified(data,f));}),missingRows=rows.filter(r=>r.slice(1,7).some(v=>v===missing)).map(r=>r[0]);return {title:"은행계좌 및 예금 부속명세",headers:["계좌 사실 ID","금융기관","명의·소유자","계좌번호(원문 마스킹 보존)","잔액(원)","활성 여부","기준일","원문 확인 상태","법적 반영 상태","원문 근거"],rows,status:usable?"source_backed":"blocked",summary:{title:"예금·면제 검토 집계",headers:["항목","검토 값","근거·검토 상태"],rows:[["인벤토리 완전성",data.context.inventoryComplete.asset==="yes"?"완전 확인":missing,missing],["검토된 예금 합계",data.context.inventoryComplete.asset==="yes"?value(data,total):missing,total?refs(data,[total]):"검토 승인된 aggregate fact 필요"],["검토된 면제 한도",value(data,limit),limit?refs(data,[limit]):"법률·기준일·요건 검토 aggregate fact 필요"]]},notes:["동일 금융기관의 계좌는 분리하며 원문 마스킹 그대로 보존하고 가려진 숫자를 추정하지 않습니다.","한 필드만 있는 문서도 출처 namespace 또는 문서 유형과 subject ID가 연결되면 관측행으로 표시합니다. 빈 필드를 임의 보충하지 않습니다.","원문 확인 상태와 법적 반영 상태를 별도 열로 표시합니다. 총액·면제한도는 verified+accepted 된 별도 aggregate fact만 사용합니다.",...(missingRows.length?["필수 사실 필드 확인 필요: "+missingRows.join(", ")]:[]),...(!usable?["필수 필드 중 원문 검증 또는 출처 무결성 확인이 끝나지 않은 항목이 있습니다."]:[])]};}
export function leasesAnnex(data:CaseData):AnnexTable{const ids=subjects(data,"lease"),rows=ids.map(id=>{const fs=rowFacts(data,id,"lease"),get=(k:string)=>fieldValue(data,fs,"lease",k);return [id,get("tenant"),get("landlord"),get("applicant_role"),get("use"),get("deposit"),get("monthly_rent"),get("secured_balance"),get("arrears_deduction"),get("start_date"),get("end_date"),...reviewState(fs),refs(data,fs)];}),total=aggregate(data,"leases.recognized_total"),usable=ids.length>0&&ids.every(id=>{const fs=rowFacts(data,id,"lease"),required=["tenant","use","deposit"].map(k=>field(data,fs,"lease",k));return required.every(f=>sourceVerified(data,f));});return {title:"임대차 및 보증금 부속명세",headers:["임대차 사실 ID","임차인","임대인","신청인 역할(원문)","사용처","보증금(원)","월 차임(원)","현재 담보채무(원)","연체차임 공제(원)","계약 시작","계약 종료","원문 확인 상태","법적 반영 상태","원문 근거"],rows,status:usable?"source_backed":"blocked",summary:{title:"임대차 보증금 검토 집계",headers:["항목","검토 값","근거·검토 상태"],rows:[["검토된 인정 합계",value(data,total),total?refs(data,[total]):"검토 승인된 aggregate fact 필요"]]},notes:["임차인·임대인·신청인 역할은 각각 원문에서 확인된 경우만 표시하며 역할을 추정하지 않습니다.","당사자·용도·보증금·현재 담보잔액·미납차임 공제는 구분된 사실로 유지합니다.","임대인 또는 제3자 소유 재산을 신청인에게 귀속하지 않습니다. 보증금·공제의 법률상 인정은 별도 검토합니다.","원문 확인 상태와 법적 반영 상태를 분리해 표시합니다.",...(usable?[]:["필수 필드의 값은 검토용 초안에 표시할 수 있으나, 원문 검증 또는 출처 무결성 확인이 끝나기 전까지 annex 상태는 차단됩니다."])]};}
export function repaymentScheduleAnnex(phases:Phase[],expectedInstallments?:number):AnnexTable {
  const result=expandPaymentSchedule(phases,expectedInstallments);
  const dateIssues=new Set(["FIRST_PAYMENT_DATE_UNKNOWN","INVALID_FIRST_PAYMENT_DATE","INSTALLMENT_COUNT_MISMATCH"]);
  const dateOnlyIssue=result.issues.length>0&&result.issues.every(issue=>dateIssues.has(issue));
  const ordered=[...phases].sort((a,b)=>a.firstInstallment-b.firstInstallment);
  let next=1;
  const fallbackSafe=dateOnlyIssue&&ordered.length>0&&new Set(ordered.map(p=>p.id)).size===ordered.length&&ordered.every(p=>{
    if(!Number.isInteger(p.firstInstallment)||!Number.isInteger(p.lastInstallment)||p.firstInstallment!==next||p.lastInstallment<p.firstInstallment||p.lastInstallment>60||!/^\d+$/.test(p.monthlyAvailableWon)||!p.allocations.length||new Set(p.allocations.map(a=>a.creditorId)).size!==p.allocations.length||p.allocations.some(a=>!a.creditorId||!/^\d+$/.test(a.principalWon)||!/^\d+$/.test(a.interestWon)))return false;
    const allocated=p.allocations.reduce((sum,a)=>sum+BigInt(a.principalWon)+BigInt(a.interestWon),0n);
    if(allocated>BigInt(p.monthlyAvailableWon))return false;
    next=p.lastInstallment+1;return true;
  })&&(expectedInstallments===undefined||next-1===expectedInstallments);
  const rows=result.status==="complete"
    ? result.rows.map(row=>[String(row.installment),row.paymentDate??missing,row.creditorId,row.principalWon,row.interestWon,row.totalWon,row.phaseId])
    : fallbackSafe?ordered.flatMap(p=>Array.from({length:p.lastInstallment-p.firstInstallment+1},(_,i)=>p.allocations.map(a=>[String(p.firstInstallment+i),missing,a.creditorId,a.principalWon,a.interestWon,(BigInt(a.principalWon)+BigInt(a.interestWon)).toString(),p.id])).flat()):[];
  const summaryRows=result.status==="complete"?result.phaseTotals.map(p=>[p.phaseId,String(p.installments),p.monthlyAvailableWon,p.monthlyPrincipalWon,p.monthlyInterestWon,p.monthlyTotalWon,p.monthlyRemainderWon,p.totalPrincipalWon,p.totalInterestWon,p.totalWon]):[];
  if(result.status==="complete")summaryRows.push(["총계","","","","","","",result.totals.principalWon,result.totals.interestWon,result.totals.totalWon]);
  return {title:"개인회생채권 변제예정액표",headers:["회차","변제일","채권자 ID","원금(원)","이자(원)","월 합계(원)","적용 단계"],rows,summary:{title:"단계별 예산·배분·총계 대조",headers:["단계","회차 수","월 가용액","월 원금합","월 이자합","월 합계","월 잔액","기간 원금합","기간 이자합","기간 총계"],rows:summaryRows},status:result.status==="complete"?"source_backed":"blocked",notes:result.issues.length?[...result.issues,"변제일은 [확인 필요]로 표시하고 날짜 확인 전까지 표 확정을 보류합니다."]:["각 단계별 월 가용액, 채권자별 원금·이자 배분, 기간 합계를 분리해 검증했습니다."]};
}

/**
 * Creates a draft-only arithmetic proposal from an explicitly entered term,
 * monthly payment, selected allocation basis, and complete ordinary-claim rows.
 * It never invents payment dates or replaces a manually entered schedule.
 */
export function proposedInstallmentAnnex(data:CaseData,calculation:CalculationResult):AnnexTable {
  const context=data.context, months=context.planMonths, payment=moneyValue(context.approvedMonthlyPayment);
  const reasons:string[]=[];
  if(!Number.isSafeInteger(months)||months!<1||months!>60)reasons.push("EXPLICIT_PLAN_TERM_REQUIRED");
  if(payment===null||payment<=0n)reasons.push("EXPLICIT_POSITIVE_MONTHLY_PAYMENT_REQUIRED");
  if(!["principal_then_interest_pro_rata","principal_only_pro_rata"].includes(context.allocationBasis??""))reasons.push("EXPLICIT_ALLOCATION_BASIS_REQUIRED");
  if(context.inventoryComplete.debt!=="yes")reasons.push("COMPLETE_DEBT_INVENTORY_REQUIRED");
  if(data.debts.some(debt=>debt.classification!=="ordinary"||debt.secured!=="no"||debt.priority!=="ordinary"||debt.excludedByReview))reasons.push("SEPARATE_CLAIM_ALLOCATION_REQUIRED");
  const manual=context.paymentSchedule?.phases?.length;
  if(manual)reasons.push("MANUAL_SCHEDULE_PRESERVED");
  const n=Number.isSafeInteger(months)&&months!>0&&months!<=60?months!:0;
  const planned=payment!==null&&payment>=0n&&n?payment*BigInt(n):null;
  if(planned===null||calculation.planTotalWon===null||calculation.planTotalWon!==planned.toString())reasons.push("EXPLICIT_PLAN_TOTAL_RECONCILIATION_REQUIRED");
  const ordinaryIds=new Set(data.debts.filter(debt=>debt.classification==="ordinary"&&debt.secured==="no"&&debt.priority==="ordinary"&&!debt.excludedByReview).map(debt=>debt.id));
  if(!ordinaryIds.size||calculation.allocations.length!==ordinaryIds.size||calculation.allocations.some(row=>!ordinaryIds.has(row.debtId)))reasons.push("COMPLETE_ORDINARY_CREDITOR_ALLOCATIONS_REQUIRED");
  const amountsValid=calculation.allocations.every(row=>/^[0-9]+$/.test(row.allocatedPrincipalWon)&&/^[0-9]+$/.test(row.allocatedInterestWon)&&row.factIds.length>0);
  if(!amountsValid)reasons.push("CREDITOR_ALLOCATION_INPUT_INVALID");
  const allocated=amountsValid?calculation.allocations.reduce((sum,row)=>sum+BigInt(row.allocatedPrincipalWon)+BigInt(row.allocatedInterestWon),0n):null;
  if(planned===null||allocated===null||allocated!==planned)reasons.push("CREDITOR_ALLOCATION_TOTAL_MISMATCH");
  const eligible=reasons.length===0&&planned!==null&&allocated!==null&&n>0;
  const rows:string[][]=[];
  const monthly:Map<string,{principal:string[];interest:string[]}>=new Map();
  if(eligible){
    let remainderCursor=0;
    for(const allocation of calculation.allocations){
      const values={principal:Array.from({length:n},()=>0n),interest:Array.from({length:n},()=>0n)};
      for(const [field,total] of [["principal",allocation.allocatedPrincipalWon],["interest",allocation.allocatedInterestWon]] as const){
        const value=BigInt(total),q=value/BigInt(n),r=Number(value%BigInt(n));
        for(let month=0;month<n;month++)values[field][month]+=q;
        for(let offset=0;offset<r;offset++)values[field][(remainderCursor+offset)%n]+=1n;
        remainderCursor=(remainderCursor+r)%n;
      }
      monthly.set(allocation.debtId,{principal:values.principal.map(String),interest:values.interest.map(String)});
    }
    for(let installment=1;installment<=n;installment++)for(const allocation of calculation.allocations){
      const amounts=monthly.get(allocation.debtId)!,principal=amounts.principal[installment-1],interest=amounts.interest[installment-1];
      rows.push([String(installment),missing,allocation.debtId,allocation.creditor||"[채권자명 확인 필요]",principal,interest,(BigInt(principal)+BigInt(interest)).toString(),"계산 제안 · 검토 전"]);
    }
  }
  const monthlyTotals=Array.from({length:n},(_,index)=>eligible?calculation.allocations.reduce((sum,allocation)=>{const values=monthly.get(allocation.debtId)!;return sum+BigInt(values.principal[index])+BigInt(values.interest[index]);},0n).toString():missing);
  const totalPrincipal=amountsValid?calculation.allocations.reduce((sum,row)=>sum+BigInt(row.allocatedPrincipalWon),0n).toString():missing;
  const totalInterest=amountsValid?calculation.allocations.reduce((sum,row)=>sum+BigInt(row.allocatedInterestWon),0n).toString():missing;
  return {title:"변제계획 제안 회차표 (자동 계산·승인 전)",headers:["회차","변제일","채권 ID","채권자명","원금(원)","이자(원)","회차 배분액(원)","상태"],rows,status:"blocked",summary:{title:"제안 기간·월액·총액 대조",headers:["구분","회차 범위","월 변제액(원)","원금 합계(원)","이자 합계(원)","총 배분(원)","상태"],rows:[
    ["자동 제안",eligible?`1–${n}`:missing,payment===null?missing:payment.toString(),totalPrincipal,totalInterest,allocated===null?missing:allocated.toString(),eligible?"검토 전 제안":"생성 조건 미충족"],
    ...monthlyTotals.map((total,index)=>[`회차 ${index+1}`,String(index+1),total,missing,missing,total,"날짜 미확인"]),
    ["기간 합계",eligible?`1–${n}`:missing,payment===null?missing:(payment*BigInt(n)).toString(),totalPrincipal,totalInterest,allocated===null?missing:allocated.toString(),eligible?"합계 대조":"확인 필요"],
  ]},notes:[eligible?"이 표는 명시된 기간·월액·배분 기준과 결정적 채권 입력을 원금·이자 별도로 회차에 나눈 검토용 제안입니다. 각 회차 합계와 기간 총액을 대조합니다.":"필수 입력이 완전하지 않아 자동 제안 회차를 만들지 않았습니다. 수동 입력 일정은 별도로 보존합니다.",...reasons.map(reason=>"생성 보류: "+reason),"자동 계산 결과는 법적 승인이나 담당자 검토를 뜻하지 않습니다. 변제일은 입력 전까지 [확인 필요]입니다."]};
}
