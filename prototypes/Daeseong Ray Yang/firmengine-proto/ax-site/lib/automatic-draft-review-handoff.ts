/** Explicit staff handoff of an existing immutable automatic REVIEW draft.
 * Preserve the original R2 artifact IDs and hashes; do not infer any
 * legal approval, court-filing readiness, or automatic source recognition.
 */
import type {DocumentWriterReceipt} from "./document-writer.ts";

export const AUTOMATIC_DRAFT_HANDOFF_VERSION="auto-draft-review-handoff/1" as const;
export interface AutoDraftArtifact {
 id:string;name:string;kind:string;hash:string;mime:string;objectKey:string;
}
export interface AutoDraftHandoffRow {
 id:string;caseId:string;legalReviewRunId:string;dataVersion:number;caseRevision:number;
 status:string;artifactsJson:string;
}
export interface AutoDraftReceiptEnvelope {
 schemaVersion:"automatic-draft-writer-receipt/1";
 documentRunId:string;caseId:string;legalReviewRunId:string;dataVersion:number;
 caseRevision:number;calculationRunId:string;writerReceipt:DocumentWriterReceipt;
}
export interface AutoDraftStorageArtifact {
 id:string;caseId:string;revision:number;name:string;kind:string;objectKey:string;hash:string;mime:string;
}
export interface ValidateAutoDraftHandoffInput {
 run:AutoDraftHandoffRow;
 receipt:AutoDraftReceiptEnvelope;
 stored:readonly AutoDraftStorageArtifact[];
 current:{caseId:string;caseRevision:number;dataVersion:number;calculationRunId:string;
   legalReviewRunId:string;referenceSha256:string;caseInputSha256:string};
}
const HEX=/^[a-f0-9]{64}$/i;
const legalKinds=new Set(["application","creditors","assets","income_expense","repayment_plan","statement",
 "evidence_index","review_workbook","bank_accounts","leases","repayment_schedule","print_html","rendered_json","package_zip"]);
const invalid=(code:string):never=>{throw new Error(code);};
export function validateAutoDraftHandoff(input:ValidateAutoDraftHandoffInput):{
 artifacts:AutoDraftArtifact[];writerReceipt:DocumentWriterReceipt;courtApprovalInferred:false;mode:"draft"
}{
 const {run,receipt,stored,current}=input;
 if(run.status!=="complete"||run.id!==receipt.documentRunId||run.caseId!==current.caseId||
    run.caseId!==receipt.caseId||run.legalReviewRunId!==current.legalReviewRunId||
    receipt.legalReviewRunId!==current.legalReviewRunId||
    run.caseRevision!==current.caseRevision||run.dataVersion!==current.dataVersion||
    receipt.caseRevision!==current.caseRevision||receipt.dataVersion!==current.dataVersion||
    receipt.calculationRunId!==current.calculationRunId)
   invalid("AUTO_DRAFT_REVIEW_VERSION_MISMATCH");
 if(receipt.schemaVersion!=="automatic-draft-writer-receipt/1")
   invalid("AUTO_DRAFT_REVIEW_RECEIPT_UNSUPPORTED");
 const w=receipt.writerReceipt;
 if(!w||w.schemaVersion!=="document-writer-receipt/2"||w.mode!=="draft"||
    w.courtApprovalInferred!==false||w.readyForElectronicFiling!==false||
    w.outputPurpose!=="review"||w.caseId!==current.caseId||w.caseRevision!==current.caseRevision||
    w.inputSha256!==current.caseInputSha256||
    w.referenceRelease?.sha256!==current.referenceSha256)
   invalid("AUTO_DRAFT_REVIEW_WRITER_RECEIPT_INVALID");
 let artifacts:AutoDraftArtifact[];
 try{artifacts=JSON.parse(run.artifactsJson) as AutoDraftArtifact[];}
 catch{invalid("AUTO_DRAFT_REVIEW_ARTIFACT_INTEGRITY");}
 if(!Array.isArray(artifacts)||!artifacts.length||artifacts.length>64)
   invalid("AUTO_DRAFT_REVIEW_ARTIFACT_INTEGRITY");
 const ids=new Set<string>(),rowsById=new Map(stored.map(row=>[row.id,row]));
 if(rowsById.size!==artifacts.length||stored.length!==artifacts.length)
   invalid("AUTO_DRAFT_REVIEW_ARTIFACT_COUNT_MISMATCH");
 for(const file of artifacts){
  if(!file||typeof file.id!=="string"||!file.id||
     typeof file.name!=="string"||!file.name||file.name.length>250||
     typeof file.kind!=="string"||!legalKinds.has(file.kind)||
     typeof file.hash!=="string"||!HEX.test(file.hash)||
     typeof file.mime!=="string"||!file.mime||
     typeof file.objectKey!=="string"||!file.objectKey.startsWith("cases/"+run.caseId+"/artifacts/")||
     !file.objectKey.endsWith("/"+file.id)||ids.has(file.id))
   invalid("AUTO_DRAFT_REVIEW_ARTIFACT_INTEGRITY");
  ids.add(file.id);
  const persisted=rowsById.get(file.id);
  if(!persisted||persisted.caseId!==current.caseId||persisted.revision!==current.caseRevision||
     persisted.name!==file.name||persisted.kind!==file.kind||persisted.objectKey!==file.objectKey||
     persisted.hash!==file.hash||persisted.mime!==file.mime)
   invalid("AUTO_DRAFT_REVIEW_ARTIFACT_DB_MISMATCH");
 }
 const hashes=artifacts.map(f=>f.hash).sort();
 if(JSON.stringify(hashes)!==JSON.stringify([...w.artifactHashes].sort()))
   invalid("AUTO_DRAFT_REVIEW_WRITER_HASH_MISMATCH");
 if(!Array.isArray(w.fieldBases)||!w.fieldBases.length||w.fieldBases.length>5000||
    w.fieldBases.some(base=>!ids.has(base.artifactId)||rowsById.get(base.artifactId)?.hash!==base.artifactHash||
      !["prose","layout"].includes(base.kind)||!base.fieldId||
      typeof base.value!=="string"||typeof base.baseValueHash!=="string"||!base.baseValueHash))
   invalid("AUTO_DRAFT_REVIEW_FIELD_BASES_INVALID");
 return {artifacts:artifacts.map(x=>({...x})),writerReceipt:w,courtApprovalInferred:false,mode:"draft"};
}
