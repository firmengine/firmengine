import { errorResponse,HttpError,requireSameOrigin } from "../../../../../lib/server-store.ts";
import { readCaseSchemaData } from "../../../../../lib/case-schema-services.ts";
export const runtime="edge";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    requireSameOrigin(request);const {id}=await params,query=new URL(request.url).searchParams;
    const number=(key:string,min:number,max:number)=>{const raw=query.get(key);if(raw===null)return undefined;const value=Number(raw);if(!/^\d+$/.test(raw)||!Number.isSafeInteger(value)||value<min||value>max)throw new HttpError(400,"조회 범위를 확인하세요.");return value;};
    const expectedRunId=query.get("expectedRunId");
    if(expectedRunId!==null&&!/^calculation-[a-f0-9]{64}$/i.test(expectedRunId))throw new HttpError(400,"계산 결과 판본을 확인하세요.");
    const result=await readCaseSchemaData(id,{view:query.get("view")??undefined,documentTypeId:query.get("documentTypeId")??undefined,expectedRevision:number("expectedRevision",1,Number.MAX_SAFE_INTEGER),expectedDataVersion:number("expectedDataVersion",0,Number.MAX_SAFE_INTEGER),expectedRunId:expectedRunId??undefined,limit:number("limit",1,50),offset:number("offset",0,Number.MAX_SAFE_INTEGER),afterEventId:number("afterEventId",0,Number.MAX_SAFE_INTEGER)});
    return Response.json(result,{headers:{"Cache-Control":"no-store"}});
  }catch(error){if(["CASE_REVISION_MISMATCH","CALCULATION_VERSION_MISMATCH"].includes((error as {code?:string}).code??""))return errorResponse(new HttpError(409,"사건 또는 계산 판본이 변경되었습니다. 최신 버전을 조회하세요."));return errorResponse(error);}
}
