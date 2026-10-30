/** Protect calculations against material OCR amounts silently omitted from typed case rows.
 * All matching is by exact canonical ID and linked source fact ID, never labels.
 * A missing link blocks final review, NOT a claim that a third party owns a debt/asset.
 */
import {createCaseReadIndex,currentFacts,moneyValue,validSourceRef,type CaseData,type CaseReadIndex,type NumericInput} from "./domain.ts";
export type MaterialDestination="income.net"|"income.gross"|"debt.principal"|"debt.interest"|"asset.grossValue";
type Policy="must_reconcile"|"context_only";
export interface MaterialDefinition {id:string;destination:MaterialDestination|null;policy:Policy;reason:string;}
export const MATERIAL_CALCULATION_SOURCES:readonly MaterialDefinition[]=[
 ["payroll_payslip::income.payroll.net_pay","income.net","must_reconcile","Salary net for stated pay period"],
 ["current_nonwage_income::income.other.net_received","income.net","must_reconcile","Nonwage net received"],
 ["tax_income::income_after_expenses","income.net","must_reconcile","Historical annual taxable business net, representative period reviewed separately"],
 ["business_current_income_summary::income.self_employment.net_receipt","income.net","must_reconcile","Self employment net cash received"],
 ["pension_benefit_income::income.benefit.net_payment","income.net","must_reconcile","Pension payment must be individually recognized"],
 ["business_sales_vat::income.sales.gross_sales","income.gross","must_reconcile","VAT turnover is not business net profit"],
 ["debt_certificate::principal_balance","debt.principal","must_reconcile","Present principal not origination amount"],
 ["debt_certificate::interest_balance","debt.interest","must_reconcile","Current accrued interest"],
 ["tax_public_arrear::principal_arrear","debt.principal","must_reconcile","Public arrears require claim classification"],
 ["tax_public_arrear::surcharge_interest","debt.interest","must_reconcile","Surcharge not automatically ordinary interest"],
 ["health_insurance_arrears::unpaid_contribution","debt.principal","must_reconcile","Insurance arrears legal priority separate"],
 ["procedure_private_creditor_request::procedure.creditor_info.principal_balance","debt.principal","must_reconcile","Private creditor statement requires verification"],
 ["procedure_private_creditor_request::procedure.creditor_info.interest_balance","debt.interest","must_reconcile","Private creditor accrued interest"],
 ["cash_deposit_asset::gross_value","asset.grossValue","must_reconcile","Deposit or cash asset gross"],
 ["bank_account_balance::balance","asset.grossValue","must_reconcile","Account ownership and encumbrance unreviewed"],
 ["insurance_policy_asset::surrender_value","asset.grossValue","must_reconcile","Surrender value, not premiums"],
 ["vehicle_valuation::market_value","asset.grossValue","must_reconcile","Vehicle fair value requires ownership"],
 ["real_property_valuation::market_value","asset.grossValue","must_reconcile","Property value requires ownership/share"],
 ["pension_contribution_benefit::withdrawal_value","asset.grossValue","must_reconcile","Withdrawal value protection separately reviewed"],
 ["business_current_income_summary::income.self_employment.business_costs",null,"context_only","Necessary expenses need reviewed period join"],
 ["business_costs_and_ledgers::income.business_cost.gross_amount",null,"context_only","Never sum expense lines as net automatically"],
 ["guarantee_joint_claim::guarantee_claimed",null,"context_only","Guarantee liability conditional"],
 ["secured_claim_security::actual_payoff",null,"context_only","Collateral payoff is not gross asset"],
 ["lease_housing::deposit",null,"context_only","Role and beneficial interest needed"],
 ["business_assets_liabilities::gross_value",null,"context_only","Book and market value not identical"],
 ["household_living_expense::household.expense.paid_amount",null,"context_only","Paid expense not automatically recognized living cost"],
 ["conditional_medical_expense::conditional.medical.paid_cost",null,"context_only","Medical deductions need legal and reimbursement review"],
 ["conditional_education_childcare::conditional.education.paid_amount",null,"context_only","Education payments need subsidies/dependent proof"],
 ["asset_transfer_disposition::proceeds_received",null,"context_only","Disposal proceeds must be reconciled with successor assets"]
].map(([id,destination,policy,reason])=>({id:id as string,destination:destination as MaterialDestination|null,
 policy:policy as Policy,reason:reason as string}));
export type MaterialIssueCode="CALC_INPUT_UNCONNECTED_MATERIAL"|"CALC_INPUT_MULTIPLE_TYPED_MATCHES"|"CALC_INPUT_AMOUNT_INVALID"|"CALC_INPUT_AMOUNT_MISMATCH"|"CALC_INPUT_SOURCE_INVALID";
export interface MaterialIssue {code:MaterialIssueCode;canonicalFieldId:string;factId:string;destination:MaterialDestination;reason:string;}
/** Fail closed for the amounts required for case calculation; source-only legal
 * context remains inspectable, but is never auto-classified or auto-added. */
export function auditMaterialCalculatorSources(data:CaseData,index:CaseReadIndex=createCaseReadIndex(data)){
 const catalog=new Map(MATERIAL_CALCULATION_SOURCES.map(c=>[c.id,c]));
 const rows=[...data.incomes.filter(x=>x.sourceCalculationRole!=="gross_turnover_only").map(x=>({category:"income" as const,item:x})),
   ...data.debts.map(x=>({category:"debt" as const,item:x})),
   ...data.assets.map(x=>({category:"asset" as const,item:x}))];
 const issues:MaterialIssue[]=[],observed=new Set<string>(),contextOnly=new Set<string>();
 const add=(code:MaterialIssueCode,field:NonNullable<ReturnType<typeof catalog.get>>,factId:string)=>{
   if(!field.destination)return;
   issues.push({code,canonicalFieldId:field.id,factId,destination:field.destination,reason:field.reason});
 };
 for(const fact of currentFacts(data,index)){
   const field=catalog.get(fact.canonicalFieldId??fact.fieldObservation?.canonicalFieldId??"");
   if(!field||fact.fieldObservation?.sourceState==="explicit_none")continue;
   observed.add(field.id);
   if(field.policy==="context_only"||!field.destination){contextOnly.add(field.id);continue;}
   if(fact.fieldObservation?.sourceState!=="present"||moneyValue(fact.numeric)===null){
     add("CALC_INPUT_AMOUNT_INVALID",field,fact.id);continue;
   }
   // A reported/extracted amount is not a source-verified amount, even when its numeric value matches typed debt.
   if(fact.state!=="verified"||fact.recognition==="rejected"||!fact.refs.length||
     fact.refs.some(ref=>!validSourceRef(data,ref,index))){
     add("CALC_INPUT_SOURCE_INVALID",field,fact.id);continue;
   }
   const matched=rows.filter(row=>row.item.factIds.includes(fact.id)&&field.destination!.startsWith(row.category+"."));
   if(!matched.length){add("CALC_INPUT_UNCONNECTED_MATERIAL",field,fact.id);continue;}
   // A single exact source amount cannot license two typed financial rows.
   // Reuse for documentary cross-check is fine; duplicating a calculator amount is not.
   // Explicit splits need separate source-backed per-row allocations and a reviewed rule.
   if(matched.length!==1){add("CALC_INPUT_MULTIPLE_TYPED_MATCHES",field,fact.id);continue;}
   const expected=moneyValue(fact.numeric),prop=field.destination.split(".")[1];
   const actual=matched.map(row=>moneyValue((row.item as unknown as Record<string,unknown>)[prop] as NumericInput|null|undefined));
   if(actual.some(amount=>amount===null||amount!==expected))add("CALC_INPUT_AMOUNT_MISMATCH",field,fact.id);
 }
 return {version:"ocr-material-calculator-sources/1" as const,definitions:MATERIAL_CALCULATION_SOURCES.length,
   observedIds:[...observed].sort(),contextOnlyIds:[...contextOnly].sort(),
   issueCount:issues.length,issues,
   automaticLegalRecognition:false as const,automaticInclusion:false as const};
}
