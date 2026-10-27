import { bucket,db,errorResponse,getCase,HttpError } from "../../../../../../lib/server-store";
export async function GET(request:Request,{params}:{params:Promise<{id:string,file:string}>}){try{
  const {id,file}=await params;await getCase(id);
  const row=await db().prepare("SELECT object_key,name,mime,hash FROM artifacts WHERE id = ? AND case_id = ?").bind(file,id).first<{object_key:string;name:string;mime:string;hash:string}>();
  if(!row)throw new HttpError(404,"생성물을 찾을 수 없습니다.");const object=await bucket().get(row.object_key);if(!object)throw new HttpError(404,"파일이 없습니다.");
  const disposition=new URL(request.url).searchParams.get("view")==="1"&&row.mime==="text/html"?"inline":"attachment";
  return new Response(object.body,{headers:{"Content-Type":row.mime,"Content-Disposition":`${disposition}; filename*=UTF-8''${encodeURIComponent(row.name)}`,"Cache-Control":"private,no-store","X-Content-Type-Options":"nosniff","ETag":`\"${row.hash}\"`,...(row.mime==="text/html"?{"Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox"}:{})}});
}catch(e){return errorResponse(e);}}
