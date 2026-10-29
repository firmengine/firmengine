import { referenceIdentity } from "./reference-runtime.ts";
import type { CaseData } from "./domain.ts";
import type { DerivedEvaluationEnvelope, ExecutionSnapshot } from "./reactive-evaluation.ts";

export interface DocumentWriterReceipt {
  schemaVersion:"document-writer-receipt/1";
  caseId:string;
  caseRevision:number;
  inputSha256:string;
  requiredKinds:string[];
  bindingsSha256:string;
  referenceRelease?:{id:string;revision:number;sha256:string};
  mode:"draft"|"final";
  status:"ready"|"review_required";
  generatedAt:string;
  courtApprovalInferred:false;
  outputPurpose:"review";
  readyForElectronicFiling:false;
  officialFormParity:"not_verified";
}
export interface PreparedDocumentWrite { execution:ExecutionSnapshot; receipt:DocumentWriterReceipt; }
const digest=async(value:unknown)=>{
  const bytes=new TextEncoder().encode(JSON.stringify(value));
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(v=>v.toString(16).padStart(2,"0")).join("");
};

/** Validates and prepares a document write from the current trusted, persisted evaluation. */
export async function prepareDocumentWrite(input:{data:CaseData;evaluation:DerivedEvaluationEnvelope|{status:"pending";revision:number;inputSha256:string;storageToken?:string}|null|undefined;processingComplete:boolean;mode:"draft"|"final";requiredKinds:string[];now?:string}):Promise<PreparedDocumentWrite>{
  const {data,evaluation,mode}=input;
  if(!evaluation||evaluation.status!=="complete"||!evaluation.execution)throw new Error("DOCUMENT_EVALUATION_PENDING");
  const execution=evaluation.execution;
  const referenceRelease=referenceIdentity();
  if(referenceRelease&&evaluation.referenceSha256!==referenceRelease.sha256)throw new Error("DOCUMENT_REFERENCE_RELEASE_STALE");
  if(evaluation.revision!==data.context.revision||execution.caseRevision!==data.context.revision||execution.caseId!==data.context.id)throw new Error("DOCUMENT_EVALUATION_STALE");
  const inputSha256=await digest(data);
  if(evaluation.inputSha256!==inputSha256)throw new Error("DOCUMENT_EVALUATION_INPUT_MISMATCH");
  if(!execution.formBindings||!execution.documentPayloads)throw new Error("DOCUMENT_BINDINGS_MISSING");
  if(data.referenceTest?.finalSubmissionProhibited||data.structuredTest?.mode==="assumed_extracted_synthetic"){
    if(mode==="final")throw new Error("SYNTHETIC_FINAL_PROHIBITED");
  }
  if(!execution.assessment.generationGate.canGenerateDraft)throw new Error("DOCUMENT_DRAFT_GATE_BLOCKED");
  if(mode==="final"&&(!input.processingComplete||!execution.assessment.generationGate.canFinalize))throw new Error("DOCUMENT_FINAL_REVIEW_REQUIRED");
  const bindingsSha256=await digest({formBindings:execution.formBindings,documentPayloads:execution.documentPayloads});
  return {execution,receipt:{schemaVersion:"document-writer-receipt/1",caseId:data.context.id,caseRevision:data.context.revision,inputSha256,requiredKinds:[...input.requiredKinds],bindingsSha256,referenceRelease,mode,status:mode==="final"?"ready":"review_required",generatedAt:input.now??new Date().toISOString(),courtApprovalInferred:false,outputPurpose:"review",readyForElectronicFiling:false,officialFormParity:"not_verified"}};
}
