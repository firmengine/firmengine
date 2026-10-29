import { errorResponse,HttpError,jsonBody,requireSameOrigin } from "../../../lib/server-store.ts";
import { caseSchemaServices } from "../../../lib/case-schema-services.ts";
export const runtime="edge";
export async function GET(request:Request){try{
  requireSameOrigin(request);const query=new URL(request.url).searchParams,afterEventId=Number(query.get("afterEventId")??0),limit=Number(query.get("limit")??50);
  return Response.json(await caseSchemaServices().caseUpdates({caseId:query.get("caseId")??undefined,afterEventId,limit}),{headers:{"Cache-Control":"no-store"}});
}catch(error){return errorResponse(error);}}
export async function POST(request:Request){try{
  requireSameOrigin(request);const body=await jsonBody(request);
  if(body.caseId!==undefined&&(typeof body.caseId!=="string"||!body.caseId.trim()||body.caseId.length>300))throw new HttpError(400,"사건 ID를 확인하세요.");
  if(body.limit!==undefined&&(!Number.isSafeInteger(body.limit)||body.limit<1||body.limit>5))throw new HttpError(400,"한 번에 처리할 사건 수는 1~5개입니다.");
  return Response.json(await caseSchemaServices().processCaseUpdates({caseId:body.caseId,limit:body.limit}),{headers:{"Cache-Control":"no-store"}});
}catch(error){return errorResponse(error);}}
