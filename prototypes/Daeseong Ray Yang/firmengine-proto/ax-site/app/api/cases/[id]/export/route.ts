import { requiredKindsForCase } from "../../../../../lib/domain";
import { newExportManifest } from "../../../../../lib/exports";
import { writeOfficePackage } from "../../../../../lib/office-writer";
import { CURRENT_RULESET } from "../../../../../lib/legal-rules";
import { bucket,db,errorResponse,event,getCase,HttpError,jsonBody,now,requireSameOrigin,saveCase,caseExtras } from "../../../../../lib/server-store";
import { caseResponse } from "../../../../../lib/case-response";
import { jsonResponse } from "../../../../../lib/json-response";
import { prepareDocumentWrite } from "../../../../../lib/document-writer";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
  requireSameOrigin(request);const {id}=await params,body=await jsonBody(request),data=await getCase(id),extras=await caseExtras(data);
  const mode=body.mode==="final"?"final":"draft";
  let prepared;
  try{prepared=await prepareDocumentWrite({data,evaluation:extras.derivedEvaluation,processingComplete:extras.processingReadiness.complete,mode,requiredKinds:requiredKindsForCase(data),now:now()});}
  catch(error){const code=error instanceof Error?error.message:"DOCUMENT_WRITER_BLOCKED";const messages:Record<string,string>={SYNTHETIC_FINAL_PROHIBITED:"합성 시험자료로 제출본을 확정할 수 없습니다.",DOCUMENT_FINAL_REVIEW_REQUIRED:"전체 증빙 처리와 필수 법률·계산 검토가 완료되어야 제출본을 확정할 수 있습니다.",DOCUMENT_DRAFT_GATE_BLOCKED:"검토용 문서를 작성할 수 있는 근거가 없습니다.",DOCUMENT_EVALUATION_PENDING:"계산·서식 기재값을 준비 중입니다. 잠시 후 다시 시도하세요.",DOCUMENT_EVALUATION_STALE:"사건 버전 계산 결과가 오래되었습니다. 새로고침 후 다시 시도하세요.",DOCUMENT_EVALUATION_INPUT_MISMATCH:"저장된 계산 결과가 현재 사건 입력과 달라 문서 작성을 보류했습니다.",DOCUMENT_BINDINGS_MISSING:"저장된 문서 기재값이 준비되지 않았습니다."};throw new HttpError(409,messages[code]??"현재 사건 검토 상태로 문서를 작성할 수 없습니다.");}
  // Content hashes identify bytes; storage IDs identify this case's export run.
  // Repeated exports and identical files in another case must remain independent.
  // Project only receipt metadata from D1. page_jobs.result can contain a full
  // page read plus prior checkpoints; loading and parsing it here duplicated
  // large OCR payloads during an already memory-intensive export.
  const receiptRows=await db().prepare("SELECT document_id,page,role,status,stage,CASE WHEN json_valid(result) THEN CASE WHEN json_type(result,'$.read.records')='array' AND json_type(result,'$.read.documentType')='text' THEN 1 ELSE 0 END ELSE 0 END AS has_stored_read FROM page_jobs WHERE case_id = ?").bind(id).all<{document_id:string;page:number;role:string;status:string;stage:string;has_stored_read:number}>();
  const pageReceipts=receiptRows.results.map(row=>({documentId:row.document_id,page:row.page,role:row.role,status:row.status,stage:row.stage,hasStoredRead:row.has_stored_read===1}));
  const generated=(await writeOfficePackage({data,rules:CURRENT_RULESET,mode,pageReceipts,preparedExecution:prepared.execution})).map(file=>({...file,id:crypto.randomUUID()}));
  const records=[];
  for(const f of generated){
    const key=`cases/${id}/artifacts/${f.id}`;await bucket().put(key,f.bytes,{httpMetadata:{contentType:f.mime}});
    records.push(db().prepare("INSERT INTO artifacts (id,case_id,revision,name,kind,object_key,hash,mime,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(f.id,id,data.context.revision,f.name,f.kind,key,f.hash,f.mime,now()));
  }
  await db().batch(records);
  data.exportManifest=newExportManifest(data.context.revision,generated.map(f=>({id:f.id,kind:f.kind,name:f.name,hash:f.hash,status:"current"})),data,mode);
  await saveCase(data,data.context.revision,data);await event(id,"document_writer.prepared",prepared.receipt);await event(id,"export.generated",{revision:data.context.revision,mode,files:generated.map(f=>({id:f.id,hash:f.hash,kind:f.kind})),writerReceipt:prepared.receipt});
  return jsonResponse(await caseResponse(data),request,{headers:{"Cache-Control":"no-store"}});
}catch(e){return errorResponse(e);}}
