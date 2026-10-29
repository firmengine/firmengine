import { renderPromptPolicy } from "./reference-prompts.ts";
import contracts from "./document-agent-field-contracts.json" with { type: "json" };
export const CLASSIFICATION_FAMILY_IDS = Object.keys(contracts.families) as Array<keyof typeof contracts.families>;
/** Definitions only: no case values, corpus labels or expected answers. The
 * compact source-field signature helps distinguish generic headings by the
 * visible combination of fields; it is not a checklist or evidence of presence. */
export const CLASSIFICATION_FAMILY_CATALOG = Object.values(contracts.families).map(family => ({
  familyId:family.family_id,
  label:family.label,
  aliases:family.aliases,
  sourceFields:family.fields.map(field => ({key:field.local_id,label:field.label})),
}));
export const CLASSIFICATION_CATALOG_RELEASE = contracts.catalog_release;
export type ClassificationFamilyId = typeof CLASSIFICATION_FAMILY_IDS[number];
const familyIdSet = new Set<string>(CLASSIFICATION_FAMILY_IDS);
export function hasValidClassificationCatalog(read: {familyId?: unknown; catalogRelease?: unknown}): boolean {
  return read.catalogRelease === CLASSIFICATION_CATALOG_RELEASE && (read.familyId === null || typeof read.familyId === "string" && familyIdSet.has(read.familyId));
}
/** Routing observations never establish a fact, identity, legal recognition, or
 * source-verification receipt. Recovery has one additional model call at most. */
export const MAX_CLASSIFICATION_ATTEMPTS = 2;
export const SOURCE_NATURES = ["official_record_claim", "copy", "self_report", "synthetic_example", "unknown"] as const;
export type SourceNature = typeof SOURCE_NATURES[number];
/** A source's own description is separate from structural routing and authenticity. */
export const SOURCE_NATURE_INSTRUCTIONS = renderPromptPolicy("prompt.classification_recovery.source_nature_instructions");
export type ClassifiedBoundary = "single_page" | "continuation_candidate" | "mixed_or_unknown";
export interface ClassificationRead {
  role: "evidence" | "filed_form" | "administrative" | "unknown";
  familyId: ClassificationFamilyId | null;
  catalogRelease: string;
  boundaryObservation: ClassifiedBoundary;
  boundaryQuote: string | null;
  confidence: "high" | "low";
  reason: string;
  titleQuote?: string | null;
  issuerQuote?: string | null;
  structureQuote?: string | null;
  evidenceRowsQuote?: string | null;
  administrativeStructureQuote?: string | null;
  legibility?: "clear" | "low";
  sourceNature?: SourceNature;
  sourceNatureQuote?: string | null;
  /** Exact public document choice; absent only on historical family-only reads. */
  documentTypeId?: string | null;
  documentTypeName?: string | null;
  documentCatalogVersion?: number;
  documentCatalogSha256?: string;
}

/** Structural view of the same active catalogue used by consultation. Family
 * contracts remain internal routing/field definitions, not a second public list. */
export interface SharedClassificationCatalog {
  catalogVersion: number;
  catalogSha256: string;
  documents: readonly {
    documentTypeId: string;
    name: string;
    allowedFamilyIds: readonly string[];
    collectionMode: string;
    fieldContracts: readonly {familyId: string;fields: readonly {id: string;key: string;label: string}[]}[];
    routingStatus: string;
  }[];
}

/** Current calls must bind both the public choice and its internal route to the
 * exact catalogue snapshot. Legacy role inspection deliberately remains separate. */
export function hasValidSharedClassification(read: ClassificationRead, catalog: SharedClassificationCatalog): boolean {
  if (!hasValidClassificationCatalog(read) || read.documentCatalogVersion !== catalog.catalogVersion || read.documentCatalogSha256 !== catalog.catalogSha256) return false;
  if (read.documentTypeId === null) return read.familyId === null && (read.documentTypeName === undefined || read.documentTypeName === null);
  if (typeof read.documentTypeId !== "string") return false;
  const document = catalog.documents.find(item => item.documentTypeId === read.documentTypeId);
  if (!document || read.documentTypeName !== undefined && read.documentTypeName !== document.name) return false;
  return read.familyId === null || document.allowedFamilyIds.includes(read.familyId);
}

export function sharedClassificationCatalogInput(catalog: SharedClassificationCatalog) {
  return {
    catalogVersion: catalog.catalogVersion,
    catalogSha256: catalog.catalogSha256,
    documents: catalog.documents.map(document => ({
      documentTypeId: document.documentTypeId,
      name: document.name,
      allowedFamilyIds: [...document.allowedFamilyIds],
      collectionMode: document.collectionMode,
      fieldContracts: document.fieldContracts.map(contract => ({familyId: contract.familyId, sourceFields: contract.fields.map(field => ({id: field.id, key: field.key, label: field.label}))})),
      routingStatus: document.routingStatus,
    })),
  };
}
export interface ClassificationRecoveryRead extends ClassificationRead {
  titleQuote: string | null; issuerQuote: string | null; structureQuote: string | null;
  evidenceRowsQuote: string | null; administrativeStructureQuote: string | null; legibility: "clear" | "low";
}
export function canRecoverClassification(read: ClassificationRead, attempts: number): boolean {
  return Number.isSafeInteger(attempts) && attempts >= 0 && attempts < MAX_CLASSIFICATION_ATTEMPTS
    && !["filed_form", "administrative"].includes(read.role)
    && (read.role === "unknown" || !read.familyId || observedClassificationRole(read) === "unknown");
}
export function recoveredClassificationRole(read: ClassificationRecoveryRead): ClassificationRead["role"] { return observedClassificationRole(read); }
export function observedClassificationRole(read: ClassificationRead): ClassificationRead["role"] {
  if (read.role === "filed_form") return read.confidence === "high" ? "filed_form" : "unknown";
  if (!hasValidClassificationCatalog(read)) return "unknown";
  if (read.confidence !== "high" || read.legibility !== "clear" || !read.familyId) return "unknown";
  const titleOrIssuer = !!(read.titleQuote?.trim() || read.issuerQuote?.trim()), hasStructure = !!read.structureQuote?.trim();
  const hasEvidenceRows = !!read.evidenceRowsQuote?.trim(), adminQuote = read.administrativeStructureQuote?.trim(), title = read.titleQuote?.trim();
  if (hasEvidenceRows && adminQuote && adminQuote !== title) return "unknown";
  if (hasEvidenceRows && titleOrIssuer && hasStructure) return "evidence";
  if (read.role === "administrative") return titleOrIssuer && hasStructure && adminQuote && adminQuote !== title && !hasEvidenceRows ? "administrative" : "unknown";
  if (read.role === "evidence" && titleOrIssuer && hasStructure) return "evidence";
  return "unknown";
}
export function canUseRescueRole(jobRole: string, pageRole: string | undefined, reason: string | undefined): boolean {
  return jobRole === pageRole && (jobRole === "evidence" || jobRole === "unknown" && reason === "classification_unknown");
}
const properties = {
  role: { type: "string", enum: ["evidence", "filed_form", "administrative", "unknown"] },
  familyId: { type: ["string", "null"], enum: [...CLASSIFICATION_FAMILY_IDS, null] },
  catalogRelease: { type: "string", enum: [CLASSIFICATION_CATALOG_RELEASE] },
  boundaryObservation: { type: "string", enum: ["single_page", "continuation_candidate", "mixed_or_unknown"] },
  boundaryQuote: { type: ["string", "null"] },
  confidence: { type: "string", enum: ["high", "low"] }, reason: { type: "string" },
  legibility: { type: "string", enum: ["clear", "low"] },
  titleQuote: { type: ["string", "null"] }, issuerQuote: { type: ["string", "null"] },
  structureQuote: { type: ["string", "null"] }, evidenceRowsQuote: { type: ["string", "null"] },
  administrativeStructureQuote: { type: ["string", "null"] },
  sourceNature: { type: "string", enum: SOURCE_NATURES },
  sourceNatureQuote: { type: ["string", "null"] },
};
export const CLASSIFICATION_SCHEMA = { type: "object", additionalProperties: false, properties, required: Object.keys(properties) };
export const CLASSIFICATION_RECOVERY_SCHEMA = { type: "object", additionalProperties: false, properties, required: Object.keys(properties) };

/** Built per request: DB catalogue edits change the allowed public IDs without
 * regenerating or silently falling back to the immutable intake seed. */
export function buildSharedClassificationSchema(catalog: SharedClassificationCatalog) {
  const ids = catalog.documents.map(document => document.documentTypeId);
  if (!Number.isSafeInteger(catalog.catalogVersion) || catalog.catalogVersion < 1 || !/^[a-f0-9]{64}$/i.test(catalog.catalogSha256) || new Set(ids).size !== ids.length || ids.some(id => !id.trim())) throw new Error("Invalid shared document catalogue snapshot");
  const sharedProperties = {
    ...properties,
    documentTypeId: {type: ["string", "null"], enum: [...ids, null]},
    documentCatalogVersion: {type: "integer", enum: [catalog.catalogVersion]},
    documentCatalogSha256: {type: "string", enum: [catalog.catalogSha256]},
  };
  return {type: "object", additionalProperties: false, properties: sharedProperties, required: Object.keys(sharedProperties)};
}
const FAMILY_SIGNATURE_GUIDANCE = renderPromptPolicy("prompt.classification_recovery.family_signature_guidance");
export const CLASSIFICATION_INSTRUCTIONS = SOURCE_NATURE_INSTRUCTIONS + "\n" + FAMILY_SIGNATURE_GUIDANCE + "\n" + renderPromptPolicy("prompt.classification_recovery.classification_instructions", {value1: CLASSIFICATION_CATALOG_RELEASE});
export const CLASSIFICATION_RECOVERY_INSTRUCTIONS = SOURCE_NATURE_INSTRUCTIONS + "\n" + FAMILY_SIGNATURE_GUIDANCE + "\n" + renderPromptPolicy("prompt.classification_recovery.classification_recovery_instructions", {value1: CLASSIFICATION_CATALOG_RELEASE});
export const SHARED_DOCUMENT_CLASSIFICATION_INSTRUCTIONS = "\n공개 문서종류 목록은 입력 documents 하나이며 상담 에이전트와 동일한 documentTypeId와 name을 사용한다. familyId는 선택 문서의 allowedFamilyIds 안에서만 고르는 내부 추출 경로다. 원문 표제·발급기관·필드/행 구조를 확인해 documentTypeId를 선택하고, 요청 목록에 있다는 이유로 원문 문서종류를 강제하지 않는다. 서로 다른 세부 문서가 더 넓은 상담 요청에 포함될 수 있으므로 fieldContracts를 함께 확인한다. 목록 밖 문서이거나 선택 근거가 부족하면 documentTypeId=null, familyId=null, role=unknown으로 반환한다. 문서종류는 보이지만 추출 경로가 없으면 familyId=null로 남겨 검토 대상으로 보존한다. documentCatalogVersion과 documentCatalogSha256은 입력 값을 정확히 반환한다. 문서종류 선택은 서류 제출 필요성·진위·소유권·법적 인정을 확정하지 않는다.";
