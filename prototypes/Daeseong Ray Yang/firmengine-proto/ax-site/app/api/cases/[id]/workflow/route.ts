import { caseWorkflowResponse } from "../../../../../lib/case-workflow-server";
import { errorResponse } from "../../../../../lib/server-store";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{return Response.json(await caseWorkflowResponse((await params).id),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
