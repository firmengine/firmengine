import type { CaseData } from "./domain.ts";
import type { CalculationResult } from "./assessment.ts";
export interface CalculationContract { applicable:boolean; status:"ready"|"provisional"|"blocked"|"not_applicable"; blockers:string[]; warnings:string[]; snapshotRevision:number; inputs:{field:string;value:string|null;unit:"KRW";factIds:string[]}[]; }
/** Read-only adapter. It exposes the existing deterministic result without recomputing or rounding it. */
export function adaptCalculationInput(data:CaseData,result:CalculationResult):CalculationContract {
 const blockers:string[]=[],warnings:string[]=[];
 if(result.caseRevision!==data.context.revision)blockers.push("CALCULATION_SNAPSHOT_STALE");
 if(result.monthlyIncomeWon===null)blockers.push("MONTHLY_INCOME_MISSING");
 if(result.recognizedLivingCostWon===null)blockers.push("RECOGNIZED_LIVING_COST_MISSING");
 if(result.ordinaryRepaymentBudgetWon===null)blockers.push("ORDINARY_BUDGET_MISSING");
 if(result.issues.some(x=>x.includes("INCOME")||x.includes("LIVING_COST")))warnings.push("INCOME_OR_DEDUCTION_REVIEW_REQUIRED");
 if(data.household.additionalLivingCost&&data.household.recognizedLivingCost&&data.household.livingCostIncludesAdditional===undefined)warnings.push("POSSIBLE_DUPLICATE_LIVING_COST_DEDUCTION_REVIEW");
 if(result.traces.some(t=>t.status==="provisional"))warnings.push("CALCULATION_HAS_PROVISIONAL_TRACE");
 const applicable=data.context.planMonths!=null;
 return {applicable,status:!applicable?"not_applicable":blockers.length?"blocked":warnings.length?"provisional":"ready",blockers,warnings,snapshotRevision:data.context.revision,inputs:[{field:"monthlyIncomeWon",value:result.monthlyIncomeWon,unit:"KRW",factIds:data.incomes.flatMap(x=>x.factIds)},{field:"recognizedLivingCostWon",value:result.recognizedLivingCostWon,unit:"KRW",factIds:data.household.factIds},{field:"ordinaryRepaymentBudgetWon",value:result.ordinaryRepaymentBudgetWon,unit:"KRW",factIds:[]} ]};
}
