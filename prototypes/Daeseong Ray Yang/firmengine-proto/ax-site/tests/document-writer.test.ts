import test from "node:test";
import assert from "node:assert/strict";
import { createCase } from "../lib/domain.ts";
import { completeDerivedEvaluation, pendingDerivedEvaluation, type ExecutionSnapshot } from "../lib/reactive-evaluation.ts";
import { finalizeDocumentWriterReceipt, prepareDocumentWrite } from "../lib/document-writer.ts";
import type { CaseData } from "../lib/domain.ts";
import { emptyCaseWorkflow } from "../lib/case-workflow-state.ts";
import { buildDerivedExecution } from "../lib/reactive-evaluation.ts";
import { writeOfficePackage } from "../lib/office-writer.ts";
import { CURRENT_RULESET } from "../lib/legal-rules.ts";
import { unzipSync, strFromU8 } from "fflate";

const sha=async(value:unknown)=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(value))))].map(x=>x.toString(16).padStart(2,"0")).join("");
function fixture(){
  const data=createCase("Synthetic document writer",crypto.randomUUID(),"2026-10-28");data.documents.push({id:"source-doc",name:"synthetic-source.pdf",sha256:"a".repeat(64),type:"evidence",status:"active",pages:[1]});
  const execution={caseId:data.context.id,caseRevision:data.context.revision,assessment:{generationGate:{canGenerateDraft:true,canFinalize:true},calculation:{debtRows:[],assetRows:[]}},formBindings:{scalars:{client_name:"Applicant",monthly_income:"1,250,000",statement:"base prose"},rows:{}},documentPayloads:[{kind:"application",paragraphs:["intro"],tables:[{rows:[["base prose"]]}]}]} as unknown as ExecutionSnapshot;
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
  assert.equal(prepared.receipt.schemaVersion,"document-writer-receipt/2");assert.equal(prepared.receipt.formResults[0]?.formCode,"D5100");assert.equal(prepared.receipt.formResults[0]?.templateHash.length,64);assert.equal(prepared.receipt.formResults[0]?.status,"ready");
  const rendered=await finalizeDocumentWriterReceipt(prepared.receipt,[{kind:"application",hash:"c".repeat(64)}]);assert.deepEqual(rendered.artifactHashes,["c".repeat(64)]);assert.notEqual(rendered.formResults[0]?.artifactIdentityHash,prepared.receipt.formResults[0]?.artifactIdentityHash);
});

test("final required-field preflight blocks missing applicant name while draft preserves unresolved markers",async()=>{
  const {data,execution}=fixture(),missing=structuredClone(execution);delete missing.formBindings!.scalars.client_name;
  const evaluation=await envelope(data,missing);
  const draft=await prepareDocumentWrite({data,evaluation,processingComplete:false,mode:"draft",requiredKinds:["application"]});
  assert.equal(draft.receipt.formResults[0]?.status,"draft_with_unresolved");assert.ok(draft.receipt.formResults[0]?.unresolved.some(x=>x.startsWith("client_name:")));
  await assert.rejects(prepareDocumentWrite({data,evaluation,processingComplete:true,mode:"final",requiredKinds:["application"]}),/DOCUMENT_PREFLIGHT_BLOCKED/);
});

test("prose overlays merge B/U/N and update form bindings, payload cells, and writer digest",async()=>{
  const {data,execution}=fixture();data.workflowState=emptyCaseWorkflow();data.workflowState.documentEdits.push({id:"edit-1",fieldId:"statement",rowId:null,kind:"prose",baseValue:"base prose",value:"reviewed prose",artifactId:"old-artifact",actor:"staff",reason:"clarified",at:"2026-10-29T00:00:00Z"});
  const evaluation=await envelope(data,execution),prepared=await prepareDocumentWrite({data,evaluation,processingComplete:false,mode:"draft",requiredKinds:["application"]});
  assert.equal(prepared.execution.formBindings!.scalars.statement,"reviewed prose");assert.deepEqual(prepared.execution.documentPayloads![0]?.paragraphs,["intro"]);assert.deepEqual(prepared.execution.documentPayloads![0]?.tables[0]?.rows,[["reviewed prose"]]);assert.deepEqual(prepared.receipt.appliedEditIds,["edit-1"]);assert.notEqual(prepared.receipt.bindingsSha256,await sha({formBindings:execution.formBindings,documentPayloads:execution.documentPayloads}));
});

test("successive edits to one stable field apply the latest value without self-conflicting",async()=>{
  const {data,execution}=fixture();data.workflowState=emptyCaseWorkflow();
  data.workflowState.documentEdits.push(
    {id:"edit-first",fieldId:"statement",rowId:null,kind:"prose",baseValue:"base prose",value:"first revision",artifactId:"artifact-1",actor:"staff",reason:"clarify",at:"2026-10-29T00:00:00Z"},
    {id:"edit-latest",fieldId:"statement",rowId:null,kind:"prose",baseValue:"base prose",value:"latest revision",artifactId:"artifact-1",actor:"staff",reason:"refine",at:"2026-10-29T00:01:00Z"},
  );
  const prepared=await prepareDocumentWrite({data,evaluation:await envelope(data,execution),processingComplete:false,mode:"draft",requiredKinds:["application"]});
  assert.equal(prepared.execution.formBindings!.scalars.statement,"latest revision");
  assert.deepEqual(prepared.execution.documentPayloads![0]?.tables[0]?.rows,[["latest revision"]]);
  assert.deepEqual(prepared.receipt.appliedEditIds,["edit-latest"]);
});

test("writer rejects conflicting, orphaned, and amount-like document overlays",async()=>{
  const {data,execution}=fixture();data.workflowState=emptyCaseWorkflow();
  data.workflowState.documentEdits.push({id:"conflict",fieldId:"statement",rowId:null,kind:"prose",baseValue:"old prose",value:"user prose",artifactId:"old-artifact",actor:"staff",reason:"edit",at:"2026-10-29T00:00:00Z"});
  const changed={...execution,formBindings:{...execution.formBindings,scalars:{...execution.formBindings!.scalars,statement:"new generated prose"}}} as ExecutionSnapshot;
  await assert.rejects(prepareDocumentWrite({data,evaluation:await envelope(data,changed),processingComplete:false,mode:"draft",requiredKinds:["application"]}),/DOCUMENT_EDIT_CONFLICT/);
  data.workflowState.documentEdits=[{id:"orphan",fieldId:"creditor.number",rowId:"deleted-debt",kind:"layout",baseValue:"1",value:"1",artifactId:"old-artifact",actor:"staff",reason:"edit",at:"2026-10-29T00:00:00Z"}];
  const withRows={...execution,formBindings:{...execution.formBindings,rows:{creditor:[{entity:"Creditor",principal:"10",content:"new"}]}},assessment:{...execution.assessment,calculation:{debtRows:[],assetRows:[]}}} as unknown as ExecutionSnapshot;
  await assert.rejects(prepareDocumentWrite({data,evaluation:await envelope(data,withRows),processingComplete:false,mode:"draft",requiredKinds:["application"]}),/DOCUMENT_EDIT_ORPHAN/);
  data.workflowState.documentEdits=[{id:"money",fieldId:"monthly_payment",rowId:null,kind:"prose",baseValue:"100",value:"200",artifactId:"old-artifact",actor:"staff",reason:"amount change",at:"2026-10-29T00:00:00Z"}];
  await assert.rejects(prepareDocumentWrite({data,evaluation:await envelope(data,execution),processingComplete:false,mode:"draft",requiredKinds:["application"]}),/DOCUMENT_EDIT_SOURCE_COMMAND_REQUIRED/);
});

test("prepared prose overlay reaches a real locally rendered DOCX artifact",async()=>{
  const data=createCase("Synthetic local overlay render","overlay-render","2026-10-29");data.context.applicant={name:"김하늘"};data.workflowState=emptyCaseWorkflow();
  let execution=buildDerivedExecution(data);const baseValue=execution.formBindings!.scalars.statement;
  data.workflowState.documentEdits.push({id:"render-edit",fieldId:"statement",rowId:null,kind:"prose",baseValue,value:"검토한 한국어 문장 overlay",artifactId:"prior-artifact",actor:"staff",reason:"clarify",at:"2026-10-29T00:00:00Z"});
  execution=buildDerivedExecution(data);execution.assessment.generationGate.canGenerateDraft=true;
  const evaluation=await envelope(data,execution),prepared=await prepareDocumentWrite({data,evaluation,processingComplete:false,mode:"draft",requiredKinds:["application"]});
  const artifacts=await writeOfficePackage({data,rules:CURRENT_RULESET,mode:"draft",preparedExecution:prepared.execution,writerReceipt:prepared.receipt});
  const application=artifacts.find(item=>item.kind==="application");assert.ok(application);assert.equal(application!.hash.length,64);
  const docXml=strFromU8(unzipSync(application!.bytes)["word/document.xml"]!);assert.ok(docXml.includes("검토한 한국어 문장 overlay"));assert.equal(prepared.execution.formBindings!.scalars.statement,"검토한 한국어 문장 overlay");assert.notEqual(baseValue,"검토한 한국어 문장 overlay");
  const renderedJson=artifacts.find(item=>item.kind==="rendered_json");assert.ok(renderedJson);const rendered=JSON.parse(new TextDecoder().decode(renderedJson!.bytes));assert.equal(rendered.metadata.writer_receipt.bindingsSha256,prepared.receipt.bindingsSha256);assert.equal(rendered.metadata.writer_receipt.caseRevision,data.context.revision);
});
