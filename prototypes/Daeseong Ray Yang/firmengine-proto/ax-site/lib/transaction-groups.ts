export interface TransactionEvidence { id:string; accountId?:string|null; counterpartyId?:string|null; transactionId?:string|null; date?:string|null; amount?:string|null; direction?:"in"|"out"; category?:string|null; status?:"posted"|"pending"|"cancelled"|"reversed"; relatedTransactionId?:string|null }
export interface TransactionGroup { id:string; policy?:{kind:"firm_review_policy";thresholdWon:string|null;legalThreshold:false}; totalAmountWon?:string|null; belowReviewThreshold?:boolean|null; kind:"duplicate_candidate"|"refund_or_reversal_candidate"|"self_transfer_candidate"|"repeated_withdrawal_candidate"; transactionIds:string[]; status:"candidate"|"unknown"; matchedEvidence:string[]; counterexamples:string[]; unknowns:string[]; requiredDocuments:string[]; determination:"none" }
export interface TransactionGroupInput { transactions:readonly TransactionEvidence[]; completePeriods?:readonly string[]; windowDays?:number; minimumCount?:number; reviewThresholdWon?:string|null }
const day=(d:string|null|undefined)=>d&&/^\d{4}-\d{2}-\d{2}$/.test(d)?Date.parse(d+"T00:00:00Z"):NaN;
const amount=(a:string|null|undefined)=>a&&/^\d+$/.test(a)?BigInt(a):null;
/** Evidence grouping only. Candidate labels never decide fraud, preference, or legal treatment. */
export function groupTransactionEvidence(input:TransactionGroupInput):TransactionGroup[] {
 const rows=input.transactions, out:TransactionGroup[]=[]; const seen=new Set<string>();
 const add=(kind:TransactionGroup["kind"], ids:string[], matched:string[], counterexamples:string[], unknowns:string[], docs:string[])=>{const key=kind+":"+[...ids].sort().join(",");if(!seen.has(key)){seen.add(key);out.push({id:key,kind,transactionIds:[...new Set(ids)].sort(),status:unknowns.length?"unknown":"candidate",matchedEvidence:matched,counterexamples,unknowns,requiredDocuments:docs,determination:"none"});}};
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
  const a=rows[i],b=rows[j], av=amount(a.amount),bv=amount(b.amount), gap=Math.abs(day(a.date)-day(b.date))/86_400_000;
  if(a.transactionId&&a.transactionId===b.transactionId&&a.accountId===b.accountId&&av!==null&&av===bv) add("duplicate_candidate",[a.id,b.id],["same_transaction_id","same_account","same_amount"],["could be repeated statement representation"],[],["original statements","bank transaction detail"]);
  if(a.accountId===b.accountId&&av!==null&&bv!==null&&av===bv&&a.direction!==b.direction&&Number.isFinite(gap)&&gap<=(input.windowDays??30)&&((a.relatedTransactionId===b.id)||(b.relatedTransactionId===a.id)||a.status==="reversed"||b.status==="reversed")) add("refund_or_reversal_candidate",[a.id,b.id],["same_account","same_amount","opposite_direction","nearby_dates"],["could be separate unrelated transactions"],[],["refund or reversal notice","account statement"]);
  if(a.accountId&&b.accountId&&a.accountId!==b.accountId&&av!==null&&bv!==null&&av===bv&&a.direction!==b.direction&&Number.isFinite(gap)&&gap<=(input.windowDays??3)) add("self_transfer_candidate",[a.id,b.id],["different_accounts","same_amount","opposite_direction","nearby_dates"],["third-party payment","timing coincidence","fees or partial matching"],["account ownership confirmation","complete statement period"],["statements for both accounts","account ownership evidence"]);
 }
 const outs=rows.filter(r=>r.direction==="out"&&r.status!=="cancelled"&&r.status!=="reversed");
 const buckets=new Map<string,TransactionEvidence[]>();
 for(const r of outs){if(!r.accountId||!r.counterpartyId||!r.date||amount(r.amount)===null)continue;const month=r.date.slice(0,7),key=`${r.accountId}:${r.counterpartyId}:${month}`;buckets.set(key,[...(buckets.get(key)??[]),r]);}
 for(const [key,items] of buckets){if(items.length<(input.minimumCount??3))continue;const [account,counterparty,month]=key.split(":");const complete=(input.completePeriods??[]).includes(month);add("repeated_withdrawal_candidate",items.map(x=>x.id),["same_account","same_counterparty","repeated_outflows"],["routine living expense","scheduled payment","ATM cash withdrawals"],complete?[]:[`period_incomplete:${month}`],["full-period account statement","purpose or receipt records"]);
  const candidate=out[out.length-1];
  const total=items.reduce((sum,x)=>sum+amount(x.amount)!,0n);
  candidate.totalAmountWon=total.toString();
  candidate.policy={kind:"firm_review_policy",thresholdWon:input.reviewThresholdWon??null,legalThreshold:false};
  candidate.belowReviewThreshold=input.reviewThresholdWon==null?null:total<BigInt(input.reviewThresholdWon);}
 return out;
}
