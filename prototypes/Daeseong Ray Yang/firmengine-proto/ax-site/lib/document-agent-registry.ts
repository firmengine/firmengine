import { catalogFamilyForDocumentType, documentFamily } from "./document-routing.ts";
import fieldContracts from "./document-agent-field-contracts.json" with { type: "json" };
import applicabilityContracts from "./field-applicability-contracts.json" with { type: "json" };
import { RECORD_CATEGORIES, RECORD_CATEGORY_POLICY, RECORD_CATEGORY_POLICY_INSTRUCTIONS } from "./category-contract.ts";
import { parseDocumentRoute, sharedDocumentFieldContract } from "./shared-document-catalog.ts";

export const DOCUMENT_AGENT_REGISTRY_VERSION = "document-agent-registry-1.0.0";
export const FIELD_CATALOG_RELEASE = "document-field-catalog-v2.2.0";
export const FIELD_CATALOG_RELEASE_SHA256 = "ccdb312b3494465f266a7a863d7ebe67342ef5085dfcbf99977168fffe27482c";
export const DEFAULT_DOCUMENT_PARALLELISM = 2;
export const MAX_DOCUMENT_PARALLELISM = 4;

export type DocumentTaskRole = "document_classifier" | "family_extractor" | "source_verifier" | "human_review_route";
export type LogicalBoundaryStatus = "page_only_unverified" | "continuation_candidate_unverified" | "boundary_conflict_pending";

export interface DownstreamDemand {
  version: "downstream-demand-1";
  targetDocumentTypes: string[];
  featureIds: string[];
  targetFields: { documentType: string; section: string; field: string; featureId: string; status: string }[];
}

/** Metadata only: selected output fields and current workflow status, never desired values or legal conclusions. */
export function buildDownstreamDemand(input: {
  familyId: string | null | undefined;
  requests: { documentType: string; sourceFamilyId: string | null; fields: { key: string; status: string; targets: { section: string; field: string }[] }[] }[];
}): DownstreamDemand | undefined {
  if (!input.familyId) return undefined;
  const matches = input.requests.filter(request => request.sourceFamilyId === input.familyId);
  if (!matches.length) return undefined;
  const targetFields = matches.flatMap(request => request.fields.flatMap(field => field.targets.map(target => ({ documentType: request.documentType, section: target.section, field: target.field, featureId: field.key, status: field.status }))));
  const order=(a:string,b:string)=>a<b?-1:a>b?1:0;
  return {
    version: "downstream-demand-1",
    targetDocumentTypes: [...new Set(matches.map(request => request.documentType))].sort(order),
    featureIds: [...new Set(targetFields.map(target => target.featureId))].sort(order),
    targetFields: targetFields.sort((a,b) => order(`${a.documentType}\u0000${a.section}\u0000${a.field}\u0000${a.featureId}`,`${b.documentType}\u0000${b.section}\u0000${b.field}\u0000${b.featureId}`)),
  };
}

export interface DocumentTaskEnvelope {
  schemaVersion: "document-task-envelope-1";
  runId: string;
  taskId: string;
  taskRole: DocumentTaskRole;
  caseId: string;
  pageJobId: string;
  documentId: string;
  sourceSha256: string;
  /** Parent/base page image, not a derivative's content hash. */
  imageSha256: string;
  /** Actual image bytes submitted on this task, in request order. */
  sentImageSha256: string[];
  page: number;
  familyId: string | null;
  familyContractId: string | null;
  canonicalFieldIds: string[];
  logicalBoundaryStatus: LogicalBoundaryStatus;
  logicalDocumentId: string | null;
  catalogRelease: string;
  catalogReleaseSha256: string;
  registryVersion: string;
  promptVersion: string;
  model: string;
  modelContextIndependence: "separate_task_context_same_model";
  verificationVisibility: "source_only" | "candidate_read_visible" | "not_applicable";
  legalApproval: "not_provided";
  downstreamDemand?: DownstreamDemand;
}

type FamilyFieldContract = (typeof fieldContracts.families)[keyof typeof fieldContracts.families];
const normalize = (value: string) => value.normalize("NFKC").trim().toLowerCase().replace(/[\s_-]+/g, "");
const contractByAlias = new Map<string, FamilyFieldContract | null>();
for (const contract of Object.values(fieldContracts.families) as FamilyFieldContract[]) {
  for (const alias of [contract.family_id, contract.canonical_type, ...contract.aliases]) {
    const key = normalize(alias);
    const prior = contractByAlias.get(key);
    if (prior === null || (prior && prior.family_id !== contract.family_id)) contractByAlias.set(key, null);
    else contractByAlias.set(key, contract);
  }
}

/** Only generic field definitions are returned. Case inventory or observed presence is never part of this registry. */
export function documentFamilyContract(familyId: string | null | undefined): FamilyFieldContract | null {
  if (!familyId) return null;
  const contract = (Object.values(fieldContracts.families) as FamilyFieldContract[]).find(item => item.family_id === familyId);
  return contract ?? null;
}

/** Compact prompt view: retain field identity and meaning while omitting repeated boilerplate. */
export function compactFamilyFieldContract(contract: FamilyFieldContract | null) {
  if (!contract) return null;
  const conditions=applicabilityContracts.families[contract.family_id as keyof typeof applicabilityContracts.families];
  const shared=contract as FamilyFieldContract & {shared_document_type_id?:string;record_policy?:Record<string,unknown>};
  return { familyId: contract.family_id, canonicalType: contract.canonical_type, ...(shared.shared_document_type_id?{documentTypeId:shared.shared_document_type_id,recordPolicy:shared.record_policy}:{}), recordCategoryPolicy:{categories:RECORD_CATEGORIES.map(category=>({category,meaning:RECORD_CATEGORY_POLICY[category]})),instructions:RECORD_CATEGORY_POLICY_INSTRUCTIONS}, caseCondition:conditions?.caseCondition??null, sourceAvailability:conditions?.sourceAvailability??null, applicabilityDecision:"source_claim_only_case_unreviewed", fields: contract.fields.map(field => ({ id: field.global_field_id, localKey: field.local_id, label: field.label, definition: field.semantic_definition, datatype: field.datatype, subjectRole: field.subject_entity_role, partyRole: field.party_value_role, temporalRole: field.temporal_role, amountOwnerRole: field.amount_owner_role, unit: field.canonical_unit, sourceCondition:conditions?.fields.find(condition=>condition.id===field.global_field_id)?.sourceCondition??null })) };
}

export function documentFieldContract(type: string | null | undefined): FamilyFieldContract | null {
  if (!type) return null;
  const shared = parseDocumentRoute(type);
  if (shared) return sharedDocumentFieldContract(shared.documentTypeId,shared.familyId);
  const direct = contractByAlias.get(normalize(type));
  if (direct !== undefined) return direct;
  const catalogFamily = catalogFamilyForDocumentType(type);
  if (catalogFamily) return documentFamilyContract(catalogFamily);
  const routed = documentFamily(type);
  return contractByAlias.get(normalize(routed)) ?? null;
}

export function documentTypeMatchesFamily(type: string | null | undefined, familyId: string | null | undefined): boolean {
  const expected = documentFamilyContract(familyId);
  const observed = documentFieldContract(type);
  return !!expected && !!observed && observed.family_id === expected.family_id;
}

/** Unknown families remain observable source reads and require a review route. */
export function routeDocumentTask(type: string | null | undefined, stage: string): { familyId: string | null; taskRole: DocumentTaskRole; reviewRequired: boolean } {
  const contract = documentFieldContract(type);
  if (stage === "classify") return { familyId: contract?.family_id ?? null, taskRole: "document_classifier", reviewRequired: false };
  if (!contract) return { familyId: null, taskRole: "human_review_route", reviewRequired: true };
  if (["verify", "repair", "region_verify", "reverify"].includes(stage)) return { familyId: contract.family_id, taskRole: "source_verifier", reviewRequired: false };
  return { familyId: contract.family_id, taskRole: "family_extractor", reviewRequired: false };
}

export function createDocumentTaskEnvelope(input: {
  runId: string; taskId: string; taskRole: DocumentTaskRole; caseId: string; pageJobId: string;
  documentId: string; sourceSha256: string; imageSha256: string; page: number; familyId: string | null;
  sentImageSha256?: string[];
  familyContractId?: string | null; canonicalFieldIds?: string[];
  logicalBoundaryStatus?: LogicalBoundaryStatus; logicalDocumentId?: string | null; promptVersion: string; model: string; downstreamDemand?: DownstreamDemand;
}): DocumentTaskEnvelope {
  return {
    schemaVersion: "document-task-envelope-1", ...input,
    logicalBoundaryStatus: input.logicalBoundaryStatus ?? "page_only_unverified",
    logicalDocumentId: input.logicalDocumentId ?? null,
    sentImageSha256: input.sentImageSha256 ?? [input.imageSha256],
    familyContractId: input.familyContractId ?? null,
    canonicalFieldIds: input.canonicalFieldIds ?? [],
    catalogRelease: FIELD_CATALOG_RELEASE, catalogReleaseSha256: FIELD_CATALOG_RELEASE_SHA256,
    registryVersion: DOCUMENT_AGENT_REGISTRY_VERSION,
    modelContextIndependence: "separate_task_context_same_model", legalApproval: "not_provided",
    verificationVisibility: input.taskRole === "source_verifier" ? "candidate_read_visible" : input.taskRole === "document_classifier" ? "not_applicable" : "source_only",
  };
}

export function clampDocumentParallelism(value: unknown): number {
  if (value === undefined) return DEFAULT_DOCUMENT_PARALLELISM;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw new Error("문서 병렬 처리 수는 1 이상의 정수여야 합니다.");
  return Math.min(value, MAX_DOCUMENT_PARALLELISM);
}

/** Bounded mapper used only after caller IDs have been deduplicated and validated. */
export async function mapBounded<T, R>(items: readonly T[], parallelism: number, task: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const limit = clampDocumentParallelism(parallelism), results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await task(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Page records are never merged by filename or value equality. */
export function continuationRelationship(left: { documentId: string; page: number; familyId: string | null; boundaryObservation?: "single_page" | "continuation_candidate" | "mixed_or_unknown"; boundaryQuote?: string | null }, right: { documentId: string; page: number; familyId: string | null; boundaryObservation?: "single_page" | "continuation_candidate" | "mixed_or_unknown"; boundaryQuote?: string | null }): LogicalBoundaryStatus {
  if (left.documentId !== right.documentId || left.familyId !== right.familyId) return "boundary_conflict_pending";
  if (Math.abs(left.page - right.page) !== 1) return "page_only_unverified";
  // Adjacency and matching family are not source evidence. A continuation is
  // only a candidate when a page itself supplied a quoted boundary cue.
  const observed = [left, right].some(page => page.boundaryObservation === "continuation_candidate" && !!page.boundaryQuote?.trim());
  if (observed) return "continuation_candidate_unverified";
  if ([left, right].some(page => page.boundaryObservation === "mixed_or_unknown")) return "boundary_conflict_pending";
  return "page_only_unverified";
}
