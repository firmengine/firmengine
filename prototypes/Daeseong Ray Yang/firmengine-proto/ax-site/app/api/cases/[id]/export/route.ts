import { requiredKindsForCase } from "../../../../../lib/domain";
import { newExportManifest } from "../../../../../lib/exports";
import { writeOfficePackage } from "../../../../../lib/office-writer";
import { CURRENT_RULESET } from "../../../../../lib/legal-rules";
import { bucket,db,errorResponse,event,getCase,HttpError,jsonBody,now,requireSameOrigin,saveCase,caseExtras } from "../../../../../lib/server-store";
import { caseResponse } from "../../../../../lib/case-response";
import { jsonResponse } from "../../../../../lib/json-response";
import { finalizeDocumentWriterReceipt, prepareDocumentWrite } from "../../../../../lib/document-writer";
import { loadReferenceSnapshot } from "../../../../../lib/reference-context.ts";
import { commitExportArtifactTransaction } from "../../../../../lib/export-artifact-transaction.ts";
import { buildCaseWorkflowView } from "../../../../../lib/case-workflow-view.ts";
import { finalWorkflowBlockers } from "../../../../../lib/document-workflow-gate.ts";
import { getIntakeCatalog } from "../../../../../lib/intake-store.ts";
import { buildFeatureLineageAudit,evaluateCaseFieldLineage } from "../../../../../lib/feature-lineage-audit.ts";
import { commandHash } from "../../../../../lib/case-command-contract.ts";
import { legalReviewInputFingerprint,currentLegalDispositionOutcome } from "../../../../../lib/legal-review-identity.ts";
import { snapshotSha256 } from "../../../../../lib/calculator-tools.ts";
import { EXECUTION_CONTRACT_VERSION } from "../../../../../lib/execution-catalog.ts";
import { buildDocumentFieldBases } from "../../../../../lib/document-field-bases.ts";
import { inspectCurrentFinalLawgraph } from "../../../../../lib/final-lawgraph-readiness.ts";
async function currentLegalDispositionStates(data:Awaited<ReturnType<typeof getCase>>,extras:Awaited<ReturnType<typeof caseExtras>>){
  if(!data.workflowState?.legalDispositions?.length)return [];
  const referenceHash=extras.referenceSnapshot?.sha256;if(!referenceHash)return [];
  const semanticHash=await legalReviewInputFingerprint(data,referenceHash,EXECUTION_CONTRACT_VERSION),storageHash=await snapshotSha256(data);
  // Query by semantic fingerprint so a workflow-only update (including this
  // very disposition) cannot hide the analysis that the reviewer acted on.
  const sourceVersion=await db().prepare("SELECT data_version AS version FROM case_data_change_state WHERE case_id=?")
    .bind(data.context.id).first<{version:number}>();
  const candidates=await db().prepare(`SELECT id,type,at,payload FROM analyses WHERE case_id=? AND type IN ('legal_review','legal_advisory') AND json_valid(payload)=1 AND (json_extract(payload,'$.reviewInputFingerprint')=? OR (json_extract(payload,'$.reviewInputFingerprint') IS NULL AND json_extract(payload,'$.calculatorExecution.inputSha256')=? AND json_extract(payload,'$.calculatorExecution.referenceRelease.sha256')=? AND json_extract(payload,'$.calculatorExecution.contractVersion')=?)) ORDER BY at DESC,id DESC LIMIT 501`).bind(data.context.id,semanticHash,storageHash,referenceHash,EXECUTION_CONTRACT_VERSION).all<{id:string;type:string;at:string;payload:string}>();
  const runs:{id:string;checkId:string;subjectFingerprint:string;dependencyFingerprint:string;status:string}[]=[];
  for(const row of candidates.results.slice(0,500)){
    const payload=JSON.parse(row.payload),receipt=payload.calculatorExecution;
    if(payload.sourceDataVersion!==sourceVersion?.version)continue;
    if(receipt?.referenceRelease?.sha256!==referenceHash||receipt?.contractVersion!==EXECUTION_CONTRACT_VERSION)continue;
    for(const check of Array.isArray(payload.checks)?payload.checks:[]){
      if(typeof check?.id!=="string"||!Array.isArray(check.factIds))continue;
      runs.push({id:row.id,checkId:check.id,subjectFingerprint:await commandHash({checkId:check.id,factIds:check.factIds}),dependencyFingerprint:await commandHash({input:semanticHash,reference:referenceHash,contract:EXECUTION_CONTRACT_VERSION,checkId:check.id}),status:String(check.status??"unknown")});
    }
  }
  const latestByCheck=new Map<string,NonNullable<typeof data.workflowState>['legalDispositions'][number]>();
  for(const disposition of data.workflowState?.legalDispositions??[])latestByCheck.set(disposition.checkId,disposition);
  const result:{checkId:string;state:string;disposition:string|null}[]=[];
  for(const disposition of latestByCheck.values()){
    // A saved rejection remains a blocker; accepted receipts require the exact current run.
    const outcome=currentLegalDispositionOutcome(disposition,runs);
    result.push({checkId:disposition.checkId,state:"current",disposition:outcome});
  }
  if(candidates.results.length>500)result.push({checkId:"legal-review-coverage",state:"current",disposition:"needs_review"});
  return result;
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
  requireSameOrigin(request);const {id}=await params,body=await jsonBody(request),data=await getCase(id),extras=await caseExtras(data);
  const mode=body.mode==="final"?"final":"draft";
  if(mode==="final"&&data.workflowState){
    const workflowView=await buildCaseWorkflowView(data);
    const activeRequirementIds=new Set(data.workflowState.requirements.filter(requirement=>!requirement.retired).map(requirement=>requirement.requirementId));
    const legalChecks=await currentLegalDispositionStates(data,extras);
    // Final review copies must not pass when a staff-approved case requirement
    // names canonical evidence that is absent, unverified, conflicted or missing its period.
    // Drafts remain available and unrelated catalog fields are never deemed mandatory.
    const intakeCatalog=await getIntakeCatalog();
    const inventory=buildFeatureLineageAudit(intakeCatalog.catalog,intakeCatalog.sha256,{limit:1000});
    const currentFieldAudit=evaluateCaseFieldLineage(data,inventory.fields,{limit:1000});
    const featureGaps=currentFieldAudit.fields.flatMap(field=>field.blockerCandidates.map(code=>({canonicalFieldId:field.canonicalFieldId,code})));
    const blockers=finalWorkflowBlockers({workflowAdopted:true,projectionBlockers:data.workflowState.projectionBlockers,
      requirements:workflowView.requirementStates.filter(requirement=>activeRequirementIds.has(requirement.requirementId)),
      legalChecks,featureGaps});
    if(blockers.length)throw new HttpError(422,"필수 증빙 처리, 투영 연결 또는 담당자 검토가 끝나야 최종 문서를 작성할 수 있습니다.");
    // New adopted workflows require a current persisted LawGraph review and
    // current human decisions; historical advisory batches alone cannot clear final.
    if(data.workflowState.requirements.length){
      const legal=await inspectCurrentFinalLawgraph(db(),{caseId:id,caseRevision:data.context.revision,
        referenceSha256:extras.referenceSnapshot?.sha256??"",humanDispositions:legalChecks});
      if(!legal.readyForFinalReviewCopy)throw new HttpError(422,"현재 법률 검토 95개 항목 또는 법률 담당자 승인 조건을 충족하지 못했습니다: "+legal.blockers.slice(0,6).join(", "));
    }
  }
  let prepared;
  try{prepared=await prepareDocumentWrite({data,evaluation:extras.derivedEvaluation,processingComplete:extras.processingReadiness.complete,mode,requiredKinds:requiredKindsForCase(data),now:now()});}
  catch(error){const code=error instanceof Error?error.message:"DOCUMENT_WRITER_BLOCKED";const messages:Record<string,string>={SYNTHETIC_FINAL_PROHIBITED:"합성 시험자료로 제출본을 확정할 수 없습니다.",DOCUMENT_FINAL_REVIEW_REQUIRED:"전체 증빙 처리와 필수 법률·계산 검토가 완료되어야 제출본을 확정할 수 있습니다.",DOCUMENT_DRAFT_GATE_BLOCKED:"검토용 문서를 작성할 수 있는 근거가 없습니다.",DOCUMENT_EVALUATION_PENDING:"계산·서식 기재값을 준비 중입니다. 잠시 후 다시 시도하세요.",DOCUMENT_EVALUATION_STALE:"사건 버전 계산 결과가 오래되었습니다. 새로고침 후 다시 시도하세요.",DOCUMENT_EVALUATION_INPUT_MISMATCH:"저장된 계산 결과가 현재 사건 입력과 달라 문서 작성을 보류했습니다.",DOCUMENT_BINDINGS_MISSING:"저장된 문서 기재값이 준비되지 않았습니다.",DOCUMENT_EDIT_SOURCE_COMMAND_REQUIRED:"금액·사실·판단 수정은 문서 편집으로 저장할 수 없습니다. 해당 원천 입력 명령으로 수정한 뒤 재계산하세요.",DOCUMENT_EDIT_FIELD_NOT_OVERLAYABLE:"이 문서 필드는 prose 또는 layout 편집 overlay로 지원되지 않습니다.",DOCUMENT_FORM_CONTRACT_MISSING:"문서 서식 계약이 등록되지 않아 작성할 수 없습니다."};
    if(code.startsWith("DOCUMENT_PREFLIGHT_BLOCKED:"))throw new HttpError(422,"필수 문서 항목이나 반복 행 합계를 확인해야 최종 검토본을 만들 수 있습니다.");
    if(code.startsWith("DOCUMENT_EDIT_CONFLICT:"))throw new HttpError(409,"문서 편집과 새 계산 결과가 충돌했습니다. 표시된 문장을 검토해 다시 편집하세요.");
    if(code.startsWith("DOCUMENT_EDIT_ORPHAN:"))throw new HttpError(409,"편집 대상 반복 행이 현재 문서에 없어 검토가 필요합니다.");
    throw new HttpError(409,messages[code]??"현재 사건 검토 상태로 문서를 작성할 수 없습니다.");}
  // Content hashes identify bytes; storage IDs identify this case's export run.
  // Repeated exports and identical files in another case must remain independent.
  // Project only receipt metadata from D1. page_jobs.result can contain a full
  // page read plus prior checkpoints; loading and parsing it here duplicated
  // large OCR payloads during an already memory-intensive export.
  const receiptRows=await db().prepare("SELECT document_id,page,role,status,stage,CASE WHEN json_valid(result) THEN CASE WHEN json_type(result,'$.read.records')='array' AND json_type(result,'$.read.documentType')='text' THEN 1 ELSE 0 END ELSE 0 END AS has_stored_read FROM page_jobs WHERE case_id = ?").bind(id).all<{document_id:string;page:number;role:string;status:string;stage:string;has_stored_read:number}>();
  const pageReceipts=receiptRows.results.map(row=>({documentId:row.document_id,page:row.page,role:row.role,status:row.status,stage:row.stage,hasStoredRead:row.has_stored_read===1}));
  const generated=(await writeOfficePackage({data,rules:CURRENT_RULESET,mode,pageReceipts,preparedExecution:prepared.execution,writerReceipt:prepared.receipt})).map(file=>({...file,id:crypto.randomUUID()}));
  const writerReceipt=await finalizeDocumentWriterReceipt(prepared.receipt,generated);
  writerReceipt.fieldBases=await buildDocumentFieldBases({data,execution:prepared.execution,formResults:writerReceipt.formResults,artifacts:generated});
  if((await loadReferenceSnapshot(db())).sha256!==prepared.receipt.referenceRelease?.sha256)throw new HttpError(409,"문서 작성 중 적용 기준이 변경되었습니다. 최신 계산과 검토 상태를 확인하세요.");
  const staged=generated.map(file=>{
    const objectKey=`cases/${id}/artifacts/${file.id}`;
    return {objectKey,bytes:file.bytes,mime:file.mime,record:{id:file.id,name:file.name,kind:file.kind,hash:file.hash,mime:file.mime,objectKey}};
  });
  await commitExportArtifactTransaction({
    artifacts:staged,
    upload:(key,bytes,mime)=>bucket().put(key,bytes,{httpMetadata:{contentType:mime}}),
    persistRecords:records=>db().batch(records.map(f=>db().prepare("INSERT INTO artifacts (id,case_id,revision,name,kind,object_key,hash,mime,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(f.id,id,data.context.revision,f.name,f.kind,f.objectKey,f.hash,f.mime,now()))),
    commitManifest:async()=>{
      // Uploads can outlast a reference update; check again at the save boundary.
      if((await loadReferenceSnapshot(db())).sha256!==prepared.receipt.referenceRelease?.sha256)throw new HttpError(409,"문서 저장 중 적용 기준이 변경되었습니다. 최신 계산과 검토 상태를 확인하세요.");
      data.exportManifest={...newExportManifest(data.context.revision,generated.map(f=>({id:f.id,kind:f.kind,name:f.name,hash:f.hash,status:"current"})),data,mode),documentWriter:writerReceipt} as typeof data.exportManifest;
      await saveCase(data,data.context.revision,data);
    },
    deleteRecords:records=>db().batch(records.map(f=>db().prepare("DELETE FROM artifacts WHERE id = ? AND case_id = ? AND object_key = ?").bind(f.id,id,f.objectKey))),
    deleteObject:key=>bucket().delete(key),
    onCleanupFailure:report=>event(id,"export.cleanup_failed",{artifactIds:report.records.map(record=>record.id),objectKeys:report.objectKeys,failureCount:report.cleanupErrors.length}),
  });
  await event(id,"document_writer.prepared",writerReceipt);await event(id,"export.generated",{revision:data.context.revision,mode,files:generated.map(f=>({id:f.id,hash:f.hash,kind:f.kind})),writerReceipt});
  return jsonResponse(await caseResponse(data),request,{headers:{"Cache-Control":"no-store"}});
}catch(e){return errorResponse(e);}}
