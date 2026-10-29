/** One source-field identity contract for OCR, physical SQL and typed-case projection.
 * Never turn a label resemblance into a canonical ID, money, or legal decision.
 * Original page reads and raw SQL field values remain unchanged.
 */
export const CANONICAL_SOURCE_BINDING_VERSION = "canonical-source-binding/1" as const;
export interface CanonicalSourceDefinition {
  global_field_id:string;local_id:string;
  datatype:string;canonical_unit:string;
}
export interface CanonicalSourceContract {
  family_id:string;fields:readonly CanonicalSourceDefinition[];
}
export interface CanonicalSourceInput {key:string;canonicalFieldId?:string|null;}
export interface CanonicalSourceBinding {
  canonicalFieldId:string|null;localKey:string|null;
  binding:"explicit_id"|"exact_key"|"unbound";
  definition:CanonicalSourceDefinition|undefined;issues:string[];
}
const prefixes=new Set(["person","income","debt","asset","transaction","household","business","statement","other","bank_account","lease","insurance","credit_report","health_insurance_arrears"]);
export function bindCanonicalSourceField(field:CanonicalSourceInput,contract:CanonicalSourceContract|null|undefined):CanonicalSourceBinding {
  const candidates=contract?.fields??[],explicit=typeof field.canonicalFieldId==="string"&&field.canonicalFieldId.length>0;
  const matches=candidates.filter(f=>explicit?f.global_field_id===field.canonicalFieldId:f.local_id===field.key||f.global_field_id===field.key);
  let definition=matches.length===1?matches[0]:undefined;
  const issues:string[]=[];
  if(definition&&explicit){
    const leaf=definition.local_id.split(".").at(-1)!;
    const uniqueLeaf=candidates.filter(f=>f.local_id.split(".").at(-1)===leaf).length===1;
    const parts=field.key.split(".");
    const compatible=field.key===definition.local_id||field.key===definition.global_field_id
      ||uniqueLeaf&&(field.key===leaf||parts.length===2&&prefixes.has(parts[0])&&parts[1]===leaf);
    if(!compatible){definition=undefined;issues.push("canonical_id_key_conflict");}
  }
  if(!definition)issues.push(explicit?"canonical_id_outside_family":matches.length>1?"canonical_id_ambiguous":"canonical_id_unbound");
  return {canonicalFieldId:definition?.global_field_id??null,localKey:definition?.local_id??null,
    binding:definition?(explicit?"explicit_id":"exact_key"):"unbound",definition,issues};
}
/** Only documented semantic equivalents may become CaseData/assessment inputs.
 * Gross base != gross total, original principal != current balance, registered lien
 * != payoff, and historical credit inquiry != current debt.
 */
const projections:Readonly<Record<string,Readonly<Record<string,Readonly<Record<string,string>>>>>>={
  payroll_payslip:{income:{
    "income.payroll.employer":"employer","income.payroll.net_pay":"net",
    "income.payroll.pay_period_start":"period_start","income.payroll.pay_period_end":"period_end"
  }},
  current_nonwage_income:{income:{
    "income.other.income_kind":"kind","income.other.gross_amount":"gross",
    "income.other.deductions":"expenses","income.other.net_received":"net",
    "income.other.earning_period_start":"period_start","income.other.earning_period_end":"period_end"
  }},
  debt_certificate:{debt:{
    "creditor":"creditor","contract_id":"contract_id","principal_balance":"principal_balance",
    "interest_balance":"interest","as_of_date":"as_of"
  }},
  bank_transactions:{transaction:{
    "account_id":"account_id","transaction_datetime":"date","direction":"direction",
    "amount":"amount","counterparty":"counterparty"
  }},
  cash_deposit_asset:{asset:{
    "asset_kind":"kind","gross_value":"gross_value","actual_payoff":"secured_payoff",
    "as_of_date":"as_of","valuation_basis":"valuation_basis"
  }},
  insurance_policy_asset:{asset:{"surrender_value":"surrender_value","as_of_date":"as_of"}}
};
export function canonicalProjectionKey(contract:CanonicalSourceContract|null|undefined,binding:CanonicalSourceBinding,recordCategory:string):string|null{
  if(!contract||!binding.definition)return null;
  return projections[contract.family_id]?.[recordCategory]?.[binding.definition.local_id]??null;
}
export function canonicalProjectionMetadata(contract:CanonicalSourceContract|null|undefined,field:CanonicalSourceInput,recordCategory:string){
  const binding=bindCanonicalSourceField(field,contract);
  return {version:CANONICAL_SOURCE_BINDING_VERSION,canonicalFieldId:binding.canonicalFieldId,
    projectionKey:canonicalProjectionKey(contract,binding,recordCategory),binding:binding.binding,
    issues:binding.issues};
}
