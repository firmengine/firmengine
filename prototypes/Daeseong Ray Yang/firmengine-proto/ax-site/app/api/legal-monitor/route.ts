import { errorResponse,HttpError,jsonBody,requireHumanActor,requireSameOrigin } from "../../../lib/server-store";
import { acknowledgeLegalMonitorAlert,legalMonitorOverview,runStoredLegalMonitor,saveLegalMonitorSchedule } from "../../../lib/legal-monitor-store.ts";
const response=(value:unknown)=>Response.json(value,{headers:{"Cache-Control":"no-store"}});
export async function GET(){try{return response(await legalMonitorOverview());}catch(error){return errorResponse(error);}}
export async function POST(request:Request){try{
  requireSameOrigin(request);const input=await jsonBody(request);
  if(input.action==="run")return response(await runStoredLegalMonitor(input));
  if(input.action==="acknowledge")return response(await acknowledgeLegalMonitorAlert(String(input.id??""),await requireHumanActor()));
  if(input.action==="set_schedule")return response(await saveLegalMonitorSchedule(input));
  throw new HttpError(400,"변경 감시 작업을 확인하세요.");
}catch(error){return errorResponse(error);}}
