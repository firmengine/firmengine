import { moneyValue, normalizeMoney, type Json } from "./domain.ts";
import type { ReferenceFieldObservation, ReferenceObjectRow, ReferenceTestDataset } from "./reference-case-import.ts";

type Collection = "incomes" | "debts" | "assets" | "transactions";
type Subject = "income" | "debt" | "asset" | "transaction";
type ApplicantProperty = "name" | "address" | "residentIdMasked" | "statement";
type Mapping = { collection: Collection; subject: Subject; property: string; canonicalKey: string; familyId?: string; localId?: string; roles?: { party?: string; temporal?: string; amount?: string } };

/** Exact app field keys only. Similar labels and raw source keys are deliberately not aliases. */
const APP_FIELD_MAPPINGS: Readonly<Record<string, Omit<Mapping, "canonicalKey">>> = {
  "income.label": { collection: "incomes", subject: "income", property: "label" },
  "income.kind": { collection: "incomes", subject: "income", property: "kind" },
  "income.employer": { collection: "incomes", subject: "income", property: "employer" },
  "income.payer_identity_id": { collection: "incomes", subject: "income", property: "payerIdentityId" },
  "income.gross": { collection: "incomes", subject: "income", property: "gross" },
  "income.expenses": { collection: "incomes", subject: "income", property: "expenses" },
  "income.net": { collection: "incomes", subject: "income", property: "net" },
  "income.period_start": { collection: "incomes", subject: "income", property: "periodStart" },
  "income.period_end": { collection: "incomes", subject: "income", property: "periodEnd" },
  "income.period_months": { collection: "incomes", subject: "income", property: "periodMonths" },
  "income.amount_basis": { collection: "incomes", subject: "income", property: "amountBasis" },
  "income.recurring": { collection: "incomes", subject: "income", property: "recurring" },
  "debt.creditor": { collection: "debts", subject: "debt", property: "creditor" },
  "debt.contract_id": { collection: "debts", subject: "debt", property: "contractId" },
  "debt.principal_balance": { collection: "debts", subject: "debt", property: "principal" },
  "debt.interest": { collection: "debts", subject: "debt", property: "interest" },
  "debt.secured": { collection: "debts", subject: "debt", property: "secured" },
  "debt.as_of": { collection: "debts", subject: "debt", property: "asOf" },
  "debt.due_date": { collection: "debts", subject: "debt", property: "dueDate" },
  "asset.label": { collection: "assets", subject: "asset", property: "label" },
  "asset.kind": { collection: "assets", subject: "asset", property: "kind" },
  "asset.gross_value": { collection: "assets", subject: "asset", property: "grossValue" },
  "asset.secured_payoff": { collection: "assets", subject: "asset", property: "securedPayoff" },
  "asset.secured_payoff_scope": { collection: "assets", subject: "asset", property: "securedPayoffScope" },
  "asset.disposal_costs": { collection: "assets", subject: "asset", property: "disposalCosts" },
  "asset.protected_value": { collection: "assets", subject: "asset", property: "protectedValue" },
  "asset.as_of": { collection: "assets", subject: "asset", property: "asOf" },
  "asset.valuation_basis": { collection: "assets", subject: "asset", property: "valuationBasis" },
  "transaction.date": { collection: "transactions", subject: "transaction", property: "date" },
  "transaction.account_id": { collection: "transactions", subject: "transaction", property: "accountId" },
  "transaction.counterparty": { collection: "transactions", subject: "transaction", property: "counterparty" },
  "transaction.kind": { collection: "transactions", subject: "transaction", property: "kind" },
  "transaction.direction": { collection: "transactions", subject: "transaction", property: "direction" },
  "transaction.amount": { collection: "transactions", subject: "transaction", property: "amount" },
};

/**
 * Family-specific aliases are limited to source contract IDs whose definitions directly match
 * an application property. This intentionally excludes original principal, credit limits,
 * registered liens, tax totals, legal classifications, transaction nature, and inferred labels.
 */
const CONTRACT_MAPPINGS: readonly Mapping[] = [
  { familyId: "debt_certificate", localId: "creditor", collection: "debts", subject: "debt", property: "creditor", canonicalKey: "debt.creditor", roles: { party: "creditor" } },
  { familyId: "debt_certificate", localId: "contract_id", collection: "debts", subject: "debt", property: "contractId", canonicalKey: "debt.contract_id" },
  { familyId: "debt_certificate", localId: "principal_balance", collection: "debts", subject: "debt", property: "principal", canonicalKey: "debt.principal_balance", roles: { temporal: "source_as_of_date" } },
  { familyId: "debt_certificate", localId: "interest_balance", collection: "debts", subject: "debt", property: "interest", canonicalKey: "debt.interest", roles: { temporal: "source_as_of_date" } },
  { familyId: "debt_certificate", localId: "as_of_date", collection: "debts", subject: "debt", property: "asOf", canonicalKey: "debt.as_of", roles: { temporal: "balance_as_of_date" } },
  { familyId: "bank_transactions", localId: "account_id", collection: "transactions", subject: "transaction", property: "accountId", canonicalKey: "transaction.account_id" },
  { familyId: "bank_transactions", localId: "transaction_datetime", collection: "transactions", subject: "transaction", property: "date", canonicalKey: "transaction.date", roles: { temporal: "transaction_datetime" } },
  { familyId: "bank_transactions", localId: "direction", collection: "transactions", subject: "transaction", property: "direction", canonicalKey: "transaction.direction" },
  { familyId: "bank_transactions", localId: "amount", collection: "transactions", subject: "transaction", property: "amount", canonicalKey: "transaction.amount", roles: { amount: "account_holder" } },
  { familyId: "bank_transactions", localId: "counterparty", collection: "transactions", subject: "transaction", property: "counterparty", canonicalKey: "transaction.counterparty", roles: { party: "counterparty" } },
  { familyId: "cash_deposit_asset", localId: "asset_kind", collection: "assets", subject: "asset", property: "kind", canonicalKey: "asset.kind" },
  { familyId: "cash_deposit_asset", localId: "gross_value", collection: "assets", subject: "asset", property: "grossValue", canonicalKey: "asset.gross_value", roles: { temporal: "valuation_as_of_date" } },
  { familyId: "cash_deposit_asset", localId: "actual_payoff", collection: "assets", subject: "asset", property: "securedPayoff", canonicalKey: "asset.secured_payoff" },
  { familyId: "cash_deposit_asset", localId: "as_of_date", collection: "assets", subject: "asset", property: "asOf", canonicalKey: "asset.as_of", roles: { temporal: "valuation_as_of_date" } },
  { familyId: "cash_deposit_asset", localId: "valuation_basis", collection: "assets", subject: "asset", property: "valuationBasis", canonicalKey: "asset.valuation_basis" },
  { familyId: "current_nonwage_income", localId: "income.other.income_kind", collection: "incomes", subject: "income", property: "kind", canonicalKey: "income.kind", roles: { party: "applicant_debtor" } },
  { familyId: "current_nonwage_income", localId: "income.other.gross_amount", collection: "incomes", subject: "income", property: "gross", canonicalKey: "income.gross", roles: { amount: "applicant_debtor", temporal: "period_scope" } },
  { familyId: "current_nonwage_income", localId: "income.other.deductions", collection: "incomes", subject: "income", property: "expenses", canonicalKey: "income.expenses", roles: { amount: "applicant_debtor", temporal: "period_scope" } },
  { familyId: "current_nonwage_income", localId: "income.other.net_received", collection: "incomes", subject: "income", property: "net", canonicalKey: "income.net", roles: { amount: "applicant_debtor", temporal: "event_date" } },
  { familyId: "current_nonwage_income", localId: "income.other.earning_period_start", collection: "incomes", subject: "income", property: "periodStart", canonicalKey: "income.period_start", roles: { temporal: "statement_period_start" } },
  { familyId: "current_nonwage_income", localId: "income.other.earning_period_end", collection: "incomes", subject: "income", property: "periodEnd", canonicalKey: "income.period_end", roles: { temporal: "statement_period_end" } },
  { familyId: "payroll_payslip", localId: "income.payroll.employer", collection: "incomes", subject: "income", property: "employer", canonicalKey: "income.employer", roles: { party: "employer" } },
  { familyId: "payroll_payslip", localId: "income.payroll.net_pay", collection: "incomes", subject: "income", property: "net", canonicalKey: "income.net", roles: { amount: "applicant_debtor", temporal: "period_scope" } },
  { familyId: "payroll_payslip", localId: "income.payroll.pay_period_start", collection: "incomes", subject: "income", property: "periodStart", canonicalKey: "income.period_start", roles: { temporal: "statement_period_start" } },
  { familyId: "payroll_payslip", localId: "income.payroll.pay_period_end", collection: "incomes", subject: "income", property: "periodEnd", canonicalKey: "income.period_end", roles: { temporal: "statement_period_end" } },
];
const APPLICANT_MAPPINGS: Readonly<Record<string, ApplicantProperty>> = {
  "identity_residence_record::identity.name": "name",
  "identity_residence_record::identity.address": "address",
  "identity_residence_record::identity.registration_id": "residentIdMasked",
  "applicant_narrative_statement::identity.statement.narrative_text": "statement",
};
const MONEY_PROPERTIES = new Set(["gross", "expenses", "net", "principal", "interest", "grossValue", "securedPayoff", "disposalCosts", "protectedValue", "amount"]);
const TRI_VALUES = new Set(["yes", "no", "unknown"]);
const INCOME_KINDS = new Set(["wage", "business", "rent", "interest", "dividend", "pension", "benefit", "other"]);
const ASSET_KINDS = new Set(["cash", "deposit", "insurance", "vehicle", "real_estate", "lease_deposit", "business", "receivable", "retirement", "other"]);
const SECURED_PAYOFF_SCOPES = new Set(["applicant_interest", "entire_collateral", "unknown"]);
const TRANSACTION_KINDS = new Set(["income", "expense", "transfer", "debt_payment", "asset_disposal", "tax", "unknown"]);
const DIRECTIONS = new Set(["in", "out", "unknown"]);
const AMOUNT_BASES = new Set(["monthly", "period_total", "unknown"]);

export interface ReferenceProjectionCoverage {
  denominator: number;
  presenceCounts: Record<"present" | "absent" | "unknown" | "masked" | "conflict", number>;
  zeroPresentValueCount: number;
  mappedObservationCount: number;
  typedBindingCount: number;
  typedObjectRows: Record<Collection, number>;
  applicantBindingCount: number;
  unmappedCaseObservationCount: number;
  unsupportedObservationCount: number;
  untestedCandidateCount: number;
  noUnitMoneyCount: number;
  ambiguousFieldCount: number;
  byFamily: Record<string, { denominator: number; present: number; absent: number; unknown: number; masked: number; conflict: number; zeroPresent: number; candidateMappings: number; typedBindings: number; unsupported: number; untested: number; unmapped: number; ambiguous: number; moneyWithoutUnit: number }>;
  byField: Record<string, { denominator: number; present: number; absent: number; unknown: number; masked: number; conflict: number; zeroPresent: number; candidateMappings: number; typedBindings: number; unsupported: number; untested: number; unmapped: number; ambiguous: number; moneyWithoutUnit: number }>;
}

function safeString(value: Json | null): value is string { return typeof value === "string" && value.trim().length > 0; }
function matchesRole(field: ReferenceFieldObservation, mapping: Mapping): boolean {
  const metadata = field.sourceMetadata;
  if (!metadata) return !mapping.familyId;
  if (field.subjectType !== "case" && field.subjectType !== mapping.subject) return false;
  if (mapping.familyId && metadata.familyId !== mapping.familyId) return false;
  if (mapping.localId && metadata.localId !== mapping.localId) return false;
  if (mapping.roles?.party && metadata.partyRole && metadata.partyRole !== mapping.roles.party) return false;
  if (mapping.roles?.temporal && metadata.temporalRole && metadata.temporalRole !== mapping.roles.temporal) return false;
  if (mapping.roles?.amount && metadata.amountRole && metadata.amountRole !== mapping.roles.amount) return false;
  return true;
}
function mappingFor(field: ReferenceFieldObservation): Mapping | null {
  const direct = APP_FIELD_MAPPINGS[field.canonicalKey];
  if (direct) {
    const mapping: Mapping = { ...direct, canonicalKey: field.canonicalKey };
    return matchesRole(field, mapping) ? mapping : null;
  }
  const metadata = field.sourceMetadata;
  if (!metadata) return null;
  const candidate = CONTRACT_MAPPINGS.find(item => item.familyId === metadata.familyId && item.localId === metadata.localId);
  return candidate && matchesRole(field, candidate) ? candidate : null;
}
function enumOrString(value: Json | null, allowed: ReadonlySet<string>): boolean { return typeof value === "string" && allowed.has(value); }
function validMappedValue(field: ReferenceFieldObservation, mapping: Mapping): boolean {
  if (field.presenceState !== "present") return field.value === null;
  const value = field.value;
  if (MONEY_PROPERTIES.has(mapping.property)) return value !== null;
  if (["label", "employer", "payerIdentityId", "creditor", "contractId", "asOf", "dueDate", "valuationBasis", "date", "accountId", "counterparty", "periodStart", "periodEnd"].includes(mapping.property)) return safeString(value);
  if (mapping.property === "kind") return mapping.collection === "incomes" ? enumOrString(value, INCOME_KINDS) : mapping.collection === "assets" ? enumOrString(value, ASSET_KINDS) : mapping.collection === "transactions" ? enumOrString(value, TRANSACTION_KINDS) : false;
  if (["secured", "recurring"].includes(mapping.property)) return enumOrString(value, TRI_VALUES);
  if (mapping.property === "securedPayoffScope") return enumOrString(value, SECURED_PAYOFF_SCOPES);
  if (mapping.property === "amountBasis") return enumOrString(value, AMOUNT_BASES);
  if (mapping.property === "direction") return enumOrString(value, DIRECTIONS);
  if (["periodMonths", "ownershipBps"].includes(mapping.property)) return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  return false;
}
function explicitUnit(field: ReferenceFieldObservation): { unit: string; currency: string } | null {
  const sources = [field.sourceUnit, field.rawValue, field.refs.map(ref => ref.quote).join(" ")].filter((item): item is string => typeof item === "string");
  const tokens: Array<[RegExp, string, string]> = [
    [/백만원|million_won/i, "million_won", "KRW"], [/천원|thousand_won/i, "thousand_won", "KRW"], [/만원|ten_thousand_won|manwon/i, "ten_thousand_won", "KRW"], [/억원/i, "억원", "KRW"], [/(?:₩|\bKRW\b|원)/i, "KRW", "KRW"],
  ];
  for (const source of sources) for (const [pattern, unit, currency] of tokens) if (pattern.test(source)) return { unit, currency };
  return null;
}
function normalizedMoney(field: ReferenceFieldObservation): ReferenceFieldObservation["numeric"] | undefined {
  if (field.numeric) return moneyValue(field.numeric) !== null && explicitUnit(field) ? field.numeric : undefined;
  const unit = explicitUnit(field);
  const normalized = field.sourceMetadata?.normalizedValue;
  if (!unit || !field.rawValue || normalized === null || typeof normalized !== "object" || Array.isArray(normalized)) return undefined;
  const amount = normalized.amount;
  const currency = normalized.currency;
  if ((typeof amount !== "string" && typeof amount !== "number") || currency !== unit.currency) return undefined;
  const parsed = normalizeMoney(field.rawValue, unit.unit, unit.currency);
  if (parsed.normalizationStatus !== "exact" || parsed.amountWon !== String(amount)) return undefined;
  return parsed;
}
function safeGroup(field: ReferenceFieldObservation): { groupKey: string; rowIndex: number } | null {
  if (field.groupKey && Number.isSafeInteger(field.rowIndex) && field.rowIndex! >= 0) return { groupKey: field.groupKey, rowIndex: field.rowIndex! };
  const sourceRowId = field.sourceMetadata?.sourceRowId;
  if (!sourceRowId || !field.sourceMetadata?.familyId) return null;
  const sourceDocumentId = field.refs[0]?.sourceDocumentId;
  if (!sourceDocumentId) return null;
  return { groupKey: `reference-row:${sourceDocumentId}:${field.sourceMetadata.familyId}:${sourceRowId}`, rowIndex: 0 };
}
function sourceOnlyKey(field: ReferenceFieldObservation): string {
  const family = field.sourceMetadata?.familyId ?? "unknown_family";
  const local = field.sourceMetadata?.localId ?? field.rawSourceKey;
  return `reference.${family}.${local}`;
}

/** Convert only exact, contract-backed observations to typed object bindings; retain all others as case facts. */
export function projectReferenceCaseDataset(input: ReferenceTestDataset): { dataset: ReferenceTestDataset; coverage: ReferenceProjectionCoverage } {
  const dataset = structuredClone(input);
  const counters: ReferenceProjectionCoverage = {
    denominator: dataset.fields.length, presenceCounts: { present: 0, absent: 0, unknown: 0, masked: 0, conflict: 0 }, zeroPresentValueCount: 0, mappedObservationCount: 0, typedBindingCount: 0,
    typedObjectRows: { incomes: 0, debts: 0, assets: 0, transactions: 0 }, applicantBindingCount: 0,
    unmappedCaseObservationCount: 0, unsupportedObservationCount: 0, untestedCandidateCount: 0, noUnitMoneyCount: 0, ambiguousFieldCount: 0, byFamily: {}, byField: {},
  };
  const groups = new Map<string, { mapping: Mapping; field: ReferenceFieldObservation; index: number; group: { groupKey: string; rowIndex: number } }[]>();
  const candidates = new Map<number, { mapping: Mapping; group: { groupKey: string; rowIndex: number } }>();
  const applicantBindings: Partial<Record<ApplicantProperty, string>> = {};
  let householdFieldId: string | undefined;
  const statRow = () => ({ denominator: 0, present: 0, absent: 0, unknown: 0, masked: 0, conflict: 0, zeroPresent: 0, candidateMappings: 0, typedBindings: 0, unsupported: 0, untested: 0, unmapped: 0, ambiguous: 0, moneyWithoutUnit: 0 });

  dataset.fields.forEach((field, index) => {
    const family = field.sourceMetadata?.familyId ?? "unknown_family";
    const local = field.sourceMetadata?.localId ?? field.rawSourceKey;
    const fieldKey = `${family}::${local}`;
    const stats = counters.byFamily[family] ??= statRow();
    const fieldStats = counters.byField[fieldKey] ??= statRow();
    for (const target of [stats, fieldStats]) { target.denominator++; target[field.presenceState]++; }
    counters.presenceCounts[field.presenceState]++;
    const normalized = field.sourceMetadata?.normalizedValue;
    const normalizedAmount = normalized !== null && typeof normalized === "object" && !Array.isArray(normalized) ? normalized.amount : normalized;
    const zeroPresent = field.presenceState === "present" && (normalizedAmount === 0 || normalizedAmount === "0");
    if (zeroPresent) { counters.zeroPresentValueCount++; stats.zeroPresent++; fieldStats.zeroPresent++; }
    if (field.canonicalKey === "household.reported_members" && (field.subjectType === "household" || field.subjectType === "case") && field.presenceState === "present" && typeof field.value === "number" && Number.isSafeInteger(field.value) && field.value >= 0 && !householdFieldId) {
      field.subjectType = "household"; householdFieldId = field.fieldId; counters.mappedObservationCount++; stats.candidateMappings++; fieldStats.candidateMappings++; stats.typedBindings++; fieldStats.typedBindings++; return;
    }
    if (field.canonicalKey === "household.reported_members") {
      field.subjectType = "case"; field.canonicalKey = sourceOnlyKey(field); counters.unmappedCaseObservationCount++; counters.unsupportedObservationCount++; stats.unmapped++; stats.unsupported++; fieldStats.unmapped++; fieldStats.unsupported++; return;
    }
    const applicantKey = `${family}::${field.sourceMetadata?.localId ?? ""}`;
    const applicantProperty = APPLICANT_MAPPINGS[applicantKey];
    if (applicantProperty && field.subjectType === "case" && field.presenceState === "present" && safeString(field.value) && field.sourceMetadata?.partyRole === "applicant" && field.refs.length > 0) {
      const existing = applicantBindings[applicantProperty];
      if (!existing) {
        field.canonicalKey = `applicant.${applicantProperty}`;
        applicantBindings[applicantProperty] = field.fieldId;
        counters.applicantBindingCount++; counters.mappedObservationCount++; stats.candidateMappings++; fieldStats.candidateMappings++; stats.typedBindings++; fieldStats.typedBindings++;
        return;
      }
      counters.ambiguousFieldCount++; stats.ambiguous++; fieldStats.ambiguous++;
      field.canonicalKey = sourceOnlyKey(field); counters.unmappedCaseObservationCount++; counters.untestedCandidateCount++; stats.unmapped++; stats.untested++; fieldStats.untested++;
      return;
    }

    const mapping = mappingFor(field);
    if (!mapping) { field.subjectType = "case"; field.canonicalKey = sourceOnlyKey(field); counters.unmappedCaseObservationCount++; counters.unsupportedObservationCount++; stats.unmapped++; stats.unsupported++; fieldStats.unmapped++; fieldStats.unsupported++; return; }
    stats.candidateMappings++; fieldStats.candidateMappings++;
    const group = safeGroup(field);
    if (!group || !validMappedValue(field, mapping)) { field.subjectType = "case"; field.canonicalKey = sourceOnlyKey(field); counters.unmappedCaseObservationCount++; counters.untestedCandidateCount++; stats.unmapped++; stats.untested++; fieldStats.untested++; return; }
    if (MONEY_PROPERTIES.has(mapping.property) && field.presenceState === "present") {
      const numeric = normalizedMoney(field);
      if (numeric) { field.numeric = numeric; field.sourceUnit = numeric.unit; }
      else {
        delete field.numeric; stats.moneyWithoutUnit++; fieldStats.moneyWithoutUnit++; counters.noUnitMoneyCount++;
        field.subjectType = "case"; field.canonicalKey = sourceOnlyKey(field); counters.unmappedCaseObservationCount++; counters.untestedCandidateCount++; stats.unmapped++; stats.untested++; fieldStats.unmapped++; fieldStats.untested++;
        return;
      }
    }
    const key = `${mapping.collection}\u0000${group.groupKey}\u0000${group.rowIndex}`;
    const items = groups.get(key) ?? []; items.push({ mapping, field, index, group }); groups.set(key, items);
    candidates.set(index, { mapping, group });
  });

  const rows: Record<Collection, ReferenceObjectRow[]> = { incomes: [], debts: [], assets: [], transactions: [] };
  const typedIndexes = new Set<number>();
  const required: Record<Collection, string[]> = { incomes: ["label", "kind"], debts: ["creditor"], assets: ["label", "kind"], transactions: ["date", "kind", "direction"] };
  for (const [key, items] of groups) {
    const collection = items[0]!.mapping.collection;
    const propertyCounts = new Map<string, number>();
    for (const item of items) propertyCounts.set(item.mapping.property, (propertyCounts.get(item.mapping.property) ?? 0) + 1);
    for (const item of items) if (propertyCounts.get(item.mapping.property)! > 1) {
      counters.ambiguousFieldCount++; const stats = counters.byFamily[item.field.sourceMetadata?.familyId ?? "unknown_family"]!; const fieldStats = counters.byField[`${item.field.sourceMetadata?.familyId ?? "unknown_family"}::${item.field.sourceMetadata?.localId ?? item.field.rawSourceKey}`]!; stats.ambiguous++; fieldStats.ambiguous++;
    }
    const unique = items.filter(item => propertyCounts.get(item.mapping.property) === 1);
    const hasRequired = required[collection].every(property => unique.some(item => item.mapping.property === property && item.field.presenceState === "present" && item.field.value !== null));
    if (!hasRequired) {
      for (const item of items) {
        item.field.subjectType = "case"; item.field.canonicalKey = sourceOnlyKey(item.field);
        counters.unmappedCaseObservationCount++; counters.untestedCandidateCount++; counters.byFamily[item.field.sourceMetadata?.familyId ?? "unknown_family"]!.unmapped++; counters.byFamily[item.field.sourceMetadata?.familyId ?? "unknown_family"]!.untested++; counters.byField[`${item.field.sourceMetadata?.familyId ?? "unknown_family"}::${item.field.sourceMetadata?.localId ?? item.field.rawSourceKey}`]!.untested++;
      }
      continue;
    }
    const fields: Record<string, string> = {};
    for (const item of unique) {
      if (item.field.presenceState !== "present" || item.field.value !== null) {
        fields[item.mapping.property] = item.field.fieldId;
        item.field.subjectType = item.mapping.subject; item.field.groupKey = item.group.groupKey; item.field.rowIndex = item.group.rowIndex; item.field.canonicalKey = item.mapping.canonicalKey;
        typedIndexes.add(item.index); counters.mappedObservationCount++; counters.typedBindingCount++;
        const stats = counters.byFamily[item.field.sourceMetadata?.familyId ?? "unknown_family"]!; const fieldStats = counters.byField[`${item.field.sourceMetadata?.familyId ?? "unknown_family"}::${item.field.sourceMetadata?.localId ?? item.field.rawSourceKey}`]!; stats.typedBindings++; fieldStats.typedBindings++;
      }
    }
    rows[collection].push({ groupKey: items[0]!.group.groupKey, rowIndex: items[0]!.group.rowIndex, fieldBindings: fields });
    counters.typedObjectRows[collection]++;
  }
  for (const [index, candidate] of candidates) {
    if (typedIndexes.has(index)) continue;
    const field = dataset.fields[index]!; field.subjectType = "case"; field.canonicalKey = sourceOnlyKey(field);
  }
  dataset.objects = { incomes: rows.incomes, debts: rows.debts, assets: rows.assets, transactions: rows.transactions };
  if (householdFieldId) dataset.objects.household = { fieldBindings: { reportedMembers: householdFieldId } };
  if (Object.keys(applicantBindings).length) dataset.applicant = { fieldBindings: applicantBindings };
  else delete dataset.applicant;
  return { dataset, coverage: counters };
}
