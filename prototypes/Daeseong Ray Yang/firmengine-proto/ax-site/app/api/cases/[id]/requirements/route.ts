import { caseWorkflowResponse } from "../../../../../lib/case-workflow-server";
import { errorResponse } from "../../../../../lib/server-store";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{const view=await caseWorkflowResponse((await params).id);return Response.json({caseId:view.caseId,revision:view.revision,stateFingerprint:view.stateFingerprint,requirements:view.workflow.requirements,states:view.requirementStates},{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
