import {errorResponse,HttpError,requireHumanActor,requireSameOrigin} from "../../../lib/server-store.ts";
import {getIntakeCatalog} from "../../../lib/intake-store.ts";
import {auditIntakeDocumentContracts} from "../../../lib/intake-document-contract-audit.ts";
/** Staff-facing 85-document source->OCR contract inventory, not a filing approval. */
export async function GET(request:Request){try{
 requireSameOrigin(request);await requireHumanActor();
 const query=new URL(request.url).searchParams,type=query.get("documentTypeId")??undefined;
 if(type&&(!/^[a-zA-Z0-9_.:-]{1,120}$/.test(type)))throw new HttpError(400,"서류 식별자를 확인하세요.");
 const current=await getIntakeCatalog();
 return Response.json(auditIntakeDocumentContracts(current.catalog,current.sha256,{documentTypeId:type}),
   {headers:{"Cache-Control":"no-store"}});
}catch(error){return errorResponse(error);}}
