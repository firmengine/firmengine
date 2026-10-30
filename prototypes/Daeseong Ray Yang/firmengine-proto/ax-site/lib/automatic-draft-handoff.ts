/** Staff-controlled bridge from an already generated automatic REVIEW draft
 * into the existing exportManifest -> document.edit -> regenerate -> final review
 * workflow. Never promotes a draft to an approved or filed document.
 */
import type {CaseData,ExportManifest} from "./domain.ts";
import {requiredKindsForCase} from "./domain.ts";
import {newExportManifest} from "./exports.ts";
import {db,bucket,event,getCase,caseExtras,caseStateFingerprint,saveCase,HttpError,sha256,now} from "./server-store.ts";
import {prepareDocumentWrite,finalizeDocumentWriterReceipt,type DocumentWriterReceipt} from "./document-writer.ts";
import {buildDocumentFieldBases} from "./document-field-bases.ts";
import {referenceIdentity} from "./reference-runtime.ts";
import {FORM_CONTRACT_VERSION} from "./form-contracts.ts";
import {automaticDraftHandoffDecision,parseAutomaticDraftArtifacts,type AutomaticDraftRow,
 type AutomaticDraftHead,type AutomaticDraftArtifact,type AutomaticDraftOrigin} from "./automatic-draft-handoff-contract.ts";

type StoredArtifact=AutomaticDraftArtifact&{revision:number};
type OriginManifest=ExportManifest&{autoDraftOrigin?:AutomaticDraftOrigin};
const reject=(code:string,status=409):never=>{throw new HttpError(status,code);};
function manifestOrigin(data:CaseData):AutomaticDraftOrigin|null{
  const x=(data.exportManifest as OriginManifest|undefined)?.autoDraftOrigin;
  return x&&typeof x.runId==="string"&&typeof x.legalReviewRunId==="string"?x:null;
}
async function head(database:D1Database,caseId:string):Promise<AutomaticDraftHead|null>{
 return database.prepare(
  "SELECT s.data_version AS dataVersion,c.run_id AS calculationRunId,l.review_run_id AS legalReviewRunId,"+
  "c.case_revision AS calculationCaseRevision,l.case_revision AS legalCaseRevision,"+
  "r.reference_sha256 AS referenceSha256 "+
  "FROM case_data_change_state s "+
  "JOIN case_calculation_heads c ON c.case_id=s.case_id "+
  "JOIN case_calculation_runs r ON r.id=c.run_id "+
  "JOIN case_legal_review_heads l ON l.case_id=s.case_id "+
  "WHERE s.case_id=? AND c.data_version=s.data_version "+
  "AND l.data_version=s.data_version AND l.calculation_run_id=c.run_id"
 ).bind(caseId).first<AutomaticDraftHead>();
}
async function completeRun(database:D1Database,caseId:string,legalReviewRunId:string|undefined){
 if(!legalReviewRunId)return null;
 return database.prepare(
  "SELECT id,case_id AS caseId,legal_review_run_id AS legalReviewRunId,data_version AS dataVersion,"+
  "case_revision AS caseRevision,status,artifacts_json AS artifactsJson "+
  "FROM case_automatic_document_runs WHERE case_id=? AND legal_review_run_id=?"
 ).bind(caseId,legalReviewRunId).first<AutomaticDraftRow>();
}
function decide(data:CaseData,run:AutomaticDraftRow|null,heads:AutomaticDraftHead|null,
  artifacts:readonly AutomaticDraftArtifact[]){
 return automaticDraftHandoffDecision({
   row:run,head:heads,caseId:data.context.id,caseRevision:data.context.revision,
   currentReferenceSha256:referenceIdentity()?.sha256??"",
   artifacts,existingCurrentFiles:(data.exportManifest?.files??[]).filter(f=>f.status==="current"),
   existingMode:data.exportManifest?.mode??null,existingOrigin:manifestOrigin(data),
   pendingEdits:!!data.workflowState?.documentEdits?.length
 });
}
export async function readAutomaticDraftHandoff(database:D1Database,data:CaseData){
  const heads=await head(database,data.context.id);
  if(!heads)return {status:"none" as const,canLink:false,runId:null,artifactCount:0,blockers:[]};
  const run=await completeRun(database,data.context.id,heads.legalReviewRunId);
  if(!run||run.status!=="complete")return {status:"none" as const,canLink:false,runId:null,artifactCount:0,blockers:[]};
  let artifacts:AutomaticDraftArtifact[]=[];
  try{artifacts=parseAutomaticDraftArtifacts(run.artifactsJson,data.context.id);}
  catch(error){return {status:"blocked" as const,canLink:false,runId:run.id,artifactCount:0,blockers:[error instanceof Error?error.message:"AUTODRAFT_INVALID_ARTIFACT_SET"]};}
  const result=decide(data,run,heads,artifacts);
  return {status:result.alreadyLinked?"linked" as const:result.eligible?"candidate" as const:"blocked" as const,
   canLink:result.eligible&&!result.alreadyLinked,runId:run.id,
   artifactCount:artifacts.length,blockers:result.blockers};
}
function mustMatchReceipt(original:DocumentWriterReceipt,latest:DocumentWriterReceipt){
  if(!original||original.schemaVersion!=="document-writer-receipt/2"||
    original.mode!=="draft"||original.courtApprovalInferred!==false||
    original.readyForElectronicFiling!==false||original.formContractVersion!==FORM_CONTRACT_VERSION)
    reject("AUTODRAFT_UNTRUSTED_WRITER_RECEIPT");
  const keys=["caseId","caseRevision","inputSha256","evaluationId","evaluationResultHash",
    "generatorVersion","formContractVersion","bindingsSha256","documentEditsHash"];
  for(const key of keys){
    if((original as unknown as Record<string,unknown>)[key]!== (latest as unknown as Record<string,unknown>)[key])
      reject("AUTODRAFT_WRITER_INPUT_CHANGED:"+key);
  }
  if(original.referenceRelease?.sha256!==latest.referenceRelease?.sha256 ||
    !original.referenceRelease?.sha256)reject("AUTODRAFT_REFERENCE_RELEASE_CHANGED");
  if(JSON.stringify([...original.requiredKinds].sort())!==JSON.stringify([...latest.requiredKinds].sort()) ||
    JSON.stringify(original.formResults)!==JSON.stringify(latest.formResults))
    reject("AUTODRAFT_WRITER_FORM_CONTRACT_CHANGED");
}
/** Staff POST can be retried safely: an already linked run returns the existing
 * exact file IDs, never regenerates new artifacts or creates a second manifest.
 */
export async function adoptAutomaticDraftForReview(input:{
 caseId:string;runId:string;expectedRevision:number;expectedStateFingerprint:string;
 actor:string;reason:string;
}){
  if(typeof input.actor!=="string"||!input.actor.trim()||input.actor==="private-site-service")reject("HUMAN_REVIEW_REQUIRED",403);
  if(!input.caseId||!input.runId||!Number.isSafeInteger(input.expectedRevision)||
    !/^case-state\/1:[a-f0-9]{64}$/.test(input.expectedStateFingerprint)||
    !input.reason?.trim()||input.reason.length>4000)reject("AUTODRAFT_INVALID_HANDOFF_REQUEST",400);
  const database=db(),data=await getCase(input.caseId);
  if(data.referenceTest||data.structuredTest||data.evaluationClone)reject("AUTODRAFT_PROTECTED_CASE",403);
  const heads=await head(database,input.caseId);
  const run=await completeRun(database,input.caseId,heads?.legalReviewRunId);
  if(!run||run.id!==input.runId||run.status!=="complete")reject("AUTODRAFT_CURRENT_RUN_NOT_FOUND");
  let artifacts:AutomaticDraftArtifact[];
  try{artifacts=parseAutomaticDraftArtifacts(run.artifactsJson,input.caseId);}
  catch(error){reject(error instanceof Error?error.message:"AUTODRAFT_ARTIFACT_INVALID");}
  const decision=decide(data,run,heads,artifacts);
  if(decision.alreadyLinked)return {status:"already_linked" as const,runId:run.id,artifactCount:artifacts.length,courtApprovalInferred:false};
  if(!decision.eligible)reject(decision.blockers.join(","));
  if(input.expectedRevision!==data.context.revision ||
    input.expectedStateFingerprint!==await caseStateFingerprint(data))
    reject("AUTODRAFT_HANDOFF_CASE_CHANGED");
  // A current export from another writer is NEVER overwritten by an automatic draft.
  // Exact artifact rows and immutable R2 hashes are checked before linking.
  const saved:StoredArtifact[]=[];
  let rendered:Record<string,unknown>|null=null;
  for(const artifact of artifacts){
    const stored=await database.prepare(
      "SELECT id,kind,name,hash,mime,object_key AS objectKey,revision FROM artifacts WHERE id=? AND case_id=?"
    ).bind(artifact.id,input.caseId).first<StoredArtifact>();
    if(!stored||stored.kind!==artifact.kind||stored.name!==artifact.name||
      stored.hash!==artifact.hash||stored.mime!==artifact.mime||
      stored.objectKey!==artifact.objectKey||stored.revision!==run.caseRevision)
      reject("AUTODRAFT_SQL_ARTIFACT_MISMATCH");
    const object=await bucket().get(artifact.objectKey);
    if(!object)reject("AUTODRAFT_OBJECT_MISSING");
    const bytes=await object.arrayBuffer();
    if(await sha256(bytes)!==artifact.hash)reject("AUTODRAFT_OBJECT_HASH_MISMATCH");
    if(artifact.kind==="rendered_json"){
      try{rendered=JSON.parse(new TextDecoder().decode(bytes)) as Record<string,unknown>;}
      catch{reject("AUTODRAFT_RENDERED_RECEIPT_INVALID");}
    }
    saved.push(stored);
  }
  if(!rendered||rendered.caseId!==input.caseId||rendered.caseRevision!==run.caseRevision||
    rendered.mode!=="draft")reject("AUTODRAFT_RENDERED_IDENTITY_MISMATCH");
  const meta=rendered.metadata;
  if(!meta||typeof meta!=="object"||Array.isArray(meta))reject("AUTODRAFT_RENDERED_RECEIPT_MISSING");
  const original=(meta as Record<string,unknown>).writer_receipt as DocumentWriterReceipt|undefined;
  if(!original)reject("AUTODRAFT_RENDERED_RECEIPT_MISSING");
  const extras=await caseExtras(data);
  if(!extras.derivedEvaluation||extras.derivedEvaluation.status!=="complete")reject("AUTODRAFT_CURRENT_EVALUATION_NOT_READY");
  const prepared=await prepareDocumentWrite({
    data,evaluation:extras.derivedEvaluation,
    processingComplete:extras.processingReadiness.complete,mode:"draft",
    requiredKinds:requiredKindsForCase(data),now:original.generatedAt
  });
  mustMatchReceipt(original,prepared.receipt);
  const finalized=await finalizeDocumentWriterReceipt(original,artifacts);
  finalized.fieldBases=await buildDocumentFieldBases({
   data,execution:prepared.execution,formResults:finalized.formResults,artifacts
  });
  // Recheck all heads after R2 reads and before the atomic manifest CAS.
  const after=await head(database,input.caseId);
  const second=decide(data,run,after,artifacts);
  if(!second.eligible||second.alreadyLinked)reject("AUTODRAFT_HANDOFF_SOURCE_CHANGED");
  const next=structuredClone(data);
  const origin:AutomaticDraftOrigin={
   runId:run.id,legalReviewRunId:run.legalReviewRunId,
   calculationRunId:after!.calculationRunId,sourceDataVersion:run.dataVersion,
   caseRevision:run.caseRevision,linkedBy:input.actor,linkedAt:now()
  };
  next.exportManifest={
   ...newExportManifest(next.context.revision,artifacts.map(item=>({
     id:item.id,kind:item.kind as ExportManifest["files"][number]["kind"],
     name:item.name,hash:item.hash,status:"current" as const
   })),next,"draft"),documentWriter:finalized,autoDraftOrigin:origin
  } as OriginManifest;
  await saveCase(next,data.context.revision,data,undefined,{
   mutationCategory:"artifact_only",
   expectedHeads:{dataVersion:run.dataVersion,calculationRunId:after!.calculationRunId,
    legalReviewRunId:run.legalReviewRunId,referenceSha256:after!.referenceSha256}
  });
  await event(input.caseId,"automatic_draft.linked_to_staff_workbench",{
    runId:run.id,legalReviewRunId:run.legalReviewRunId,caseRevision:run.caseRevision,
    sourceDataVersion:run.dataVersion,artifactIds:artifacts.map(a=>a.id),actor:input.actor,reason:input.reason,
    mode:"draft",courtApprovalInferred:false
  }).catch(()=>{});
  return {status:"linked" as const,runId:run.id,artifactCount:artifacts.length,
    courtApprovalInferred:false};
}
