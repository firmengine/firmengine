/** Private D1 extension for human-itemized pre-approval court correction orders.
 * No case source/OCR/calculator/legal disposition updates. A PDF or receipt is
 * evidence only: an item can never be automatically marked court-satisfied.
 */
import canonical from "./canonical-field-id-index.json" with {type:"json"};
import {currentFacts,validSourceRef,type CaseData,type Fact} from "./domain.ts";
export const PREAPPROVAL_CORRECTION_ITEM_STORE_VERSION="case-court-correction-items/1" as const;
export interface CorrectionItemDraft {
 courtEventId:string;itemNo:number;orderDocumentId:string;orderPage:number;
 orderQuote:string;requiredCanonicalFieldIds:string[];unmappedRequiredFieldLabels:string[];
 requiredDocumentTypeIds:string[];requiredPeriod:string|null;
 deadline:{date:string;sourceFactId:string}|null;
 responseEventId:string|null;responseDocumentIds:string[];receiptDocumentId:string|null;
 expectedCaseRevision:number;expectedSourceDataVersion:number;expectedHeadId:string|null;reason:string;
}
type Version={versionId:string;payload:CorrectionItemDraft;orderDocumentSha256:string};
const knownCanonical=new Set(canonical.ids);
const iso=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+"T00:00:00Z"))&&new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v;
const unique=(v:string[])=>new Set(v).size===v.length;
const goodStrings=(v:unknown,max=100)=>(Array.isArray(v)&&v.length<=max&&v.every(x=>typeof x==="string"&&!!x.trim()&&x.length<=250)&&unique(v));
const fail=(code:string)=>Object.assign(new Error(code),{code});
const stable=(v:unknown):string=>v===null||typeof v!=="object"?JSON.stringify(v)??"null":
 Array.isArray(v)?"["+v.map(stable).join(",")+"]":
 "{"+Object.keys(v).sort().filter(k=>(v as Record<string,unknown>)[k]!==undefined).map(k=>JSON.stringify(k)+":"+stable((v as Record<string,unknown>)[k])).join(",")+"}";
const digest=async(v:string)=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)))].map(x=>x.toString(16).padStart(2,"0")).join("");
const linkedFact=(data:CaseData,fact:Fact,orderDocumentId:string)=>fact.state==="verified"&&fact.recognition==="accepted"&&
 fact.refs.some(ref=>ref.documentId===orderDocumentId&&validSourceRef(data,ref));
export function validateCorrectionItemDraft(data:CaseData,draft:CorrectionItemDraft):{payload:CorrectionItemDraft;orderDocumentSha256:string}{
 if(data.structuredTest||data.referenceTest||data.evaluationClone)throw fail("CORRECTION_SYNTHETIC_CASE_WRITE_FORBIDDEN");
 if(!draft||typeof draft!=="object"||draft.expectedCaseRevision!==data.context.revision)throw fail("CORRECTION_CASE_REVISION_MISMATCH");
 if(typeof draft.courtEventId!=="string"||!draft.courtEventId.trim()||
    !Number.isInteger(draft.itemNo)||draft.itemNo<1||draft.itemNo>500||
    !Number.isSafeInteger(draft.expectedSourceDataVersion)||draft.expectedSourceDataVersion<0||
    typeof draft.orderDocumentId!=="string"||!Number.isInteger(draft.orderPage)||draft.orderPage<1||
    typeof draft.orderQuote!=="string"||draft.orderQuote.trim().length<10||draft.orderQuote.length>4000||
    typeof draft.reason!=="string"||draft.reason.trim().length<5||draft.reason.length>3000||
    (draft.expectedHeadId!==null&&(typeof draft.expectedHeadId!=="string"||!/^correction-[a-f0-9]{64}$/.test(draft.expectedHeadId))))
   throw fail("CORRECTION_ITEM_INPUT_INVALID");
 if(!goodStrings(draft.requiredCanonicalFieldIds,100)||draft.requiredCanonicalFieldIds.some(id=>!knownCanonical.has(id))||
    !goodStrings(draft.unmappedRequiredFieldLabels,40)||!goodStrings(draft.requiredDocumentTypeIds,85)||
    !goodStrings(draft.responseDocumentIds,100))
   throw fail("CORRECTION_ITEM_FIELD_CONTRACT_INVALID");
 if(draft.requiredPeriod!==null&&(typeof draft.requiredPeriod!=="string"||draft.requiredPeriod.length>100))throw fail("CORRECTION_ITEM_PERIOD_INVALID");
 const order=(data.workflowState?.procedureEvents??[]).find(e=>e.id===draft.courtEventId&&e.state==="correction_requested");
 const document=data.documents.find(d=>d.id===draft.orderDocumentId&&d.status==="active");
 if(!order||!order.courtReference?.trim()||!order.sourceDocumentIds.includes(draft.orderDocumentId)||!document||!document.pages.includes(draft.orderPage))
  throw fail("CORRECTION_COURT_ORDER_SOURCE_UNVERIFIED");
 const deadline=draft.deadline;
 if(deadline!==null){
  if(!deadline||typeof deadline.sourceFactId!=="string"||typeof deadline.date!=="string"||!iso(deadline.date))throw fail("CORRECTION_DEADLINE_NOT_SOURCE_BOUND");
  const fact=currentFacts(data).find(f=>f.id===deadline.sourceFactId&&["court.correctionDeadline","corrections.deadline"].includes(f.key)&&
    f.value===deadline.date&&linkedFact(data,f,draft.orderDocumentId));
  if(!fact)throw fail("CORRECTION_DEADLINE_NOT_SOURCE_BOUND");
 }
 if(draft.responseDocumentIds.some(id=>!data.documents.some(d=>d.id===id&&d.status==="active"))||
    draft.receiptDocumentId!==null&&!data.documents.some(d=>d.id===draft.receiptDocumentId&&d.status==="active"))
   throw fail("CORRECTION_RESPONSE_DOCUMENT_UNKNOWN");
 if(draft.responseEventId!==null){
  const reply=data.workflowState?.procedureEvents.find(e=>e.id===draft.responseEventId&&
    ["submitted","received","amended"].includes(e.state)&&e.courtReference===order.courtReference);
  if(!reply||draft.responseDocumentIds.some(id=>!reply.sourceDocumentIds.includes(id))||
      draft.receiptDocumentId!==null&&!reply.sourceDocumentIds.includes(draft.receiptDocumentId))
   throw fail("CORRECTION_RESPONSE_EVENT_UNBOUND");
 }else if(draft.receiptDocumentId!==null||draft.responseDocumentIds.length)
   throw fail("CORRECTION_RESPONSE_EVENT_REQUIRED");
 const payload:CorrectionItemDraft={...draft,
   orderQuote:draft.orderQuote.trim(),reason:draft.reason.trim(),
   requiredCanonicalFieldIds:[...draft.requiredCanonicalFieldIds],
   unmappedRequiredFieldLabels:[...draft.unmappedRequiredFieldLabels],
   requiredDocumentTypeIds:[...draft.requiredDocumentTypeIds],
   responseDocumentIds:[...draft.responseDocumentIds],
   deadline:deadline?{...deadline}:null};
 return {payload,orderDocumentSha256:document.sha256};
}
type Head={versionId:string};
async function currentVersion(database:D1Database,caseId:string){
 return database.prepare("SELECT c.revision AS revision,s.data_version AS dataVersion FROM cases c JOIN case_data_change_state s ON s.case_id=c.id WHERE c.id=?")
  .bind(caseId).first<{revision:number;dataVersion:number}>();
}
export async function upsertCourtCorrectionItem(database:D1Database,input:{data:CaseData;draft:CorrectionItemDraft;actorId:string}){
 if(!input.actorId||input.actorId==="private-site-service")throw fail("CORRECTION_HUMAN_REQUIRED");
 const {data,draft}=input,validated=validateCorrectionItemDraft(data,draft),caseId=data.context.id;
 const current=await currentVersion(database,caseId);
 if(!current||current.revision!==draft.expectedCaseRevision)throw fail("CORRECTION_CASE_REVISION_MISMATCH");
 if(current.dataVersion!==draft.expectedSourceDataVersion)throw fail("CORRECTION_SOURCE_DATA_VERSION_MISMATCH");
 const actualOrder=await database.prepare("SELECT sha256,case_id AS caseId FROM documents WHERE id=?")
   .bind(draft.orderDocumentId).first<{sha256:string;caseId:string}>();
 if(!actualOrder||actualOrder.caseId!==caseId||actualOrder.sha256!==validated.orderDocumentSha256)
   throw fail("CORRECTION_ORDER_STORAGE_HASH_MISMATCH");
 const previous=await database.prepare("SELECT version_id AS versionId FROM case_court_correction_item_heads WHERE case_id=? AND court_event_id=? AND item_no=?")
  .bind(caseId,draft.courtEventId,draft.itemNo).first<Head>();
 const versionId="correction-"+await digest(stable({caseId,sourceVersion:current.dataVersion,revision:current.revision,
   payload:validated.payload,documentSha256:validated.orderDocumentSha256,actorId:input.actorId}));
 if(previous?.versionId===versionId)return {caseId,versionId,unchanged:true,courtOrderSatisfied:false};
 if((previous?.versionId??null)!==draft.expectedHeadId)throw fail("CORRECTION_ITEM_CONCURRENT_CHANGE");
 const at=new Date().toISOString();
 const guard=" EXISTS (SELECT 1 FROM cases c JOIN case_data_change_state s ON s.case_id=c.id WHERE c.id=? AND c.revision=? AND s.data_version=?)";
 const whereHead=previous?" AND EXISTS (SELECT 1 FROM case_court_correction_item_heads h WHERE h.case_id=? AND h.court_event_id=? AND h.item_no=? AND h.version_id=?)":
  " AND NOT EXISTS (SELECT 1 FROM case_court_correction_item_heads h WHERE h.case_id=? AND h.court_event_id=? AND h.item_no=?)";
 const where=guard+whereHead;
 const binds=[caseId,current.revision,current.dataVersion,caseId,draft.courtEventId,draft.itemNo,...(previous?[draft.expectedHeadId]:[])];
 const record=database.prepare(
  "INSERT OR IGNORE INTO case_court_correction_item_versions(id,case_id,court_event_id,item_no,case_revision,source_data_version,order_document_id,order_document_sha256,payload_json,actor_id,reason,created_at) "+
  "SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE"+where)
  .bind(versionId,caseId,draft.courtEventId,draft.itemNo,current.revision,current.dataVersion,
   draft.orderDocumentId,validated.orderDocumentSha256,JSON.stringify(validated.payload),input.actorId,draft.reason,at,...binds);
 const head=previous?
  database.prepare("UPDATE case_court_correction_item_heads SET version_id=?,source_case_revision=?,source_data_version=?,updated_at=? "+
   "WHERE case_id=? AND court_event_id=? AND item_no=? AND version_id=? AND"+guard)
   .bind(versionId,current.revision,current.dataVersion,at,caseId,draft.courtEventId,draft.itemNo,draft.expectedHeadId,
     caseId,current.revision,current.dataVersion):
  database.prepare("INSERT OR IGNORE INTO case_court_correction_item_heads(case_id,court_event_id,item_no,version_id,source_case_revision,source_data_version,updated_at) "+
   "SELECT ?,?,?,?,?,?,? WHERE"+guard)
   .bind(caseId,draft.courtEventId,draft.itemNo,versionId,current.revision,current.dataVersion,at,
     caseId,current.revision,current.dataVersion);
 const receipts=await database.batch([record,head]);
 if(!receipts[1]?.meta?.changes)throw fail("CORRECTION_ITEM_CONCURRENT_CHANGE");
 return {caseId,versionId,unchanged:false,courtOrderSatisfied:false};
}
export async function readCourtCorrectionItems(database:D1Database,data:CaseData){
 const current=await currentVersion(database,data.context.id);
 if(!current||current.revision!==data.context.revision)throw fail("CORRECTION_CASE_REVISION_MISMATCH");
 const rows=(await database.prepare(
  "SELECT h.court_event_id AS courtEventId,h.item_no AS itemNo,h.version_id AS versionId,"+
  "h.source_case_revision AS sourceCaseRevision,h.source_data_version AS sourceDataVersion,"+
  "v.order_document_id AS orderDocumentId,v.order_document_sha256 AS orderDocumentSha256,v.payload_json AS payloadJson,"+
  "v.actor_id AS actorId,v.created_at AS createdAt "+
  "FROM case_court_correction_item_heads h JOIN case_court_correction_item_versions v ON v.id=h.version_id "+
  "WHERE h.case_id=? ORDER BY h.court_event_id,h.item_no LIMIT 1001")
   .bind(data.context.id).all<{courtEventId:string;itemNo:number;versionId:string;sourceCaseRevision:number;sourceDataVersion:number;
    orderDocumentId:string;orderDocumentSha256:string;payloadJson:string;actorId:string;createdAt:string}>()).results??[];
 if(rows.length>1000)throw fail("CORRECTION_ITEM_LIST_TRUNCATED");
 const after=await currentVersion(database,data.context.id);
 if(!after||after.revision!==current.revision||after.dataVersion!==current.dataVersion)throw fail("CORRECTION_CASE_REVISION_MISMATCH");
 const items=rows.map(row=>{
  const doc=data.documents.find(d=>d.id===row.orderDocumentId&&d.status==="active");
  const event=data.workflowState?.procedureEvents.find(e=>e.id===row.courtEventId&&e.state==="correction_requested");
  let payload:CorrectionItemDraft|null=null;
  try{payload=JSON.parse(row.payloadJson) as CorrectionItemDraft;}catch{/* stored record is invalid */}
  const liveFacts=currentFacts(data);
  const dateStillSupported=!payload?.deadline||liveFacts.some(f=>f.id===payload.deadline?.sourceFactId&&
     f.value===payload.deadline?.date&&["court.correctionDeadline","corrections.deadline"].includes(f.key)&&
     linkedFact(data,f,row.orderDocumentId));
  const relatedResponse=payload?.responseEventId===null?
      !payload?.responseDocumentIds.length&&payload?.receiptDocumentId===null:
      (data.workflowState?.procedureEvents??[]).some(e=>e.id===payload?.responseEventId&&
       ["submitted","received","amended"].includes(e.state)&&e.courtReference===event?.courtReference&&
       (payload?.responseDocumentIds??[]).every(id=>e.sourceDocumentIds.includes(id)&&
         data.documents.some(d=>d.id===id&&d.status==="active"))&&
       (!payload?.receiptDocumentId||(e.sourceDocumentIds.includes(payload.receiptDocumentId)&&
         data.documents.some(d=>d.id===payload.receiptDocumentId&&d.status==="active"))));
  const currentSource=!!doc&&doc.sha256===row.orderDocumentSha256&&!!event&&
   event.sourceDocumentIds.includes(row.orderDocumentId)&&
   row.sourceCaseRevision===current.revision&&row.sourceDataVersion===current.dataVersion&&
   !!payload&&payload.courtEventId===row.courtEventId&&payload.itemNo===row.itemNo&&
   dateStillSupported&&relatedResponse;
  return {courtEventId:row.courtEventId,itemNo:row.itemNo,versionId:row.versionId,
   sourceCurrent:currentSource,draft:currentSource?payload:null,
   status:currentSource?"itemized_needs_lawyer_and_court_receipt_review":"stale_source_or_invalid_item",
   courtOrderSatisfied:false as const};
 });
 const actualOrderEvents=(data.workflowState?.procedureEvents??[]).filter(e=>e.state==="correction_requested");
 const listedOrders=new Set(items.map(item=>item.courtEventId));
 const orderEventsWithoutItems=actualOrderEvents.filter(e=>!listedOrders.has(e.id)).map(e=>e.id);
 const staleItemIds=items.filter(item=>!item.sourceCurrent).map(item=>item.versionId);
 return {schemaVersion:PREAPPROVAL_CORRECTION_ITEM_STORE_VERSION,caseId:data.context.id,
  caseRevision:current.revision,sourceDataVersion:current.dataVersion,
  actualOrderCount:actualOrderEvents.length,
  unitemizedCourtEventIds:orderEventsWithoutItems,staleItemVersionIds:staleItemIds,
  unresolvedCourtItemCount:items.length+orderEventsWithoutItems.length,
  count:items.length,items,courtApprovalInferred:false as const,
  note:"Human-itemized order fields are evidence routing only. A submitted document or receipt does not establish the court's acceptance or legal compliance."};
}
