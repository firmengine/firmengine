/** Case-scoped human read boundary. The private Site shell is not a substitute
 * for checking a specific actor's grant before exposing client case material.
 * Neither a service identity nor a role administrator implicitly gets access.
 */
import {HttpError,requireHumanActor} from "./server-store.ts";
import {rolesForActor} from "./app-roles.ts";

export async function requireCaseReadAccess(caseId:string):Promise<string>{
  if(typeof caseId!=="string"||!caseId.trim())throw new HttpError(400,"CASE_READ_INVALID_ID");
  const who=await requireHumanActor();
  const roles=await rolesForActor(who,caseId);
  if(!roles.some(role=>role==="case_editor"||role==="caseworker_review"||role==="lawyer_review"))
    throw new HttpError(403,"CASE_READ_ROLE_REQUIRED");
  return who;
}
