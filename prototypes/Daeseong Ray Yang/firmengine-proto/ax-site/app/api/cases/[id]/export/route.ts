import { assessCase } from "../../../../../lib/assessment";
import { newExportManifest } from "../../../../../lib/exports";
import { writeOfficePackage } from "../../../../../lib/office-writer";
import { CURRENT_RULESET } from "../../../../../lib/legal-rules";
import { bucket,db,errorResponse,event,getCase,getProcessingReadiness,HttpError,jsonBody,now,requireSameOrigin,saveCase } from "../../../../../lib/server-store";
import { caseResponse } from "../../../../../lib/case-response";
import { jsonResponse } from "../../../../../lib/json-response";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
  requireSameOrigin(request);const {id}=await params,body=await jsonBody(request),data=await getCase(id),assessment=assessCase(data,CURRENT_RULESET);
  const mode=body.mode==="final"?"final":"draft";
  if(mode==="final"&&!(await getProcessingReadiness(data)).complete)throw new HttpError(409,"업로드·분류·추출·독립 대조가 완료되지 않은 증빙 페이지가 있어 제출본 확정을 보류합니다.");
  if(mode==="final"&&!assessment.generationGate.canFinalize)throw new HttpError(409,"미확정·누락 항목이 있어 제출본 확정이 보류됩니다. 검토용 초안을 만들 수 있습니다.");
  if(!assessment.generationGate.canGenerateDraft)throw new HttpError(409,"최소 한 개 이상의 원문 근거가 있는 사실이 필요합니다.");
  // Content hashes identify bytes; storage IDs identify this case's export run.
  // Repeated exports and identical files in another case must remain independent.
  // Project only receipt metadata from D1. page_jobs.result can contain a full
  // page read plus prior checkpoints; loading and parsing it here duplicated
  // large OCR payloads during an already memory-intensive export.
  const receiptRows=await db().prepare("SELECT document_id,page,role,status,stage,CASE WHEN json_valid(result) THEN CASE WHEN json_type(result,'$.read.records')='array' AND json_type(result,'$.read.documentType')='text' THEN 1 ELSE 0 END ELSE 0 END AS has_stored_read FROM page_jobs WHERE case_id = ?").bind(id).all<{document_id:string;page:number;role:string;status:string;stage:string;has_stored_read:number}>();
  const pageReceipts=receiptRows.results.map(row=>({documentId:row.document_id,page:row.page,role:row.role,status:row.status,stage:row.stage,hasStoredRead:row.has_stored_read===1}));
  const generated=(await writeOfficePackage({data,rules:CURRENT_RULESET,mode,pageReceipts})).map(file=>({...file,id:crypto.randomUUID()}));
  const records=[];
  for(const f of generated){
    const key=`cases/${id}/artifacts/${f.id}`;await bucket().put(key,f.bytes,{httpMetadata:{contentType:f.mime}});
    records.push(db().prepare("INSERT INTO artifacts (id,case_id,revision,name,kind,object_key,hash,mime,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(f.id,id,data.context.revision,f.name,f.kind,key,f.hash,f.mime,now()));
  }
  await db().batch(records);
  data.exportManifest=newExportManifest(data.context.revision,generated.map(f=>({id:f.id,kind:f.kind,name:f.name,hash:f.hash,status:"current"})),data,mode);
  await saveCase(data,data.context.revision,data);await event(id,"export.generated",{revision:data.context.revision,mode,files:generated.map(f=>({id:f.id,hash:f.hash,kind:f.kind}))});
  return jsonResponse(await caseResponse(data),request,{headers:{"Cache-Control":"no-store"}});
}catch(e){return errorResponse(e);}}
