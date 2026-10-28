import { currentFacts, touchCase, validSourceRef, moneyValue, normalizeMoney, type Asset, type CaseData, type Debt, type Fact, type IncomeSource, type Json, type NumericInput, type ReferenceTestProvenance, type Transaction } from "./domain.ts";
import { isValidSourceBBox } from "./source-verification-identity.ts";
import { projectReferenceCaseDataset } from "./reference-case-projection.ts";

export type ReferencePresenceState = "present" | "absent" | "unknown" | "masked" | "conflict";
export interface ReferencePageBinding { page: number; sourceRole: "evidence" | "filed_form" | "administrative" | "unknown"; targetRole: "evidence" | "filed_form" | "administrative" | "unknown" }
export interface ReferenceDocumentBinding { sourceDocumentId: string; targetDocumentId: string; sourceSha256: string; targetSha256: string; pages: ReferencePageBinding[] }
export interface ReferenceSourceRef { sourceCaseId: string; sourceDocumentId: string; page: number; sourceHash: string; quote: string; bbox?: number[] }
export interface ReferenceFieldObservation {
  fieldId: string; canonicalKey: string; rawSourceKey: string; subjectType: "case" | "household" | "income" | "debt" | "asset" | "transaction";
  groupKey?: string; rowIndex?: number; presenceState: ReferencePresenceState; value: Json | null; rawValue?: string; sourceUnit?: string | null; numeric?: NumericInput;
  periodStart?: string; periodEnd?: string; asOf?: string; confidence?: "clear" | "uncertain" | "unreadable"; notes?: string;
  sourceMetadata?: { familyId: string; localId: string; partyRole?: string; temporalRole?: string; amountRole?: string; sourceLabel?: string; origin?: string; sourceRowId?: string; normalizedValue: Json | null };
  refs: ReferenceSourceRef[];
}
export interface ReferenceObjectRow { groupKey: string; rowIndex: number; fieldBindings: Record<string, string> }
export interface ReferenceTestDataset {
  schemaVersion: "firmengine-reference-test-dataset/v1"; sourceCaseId: string; version: string; documents: ReferenceDocumentBinding[];
  fields: ReferenceFieldObservation[];
  objects: { incomes: ReferenceObjectRow[]; debts: ReferenceObjectRow[]; assets: ReferenceObjectRow[]; transactions: ReferenceObjectRow[]; household?: { fieldBindings: Record<string, string> } };
  applicant?: { fieldBindings: Partial<Record<"name" | "address" | "residentIdMasked" | "statement", string>> };
}

export class ReferenceImportError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; this.name = "ReferenceImportError"; }
}
function fail(message: string, status = 400): never { throw new ReferenceImportError(message, status); }
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const sha256Pattern = /^[a-f0-9]{64}$/;
const hash = async (bytes: Uint8Array) => { const copy = new Uint8Array(bytes); return [...new Uint8Array(await crypto.subtle.digest("SHA-256", copy.buffer))].map(value => value.toString(16).padStart(2, "0")).join(""); };
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function canonicalReferenceDatasetJson(dataset: ReferenceTestDataset): string { return canonical(dataset); }
export async function referenceDatasetSha256(dataset: ReferenceTestDataset): Promise<string> {
  return hash(new TextEncoder().encode(canonicalReferenceDatasetJson(dataset)));
}
const validPresence = (value: unknown): value is ReferencePresenceState => ["present", "absent", "unknown", "masked", "conflict"].includes(String(value));
const targetObjectId = async (caseId: string, collection: string, groupKey: string, rowIndex: number) => `ref-${(await hash(new TextEncoder().encode(`${caseId}\u0000${collection}\u0000${groupKey}\u0000${rowIndex}`))).slice(0, 32)}`;
const objectKeys: Record<"incomes" | "debts" | "assets" | "transactions", Set<string>> = {
  incomes: new Set(["label", "kind", "employer", "payerIdentityId", "gross", "expenses", "net", "periodStart", "periodEnd", "periodMonths", "amountBasis", "recurring"]),
  debts: new Set(["creditor", "contractId", "principal", "interest", "secured", "classification", "asOf", "dueDate", "priority"]),
  assets: new Set(["label", "kind", "grossValue", "securedPayoff", "securedPayoffScope", "disposalCosts", "protectedValue", "ownershipBps", "asOf", "valuationBasis"]),
  transactions: new Set(["date", "accountId", "counterparty", "kind", "direction", "amount", "relatedObjectId"]),
};
const numericObjectKeys = new Set(["gross", "expenses", "net", "principal", "interest", "grossValue", "securedPayoff", "disposalCosts", "protectedValue", "amount"]);
function ensureOpaque(value: unknown, label: string, max = 200): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > max) fail(`${label} is required and must be at most ${max} characters.`);
}
function sourceRefForTarget(ref: ReferenceSourceRef, binding: ReferenceDocumentBinding): { documentId: string; page: number; sourceHash: string; quote: string; bbox?: [number, number, number, number] } {
  return { documentId: binding.targetDocumentId, page: ref.page, sourceHash: binding.targetSha256, quote: ref.quote, ...(ref.bbox ? { bbox: ref.bbox as [number, number, number, number] } : {}) };
}

export async function prepareReferenceCaseImport(input: {
  data: CaseData; targetCaseId: string; expectedRevision: number; dataset: ReferenceTestDataset; datasetSha256: string; importReason: string; actor: string;
}): Promise<{ data: CaseData; summary: Record<string, unknown>; noOp: boolean }> {
  const { data, targetCaseId, expectedRevision, datasetSha256, importReason, actor } = input;
  let dataset = input.dataset;
  if (data.context.id !== targetCaseId || data.context.revision !== expectedRevision) fail("The target case or revision changed; reload and preview again.", 409);
  if (!data.context.caseName.startsWith("합성 추출평가 ")) fail("Reference datasets can be imported only into a case explicitly named for synthetic extraction evaluation.", 403);
  ensureOpaque(dataset?.sourceCaseId, "dataset.sourceCaseId"); ensureOpaque(dataset?.version, "dataset.version", 120); ensureOpaque(importReason, "importReason", 2000); ensureOpaque(actor, "actor");
  if (!dataset || dataset.schemaVersion !== "firmengine-reference-test-dataset/v1" || !Array.isArray(dataset.documents) || !Array.isArray(dataset.fields) || !isRecord(dataset.objects)) fail("The reference dataset schema is not supported.");
  if (!sha256Pattern.test(datasetSha256) || await referenceDatasetSha256(dataset) !== datasetSha256) fail("The reference dataset digest does not match its canonical content.", 409);
  const rawDatasetSha256 = datasetSha256;
  const projected = projectReferenceCaseDataset(dataset);
  dataset = projected.dataset;
  const projectedDatasetSha256 = await referenceDatasetSha256(dataset);
  if (data.referenceTest && data.referenceTest.mode !== "synthetic_reference_only") fail("The case has an incompatible reference-test marker.", 409);
  if (currentFacts(data).some(fact => !!fact.reviewer || fact.recognition === "accepted" || fact.recognition === "rejected") || data.incomes.some(item => item.recognition === "accepted" || item.recognition === "rejected" || item.aggregationReviewed === true) || data.debts.some(item => item.legalReview === "accepted" || item.legalReview === "rejected") || data.assets.some(item => item.recognition === "accepted" || item.recognition === "rejected") || data.household.recognition === "accepted" || data.context.ruleApplicationReviewed || data.context.assetValuationBasisReviewed || data.context.presentValueReviewed || data.context.allocationBasisReviewed) fail("A case with human-reviewed facts or decisions cannot be replaced by a reference dataset.", 409);

  const activeDocuments = data.documents.filter(document => document.status === "active");
  const bindings = new Map<string, ReferenceDocumentBinding>();
  const targetIds = new Set<string>();
  for (const binding of dataset.documents) {
    ensureOpaque(binding.sourceDocumentId, "sourceDocumentId"); ensureOpaque(binding.targetDocumentId, "targetDocumentId");
    if (!sha256Pattern.test(binding.sourceSha256) || binding.sourceSha256 !== binding.targetSha256 || !Array.isArray(binding.pages)) fail("Document source hashes must exactly match each other and be SHA-256 values.");
    if (bindings.has(binding.sourceDocumentId) || targetIds.has(binding.targetDocumentId)) fail("Document bindings must be unique.");
    const target = activeDocuments.find(document => document.id === binding.targetDocumentId);
    if (!target || target.sha256 !== binding.targetSha256 || target.name !== `synthetic-${target.sha256.slice(0, 12)}.pdf`) fail("A target document is not an exact synthetic document binding.", 409);
    if (binding.pages.length !== target.pages.length || new Set(binding.pages.map(page => page.page)).size !== binding.pages.length) fail("Page bindings must cover each target document page exactly once.");
    for (const pageBinding of binding.pages) {
      const page = data.pages.find(item => item.documentId === target.id && item.page === pageBinding.page);
      if (!page || !target.pages.includes(pageBinding.page) || pageBinding.sourceRole !== page.role || pageBinding.targetRole !== page.role) fail("A source page role or page binding differs from the target case.", 409);
    }
    bindings.set(binding.sourceDocumentId, binding); targetIds.add(binding.targetDocumentId);
  }
  if (bindings.size !== activeDocuments.length || activeDocuments.some(document => !targetIds.has(document.id))) fail("The dataset must bind every active target document and no others.", 409);

  if (dataset.fields.length > 10000 || new Set(dataset.fields.map(field => field.fieldId)).size !== dataset.fields.length) fail("Field IDs must be unique and the dataset is limited to 10,000 fields.");
  const fields = new Map<string, ReferenceFieldObservation>();
  const mappedRefs = new Map<string, ReturnType<typeof sourceRefForTarget>[]>();
  for (const field of dataset.fields) {
    ensureOpaque(field.fieldId, "fieldId", 240); ensureOpaque(field.canonicalKey, "canonicalKey", 180); ensureOpaque(field.rawSourceKey, "rawSourceKey", 180);
    if (field.sourceMetadata) {
      ensureOpaque(field.sourceMetadata.familyId, "sourceMetadata.familyId", 180); ensureOpaque(field.sourceMetadata.localId, "sourceMetadata.localId", 180);
    if (canonical(field.sourceMetadata.normalizedValue) !== canonical(field.value)) fail("The source metadata normalizedValue must equal the canonical field value.");
    }
    if (!validPresence(field.presenceState) || !Array.isArray(field.refs) || field.refs.length > 20) fail("A field presence state or source-ref list is invalid.");
    if (field.subjectType !== "household" && (field.groupKey === undefined) !== (field.rowIndex === undefined)) fail("Grouped observations require both groupKey and rowIndex.");
    if (field.subjectType !== "case" && field.subjectType !== "household" && (!field.groupKey || !Number.isSafeInteger(field.rowIndex) || field.rowIndex! < 0)) fail("Typed object observations require a groupKey and nonnegative rowIndex.");
    if (field.subjectType === "household" && (field.groupKey !== undefined || field.rowIndex !== undefined)) fail("Household observations cannot carry repeated-row identity.");
    const present = field.presenceState === "present";
    if (present ? field.value === null || field.value === undefined || field.refs.length === 0 : field.value !== null || field.numeric !== undefined) fail("Present fields need a value and source refs; absent, unknown, masked, and conflict fields must be explicit nulls without numeric coercion.");
    if (field.numeric) {
      const normalized = normalizeMoney(field.numeric.rawValue, field.numeric.unit, field.numeric.currency);
      if (field.sourceUnit == null || field.rawValue === undefined || field.numeric.rawValue === null || String(field.numeric.rawValue) !== field.rawValue || field.sourceUnit !== field.numeric.unit || moneyValue(field.numeric) === null || normalized.amountWon !== field.numeric.amountWon || normalized.normalizationStatus !== field.numeric.normalizationStatus) fail("A numeric reference value must exactly normalize from explicit raw source text and unit.");
      if (isRecord(field.value) && (String(field.value.amount) !== field.numeric.amountWon || String(field.value.currency).toUpperCase() !== field.numeric.currency.toUpperCase())) fail("A structured normalized amount must match its separately validated numeric value and currency.");
    }
    if (field.refs.some(ref => ref.sourceCaseId !== dataset.sourceCaseId || !Number.isSafeInteger(ref.page) || ref.page < 1 || typeof ref.quote !== "string" || ref.quote.length > 10000 || ref.bbox !== undefined && !isValidSourceBBox(ref.bbox))) fail("A source reference is malformed or bound to a different source case.");
    const refs = field.refs.map(ref => {
      const binding = bindings.get(ref.sourceDocumentId);
      if (!binding || ref.sourceHash !== binding.sourceSha256 || !binding.pages.some(page => page.page === ref.page && page.sourceRole === "evidence" && page.targetRole === "evidence")) fail("A field source reference is outside the exact evidence page bindings.");
      const mapped = sourceRefForTarget(ref, binding);
      if (!validSourceRef(data, mapped)) fail("A field source quote does not validate against the bound evidence page.", 409);
      return mapped;
    });
    fields.set(field.fieldId, field); mappedRefs.set(field.fieldId, refs);
  }

  const rowsBySubject = new Map<string, { collection: string; row: ReferenceObjectRow; id: string }>();
  const rows = dataset.objects as ReferenceTestDataset["objects"];
  for (const collection of ["incomes", "debts", "assets", "transactions"] as const) {
    if (!Array.isArray(rows[collection]) || rows[collection].length > 5000) fail(`Object rows for ${collection} are invalid or exceed the limit.`);
    const seen = new Set<string>();
    for (const row of rows[collection]) {
      ensureOpaque(row.groupKey, `${collection}.groupKey`, 240);
      if (!Number.isSafeInteger(row.rowIndex) || row.rowIndex < 0 || !isRecord(row.fieldBindings)) fail(`A ${collection} row binding is invalid.`);
      const key = `${collection}\u0000${row.groupKey}\u0000${row.rowIndex}`;
      if (seen.has(key)) fail(`Duplicate ${collection} groupKey/rowIndex.`); seen.add(key);
      const id = await targetObjectId(targetCaseId, collection, row.groupKey, row.rowIndex);
      rowsBySubject.set(key, { collection, row, id });
      for (const [property, fieldId] of Object.entries(row.fieldBindings)) {
        if (!objectKeys[collection].has(property) || typeof fieldId !== "string" || !fields.has(fieldId)) fail(`A ${collection} field binding is unsupported or missing.`);
        const field = fields.get(fieldId)!;
        if (field.subjectType !== collection.slice(0, -1) || field.groupKey !== row.groupKey || field.rowIndex !== row.rowIndex) fail(`A ${collection} binding points to a different source row.`);
        if (numericObjectKeys.has(property) && field.presenceState === "present" && (!field.numeric || moneyValue(field.numeric) === null)) fail(`A present monetary object field needs an exact normalized NumericInput.`);
      }
      const required: Record<typeof collection, string[]> = { incomes: ["label", "kind"], debts: ["creditor"], assets: ["label", "kind"], transactions: ["date", "kind", "direction"] };
      if (required[collection].some(property => !row.fieldBindings[property] || fields.get(row.fieldBindings[property])?.presenceState !== "present")) fail(`A typed ${collection} row is missing a required source-backed field.`);
    }
  }
  const householdBindings = rows.household?.fieldBindings ?? {};
  if (!isRecord(householdBindings) || Object.keys(householdBindings).some(key => key !== "reportedMembers" || typeof householdBindings[key] !== "string" || !fields.has(householdBindings[key] as string))) fail("Only a reportedMembers source binding is supported for household reference data.");
  if (householdBindings.reportedMembers) {
    const field = fields.get(String(householdBindings.reportedMembers))!;
    if (field.subjectType !== "household") fail("Household bindings must point to a household field.");
  }
  const applicantBindings = dataset.applicant?.fieldBindings ?? {};
  const applicantKeys = new Set(["name", "address", "residentIdMasked", "statement"]);
  if (!isRecord(applicantBindings) || Object.entries(applicantBindings).some(([key, fieldId]) => !applicantKeys.has(key) || typeof fieldId !== "string" || !fields.has(fieldId))) fail("Applicant identity bindings are invalid.");
  for (const [key, fieldId] of Object.entries(applicantBindings)) {
    const field = fields.get(String(fieldId))!;
    if (field.subjectType !== "case" || field.groupKey !== undefined || field.presenceState !== "present" || typeof field.value !== "string" || !field.refs.length || field.canonicalKey !== `applicant.${key}` || field.sourceMetadata?.partyRole !== "applicant") fail("Applicant identity can be imported only from an explicit applicant-role source field.");
  }
  for (const field of dataset.fields) {
    if (field.subjectType === "household" || field.subjectType === "case") continue;
    const collection = `${field.subjectType}s` as "incomes" | "debts" | "assets" | "transactions";
    const rowKey = `${collection}\u0000${field.groupKey}\u0000${field.rowIndex}`;
    const row = rowsBySubject.get(rowKey);
    if (!row || !Object.values(row.row.fieldBindings).includes(field.fieldId)) fail("Every grouped source observation must be bound to its typed object row.");
  }

  const oldFacts = currentFacts(data);
  const newData = touchCase(data);
  let retiredFactCount = 0;
  for (const prior of oldFacts) {
    const tombstone: Fact = { ...prior, id: crypto.randomUUID(), version: prior.version + 1, supersedes: prior.id, state: "retracted", recognition: "unreviewed", createdAt: new Date().toISOString(), reviewReason: `Superseded by synthetic reference dataset ${dataset.version}.` };
    newData.facts.push(tombstone); retiredFactCount++;
  }
  const importedFacts = new Map<string, Fact>();
  const now = new Date().toISOString();
  for (const field of dataset.fields) {
    let subjectId = newData.context.id;
    if (field.subjectType === "household") subjectId = `household:${newData.context.id}`;
    else if (field.subjectType !== "case") {
      const collection = `${field.subjectType}s` as "incomes" | "debts" | "assets" | "transactions";
      subjectId = rowsBySubject.get(`${collection}\u0000${field.groupKey}\u0000${field.rowIndex}`)!.id;
    } else if (field.groupKey !== undefined) subjectId = `reference-group:${newData.context.id}:${dataset.sourceCaseId}:${field.groupKey}:${field.rowIndex}`;
    const logicalId = `reference:${dataset.sourceCaseId}:${field.subjectType}:${field.groupKey ?? ""}:${field.rowIndex ?? ""}:${field.canonicalKey}:${field.fieldId}`;
    const prior = data.facts.filter(fact => fact.logicalId === logicalId).sort((a, b) => b.version - a.version)[0];
    const issueCode = field.presenceState === "present" ? "REFERENCE_DATA" : `REFERENCE_${field.presenceState.toUpperCase()}`;
    const fact: Fact = {
      id: crypto.randomUUID(), logicalId, version: (prior?.version ?? 0) + 1, ...(prior ? { supersedes: prior.id } : {}),
      subjectId, key: field.canonicalKey, value: field.presenceState === "present" ? field.value! : null, ...(field.rawValue !== undefined ? { rawValue: field.rawValue } : {}), ...(field.sourceUnit !== undefined ? { sourceUnit: field.sourceUnit } : {}), ...(field.numeric ? { numeric: field.numeric } : {}),
      ...(field.periodStart ? { periodStart: field.periodStart } : {}), ...(field.periodEnd ? { periodEnd: field.periodEnd } : {}), ...(field.asOf ? { asOf: field.asOf } : {}),
      state: field.presenceState === "conflict" ? "disputed" : "reported", recognition: "unreviewed", refs: mappedRefs.get(field.fieldId) ?? [],
      validation: [{ code: issueCode, message: "Synthetic reference data; not OCR proof, human review, or legal acceptance.", severity: "warning" }], createdAt: now,
    };
    newData.facts.push(fact); importedFacts.set(field.fieldId, fact);
  }

  const setObjectFields = (row: ReferenceObjectRow, collection: keyof typeof objectKeys, base: Record<string, unknown>) => {
    const result = { ...base } as Record<string, unknown>, ids: string[] = [];
    for (const [property, fieldId] of Object.entries(row.fieldBindings)) {
      const fact = importedFacts.get(fieldId)!; ids.push(fact.id);
      const value = fact.value;
      if (fact.state !== "disputed" && value !== null) {
        if (numericObjectKeys.has(property)) result[property] = fact.numeric ?? null;
        else if (property === "periodMonths" || property === "ownershipBps") result[property] = typeof value === "number" ? value : /^\d+$/.test(String(value)) ? Number(value) : null;
        else result[property] = value;
      } else if (numericObjectKeys.has(property)) result[property] = null;
      else if (["secured", "classification", "priority", "securedPayoffScope", "amountBasis", "recurring", "direction", "kind"].includes(property)) result[property] = "unknown";
      else result[property] = null;
    }
    result.factIds = ids;
    return result;
  };
  const buildRows = <T>(collection: keyof typeof objectKeys, defaults: (row: ReferenceObjectRow, id: string) => Record<string, unknown>) => (rows[collection] as ReferenceObjectRow[]).map(row => {
    const id = rowsBySubject.get(`${collection}\u0000${row.groupKey}\u0000${row.rowIndex}`)!.id;
    const bound = setObjectFields(row, collection, defaults(row, id));
    bound.referenceGroupKey = row.groupKey; bound.referenceRowIndex = row.rowIndex;
    return bound as T;
  });
  const incomes = buildRows<IncomeSource>("incomes", (row, id) => ({ id, recognition: "unreviewed", aggregationTreatment: "unknown", aggregationReviewed: false, factIds: [] }));
  const debts = buildRows<Debt>("debts", (row, id) => ({ id, secured: "unknown", classification: "unknown", legalReview: "unreviewed", excludedByReview: false, factIds: [] }));
  const assets = buildRows<Asset>("assets", (row, id) => ({ id, recognition: "unreviewed", factIds: [] }));
  const transactions = buildRows<Transaction>("transactions", (row, id) => ({ id, factIds: [] }));
  const reportedMembersFact = householdBindings.reportedMembers ? importedFacts.get(String(householdBindings.reportedMembers)) : undefined;
  newData.incomes = incomes; newData.debts = debts; newData.assets = assets; newData.transactions = transactions;
  newData.household = { factIds: reportedMembersFact ? [reportedMembersFact.id] : [], ...(reportedMembersFact?.state !== "disputed" && typeof reportedMembersFact?.value === "number" ? { reportedMembers: reportedMembersFact.value } : { reportedMembers: null }), recognizedMembers: null, recognition: "unreviewed" };
  newData.context.inventoryComplete = { income: "unknown", debt: "unknown", asset: "unknown" };
  newData.context.ruleApplicationReviewed = false;
  newData.context.incomePeriodReviewed = false;
  newData.context.assetValuationBasisReviewed = false;
  newData.context.presentValueReviewed = false;
  newData.context.allocationBasisReviewed = false;
  newData.context.eligibility = { naturalPerson: "unknown", insolventOrRisk: "unknown", priorProceedingsReviewed: "unknown" };
  newData.context.approvedMonthlyPayment = null; newData.context.approvedPresentValue = null; newData.context.presentValueBasis = undefined;
  newData.context.planMonths = null; newData.context.exceptionalTermReviewed = false; newData.context.shortenedTermReview = null;
  newData.context.monthlyTrusteeFee = null; newData.context.monthlyPriorityPayment = null; newData.context.monthlyEstatePayment = null;
  newData.context.paymentSchedule = { reviewed: false, phases: [] };
  // Old OCR-derived applicant identity must not remain visible after the fact set is replaced.
  // Identity can be imported later only through an explicitly source-bound applicant mapping.
  newData.context.applicant = Object.fromEntries(Object.entries(applicantBindings).map(([key, fieldId]) => [key, fields.get(String(fieldId))!.value])) as CaseData["context"]["applicant"];

  const sourceBindingsSha256 = await hash(new TextEncoder().encode(canonical(dataset.documents)));
  const archivedSnapshots = [...(data.referenceTest?.archivedSnapshots ?? []), {
    datasetVersion: data.referenceTest?.datasetVersion ?? "pre-reference-import",
    datasetSha256: data.referenceTest?.datasetSha256 ?? "0".repeat(64), archivedAt: now,
    objects: structuredClone({ incomes: data.incomes, debts: data.debts, assets: data.assets, transactions: data.transactions, household: data.household }),
    contextReviewState: structuredClone({ inventoryComplete: data.context.inventoryComplete, ruleApplicationReviewed: data.context.ruleApplicationReviewed, incomePeriodReviewed: data.context.incomePeriodReviewed, assetValuationBasisReviewed: data.context.assetValuationBasisReviewed, presentValueReviewed: data.context.presentValueReviewed, allocationBasisReviewed: data.context.allocationBasisReviewed, eligibility: data.context.eligibility }),
  }];
  const priorHistory = data.referenceTest?.importHistory ?? [];
  const history = [...priorHistory, { datasetVersion: dataset.version, datasetSha256: rawDatasetSha256, importedAt: now, importedBy: actor, importReason, retiredFactCount }];
  const provenance: ReferenceTestProvenance = {
    mode: "synthetic_reference_only", sourceCaseId: dataset.sourceCaseId, datasetVersion: dataset.version, datasetSha256: rawDatasetSha256, projectedDatasetSha256, projectionVersion: "reference-case-projection/v1", sourceBindingsSha256, importedAt: now, importedBy: actor, importReason,
    finalSubmissionProhibited: true,
    fields: dataset.fields.map(field => ({ fieldId: field.fieldId, canonicalKey: field.canonicalKey, rawSourceKey: field.rawSourceKey, presenceState: field.presenceState, factId: importedFacts.get(field.fieldId)!.id, ...(field.groupKey ? { groupKey: field.groupKey } : {}), ...(field.rowIndex !== undefined ? { rowIndex: field.rowIndex } : {}), ...(field.sourceMetadata ? { sourceMetadata: structuredClone(field.sourceMetadata) } : {}) })),
    objectCounts: { incomes: incomes.length, debts: debts.length, assets: assets.length, transactions: transactions.length }, importHistory: history, archivedSnapshots,
  };
  newData.referenceTest = provenance;
  const noOp = data.referenceTest?.datasetSha256 === rawDatasetSha256;
  const coverage = projected.coverage;
  if (noOp) return { data, noOp: true, summary: { targetCaseId, revision: data.context.revision, sourceCaseId: dataset.sourceCaseId, datasetVersion: dataset.version, datasetSha256: rawDatasetSha256, projectedDatasetSha256: data.referenceTest!.projectedDatasetSha256, projectionVersion: data.referenceTest!.projectionVersion, projectionCoverage: coverage, sourceBindingsSha256, fieldCount: dataset.fields.length, presenceCounts: Object.fromEntries(["present", "absent", "unknown", "masked", "conflict"].map(state => [state, dataset.fields.filter(field => field.presenceState === state).length])), retiredFactCount: 0, objectCounts: data.referenceTest!.objectCounts, referenceMode: data.referenceTest!.mode, finalSubmissionProhibited: true } };
  if (priorHistory.some(entry => entry.datasetSha256 === rawDatasetSha256)) fail("This dataset was already imported earlier; replay or rollback is not allowed.", 409);
  const summary = { targetCaseId, revision: newData.context.revision, sourceCaseId: dataset.sourceCaseId, datasetVersion: dataset.version, datasetSha256: rawDatasetSha256, projectedDatasetSha256, projectionVersion: provenance.projectionVersion, projectionCoverage: coverage, sourceBindingsSha256, fieldCount: dataset.fields.length, presenceCounts: Object.fromEntries(["present", "absent", "unknown", "masked", "conflict"].map(state => [state, dataset.fields.filter(field => field.presenceState === state).length])), retiredFactCount, objectCounts: provenance.objectCounts, referenceMode: provenance.mode, finalSubmissionProhibited: true };
  return { data: noOp ? data : newData, summary, noOp };
}
