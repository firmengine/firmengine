import { createCase } from "../../../lib/domain";
import { actor,db,errorResponse,event,jsonBody,now,requireSameOrigin } from "../../../lib/server-store";
import { CURRENT_RULESET } from "../../../lib/legal-rules";
import { caseResponse } from "../../../lib/case-response";
export async function POST(request:Request){try{
  requireSameOrigin(request);const body=await jsonBody(request);
  const c=createCase(String(body.name||"새 개인회생 사건").slice(0,100));
  if(/^\d{4}-\d{2}-\d{2}$/.test(body.applicationDate||""))c.context.applicationDate=c.context.asOf=body.applicationDate;
  c.context.courtId=typeof body.courtId==="string"?body.courtId.slice(0,50):"seoul";
  c.context.ruleReleaseId=CURRENT_RULESET.id;
  await db().prepare("INSERT INTO cases (id,name,owner,revision,payload,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(c.context.id,c.context.caseName,await actor(),c.context.revision,JSON.stringify(c),now(),now()).run();
  await event(c.context.id,"case.created",{name:c.context.caseName});
  return Response.json(await caseResponse(c),{status:201,headers:{"Location":`/api/cases/${c.context.id}`,"Cache-Control":"no-store"}});
}catch(e){return errorResponse(e);}}
