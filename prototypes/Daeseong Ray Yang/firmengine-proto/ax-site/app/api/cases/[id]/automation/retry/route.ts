import {db,errorResponse,HttpError,jsonBody,requireHumanActor,requireSameOrigin} from "../../../../../../lib/server-store.ts";
import {retryFailedCaseLegalAutomation} from "../../../../../../lib/case-legal-automation.ts";
export const runtime="edge";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  requireSameOrigin(request);
  await requireHumanActor();
  const {id}=await params,body=await jsonBody(request);
  if(!Number.isSafeInteger(body.expectedDataVersion)||body.expectedDataVersion<1)
   throw new HttpError(400,"현재 데이터 버전을 확인하세요.");
  return Response.json(await retryFailedCaseLegalAutomation(db(),{caseId:id,expectedDataVersion:body.expectedDataVersion}),
   {headers:{"Cache-Control":"no-store"}});
 }catch(error){return errorResponse(error);}
}
