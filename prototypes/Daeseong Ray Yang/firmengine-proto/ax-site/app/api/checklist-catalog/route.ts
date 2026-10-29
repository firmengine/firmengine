import { getIntakeCatalog,saveIntakeCatalog } from "../../../lib/intake-store.ts";
import { errorResponse,HttpError,jsonBody,requireHumanActor,requireSameOrigin } from "../../../lib/server-store.ts";
export const runtime="edge";
export async function GET(request:Request){try{requireSameOrigin(request);return Response.json(await getIntakeCatalog(),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
export async function PUT(request:Request){try{requireSameOrigin(request);await requireHumanActor();const body=await jsonBody(request);if(!body||typeof body!=="object"||Array.isArray(body))throw new HttpError(400,"요청 형식을 확인하세요.");return Response.json(await saveIntakeCatalog(body.catalog,body.expectedVersion),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
