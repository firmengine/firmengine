/** REVIEW DRAFT ONLY. Derived artifacts do not change source case revisions. */
import {requiredKindsForCase} from "./domain.ts";
import {bucket,caseExtras,db,event,getCase,now} from "./server-store.ts";
import {prepareDocumentWrite,finalizeDocumentWriterReceipt} from "./document-writer.ts";
import {buildDocumentFieldBases} from "./document-field-bases.ts";
import {writeOfficePackage} from "./office-writer.ts";
import {CURRENT_RULESET} from "./legal-rules.ts";
import {referenceIdentity} from "./reference-runtime.ts";
import {commitExportArtifactTransaction} from "./export-artifact-transaction.ts";
import type {LegalAutomationServices} from "./case-legal-automation.ts";

type Input=Parameters<LegalAutomationServices["generateDraft"]>[0];
type DraftArtifact={id:string;name:string;kind:string;hash:string;mime:string;objectKey:string};
const fail=(code:string):never=>{throw new Error(code);};
async function assertCurrent(input:Input){
 const record=await db().prepare("SELECT c.revision AS revision,s.data_version AS dataVersion,ch.run_id AS calculationRunId,lh.review_run_id AS reviewRunId,j.lease_token AS leaseToken,j.lease_until AS leaseUntil,j.status AS status FROM cases c JOIN case_data_change_state s ON s.case_id=c.id JOIN case_calculation_heads ch ON ch.case_id=c.id JOIN case_legal_review_heads lh ON lh.case_id=c.id JOIN case_legal_automation_jobs j ON j.id=? AND j.case_id=c.id WHERE c.id=?")
  .bind(input.jobId,input.caseId).first<{revision:number;dataVersion:number;calculationRunId:string;reviewRunId:string;leaseToken:string|null;leaseUntil:string|null;status:string}>();
 if(!record||record.revision!==input.caseRevision||record.dataVersion!==input.dataVersion
  ||record.calculationRunId!==input.calculationRunId||record.reviewRunId!==input.legalReviewRunId
  ||record.leaseToken!==input.leaseToken||record.status!=="running"||!record.leaseUntil||record.leaseUntil<=now())
  fail("LEGAL_AUTOMATION_DRAFT_SOURCE_STALE");
}
export async function generateAutomaticReviewDraft(input:Input){
 const database=db(),runId="auto-draft:"+input.legalReviewRunId;
 await assertCurrent(input);
 const existing=await database.prepare("SELECT status,artifacts_json AS artifactsJson FROM case_automatic_document_runs WHERE legal_review_run_id=? AND case_id=?")
  .bind(input.legalReviewRunId,input.caseId).first<{status:string;artifactsJson:string}>();
 if(existing?.status==="complete"){
  const prior=JSON.parse(existing.artifactsJson) as DraftArtifact[];
  return {documentRunId:runId,artifacts:prior.map(a=>({id:a.id,name:a.name,kind:a.kind}))};
 }
 const data=await getCase(input.caseId);
 if(data.context.revision!==input.caseRevision)fail("LEGAL_AUTOMATION_DRAFT_SOURCE_STALE");
 const extras=await caseExtras(data);
 if(!extras.processingReadiness.complete)fail("DOCUMENT_EVIDENCE_PROCESSING_INCOMPLETE");
 if(!extras.derivedEvaluation||extras.derivedEvaluation.status!=="complete")fail("DOCUMENT_EVALUATION_PENDING");
 const prepared=await prepareDocumentWrite({data,evaluation:extras.derivedEvaluation,
   processingComplete:extras.processingReadiness.complete,mode:"draft",
   requiredKinds:requiredKindsForCase(data),now:now()});
 if(!prepared.execution.assessment.generationGate.canGenerateDraft)fail("DOCUMENT_DRAFT_GATE_BLOCKED");
 const pages=(await database.prepare("SELECT document_id,page,role,status,stage,CASE WHEN json_valid(result) AND json_type(result,'$.read.records')='array' THEN 1 ELSE 0 END AS has_stored_read FROM page_jobs WHERE case_id=?")
  .bind(input.caseId).all<{document_id:string;page:number;role:string;status:string;stage:string;has_stored_read:number}>()).results;
 const receipts=pages.map(p=>({documentId:p.document_id,page:p.page,role:p.role,status:p.status,stage:p.stage,hasStoredRead:p.has_stored_read===1}));
 await assertCurrent(input);
 const generated=(await writeOfficePackage({data,rules:CURRENT_RULESET,mode:"draft",
   pageReceipts:receipts,preparedExecution:prepared.execution,writerReceipt:prepared.receipt}))
  .map(file=>({...file,id:crypto.randomUUID()}));
 if(!generated.length)fail("DOCUMENT_AUTOMATIC_DRAFT_EMPTY");
 const writerReceipt=await finalizeDocumentWriterReceipt(prepared.receipt,generated);
 if(writerReceipt.mode!=="draft"||writerReceipt.courtApprovalInferred!==false)fail("DOCUMENT_DRAFT_MODE_VIOLATION");
 writerReceipt.fieldBases=await buildDocumentFieldBases({
  data,execution:prepared.execution,formResults:writerReceipt.formResults,artifacts:generated
 });
 // Retain the exact generator + editable field bases alongside immutable R2
 // artifact IDs. A human can explicitly adopt the review draft later without
 // recreating a different file or confusing a draft with a final filing.
 const handoff={schemaVersion:"automatic-draft-writer-receipt/1" as const,
  documentRunId:runId,caseId:input.caseId,legalReviewRunId:input.legalReviewRunId,
  dataVersion:input.dataVersion,caseRevision:input.caseRevision,
  calculationRunId:input.calculationRunId,writerReceipt};
 const handoffJson=JSON.stringify(handoff);
 if(new TextEncoder().encode(handoffJson).byteLength>1_800_000)
  fail("DOCUMENT_AUTOMATIC_REVIEW_RECEIPT_TOO_LARGE");
 await assertCurrent(input);
 if(prepared.receipt.referenceRelease?.sha256!==(referenceIdentity()?.sha256??prepared.receipt.referenceRelease?.sha256))
  fail("DOCUMENT_REFERENCE_RELEASE_STALE");
 await database.prepare("INSERT OR IGNORE INTO case_automatic_document_runs(id,case_id,legal_review_run_id,data_version,case_revision,status,artifacts_json,created_at,updated_at) VALUES(?,?,?,?,?,'pending','[]',?,?)")
  .bind(runId,input.caseId,input.legalReviewRunId,input.dataVersion,input.caseRevision,now(),now()).run();
 const payload=generated.map(file=>({
  objectKey:"cases/"+input.caseId+"/artifacts/"+file.id,bytes:file.bytes,mime:file.mime,
  record:{id:file.id,name:file.name,kind:file.kind,hash:file.hash,mime:file.mime,objectKey:"cases/"+input.caseId+"/artifacts/"+file.id}
 }));
 await commitExportArtifactTransaction({
  artifacts:payload,
  upload:(key,bytes,mime)=>bucket().put(key,bytes,{httpMetadata:{contentType:mime}}),
  persistRecords:records=>database.batch(records.map(f=>database.prepare(
   "INSERT INTO artifacts(id,case_id,revision,name,kind,object_key,hash,mime,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
   .bind(f.id,input.caseId,input.caseRevision,f.name,f.kind,f.objectKey,f.hash,f.mime,now()))),
  commitManifest:async(records)=>{
   await assertCurrent(input);
   const committed=await database.batch([
    database.prepare("INSERT INTO analyses(id,case_id,revision,type,payload,at) VALUES(?, ?,?,'automatic_draft_writer_receipt',?,?)")
      .bind("auto-draft-receipt:"+runId,input.caseId,input.caseRevision,handoffJson,now()),
    database.prepare("UPDATE case_automatic_document_runs SET status='complete',artifacts_json=?,reason=NULL,updated_at=? WHERE id=? AND case_id=? AND data_version=? AND case_revision=? AND status='pending' AND EXISTS (SELECT 1 FROM case_legal_review_heads h JOIN case_calculation_heads c ON c.case_id=h.case_id WHERE h.case_id=? AND h.review_run_id=? AND h.calculation_run_id=? AND h.data_version=?)")
      .bind(JSON.stringify(records),now(),runId,input.caseId,input.dataVersion,input.caseRevision,
        input.caseId,input.legalReviewRunId,input.calculationRunId,input.dataVersion)
   ]);
   if(!committed[1]?.meta.changes)fail("LEGAL_AUTOMATION_DRAFT_SOURCE_STALE");
   return runId;
  },
  deleteRecords:records=>database.batch(records.map(f=>database.prepare(
   "DELETE FROM artifacts WHERE id=? AND case_id=? AND object_key=?").bind(f.id,input.caseId,f.objectKey))),
  deleteObject:key=>bucket().delete(key),
  onCleanupFailure:()=>{},
 });
 await event(input.caseId,"legal_automation.review_draft_generated",{
  dataVersion:input.dataVersion,reviewRunId:input.legalReviewRunId,
  draftRunId:runId,artifactCount:generated.length,mode:"draft",
  courtApprovalInferred:false,finalFilingAllowed:false}).catch(()=>{});
 return {documentRunId:runId,artifacts:generated.map(a=>({id:a.id,name:a.name,kind:a.kind}))};
}
