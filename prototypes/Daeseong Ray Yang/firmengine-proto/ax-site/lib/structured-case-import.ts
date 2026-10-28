import { factHasValidStructuredRefs, type CaseData, type Fact, type Json } from "./domain.ts";

export const STRUCTURED_CASE_IMPORT_SCHEMA = "firmengine-structured-case-import/v1" as const;
export const STRUCTURED_CASE_IMPORT_MAX_BYTES = 8_000_000;
export const STRUCTURED_CASE_IMPORT_MAX_CASES = 52;
const FORBIDDEN_EXPECTATION_KEYS = new Set(["expected", "expectedcalculation", "expectedjudgments", "documentassertions", "oracle", "expectedoutcomes"]);

export interface StructuredCaseImportEntry {
  scenarioId: string;
  caseData: CaseData;
  caseDataSha256: string;
}
export interface StructuredCaseImportBatch {
  schemaVersion: typeof STRUCTURED_CASE_IMPORT_SCHEMA;
  manifestSha256: string;
  cases: StructuredCaseImportEntry[];
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite numbers are not valid import data.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  throw new Error("Import data must be JSON values only.");
}

export async function canonicalSha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...hash].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function structuredCaseManifestSha256(cases: Pick<StructuredCaseImportEntry, "scenarioId" | "caseDataSha256">[]): Promise<string> {
  return canonicalSha256({ schemaVersion: STRUCTURED_CASE_IMPORT_SCHEMA, cases: cases.map(({ scenarioId, caseDataSha256 }) => ({ scenarioId, caseDataSha256 })) });
}

export async function storedCaseMatchesImport(stored: CaseData, entry: Pick<StructuredCaseImportEntry, "caseData" | "caseDataSha256">, manifestSha256: string): Promise<boolean> {
  const marker = stored.structuredTest as (typeof stored.structuredTest & { datasetManifestSha256?: string; caseDataSha256?: string }) | undefined;
  if (marker?.mode !== "assumed_extracted_synthetic" || marker.datasetManifestSha256 !== manifestSha256 || marker.caseDataSha256 !== entry.caseDataSha256) return false;
  const comparable = structuredClone(stored) as CaseData & { structuredTest: NonNullable<CaseData["structuredTest"]> & { datasetManifestSha256?: string; caseDataSha256?: string } };
  delete comparable.structuredTest.datasetManifestSha256;
  delete comparable.structuredTest.caseDataSha256;
  return await canonicalSha256(comparable) === entry.caseDataSha256;
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function forbiddenExpectation(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(forbiddenExpectation);
  if (!object(value)) return false;
  return Object.entries(value).some(([key, child]) => FORBIDDEN_EXPECTATION_KEYS.has(key.toLowerCase()) || forbiddenExpectation(child));
}
function sourceWrapper(data: CaseData, fact: Fact, ref: NonNullable<Fact["structuredRefs"]>[number]): Record<string, unknown> | null {
  if (!ref || typeof ref.sourceRecordId !== "string" || typeof ref.jsonPointer !== "string" || !ref.jsonPointer.startsWith("/") || !ref.jsonPointer.endsWith("/value")) return null;
  const record = data.structuredTest?.sourceRecords.find(item => item.id === ref.sourceRecordId);
  if (!record || record.recordId !== fact.subjectId) return null;
  const path: string[] = [];
  for (const part of ref.jsonPointer.slice(1).split("/")) {
    if (/~(?![01])/u.test(part)) return null;
    const decoded = part.replace(/~1/g, "/").replace(/~0/g, "~");
    if (["__proto__", "prototype", "constructor"].includes(decoded)) return null;
    path.push(decoded);
  }
  if (path.length < 2 || path.at(-1) !== "value") return null;
  let cursor: unknown = record.data;
  for (const segment of path.slice(0, -1)) {
    if (!object(cursor) || !Object.hasOwn(cursor, segment)) return null;
    cursor = cursor[segment];
  }
  if (!object(cursor) || !Object.hasOwn(cursor, "value") || typeof cursor.fieldId !== "string" || cursor.fieldId.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase() !== fact.key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()) return null;
  const presence = cursor.presence;
  if (!["present", "absent", "blank", "unknown", "masked", "conflict"].includes(String(presence))) return null;
  const value = cursor.value as Json | null;
  if (presence === "present") return value !== null && value !== undefined && canonicalJson(value) === canonicalJson(fact.value) ? cursor : null;
  if (value !== null || fact.value !== null || fact.numeric !== undefined) return null;
  return cursor;
}
function noHumanReview(data: CaseData): boolean {
  if (data.documents.length !== 0 || data.pages.length !== 0) return false;
  const context = data.context as unknown as Record<string, unknown>;
  if (["ruleApplicationReviewed", "incomePeriodReviewed", "presentValueReviewed", "assetValuationBasisReviewed", "allocationBasisReviewed", "exceptionalTermReviewed"].some(key => context[key] === true) || context.approvedMonthlyPayment != null || context.approvedPresentValue != null) return false;
  if (data.facts.some(fact => fact.state === "verified" || fact.recognition !== "unreviewed" || fact.reviewer !== undefined || fact.reviewReason !== undefined || fact.sourceVerification !== undefined || fact.refs.length !== 0)) return false;
  const allObjects: Record<string, unknown>[] = [...data.incomes, ...data.debts, ...data.assets, ...data.transactions] as unknown as Record<string, unknown>[];
  if (allObjects.some(item => (item.recognition !== undefined && item.recognition !== "unreviewed") || item.reviewer !== undefined || item.reviewReason !== undefined || (item.legalReview !== undefined && item.legalReview !== "unreviewed"))) return false;
  if (data.household.recognition !== undefined && data.household.recognition !== "unreviewed") return false;
  const household = data.household as unknown as Record<string, unknown>;
  if (household.reviewer !== undefined || household.reviewReason !== undefined) return false;
  return true;
}

/** Validate the import envelope and its source-bound, assumed-extracted CaseData. */
export async function validateStructuredCaseImport(input: unknown, headerBodySha256: string | null): Promise<StructuredCaseImportBatch> {
  if (!object(input) || input.schemaVersion !== STRUCTURED_CASE_IMPORT_SCHEMA || !Array.isArray(input.cases) || input.cases.length < 1 || input.cases.length > STRUCTURED_CASE_IMPORT_MAX_CASES) {
    throw new Error("Malformed synthetic case import batch.");
  }
  const batch = input as unknown as StructuredCaseImportBatch;
  if (!/^[a-f0-9]{64}$/.test(batch.manifestSha256) || !headerBodySha256 || !/^[a-f0-9]{64}$/.test(headerBodySha256)) throw new Error("Import hash headers are required.");
  if (await canonicalSha256(input) !== headerBodySha256) throw new Error("Canonical request body hash mismatch.");

  const seen = new Set<string>();
  for (const entry of batch.cases) {
    if (!object(entry) || typeof entry.scenarioId !== "string" || !/^synthetic-[a-z0-9][a-z0-9-]{2,110}$/.test(entry.scenarioId) || seen.has(entry.scenarioId)) throw new Error("Scenario IDs must be unique and in the synthetic namespace.");
    seen.add(entry.scenarioId);
    if (!/^[a-f0-9]{64}$/.test(entry.caseDataSha256) || await canonicalSha256(entry.caseData) !== entry.caseDataSha256) throw new Error(`Case data hash mismatch for ${entry.scenarioId}.`);
    const data = entry.caseData;
    if (!object(data) || !object(data.context) || data.context.id !== entry.scenarioId || data.context.revision !== 1 || typeof data.context.caseName !== "string" || !data.context.caseName.toLowerCase().includes("synthetic") || !Array.isArray(data.documents) || !Array.isArray(data.pages) || !Array.isArray(data.facts) || !Array.isArray(data.incomes) || !Array.isArray(data.debts) || !Array.isArray(data.assets) || !Array.isArray(data.transactions) || !object(data.household)) throw new Error(`Case shape is invalid for ${entry.scenarioId}.`);
    if (forbiddenExpectation(data) || !noHumanReview(data)) throw new Error(`Expected answers, documents, pages, or human review are forbidden for ${entry.scenarioId}.`);
    if (data.structuredTest?.mode !== "assumed_extracted_synthetic" || data.structuredTest.scenarioId !== entry.scenarioId || !Array.isArray(data.structuredTest.sourceRecords) || data.structuredTest.sourceRecords.length < 1) throw new Error(`Synthetic source record binding is missing for ${entry.scenarioId}.`);
    const recordIds = new Set<string>();
    for (const record of data.structuredTest.sourceRecords) {
      if (!object(record) || typeof record.id !== "string" || !record.id || recordIds.has(record.id) || typeof record.recordType !== "string" || !record.recordType || typeof record.recordId !== "string" || !record.recordId || !object(record.data)) throw new Error(`Invalid source record in ${entry.scenarioId}.`);
      recordIds.add(record.id);
    }
    for (const fact of data.facts) {
      if (!Array.isArray(fact.structuredRefs) || fact.structuredRefs.length === 0) throw new Error(`Unbound synthetic fact ${fact.id} in ${entry.scenarioId}.`);
      const wrappers = fact.structuredRefs.map(ref => sourceWrapper(data, fact, ref));
      if (wrappers.some(wrapper => wrapper === null) || (wrappers.every(wrapper => wrapper!.presence === "present") && !factHasValidStructuredRefs(data, fact))) throw new Error(`Unbound synthetic fact ${fact.id} in ${entry.scenarioId}.`);
    }
    if (data.facts.length === 0) throw new Error(`Synthetic case ${entry.scenarioId} has no source-bound facts.`);
  }
  if (await structuredCaseManifestSha256(batch.cases) !== batch.manifestSha256) throw new Error("Import manifest hash mismatch.");
  return batch;
}

export function structuredCaseCounts(data: CaseData) {
  return { facts: data.facts.length, incomes: data.incomes.length, debts: data.debts.length, assets: data.assets.length, transactions: data.transactions.length, sourceRecords: data.structuredTest?.sourceRecords.length ?? 0 };
}
