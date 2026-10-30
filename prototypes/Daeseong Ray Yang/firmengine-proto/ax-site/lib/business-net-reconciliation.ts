/** Explicit human-authorized business income transformations.
 * The immutable OCR facts remain untouched. Each reviewed one-month income
 * records its exact gross/cost/identity/period source fact versions and active
 * official-source reference release. No fuzzy join, monthly imputation, hidden
 * VAT deduction, or unreviewed cost recognition is permitted.
 */
import {createCaseReadIndex,currentFacts,factSourceLineageIssues,normalizeMoney,moneyValue,type CaseData,type CaseReadIndex,type Fact,type IncomeSource} from "./domain.ts";
import {approvedBusinessIncomeRule} from "./business-income-policy.ts";
import {BUSINESS_SOURCE_MONEY_ROLES} from "./business-source-evidence.ts";

export const BUSINESS_NET_REVIEW_VERSION="reviewed-business-net/1" as const;
export interface BusinessNetSelection {
 businessRegistrationFactId:string;
 grossFactId:string;
 costFactIds:string[];
 month:string;
}
export interface BusinessNetReview{
 schemaVersion:typeof BUSINESS_NET_REVIEW_VERSION;
 id:string;incomeId:string;status:"proposed"|"approved"|"stale";
 month:string;businessRegistrationFactId:string;grossFactId:string;costFactIds:string[];
 sourceFactIds:string[];
 payerIdentityId:string;grossWon:string;costWon:string;netWon:string;
 referenceSha256:string;referenceRuleId:string;
 /** Exact deterministic source/period/identity/reference snapshot, compared
  * again on every calculation. SHA is a persisted receipt identity only. */
 basisSnapshot:string;basisSha256:string;
 proposer:string;proposedAt:string;reason:string;
 reviewer?:string;reviewedAt?:string;reviewReason?:string;
}
const VAT="business_sales_vat::income.sales.";
const COST="business_costs_and_ledgers::income.business_cost.";
const REG="business_registration::business_id";
const canonical=(fact:Fact)=>fact.canonicalFieldId??fact.fieldObservation?.canonicalFieldId??"";
const unique=(xs:string[])=>[...new Set(xs)].sort();
const exactDate=(value:string)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+"T00:00:00.000Z");
 return Number.isFinite(date.valueOf())&&date.toISOString().slice(0,10)===value;
};
function datesFor(month:string){
 if(!/^\d{4}-\d{2}$/.test(month))throw Error("BUSINESS_MONTH_INVALID");
 const start=month+"-01";if(!exactDate(start))throw Error("BUSINESS_MONTH_INVALID");
 const d=new Date(start+"T00:00:00.000Z");
 return {start,end:new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).toISOString().slice(0,10)};
}
const sourceFact=(data:CaseData,index:CaseReadIndex,id:string,expected:string):Fact=>{
 const fact=index.byId.get(id);
 if(!fact||canonical(fact)!==expected||fact.state!=="verified"||fact.recognition!=="accepted"||
    fact.validation.some(x=>x.severity==="error")||fact.fieldObservation&&fact.fieldObservation.sourceState!=="present"||
    factSourceLineageIssues(data,[id],index).length)throw Error("BUSINESS_SOURCE_FACT_NOT_VERIFIED:"+expected);
 return fact;
};
const simpleValue=(fact:Fact)=>typeof fact.value==="string"?fact.value.trim():"";
function rowUnique(data:CaseData,index:CaseReadIndex,subjectId:string,id:string):Fact{
 const rows=(index.bySubject.get(subjectId)??[]).filter(fact=>canonical(fact)===id);
 if(rows.length!==1)throw Error("BUSINESS_ROW_FIELD_MISSING_OR_MULTIPLE:"+id);
 return sourceFact(data,index,rows[0].id,id);
}
function money(fact:Fact):bigint{
 const n=moneyValue(fact.numeric);
 if(n===null||n<0n)throw Error("BUSINESS_MONEY_NOT_EXACT_NONNEGATIVE:"+fact.id);
 return n;
}
const factStamp=(fact:Fact)=>[
 fact.id,fact.logicalId,fact.version,fact.subjectId,fact.state,fact.recognition,
 canonical(fact),fact.key,fact.value,
 fact.numeric??null,fact.sourceUnit??null,
 fact.refs.map(r=>[r.documentId,r.page,r.sourceHash??null,r.quote,r.bbox??null]),
 fact.fieldObservation?.sourceState??null
];
export function businessNetReviewBasis(data:CaseData,proposal:Pick<BusinessNetReview,
 "sourceFactIds"|"month"|"payerIdentityId"|"grossWon"|"costWon"|"netWon"|"referenceSha256"|"referenceRuleId">,
 index:CaseReadIndex=createCaseReadIndex(data)){
 const facts=proposal.sourceFactIds.map(id=>index.byId.get(id));
 if(facts.some(x=>!x))return null;
 const month=datesFor(proposal.month);
 return JSON.stringify([
  BUSINESS_NET_REVIEW_VERSION,data.context.id,data.context.courtId,data.context.applicationDate,
  data.context.filingPeriod??null,month,proposal.payerIdentityId,
  proposal.grossWon,proposal.costWon,proposal.netWon,
  proposal.referenceSha256,proposal.referenceRuleId,
  facts.map(f=>factStamp(f!)).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))
 ]);
}
export type BusinessNetPreflight = {
 selection:BusinessNetSelection;incomeId:string;
 grossWon:string;costWon:string;netWon:string;payerIdentityId:string;
 sourceFactIds:string[];referenceSha256:string;referenceRuleId:string;
 basisSnapshot:string;
};
/** This preflight never grants legal status. It only establishes that exact
 * inputs COULD be proposed under a reviewed reference mapping.
 */
export function preflightBusinessNet(
 data:CaseData,selection:BusinessNetSelection,index:CaseReadIndex=createCaseReadIndex(data)
):BusinessNetPreflight{
 if(index.owner!==data)throw Error("BUSINESS_INCOME_WRONG_CASE");
 if(!selection||typeof selection.businessRegistrationFactId!=="string"||
    typeof selection.grossFactId!=="string"||typeof selection.month!=="string"||
    !Array.isArray(selection.costFactIds)||selection.costFactIds.length<1||
    selection.costFactIds.length>80||selection.costFactIds.some(x=>typeof x!=="string")||
    new Set(selection.costFactIds).size!==selection.costFactIds.length||
    selection.costFactIds.includes(selection.grossFactId))
    throw Error("BUSINESS_REVIEW_SELECTION_INVALID");
 const period=datesFor(selection.month),window=data.context.filingPeriod;
 if(!window||window.start>period.start||window.end<period.end||
    !exactDate(window.start)||!exactDate(window.end))throw Error("BUSINESS_MONTH_OUTSIDE_REPRESENTATIVE_PERIOD");
 const policy=approvedBusinessIncomeRule(data.context.courtId,data.context.applicationDate);
 if(!policy)throw Error("BUSINESS_OFFICIAL_REFERENCE_REVIEW_REQUIRED");
 const reg=sourceFact(data,index,selection.businessRegistrationFactId,REG);
 const normalizedId=simpleValue(reg).replace(/[\s-]/g,"");
 if(!/^\d{10}$/.test(normalizedId))throw Error("BUSINESS_REGISTRATION_ID_INVALID");
 const gross=sourceFact(data,index,selection.grossFactId,VAT+"gross_sales");
 const costs=selection.costFactIds.map(id=>sourceFact(data,index,id,COST+"gross_amount"));
 const allRows=[gross,...costs];
 if(new Set(allRows.map(f=>f.subjectId)).size!==allRows.length)throw Error("BUSINESS_SOURCE_RECORD_DUPLICATED");
 const sourceIds=[reg.id];
 for(const f of allRows){
  const family=f===gross?VAT:COST;
  const start=rowUnique(data,index,f.subjectId,family+(f===gross?"reporting_period_start":"period_start"));
  const end=rowUnique(data,index,f.subjectId,family+(f===gross?"reporting_period_end":"period_end"));
  if(simpleValue(start)!==period.start||simpleValue(end)!==period.end)
    throw Error("BUSINESS_SOURCE_PERIOD_DIFFERS:"+f.id);
  const owner=rowUnique(data,index,f.subjectId,family+(f===gross?"business_entity":"business_entity"));
  if(!simpleValue(owner))throw Error("BUSINESS_SOURCE_ENTITY_UNKNOWN:"+f.id);
  // Entity names are source context. Only the human lawyer review below
  // authorizes associating them with the selected registration ID.
  sourceIds.push(f.id,start.id,end.id,owner.id);
  if(f!==gross){
   const category=rowUnique(data,index,f.subjectId,COST+"expense_category");
   if(!policy.rule.approvedCostCategories.includes(simpleValue(category)))
     throw Error("BUSINESS_EXPENSE_CATEGORY_NOT_APPROVED:"+category.id);
   sourceIds.push(category.id);
  }
  // Any additional amount on the same source record must be explicitly
  // classified, not ignored as a potential VAT, return or cost adjustment.
  const current=index.bySubject.get(f.subjectId)??[];
  for(const extra of current){
   const role=BUSINESS_SOURCE_MONEY_ROLES[canonical(extra)];
   if(role&&extra.id!==f.id){
    // A nonzero refund or VAT adjustment must be separately reconciled before
    // the as-stated gross/cost formula is accepted.
    const value=money(sourceFact(data,index,extra.id,canonical(extra)));
    if(value!==0n)throw Error("BUSINESS_VAT_REFUND_OR_COMPONENT_REVIEW_REQUIRED:"+extra.id);
    sourceIds.push(extra.id);
   }
  }
 }
 // The registration and each current source row must be independently signed
 // off as one business; a matching name or amount is never sufficient.
 const totalGross=money(gross),totalCost=costs.reduce((sum,cost)=>sum+money(cost),0n);
 if(totalCost>totalGross)throw Error("BUSINESS_NEGATIVE_NET_REQUIRES_SEPARATE_LEGAL_REVIEW");
 const sources=unique(sourceIds);
 // A fact may not be reused in another already approved distinct monthly net.
 const approved=data.workflowState?.businessNetReviews??[];
 if(approved.some(review=>review.status==="approved"&&
     (review.month===selection.month&&review.payerIdentityId===normalizedId||
      [review.grossFactId,...review.costFactIds].some(id=>[selection.grossFactId,...selection.costFactIds].includes(id)))))
    throw Error("BUSINESS_MONTH_OR_SOURCE_ALREADY_APPROVED");
 const basic={sourceFactIds:sources,month:selection.month,payerIdentityId:normalizedId,
  grossWon:totalGross.toString(),costWon:totalCost.toString(),netWon:(totalGross-totalCost).toString(),
  referenceSha256:policy.referenceSha256,referenceRuleId:policy.rule.id};
 const basisSnapshot=businessNetReviewBasis(data,basic,index);
 if(!basisSnapshot)throw Error("BUSINESS_REVIEW_BASIS_MISSING");
 return {selection:{...selection,costFactIds:[...selection.costFactIds]},
  incomeId:crypto.randomUUID(),...basic,basisSnapshot};
}
async function sha256(text:string){
 const bytes=new TextEncoder().encode(text);
 return [...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))]
  .map(value=>value.toString(16).padStart(2,"0")).join("");
}
export async function proposeBusinessNet(
 data:CaseData,selection:BusinessNetSelection,reason:string,actor:string,at:string
):Promise<BusinessNetReview>{
 if(!reason.trim()||!actor.trim()||!Number.isFinite(Date.parse(at)))
  throw Error("BUSINESS_REVIEW_OPERATOR_OR_REASON_REQUIRED");
 const p=preflightBusinessNet(data,selection);
 return {schemaVersion:BUSINESS_NET_REVIEW_VERSION,
  id:crypto.randomUUID(),incomeId:p.incomeId,status:"proposed",
  month:p.month,payerIdentityId:p.payerIdentityId,
  businessRegistrationFactId:selection.businessRegistrationFactId,
  grossFactId:selection.grossFactId,costFactIds:[...selection.costFactIds],
  sourceFactIds:p.sourceFactIds,grossWon:p.grossWon,costWon:p.costWon,netWon:p.netWon,
  referenceSha256:p.referenceSha256,referenceRuleId:p.referenceRuleId,
  basisSnapshot:p.basisSnapshot,basisSha256:await sha256(p.basisSnapshot),
  proposer:actor,proposedAt:at,reason};
}
function exactReview(data:CaseData,review:BusinessNetReview,index:CaseReadIndex){
 if(!review||review.schemaVersion!==BUSINESS_NET_REVIEW_VERSION||
    !["proposed","approved"].includes(review.status)||!review.sourceFactIds.length)return false;
 try{
  const recreated=preflightBusinessNetIgnoringExisting(data,{
   month:review.month,businessRegistrationFactId:review.businessRegistrationFactId,
   grossFactId:review.grossFactId,costFactIds:review.costFactIds},review.id);
  return recreated.grossWon===review.grossWon&&recreated.costWon===review.costWon&&
   recreated.netWon===review.netWon&&recreated.payerIdentityId===review.payerIdentityId&&
   recreated.referenceRuleId===review.referenceRuleId&&recreated.referenceSha256===review.referenceSha256&&
   JSON.stringify(recreated.sourceFactIds)===JSON.stringify(review.sourceFactIds)&&
   recreated.basisSnapshot===review.basisSnapshot;
 }catch{return false;}
}
// Run preflight without treating the one receipt being adopted as a duplicate.
// This does NOT bypass any factual, period, source version or reference check.
function preflightBusinessNetIgnoringExisting(
 data:CaseData,selection:BusinessNetSelection,ignoreId:string
){
 const previous=data.workflowState?.businessNetReviews??[];
 const other=previous.filter(x=>x.id!==ignoreId);
 const staged:{workflowState?:CaseData["workflowState"]}={workflowState:data.workflowState?
  {...data.workflowState,businessNetReviews:other}:undefined};
 const base={...data,...staged} as CaseData;
 const adjusted=createCaseReadIndex(base);
 return preflightBusinessNet(base,selection,adjusted);
}
export function validBusinessNetReview(
 data:CaseData,review:BusinessNetReview,index:CaseReadIndex=createCaseReadIndex(data)
):boolean{
 return review.status==="approved"&&!!review.reviewer?.trim()&&!!review.reviewReason?.trim()&&
   !!review.reviewedAt&&exactReview(data,review,index);
}
export function reviewedBusinessIncomeIds(data:CaseData,index:CaseReadIndex=createCaseReadIndex(data)):Set<string>{
 const active=new Set<string>();
 for(const review of data.workflowState?.businessNetReviews??[]){
  if(!validBusinessNetReview(data,review,index))continue;
  const income=data.incomes.find(i=>i.id===review.incomeId);
  if(!income||income.kind!=="business"||income.recognition!=="accepted"||
     income.sourceCalculationRole!=="period_income_observation"||
     income.periodStart!==review.month+"-01"||income.periodEnd!==datesFor(review.month).end||
     income.amountBasis!=="period_total"||
     moneyValue(income.gross)?.toString()!==review.grossWon||
     moneyValue(income.expenses)?.toString()!==review.costWon||
     moneyValue(income.net)?.toString()!==review.netWon||
     !review.sourceFactIds.every(id=>income.factIds.includes(id)))continue;
  active.add(income.id);
 }
 return active;
}
export function adoptBusinessNet(
 data:CaseData,reviewId:string,actor:string,reason:string,at:string
):{income:IncomeSource;review:BusinessNetReview}{
 const record=data.workflowState?.businessNetReviews?.find(x=>x.id===reviewId);
 if(!record||record.status!=="proposed"||!actor.trim()||reason.trim().length<15||
    !Number.isFinite(Date.parse(at)))throw Error("BUSINESS_REVIEW_APPROVAL_INVALID");
 if(!exactReview(data,record,createCaseReadIndex(data)))
  throw Error("BUSINESS_REVIEW_SOURCE_OR_POLICY_STALE");
 if(data.incomes.some(i=>i.id===record.incomeId))
  throw Error("BUSINESS_REVIEW_TARGET_INCOME_EXISTS");
 const dates=datesFor(record.month);
 const net=normalizeMoney(record.netWon);
 const income:IncomeSource={id:record.incomeId,kind:"business",label:"검토된 사업소득 "+record.month,
  payerIdentityId:record.payerIdentityId,
  amountBasis:"period_total",periodStart:dates.start,periodEnd:dates.end,periodMonths:1,
  gross:normalizeMoney(record.grossWon),expenses:normalizeMoney(record.costWon),net,
  recurring:"unknown",aggregationTreatment:"series_observation",aggregationReviewed:true,
  aggregationReviewReason:reason,sourceCalculationRole:"period_income_observation",
  recognition:"accepted",factIds:[...record.sourceFactIds]};
 const review:BusinessNetReview={...record,status:"approved",reviewer:actor,reviewedAt:at,reviewReason:reason};
 return {income,review};
}
