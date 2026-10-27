import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { AI_MODEL, type CaseData } from "./domain";
import { inspectProcessingReadiness,type StoredDocumentState,type StoredPageState } from "./processing-readiness";

export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
export const now=()=>new Date().toISOString();
export function db():D1Database { if(!env.DB)throw new HttpError(503,"사건 저장소가 준비되지 않았습니다.");return env.DB; }
export function bucket():R2Bucket { if(!env.BUCKET)throw new HttpError(503,"문서 저장소가 준비되지 않았습니다.");return env.BUCKET; }
export function connection(){return {model:AI_MODEL,apiKeyConfigured:!!env.OPENAI_API_KEY,storageReady:!!env.DB&&!!env.BUCKET};}
export async function actor(){const user=await getChatGPTUser();return user?.userId??"private-site-service";}
/** This deployment is owner-private. Sites dispatch authenticates browser and service access.
 * Do not make public without replacing this shared-workspace boundary with per-record ACLs. */
export function requireSameOrigin(request:Request){
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)throw new HttpError(403,"다른 사이트에서 보낸 변경 요청입니다.");
  if(request.headers.get("sec-fetch-site")==="cross-site")throw new HttpError(403,"교차 사이트 요청은 허용하지 않습니다.");
}
export async function jsonBody(request:Request){
  if(!request.headers.get("content-type")?.includes("application/json"))throw new HttpError(415,"JSON 형식이 필요합니다.");
  const text=await request.text();if(text.length>2_000_000)throw new HttpError(413,"요청이 너무 큽니다.");
  try{return JSON.parse(text);}catch{throw new HttpError(400,"JSON을 읽을 수 없습니다.");}
}
// A case revision tracks evidence changes. Manifest/review writes also need their
// own CAS token so a stale export cannot overwrite a newer review or archive.
const caseSnapshots=new WeakMap<CaseData,{id:string;revision:number;token:string}>();
const CASE_INLINE_LIMIT=500_000;
type CaseSummary={documents:number;facts:number;status:"review_required"|"needs_evidence"};
type CasePointer={_storage:"r2-case-v1";caseId:string;revision:number;key:string;sha256:string;summary:CaseSummary};
export function caseSummary(data:CaseData):CaseSummary{const facts=data.facts.length;return {documents:data.documents.filter(d=>d.status==="active").length,facts,status:facts?"review_required":"needs_evidence"};}
function casePointer(value:unknown):value is CasePointer{return !!value&&typeof value==="object"&&(value as CasePointer)._storage==="r2-case-v1";}
function validPointer(pointer:CasePointer,id:string,revision:number){return pointer.caseId===id&&pointer.revision===revision&&typeof pointer.key==="string"&&pointer.key.startsWith(`cases/${id}/state/`)&&pointer.key.endsWith(".json")&&/^[a-f0-9]{64}$/.test(pointer.sha256)&&!!pointer.summary&&Number.isSafeInteger(pointer.summary.facts)&&Number.isSafeInteger(pointer.summary.documents);}
export async function getCase(id:string):Promise<CaseData>{
  const row=await db().prepare("SELECT payload,revision,storage_token AS storageToken FROM cases WHERE id = ?").bind(id).first<{payload:string;revision:number;storageToken:string}>();
  if(!row)throw new HttpError(404,"사건을 찾을 수 없습니다.");
  let stored:unknown;try{stored=JSON.parse(row.payload);}catch{throw new HttpError(409,"사건 저장 상태를 확인한 뒤 다시 불러오세요.");}
  let data:CaseData;
  if(casePointer(stored)){
    if(!validPointer(stored,id,row.revision))throw new HttpError(409,"사건 저장 상태를 확인한 뒤 다시 불러오세요.");
    const object=await bucket().get(stored.key);if(!object)throw new HttpError(409,"사건 저장 상태를 확인한 뒤 다시 불러오세요.");
    const bytes=await object.arrayBuffer();if(await sha256(bytes)!==stored.sha256)throw new HttpError(409,"사건 저장 상태를 확인한 뒤 다시 불러오세요.");
    try{data=JSON.parse(new TextDecoder().decode(bytes)) as CaseData;}catch{throw new HttpError(409,"사건 저장 상태를 확인한 뒤 다시 불러오세요.");}
  }else data=stored as CaseData;
  if(typeof row.storageToken!=="string"||data.context.id!==id||data.context.revision!==row.revision)throw new HttpError(409,"사건 저장 상태를 확인한 뒤 다시 불러오세요.");
  caseSnapshots.set(data,{id,revision:row.revision,token:row.storageToken});return data;
}
export async function saveCase(data:CaseData,expected:number,previous:CaseData){
  const snapshot=caseSnapshots.get(previous);
  if(!snapshot||snapshot.id!==data.context.id||snapshot.revision!==expected||!Number.isSafeInteger(data.context.revision)||data.context.revision<expected)throw new HttpError(409,"원래 불러온 사건 버전이 필요합니다. 최신 내용을 불러온 뒤 다시 시도하세요.");
  const token=crypto.randomUUID(),serialized=JSON.stringify(data),bytes=new TextEncoder().encode(serialized);let payload=serialized,createdKey:string|undefined;
  if(bytes.byteLength>=CASE_INLINE_LIMIT){const uuid=crypto.randomUUID();createdKey=`cases/${data.context.id}/state/${uuid}.json`;await bucket().put(createdKey,bytes,{httpMetadata:{contentType:"application/json"}});const pointer:CasePointer={_storage:"r2-case-v1",caseId:data.context.id,revision:data.context.revision,key:createdKey,sha256:await sha256(bytes),summary:caseSummary(data)};payload=JSON.stringify(pointer);}
  let result;try{result=await db().prepare("UPDATE cases SET payload = ?, revision = ?, name = ?, updated_at = ?, storage_token = ? WHERE id = ? AND revision = ? AND storage_token = ?")
    .bind(payload,data.context.revision,data.context.caseName,now(),token,data.context.id,expected,snapshot.token).run();}catch(error){if(createdKey)await bucket().delete(createdKey);throw error;}
  if(!result.meta.changes){if(createdKey)await bucket().delete(createdKey);throw new HttpError(409,"사건이 변경되었습니다. 최신 내용을 불러온 뒤 다시 시도하세요.");}
  caseSnapshots.delete(previous);caseSnapshots.set(data,{id:data.context.id,revision:data.context.revision,token});
}
export async function event(caseId:string,type:string,detail:unknown){
  await db().prepare("INSERT INTO events (id,case_id,actor,type,detail,at) VALUES (?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),caseId,await actor(),type,JSON.stringify(detail),now()).run();
}
export async function jobs(caseId:string){
  return (await db().prepare("SELECT id,document_id AS documentId,page,role,document_type AS documentType,status,stage,attempts,error,updated_at AS updatedAt FROM page_jobs WHERE case_id = ? ORDER BY document_id,page").bind(caseId).all()).results;
}
export async function getProcessingReadiness(data:CaseData){
  const [documents,pages]=await Promise.all([
    db().prepare("SELECT id,ready FROM documents WHERE case_id = ?").bind(data.context.id).all<StoredDocumentState>(),
    db().prepare("SELECT document_id AS documentId,page,role,status,CASE WHEN image_key IS NOT NULL THEN 1 ELSE 0 END AS imageReady FROM page_jobs WHERE case_id = ?").bind(data.context.id).all<StoredPageState>(),
  ]);
  return inspectProcessingReadiness(data,documents.results,pages.results);
}
export async function requireUploadedSource(data:CaseData,source:{documentId?:string;page?:number}|null|undefined){
  if(!source||typeof source.documentId!=="string"||!Number.isInteger(source.page))throw new HttpError(400,"원본 문서와 페이지가 필요합니다.");
  if(!data.documents.some(d=>d.id===source.documentId&&d.status==="active")||!data.pages.some(p=>p.documentId===source.documentId&&p.page===source.page&&p.role==="evidence"))throw new HttpError(409,"현재 생성용 증빙 페이지를 선택하세요.");
  const row=await db().prepare("SELECT d.id FROM documents d JOIN page_jobs p ON p.document_id = d.id AND p.case_id = d.case_id WHERE d.id = ? AND d.case_id = ? AND d.ready = 1 AND p.page = ? AND p.image_key IS NOT NULL").bind(source.documentId,data.context.id,source.page).first();
  if(!row)throw new HttpError(409,"원본과 해당 페이지의 업로드가 끝난 뒤 데이터를 등록하세요.");
}
export async function caseExtras(data:CaseData){
  const id=data.context.id;
  const currentFiles=new Set((data.exportManifest?.files??[]).filter(f=>f.status==="current").map(f=>f.id));
  const [j,a,e,processingReadiness,usage]=await Promise.all([
    jobs(id),db().prepare("SELECT id,revision,name,kind,hash,mime FROM artifacts WHERE case_id = ? ORDER BY created_at DESC").bind(id).all(),
    db().prepare("SELECT id,revision,type,payload,at FROM analyses WHERE case_id = ? AND revision = ? ORDER BY at DESC LIMIT 10").bind(id,data.context.revision).all<{id:string,revision:number,type:string,payload:string,at:string}>(),
    getProcessingReadiness(data),
    db().prepare("SELECT COUNT(*) AS attempts,COALESCE(SUM(CAST(json_extract(detail,'$.inputTokens') AS INTEGER)),0) AS inputTokens,COALESCE(SUM(CAST(json_extract(detail,'$.outputTokens') AS INTEGER)),0) AS outputTokens,MIN(at) AS startedAt,MAX(at) AS completedAt FROM events WHERE case_id = ? AND type = 'model.call' AND json_extract(detail,'$.model') = ?").bind(id,AI_MODEL).first<{attempts:number,inputTokens:number,outputTokens:number,startedAt:string|null,completedAt:string|null}>(),
  ]);
  const execution:CaseData["execution"]=usage&&usage.attempts>0?{model:AI_MODEL,attempts:usage.attempts,inputTokens:usage.inputTokens,outputTokens:usage.outputTokens,...(usage.startedAt?{startedAt:usage.startedAt}:{}),...(usage.completedAt?{completedAt:usage.completedAt}:{})}:data.execution;
  return {jobs:j,processingReadiness,execution,files:a.results.filter(x=>currentFiles.has(String(x.id))).map(x=>({...x,url:`/api/cases/${id}/artifacts/${x.id}`})),analyses:e.results.map(x=>({...x,payload:JSON.parse(x.payload)}))};
}
export function errorResponse(error:unknown){
  const status=error instanceof HttpError?error.status:500;
  let message=error instanceof Error?error.message:"처리 중 오류가 발생했습니다.";
  if(/no such table/i.test(message))message="저장소 마이그레이션이 아직 적용되지 않았습니다. 배포 상태를 확인하세요.";
  // Never expose upstream payloads, authorization headers, or credentials.
  message=message.replace(/sk-[\w-]+/g,"[비공개]").slice(0,500);
  return Response.json({error:message},{status,headers:{"Cache-Control":"no-store"}});
}
export async function sha256(bytes:ArrayBuffer|Uint8Array):Promise<string>{
  const data=bytes instanceof Uint8Array?new Uint8Array(bytes).buffer:bytes;
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",data))).map(b=>b.toString(16).padStart(2,"0")).join("");
}
