import { touchCase } from "../../../../../lib/domain";
import { db,errorResponse,event,getCase,HttpError,jsonBody,now,requireSameOrigin,saveCase } from "../../../../../lib/server-store";
import { SAMPLE_SHA256,samplePageRole } from "../../../../../lib/sample-manifest";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
  requireSameOrigin(request);const {id}=await params,body=await jsonBody(request),c=await getCase(id);
  if(c.structuredTest)throw new HttpError(409,"가정 추출 합성 시나리오에서는 증빙 문서를 추가할 수 없습니다.");
  if(typeof body.sha256!=="string"||!/^[a-f0-9]{64}$/.test(body.sha256))throw new HttpError(400,"파일 해시를 확인하세요.");
  if(!Number.isInteger(body.pageCount)||body.pageCount<1||body.pageCount>600)throw new HttpError(400,"파일당 1~600쪽까지 등록할 수 있습니다.");
  const existing=c.documents.find(d=>d.status==="active"&&d.sha256===body.sha256);
  if(existing){
    if(existing.pages.length!==body.pageCount)throw new HttpError(409,"같은 원본의 페이지 수가 기존 등록과 다릅니다.");
    return Response.json({documentId:existing.id,knownSample:body.sha256===SAMPLE_SHA256,idempotent:true,pageRoles:c.pages.filter(p=>p.documentId===existing.id).map(p=>({page:p.page,role:p.role,documentType:p.documentType}))});
  }
  const documentId=crypto.randomUUID(),name=String(body.name||"업로드 문서").slice(0,180),n=touchCase(c);
  const pageRoles=Array.from({length:body.pageCount},(_,i)=>samplePageRole(body.sha256,i+1));
  n.documents.push({id:documentId,name,sha256:body.sha256,status:"active",pages:pageRoles.map(p=>p.page),uploadedAt:now(),extractionStatus:"pending"});
  n.pages.push(...pageRoles.map(p=>({...p,documentId,imageUrl:`/api/cases/${id}/documents/${documentId}?kind=page&page=${p.page}`})));
  n.context.inventoryComplete={income:"unknown",debt:"unknown",asset:"unknown"};
  try{
    await db().prepare("INSERT INTO documents (id,case_id,name,sha256,page_count,ready,created_at) VALUES (?,?,?,?,?,0,?)").bind(documentId,id,name,body.sha256,body.pageCount,now()).run();
    const statements=pageRoles.map(p=>db().prepare("INSERT INTO page_jobs (id,case_id,document_id,page,role,document_type,status,stage,attempts,updated_at) VALUES (?,?,?,?,?,?,?,'waiting',0,?)").bind(`${documentId}:${p.page}`,id,documentId,p.page,p.role,p.documentType??null,["filed_form","administrative"].includes(p.role)?"held":"awaiting_upload",now()));
    for(let i=0;i<statements.length;i+=80)await db().batch(statements.slice(i,i+80));
    await saveCase(n,c.context.revision,c);
  }catch(error){
    await db().batch([db().prepare("DELETE FROM page_jobs WHERE document_id = ? AND case_id = ?").bind(documentId,id),db().prepare("DELETE FROM documents WHERE id = ? AND case_id = ? AND ready = 0").bind(documentId,id)]);throw error;
  }
  await event(id,"document.registered",{documentId,sha256:body.sha256,pageCount:body.pageCount});
  return Response.json({documentId,knownSample:body.sha256===SAMPLE_SHA256,pageRoles},{status:201});
}catch(e){return errorResponse(e);}}
