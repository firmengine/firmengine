import { createCase } from "../../../lib/domain";
import { actor,db,errorResponse,getCase,jsonBody,now,requireSameOrigin } from "../../../lib/server-store";
import { CURRENT_RULESET } from "../../../lib/legal-rules";
import { caseResponse } from "../../../lib/case-response";
export async function POST(request:Request){try{
  requireSameOrigin(request);const body=await jsonBody(request);
  const c=createCase(String(body.name||"새 개인회생 사건").slice(0,100));
  if(/^\d{4}-\d{2}-\d{2}$/.test(body.applicationDate||""))c.context.applicationDate=c.context.asOf=body.applicationDate;
  c.context.courtId=typeof body.courtId==="string"?body.courtId.slice(0,50):"seoul";
  c.context.ruleReleaseId=CURRENT_RULESET.id;
  // Case and its creation audit event must commit together; a failed event write
  // must not leave an invisible case behind a 500 response.
  const owner=await actor(),createdAt=now();
  const receipts=await db().batch([
    db().prepare("INSERT INTO cases (id,name,owner,revision,payload,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(c.context.id,c.context.caseName,owner,c.context.revision,JSON.stringify(c),createdAt,createdAt),
    db().prepare("INSERT INTO events (id,case_id,actor,type,detail,at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),c.context.id,owner,"case.created",JSON.stringify({name:c.context.caseName}),createdAt),
  ]);
  if(receipts.length!==2||receipts.some(item=>item?.meta?.changes!==1))throw new Error("CASE_CREATE_RECEIPT_UNCONFIRMED");
  return Response.json(await caseResponse(await getCase(c.context.id)),{status:201,headers:{"Location":`/api/cases/${c.context.id}`,"Cache-Control":"no-store"}});
}catch(e){return errorResponse(e);}}
