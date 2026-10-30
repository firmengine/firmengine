import { moneyValue, type CaseData, type Money } from "./domain.ts";
import type { CalculationResult } from "./assessment.ts";

export type PlanClaimClass = "ordinary" | "priority" | "estate" | "trustee_fee";
export interface PlanLedgerRow {
  installment:number; paymentDate:string|null; phaseId:string; debtId:string; claimClass:PlanClaimClass;
  principalWon:Money; interestWon:Money; otherComponentWon:Money; fundingSourceId:string;
  balanceAfter:Money; sourceIds:string[];
}
export interface PlanLedger { status:"complete"|"provisional"|"blocked"; rows:PlanLedgerRow[]; issues:string[]; }
const nat=(s:unknown):s is string=>typeof s==="string"&&/^\d+$/.test(s);
function dateParts(s:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;const [y,m,d]=s.split("-").map(Number),v=new Date(Date.UTC(y,m-1,d));return v.getUTCFullYear()===y&&v.getUTCMonth()===m-1&&v.getUTCDate()===d?{y,m,d}:null;}
function addMonths(s:string,n:number){const p=dateParts(s);if(!p)return null;const first=new Date(Date.UTC(p.y,p.m-1+n,1)),last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();return `${first.getUTCFullYear().toString().padStart(4,"0")}-${(first.getUTCMonth()+1).toString().padStart(2,"0")}-${Math.min(p.d,last).toString().padStart(2,"0")}`;}
function addTrusteeFeeRows(data:CaseData,rows:PlanLedgerRow[],installments:number,issues:string[],phaseIdFor:(month:number)=>string,paymentDateFor:(month:number)=>string|null){
 const fee=moneyValue(data.context.monthlyTrusteeFee);
 if(fee===null||fee<0n){issues.push("TRUSTEE_FEE_AMOUNT_MISSING");return;}
 for(let installment=1;installment<=installments;installment++)rows.push({installment,paymentDate:paymentDateFor(installment),phaseId:phaseIdFor(installment),debtId:"system:trustee-fee",claimClass:"trustee_fee",principalWon:"0",interestWon:"0",otherComponentWon:fee.toString(),fundingSourceId:"disposable_income",balanceAfter:"0",sourceIds:[]});
}
function orderRows(rows:PlanLedgerRow[]):PlanLedgerRow[]{const rank:Record<PlanClaimClass,number>={ordinary:0,priority:1,estate:2,trustee_fee:3};return rows.sort((a,b)=>a.installment-b.installment||rank[a.claimClass]-rank[b.claimClass]||a.debtId.localeCompare(b.debtId));}

/** Builds a stable, debt-keyed ledger from the reviewed schedule inputs and calculation snapshot. */
export function buildRepaymentPlanModel(data:CaseData, calculation:CalculationResult):PlanLedger {
 const schedule=data.context.paymentSchedule;
 const issues:string[]=[],rows:PlanLedgerRow[]=[], debts=new Map(data.debts.map(d=>[d.id,d]));
 const months=data.context.planMonths;
 // Missing or malformed claim money must never become a zero balance (or
 // throw inside BigInt) when the repayment schedule is marked reviewed.
 // This is a typed-money integrity gate, not legal recognition of a claim.
 const invalidClaimBalances=data.debts.filter(debt=>!nat(debt.principal?.amountWon)||!nat(debt.interest?.amountWon)).map(debt=>"CLAIM_BALANCE_MISSING:"+debt.id);
 if(invalidClaimBalances.length)return {status:"blocked",rows:[],issues:[...new Set(invalidClaimBalances)]};
 if(!schedule||schedule.phases.length===0){
  if(!Number.isSafeInteger(months)||months!<1||calculation.planTotalWon===null)return {status:"blocked",rows:[],issues:["DEFAULT_PLAN_INPUTS_MISSING"]};
  const balances=new Map(data.debts.map(d=>[d.id,(BigInt(d.principal?.amountWon??"0")+BigInt(d.interest?.amountWon??"0"))]));
  const allocations=calculation.allocations;
  for(let month=1;month<=months!;month++)for(const a of allocations){
   const p=BigInt(a.allocatedPrincipalWon),i=BigInt(a.allocatedInterestWon),n=BigInt(months!);
   const mp=p/n+(BigInt(month)<=p%n?1n:0n),mi=i/n+(BigInt(month)<=i%n?1n:0n),debt=debts.get(a.debtId);
   if(!debt){issues.push("SCHEDULE_DEBT_MISSING");continue;}
   const claimClass:PlanClaimClass=debt.priority==="estate"||debt.classification==="estate"?"estate":debt.priority==="priority"||debt.classification==="tax"?"priority":"ordinary";
   const rem=balances.get(debt.id)??0n, paid=mp+mi, after=rem>paid?rem-paid:0n;balances.set(debt.id,after);
   rows.push({installment:month,paymentDate:null,phaseId:"generated-default",debtId:debt.id,claimClass,principalWon:mp.toString(),interestWon:mi.toString(),otherComponentWon:"0",fundingSourceId:claimClass==="ordinary"?"ordinary_budget":claimClass==="priority"?"priority_budget":"estate_budget",balanceAfter:after.toString(),sourceIds:[...a.factIds]});
  }
  addTrusteeFeeRows(data,rows,months!,issues,()=>"generated-default",()=>null);
  return {status:issues.length?"blocked":"provisional",rows:orderRows(rows),issues:[...new Set(issues)]};
 }
 const expectedInstallments=schedule.expectedInstallments??data.context.planMonths;
 if(expectedInstallments!==undefined&&expectedInstallments!==data.context.planMonths)issues.push("INSTALLMENT_COUNT_MISMATCH");
 const phases=[...schedule.phases].sort((a,b)=>a.firstInstallment-b.firstInstallment); let next=1;
 if(new Set(phases.map(p=>p.id)).size!==phases.length)issues.push("DUPLICATE_PHASE_ID");
 const balances=new Map(data.debts.map(d=>[d.id,(BigInt(d.principal?.amountWon??"0")+BigInt(d.interest?.amountWon??"0"))]));
 for(const phase of phases){
  if(phase.firstInstallment!==next||phase.lastInstallment<phase.firstInstallment){issues.push("MISSING_OR_DUPLICATE_MONTH");break;}
  if(phase.firstPaymentDate&&!dateParts(phase.firstPaymentDate)){issues.push("INVALID_PAYMENT_DATE");break;}
  if(!nat(phase.monthlyAvailableWon)){issues.push("INVALID_PHASE_BUDGET");break;}
  const seen=new Set<string>();
  for(const a of phase.allocations){
   if(seen.has(a.creditorId)){issues.push("DUPLICATE_CREDITOR_MONTH");continue;} seen.add(a.creditorId);
   const debt=debts.get(a.creditorId); if(!debt){issues.push("SCHEDULE_DEBT_MISSING");continue;}
   if(!nat(a.principalWon)||!nat(a.interestWon)){issues.push("INVALID_SCHEDULE_AMOUNT");continue;}
   const claimClass:PlanClaimClass=debt.priority==="estate"||debt.classification==="estate"?"estate":debt.priority==="priority"||debt.classification==="tax"?"priority":"ordinary";
   for(let installment=phase.firstInstallment;installment<=phase.lastInstallment;installment++){
    const principal=BigInt(a.principalWon),interest=BigInt(a.interestWon);
    const balance=balances.get(debt.id)??0n, paid=principal+interest, after=balance>paid?balance-paid:0n;balances.set(debt.id,after);
    const date=phase.firstPaymentDate??null, day=date?.slice(8,10),monthDate=date&&day?new Date(Date.UTC(Number(date.slice(0,4)),Number(date.slice(5,7))-1+installment-phase.firstInstallment,1)):null;
    const paymentDate=monthDate?`${monthDate.getUTCFullYear().toString().padStart(4,"0")}-${(monthDate.getUTCMonth()+1).toString().padStart(2,"0")}-${Math.min(Number(day),new Date(Date.UTC(monthDate.getUTCFullYear(),monthDate.getUTCMonth()+1,0)).getUTCDate()).toString().padStart(2,"0")}`:null;
    rows.push({installment,paymentDate,phaseId:phase.id,debtId:debt.id,claimClass,principalWon:a.principalWon,interestWon:a.interestWon,otherComponentWon:"0",fundingSourceId:claimClass==="ordinary"?"ordinary_budget":claimClass==="priority"?"priority_budget":"estate_budget",balanceAfter:after.toString(),sourceIds:[...debt.factIds]});
   }
  }
  next=phase.lastInstallment+1;
 }
 for(let i=1;i<phases.length;i++){const previous=phases[i-1]!,current=phases[i]!;if(previous.firstPaymentDate&&current.firstPaymentDate){const expected=addMonths(previous.firstPaymentDate,previous.lastInstallment-previous.firstInstallment+1);if(expected&&expected!==current.firstPaymentDate)issues.push("PHASE_PAYMENT_DATES_NOT_CONTIGUOUS");}}
 if(expectedInstallments!==undefined&&next-1!==expectedInstallments)issues.push("TERM_BOUNDARY_MISMATCH");
 const feeInstallments=expectedInstallments??next-1;
 addTrusteeFeeRows(data,rows,feeInstallments,issues,month=>phases.find(p=>month>=p.firstInstallment&&month<=p.lastInstallment)?.id??"manual-uncovered-month",month=>{const row=rows.find(r=>r.installment===month);if(row)return row.paymentDate;const phase=phases.find(p=>month>=p.firstInstallment&&month<=p.lastInstallment);if(!phase?.firstPaymentDate)return null;return addMonths(phase.firstPaymentDate,month-phase.firstInstallment);});
 const hasPriority=data.debts.some(d=>d.priority==="priority"||d.priority==="estate"||d.classification==="estate");
 if(hasPriority)for(const debt of data.debts.filter(d=>d.priority==="priority"||d.priority==="estate"||d.classification==="estate")){
  const amounts=[debt.principal?.amountWon,debt.interest?.amountWon];
  if(amounts.some(x=>x==null||!nat(x))){issues.push("PRIORITY_CLAIM_BALANCE_UNKNOWN:"+debt.id);continue;}
  const due=BigInt(amounts[0]!)+BigInt(amounts[1]!);
  const paid=rows.filter(r=>r.debtId===debt.id).reduce((n,r)=>n+BigInt(r.principalWon)+BigInt(r.interestWon)+BigInt(r.otherComponentWon),0n);
  if(due>0n&&paid===0n)issues.push("PRIORITY_CLAIM_ZERO_PAYMENT:"+debt.id);
 }
 if(calculation.caseRevision!==data.context.revision)issues.push("CALCULATION_SNAPSHOT_STALE");
 return {status:issues.length?"blocked":schedule.reviewed?"complete":"provisional",rows:orderRows(rows),issues:[...new Set(issues)]};
}
