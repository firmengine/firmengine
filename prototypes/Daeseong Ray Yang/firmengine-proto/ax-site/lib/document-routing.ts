/** Document identity is a routing hint, never a source of monetary or legal facts. */
export const DOCUMENT_FAMILY_ALIASES: Record<string, readonly string[]> = {
  payroll: ["payslip", "pay_slip", "payroll_statement", "salary_statement", "employer_signed_salary_statement", "급여명세서", "임금명세서", "급료명세서", "급여지급명세서"],
  debt_certificate: ["debt_balance_certificate", "debt_balance", "debt_statement", "채무잔액증명서", "채무잔액확인서", "부채증명서", "채무확인서"],
  credit_report: ["credit_information_report", "creditor_change_report", "creditor_change_history", "debt_assignment_history", "sold_claim_history", "신용정보조회서", "채권자변동정보조회서"],
  health_insurance_arrears: ["health_insurance_premium_arrears", "insurance_premium_arrears", "건강보험료미납내역서", "건강보험료체납내역서", "보험료미납내역서"],
  health_insurance_payment: ["health_insurance_payment_confirmation", "health_insurance_payment_certificate", "건강보험료납부확인서", "건강보험료납부내역서"],
  health_insurance: ["health_insurance_qualification", "건강보험자격득실확인서", "건강보험자격확인서"],
  bank_transactions: ["bank_statement", "business_bank_statement", "salary_bank_statement", "계좌거래내역서", "입출금거래내역서", "예금거래내역서"],
  bank_account: ["bank_account_opening_certificate", "bank_balance_certificate", "account_inventory", "계좌개설확인서", "계좌개설증명서", "잔액증명서", "계좌통합조회", "예금잔액증명서"],
  tax_income: ["tax_income_certificate", "income_certificate", "income_amount_certificate", "business_income_report", "business_tax_return", "소득금액증명", "소득금액증명원"],
  tax_revenue: ["vat_certificate", "부가가치세과세표준증명", "부가가치세면세사업자수입금액증명"],
  tax_payment: ["tax_payment_certificate", "national_tax_payment_certificate", "납세증명서", "국세납세증명서", "지방세납세증명서"],
  local_tax: ["local_tax_assessment_certificate", "지방세세목별과세증명서"],
  tax_arrears: ["tax_arrears_statement", "national_tax_arrears", "local_tax_arrears", "국세체납내역서", "지방세체납내역서"],
  lease: ["lease_contract", "rental_contract", "sublease_contract", "임대차계약서", "부동산임대차계약서", "전대차계약서", "전월세계약서"],
  insurance: ["insurance_policy", "insurance_surrender_statement", "insurance_surrender_value", "insurance_enrollment_report", "보험가입내역조회결과", "보험예상해약환급금안내서", "보험해약환급금증명서"],
  vehicle_registry: ["vehicle_registration", "vehicle_register", "자동차등록원부", "자동차등록증"],
  vehicle_valuation: ["vehicle_market_evidence", "vehicle_appraisal", "중고차시세표", "자동차시세확인서"],
  pension: ["national_pension_enrollment_certificate", "pension_enrollment_record", "pension_subscription_history", "national_pension_contribution_history", "pension_contribution_payment_record", "국민연금가입증명서", "국민연금가입내역안내서"],
  pension_benefit: ["pension_certificate", "pension_benefit_certificate", "연금수급증명서", "연금지급내역서"],
  identity_family: ["resident_registration", "family_relation", "family_relation_certificate", "family_relationship_certificate", "marriage_certificate", "foreign_registration", "주민등록등본", "주민등록초본", "가족관계증명서", "혼인관계증명서"],
  client_statement: ["client_narrative", "client_intake_statement"],
  business_registration: ["business_registration_certificate", "사업자등록증", "사업자등록증명"],
  property_search: ["property_ownership_search", "지방세전국재산세과세내역", "부동산소유현황"],
};

const normalized = (label: string) => label.normalize("NFKC").trim().toLowerCase().replace(/[\s_-]+/g, "");
const byAlias = new Map<string, string>();
for (const [family, aliases] of Object.entries(DOCUMENT_FAMILY_ALIASES)) {
  for (const alias of [family, ...aliases]) {
    const key = normalized(alias), prior = byAlias.get(key);
    if (prior && prior !== family) throw new Error(`Ambiguous document alias: ${alias}`);
    byAlias.set(key, family);
  }
}

/** Accept explicit titles with normal qualifiers; broad words like 보험 or 세금 never suffice. */
export function documentFamily(label: string): string {
  const direct = byAlias.get(normalized(label));
  if (direct) return direct;
  const text = label.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
  if (/(?:급여|급료|임금)(?:지급)?명세서/.test(text)) return "payroll";
  if (/신용정보조회서|채권자변동정보|미보유채권|매각당시.*(?:정보|이력)/.test(text)) return "credit_report";
  if (/건강보험료(?:미납|체납)(?:내역|증명)|보험료미납내역서/.test(text)) return "health_insurance_arrears";
  if (/건강보험료납부(?:내역|확인|증명)/.test(text)) return "health_insurance_payment";
  if (/건강보험자격(?:득실)?확인/.test(text)) return "health_insurance";
  if (/지방세세목별과세증명/.test(text)) return "local_tax";
  if (/(?:국세|지방세)체납(?:및정리보류)?내역/.test(text)) return "tax_arrears";
  if (/소득금액증명/.test(text)) return "tax_income";
  if (/부가가치세(?:과세표준|면세사업자수입금액)증명/.test(text)) return "tax_revenue";
  if (/채무잔액(?:증명|확인)서|부채증명서|채무확인서/.test(text)) return "debt_certificate";
  if (/(?:임대차|전대차|전월세)계약서/.test(text)) return "lease";
  if (/자동차등록(?:원부|증)/.test(text)) return "vehicle_registry";
  if (/보험(?:가입내역|예상해약환급금|해약환급금)/.test(text)) return "insurance";
  if (/(?:입출금|예금|계좌)거래내역/.test(text)) return "bank_transactions";
  if (/계좌(?:개설|통합조회)|예금잔액증명/.test(text)) return "bank_account";
  if (/주민등록(?:등본|초본)|가족관계증명|혼인관계증명/.test(text)) return "identity_family";
  if (/사업자등록(?:증|증명)/.test(text)) return "business_registration";
  return "unknown";
}

/** All equivalent names help find existing workflow contracts without changing their legal scope. */
export function equivalentDocumentTypes(label: string): string[] {
  const family = documentFamily(label);
  return [...new Set([label, ...(family === "unknown" ? [] : [family, ...(DOCUMENT_FAMILY_ALIASES[family] ?? [])])])];
}
