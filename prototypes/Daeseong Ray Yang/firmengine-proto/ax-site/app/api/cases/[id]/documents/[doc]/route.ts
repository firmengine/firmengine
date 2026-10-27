import { canUseRescueRole } from "../../../../../../lib/classification-recovery";
import { createHash } from "node:crypto";
import { bucket,db,errorResponse,getCase,HttpError,now,requireSameOrigin,sha256 } from "../../../../../../lib/server-store";
import { samplePageRole } from "../../../../../../lib/sample-manifest";
import { rescueSpecs } from "../../../../../../lib/scan-quality";
type Context={params:Promise<{id:string,doc:string}>};
async function record(id:string,doc:string){
  const c=await getCase(id);if(!c.documents.some(d=>d.id===doc&&d.status==="active"))throw new HttpError(404,"사용 중인 문서를 찾을 수 없습니다.");
  const row=await db().prepare("SELECT * FROM documents WHERE id = ? AND case_id = ?").bind(doc,id).first<{id:string,sha256:string,name:string,page_count:number,original_key:string|null,ready:number}>();
  if(!row)throw new HttpError(404,"문서를 찾을 수 없습니다.");return row;
}
export async function PUT(request:Request,{params}:Context){try{
  requireSameOrigin(request);const {id,doc}=await params,r=await record(id,doc),url=new URL(request.url),kind=url.searchParams.get("kind");
  if(!request.body)throw new HttpError(400,"파일 내용이 없습니다.");
  if(kind==="original"){
    const length=Number(request.headers.get("content-length")||0);if(!Number.isSafeInteger(length)||length<=0||length>100_000_000)throw new HttpError(413,"100MB 이하 원본 파일과 전송 크기가 필요합니다.");
    const mime=request.headers.get("content-type")||"application/pdf";if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(mime))throw new HttpError(415,"PDF 또는 이미지 파일을 올려주세요.");
    const hash=createHash("sha256");let bytes=0;
    const stream=request.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk,controller){bytes+=chunk.byteLength;if(bytes>100_000_000)throw new Error("100MB 제한을 넘었습니다.");hash.update(chunk);controller.enqueue(chunk);}}));
    // A new upload never touches the currently referenced object. Only a fully
    // checked upload may win the one-time pointer CAS; all losing keys are private.
    const key=`cases/${id}/documents/${doc}/original/${crypto.randomUUID()}`;
    const fixed=new FixedLengthStream(length),abort=new AbortController();let retained=false;
    try{
      const writing=stream.pipeTo(fixed.writable,{signal:abort.signal});
      const uploading=bucket().put(key,fixed.readable,{httpMetadata:{contentType:mime}}).catch(error=>{abort.abort(error);throw error;});
      const results=await Promise.allSettled([writing,uploading]),failed=results.find(result=>result.status==="rejected");
      if(failed?.status==="rejected")throw failed.reason;
      if(bytes!==length)throw new HttpError(400,"실제 전송 크기가 지정한 파일 크기와 다릅니다.");
      if(hash.digest("hex")!==r.sha256)throw new HttpError(422,"전송한 파일과 등록된 해시가 다릅니다. 다시 업로드하세요.");
      const updated=await db().prepare("UPDATE documents SET original_key = ?,ready = 1 WHERE id = ? AND case_id = ? AND ready = 0 AND sha256 = ?").bind(key,doc,id,r.sha256).run();
      if(updated.meta.changes){retained=true;return Response.json({stored:true});}
      const latest=await db().prepare("SELECT sha256,original_key,ready FROM documents WHERE id = ? AND case_id = ?").bind(doc,id).first<{sha256:string;original_key:string|null;ready:number}>();
      if(latest?.ready===1&&latest.original_key&&latest.sha256===r.sha256)return Response.json({stored:true,idempotent:true});
      throw new HttpError(409,"문서 업로드 상태가 변경되었습니다. 최신 내용을 불러온 뒤 다시 시도하세요.");
    }finally{
      if(!retained)try{await bucket().delete(key);}catch{/* Unreferenced staging data is never exposed as an original. */}
    }
  }
  const page=Number(url.searchParams.get("page"));if(!Number.isInteger(page)||page<1||page>r.page_count)throw new HttpError(400,"페이지 범위를 확인하세요.");
  const job=await db().prepare("SELECT role,status,image_hash FROM page_jobs WHERE id = ? AND case_id = ? AND document_id = ? AND page = ?").bind(`${doc}:${page}`,id,doc,page).first<{role:string,status:string,image_hash:string|null}>();
  if(!job)throw new HttpError(404,"페이지가 없습니다.");
  if(["filed_form","administrative"].includes(job.role)||["filed_form","administrative"].includes(samplePageRole(r.sha256,page).role))return Response.json({stored:false,heldOut:true});
  if(kind==="variant"){
    const current=await getCase(id),casePage=current.pages.find(p=>p.documentId===doc&&p.page===page);
    if(r.ready!==1)throw new HttpError(409,"활성 원본 문서가 준비되지 않았습니다.");
    if(!job.image_hash)throw new HttpError(409,"기준 페이지 이미지가 아직 준비되지 않았습니다.");
    const planId=request.headers.get("x-rescue-plan-id")||"",sourceHash=request.headers.get("x-source-hash")||"",baseHash=request.headers.get("x-base-image-hash")||"",variant=request.headers.get("x-variant")||"",bboxText=request.headers.get("x-source-bbox")||"",transformText=request.headers.get("x-transform")||"{}";
    let currentPlan: {rescuePlan?:{planId?:string;documentId?:string;page?:number;sourceHash?:string;baseImageHash?:string;reason?:"field_disagreement"|"omitted_rows"|"unreadable"|"incomplete_extraction"|"classification_unknown";boxes?:unknown[];recipeVersion?:"neutral-v1"|"luma-levels-v2"}}|null=null;
    const jobResult=await db().prepare("SELECT result FROM page_jobs WHERE id = ? AND case_id = ?").bind(`${doc}:${page}`,id).first<{result:string|null}>();try{currentPlan=JSON.parse(jobResult?.result??"{}");}catch{}
    const activePlan=currentPlan?.rescuePlan;
    if(!canUseRescueRole(job.role,casePage?.role,activePlan?.reason))throw new HttpError(409,"현재 활성 증빙 또는 제한된 미분류 복구 계획의 페이지만 사용할 수 있습니다.");
    if(!planId||activePlan?.planId!==planId||activePlan.documentId!==doc||activePlan.page!==page||activePlan.sourceHash!==sourceHash||activePlan.baseImageHash!==baseHash)throw new HttpError(409,"재판독 계획이 만료되었거나 원본이 변경되었습니다. 최신 계획을 다시 불러오세요.");
    if(sourceHash!==r.sha256||baseHash!==job.image_hash)throw new HttpError(409,"원본 또는 기준 이미지가 변경되어 후보를 연결하지 않았습니다.");
    if(!activePlan.reason||!activePlan.boxes)throw new HttpError(409,"재판독 계획 정보가 불완전합니다.");
    if(!/^rescue-(field_disagreement|omitted_rows|unreadable|incomplete_extraction|classification_unknown)-[1-4]$/.test(variant))throw new HttpError(400,"후보 유형을 확인하세요.");
    let bbox:unknown,transform:unknown;try{bbox=JSON.parse(bboxText);transform=JSON.parse(transformText);}catch{throw new HttpError(400,"후보의 위치 정보를 읽을 수 없습니다.");}
    if(!Array.isArray(bbox)||bbox.length!==4||bbox.some(x=>typeof x!=="number"||x<0||x>1)||bbox[0]>=bbox[2]||bbox[1]>=bbox[3])throw new HttpError(400,"후보 위치 범위가 올바르지 않습니다.");
    const tx=transform as {rotation?:unknown;contrast?:unknown;tone?:unknown;recipeVersion?:unknown;method?:unknown};if(!tx||typeof tx!=="object"||!(["canvas-crop-v1","pymupdf-pillow-crop-v1"] as unknown[]).includes(tx.method)||typeof tx.rotation!=="number"||!Number.isFinite(tx.rotation)||Math.abs(tx.rotation)>180||typeof tx.contrast!=="number"||tx.contrast<.75||tx.contrast>1.35)throw new HttpError(400,"후보 변환 정보가 허용 범위를 벗어났습니다.");
    if(activePlan.recipeVersion!==undefined&&!("neutral-v1"===activePlan.recipeVersion||"luma-levels-v2"===activePlan.recipeVersion))throw new HttpError(409,"저장된 재판독 변환 레시피를 확인할 수 없습니다.");
    const expected=rescueSpecs({reason:activePlan.reason,boxes:activePlan.boxes,sourceHash,baseImageHash:baseHash,recipeVersion:activePlan.recipeVersion}).find(spec=>spec.variant===variant);
    const legacyNeutral=expected?.recipeVersion==="neutral-v1"&&tx.recipeVersion===undefined&&tx.tone===undefined;
    if(!expected||JSON.stringify(expected.bbox)!==JSON.stringify(bbox)||expected.rotation!==tx.rotation||expected.contrast!==tx.contrast||(!legacyNeutral&&(tx.recipeVersion!==expected.recipeVersion||tx.tone!==expected.tone)))throw new HttpError(400,"후보는 저장된 재판독 계획의 위치·회전·대비·톤 레시피와 일치해야 합니다.");
    const bytes=await request.arrayBuffer();if(bytes.byteLength<1||bytes.byteLength>8_000_000)throw new HttpError(413,"후보 이미지는 8MB까지 지원합니다.");
    const contentType=request.headers.get("content-type")||"";if(!["image/jpeg","image/png","image/webp"].includes(contentType))throw new HttpError(415,"후보는 JPEG·PNG·WEBP 이미지여야 합니다.");
    // The same crop bytes may legitimately occupy distinct rescue slots. Bind
    // both the row identity and object key to the validated slot so one slot
    // can never make another appear idempotent or overwrite its R2 object.
    const variantHash=await sha256(bytes),derivativeId=`${doc}:${page}:${planId}:${variant}:${variantHash}`,key=`cases/${id}/documents/${doc}/derivatives/${page}/${planId}/${variant}/${variantHash}`;
    const existing=await db().prepare("SELECT id,variant_hash FROM page_derivatives WHERE id = ? AND case_id = ? AND plan_id = ? AND source_hash = ? AND base_image_hash = ?").bind(derivativeId,id,planId,sourceHash,baseHash).first();if(existing)return Response.json({stored:true,idempotent:true,variant,variantHash});
    const sameVariant=await db().prepare("SELECT id,variant_hash FROM page_derivatives WHERE case_id = ? AND document_id = ? AND page = ? AND plan_id = ? AND variant = ?").bind(id,doc,page,planId,variant).first<{id:string;variant_hash:string}>();
    if(sameVariant){if(sameVariant.variant_hash===variantHash)return Response.json({stored:true,idempotent:true,variant,variantHash});throw new HttpError(409,"이 재판독 계획의 후보 유형은 이미 다른 이미지로 저장되었습니다.");}
    const count=await db().prepare("SELECT COUNT(*) AS n FROM page_derivatives WHERE case_id = ? AND document_id = ? AND page = ? AND plan_id = ? AND source_hash = ? AND base_image_hash = ?").bind(id,doc,page,planId,sourceHash,baseHash).first<{n:number}>();
    if((count?.n??0)>=4)throw new HttpError(409,"이 페이지의 후보 재판독 한도에 도달했습니다.");
    const latestJob=await db().prepare("SELECT role,image_hash,status FROM page_jobs WHERE id = ? AND case_id = ?").bind(`${doc}:${page}`,id).first<{role:string;image_hash:string|null;status:string}>(),latestCase=await getCase(id),latestPage=latestCase.pages.find(p=>p.documentId===doc&&p.page===page);
    if(!latestJob||!canUseRescueRole(latestJob.role,latestPage?.role,activePlan.reason)||latestJob.image_hash!==baseHash||!latestCase.documents.some(d=>d.id===doc&&d.status==="active"&&d.sha256===sourceHash))throw new HttpError(409,"페이지 역할이나 원본이 변경되어 후보를 연결하지 않았습니다.");
    await bucket().put(key,bytes,{httpMetadata:{contentType}});
    try{
      const inserted=await db().prepare("INSERT INTO page_derivatives (id,case_id,document_id,page,plan_id,source_hash,base_image_hash,variant_hash,variant,object_key,bbox,transform,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM page_derivatives WHERE case_id = ? AND document_id = ? AND page = ? AND plan_id = ? AND source_hash = ? AND base_image_hash = ?) < 4 AND NOT EXISTS (SELECT 1 FROM page_derivatives WHERE case_id = ? AND document_id = ? AND page = ? AND plan_id = ? AND variant = ?) AND EXISTS (SELECT 1 FROM page_jobs WHERE id = ? AND case_id = ? AND document_id = ? AND page = ? AND (role = 'evidence' OR (role = 'unknown' AND json_extract(result, '$.rescuePlan.reason') = 'classification_unknown')) AND image_hash = ? AND json_extract(result, '$.rescuePlan.planId') = ? AND json_extract(result, '$.rescuePlan.documentId') = ? AND json_extract(result, '$.rescuePlan.page') = ? AND json_extract(result, '$.rescuePlan.sourceHash') = ? AND json_extract(result, '$.rescuePlan.baseImageHash') = ?)").bind(derivativeId,id,doc,page,planId,sourceHash,baseHash,variantHash,variant,key,JSON.stringify(bbox),JSON.stringify(transform),now(),id,doc,page,planId,sourceHash,baseHash,id,doc,page,planId,variant,`${doc}:${page}`,id,doc,page,baseHash,planId,doc,page,sourceHash,baseHash).run();
      if(!inserted.meta.changes){const existing=await db().prepare("SELECT id,variant_hash FROM page_derivatives WHERE case_id = ? AND document_id = ? AND page = ? AND plan_id = ? AND variant = ?").bind(id,doc,page,planId,variant).first<{id:string;variant_hash:string}>();if(existing?.variant_hash===variantHash)return Response.json({stored:true,idempotent:true,variant,variantHash});if(!existing)throw new HttpError(409,"재판독 계획이 변경되었거나 페이지 후보 한도에 도달했습니다.");throw new HttpError(409,"이 재판독 계획의 후보 유형은 이미 다른 이미지로 저장되었습니다.");}
    }catch(error){const sameVariant=await db().prepare("SELECT id,variant_hash FROM page_derivatives WHERE case_id = ? AND document_id = ? AND page = ? AND plan_id = ? AND variant = ?").bind(id,doc,page,planId,variant).first<{id:string;variant_hash:string}>();if(sameVariant?.variant_hash===variantHash)return Response.json({stored:true,idempotent:true,variant,variantHash});if(sameVariant){try{await bucket().delete(key);}catch{/* orphan cleanup is best-effort */}throw new HttpError(409,"이 재판독 계획의 후보 유형은 이미 다른 이미지로 저장되었습니다.");}const existing=await db().prepare("SELECT id FROM page_derivatives WHERE id = ? AND case_id = ?").bind(derivativeId,id).first();if(!existing){try{await bucket().delete(key);}catch{/* orphan cleanup is best-effort */}throw error;}}
    return Response.json({stored:true,variant,variantHash});
  }
  const contentType=request.headers.get("content-type")||"";if(!["image/jpeg","image/png","image/webp"].includes(contentType))throw new HttpError(415,"페이지는 JPEG·PNG·WEBP 이미지여야 합니다.");
  const bytes=await request.arrayBuffer();if(bytes.byteLength>8_000_000)throw new HttpError(413,"페이지 이미지는 8MB까지 지원합니다.");
  const hash=await sha256(bytes),key=`cases/${id}/documents/${doc}/pages/${page}/${hash}`;
  if(job.image_hash===hash)return Response.json({stored:true,page,idempotent:true});
  if(job.image_hash)throw new HttpError(409,"기존 페이지 이미지를 덮어쓸 수 없습니다. 원본 변경은 새 문서로 올리고 이전 문서를 철회하세요.");
  await bucket().put(key,bytes,{httpMetadata:{contentType}});
  const updated=await db().prepare("UPDATE page_jobs SET image_key = ?,image_hash = ?,status = 'pending',stage = 'waiting',error = NULL,attempts = 0,updated_at = ? WHERE id = ? AND case_id = ? AND image_hash IS NULL AND status = 'awaiting_upload'").bind(key,hash,now(),`${doc}:${page}`,id).run();
  if(!updated.meta.changes){const latest=await db().prepare("SELECT image_hash FROM page_jobs WHERE id = ? AND case_id = ?").bind(`${doc}:${page}`,id).first<{image_hash:string|null}>();if(latest?.image_hash!==hash)throw new HttpError(409,"페이지가 다른 요청에서 변경되었습니다.");}
  return Response.json({stored:true,page});
}catch(e){return errorResponse(e);}}
export async function GET(request:Request,{params}:Context){try{
  const {id,doc}=await params,r=await record(id,doc),url=new URL(request.url);let key=r.original_key;
  if(url.searchParams.get("kind")==="page"){
    const page=Number(url.searchParams.get("page"));const row=await db().prepare("SELECT image_key FROM page_jobs WHERE document_id = ? AND page = ? AND case_id = ?").bind(doc,page,id).first<{image_key:string|null}>();key=row?.image_key??null;
  }
  if(!key)throw new HttpError(404,"아직 업로드되지 않은 파일입니다.");const object=await bucket().get(key);if(!object)throw new HttpError(404,"파일을 찾을 수 없습니다.");
  const headers=new Headers({"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"});object.writeHttpMetadata(headers);
  if(url.searchParams.get("download"))headers.set("Content-Disposition",`attachment; filename*=UTF-8''${encodeURIComponent(r.name)}`);
  return new Response(object.body,{headers});
}catch(e){return errorResponse(e);}}
