import type { CaseData, NumericInput } from "./domain.ts";
import type { CalculationResult } from "./assessment.ts";
import { currentFacts, factSourceLineageIssues, moneyValue } from "./domain.ts";
import { sourceFactMoneyValue } from "./assessment.ts";
export type OverrideField="monthlyTrusteeFee"|"monthlyPriorityPayment"|"monthlyEstatePayment"|"approvedMonthlyPayment";
export interface CalculationOverride { field:OverrideField; value:NumericInput; scope:string; sourceIds:string[]; reason:string; effectivePeriod:{start:string;end:string}; baseFingerprint:string; }
const allowed=new Set<OverrideField>(["monthlyTrusteeFee","monthlyPriorityPayment","monthlyEstatePayment","approvedMonthlyPayment"]);
export function calculationBaseFingerprint(data:CaseData):string { return JSON.stringify({context:{...data.context,revision:0},incomes:data.incomes,debts:data.debts,assets:data.assets,household:data.household,transactions:data.transactions,facts:currentFacts(data),documents:data.documents.filter(d=>d.status==="active").map(d=>[d.id,d.sha256])}); }
/** Suggestion is data only; caller must explicitly adopt after validating source and scope. */
export function proposeCalculationOverride(data:CaseData,field:OverrideField,value:NumericInput,details:{scope:string;sourceIds:string[];reason:string;effectivePeriod:{start:string;end:string}}):CalculationOverride {
 const date=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v+"T00:00:00.000Z").toISOString().slice(0,10)===v;
 if(!allowed.has(field)||!details.scope.trim()||!details.reason.trim()||!details.sourceIds.length||!date(details.effectivePeriod.start)||!date(details.effectivePeriod.end)||details.effectivePeriod.start>details.effectivePeriod.end)throw new Error("OVERRIDE_CONTEXT_INCOMPLETE");
 return {field,value,scope:details.scope,sourceIds:[...new Set(details.sourceIds)],reason:details.reason,effectivePeriod:details.effectivePeriod,baseFingerprint:calculationBaseFingerprint(data)};
}
export function adoptCalculationOverride(data:CaseData,calculation:CalculationResult,override:CalculationOverride):{status:"adopted"|"stale"|"blocked";context:CaseData["context"]|null;issues:string[]} {
 const issues:string[]=[];if(override.baseFingerprint!==calculationBaseFingerprint(data)||calculation.caseRevision!==data.context.revision)return {status:"stale",context:null,issues:["OVERRIDE_BASE_STALE"]};
 const date=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v+"T00:00:00.000Z").toISOString().slice(0,10)===v;
 if(!allowed.has(override.field)||!override.scope.trim()||!override.reason.trim()||!override.sourceIds.length||!date(override.effectivePeriod.start)||!date(override.effectivePeriod.end)||override.effectivePeriod.start>override.effectivePeriod.end)issues.push("OVERRIDE_CONTEXT_INCOMPLETE");
 if(override.value.normalizationStatus!=="exact"||override.value.unit!=="KRW"||override.value.currency!=="KRW"||override.value.amountWon===null||!/^[0-9]+$/.test(override.value.amountWon))issues.push("OVERRIDE_AMOUNT_NOT_EXACT_KRW");
 const sources=currentFacts(data).filter(f=>override.sourceIds.includes(f.id));
 if(!sources.length||sources.length!==new Set(override.sourceIds).size||sources.some(f=>f.state!=="verified"||f.recognition!=="accepted"||factSourceLineageIssues(data,[f.id]).length>0||sourceFactMoneyValue(f)!==moneyValue(override.value)))issues.push("OVERRIDE_SOURCE_VALUE_NOT_VERIFIED");
 if(override.field==="approvedMonthlyPayment"&&calculation.ordinaryRepaymentBudgetWon===null)issues.push("OVERRIDE_CALCULATED_BUDGET_UNRESOLVED");
 if(override.field==="approvedMonthlyPayment"&&calculation.ordinaryRepaymentBudgetWon!==null&&override.value.amountWon!==null&&BigInt(override.value.amountWon)>BigInt(calculation.ordinaryRepaymentBudgetWon))issues.push("OVERRIDE_EXCEEDS_CALCULATED_BUDGET");
 if(issues.length)return {status:"blocked",context:null,issues};
 // A reviewed deficit checkbox is never consulted; this creates a candidate snapshot only.
 return {status:"adopted",context:{...data.context,[override.field]:override.value},issues:[]};
}
