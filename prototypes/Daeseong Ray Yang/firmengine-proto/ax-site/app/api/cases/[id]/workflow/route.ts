import { requireCaseReadAccess } from "../../../../../lib/case-read-access.ts";
import { caseWorkflowResponse } from "../../../../../lib/case-workflow-server";
import { errorResponse } from "../../../../../lib/server-store";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;await requireCaseReadAccess(id);return Response.json(await caseWorkflowResponse(id),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
