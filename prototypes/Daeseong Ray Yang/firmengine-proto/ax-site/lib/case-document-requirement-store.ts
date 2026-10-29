import { validateIntakeCatalog } from "./intake-engine.ts";
import { intakeCatalogSha256 } from "./intake-catalog-snapshot.ts";
import type { IntakeCatalog,IntakeRequirement,IntakeResult } from "./intake-types.ts";
import { buildSharedDocumentCatalog } from "./shared-document-catalog.ts";
import { buildCaseRequirementFieldPlan, type CaseRequirementFieldPlan } from "./case-requirement-field-plan.ts";

const hash=async(text:string)=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text)))].map(byte=>byte.toString(16).padStart(2,"0")).join("");
const required=(value:string,label:string)=>{if(typeof value!=="string"||!value.trim()||value.length>16_000)throw new Error("CASE_REQUIREMENT_INVALID_"+label);return value;};
export interface CaseDocumentRequirementInput {caseId:string;runId:string;catalog:IntakeCatalog;catalogSha256:string;result:IntakeResult;}

/** Normalize an existing immutable catalogue. No DDL or seed creation occurs here. */
export async function persistSharedDocumentTypes(database:D1Database,input:{catalog:IntakeCatalog;catalogSha256:string}){
  const catalog=validateIntakeCatalog(input.catalog),sha256=await intakeCatalogSha256(catalog);
  if(sha256!==input.catalogSha256)throw new Error("CASE_REQUIREMENT_CATALOG_HASH_MISMATCH");
  const stored=await database.prepare("SELECT sha256 FROM intake_catalog_versions WHERE version = ?").bind(catalog.version).first<{sha256:string}>();
  if(stored?.sha256!==sha256)throw new Error("CASE_REQUIREMENT_CATALOG_NOT_STORED");
  const at=new Date().toISOString(),statements:D1PreparedStatement[]=[];
  statements.push(database.prepare("UPDATE shared_document_types SET active = 0 WHERE catalog_sha256 <> ? AND EXISTS (SELECT 1 FROM intake_catalog_head WHERE id = 'default' AND sha256 = ?)").bind(sha256,sha256));
  for(const document of catalog.documents){
    const mode=document.ocr?.collectionMode??"client_evidence",status=document.ocr?.routingStatus??"review_required",payload=JSON.stringify(document);
    statements.push(database.prepare(`INSERT INTO shared_document_types (id,name,category,issuer,purpose,collection_mode,routing_status,catalog_version,catalog_sha256,active,payload_json,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,CASE WHEN EXISTS (SELECT 1 FROM intake_catalog_head WHERE id = 'default' AND sha256 = ?) THEN 1 ELSE 0 END,?,?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,issuer=excluded.issuer,purpose=excluded.purpose,collection_mode=excluded.collection_mode,routing_status=excluded.routing_status,catalog_version=excluded.catalog_version,catalog_sha256=excluded.catalog_sha256,active=1,payload_json=excluded.payload_json,updated_at=excluded.updated_at
      WHERE EXISTS (SELECT 1 FROM intake_catalog_head WHERE id = 'default' AND sha256 = excluded.catalog_sha256)`)
      .bind(document.id,document.name,document.category,document.issuer,document.purpose,mode,status,catalog.version,sha256,sha256,payload,at));
    statements.push(database.prepare("INSERT OR IGNORE INTO shared_document_type_versions (catalog_sha256,document_type_id,catalog_version,name,category,issuer,purpose,collection_mode,routing_status,payload_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind(sha256,document.id,catalog.version,document.name,document.category,document.issuer,document.purpose,mode,status,payload,at));
  }
  await database.batch(statements);
  return {catalogVersion:catalog.version,catalogSha256:sha256,documentTypes:catalog.documents.length};
}

/** Skip repeated metadata writes when this exact active version is materialized. */
export async function ensureSharedDocumentTypes(database:D1Database,input:{catalog:IntakeCatalog;catalogSha256:string}){
  const current=await database.prepare("SELECT COUNT(*) AS count FROM shared_document_types WHERE active = 1 AND catalog_sha256 = ?").bind(input.catalogSha256).first<{count:number}>();
  const versions=await database.prepare("SELECT COUNT(*) AS count FROM shared_document_type_versions WHERE catalog_sha256 = ?").bind(input.catalogSha256).first<{count:number}>();
  if(current?.count===input.catalog.documents.length&&versions?.count===input.catalog.documents.length)return {catalogVersion:input.catalog.version,catalogSha256:input.catalogSha256,documentTypes:input.catalog.documents.length};
  return persistSharedDocumentTypes(database,input);
}

/** Prepare rows so the caller can publish run/head/requirements in one D1 batch. */
export async function prepareCaseDocumentRequirementWrites(database:D1Database,input:CaseDocumentRequirementInput,options:{allowPending?:boolean}={}){
  required(input.caseId,"CASE_ID");required(input.runId,"RUN_ID");
  const catalog=validateIntakeCatalog(input.catalog);
  if(await intakeCatalogSha256(catalog)!==input.catalogSha256)throw new Error("CASE_REQUIREMENT_CATALOG_HASH_MISMATCH");
  const run=await database.prepare("SELECT case_id AS caseId,catalog_version AS catalogVersion,status,payload FROM consultation_runs WHERE id = ?").bind(input.runId).first<{caseId:string;catalogVersion:number;status:string;payload:string|null}>();
  const exists=await database.prepare("SELECT id FROM cases WHERE id = ?").bind(input.caseId).first<{id:string}>();
  if(!exists||!run||run.caseId!==input.caseId||run.catalogVersion!==catalog.version||!(run.status==="complete"||options.allowPending&&run.status==="pending"))throw new Error("CASE_REQUIREMENT_RUN_MISMATCH");
  if(run.status==="complete"){
    let saved;try{saved=JSON.parse(run.payload??"");}catch{throw new Error("CASE_REQUIREMENT_RUN_MISMATCH");}
    if(saved.catalogSha256!==input.catalogSha256||JSON.stringify(saved.result)!==JSON.stringify(input.result))throw new Error("CASE_REQUIREMENT_RESULT_MISMATCH");
  }
  const documents=new Map(catalog.documents.map(document=>[document.id,document]));
  const sharedDocuments=new Map(buildSharedDocumentCatalog(catalog,input.catalogSha256).documents.map(document=>[document.documentTypeId,document]));
  const seen=new Set<string>(),at=new Date().toISOString(),statements:D1PreparedStatement[]=[];
  const existing=(await database.prepare("SELECT requirement_id AS id,raw_json AS rawJson FROM case_document_requirements WHERE consultation_run_id = ?").bind(input.runId).all<{id:string;rawJson:string}>()).results;
  const previous=new Map(existing.map(row=>[row.id,row.rawJson]));
  if(!Array.isArray(input.result.requirements)||input.result.requirements.length>10_000)throw new Error("CASE_REQUIREMENT_INVALID_RESULT");
  for(const requirement of input.result.requirements){
    const document=documents.get(requirement.documentTypeId),raw=JSON.stringify(requirement);
    if(!document||document.name!==requirement.documentName)throw new Error("CASE_REQUIREMENT_DOCUMENT_MISMATCH");
    const fieldPlan=buildCaseRequirementFieldPlan({caseId:input.caseId,runId:input.runId,requirement,document,shared:sharedDocuments.get(document.id),catalogVersion:catalog.version,catalogSha256:input.catalogSha256});
    const fieldPlanJson=JSON.stringify(fieldPlan);
    if(seen.has(requirement.id)||previous.has(requirement.id)&&previous.get(requirement.id)!==raw)throw new Error("CASE_REQUIREMENT_IMMUTABLE_ROW_CONFLICT");
    seen.add(required(requirement.id,"ID"));required(requirement.subjectId,"SUBJECT");required(requirement.subjectLabel,"SUBJECT_LABEL");required(requirement.period,"PERIOD");
    if(!["required_when_applicable","recommended","court_ordered"].includes(requirement.requirement)||!["requested","qualification_needed","conflict","legal_review"].includes(requirement.status))throw new Error("CASE_REQUIREMENT_INVALID_STATUS");
    statements.push(database.prepare(`INSERT OR IGNORE INTO case_document_requirements
      (consultation_run_id,requirement_id,case_id,document_type_id,document_name,subject_id,subject_label,required_period,requirement,status,catalog_version,catalog_sha256,raw_json,raw_sha256,created_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM consultation_runs WHERE id = ? AND case_id = ? AND status = 'complete')`)
      .bind(input.runId,requirement.id,input.caseId,requirement.documentTypeId,requirement.documentName,requirement.subjectId,requirement.subjectLabel,requirement.period,requirement.requirement,requirement.status,catalog.version,input.catalogSha256,raw,await hash(raw),at,input.runId,input.caseId));
    statements.push(database.prepare(`INSERT OR IGNORE INTO case_requirement_field_plans
      (consultation_run_id,requirement_id,case_id,document_type_id,catalog_sha256,schema_version,routing_status,mapping_status,plan_json,plan_sha256,created_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM case_document_requirements WHERE consultation_run_id = ? AND requirement_id = ? AND case_id = ?)`)
      .bind(input.runId,requirement.id,input.caseId,requirement.documentTypeId,input.catalogSha256,fieldPlan.schemaVersion,fieldPlan.routingStatus,fieldPlan.mappingStatus,fieldPlanJson,await hash(fieldPlanJson),at,input.runId,requirement.id,input.caseId));
  }
  if(existing.some(row=>!seen.has(row.id)))throw new Error("CASE_REQUIREMENT_IMMUTABLE_ROW_CONFLICT");
  return statements;
}

export async function persistCaseDocumentRequirements(database:D1Database,input:CaseDocumentRequirementInput){
  await persistSharedDocumentTypes(database,input);
  const statements=await prepareCaseDocumentRequirementWrites(database,input);
  if(statements.length)await database.batch(statements);
  return {caseId:input.caseId,runId:input.runId,requirements:input.result.requirements.length};
}

/** Only consultation_heads.active_run_id determines current requirements. */
export async function listCaseDocumentRequirements(database:D1Database,caseId:string){
  required(caseId,"CASE_ID");
  const rows=(await database.prepare(`SELECT run.id AS activeRunId,requirement.requirement_id AS requirementId,requirement.case_id AS caseId,requirement.consultation_run_id AS consultationRunId,
    requirement.document_type_id AS documentTypeId,requirement.document_name AS documentName,requirement.subject_id AS subjectId,requirement.subject_label AS subjectLabel,
    requirement.required_period AS period,requirement.requirement,requirement.status,requirement.catalog_version AS catalogVersion,requirement.catalog_sha256 AS catalogSha256,requirement.raw_json AS rawJson,requirement.raw_sha256 AS rawSha256,plan.plan_json AS planJson,plan.plan_sha256 AS planSha256
    FROM consultation_heads AS head
    LEFT JOIN consultation_runs AS run ON run.id = head.active_run_id AND run.case_id = head.case_id AND run.status = 'complete'
    LEFT JOIN case_document_requirements AS requirement ON requirement.consultation_run_id = run.id AND requirement.case_id = head.case_id
    LEFT JOIN case_requirement_field_plans AS plan ON plan.consultation_run_id = requirement.consultation_run_id AND plan.requirement_id = requirement.requirement_id AND plan.case_id = head.case_id
    WHERE head.case_id = ? ORDER BY requirement.document_type_id,requirement.subject_id,requirement.requirement_id`).bind(caseId).all<{activeRunId:string|null;requirementId:string|null;caseId:string;consultationRunId:string;documentTypeId:string;documentName:string;subjectId:string;subjectLabel:string;period:string;requirement:string;status:string;catalogVersion:number;catalogSha256:string;rawJson:string;rawSha256:string;planJson:string|null;planSha256:string|null}>()).results;
  const requirements=[];
  for(const row of rows){
    if(row.requirementId===null)continue;
    if(typeof row.rawJson!=="string"||await hash(row.rawJson)!==row.rawSha256)throw new Error("CASE_REQUIREMENT_INTEGRITY_FAILED");
    const raw=JSON.parse(row.rawJson) as IntakeRequirement;
    if(raw.id!==row.requirementId||raw.documentTypeId!==row.documentTypeId||raw.documentName!==row.documentName||raw.subjectId!==row.subjectId||raw.subjectLabel!==row.subjectLabel||raw.period!==row.period||raw.requirement!==row.requirement||raw.status!==row.status)throw new Error("CASE_REQUIREMENT_INTEGRITY_FAILED");
    let fieldPlan:CaseRequirementFieldPlan|null=null;
    if(row.planJson!==null){
      if(typeof row.planJson!=="string"||!row.planSha256||await hash(row.planJson)!==row.planSha256)throw new Error("CASE_FIELD_PLAN_INTEGRITY_FAILED");
      try{fieldPlan=JSON.parse(row.planJson) as CaseRequirementFieldPlan;}catch{throw new Error("CASE_FIELD_PLAN_INTEGRITY_FAILED");}
      if(fieldPlan.caseId!==caseId||fieldPlan.consultationRunId!==row.consultationRunId||fieldPlan.requirementId!==row.requirementId||fieldPlan.documentTypeId!==row.documentTypeId||fieldPlan.catalogSha256!==row.catalogSha256||fieldPlan.subjectId!==row.subjectId||fieldPlan.period!==row.period)
        throw new Error("CASE_FIELD_PLAN_INTEGRITY_FAILED");
    }
    const {rawJson:_rawJson,rawSha256:_rawSha256,activeRunId:_activeRunId,planJson:_planJson,planSha256:_planSha256,...columns}=row;
    requirements.push({...columns,raw,fieldPlan,fieldPlanStatus:fieldPlan?"materialized":"legacy_unmaterialized"});
  }
  // Do not imply "no documents required" while reanalysis is pending.
  const activeRunId=rows[0]?.activeRunId??null;
  const previous=activeRunId?null:await database.prepare("SELECT id FROM consultation_runs WHERE case_id=? AND status='complete' ORDER BY updated_at DESC LIMIT 1").bind(caseId).first<{id:string}>();
  return {caseId,activeRunId,requirements,pendingReanalysis:!activeRunId&&!!previous,previousCompletedRunId:previous?.id??null};
}
