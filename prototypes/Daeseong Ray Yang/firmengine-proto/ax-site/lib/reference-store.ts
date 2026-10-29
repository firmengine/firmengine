import { REFERENCE_RECORDS, REFERENCE_RELEASE, referenceRecord, validateReferenceValue } from "./reference-registry.ts";
import { referenceSnapshotHash, type ReferenceSnapshot } from "./reference-runtime.ts";
import { loadReferenceSnapshot } from "./reference-context.ts";

export async function referenceHash(value:unknown):Promise<string>{const bytes=new TextEncoder().encode(JSON.stringify(value));return [...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(b=>b.toString(16).padStart(2,"0")).join("");}
export async function referenceStorageStatus(database:D1Database){
  const count=await database.prepare("SELECT COUNT(*) AS n FROM legal_reference_items WHERE release_id = ?").bind(REFERENCE_RELEASE.id).first<{n:number}>();
  return {seeded:count?.n??0,total:REFERENCE_RECORDS.length,complete:count?.n===REFERENCE_RECORDS.length};
}
/** Explicit, resumable seed import. Never reads or writes any case table. */
export async function bootstrapReferenceData(database:D1Database,offset=0,limit=100){
  if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>500)throw new Error("INVALID_REFERENCE_PAGE");
  await database.prepare("INSERT OR IGNORE INTO legal_reference_releases (id,revision,seed_sha256,sha256,status,payload,created_at,actor,reason) VALUES (?,?,?,?,?,?,?,?,?)").bind(REFERENCE_RELEASE.id,1,REFERENCE_RELEASE.sha256,REFERENCE_RELEASE.sha256,"active",JSON.stringify({values:{}}),new Date().toISOString(),"seed_import","v31 구현의 기준정보 이관; 법적 내용 신규 승인 아님").run();
  const existing=await database.prepare("SELECT seed_sha256 AS sha FROM legal_reference_releases WHERE id = ?").bind(REFERENCE_RELEASE.id).first<{sha:string}>();
  if(existing?.sha!==REFERENCE_RELEASE.sha256)throw new Error("REFERENCE_SEED_ID_CONFLICT");
  const page=REFERENCE_RECORDS.slice(offset,offset+limit);
  for(let i=0;i<page.length;i+=40)await database.batch(page.slice(i,i+40).map(row=>database.prepare("INSERT OR IGNORE INTO legal_reference_items (release_id,id,kind,category,title,sha256,payload) VALUES (?,?,?,?,?,?,?)").bind(REFERENCE_RELEASE.id,row.id,row.kind,row.category,row.title,row.sha256,JSON.stringify(row))));
  return {release:REFERENCE_RELEASE.id,processed:page.length,nextOffset:offset+page.length<REFERENCE_RECORDS.length?offset+page.length:null,...await referenceStorageStatus(database)};
}
export interface ReferenceProposalInput {id:string;value:unknown;reason:string;sourceUrls:string[];effectiveFrom?:string|null;expectedActiveSha256?:string}
function official(url:string):boolean{try{const u=new URL(url);return u.protocol==="https:"&&!u.username&&!u.password&&(u.hostname.endsWith(".go.kr")||u.hostname==="law.go.kr"||u.hostname.endsWith(".scourt.go.kr")||u.hostname==="scourt.go.kr");}catch{return false;}}
export async function proposeReferenceChange(database:D1Database,input:ReferenceProposalInput,actor:string){
  const record=referenceRecord(input.id);if(!record)throw new Error("UNKNOWN_REFERENCE_ID");validateReferenceValue(record,input.value);
  if(typeof input.reason!=="string"||input.reason.trim().length<5||input.reason.length>4000)throw new Error("REFERENCE_CHANGE_REASON_REQUIRED");
  const legalSourceRequired=["statute","court_practice"].includes(record.category);
  if(!Array.isArray(input.sourceUrls)||legalSourceRequired&&!input.sourceUrls.length||input.sourceUrls.length>20||input.sourceUrls.some(u=>typeof u!=="string"||!official(u)))throw new Error("OFFICIAL_REFERENCE_SOURCE_REQUIRED");
  if(input.effectiveFrom && (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)||Number.isNaN(Date.parse(input.effectiveFrom))||new Date(input.effectiveFrom).toISOString().slice(0,10)!==input.effectiveFrom))throw new Error("INVALID_REFERENCE_EFFECTIVE_DATE");
  const active=await loadReferenceSnapshot(database);
  if(input.expectedActiveSha256&&input.expectedActiveSha256!==active.sha256)throw new Error("REFERENCE_RELEASE_CONFLICT");
  const candidate={id:crypto.randomUUID(),referenceId:input.id,oldValue:Object.hasOwn(active.values,input.id)?active.values[input.id]:record.value,value:input.value,reason:input.reason.trim(),sourceUrls:input.sourceUrls,effectiveFrom:input.effectiveFrom??null,baseSha256:active.sha256,basisType:legalSourceRequired?"official_source":"internal_policy",status:"pending_review",createdAt:new Date().toISOString(),actor};
  await database.prepare("INSERT INTO legal_reference_changes (id,reference_id,status,base_sha256,payload,created_at,actor) VALUES (?,?,?,?,?,?,?)").bind(candidate.id,input.id,candidate.status,active.sha256,JSON.stringify(candidate),candidate.createdAt,actor).run();
  return candidate;
}
/** Only an authenticated human review route calls this. Agent monitors never do. */
export async function activateReferenceChange(database:D1Database,proposalId:string,expectedSha256:string,actor:string){
  const row=await database.prepare("SELECT payload,status FROM legal_reference_changes WHERE id = ?").bind(proposalId).first<{payload:string;status:string}>();
  if(!row||row.status!=="pending_review")throw new Error("REFERENCE_PROPOSAL_NOT_PENDING");
  const candidate=JSON.parse(row.payload) as {referenceId:string;value:unknown;baseSha256:string;effectiveFrom:string|null;reason:string;sourceUrls:string[];basisType:string};
  const record=referenceRecord(candidate.referenceId);if(!record)throw new Error("UNKNOWN_REFERENCE_ID");validateReferenceValue(record,candidate.value);
  const current=await loadReferenceSnapshot(database);
  if(current.sha256!==expectedSha256||candidate.baseSha256!==current.sha256)throw new Error("REFERENCE_RELEASE_CONFLICT");
  const koreanDate=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  if(candidate.effectiveFrom&&candidate.effectiveFrom>koreanDate)throw new Error("REFERENCE_CHANGE_NOT_YET_EFFECTIVE");
  const values={...current.values,[candidate.referenceId]:candidate.value};
  const ordinary=Number(values["param.national.term.ordinary_months"]??referenceRecord("param.national.term.ordinary_months")?.value),maximum=Number(values["param.national.term.exceptional_max_months"]??referenceRecord("param.national.term.exceptional_max_months")?.value);
  if(ordinary>maximum)throw new Error("REFERENCE_TERM_INVARIANT");
  const at=new Date().toISOString();
  const recordSha256=await referenceHash({...record,value:candidate.value,sourceUrls:candidate.sourceUrls,effectiveFrom:candidate.effectiveFrom,verification:"human_reviewed_reference_change",sha256:undefined});
  const metadata={...current.metadata,[candidate.referenceId]:{sourceUrls:candidate.sourceUrls,effectiveFrom:candidate.effectiveFrom,reason:candidate.reason,reviewedAt:at,reviewedBy:actor,recordSha256,basisType:candidate.basisType}};
  const snapshot:ReferenceSnapshot={id:`${REFERENCE_RELEASE.id}:r${current.revision+1}:${crypto.randomUUID()}`,revision:current.revision+1,sha256:await referenceSnapshotHash(REFERENCE_RELEASE.sha256,values,metadata),values,metadata};
  const results=await database.batch([
    database.prepare("INSERT INTO legal_reference_releases (id,revision,seed_sha256,sha256,status,payload,created_at,actor,reason) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM legal_reference_releases WHERE id = ? AND sha256 = ? AND status = 'active')").bind(snapshot.id,snapshot.revision,REFERENCE_RELEASE.sha256,snapshot.sha256,"active",JSON.stringify({values,metadata}),at,actor,candidate.reason,current.id,current.sha256),
    database.prepare("UPDATE legal_reference_releases SET status = 'superseded' WHERE status = 'active' AND id <> ? AND EXISTS (SELECT 1 FROM legal_reference_releases WHERE id = ?)").bind(snapshot.id,snapshot.id),
    database.prepare("UPDATE legal_reference_changes SET status = 'approved',reviewed_at = ?,reviewed_by = ? WHERE id = ? AND EXISTS (SELECT 1 FROM legal_reference_releases WHERE id = ?)").bind(at,actor,proposalId,snapshot.id),
  ]);
  if(!results[0].meta.changes)throw new Error("REFERENCE_RELEASE_CONFLICT");
  return snapshot;
}
