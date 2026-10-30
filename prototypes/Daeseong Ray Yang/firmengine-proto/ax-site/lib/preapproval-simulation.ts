/** Isolated what-if wrapper around the existing deterministic case calculator.
 * Hypothetical fields are NEVER source facts, verified evidence, or human approvals.
 * This module performs no writes; only a caller-supplied existing calculator may run.
 */
import type {CaseData} from "./domain.ts";
export const PREAPPROVAL_SIMULATION_VERSION="preapproval-what-if/1" as const;
const MONEY_FIELDS=["household.additionalLivingCost","context.monthlyTrusteeFee","context.monthlyPriorityPayment","context.monthlyEstatePayment","context.approvedMonthlyPayment"] as const;
const MONTH_FIELD="context.planMonths" as const;
export type ScenarioPath=typeof MONEY_FIELDS[number]|typeof MONTH_FIELD;
export type ScenarioEdit={path:ScenarioPath;candidateWon?:string;candidateMonths?:number;basisFactIds:readonly string[];reason:string};
export interface SimulatedExecution{assessment:{calculation:object};courtApprovalInferred:false}
const won=(value:unknown):value is string=>typeof value==="string"&&/^\d{1,16}$/.test(value);
export function simulatePreapprovalCase<T extends SimulatedExecution>(data:CaseData,edits:readonly ScenarioEdit[],runExistingCalculator:(data:CaseData)=>T){
 if(!edits.length||edits.length>5||new Set(edits.map(e=>e.path)).size!==edits.length)throw Error("INVALID_SCENARIO_EDIT_SET");
 const cloned=structuredClone(data); // no mutation to D1/R2 or live case object
 for(const edit of edits){
  if(!edit.reason.trim()||edit.reason.length>1000||!Array.isArray(edit.basisFactIds)||edit.basisFactIds.some(id=>typeof id!=="string"))throw Error("INVALID_SCENARIO_EVIDENCE");
  if(edit.path!==MONTH_FIELD&&!MONEY_FIELDS.includes(edit.path as typeof MONEY_FIELDS[number]))throw Error("INVALID_SCENARIO_FIELD");
  if(edit.path===MONTH_FIELD){
   if(!Number.isInteger(edit.candidateMonths)||edit.candidateMonths!<1||edit.candidateMonths!>120||edit.candidateWon!==undefined)throw Error("INVALID_SCENARIO_MONTHS");
   cloned.context.planMonths=edit.candidateMonths;
  }else{
   if(!won(edit.candidateWon)||edit.candidateMonths!==undefined)throw Error("INVALID_SCENARIO_AMOUNT");
   const normalized={rawValue:edit.candidateWon,amountWon:edit.candidateWon,unit:"KRW",currency:"KRW",normalizationStatus:"exact" as const};
   if(edit.path==="household.additionalLivingCost")cloned.household.additionalLivingCost=normalized;
   else if(edit.path==="context.monthlyTrusteeFee")cloned.context.monthlyTrusteeFee=normalized;
   else if(edit.path==="context.monthlyPriorityPayment")cloned.context.monthlyPriorityPayment=normalized;
   else if(edit.path==="context.monthlyEstatePayment")cloned.context.monthlyEstatePayment=normalized;
   else if(edit.path==="context.approvedMonthlyPayment")cloned.context.approvedMonthlyPayment=normalized;
  }
 }
 const original=runExistingCalculator(data);
 const hypothetical=runExistingCalculator(cloned);
 if(original.courtApprovalInferred!==false||hypothetical.courtApprovalInferred!==false)throw Error("SIMULATION_CALCULATOR_SCOPE_VIOLATION");
 const baseValues=original.assessment.calculation as Record<string,unknown>,scenarioValues=hypothetical.assessment.calculation as Record<string,unknown>;
 const outputNames=["monthlyIncomeWon","recognizedLivingCostWon","disposableIncomeWon","ordinaryRepaymentBudgetWon","monthlyPaymentWon","planTotalWon","liquidationValueWon","presentValueWon","liquidationComparison"];
 const differences=outputNames.map(name=>({outputName:name,original:baseValues[name]??null,
   hypothetical:scenarioValues[name]??null})).filter(x=>JSON.stringify(x.original)!==JSON.stringify(x.hypothetical));
 return {schemaVersion:PREAPPROVAL_SIMULATION_VERSION,caseId:data.context.id,sourceRevision:data.context.revision,
   assumptionOnly:true as const,sourceMutationPerformed:false as const,humanLegalAcceptanceGranted:false as const,
   legallyRecognizedAmounts:false as const,courtApprovalInferred:false as const,approvalProbability:null,
   edits:edits.map(e=>({...e,basisFactIds:[...e.basisFactIds]})),differences,
   baseCalculatorIssues:[...((baseValues.issues??[]) as string[])],
   hypotheticalCalculatorIssues:[...((scenarioValues.issues??[]) as string[])],
   note:"기존 계산기를 복제 입력으로 재실행한 산술 시뮬레이션. 법령상 비용 인정/인가결정/실제 문서 값 아님"};
}
