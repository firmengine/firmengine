import type { DocumentWriterReceipt } from "./document-writer.ts";
import type { CaseWorkflowState } from "./case-workflow-state.ts";
import documentPolicy from "./reference-document-policy.json" with { type: "json" };
import { readReferenceValue } from "./reference-runtime.ts";
import { observeField, type FieldObservation, type PageFieldCoverage } from "./field-observation.ts";
import { requiresRecordCategoryStatus } from "./category-contract.ts";
import { isSourceMoney,insuranceReviewFieldKey,debtComponentSlotKey } from "./source-quantity.ts";
import { bboxLocatorFingerprintSegment, fingerprintHasBBoxLocator, isValidSourceBBox, sameSourceBBox, sourceQuotesOverlap, type BBoxReceiptLocator, type SourceBBox } from "./source-verification-identity.ts";

/** Canonical, JSON-safe evidence ledger. Money arithmetic never uses floating point. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type TriState = "yes" | "no" | "unknown";
export type Money = string;
export type FactState = "reported" | "extracted" | "verified" | "disputed" | "retracted";
export type Recognition = "unreviewed" | "accepted" | "rejected";
export type IncomeKind = "wage" | "business" | "rent" | "interest" | "dividend" | "pension" | "benefit" | "other";
export type DebtClassification = "ordinary" | "secured" | "tax" | "estate" | "non_dischargeable" | "disputed" | "unknown";

export interface NumericInput {
  rawValue: string | number | null;
  amountWon: Money | null;
  unit: string;
  currency: string;
  normalizationStatus: "exact" | "missing" | "invalid" | "review_required";
}
export interface SourceRef {
  documentId: string;
  page: number;
  bbox?: [number, number, number, number];
  quote: string;
  sourceHash?: string;
}
/** A JSON pointer into explicitly assumed-extracted synthetic scenario data; never a PDF citation. */
export interface StructuredSourceRef {
  sourceRecordId: string;
  jsonPointer: string;
}
export interface StructuredTestProvenance {
  mode: "assumed_extracted_synthetic";
  scenarioId?: string;
  sourceRecords: { id: string; recordType: string; recordId: string; data: Json }[];
}
export interface EvidenceDocument {
  id: string;
  parentId?: string;
  sha256: string;
  name: string;
  type?: string;
  status: "active" | "deleted";
  pages: number[];
  uploadedAt?: string;
  deletedAt?: string;
  extractionStatus?: "pending" | "processing" | "completed" | "failed";
}
export interface EvidencePage {
  fieldCoverage?: PageFieldCoverage;
  documentId: string;
  page: number;
  role: "evidence" | "filed_form" | "administrative" | "unknown";
  text?: string;
  imageUrl?: string;
  documentType?: string;
}
export interface Fact {
  canonicalFieldId?: string;
  fieldObservation?: FieldObservation;
  id: string;
  logicalId: string;
  version: number;
  supersedes?: string;
  subjectId: string;
  key: string;
  value: Json;
  rawValue?: string;
  /** Exact unit token read beside the source value, including non-monetary fields. */
  sourceUnit?: string | null;
  numeric?: NumericInput;
  periodStart?: string;
  periodEnd?: string;
  asOf?: string;
  state: FactState;
  recognition: Recognition;
  refs: SourceRef[];
  structuredRefs?: StructuredSourceRef[];
  validation: { code: string; message: string; severity: "info" | "warning" | "error" }[];
  reviewer?: string;
  reviewReason?: string;
  /** Server-authored independent OCR corroboration. Never implies legal acceptance or human review. */
  sourceVerification?: {
    method: "independent_luna_cross_read";
    model: EvidenceModel;
    promptVersion: string;
    verifiedAt: string;
    /** Missing means historical value/unit/quote corroboration only; never backfilled as field-semantic proof. */
    verificationScope?: "field_meaning_v1";
    source: { documentId: string; page: number; sha256: string };
    field: { recordCategory: string; key: string; value: string; unit: string | null; quote: string; locator?: BBoxReceiptLocator };
    extractionReading: { value: string; unit: string | null; quote: string; bbox?: SourceBBox };
    verificationQuotes: string[];
    fieldFingerprint: string;
    proofReadIndexes: { pass: "verify" | "repair"; recordIndex: number; fieldIndex: number }[];
    proofReads: { pass: "verify" | "repair"; model: EvidenceModel; promptVersion: string; promptHash: string; verifiedAt: string; recordIndex: number; fieldIndex: number; categoryStatus?: "supported"; meaningStatus?: string; status: "agrees" | "corrected"; value: string; unit: string | null; quote: string; bbox?: SourceBBox }[];
    geometry?: { version: "bbox_corroboration_v1"; extractionBBox: SourceBBox | null; finalBBox: SourceBBox; verifierReads: {pass:"verify"|"repair";model:EvidenceModel;promptVersion:string;promptHash:string;verifiedAt:string;recordIndex:number;fieldIndex:number;categoryStatus?:"supported";meaningStatus:"supported";status:"agrees"|"corrected";value:string;unit:string|null;quote:string;bbox:SourceBBox}[] };
    recognition: "unreviewed";
    factBinding: { id: string; logicalId: string; version: number };
  };
  createdAt?: string;
}
export interface IncomeSource {
  id: string;
  kind: IncomeKind;
  label: string;
  employer?: string;
  /** Source-backed legal payer identifier; names alone are not an identity key. */
  payerIdentityId?: string;
  aggregationTreatment?: "series_observation" | "independent_source" | "component" | "duplicate" | "unknown";
  aggregationReviewed?: boolean;
  aggregationReviewReason?: string;
  gross?: NumericInput | null;
  expenses?: NumericInput | null;
  net?: NumericInput | null;
  periodStart?: string;
  periodEnd?: string;
  periodMonths?: number | null;
  amountBasis?: "monthly" | "period_total" | "unknown";
  recurring?: TriState;
  recognition?: Recognition;
  factIds: string[];
}
export interface Debt {
  id: string;
  contractId?: string;
  creditor: string;
  principal?: NumericInput | null;
  interest?: NumericInput | null;
  secured: TriState;
  classification: DebtClassification;
  asOf?: string;
  dueDate?: string;
  priority?: "ordinary" | "priority" | "estate" | "unknown";
  legalReview?: Recognition;
  excludedByReview?: boolean;
  exclusionReason?: string;
  /** Unusable slots observed by the source reader; never numeric facts or legal decisions. */
  sourceComponentIssues?: string[];
  /** Explicit, reviewer-authored treatment for guarantee, contingent and overlapping claims. */
  guaranteeDetails?: {
    liabilityRole: "principal" | "guarantor" | "joint_and_several" | "unknown";
    claimNature: "fixed" | "contingent" | "disputed" | "unknown";
    underlyingDebtId?: string;
    /** Source-stated amounts only; never treated as the applicant's own liability amount. */
    sourceGuaranteeAmount?: NumericInput | null;
    sourceGuaranteeLimit?: NumericInput | null;
    recourseStatus: "not_applicable" | "unpaid" | "partially_paid" | "subrogated" | "unknown";
    capTreatment: "include" | "exclude" | "unknown";
    capTreatmentReviewed?: boolean;
    reviewReason?: string;
  };
  factIds: string[];
}
export interface Asset {
  id: string;
  kind: "cash" | "deposit" | "insurance" | "vehicle" | "real_estate" | "lease_deposit" | "business" | "receivable" | "retirement" | "other";
  label: string;
  grossValue?: NumericInput | null;
  securedPayoff?: NumericInput | null;
  securedPayoffScope?: "applicant_interest" | "entire_collateral" | "unknown";
  disposalCosts?: NumericInput | null;
  protectedValue?: NumericInput | null;
  ownershipBps?: number | null;
  asOf?: string;
  valuationBasis?: string;
  recognition?: Recognition;
  factIds: string[];
}
export interface Household {
  reportedMembers?: number | null;
  recognizedMembers?: number | null;
  recognizedLivingCost?: NumericInput | null;
  additionalLivingCost?: NumericInput | null;
  livingCostIncludesAdditional?: boolean;
  recognition?: Recognition;
  factIds: string[];
}
export interface Transaction {
  id: string;
  date: string;
  accountId?: string;
  counterparty?: string;
  kind: "income" | "expense" | "transfer" | "debt_payment" | "asset_disposal" | "tax" | "unknown";
  direction: "in" | "out" | "unknown";
  amount: NumericInput;
  relatedObjectId?: string;
  factIds: string[];
}
/** Explicit disposal assumptions. Amounts are never inferred from the asset valuation. */
export interface DisposalScenario {
  id: string;
  assetId: string;
  intent?: "proposed" | "unknown";
  saleAmount?: NumericInput | null;
  securedPayoff?: NumericInput | null;
  costs?: NumericInput | null;
  factIds: string[];
  recognition: Recognition;
}
export interface CaseContext {
  id: string;
  caseName: string;
  revision: number;
  applicationDate: string;
  asOf: string;
  courtId: string;
  filingPeriod?: { start: string; end: string } | null;
  incomePeriodReviewed?: boolean;
  evidence_cutoff?: string;
  ruleReleaseId: string;
  ruleApplicationReviewed: boolean;
  referenceReviewSha256?: string;
  referenceApplicationRequired?: boolean;
  referenceBundleId?: string | null;
  referenceArtifactIds?: string[] | null;
  referenceDateBasis?: "applicationDate" | "asOf" | null;
  referenceEffectiveDate?: string | null;
  inventoryComplete: { income: TriState; debt: TriState; asset: TriState };
  planMonths?: number | null;
  exceptionalTermReviewed?: boolean;
  /** Explicit human disposition for a shortened plan, bound to the reviewed evidence and plan. */
  shortenedTermReview?: { months: number; ruleReleaseId: string; reason: string; basisFingerprint: string } | null;
  /** Explicit, human-confirmed no-disposal applicability, bound to current asset facts. */
  disposalApplicabilityReview?: { disposition:"not_applicable"; status:"candidate"|"confirmed"; reason:string; basisFingerprint:string; factIds:string[]; reviewedBy?:string; reviewedAt?:string } | null;
  monthlyTrusteeFee?: NumericInput | null;
  monthlyPriorityPayment?: NumericInput | null;
  monthlyEstatePayment?: NumericInput | null;
  approvedMonthlyPayment?: NumericInput | null;
  approvedPresentValue?: NumericInput | null;
  presentValueBasis?: string;
  /** Explicit review that the entered PV follows the stated valuation method and date. */
  presentValueReviewed?: boolean;
  assetValuationBasisReviewed?: boolean;
  courtObjection?: TriState;
  allocationBasis?: "principal_then_interest_pro_rata" | "principal_only_pro_rata";
  allocationBasisReviewed?: boolean;
  eligibility?: { naturalPerson?: TriState; insolventOrRisk?: TriState; priorProceedingsReviewed?: TriState };
  applicant?: { name?: string; address?: string; residentIdMasked?: string; statement?: string };
  paymentSchedule?: {
    reviewed: boolean;
    reviewReason?: string;
    expectedInstallments?: number | null;
    phases: { id: string; firstInstallment: number; lastInstallment: number; firstPaymentDate?: string; monthlyAvailableWon: Money; allocations: { creditorId: string; principalWon: Money; interestWon: Money }[] }[];
  };
}
export type ArtifactKind = "application" | "creditors" | "assets" | "income_expense" | "repayment_plan" | "statement" | "evidence_index" | "review_workbook" | "bank_accounts" | "leases" | "repayment_schedule";
export interface ExportFile {
  id: string;
  kind: ArtifactKind | "print_html" | "rendered_json" | "package_zip";
  name: string;
  hash: string;
  status: "current" | "archived" | "invalidated";
}
export interface ReviewRecord {
  actor: string;
  at: string;
  caseRevision: number;
  manifestFingerprint: string;
}
export interface ExportManifest {
  caseRevision: number;
  /** Legacy manifests without a mode are treated as drafts and cannot be reviewed. */
  mode?: "draft" | "final";
  requiredKinds: ArtifactKind[];
  files: ExportFile[];
  reviews: { caseworker: ReviewRecord | null; lawyer: ReviewRecord | null };
  /** Render-time document writer receipt; preserved with the export manifest for edit authority and audit. */
  documentWriter?: DocumentWriterReceipt;
}
export interface ReferenceTestProvenance {
  mode: "synthetic_reference_only";
  sourceCaseId: string;
  datasetVersion: string;
  datasetSha256: string;
  projectedDatasetSha256: string;
  projectionVersion: "reference-case-projection/v1";
  sourceBindingsSha256: string;
  importedAt: string;
  importedBy: string;
  importReason: string;
  finalSubmissionProhibited: true;
  fields: { fieldId: string; canonicalKey: string; rawSourceKey: string; presenceState: "present" | "absent" | "unknown" | "masked" | "conflict"; factId: string; groupKey?: string; rowIndex?: number; sourceMetadata?: { familyId: string; localId: string; partyRole?: string; temporalRole?: string; amountRole?: string; sourceLabel?: string; origin?: string; sourceRowId?: string; normalizedValue: Json | null } }[];
  objectCounts: { incomes: number; debts: number; assets: number; transactions: number };
  importHistory: { datasetVersion: string; datasetSha256: string; importedAt: string; importedBy: string; importReason: string; retiredFactCount: number }[];
  archivedSnapshots: { datasetVersion: string; datasetSha256: string; archivedAt: string; objects: { incomes: IncomeSource[]; debts: Debt[]; assets: Asset[]; transactions: Transaction[]; household: Household }; contextReviewState: Pick<CaseContext, "inventoryComplete" | "ruleApplicationReviewed" | "incomePeriodReviewed" | "assetValuationBasisReviewed" | "presentValueReviewed" | "allocationBasisReviewed" | "eligibility"> }[];
}
export interface CaseData {
  /** Server persisted workflow; does not confer factual or legal recognition. */
  workflowState?: CaseWorkflowState;
  evaluationClone?: {sourceCaseId:string;sourceInputSha256:string;createdAt:string;finalSubmissionProhibited:true};
  /** Response-only CAS fingerprint. Never used as a stored authority. */
  clientStateFingerprint?: string;
  context: CaseContext;
  documents: EvidenceDocument[];
  pages: EvidencePage[];
  facts: Fact[];
  incomes: IncomeSource[];
  debts: Debt[];
  assets: Asset[];
  household: Household;
  transactions: Transaction[];
  disposalScenarios?: DisposalScenario[];
  exportManifest?: ExportManifest;
  referenceTest?: ReferenceTestProvenance;
  structuredTest?: StructuredTestProvenance;
  extractionWarnings?: string[];
  execution?: { model: EvidenceModel; attempts: number; inputTokens: number; outputTokens: number; startedAt?: string; completedAt?: string; calls?: { agent: string; attempt: number; status: "completed" | "failed"; inputTokens: number; outputTokens: number; durationMs: number }[] };
  historyIntegrityRepairs?: { operation: "restore_historical_source_proof_metadata_v1"; reason: "Restore historical proof metadata only; no OCR or human review"; baselineKey: string; baselineObjectSha256: string; baselineFactsSha256: string; documentId: string; page: number; sourceSha256: string; baselineRevision: number; beforeRevision: number; afterRevision: number; selectedCount: number; selectedIdsSha256: string; activeFactsChanged: 0; humanFactReviewsChanged: 0; activeExportFilesInvalidated: number; priorReviewsCleared: number; priorReviewFingerprintsSha256: string; actor: string; actorKind: "human" | "private-site-service"; at: string }[];
}
export interface RuleSource {
  id: string;
  title: string;
  url: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  reviewedAt?: string;
}
export interface RuleSet {
  id: string;
  status: "draft" | "source_verified" | "verified";
  sources: RuleSource[];
  effectiveFrom?: string;
  effectiveTo?: string;
  courtIds?: string[];
  debtCaps?: { unsecuredWon: Money; securedWon: Money; comparison: "lte" | "lt" };
  term?: { ordinaryMonths: number; exceptionalMaxMonths?: number };
  livingCostTable?: Record<string, Money>;
}

export const REQUIRED_ARTIFACT_KINDS = documentPolicy.requiredKinds as ArtifactKind[];
export function requiredKindsForCase(data: Pick<CaseData, "documents" | "pages" | "facts"> & Partial<Pick<CaseData,"assets"|"incomes"|"transactions">>): ArtifactKind[] {
  const kinds: ArtifactKind[] = [...readReferenceValue("document.required_kinds", REQUIRED_ARTIFACT_KINDS), ...documentPolicy.alwaysAdditionalKinds as ArtifactKind[]];
  const source = JSON.stringify([data.documents.filter(d => d.status === "active").map(d => d.type ?? ""),data.pages.filter(p=>p.role==="evidence").map(p=>p.documentType??""),currentFacts(data).map(f => f.key)]).toLowerCase();
  for (const rule of readReferenceValue("document.conditional_kinds", documentPolicy.conditionalKinds)) {
    if (new RegExp(rule.sourcePattern).test(source) || data.assets?.some(a => rule.assetKinds.includes(a.kind)) || data.incomes?.some(i => rule.incomeKinds.includes(i.kind)) || rule.transactionAccount && data.transactions?.some(t => !!t.accountId)) kinds.push(rule.kind as ArtifactKind);
  }
  return [...new Set(kinds)];
}
export const AI_MODEL = "gpt-6.1-terra" as const;
export const CONSULTATION_AI_MODEL = "gpt-6-luna" as const;
export type EvidenceModel = typeof AI_MODEL | typeof CONSULTATION_AI_MODEL;
/** Historical Luna receipts keep their original model; new OCR runs use Terra. */
export function isEvidenceModel(model:unknown):model is EvidenceModel { return model===AI_MODEL||model===CONSULTATION_AI_MODEL; }
export const DRAFT_RULESET: RuleSet = { id: "kr-rehabilitation-draft", status: "draft", sources: [] };
const ZERO = BigInt(0);
const ONE = BigInt(1);

export function createCase(caseName = "새 사건", id = crypto.randomUUID(), asOf = new Date().toISOString().slice(0, 10)): CaseData {
  return {
    context: { id, caseName, revision: 1, applicationDate: asOf, asOf, courtId: "seoul", ruleReleaseId: DRAFT_RULESET.id, ruleApplicationReviewed: false, inventoryComplete: { income: "unknown", debt: "unknown", asset: "unknown" } },
    documents: [], pages: [], facts: [], incomes: [], debts: [], assets: [], household: { factIds: [] }, transactions: [],
  };
}

/** Accept decimal source text, but only when its unit conversion yields exact integer KRW. */
export function normalizeMoney(rawValue: string | number | null | undefined, unit = "KRW", currency = "KRW"): NumericInput {
  const result: NumericInput = { rawValue: rawValue ?? null, amountWon: null, unit, currency, normalizationStatus: "missing" };
  if (rawValue === null || rawValue === undefined || String(rawValue).trim() === "") return result;
  if (currency.toUpperCase() !== "KRW") return { ...result, normalizationStatus: "review_required" };
  if (typeof rawValue === "number" && !Number.isSafeInteger(rawValue)) return { ...result, normalizationStatus: "invalid" };
  const text = String(rawValue).trim().replace(/,/g, "").replace(/\s*(?:원|KRW)\s*$/i, "");
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(text);
  const units: Record<string, bigint> = { KRW: ONE, won: ONE, 원: ONE, thousand_won: BigInt(1000), 천원: BigInt(1000), ten_thousand_won: BigInt(10000), manwon: BigInt(10000), 만원: BigInt(10000), million_won: BigInt(1000000), 백만원: BigInt(1000000), 억원: BigInt(100000000) };
  const scale = units[unit];
  if (!match || !scale || text.length > 100) return { ...result, normalizationStatus: "invalid" };
  const fraction = match[3] ?? "";
  const denominator = BigInt(10) ** BigInt(fraction.length);
  const signed = (match[1] === "-" ? -ONE : ONE) * BigInt(match[2] + fraction) * scale;
  if (signed % denominator !== ZERO) return { ...result, normalizationStatus: "review_required" };
  return { ...result, amountWon: (signed / denominator).toString(), normalizationStatus: "exact" };
}

export function moneyValue(input: NumericInput | null | undefined): bigint | null {
  if (!input || input.normalizationStatus !== "exact" || input.currency.toUpperCase() !== "KRW" || !/^-?\d+$/.test(input.amountWon ?? "")) return null;
  // A supplied normalized amount must agree with the preserved source value/unit.
  const checked = normalizeMoney(input.rawValue, input.unit, input.currency);
  return checked.amountWon === input.amountWon ? BigInt(input.amountWon!) : null;
}

export function formatWon(value: Money | null | undefined): string {
  return value !== null && value !== undefined && /^-?\d+$/.test(value) ? BigInt(value).toLocaleString("ko-KR") + "원" : "확인 필요";
}

/** Request-scoped read indexes. Callers must not mutate evidence during the indexed read. */
export interface CaseReadIndex {
  readonly owner: CaseData;
  readonly current: Fact[];
  readonly byId: Map<string, Fact>;
  readonly bySubject: Map<string, Fact[]>;
  readonly documentsById: Map<string, EvidenceDocument>;
  readonly pagesByKey: Map<string, EvidencePage>;
  readonly canonicalPageTextByKey: Map<string, string | null>;
  readonly validRefs: WeakMap<object, boolean>;
  readonly lineageById: Map<string, string[]>;
}
const pageKey=(documentId:string,page:number)=>documentId+"\0"+page;
export function createCaseReadIndex(data:CaseData):CaseReadIndex {
  const groups = new Map<string, Fact[]>();
  for (const fact of data.facts) groups.set(fact.logicalId, [...(groups.get(fact.logicalId) ?? []), fact]);
  const current=[...groups.values()].flatMap((items) => {
    const version = Math.max(...items.map((f) => f.version));
    // Concurrent same-version candidates stay visible so downstream checks can block them.
    return items.filter((f) => f.version === version && f.state !== "retracted");
  });
  const bySubject=new Map<string,Fact[]>();for(const fact of current){let rows=bySubject.get(fact.subjectId);if(!rows){rows=[];bySubject.set(fact.subjectId,rows);}rows.push(fact);}
  const pagesByKey=new Map(data.pages.map(page=>[pageKey(page.documentId,page.page),page]));
  const canonicalPageTextByKey=new Map([...pagesByKey].map(([key,page])=>[key,page.text?.trim()?page.text.normalize("NFKC").replace(/\s+/g,"").toLowerCase():null]));
  return {owner:data,current,byId:new Map(current.map(fact=>[fact.id,fact])),bySubject,documentsById:new Map(data.documents.map(document=>[document.id,document])),pagesByKey,canonicalPageTextByKey,validRefs:new WeakMap(),lineageById:new Map()};
}

export function currentFacts(data: Pick<CaseData, "facts">, index?:CaseReadIndex): Fact[] {
  if(index){if(index.owner!==data)throw new Error("source index belongs to a different case snapshot");return index.current;}
  const groups = new Map<string, Fact[]>();
  for (const fact of data.facts) groups.set(fact.logicalId, [...(groups.get(fact.logicalId) ?? []), fact]);
  return [...groups.values()].flatMap(items => {const version=Math.max(...items.map(f=>f.version));return items.filter(f=>f.version===version&&f.state!=="retracted");});
}

export function validSourceRef(data: CaseData, ref: SourceRef, index?:CaseReadIndex): boolean {
  if(index&&index.owner!==data)throw new Error("source index belongs to a different case snapshot");
  const cached=index?.validRefs.get(ref);if(cached!==undefined)return cached;
  const document = index?.documentsById.get(ref.documentId)??data.documents.find((d) => d.id === ref.documentId);
  let result=false;
  if (!document || document.status!=="active" || !document.pages.includes(ref.page) || !ref.quote?.trim()) {index?.validRefs.set(ref,false);return false;}
  if (ref.sourceHash && ref.sourceHash !== document.sha256) {index?.validRefs.set(ref,false);return false;}
  const page = index?.pagesByKey.get(pageKey(ref.documentId,ref.page))??data.pages.find((p) => p.documentId === ref.documentId && p.page === ref.page);
  if (!page || page.role !== "evidence") {index?.validRefs.set(ref,false);return false;}
  // Text-backed pages permit a deterministic quote check. Images remain explicit review inputs.
  const canonical = (text: string) => text.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
  const canonicalPage=index?.canonicalPageTextByKey.get(pageKey(ref.documentId,ref.page));
  result=canonicalPage!==undefined?canonicalPage===null||canonicalPage.includes(canonical(ref.quote)):!page.text?.trim()||canonical(page.text).includes(canonical(ref.quote));
  index?.validRefs.set(ref,result);
  return result;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

/**
 * Validate a synthetic source pointer without treating it as documentary proof.
 * Only own properties are traversed; prototype-related path segments are rejected.
 */
export function validStructuredSourceRef(data: CaseData, fact: Fact, ref: StructuredSourceRef): boolean {
  const provenance = data.structuredTest;
  if (provenance?.mode !== "assumed_extracted_synthetic" || !Array.isArray(provenance.sourceRecords) || fact.refs.length !== 0 || fact.sourceVerification !== undefined || fact.state === "verified" || fact.recognition === "accepted") return false;
  if (!ref || typeof ref.sourceRecordId !== "string" || !ref.sourceRecordId.trim() || typeof ref.jsonPointer !== "string" || !ref.jsonPointer.startsWith("/") || !ref.jsonPointer.endsWith("/value")) return false;
  if (provenance.sourceRecords.some(record => !record || typeof record.id !== "string" || !record.id.trim() || typeof record.recordType !== "string" || !record.recordType.trim() || typeof record.recordId !== "string" || !record.recordId.trim()) || new Set(provenance.sourceRecords.map(record => record.id)).size !== provenance.sourceRecords.length) return false;
  const record = provenance.sourceRecords.find(item => item.id === ref.sourceRecordId);
  if (!record || typeof record.recordType !== "string" || !record.recordType.trim() || record.recordId !== fact.subjectId) return false;
  const encoded = ref.jsonPointer.slice(1).split("/");
  const segments: string[] = [];
  for (const part of encoded) {
    if (/~(?![01])/u.test(part)) return false;
    const segment = part.replace(/~1/g, "/").replace(/~0/g, "~");
    if (segment === "__proto__" || segment === "prototype" || segment === "constructor") return false;
    segments.push(segment);
  }
  if (segments.length < 2 || segments.at(-1) !== "value") return false;
  let current: unknown = record.data;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      if (!/^(?:0|[1-9]\d*)$/u.test(segment)) return false;
      const position = Number(segment);
      if (!Number.isSafeInteger(position) || position >= current.length) return false;
      current = current[position];
    } else if (current && typeof current === "object" && Object.hasOwn(current, segment)) current = (current as Record<string, unknown>)[segment];
    else return false;
  }
  const wrapper: unknown = (() => {
    let parent: unknown = record.data;
    for (const segment of segments.slice(0, -1)) {
      if (Array.isArray(parent)) parent = parent[Number(segment)];
      else if (parent && typeof parent === "object" && Object.hasOwn(parent, segment)) parent = (parent as Record<string, unknown>)[segment];
      else return undefined;
    }
    return parent;
  })();
  if (!wrapper || typeof wrapper !== "object" || Array.isArray(wrapper) || !Object.hasOwn(wrapper, "presence") || (wrapper as Record<string, unknown>).presence !== "present" || current === null || current === undefined) return false;
  const envelope = wrapper as Record<string, unknown>;
  const normalizedKey = (value: string) => value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  if (typeof envelope.fieldId !== "string" || normalizedKey(envelope.fieldId) !== normalizedKey(fact.key)) return false;
  if (stableJson(current) !== stableJson(fact.value)) return false;
  if (fact.numeric) {
    const unit = typeof envelope.sourceUnit === "string" ? envelope.sourceUnit : null;
    if (!unit || unit !== fact.numeric.unit || fact.sourceUnit !== unit) return false;
    const objectValue = current && typeof current === "object" && !Array.isArray(current) ? current as Record<string, unknown> : null;
    const explicitCurrency = typeof objectValue?.currency === "string" ? objectValue.currency : typeof envelope.currency === "string" ? envelope.currency : null;
    if (!explicitCurrency || explicitCurrency.toUpperCase() !== fact.numeric.currency.toUpperCase()) return false;
    if (objectValue) {
      const minorUnits = objectValue.minorUnits;
      const amount = objectValue.amount;
      if (minorUnits !== undefined && String(minorUnits) !== fact.numeric.amountWon) return false;
      if (amount !== undefined && String(amount) !== fact.numeric.amountWon) return false;
      if (objectValue.unit !== undefined && objectValue.unit !== unit) return false;
      if (minorUnits === undefined && amount === undefined) return false;
    }
    const raw = Object.hasOwn(envelope, "rawValue") ? envelope.rawValue : current;
    if (raw === null || raw === undefined || (typeof raw !== "string" && typeof raw !== "number")) return false;
    if (fact.numeric.rawValue === null || String(raw) !== String(fact.numeric.rawValue)) return false;
    const normalized = normalizeMoney(raw, unit, explicitCurrency);
    if (normalized.normalizationStatus !== fact.numeric.normalizationStatus || normalized.amountWon !== fact.numeric.amountWon || moneyValue(fact.numeric) === null) return false;
  }
  return true;
}

export function factHasValidStructuredRefs(data: CaseData, fact: Fact): boolean {
  return Array.isArray(fact.structuredRefs) && fact.structuredRefs.length > 0 && fact.structuredRefs.every(ref => validStructuredSourceRef(data, fact, ref));
}

/** Stable, row-scoped synthetic source identity for calculation and reconciliation. */
export function structuredSourceRowKeys(data: CaseData, fact: Fact): string[] {
  if (!factHasValidStructuredRefs(data, fact)) return [];
  const records = data.structuredTest!.sourceRecords;
  return [...new Set(fact.structuredRefs!.map(ref => {
    const record = records.find(item => item.id === ref.sourceRecordId)!;
    return `${record.recordType}\0${record.recordId}`;
  }))];
}

export function describeStructuredSourceRefs(data: CaseData, fact: Fact): string[] {
  if (!factHasValidStructuredRefs(data, fact)) return [];
  const records = data.structuredTest!.sourceRecords;
  return fact.structuredRefs!.map(ref => {
    const record = records.find(item => item.id === ref.sourceRecordId)!;
    return `합성 가정추출 · ${record.recordType} / ${record.recordId} / ${ref.jsonPointer}`;
  });
}

const SOURCE_RECEIPT_BBOX_IOU=0.5;
function sourceReceiptBBoxIoU(a:unknown,b:unknown):number{
  if(!isValidSourceBBox(a)||!isValidSourceBBox(b))return 0;
  const intersection=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
  const areaA=(a[2]-a[0])*(a[3]-a[1]),areaB=(b[2]-b[0])*(b[3]-b[1]),union=areaA+areaB-intersection;
  return union>0?intersection/union:0;
}

export function factSourceLineageIssues(data: CaseData, ids: string[], index?:CaseReadIndex): string[] {
  if(index&&index.owner!==data)throw new Error("source index belongs to a different case snapshot");
  if (!ids.length) return ["SOURCE_FACTS_MISSING"];
  const active = index?.byId??new Map(currentFacts(data,index).map((f) => [f.id, f]));
  const issues = new Set<string>();
  for (const id of ids) {
    const cached=index?.lineageById.get(id);
    if(cached){for(const issue of cached)issues.add(issue);continue;}
    const factIssues=new Set<string>();
    const fact = active.get(id);
    if (!fact) { issues.add("STALE_OR_RETRACTED_FACT");index?.lineageById.set(id,["STALE_OR_RETRACTED_FACT"]);continue; }
    if (fact.state === "disputed" || fact.recognition === "rejected") factIssues.add("DISPUTED_OR_REJECTED_FACT");
    const validStructured = factHasValidStructuredRefs(data, fact);
    if (fact.structuredRefs !== undefined ? !validStructured : !fact.refs.length || fact.refs.some((ref) => !validSourceRef(data, ref,index))) factIssues.add("SOURCE_REFERENCE_INVALID");
    if (fact.state !== "verified") factIssues.add("SOURCE_VERIFICATION_REQUIRED");
    const proof = fact.sourceVerification;
    if (proof) {
      const sourceDocumentId = typeof proof.source?.documentId === "string" ? proof.source.documentId : "";
      const sourcePage = Number.isSafeInteger(proof.source?.page) ? proof.source.page : -1;
      const sourceHash = typeof proof.source?.sha256 === "string" ? proof.source.sha256 : "";
      const document = index?.documentsById.get(sourceDocumentId)??data.documents.find((d) => d.id === sourceDocumentId);
      const quote = typeof proof.field?.quote === "string" ? proof.field.quote : "";
      const boundRef = !!quote && fact.refs.some((r) => r.documentId === sourceDocumentId && r.page === sourcePage && r.quote.normalize("NFKC").trim() === quote.normalize("NFKC").trim() && r.sourceHash === sourceHash);
      const locator=proof.field?.locator;
      const bboxBoundRef=!!locator&&fact.refs.some(r=>r.documentId===sourceDocumentId&&r.page===sourcePage&&r.quote.normalize("NFKC").trim()===quote.normalize("NFKC").trim()&&r.sourceHash===sourceHash&&sameSourceBBox(r.bbox,locator.bbox));
      const raw = fact.numeric?.rawValue ?? (typeof fact.value === "string" ? fact.value : null);
      const validBinding = proof.factBinding?.id === fact.id && proof.factBinding.logicalId === fact.logicalId && proof.factBinding.version === fact.version;
      const categoryStatusRequired=requiresRecordCategoryStatus(proof.promptVersion);
      const validProofReads = Array.isArray(proof.proofReads) && proof.proofReads.length > 0 && typeof proof.field?.value === "string" && proof.proofReads.every(p => p.model === proof.model && typeof p.promptVersion === "string" && !!p.promptVersion.trim() && (p.categoryStatus===undefined||p.categoryStatus==="supported") && (!categoryStatusRequired&&!requiresRecordCategoryStatus(p.promptVersion)||p.categoryStatus==="supported") && typeof p.promptHash === "string" && /^[a-f0-9]{64}$/i.test(p.promptHash) && Number.isFinite(Date.parse(p.verifiedAt)) && p.fieldIndex >= 0 && p.recordIndex >= 0 && ["agrees","corrected"].includes(p.status) && typeof p.value === "string" && p.value.normalize("NFKC").trim() === proof.field.value.normalize("NFKC").trim() && (p.unit===null?proof.field.unit===null:typeof proof.field.unit==="string"&&p.unit.normalize("NFKC").trim()===proof.field.unit.normalize("NFKC").trim()) && typeof p.quote === "string" && !!p.quote.trim()) && Array.isArray(proof.proofReadIndexes) && proof.proofReads.length === proof.proofReadIndexes.length;
      const validNumeric = !fact.numeric || fact.numeric.normalizationStatus === "exact" && fact.numeric.amountWon !== null && typeof proof.field?.unit === "string" && fact.numeric.unit.normalize("NFKC").trim() === proof.field.unit.normalize("NFKC").trim() && normalizeMoney(raw, proof.field.unit).amountWon === fact.numeric.amountWon;
      const validSourceUnit = !Object.hasOwn(fact,"sourceUnit") || (fact.sourceUnit===null ? proof.field?.unit===null : typeof fact.sourceUnit==="string" && typeof proof.field?.unit==="string" && fact.sourceUnit.normalize("NFKC").trim()===proof.field.unit.normalize("NFKC").trim());
      const validProofIndexBinding = Array.isArray(proof.proofReadIndexes) && Array.isArray(proof.proofReads) && Array.isArray(proof.verificationQuotes) && proof.proofReads.every((p,i)=>p.pass===proof.proofReadIndexes[i]?.pass&&p.recordIndex===proof.proofReadIndexes[i]?.recordIndex&&p.fieldIndex===proof.proofReadIndexes[i]?.fieldIndex&&p.quote===proof.verificationQuotes[i]);
      const parsedFingerprint=(()=>{try{const parsed=JSON.parse(proof.fieldFingerprint);return Array.isArray(parsed)?parsed:null;}catch{return null;}})();
      const fingerprintHasMeaningScope=!!parsedFingerprint&&parsedFingerprint[10]==="field_meaning_v1";
      const hasMeaningReadMetadata=Array.isArray(proof.proofReads)&&proof.proofReads.some(p=>Object.hasOwn(p,"meaningStatus"));
      let validLocator=true;
      if(locator){
        const locatorSegment=(()=>{if(locator.version!=="bbox_v1"||!isValidSourceBBox(locator.bbox)||!isValidSourceBBox(proof.extractionReading?.bbox)||!sameSourceBBox(proof.extractionReading.bbox,locator.bbox)||!Array.isArray(proof.proofReads)||proof.proofReads.some(p=>!isValidSourceBBox(p.bbox)||!sameSourceBBox(p.bbox,locator.bbox)))return null;return bboxLocatorFingerprintSegment({locator,extractionBBox:proof.extractionReading.bbox,proofBBoxes:proof.proofReads.map(p=>p.bbox!)});})();
        validLocator=!!locatorSegment&&bboxBoundRef&&fingerprintHasBBoxLocator(proof.fieldFingerprint,locatorSegment);
      }else{
        const hasExtendedLocatorMarker=!!parsedFingerprint&&!!parsedFingerprint[11]&&typeof parsedFingerprint[11]==="object"&&Object.hasOwn(parsedFingerprint[11],"locatorVersion");
        if(proof.extractionReading?.bbox!==undefined||Array.isArray(proof.proofReads)&&proof.proofReads.some(p=>p.bbox!==undefined)||hasExtendedLocatorMarker)validLocator=false;
      }
      const fingerprintGeometry=parsedFingerprint?.find(item=>!!item&&typeof item==="object"&&Object.hasOwn(item,"bbox_corroboration")) as {bbox_corroboration?:unknown}|undefined;
      let validGeometry=!proof.geometry&&!fingerprintGeometry;
      if(proof.geometry){
        const geometry=proof.geometry,geometryMarker=!!fingerprintGeometry&&JSON.stringify(fingerprintGeometry.bbox_corroboration)===JSON.stringify(geometry);
        const validGeometryShape=geometry.version==="bbox_corroboration_v1"&&isValidSourceBBox(geometry.finalBBox)&&(geometry.extractionBBox===null||isValidSourceBBox(geometry.extractionBBox))&&Array.isArray(geometry.verifierReads)&&geometry.verifierReads.length>0;
        const validGeometryReads=validGeometryShape&&geometry.verifierReads.every(read=>!!read&&typeof read==="object"&&["verify","repair"].includes(read.pass)&&read.model===proof.model&&typeof read.promptVersion==="string"&&!!read.promptVersion.trim()&&/^[a-f0-9]{64}$/i.test(read.promptHash)&&Number.isFinite(Date.parse(read.verifiedAt))&&Number.isSafeInteger(read.recordIndex)&&read.recordIndex>=0&&Number.isSafeInteger(read.fieldIndex)&&read.fieldIndex>=0&&read.meaningStatus==="supported"&&(read.categoryStatus===undefined||read.categoryStatus==="supported")&&(!categoryStatusRequired&&!requiresRecordCategoryStatus(read.promptVersion)||read.categoryStatus==="supported")&&["agrees","corrected"].includes(read.status)&&read.value===proof.field?.value&&(read.unit===null?proof.field?.unit===null:typeof proof.field?.unit==="string"&&read.unit.normalize("NFKC").trim()===proof.field.unit.normalize("NFKC").trim())&&sourceQuotesOverlap(read.quote,proof.field?.quote)&&isValidSourceBBox(read.bbox)&&sourceReceiptBBoxIoU(read.bbox,geometry.finalBBox)>=SOURCE_RECEIPT_BBOX_IOU);
        const geometryRefBound=fact.refs.some(ref=>ref.documentId===sourceDocumentId&&ref.page===sourcePage&&ref.quote.normalize("NFKC").trim()===quote.normalize("NFKC").trim()&&ref.sourceHash===sourceHash&&sameSourceBBox(ref.bbox,geometry.finalBBox));
        const needsTwoReads=!geometry.extractionBBox||sourceReceiptBBoxIoU(geometry.extractionBBox,geometry.finalBBox)<SOURCE_RECEIPT_BBOX_IOU;
        const passKinds=new Set(Array.isArray(geometry.verifierReads)?geometry.verifierReads.filter(read=>!!read&&typeof read==="object").map(read=>read.pass):[]);
        validGeometry=geometryMarker&&validGeometryReads&&Array.isArray(geometry.verifierReads)&&passKinds.size===geometry.verifierReads.length&&geometryRefBound&&(!needsTwoReads||geometry.verifierReads.length>=2&&passKinds.size>=2);
      }
      const validFieldMeaning=proof.verificationScope==="field_meaning_v1"?fingerprintHasMeaningScope&&Array.isArray(proof.proofReads)&&proof.proofReads.length>0&&proof.proofReads.every(p=>p.meaningStatus==="supported"&&sourceQuotesOverlap(p.quote,proof.field?.quote))&&Array.isArray(proof.verificationQuotes)&&proof.verificationQuotes.length===proof.proofReads.length&&proof.proofReads.every((p,i)=>p.quote===proof.verificationQuotes[i]&&sourceQuotesOverlap(proof.verificationQuotes[i],proof.field?.quote))&&validLocator&&validGeometry:proof.verificationScope===undefined&&!fingerprintHasMeaningScope&&!hasMeaningReadMetadata&&!locator&&validLocator&&validGeometry;
      if (fact.state !== "verified" || proof.method !== "independent_luna_cross_read" || !isEvidenceModel(proof.model) || typeof proof.promptVersion !== "string" || !proof.promptVersion.trim() || !/^[a-f0-9]{64}$/i.test(sourceHash) || !Number.isFinite(Date.parse(proof.verifiedAt)) || proof.recognition !== "unreviewed" || !document || document.status!=="active" || document.sha256 !== sourceHash || !document.pages.includes(sourcePage) || !boundRef || !validBinding || !validProofReads || !validProofIndexBinding || !validNumeric || !validSourceUnit || !validFieldMeaning || raw === null || typeof proof.field?.value !== "string" || String(raw).normalize("NFKC").trim() !== proof.field.value.normalize("NFKC").trim() || typeof proof.extractionReading?.quote !== "string" || !proof.extractionReading.quote.trim() || typeof proof.extractionReading.value !== "string") factIssues.add("SOURCE_VERIFICATION_RECEIPT_INVALID");
    }
    const normalized=[...factIssues];index?.lineageById.set(id,normalized);for(const issue of normalized)issues.add(issue);
  }
  return [...issues];
}

/** Compatibility helper; source verification and normative recognition remain distinct checks. */
export function factLineageIssues(data: CaseData, ids: string[], index?:CaseReadIndex): string[] {
  const issues = new Set(factSourceLineageIssues(data, ids,index));
  const active = index?.byId??new Map(currentFacts(data,index).map((f) => [f.id, f]));
  for (const id of ids) { const fact = active.get(id); if (fact && fact.recognition !== "accepted") issues.add("LEGAL_RECOGNITION_REQUIRED"); }
  return [...issues];
}

function invalidateExports(data: CaseData): void {
  if (!data.exportManifest) return;
  data.exportManifest.files = data.exportManifest.files.map((f) => f.status === "current" ? { ...f, status: "invalidated" } : f);
  data.exportManifest.reviews = { caseworker: null, lawyer: null };
}

export function touchCase(input: CaseData): CaseData {
  const data = structuredClone(input);
  data.context.revision += 1;
  invalidateExports(data);
  return data;
}

/** Source truth and legal recognition are separate, explicit review operations. */
export function reviewFact(input: CaseData, id: string, review: { state?: FactState; recognition?: Recognition; value?: Json; numeric?: NumericInput; sourceUnit?: string | null; actor: string; reason: string }): CaseData {
  if (!review.actor.trim() || !review.reason.trim()) throw new Error("확인자와 검토 사유가 필요합니다.");
  const prior = currentFacts(input).find((f) => f.id === id);
  if (!prior) throw new Error("현재 사실 버전이 아닙니다.");
  const unitProvided=Object.hasOwn(review,"sourceUnit");
  if(unitProvided&&review.sourceUnit!==null&&(typeof review.sourceUnit!=="string"||review.sourceUnit.length>64))throw new Error("원문 단위는 64자 이내 문자열 또는 미확인이어야 합니다.");
  const priorUnit=Object.hasOwn(prior,"sourceUnit")?prior.sourceUnit:prior.numeric?.unit??prior.sourceVerification?.field.unit??null;
  const sourceUnit=unitProvided?review.sourceUnit?.trim()||null:priorUnit;
  const value=review.value!==undefined?review.value:prior.value;
  const valueChanged=JSON.stringify(value)!==JSON.stringify(prior.value);
  const unitChanged=unitProvided&&(sourceUnit??null)!==(priorUnit??null);
  let numeric=review.numeric;
  // A ledger correction must never retain an amount normalized from the old value or scale.
  // Missing/foreign units stay blocked; the dedicated object editor still owns remapping.
  if(numeric===undefined&&(valueChanged||unitChanged)&&(prior.numeric||isSourceMoney(prior.key,sourceUnit))){
    if(value!==null&&typeof value!=="string"&&typeof value!=="number")throw new Error("금액 정정에는 숫자 또는 원문 문자열이 필요합니다.");
    numeric=sourceUnit?normalizeMoney(value,sourceUnit):{...normalizeMoney(value,"unknown"),normalizationStatus:"review_required"};
  }
  if(unitProvided&&numeric&&numeric.unit!==(sourceUnit??"unknown"))throw new Error("정정한 원문 단위와 정규화 단위가 일치하지 않습니다.");
  const data = touchCase(input);
  const changed = valueChanged || unitChanged || numeric !== undefined && JSON.stringify(numeric) !== JSON.stringify(prior.numeric);
  const next: Fact = { ...prior, id: crypto.randomUUID(), version: prior.version + 1, supersedes: prior.id, reviewer: review.actor, reviewReason: review.reason, createdAt: new Date().toISOString(), state: review.state ?? (changed ? "reported" : prior.state), recognition: review.recognition ?? (changed ? "unreviewed" : prior.recognition) };
  delete next.sourceVerification;
  if(changed){delete next.fieldObservation;delete next.canonicalFieldId;}
  if(changed&&prior.fieldObservation){
    const old=prior.fieldObservation;
    for(const page of data.pages)for(const observation of page.fieldCoverage?.observations??[]){
      if(observation.documentId===old.documentId&&observation.page===old.page&&observation.sourceSha256===old.sourceSha256&&observation.recordIndex===old.recordIndex&&observation.fieldIndex===old.fieldIndex)observation.supersededByHumanFactId=next.id;
    }
  }
  if (review.value !== undefined) { next.value = value; if(valueChanged) next.rawValue=typeof value==="string"||typeof value==="number"?String(value):undefined; }
  if (numeric !== undefined) next.numeric = numeric;
  if (unitProvided) next.sourceUnit=sourceUnit??null;
  else if(review.numeric)next.sourceUnit=review.numeric.unit;
  if(numeric&&moneyValue(numeric)===null&&!next.validation.some(v=>v.code==="NORMALIZATION_REVIEW"))next.validation=[...next.validation,{code:"NORMALIZATION_REVIEW",message:"정정한 금액의 원문·통화·단위를 다시 확인하세요.",severity:"warning"}];
  if (next.state === "verified" && (!next.refs.length || next.refs.some((r) => !validSourceRef(data, r)))) throw new Error("유효한 원문 근거 없이 원문 확인을 완료할 수 없습니다.");
  if (next.recognition === "accepted" && next.state !== "verified") throw new Error("원문 확인을 완료한 사실만 인정 검토할 수 있습니다.");
  // Resolve only warnings this reviewer explicitly closed. The prior fact version retains the
  // original warning as history; unresolved conflicts and unit errors remain blocking.
  if (next.state === "verified") {
    const clearable = new Set(["USER_EDIT", "UNCERTAIN_READING", "VERIFY_DISAGREEMENT"]);
    if (next.numeric && moneyValue(next.numeric) !== null) {
      clearable.add("NORMALIZATION_REVIEW");
      clearable.add("MONETARY_UNIT_MISSING");
    }
    const resolved = next.validation.filter((v) => clearable.has(v.code) && v.severity !== "info");
    next.validation = next.validation.filter((v) => !clearable.has(v.code) || v.severity === "info");
    next.validation.push(...resolved.map((v) => ({ code: "RESOLVED_" + v.code, message: `${v.message} · ${review.actor}: ${review.reason}`, severity: "info" as const })));
  }
  if (next.state === "retracted") next.recognition = "rejected";
  data.facts.push(next);
  // Same value/status reviews may advance the entity's evidence reference safely.
  // Value changes intentionally invalidate object projection until the extractor/editor remaps it.
  if (!changed) {
    const remap = (ids: string[]) => ids.map((fid) => fid === prior.id ? next.id : fid);
    for (const group of [data.incomes, data.debts, data.assets, data.transactions]) for (const item of group) item.factIds = remap(item.factIds);
    data.household.factIds = remap(data.household.factIds);
  }
  return data;
}

/** Remove every descendant and withdraw all derived assertions, while retaining history. */
export function retractDocument(input: CaseData, documentId: string): CaseData {
  if (!input.documents.some((d) => d.id === documentId && d.status === "active")) throw new Error("현재 문서를 찾을 수 없습니다.");
  const data = touchCase(input);
  const ids = new Set([documentId]);
  let count = -1;
  while (count !== ids.size) {
    count = ids.size;
    for (const doc of data.documents) if (doc.parentId && ids.has(doc.parentId)) ids.add(doc.id);
  }
  const at = new Date().toISOString();
  for (const doc of data.documents) if (ids.has(doc.id)) { doc.status = "deleted"; doc.deletedAt = at; }
  for (const fact of currentFacts(data)) if (fact.refs.some((r) => ids.has(r.documentId))) {
    data.facts.push({ ...fact, id: crypto.randomUUID(), version: fact.version + 1, supersedes: fact.id, state: "retracted", recognition: "rejected", reviewReason: "원본 또는 상위 묶음 문서 철회", createdAt: at });
  }
  data.context.inventoryComplete = { income: "unknown", debt: "unknown", asset: "unknown" };
  return data;
}

export function extractionCacheKey(input: { documentId: string; documentHash: string; pages: number[]; mappingVersion: string; promptVersion: string; model: string; ruleReleaseId: string }): string {
  // Deliberately includes identity as cache values carry document/page references.
  return JSON.stringify([input.documentId, input.documentHash, [...input.pages].sort((a, b) => a - b), input.mappingVersion, input.promptVersion, input.model, input.ruleReleaseId]);
}

export interface ExtractionPayload {
  facts?: Partial<Fact>[];
  incomes?: IncomeSource[];
  debts?: Debt[];
  assets?: Asset[];
  transactions?: Transaction[];
  household?: Partial<Household>;
  pages?: EvidencePage[];
  /** Only a complete reread may withdraw prior automatic facts from these pages. */
  replacesPages?: { documentId: string; page: number }[];
  warnings?: string[];
}

const reviewFieldKey=(field:Partial<Fact>)=>{
  const normalized=(field.key??"").trim().replace(/([a-z0-9])([A-Z])/g,"$1_$2").toLowerCase();
  const insurance=insuranceReviewFieldKey(normalized,(field.refs??[]).map(ref=>ref.quote));
  if(insurance)return insurance;
  return normalized==="debt.outstanding_principal"?"debt.principal_balance":normalized;
};
function reviewedSourceField(prior:Fact,raw:Partial<Fact>,exact:boolean):boolean {
  if(reviewFieldKey(prior)!==reviewFieldKey(raw)||!raw.refs?.length)return false;
  const box=(ref:SourceRef)=>Array.isArray(ref.bbox)&&ref.bbox.length===4&&ref.bbox.every(n=>Number.isFinite(n)&&n>=0&&n<=1)&&ref.bbox[0]<ref.bbox[2]&&ref.bbox[1]<ref.bbox[3]?ref.bbox:null;
  const quote=(value:string)=>value.normalize("NFKC").trim();
  return raw.refs.every(ref=>prior.refs.some(old=>{
    if(ref.documentId!==old.documentId||ref.page!==old.page||ref.sourceHash!==old.sourceHash)return false;
    const a=box(ref),b=box(old);
    if(a&&b)return JSON.stringify(a)===JSON.stringify(b)&&(!exact||quote(ref.quote)===quote(old.quote));
    // Record ordinals can move and a repeated quote is not a stable row anchor.
    // Preserve the old human decision, but leave this reread as a candidate.
    return false;
  }));
}

/** Untrusted extraction never grants source verification or legal acceptance. */
export function applyExtraction(input: CaseData, extraction: ExtractionPayload): CaseData {
  const data = touchCase(input);
  const idMap = new Map<string, string>();
  const blockedByManual=new Set<string>();
  // Keep the latest HUMAN decision even if a legacy automatic reread later
  // created a newer candidate. Only another human decision can supersede it.
  const humanDecisions=new Map<string,Fact>();
  const previousHeads=new Map<string,Fact>();
  for(const fact of input.facts){
    if(!previousHeads.has(fact.logicalId)||previousHeads.get(fact.logicalId)!.version<fact.version)previousHeads.set(fact.logicalId,fact);
    if(fact.reviewer&&(!humanDecisions.has(fact.logicalId)||humanDecisions.get(fact.logicalId)!.version<fact.version))humanDecisions.set(fact.logicalId,fact);
  }
  const humanByKey=new Map<string,Fact[]>();
  for(const fact of humanDecisions.values()){const key=reviewFieldKey(fact);humanByKey.set(key,[...(humanByKey.get(key)??[]),fact]);}
  const warnings = [...(extraction.warnings ?? [])];
  for (const page of extraction.pages ?? []) {
    if (!data.documents.some((d) => d.id === page.documentId && d.status === "active" && d.pages.includes(page.page))) { warnings.push("문서 범위 밖의 추출 페이지를 제외했습니다."); continue; }
    const previous = data.pages.find((p) => p.documentId === page.documentId && p.page === page.page);
    // A previously held-out or administrative page cannot be promoted by extraction.
    if (previous && ["filed_form", "administrative"].includes(previous.role)) continue;
    const index = data.pages.findIndex((p) => p.documentId === page.documentId && p.page === page.page);
    // Native text and the original image are source data, never model output.
    const merged = { ...previous, ...page, text: previous?.text, imageUrl: previous?.imageUrl };
    if (index >= 0) data.pages[index] = merged; else data.pages.push(merged);
  }
  const scope = new Set((extraction.replacesPages ?? []).filter((p) => data.pages.some((existing) => existing.documentId === p.documentId && existing.page === p.page && existing.role === "evidence") && data.documents.some((d) => d.id === p.documentId && d.status === "active" && d.pages.includes(p.page))).map((p) => `${p.documentId}:${p.page}`));
  const withdrawn = new Set<string>();
  const at = new Date().toISOString();
  for(const decision of [...humanDecisions.values()]){
    const head=previousHeads.get(decision.logicalId)!;
    const key=reviewFieldKey(decision),peers=humanByKey.get(key)!;
    const incoming=(extraction.facts??[]).filter(raw=>reviewedSourceField(decision,raw,false));
    const touched=decision.refs.every(ref=>scope.has(`${ref.documentId}:${ref.page}`))||incoming.length===1;
    if(head.version<=decision.version||head.reviewer||!touched||!decision.refs.length||decision.refs.some(ref=>!validSourceRef(data,ref))||peers.filter(other=>reviewedSourceField(other,decision,false)).length!==1)continue;
    // Repair a legacy machine overwrite by copying the recorded human decision;
    // this is a history-linked restoration, not a new review or source proof.
    const restored:Fact={...decision,id:crypto.randomUUID(),version:head.version+1,supersedes:head.id,createdAt:at,validation:[...decision.validation,{code:"RESTORED_HUMAN_DECISION",severity:"info",message:`기존 수동 판단 ${decision.id}을 가린 자동 버전 ${head.id} 이후에 동일 판단을 복원했습니다.`}]};
    data.facts.push(restored);humanDecisions.set(restored.logicalId,restored);humanByKey.set(key,peers.map(fact=>fact.id===decision.id?restored:fact));
    for(const group of [data.incomes,data.debts,data.assets,data.transactions])for(const item of group)item.factIds=item.factIds.map(id=>id===decision.id?restored.id:id);
    data.household.factIds=data.household.factIds.map(id=>id===decision.id?restored.id:id);
    warnings.push("과거 자동 버전이 가린 유효한 수동 판단을 원래 검토 기록에 연결하여 복원했습니다.");
  }
  for (const prior of currentFacts(data)) {
    if (!prior.refs.length || !prior.refs.every((ref) => scope.has(`${ref.documentId}:${ref.page}`))) continue;
    // Human-reviewed facts survive rereading. Machine cross-read facts are
    // source/version-bound and must be re-issued against the new reread.
    if (prior.reviewer || prior.state === "verified" && !prior.sourceVerification) continue;
    data.facts.push({ ...prior, id: crypto.randomUUID(), version: prior.version + 1, supersedes: prior.id, state: "retracted", recognition: "rejected", reviewReason: "완전한 페이지 재추출로 이전 자동 후보 철회", createdAt: at });
    withdrawn.add(prior.id);
  }
  const reviewedObject = (item: { recognition?: Recognition; legalReview?: Recognition }) => item.recognition === "accepted" || item.recognition === "rejected" || item.legalReview === "accepted" || item.legalReview === "rejected";
  const retain = <T extends { factIds: string[]; recognition?: Recognition; legalReview?: Recognition }>(items: T[]): T[] => items.filter((item) => !item.factIds.some((id) => withdrawn.has(id)) || reviewedObject(item));
  data.incomes = retain(data.incomes); data.debts = retain(data.debts); data.assets = retain(data.assets); data.transactions = retain(data.transactions);
  if (data.household.factIds.some((id) => withdrawn.has(id))) {
    data.household.factIds = data.household.factIds.filter((id) => !withdrawn.has(id));
    data.household.reportedMembers = null;
    data.household.recognition = "unreviewed";
  }
  for (const raw of extraction.facts ?? []) {
    if (!raw.key || !raw.subjectId || raw.value === undefined || Object.hasOwn(raw,"sourceUnit")&&raw.sourceUnit!==null&&typeof raw.sourceUnit!=="string" || !Array.isArray(raw.refs) || !raw.refs.length || raw.refs.some((r) => !validSourceRef(data, r))) { warnings.push("유효한 문서·페이지·원문 인용이 없는 사실 후보를 제외했습니다."); continue; }
    let logicalId = raw.logicalId || [raw.subjectId, raw.key, raw.periodStart ?? "", raw.periodEnd ?? "", raw.refs[0].documentId].join(":");
    const directDecision=humanDecisions.get(logicalId);
    const keyedDecisions=humanByKey.get(reviewFieldKey(raw))??[];
    const relatedDecisions=keyedDecisions.filter(fact=>reviewedSourceField(fact,raw,false));
    // A broad/shared coordinate cannot prove which source row was reviewed.
    const uniqueSource=relatedDecisions.length===1&&(extraction.facts??[]).filter(other=>reviewedSourceField(relatedDecisions[0],other,false)).length===1;
    if(uniqueSource&&relatedDecisions[0].state==="retracted"){
      if(raw.id)blockedByManual.add(raw.id);
      warnings.push("사람이 철회한 동일 원문 필드는 재판독·키 정규화로 다시 활성화하지 않았습니다. 변경이 필요하면 철회 판단을 직접 검토하세요.");
      continue;
    }
    // Include tombstones so a new extraction cannot restart at version 1 under an older version 2.
    let prior: Fact | undefined = data.facts.filter((f) => f.logicalId === logicalId).sort((a, b) => b.version - a.version)[0];
    const unlocatedCoincidence=keyedDecisions.some(fact=>raw.refs!.some(ref=>fact.refs.some(old=>ref.documentId===old.documentId&&ref.page===old.page&&ref.sourceHash===old.sourceHash&&ref.quote.normalize("NFKC").trim()===old.quote.normalize("NFKC").trim()&&(!ref.bbox||!old.bbox))));
    if(directDecision&&(!uniqueSource||!relatedDecisions.includes(directDecision))){
      // Parser row ordinals can move. A reused logical ID is not permission to
      // overwrite a human decision at a different/uncertain source location.
      logicalId+=":candidate:"+crypto.randomUUID();prior=undefined;
      warnings.push("행 순서 또는 원문 위치가 기존 수동 판단과 달라 자동 연결하지 않고 상충 후보로 보존했습니다.");
    }else if(!directDecision&&(relatedDecisions.length||unlocatedCoincidence)){
      const exact=relatedDecisions.filter(fact=>reviewedSourceField(fact,raw,true));
      if(uniqueSource&&exact.length===1&&exact[0].subjectId===raw.subjectId){prior=exact[0];logicalId=prior.logicalId;}
      else {logicalId+=":candidate:"+crypto.randomUUID();prior=undefined;warnings.push("기존 수동 검토와 겹치는 원문 필드의 연결이 불확실하여 별도 상충 후보로 보존했습니다.");}
    }
    if (prior && prior.state !== "retracted" && (prior.state === "verified" || prior.reviewer)) {
      const sameSource = JSON.stringify(prior.refs.map(r => [r.documentId,r.page,r.quote,r.sourceHash,r.bbox??null])) === JSON.stringify((raw.refs ?? []).map(r => [r.documentId,r.page,r.quote,r.sourceHash,r.bbox??null]));
      const priorSourceUnit=Object.hasOwn(prior,"sourceUnit")?prior.sourceUnit:prior.sourceVerification?.field?.unit??(prior.numeric?.unit&&prior.numeric.unit!=="unknown"?prior.numeric.unit:null);
      const sameSourceUnit=(a:string|null|undefined,b:string|null|undefined)=>a==null&&b==null||typeof a==="string"&&typeof b==="string"&&a.normalize("NFKC").trim()===b.normalize("NFKC").trim();
      const sameReading = JSON.stringify(prior.value) === JSON.stringify(raw.value) && JSON.stringify(prior.numeric ?? null) === JSON.stringify(raw.numeric ?? null) && (!Object.hasOwn(raw,"sourceUnit") || sameSourceUnit(priorSourceUnit,raw.sourceUnit as string|null|undefined));
      if (sameReading && sameSource) { if (raw.id) idMap.set(raw.id, prior.id); continue; }
      if (prior.sourceVerification && (!sameReading || !sameSource)) {
        const tombstone:Fact={ ...prior, id: crypto.randomUUID(), version: prior.version + 1, supersedes: prior.id, state: "retracted", recognition: "rejected", sourceVerification: undefined, reviewReason: "기계 교차판독 사실의 원문·값이 변경되어 증명을 무효화했습니다.", createdAt: at };
        data.facts.push(tombstone);prior = tombstone;
      } else {
      logicalId += ":candidate:" + crypto.randomUUID();
      warnings.push("검토 완료 사실과 다른 추출값을 별도 충돌 후보로 보존했습니다.");
      prior = undefined;
      }
    }
    const id = crypto.randomUUID();
    if (raw.id) idMap.set(raw.id, id);
    const validation = (Array.isArray(raw.validation) ? raw.validation : []).filter((v) => v && typeof v.code === "string" && typeof v.message === "string" && ["info", "warning", "error"].includes(v.severity)).map((v) => ({ code: v.code, message: v.message, severity: v.severity }));
    const observed=raw.fieldObservation;
    const safeObservation=observed&&typeof observed=== "object"&&observed.applicability&&typeof observed.label==="string"&&observed.documentId===raw.refs[0].documentId&&observed.page===raw.refs[0].page&&observed.sourceSha256===raw.refs[0].sourceHash&&observed.rawValue===raw.value&&observed.quote===raw.refs[0].quote&&observed.rawUnit===(raw.sourceUnit??null)&&JSON.stringify(observed.bbox)===JSON.stringify(raw.refs[0].bbox??null)?observeField(data.pages.find(p=>p.documentId===observed.documentId&&p.page===observed.page)?.documentType??"",{key:raw.key,label:observed.label,value:observed.rawValue,unit:observed.rawUnit,quote:observed.quote,bbox:observed.bbox,confidence:observed.extractionState==="value_read"?"clear":"uncertain",canonicalFieldId:observed.canonicalFieldId,sourceState:observed.sourceState,applicability:observed.applicability.sourceClaim,applicabilityQuote:observed.applicability.quote,verificationState:observed.verificationState},{documentId:observed.documentId,page:observed.page,sourceSha256:observed.sourceSha256},observed.recordIndex,observed.fieldIndex):undefined;
    const fact: Fact = { ...(safeObservation?{fieldObservation:safeObservation,canonicalFieldId:safeObservation.canonicalFieldId??undefined}:{}), id, logicalId, version: (prior?.version ?? 0) + 1, supersedes: prior?.id, subjectId: raw.subjectId, key: raw.key, value: raw.value, rawValue: raw.rawValue, ...(Object.hasOwn(raw,"sourceUnit")?{sourceUnit:raw.sourceUnit as string|null}:{}), numeric: raw.numeric, periodStart: raw.periodStart, periodEnd: raw.periodEnd, asOf: raw.asOf, state: logicalId.includes(":candidate:") ? "disputed" : "extracted", recognition: "unreviewed", refs: raw.refs, validation, createdAt: at };
    if (raw.numeric && moneyValue(raw.numeric) === null) fact.validation.push({ code: "NORMALIZATION_REVIEW", message: "원문 금액·통화·단위를 다시 확인하세요.", severity: "warning" });
    data.facts.push(fact);
  }
  const active = new Set(currentFacts(data).map((f) => f.id));
  function merge<T extends { id: string; factIds: string[]; recognition?: Recognition; legalReview?: Recognition }>(existing: T[], received: T[]): T[] {
    const result = [...existing];
    for (const raw of received) {
      if((raw.factIds??[]).some(id=>blockedByManual.has(id))){warnings.push("수동 철회한 원문 필드를 포함한 객체는 재판독으로 덮어쓰지 않았습니다.");continue;}
      const ids = (raw.factIds ?? []).map((id) => idMap.get(id) ?? id);
      if (!raw.id || !ids.length || ids.some((id) => !active.has(id))) { warnings.push("현재 사실 근거와 연결되지 않은 객체 후보를 제외했습니다."); continue; }
      const item = { ...raw, factIds: ids };
      if ("recognition" in item) item.recognition = "unreviewed";
      if ("legalReview" in item) item.legalReview = "unreviewed";
      if ("guaranteeDetails" in item && item.guaranteeDetails) {
        const details = (item as typeof item & { guaranteeDetails?: Debt["guaranteeDetails"] }).guaranteeDetails!;
        (item as typeof item & { guaranteeDetails?: Debt["guaranteeDetails"] }).guaranteeDetails = { ...details, capTreatment: "unknown", capTreatmentReviewed: false, reviewReason: undefined };
      }
      if ("aggregationTreatment" in item || "payerIdentityId" in item || "aggregationReviewed" in item || "aggregationReviewReason" in item) {
        const income = item as typeof item & Pick<IncomeSource, "aggregationTreatment" | "aggregationReviewed" | "aggregationReviewReason">;
        income.aggregationTreatment = "unknown";
        income.aggregationReviewed = false;
        income.aggregationReviewReason = undefined;
      }
      const index = result.findIndex((e) => e.id === item.id);
      if (index >= 0 && reviewedObject(result[index])) {
        // Preserve the decision and amounts while retaining new source-reader
        // incompleteness. An unresolved slot is metadata, not a replacement fact.
        if("sourceComponentIssues" in item&&Array.isArray(item.sourceComponentIssues)){
          const prior=result[index] as T & Pick<Debt,"sourceComponentIssues">;
          const incomingIssues=item.sourceComponentIssues.filter((key):key is string=>typeof key==="string");
          const sourceFields=(extraction.facts??[]).filter(fact=>fact.subjectId===item.id);
          const anchors=prior.factIds.map(id=>input.facts.find(fact=>fact.id===id)).filter((fact):fact is Fact=>!!fact&&["debt.principal","debt.principal_balance","debt.outstanding_principal","debt.interest"].includes(fact.key));
          const matchedRow=anchors.length>0&&anchors.every(fact=>fact.refs.length>0&&fact.refs.every(ref=>scope.has(`${ref.documentId}:${ref.page}`))&&sourceFields.filter(raw=>reviewedSourceField(fact,raw,true)).length===1);
          const resolvedSlots=new Set(matchedRow?sourceFields.filter(fact=>fact.key&&debtComponentSlotKey(fact.key)&&fact.value!==null&&fact.value!==undefined&&fact.refs?.length&&fact.refs.every(ref=>scope.has(`${ref.documentId}:${ref.page}`)&&validSourceRef(data,ref))&&!fact.validation?.some(issue=>issue.severity==="error"||issue.code==="UNCERTAIN_READING")&&moneyValue(fact.numeric)!==null).map(fact=>debtComponentSlotKey(fact.key!)):[]);
          // Missing slots cannot clear earlier uncertainty. Only a complete reread
          // of the exact amount row with an explicit usable replacement can do so.
          // The replacement fact still needs its independent source verification.
          prior.sourceComponentIssues=[...new Set([...(prior.sourceComponentIssues??[]).filter(key=>!resolvedSlots.has(debtComponentSlotKey(key))),...incomingIssues])];
        }
        warnings.push("인정 검토한 객체는 자동 재추출로 덮어쓰지 않았습니다. 최신 근거와 대조하세요."); continue;
      }
      if (index >= 0) result[index] = item; else result.push(item);
    }
    return result;
  }
  data.incomes = merge(data.incomes, extraction.incomes ?? []);
  if (extraction.incomes?.length) data.context.incomePeriodReviewed = false;
  data.debts = merge(data.debts, extraction.debts ?? []).map((d) => {
    if (!(extraction.debts ?? []).some((e) => e.id === d.id) || reviewedObject(d)) return d;
    return { ...d, legalReview: "unreviewed", excludedByReview: false, exclusionReason: undefined };
  });
  data.assets = merge(data.assets, extraction.assets ?? []);
  data.transactions = merge(data.transactions, extraction.transactions ?? []);
  // Reported household size may be extracted; recognized living costs are human/legal inputs.
  if (extraction.household?.reportedMembers !== undefined) data.household.reportedMembers = extraction.household.reportedMembers;
  if (extraction.household?.factIds) data.household.factIds = [...new Set([...data.household.factIds, ...extraction.household.factIds.map((id) => idMap.get(id) ?? id).filter((id) => active.has(id))])];
  data.extractionWarnings = [...new Set([...(data.extractionWarnings ?? []), ...warnings])];
  return data;
}

export function manifestFingerprint(manifest: ExportManifest): string {
  return JSON.stringify([manifest.caseRevision, manifest.mode ?? "draft", [...manifest.requiredKinds].sort(), manifest.files.filter((f) => f.status === "current").map((f) => [f.id, f.kind, f.hash]).sort((a, b) => a[0].localeCompare(b[0]))]);
}
export function manifestIssues(data: CaseData): string[] {
  const m = data.exportManifest;
  if (!m || m.caseRevision !== data.context.revision) return ["현재 사건 버전의 생성물이 없습니다."];
  const current = m.files.filter((f) => f.status === "current" && !!f.hash);
  return [...new Set([...requiredKindsForCase(data), ...m.requiredKinds])].filter((kind) => !current.some((f) => f.kind === kind)).map((kind) => `필수 생성물 누락: ${kind}`);
}
/** Saved review records remain on the manifest as history; only records bound
 * to the complete current final manifest are surfaced as current approvals. */
export function currentExportReviews(data: CaseData): ExportManifest["reviews"] {
  const manifest = data.exportManifest;
  const none = { caseworker: null, lawyer: null } as const;
  if (!manifest || manifest.mode !== "final" || manifest.caseRevision !== data.context.revision || manifestIssues(data).length) return none;
  const fingerprint = manifestFingerprint(manifest);
  const isCurrent = (record: ReviewRecord | null | undefined): record is ReviewRecord => !!record && !!record.actor.trim() && record.actor.trim() !== "private-site-service" && record.caseRevision === data.context.revision && record.manifestFingerprint === fingerprint;
  const caseworker = isCurrent(manifest.reviews?.caseworker) ? manifest.reviews.caseworker : null;
  const lawyer = caseworker && isCurrent(manifest.reviews?.lawyer) ? manifest.reviews.lawyer : null;
  return { caseworker, lawyer };
}
export function archiveExport(input: CaseData, id: string): CaseData {
  const data = structuredClone(input);
  const file = data.exportManifest?.files.find((f) => f.id === id && f.status === "current");
  if (!file || !data.exportManifest) throw new Error("현재 생성물을 찾을 수 없습니다.");
  file.status = "archived";
  data.exportManifest.reviews = { caseworker: null, lawyer: null };
  return data;
}
export function reviewExport(input: CaseData, role: "caseworker" | "lawyer", actor: string, expectedFingerprint: string): CaseData {
  if (!actor.trim() || actor === "private-site-service") throw new Error("인증된 사용자 확인이 필요합니다.");
  const issues = manifestIssues(input);
  if (issues.length) throw new Error(issues.join(" / "));
  const data = structuredClone(input);
  const manifest = data.exportManifest!;
  if (manifest.mode !== "final") throw new Error("최종 검토본을 생성한 뒤 검수 기록을 남길 수 있습니다.");
  const fingerprint = manifestFingerprint(manifest);
  if (fingerprint !== expectedFingerprint) throw new Error("검토한 생성물 집합이 변경되었습니다.");
  if (role === "lawyer" && currentExportReviews(data).caseworker?.manifestFingerprint !== fingerprint) throw new Error("현재 생성물 전체의 담당자 검수가 먼저 필요합니다.");
  if (role === "caseworker") manifest.reviews.lawyer = null;
  manifest.reviews[role] = { actor, at: new Date().toISOString(), caseRevision: data.context.revision, manifestFingerprint: fingerprint };
  return data;
}

/** Machine-readable interface summary for model routing; response must still be validated. */
export const EXTRACTION_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    facts: {
      type: "array",
      items: {
        type: "object", required: ["id", "subjectId", "key", "value", "refs"],
        properties: {
          id: { type: "string" }, subjectId: { type: "string" }, key: { type: "string" }, value: {},
          refs: {
            type: "array", minItems: 1,
            items: {
              type: "object", required: ["documentId", "page", "quote"],
              properties: {
                documentId: { type: "string" }, page: { type: "integer", minimum: 1 },
                quote: { type: "string", minLength: 1 },
                bbox: { type: "array", items: { type: "number" }, minItems: 4, maxItems: 4 },
              },
            },
          },
        },
      },
    },
    incomes: { type: "array" }, debts: { type: "array" }, assets: { type: "array" }, household: { type: "object" }, transactions: { type: "array" }, pages: { type: "array" }, warnings: { type: "array", items: { type: "string" } },
  }, required: ["facts"],
} as const;
