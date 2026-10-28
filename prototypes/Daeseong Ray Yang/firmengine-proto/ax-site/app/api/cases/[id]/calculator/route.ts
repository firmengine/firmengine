import { getCase, errorResponse, HttpError, jsonBody, requireSameOrigin } from "../../../../../lib/server-store";
import { jsonResponse } from "../../../../../lib/json-response";
import { callCalculatorTool } from "../../../../../lib/calculator-tools";
import { CURRENT_RULESET } from "../../../../../lib/legal-rules";

/** Same owner-private case access as the existing routes; clients cannot replace the stored snapshot. */
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    requireSameOrigin(request);
    const {id}=await params,body=await jsonBody(request);
    if(!["plan_case","calculate_case","build_document_payload"].includes(body.tool))throw new HttpError(400,"지원하지 않는 사건 계산 도구입니다.");
    const data=await getCase(id);
    if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision!==data.context.revision)throw new HttpError(409,"사건 내용이 변경되었습니다. 현재 판본으로 다시 계산하세요.");
    const result=await callCalculatorTool(body.tool,{caseData:data,expectedRevision:body.expectedRevision,ruleReleaseId:body.ruleReleaseId??CURRENT_RULESET.id});
    return jsonResponse(result,request,{status:result.ok?200:422,headers:{"Cache-Control":"no-store"}});
  } catch(error) { return errorResponse(error); }
}
