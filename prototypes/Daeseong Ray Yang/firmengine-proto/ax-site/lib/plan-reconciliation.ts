import { moneyValue, type CaseData } from "./domain.ts";
import type { CalculationResult } from "./assessment.ts";
import type { PlanLedger } from "./repayment-plan-model.ts";

export interface PlanReconciliation {
  status:"reconciled"|"blocked";
  issues:string[];
  totals:{principalWon:string;interestWon:string;otherComponentWon:string;totalWon:string;ordinaryWon:string;priorityWon:string;estateWon:string;trusteeFeeWon:string};
  /** Budget left unused by the scheduled rows, broken out by installment and funding category. */
  unallocatedBudgets:Record<string,string>;
  priorityPayoffInstallment:Record<string,number|null>;
  priorityCoverage:Record<string,{scheduledWon:string;uncoveredWon:string;deadlineInstallment:number;status:"covered"|"blocked"|"unknown"}>;
  legalReviewTasks?:string[];
}
/** Explicit case policy input for a unit-reviewed priority deadline; this is not a legal classification rule. */
export interface PriorityCoveragePolicy { deadlineInstallment:number; applicability:"confirmed"|"unknown"; }
const nat=(v:unknown)=>typeof v==="string"&&/^\d+$/.test(v);

export function reconcilePlanLedger(data:CaseData,calculation:CalculationResult,ledger:PlanLedger,options:{priorityPolicies?:Record<string,PriorityCoveragePolicy>}={}):PlanReconciliation {
 const issues=[...ledger.issues],byMonth=new Map<number,typeof ledger.rows>();
 if(ledger.status==="blocked")issues.push("PLAN_LEDGER_BLOCKED");
 for(const r of ledger.rows){
  if(!Number.isInteger(r.installment)||r.installment<1)issues.push("INVALID_INSTALLMENT");
  const list=byMonth.get(r.installment)??[];list.push(r);byMonth.set(r.installment,list);
  for(const amount of [r.principalWon,r.interestWon,r.otherComponentWon,r.balanceAfter])if(!nat(amount))issues.push("INVALID_LEDGER_MONEY");
  if(r.claimClass==="trustee_fee"&&(r.debtId!=="system:trustee-fee"||r.principalWon!=="0"||r.interestWon!=="0"||r.fundingSourceId!=="disposable_income"))issues.push("INVALID_TRUSTEE_FEE_ROW");
 }
 const expected=data.context.paymentSchedule?.expectedInstallments??data.context.planMonths??0;
 if(expected>0){for(let m=1;m<=expected;m++)if(!byMonth.has(m))issues.push("MISSING_MONTH:"+m);for(const m of byMonth.keys())if(m>expected)issues.push("MONTH_AFTER_TERM:"+m);}
 const unallocatedBudgets:Record<string,string>={};
 for(const [month,rows] of byMonth){
  const creditorRows=rows.filter(r=>r.claimClass!=="trustee_fee");
  if(new Set(creditorRows.map(r=>r.debtId)).size!==creditorRows.length)issues.push("DUPLICATE_DEBT_MONTH:"+month);
  const budgets={ordinary:calculation.ordinaryRepaymentBudgetWon,priority:data.context.monthlyPriorityPayment?.amountWon,estate:data.context.monthlyEstatePayment?.amountWon,trustee_fee:moneyValue(data.context.monthlyTrusteeFee)?.toString()??null};
  for(const cls of ["ordinary","priority","estate","trustee_fee"] as const){
   const cap=budgets[cls],paid=rows.filter(r=>r.claimClass===cls).reduce((n,r)=>n+BigInt(r.principalWon)+BigInt(r.interestWon)+BigInt(r.otherComponentWon),0n);
   if(cap==null||!nat(cap)){if(paid>0n)issues.push("CATEGORY_BUDGET_MISSING:"+month+":"+cls);}
   else if(paid>BigInt(cap))issues.push("CATEGORY_BUDGET_EXCEEDED:"+month+":"+cls);
   else unallocatedBudgets[`${month}:${cls}`]=(BigInt(cap)-paid).toString();
  }
  // paymentSchedule.monthlyAvailableWon covers claim payments; the disposable income
  // cap also covers the separately scheduled monthly trustee fee.
  const phase=data.context.paymentSchedule?.phases.find(p=>month>=p.firstInstallment&&month<=p.lastInstallment);
  const scheduleCap=phase?.monthlyAvailableWon??calculation.monthlyPaymentWon;
  const claimPaid=creditorRows.reduce((n,r)=>n+BigInt(r.principalWon)+BigInt(r.interestWon)+BigInt(r.otherComponentWon),0n);
  if(scheduleCap==null||!nat(scheduleCap)){if(claimPaid>0n)issues.push("MONTHLY_BUDGET_MISSING:"+month);}
  else if(claimPaid>BigInt(scheduleCap))issues.push("MONTHLY_BUDGET_EXCEEDED:"+month);
  else unallocatedBudgets[`${month}:schedule_total`]=(BigInt(scheduleCap)-claimPaid).toString();
  const disposable=calculation.disposableIncomeWon,totalPaid=rows.reduce((n,r)=>n+BigInt(r.principalWon)+BigInt(r.interestWon)+BigInt(r.otherComponentWon),0n);
  if(disposable==null||!nat(disposable)){if(totalPaid>0n)issues.push("DISPOSABLE_INCOME_BUDGET_MISSING:"+month);}
  else if(totalPaid>BigInt(disposable))issues.push("DISPOSABLE_INCOME_BUDGET_EXCEEDED:"+month);
  else unallocatedBudgets[`${month}:disposable_income`]=(BigInt(disposable)-totalPaid).toString();
 }
 const payoff:Record<string,number|null>={},priorityCoverage:PlanReconciliation["priorityCoverage"]={},legalReviewTasks:string[]=[];
 for(const debt of data.debts){
  const rows=ledger.rows.filter(row=>row.debtId===debt.id),isPriority=debt.priority==="priority"||debt.priority==="estate"||debt.classification==="estate";
  if(!rows.length&&!isPriority)continue;
  const principal=debt.principal?.amountWon,interest=debt.interest?.amountWon;
  if(principal==null||interest==null||!nat(principal)||!nat(interest)){issues.push("CLAIM_BALANCE_MISSING:"+debt.id);if(isPriority)priorityCoverage[debt.id]={scheduledWon:"0",uncoveredWon:"0",deadlineInstallment:expected,status:"unknown"};continue;}
  const cap=BigInt(principal)+BigInt(interest);let paid=0n,when:number|null=null;
  for(const row of [...rows].sort((a,b)=>a.installment-b.installment)){
   paid+=BigInt(row.principalWon)+BigInt(row.interestWon)+BigInt(row.otherComponentWon);
   if(paid>cap)issues.push("PAYMENT_EXCEEDS_CLAIM:"+debt.id);
   if(when===null&&paid>=cap)when=row.installment;
  }
  if(isPriority){
   payoff[debt.id]=when;const policy=options.priorityPolicies?.[debt.id],deadline=policy?.deadlineInstallment??expected;
   const policyValid=Number.isSafeInteger(deadline)&&deadline>=1&&deadline<=Math.max(expected,1);
   const deadlinePaid=ledger.rows.filter(row=>row.debtId===debt.id&&row.installment<=deadline).reduce((n,row)=>n+BigInt(row.principalWon)+BigInt(row.interestWon)+BigInt(row.otherComponentWon),0n);
   const scheduled=deadlinePaid<cap?deadlinePaid:cap,uncovered=cap-scheduled;
   const status=policy?.applicability==="unknown"||!policyValid?"unknown":uncovered===0n?"covered":"blocked";
   priorityCoverage[debt.id]={scheduledWon:scheduled.toString(),uncoveredWon:uncovered.toString(),deadlineInstallment:deadline,status};
   if(status==="unknown")legalReviewTasks.push("PRIORITY_COVERAGE_POLICY_REVIEW:"+debt.id);
   else if(uncovered>0n)issues.push("PRIORITY_ESTATE_NOT_FULLY_PAID_BY_DEADLINE:"+debt.id);
  }
 }
 const zero={principalWon:"0",interestWon:"0",otherComponentWon:"0",totalWon:"0"};
 const sums=ledger.rows.reduce<typeof zero>((a,r)=>({principalWon:(BigInt(a.principalWon)+BigInt(r.principalWon)).toString(),interestWon:(BigInt(a.interestWon)+BigInt(r.interestWon)).toString(),otherComponentWon:(BigInt(a.otherComponentWon)+BigInt(r.otherComponentWon)).toString(),totalWon:(BigInt(a.totalWon)+BigInt(r.principalWon)+BigInt(r.interestWon)+BigInt(r.otherComponentWon)).toString()}),zero);
 const classSums={ordinaryWon:"0",priorityWon:"0",estateWon:"0",trusteeFeeWon:"0"};
 for(const row of ledger.rows){const key=row.claimClass==="ordinary"?"ordinaryWon":row.claimClass==="priority"?"priorityWon":row.claimClass==="estate"?"estateWon":"trusteeFeeWon";classSums[key]=(BigInt(classSums[key])+BigInt(row.principalWon)+BigInt(row.interestWon)+BigInt(row.otherComponentWon)).toString();}
 if(calculation.planTotalWon!==null&&BigInt(classSums.ordinaryWon)!==BigInt(calculation.planTotalWon))legalReviewTasks.push("ORDINARY_ALLOCATION_UNRESOLVED");
 return {status:issues.length?"blocked":"reconciled",issues:[...new Set(issues)],totals:{...sums,...classSums},unallocatedBudgets,priorityPayoffInstallment:payoff,priorityCoverage,...(legalReviewTasks.length?{legalReviewTasks:[...new Set(legalReviewTasks)]}:{})};
}
