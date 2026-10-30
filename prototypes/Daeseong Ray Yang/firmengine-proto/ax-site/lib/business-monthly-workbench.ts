/** Source-month inventory for independent business-income reconciliation.
 * This deliberately DOES NOT write an IncomeSource, recognized expense, legal
 * net amount or official D5103 form value. Document names, payer names and
 * matching sums are not proof of a common business identity.
 */
import {createCaseReadIndex,type CaseData,type CaseReadIndex} from "./domain.ts";
import {auditBusinessSourceEvidence,type BusinessSourceMoneyRow} from "./business-source-evidence.ts";

export const BUSINESS_MONTHLY_WORKBENCH_VERSION="business-monthly-evidence/1";
export type MonthlyGap=
  "BUSINESS_MONTH_NO_SOURCE_ROWS"|"BUSINESS_GROSS_TOTAL_MISSING"|
  "BUSINESS_GROSS_TOTAL_MULTIPLE"|"BUSINESS_COST_EVIDENCE_MISSING"|
  "BUSINESS_COST_TOTAL_AND_LINES_OVERLAP"|"BUSINESS_COST_ROW_AMOUNT_AMBIGUOUS"|
  "BUSINESS_SOURCE_VALUE_UNVERIFIED"|"BUSINESS_SOURCE_PERIOD_NOT_SINGLE_MONTH"|
  "BUSINESS_PERIOD_PARTIAL_OR_UNKNOWN"|"BUSINESS_IDENTITY_NOT_CROSSWALKED"|
  "BUSINESS_VAT_TREATMENT_NOT_REVIEWED"|"BUSINESS_RETURNS_NOT_REVIEWED";
export interface MonthEvidenceSummary {
  month:string;
  selectedSourceFactIds:string[];
  selectedSourceRecordIds:string[];
  revenueGrossFacts:string[];
  costLineFacts:string[];
  costSummaryFacts:string[];
  componentSalesFacts:string[];
  receiptAndTaxFacts:string[];
  sourceGrossWon:string|null;
  sumRawCostLinesWon:string|null;
  /** Arithmetic only. Never used as legal net income or an approved form token. */
  arithmeticDifferenceWon:string|null;
  gaps:MonthlyGap[];
  status:"needs_evidence"|"arithmetic_preview_not_legal_income";
  legalNetApproved:false;
}
export interface BusinessMonthWorkbench {
  schemaVersion:typeof BUSINESS_MONTHLY_WORKBENCH_VERSION;
  caseRevision:number;
  selectedPeriod:{start:string;end:string}|null;
  expectedMonths:number;
  months:MonthEvidenceSummary[];
  unassignedSourceFacts:{factId:string;reason:string}[];
  outsideSelectedPeriodFactIds:string[];
  sourceMoneyFactCount:number;
  incompleteSourceCoverage:boolean;
  legalIncomeApproved:false;
}
const unique=(a:string[])=>[...new Set(a)].sort();
const validDate=(s:string)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const day=new Date(s+"T00:00:00.000Z");
 return Number.isFinite(day.getTime())&&day.toISOString().slice(0,10)===s;
};
const fullMonth=(start:string|null,end:string|null):string|null=>{
 if(!start||!end||!validDate(start)||!validDate(end)||start.slice(0,7)!==end.slice(0,7)||!start.endsWith("-01"))
   return null;
 const d=new Date(start+"T00:00:00.000Z");
 const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).toISOString().slice(0,10);
 return end===last?start.slice(0,7):null;
};
function selectedMonths(period:{start:string;end:string}|null):string[]{
 if(!period||!validDate(period.start)||!validDate(period.end)||period.start>period.end)
   return [];
 const first=new Date(period.start+"T00:00:00.000Z");
 const last=new Date(period.end+"T00:00:00.000Z");
 const length=(last.getUTCFullYear()-first.getUTCFullYear())*12+last.getUTCMonth()-first.getUTCMonth()+1;
 if(first.getUTCDate()!==1 ||
    last.getUTCDate()!==new Date(Date.UTC(last.getUTCFullYear(),last.getUTCMonth()+1,0)).getUTCDate() ||
    length<1||length>60)return [];
 return Array.from({length},(_,i)=>new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+i,1)).toISOString().slice(0,7));
}
const sumMoney=(rows:BusinessSourceMoneyRow[]):string|null=>
 rows.length&&rows.every(row=>row.verifiedAndAcceptedSource&&row.amountWon!==null&&/^\d+$/.test(row.amountWon))
 ? rows.reduce((total,row)=>total+BigInt(row.amountWon!),0n).toString():null;

/** Pure deterministic grouping. The output is an EVIDENCE workbook, not a
 * statutory expense-deductibility or legal net-income judgment.
 */
export function assembleBusinessMonthEvidence(rows:readonly BusinessSourceMoneyRow[],period:{start:string;end:string}|null){
 const expected=selectedMonths(period);
 const groups=new Map<string,BusinessSourceMoneyRow[]>();
 const unmatched:{factId:string;reason:string}[]=[];
 const outside:string[]=[];
 for(const row of rows){
  if(row.periodOverlap==="outside"){outside.push(row.factId);continue;}
  const key=fullMonth(row.periodStart,row.periodEnd);
  if(!key){unmatched.push({factId:row.factId,reason:"SOURCE_PERIOD_NOT_EXACT_ONE_CALENDAR_MONTH"});continue;}
  groups.set(key,[...(groups.get(key)??[]),row]);
 }
 const periods=expected.length?expected:unique([...groups.keys()]);
 const months:MonthEvidenceSummary[]=periods.map((month):MonthEvidenceSummary=>{
  const entries=groups.get(month)??[];
  const byRole=(role:BusinessSourceMoneyRow["role"])=>
    entries.filter(entry=>entry.role===role);
  const gross=byRole("turnover_total"),cost=byRole("cost_line"),summaries=byRole("cost_summary"),
   components=byRole("turnover_component"),refunds=byRole("returns_refunds"),
   tax=[...byRole("vat_collected"),...byRole("input_vat")],
   receipts=[...byRole("gross_receivable"),...byRole("net_cash_received"),...byRole("withheld_tax")];
  const gaps:MonthlyGap[]=[];
  if(!entries.length)gaps.push("BUSINESS_MONTH_NO_SOURCE_ROWS");
  if(gross.length===0)gaps.push("BUSINESS_GROSS_TOTAL_MISSING");
  if(gross.length>1)gaps.push("BUSINESS_GROSS_TOTAL_MULTIPLE");
  if(!cost.length&&!summaries.length)gaps.push("BUSINESS_COST_EVIDENCE_MISSING");
  if(cost.length&&summaries.length)gaps.push("BUSINESS_COST_TOTAL_AND_LINES_OVERLAP");
  if(new Set(cost.map(row=>row.sourceRecordId)).size!==cost.length)gaps.push("BUSINESS_COST_ROW_AMOUNT_AMBIGUOUS");
  if(entries.some(row=>!row.verifiedAndAcceptedSource||row.amountWon===null))gaps.push("BUSINESS_SOURCE_VALUE_UNVERIFIED");
  if(entries.some(row=>row.periodOverlap!=="inside"))gaps.push("BUSINESS_PERIOD_PARTIAL_OR_UNKNOWN");
  if(entries.length)gaps.push("BUSINESS_IDENTITY_NOT_CROSSWALKED");
  if(gross.length||components.length||tax.length)gaps.push("BUSINESS_VAT_TREATMENT_NOT_REVIEWED");
  if(refunds.length)gaps.push("BUSINESS_RETURNS_NOT_REVIEWED");
  const grossValue=gross.length===1?sumMoney(gross):null;
  const costValue=cost.length&&!summaries.length&&
    new Set(cost.map(row=>row.sourceRecordId)).size===cost.length?sumMoney(cost):null;
  // Arithmetic preview is allowed only for a single verified gross total and
  // fully verified, individually located cost lines within the same exact month.
  // It is NOT legal income and cannot be automatically projected into CaseData.
  // A VAT document's revenue and a separate expense ledger are not proven
  // to belong to the same business merely because their month agrees.
  // Only same-record arithmetic may be shown before staff crosswalk review.
  const sameSourceRow=gross.length===1&&cost.length>0&&
    cost.every(row=>row.sourceRecordId===gross[0].sourceRecordId);
  const arithmetic=grossValue!==null&&costValue!==null&&sameSourceRow&&
    entries.every(row=>row.verifiedAndAcceptedSource)&&
    !refunds.length ? (BigInt(grossValue)-BigInt(costValue)).toString():null;
  return {month,selectedSourceFactIds:unique(entries.map(row=>row.factId)),
   selectedSourceRecordIds:unique(entries.map(row=>row.sourceRecordId)),
   revenueGrossFacts:gross.map(row=>row.factId),
   costLineFacts:cost.map(row=>row.factId),
   costSummaryFacts:summaries.map(row=>row.factId),
   componentSalesFacts:components.map(row=>row.factId),
   receiptAndTaxFacts:[...tax,...receipts,...refunds].map(row=>row.factId),
   sourceGrossWon:grossValue,sumRawCostLinesWon:costValue,
   arithmeticDifferenceWon:arithmetic,gaps:unique(gaps) as MonthlyGap[],
   status:arithmetic===null?"needs_evidence":"arithmetic_preview_not_legal_income",
   legalNetApproved:false as const};
 });
 // A dated row outside a reviewed window is never reclassified as inside.
 const listed=new Set(periods),other=groups.entries();
 for(const [month,entries] of other)if(expected.length&&!listed.has(month))
   outside.push(...entries.map(row=>row.factId));
 return {expectedMonths:expected.length,months,unassignedSourceFacts:unmatched,
  outsideSelectedPeriodFactIds:unique(outside),
  incompleteSourceCoverage:expected.length===0 || months.some(row=>row.gaps.some(gap=>[
   "BUSINESS_MONTH_NO_SOURCE_ROWS","BUSINESS_GROSS_TOTAL_MISSING","BUSINESS_GROSS_TOTAL_MULTIPLE",
   "BUSINESS_COST_EVIDENCE_MISSING","BUSINESS_COST_TOTAL_AND_LINES_OVERLAP",
   "BUSINESS_COST_ROW_AMOUNT_AMBIGUOUS","BUSINESS_SOURCE_VALUE_UNVERIFIED",
   "BUSINESS_PERIOD_PARTIAL_OR_UNKNOWN","BUSINESS_RETURNS_NOT_REVIEWED",
   "BUSINESS_IDENTITY_NOT_CROSSWALKED"].includes(gap))) || unmatched.length>0};
}
export function buildBusinessMonthlyWorkbench(data:CaseData,index:CaseReadIndex=createCaseReadIndex(data)):BusinessMonthWorkbench{
 if(index.owner!==data)throw Error("BUSINESS_MONTH_WRONG_CASE");
 // Exhaust paginated source observations. Never silently use the first 1,000.
 let offset=0,complete=false,count=0;
 const all:BusinessSourceMoneyRow[]=[];
 for(let page=0;page<50;page++){
  const result=auditBusinessSourceEvidence(data,index,{offset,limit:1000});
  count=result.total;
  all.push(...result.rows);
  if(result.nextOffset===null){complete=true;break;}
  offset=result.nextOffset;
 }
 if(!complete||all.length!==count)throw Error("BUSINESS_MONTH_SOURCE_LIST_TOO_LARGE");
 const period=data.context.filingPeriod??null;
 return {schemaVersion:BUSINESS_MONTHLY_WORKBENCH_VERSION,caseRevision:data.context.revision,
  selectedPeriod:period,sourceMoneyFactCount:count,
  ...assembleBusinessMonthEvidence(all,period),legalIncomeApproved:false};
}
