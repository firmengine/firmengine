import test from "node:test";
import assert from "node:assert/strict";
import { createCase, normalizeMoney, currentFacts, type CaseData, type Fact } from "../lib/domain.ts";
import { reduceCaseCommand, documentEditBaseHash } from "../lib/case-commands.ts";
import { commandHash, type CaseCommand } from "../lib/case-command-contract.ts";
import { makeCaseRequirement } from "../lib/case-requirements.ts";
import { emptyCaseWorkflow } from "../lib/case-workflow-state.ts";

const actor={actor:"synthetic reviewer",roles:["case_editor","caseworker_review","lawyer_review"],at:"2026-10-29T00:00:00.000Z"};
const command=(commandType:string,target:Record<string,unknown>,patch:Record<string,unknown>,extra:Record<string,unknown>={}):CaseCommand=>({commandId:"command-0001",commandType:commandType as CaseCommand["commandType"],payloadVersion:1,expectedRevision:1,expectedStateFingerprint:`case-state/1:${"a".repeat(64)}`,target,patch,reason:"synthetic review reason",...extra} as CaseCommand);
function factCase(){
  const data=createCase("Synthetic reducer","case-synthetic", "2026-10-29");
  data.documents=[{id:"doc-1",name:"Synthetic evidence",sha256:"a".repeat(64),status:"active",pages:[1]}];data.pages=[{documentId:"doc-1",page:1,role:"evidence",text:"principal 100 KRW"}];
  const fact:Fact={id:"fact-1",logicalId:"debt-1:principal",version:1,subjectId:"debt-1",key:"debt.principal",value:"100",rawValue:"100",sourceUnit:"원",numeric:normalizeMoney("100","원"),asOf:"2026-10-01",state:"verified",recognition:"unreviewed",refs:[{documentId:"doc-1",page:1,quote:"principal 100 KRW",sourceHash:"a".repeat(64)}],validation:[]};
  data.facts=[fact];data.debts=[{id:"debt-1",creditor:"Synthetic creditor",principal:normalizeMoney("100","원"),secured:"unknown",classification:"unknown",factIds:[fact.id]}];
  data.context.paymentSchedule={reviewed:true,reviewReason:"old",expectedInstallments:1,phases:[]};data.context.allocationBasisReviewed=true;data.context.referenceReviewSha256="old-reference";
  return data;
}
const err=(code:string)=>({code});

test("fact correction checks the exact original value hash and creates a new unreviewed fact",async()=>{
  const data=factCase(),hash=await commandHash({value:"100",sourceUnit:"원"});
  await assert.rejects(reduceCaseCommand(data,command("fact.correct",{factId:"fact-1"},{value:"200"},{baseValueHash:"0".repeat(64)}),actor),err("CASE_STATE_CONFLICT"));
  const result=await reduceCaseCommand(data,command("fact.correct",{factId:"fact-1"},{value:"200"},{baseValueHash:hash}),actor);
  const current=currentFacts(result.data)[0]!;
  assert.equal(current.value,"200");assert.equal(current.state,"extracted");assert.equal(current.recognition,"unreviewed");
  assert.equal(result.data.context.paymentSchedule?.reviewed,false);assert.equal(result.data.context.referenceReviewSha256,undefined);assert.ok((result.impact.reviewInvalidation as unknown[]).length>0);
});

test("synthetic evidence cannot receive verified facts, accepted facts, object acceptance, or legal disposition",async()=>{
  const data=factCase();data.structuredTest={mode:"assumed_extracted_synthetic",sourceRecords:[]};data.evaluationClone={sourceCaseId:"source",sourceInputSha256:"a".repeat(64),createdAt:"2026-10-29",finalSubmissionProhibited:true};
  await assert.rejects(reduceCaseCommand(data,command("fact.review",{factId:"fact-1"},{state:"verified",recognition:"accepted"}),actor),err("SYNTHETIC_REVIEW_PROHIBITED"));
  await assert.rejects(reduceCaseCommand(data,command("object.review",{collection:"debts",objectId:"debt-1"},{recognition:"accepted"}),actor),err("SYNTHETIC_REVIEW_PROHIBITED"));
  const legalRun={id:"run-1",checkId:"check-1",subjectFingerprint:"subject",dependencyFingerprint:"dep",status:"pass",factIds:["fact-1"],coverageComplete:true,source:"ai" as const};
  await assert.rejects(reduceCaseCommand(data,command("legalCheck.dispose",{runId:"run-1",checkId:"check-1"},{status:"accepted",evidenceFactIds:["fact-1"],role:"lawyer"}),{...actor,legalRun,legalRunVerified:true}),err("SYNTHETIC_REVIEW_PROHIBITED"));
});

test("legal dispositions reject a client supplied or incomplete run without server verification",async()=>{
  const data=factCase(),legalRun={id:"run-1",checkId:"check-1",subjectFingerprint:"subject",dependencyFingerprint:"dep",status:"pass",factIds:["fact-1"],coverageComplete:true,source:"ai" as const};
  await assert.rejects(reduceCaseCommand(data,command("legalCheck.dispose",{runId:"run-1",checkId:"check-1"},{status:"accepted",evidenceFactIds:["fact-1"],role:"lawyer"}),{...actor,legalRun}),err("CASE_STATE_CONFLICT"));
  await assert.rejects(reduceCaseCommand(data,command("legalCheck.dispose",{runId:"run-1",checkId:"check-1"},{status:"accepted",evidenceFactIds:["fact-1"],role:"lawyer"}),{...actor,legalRun:{...legalRun,truncated:true},legalRunVerified:true}),err("CASE_STATE_CONFLICT"));
  const approved=await reduceCaseCommand(data,command("legalCheck.dispose",{runId:"run-1",checkId:"check-1"},{status:"accepted",evidenceFactIds:["fact-1"],role:"lawyer"}),{...actor,legalRun,legalRunVerified:true});
  assert.equal(approved.data.workflowState?.legalDispositions[0]?.actor,actor.actor);
});

test("incomplete legal runs can be recorded unresolved or rejected, but cannot be accepted",async()=>{
  const data=factCase(),legalRun={id:"run-partial",checkId:"check-1",subjectFingerprint:"subject",dependencyFingerprint:"dep",status:"missing",factIds:["fact-1"],coverageComplete:false,source:"ai" as const};
  await assert.rejects(reduceCaseCommand(data,command("legalCheck.dispose",{runId:legalRun.id,checkId:legalRun.checkId},{status:"accepted",evidenceFactIds:["fact-1"],role:"lawyer"}),{...actor,legalRun,legalRunVerified:true}),err("CASE_STATE_CONFLICT"));
  const pending=await reduceCaseCommand(data,command("legalCheck.dispose",{runId:legalRun.id,checkId:legalRun.checkId},{status:"needs_review",evidenceFactIds:["fact-1"],role:"lawyer"}),{...actor,legalRun,legalRunVerified:true});
  assert.equal(pending.data.workflowState?.legalDispositions[0]?.status,"needs_review");
  const rejected=await reduceCaseCommand(data,command("legalCheck.dispose",{runId:legalRun.id,checkId:legalRun.checkId},{status:"rejected",evidenceFactIds:["fact-1"],role:"lawyer"}),{...actor,legalRun,legalRunVerified:true});
  assert.equal(rejected.data.workflowState?.legalDispositions[0]?.status,"rejected");
});

test("document role validates enums and preserves immutable filed-form role",async()=>{
  const data=factCase();data.pages[0]!.role="filed_form";
  await assert.rejects(reduceCaseCommand(data,command("document.role",{documentId:"doc-1",page:1},{role:"bogus"}),actor),err("INVALID_COMMAND"));
  await assert.rejects(reduceCaseCommand(data,command("document.role",{documentId:"doc-1",page:1},{role:"evidence"}),actor),err("IMMUTABLE_PAGE_ROLE"));
  const mutable=factCase(),result=await reduceCaseCommand(mutable,command("document.role",{documentId:"doc-1",page:1},{role:"administrative"}),actor);
  assert.equal(result.data.pages[0]!.role,"administrative");assert.equal(currentFacts(result.data).length,0);assert.equal(result.data.facts.at(-1)?.state,"retracted");assert.deepEqual(result.impact.pageRoleMutation,{documentId:"doc-1",page:1,role:"administrative"});
});

test("source references and workflow enum branches reject stale or fabricated identifiers",async()=>{
  const data=factCase();
  await assert.rejects(reduceCaseCommand(data,command("object.upsert",{collection:"debts"},{item:{creditor:"X"},source:{documentId:"doc-1",page:9,quote:"fake"}}),actor));
  await assert.rejects(reduceCaseCommand(data,command("subject.link",{linkId:"none"},{operation:"other",expectedVersion:1,evidenceRefs:[]}),actor));
  await assert.rejects(reduceCaseCommand(data,command("requirement.override",{requirementId:"none"},{operation:"not-a-disposition"}),actor));
  await assert.rejects(reduceCaseCommand(data,command("document.match",{requirementId:"none"},{operation:"other"}),actor));
});

test("requirement mapping review uses a current crosswalk, human reviewer, and valid typed targets",async()=>{
  const data=factCase(),workflow=emptyCaseWorkflow();
  const requirement=makeCaseRequirement({intakeRunId:"run-1",availableFieldIds:["income.net"],crosswalk:{crosswalkId:"crosswalk-1",familyId:"income",version:"v1",requiredFieldGroups:[],optionalFieldIds:[],typedTargets:[],reviewState:"review_required",coveragePolicy:"unreviewed"},source:{id:"need-1",documentTypeId:"income_record",documentName:"income record",subjectId:"case",subjectLabel:"case",period:"current",requirement:"required_when_applicable",status:"requested",reason:[],matchedRuleIds:[],workflowIds:[],sourceClaimIds:[],sourceIds:[],alternatives:[],alternativePolicy:"any_of",fields:[],issuer:"synthetic"},idFactory:()=>"requirement-1"});
  workflow.requirements=[requirement];data.workflowState=workflow;
  const target={requirementId:requirement.requirementId},mappingReview={expectedCrosswalkId:"crosswalk-1",expectedCrosswalkVersion:"v1",requiredFieldGroups:[["income.net"]],optionalFieldIds:[],typedTargets:[{fieldId:"income.net",targetPath:"incomes[].net"}],noRequiredFields:false,subjectScope:"case",periodPolicy:"current"};
  await assert.rejects(reduceCaseCommand(data,command("requirement.override",target,{operation:"review_mapping",mappingReview:{...mappingReview,expectedCrosswalkVersion:"stale"}}),actor));
  const result=await reduceCaseCommand(data,command("requirement.override",target,{operation:"review_mapping",mappingReview}),actor);
  assert.equal(result.data.workflowState?.requirements[0]?.mappingRequired,false);assert.equal(result.data.workflowState?.requirements[0]?.crosswalkReview?.reviewer,actor.actor);
});

test("document edits require a matching server-loaded base and hash",async()=>{
  const data=factCase();data.exportManifest={caseRevision:1,mode:"final",requiredKinds:["statement"],files:[{id:"artifact-1",kind:"statement",name:"statement",hash:"hash",status:"current"}],reviews:{caseworker:null,lawyer:null}};
  const cmd=command("document.edit",{artifactId:"artifact-1",fieldId:"statement"},{value:"updated",baseValue:"base"},{baseValueHash:await documentEditBaseHash({artifactId:"artifact-1",fieldId:"statement",rowId:null,value:"base"})});
  await assert.rejects(reduceCaseCommand(data,cmd,actor),err("CASE_STATE_CONFLICT"));
  const result=await reduceCaseCommand(data,cmd,{...actor,documentBases:[{artifactId:"artifact-1",fieldId:"statement",rowId:null,value:"base"}]});
  assert.equal(result.data.workflowState?.documentEdits[0]?.value,"updated");
});
