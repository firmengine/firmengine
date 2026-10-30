import {adoptAutomaticDraftForReview} from "../../../../../../lib/automatic-draft-handoff.ts";
import {requireAppRole} from "../../../../../../lib/app-roles.ts";
import {errorResponse,jsonBody,requireSameOrigin} from "../../../../../../lib/server-store.ts";
import {jsonResponse} from "../../../../../../lib/json-response.ts";

/** Explicit staff action. Does not submit, finalize, or approve any court filing. */
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  requireSameOrigin(request);
  const {id}=await params;
  const actor=await requireAppRole("case_editor",id);
  await requireAppRole("caseworker_review",id);
  const body=await jsonBody(request) as Record<string,unknown>;
  if(!body||Array.isArray(body)||typeof body!=="object"||
    Object.keys(body).some(key=>!["runId","expectedRevision","expectedStateFingerprint","reason"].includes(key)))
    throw new Error("AUTODRAFT_INVALID_HANDOFF_REQUEST");
  const result=await adoptAutomaticDraftForReview({
    caseId:id,actor,runId:String(body.runId??""),
    expectedRevision:Number(body.expectedRevision),
    expectedStateFingerprint:String(body.expectedStateFingerprint??""),
    reason:String(body.reason??"")
  });
  return jsonResponse(result,request,{headers:{"Cache-Control":"no-store"}});
 }catch(error){return errorResponse(error);}
}
