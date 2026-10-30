import { maximumPlanMonths } from "./reference-parameters.ts";
/** Source-backed annex rows; facts remain separate from reviewed legal aggregates. */
import { createCaseReadIndex, currentFacts, factSourceLineageIssues, moneyValue, validSourceRef, DRAFT_RULESET } from "./domain.ts";
import type { CaseData, CaseReadIndex, Fact } from "./domain.ts";
import { expandPaymentSchedule, type Phase } from "./payment-schedule.ts";
import { calculateCase, type CalculationResult } from "./assessment.ts";
import { resolveDebtRows } from "./debt-resolution.ts";
import type { PlanLedger } from "./repayment-plan-model.ts";
import type { PlanReconciliation } from "./plan-reconciliation.ts";
const missing="[확인 필요]";
const norm=(s:string)=>s.replace(/([a-z0-9])([A-Z])/g,"$1_$2").toLowerCase();
const aliases:Record<string,string[]>={institution:["institution","bank","financial_institution"],owner:["owner","account_holder","account_holder_name","customer_name"],account_number:["account_number"],balance:["balance","current_balance"],active:["active","active_status","account_status","status"],as_of:["as_of","balance_as_of"],tenant:["tenant","lessee"],landlord:["landlord","lessor"],applicant_role:["applicant_role","applicant_is_tenant","applicant_is_landlord"],use:["use"],deposit:["deposit","security_deposit"],monthly_rent:["monthly_rent","rent_per_month"],secured_balance:["secured_balance"],arrears_deduction:["arrears_deduction"],start_date:["start_date","period_start"],end_date:["end_date","period_end"],encumbrance_status:["encumbrance_status","attachment_or_pledge_status"],seizure_status:["seizure_status","attachment_status","garnishment_status"],pledge_status:["pledge_status","collateral_status"],property_address:["property_address","property_location","premises_address","leased_property_address","leased_address"],property_reference:["property_reference","property_id","premises_id"]};
function accountOrLeaseKey(f:Fact,kind:"bank_account"|"lease"):string|null{const key=norm(f.key),parts=key.split("."),local=parts.at(-1)??"",prefix=parts.slice(0,-1).join(".");for(const [field,vs] of Object.entries(aliases)){if(!vs.map(norm).includes(local))continue;const valid=kind==="bank_account"?["institution","owner","account_number","balance","active","as_of","encumbrance_status","seizure_status","pledge_status"].includes(field):["tenant","landlord","applicant_role","use","deposit","monthly_rent","secured_balance","arrears_deduction","start_date","end_date","property_address","property_reference"].includes(field);if(valid&&[kind,"other."+kind,"asset","other","account"].includes(prefix))return field;}return null;}
function value(data:CaseData,f:Fact|undefined,index?:CaseReadIndex):string{if(!f||f.state==="disputed"||f.state==="retracted"||f.recognition==="rejected"||!f.refs.length||f.refs.some(r=>!validSourceRef(data,r,index))||f.validation.some(v=>v.severity==="error"||["UNCERTAIN_READING","NORMALIZATION_REVIEW","FIELD_CONFLICT"].includes(v.code))||factSourceLineageIssues(data,[f.id],index).some(issue=>issue!=="SOURCE_VERIFICATION_REQUIRED"))return missing;if(f.numeric){const n=moneyValue(f.numeric);return n===null?(String(f.numeric.rawValue??missing)+" [원문 단위 확인: "+(f.numeric.unit||"미확인")+"]"):n.toString();}return typeof f.value==="string"?f.value:JSON.stringify(f.value);}
function sourceVerified(data:CaseData,f:Fact|undefined,index?:CaseReadIndex):boolean{return !!f&&factSourceLineageIssues(data,[f.id],index).length===0;}
function refs(data:CaseData,fs:Fact[],index?:CaseReadIndex):string{return [...new Set(fs.flatMap(f=>f.refs.filter(r=>validSourceRef(data,r,index)).map(r=>r.documentId+" p."+r.page+": "+r.quote)))].join(" | ")||missing;}
function reviewState(fs:Fact[]):[string,string]{const source=[...new Set(fs.map(f=>f.state))].join(" / ")||missing,legal=[...new Set(fs.map(f=>f.recognition))].join(" / ")||missing;return [source,legal];}
function fieldValue(data:CaseData,fs:Fact[],kind:"bank_account"|"lease",name:string,index?:CaseReadIndex):string{
  const found=fs.filter(f=>accountOrLeaseKey(f,kind)===name),values=found.map(f=>f.value===null||f.value===""?missing:value(data,f,index));
  const distinct=new Set(values.filter(v=>v!==missing));
  // Aliases are one observed slot. An unusable alternative must not disappear
  // from the decision merely because another spelling has a usable value.
  if(distinct.size>1||found.some(f=>f.state==="disputed"||f.validation.some(v=>v.code==="FIELD_CONFLICT")))return "[상충·선택 보류]";
  return !found.length||values.includes(missing)?missing:values[0];
}
function field(data:CaseData,fs:Fact[],kind:"bank_account"|"lease",name:string,index?:CaseReadIndex):Fact|undefined{
  const found=fs.filter(f=>accountOrLeaseKey(f,kind)===name),rendered=fieldValue(data,fs,kind,name,index);
  // Row readiness covers every observation of the slot, not just whichever
  // equal-valued fact happened to occur first in the evidence ledger.
  return rendered!==missing&&rendered!=="[상충·선택 보류]"&&found.every(f=>sourceVerified(data,f,index))?found[0]:undefined;
}
export type AnnexTable={title:string;headers:string[];rows:string[][];summary?:{title:string;headers:string[];rows:string[][]};status:"source_backed"|"blocked";notes:string[]};
/** Office schedule projection. It never reconstructs installments from allocation totals. */
export function repaymentPlanLedgerAnnex(data:CaseData,calculation:CalculationResult,ledger:PlanLedger,reconciliation:PlanReconciliation):AnnexTable{
 // Unverified amounts must not throw or silently become zero in a court-facing annex.
 const isWon=(v:unknown):v is string=>typeof v==="string"&&/^\d+$/.test(v);
 const showWon=(v:unknown):string=>isWon(v)?v:missing;
 const sumWon=(values:readonly unknown[]):string=>{
  let total=0n;
  for(const value of values){if(!isWon(value))return missing;total+=BigInt(value);}
  return total.toString();
 };
 const monthIds=[...new Set(ledger.rows.map(r=>r.installment))].sort((a,b)=>a-b);
 const phaseFor=(month:number)=>data.context.paymentSchedule?.phases.find(p=>month>=p.firstInstallment&&month<=p.lastInstallment);
 const term=data.context.paymentSchedule?.expectedInstallments??data.context.planMonths??0;
 const allMonthsPresent=Number.isSafeInteger(term)&&term>0&&monthIds.length===term&&monthIds.every((month,i)=>month===i+1);
 const rowValuesValid=ledger.rows.every(row=>[row.principalWon,row.interestWon,row.otherComponentWon,row.balanceAfter].every(isWon));
 const totals=reconciliation.totals;
 const totalsValid=[totals.principalWon,totals.interestWon,totals.otherComponentWon,totals.totalWon,totals.ordinaryWon,totals.priorityWon,totals.estateWon,totals.trusteeFeeWon].every(isWon);
 const budgetValuesValid=Object.values(reconciliation.unallocatedBudgets).every(isWon)&&monthIds.every(month=>isWon(reconciliation.unallocatedBudgets[`${month}:disposable_income`]));
 const capsValid=monthIds.every(month=>isWon(phaseFor(month)?.monthlyAvailableWon??calculation.monthlyPaymentWon));
 const monetaryValid=allMonthsPresent&&rowValuesValid&&totalsValid&&budgetValuesValid&&capsValid;
 const rows=ledger.rows.map(row=>[
  String(row.installment),row.paymentDate??missing,row.claimClass==="trustee_fee"?"회생위원 보수":row.debtId,
  showWon(row.principalWon),showWon(row.interestWon),sumWon([row.principalWon,row.interestWon,row.otherComponentWon]),
  row.phaseId,showWon(row.otherComponentWon),row.fundingSourceId,showWon(row.balanceAfter)
 ]);
 const summaryRows=monthIds.map(month=>{
  const monthRows=ledger.rows.filter(row=>row.installment===month);
  const creditorRows=monthRows.filter(row=>row.claimClass!=="trustee_fee");
  const feeRows=monthRows.filter(row=>row.claimClass==="trustee_fee");
  return [
   `회차 ${month}`,phaseFor(month)?.id??(ledger.rows[0]?.phaseId??missing),
   showWon(phaseFor(month)?.monthlyAvailableWon??calculation.monthlyPaymentWon),
   sumWon(monthRows.map(row=>row.principalWon)),
   sumWon(monthRows.map(row=>row.interestWon)),
   sumWon(feeRows.map(row=>row.otherComponentWon)),
   sumWon(creditorRows.flatMap(row=>[row.principalWon,row.interestWon,row.otherComponentWon])),
   sumWon(monthRows.flatMap(row=>[row.principalWon,row.interestWon,row.otherComponentWon])),
   showWon(reconciliation.unallocatedBudgets[`${month}:disposable_income`]),
   monetaryValid&&reconciliation.status==="reconciled"?"대조 완료":"대조 보류"
  ];
 });
 if(monthIds.length)summaryRows.push([
  "총계",String(term),"",
  sumWon(ledger.rows.map(row=>row.principalWon)),
  sumWon(ledger.rows.map(row=>row.interestWon)),
  sumWon(ledger.rows.map(row=>row.otherComponentWon)),
  monetaryValid?sumWon([totals.ordinaryWon,totals.priorityWon,totals.estateWon]):missing,
  monetaryValid?showWon(totals.totalWon):missing,
  monetaryValid?sumWon(monthIds.map(month=>reconciliation.unallocatedBudgets[`${month}:disposable_income`])):missing,
  monetaryValid&&reconciliation.status==="reconciled"?"합계 대조 완료":"대조 보류"
 ]);
 const blocked=ledger.status==="blocked"||reconciliation.status==="blocked"||!monetaryValid;
 return {title:"개인회생 변제예정액표 · PlanLedger",
  headers:["회차","변제일","채권·비용 ID","원금(원)","이자(원)","합계(원)","적용 단계","기타·수수료(원)","재원","잔액 후(원)"],
  rows,summary:{title:"PlanLedger 월별 예산·지급·잔액 대조",
   headers:["회차","단계","채권 예산(원)","원금 합계(원)","이자 합계(원)","수수료(원)","채권 지급(원)","전체 지급(원)","가용소득 잔액(원)","검증 상태"],rows:summaryRows},
  status:!blocked&&ledger.status==="complete"?"source_backed":"blocked",
  notes:[
   "채권자별 변제액, 단계 일정, D5110 월액은 이 PlanLedger 행을 공유합니다. 월별로 금액이 변하면 단일 월액은 확인 필요로 표시합니다.",
   "회생위원 보수는 해당 회차의 별도 비용 행으로 표시하며 일반·우선·재단채권 예산에 합산하지 않습니다.",
   "우선·재단채권은 법적 분류를 확정하지 않으며, 확인된 채권 잔액의 전액 변제 여부와 최종 회차를 별도로 대조합니다.",
   ...(!monetaryValid?["원본/정규화 원금·이자·수수료·잔액·예산 또는 기간이 미확정·누락·오인식이므로 금액 대조를 완료하지 않았습니다."]:[]),
   ...(ledger.issues.length?ledger.issues.map(issue=>"PlanLedger 입력 점검: "+issue):[]),
   ...(reconciliation.issues.length?reconciliation.issues.map(issue=>"정합성 점검: "+issue):[]),
   ...(ledger.status!=="complete"?["이 일정은 계산·검토 전 제안이며 법적 승인이나 최종 검토를 의미하지 않습니다."]:[])
  ]
 };
}
function subjects(data:CaseData,kind:"bank_account"|"lease",index?:CaseReadIndex):string[]{const facts=currentFacts(data,index),groups=new Map<string,Fact[]>();for(const f of facts){if(accountOrLeaseKey(f,kind))groups.set(f.subjectId,[...(groups.get(f.subjectId)??[]),f]);}return [...groups].filter(([id,fs])=>{const ref=fs[0]?.refs[0],doc=data.documents.find(d=>d.id===ref?.documentId),page=data.pages.find(p=>p.documentId===doc?.id&&p.page===ref?.page),type=norm((doc?.type??"")+" "+(page?.documentType??"")),explicit=fs.some(f=>norm(f.key).startsWith(kind+".")||norm(f.key).startsWith("other."+kind+".")),cat=id.split(":").at(-2),docMatch=kind==="bank_account"?/bank.?account|account.?statement|예금|계좌/.test(type):/lease|임대차|임대계약/.test(type);return explicit||(docMatch&&(cat==="other"||cat==="asset"));}).map(x=>x[0]);}
function rowFacts(data:CaseData,id:string,kind:"bank_account"|"lease",index?:CaseReadIndex){return currentFacts(data,index).filter(f=>f.subjectId===id&&accountOrLeaseKey(f,kind));}
function aggregate(data:CaseData,key:string,index?:CaseReadIndex){const all=currentFacts(data,index).filter(f=>f.key===key&&f.state==="verified"&&f.recognition==="accepted"&&sourceVerified(data,f,index)&&!!f.numeric&&moneyValue(f.numeric)!==null&&value(data,f,index)!==missing),unique=[...new Set(all.map(f=>value(data,f,index)))];return unique.length===1?all[0]:undefined;}
export function bankAccountsAnnex(data:CaseData,index:CaseReadIndex=createCaseReadIndex(data)):AnnexTable{const ids=subjects(data,"bank_account",index),rows=ids.map(id=>{const fs=rowFacts(data,id,"bank_account",index),get=(k:string)=>fieldValue(data,fs,"bank_account",k,index);return [id,get("institution"),get("owner"),get("account_number"),get("balance"),get("active"),get("as_of"),...reviewState(fs),refs(data,fs,index),get("encumbrance_status"),get("seizure_status"),get("pledge_status")];}),total=aggregate(data,"bank_accounts.recognized_total",index),limit=aggregate(data,"bank_accounts.exempt_limit",index),usable=ids.length>0&&ids.every(id=>{const fs=rowFacts(data,id,"bank_account",index),required=["institution","owner","account_number","balance","active","as_of"].map(k=>field(data,fs,"bank_account",k,index));return required.every(f=>sourceVerified(data,f,index));}),missingRows=rows.filter(r=>r.slice(1,7).some(v=>v===missing)).map(r=>r[0]);return {title:"은행계좌 및 예금 부속명세",headers:["계좌 사실 ID","금융기관","명의·소유자","계좌번호(원문 마스킹 보존)","잔액(원)","활성 여부","기준일","원문 확인 상태","법적 반영 상태","원문 근거","압류·담보 상태(통합 원문)","압류 여부(원문)","담보·질권 여부(원문)"],rows,status:usable?"source_backed":"blocked",summary:{title:"예금·면제 검토 집계",headers:["항목","검토 값","근거·검토 상태"],rows:[["전체 계좌 확인 여부",data.context.inventoryComplete.asset==="yes"?"완전 확인":missing,missing],["검토된 예금 합계",data.context.inventoryComplete.asset==="yes"?value(data,total,index):missing,total?refs(data,[total],index):"원문 대조 및 법률 검토를 마친 합계가 필요합니다."],["검토된 면제 한도",value(data,limit,index),limit?refs(data,[limit],index):"적용 법률과 기준일 및 면제요건을 확인해야 합니다."]]},notes:["동일 금융기관의 계좌는 분리하며 원문 마스킹 그대로 보존하고 가려진 숫자를 추정하지 않습니다.","일부 항목만 확인된 계좌도 원문 근거와 함께 표시합니다. 기재되지 않은 값은 확인 필요로 남깁니다.","원문 확인 상태와 법적 반영 상태를 별도 열로 표시합니다. 합계와 면제한도는 원문 대조 및 법률 검토를 마친 값만 표시합니다.",...(missingRows.length?["필수 기재 항목을 확인할 계좌: "+missingRows.length+"개"]:[]),...(!usable?["필수 필드 중 원문 검증 또는 출처 무결성 확인이 끝나지 않은 항목이 있습니다."]:[])]};}
export function leasesAnnex(data:CaseData,index:CaseReadIndex=createCaseReadIndex(data)):AnnexTable{const ids=subjects(data,"lease",index),rows=ids.map(id=>{const fs=rowFacts(data,id,"lease",index),get=(k:string)=>fieldValue(data,fs,"lease",k,index);return [id,get("tenant"),get("landlord"),get("applicant_role"),get("use"),get("deposit"),get("monthly_rent"),get("secured_balance"),get("arrears_deduction"),get("start_date"),get("end_date"),...reviewState(fs),refs(data,fs,index),get("property_address"),get("property_reference")];}),total=aggregate(data,"leases.recognized_total",index),usable=ids.length>0&&ids.every(id=>{const fs=rowFacts(data,id,"lease",index),required=["tenant","use","deposit"].map(k=>field(data,fs,"lease",k,index));return required.every(f=>sourceVerified(data,f,index));});return {title:"임대차 및 보증금 부속명세",headers:["임대차 사실 ID","임차인","임대인","신청인 역할(원문)","사용처","보증금(원)","월 차임(원)","현재 담보채무(원)","연체차임 공제(원)","계약 시작","계약 종료","원문 확인 상태","법적 반영 상태","원문 근거","임대차 목적물 주소(원문)","목적물 식별정보(원문)"],rows,status:usable?"source_backed":"blocked",summary:{title:"임대차 보증금 검토 집계",headers:["항목","검토 값","근거·검토 상태"],rows:[["검토된 인정 합계",value(data,total,index),total?refs(data,[total],index):"원문 대조 및 법률 검토를 마친 합계가 필요합니다."]]},notes:["임차인·임대인·신청인 역할은 각각 원문에서 확인된 경우만 표시하며 역할을 추정하지 않습니다.","당사자·용도·보증금·현재 담보잔액·미납차임 공제는 구분된 사실로 유지합니다.","임대인 또는 제3자 소유 재산을 신청인에게 귀속하지 않습니다. 보증금·공제의 법률상 인정은 별도 검토합니다.","원문 확인 상태와 법적 반영 상태를 분리해 표시합니다.",...(usable?[]:["확인된 값은 검토용 초안에 표시합니다. 원문 대조가 끝나지 않은 항목이 있어 문서 확정을 보류합니다."])]};}
export function repaymentScheduleAnnex(phases:Phase[],expectedInstallments?:number):AnnexTable {
  const result=expandPaymentSchedule(phases,expectedInstallments);
  const dateIssues=new Set(["FIRST_PAYMENT_DATE_UNKNOWN","INVALID_FIRST_PAYMENT_DATE","INSTALLMENT_COUNT_MISMATCH"]);
  const dateOnlyIssue=result.issues.length>0&&result.issues.every(issue=>dateIssues.has(issue));
  const ordered=[...phases].sort((a,b)=>a.firstInstallment-b.firstInstallment);
  let next=1;
  const fallbackSafe=dateOnlyIssue&&ordered.length>0&&new Set(ordered.map(p=>p.id)).size===ordered.length&&ordered.every(p=>{
    if(!Number.isInteger(p.firstInstallment)||!Number.isInteger(p.lastInstallment)||p.firstInstallment!==next||p.lastInstallment<p.firstInstallment||p.lastInstallment>maximumPlanMonths()||!/^\d+$/.test(p.monthlyAvailableWon)||!p.allocations.length||new Set(p.allocations.map(a=>a.creditorId)).size!==p.allocations.length||p.allocations.some(a=>!a.creditorId||!/^\d+$/.test(a.principalWon)||!/^\d+$/.test(a.interestWon)))return false;
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
export function proposedInstallmentAnnex(data:CaseData,calculation:CalculationResult,index:CaseReadIndex=createCaseReadIndex(data)):AnnexTable {
  const context=data.context, months=context.planMonths, payment=moneyValue(context.approvedMonthlyPayment);
  const reasons:string[]=[];
  if(calculation.caseRevision!==context.revision)reasons.push("CALCULATION_REVISION_STALE");
  const currentCalculation=calculateCase(data,DRAFT_RULESET,index);
  const allocationFingerprint=(rows:CalculationResult["allocations"])=>JSON.stringify(rows.map(row=>[row.debtId,row.creditor,row.allocatedPrincipalWon,row.allocatedInterestWon,[...row.factIds].sort(),row.basis,row.status]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
  if(calculation.computedBy!=="deterministic-bigint"||calculation.planTotalWon!==currentCalculation.planTotalWon||calculation.monthlyPaymentWon!==currentCalculation.monthlyPaymentWon||allocationFingerprint(calculation.allocations)!==allocationFingerprint(currentCalculation.allocations))reasons.push("CALCULATION_INPUTS_NOT_CURRENT");
  if(!Number.isSafeInteger(months)||months!<1||months!>maximumPlanMonths())reasons.push("EXPLICIT_PLAN_TERM_REQUIRED");
  if(payment===null||payment<=0n)reasons.push("EXPLICIT_POSITIVE_MONTHLY_PAYMENT_REQUIRED");
  if(!["principal_then_interest_pro_rata","principal_only_pro_rata"].includes(context.allocationBasis??""))reasons.push("EXPLICIT_ALLOCATION_BASIS_REQUIRED");
  if(context.inventoryComplete.debt!=="yes")reasons.push("COMPLETE_DEBT_INVENTORY_REQUIRED");
  if(data.debts.some(debt=>debt.classification!=="ordinary"||debt.secured!=="no"||debt.priority!=="ordinary"||debt.excludedByReview))reasons.push("SEPARATE_CLAIM_ALLOCATION_REQUIRED");
  const manual=context.paymentSchedule?.phases?.length;
  if(manual)reasons.push("MANUAL_SCHEDULE_PRESERVED");
  const n=Number.isSafeInteger(months)&&months!>0&&months!<=maximumPlanMonths()?months!:0;
  const planned=payment!==null&&payment>=0n&&n?payment*BigInt(n):null;
  if(planned===null||calculation.planTotalWon===null||calculation.planTotalWon!==planned.toString())reasons.push("EXPLICIT_PLAN_TOTAL_RECONCILIATION_REQUIRED");
  const resolvedDebts=resolveDebtRows(data,index).rows;
  const ordinaryDebts=resolvedDebts.filter(debt=>debt.classification==="ordinary"&&debt.secured==="no"&&debt.priority==="ordinary"&&!debt.excludedByReview);
  const ordinaryIds=new Set(ordinaryDebts.map(debt=>debt.id));
  if(!ordinaryIds.size||calculation.allocations.length!==ordinaryIds.size||calculation.allocations.some(row=>!ordinaryIds.has(row.debtId)))reasons.push("COMPLETE_ORDINARY_CREDITOR_ALLOCATIONS_REQUIRED");
  const amountsValid=calculation.allocations.every(row=>/^[0-9]+$/.test(row.allocatedPrincipalWon)&&/^[0-9]+$/.test(row.allocatedInterestWon)&&row.factIds.length>0);
  if(!amountsValid)reasons.push("CREDITOR_ALLOCATION_INPUT_INVALID");
  const currentFactsById=new Map(currentFacts(data,index).map(fact=>[fact.id,fact]));
  const debtById=new Map(ordinaryDebts.map(debt=>[debt.id,debt]));
  for(const allocation of calculation.allocations){
    const debt=debtById.get(allocation.debtId);
    if(!debt||allocation.factIds.some(id=>!debt.factIds.includes(id)||!currentFactsById.has(id)||factSourceLineageIssues(data,[id],index).some(issue=>["STALE_OR_RETRACTED_FACT","DISPUTED_OR_REJECTED_FACT","SOURCE_REFERENCE_INVALID","SOURCE_VERIFICATION_RECEIPT_INVALID"].includes(issue))))reasons.push("CREDITOR_ALLOCATION_SOURCE_BINDING_INVALID");
  }
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
