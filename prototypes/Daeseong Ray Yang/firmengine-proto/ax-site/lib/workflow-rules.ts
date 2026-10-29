import { shareBasisPoints } from "./reference-parameters.ts";
import decisionTables from "./reference-decision-tables.json" with { type: "json" };
import { readReferenceValue } from "./reference-runtime.ts";
import type { ArtifactKind, CaseData, Fact, Json, SourceRef } from "./domain.ts";
import { currentFacts, factHasValidStructuredRefs, factSourceLineageIssues, validSourceRef } from "./domain.ts";
import { assessCase, type Assessment } from "./assessment.ts";
import { CURRENT_RULESET, LEGAL_CATALOG } from "./legal-rules.ts";

export type WorkflowStatus = "pass" | "fail" | "missing" | "conflict" | "not_applicable";
type Scope = "case" | "income" | "debt" | "asset" | "transaction";
export interface WorkflowTarget { kind: ArtifactKind; section: string; field: string }
export interface WorkflowField {
  key: string; label: string; unit?: string; period?: string;
  aliases?: string[]; crossChecks: string[]; targets: WorkflowTarget[];
  validation?: "nonnegative_money" | "positive_integer" | "date" | "ownership_bps";
}
export interface WorkflowDocument {
  type: string; label: string; why: string; fields: WorkflowField[];
  alternatives?: string[]; requirement: "required_when_applicable" | "conditional" | "court_ordered";
}
export interface WorkflowRule {
  id: string; title: string; scope: Scope;
  activation: { feature: string; op: "eq" | "in" | "gt" | "exists"; value?: Json }[];
  activationMode?: "all" | "any";
  documents: WorkflowDocument[]; ruleIds: string[];
  missingAction: string; disposalConsiderations: string[]; legalReviewRequired: boolean;
}
type Subject = { id: string; scope: Scope; value: Record<string, unknown>; factIds: string[] };
interface Cell { status: WorkflowStatus; value: Json | null; reason: string; facts: Fact[] }
interface WorkflowIndex {
  facts: Fact[];
  byKey: Map<string, Fact[]>;
  ledgerOrder: Map<string, number>;
  objectIds: Set<string>;
  householdFactIds: Set<string>;
  subjectFactIds: Map<string, Set<string>>;
  sourceValid: Map<string, boolean>;
  sourceReady: Map<string, boolean>;
  cells: Map<string, Cell>;
}
function workflowIndex(data: CaseData): WorkflowIndex {
  const facts = currentFacts(data), byKey = new Map<string, Fact[]>();
  for (const fact of facts) { const values = byKey.get(fact.key) ?? []; values.push(fact); byKey.set(fact.key, values); }
  const objects = [...data.incomes, ...data.debts, ...data.assets, ...data.transactions];
  return { facts, byKey, ledgerOrder: new Map(facts.map((f,i)=>[f.id,i])), objectIds: new Set(objects.map(o => o.id)), householdFactIds: new Set(data.household.factIds), subjectFactIds: new Map(objects.map(o => [o.id, new Set(o.factIds)])), sourceValid: new Map(), sourceReady: new Map(), cells: new Map() };
}

/** Declarative conditions, required documents and actions share the reference table. */
export const WORKFLOW_RULES = decisionTables.workflows as unknown as WorkflowRule[];
export function getWorkflowRules(): WorkflowRule[] {
  return WORKFLOW_RULES.map(rule => readReferenceValue(`workflow.${rule.id}`, rule));
}

/** Aliases preserve original extraction vocabulary without converting incompatible units. */
const ALIASES: Record<string, string[]> = {
  "applicant.name": ["client_name", "person.name"], "applicant.address": ["address", "person.address", "jurisdiction.residence"],
  "case.applicationDate": ["application_date", "case.application_date"], "case.courtId": ["court_name", "jurisdiction.court"],
  "income.employer": ["income_source.employer", "income.employer", "employer_name"],
  "income.gross": ["income.monthly_gross", "income.business_revenue", "annual_revenue", "monthly_revenue"],
  "income.expenses": ["income.necessary_cost", "annual_expenses", "monthly_expense"],
  "income.net": ["income.monthly_net", "annual_business_income", "monthly_income"],
  "income.recurring": ["income.recurring"],
  "income.periodStart": ["income.period_start"], "income.periodEnd": ["income.period_end"],
  "income.period": ["income.period"], "income.kind": ["income_source.kind", "income.type"],
  "income.businessName": ["business_name"], "income.businessType": ["business_type"],
  "debt.creditor": ["creditor.name", "creditor_name"], "debt.contractId": ["creditor_contract_id"],
  "debt.principal": ["debt.principal", "creditor_principal"], "debt.interest": ["debt.interest", "creditor_interest"],
  "debt.asOf": ["debt_as_of", "debts[].as_of"], "debt.cause": ["creditor_cause"],
  "debt.dueDate": ["creditor_due_date", "tax_arrears.due_date"], "debt.taxType": ["tax_arrears.tax_type", "tax_type"],
  "debt.taxPeriod": ["tax_arrears.period"], "debt.priority": ["tax_arrears.priority_status"],
  "debt.nonDischargeGround": ["tax_arrears.non_discharge_ground"], "debt.incurredAt": ["creditor_loan_date"],
  "debt.collateralId": ["creditor_collateral"], "debt.expectedSeparateRecovery": ["creditor_secured_recovery"],
  "debt.deficiency": ["creditor_shortfall"], "debt.claimedAmount": ["creditor_disputed_amount"],
  "debt.undisputedAmount": ["creditor_undisputed_amount"], "debt.disputeReason": ["creditor_dispute_reason"],
  "asset.label": ["asset_description", "assets[].description"], "asset.grossValue": ["asset_value", "assets[].gross_value"],
  "asset.asOf": ["assets[].valuation_as_of"], "asset.valuationBasis": ["assets[].valuation_method"],
  "asset.securedPayoff": ["assets[].secured_claim_amount"], "asset.protectionGround": ["assets[].protection_ground"],
  "asset.retirementType": ["retirement_type"], "asset.investmentHistory": ["assets[].transaction_history"],
  "household.recognizedMembers": ["household_size", "living.household_size"],
  "household.additionalLivingCost": ["living.additional_cost"],
  "court.orders": ["court.orders[]"], "court.responses": ["issue.answered", "issue.resolved"],
  "case.priorProceedings": ["prior_proceedings"], "case.planMonths": ["repayment_months", "plan.months"],
  "case.approvedMonthlyPayment": ["plan.monthly_payment"], "case.approvedPresentValue": ["plan.present_value"],
};

function jsonValue(value: unknown): Json | null {
  if (value === undefined || value === null || value === "" || value === "unknown") return null;
  if (typeof value === "object" && "normalizationStatus" in value && "amountWon" in value) {
    const numeric = value as { normalizationStatus: string; amountWon: string | null };
    return numeric.normalizationStatus === "exact" ? numeric.amountWon : null;
  }
  return value as Json;
}
function boolValue(value: Json | null): Json | null {
  return value === "yes" ? true : value === "no" ? false : value;
}
function sourceFacts(data: CaseData, subject: Subject, key: string, index: WorkflowIndex, extra: string[] = []): Fact[] {
  const snakeKey = key.replace(/[A-Z]/g, letter => "_" + letter.toLowerCase());
  const aliases = new Set([key, snakeKey, ...(ALIASES[key] ?? []), ...extra]);
  const candidates = [...aliases].flatMap(alias => index.byKey.get(alias) ?? []);
  const linked = index.subjectFactIds.get(subject.id) ?? new Set(subject.factIds);
  // Keep the ledger order: callers use it to preserve source and conflict order.
  const selected = candidates.filter(f => subject.scope === "case"
    ? [data.context.id, "case", "applicant", "household"].includes(f.subjectId) || index.householdFactIds.has(f.id) || !index.objectIds.has(f.subjectId)
    : f.subjectId === subject.id && linked.has(f.id));
  return selected.sort((a,b)=>(index.ledgerOrder.get(a.id)??0)-(index.ledgerOrder.get(b.id)??0));
}
function objectValue(data: CaseData, subject: Subject, key: string): unknown {
  const [namespace, ...rest] = key.split(".");
  if (namespace === subject.scope) return rest.reduce<unknown>((v, k) => v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined, subject.value);
  if (subject.scope === "case" && namespace === "case") return (data.context as unknown as Record<string, unknown>)[rest.join(".")];
  if (subject.scope === "case" && namespace === "applicant") return (data.context.applicant as unknown as Record<string, unknown> | undefined)?.[rest.join(".")];
  if (subject.scope === "case" && namespace === "household") return (data.household as unknown as Record<string, unknown>)[rest.join(".")];
  return undefined;
}
function computeCell(data: CaseData, subject: Subject, key: string, index: WorkflowIndex, aliases: string[] = [], activation = false): Cell {
  const facts = sourceFacts(data, subject, key, index, aliases);
  const valid = facts.filter(f => {
    if (!index.sourceValid.has(f.id)) index.sourceValid.set(f.id, f.state !== "retracted" && f.recognition !== "rejected" && (f.structuredRefs !== undefined ? factHasValidStructuredRefs(data,f) : f.refs.length > 0 && f.refs.every(ref => validSourceRef(data, ref))));
    return index.sourceValid.get(f.id);
  });
  const values = valid.map(f => jsonValue(f.numeric ?? f.value)).filter(v => v !== null);
  const distinct = [...new Set(values.map(v => JSON.stringify(boolValue(v))))];
  const periods = new Set(valid.map(f => `${f.periodStart ?? ""}|${f.periodEnd ?? ""}|${f.asOf ?? ""}`));
  if (periods.size > 1 && distinct.length > 1) return { status: "missing", value: null, reason: "서로 다른 기간·기준일의 값입니다. 같은 기간의 집계·대조 근거를 연결하세요.", facts };
  if (facts.some(f => f.state === "disputed") || distinct.length > 1) return { status: "conflict", value: null, reason: "같은 대상·피처의 현재 사실이 충돌합니다.", facts };
  const direct = jsonValue(objectValue(data, subject, key));
  if (distinct.length && direct !== null && JSON.stringify(boolValue(direct)) !== distinct[0]) return { status: "conflict", value: null, reason: "객체 입력과 연결된 현재 사실이 다릅니다.", facts };
  if (valid.length && values.length) {
    const ready = valid.every(f => {
      if (!index.sourceReady.has(f.id)) index.sourceReady.set(f.id, factSourceLineageIssues(data, [f.id]).length === 0);
      return index.sourceReady.get(f.id);
    });
    return { status: ready ? "pass" : "missing", value: values[0], reason: ready ? "검증·인정된 원문 근거가 연결되었습니다." : "값을 추출했으나 원문 대조·인정 검토가 남았습니다.", facts: valid };
  }
  // Object categories activate the appropriate evidence branch, but do not prove its fields.
  if (activation && direct !== null && subject.scope !== "case") {
    const objectRecognized = subject.value.recognition === "accepted" || subject.value.legalReview === "accepted";
    const objectReady = objectRecognized && subject.factIds.length > 0 && factSourceLineageIssues(data, subject.factIds).length === 0;
    return { status: objectReady ? "pass" : "missing", value: direct, reason: objectReady ? "검증된 객체 분류" : "객체의 분류·근거 검토 필요", facts: index.facts.filter(f => (index.subjectFactIds.get(subject.id) ?? new Set(subject.factIds)).has(f.id)) };
  }
  return { status: "missing", value: direct, reason: direct === null ? "값과 원문 근거가 없습니다." : "객체 값의 해당 피처 원문 연결이 없습니다.", facts };
}
function cell(data: CaseData, subject: Subject, key: string, index: WorkflowIndex, aliases: string[] = [], activation = false): Cell {
  const identity = JSON.stringify([subject.scope, subject.id, key, aliases, activation]);
  let cached = index.cells.get(identity);
  if (!cached) { cached = computeCell(data, subject, key, index, aliases, activation); index.cells.set(identity, cached); }
  // Field-specific validations modify the returned status, never a shared cache.
  return { ...cached };
}
function specialCell(data: CaseData, subject: Subject, key: string): Cell | undefined {
  const known = (value: Json, reason: string): Cell => ({ status: "pass", value, reason, facts: [] });
  if (key === "case.always") return known(true, "공통 신청 점검");
  if (key === "debt.exists" && subject.scope === "debt") return known(true, "채무 객체에 대응하는 증빙 점검");
  if (key === "case.multipleIncomeSources") {
    if (data.incomes.length >= 2) return known(true, "복수 소득원 후보가 존재합니다.");
    if (data.context.inventoryComplete.income === "yes") return known(false, "검토한 소득원 목록에 복수 소득원이 없습니다.");
    return { status: "missing", value: null, reason: "전체 소득원 조사범위 미확인", facts: [] };
  }
  if (key === "case.incomeInventoryComplete") {
    const value = data.context.inventoryComplete.income;
    return value === "yes" ? known(true, "사건의 소득원 목록 완전성 검토") : { status: "missing", value: null, reason: "소득원 목록 완전성 검토 필요", facts: [] };
  }
  return undefined;
}
function compare(value: Json | null, op: WorkflowRule["activation"][number]["op"], expected?: Json): boolean | null {
  value = boolValue(value);
  if (value === null) return null;
  if (op === "exists") return true;
  if (op === "eq") {
    if (typeof expected === "boolean" && typeof value !== "boolean") return null;
    return JSON.stringify(value) === JSON.stringify(expected);
  }
  if (op === "in") return Array.isArray(expected) ? expected.some(x => JSON.stringify(x) === JSON.stringify(value)) : null;
  if (op === "gt" && /^-?\d+$/.test(String(value)) && /^-?\d+$/.test(String(expected))) return BigInt(String(value)) > BigInt(String(expected));
  return null;
}
const priority: WorkflowStatus[] = ["conflict", "fail", "missing", "pass", "not_applicable"];
function aggregate(statuses: WorkflowStatus[]): WorkflowStatus { return priority.find(s => statuses.includes(s)) ?? "missing"; }
function fieldResult(data: CaseData, subject: Subject, spec: WorkflowField, index: WorkflowIndex) {
  const result = specialCell(data, subject, spec.key) ?? cell(data, subject, spec.key, index, spec.aliases);
  if (spec.unit === "KRW" && result.status === "pass" && result.facts.some(f => !f.numeric || f.numeric.normalizationStatus !== "exact")) {
    result.status = "missing"; result.reason = "원문 금액의 단위·통화·정수 원화 정규화를 확인해야 합니다.";
  }
  if (result.status === "pass" && result.value !== null) {
    const value = String(result.value);
    if (spec.validation === "nonnegative_money" && (!/^\d+$/.test(value))) { result.status = "fail"; result.reason = "금액은 0 이상 정수 원화여야 합니다. 원문 단위를 확인하세요."; }
    if (spec.validation === "positive_integer" && (!/^\d+$/.test(value) || BigInt(value) <= 0n)) { result.status = "fail"; result.reason = "양의 정수인지 확인하세요."; }
    if (spec.validation === "ownership_bps" && (!/^\d+$/.test(value) || BigInt(value) > BigInt(shareBasisPoints()))) { result.status = "fail"; result.reason = `소유지분은 0~${shareBasisPoints()} basis points입니다. 원문 비율 단위를 확인하세요.`; }
    if (spec.validation === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)))) { result.status = "fail"; result.reason = "유효한 ISO 날짜가 필요합니다."; }
  }
  return { ...spec, status: result.status, value: result.value, reason: result.reason, factIds: result.facts.map(f => f.id), refs: result.facts.flatMap(f => f.refs), structuredRefs: result.facts.flatMap(f => f.structuredRefs ?? []) };
}
function subjects(data: CaseData, scope: Scope): Subject[] {
  if (scope === "case") return [{ id: data.context.id, scope, value: data.context as unknown as Record<string, unknown>, factIds: [] }];
  const objects = scope === "income" ? data.incomes : scope === "debt" ? data.debts : scope === "asset" ? data.assets : data.transactions;
  return objects.map(x => ({ id: x.id, scope, value: x as unknown as Record<string, unknown>, factIds: x.factIds }));
}
function noObjectsStatus(data: CaseData, scope: Scope): WorkflowStatus {
  return (scope === "income" || scope === "debt" || scope === "asset") && data.context.inventoryComplete[scope] === "yes" ? "not_applicable" : "missing";
}

function crossCheckResults(data: CaseData, subject: Subject, fields: ReturnType<typeof fieldResult>[]) {
  const results: { id: string; status: WorkflowStatus; message: string }[] = [];
  const byKey = new Map(fields.map(f => [f.key, f]));
  const start = byKey.get("income.periodStart"), end = byKey.get("income.periodEnd");
  if (start || end) results.push({ id: "income_period_order", status: start?.status === "pass" && end?.status === "pass" ? String(start.value) <= String(end.value) ? "pass" : "fail" : "missing", message: "소득 산정 시작일과 종료일의 순서·범위를 확인합니다." });
  const gross = byKey.get("income.gross"), expenses = byKey.get("income.expenses"), net = byKey.get("income.net");
  if (subject.value.kind === "business" && gross && expenses && net) {
    const ready = [gross, expenses, net].every(f => f.status === "pass" && /^-?\d+$/.test(String(f.value)));
    results.push({ id: "business_income_equation", status: ready ? BigInt(String(gross.value)) - BigInt(String(expenses.value)) === BigInt(String(net.value)) ? "pass" : "conflict" : "missing", message: "같은 기간의 매출−필요비용=순소득을 대조합니다. 기간·총액 기준도 확인해야 합니다." });
  }
  const asOf = byKey.get("debt.asOf");
  if (asOf) results.push({ id: "debt_as_of", status: asOf.status === "pass" ? asOf.value === data.context.asOf && asOf.value === data.context.applicationDate ? "pass" : "conflict" : "missing", message: "잔액 기준일·신청일·사건 산정일을 맞춰야 채무한도 비교에 사용할 수 있습니다." });
  return results;
}

/** Evidence gaps are deterministic; discretionary legal outcomes remain explicit review work. */
export function evaluateWorkflow(data: CaseData, existingAssessment?: Assessment) {
  const assessment = existingAssessment ?? assessCase(data, CURRENT_RULESET);
  const index = workflowIndex(data);
  const legalMap = new Map(LEGAL_CATALOG.map(r => [r.id, r]));
  const findingMap: Record<string, string[]> = { "KR-PR-006": ["cap_담보"], "KR-PR-007": ["cap_무담보"], "KR-PR-041": ["plan_term"], "KR-PR-043": ["liquidation"] };
  const items = getWorkflowRules().flatMap(rule => {
    const scoped = subjects(data, rule.scope);
    const allSubjects = scoped.length ? scoped : [{ id: `${data.context.id}:${rule.scope}:unconfirmed`, scope: rule.scope, value: {}, factIds: [] } as Subject];
    return allSubjects.map(subject => {
      const activationChecks = rule.activation.map(condition => {
        const result = specialCell(data, subject, condition.feature) ?? cell(data, subject, condition.feature, index, [], true);
        const matches = compare(result.value, condition.op, condition.value);
        return { ...condition, status: result.status, actualValue: result.value, matches, reason: result.reason, factIds: result.facts.map(f => f.id) };
      });
      let applicability: WorkflowStatus;
      if (!scoped.length) applicability = noObjectsStatus(data, rule.scope);
      else if (activationChecks.some(x => x.status === "conflict")) applicability = "conflict";
      else {
        const provenFalse = activationChecks.filter(x => x.status === "pass" && x.matches === false).length;
        const provenTrue = activationChecks.filter(x => x.status === "pass" && x.matches === true).length;
        if (rule.activationMode === "any") applicability = provenTrue ? "pass" : provenFalse === activationChecks.length ? "not_applicable" : "missing";
        else applicability = provenFalse ? "not_applicable" : provenTrue === activationChecks.length ? "pass" : "missing";
      }
      const documents = rule.documents.map(spec => {
        const fields = spec.fields.map(f => fieldResult(data, subject, f, index));
        const refs = fields.flatMap(f => f.refs);
        const documentIds = [...new Set(refs.map(ref => ref.documentId))];
        const checks = crossCheckResults(data, subject, fields);
        const sourceRecordIds = [...new Set(fields.flatMap(f => f.structuredRefs.map(ref => ref.sourceRecordId)))];
        return { ...spec, status: applicability === "not_applicable" ? "not_applicable" as WorkflowStatus : aggregate([...fields.map(f => f.status), ...checks.map(c => c.status)]), documentIds, ...(sourceRecordIds.length ? { sourceRecordIds, sourceBasis: "assumed_extracted_synthetic" as const } : {}), fields, crossCheckResults: checks };
      });
      const legalChecks = rule.ruleIds.map(ruleId => {
        const definition = legalMap.get(ruleId);
        const matches = assessment.findings.filter(f => (findingMap[ruleId] ?? []).includes(f.id));
        let status: WorkflowStatus = applicability === "not_applicable" ? "not_applicable" : "missing";
        if (applicability !== "not_applicable" && matches.length) status = aggregate(matches.map(f => f.outcome === "pass" ? "pass" : f.outcome === "fail" ? "fail" : "missing"));
        if (definition?.authority_scope === "서울회생법원" && data.context.courtId !== "seoul") status = "missing";
        if (!data.context.ruleApplicationReviewed || data.context.ruleReleaseId !== CURRENT_RULESET.id || data.context.applicationDate < (CURRENT_RULESET.effectiveFrom ?? "")) status = applicability === "not_applicable" ? "not_applicable" : "missing";
        return { ruleId, title: definition?.title ?? "규칙 연결 확인", article: definition?.article ?? "", sourceUrl: definition?.source_url ?? "", status, reason: matches.length ? matches.map(f => f.detail).join(" ") : "원문·시행일·관할과 이 사건 적용의 별도 법률 검토가 필요합니다.", implementationScope: definition?.implementation_scope ?? "unresolved" };
      });
      const dataStatus = applicability === "not_applicable" ? "not_applicable" : aggregate([applicability, ...documents.map(d => d.status)]);
      const status = applicability === "not_applicable" ? "not_applicable" : aggregate([dataStatus, ...legalChecks.map(c => c.status)]);
      return { id: `${rule.id}:${subject.id}`, ruleId: rule.id, title: rule.title, subjectId: subject.id, applicability, status, dataStatus, activationChecks, documents, legalChecks, ruleIds: rule.ruleIds, missingAction: rule.missingAction, disposalConsiderations: rule.disposalConsiderations, legalReviewRequired: applicability !== "not_applicable" && rule.legalReviewRequired && legalChecks.some(c => c.status !== "pass") };
    });
  });
  const summary = { total: items.length, pass: 0, fail: 0, missing: 0, conflict: 0, not_applicable: 0, legalReviewRequired: 0 };
  for (const item of items) { summary[item.status] += 1; if (item.legalReviewRequired) summary.legalReviewRequired += 1; }
  return { version: "2026-10-27.1", evaluatedAt: data.context.asOf, scope: "상황별 증빙·원문·제출항목 연결과 구현된 사전요건 점검. 법원의 개시·인가·면책 결론이 아닙니다.", summary, items };
}

/** Preserved vocabulary; never promoted into current legal recognition. */
export const LEGACY_WORKFLOW_ORIGIN = decisionTables.legacyWorkflowOrigin;
export const LEGACY_DOCUMENT_TYPES = decisionTables.legacyDocumentTypes;
export const LEGACY_FEATURE_CATALOG = decisionTables.legacyFeatures;
export const LEGACY_DOCUMENT_REQUIREMENTS = decisionTables.legacyRequirements;
