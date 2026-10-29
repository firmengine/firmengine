import { validateIntakeCatalog } from "./intake-engine.ts";
import { INTAKE_SCHEMA_VERSION, type IntakeCatalog } from "./intake-types.ts";

export const intakeCatalogSha256=async(value:unknown)=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(value))))].map(byte=>byte.toString(16).padStart(2,"0")).join("");
export interface IntakeCatalogSnapshot {catalog:IntakeCatalog;sha256:string;}
type StoredCatalogSnapshot={headVersion:number;headSha256:string;storedVersion:number|null;schemaVersion:string|null;payload:string|null;storedSha256:string|null;};
const HASH=/^[a-f0-9]{64}$/;

/** Read one authoritative DB head/version pair. This helper never seeds/upgrades. */
export async function readActiveIntakeCatalogSnapshot(database:D1Database):Promise<IntakeCatalogSnapshot|null>{
  const stored=await database.prepare(`SELECT head.version AS headVersion, head.sha256 AS headSha256,
    version.version AS storedVersion, version.schema_version AS schemaVersion,
    version.payload AS payload, version.sha256 AS storedSha256
    FROM intake_catalog_head AS head
    LEFT JOIN intake_catalog_versions AS version ON version.version = head.version
    WHERE head.id = 'default'`).first<StoredCatalogSnapshot>();
  if(!stored)return null;
  try{
    if(!Number.isSafeInteger(stored.headVersion)||stored.headVersion<1||stored.storedVersion!==stored.headVersion||stored.schemaVersion!==INTAKE_SCHEMA_VERSION||typeof stored.payload!=="string"||!HASH.test(stored.headSha256)||stored.storedSha256!==stored.headSha256)throw new Error("metadata");
    const catalog=validateIntakeCatalog(JSON.parse(stored.payload));
    if(catalog.version!==stored.headVersion||await intakeCatalogSha256(catalog)!==stored.headSha256)throw new Error("hash");
    return {catalog,sha256:stored.headSha256};
  }catch{throw new Error("INTAKE_CATALOG_INTEGRITY_FAILED");}
}

/** Append missing registry entries only; preserve edited names/rules/history. */
export function supplementIntakeCatalog(current:IntakeCatalog,baseline:IntakeCatalog){
  const original=validateIntakeCatalog(current),seed=validateIntakeCatalog(baseline),catalog=structuredClone(original);
  const byId=new Map(catalog.documents.map(document=>[document.id,document]));
  const addedDocumentIds:string[]=[],attachedOcrIds:string[]=[];
  for(const document of seed.documents){
    const existing=byId.get(document.id);
    if(!existing){const addition=structuredClone(document);catalog.documents.push(addition);byId.set(addition.id,addition);addedDocumentIds.push(addition.id);}
    else if(existing.ocr===undefined&&document.ocr!==undefined){existing.ocr=structuredClone(document.ocr);attachedOcrIds.push(existing.id);}
  }
  const sourceIds=new Set(catalog.sources.map(source=>source.id)),seedSources=new Map(seed.sources.map(source=>[source.id,source]));
  for(const document of catalog.documents)for(const sourceId of document.sourceIds)if(!sourceIds.has(sourceId)){
    const source=seedSources.get(sourceId);if(!source)throw new Error("INTAKE_UNKNOWN_SOURCE: "+sourceId);
    catalog.sources.push(structuredClone(source));sourceIds.add(sourceId);
  }
  const changed=addedDocumentIds.length>0||attachedOcrIds.length>0;
  if(changed)catalog.version=original.version+1;
  return {catalog:validateIntakeCatalog(catalog),changed,addedDocumentIds,attachedOcrIds};
}
