/** Human-initiated import of an existing source-verified automatic REVIEW
 * draft into the established editable exportManifest. This does not finalize,
 * approve, submit, or modify the case's source data / LawGraph version.
 */
import {bucket,db,errorResponse,getCase,HttpError,jsonBody,requireHumanActor,requireSameOrigin,saveCase,sha256} from "../../../../../../lib/server-store.ts";
import {rolesForActor} from "../../../../../../lib/app-roles.ts";
import {loadReferenceSnapshot} from "../../../../../../lib/reference-context.ts";
import {newExportManifest} from "../../../../../../lib/exports.ts";
import {validateAutoDraftHandoff,type AutoDraftHandoffRow,type AutoDraftReceiptEnvelope,type AutoDraftStorageArtifact,type AutoDraftArtifact} from "../../../../../../lib/automatic-draft-review-handoff.ts";
import type {ExportManifest} from "../../../../../../lib/domain.ts";

const validId=(value:unknown)=>typeof value==="string"&&value.length>0&&value.length<=250&&/^[A-Za-z0-9_:\-.]+$/.test(value);
export const runtime="edge";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  requireSameOrigin(request);
  const user=await requireHumanActor(),{id:caseId}=await params;
  const roles=await rolesForActor(user,caseId);
  if(!roles.includes("case_editor")||!roles.includes("caseworker_review"))
    throw new HttpError(403,"사건 담당 및 서류 검토 권한이 필요합니다.");
  const body=await jsonBody(request);
  if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1||
     !Number.isSafeInteger(body.expectedDataVersion)||body.expectedDataVersion<1||
     !validId(body.documentRunId)||!validId(body.legalReviewRunId))
    throw new HttpError(400,"검토 대상 자동초안의 사건·원천·법률검토 판본을 지정하세요.");
  const database=db();
  const [data,run,heads,receiptRow,snapshot]=await Promise.all([
   getCase(caseId),
   database.prepare("SELECT id,case_id AS caseId,legal_review_run_id AS legalReviewRunId,data_version AS dataVersion,case_revision AS caseRevision,status,artifacts_json AS artifactsJson FROM case_automatic_document_runs WHERE case_id=? AND id=?")
    .bind(caseId,body.documentRunId).first<AutoDraftHandoffRow>(),
   database.prepare("SELECT s.data_version AS dataVersion,c.revision AS caseRevision,lh.review_run_id AS legalReviewRunId,ch.run_id AS calculationRunId,cr.reference_sha256 AS calculationReferenceSha256,j.status AS jobStatus FROM cases c JOIN case_data_change_state s ON s.case_id=c.id JOIN case_legal_review_heads lh ON lh.case_id=c.id JOIN case_calculation_heads ch ON ch.case_id=c.id JOIN case_calculation_runs cr ON cr.id=ch.run_id LEFT JOIN case_legal_automation_jobs j ON j.case_id=c.id AND j.legal_review_run_id=lh.review_run_id WHERE c.id=?")
    .bind(caseId).first<{dataVersion:number;caseRevision:number;legalReviewRunId:string;calculationRunId:string;calculationReferenceSha256:string;jobStatus:string|null}>(),
   database.prepare("SELECT payload FROM analyses WHERE id=? AND case_id=? AND type='automatic_draft_writer_receipt'")
    .bind("auto-draft-receipt:"+String(body.documentRunId),caseId).first<{payload:string}>(),
   loadReferenceSnapshot(database)
  ]);
  if(!run||!heads||!receiptRow||
     data.context.revision!==body.expectedRevision||heads.caseRevision!==body.expectedRevision||
     heads.dataVersion!==body.expectedDataVersion||run.legalReviewRunId!==body.legalReviewRunId||
     heads.legalReviewRunId!==body.legalReviewRunId||
     heads.jobStatus!=="draft_ready"||heads.calculationReferenceSha256!==snapshot.sha256)
    throw new HttpError(409,"현재 사건·원천·계산·법률 판단에 맞는 자동초안이 아닙니다. 최신 검토 상태를 확인하세요.");
  let receipt:AutoDraftReceiptEnvelope;
  try{receipt=JSON.parse(receiptRow.payload) as AutoDraftReceiptEnvelope;}
  catch{throw new HttpError(409,"자동초안 검토 원장의 무결성을 확인할 수 없습니다.");}
  let files:AutoDraftArtifact[];
  try{files=JSON.parse(run.artifactsJson) as AutoDraftArtifact[];}
  catch{throw new HttpError(409,"생성 파일 목록을 확인할 수 없습니다.");}
  if(!Array.isArray(files)||!files.length||files.length>64||files.some(f=>!f||!validId(f.id)))
    throw new HttpError(409,"생성 파일 식별자가 유효하지 않습니다.");
  const clause=files.map(()=>"?").join(",");
  const stored=(await database.prepare(`SELECT id,case_id AS caseId,revision,name,kind,object_key AS objectKey,hash,mime FROM artifacts WHERE case_id=? AND id IN (${clause})`)
   .bind(caseId,...files.map(f=>f.id)).all<AutoDraftStorageArtifact>()).results??[];
  const active=data.exportManifest?.files.filter(f=>f.status==="current")??[];
  // An already adopted draft changes exportManifest (not evidence). The original
  // writer receipt still identifies the source snapshot that was admitted.
  // Accept only exactly the same original IDs/hashes and receipt identity.
  const sameActive=data.exportManifest?.mode==="draft"&&active.length>0&&
    active.length===files.length&&active.every(f=>files.some(a=>
      a.id===f.id&&a.kind===f.kind&&a.hash===f.hash))&&
    data.exportManifest?.documentWriter?.inputSha256===receipt.writerReceipt?.inputSha256&&
    data.exportManifest?.documentWriter?.mode==="draft";
  const sourceHash=sameActive?receipt.writerReceipt.inputSha256:
    await sha256(new TextEncoder().encode(JSON.stringify(data)));
  let validated:ReturnType<typeof validateAutoDraftHandoff>;
  try{validated=validateAutoDraftHandoff({run,receipt,stored,current:{
     caseId,caseRevision:data.context.revision,dataVersion:heads.dataVersion,
     calculationRunId:heads.calculationRunId,legalReviewRunId:heads.legalReviewRunId,
     referenceSha256:snapshot.sha256,caseInputSha256:sourceHash
  }});}catch(error){
   throw new HttpError(409,error instanceof Error?error.message:"AUTO_DRAFT_REVIEW_INTEGRITY_FAILED");
  }
  // HEAD checks precede both the initial and idempotent adoption path. The
  // worker's originally generated R2 bytes are never duplicated or replaced.
  for(const file of validated.artifacts)if(!await bucket().head(file.objectKey))
    throw new HttpError(409,"자동 생성 파일의 원본 저장소 내용이 누락되었습니다.");
  if(active.length){
   if(sameActive)return Response.json({adopted:true,alreadyAdopted:true,mode:"draft",
       courtApprovalInferred:false,canFinalize:false,readyForElectronicFiling:false,
       documentRunId:run.id,files:validated.artifacts.map(a=>({id:a.id,kind:a.kind,hash:a.hash}))},
       {headers:{"Cache-Control":"no-store"});
   throw new HttpError(409,"기존 검토 중인 생성물이 있습니다. 현재 문서를 처리한 뒤 새 검토본을 가져오세요.");
  }
  const latestRoles=await rolesForActor(user,caseId);
  if(!latestRoles.includes("case_editor")||!latestRoles.includes("caseworker_review"))
    throw new HttpError(403,"검토 권한이 변경되어 작업을 중단했습니다.");
  // Another staff member could approve a new reference while storage is read.
  if((await loadReferenceSnapshot(database)).sha256!==snapshot.sha256)
    throw new HttpError(409,"자동초안 연결 중 기준정보 판본이 변경되었습니다.");
  const next=structuredClone(data);
  const manifestFiles=validated.artifacts.map(file=>({
    id:file.id,name:file.name,kind:file.kind as ExportManifest["files"][number]["kind"],
    hash:file.hash,status:"current" as const
  }));
  next.exportManifest={
    ...newExportManifest(data.context.revision,manifestFiles,next,"draft"),
    documentWriter:validated.writerReceipt
  };
  await saveCase(next,data.context.revision,data,undefined,{mutationCategory:"artifact_only"});
  return Response.json({adopted:true,alreadyAdopted:false,mode:"draft",courtApprovalInferred:false,
    canFinalize:false,readyForElectronicFiling:false,documentRunId:run.id,
    files:manifestFiles.map(f=>({id:f.id,kind:f.kind,hash:f.hash})),
    nextAction:"기존 문서 검수 화면에서 문안·배치를 확인하고 필요한 부분을 수정해 다시 생성하세요."},
    {headers:{"Cache-Control":"no-store"}});
 }catch(error){return errorResponse(error);}
}
