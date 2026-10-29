import { errorResponse,getCase,HttpError,readCaseAnalyses } from "../../../../../lib/server-store";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params,url=new URL(request.url),data=await getCase(id),rawRevision=url.searchParams.get("revision"),revision=rawRevision===null?data.context.revision:Number(rawRevision),rawLimit=url.searchParams.get("limit"),limit=rawLimit===null?undefined:Number(rawLimit),rawHistorical=url.searchParams.get("includeHistorical");
    if(rawHistorical!==null&&rawHistorical!=="true"&&rawHistorical!=="false")throw new HttpError(400,"includeHistorical은 true 또는 false여야 합니다.");
    if(limit!==undefined&&!Number.isSafeInteger(limit))throw new HttpError(400,"분석 페이지 크기를 확인하세요.");
    const result=await readCaseAnalyses(data,{revision,limit,cursor:url.searchParams.get("cursor"),includeHistorical:rawHistorical==="true",inputSha256:url.searchParams.get("inputSha256")??undefined});
    return Response.json(result,{headers:{"Cache-Control":"no-store"}});
  }catch(error){return errorResponse(error);}
}
