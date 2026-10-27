/** Shared conservative source quantity rules for extraction and proof validation. */
const normalizeKey=(key:string)=>key.trim().replace(/([A-Z]+)([A-Z][a-z])/g,"$1_$2").replace(/([a-z0-9])([A-Z])/g,"$1_$2").toLowerCase();
const moneyKeys=new Set([
  "principal","principal_balance","outstanding_principal","original_principal","interest","overdue_interest","total","total_claim","gross","expenses","net","gross_value","secured_payoff","disposal_costs","protected_value","amount","reported_amount","balance","monthly_rent","rent_per_month","deposit","security_deposit","secured_balance","arrears_deduction","tax_arrears","premium_arrears","late_charge","total_arrears","disposition_amount","arrears_amount","current_balance","claim_amount","amount_due","refund_value","guarantee_limit","guarantee_amount",
  "coverage_amount","insured_amount","insurance_amount","monthly_premium","premium","insurance_premium","paid_premium","premium_paid","tax_amount","tax","secured_amount","secured_recovery","disputed_amount","gross_amount","net_amount","total_amount","current_amount","claimed_amount","recovery_amount","surrender_value","cash_value","market_value","appraised_value","asset_value","salary_amount","income_amount","payment_amount","fee_amount","cost_amount","interest_amount","principal_amount","outstanding_amount","loan_amount","remaining_balance","arrears_amount","disposal_cost","disposal_costs","guaranteed_amount","guarantee_ceiling","installment_amount","monthly_payment","annual_income","monthly_income","period_total"
]);
const nonMoneyKeys=new Set(["date","as_of","issued_date","issue_date","document_date","birth_date","phone","phone_number","mobile","registration_number","identity_id","id_number","account_number","contract_id","period_months","months","count","row_count","member_count","share","ownership_share","percentage","rate","interest_rate","tax_rate","quantity","number_of_items","age","year","amount_basis","basis_amount_type","amount_type"]);
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

