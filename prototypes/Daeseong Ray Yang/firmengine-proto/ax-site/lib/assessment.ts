import { maximumCalculationMonths, referenceFormula, referenceParameter, shareBasisPoints } from "./reference-parameters.ts";
import { referenceIdentity } from "./reference-runtime.ts";
import { resolveDebtRows } from "./debt-resolution.ts";
import { resolveIncomeRows } from "./income-resolution.ts";
import { resolveAssetRows } from "./asset-resolution.ts";
import { createDebtSourceIntegrityResolver } from "./debt-source-integrity.ts";
import {auditMaterialCalculatorSources} from "./material-calculation-source-gate.ts";
import {auditBusinessSourceEvidence} from "./business-source-evidence.ts";
import {reviewedBusinessIncomeIds} from "./business-net-reconciliation.ts";
import { createCaseReadIndex, currentFacts, factHasValidStructuredRefs, factSourceLineageIssues, moneyValue, normalizeMoney } from "./domain.ts";
import type { Asset, CaseData, CaseReadIndex, IncomeSource, Money, NumericInput, RuleSet } from "./domain.ts";
import { buildLegalProposals, shortenedTermBasisFingerprint } from "./legal-proposals.ts";

const ZERO = BigInt(0);
const ONE = BigInt(1);

export interface CalculationTrace {
  id: string;
  title: string;
  formula: string;
  inputs: { label: string; value: string | null; factIds: string[] }[];
  resultWon: Money | null;
  status: "calculated" | "provisional" | "blocked";
  reasons: string[];
}
export interface Allocation {
  debtId: string;
  creditor: string;
  principalWon: Money;
  interestWon: Money;
  allocatedPrincipalWon: Money;
  allocatedInterestWon: Money;
  totalWon: Money;
  factIds: string[];
  basis: string;
  status: "provisional" | "reviewed_basis";
}
export interface CalculationResult {
  caseRevision: number;
  computedBy: "deterministic-bigint";
  incomeRows: { id: string; label: string; monthlyWon: Money | null; reasons: string[] }[];
  incomeGroups: { id: string; label: string; sourceIds: string[]; monthlyObservedAverageWon: Money | null; observedMonths: number; selectedPeriod?: { start: string; end: string }; reasons: string[] }[];
  debtRows: { id: string; creditor: string; principalWon: Money | null; interestWon: Money | null; totalWon: Money | null; classification: string }[];
  assetRows: { id: string; label: string; liquidationWon: Money | null; reasons: string[] }[];
  monthlyIncomeWon: Money | null;
  debtPrincipalWon: Money | null;
  debtInterestWon: Money | null;
  totalDebtWon: Money | null;
  securedDebtWon: Money | null;
  unsecuredDebtWon: Money | null;
  recognizedLivingCostWon: Money | null;
  disposableIncomeWon: Money | null;
  /** Budget for ordinary claims after separately modeled fees/priority/estate payments. */
  ordinaryRepaymentBudgetWon: Money | null;
  liquidationValueWon: Money | null;
  monthlyPaymentWon: Money | null;
  planTotalWon: Money | null;
  presentValueWon: Money | null;
  liquidationComparison: "met" | "not_met" | "unknown";
  allocations: Allocation[];
  traces: CalculationTrace[];
  issues: string[];
  excludedDuplicateIds: string[];
}
export interface Finding {
  id: string;
  category: "evidence" | "source_verification" | "legal_review" | "calculation" | "eligibility";
  severity: "info" | "warning" | "blocking";
  outcome: "pass" | "fail" | "unknown" | "review_required";
  title: string;
  detail: string;
  objectId?: string;
  factIds: string[];
  ruleSourceIds: string[];
  nextAction?: string;
}
export type AssessmentStatus = "requirements_met" | "needs_evidence" | "review_required" | "requirements_not_met";
export interface Assessment {
  caseRevision: number;
  status: AssessmentStatus;
  label: string;
  scope: string;
  findings: Finding[];
  calculation: CalculationResult;
  generationGate: { canGenerateDraft: boolean; canFinalize: boolean; reasons: string[] };
  quality: { currentFacts: number; sourceVerified: number; legallyAccepted: number; sourceLinked: number; note: string };
}

function floorDivide(value: bigint, denominator: bigint): bigint {
  const quotient = value / denominator;
  return value < ZERO && value % denominator !== ZERO ? quotient - ONE : quotient;
}
function ceilDivide(value: bigint, denominator: bigint): bigint {
  const quotient = value / denominator;
  return value > ZERO && value % denominator !== ZERO ? quotient + ONE : quotient;
}
function sumKnown(values: (bigint | null)[], complete: boolean): bigint | null {
  return !complete || values.some((v) => v === null) ? null : (values as bigint[]).reduce((sum, value) => sum + value, ZERO);
}
function asMoney(value: bigint | null): Money | null { return value === null ? null : value.toString(); }
function nonnegative(input: NumericInput | null | undefined): bigint | null {
  const value = moneyValue(input);
  return value !== null && value >= ZERO ? value : null;
}
function invalidLineage(data: CaseData, ids: string[],index?:CaseReadIndex): string[] {
  return factSourceLineageIssues(data, ids,index).filter((code) => ["SOURCE_FACTS_MISSING", "STALE_OR_RETRACTED_FACT", "DISPUTED_OR_REJECTED_FACT", "SOURCE_REFERENCE_INVALID"].includes(code));
}
function sourceChecked(data: CaseData, fact: { id: string; state: string; recognition?: string; validation: { severity: string }[] }): boolean {
  return fact.state === "verified" && fact.recognition === "accepted" && fact.validation.every((item) => item.severity !== "error") && factSourceLineageIssues(data, [fact.id]).length === 0;
}

export function sourceFactMoneyValue(fact: ReturnType<typeof currentFacts>[number]): bigint | null {
  const parse=(raw:unknown,unit:string,currency:string):bigint|null=>typeof raw==="string"||typeof raw==="number"?moneyValue(normalizeMoney(raw,unit,currency)):null;
  const equal=(values:(bigint|null)[])=>values.length>0&&values.every(value=>value!==null&&value===values[0])?values[0]!:null;
  const parsedValue=(value:unknown,unit:string,currency:string):bigint|null=>{
    if(typeof value==="string"||typeof value==="number")return parse(value,unit,currency);
    if(!value||typeof value!=="object"||Array.isArray(value))return null;
    const row=value as Record<string,unknown>,valueUnit=typeof row.unit==="string"?row.unit:unit,valueCurrency=typeof row.currency==="string"?row.currency:currency;
    if(typeof row.unit==="string"&&row.unit!==unit||typeof row.currency==="string"&&row.currency.toUpperCase()!==currency.toUpperCase())return null;
    const aliases:(bigint|null)[]=[];
    // Each populated representation is independently checked. A valid alias cannot hide a conflicting one.
    if(Object.hasOwn(row,"minorUnits"))aliases.push(parse(row.minorUnits,"KRW",valueCurrency));
    if(Object.hasOwn(row,"amountWon"))aliases.push(parse(row.amountWon,"KRW",valueCurrency));
    if(Object.hasOwn(row,"amount"))aliases.push(parse(row.amount,valueUnit,valueCurrency));
    if(Object.hasOwn(row,"rawValue"))aliases.push(parse(row.rawValue,valueUnit,valueCurrency));
    return equal(aliases);
  };
  if(fact.numeric){
    const numericAmount=moneyValue(fact.numeric);
    if(numericAmount===null||fact.sourceUnit!==undefined&&fact.sourceUnit!==null&&fact.sourceUnit!==fact.numeric.unit)return null;
    if(fact.rawValue!==undefined&&parse(fact.rawValue,fact.numeric.unit,fact.numeric.currency)!==numericAmount)return null;
    const valueAmount=parsedValue(fact.value,fact.numeric.unit,fact.numeric.currency);
    return valueAmount===numericAmount?numericAmount:null;
  }
  const unit=fact.sourceUnit??"KRW",currency="KRW",valueAmount=parsedValue(fact.value,unit,currency);
  if(valueAmount===null)return null;
  if(fact.rawValue!==undefined&&parse(fact.rawValue,unit,currency)!==valueAmount)return null;
  return valueAmount;
}

function sourceFactAmount(fact: ReturnType<typeof currentFacts>[number]): bigint | null { return sourceFactMoneyValue(fact); }

/** Current source amounts may constrain typed calculation inputs, but never fill missing ones. */
function objectMoneyFactConflict(data: CaseData, subjectId: string, typed: NumericInput | null | undefined, supportedKeys: string[], index?: CaseReadIndex): string[] {
  const expected = moneyValue(typed);
  if (expected === null) return [];
  const keys = new Set(supportedKeys.map(key => key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()));
  if(index&&index.owner!==data)throw new Error("source index belongs to a different case snapshot");
  const candidates=index?index.bySubject.get(subjectId)??[]:currentFacts(data).filter(fact=>fact.subjectId===subjectId);
  const facts = candidates.filter(fact => keys.has(fact.key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()));
  if (!facts.length) return [];
  const values = facts.map(sourceFactAmount);
  const invalidSource = facts.some((fact,i) => values[i] === null || factSourceLineageIssues(data,[fact.id],index).some(issue => ["STALE_OR_RETRACTED_FACT","DISPUTED_OR_REJECTED_FACT","SOURCE_REFERENCE_INVALID","SOURCE_VERIFICATION_RECEIPT_INVALID"].includes(issue)));
  return invalidSource || new Set(values.map(value => value?.toString())).size > 1 || values.some(value => value !== expected)
    ? ["OBJECT_FACT_MONEY_CONFLICT"] : [];
}

function monthIndex(value: string | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) return null;
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}
function monthSpan(start: string | undefined, end: string | undefined): { start: number; end: number; months: number; completeMonths: boolean } | null {
  const first = monthIndex(start), last = monthIndex(end);
  if (first === null || last === null || first > last) return null;
  const endDate = new Date(`${end}T00:00:00.000Z`);
  const completeMonths = new Date(`${start}T00:00:00.000Z`).getUTCDate() === 1 && endDate.getUTCDate() === new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, 0)).getUTCDate();
  return { start: first, end: last, months: last - first + 1, completeMonths };
}

export function monthlyIncome(source: IncomeSource): { value: bigint | null; reasons: string[]; formula: string } {
  const reasons: string[] = [];
  // VAT sales are a turnover observation, never a standalone net-income row.
  // Even a manually entered net/expense field cannot turn this source role
  // into a legally reviewed monthly operating-profit reconciliation.
  if(source.sourceCalculationRole==="gross_turnover_only")reasons.push("INCOME_VAT_TURNOVER_NOT_NET_INCOME");
  const gross = moneyValue(source.gross), expenses = nonnegative(source.expenses), net = moneyValue(source.net);
  let amount = net;
  let formula = referenceFormula("income_monthly");
  if (net === null) {
    if (gross !== null && expenses !== null) { amount = gross - expenses; formula = referenceFormula("income_gross_less_expenses"); }
    else reasons.push("INCOME_AMOUNT_OR_EXPENSES_MISSING");
  } else if (gross !== null && expenses !== null && gross - expenses !== net) {
    reasons.push("INCOME_NET_GROSS_EXPENSE_CONFLICT"); amount = null;
  }
  // A negative source-level "income" must not offset another source and inflate disposable
  // income. Business losses and other negative adjustments need explicit legal/accounting review.
  if (amount !== null && amount < ZERO) reasons.push("INCOME_NET_NEGATIVE_REQUIRES_REVIEW");
  const span = monthSpan(source.periodStart, source.periodEnd);
  const inferredMonths = span?.completeMonths ? span.months : null;
  // An explicit `periodMonths` does not turn a partial or malformed source
  // period into complete calendar months. Never let a payslip covering 15 days
  // enter the month-average denominator as one full observed month.
  if (source.amountBasis === "period_total" && (source.periodStart || source.periodEnd) && !span?.completeMonths)
    reasons.push("INCOME_PERIOD_NOT_COMPLETE_CALENDAR_MONTHS");
  const months = source.amountBasis === "monthly" ? 1 : source.amountBasis === "period_total" ? source.periodMonths ?? inferredMonths : null;
  if (source.amountBasis === "period_total" && source.periodMonths !== null && source.periodMonths !== undefined && inferredMonths !== null && source.periodMonths !== inferredMonths) reasons.push("INCOME_PERIOD_DENOMINATOR_CONFLICT");
  if (months === null || months === undefined || !Number.isSafeInteger(months) || months <= 0 || months > maximumCalculationMonths()) reasons.push("INCOME_PERIOD_DENOMINATOR_MISSING");
  if (source.amountBasis === "monthly" && source.periodMonths && source.periodMonths > 1 && net === null && (gross !== null || expenses !== null)) reasons.push("INCOME_PERIOD_BASIS_CONFLICT");
  return { value: amount === null || reasons.length ? null : floorDivide(amount, BigInt(months!)), reasons, formula: source.amountBasis === "period_total" && source.periodMonths == null && inferredMonths !== null ? referenceFormula("income_calendar_months") : formula };
}

// Contract identities are scoped by source-backed creditor identity.
export function liquidationContribution(asset: Asset, payoffScopeSourceLinked=false, payoffScopeReviewed=false): { value: bigint | null; reasons: string[] } {
  const shareDenominator = shareBasisPoints();
  const reasons: string[] = [];
  const gross = nonnegative(asset.grossValue), payoff = nonnegative(asset.securedPayoff), costs = nonnegative(asset.disposalCosts), protectedValue = nonnegative(asset.protectedValue);
  if ([gross, payoff, costs, protectedValue].some((v) => v === null)) reasons.push("ASSET_COMPONENTS_MISSING");
  if (!Number.isSafeInteger(asset.ownershipBps) || asset.ownershipBps! < 0 || asset.ownershipBps! > shareDenominator) reasons.push("ASSET_OWNERSHIP_MISSING");
  if(Number.isSafeInteger(asset.ownershipBps)&&asset.ownershipBps!>0&&asset.ownershipBps!<shareDenominator&&payoff!==null&&payoff>ZERO){
    if(asset.securedPayoffScope!=="applicant_interest")reasons.push("ASSET_SHARED_COLLATERAL_PAYOFF_SCOPE_UNRESOLVED");
    else if(!payoffScopeSourceLinked)reasons.push("ASSET_SHARED_COLLATERAL_PAYOFF_SCOPE_SOURCE_REQUIRED");
  }
  if (!asset.asOf) reasons.push("ASSET_VALUATION_DATE_MISSING");
  else if (monthIndex(asset.asOf) === null) reasons.push("ASSET_VALUATION_DATE_INVALID");
  if (!asset.valuationBasis?.trim()) reasons.push("ASSET_VALUATION_BASIS_MISSING");
  if (reasons.length) return { value: null, reasons };
  const owned = ceilDivide(gross! * BigInt(asset.ownershipBps!), BigInt(shareDenominator));
  const residual = owned - payoff! - costs! - protectedValue!;
  if (payoff! > owned) reasons.push("COLLATERAL_SHORTFALL_REQUIRES_CLASSIFICATION");
  if(Number.isSafeInteger(asset.ownershipBps)&&asset.ownershipBps!>0&&asset.ownershipBps!<shareDenominator&&payoff!>ZERO&&asset.securedPayoffScope==="applicant_interest"&&payoffScopeSourceLinked&&!payoffScopeReviewed)reasons.push("ASSET_SHARED_COLLATERAL_PAYOFF_SCOPE_REVIEW_REQUIRED");
  return { value: residual > ZERO ? residual : ZERO, reasons };
}

/** Exact largest-remainder allocation; total allocations always equal min(budget, claims). */
export function allocateProRata(budget: Money, weights: { id: string; amountWon: Money }[]): { id: string; amountWon: Money }[] {
  if (!/^\d+$/.test(budget) || weights.some((w) => !/^\d+$/.test(w.amountWon)) || new Set(weights.map((w) => w.id)).size !== weights.length) throw new Error("배분 예산·채권금액·고유 ID를 확인하세요.");
  const total = weights.reduce((sum, w) => sum + BigInt(w.amountWon), ZERO);
  const cap = BigInt(budget) < total ? BigInt(budget) : total;
  if (total === ZERO) return weights.map((w) => ({ id: w.id, amountWon: "0" }));
  const rows = weights.map((w) => ({ id: w.id, value: cap * BigInt(w.amountWon) / total, remainder: cap * BigInt(w.amountWon) % total }));
  let left = cap - rows.reduce((sum, row) => sum + row.value, ZERO);
  const ranked = [...rows].sort((a, b) => a.remainder === b.remainder ? a.id.localeCompare(b.id) : a.remainder > b.remainder ? -1 : 1);
  for (const row of ranked) if (left > ZERO) { row.value += ONE; left -= ONE; }
  return rows.map((r) => ({ id: r.id, amountWon: r.value.toString() }));
}

type IncomeTreatment = "series_observation" | "independent_source" | "component" | "duplicate" | "unknown";
type IncomeSourceAudit = IncomeSource & { payerIdentityId?: string; aggregationTreatment?: IncomeTreatment; aggregationReviewed?: boolean };
interface IncomeObservation { source: IncomeSourceAudit; value: bigint | null; span: ReturnType<typeof monthSpan>; periodTotalOverride?: bigint | null; }
interface IncomeGroupSummary { id: string; label: string; sourceIds: string[]; monthlyObservedAverageWon: Money | null; observedMonths: number; selectedPeriod?: { start: string; end: string }; reasons: string[]; }

function aggregateIncomeObservations(data: CaseData, input: IncomeObservation[], issues: string[]): { total: bigint | null; groups: IncomeGroupSummary[] } {
  const filing = data.context.filingPeriod;
  const selected = filing ? monthSpan(filing.start, filing.end) : null;
  if (filing && (!selected || !selected.completeMonths)) issues.push("INCOME_FILING_PERIOD_INVALID");
  const buckets = new Map<string, IncomeObservation[]>();
  const payerId = (s: IncomeSourceAudit) => s.payerIdentityId?.trim().normalize("NFKC").replace(/\s+/g, "").toLowerCase() || "";
  const employer = (s: IncomeSourceAudit) => s.employer?.trim().normalize("NFKC").replace(/\s+/g, "").toLowerCase() || "";
  for (const observation of input) {
    const identity = payerId(observation.source), name = employer(observation.source);
    const treatment = observation.source.aggregationTreatment ?? "unknown";
    if (treatment !== "unknown" && (observation.source.aggregationReviewed !== true || !observation.source.aggregationReviewReason?.trim())) {
      issues.push("INCOME_AGGREGATION_REVIEW_REQUIRED:" + observation.source.id);
    }
    if (treatment === "duplicate" && observation.source.aggregationReviewed === true && observation.source.aggregationReviewReason?.trim()) continue;
    // A payer name alone can point to a different legal entity or payroll branch.
    const key = treatment === "independent_source" && observation.source.aggregationReviewed === true && observation.source.aggregationReviewReason?.trim()
      ? `independent:${observation.source.id}`
      : identity ? `payer:${identity}:${observation.source.kind}` : name ? `name-candidate:${name}:${observation.source.kind}` : `source:${observation.source.id}`;
    buckets.set(key, [...(buckets.get(key) ?? []), observation]);
  }
  const groups: IncomeGroupSummary[] = [];
  for (const [key, original] of buckets) {
    const reasons: string[] = [];
    let rows = [...original];
    if (!rows.length) continue;
    const reviewedSameNameSeries=key.startsWith("name-candidate:")&&original.length>1&&original.every(row=>row.source.aggregationTreatment==="series_observation"&&row.source.aggregationReviewed===true&&!!row.source.aggregationReviewReason?.trim());
    const identityMissing = key.startsWith("name-candidate:") && original.length > 1 && !reviewedSameNameSeries;
    if (identityMissing) reasons.push("INCOME_PAYER_IDENTITY_REVIEW_REQUIRED");
    if (filing && !selected) reasons.push("INCOME_FILING_PERIOD_INVALID");
    if (filing && selected?.completeMonths) {
      const filtered: IncomeObservation[] = [];
      for (const row of rows) {
        if (!row.span) { reasons.push("INCOME_PERIOD_RANGE_MISSING_FOR_FILING_PERIOD"); filtered.push(row); continue; }
        if (row.span.end < selected.start || row.span.start > selected.end) continue;
        if (row.span.start < selected.start || row.span.end > selected.end) reasons.push("INCOME_FILING_WINDOW_PARTIAL_OBSERVATION");
        filtered.push(row);
      }
      rows = filtered;
    }
    if (!rows.length) {
      continue; // Entire source group falls outside the chosen period.
    }
    // A payer with no source-backed identity cannot be safely merged or silently added twice.
    const distinctSources = new Set(rows.map((row) => row.source.id));
    if (!payerId(rows[0].source) && distinctSources.size > 1 && !reviewedSameNameSeries) reasons.push("INCOME_PAYER_IDENTITY_REVIEW_REQUIRED");
    let total = ZERO, monthsTotal = 0;
    const overlaps = (a: IncomeObservation, b: IncomeObservation) => !!a.span && !!b.span && a.span.start <= b.span.end && b.span.start <= a.span.end;
    const sorted = [...rows].sort((a, b) => (a.span?.start ?? Number.MAX_SAFE_INTEGER) - (b.span?.start ?? Number.MAX_SAFE_INTEGER));
    let hasOverlap = false;
    for (let i = 0; i < sorted.length; i++) for (let j = i + 1; j < sorted.length; j++) if (overlaps(sorted[i], sorted[j])) hasOverlap = true;
    const duration = (row: IncomeObservation): number | null => row.span?.completeMonths ? row.span.months : (row.source.amountBasis === "period_total" || row.source.amountBasis === "monthly") && Number.isSafeInteger(row.source.periodMonths) && row.source.periodMonths! > 0 ? row.source.periodMonths! : row.source.amountBasis === "monthly" && !row.source.periodStart && !row.source.periodEnd ? 1 : null;
    const periodTotal = (row: IncomeObservation): bigint | null => {
      if (row.periodTotalOverride !== undefined) return row.periodTotalOverride;
      if (row.value === null) return null;
      const n = duration(row);
      if (n === null) return null;
      if (row.source.amountBasis === "monthly") return row.value * BigInt(n);
      const net = moneyValue(row.source.net), gross = moneyValue(row.source.gross), expenses = nonnegative(row.source.expenses);
      return net ?? (gross !== null && expenses !== null ? gross - expenses : null);
    };
    if (rows.some((row) => !row.span && rows.length > 1)) reasons.push("INCOME_PERIOD_RANGE_MISSING_FOR_SERIES");
    if (rows.some((row) => row.value === null)) reasons.push("INCOME_OBSERVATION_INVALID");
    let effectiveRows = rows;
    const componentReview = (row: IncomeObservation) => row.source.aggregationTreatment === "component" && row.source.aggregationReviewed === true && !!row.source.aggregationReviewReason?.trim();
    const allSameSpan = sorted.length > 1 && sorted.every((row) => row.span && row.span.start === sorted[0].span?.start && row.span.end === sorted[0].span?.end);
    const approvedComponents = hasOverlap && allSameSpan && sorted.every(componentReview);
    if (hasOverlap && !approvedComponents) reasons.push("INCOME_OVERLAPPING_OBSERVATIONS_REVIEW_REQUIRED");
    if (hasOverlap && approvedComponents) effectiveRows = [{ ...sorted[0], value: sorted.some((item) => item.value === null) ? null : sorted.reduce((sum, item) => sum + item.value!, ZERO), periodTotalOverride: sorted.some((item) => periodTotal(item) === null) ? null : sorted.reduce((sum, item) => sum + periodTotal(item)!, ZERO) }];
    if (!hasOverlap && rows.some((r) => r.source.aggregationTreatment === "component")) reasons.push("INCOME_COMPONENT_PERIOD_MISMATCH");
    const nonComputable = new Set(["INCOME_PAYER_IDENTITY_REVIEW_REQUIRED", "INCOME_FILING_PERIOD_INVALID", "INCOME_PERIOD_RANGE_MISSING_FOR_FILING_PERIOD", "INCOME_FILING_WINDOW_PARTIAL_OBSERVATION", "INCOME_PERIOD_RANGE_MISSING_FOR_SERIES", "INCOME_OBSERVATION_INVALID", "INCOME_OVERLAPPING_OBSERVATIONS_REVIEW_REQUIRED", "INCOME_COMPONENT_PERIOD_MISMATCH", "INCOME_DUPLICATE_REVIEW_REQUIRED"]);
    if (!reasons.some((reason) => nonComputable.has(reason))) {
      // Aggregate non-overlapping monthly or annual observations as a duration-weighted mean.
      for (const row of effectiveRows) {
        const n = duration(row);
        if (n === null) { reasons.push("INCOME_PERIOD_RANGE_MISSING_FOR_SERIES"); break; }
        const rawTotal = periodTotal(row);
        if (rawTotal === null) { reasons.push("INCOME_OBSERVATION_INVALID"); break; }
        // Sum original period totals before dividing once; rounded monthly displays lose remainders.
        total += rawTotal; monthsTotal += n;
      }
    }
    if (effectiveRows.some((r) => r.source.aggregationTreatment === "duplicate")) reasons.push("INCOME_DUPLICATE_REVIEW_REQUIRED");
    let average = reasons.some((reason) => nonComputable.has(reason)) || monthsTotal === 0 ? null : floorDivide(total, BigInt(monthsTotal));
    // Distinct, same-period records can be a duplicate document, bonus, or component; do not guess.
    if (hasOverlap && !approvedComponents) average = null;
    const label = rows.map((r) => r.source.employer || r.source.label).find(Boolean) || rows[0].source.label;
    const allRows = rows;
    const coveredMonths = new Set<number>();
    for (const row of allRows) if (row.span?.completeMonths) for (let month=row.span.start;month<=row.span.end;month++) coveredMonths.add(month);
    const observedMonths = allRows.every(row=>row.span?.completeMonths) ? coveredMonths.size : effectiveRows.reduce((sum,r)=>sum+(duration(r)??0),0);
    const group: IncomeGroupSummary = { id: key, label, sourceIds: allRows.map((r) => r.source.id), monthlyObservedAverageWon: asMoney(average), observedMonths, ...(filing ? { selectedPeriod: filing } : {}), reasons: [...new Set(reasons)] };
    groups.push(group);
    issues.push(...group.reasons.map((reason) => `${reason}:${group.sourceIds.join(",")}`));
  }
  if (filing && input.length > 0 && groups.length === 0) issues.push("INCOME_NO_OBSERVATION_IN_SELECTED_PERIOD");
  const total = groups.some((group) => group.monthlyObservedAverageWon === null) || (input.length > 0 && groups.length === 0) ? null : groups.reduce((sum, group) => sum + BigInt(group.monthlyObservedAverageWon!), ZERO);
  return { total, groups };
}

export function calculateCase(data: CaseData, rules: RuleSet,index:CaseReadIndex=createCaseReadIndex(data)): CalculationResult {
  const traces: CalculationTrace[] = [], issues: string[] = [], duplicateIds: string[] = [];
  // Exact source-linked financial observations that cannot be reached by the
  // case calculation objects remain explicit blockers, never silent zeros.
  const materialAudit=auditMaterialCalculatorSources(data,index);
  issues.push(...materialAudit.issues.map(issue=>issue.code+":"+issue.canonicalFieldId+":"+issue.factId));
  // Business cost and component-sales fields can be source-only even if an
  // income inventory is marked complete. They cannot establish zero income.
  const businessSourceAudit=auditBusinessSourceEvidence(data,index,{limit:1});
  if(businessSourceAudit.summary.zeroIncomeWouldBeUnsupported)
    issues.push("INCOME_BUSINESS_SOURCE_ONLY_REQUIRES_RECONCILIATION");
  // Exact source amounts omitted from typed rows must not appear as zero or partial totals.
  // The object rows remain as diagnostics, but affected case aggregates become unknown.
  const materialAggregateBlocked=(category:"income"|"debt"|"asset")=>
    materialAudit.issues.some(issue=>issue.destination.startsWith(category+"."));
  const incomeRows: CalculationResult["incomeRows"] = [];
  const incomeObservations: IncomeObservation[] = [];
  const approvedBusinessIncomeIds=reviewedBusinessIncomeIds(data,index);
  const approvedBusinessGrossFacts=new Set((data.workflowState?.businessNetReviews??[])
    .filter(review=>review.status==="approved"&&approvedBusinessIncomeIds.has(review.incomeId))
    .map(review=>review.grossFactId));
  const incomeResolution = resolveIncomeRows(data);
  duplicateIds.push(...incomeResolution.duplicates);
  issues.push(...incomeResolution.issues);
  for (const source of incomeResolution.rows) {
    // The original VAT page still has its immutable source-only IncomeSource
    // for SQL/OCR replay. Once the lawyer-reviewed derived monthly row consumes
    // that exact gross fact, it is documentary evidence, not a second income.
    if(source.sourceCalculationRole==="gross_turnover_only"&&
      source.factIds.some(id=>approvedBusinessGrossFacts.has(id)))continue;
    const monthly = monthlyIncome(source);
    const lineage = invalidLineage(data, source.factIds,index);
    const moneyConflict = [
      ...objectMoneyFactConflict(data,source.id,source.net,["income.net","income.monthly_net"],index),
      ...objectMoneyFactConflict(data,source.id,source.gross,["income.gross","income.monthly_gross","income.business_revenue"],index),
      ...objectMoneyFactConflict(data,source.id,source.expenses,["income.expenses","income.necessary_cost"],index),
    ].length > 0;
    const meta = source as IncomeSourceAudit;
    const reviewedDuplicate = meta.aggregationTreatment === "duplicate" && meta.aggregationReviewed === true && !!meta.aggregationReviewReason?.trim();
    // A prior-year income-tax certificate may duplicate already observed wages
    // or business revenues. It is comparative evidence, not automatically an
    // independent current monthly payer; only explicit human recognition or
    // reviewed duplicate treatment can use/exclude it safely.
    const historicalUnreviewed = source.sourceCalculationRole==="historical_tax_comparison" && source.recognition!=="accepted";
    const historicalPeriodUnreviewed = source.sourceCalculationRole==="historical_tax_comparison" && !historicalUnreviewed &&
      (source.aggregationReviewed!==true || !source.aggregationReviewReason?.trim() ||
       !["series_observation","independent_source"].includes(source.aggregationTreatment??"unknown"));
    // Exact VAT canonical source facts cannot turn into current net income simply
    // by modifying a typed object's label, kind or calculation role.
    const linkedVat = source.factIds.some(id=>{
      const fact=index.byId.get(id),canonical=fact?.canonicalFieldId??fact?.fieldObservation?.canonicalFieldId??"";
      return canonical.startsWith("business_sales_vat::income.sales.");
    });
    const turnoverOnly = !approvedBusinessIncomeIds.has(source.id) && (source.sourceCalculationRole==="gross_turnover_only" || linkedVat);
    const value = lineage.length || source.recognition === "rejected" || reviewedDuplicate || moneyConflict || historicalUnreviewed || historicalPeriodUnreviewed || turnoverOnly ? null : monthly.value;
    const reasons = [...monthly.reasons, ...lineage, ...(moneyConflict ? ["INCOME_OBJECT_FACT_CONFLICT"] : []), ...(source.recognition === "rejected" ? ["INCOME_RECOGNITION_REJECTED"] : []), ...(reviewedDuplicate ? ["INCOME_DUPLICATE_REVIEWED_EXCLUDED"] : []), ...(historicalUnreviewed ? ["INCOME_HISTORICAL_TAX_RECOGNITION_REQUIRED"] : []), ...(historicalPeriodUnreviewed ? ["INCOME_HISTORICAL_TAX_PERIOD_USE_REVIEW_REQUIRED"] : []), ...(turnoverOnly && !monthly.reasons.includes("INCOME_VAT_TURNOVER_NOT_NET_INCOME") ? ["INCOME_VAT_TURNOVER_NOT_NET_INCOME"] : [])];
    if (reviewedDuplicate) duplicateIds.push(source.id);
    incomeRows.push({ id: source.id, label: source.label, monthlyWon: asMoney(value), reasons });
    incomeObservations.push({ source: meta, value, span: monthSpan(source.periodStart, source.periodEnd) });
    const inferred = source.amountBasis === "period_total" && source.periodMonths == null ? monthSpan(source.periodStart, source.periodEnd)?.months : undefined;
    traces.push({ id: "income:" + source.id, title: source.label + " 소득 관측", formula: monthly.formula, inputs: [{ label: "기간 순소득", value: source.net?.amountWon ?? null, factIds: source.factIds }, { label: "총수입", value: source.gross?.amountWon ?? null, factIds: source.factIds }, { label: "필요경비", value: source.expenses?.amountWon ?? null, factIds: source.factIds }, { label: "개월수", value: source.amountBasis === "monthly" ? "1" : source.periodMonths?.toString() ?? inferred?.toString() ?? null, factIds: source.factIds }], resultWon: asMoney(value), status: value === null ? "blocked" : factSourceLineageIssues(data, source.factIds,index).length || source.recognition !== "accepted" ? "provisional" : "calculated", reasons });
    issues.push(...reasons.map((r) => r + ":" + source.id));
  }
  const incomeAggregation = aggregateIncomeObservations(data, incomeObservations, issues);
  const incomeGroups = incomeAggregation.groups;
  const hasFilingPeriod = !!data.context.filingPeriod;
  const filingPeriodValid = !data.context.filingPeriod || !!monthSpan(data.context.filingPeriod.start, data.context.filingPeriod.end)?.completeMonths;
  const periodReviewed = (data.context as CaseData["context"] & { incomePeriodReviewed?: boolean }).incomePeriodReviewed === true;
  const coverageIncomplete = incomeGroups.some((group) => group.selectedPeriod && group.observedMonths < (monthSpan(group.selectedPeriod.start, group.selectedPeriod.end)?.months ?? Number.MAX_SAFE_INTEGER));
  if (!hasFilingPeriod) issues.push("INCOME_REPRESENTATIVE_PERIOD_NOT_SELECTED");
  else if (!periodReviewed) issues.push("INCOME_REPRESENTATIVE_PERIOD_REVIEW_REQUIRED");
  if (coverageIncomplete) issues.push("INCOME_PERIOD_COVERAGE_INCOMPLETE");
  // Do not publish a partial observed average as the case-wide monthly income.
  // Per-source and per-group observed values remain available for review.
  // A selected but invalid calendar period is diagnostic-only, never a computed case-wide income.
  // Keep individual source rows for review; do not infer an approved legal income amount.
  const income = materialAggregateBlocked("income") || (hasFilingPeriod && !filingPeriodValid) || coverageIncomplete || businessSourceAudit.summary.zeroIncomeWouldBeUnsupported ? null : incomeAggregation.total;
  for (const group of incomeGroups) traces.push({ id: "income_group:" + group.id, title: group.label + " 관측기간 월평균", formula: referenceFormula("income_aggregation"), inputs: group.sourceIds.map((id) => ({ label: id + " 월평균", value: incomeRows.find((row) => row.id === id)?.monthlyWon ?? null, factIds: data.incomes.find((source) => source.id === id)?.factIds ?? [] })), resultWon: group.monthlyObservedAverageWon, status: group.monthlyObservedAverageWon === null ? "blocked" : !hasFilingPeriod || !filingPeriodValid || !periodReviewed || group.reasons.length || coverageIncomplete ? "provisional" : "calculated", reasons: [...group.reasons, ...(!hasFilingPeriod ? ["대표기간 미선택 · 관측 평균만 표시"] : []), ...(hasFilingPeriod && !filingPeriodValid ? ["선택 기간이 완전한 달력월이 아닙니다."] : []), ...(hasFilingPeriod && !periodReviewed ? ["선택한 대표기간 검토 전"] : []), ...(coverageIncomplete ? ["선택기간에 비해 관측 개월이 부족합니다."] : [])] });
  if (data.context.inventoryComplete.income !== "yes") issues.push("INCOME_INVENTORY_INCOMPLETE");
  const deduped = resolveDebtRows(data,index); issues.push(...deduped.issues); duplicateIds.push(...deduped.duplicates);
  const resolveDebtIntegrity=createDebtSourceIntegrityResolver(data,index);
  const debtRows: CalculationResult["debtRows"] = deduped.rows.map((debt, rowIndex) => {
    const sourceDebts=deduped.sourceGroups[rowIndex]??[debt];
    const sourceCalculations=sourceDebts.map(sourceDebt=>{
      const lineage=invalidLineage(data,sourceDebt.factIds,index);
      const subjectIds=[...new Set(sourceDebt.factIds.map(id=>index.byId.get(id)?.subjectId).filter((id):id is string=>!!id))];
      if(!subjectIds.length)subjectIds.push(sourceDebt.id);
      const subjectFacts=subjectIds.flatMap(id=>index.bySubject.get(id)??[]),canonical=(key:string)=>key.replace(/([a-z0-9])([A-Z])/g,"$1_$2").toLowerCase();
      const hasCurrentPrincipal=subjectFacts.some(fact=>["debt.principal_balance","debt.outstanding_principal"].includes(canonical(fact.key)));
      const principalKeys=hasCurrentPrincipal?["debt.principal_balance","debt.outstanding_principal"]:["debt.principal","creditor_principal"];
      const principalConflict=subjectIds.some(subjectId=>objectMoneyFactConflict(data,subjectId,sourceDebt.principal,principalKeys,index).length>0);
      const interestConflict=subjectIds.some(subjectId=>objectMoneyFactConflict(data,subjectId,sourceDebt.interest,["debt.interest","creditor_interest"],index).length>0);
      const sourcePrincipal=lineage.length||principalConflict?null:nonnegative(sourceDebt.principal),sourceInterest=lineage.length||interestConflict?null:nonnegative(sourceDebt.interest);
      const baseIntegrity=resolveDebtIntegrity(sourceDebt,sourcePrincipal,sourceInterest);
      const conflicts=[...(principalConflict?["DEBT_OBJECT_FACT_CONFLICT:principal"]:[]),...(interestConflict?["DEBT_OBJECT_FACT_CONFLICT:interest"]:[])];
      const integrity=conflicts.length?{...baseIntegrity,totalWon:null,blockers:[...new Set([...baseIntegrity.blockers,...conflicts])]}:baseIntegrity;
      return {lineage,principalConflict,interestConflict,integrity};
    });
    const lineage=[...new Set(sourceCalculations.flatMap(source=>source.lineage))];
    const principal = lineage.length || sourceCalculations.some(source=>source.principalConflict) ? null : nonnegative(debt.principal), interest = lineage.length || sourceCalculations.some(source=>source.interestConflict) ? null : nonnegative(debt.interest);
    const integrities=sourceCalculations.map(source=>source.integrity);
    const integrity={
      factIds:[...new Set(integrities.flatMap(source=>source.factIds))],
      totalFactIds:[...new Set(integrities.flatMap(source=>source.totalFactIds))],
      costFactIds:[...new Set(integrities.flatMap(source=>source.costFactIds))],
      totalWon:integrities.every(source=>source.totalWon!==null)&&new Set(integrities.map(source=>source.totalWon?.toString())).size===1?integrities[0]?.totalWon??null:null,
      sourceTotalWon:integrities.map(source=>source.sourceTotalWon).find(value=>value!==null)??null,
      costObservation:[...new Set(integrities.map(source=>source.costObservation).filter((value):value is string=>value!==null))].join(", ")||null,
      blockers:[...new Set(integrities.flatMap(source=>source.blockers))],
    };
    if(integrities.some(source=>source.totalWon===null)&&integrity.blockers.length===0)integrity.blockers.push("DEBT_SOURCE_ROW_IDENTITY_AMBIGUOUS");
    const total = integrity.totalWon;
    const reasons = [...lineage,...integrity.blockers];
    if (principal === null) reasons.push("DEBT_PRINCIPAL_MISSING");
    if (interest === null) reasons.push("DEBT_INTEREST_MISSING");
    if (!debt.asOf) reasons.push("DEBT_AS_OF_MISSING");
    else if (debt.asOf !== data.context.asOf) reasons.push("DEBT_AS_OF_RECONCILIATION_REQUIRED");
    issues.push(...reasons.map((r) => r + ":" + debt.id));
    const integrityFacts=integrity.factIds;
    traces.push({ id: "debt:" + debt.id, title: debt.creditor + " 채무", formula: referenceFormula("debt_total"), inputs: [{ label: "원금", value: asMoney(principal), factIds: debt.factIds }, { label: "이자", value: asMoney(interest), factIds: debt.factIds }, { label: "원문 채권 총액 관측", value: asMoney(integrity.sourceTotalWon), factIds:integrity.totalFactIds }, { label: "별도 비용 관측 (원금·이자에 합산하지 않음)", value: integrity.costObservation, factIds:integrity.costFactIds }], resultWon: asMoney(total), status: total === null ? "blocked" : factSourceLineageIssues(data, [...debt.factIds,...integrityFacts],index).length ? "provisional" : "calculated", reasons });
    return { id: debt.id, creditor: debt.creditor, principalWon: asMoney(principal), interestWon: asMoney(interest), totalWon: asMoney(total), classification: debt.classification };
  });
  const debtComplete = data.context.inventoryComplete.debt === "yes" && !deduped.issues.length
    && !materialAggregateBlocked("debt");
  if (data.context.inventoryComplete.debt !== "yes") issues.push("DEBT_INVENTORY_INCOMPLETE");
  const debtTotalComplete=debtComplete&&debtRows.every(row=>row.totalWon!==null);
  const excludedAfterReview=(debt:(typeof deduped.rows)[number])=>debt.excludedByReview&&debt.legalReview==="accepted"&&!!debt.exclusionReason?.trim();
  const includedDebtTotalComplete=debtComplete&&deduped.rows.every((debt,rowIndex)=>excludedAfterReview(debt)||debtRows[rowIndex]?.totalWon!==null);
  const principal = sumKnown(debtRows.map((r) => r.principalWon === null ? null : BigInt(r.principalWon)), debtComplete);
  const interest = sumKnown(debtRows.map((r) => r.interestWon === null ? null : BigInt(r.interestWon)), debtComplete);
  const totalDebt = !debtTotalComplete||principal === null || interest === null ? null : principal + interest;
  const capDateMatchesApplication = data.context.asOf === data.context.applicationDate;
  let capComplete = includedDebtTotalComplete && capDateMatchesApplication, secured = ZERO, unsecured = ZERO;
  if (!capDateMatchesApplication) issues.push("DEBT_CAP_APPLICATION_DATE_MISMATCH");
  for (const debt of deduped.rows) {
    const row = debtRows.find((r) => r.id === debt.id)!;
    if (debt.excludedByReview && debt.legalReview === "accepted" && debt.exclusionReason?.trim()) continue;
    const guarantee = debt.guaranteeDetails;
    const linkedUnderlying = guarantee?.underlyingDebtId ? deduped.rows.find((candidate) => candidate.id === guarantee.underlyingDebtId || candidate.contractId === guarantee.underlyingDebtId) : undefined;
    const guaranteeIncomplete = !!guarantee && (guarantee.liabilityRole === "unknown" || guarantee.claimNature === "unknown" || guarantee.claimNature === "disputed" || guarantee.recourseStatus === "unknown" || guarantee.capTreatment === "unknown" || guarantee.capTreatmentReviewed !== true || !guarantee.reviewReason?.trim());
    const underlyingExcluded = !!linkedUnderlying && linkedUnderlying.excludedByReview === true && linkedUnderlying.legalReview === "accepted" && !!linkedUnderlying.exclusionReason?.trim();
    if (guaranteeIncomplete || (linkedUnderlying && !underlyingExcluded && guarantee?.capTreatment !== "exclude")) {
      capComplete = false;
      issues.push((linkedUnderlying && !underlyingExcluded ? "GUARANTEE_OVERLAP_REQUIRES_REVIEW:" : "GUARANTEE_CAP_TREATMENT_REVIEW_REQUIRED:") + debt.id + (linkedUnderlying && !underlyingExcluded ? ":" + linkedUnderlying.id : ""));
      continue;
    }
    if (guarantee?.capTreatment === "exclude" && guarantee.capTreatmentReviewed === true && !!guarantee.reviewReason?.trim()) continue;
    if (row.totalWon === null || debt.secured === "unknown" || debt.classification === "unknown" || !debt.asOf || debt.asOf !== data.context.asOf || (["tax", "estate", "disputed", "non_dischargeable"].includes(debt.classification) && debt.legalReview !== "accepted")) { capComplete = false; continue; }
    if (debt.secured === "yes") secured += BigInt(row.totalWon); else unsecured += BigInt(row.totalWon);
  }
  if (!capComplete && capDateMatchesApplication) issues.push("DEBT_CAP_CLASSIFICATION_INCOMPLETE");
  for(const debt of deduped.rows)if((debt.priority===undefined||debt.priority==="unknown")&&!(debt.excludedByReview&&debt.legalReview==="accepted"&&debt.exclusionReason?.trim()))issues.push(`DEBT_PRIORITY_TREATMENT_REQUIRED:${debt.id}`);
  const assetResolution = resolveAssetRows(data,index);
  duplicateIds.push(...assetResolution.duplicates); issues.push(...assetResolution.issues);
  const conflictedAssets = new Set(assetResolution.conflictIds);
  const assetRows = assetResolution.rows.map((asset) => {
    const scopeKey="asset.secured_payoff_scope",scopeFact=asset.factIds.map(id=>index.byId.get(id)).find(fact=>fact?.subjectId===asset.id&&fact.key===scopeKey&&fact.value===asset.securedPayoffScope),scopeSourceLinked=!!scopeFact&&!invalidLineage(data,[scopeFact.id],index).length,scopeSourceReviewed=!!scopeFact&&scopeFact.state==="verified"&&scopeFact.recognition==="accepted";
    const contribution = liquidationContribution(asset,scopeSourceLinked,scopeSourceReviewed), lineage = invalidLineage(data, asset.factIds,index);
    const moneyConflict=[
      ...objectMoneyFactConflict(data,asset.id,asset.grossValue,["asset.gross_value","asset.grossValue"],index),
      ...objectMoneyFactConflict(data,asset.id,asset.securedPayoff,["asset.secured_payoff","asset.secured_claim_amount"],index),
      ...objectMoneyFactConflict(data,asset.id,asset.disposalCosts,["asset.disposal_costs"],index),
      ...objectMoneyFactConflict(data,asset.id,asset.protectedValue,["asset.protected_value"],index),
    ].length>0;
    const value = lineage.length || moneyConflict || asset.recognition === "rejected" || conflictedAssets.has(asset.id) ? null : contribution.value;
    const reasons = [...contribution.reasons, ...(moneyConflict?["ASSET_OBJECT_FACT_CONFLICT"]:[]), ...(monthIndex(asset.asOf) !== null && asset.asOf !== data.context.asOf ? ["ASSET_AS_OF_RECONCILIATION_REQUIRED"] : []), ...lineage, ...(asset.recognition === "rejected" ? ["ASSET_RECOGNITION_REJECTED"] : []), ...(conflictedAssets.has(asset.id) ? ["ASSET_IDENTITY_CONFLICT_REQUIRES_REVIEW"] : [])];
    issues.push(...reasons.map((r) => r + ":" + asset.id));
    const scopeReview=reasons.includes("ASSET_SHARED_COLLATERAL_PAYOFF_SCOPE_REVIEW_REQUIRED")||reasons.includes("ASSET_AS_OF_RECONCILIATION_REQUIRED");
    traces.push({ id: "asset:" + asset.id, title: asset.label + " 청산가치 검토", formula: referenceFormula("asset_liquidation"), inputs: [{ label: "평가액", value: asset.grossValue?.amountWon ?? null, factIds: asset.factIds }, { label: `소유지분 (1/${shareBasisPoints().toLocaleString("en-US")})`, value: asset.ownershipBps?.toString() ?? null, factIds: asset.factIds }, { label: "담보상환액의 귀속 범위", value: asset.securedPayoffScope ?? null, factIds: scopeFact?[scopeFact.id]:[] }, { label: "담보상환액", value: asset.securedPayoff?.amountWon ?? null, factIds: asset.factIds }, { label: "처분비용", value: asset.disposalCosts?.amountWon ?? null, factIds: asset.factIds }, { label: "검토 면제액", value: asset.protectedValue?.amountWon ?? null, factIds: asset.factIds }], resultWon: asMoney(value), status: value === null ? "blocked" : scopeReview || reasons.includes("ASSET_AS_OF_RECONCILIATION_REQUIRED") || asset.recognition !== "accepted" || factSourceLineageIssues(data, asset.factIds,index).length ? "provisional" : "calculated", reasons });
    return { id: asset.id, label: asset.label, liquidationWon: asMoney(value), reasons };
  });
  const liquidation = sumKnown(assetRows.map((a) => a.liquidationWon === null ? null : BigInt(a.liquidationWon)),
    data.context.inventoryComplete.asset === "yes" && !materialAggregateBlocked("asset"));
  if (data.context.inventoryComplete.asset !== "yes") issues.push("ASSET_INVENTORY_INCOMPLETE");
  const baseLiving = nonnegative(data.household.recognizedLivingCost);
  const extraLiving = data.household.livingCostIncludesAdditional === true ? ZERO : data.household.livingCostIncludesAdditional === false ? nonnegative(data.household.additionalLivingCost) : null;
  const householdLineage = invalidLineage(data, data.household.factIds,index);
  const living = baseLiving === null || extraLiving === null || householdLineage.length || data.household.recognition === "rejected" ? null : baseLiving + extraLiving;
  issues.push(...householdLineage.map((issue) => issue + ":household"));
  const trustee = nonnegative(data.context.monthlyTrusteeFee), priority = nonnegative(data.context.monthlyPriorityPayment), estate = nonnegative(data.context.monthlyEstatePayment);
  const disposable = income === null || living === null ? null : income - living;
  const ordinaryBudget = disposable === null || trustee === null || priority === null || estate === null ? null : disposable - trustee - priority - estate;
  if (living === null) issues.push("RECOGNIZED_LIVING_COST_MISSING");
  if (trustee === null || priority === null || estate === null) issues.push("PLAN_COST_OR_PRIORITY_PAYMENT_MISSING");
  traces.push({ id: "ordinary_budget", title: "일반채권 월 변제예산", formula: referenceFormula("ordinary_budget"), inputs: [{ label: "월평균 순소득", value: asMoney(income), factIds: data.incomes.flatMap((x) => x.factIds) }, { label: "인정 생계비", value: asMoney(living), factIds: data.household.factIds }, { label: "회생위원 보수", value: asMoney(trustee), factIds: [] }, { label: "우선채권 월 변제", value: asMoney(priority), factIds: [] }, { label: "재단채권 월 변제", value: asMoney(estate), factIds: [] }], resultWon: asMoney(ordinaryBudget), status: ordinaryBudget === null ? "blocked" : data.context.ruleApplicationReviewed === true && data.household.recognition === "accepted" && traces.filter((t) => t.id.startsWith("income:")).every((t) => t.status === "calculated") ? "calculated" : "provisional", reasons: ordinaryBudget === null ? ["필수 입력 중 일부가 확인되지 않았습니다."] : [] });
  traces.push({ id: "disposable", title: "월 가용소득", formula: referenceFormula("disposable_income"), inputs: [{label:"월평균 순소득",value:asMoney(income),factIds:data.incomes.flatMap(x=>x.factIds)},{label:"인정 생계비",value:asMoney(living),factIds:data.household.factIds}], resultWon:asMoney(disposable),status:disposable===null?"blocked":data.household.recognition==="accepted"&&traces.filter(t=>t.id.startsWith("income:")).every(t=>t.status==="calculated")?"calculated":"provisional",reasons:disposable===null?["소득 또는 생계비 입력 확인 필요"]:[] });
  const approvedPayment = nonnegative(data.context.approvedMonthlyPayment);
  const hasApprovedPayment = data.context.approvedMonthlyPayment !== undefined && data.context.approvedMonthlyPayment !== null;
  // An adopted payment is a proposal, not evidence that income, court-reviewed
  // living costs, or priority/estate fees are known. Never emit an apparently
  // finalized payment/plan amount while the ordinary budget is unresolved.
  // A proposed payment exceeding the budget remains a reviewable context input.
  const approvedExceedsBudget=approvedPayment!==null&&ordinaryBudget!==null&&approvedPayment>ordinaryBudget;
  const payment = income===null || ordinaryBudget===null || ordinaryBudget<ZERO || approvedExceedsBudget ? null
    : hasApprovedPayment ? approvedPayment : ordinaryBudget>ZERO ? ordinaryBudget : null;
  if (hasApprovedPayment && approvedPayment === null) issues.push("APPROVED_PAYMENT_INVALID");
  if (approvedExceedsBudget) issues.push("PAYMENT_EXCEEDS_DISPOSABLE_INCOME");
  const months = data.context.planMonths;
  const termValid = Number.isSafeInteger(months) && months! > 0 && months! <= maximumCalculationMonths();
  if (!termValid) issues.push("PLAN_TERM_MISSING");
  const planTotal = payment === null || !termValid ? null : payment * BigInt(months!);
  // Present value is never replaced by the undiscounted sum of installments.
  const presentValue = data.context.presentValueBasis?.trim() ? nonnegative(data.context.approvedPresentValue) : null;
  const assetDateReconciliation=issues.filter(issue=>issue.startsWith("ASSET_AS_OF_RECONCILIATION_REQUIRED:"));
  const liquidationComparison = liquidation === null || presentValue === null || assetDateReconciliation.length > 0 ? "unknown" : presentValue >= liquidation ? "met" : "not_met";
  traces.push({ id: "liquidation_comparison", title: "청산가치 보장 비교", formula: referenceFormula("liquidation_comparison"), inputs: [{ label: "현재가치", value: asMoney(presentValue), factIds: [] }, { label: "청산가치", value: asMoney(liquidation), factIds: data.assets.flatMap((a) => a.factIds) }], resultWon: presentValue === null || liquidation === null ? null : (presentValue - liquidation).toString(), status: presentValue === null || liquidation === null ? "blocked" : data.context.assetValuationBasisReviewed === true && data.context.presentValueReviewed === true && assetDateReconciliation.length === 0 ? "calculated" : "provisional", reasons: [...assetDateReconciliation, ...(presentValue === null ? ["PRESENT_VALUE_BASIS_MISSING"] : data.context.presentValueReviewed !== true ? ["PRESENT_VALUE_REVIEW_REQUIRED"] : [])] });
  const allocations: Allocation[] = [];
  const ordinary = deduped.rows.filter((d) => d.classification === "ordinary" && d.secured === "no" && d.priority === "ordinary" && !excludedAfterReview(d) && (!d.guaranteeDetails || d.guaranteeDetails.capTreatment === "include" && d.guaranteeDetails.capTreatmentReviewed === true && !!d.guaranteeDetails.reviewReason?.trim() && !(d.guaranteeDetails.underlyingDebtId && deduped.rows.some((candidate) => (candidate.id === d.guaranteeDetails!.underlyingDebtId || candidate.contractId === d.guaranteeDetails!.underlyingDebtId) && !excludedAfterReview(candidate)))));
  if (planTotal !== null && includedDebtTotalComplete && ["principal_then_interest_pro_rata", "principal_only_pro_rata"].includes(data.context.allocationBasis ?? "") && ordinary.every((d) => nonnegative(d.principal) !== null && nonnegative(d.interest) !== null && !invalidLineage(data, d.factIds,index).length)) {
    const first = allocateProRata(planTotal.toString(), ordinary.map((d) => ({ id: d.id, amountWon: nonnegative(d.principal)!.toString() })));
    const used = first.reduce((sum, a) => sum + BigInt(a.amountWon), ZERO);
    const second = data.context.allocationBasis === "principal_then_interest_pro_rata" ? allocateProRata((planTotal - used).toString(), ordinary.map((d) => ({ id: d.id, amountWon: nonnegative(d.interest)!.toString() }))) : ordinary.map((d) => ({ id: d.id, amountWon: "0" }));
    for (const debt of ordinary) {
      const p = first.find((a) => a.id === debt.id)!.amountWon, i = second.find((a) => a.id === debt.id)!.amountWon;
      allocations.push({ debtId: debt.id, creditor: debt.creditor, principalWon: nonnegative(debt.principal)!.toString(), interestWon: nonnegative(debt.interest)!.toString(), allocatedPrincipalWon: p, allocatedInterestWon: i, totalWon: (BigInt(p) + BigInt(i)).toString(), factIds: debt.factIds, basis: data.context.allocationBasis!, status: data.context.allocationBasisReviewed === true ? "reviewed_basis" : "provisional" });
    }
  }
  if (planTotal !== null && includedDebtTotalComplete && ["principal_then_interest_pro_rata", "principal_only_pro_rata"].includes(data.context.allocationBasis ?? "")) {
    const allocated = allocations.reduce((sum, row) => sum + BigInt(row.totalWon), ZERO);
    const difference = planTotal - allocated;
    if (difference !== ZERO) issues.push("ALLOCATION_BUDGET_UNRECONCILED");
    traces.push({ id: "allocation_conservation", title: "변제계획 총액과 채권별 배분 대조", formula: "명목 총변제액 − 채권별 원금·이자 배분 합계 = 0", inputs: [{ label: "명목 총변제액", value: planTotal.toString(), factIds: [] }, { label: "채권별 배분 합계", value: allocated.toString(), factIds: allocations.flatMap((a) => a.factIds) }], resultWon: difference.toString(), status: difference !== ZERO ? "blocked" : data.context.allocationBasisReviewed === true ? "calculated" : "provisional", reasons: difference !== ZERO ? ["ALLOCATION_BUDGET_UNRECONCILED"] : [] });
  }
  const separatelyTreatedClaims=deduped.rows.filter(debt=>(debt.priority==="priority"||debt.priority==="estate")&&!(debt.excludedByReview&&debt.legalReview==="accepted"&&debt.exclusionReason?.trim()));
  if(separatelyTreatedClaims.length){
    const schedule=data.context.paymentSchedule,covered=!!schedule?.reviewed&&!!schedule.reviewReason?.trim()&&schedule.expectedInstallments===months&&!!schedule.phases.length&&schedule.phases.every(phase=>separatelyTreatedClaims.every(debt=>phase.allocations.some(allocation=>allocation.creditorId===debt.id)));
    if(!covered)issues.push("PRIORITY_CLAIM_SCHEDULE_COVERAGE_REQUIRED");
  }
  if (!["principal_then_interest_pro_rata", "principal_only_pro_rata"].includes(data.context.allocationBasis ?? "") || data.context.allocationBasisReviewed !== true) issues.push("ALLOCATION_BASIS_REVIEW_REQUIRED");
  if (rules.status === "draft") issues.push("RULESET_NOT_SOURCE_VERIFIED");
  return { caseRevision: data.context.revision, computedBy: "deterministic-bigint", incomeRows, incomeGroups, debtRows, assetRows, monthlyIncomeWon: asMoney(income), debtPrincipalWon: asMoney(principal), debtInterestWon: asMoney(interest), totalDebtWon: asMoney(totalDebt), securedDebtWon: capComplete ? secured.toString() : null, unsecuredDebtWon: capComplete ? unsecured.toString() : null, recognizedLivingCostWon: asMoney(living), disposableIncomeWon: asMoney(disposable), ordinaryRepaymentBudgetWon: asMoney(ordinaryBudget), liquidationValueWon: asMoney(liquidation), monthlyPaymentWon: asMoney(payment), planTotalWon: asMoney(planTotal), presentValueWon: asMoney(presentValue), liquidationComparison, allocations, traces, issues: [...new Set(issues)], excludedDuplicateIds: duplicateIds };
}

export function assessCase(data: CaseData, rules: RuleSet,sourceIndex:CaseReadIndex=createCaseReadIndex(data)): Assessment {
  const calculation = calculateCase(data, rules,sourceIndex), findings: Finding[] = [];
  const legalProposals = buildLegalProposals(data);
  function add(id: string, category: Finding["category"], title: string, detail: string, outcome: Finding["outcome"], nextAction?: string, objectId?: string, factIds: string[] = [], sources: string[] = []) {
    findings.push({ id, category, title, detail, outcome, severity: outcome === "pass" ? "info" : category === "eligibility" && outcome === "fail" ? "blocking" : "warning", nextAction, objectId, factIds, ruleSourceIds: sources });
  }
  const rulesCurrent = rules.status !== "draft" && data.context.ruleReleaseId === rules.id && (!rules.effectiveFrom || data.context.applicationDate >= rules.effectiveFrom) && (!rules.effectiveTo || data.context.applicationDate <= rules.effectiveTo) && (!rules.courtIds || rules.courtIds.includes(data.context.courtId));
  const referenceRelease = referenceIdentity();
  const reviewedReferenceSha = (data.context as CaseData["context"] & { referenceReviewSha256?: string }).referenceReviewSha256;
  if (referenceRelease && referenceRelease.revision > 1 && reviewedReferenceSha !== referenceRelease.sha256) add("reference_release_review", "legal_review", "변경된 기준정보의 사건별 적용 검토", `기준정보 ${referenceRelease.id}의 ${referenceRelease.revision}판이 현재 사건의 검토 기록과 연결되지 않았습니다. 이전 규칙 적용 검토를 새 기준정보의 승인으로 이어받지 않습니다.`, "review_required", "변경된 기준·시행일·관할과 사건 영향을 확인하고 현재 기준정보 해시에 연결된 적용 검토를 기록하세요.");
  if (!rulesCurrent) add("rule_release", "legal_review", "적용 규칙 확인", "공식 출처·시행일·관할 또는 사건에 지정된 규칙 판본이 확인되지 않았습니다.", "review_required", "현재 신청일과 관할에 맞는 규칙을 확인하세요.");
  if (data.context.ruleApplicationReviewed !== true) add("rule_application", "legal_review", "사건별 규칙 적용 검토", "공식 원문 확인과 이 사건에 대한 적용 검토는 별개입니다.", "review_required", "예외·경과규정과 사건 적용을 검토하세요.");
  for (const [key, label] of [["income", "소득원"], ["debt", "채무"], ["asset", "재산"]] as const) if (data.context.inventoryComplete[key] !== "yes") add("inventory_" + key, "evidence", label + " 목록 완전성", "누락이 없는지 확인되지 않아 전체 합계를 확정하지 않았습니다.", "unknown", label + " 목록과 조회·진술·증빙을 대조하세요.");
  const activeFacts = currentFacts(data,sourceIndex);
  for (const fact of activeFacts) {
    const lineage = factSourceLineageIssues(data, [fact.id],sourceIndex);
    if (lineage.includes("SOURCE_REFERENCE_INVALID") || lineage.includes("SOURCE_VERIFICATION_RECEIPT_INVALID")) add("source_" + fact.id, "evidence", "원문 근거 확인", "삭제·변경된 문서, 확인할 수 없는 페이지 또는 현재 사실과 맞지 않는 교차판독을 참조합니다.", "unknown", "현재 증빙 페이지와 교차판독 영수증을 다시 확인하세요.", fact.subjectId, [fact.id]);
    else if (lineage.length) add("verification_" + fact.id, "source_verification", "추출값 원문 대조", fact.key + "의 원문 일치가 확인되지 않았습니다.", "review_required", "문서·페이지·인용과 값·단위를 대조하세요.", fact.subjectId, [fact.id]);
    if (fact.state === "disputed" || fact.recognition === "rejected") add("fact_disputed_" + fact.id, "evidence", "상충·불인정 사실 확인", fact.key + "은 상충하거나 불인정되어 현재 사용을 막았습니다.", "unknown", "현재 원문과 값 또는 불인정 사유를 검토하세요.", fact.subjectId, [fact.id]);
  }
  for (const source of data.incomes) {
    if (source.recurring !== "yes") add("recurrence_" + source.id, "legal_review", "계속적 수입 검토", source.label + "의 지속 가능성이 확인되지 않았습니다.", "review_required", "근로·영업·임대·연금 등 소득원별 지속 근거를 확인하세요.", source.id, source.factIds);
    if (source.recognition !== "accepted") add("income_recognition_" + source.id, "legal_review", "소득원 인정 검토", source.label + "의 소득 인정이 완료되지 않았거나 불인정된 상태입니다.", "review_required", "증빙의 수입과 법적으로 인정할 계속 소득을 구별해 검토하세요.", source.id, source.factIds);
  }
  for (const debt of data.debts) if (debt.legalReview === "rejected") add("debt_rejected_" + debt.id, "legal_review", "채무 분류 불인정", debt.creditor + "의 현재 분류를 인정하지 않은 상태입니다.", "review_required", "채무의 원금·이자 및 법적 분류를 다시 검토하세요.", debt.id, debt.factIds);
  for (const debt of data.debts) if (["tax", "estate", "non_dischargeable", "disputed", "unknown"].includes(debt.classification)) {
    if (debt.legalReview !== "accepted") add("debt_classification_" + debt.id, "legal_review", "특수 채무 분류", debt.creditor + "의 조세·재단채권·우선권·면책 제외 또는 다툼 여부를 구분해야 합니다.", "review_required", "원금·이자·납기·성립일·세목·담보·우선순위와 적용 조문을 대조하세요.", debt.id, debt.factIds);
  }
  for (const asset of data.assets) if (asset.recognition !== "accepted") add("asset_review_" + asset.id, "legal_review", "재산가액·면제 검토", asset.label + "의 시가·지분·담보·처분비용·면제액은 별도 인정 검토 대상입니다.", "review_required", "기준일별 시가 증빙과 적용 보호 범위를 확인하세요.", asset.id, asset.factIds);
  if (data.household.recognition !== "accepted") add("household_review", "legal_review", "가구원·생계비 인정", "신고 가구원 수를 자동으로 인정 가구원 수로 사용하지 않습니다.", "review_required", "실제 부양·소득과 추가 생계비 사유를 검토하세요.", undefined, data.household.factIds);
  if (!Number.isSafeInteger(data.household.recognizedMembers) || data.household.recognizedMembers! < 1) add("household_members", "evidence", "인정 가구원 수 확인", "인정 가구원 수가 없거나 유효한 인원수가 아닙니다.", "unknown", "신청인과 인정 부양가족의 범위를 확인하세요.", undefined, data.household.factIds);
  if (data.context.assetValuationBasisReviewed !== true) add("asset_valuation_basis", "legal_review", "청산가치 평가기준 검토", "재산가액·평가기준일·면제 범위·현재가치 비교기준의 검토가 완료되지 않았습니다.", "review_required", "현재 사건 버전의 평가기준을 검토하세요.");
  if (data.context.presentValueReviewed !== true) add("present_value_review", "legal_review", "변제액 현재가치 산식 검토", "현재가치 금액은 명목 총변제액과 별도 입력이며, 설명문만으로 할인 산식·평가기준일 검토가 완료된 것으로 보지 않습니다.", "review_required", "적용한 산식·금리·평가기준일과 입력값을 대조하고 현재가치 계산을 승인하세요.");
  for (const issue of calculation.issues) {
    const category = /MISSING|INCOMPLETE|STALE|INVALID|SOURCE_FACTS/.test(issue) ? "evidence" : /CONFLICT|EXCEEDS/.test(issue) ? "calculation" : "legal_review";
    add("calc_" + issue, category, issueTitle(issue), issueExplanation(issue), /EXCEEDS|CONFLICT/.test(issue) ? "fail" : category === "evidence" ? "unknown" : "review_required", issueAction(issue));
  }
  // Finalization must not omit a provisional/blocked calculation just because its numeric result exists.
  for (const trace of calculation.traces) if (trace.status !== "calculated") add("trace_" + trace.id, trace.status === "blocked" ? "evidence" : "legal_review", trace.title + " 산식 확정", trace.status === "blocked" ? "현재 근거로 계산을 확정할 수 없습니다." : "값은 임시 계산이며 관련 원문·인정·산식 검토가 남아 있습니다.", trace.status === "blocked" ? "unknown" : "review_required", "산식 입력과 최신 검토 상태를 확인하세요.", undefined, [...new Set(trace.inputs.flatMap((x) => x.factIds))]);
  if (rulesCurrent && rules.debtCaps) {
    if (data.context.asOf !== data.context.applicationDate) {
      add("cap_application_date", "eligibility", "신청일 기준 채무한도 대조", `신청일 ${data.context.applicationDate}과 채무 계산 기준일 ${data.context.asOf}이 달라 현재 채무한도 계산을 신청일 당시 금액으로 확인할 수 없습니다.`, "unknown", "신청일 기준 채무 자료로 맞추거나 신청일 당시 잔액을 별도 대조하세요.", undefined, [], rules.sources.map((s) => s.id));
    }
    for (const [kind, amount, cap] of [["담보", calculation.securedDebtWon, rules.debtCaps.securedWon], ["무담보", calculation.unsecuredDebtWon, rules.debtCaps.unsecuredWon]] as const) {
      const pass = amount === null ? null : rules.debtCaps.comparison === "lte" ? BigInt(amount) <= BigInt(cap) : BigInt(amount) < BigInt(cap);
      add("cap_" + kind, "eligibility", kind + " 채무한도", amount === null ? "같은 기준일의 채무금액·분류·목록 완전성을 확인해야 합니다." : `${amount}원 / 한도 ${cap}원 (${rules.debtCaps.comparison === "lte" ? "이하" : "미만"})`, pass === null ? "unknown" : pass ? "pass" : "fail", pass === false ? "채무 포함·제외와 기준일을 검토하고 다른 절차를 검토하세요." : undefined, undefined, [], rules.sources.map((s) => s.id));
    }
  }
  if (rulesCurrent && rules.term && data.context.planMonths) {
    const months = data.context.planMonths;
    const exceptionalMax = rules.term.exceptionalMaxMonths;
    const exceedsHardCap = exceptionalMax !== undefined && months > exceptionalMax;
    const withinOrdinary = months <= rules.term.ordinaryMonths;
    const withinExceptional = exceptionalMax !== undefined && months <= exceptionalMax;
    const outcome: Finding["outcome"] = exceedsHardCap ? "fail"
      : withinOrdinary ? "pass"
      : !withinExceptional ? "review_required"
      : data.context.exceptionalTermReviewed === true ? "pass" : "review_required";
    const detail = `${months}개월 / 원칙 범위 ${rules.term.ordinaryMonths}개월, 특별사정 검토 시 최대 ${exceptionalMax ?? "미확인"}개월`;
    add("plan_term", "eligibility", "변제기간 검토", detail, outcome,
      outcome === "fail" ? "현재 규칙의 최대 변제기간을 초과합니다. 기간을 조정하고 적용 규칙을 확인하세요."
        : outcome === "review_required" ? "원칙기간 초과에 필요한 특별사정 검토와 법원 판단을 확인하세요." : undefined);
    if (data.context.courtId === referenceParameter<string>("param.seoul.shortened_term.court_id") && data.context.applicationDate >= referenceParameter<string>("param.seoul.shortened_term.effective_from") && months < rules.term.ordinaryMonths) {
      const candidate = legalProposals.termCandidate;
      const review = data.context.shortenedTermReview;
      const fingerprint = shortenedTermBasisFingerprint(data);
      const reviewMatches = !!review && review.months === months && review.ruleReleaseId === rules.id && review.basisFingerprint === fingerprint && !!review.reason.trim();
      const candidatePass = candidate.status === "candidate_for_human_review";
      const detail = `${months}개월 단축기간은 서울회생법원 준칙 제424호의 후보요건과 사건별 검토가 필요합니다. 후보 상태: ${candidate.status}.`;
      const outcome: Finding["outcome"] = candidatePass && reviewMatches ? "pass" : candidate.status === "unknown" || candidate.status === "unsupported_version" ? "unknown" : "review_required";
      add("seoul_424_shortened_term", "eligibility", "서울회생법원 단축기간 후보와 사건별 검토", detail, outcome, outcome === "pass" ? undefined : "근거가 확인된 준칙상 후보 경로를 검토하고, 현재 기간·규칙판본·근거에 연결된 사건별 검토 이유를 기록하세요.", undefined, [...new Set(candidate.conditions.flatMap((condition) => condition.factIds))], ["seoul-practice-2026"]);
    }
  }
  if (legalProposals.objection.value === "unknown") {
    add("objection_status", "eligibility", "이의 여부 확인", "채권자와 회생위원의 이의 여부가 각각 확인된 source-verified·legally-accepted 사실로 확정되지 않았습니다.", "unknown", "두 이의 여부를 각각 확인하고 근거를 검토하세요.", undefined, legalProposals.objection.factIds);
  } else if (legalProposals.objection.value === "yes") {
    const minimum = legalProposals.objectionMinimum;
    const minimumOutcome: Finding["outcome"] = minimum.status === "comparison" ? minimum.comparison === "meets_minimum" ? "pass" : "fail" : "unknown";
    add("objection_minimum", "eligibility", "이의 사건 최소변제액", minimum.reason, minimumOutcome, minimumOutcome === "pass" ? undefined : "인가결정일 기준 채권 총액·계획 변제 현재가치와 적용 판본을 확인하세요.", undefined, minimum.status === "comparison" ? minimum.sourceFactIds : legalProposals.objection.factIds, [minimum.sourceUrl]);
    add("objection_individual_liquidation", "eligibility", "이의 채권자별 청산배당 비교", "현재 자료 모델은 전체 청산가치 비교만 계산하며, 이의 제기 채권자의 개별 청산배당액 비교를 증명하지 않습니다.", "unknown", "이의 채권자별 신고채권액과 파산 배당예정액을 개별 대조하는 구조화된 검토가 필요합니다.", undefined, legalProposals.objection.factIds);
    const incomeDuringTerm = currentFacts(data).filter((fact) => fact.key === "plan.disposableIncomeDuringTerm");
    const committed = currentFacts(data).filter((fact) => fact.key === "plan.amountCommitted");
    const reviewedAmount = (rows: typeof incomeDuringTerm) => rows.length === 1 && sourceChecked(data, rows[0]) && rows[0].numeric ? moneyValue(rows[0].numeric) : null;
    const incomeTotal = reviewedAmount(incomeDuringTerm), committedTotal = reviewedAmount(committed);
    const allIncomeOutcome: Finding["outcome"] = incomeTotal === null || committedTotal === null ? "unknown" : committedTotal >= incomeTotal ? "pass" : "fail";
    add("objection_all_disposable_income", "eligibility", "이의 사건 가용소득 전부 제공", incomeTotal === null || committedTotal === null ? "변제기간 전체 가용소득과 계획 투입액의 별도 source-verified·legally-accepted 집계가 확인되지 않았습니다." : `변제기간 전체 가용소득 ${incomeTotal}원과 계획 투입액 ${committedTotal}원을 대조했습니다.`, allIncomeOutcome, allIncomeOutcome === "pass" ? undefined : "변제기간 전체 기준의 가용소득 및 계획 투입 총액을 각각 확인하고 대조하세요.", undefined, [...incomeDuringTerm, ...committed].map((fact) => fact.id), rules.sources.map((s) => s.id));
  }
  if (calculation.ordinaryRepaymentBudgetWon !== null && BigInt(calculation.ordinaryRepaymentBudgetWon) <= ZERO) add("disposable_nonpositive", "eligibility", "일반채권 변제예산 부족", "현재 입력에서 비용·우선/재단채권 변제 후 예산이 0원 이하입니다.", "fail", "계속 수입·생계비·우선채권 변제를 재검토하고 다른 절차의 적합성을 검토하세요.");
  add("liquidation", "eligibility", "청산가치 보장", calculation.liquidationComparison === "unknown" ? "현재가치 근거 또는 재산가액이 미확정입니다." : "변제액의 검토 현재가치와 청산가치를 대조했습니다.", calculation.liquidationComparison === "met" ? "pass" : calculation.liquidationComparison === "not_met" ? "fail" : "unknown", calculation.liquidationComparison === "met" ? undefined : "현재가치 산식·평가기준일·담보부족액·면제재산을 검토하세요.");
  for (const [key, title] of [["naturalPerson", "자연인 요건"], ["insolventOrRisk", "지급불능 또는 우려"], ["priorProceedingsReviewed", "과거 절차·면책 이력"]] as const) {
    const value = data.context.eligibility?.[key];
    if (key !== "priorProceedingsReviewed" && value === "no") {
      add("eligibility_" + key, "eligibility", title, "입력된 조건부 값이 ‘아니오’입니다. 이는 사전요건 미충족 표시이며 법원의 결정을 뜻하지 않습니다.", "fail", "조건부 입력과 적용 요건을 확인하고, 값이 잘못된 경우 근거를 검토해 정정하세요.");
    } else if (value !== "yes") {
      add("eligibility_" + key, "legal_review", title, "이 요건의 사건별 확인이 남아 있습니다.", "review_required", "관련 진술·조회·결정문을 확인하세요.");
    }
  }
  const failures = findings.filter((f) => f.outcome === "fail" && f.category === "eligibility");
  const missing = findings.some((f) => f.outcome === "unknown");
  const reviews = findings.some((f) => f.outcome === "review_required" || f.outcome === "fail");
  const status: AssessmentStatus = failures.length ? "requirements_not_met" : missing ? "needs_evidence" : reviews ? "review_required" : "requirements_met";
  const label = { requirements_met: "검증한 사전요건 충족", needs_evidence: "자료 보완 필요", review_required: "인정·법리 검토 필요", requirements_not_met: "현재 입력 기준 사전요건 미충족" }[status];
  const reasons = findings.filter((f) => f.outcome !== "pass").map((f) => f.title + ": " + f.detail);
  const structuredDraftSource = data.structuredTest?.mode === "assumed_extracted_synthetic" && activeFacts.some(fact => factHasValidStructuredRefs(data, fact));
  return { caseRevision: data.context.revision, status, label, scope: "구현된 사전요건과 산식의 점검 결과입니다. 법원의 개시·인가·면책 판단이나 인가확률을 산출하지 않습니다.", findings, calculation, generationGate: { canGenerateDraft: (data.documents.some((d) => d.status === "active") || structuredDraftSource) && activeFacts.length > 0, canFinalize: status === "requirements_met" && !structuredDraftSource && !data.structuredTest, reasons: structuredDraftSource ? [...reasons, "가정 추출 합성자료는 초안 검토에만 사용할 수 있으며 제출본을 확정할 수 없습니다."] : reasons }, quality: { currentFacts: activeFacts.length, sourceVerified: activeFacts.filter((f) => f.state === "verified" && !factSourceLineageIssues(data,[f.id],sourceIndex).length).length, legallyAccepted: activeFacts.filter((f) => f.state === "verified" && f.recognition === "accepted").length, sourceLinked: activeFacts.filter((f) => !factSourceLineageIssues(data, [f.id],sourceIndex).includes("SOURCE_REFERENCE_INVALID")).length, note: "완료 건수이며 추출 정확도·법률 정확도·인가확률이 아닙니다. 99% 목표는 별도 정답셋 독립검증이 필요합니다." } };
}

function issueTitle(code: string): string {
  if (code.startsWith("DEBT_PRIORITY_TREATMENT_REQUIRED:")) return "채권별 우선·재단 처리 분류";
  if (code.startsWith("CALC_INPUT_MULTIPLE_TYPED_MATCHES:")) return "동일 OCR 원문 금액의 복수 계산행 중복 연결";
  if (code.startsWith("DEBT_SOURCE_TOTAL")) return "채권 원문 총액과 원금·이자 대조";
  if (code.startsWith("DEBT_SEPARATE_COST")) return "별도 채권 비용 확인";
  if (code.startsWith("DEBT_SOURCE_ROW_IDENTITY")) return "채무 원문 행 연결 확인";
  if (code.includes("ASSET_AS_OF_RECONCILIATION")) return "재산 평가 기준일 대조";
  if (code.includes("ASSET_VALUATION_DATE_MISSING")) return "재산 평가 기준일 입력";
  if (code.includes("ASSET_VALUATION_DATE_INVALID")) return "재산 평가 기준일 확인";
  if (code === "PRIORITY_CLAIM_SCHEDULE_COVERAGE_REQUIRED") return "채권별 우선·재단 변제 일정 확인";
  if (code.includes("INCOME_BUSINESS_SOURCE_ONLY")) return "사업 매출·비용 원문을 현재 순소득으로 대조";
  if (code.includes("INCOME_VAT_TURNOVER")) return "사업 매출·순소득 구분 및 월별 경비 대조";
  if (code.includes("INCOME_HISTORICAL_TAX_PERIOD_USE")) return "과거 신고소득의 현재 대표기간 적용 검토";
  if (code.includes("INCOME_PAYER_IDENTITY")) return "소득 지급자 식별 확인";
  if (code.includes("INCOME_OVERLAPPING") || code.includes("INCOME_COMPONENT") || code.includes("INCOME_DUPLICATE")) return "같은 기간 소득 관측 중복·구성 확인";
  if (code.includes("INCOME_REPRESENTATIVE_PERIOD") || code.includes("INCOME_FILING_PERIOD")) return "소득 대표기간 선택·검토";
  if (code.includes("INCOME_PERIOD_COVERAGE")) return "소득 기간 증빙 범위 확인";
  if (code.includes("INCOME_NO_OBSERVATION_IN_SELECTED_PERIOD")) return "선택기간 소득 관측 확인";
  if (code.includes("INCOME_PERIOD_RANGE")) return "소득 관측기간 확인";
  if (code.includes("APPROVED_PAYMENT_INVALID")) return "제안 월 변제액 확인";
  if (code.includes("GUARANTEE")) return "보증·연대·중복 채무 범위 검토";
  if (code.includes("INCOME_NET_NEGATIVE")) return "음수 순소득 검토";
  if (code.includes("INCOME_PERIOD")) return "소득 산정기간 확인";
  if (code.includes("CONTRACT_CONFLICT")) return "동일 계약 채무금액 충돌";
  if (code.includes("DEBT_PRINCIPAL")) return "채권 원금 확인";
  if (code.includes("DEBT_INTEREST")) return "채권 이자 확인";
  if (code.includes("AS_OF")) return "채무 산정기준일 대조";
  if (code.includes("INCOME")) return "소득 집계 확인";
  if (code.includes("ASSET") || code.includes("COLLATERAL")) return "재산 평가·담보 대조";
  if (code.includes("LIVING")) return "인정 생계비 확인";
  if (code.includes("STALE") || code.includes("SOURCE")) return "최신 원문 근거 연결";
  if (code.includes("ALLOCATION")) return "채권별 배분 기준 검토";
  if (code.includes("TERM")) return "변제기간 확인";
  if (code.includes("PAYMENT")) return "변제액·비용 대조";
  if (code.includes("RULESET")) return "공식 규칙 판본 확인";
  return "입력·산식 대조";
}
function issueExplanation(code: string): string {
  if(code.includes("INCOME_BUSINESS_SOURCE_ONLY"))return "사업 매출·경비·입금·원천공제 등 원문 수치가 관측되었으나 현재 소득 계산행의 독립적인 순소득 근거가 확인되지 않았습니다. 현재 소득이 0원이라고 단정하지 않습니다.";
  if(code.includes("INCOME_VAT_TURNOVER"))return "부가가치세 관련 매출금액은 사업 순소득이 아닙니다. 다른 서류의 필요경비·입금·환급과 같은 사업자·월·원문 행을 대조하고 이중 집계 여부를 검토해야 합니다.";
  if(code.includes("INCOME_HISTORICAL_TAX_PERIOD_USE"))return "과거 소득금액증명은 현재 계속 소득과 기간이 다를 수 있어 인정 여부뿐 아니라 현재 대표기간에 사용할 방법 및 중복 여부의 명시적 검토가 필요합니다.";
  if (code.startsWith("CALC_INPUT_MULTIPLE_TYPED_MATCHES:")) return "하나의 원문 금액 피처를 둘 이상의 계산 객체에 동일하게 연결했습니다. 두 행이 별개 소득·채무·재산이라는 원문 근거와 배분 기준 없이 중복 합산할 수 없습니다.";
  if(code.includes("DEBT_SOURCE_TOTAL_CONFLICT"))return "같은 채무 원문 행의 별도 총액이 계산한 원금+이자와 다릅니다. 비용이나 미분류 금액을 원금·이자에 자동 섞지 않고 행 총액·구성 근거를 대조합니다.";
  if(code.includes("DEBT_SOURCE_TOTAL_INVALID"))return "같은 행에 총액 필드가 있으나 단위·값·인용·검증 상태가 유효하지 않거나 상충합니다. 해당 슬롯을 누락으로 취급하지 않고 총액 계산을 보류합니다.";
  if(code.includes("DEBT_SOURCE_TOTAL_RECONCILIATION_UNAVAILABLE"))return "원문 총액은 관측되었지만 원금이나 이자가 계산 가능하지 않아 원문 합계와 대조할 수 없습니다.";
  if(code.includes("DEBT_SEPARATE_COST_REQUIRES_REVIEW"))return "같은 원문 행에 별도 비용이 있습니다. 비용을 원금이나 이자에 더하지 않았으며 채권 총액·법적 분류를 검토하기 전 행 총액·한도·배분을 보류합니다.";
  if(code.includes("DEBT_SEPARATE_COST_INVALID"))return "같은 행에 별도 비용 슬롯이 있으나 금액·단위·원문 연결·검증 상태가 유효하지 않거나 상충합니다. 미기재 또는 0원으로 취급하지 않습니다.";
  if(code.includes("DEBT_SOURCE_ROW_IDENTITY"))return "원금·이자에 연결된 원문 행의 신원을 확정하지 못해 다른 행이나 페이지의 총액·비용을 조합하지 않았습니다.";
  if(code.includes("DEBT_PRIORITY_TREATMENT_REQUIRED"))return "채무의 원금·이자·담보 구분과 별도로, 이 채권을 일반·우선·재단 처리 중 어디에 둘지 사건별 분류가 확인되지 않았습니다. 우선 여부는 한도 합계 계산과 일반채권 배분에서 다르게 사용됩니다.";
  if(code.includes("ASSET_SHARED_COLLATERAL_PAYOFF_SCOPE_REVIEW_REQUIRED"))return "공동소유 담보의 신청인 지분 귀속액을 원문으로 연결해 계산했지만, 해당 귀속 범위는 사건별 검토가 필요한 입력입니다.";
  if(code.includes("ASSET_SHARED_COLLATERAL_PAYOFF_SCOPE_UNRESOLVED"))return "공동소유 재산의 담보상환액이 신청인 지분 몫인지 전체 담보물 잔액인지 확인되지 않아 청산기여액을 계산하지 않았습니다. 전체 담보물 잔액을 소유지분으로 자동 안분하지 않습니다.";
  if(code.includes("ASSET_SHARED_COLLATERAL_PAYOFF_SCOPE_SOURCE_REQUIRED"))return "신청인 지분 귀속 담보상환액이라는 입력은 있으나 현재 원문에 연결된 귀속 범위 사실이 없어 계산을 보류했습니다.";
  if (code.includes("INCOME_PAYER_IDENTITY")) return "같은 지급자명만으로는 동일 법인·급여원인지 확정할 수 없어 관측을 합산하거나 평균하지 않았습니다.";
  if (code.includes("INCOME_OVERLAPPING") || code.includes("INCOME_COMPONENT")) return "같은 지급자의 같은 기간 소득이 중복 증빙·보너스·구성항목 중 무엇인지 확인되지 않아 임의로 중복 제거하거나 합산하지 않았습니다.";
  if (code.includes("INCOME_DUPLICATE")) return "중복으로 표시한 소득 관측에 명시적 검토 기록이 없어 제외하지 않았습니다.";
  if (code.includes("INCOME_REPRESENTATIVE_PERIOD_NOT_SELECTED")) return "기준기간을 선택하지 않아 증빙 관측의 기간가중 평균만 제시합니다. 이 값은 법적 대표기간으로 검토되지 않았습니다.";
  if (code.includes("INCOME_REPRESENTATIVE_PERIOD_REVIEW_REQUIRED")) return "대표기간이 입력되었지만 사건의 소득 대표기간으로 검토 완료되지 않았습니다.";
  if (code.includes("INCOME_PERIOD_COVERAGE")) return "선택한 대표기간 전체에 비해 근거가 있는 관측 개월이 부족합니다. 관측 평균은 보이되 대표값 확정은 보류합니다.";
  if (code.includes("INCOME_NO_OBSERVATION_IN_SELECTED_PERIOD")) return "해당 지급자의 증빙 관측이 선택한 대표기간과 겹치지 않아 과거 금액을 현재기간 소득으로 옮기지 않았습니다.";
  if (code.includes("INCOME_FILING_WINDOW_PARTIAL")) return "대표기간과 소득 관측기간이 일부만 겹쳐 해당 월에 어느 금액을 반영할지 일할 추정하지 않았습니다.";
  if (code.includes("INCOME_PERIOD_RANGE")) return "같은 지급자의 여러 금액이 서로 다른 기간인지 확인할 시작일·종료일이 없습니다.";
  if (code.includes("APPROVED_PAYMENT_INVALID")) return "제안 월 변제액이 누락·음수·정규화 오류 상태입니다. 자동 계산액으로 대체하지 않았습니다.";
  if (code.includes("GUARANTEE_OVERLAP")) return "주채무와 보증·구상 채무의 연결을 확인했지만, 두 금액의 한도 산입 관계가 검토되지 않아 중복 합산을 보류했습니다.";
  if (code.includes("GUARANTEE")) return "보증·연대·조건부 채권은 채무 역할, 발생 성격, 주채무, 대위·구상 상태와 한도 산입 여부를 명시적으로 검토하기 전 채무한도 합계에 넣지 않았습니다.";
  if (code.includes("INCOME_NET_NEGATIVE")) return "소득원 하나의 음수 순액을 다른 소득에서 자동 차감하지 않았습니다. 손실의 성격·기간·상계 가능성을 확인해야 합니다.";
  if (code.includes("DENOMINATOR")) return "기간 합계의 개월수가 없어 월평균을 계산하지 않았습니다.";
  if (code.includes("CONTRACT_CONFLICT")) return "동일 계약에서 원금·이자·기준일 또는 채권자 정보가 충돌해 중복 합산을 보류했습니다.";
  if (code.includes("INTEREST_MISSING")) return "이자 미기재를 0원으로 바꾸지 않았습니다. 원금과 이자를 각각 확인해야 합니다.";
  if (code.includes("STALE_OR_RETRACTED")) return "객체가 최신 사실 버전이 아닌 과거 또는 철회된 사실을 참조합니다.";
  if (code.includes("ASSET_AS_OF_RECONCILIATION")) return "재산 평가 기준일과 사건 산정기준일이 달라 현재 평가액의 적용 여부를 대조해야 합니다.";
  if (code.includes("ASSET_VALUATION_DATE_MISSING")) return "재산 평가 기준일이 없어 평가액을 사건 기준과 대조할 수 없습니다.";
  if (code.includes("ASSET_VALUATION_DATE_INVALID")) return "재산 평가 기준일이 실제 날짜가 아니어서 평가액을 계산할 수 없습니다.";
  if (code.includes("AS_OF_RECONCILIATION")) return "채권 증빙의 금액 기준일과 사건 산정기준일이 달라 대조가 필요합니다.";
  if (code.includes("ALLOCATION_BUDGET_UNRECONCILED")) return "계획의 명목 총변제액과 채권별 배분 합계가 다릅니다. 월액·기간·완제 시점 또는 별도 변제 대상을 조정·검토해야 합니다.";
  if (code.includes("ALLOCATION")) return "일반채권 원금·이자 배분 가정이 승인되지 않았습니다. 조세·재단채권·담보부족액을 자동 혼합하지 않습니다.";
  if (code.includes("EXCEEDS")) return "제안 월 변제액이 현재 계산된 월 가용소득을 초과합니다.";
  return "미확인 값·분류·목록 완전성을 0 또는 비해당으로 대체하지 않았습니다. 확인 항목: " + code.split(":")[0];
}
function issueAction(code: string): string {
  if(code.includes("INCOME_BUSINESS_SOURCE_ONLY"))return "business_source_audit·business_monthly_workbench·business_identity_crosswalk에서 원문 행·사업자·기간·금액과 미연결 항목을 확인하세요. 동일사업자 관계 및 필요경비/VAT 법적 처리를 검토·승인하기 전 순소득·서식에 합산하지 마세요.";
  if(code.includes("INCOME_VAT_TURNOVER"))return "매출·환불·부가세·필요경비를 동일 사업자·발생월·원문 근거로 묶은 별도 순소득 검토안을 생성하고 담당자 승인을 받으세요. VAT 매출 행에 임의의 순소득을 덧씌우지 마세요.";
  if(code.includes("INCOME_HISTORICAL_TAX_PERIOD_USE"))return "동일 사업자의 신고 소득과 최신 월별 매출·비용을 비교하고 대표기간, 중복 제거, 채택 이유를 명시적으로 검토하세요.";
  if (code.startsWith("CALC_INPUT_MULTIPLE_TYPED_MATCHES:")) return "연결된 각 계산행의 문서 ID·페이지·원문 행·계약 또는 자산 식별자를 대조하고, 동일 행 복제는 제거하거나 별도 금액 배분을 문서 근거와 담당자 검토로 등록하세요.";
  if(code.includes("DEBT_SOURCE_TOTAL"))return "같은 원문 행의 현재 원금, 이자, 채권 총액, 별도 비용과 각각의 단위·기준일을 대조하고, 총액 근거를 확인하세요. 비용을 원금·이자로 재분류하지 마세요.";
  if(code.includes("DEBT_SEPARATE_COST"))return "별도 법률·추심·집행·기타 비용의 현재성·단위·채권자 청구와 원문 포함 범위를 검토하고, 채무 구성·분류를 별도로 결정하세요.";
  if(code.includes("DEBT_SOURCE_ROW_IDENTITY"))return "같은 증명서 행의 원금·이자·총액·비용을 현재 source row로 연결하거나, 연결이 불가능하면 수동 검토를 기록하세요.";
  if(code.includes("ASSET_AS_OF_RECONCILIATION"))return "재산 평가 기준일과 사건 산정기준일을 대조하고, 현재 사건 기준으로 적용 가능한 평가 자료를 확인하세요.";
  if(code.includes("ASSET_VALUATION_DATE_MISSING"))return "원문에서 재산 평가 기준일을 확인해 입력하세요.";
  if(code.includes("ASSET_VALUATION_DATE_INVALID"))return "원문에서 재산 평가 기준일을 확인하고 실제 날짜로 수정하세요.";
  if(code.includes("DEBT_PRIORITY_TREATMENT_REQUIRED"))return "별도 채무 CRUD에서 이 채권의 우선·재단 처리 항목을 원문과 사건별 검토에 따라 선택하고, 변경 사유를 남기세요.";
  if(code.includes("ASSET_SHARED_COLLATERAL_PAYOFF_SCOPE_REVIEW_REQUIRED"))return "담보잔액의 범위와 지분 귀속 근거를 원문에 대조하고 사건별 청산가치 반영을 검토하세요.";
  if(code.includes("ASSET_SHARED_COLLATERAL_PAYOFF_SCOPE"))return "최신 담보잔액 증빙에서 전체 담보물 잔액과 신청인 지분 귀속액을 구분해 연결하거나, 범위가 명시된 신청인 지분 귀속액을 원문 인용과 함께 별도 기록하세요. 원문에 귀속 범위가 없으면 값을 추정하지 마세요.";
  if (code.includes("INCOME_PAYER_IDENTITY")) return "급여명세서·원천징수영수증의 사업자등록번호 등 원문 지급자 식별자를 연결하고, 실제 독립 소득원인지 확인하세요.";
  if (code.includes("INCOME_OVERLAPPING") || code.includes("INCOME_COMPONENT") || code.includes("INCOME_DUPLICATE")) return "같은 기간 자료가 중복인지, 별도 보너스·급여 구성인지 원문으로 대조하고 소득원 처리와 검토 사유를 명시하세요.";
  if (code.includes("INCOME_REPRESENTATIVE_PERIOD")) return "사건에 사용할 소득 기준 시작일·종료일을 선택하고 해당 기간이 대표적인지 검토 기록하세요.";
  if (code.includes("INCOME_PERIOD_COVERAGE")) return "선택 기간의 부족한 월별 급여·사업 자료를 보완하거나 관측범위가 제한된 이유를 기록하세요.";
  if (code.includes("INCOME_NO_OBSERVATION_IN_SELECTED_PERIOD")) return "선택기간 안의 자료를 보완하거나 그 소득원이 해당 기간에 종료·중단된 사실을 확인하세요.";
  if (code.includes("INCOME_PERIOD_RANGE")) return "원문에 표시된 정확한 소득 발생 시작일·종료일을 입력하세요.";
  if (code.includes("APPROVED_PAYMENT_INVALID")) return "변제계획에 기재할 월액을 원문·단위와 대조해 유효한 0원 이상 금액으로 다시 입력하세요.";
  if (code.includes("GUARANTEE")) return "주채무 계약·채권자 청구·보증 범위·대위변제 여부를 원문으로 연결하고 한도 산입 여부 및 사유를 검토 기록하세요.";
  if (code.includes("INCOME_NET_NEGATIVE")) return "해당 기간 매출·필요경비·일회성 손실을 대조하고, 법률·회계 검토 후 정정된 인정 순소득을 입력하세요.";
  if (code.includes("DENOMINATOR")) return "증빙에 대응하는 시작일·종료일 및 명시적 개월수를 입력하세요.";
  if (code.includes("CONFLICT")) return "계약 ID·채권자·기준일·최종 채무증명서를 대조해 채택할 값을 결정하세요.";
  if (code.includes("STALE")) return "현재 사실 버전으로 객체의 입력을 다시 연결하고 재계산하세요.";
  return "원문 증빙과 해당 검토 필드를 보완한 후 다시 계산하세요.";
}

/** A disposal creates replacement cash and an explicit deficit; it cannot erase asset value. */
export function calculateDisposal(input: { saleAmount: NumericInput; securedPayoff: NumericInput; costs: NumericInput }): { saleWon: Money | null; payoffWon: Money | null; costsWon: Money | null; netProceedsWon: Money | null; successorCashWon: Money | null; shortfallWon: Money | null; conserved: boolean; status: "calculated" | "needs_evidence" } {
  const sale = nonnegative(input.saleAmount), payoff = nonnegative(input.securedPayoff), costs = nonnegative(input.costs);
  if (sale === null || payoff === null || costs === null) return { saleWon: asMoney(sale), payoffWon: asMoney(payoff), costsWon: asMoney(costs), netProceedsWon: null, successorCashWon: null, shortfallWon: null, conserved: false, status: "needs_evidence" };
  const net = sale - payoff - costs, cash = net >= ZERO ? net : ZERO, deficit = net < ZERO ? -net : ZERO;
  return { saleWon: sale.toString(), payoffWon: payoff.toString(), costsWon: costs.toString(), netProceedsWon: net.toString(), successorCashWon: cash.toString(), shortfallWon: deficit.toString(), conserved: sale + deficit === payoff + costs + cash, status: "calculated" };
}
