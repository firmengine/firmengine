import {requireAppRole} from "../../../../../../lib/app-roles.ts";
import {caseCalculationPollHealth,retryFailedCaseCalculationPoll} from "../../../../../../lib/case-data-recompute.ts";
import {db,errorResponse,event,HttpError,jsonBody,requireSameOrigin} from "../../../../../../lib/server-store.ts";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params;await requireAppRole("case_editor",id);
  return Response.json(await caseCalculationPollHealth(db(),id),{headers:{"Cache-Control":"no-store"}});
 }catch(error){return errorResponse(error);}
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  requireSameOrigin(request);
  const {id}=await params,who=await requireAppRole("case_editor",id),body=await jsonBody(request);
  if(!body||typeof body!=="object"||Array.isArray(body)||!Number.isSafeInteger(body.expectedDataVersion)||typeof body.reason!=="string"||!body.reason.trim()||body.reason.length>500)
   throw new HttpError(400,"현재 원본 판본과 재시도 사유를 확인하세요.");
  const result=await retryFailedCaseCalculationPoll(db(),{caseId:id,expectedDataVersion:body.expectedDataVersion});
  await event(id,"case_calculation.retry_requested",{actor:who,dataVersion:result.dataVersion,reason:body.reason.trim()}).catch(()=>{});
  return Response.json(result,{headers:{"Cache-Control":"no-store"}});
 }catch(error){return errorResponse(error);}
}
