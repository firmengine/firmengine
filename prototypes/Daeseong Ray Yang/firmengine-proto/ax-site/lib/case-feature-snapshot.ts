/** Bind a calculation snapshot to the current normalized SQL source observations.
 * Source/history drift blocks calculation; it never silently reuses an older
 * CaseData value, reissues a source proof, or creates a human/legal acceptance. */
import {currentFacts,type CaseData,type Fact,type NumericInput,type ExtractionPayload} from "./domain.ts";
import {projectPage,validatePageRead,type PageRead} from "./extraction.ts";
import {bindCanonicalSourceField,canonicalProjectionKey,CANONICAL_SOURCE_BINDING_VERSION} from "./canonical-field-binding.ts";

type Head={case_id:string;source_document_id:string;page:number;run_id:string;head_case_revision:number;run_case_id:string;document_instance_id:string;schema_id:string;stage:string;model:string;source_hash:string;image_hash:string;read_sha256:string;read_json:string;run_case_revision:number;instance_case_id:string;instance_source_document_id:string;instance_page:number;shared_document_type_id:string|null;family_id:string|null;schema_sha256:string;schema_payload_json:string;document_case_id:string;document_sha256:string};
type RecordRow={id:string;ordinal:number;category:string;label:string};
type FeatureRow={id:string;record_id:string;schema_id:string;ordinal:number;canonical_field_id:string|null;field_key:string;label:string;raw_value_json:string;unit:string|null;source_state:string|null;confidence:string;quote:string|null;bbox_json:string;raw_field_json:string;projection_key:string|null;binding_version:string;}
type SchemaField={canonical_field_id:string;ordinal:number;local_key:string;label:string;datatype:string;unit:string;subject_role:string;party_role:string;temporal_role:string;amount_owner_role:string|null;definition_json:string};
const stable=(value:unknown):string=>value===null||typeof value!=="object"?JSON.stringify(value)??"null":Array.isArray(value)?`[${value.map(stable).join(",")}]`:`{${Object.keys(value).sort().filter(key=>(value as Record<string,unknown>)[key]!==undefined).map(key=>JSON.stringify(key)+":"+stable((value as Record<string,unknown>)[key])).join(",")}}`;
const digest=async(value:string)=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(value=>value.toString(16).padStart(2,"0")).join("");
function fault(code:"SOURCE_INTEGRITY_MISMATCH"|"PROJECTION_CONFLICT"|"CASE_REVISION_MISMATCH",reason:string){return Object.assign(new Error(code),{code,reason});}
const same=(a:unknown,b:unknown)=>stable(a)===stable(b);
function parse(value:string,reason:string):any{try{return JSON.parse(value);}catch{throw fault("SOURCE_INTEGRITY_MISMATCH",reason);}}
function sourceReadingMatches(raw:Partial<Fact>,fact:Fact):boolean {
  const sourceUnit=Object.hasOwn(fact,"sourceUnit")?fact.sourceUnit:fact.numeric?.unit??null;
  return raw.subjectId===fact.subjectId&&raw.key===fact.key&&same(raw.value,fact.value)&&same(raw.sourceUnit??null,sourceUnit)
    &&(!raw.numeric||same(raw.numeric,fact.numeric))
    &&(raw.refs??[]).every(ref=>fact.refs.some(current=>same(ref,current)));
}
const sourceMoneyProperties:Record<string,string[]>={incomes:["gross","expenses","net"],debts:["principal","interest"],assets:["grossValue","securedPayoff","disposalCosts"],transactions:["amount"]};
function verifyProjection(data:CaseData,projection:ExtractionPayload,documentId:string,page:number,warnings:string[]){
  const active=currentFacts(data),projected=projection.facts??[];
  const latest=new Map<string,Fact>();for(const fact of data.facts)if(!latest.has(fact.logicalId)||latest.get(fact.logicalId)!.version<fact.version)latest.set(fact.logicalId,fact);
  for(const raw of projected){
    if(!raw.logicalId||!raw.refs?.length)continue;
    const candidates=active.filter(fact=>fact.logicalId===raw.logicalId&&sourceReadingMatches(raw,fact));
    if(candidates.length===1)continue;
    const decision=latest.get(raw.logicalId);
    if(decision?.reviewer&&decision.state==="retracted"){
      warnings.push(`human_source_retraction_preserved:${documentId}:${page}:${raw.key}`);continue;
    }
    throw fault("PROJECTION_CONFLICT",`normalized source field differs from case snapshot: ${documentId}:${page}:${raw.key}`);
  }
  for(const fact of active){
    if(fact.reviewer||!fact.refs.length||!fact.refs.every(ref=>ref.documentId===documentId&&ref.page===page))continue;
    if(!projected.some(raw=>sourceReadingMatches(raw,fact)))throw fault("PROJECTION_CONFLICT",`automatic case field is absent from the active normalized read: ${documentId}:${page}:${fact.key}`);
  }
  for(const [collection,properties] of Object.entries(sourceMoneyProperties)){
    const expected=(projection[collection as keyof ExtractionPayload]??[]) as unknown as Array<{id:string;[key:string]:unknown}>;
    const current=data[collection as "incomes"|"debts"|"assets"|"transactions"] as unknown as Array<{id:string;[key:string]:unknown}>;
    for(const row of expected){
      const actual=current.find(item=>item.id===row.id);
      if(!actual){
        // Explicit human retractions may suppress an entire typed source row.
        const sourceFields=projected.filter(field=>field.subjectId===row.id);
        if(sourceFields.some(field=>field.logicalId&&latest.get(field.logicalId)?.reviewer&&latest.get(field.logicalId)?.state==="retracted"))continue;
        throw fault("PROJECTION_CONFLICT",`normalized typed row is absent from case snapshot: ${documentId}:${page}:${row.id}`);
      }
      for(const property of properties){
        const value=row[property] as NumericInput|null|undefined;
        if(value!==null&&value!==undefined&&!same(value,actual[property]))throw fault("PROJECTION_CONFLICT",`normalized amount differs from typed case input: ${documentId}:${page}:${collection}.${property}`);
      }
    }
  }
}

export async function buildCaseFeatureSnapshot(database:D1Database,input:{caseData:CaseData}){
  const data=input.caseData,caseId=data.context.id;
  const before=await database.prepare("SELECT c.revision,s.data_version FROM cases c LEFT JOIN case_data_change_state s ON s.case_id=c.id WHERE c.id=?").bind(caseId).first<{revision:number;data_version:number|null}>();
  if(!before||before.revision!==data.context.revision)throw fault("CASE_REVISION_MISMATCH","case revision changed before source snapshot validation");
  const heads=(await database.prepare("SELECT h.case_id,h.source_document_id,h.page,h.run_id,h.case_revision AS head_case_revision,r.case_id AS run_case_id,r.document_instance_id,r.schema_id,r.stage,r.model,r.source_hash,r.image_hash,r.read_sha256,r.case_revision AS run_case_revision,i.case_id AS instance_case_id,i.source_document_id AS instance_source_document_id,i.page AS instance_page,i.shared_document_type_id,i.family_id,s.sha256 AS schema_sha256,s.payload_json AS schema_payload_json,d.case_id AS document_case_id,d.sha256 AS document_sha256 FROM case_extraction_heads h JOIN extraction_runs r ON r.id=h.run_id JOIN document_instances i ON i.id=r.document_instance_id JOIN extraction_schema_versions s ON s.id=r.schema_id JOIN documents d ON d.id=h.source_document_id WHERE h.case_id=? ORDER BY h.source_document_id,h.page").bind(caseId).all<Head>()).results;
  const warnings:string[]=[],sourceHeads:Array<{documentId:string;page:number;runId:string;readSha256:string;schemaId:string;schemaSha256:string;model:string;sourceHash:string;headCaseRevision:number;records:number;features:number}>=[];
  for(const head of heads){
    if(head.run_case_id!==caseId||head.instance_case_id!==caseId||head.document_case_id!==caseId||head.instance_source_document_id!==head.source_document_id||head.instance_page!==head.page||head.stage!=="committed"||head.document_sha256!==head.source_hash)throw fault("SOURCE_INTEGRITY_MISMATCH","active head, case, run, document and page bindings disagree");
    const document=data.documents.find(item=>item.id===head.source_document_id&&item.status==="active"),page=data.pages.find(item=>item.documentId===head.source_document_id&&item.page===head.page);
    if(!document||page?.role!=="evidence") {warnings.push(`inactive_source_head_ignored:${head.source_document_id}:${head.page}`);continue;}
    if(document.sha256!==head.source_hash||!document.pages.includes(head.page))throw fault("SOURCE_INTEGRITY_MISMATCH","active source hash/page disagrees with case snapshot");
    const sourceRead=await database.prepare("SELECT read_json FROM extraction_runs WHERE id=?").bind(head.run_id).first<{read_json:string}>();
    if(!sourceRead)throw fault("SOURCE_INTEGRITY_MISMATCH","active source read is missing");
    if(await digest(sourceRead.read_json)!==head.read_sha256||await digest(head.schema_payload_json)!==head.schema_sha256)throw fault("SOURCE_INTEGRITY_MISMATCH","immutable source read/schema checksum differs");
    const original=parse(sourceRead.read_json,"source read JSON is invalid") as PageRead,schema=parse(head.schema_payload_json,"schema JSON is invalid");
    const schemaFields=(await database.prepare("SELECT canonical_field_id,ordinal,local_key,label,datatype,unit,subject_role,party_role,temporal_role,amount_owner_role,definition_json FROM extraction_schema_fields WHERE schema_id=? ORDER BY ordinal").bind(head.schema_id).all<SchemaField>()).results;
    const definitions=schema.contract?.fields??[];
    if(!Array.isArray(definitions)||definitions.length!==schemaFields.length)throw fault("SOURCE_INTEGRITY_MISMATCH","physical schema field count differs from immutable contract");
    for(const [index,field]of schemaFields.entries()){
      const definition=definitions[index];
      if(field.ordinal!==index||field.canonical_field_id!==definition.global_field_id||field.local_key!==definition.local_id||field.label!==definition.label||field.datatype!==definition.datatype||field.unit!==definition.canonical_unit||field.subject_role!==definition.subject_entity_role||field.party_role!==definition.party_value_role||field.temporal_role!==definition.temporal_role||field.amount_owner_role!==definition.amount_owner_role||!same(parse(field.definition_json,"field definition JSON invalid"),definition))throw fault("SOURCE_INTEGRITY_MISMATCH","physical schema field differs from immutable contract");
    }
    const records=(await database.prepare("SELECT id,ordinal,category,label FROM extraction_records WHERE run_id=? ORDER BY ordinal").bind(head.run_id).all<RecordRow>()).results;
    const features=(await database.prepare("SELECT f.id,f.record_id,f.schema_id,f.ordinal,f.canonical_field_id,f.field_key,f.label,f.raw_value_json,f.unit,f.source_state,f.confidence,f.quote,f.bbox_json,f.raw_field_json,f.projection_key,f.binding_version FROM extracted_features f JOIN extraction_records r ON r.id=f.record_id WHERE r.run_id=? ORDER BY r.ordinal,f.ordinal").bind(head.run_id).all<FeatureRow>()).results;
    if(!Array.isArray(original.records)||records.length!==original.records.length)throw fault("SOURCE_INTEGRITY_MISMATCH","physical source record count differs from immutable read");
    const rebuilt={...original,records:records.map((record,ri)=>{
      const old=original.records[ri],fields=features.filter(field=>field.record_id===record.id);
      if(record.ordinal!==ri||record.category!==old.category||record.label!==old.label||fields.length!==old.fields.length)throw fault("SOURCE_INTEGRITY_MISMATCH","source record identity/count differs from immutable read");
      return {...old,category:record.category,label:record.label,fields:fields.map((field,fi)=>{
        const raw=parse(field.raw_field_json,"raw source field JSON invalid"),expected=old.fields[fi];
        if(field.binding_version===CANONICAL_SOURCE_BINDING_VERSION){
          const binding=bindCanonicalSourceField(raw,schema.contract??null);
          const mapped=canonicalProjectionKey(schema.contract??null,binding,record.category);
          if(binding.canonicalFieldId!==field.canonical_field_id||mapped!==field.projection_key)
            throw fault("SOURCE_INTEGRITY_MISMATCH","canonical OCR field/typed projection differs from immutable source");
        }
        if(field.ordinal!==fi||field.schema_id!==head.schema_id||!same(raw,expected)||field.field_key!==raw.key||field.label!==raw.label||!same(parse(field.raw_value_json,"raw value JSON invalid"),raw.value)||field.unit!==(raw.unit??null)||field.source_state!==(raw.sourceState??null)||field.confidence!==raw.confidence||field.quote!==(raw.quote??null)||!same(parse(field.bbox_json,"bbox JSON invalid"),raw.bbox??null))throw fault("SOURCE_INTEGRITY_MISMATCH","normalized feature differs from immutable source field");
        if(field.canonical_field_id&&!definitions.some((definition:any)=>definition.global_field_id===field.canonical_field_id&&(raw.canonicalFieldId?raw.canonicalFieldId===definition.global_field_id:raw.key===definition.local_id||raw.key===definition.global_field_id)))throw fault("SOURCE_INTEGRITY_MISMATCH","normalized canonical field binding differs from source/schema");
        return raw;
      })};
    })};
    if(!same(rebuilt,original))throw fault("SOURCE_INTEGRITY_MISMATCH","normalized source reconstruction differs from immutable read");
    const read=validatePageRead(structuredClone(rebuilt));
    verifyProjection(data,projectPage(read,head.source_document_id,head.page,head.source_hash),head.source_document_id,head.page,warnings);
    sourceHeads.push({documentId:head.source_document_id,page:head.page,runId:head.run_id,readSha256:head.read_sha256,schemaId:head.schema_id,schemaSha256:head.schema_sha256,model:head.model,sourceHash:head.source_hash,headCaseRevision:head.head_case_revision,records:records.length,features:features.length});
  }
  const sourcePages=new Set(sourceHeads.map(head=>head.documentId+":"+head.page));
  const legacyPages=[...new Set(currentFacts(data).filter(fact=>!fact.reviewer).flatMap(fact=>fact.refs.filter(ref=>data.documents.some(document=>document.id===ref.documentId&&document.status==="active")&&!sourcePages.has(ref.documentId+":"+ref.page)).map(ref=>ref.documentId+":"+ref.page)))];
  if(!sourceHeads.length)warnings.push("legacy_case_snapshot_fallback:no_active_normalized_source_heads");
  else if(legacyPages.length)warnings.push(`legacy_source_pages_without_normalized_heads:${legacyPages.length}`);
  const after=await database.prepare("SELECT c.revision,s.data_version FROM cases c LEFT JOIN case_data_change_state s ON s.case_id=c.id WHERE c.id=?").bind(caseId).first<{revision:number;data_version:number|null}>();
  if(!after||after.revision!==before.revision||after.data_version!==before.data_version)throw fault("CASE_REVISION_MISMATCH","source data changed during source snapshot validation");
  return {caseData:structuredClone(data),sourceHeads,inputOrigin:sourceHeads.length?"normalized_rows_validated_case_snapshot" as const:"legacy_case_snapshot" as const,
    legacySnapshotFallback:!sourceHeads.length||legacyPages.length>0,warnings,legalRecognition:"not_provided" as const,sourceDataVersion:after.data_version};
}
