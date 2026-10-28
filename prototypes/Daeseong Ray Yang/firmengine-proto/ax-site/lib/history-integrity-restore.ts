import type { CaseData, Fact } from "./domain";
import { bucket, db, HttpError, sha256 } from "./server-store";

const MAX_LIST = 1000, MAX_CANDIDATES = 4, MAX_BYTES = 32 * 1024 * 1024;
const HEX = /^[a-f0-9]{64}$/;
async function sha256View(view:Uint8Array):Promise<string>{const digest=await crypto.subtle.digest("SHA-256",view as unknown as BufferSource);return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");}
export type RestoreInput = { expectedRevision:number; baselineRevision:number; documentId:string; page:number; sourceSha256:string; baselineFactsSha256:string };
type Selected = { key:string; objectSha256:string; factsSha256:string; revision:number; facts:Fact[] };

export function parseRestoreInput(value:unknown):RestoreInput {
  if(!value||typeof value!=="object")throw new HttpError(400,"복구 미리보기 입력을 확인하세요.");
  const x=value as Record<string,unknown>;
  if(!Number.isSafeInteger(x.expectedRevision)||!Number.isSafeInteger(x.baselineRevision)||Number(x.baselineRevision)>=Number(x.expectedRevision)||typeof x.documentId!=="string"||!x.documentId.trim()||x.documentId.length>200||!Number.isSafeInteger(x.page)||Number(x.page)<1||typeof x.sourceSha256!=="string"||!HEX.test(x.sourceSha256)||typeof x.baselineFactsSha256!=="string"||!HEX.test(x.baselineFactsSha256))throw new HttpError(400,"복구 미리보기 입력을 확인하세요.");
  return {expectedRevision:Number(x.expectedRevision),baselineRevision:Number(x.baselineRevision),documentId:x.documentId,page:Number(x.page),sourceSha256:x.sourceSha256,baselineFactsSha256:x.baselineFactsSha256};
}
function baselineProofEligible(f:Fact,all:Fact[],id:string,page:number,hash:string){
  const proof=f.sourceVerification,binding=proof?.factBinding;
  if(f.state!=="retracted"||f.recognition!=="rejected"||f.reviewer!==undefined||!proof||proof.recognition!=="unreviewed"||!f.refs?.some(r=>r.documentId===id&&r.page===page&&r.sourceHash===hash)||proof.source.documentId!==id||proof.source.page!==page||proof.source.sha256!==hash)return false;
  if(binding?.id===f.id&&binding.logicalId===f.logicalId&&binding.version===f.version)return true;
  const predecessors=all.filter(candidate=>candidate.id===binding?.id);
  if(predecessors.length!==1)return false;
  const predecessor=predecessors[0];
  if(predecessor.id===f.id||f.supersedes!==predecessor.id||f.logicalId!==predecessor.logicalId||f.version!==predecessor.version+1||binding?.logicalId!==predecessor.logicalId||binding.version!==predecessor.version||predecessor.state!=="verified"||predecessor.recognition!=="unreviewed"||predecessor.reviewer!==undefined||!predecessor.sourceVerification||predecessor.sourceVerification.recognition!=="unreviewed"||JSON.stringify(predecessor.sourceVerification)!==JSON.stringify(proof))return false;
  if(predecessor.sourceVerification.source.documentId!==id||predecessor.sourceVerification.source.page!==page||predecessor.sourceVerification.source.sha256!==hash)return false;
  const lineageFields=new Set(["id","version","supersedes","state","recognition","reviewReason","createdAt"]), omit=(fact:Fact)=>{const copy=structuredClone(fact) as unknown as Record<string,unknown>;for(const key of lineageFields)delete copy[key];return copy;};
  return JSON.stringify(omit(predecessor))===JSON.stringify(omit(f));
}
function expectedCurrent(baseline:Fact):Fact {
  const result=structuredClone(baseline);delete result.sourceVerification;result.validation=result.validation.filter(v=>v.code!=="MACHINE_SOURCE_VERIFIED");return result;
}
function stringEnd(bytes:Uint8Array,start:number){for(let i=start+1;i<bytes.length;i++){if(bytes[i]===0x5c){i++;continue;}if(bytes[i]===0x22)return i+1;}return -1;}
function valueEnd(bytes:Uint8Array,start:number){
  const first=bytes[start];if(first===0x22)return stringEnd(bytes,start);
  if(first===0x7b||first===0x5b){const stack:number[]=[first];for(let i=start+1;i<bytes.length;i++){const c=bytes[i];if(c===0x22){const end=stringEnd(bytes,i);if(end<0)return -1;i=end-1;continue;}if(c===0x7b||c===0x5b)stack.push(c);else if(c===0x7d||c===0x5d){const open=stack.pop();if((open===0x7b&&c!==0x7d)||(open===0x5b&&c!==0x5d)||open===undefined)return -1;if(!stack.length)return i+1;}}return -1;}
  let i=start;while(i<bytes.length&&bytes[i]!==0x2c&&bytes[i]!==0x7d)i++;return i;
}
function topLevelFactsSlice(bytes:Uint8Array):[number,number]|null{
  let i=0;while(i<bytes.length&&bytes[i]!==0x7b)i++;if(i===bytes.length)return null;i++;
  while(i<bytes.length){while(bytes[i]===0x20||bytes[i]===0x0a||bytes[i]===0x0d||bytes[i]===0x09||bytes[i]===0x2c)i++;if(bytes[i]===0x7d)return null;if(bytes[i]!==0x22)return null;
    const keyEnd=stringEnd(bytes,i);if(keyEnd<0)return null;let key:string;try{key=new TextDecoder().decode(bytes.subarray(i,keyEnd));key=JSON.parse(key) as string;}catch{return null;}i=keyEnd;while(bytes[i]===0x20||bytes[i]===0x0a||bytes[i]===0x0d||bytes[i]===0x09)i++;if(bytes[i++]!==0x3a)return null;while(bytes[i]===0x20||bytes[i]===0x0a||bytes[i]===0x0d||bytes[i]===0x09)i++;
    if(key==="facts"){if(bytes[i]!==0x5b)return null;const end=valueEnd(bytes,i);return end>i?[i,end]:null;}
    const end=valueEnd(bytes,i);if(end<=i)return null;i=end;
  }return null;
}
async function findBaseline(caseId:string,input:RestoreInput,requestedAt:string):Promise<Selected>{
  const prefix=`cases/${caseId}/state/`, listed=await bucket().list({prefix,limit:MAX_LIST});
  if(listed.truncated||listed.objects.length>=MAX_LIST)throw new HttpError(409,"이전 사건 스냅샷 목록이 제한을 넘었습니다. 별도 검토가 필요합니다.");
  const candidates=listed.objects.filter(o=>o.key.startsWith(prefix)&&o.key.endsWith(".json")&&o.uploaded&&o.uploaded.getTime()<=Date.parse(requestedAt)&&Number.isFinite(o.size))
    .sort((a,b)=>b.uploaded!.getTime()-a.uploaded!.getTime()||a.key.localeCompare(b.key)).slice(0,MAX_CANDIDATES);
  for(const item of candidates){
    if(item.size>MAX_BYTES)continue;
    const object=await bucket().get(item.key);if(!object||object.key!==item.key)continue;
    let bytes=new Uint8Array(await object.arrayBuffer());if(bytes.byteLength>MAX_BYTES||bytes.byteLength!==item.size)continue;
    const objectSha=await sha256(bytes),factsRange=topLevelFactsSlice(bytes);if(!factsRange)continue;
    const factsSha=await sha256View(bytes.subarray(factsRange[0],factsRange[1]));
    let text=new TextDecoder().decode(bytes);bytes=new Uint8Array(0);let snapshot:CaseData;
    try{snapshot=JSON.parse(text) as CaseData;}catch{text="";continue;}text="";
    if(snapshot.context?.id!==caseId||snapshot.context.revision!==input.baselineRevision||!Array.isArray(snapshot.facts))continue;
    if(factsSha!==input.baselineFactsSha256)continue;
    const baselineIds=new Set<string>();for(const fact of snapshot.facts){if(baselineIds.has(fact.id))throw new HttpError(409,"기준 스냅샷의 사실 ID가 중복되었습니다.");baselineIds.add(fact.id);}
    // Retain only matching historical tombstones; discard the large parsed snapshot before loading current state.
    const matching=snapshot.facts.filter(f=>f.refs?.some(r=>r.documentId===input.documentId&&r.page===input.page));
    const eligible:Fact[]=[];for(const fact of matching){if(fact.state==="retracted"&&fact.recognition==="rejected"&&fact.reviewer===undefined&&fact.sourceVerification){if(!baselineProofEligible(fact,snapshot.facts,input.documentId,input.page,input.sourceSha256))throw new HttpError(409,"기준 스냅샷의 원문 proof 연결이 일치하지 않습니다.");eligible.push(fact);}}
    const revision=snapshot.context.revision;snapshot=null as unknown as CaseData;
    return {key:item.key,objectSha256:objectSha,factsSha256:factsSha,revision,facts:eligible};
  }
  throw new HttpError(409,"서버가 보유한 제한 범위 안에서 기준 스냅샷을 확인할 수 없습니다.");
}
export async function buildRestorePlan(caseId:string,input:RestoreInput){
  const rows=await db().prepare("SELECT p.id,p.document_id AS documentId,p.page,p.role,p.status,p.stage,p.lease_until AS leaseUntil,p.image_key AS imageKey,p.image_hash AS imageHash,p.result,d.sha256 AS sourceHash,d.ready FROM page_jobs p JOIN documents d ON d.id=p.document_id AND d.case_id=p.case_id WHERE p.case_id=? AND p.document_id=? AND p.page=?").bind(caseId,input.documentId,input.page).all<any>();
  if(rows.results.length!==1)throw new HttpError(409,"원본 페이지 작업이 하나로 특정되지 않습니다.");
  const job=rows.results[0];let saved:any;try{saved=JSON.parse(job.result??"");}catch{throw new HttpError(409,"완료된 재검증 기록을 확인할 수 없습니다.");}
  const rv=saved.reverification;
  const expectedImageKey=`cases/${caseId}/documents/${input.documentId}/pages/${input.page}/${job.imageHash}`;
  if(job.id!==`${input.documentId}:${input.page}`||job.ready!==1||job.role!=="evidence"||!job.imageKey||job.imageKey!==expectedImageKey||!HEX.test(job.imageHash??"")||job.sourceHash!==input.sourceSha256||!rv||typeof rv.requestedAt!=="string"||!Number.isFinite(Date.parse(rv.requestedAt))||rv.sourceHash!==job.sourceHash||rv.imageHash!==job.imageHash||rv.imageKey!==job.imageKey||saved.read?.complete!==true||job.stage!=="completed"||!['completed','review_required'].includes(job.status)||job.leaseUntil!==null)throw new HttpError(409,"완료된 재검증과 현재 원본 연결을 확인할 수 없습니다.");
  const baseline=await findBaseline(caseId,input,rv.requestedAt);
  const current=await (await import("./server-store")).getCase(caseId);
  if(current.context.revision!==input.expectedRevision)throw new HttpError(409,"사건 버전이 변경되었습니다.");
  const doc=current.documents.find(d=>d.id===input.documentId&&d.status==="active"&&d.sha256===input.sourceSha256),page=current.pages.find(p=>p.documentId===input.documentId&&p.page===input.page&&p.role==="evidence");
  if(!doc||!page)throw new HttpError(409,"현재 활성 원본 페이지를 확인할 수 없습니다.");
  if((current.historyIntegrityRepairs??[]).some(r=>r.baselineRevision===input.baselineRevision&&r.documentId===input.documentId&&r.page===input.page))throw new HttpError(409,"같은 기준 스냅샷의 복구 기록이 이미 있습니다.");
  const currentReviews=[...(current.exportManifest?.reviews.caseworker?[{role:"caseworker",fingerprint:current.exportManifest.reviews.caseworker.manifestFingerprint}]:[]),...(current.exportManifest?.reviews.lawyer?[{role:"lawyer",fingerprint:current.exportManifest.reviews.lawyer.manifestFingerprint}]:[])];
  const activeExportFilesInvalidated=current.exportManifest?.files.filter(f=>f.status==="current").length??0;
  const priorReviewFingerprintsSha256=await sha256View(new TextEncoder().encode(JSON.stringify(currentReviews)));
  const bmap=new Map<string,Fact>(),cmap=new Map<string,Fact>();
  for(const f of baseline.facts){if(bmap.has(f.id))throw new HttpError(409,"기준 스냅샷의 사실 ID가 중복되었습니다.");bmap.set(f.id,f);}
  for(const f of current.facts){if(cmap.has(f.id))throw new HttpError(409,"현재 사건의 사실 ID가 중복되었습니다.");cmap.set(f.id,f);}
  const candidates:Fact[]=[];
  for(const [id,b] of bmap){const c=cmap.get(id);if(!c||c.state!=="retracted"||c.recognition!=="rejected"||c.reviewer)throw new HttpError(409,"현재 사실이 기준 기록에서 허용된 metadata 삭제 외에 변경되었습니다.");if(JSON.stringify(c)===JSON.stringify(b))continue;if(JSON.stringify(c)!==JSON.stringify(expectedCurrent(b)))throw new HttpError(409,"현재 사실이 기준 기록에서 허용된 metadata 삭제 외에 변경되었습니다.");candidates.push(b);}
  const ids=candidates.map(f=>f.id).sort(), idDigest=await sha256(new TextEncoder().encode(JSON.stringify(ids)));
  return {input,baseline,current,candidates,plan:{baselineObjectSha256:baseline.objectSha256,baselineFactsSha256:baseline.factsSha256,baselineKey:baseline.key,count:candidates.length,selectedIdsSha256:idDigest,expectedRevision:input.expectedRevision,activeExportFilesInvalidated,priorReviewsCleared:currentReviews.length,priorReviewFingerprintsSha256}};
}
