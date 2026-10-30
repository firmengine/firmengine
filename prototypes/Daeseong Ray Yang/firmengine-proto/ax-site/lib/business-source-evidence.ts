/** Exact source-row observations for business income reconciliation.
 * Revenue, costs, tax, withheld cash and receipts are distinct measures.
 * No legal expense recognition, VAT adjustment, cross-document business
 * identity match, or arithmetic aggregation occurs in this read-only audit.
 */
import {createCaseReadIndex,currentFacts,moneyValue,validSourceRef,factSourceLineageIssues,type CaseData,type CaseReadIndex,type Fact} from "./domain.ts";

export type BusinessMoneyRole =
  "turnover_total"|"turnover_component"|"returns_refunds"|"vat_collected"|
  "cost_line"|"cost_summary"|"gross_receivable"|"net_cash_received"|"withheld_tax";
const sourceMoneyRoles:Readonly<Record<string,BusinessMoneyRole>>={
  "business_sales_vat::income.sales.gross_sales":"turnover_total",
  "business_sales_vat::income.sales.taxable_sales":"turnover_component",
  "business_sales_vat::income.sales.exempt_sales":"turnover_component",
  "business_sales_vat::income.sales.returns_refunds":"returns_refunds",
  "business_sales_vat::income.sales.vat_collected":"vat_collected",
  "business_costs_and_ledgers::income.business_cost.gross_amount":"cost_line",
  "business_costs_and_ledgers::income.business_cost.tax_component":"vat_collected",
  "business_current_income_summary::income.self_employment.business_costs":"cost_summary",
  "business_current_income_summary::income.self_employment.gross_receivable":"gross_receivable",
  "business_current_income_summary::income.self_employment.net_receipt":"net_cash_received",
  "business_current_income_summary::income.self_employment.withheld_tax":"withheld_tax"
};
const rowPeriods:Readonly<Record<string,readonly [string,string]>>={
  business_sales_vat:[
    "business_sales_vat::income.sales.reporting_period_start",
    "business_sales_vat::income.sales.reporting_period_end"
  ],
  business_costs_and_ledgers:[
    "business_costs_and_ledgers::income.business_cost.period_start",
    "business_costs_and_ledgers::income.business_cost.period_end"
  ],
  business_current_income_summary:[
    "business_current_income_summary::income.self_employment.service_period_start",
    "business_current_income_summary::income.self_employment.service_period_end"
  ]
};
const canonicalId=(fact:Fact)=>fact.canonicalFieldId??fact.fieldObservation?.canonicalFieldId??"";
const exactDate=(value:unknown):value is string=>{
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const day=new Date(value+"T00:00:00.000Z");
 return Number.isFinite(day.getTime())&&day.toISOString().slice(0,10)===value;
};
export type PeriodOverlap="inside"|"outside"|"partly_outside"|"unknown";
export interface BusinessSourceMoneyRow {
  factId:string;canonicalFieldId:string;role:BusinessMoneyRole;
  sourceRecordId:string;sourceDocumentIds:string[];sourcePages:number[];
  amountWon:string|null;observedState:string;reviewState:string;
  verifiedAndAcceptedSource:boolean;
  periodStart:string|null;periodEnd:string|null;periodOverlap:PeriodOverlap;
  linkedBusinessIncomeIds:string[];
  use:"source_only_not_legally_approved";
}
export interface BusinessSourceAudit {
  schemaVersion:"business-source-money-review/1";
  caseRevision:number;total:number;offset:number;limit:number;nextOffset:number|null;
  summary:{
    sourceMoneyFacts:number;currentlyRelevant:number;outsideSelectedPeriod:number;
    notYetLinked:number;noCurrentBusinessIncomeCandidate:boolean;
    zeroIncomeWouldBeUnsupported:boolean;
  };
  rows:BusinessSourceMoneyRow[];
  automaticNetCalculation:false;
}
export function auditBusinessSourceEvidence(
 data:CaseData,index:CaseReadIndex=createCaseReadIndex(data),
 input:{offset?:number;limit?:number}={}
):BusinessSourceAudit{
 if(index.owner!==data)throw Error("BUSINESS_SOURCE_INDEX_WRONG_CASE");
 const offset=input.offset??0,limit=input.limit??100;
 if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>1000)
   throw Error("INVALID_BUSINESS_SOURCE_AUDIT_PAGE");
 const facts=currentFacts(data,index);
 const financial=facts.filter(fact=>!!sourceMoneyRoles[canonicalId(fact)]);
 const window=data.context.filingPeriod;
 const validWindow=!!window&&exactDate(window.start)&&exactDate(window.end)&&window.start<=window.end;
 const bySubject=index.bySubject;
 const candidates=data.incomes.filter(source=>source.kind==="business" && source.recognition==="accepted" &&
   source.sourceCalculationRole!=="gross_turnover_only" && source.factIds.length>0 &&
   factSourceLineageIssues(data,source.factIds,index).length===0 &&
   (moneyValue(source.net)!==null || moneyValue(source.gross)!==null&&moneyValue(source.expenses)!==null));
 const links=new Map<string,string[]>();
 for(const income of data.incomes)if(income.kind==="business")
   for(const id of income.factIds)links.set(id,[...(links.get(id)??[]),income.id]);
 const all=financial.map((fact):BusinessSourceMoneyRow=>{
  const id=canonicalId(fact),family=id.split("::")[0];
  const row=bySubject.get(fact.subjectId)??[];
  const slots=rowPeriods[family];
  // A single valid date is required. "First matching field wins" can classify
  // a conflicting or unverified period as historical and incorrectly suppress
  // a live financial-source blocker.
  const fieldDate=(key:string):string|null=>{
    const matches=row.filter(item=>canonicalId(item)===key);
    if(matches.length!==1)return null;
    const dateFact=matches[0];
    return dateFact.state==="verified"&&dateFact.recognition==="accepted"&&
      dateFact.validation.every(check=>check.severity!=="error")&&
      dateFact.refs.length>0&&dateFact.refs.every(ref=>validSourceRef(data,ref,index))&&
      exactDate(dateFact.value)?dateFact.value:null;
  };
  const start=slots?fieldDate(slots[0]):null;
  const end=slots?fieldDate(slots[1]):null;
  const scope:PeriodOverlap= !validWindow||!start||!end||end<start ? "unknown" :
    end<window!.start||start>window!.end ? "outside" :
    start<window!.start||end>window!.end ? "partly_outside":"inside";
  const linkedBusinessIncomeIds=[...new Set(links.get(fact.id)??[])].sort();
  return {factId:fact.id,canonicalFieldId:id,role:sourceMoneyRoles[id],sourceRecordId:fact.subjectId,
    sourceDocumentIds:[...new Set(fact.refs.map(ref=>ref.documentId))].sort(),
    sourcePages:[...new Set(fact.refs.map(ref=>ref.page))].sort((a,b)=>a-b),
    amountWon:moneyValue(fact.numeric)?.toString()??null,
    observedState:fact.fieldObservation?.sourceState??"not_classified",
    reviewState:fact.recognition,
    verifiedAndAcceptedSource:fact.state==="verified"&&fact.recognition==="accepted"&&
      fact.validation.every(check=>check.severity!=="error")&&
      fact.refs.length>0&&fact.refs.every(ref=>validSourceRef(data,ref,index))&&
      factSourceLineageIssues(data,[fact.id],index).length===0&&
      moneyValue(fact.numeric)!==null,
    periodStart:start,periodEnd:end,periodOverlap:scope,linkedBusinessIncomeIds,
    use:"source_only_not_legally_approved"};
 }).sort((a,b)=>a.sourceRecordId.localeCompare(b.sourceRecordId)||a.factId.localeCompare(b.factId));
 const relevant=all.filter(row=>row.periodOverlap!=="outside"&&row.observedState!=="explicit_none"&&row.reviewState!=="rejected");
 const zeroIncomeWouldBeUnsupported=candidates.length===0&&relevant.length>0;
 return {schemaVersion:"business-source-money-review/1",caseRevision:data.context.revision,
  total:all.length,offset,limit,nextOffset:offset+limit<all.length?offset+limit:null,
  summary:{sourceMoneyFacts:all.length,currentlyRelevant:relevant.length,
    outsideSelectedPeriod:all.filter(x=>x.periodOverlap==="outside").length,
    notYetLinked:relevant.filter(x=>x.linkedBusinessIncomeIds.length===0).length,
    noCurrentBusinessIncomeCandidate:candidates.length===0,
    zeroIncomeWouldBeUnsupported},
  rows:all.slice(offset,offset+limit),automaticNetCalculation:false};
}
