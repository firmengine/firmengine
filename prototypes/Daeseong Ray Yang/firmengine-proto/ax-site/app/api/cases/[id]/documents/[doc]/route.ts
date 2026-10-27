import { createHash } from "node:crypto";
import { bucket,db,errorResponse,getCase,HttpError,now,requireSameOrigin,sha256 } from "../../../../../../lib/server-store";
import { samplePageRole } from "../../../../../../lib/sample-manifest";
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
  const job=await db().prepare("SELECT role,status,image_hash FROM page_jobs WHERE id = ? AND case_id = ?").bind(`${doc}:${page}`,id).first<{role:string,status:string,image_hash:string|null}>();
  if(!job)throw new HttpError(404,"페이지가 없습니다.");
  if(["filed_form","administrative"].includes(job.role)||["filed_form","administrative"].includes(samplePageRole(r.sha256,page).role))return Response.json({stored:false,heldOut:true});
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
