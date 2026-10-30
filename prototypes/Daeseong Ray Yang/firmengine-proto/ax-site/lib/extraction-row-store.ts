/** Append-only, normalized source observations. No legal recognition is stored here. */
import type { PageRead, ReadField } from "./extraction.ts";
import type { ClassificationRead } from "./classification-recovery.ts";
import { documentFieldContract } from "./document-agent-registry.ts";
import { parseDocumentRoute, sharedDocumentFieldContract } from "./shared-document-catalog.ts";
import { bindCanonicalSourceField, canonicalProjectionKey, CANONICAL_SOURCE_BINDING_VERSION } from "./canonical-field-binding.ts";
import { calculationSourceCellIssues } from "./ocr-calculation-input.ts";

export const EXTRACTION_ROW_STORE_VERSION="normalized-source-extraction/1";
type Contract=NonNullable<ReturnType<typeof documentFieldContract>>;

type Classification=Pick<ClassificationRead,"documentTypeId"|"documentTypeName"|"familyId"|"documentCatalogVersion"|"documentCatalogSha256">;
export interface PersistPageExtractionRowsInput {
  caseId:string;documentId:string;page:number;pageJobId?:string|null;read:PageRead;
  sourceHash:string;imageHash:string;model:string;caseRevision:number;stage:string;
  classification?:Partial<Classification>;
}
const json=(value:unknown)=>JSON.stringify(value);
const digest=async(value:string)=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,"0")).join("");
const stable=(value:unknown):string=>value===null||typeof value!=="object"?JSON.stringify(value)??"null":Array.isArray(value)?`[${value.map(stable).join(",")}]`:`{${Object.keys(value).sort().filter(k=>(value as Record<string,unknown>)[k]!==undefined).map(k=>`${JSON.stringify(k)}:${stable((value as Record<string,unknown>)[k])}`).join(",")}}`;
function fault(code:string):Error&{code:string}{return Object.assign(new Error(code),{code});}
function inputGuard(input:PersistPageExtractionRowsInput):void {
  if(!input.caseId||!input.documentId||!Number.isSafeInteger(input.page)||input.page<1||!Number.isSafeInteger(input.caseRevision)||input.caseRevision<1||!input.model?.trim()||!input.stage?.trim())throw fault("INVALID_EXTRACTION_ROW_INPUT");
  if(!/^[a-f0-9]{64}$/i.test(input.sourceHash)||!/^[a-f0-9]{64}$/i.test(input.imageHash))throw fault("EXTRACTION_ROW_SOURCE_HASH_REQUIRED");
  if(!input.read||typeof input.read.documentType!=="string"||!Array.isArray(input.read.records)||!Array.isArray(input.read.warnings)||typeof input.read.complete!=="boolean")throw fault("INVALID_EXTRACTION_ROW_READ");
  let fields=0;
  for(const record of input.read.records){
    if(typeof record.category!=="string"||typeof record.label!=="string"||!Array.isArray(record.fields))throw fault("INVALID_EXTRACTION_ROW_RECORD");
    for(const f of record.fields){fields++;if(typeof f.key!=="string"||typeof f.label!=="string"||!(f.value===null||typeof f.value==="string")||!(f.unit===null||typeof f.unit==="string")||!(f.quote===null||typeof f.quote==="string")||!['clear','uncertain','unreadable'].includes(f.confidence))throw fault("INVALID_EXTRACTION_ROW_FIELD");}
  }
  if(input.read.records.length>500||fields>5000||new TextEncoder().encode(json(input.read)).length>1_900_000)throw fault("EXTRACTION_ROW_SIZE_LIMIT");
}
function bindField(field:ReadField,contract:Contract|null,category:string){
  const resolved=bindCanonicalSourceField(field,contract),selected=resolved.definition;
  const bindingStatus=resolved.binding==="explicit_id"?"bound_exact_id":resolved.binding==="exact_key"?"bound_exact_key":"unbound";
  const issues=resolved.issues.map(issue=>issue==="canonical_id_key_conflict"?"CANONICAL_ID_KEY_CONFLICT":issue==="canonical_id_outside_family"?"CANONICAL_FIELD_NOT_IN_SCHEMA":issue==="canonical_id_ambiguous"?"AMBIGUOUS_SOURCE_FIELD_KEY":"SOURCE_FIELD_KEY_UNBOUND");
  if(selected)issues.push(...calculationSourceCellIssues(field,selected));
  if(field.confidence!=="clear")issues.push("SOURCE_READ_UNCERTAIN");
  if(field.sourceState!==undefined&&field.sourceState!=="present"&&field.sourceState!=="explicit_none")issues.push("SOURCE_STATE_REQUIRES_REVIEW");
  return {canonicalFieldId:resolved.canonicalFieldId,projectionKey:canonicalProjectionKey(contract,resolved,category),
    bindingStatus,validationStatus:!selected?"unbound":issues.length?"source_review_required":"source_only",issues};
}

type Value=string|number|null;
function insertRows(database:D1Database,table:string,columns:string[],rows:Value[][]):D1PreparedStatement[]{
  const size=Math.max(1,Math.floor(90/columns.length)),statements:D1PreparedStatement[]=[];
  for(let start=0;start<rows.length;start+=size){const chunk=rows.slice(start,start+size);statements.push(database.prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES ${chunk.map(()=>`(${columns.map(()=>"?").join(",")})`).join(",")} ON CONFLICT DO NOTHING`).bind(...chunk.flat()));}
  return statements;
}

/** Extracted stages append raw rows; only the committed stage advances the page head. */
export async function persistPageExtractionRows(database:D1Database,input:PersistPageExtractionRowsInput){
  inputGuard(input);
  const current=await database.prepare("SELECT revision FROM cases WHERE id = ?").bind(input.caseId).first<{revision:number}>();
  if(!current)throw fault("EXTRACTION_CASE_NOT_FOUND");
  if(current.revision!==input.caseRevision)throw fault("CASE_REVISION_MISMATCH");
  const source=await database.prepare("SELECT case_id,sha256,page_count FROM documents WHERE id = ?").bind(input.documentId).first<{case_id:string;sha256:string;page_count:number}>();
  if(!source||source.case_id!==input.caseId||source.sha256!==input.sourceHash||input.page>source.page_count)throw fault("EXTRACTION_SOURCE_BINDING_MISMATCH");
  const route=parseDocumentRoute(input.read.documentType),classification=input.classification;
  if(route&&classification?.documentTypeId&&classification.documentTypeId!==route.documentTypeId||route&&classification?.familyId&&classification.familyId!==route.familyId)throw fault("EXTRACTION_DOCUMENT_ROUTE_MISMATCH");
  const documentTypeId=classification?.documentTypeId??route?.documentTypeId??null;
  const familyId=classification?.familyId??route?.familyId??documentFieldContract(input.read.documentType)?.family_id??null;
  const contract=documentTypeId&&familyId?sharedDocumentFieldContract(documentTypeId,familyId):documentFieldContract(input.read.documentType);
  if(documentTypeId&&!contract)throw fault("EXTRACTION_DOCUMENT_SCHEMA_UNAVAILABLE");
  const version=contract?.field_contract_version??"unmapped-source-schema-v1",at=new Date().toISOString();
  const schemaPayload={version:EXTRACTION_ROW_STORE_VERSION,documentTypeId,familyId,contractVersion:version,contract:contract??null};
  const schemaJson=stable(schemaPayload),schemaHash=await digest(schemaJson),schemaId="schema-"+schemaHash;
  const name=classification?.documentTypeName??null,catalogVersion=classification?.documentCatalogVersion??null,catalogHash=classification?.documentCatalogSha256??null;
  const instanceId="instance-"+await digest(stable([input.caseId,input.documentId,input.page,input.sourceHash,documentTypeId,name,familyId,catalogVersion,catalogHash]));
  const readJson=json(input.read),readSha=await digest(readJson);
  const runId="read-"+await digest(stable([instanceId,schemaId,readSha,input.imageHash,input.model,input.stage]));
  const statements:D1PreparedStatement[]=[
    database.prepare("INSERT OR IGNORE INTO extraction_schema_versions (id,sha256,document_type_id,family_id,contract_version,payload_json,created_at) VALUES (?,?,?,?,?,?,?)").bind(schemaId,schemaHash,documentTypeId,familyId,version,schemaJson,at),
    ...insertRows(database,"extraction_schema_fields",["schema_id","canonical_field_id","ordinal","local_key","label","datatype","unit","subject_role","party_role","temporal_role","amount_owner_role","definition_json"],(contract?.fields??[]).map((f,i)=>[schemaId,f.global_field_id,i,f.local_id,f.label,f.datatype,f.canonical_unit,f.subject_entity_role,f.party_value_role,f.temporal_role,f.amount_owner_role,json(f)])),
    database.prepare("INSERT OR IGNORE INTO document_instances (id,case_id,source_document_id,page,shared_document_type_id,shared_document_type_name,family_id,boundary_status,catalog_version,catalog_sha256,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(instanceId,input.caseId,input.documentId,input.page,documentTypeId,name,familyId,"page_only_unverified",catalogVersion,catalogHash,at),
    database.prepare("INSERT OR IGNORE INTO extraction_runs (id,case_id,document_instance_id,schema_id,page_job_id,stage,model,source_hash,image_hash,read_sha256,read_json,case_revision,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(runId,input.caseId,instanceId,schemaId,input.pageJobId??null,input.stage,input.model,input.sourceHash,input.imageHash,readSha,readJson,input.caseRevision,at),
  ];
  const records:Value[][]=[],features:Value[][]=[];
  const coverage=new Map<string,{counts:Record<string,number>;observed:number;review:number}>(
    (contract?.fields??[]).map(field=>[field.global_field_id,{counts:{},observed:0,review:0}]));
  for(const [ri,record] of input.read.records.entries()){
    const recordId=`${runId}:record:${ri}`;records.push([recordId,runId,ri,record.category,record.label]);
    for(const [fi,f]of record.fields.entries()){
      const binding=bindField(f,contract,record.category);
      features.push([`${recordId}:field:${fi}`,recordId,schemaId,fi,binding.canonicalFieldId,f.key,f.label,json(f.value),f.unit,f.sourceState??null,f.confidence,f.quote,json(f.bbox??null),json(f),binding.bindingStatus,binding.validationStatus,json(binding.issues),binding.projectionKey,CANONICAL_SOURCE_BINDING_VERSION]);
      if(binding.canonicalFieldId){
        const item=coverage.get(binding.canonicalFieldId);
        if(item){
          item.observed++;if(binding.validationStatus!=="source_only")item.review++;
          const state=f.sourceState??(f.value!==null?"present":"unknown");
          item.counts[state]=(item.counts[state]??0)+1;
        }
      }
    }
  }
  statements.push(...insertRows(database,"extraction_records",["id","run_id","ordinal","category","label"],records),
    ...insertRows(database,"extracted_features",["id","record_id","schema_id","ordinal","canonical_field_id","field_key","label","raw_value_json","unit","source_state","confidence","quote","bbox_json","raw_field_json","binding_status","validation_status","validation_json","projection_key","binding_version"],features));
  const coverageRows:Value[][]=[...coverage].map(([canonicalId,item])=>[runId,schemaId,canonicalId,
    item.observed===0?"not_observed_on_page":item.review>0?"observed_review_required":"observed_source_only",
    item.observed,item.review,json(item.counts),at]);
  statements.push(...insertRows(database,"extraction_field_coverage",
    ["run_id","schema_id","canonical_field_id","observation_status","observed_count","review_count","source_state_counts_json","created_at"],coverageRows));
  const promote=input.stage==="committed";
  if(promote)statements.push(database.prepare("INSERT INTO case_extraction_heads (case_id,source_document_id,page,run_id,case_revision,updated_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM cases WHERE id=? AND revision=?) ON CONFLICT(case_id,source_document_id,page) DO UPDATE SET run_id=excluded.run_id,case_revision=excluded.case_revision,updated_at=excluded.updated_at WHERE excluded.case_revision>=case_extraction_heads.case_revision").bind(input.caseId,input.documentId,input.page,runId,input.caseRevision,at,input.caseId,input.caseRevision));
  const result=await database.batch(statements);
  if(promote&&!result.at(-1)?.meta?.changes)throw fault("CASE_REVISION_MISMATCH");
  return {runId,schemaId,documentInstanceId:instanceId,records:records.length,features:features.length,expectedFields:coverageRows.length,notObservedOnPage:coverageRows.filter(x=>x[3]==="not_observed_on_page").length,headPromoted:promote,sourceOnly:true as const,legalRecognition:"not_provided" as const};
}

interface StoredRecord {id:string;run_id:string;ordinal:number;category:string;label:string;case_revision:number;head_case_revision:number;stage:string;model:string;source_hash:string;image_hash:string;read_sha256:string;schema_id:string;source_document_id:string;page:number;shared_document_type_id:string|null;shared_document_type_name:string|null;family_id:string|null;boundary_status:string;catalog_version:number|null;catalog_sha256:string|null;contract_version:string;schema_sha256:string;feature_count:number;}
interface StoredFeature {id:string;record_id:string;ordinal:number;canonical_field_id:string|null;field_key:string;label:string;raw_value_json:string;unit:string|null;source_state:string|null;confidence:string;quote:string|null;bbox_json:string;binding_status:string;validation_status:string;validation_json:string;projection_key:string|null;binding_version:string;datatype:string|null;expected_unit:string|null;subject_role:string|null;party_role:string|null;temporal_role:string|null;amount_owner_role:string|null;}
/** Bounded SQL projection of active committed page reads, with explicit lineage. */
export async function listCaseExtractionRows(database:D1Database,input:{caseId:string;documentTypeId?:string;limit?:number;offset?:number;expectedRevision?:number}){
  const limit=input.limit??25,offset=input.offset??0;
  if(!input.caseId||!Number.isSafeInteger(limit)||limit<1||limit>50||!Number.isSafeInteger(offset)||offset<0)throw fault("INVALID_EXTRACTION_ROW_QUERY");
  const current=await database.prepare("SELECT revision FROM cases WHERE id=?").bind(input.caseId).first<{revision:number}>();
  if(!current)throw fault("EXTRACTION_CASE_NOT_FOUND");
  if(input.expectedRevision!==undefined&&current.revision!==input.expectedRevision)throw fault("CASE_REVISION_MISMATCH");
  const params:Value[]=[input.caseId],filter=input.documentTypeId?" AND i.shared_document_type_id=?":"";
  if(input.documentTypeId)params.push(input.documentTypeId);
  const from=" FROM case_extraction_heads h JOIN extraction_runs r ON r.id=h.run_id JOIN document_instances i ON i.id=r.document_instance_id JOIN extraction_schema_versions s ON s.id=r.schema_id JOIN extraction_records e ON e.run_id=r.id WHERE h.case_id=?"+filter;
  const count=await database.prepare("SELECT COUNT(*) AS n"+from).bind(...params).first<{n:number}>();
  const selected=await database.prepare("SELECT e.*,r.case_revision,h.case_revision AS head_case_revision,r.stage,r.model,r.source_hash,r.image_hash,r.read_sha256,r.schema_id,i.source_document_id,i.page,i.shared_document_type_id,i.shared_document_type_name,i.family_id,i.boundary_status,i.catalog_version,i.catalog_sha256,s.contract_version,s.sha256 AS schema_sha256,(SELECT COUNT(*) FROM extracted_features f WHERE f.record_id=e.id) AS feature_count"+from+" ORDER BY i.source_document_id,i.page,e.ordinal LIMIT ? OFFSET ?").bind(...params,limit,offset).all<StoredRecord>();
  const records=selected.results??[],featureLimit=10000,featureBatchSize=500;
  const expectedFeatures=records.reduce((sum,row)=>sum+row.feature_count,0);
  if(expectedFeatures>featureLimit)throw fault("EXTRACTION_ROW_TOO_MANY_FIELDS_REDUCE_LIMIT");
  const features:StoredFeature[]=[];
  if(records.length&&expectedFeatures){
    const query=`SELECT f.*,s.datatype,s.unit AS expected_unit,s.subject_role,s.party_role,s.temporal_role,s.amount_owner_role FROM extracted_features f LEFT JOIN extraction_schema_fields s ON s.schema_id=f.schema_id AND s.canonical_field_id=f.canonical_field_id WHERE f.record_id IN (${records.map(()=>"?").join(",")}) ORDER BY f.record_id,f.ordinal LIMIT ? OFFSET ?`;
    for(let offset=0;offset<expectedFeatures;offset+=featureBatchSize){
      const portion=(await database.prepare(query).bind(...records.map(r=>r.id),Math.min(featureBatchSize,expectedFeatures-offset),offset).all<StoredFeature>()).results??[];
      features.push(...portion);
    }
  }
  if(features.length!==expectedFeatures)throw fault("EXTRACTION_ROW_FIELD_COUNT_MISMATCH");
  const byRecord=new Map<string,StoredFeature[]>();
  for(const item of features)byRecord.set(item.record_id,[...(byRecord.get(item.record_id)??[]),item]);
  const after=await database.prepare("SELECT revision FROM cases WHERE id=?").bind(input.caseId).first<{revision:number}>();
  if(after?.revision!==current.revision)throw fault("CASE_REVISION_MISMATCH");
  return {schemaVersion:EXTRACTION_ROW_STORE_VERSION,caseId:input.caseId,caseRevision:current.revision,sourceOnly:true,legalRecognition:"not_provided",courtApprovalInferred:false,
    currentVersionMeaning:"Active committed source read per original-document page; extraction revision and current case revision are separate.",
    totalRecords:count?.n??0,limit,offset,nextOffset:offset+records.length<(count?.n??0)?offset+records.length:null,featureLimit,featureBatchSize,featuresTruncated:false,
    records:records.map(row=>({recordId:row.id,recordOrdinal:row.ordinal,category:row.category,label:row.label,runId:row.run_id,
      source:{documentId:row.source_document_id,page:row.page,documentTypeId:row.shared_document_type_id,documentTypeName:row.shared_document_type_name,familyId:row.family_id,boundaryStatus:row.boundary_status,model:row.model,stage:row.stage,sourceHash:row.source_hash,imageHash:row.image_hash,readSha256:row.read_sha256,runCaseRevision:row.case_revision,headCaseRevision:row.head_case_revision,catalogVersion:row.catalog_version,catalogSha256:row.catalog_sha256,schemaId:row.schema_id,schemaSha256:row.schema_sha256,contractVersion:row.contract_version},
      fieldCount:row.feature_count,fields:(byRecord.get(row.id)??[]).map(f=>({featureId:f.id,recordId:f.record_id,fieldOrdinal:f.ordinal,canonicalFieldId:f.canonical_field_id,key:f.field_key,label:f.label,value:JSON.parse(f.raw_value_json),unit:f.unit,projectionKey:f.projection_key,bindingVersion:f.binding_version,sourceState:f.source_state,confidence:f.confidence,quote:f.quote,bbox:JSON.parse(f.bbox_json),bindingStatus:f.binding_status,validationStatus:f.validation_status,validation:JSON.parse(f.validation_json),expected:{datatype:f.datatype,unit:f.expected_unit,subjectRole:f.subject_role,partyRole:f.party_role,temporalRole:f.temporal_role,amountOwnerRole:f.amount_owner_role}}))}))};
}

/** Records every expected schema key, even when OCR found nothing. This is
 * PAGE coverage only; unobserved is never legal non-applicability or zero. */
export async function listCaseExtractionCoverage(database:D1Database,input:{caseId:string;documentTypeId?:string;limit?:number;offset?:number;expectedRevision?:number}){
  const limit=input.limit??25,offset=input.offset??0;
  if(!input.caseId||!Number.isSafeInteger(limit)||limit<1||limit>100||!Number.isSafeInteger(offset)||offset<0)throw fault("INVALID_EXTRACTION_COVERAGE_QUERY");
  const before=await database.prepare("SELECT revision FROM cases WHERE id=?").bind(input.caseId).first<{revision:number}>();
  if(!before)throw fault("EXTRACTION_CASE_NOT_FOUND");
  if(input.expectedRevision!==undefined&&input.expectedRevision!==before.revision)throw fault("CASE_REVISION_MISMATCH");
  const filter=input.documentTypeId?" AND i.shared_document_type_id=?":"";
  const params=[input.caseId,...(input.documentTypeId?[input.documentTypeId]:[])];
  const from=" FROM case_extraction_heads h JOIN extraction_runs r ON r.id=h.run_id JOIN document_instances i ON i.id=r.document_instance_id JOIN extraction_field_coverage c ON c.run_id=r.id JOIN extraction_schema_fields f ON f.schema_id=c.schema_id AND f.canonical_field_id=c.canonical_field_id WHERE h.case_id=?"+filter;
  const count=await database.prepare("SELECT COUNT(*) AS n"+from).bind(...params).first<{n:number}>();
  const result=await database.prepare("SELECT i.source_document_id AS documentId,i.page,i.shared_document_type_id AS documentTypeId,i.family_id AS familyId,r.id AS runId,c.canonical_field_id AS canonicalFieldId,c.observation_status AS observationStatus,c.observed_count AS observedCount,c.review_count AS reviewCount,c.source_state_counts_json AS statesJson,f.local_key AS localKey,f.datatype AS datatype,f.unit AS expectedUnit"+from+" ORDER BY i.source_document_id,i.page,f.ordinal LIMIT ? OFFSET ?")
    .bind(...params,limit,offset).all<{documentId:string;page:number;documentTypeId:string|null;familyId:string|null;runId:string;canonicalFieldId:string;observationStatus:string;observedCount:number;reviewCount:number;statesJson:string;localKey:string;datatype:string;expectedUnit:string}>();
  const after=await database.prepare("SELECT revision FROM cases WHERE id=?").bind(input.caseId).first<{revision:number}>();
  if(after?.revision!==before.revision)throw fault("CASE_REVISION_MISMATCH");
  const rows=result.results??[];
  return {schemaVersion:"source-field-coverage/1",caseId:input.caseId,caseRevision:before.revision,
    totalFields:count?.n??0,limit,offset,nextOffset:offset+rows.length<(count?.n??0)?offset+rows.length:null,
    missingMeans:"Not observed on this page; not proof of absence, inapplicability, or zero.",
    legalRecognition:"not_provided",rows:rows.map(({statesJson,...item})=>({...item,sourceStateCounts:JSON.parse(statesJson) as Record<string,number>}))};
}
