/** Explicit reviewer-managed phase/creditor allocation schedule. No dates/counts inferred. */
export type CreditorPhaseAllocation={creditorId:string;principalWon:string;interestWon:string};
export type Phase={id:string;firstInstallment:number;lastInstallment:number;firstPaymentDate?:string;monthlyAvailableWon:string;allocations:CreditorPhaseAllocation[]};
export type ScheduleRow={installment:number;paymentDate:string|null;creditorId:string;principalWon:string;interestWon:string;totalWon:string;phaseId:string};
export type PhaseTotal={phaseId:string;installments:number;monthlyAvailableWon:string;monthlyRemainderWon:string;monthlyPrincipalWon:string;monthlyInterestWon:string;monthlyTotalWon:string;totalPrincipalWon:string;totalInterestWon:string;totalWon:string};
export type ScheduleResult={status:"complete"|"blocked";rows:ScheduleRow[];totals:{principalWon:string;interestWon:string;totalWon:string};phaseTotals:PhaseTotal[];issues:string[]};
const nat=(v:string)=>/^\d+$/.test(v), zero={principalWon:"0",interestWon:"0",totalWon:"0"};
function dateParts(s:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;const [y,m,d]=s.split("-").map(Number),date=new Date(Date.UTC(y,m-1,d));return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?{y,m,d}:null;}
function addMonths(iso:string,n:number):string|null{const p=dateParts(iso);if(!p)return null;const first=new Date(Date.UTC(p.y,p.m-1+n,1)),last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();return String(first.getUTCFullYear()).padStart(4,"0")+"-"+String(first.getUTCMonth()+1).padStart(2,"0")+"-"+String(Math.min(p.d,last)).padStart(2,"0");}
export function expandPaymentSchedule(phases:Phase[],expectedInstallments?:number):ScheduleResult{
 const issues:string[]=[],rows:ScheduleRow[]=[],phaseTotals:PhaseTotal[]=[];const ordered=[...phases].sort((a,b)=>a.firstInstallment-b.firstInstallment);let next=1;
 if(!ordered.length)issues.push("NO_PHASES");
 if(new Set(ordered.map(p=>p.id)).size!==ordered.length)issues.push("DUPLICATE_PHASE_ID");
 for(let phaseIndex=0;phaseIndex<ordered.length;phaseIndex++){const p=ordered[phaseIndex];
  if(!Number.isInteger(p.firstInstallment)||!Number.isInteger(p.lastInstallment)||p.firstInstallment!==next||p.lastInstallment<p.firstInstallment){issues.push("PHASE_GAP_OVERLAP_OR_INVALID_BOUNDARY");break;}
  if(!p.allocations.length||new Set(p.allocations.map(a=>a.creditorId)).size!==p.allocations.length){issues.push("MISSING_OR_DUPLICATE_CREDITOR_ALLOCATION");break;}
  if(!nat(p.monthlyAvailableWon)){issues.push("INVALID_PHASE_BUDGET");break;}
  if(p.allocations.some(a=>!a.creditorId||!nat(a.principalWon)||!nat(a.interestWon))){issues.push("INVALID_PHASE_CREDITOR_AMOUNT");break;}
  const monthlyAllocated=p.allocations.reduce((n,a)=>n+BigInt(a.principalWon)+BigInt(a.interestWon),0n);if(monthlyAllocated>BigInt(p.monthlyAvailableWon)){issues.push("PHASE_ALLOCATION_EXCEEDS_MONTHLY_BUDGET");break;}
  if(p.lastInstallment>60){issues.push("INSTALLMENT_LIMIT_EXCEEDED");break;}
  if(!p.firstPaymentDate){issues.push("FIRST_PAYMENT_DATE_UNKNOWN");break;}if(!dateParts(p.firstPaymentDate)){issues.push("INVALID_FIRST_PAYMENT_DATE");break;}
  if(phaseIndex>0){const previous=ordered[phaseIndex-1];if(previous.firstPaymentDate){const expected=addMonths(previous.firstPaymentDate,previous.lastInstallment-previous.firstInstallment+1);if(expected&&expected!==p.firstPaymentDate){issues.push("PHASE_PAYMENT_DATES_NOT_CONTIGUOUS");break;}}}
  const principal=p.allocations.reduce((n,a)=>n+BigInt(a.principalWon),0n),interest=p.allocations.reduce((n,a)=>n+BigInt(a.interestWon),0n),count=p.lastInstallment-p.firstInstallment+1;
  let validDates=true;for(let i=p.firstInstallment;i<=p.lastInstallment;i++){const date=addMonths(p.firstPaymentDate,i-p.firstInstallment);if(!date){validDates=false;break;}for(const a of p.allocations)rows.push({installment:i,paymentDate:date,creditorId:a.creditorId,principalWon:a.principalWon,interestWon:a.interestWon,totalWon:(BigInt(a.principalWon)+BigInt(a.interestWon)).toString(),phaseId:p.id});}
  if(!validDates){issues.push("INVALID_PAYMENT_DATE");break;}
  const totalP=principal*BigInt(count),totalI=interest*BigInt(count);phaseTotals.push({phaseId:p.id,installments:count,monthlyAvailableWon:p.monthlyAvailableWon,monthlyRemainderWon:(BigInt(p.monthlyAvailableWon)-principal-interest).toString(),monthlyPrincipalWon:principal.toString(),monthlyInterestWon:interest.toString(),monthlyTotalWon:(principal+interest).toString(),totalPrincipalWon:totalP.toString(),totalInterestWon:totalI.toString(),totalWon:(totalP+totalI).toString()});next=p.lastInstallment+1;
 }
 if(expectedInstallments!==undefined&&next-1!==expectedInstallments)issues.push("INSTALLMENT_COUNT_MISMATCH");
 for(const p of ordered){if(issues.length)break;const pt=phaseTotals.find(x=>x.phaseId===p.id)!;for(let i=p.firstInstallment;i<=p.lastInstallment;i++){const month=rows.filter(r=>r.phaseId===p.id&&r.installment===i);const mp=month.reduce((x,r)=>x+BigInt(r.principalWon),0n),mi=month.reduce((x,r)=>x+BigInt(r.interestWon),0n),mt=month.reduce((x,r)=>x+BigInt(r.totalWon),0n);if(mp!==BigInt(pt.monthlyPrincipalWon)||mi!==BigInt(pt.monthlyInterestWon)||mt!==BigInt(pt.monthlyTotalWon))issues.push("PHASE_MONTHLY_ALLOCATION_CONSERVATION_FAILURE");}}
 const sums=rows.reduce((x,r)=>({principalWon:(BigInt(x.principalWon)+BigInt(r.principalWon)).toString(),interestWon:(BigInt(x.interestWon)+BigInt(r.interestWon)).toString(),totalWon:(BigInt(x.totalWon)+BigInt(r.totalWon)).toString()}),zero);
 const byPhase=phaseTotals.reduce((x,p)=>({principalWon:(BigInt(x.principalWon)+BigInt(p.totalPrincipalWon)).toString(),interestWon:(BigInt(x.interestWon)+BigInt(p.totalInterestWon)).toString(),totalWon:(BigInt(x.totalWon)+BigInt(p.totalWon)).toString()}),zero);
 if(sums.principalWon!==byPhase.principalWon||sums.interestWon!==byPhase.interestWon||sums.totalWon!==byPhase.totalWon||BigInt(sums.principalWon)+BigInt(sums.interestWon)!==BigInt(sums.totalWon))issues.push("TOTAL_CONSERVATION_FAILURE");
 return {status:issues.length?"blocked":"complete",rows:issues.length?[]:rows,totals:issues.length?zero:sums,phaseTotals:issues.length?[]:phaseTotals,issues:[...new Set(issues)]};
}
