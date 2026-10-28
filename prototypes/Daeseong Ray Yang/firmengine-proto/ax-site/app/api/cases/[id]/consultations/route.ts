import { analyzeConsultation,appendConsultation,getConsultationView } from "../../../../../lib/intake-store.ts";
import { errorResponse,HttpError,jsonBody,requireSameOrigin } from "../../../../../lib/server-store.ts";
export const runtime="edge";
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Context){try{requireSameOrigin(request);return Response.json(await getConsultationView((await params).id),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
export async function POST(request:Request,{params}:Context){try{requireSameOrigin(request);const {id}=await params,body=await jsonBody(request);if(!body||typeof body!=="object"||Array.isArray(body))throw new HttpError(400,"요청 형식을 확인하세요.");const result=body.action==="append"?await appendConsultation(id,body):body.action==="analyze"?await analyzeConsultation(id,body):null;if(!result)throw new HttpError(400,"상담 저장 또는 분석 작업을 선택하세요.");return Response.json(result,{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
