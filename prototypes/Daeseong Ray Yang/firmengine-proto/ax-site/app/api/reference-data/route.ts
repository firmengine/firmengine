import { db,errorResponse,HttpError,jsonBody,requireHumanActor,requireSameOrigin } from "../../../lib/server-store";
import { REFERENCE_RELEASE,referenceRecordsPage } from "../../../lib/reference-registry.ts";
import { activateReferenceChange,bootstrapReferenceData,proposeReferenceChange,referenceStorageStatus } from "../../../lib/reference-store.ts";
import { loadReferenceSnapshot } from "../../../lib/reference-context.ts";
import { currentReferenceSnapshot } from "../../../lib/reference-runtime.ts";

const response=(value:unknown)=>Response.json(value,{headers:{"Cache-Control":"no-store"}});
export async function GET(request:Request){try{
  const query=new URL(request.url).searchParams;
  const page=referenceRecordsPage({kind:query.get("kind")||undefined,q:query.get("q")||undefined,offset:Number(query.get("offset")??0),limit:Number(query.get("limit")??50)});
  return response({release:REFERENCE_RELEASE,active:currentReferenceSnapshot()??await loadReferenceSnapshot(db()),storage:await referenceStorageStatus(db()),...page});
}catch(error){return errorResponse(error);}}
export async function POST(request:Request){try{
  requireSameOrigin(request);const input=await jsonBody(request);
  if(input.action==="bootstrap")return response(await bootstrapReferenceData(db(),input.offset??0,input.limit??200));
  if(input.action==="propose")return response(await proposeReferenceChange(db(),input,await requireHumanActor()));
  if(input.action==="activate")return response(await activateReferenceChange(db(),String(input.proposalId??""),String(input.expectedActiveSha256??""),await requireHumanActor()));
  throw new HttpError(400,"기준정보 작업을 확인하세요.");
}catch(error){if(error instanceof Error&&/^(INVALID_|UNKNOWN_|REFERENCE_|OFFICIAL_)/.test(error.message))return errorResponse(new HttpError(error.message.includes("CONFLICT")?409:400,error.message));return errorResponse(error);}}
