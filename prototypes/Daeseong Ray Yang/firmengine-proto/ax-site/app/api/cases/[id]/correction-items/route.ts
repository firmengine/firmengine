/** Authenticated staff entry of actual court correction-order sub-items.
 * This endpoint never accepts/approves the legal sufficiency of the item.
 */
import {db,errorResponse,getCase,HttpError,jsonBody,requireSameOrigin} from "../../../../../lib/server-store.ts";
import {requireAppRole} from "../../../../../lib/app-roles.ts";
import {getIntakeCatalog} from "../../../../../lib/intake-store.ts";
import {readCourtCorrectionItems,upsertCourtCorrectionItem,type CorrectionItemDraft} from "../../../../../lib/preapproval-correction-item-store.ts";
export const runtime="edge";
type Params={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Params){
 try{
  requireSameOrigin(request);
  const {id}=await params,data=await getCase(id);
  const result=await readCourtCorrectionItems(db(),data);
  return Response.json(result,{headers:{"Cache-Control":"no-store"}});
 }catch(error){return errorResponse(error);}
}
export async function POST(request:Request,{params}:Params){
 try{
  requireSameOrigin(request);
  const {id}=await params;
  const actorId=await requireAppRole("caseworker_review",id);
  const raw=await jsonBody(request);
  if(!raw||typeof raw!=="object"||raw.action!=="upsert_correction_item"||
     !raw.draft||typeof raw.draft!=="object"||Array.isArray(raw.draft))
    throw new HttpError(400,"보정명령 항목 입력값을 확인하세요.");
  const keys=["courtEventId","itemNo","orderDocumentId","orderPage","orderQuote",
    "requiredCanonicalFieldIds","unmappedRequiredFieldLabels","requiredDocumentTypeIds",
    "requiredPeriod","deadline","responseEventId","responseDocumentIds","receiptDocumentId",
    "expectedCaseRevision","expectedSourceDataVersion","expectedHeadId","reason"];
  if(Object.keys(raw).some(key=>!["action","draft"].includes(key))||
      Object.keys(raw.draft).length!==keys.length||
      Object.keys(raw.draft).some(key=>!keys.includes(key)))
    throw new HttpError(400,"보정명령 항목 형식을 확인하세요.");
  const activeCatalog=await getIntakeCatalog();
  const approvedIds=new Set(activeCatalog.catalog.documents.map(d=>d.id));
  if(!Array.isArray(raw.draft.requiredDocumentTypeIds)||
     raw.draft.requiredDocumentTypeIds.some((docType:unknown)=>typeof docType!=="string"||!approvedIds.has(docType)))
    throw new HttpError(400,"등록된 서류 기준정보에 없는 보정 요청서류입니다.");
  const data=await getCase(id);
  const receipt=await upsertCourtCorrectionItem(db(),{data,draft:raw.draft as CorrectionItemDraft,actorId});
  return Response.json({...receipt,autoApproval:false,courtAcceptanceInferred:false},
    {headers:{"Cache-Control":"no-store"},status:receipt.unchanged?200:201});
 }catch(error){
  if(error instanceof Error&&/^(?:CORRECTION_CASE_REVISION_MISMATCH|CORRECTION_ITEM_CONCURRENT_CHANGE|CORRECTION_SOURCE_DATA_VERSION_MISMATCH|CORRECTION_ORDER_STORAGE_HASH_MISMATCH)$/.test(error.message))
    return errorResponse(new HttpError(409,error.message));
  if(error instanceof Error&&error.message.startsWith("CORRECTION_"))
    return errorResponse(new HttpError(400,error.message));
  return errorResponse(error);
 }
}
