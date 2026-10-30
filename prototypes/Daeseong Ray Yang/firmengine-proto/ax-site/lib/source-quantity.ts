/** Shared conservative source quantity rules for extraction and proof validation. */
const normalizeKey=(key:string)=>key.trim().replace(/([A-Z]+)([A-Z][a-z])/g,"$1_$2").replace(/([a-z0-9])([A-Z])/g,"$1_$2").toLowerCase();
export const DEBT_TOTAL_KEYS=["total","total_claim","claim_amount","amount_due","total_amount"] as const;
export const DEBT_COST_KEYS=["legal_cost","legal_costs","legal_fee","legal_fees","collection_cost","collection_costs","collection_fee","collection_fees","enforcement_cost","enforcement_costs","enforcement_fee","enforcement_fees","other_cost","other_costs","other_fee","other_fees","cost","costs"] as const;
const debtComponentKeys=new Set<string>([...DEBT_TOTAL_KEYS,...DEBT_COST_KEYS]);
export const isDebtComponentSlot=(key:string)=>debtComponentKeys.has(normalizeKey(key).split(".").at(-1)??"");
/** Semantic identity for unresolved-slot metadata only; raw source keys stay intact. */
export function debtComponentSlotKey(key:string):string|null{
  const local=normalizeKey(key).split(".").at(-1)??"";
  if((DEBT_TOTAL_KEYS as readonly string[]).includes(local))return "total";
  if(!(DEBT_COST_KEYS as readonly string[]).includes(local))return null;
  const category=local.match(/^(legal|collection|enforcement|other)_(?:costs?|fees?)$/)?.[1];
  return category?category+"_costs":"costs";
}

const moneyKeys=new Set([
  ...DEBT_TOTAL_KEYS,...DEBT_COST_KEYS,
  "principal","principal_balance","outstanding_principal","original_principal","interest","overdue_interest","total","total_claim","gross","expenses","net","gross_value","secured_payoff","disposal_costs","protected_value","amount","reported_amount","balance","monthly_rent","rent_per_month","deposit","security_deposit","secured_balance","arrears_deduction","tax_arrears","premium_arrears","late_charge","total_arrears","disposition_amount","arrears_amount","current_balance","claim_amount","amount_due","refund_value","surrender_refund","policy_loan_balance","loan_balance","guarantee_limit","guarantee_amount","legal_costs","collection_costs","enforcement_costs","other_costs",
  "coverage_amount","insured_amount","insurance_amount","monthly_premium","premium","insurance_premium","paid_premium","premium_paid","tax_amount","tax","secured_amount","secured_recovery","disputed_amount","gross_amount","net_amount","total_amount","current_amount","claimed_amount","recovery_amount","surrender_value","cash_value","market_value","appraised_value","asset_value","salary_amount","income_amount","payment_amount","fee_amount","cost_amount","interest_amount","principal_amount","outstanding_amount","loan_amount","remaining_balance","arrears_amount","disposal_cost","disposal_costs","guaranteed_amount","guarantee_ceiling","installment_amount","monthly_payment","annual_income","monthly_income","period_total"
]);
const nonMoneyKeys=new Set(["date","as_of","issued_date","issue_date","document_date","birth_date","phone","phone_number","mobile","registration_number","identity_id","id_number","account_number","contract_id","period_months","months","count","row_count","member_count","share","ownership_share","percentage","rate","interest_rate","tax_rate","quantity","number_of_items","age","year","amount_basis","basis_amount_type","amount_type"]);
export const INSURANCE_SURRENDER_KEYS=["surrender_value","surrender_refund","cash_value"] as const;
const surrenderLabel="(?:(?:해약|해지)(?:\\s*시)?\\s*환급\\s*(?:(?:예상|예정)\\s*(?:금액|금|액)|(?:금|액)(?:\\s*(?:예상|예정)\\s*(?:금액|금|액))?)|surrender\\s*(?:value|amount)|cash\\s*value)";
export const isInsuranceSurrenderQuote=(quote:string)=>new RegExp(surrenderLabel,"iu").test(quote);
/** A local amount immediately attached to the source's surrender-value label. */
export function quotedInsuranceSurrenderAmount(quote:string):{raw:string;unit:string|null}|null{
  const pattern=new RegExp(surrenderLabel+"\\s*(?:\\([^()0-9]{0,30}\\))?\\s*[:：=]?\\s*([+-]?\\d[\\d,]*(?:\\.\\d+)?)\\s*(백만원|천원|만원|억원|원|KRW|won)?","giu");
  const values=[...quote.normalize("NFKC").matchAll(pattern)].map(match=>({raw:match[1],unit:match[2]??null}));
  return values.length===1?values[0]:null;
}
/** Alias identity only; it grants neither source verification nor ownership. */
export function insuranceReviewFieldKey(key:string,quotes:readonly string[]):string|null{
  const normalized=normalizeKey(key),parts=normalized.split(".");
  if(parts.length!==2||!["asset","insurance"].includes(parts[0]))return null;
  if((INSURANCE_SURRENDER_KEYS as readonly string[]).includes(parts[1])||["refund_value","gross_value"].includes(parts[1])&&quotes.length>0&&quotes.every(isInsuranceSurrenderQuote))return "asset.surrender_value";
  return null;
}
/** Exact field semantics win; a unit on an otherwise unknown amount-like key still marks a monetary source quantity (foreign units remain unnormalized). */
export function isSourceMoney(key:string,unit?:string|null):boolean{
  const local=normalizeKey(key).split(".").at(-1)??normalizeKey(key);
  if(moneyKeys.has(local))return true;
  if(nonMoneyKeys.has(local))return false;
  // Qualified financial metadata remains a date/count/rate/identifier, even if
  // its name also contains "tax", "interest", "income", or "payment".
  if(/(?:^|_)(?:date|year|years|months|days|count|quantity|rate|ratio|percent|percentage|bps|basis|phone|number|id)(?:_|$)/i.test(local))return false;
  if(!unit?.normalize("NFKC").trim())return false;
  return /(?:^|_)(?:amount|value|balance|premium|principal|interest|tax|cost|recovery|claim|arrears|limit|expense|gross|net|total|income|salary|payment|fee|rent|deposit|payoff|charge|benefit)(?:_|$)/i.test(local);
}


/** Exact ownership ratio to integral basis points. Ambiguous bare 50 stays unknown. */
export function parseExactOwnershipBps(input:{value:string|null;unit:string|null}):number|null{
 const raw=input.value?.normalize("NFKC").trim().replace(/,/g,"")??"";
 const unit=input.unit?.normalize("NFKC").trim().toLowerCase()??"";
 if(!raw)return null;
 const percent=/^(\d+)(?:\.(\d+))?\s*%$/.exec(raw);
 const number=/^(\d+)(?:\.(\d+))?$/.exec(raw);
 const fraction=/^(\d+)\s*\/\s*(\d+)$/.exec(raw);
 const ratio=/^(0|1)(?:\.(\d+))?$/.exec(raw);
 let numerator:bigint,denominator:bigint;
 if(percent||(["%","percent","percentage","퍼센트"].includes(unit)&&number)){
   const n=(percent??number)!;
   numerator=BigInt(n[1]+(n[2]??""))*100n;denominator=10n**BigInt((n[2]??"").length);
 }else if(fraction){numerator=BigInt(fraction[1])*10000n;denominator=BigInt(fraction[2]);}
 else if(["ratio","fraction","비율"].includes(unit)&&ratio){
   numerator=BigInt(ratio[1]+(ratio[2]??""))*10000n;denominator=10n**BigInt((ratio[2]??"").length);
 }else if(["bps","basis_points"].includes(unit)&&/^\d+$/.test(raw)){numerator=BigInt(raw);denominator=1n;}
 else return null;
 if(denominator===0n||numerator>10000n*denominator||numerator%denominator!==0n)return null;
 return Number(numerator/denominator);
}
