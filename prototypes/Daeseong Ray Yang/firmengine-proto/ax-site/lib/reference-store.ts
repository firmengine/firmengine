import { REFERENCE_RECORDS, REFERENCE_RELEASE, referenceRecord, validateReferenceValue } from "./reference-registry.ts";
import {SUBSTITUTION_POLICY_REFERENCE_ID} from "./substitution-policy.ts";
import {LEGAL_EVIDENCE_POLICY_REFERENCE_ID} from "./legal-evidence-criteria.ts";
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
export interface ReferenceProposalInput {id:string;value:unknown;reason:string;sourceUrls:string[];effectiveFrom?:string|null;applicationContract?:ReferenceApplicationContract;expectedActiveSha256?:string}
export interface ReferenceApplicationContract { dateBasis:string; jurisdiction?:string|null; effectiveTo?:string|null; transition:{status:"declared"|"unknown";conditions?:string[]} }
export interface ReferenceProposal { id:string; referenceId:string; oldValue:unknown; value:unknown; reason:string; sourceUrls:string[]; effectiveFrom:string|null; applicationContract?:ReferenceApplicationContract; baseSha256:string; basisType:string; status:string; createdAt:string; actor:string; proposalFingerprint?:string }
export async function fingerprintReferenceProposal(value:Pick<ReferenceProposal,"id"|"referenceId"|"oldValue"|"value"|"reason"|"sourceUrls"|"effectiveFrom"|"applicationContract"|"baseSha256"|"basisType"|"createdAt"|"actor">){
 return referenceHash({id:value.id,referenceId:value.referenceId,oldValue:value.oldValue,value:value.value,reason:value.reason,sourceUrls:value.sourceUrls,effectiveFrom:value.effectiveFrom,applicationContract:value.applicationContract??null,baseSha256:value.baseSha256,basisType:value.basisType,createdAt:value.createdAt,actor:value.actor});
}
export async function listPendingReferenceChanges(database:D1Database){
 const rows=await database.prepare("SELECT id,status,payload,created_at AS createdAt,actor FROM legal_reference_changes WHERE status='pending_review' ORDER BY created_at").all<{id:string;status:string;payload:string;createdAt:string;actor:string}>();
 return rows.results.map(row=>({...JSON.parse(row.payload) as ReferenceProposal,status:row.status,proposalFingerprint:(JSON.parse(row.payload) as ReferenceProposal).proposalFingerprint??""}));
}
export async function getPendingReferenceChange(database:D1Database,id:string):Promise<ReferenceProposal|null>{
 const row=await database.prepare("SELECT payload,status FROM legal_reference_changes WHERE id=?").bind(id).first<{payload:string;status:string}>();
 return row?.status==="pending_review"?JSON.parse(row.payload) as ReferenceProposal:null;
}
export async function listReferenceReleaseHistory(database:D1Database){
 const rows=await database.prepare("SELECT id,revision,sha256,status,created_at AS createdAt,actor,reason FROM legal_reference_releases ORDER BY revision DESC LIMIT 100").all<{id:string;revision:number;sha256:string;status:string;createdAt:string;actor:string;reason:string}>();
 return rows.results;
}
async function readHistoricalSnapshot(database:D1Database,targetSha256:string):Promise<ReferenceSnapshot>{
 if(!/^[a-f0-9]{64}$/i.test(targetSha256))throw new Error("INVALID_REFERENCE_TARGET_SHA");
 const row=await database.prepare("SELECT id,revision,sha256,seed_sha256 AS seedSha256,status,payload FROM legal_reference_releases WHERE sha256=? AND status='superseded' ORDER BY revision DESC LIMIT 1").bind(targetSha256).first<{id:string;revision:number;sha256:string;seedSha256:string;status:string;payload:string}>();
 if(!row)throw new Error("REFERENCE_TARGET_NOT_FOUND");if(row.seedSha256!==REFERENCE_RELEASE.sha256)throw new Error("REFERENCE_RELEASE_CODE_MISMATCH");
 const parsed=JSON.parse(row.payload) as {values:Record<string,unknown>;metadata?:ReferenceSnapshot["metadata"];bundleReview?:ReferenceSnapshot["bundleReview"]};
 if(!parsed.values||typeof parsed.values!=="object"||Array.isArray(parsed.values)||await referenceSnapshotHash(REFERENCE_RELEASE.sha256,parsed.values,parsed.metadata??{},parsed.bundleReview)!==row.sha256)throw new Error("REFERENCE_RELEASE_INTEGRITY_FAILED");
 for(const id of Object.keys(parsed.metadata??{}))if(!referenceRecord(id)||!Object.hasOwn(parsed.values,id))throw new Error("REFERENCE_CHANGE_PROVENANCE_MISSING");
 for(const [id,value] of Object.entries(parsed.values)){
  const record=referenceRecord(id);if(!record)throw new Error("UNKNOWN_REFERENCE_ID");validateReferenceValue(record,value);
  const metadata=parsed.metadata?.[id];if(!metadata||!/^([a-f0-9]{64})$/i.test(metadata.recordSha256)||!Array.isArray(metadata.sourceUrls)||metadata.sourceUrls.length>20||metadata.sourceUrls.some(url=>!official(url))||!metadata.reason?.trim()||!metadata.reviewedBy?.trim()||!Number.isFinite(Date.parse(metadata.reviewedAt))||!(["official_source","internal_policy"] as string[]).includes(metadata.basisType))throw new Error("REFERENCE_CHANGE_PROVENANCE_MISSING");
  const legalSourceRequired=["statute","court_practice"].includes(record.category);if(legalSourceRequired&&!metadata.sourceUrls.length||legalSourceRequired&&metadata.basisType!=="official_source"||!legalSourceRequired&&metadata.basisType!=="internal_policy")throw new Error("OFFICIAL_REFERENCE_SOURCE_REQUIRED");
  if(metadata.effectiveFrom&&(!/^\d{4}-\d{2}-\d{2}$/.test(metadata.effectiveFrom)||Number.isNaN(Date.parse(metadata.effectiveFrom))||new Date(metadata.effectiveFrom).toISOString().slice(0,10)!==metadata.effectiveFrom))throw new Error("INVALID_REFERENCE_EFFECTIVE_DATE");
  validateApplicationContract(metadata.applicationContract);
 }
 return {id:row.id,revision:row.revision,sha256:row.sha256,values:parsed.values,metadata:parsed.metadata??{},...(parsed.bundleReview?{bundleReview:parsed.bundleReview}:{})};
}
export async function previewReferenceReleaseRestore(database:D1Database,targetSha256:string,expectedActiveSha256:string){
 const active=await loadReferenceSnapshot(database);if(active.sha256!==expectedActiveSha256)throw new Error("REFERENCE_RELEASE_CONFLICT");
 const target=await readHistoricalSnapshot(database,targetSha256),ids=[...new Set([...Object.keys(active.values),...Object.keys(target.values),...Object.keys(active.metadata??{}),...Object.keys(target.metadata??{})])].sort();
 const changedReferenceIds=ids.filter(id=>JSON.stringify([active.values[id],active.metadata?.[id]])!==JSON.stringify([target.values[id],target.metadata?.[id]]));
 return {targetRelease:{id:target.id,revision:target.revision,sha256:target.sha256},activeRelease:{id:active.id,revision:active.revision,sha256:active.sha256},changedReferenceIds,invalidatesBundleReview:true,caseWrites:0,caseReviewsCarried:false};
}
/** Restore is a new immutable release. It never rewrites case snapshots or carries bundle approval. */
export async function restoreReferenceRelease(database:D1Database,input:{targetSha256:string;expectedActiveSha256:string;reason:string},actor:string){
 if(typeof input.reason!=="string"||input.reason.trim().length<5||input.reason.length>4000)throw new Error("REFERENCE_RESTORE_REASON_REQUIRED");
 const active=await loadReferenceSnapshot(database);if(active.sha256!==input.expectedActiveSha256)throw new Error("REFERENCE_RELEASE_CONFLICT");
 const target=await readHistoricalSnapshot(database,input.targetSha256),at=new Date().toISOString();
 const snapshot:ReferenceSnapshot={id:`${REFERENCE_RELEASE.id}:r${active.revision+1}:${crypto.randomUUID()}`,revision:active.revision+1,sha256:await referenceSnapshotHash(REFERENCE_RELEASE.sha256,target.values,target.metadata??{}),values:target.values,metadata:target.metadata??{}};
 const reason=`Restore ${target.id} (${target.sha256}): ${input.reason.trim()}`;
 const results=await database.batch([
  database.prepare("INSERT INTO legal_reference_releases (id,revision,seed_sha256,sha256,status,payload,created_at,actor,reason) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM legal_reference_releases WHERE id=? AND sha256=? AND status='active')").bind(snapshot.id,snapshot.revision,REFERENCE_RELEASE.sha256,snapshot.sha256,"active",JSON.stringify({values:snapshot.values,metadata:snapshot.metadata}),at,actor,reason,active.id,active.sha256),
  database.prepare("UPDATE legal_reference_releases SET status='superseded' WHERE status='active' AND id<>? AND EXISTS (SELECT 1 FROM legal_reference_releases WHERE id=?)").bind(snapshot.id,snapshot.id),
 ]);
 if(!results[0].meta.changes)throw new Error("REFERENCE_RELEASE_CONFLICT");
 return snapshot;
}
function official(url:string):boolean{try{const u=new URL(url);return u.protocol==="https:"&&!u.username&&!u.password&&(u.hostname.endsWith(".go.kr")||u.hostname==="law.go.kr"||u.hostname.endsWith(".scourt.go.kr")||u.hostname==="scourt.go.kr");}catch{return false;}}
function validateApplicationContract(rawContract:unknown){
 const contract=rawContract as ReferenceApplicationContract|undefined;
 if(contract===undefined)return;
 if(!contract||typeof contract.dateBasis!=="string"||!contract.dateBasis.trim()||contract.dateBasis.length>120)throw new Error("REFERENCE_DATE_BASIS_REQUIRED");
 if(contract.jurisdiction!==undefined&&contract.jurisdiction!==null&&(typeof contract.jurisdiction!=="string"||!contract.jurisdiction.trim()||contract.jurisdiction.length>128))throw new Error("INVALID_REFERENCE_JURISDICTION");
 if(contract.effectiveTo&&(!/^\d{4}-\d{2}-\d{2}$/.test(contract.effectiveTo)||Number.isNaN(Date.parse(contract.effectiveTo))||new Date(contract.effectiveTo).toISOString().slice(0,10)!==contract.effectiveTo))throw new Error("INVALID_REFERENCE_EFFECTIVE_DATE");
 if(!contract.transition||!["declared","unknown"].includes(contract.transition.status)||contract.transition.conditions?.some(v=>typeof v!=="string"||!v.trim()||v.length>500)||((contract.transition.conditions?.length??0)>32))throw new Error("INVALID_REFERENCE_TRANSITION_CONTRACT");
}
export async function proposeReferenceChange(database:D1Database,input:ReferenceProposalInput,actor:string){
  const record=referenceRecord(input.id);if(!record)throw new Error("UNKNOWN_REFERENCE_ID");validateReferenceValue(record,input.value);validateApplicationContract(input.applicationContract);
  if(typeof input.reason!=="string"||input.reason.trim().length<5||input.reason.length>4000)throw new Error("REFERENCE_CHANGE_REASON_REQUIRED");
  const legalSourceRequired=["statute","court_practice"].includes(record.category);
  if(!Array.isArray(input.sourceUrls)||legalSourceRequired&&!input.sourceUrls.length||input.sourceUrls.length>20||input.sourceUrls.some(u=>typeof u!=="string"||!official(u)))throw new Error("OFFICIAL_REFERENCE_SOURCE_REQUIRED");
  if(input.effectiveFrom && (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)||Number.isNaN(Date.parse(input.effectiveFrom))||new Date(input.effectiveFrom).toISOString().slice(0,10)!==input.effectiveFrom))throw new Error("INVALID_REFERENCE_EFFECTIVE_DATE");
  const active=await loadReferenceSnapshot(database);
  if(input.expectedActiveSha256&&input.expectedActiveSha256!==active.sha256)throw new Error("REFERENCE_RELEASE_CONFLICT");
  const candidateBase={id:crypto.randomUUID(),referenceId:input.id,oldValue:Object.hasOwn(active.values,input.id)?active.values[input.id]:record.value,value:input.value,reason:input.reason.trim(),sourceUrls:input.sourceUrls,effectiveFrom:input.effectiveFrom??null,...(input.applicationContract?{applicationContract:input.applicationContract}:{}),baseSha256:active.sha256,basisType:legalSourceRequired?"official_source":"internal_policy",status:"pending_review",createdAt:new Date().toISOString(),actor};
  const candidate={...candidateBase,proposalFingerprint:await fingerprintReferenceProposal(candidateBase)};
  await database.prepare("INSERT INTO legal_reference_changes (id,reference_id,status,base_sha256,payload,created_at,actor) VALUES (?,?,?,?,?,?,?)").bind(candidate.id,input.id,candidate.status,active.sha256,JSON.stringify(candidate),candidate.createdAt,actor).run();
  return candidate;
}
/** A distinct approval for an exact artifact set on the current immutable release.
 * It never supplies missing date, jurisdiction, or transition declarations. */
export async function approveReferenceBundle(database:D1Database,input:{artifactIds:unknown;expectedActiveSha256:string;reason:string},actor:string){
  if(!Array.isArray(input.artifactIds)||!input.artifactIds.length||input.artifactIds.length>REFERENCE_RECORDS.length||input.artifactIds.some(id=>typeof id!=="string"||!id.trim()))throw new Error("INVALID_REFERENCE_BUNDLE_ARTIFACTS");
  const artifactIds=[...new Set(input.artifactIds as string[])].sort();
  if(artifactIds.length!==(input.artifactIds as unknown[]).length)throw new Error("DUPLICATE_REFERENCE_BUNDLE_ARTIFACT");
  if(artifactIds.some(id=>!referenceRecord(id)))throw new Error("UNKNOWN_REFERENCE_BUNDLE_ARTIFACT");
  if(typeof input.reason!=="string"||input.reason.trim().length<5||input.reason.length>4000)throw new Error("REFERENCE_BUNDLE_REVIEW_REASON_REQUIRED");
  const current=await loadReferenceSnapshot(database);
  if(current.sha256!==input.expectedActiveSha256)throw new Error("REFERENCE_RELEASE_CONFLICT");
  const at=new Date().toISOString();
  const artifacts=artifactIds.map(id=>{
    const record=referenceRecord(id)!;const metadata=current.metadata?.[id],contract=metadata?.applicationContract;
    const declaredJurisdiction=contract?.jurisdiction??(record.courtIds.length===1?record.courtIds[0]:null);
    return {id,revision:String(current.revision),sha256:metadata?.recordSha256??record.sha256,effectiveFrom:metadata?.effectiveFrom??record.effectiveFrom,effectiveTo:contract?.effectiveTo??record.effectiveTo,jurisdiction:declaredJurisdiction,dateBasis:contract?.dateBasis,transition:contract?.transition??{status:"unknown" as const}};
  });
  const bundleReview={status:"verified" as const,basedOnSha256:current.sha256,artifactIds,artifacts,reason:input.reason.trim(),reviewedAt:at,reviewedBy:actor};
  const snapshot:ReferenceSnapshot={id:`${REFERENCE_RELEASE.id}:r${current.revision+1}:${crypto.randomUUID()}`,revision:current.revision+1,sha256:await referenceSnapshotHash(REFERENCE_RELEASE.sha256,current.values,current.metadata??{},bundleReview),values:current.values,metadata:current.metadata??{},bundleReview};
  const results=await database.batch([
    database.prepare("INSERT INTO legal_reference_releases (id,revision,seed_sha256,sha256,status,payload,created_at,actor,reason) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM legal_reference_releases WHERE id = ? AND sha256 = ? AND status = 'active')").bind(snapshot.id,snapshot.revision,REFERENCE_RELEASE.sha256,snapshot.sha256,"active",JSON.stringify({values:snapshot.values,metadata:snapshot.metadata,bundleReview}),at,actor,`Bundle compatibility approval: ${bundleReview.reason}`,current.id,current.sha256),
    database.prepare("UPDATE legal_reference_releases SET status = 'superseded' WHERE status = 'active' AND id <> ? AND EXISTS (SELECT 1 FROM legal_reference_releases WHERE id = ?)").bind(snapshot.id,snapshot.id),
  ]);
  if(!results[0].meta.changes)throw new Error("REFERENCE_RELEASE_CONFLICT");
  return snapshot;
}
/** Only an authenticated human review route calls this. Agent monitors never do. */
export async function activateReferenceChange(database:D1Database,proposalId:string,expectedSha256:string,actor:string,expectedProposalFingerprint?:string,policy:{fourEyesRequired?:boolean}={}){
  const row=await database.prepare("SELECT payload,status FROM legal_reference_changes WHERE id = ?").bind(proposalId).first<{payload:string;status:string}>();
  if(!row||row.status!=="pending_review")throw new Error("REFERENCE_PROPOSAL_NOT_PENDING");
  const candidate=JSON.parse(row.payload) as ReferenceProposal;
  const actualFingerprint=await fingerprintReferenceProposal(candidate);
  if(!candidate.proposalFingerprint||candidate.proposalFingerprint!==actualFingerprint||!expectedProposalFingerprint||expectedProposalFingerprint!==actualFingerprint)throw new Error("REFERENCE_PROPOSAL_FINGERPRINT_CONFLICT");
  const record=referenceRecord(candidate.referenceId);if(!record)throw new Error("UNKNOWN_REFERENCE_ID");validateReferenceValue(record,candidate.value);validateApplicationContract(candidate.applicationContract);
  if((policy.fourEyesRequired||record.id===SUBSTITUTION_POLICY_REFERENCE_ID||record.id===LEGAL_EVIDENCE_POLICY_REFERENCE_ID)&&candidate.actor===actor)throw new Error("REFERENCE_FOUR_EYES_REQUIRED");
  const legalSourceRequired=["statute","court_practice"].includes(record.category);
  if(typeof candidate.reason!=="string"||candidate.reason.trim().length<5||!Array.isArray(candidate.sourceUrls)||candidate.sourceUrls.length>20||legalSourceRequired&&!candidate.sourceUrls.length||candidate.sourceUrls.some(url=>!official(url)))throw new Error("OFFICIAL_REFERENCE_SOURCE_REQUIRED");
  if(candidate.effectiveFrom&&(!/^\d{4}-\d{2}-\d{2}$/.test(candidate.effectiveFrom)||Number.isNaN(Date.parse(candidate.effectiveFrom))||new Date(candidate.effectiveFrom).toISOString().slice(0,10)!==candidate.effectiveFrom))throw new Error("INVALID_REFERENCE_EFFECTIVE_DATE");
  const current=await loadReferenceSnapshot(database);
  if(current.sha256!==expectedSha256||candidate.baseSha256!==current.sha256)throw new Error("REFERENCE_RELEASE_CONFLICT");
  const koreanDate=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  if(candidate.effectiveFrom&&candidate.effectiveFrom>koreanDate)throw new Error("REFERENCE_CHANGE_NOT_YET_EFFECTIVE");
  const values={...current.values,[candidate.referenceId]:candidate.value};
  const ordinary=Number(values["param.national.term.ordinary_months"]??referenceRecord("param.national.term.ordinary_months")?.value),maximum=Number(values["param.national.term.exceptional_max_months"]??referenceRecord("param.national.term.exceptional_max_months")?.value);
  if(ordinary>maximum)throw new Error("REFERENCE_TERM_INVARIANT");
  const at=new Date().toISOString();
  const recordSha256=await referenceHash({...record,value:candidate.value,sourceUrls:candidate.sourceUrls,effectiveFrom:candidate.effectiveFrom,verification:"human_reviewed_reference_change",sha256:undefined});
  const metadata={...current.metadata,[candidate.referenceId]:{sourceUrls:candidate.sourceUrls,effectiveFrom:candidate.effectiveFrom,reason:candidate.reason,reviewedAt:at,reviewedBy:actor,recordSha256,basisType:candidate.basisType,...(candidate.applicationContract?{applicationContract:candidate.applicationContract}:{})}};
  // Any source change invalidates prior whole-set compatibility approval.
  const snapshot:ReferenceSnapshot={id:`${REFERENCE_RELEASE.id}:r${current.revision+1}:${crypto.randomUUID()}`,revision:current.revision+1,sha256:await referenceSnapshotHash(REFERENCE_RELEASE.sha256,values,metadata),values,metadata};
  const results=await database.batch([
    database.prepare("INSERT INTO legal_reference_releases (id,revision,seed_sha256,sha256,status,payload,created_at,actor,reason) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM legal_reference_releases WHERE id = ? AND sha256 = ? AND status = 'active')").bind(snapshot.id,snapshot.revision,REFERENCE_RELEASE.sha256,snapshot.sha256,"active",JSON.stringify({values,metadata}),at,actor,candidate.reason,current.id,current.sha256),
    database.prepare("UPDATE legal_reference_releases SET status = 'superseded' WHERE status = 'active' AND id <> ? AND EXISTS (SELECT 1 FROM legal_reference_releases WHERE id = ?)").bind(snapshot.id,snapshot.id),
    database.prepare("UPDATE legal_reference_changes SET status = 'approved',reviewed_at = ?,reviewed_by = ? WHERE id = ? AND EXISTS (SELECT 1 FROM legal_reference_releases WHERE id = ?)").bind(at,actor,proposalId,snapshot.id),
  ]);
  if(!results[0].meta.changes)throw new Error("REFERENCE_RELEASE_CONFLICT");
  return snapshot;
}
