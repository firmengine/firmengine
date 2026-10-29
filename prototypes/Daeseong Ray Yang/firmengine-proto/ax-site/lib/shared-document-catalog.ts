/** Public document identity is shared by consultation and OCR. Families are internal extraction routes. */
import type { IntakeCatalog } from "./intake-types.ts";
import families from "./document-agent-field-contracts.json" with { type: "json" };
import definitions from "./shared-document-field-contracts.json" with { type: "json" };

type BaseContract = (typeof families.families)[keyof typeof families.families];
type BaseField = BaseContract["fields"][number];
interface DocumentDefinition {
  documentTypeId: string;
  allowedFamilyIds: string[];
  fieldContractVersion: string;
  fieldsByFamily: Record<string, BaseField[]>;
  recordPolicy: Record<string, unknown>;
}
const definitionsById = definitions.documents as unknown as Record<string, DocumentDefinition>;
const familyById = new Map<string, BaseContract>(Object.values(families.families).map(f => [f.family_id, f]));
const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/;
const ROUTE = /^shared-document:([A-Za-z0-9][A-Za-z0-9_.:-]{0,119})@([A-Za-z0-9][A-Za-z0-9_.:-]{0,119})$/;

export function encodeDocumentRoute(documentTypeId: string, familyId: string): string {
  if (!ID.test(documentTypeId) || !familyById.has(familyId)) throw new Error("INVALID_SHARED_DOCUMENT_ROUTE");
  return `shared-document:${documentTypeId}@${familyId}`;
}
export function parseDocumentRoute(value: string | null | undefined): {documentTypeId:string;familyId:string} | null {
  if (typeof value !== "string") return null;
  const match = ROUTE.exec(value);
  return match && familyById.has(match[2]) ? {documentTypeId:match[1],familyId:match[2]} : null;
}

/** The selected family is kept separate: fields from unrelated document families are never merged. */
export function sharedDocumentFieldContract(documentTypeId: string, familyId: string): BaseContract | null {
  const definition = definitionsById[documentTypeId], base = familyById.get(familyId);
  if (!definition || !base || !definition.allowedFamilyIds.includes(familyId)) return null;
  const fields = [...base.fields] as BaseField[];
  const ids = new Set(fields.map(f => f.global_field_id));
  for (const field of definition.fieldsByFamily[familyId] ?? []) {
    if (ids.has(field.global_field_id)) throw new Error("DUPLICATE_SHARED_DOCUMENT_FIELD_ID");
    ids.add(field.global_field_id);fields.push(field);
  }
  return {...base,canonical_type:encodeDocumentRoute(documentTypeId,familyId),
    field_contract_version:definition.fieldContractVersion,fields,
    shared_document_type_id:documentTypeId,record_policy:definition.recordPolicy} as unknown as BaseContract;
}

export interface SharedDocumentCatalogEntry {
  documentTypeId:string;name:string;allowedFamilyIds:string[];
  collectionMode:"client_evidence"|"generated_or_prior_form";
  routingStatus:"ready"|"review_required";
  fieldContracts:{familyId:string;fields:{id:string;key:string;label:string}[];sourceFields:{id:string;key:string;label:string}[]}[];
}
export interface SharedDocumentCatalog {
  catalogVersion:number;catalogSha256:string;documents:SharedDocumentCatalogEntry[];
}

/** Only the caller's validated active catalog supplies public IDs and names, including staff edits. */
export function buildSharedDocumentCatalog(catalog: IntakeCatalog, catalogSha256: string): SharedDocumentCatalog {
  if (!/^[a-f0-9]{64}$/i.test(catalogSha256)) throw new Error("SHARED_DOCUMENT_CATALOG_HASH_REQUIRED");
  const documents=catalog.documents.map(document => {
    const definition=definitionsById[document.id];
    const allowedFamilyIds=[...new Set(document.ocr?.familyIds??[])].filter(id => familyById.has(id)&&definition?.allowedFamilyIds.includes(id));
    const fieldContracts=allowedFamilyIds.flatMap(familyId=>{
      const contract=sharedDocumentFieldContract(document.id,familyId);
      if (!contract) return [];
      const fields=contract.fields.map(field=>({id:field.global_field_id,key:field.local_id,label:field.label}));
      return [{familyId,fields,sourceFields:fields}];
    });
    return {documentTypeId:document.id,name:document.name,allowedFamilyIds,
      collectionMode:document.ocr?.collectionMode??"client_evidence",
      routingStatus:document.ocr?.routingStatus==="ready"&&fieldContracts.length>0?"ready":"review_required",
      fieldContracts} satisfies SharedDocumentCatalogEntry;
  });
  return {catalogVersion:catalog.version,catalogSha256,documents};
}

export function sharedDocumentDefinition(documentTypeId:string): DocumentDefinition | null {
  return definitionsById[documentTypeId]??null;
}
