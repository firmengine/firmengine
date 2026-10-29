import { CONSULTATION_AI_MODEL as AI_MODEL, type CaseData } from "./domain.ts";
import { actor, connection, db, event, getCase, HttpError, now, sha256 } from "./server-store.ts";
import { callLuna } from "./luna.ts";
import { INTAKE_CATALOG_SEED } from "./intake-catalog.ts";
import { buildIntakeClassifierRequest } from "./intake-classifier.ts";
import { adaptIntakeClassifierResponse } from "./intake-classifier-response.ts";
import { resolveIntakeSourceSpanRefs } from "./intake-source-spans.ts";
import { matchIntakeChecklist, validateIntakeCatalog, validateIntakeClaims } from "./intake-engine.ts";
import { INTAKE_ACTIVE_MAX_CHARS, INTAKE_NOTE_MAX_CHARS, INTAKE_ENGINE_VERSION, INTAKE_PROMPT_VERSION, type ConsultationNote, type IntakeCatalog, type IntakeChecklistView, type IntakeRun } from "./intake-types.ts";
import { INTAKE_CLASSIFIER_OUTPUT_CONTRACT_VERSION, INTAKE_FINGERPRINT_SCHEMA, intakeInputFingerprint } from "./intake-fingerprint.ts";
import { readActiveIntakeCatalogSnapshot, supplementIntakeCatalog } from "./intake-catalog-snapshot.ts";
import { ensureSharedDocumentTypes, prepareCaseDocumentRequirementWrites } from "./case-document-requirement-store.ts";
import { recomputeCaseDataUpdate } from "./case-data-recompute.ts";

/** One-way identifier preserves the protected-case guard without publishing case metadata. */
export const PROTECTED_INTAKE_CASE_SHA256 = "1dfd979da22e0b7222eec78973c993ae0e1220748fd558ac2e236350c9d92aae";
const digest = (value:unknown) => sha256(new TextEncoder().encode(JSON.stringify(value)));
const textDigest = (value:string) => sha256(new TextEncoder().encode(value));
type CatalogState = {catalog:IntakeCatalog;sha256:string;history:{version:number;createdAt:string;actor:string;sha256:string}[];model:string};
type Head = {revision:number;activeRunId:string|null};
type Identity = {revision:number;token:string};
const integer = (value:unknown,label:string) => {if(!Number.isSafeInteger(value)||Number(value)<0)throw new HttpError(400,`${label}을 확인하세요.`);return Number(value);};

/** Immutable catalogue revisions; seed data is intentionally outside SQL migrations. */
export async function getIntakeCatalog():Promise<CatalogState> {
  const database=db();
  for(let attempt=0;attempt<4;attempt++){
    let snapshot;
    try{snapshot=await readActiveIntakeCatalogSnapshot(database);}catch{throw new HttpError(409,"서류 기준정보 무결성 확인에 실패했습니다.");}
    if(!snapshot){
      const seed=validateIntakeCatalog(structuredClone(INTAKE_CATALOG_SEED)),hash=await digest(seed),at=now();
      await database.batch([
        database.prepare("INSERT OR IGNORE INTO intake_catalog_versions (version,schema_version,payload,sha256,actor,created_at) VALUES (?,?,?,?,?,?)").bind(seed.version,seed.schemaVersion,JSON.stringify(seed),hash,"system:reference-seed",at),
        database.prepare("INSERT OR IGNORE INTO intake_catalog_head (id,version,sha256) SELECT 'default',version,sha256 FROM intake_catalog_versions WHERE version = ?").bind(seed.version),
      ]);
      continue;
    }
    // Registry additions become a new immutable active version. Never overlay a
    // newer seed onto one consumer while another reads the stored DB payload.
    const upgrade=supplementIntakeCatalog(snapshot.catalog,INTAKE_CATALOG_SEED);
    if(upgrade.changed){
      const latest=await database.prepare("SELECT MAX(version) AS version FROM intake_catalog_versions").first<{version:number|null}>();
      const catalog=upgrade.catalog;
      catalog.version=Math.max(catalog.version,(latest?.version??0)+1);
      const serialized=JSON.stringify(catalog);
      if(new TextEncoder().encode(serialized).byteLength>750_000)throw new HttpError(413,"서류 기준정보가 허용 크기를 초과했습니다.");
      const hash=await digest(catalog),at=now();
      try{
        const saved=await database.batch([
          database.prepare("INSERT INTO intake_catalog_versions (version,schema_version,payload,sha256,actor,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM intake_catalog_head WHERE id = 'default' AND version = ? AND sha256 = ?)").bind(catalog.version,catalog.schemaVersion,serialized,hash,"system:unified-document-catalog",at,snapshot.catalog.version,snapshot.sha256),
          database.prepare("UPDATE intake_catalog_head SET version = ?,sha256 = ? WHERE id = 'default' AND version = ? AND sha256 = ? AND EXISTS (SELECT 1 FROM intake_catalog_versions WHERE version = ? AND sha256 = ?)").bind(catalog.version,hash,snapshot.catalog.version,snapshot.sha256,catalog.version,hash),
        ]);
        if(!saved[1].meta.changes)continue;
      }catch(error){if(/unique|constraint/i.test(error instanceof Error?error.message:""))continue;throw error;}
      // Re-read the authoritative winner, including any concurrent custom edit.
      continue;
    }
    await ensureSharedDocumentTypes(database,{catalog:snapshot.catalog,catalogSha256:snapshot.sha256});
    const history=(await database.prepare("SELECT version,created_at AS createdAt,actor,sha256 FROM intake_catalog_versions ORDER BY version DESC LIMIT 30").all<CatalogState["history"][number]>()).results;
    return {catalog:snapshot.catalog,sha256:snapshot.sha256,history,model:AI_MODEL};
  }
  throw new HttpError(409,"서류 기준정보가 갱신 중입니다. 최신 기준을 다시 불러오세요.");
}

export async function saveIntakeCatalog(value:unknown,expectedVersion:unknown):Promise<CatalogState>{
  const expected=integer(expectedVersion,"기준정보 버전"),current=await getIntakeCatalog();
  if(current.catalog.version!==expected)throw new HttpError(409,"다른 변경으로 서류 기준이 갱신되었습니다. 최신 기준을 불러오세요.");
  if(!value||typeof value!=="object"||Array.isArray(value))throw new HttpError(400,"서류 기준정보 형식을 확인하세요.");
  let catalog:IntakeCatalog;
  try{catalog=validateIntakeCatalog({...value,version:expected+1});}catch(error){throw new HttpError(400,error instanceof Error?error.message:"서류 기준정보를 확인하세요.");}
  const serialized=JSON.stringify(catalog);
  if(new TextEncoder().encode(serialized).byteLength>750_000)throw new HttpError(413,"서류 기준정보가 허용 크기를 초과했습니다.");
  const hash=await digest(catalog),by=await actor(),at=now();
  let saved;
  try{saved=await db().batch([
    db().prepare("INSERT INTO intake_catalog_versions (version,schema_version,payload,sha256,actor,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM intake_catalog_head WHERE id = 'default' AND version = ? AND sha256 = ?)").bind(catalog.version,catalog.schemaVersion,serialized,hash,by,at,expected,current.sha256),
    db().prepare("UPDATE intake_catalog_head SET version = ?,sha256 = ? WHERE id = 'default' AND version = ? AND sha256 = ? AND EXISTS (SELECT 1 FROM intake_catalog_versions WHERE version = ? AND sha256 = ?)").bind(catalog.version,hash,expected,current.sha256,catalog.version,hash),
  ]);}catch(error){if(/unique|constraint/i.test(error instanceof Error?error.message:""))throw new HttpError(409,"다른 변경으로 기준정보가 갱신되었습니다. 최신 기준을 불러오세요.");throw error;}
  if(!saved[1].meta.changes)throw new HttpError(409,"서류 기준이 변경되었습니다. 최신 기준을 불러오세요.");
  return getIntakeCatalog();
}

export function activeConsultationNotes(notes:ConsultationNote[]):ConsultationNote[]{
  const replaced=new Set(notes.map(note=>note.supersedesId).filter((id):id is string=>!!id));
  return notes.filter(note=>!replaced.has(note.id));
}
export async function isIntakeReadOnly(data:CaseData):Promise<boolean>{return !!data.structuredTest||!!data.referenceTest||await textDigest(data.context.id)===PROTECTED_INTAKE_CASE_SHA256;}
async function writable(data:CaseData){if(await isIntakeReadOnly(data))throw new HttpError(409,"보존 중인 원본·평가 사건입니다. 별도의 상담용 사건에서 진행하세요.");}

async function caseIdentity(id:string):Promise<Identity>{
  const row=await db().prepare("SELECT revision,storage_token AS token FROM cases WHERE id = ?").bind(id).first<Identity>();
  if(!row)throw new HttpError(404,"사건을 찾을 수 없습니다.");return row;
}
async function intakeSnapshot(id:string){
  // getCase is read-only; never call caseExtras/derived evaluation for intake.
  const before=await caseIdentity(id),data=await getCase(id),after=await caseIdentity(id);
  if(before.revision!==after.revision||before.token!==after.token||data.context.revision!==after.revision)throw new HttpError(409,"사건이 변경되었습니다. 최신 사건을 불러오세요.");
  return {data,identity:after,inputSha256:await digest(data)};
}
async function readNotes(caseId:string){
  const head=await db().prepare("SELECT revision,active_run_id AS activeRunId FROM consultation_heads WHERE case_id = ?").bind(caseId).first<Head>();
  const notes:ConsultationNote[]=(await db().prepare("SELECT id,case_id AS caseId,sequence,text,text_sha256 AS textSha256,occurred_at AS occurredAt,supersedes_id AS supersedesId,actor,created_at AS createdAt FROM consultation_notes WHERE case_id = ? ORDER BY sequence").bind(caseId).all<ConsultationNote>()).results;
  if(notes.length>100||notes.length!==(head?.revision??0)||notes.some((n,i)=>n.sequence!==i+1))throw new HttpError(409,"상담 이력이 변경되었습니다. 다시 불러오세요.");
  for(const note of notes)if(await textDigest(note.text)!==note.textSha256)throw new HttpError(409,"상담 원문 무결성 확인에 실패했습니다.");
  return {head:head??{revision:0,activeRunId:null},notes};
}
export async function consultationHistorySha256(notes:ConsultationNote[]){return digest(notes.map(n=>({id:n.id,sequence:n.sequence,textSha256:n.textSha256,occurredAt:n.occurredAt,supersedesId:n.supersedesId})));}
async function semanticFingerprint(notes:ConsultationNote[],data:CaseData,catalogHash:string){
  return intakeInputFingerprint({notes,catalogHash,courtId:data.context.courtId,asOf:data.context.asOf,engineVersion:INTAKE_ENGINE_VERSION,promptVersion:INTAKE_PROMPT_VERSION,model:AI_MODEL,outputContractVersion:INTAKE_CLASSIFIER_OUTPUT_CONTRACT_VERSION});
}

export async function getConsultationView(caseId:string):Promise<IntakeChecklistView>{
  const snapshot=await intakeSnapshot(caseId),catalog=await getIntakeCatalog(),{head,notes}=await readNotes(caseId);
  const row=await db().prepare("SELECT id,case_id AS caseId,case_revision AS caseRevision,case_storage_token AS caseStorageToken,consultation_revision AS consultationRevision,catalog_version AS catalogVersion,payload,payload_sha256 AS payloadSha256 FROM consultation_runs WHERE case_id = ? AND status = 'complete' ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END,updated_at DESC LIMIT 1").bind(caseId,head.activeRunId??"").first<{id:string;caseId:string;caseRevision:number;caseStorageToken:string;consultationRevision:number;catalogVersion:number;payload:string;payloadSha256:string|null}>();
  let run:IntakeRun|null=null;
  if(row?.payload){
    if(!row.payloadSha256||await textDigest(row.payload)!==row.payloadSha256)throw new HttpError(409,"저장된 상담 분석의 무결성 확인에 실패했습니다. 원본 이력은 보존되어 있습니다.");
    try{run=JSON.parse(row.payload) as IntakeRun;}catch{throw new HttpError(409,"저장된 상담 분석을 확인하지 못했습니다.");}
    if(run.id!==row.id||run.caseId!==caseId||run.caseId!==row.caseId||run.caseRevision!==row.caseRevision||run.caseStorageToken!==row.caseStorageToken||run.consultationRevision!==row.consultationRevision||run.catalogVersion!==row.catalogVersion)throw new HttpError(409,"상담 분석과 저장 판본의 연결을 확인하지 못했습니다.");
    const reasons:string[]=[],historyHash=await consultationHistorySha256(notes);
    const currentV2=run.intakeInputFingerprintVersion===INTAKE_FINGERPRINT_SCHEMA&&typeof run.intakeInputFingerprint==="string";
    if(currentV2){
      // v2 means semantic classifier inputs only. Case revision/token/whole-case
      // hash remain audit metadata and workflow adoption cannot invalidate this run.
      if(run.consultationSha256!==historyHash)reasons.push("상담 이력 변경");
      if(run.catalogSha256!==catalog.sha256)reasons.push("서류 기준정보 변경");
      if(run.semanticContext?.courtId!==snapshot.data.context.courtId||run.semanticContext?.asOf!==snapshot.data.context.asOf)reasons.push("관할·기준일 변경");
      if(run.engineVersion!==INTAKE_ENGINE_VERSION||run.promptVersion!==INTAKE_PROMPT_VERSION||run.model!==AI_MODEL||run.semanticContext?.outputContractVersion!==INTAKE_CLASSIFIER_OUTPUT_CONTRACT_VERSION)reasons.push("분류·매칭 기준 변경");
      const currentFingerprint=await semanticFingerprint(notes,snapshot.data,catalog.sha256);
      if(currentFingerprint!==run.intakeInputFingerprint&&!reasons.length)reasons.push("상담 분류 의미 입력 변경");
    }else{
      // Legacy v1 payloads and receipts remain immutable and use their original
      // full-case identity semantics. Do not synthesize a v2 proof from them.
      if(run.caseRevision!==snapshot.data.context.revision||run.caseStorageToken!==snapshot.identity.token||run.caseInputSha256!==snapshot.inputSha256)reasons.push("사건 자료 변경");
      if(run.consultationRevision!==head.revision||run.consultationSha256!==historyHash)reasons.push("상담 이력 변경");
      if(run.catalogVersion!==catalog.catalog.version||run.catalogSha256!==catalog.sha256)reasons.push("서류 기준정보 변경");
      if(run.engineVersion!==INTAKE_ENGINE_VERSION||run.promptVersion!==INTAKE_PROMPT_VERSION||run.model!==AI_MODEL)reasons.push("분류·매칭 기준 변경");
    }
    run={...run,stale:reasons.length>0,staleReasons:reasons};
  }
  const latestAttempt=await db().prepare("SELECT id,status,lease_until AS leaseUntil,error,updated_at AS updatedAt FROM consultation_runs WHERE case_id = ? ORDER BY updated_at DESC LIMIT 1").bind(caseId).first<NonNullable<IntakeChecklistView["latestAttempt"]>>();
  return {caseId,caseName:snapshot.data.context.caseName,caseRevision:snapshot.data.context.revision,courtId:snapshot.data.context.courtId,consultationRevision:head.revision,notes,run,latestAttempt,catalogVersion:catalog.catalog.version,model:AI_MODEL,apiKeyConfigured:connection().apiKeyConfigured,readOnly:await isIntakeReadOnly(snapshot.data)};
}

export async function appendConsultation(caseId:string,body:Record<string,unknown>){
  const snapshot=await intakeSnapshot(caseId);await writable(snapshot.data);
  const expected=integer(body.expectedConsultationRevision,"상담 버전"),{head,notes}=await readNotes(caseId);
  if(head.revision!==expected)throw new HttpError(409,"상담이 변경되었습니다. 최신 이력을 불러오세요.");
  if(typeof body.text!=="string"||!body.text.trim()||body.text.length>INTAKE_NOTE_MAX_CHARS)throw new HttpError(400,"상담 내용은 1~16,000자 이내로 입력하세요.");
  if(notes.length>=100)throw new HttpError(409,"상담 이력이 100건에 도달했습니다. 사건 기록을 검토해 주세요.");
  const supersedesId=body.supersedesId??null;
  if(supersedesId!==null&&(typeof supersedesId!=="string"||!activeConsultationNotes(notes).some(n=>n.id===supersedesId)))throw new HttpError(400,"정정할 현재 상담 이력을 선택하세요.");
  const occurredAt=body.occurredAt??null;
  if(occurredAt!==null){
    if(typeof occurredAt!=="string"||!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(occurredAt)||!Number.isFinite(Date.parse(occurredAt)))throw new HttpError(400,"상담 일자를 확인하세요.");
    const calendarDate=occurredAt.slice(0,10);
    if(new Date(`${calendarDate}T00:00:00Z`).toISOString().slice(0,10)!==calendarDate)throw new HttpError(400,"실제 존재하는 상담 일자를 입력하세요.");
  }
  const text=body.text.trim(),active=activeConsultationNotes(notes).filter(n=>n.id!==supersedesId);
  if(active.reduce((sum,n)=>sum+n.text.length,0)+text.length>INTAKE_ACTIVE_MAX_CHARS)throw new HttpError(413,"분석할 상담 원문은 합계 40,000자 이내로 정리해 주세요. 원문을 잘라 분석하지 않습니다.");
  const id=crypto.randomUUID(),at=now(),by=await actor(),textSha256=await textDigest(text);
  await db().prepare("INSERT OR IGNORE INTO consultation_heads (case_id,revision,active_run_id,updated_at) VALUES (?,0,NULL,?)").bind(caseId,at).run();
  const saved=await db().batch([
    db().prepare("INSERT INTO consultation_notes (id,case_id,sequence,text,text_sha256,occurred_at,supersedes_id,actor,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM consultation_heads WHERE case_id = ? AND revision = ?) AND EXISTS (SELECT 1 FROM cases WHERE id = ? AND revision = ? AND storage_token = ?)")
      .bind(id,caseId,expected+1,text,textSha256,occurredAt,supersedesId,by,at,caseId,expected,caseId,snapshot.identity.revision,snapshot.identity.token),
    db().prepare("UPDATE consultation_heads SET revision = ?,active_run_id = NULL,updated_at = ? WHERE case_id = ? AND revision = ? AND EXISTS (SELECT 1 FROM consultation_notes WHERE id = ?)")
      .bind(expected+1,at,caseId,expected,id),
  ]);
  if(!saved[1].meta.changes)throw new HttpError(409,"사건 또는 상담이 변경되었습니다. 최신 이력을 불러오세요.");
  await recomputeCaseDataUpdate(db(),{caseId,loadCase:()=>getCase(caseId)}).catch(()=>{});
  return getConsultationView(caseId);
}

export async function analyzeConsultation(caseId:string,body:Record<string,unknown>){
  const snapshot=await intakeSnapshot(caseId);await writable(snapshot.data);
  const expectedConsultation=integer(body.expectedConsultationRevision,"상담 버전"),expectedCase=integer(body.expectedCaseRevision,"사건 버전"),expectedCatalog=integer(body.expectedCatalogVersion,"기준정보 버전");
  const {head,notes}=await readNotes(caseId),catalog=await getIntakeCatalog();
  if(snapshot.identity.revision!==expectedCase||head.revision!==expectedConsultation||catalog.catalog.version!==expectedCatalog)throw new HttpError(409,"사건·상담·서류 기준이 변경되었습니다. 최신 내용을 불러오세요.");
  const activeNotes=activeConsultationNotes(notes);
  if(!activeNotes.length)throw new HttpError(400,"상담 이력을 먼저 저장하세요.");
  if(activeNotes.reduce((sum,n)=>sum+n.text.length,0)>INTAKE_ACTIVE_MAX_CHARS)throw new HttpError(413,"분석 가능한 상담 원문 크기를 초과했습니다.");
  const historyHash=await consultationHistorySha256(notes);
  const semanticHash=await semanticFingerprint(notes,snapshot.data,catalog.sha256);
  // The semantic hash intentionally omits case identity; the globally unique
  // database key scopes reuse to one case without changing semantic freshness.
  const fingerprint=await digest({scopeCaseId:caseId,semanticHash});
  const existing=await db().prepare("SELECT id,status,lease_until AS leaseUntil FROM consultation_runs WHERE fingerprint = ? AND case_id = ?").bind(fingerprint,caseId).first<{id:string;status:string;leaseUntil:string|null}>();
  if(existing?.status==="complete")return getConsultationView(caseId);
  const at=now(),leaseUntil=new Date(Date.now()+90_000).toISOString(),runId=existing?.id??crypto.randomUUID(),by=await actor();
  if(existing?.status==="pending"&&existing.leaseUntil&&existing.leaseUntil>at)throw new HttpError(409,"동일한 상담 분석이 진행 중입니다. 잠시 후 결과를 새로 불러오세요.");
  const acquired=existing
    ?await db().prepare("UPDATE consultation_runs SET status = 'pending',lease_until = ?,error = NULL,updated_at = ? WHERE id = ? AND (status = 'failed' OR (status = 'pending' AND lease_until <= ?))").bind(leaseUntil,at,runId,at).run()
    :await db().prepare("INSERT OR IGNORE INTO consultation_runs (id,case_id,fingerprint,case_revision,case_storage_token,consultation_revision,catalog_version,status,lease_until,payload,error,actor,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'pending',?,NULL,NULL,?,?,?)")
      .bind(runId,caseId,fingerprint,expectedCase,snapshot.identity.token,expectedConsultation,expectedCatalog,leaseUntil,by,at,at).run();
  if(!acquired.meta.changes)throw new HttpError(409,"동일한 상담 분석이 이미 시작되었습니다. 잠시 후 새로 불러오세요.");
  try{
    const classifierRequest=buildIntakeClassifierRequest(activeNotes,catalog.catalog);
    const response=await callLuna<unknown>(classifierRequest);
    // Usage contains no consultation text and is also retained in the run receipt.
    await event(caseId,"model.call",{agent:"consultation_classifier",runId,...response.usage}).catch(()=>{});
    let claims;
    let classifierReceipt;
    try{const normalized=adaptIntakeClassifierResponse(response.value,classifierRequest.sourceSpans,catalog.catalog);classifierReceipt=normalized.classifierReceipt;claims=validateIntakeClaims(resolveIntakeSourceSpanRefs({claims:normalized.claims},activeNotes),activeNotes,catalog.catalog);}catch(error){throw new HttpError(422,`상담 분류의 근거를 확인하지 못했습니다. ${error instanceof Error?error.message:"원문을 검토해 주세요."}`);}
    const result=matchIntakeChecklist({claims,catalog:catalog.catalog,courtId:snapshot.data.context.courtId,asOf:snapshot.data.context.asOf});
    const run:IntakeRun={id:runId,caseId,caseRevision:expectedCase,caseStorageToken:snapshot.identity.token,caseInputSha256:snapshot.inputSha256,consultationRevision:expectedConsultation,consultationSha256:historyHash,catalogVersion:expectedCatalog,catalogSha256:catalog.sha256,catalogSnapshot:{features:catalog.catalog.features.map(({id,label})=>({id,label})),sources:catalog.catalog.sources,rules:catalog.catalog.rules.map(({id,title})=>({id,title}))},engineVersion:INTAKE_ENGINE_VERSION,promptVersion:INTAKE_PROMPT_VERSION,model:AI_MODEL,createdAt:now(),result,usage:{inputTokens:response.usage.inputTokens,outputTokens:response.usage.outputTokens,durationMs:response.usage.durationMs},classifierReceipt,intakeInputFingerprintVersion:INTAKE_FINGERPRINT_SCHEMA,intakeInputFingerprint:semanticHash,semanticContext:{courtId:snapshot.data.context.courtId,asOf:snapshot.data.context.asOf,outputContractVersion:INTAKE_CLASSIFIER_OUTPUT_CONTRACT_VERSION}};
    const serializedRun=JSON.stringify(run),runHash=await textDigest(serializedRun);
    await ensureSharedDocumentTypes(db(),{catalog:catalog.catalog,catalogSha256:catalog.sha256});
    const requirementWrites=await prepareCaseDocumentRequirementWrites(db(),{caseId,runId,catalog:catalog.catalog,catalogSha256:catalog.sha256,result},{allowPending:true});
    const saved=await db().batch([
      db().prepare("UPDATE consultation_runs SET status = 'complete',payload = ?,payload_sha256 = ?,lease_until = NULL,updated_at = ? WHERE id = ? AND status = 'pending' AND lease_until = ?").bind(serializedRun,runHash,now(),runId,leaseUntil),
      db().prepare("UPDATE consultation_heads SET active_run_id = ? WHERE case_id = ? AND revision = ? AND EXISTS (SELECT 1 FROM cases WHERE id = ? AND revision = ? AND storage_token = ?) AND EXISTS (SELECT 1 FROM intake_catalog_head WHERE id = 'default' AND version = ? AND sha256 = ?) AND EXISTS (SELECT 1 FROM consultation_runs WHERE id = ? AND status = 'complete')")
        .bind(runId,caseId,expectedConsultation,caseId,expectedCase,snapshot.identity.token,expectedCatalog,catalog.sha256,runId),
      ...requirementWrites,
    ]);
    if(!saved[0].meta.changes)throw new HttpError(409,"분석 저장 대기시간이 지나 결과를 현재 분석으로 채택하지 않았습니다. 다시 불러오세요.");
    if(!saved[1].meta.changes)throw new HttpError(409,"분석 중 사건·상담·서류 기준이 변경되었습니다. 이전 결과는 보존했으며 현재 자료로 다시 분석하세요.");
    await recomputeCaseDataUpdate(db(),{caseId,loadCase:()=>getCase(caseId)}).catch(()=>{});
    return getConsultationView(caseId);
  }catch(error){
    const message=error instanceof HttpError?error.message:"상담 분석을 완료하지 못했습니다. 저장된 상담을 확인한 뒤 다시 시도하세요.";
    await db().prepare("UPDATE consultation_runs SET status = 'failed',error = ?,lease_until = NULL,updated_at = ? WHERE id = ? AND status = 'pending' AND lease_until = ?").bind(message,now(),runId,leaseUntil).run();
    if(error instanceof HttpError)throw error;throw new HttpError(502,message);
  }
}
