import test from "node:test";
import assert from "node:assert/strict";
import { createCase } from "../lib/domain.ts";
import { completeDerivedEvaluation, pendingDerivedEvaluation, type ExecutionSnapshot } from "../lib/reactive-evaluation.ts";
import { prepareDocumentWrite } from "../lib/document-writer.ts";
import type { CaseData } from "../lib/domain.ts";

const sha=async(value:unknown)=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(value))))].map(x=>x.toString(16).padStart(2,"0")).join("");
function fixture(){
  const data=createCase("Synthetic document writer",crypto.randomUUID(),"2026-10-28");data.documents.push({id:"source-doc",name:"synthetic-source.pdf",sha256:"a".repeat(64),type:"evidence",status:"active",pages:[1]});
  const execution={caseId:data.context.id,caseRevision:data.context.revision,assessment:{generationGate:{canGenerateDraft:true,canFinalize:true}},formBindings:{scalars:{monthly_income:"1,250,000"}},documentPayloads:[{kind:"application",tables:[]}]} as unknown as ExecutionSnapshot;
  const pending=pendingDerivedEvaluation({revision:data.context.revision,storageToken:"token",inputSha256:"0".repeat(64),generatedAt:"2026-10-28T00:00:00.000Z"});
  return {data,execution,pending};
}
async function envelope(data:CaseData,execution:ExecutionSnapshot){const pending=pendingDerivedEvaluation({revision:data.context.revision,storageToken:"token",inputSha256:await sha(data),generatedAt:"2026-10-28T00:00:00.000Z"});return completeDerivedEvaluation(pending,execution,"b".repeat(64));}

test("writer accepts only current saved bindings and returns review receipt for draft",async()=>{
  const {data,execution}=fixture(),evaluation=await envelope(data,execution);
  const prepared=await prepareDocumentWrite({data,evaluation,processingComplete:false,mode:"draft",requiredKinds:["application"],now:"2026-10-28T01:00:00Z"});
  assert.equal(prepared.receipt.status,"review_required");assert.equal(prepared.receipt.caseRevision,data.context.revision);assert.equal(prepared.receipt.inputSha256,evaluation.inputSha256);assert.equal(prepared.receipt.requiredKinds[0],"application");assert.equal(prepared.execution.formBindings!.scalars.monthly_income,"1,250,000");
});
test("writer rejects stale evaluation, synthetic final, and incomplete review gates",async()=>{
  const {data,execution}=fixture(),evaluation=await envelope(data,execution);
  const stale=structuredClone(data);stale.context.revision++;
  await assert.rejects(prepareDocumentWrite({data:stale,evaluation,processingComplete:true,mode:"final",requiredKinds:[]}));
  const sameRevisionChanged=structuredClone(data);sameRevisionChanged.context.caseName+=" changed";
  await assert.rejects(prepareDocumentWrite({data:sameRevisionChanged,evaluation,processingComplete:true,mode:"draft",requiredKinds:[]}),/DOCUMENT_EVALUATION_INPUT_MISMATCH/);
  const synthetic=structuredClone(data);synthetic.structuredTest={mode:"assumed_extracted_synthetic",scenarioId:"synthetic-case",sourceRecords:[]};
  const syntheticEvaluation=await envelope(synthetic,{...execution,caseRevision:synthetic.context.revision} as ExecutionSnapshot);
  await assert.rejects(prepareDocumentWrite({data:synthetic,evaluation:syntheticEvaluation,processingComplete:true,mode:"final",requiredKinds:[]}),/SYNTHETIC_FINAL_PROHIBITED/);
  const blocked={...execution,assessment:{generationGate:{canGenerateDraft:true,canFinalize:false}}} as unknown as ExecutionSnapshot;
  const blockedEvaluation=await envelope(data,blocked);
  await assert.rejects(prepareDocumentWrite({data,evaluation:blockedEvaluation,processingComplete:true,mode:"final",requiredKinds:[]}),/DOCUMENT_FINAL_REVIEW_REQUIRED/);
  await assert.rejects(prepareDocumentWrite({data,evaluation,processingComplete:false,mode:"final",requiredKinds:[]}),/DOCUMENT_FINAL_REVIEW_REQUIRED/);
});

test("final review generation does not certify e-form parity or filing readiness",async()=>{
  const {data,execution}=fixture(),evaluation=await envelope(data,execution);
  const prepared=await prepareDocumentWrite({data,evaluation,processingComplete:true,mode:"final",requiredKinds:["application"]});
  assert.equal(prepared.receipt.status,"ready");
  assert.equal(prepared.receipt.outputPurpose,"review");
  assert.equal(prepared.receipt.readyForElectronicFiling,false);
  assert.equal(prepared.receipt.officialFormParity,"not_verified");
});
