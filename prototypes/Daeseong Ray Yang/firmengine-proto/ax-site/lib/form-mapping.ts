import { shareBasisPoints } from "./reference-parameters.ts";
import documentPolicy from "./reference-document-policy.json" with { type: "json" };
/** Public blank-form mapping. No filled sample, evaluator answer, or model output is embedded. */
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { createCaseReadIndex, currentFacts, factHasValidStructuredRefs, factSourceLineageIssues, moneyValue, validSourceRef } from "./domain.ts";
import type { ArtifactKind, CaseData, CaseReadIndex, Fact, NumericInput } from "./domain.ts";
import type { CalculationResult } from "./assessment.ts";
import type { PlanLedger } from "./repayment-plan-model.ts";
import type { PlanReconciliation } from "./plan-reconciliation.ts";
import { resolveAssetRows } from "./asset-resolution.ts";
import { resolveDebtRows } from "./debt-resolution.ts";
import { applicantIdentityValue } from "./applicant-identity.ts";
import { applicantStatementForForm } from "./statement-paragraphs.ts";
import { PUBLIC_FORM_BASE64, PUBLIC_FORM_METADATA } from "./form-template-data.ts";

/** An annual/partial/unknown source period is NOT a court-form monthly row.
 * No proportional allocation of annual totals is permitted without real months. */
export function exactSourceCalendarMonth(start:string|undefined,end:string|undefined,basis:string|undefined):string|null{
 if(!["monthly","period_total"].includes(basis??"")||!start||!end||!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end))return null;
 const from=new Date(start+"T00:00:00.000Z"),to=new Date(end+"T00:00:00.000Z");
 if(!Number.isFinite(from.valueOf())||!Number.isFinite(to.valueOf())||from.toISOString().slice(0,10)!==start||to.toISOString().slice(0,10)!==end)return null;
 if(start.slice(0,7)!==end.slice(0,7)||from.getUTCDate()!==1)return null;
 const monthEnd=new Date(Date.UTC(to.getUTCFullYear(),to.getUTCMonth()+1,0)).getUTCDate();
 return to.getUTCDate()===monthEnd?start.slice(0,7):null;
}

export const FORM_MAPPING_VERSION = "canonical-public-forms-1.0.3";
export const MISSING_FORM_VALUE = "[확인 필요]";
export const BASIC_FORM_CODES = documentPolicy.basicFormCodes as Partial<Record<ArtifactKind, keyof typeof PUBLIC_FORM_METADATA>>;
export interface FormBindings {
  scalars: Record<string, string>;
  rows: Record<string, Record<string, string>[]>;
}
export interface FormProvenance {
  code: string;
  mappingVersion: string;
  templateVersion: string;
  templateSha256: string;
  approvalStatus: "reviewer_pending";
  reconstruction: boolean;
  sourceUrls: string[];
  limitations: string;
  unresolvedTokens: string[];
}
export interface MappedPublicForm {
  bytes: Uint8Array;
  provenance: FormProvenance;
  /** Number of original form tables, before the independently checked calculation appendix. */
  formTableCount: number;
}

const clean = (value: unknown) => String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "�");
const present = (value: unknown): string => value === undefined || value === null || value === "" ? MISSING_FORM_VALUE : clean(typeof value === "object" ? JSON.stringify(value) : value);
const amount = (value: string | null | undefined): string => value !== undefined && value !== null && /^-?\d+$/.test(value) ? BigInt(value).toLocaleString("ko-KR") : MISSING_FORM_VALUE;
const numeric = (value: NumericInput | null | undefined): string => { const n = moneyValue(value); return n === null ? MISSING_FORM_VALUE : amount(n.toString()); };
const claimLabels: Record<string,string> = { ordinary:"일반채권", secured:"담보채권", tax:"조세채권", estate:"재단채권", non_dischargeable:"면책 제외 검토 채권", disputed:"다툼 있는 채권", unknown:"분류 확인 필요" };
const assetLabels: Record<string,string> = { cash:"현금",deposit:"예금",insurance:"보험 해약환급금",vehicle:"자동차",real_estate:"부동산",lease_deposit:"임차보증금",business:"사업용 재산",receivable:"채권",retirement:"퇴직금",other:"기타 재산" };
const allocationLabels: Record<string,string> = { principal_then_interest_pro_rata:"원금 비례배분 후 잔여금으로 이자 배분",principal_only_pro_rata:"원금 비례배분" };
const normalizedKey = (key: string) => key.replace(/[A-Z]/g, (x) => "_" + x.toLowerCase());
function usableFact(data: CaseData, fact: Fact,index?:CaseReadIndex): boolean {
  const linked = fact.structuredRefs !== undefined ? factHasValidStructuredRefs(data, fact) : !!fact.refs.length && fact.refs.every((r) => validSourceRef(data, r,index));
  return fact.state !== "disputed" && fact.recognition !== "rejected" && linked && !fact.validation.some((v) => v.severity === "error" || ["UNCERTAIN_READING", "NORMALIZATION_REVIEW"].includes(v.code)) && !factSourceLineageIssues(data,[fact.id],index).some(code=>code!=="SOURCE_VERIFICATION_REQUIRED");
}
function sourceValid(data: CaseData, ids: string[],index?:CaseReadIndex): boolean {
  // Draft preview may show clear, cited extracted values before cross-read.
  // Final generation is independently gated by assessment/source review.
  return !factSourceLineageIssues(data, ids,index).some(code => code !== "SOURCE_VERIFICATION_REQUIRED");
}
const aliases: Record<string, string[]> = {
  client_name: ["person.name", "applicant.name"], address: ["person.address", "applicant.address", "jurisdiction.residence", "creditor_address", "debt.creditor_address"],
  resident_id: ["person.resident_id_masked", "applicant.resident_id_masked"], registered_address: ["person.registered_address"],
  phone: ["person.phone", "applicant.phone", "creditor_phone"], fax: ["creditor_fax"], business_name: ["business.name", "business.business_name", "income.business_name"],
  business_type: ["business.type", "business.business_type"], business_registration: ["business.registration", "business.business_registration"],
  business_address: ["business.address"], opening_date: ["business.opening_date"], statement: ["statement.text", "person.statement", "form.statement"],
  prior_proceedings: ["case.prior_proceedings", "statement.prior_proceedings"], court_name: ["court.name"],
  "debt.principal": ["debt.principal_balance", "debt.outstanding_principal"],
  cause: ["creditor_cause", "debt.cause"], content: ["debt.content", "creditor_content"],
  loan_date: ["creditor_loan_date", "debt.incurred_at", "debt.loan_date"],
  original_principal: ["debt.original_principal", "creditor_original_principal"],
  collateral: ["creditor_collateral", "debt.collateral_id"], secured_amount: ["creditor_secured_amount", "debt.secured_amount"],
  secured_recovery: ["creditor_secured_recovery", "debt.expected_separate_recovery"], shortfall: ["creditor_shortfall", "debt.deficiency"],
  dispute_reason: ["creditor_dispute_reason", "debt.dispute_reason"], disputed_amount: ["creditor_disputed_amount", "debt.claimed_amount"],
  undisputed_amount: ["creditor_undisputed_amount", "debt.undisputed_amount"], litigation: ["creditor_litigation", "debt.litigation"],
  assignment_order: ["creditor_assignment_order", "debt.assignment_order"], priority_basis: ["creditor_priority_basis", "debt.priority_basis"],
  "debt.cause": ["creditor_cause"], "debt.content": ["creditor_content"], "debt.address": ["creditor_address"],
  "debt.phone": ["creditor_phone"], "debt.fax": ["creditor_fax"], "debt.loan_date": ["creditor_loan_date", "debt.incurred_at"],
  "debt.original_principal": ["creditor_original_principal"], "debt.collateral": ["creditor_collateral", "debt.collateral_id"],
  "debt.secured_amount": ["creditor_secured_amount"], "debt.secured_recovery": ["creditor_secured_recovery", "debt.expected_separate_recovery"],
  "debt.shortfall": ["creditor_shortfall", "debt.deficiency"], "debt.dispute_reason": ["creditor_dispute_reason", "debt.dispute_reason"],
  "debt.disputed_amount": ["creditor_disputed_amount", "debt.claimed_amount"], "debt.undisputed_amount": ["creditor_undisputed_amount", "debt.undisputed_amount"],
  "debt.litigation": ["creditor_litigation"], "debt.assignment_order": ["creditor_assignment_order"], "debt.priority_basis": ["creditor_priority_basis"],
  "asset.institution": ["asset.insurer", "asset.insurance_company", "asset.bank", "bank_account.bank"],
  "asset.policy_number": ["asset.policy_id", "asset.insurance_policy_number"],
  "asset.acquisition_date": ["asset.acquired_date"],
};

/** Exact typed amounts are reused; unsupported legal choices and missing facts stay explicit. */
export function buildFormBindings(data: CaseData, calculation: CalculationResult,index:CaseReadIndex=createCaseReadIndex(data),ledger?:PlanLedger,reconciliation?:PlanReconciliation): FormBindings {
  const facts = currentFacts(data,index).filter((fact) => usableFact(data, fact,index));
  const assetResolution = resolveAssetRows(data,index), debtResolution = resolveDebtRows(data,index);
  const conflictedAssets = new Set(assetResolution.conflictIds);
  const linkedFacts = new Map([...data.incomes, ...debtResolution.rows, ...assetResolution.rows].map(row=>[row.id,new Set(row.factIds)]));
  const select = (key: string, subjectId?: string): Fact[] => {
    const keys = new Set([key, ...(aliases[key] ?? []), ...["person", "applicant", "case", "business", "statement", "household", "other"].map((prefix) => prefix + "." + key)].map(normalizedKey));
    return facts.filter((fact) => (!subjectId || (linkedFacts.has(subjectId) ? linkedFacts.get(subjectId)!.has(fact.id) : fact.subjectId === subjectId)) && keys.has(normalizedKey(fact.key)));
  };
  const pick = (key: string, subjectId?: string): string => {
    const values = [...new Set(select(key, subjectId).map((fact) => fact.numeric ? numeric(fact.numeric) : present(fact.value)))];
    return values.length === 1 ? values[0] : values.length ? "[불일치·확인 필요]" : MISSING_FORM_VALUE;
  };
  const objectFact = (category: string, key: string, subjectId: string) => pick(category + "." + key, subjectId);
  const scalars: Record<string, string> = {};
  for (const form of Object.values(PUBLIC_FORM_METADATA)) for (const token of form.mapped_tokens) if (!token.includes(".")) scalars[token] = pick(token);
  Object.assign(scalars, {
    client_name: present(data.context.applicant?.name || (applicantIdentityValue(data,"name",index) !== MISSING_FORM_VALUE ? applicantIdentityValue(data,"name",index) : undefined)),
    address: present(data.context.applicant?.address || (applicantIdentityValue(data,"address",index) !== MISSING_FORM_VALUE ? applicantIdentityValue(data,"address",index) : undefined)),
    resident_id: present(data.context.applicant?.residentIdMasked || (applicantIdentityValue(data,"resident_id_masked",index) !== MISSING_FORM_VALUE ? applicantIdentityValue(data,"resident_id_masked",index) : undefined)),
    phone: applicantIdentityValue(data,"phone",index),
    registered_address: applicantIdentityValue(data,"registered_address",index),
    court_name: pick("court_name") !== MISSING_FORM_VALUE ? pick("court_name") : data.context.courtId === "seoul" ? "서울회생법원" : MISSING_FORM_VALUE,
    application_date: present(data.context.applicationDate), debt_as_of: present(data.context.asOf),
    statement: present(applicantStatementForForm(data,index)),
    total_principal: amount(calculation.debtPrincipalWon), total_interest: amount(calculation.debtInterestWon),
    secured_debt_total: amount(calculation.securedDebtWon), unsecured_debt_total: amount(calculation.unsecuredDebtWon),
    monthly_income: amount(calculation.monthlyIncomeWon), recognized_living_cost: amount(calculation.recognizedLivingCostWon),
    household_size: data.household.recognition === "accepted" ? present(data.household.recognizedMembers) : MISSING_FORM_VALUE,
    monthly_disposable_income: amount(calculation.disposableIncomeWon), ordinary_repayment_budget: amount(calculation.ordinaryRepaymentBudgetWon), monthly_payment: amount(calculation.monthlyPaymentWon),
    monthly_trustee_fee: numeric(data.context.monthlyTrusteeFee), repayment_months: present(data.context.planMonths),
    total_repayment: amount(calculation.planTotalWon), liquidation_value: amount(calculation.liquidationValueWon),
    present_value: amount(calculation.presentValueWon), present_value_basis: present(data.context.presentValueBasis),
    allocation_basis: data.context.allocationBasisReviewed === true ? present(allocationLabels[data.context.allocationBasis ?? ""]) : "[배분 기준 검토 필요]",
    approved_monthly_income: data.context.inventoryComplete.income==="yes" && data.context.incomePeriodReviewed===true &&
      calculation.monthlyIncomeWon !== null && calculation.incomeRows.length > 0 && calculation.incomeRows.every((row) => {
      const current=data.incomes.find(s=>s.id===row.id);
      return !!current&&row.monthlyWon!==null&&current.recognition==="accepted"&&
        current.factIds.length>0&&factSourceLineageIssues(data,current.factIds,index).length===0;
    }) ? amount(calculation.monthlyIncomeWon) : MISSING_FORM_VALUE,
  });
  // D5110's ③=①−② and ⑤=③−④ are a different quantity from an approved ordinary-claim payment.
  const beforeFee = calculation.monthlyIncomeWon === null || calculation.recognizedLivingCostWon === null ? null : BigInt(calculation.monthlyIncomeWon) - BigInt(calculation.recognizedLivingCostWon);
  const fee = moneyValue(data.context.monthlyTrusteeFee);
  const afterFee = beforeFee === null || fee === null || fee < 0n ? null : beforeFee - fee;
  scalars.form_pre_fee_disposable = beforeFee === null ? MISSING_FORM_VALUE : amount(beforeFee.toString());
  scalars.form_available_after_trustee = afterFee === null ? MISSING_FORM_VALUE : amount(afterFee.toString());
  scalars.form_total_available_after_trustee = afterFee === null || !Number.isSafeInteger(data.context.planMonths) || data.context.planMonths! <= 0 ? MISSING_FORM_VALUE : amount((afterFee * BigInt(data.context.planMonths!)).toString());
  const rows: FormBindings["rows"] = {};
  const sourceText = (ids: string[], key: string): string => {
    let candidates=facts.filter((f) => ids.includes(f.id) && [key,...(aliases[key]??[])].map(normalizedKey).includes(normalizedKey(f.key)));
    if(key==="debt.principal"){
      const current=candidates.filter(f=>["debt.principal_balance","debt.outstanding_principal"].includes(normalizedKey(f.key)));
      if(current.length)candidates=current;
    }
    return candidates.flatMap((f) => f.refs.map((r) => `${r.documentId} ${r.page}쪽: ${r.quote}`)).join(" / ") || MISSING_FORM_VALUE;
  };
  rows.creditor = calculation.debtRows.map((row, index) => {
    const debt = debtResolution.rows.find((d) => d.id === row.id)!;
    const base: Record<string, string> = {
      number: String(index + 1), entity: present(debt.creditor), contract_id: present(debt.contractId), period: present(debt.asOf),
      principal: amount(row.principalWon), interest: amount(row.interestWon), claim_type: present(claimLabels[debt.classification]),
      principal_basis: row.principalWon===null?MISSING_FORM_VALUE:sourceText(debt.factIds, "debt.principal"), interest_basis: sourceText(debt.factIds, "debt.interest"),
      total_payment: amount(calculation.allocations.find((a) => a.debtId === debt.id)?.totalWon),
      monthly_payment: (()=>{if(!ledger||ledger.status==="blocked"||reconciliation?.status!=="reconciled")return MISSING_FORM_VALUE;const rows=ledger.rows.filter(r=>r.debtId===debt.id);if(!rows.length)return MISSING_FORM_VALUE;const months=new Map<number,bigint>();for(const r of rows)months.set(r.installment,(months.get(r.installment)??0n)+BigInt(r.principalWon)+BigInt(r.interestWon)+BigInt(r.otherComponentWon));const vals=[...months.values()];return vals.length&&vals.every(v=>v===vals[0])?amount(vals[0]!.toString()):MISSING_FORM_VALUE;})(),
    };
    for (const key of ["cause", "content", "address", "phone", "fax", "loan_date", "original_principal", "collateral", "secured_amount", "secured_recovery", "shortfall", "dispute_reason", "disputed_amount", "undisputed_amount", "litigation", "assignment_order", "priority_basis", "due_date"]) base[key] = key === "due_date" ? present(debt.dueDate) : objectFact("debt", key, debt.id);
    if (base.loan_date === MISSING_FORM_VALUE) base.loan_date = objectFact("debt", "origination_date", debt.id);
    return base;
  });
  const debtRowsBy = (predicate: (id: string) => boolean) => rows.creditor.filter((_, i) => predicate(calculation.debtRows[i].id));
  rows.secured = debtRowsBy((id) => { const d = data.debts.find((d) => d.id === id)!; return d.secured === "yes" || d.classification === "secured"; });
  rows.disputed = debtRowsBy((id) => data.debts.find((d) => d.id === id)?.classification === "disputed");
  rows.priority = debtRowsBy((id) => data.debts.find((d) => d.id === id)?.priority === "priority");
  rows.estate = debtRowsBy((id) => data.debts.find((d) => d.id === id)?.classification === "estate");
  rows.assignment = rows.creditor.filter((r) => r.assignment_order !== MISSING_FORM_VALUE);
  const ownGross = (id: string): bigint | null => {
    const asset = assetResolution.rows.find((a) => a.id === id)!;
    const gross = moneyValue(asset.grossValue);
    if (conflictedAssets.has(asset.id) || !sourceValid(data, asset.factIds,index) || gross === null || gross < 0n || !Number.isSafeInteger(asset.ownershipBps) || asset.ownershipBps! < 0 || asset.ownershipBps! > shareBasisPoints()) return null;
    return (gross * BigInt(asset.ownershipBps!) + BigInt(shareBasisPoints() - 1)) / BigInt(shareBasisPoints());
  };
  rows.asset = assetResolution.rows.map((asset) => {
    const valid = sourceValid(data, asset.factIds,index), own = ownGross(asset.id);
    const gross = moneyValue(asset.grossValue);
    const base: Record<string, string> = { entity: present(asset.label), kind: present(assetLabels[asset.kind]), period: present(asset.asOf), value: valid && !conflictedAssets.has(asset.id) && gross !== null && gross >= 0n ? amount(gross.toString()) : MISSING_FORM_VALUE, ownership_share: asset.ownershipBps === null || asset.ownershipBps === undefined ? MISSING_FORM_VALUE : `${asset.ownershipBps}/${shareBasisPoints()}`, secured_payoff_scope: objectFact("asset", "secured_payoff_scope", asset.id), valuation_basis: valid ? present(asset.valuationBasis) : MISSING_FORM_VALUE, applicant_share_value: own === null ? MISSING_FORM_VALUE : amount(own.toString()), attribution_status: own === null ? "신청인 귀속분 미확정 · 원문 총액만 표시" : "입력 지분을 적용한 계산값 · 인정 여부 별도 검토" };
    for (const key of ["account_number", "acquisition_date", "address", "collateral", "description", "institution", "return_amount", "seizure"]) base[key] = valid ? objectFact("asset", key, asset.id) : MISSING_FORM_VALUE;
    if (valid && asset.kind === "insurance" && base.account_number === MISSING_FORM_VALUE) base.account_number = objectFact("asset", "policy_number", asset.id);
    return base;
  });
  const assetSum = (kind?: string) => {
    const items = assetResolution.rows.filter((a) => !kind || a.kind === kind);
    const values = items.map((a) => ownGross(a.id));
    return data.context.inventoryComplete.asset !== "yes" || values.some((v) => v === null) ? MISSING_FORM_VALUE : amount((values as bigint[]).reduce((a, b) => a + b, 0n).toString());
  };
  for (const [key, kind] of Object.entries({cash:"cash",bank_balance:"deposit",insurance_surrender:"insurance",vehicle_value:"vehicle",housing_deposit:"lease_deposit",real_estate_value:"real_estate",retirement_value:"retirement",business_assets_value:"business",other_assets:"other"})) scalars[key] = assetSum(kind);
  scalars.assets_total = assetSum();
  const incomesById=new Map(data.incomes.map(income=>[income.id,income]));
  // The source set of a D5103 month table is exactly the set used by
  // the deterministic calculation after explicit duplicate exclusions.
  rows.month = calculation.incomeRows.map((calculationRow) => {
    const income=incomesById.get(calculationRow.id);
    const month=income?exactSourceCalendarMonth(income.periodStart,income.periodEnd,income.amountBasis):null;
    const verified=!!income&&sourceValid(data,income.factIds,index);
    const usable=!!month&&verified&&calculationRow.monthlyWon!==null;
    return {
      entity:present(income?.label),
      period:month??MISSING_FORM_VALUE,
      revenue:usable?numeric(income?.gross):MISSING_FORM_VALUE,
      expense:usable?numeric(income?.expenses):MISSING_FORM_VALUE,
      net_income:usable?amount(calculationRow.monthlyWon):MISSING_FORM_VALUE
    };
  });
  const business = calculation.incomeGroups.filter((group) => group.sourceIds.some(id=>data.incomes.find(s=>s.id===id)?.kind==="business"));
  // The source group may have a plausible observed average while another
  // money source/selected month is still missing. Never render it as a court
  // form income amount when the case-wide calculation is explicitly blocked.
  scalars.monthly_business_income = calculation.monthlyIncomeWon !== null &&
    data.context.inventoryComplete.income === "yes" &&
    (business.length>0||!data.incomes.some(s=>s.kind==="business")) &&
    business.every((r) => r.monthlyObservedAverageWon !== null) ?
    amount(business.reduce((sum,row)=>sum+BigInt(row.monthlyObservedAverageWon!),0n).toString()) : MISSING_FORM_VALUE;
  for (const prefix of ["career", "enforcement", "prior", "family"]) {
    const grouped = new Map<string, Record<string, string>>();
    for (const fact of facts) {
      const key = normalizedKey(fact.key), marker = key.startsWith(prefix + ".") ? prefix + "." : key.startsWith("statement." + prefix + ".") ? "statement." + prefix + "." : key.startsWith("household." + prefix + ".") ? "household." + prefix + "." : null;
      if (!marker) continue;
      const row = grouped.get(fact.subjectId) ?? {};
      const name = key.slice(marker.length), value = fact.numeric ? numeric(fact.numeric) : present(fact.value);
      row[name] = row[name] && row[name] !== value ? "[불일치·확인 필요]" : value;
      grouped.set(fact.subjectId, row);
    }
    rows[prefix] = [...grouped.values()];
  }
  rows.attachment = data.documents.filter((d) => d.status === "active").map((document, i) => ({ number: String(i + 1), document_id: document.id, title: document.name, pages: document.pages.join(", "), period: MISSING_FORM_VALUE, purpose: present(document.type), subject: MISSING_FORM_VALUE, included: "[편철 포함 여부 별도 확인]" }));
  return { scalars, rows };
}

function xmlEscape(value: string): string {
  return clean(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;").replaceAll("{", "&#123;").replaceAll("}", "&#125;").replace(/\r?\n/g, '</w:t><w:br/><w:t xml:space="preserve">');
}
function textParagraph(value: string, bold=false): string {
  return `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="맑은 고딕"/>${bold?"<w:b/>":""}<w:color w:val="000000"/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">${xmlEscape(value)}</w:t></w:r></w:p>`;
}
function sourceLinkParagraph(label: string, relationshipId: string): string {
  return `<w:p><w:pPr><w:spacing w:after="100"/></w:pPr><w:hyperlink r:id="${relationshipId}" w:history="1"><w:r><w:rPr><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="맑은 고딕"/><w:color w:val="000000"/><w:sz w:val="18"/></w:rPr><w:t>${xmlEscape(label)}</w:t></w:r></w:hyperlink></w:p>`;
}
async function sha256(bytes: Uint8Array): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const decode = (base64: string): Uint8Array => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

/** Fill literal tokens and clone original table rows without evaluating expressions or signatures. */
export async function renderPublicForm(input: { kind: ArtifactKind; data: CaseData; calculation: CalculationResult; appendixDocx: Uint8Array; mode: "draft" | "final"; sourceIndex?:CaseReadIndex; bindings?:FormBindings; planLedger?:PlanLedger; planReconciliation?:PlanReconciliation }): Promise<MappedPublicForm | null> {
  const code = BASIC_FORM_CODES[input.kind];
  if (!code) return null;
  const metadata = PUBLIC_FORM_METADATA[code];
  const original = decode(PUBLIC_FORM_BASE64[code]);
  if (await sha256(original) !== metadata.template.sha256) throw new Error("공개 서식 템플릿 해시가 카탈로그와 다릅니다: " + code);
  const archive = unzipSync(original), appendix = unzipSync(input.appendixDocx);
  let xml = strFromU8(archive["word/document.xml"]);
  if (code === "D5110") {
    xml = xml.replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, (table) => ["approved_monthly_income", "recognized_living_cost", "monthly_disposable_income", "monthly_trustee_fee", "monthly_payment", "repayment_months", "total_repayment"].every((token) => table.includes("{{" + token + "}}")) ? table.replaceAll("{{approved_monthly_income}}", "{{monthly_income}}").replaceAll("{{monthly_disposable_income}}", "{{form_pre_fee_disposable}}").replaceAll("{{monthly_payment}}", "{{form_available_after_trustee}}").replaceAll("{{total_repayment}}", "{{form_total_available_after_trustee}}") + textParagraph("위 표는 관측 월평균 수입을 사용한 ①−②−④의 기본 가용소득 계산입니다. 소득·생계비의 법적 인정은 별도 검토하며, 음수는 부족액을 뜻합니다. 별도 우선·재단채권 변제와 검토된 일반채권 계획 월액·총액은 6항 및 계산 부록에서 구분하여 대조합니다.") : table);
    xml = xml.replace(/월 평균\s*가용소득에서 월 회생위원 보수를 차감한 월 실제 가용소득을 안분하여/g, "검토한 일반채권 월 변제계획액을 안분하여");
  }
  // Display-only labels belong to this render. The persisted snapshot and its
  // receipt digest must remain unchanged when reused by another document/tool.
  const sourceBindings = input.bindings??buildFormBindings(input.data, input.calculation,input.sourceIndex,input.planLedger,input.planReconciliation);
  const bindings:FormBindings = {rows:sourceBindings.rows,scalars:{...sourceBindings.scalars,
    review_status:input.mode === "final" ? "최종 검토본 · 서식 검토 대기" : "초안 · 서식 검토 대기",
    revision:String(input.data.context.revision),
  }}, unresolved = new Set<string>();
  const replace = (source: string, prefix?: string, row?: Record<string, string>): string => source.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (_, token: string) => {
    const value = prefix && token.startsWith(prefix + ".") ? row?.[token.slice(prefix.length + 1)] : bindings.scalars[token];
    if (value === undefined || value === MISSING_FORM_VALUE || value.startsWith("[불일치")) unresolved.add(token);
    return xmlEscape(value ?? MISSING_FORM_VALUE);
  });
  xml = xml.replace(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, (rowXml) => {
    const prefixes = [...new Set([...rowXml.matchAll(/\{\{([a-z_]+)\.[a-zA-Z0-9_.]+\}\}/g)].map((match) => match[1]))];
    if (prefixes.length > 1) throw new Error("반복행에 서로 다른 대상이 혼합되었습니다: " + code);
    if (!prefixes.length) return replace(rowXml);
    const prefix = prefixes[0], values = bindings.rows[prefix] ?? [];
    return (values.length ? values : [{}]).map((row) => replace(rowXml, prefix, row)).join("");
  });
  xml = replace(xml);
  xml = xml.replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, (table) => table.replace(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/, (row) => row.includes("<w:tblHeader") ? row : row.includes("<w:trPr>") ? row.replace("<w:trPr>", "<w:trPr><w:tblHeader/>") : row.replace(/(<w:tr(?:\s[^>]*)?>)/, "$1<w:trPr><w:tblHeader/></w:trPr>")));
  for (const name of Object.keys(archive)) if (/^word\/(?:header|footer)\d+\.xml$/.test(name)) archive[name] = strToU8(replace(strFromU8(archive[name])));
  const formTableCount = [...xml.matchAll(/<w:tbl(?:\s[^>]*)?>/g)].length;
  const sourceUrls = [...new Set(metadata.originals.map((source) => source.url))];
  const provenance: FormProvenance = { code, mappingVersion: FORM_MAPPING_VERSION, templateVersion: metadata.template_version, templateSha256: metadata.template.sha256, approvalStatus: "reviewer_pending", reconstruction: true, sourceUrls, limitations: metadata.limitations, unresolvedTokens: [...unresolved].sort() };
  const note = `${input.mode === "final" ? "최종 검토본 · 서명·제출 승인 전" : "검토용 초안"} | ${code} | 서식 대응 검토 대기 | 사건 v${input.data.context.revision}`;
  xml = xml.replace(/(<w:body>)/, "$1" + textParagraph(note, true));
  // The original form owns its styles, dimensions, labels, field order, and blank signature lines.
  const appendixXml = strFromU8(appendix["word/document.xml"]);
  const appendixSection = appendixXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0]?.replace(/<w:(?:footerReference|headerReference)[^>]*\/>/g, "") ?? "<w:sectPr/>";
  const appendixBody = appendixXml.match(/<w:body>([\s\S]*)<\/w:body>/)?.[1]?.replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/g, "");
  if (!appendixBody) throw new Error("계산·근거 부록 본문을 읽지 못했습니다.");
  const relationshipPath = "word/_rels/document.xml.rels";
  let relationships = archive[relationshipPath] ? strFromU8(archive[relationshipPath]) : '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  const sourceLinks = metadata.originals.map((source, index) => {
    const id=`rIdFirmPublicSource${index+1}`;
    relationships=relationships.replace("</Relationships>", `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEscape(source.url)}" TargetMode="External"/></Relationships>`);
    return sourceLinkParagraph(`${source.title} · 법원 공개 원본 (file.scourt.go.kr)`, id);
  }).join("");
  archive[relationshipPath]=strToU8(relationships);
  const sourceNotes = textParagraph("서식 출처 및 매핑 검토", true) + textParagraph(`공개 편집 재구성 ${metadata.template_version}; 원본과 동일한 페이지 배치 또는 최신 접수 적합성을 인증하지 않습니다.`) + textParagraph(`템플릿 SHA-256 ${metadata.template.sha256}; 매핑 ${FORM_MAPPING_VERSION}; 미확인 토큰 ${unresolved.size}개`) + sourceLinks;
  const originalSection = xml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0] ?? "<w:sectPr/>";
  const sectionBreak = `<w:p><w:pPr>${originalSection}</w:pPr></w:p>`;
  const extra = sectionBreak + textParagraph("계산 및 원문 근거 검토 부록", true) + appendixBody + sourceNotes + appendixSection;
  xml = xml.replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/, "").replace("</w:body>", extra + "</w:body>");
  archive["word/document.xml"] = strToU8(xml);
  if (archive["word/styles.xml"]) {
    let styles = strFromU8(archive["word/styles.xml"]);
    styles = styles.replace(/<w:style\b[^>]*w:styleId="(?:Title|Subtitle|Heading[1-9](?:Char)?|TitleChar|SubtitleChar)"[^>]*>[\s\S]*?<\/w:style>/g, (style) => style.replace(/<w:pBdr>[\s\S]*?<\/w:pBdr>/g, "").replace(/<w:color\b[^>]*\/>/g, '<w:color w:val="000000"/>').replace(/<w:rFonts\b[^>]*\/>/g, '<w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="맑은 고딕"/>'));
    styles = styles.replace(/<w:style\b[^>]*w:styleId="Normal"[^>]*>[\s\S]*?<\/w:style>/g, (style) => style.replace(/<w:spacing\b[^>]*\/>/, '<w:spacing w:after="60" w:line="264" w:lineRule="auto"/>'));
    styles = styles.replace(/<w:style\b[^>]*w:styleId="Heading1"[^>]*>[\s\S]*?<\/w:style>/g, (style) => style.replace(/w:before="480"/, 'w:before="180"'));
    archive["word/styles.xml"] = strToU8(styles);
  }
  // Preserve public template package parts. Appendices contain no external relationships.
  return { bytes: zipSync(archive, { level: 6 }), provenance, formTableCount };
}
