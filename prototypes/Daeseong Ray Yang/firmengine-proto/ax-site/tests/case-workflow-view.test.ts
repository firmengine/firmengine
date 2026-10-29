import test from "node:test";
import assert from "node:assert/strict";
import { createCase, type CaseData, type Fact } from "../lib/domain.ts";
import { buildCaseWorkflowView } from "../lib/case-workflow-view.ts";
import { applyRequirementOverride, makeCaseRequirement } from "../lib/case-requirements.ts";
import { emptyCaseWorkflow } from "../lib/case-workflow-state.ts";
import type { IntakeRequirement } from "../lib/intake-types.ts";

const fieldId="bank.balance";
const source:IntakeRequirement={id:"r",documentTypeId:"bank_statement",documentName:"Bank statement",subjectId:"case",subjectLabel:"신청인",period:"12 months",requirement:"required_when_applicable",status:"requested",reason:["rule"],matchedRuleIds:["r1"],workflowIds:["wf"],sourceClaimIds:["c1"],sourceIds:["s1"],alternatives:[],alternativePolicy:"any_of",fields:[fieldId],issuer:"Bank"};
const requirement=()=>makeCaseRequirement({source,intakeRunId:"run1",subjectLinkId:"subject-link",scopeKey:"intake-subject:case",fieldGroups:[[fieldId]],mappingRequired:false,idFactory:()=>"requirement-1"});
function baseCase():CaseData {
  const data=createCase("Workflow projection test","20000000-0000-4000-8000-000000000001","2025-12-31");
  data.documents=[{id:"doc1",sha256:"a".repeat(64),name:"Bank statement",status:"active",pages:[1]}];
  data.pages=[{documentId:"doc1",page:1,role:"evidence",documentType:"bank_statement",text:"Balance 100; corrected Balance 200",fieldCoverage:{version:"field-observation-2",documentId:"doc1",page:1,sourceSha256:"a".repeat(64),familyId:"bank_statement",catalogRelease:"test",catalogSha256:"b".repeat(64),completeReadClaim:true,observations:[]} as any}];
  data.facts=[fact(1,"fact1","100","Balance 100")];
  const workflow=emptyCaseWorkflow();
  workflow.requirements=[requirement()];
  workflow.subjectLinks=[{linkId:"subject-link",intakeRunId:"run1",intakeSubjectId:"case",subjectScope:"case",typedEntityId:"applicant",scopeKey:"intake-subject:case",status:"confirmed",basisRefs:["staff-confirmation"],version:2,reviewer:"caseworker"}];
  workflow.documentMatches=[{matchId:"match1",requirementId:"requirement-1",subjectLinkId:"subject-link",documentId:"doc1",pageIds:["doc1:1"],coveredPeriod:{start:"2025-01",end:"2025-12"},sourceDocumentHash:"a".repeat(64),state:"accepted",version:2,reason:"reviewed source match",staffReviewer:"caseworker",dispositionFingerprint:"match-fingerprint"}];
  data.workflowState=workflow;
  return data;
}
function fact(version:number,id:string,value:string,quote:string):Fact {
  return {id,logicalId:"balance",version,subjectId:"case",key:"bank.balance",canonicalFieldId:fieldId,value,state:"extracted",recognition:"unreviewed",refs:[{documentId:"doc1",page:1,quote,sourceHash:"a".repeat(64)}],validation:[]};
}

test("view derives completion only from current accepted match, evidence page, and source-backed current fact",async()=>{
  const data=baseCase();
  const view=await buildCaseWorkflowView(data);
  const state=view.requirementStates[0];
  assert.equal(state.engineFulfillment,"complete");
  assert.equal(state.staffDisposition,"unreviewed");
  assert.equal(state.requirementStatus,"eligible_for_confirmation");
  assert.deepEqual(state.requiredFieldCoverage,{required:[fieldId],covered:[fieldId],missing:[]});
  assert.equal(state.reception[0].primaryStatus,"read_complete");
  assert.equal(data.facts[0].recognition,"unreviewed");
  assert.equal(data.facts[0].sourceVerification,undefined);
});

test("one current source fact is shared across two requirement links for the same document",async()=>{
  const data=baseCase(),second={...requirement(),requirementId:"requirement-2",originKey:"second-purpose",scopeKey:"second-purpose"};
  data.workflowState!.requirements.push(second);
  data.workflowState!.documentMatches.push({...data.workflowState!.documentMatches[0]!,matchId:"match-2",requirementId:second.requirementId});
  const view=await buildCaseWorkflowView(data);
  assert.equal(data.facts.length,1);
  assert.deepEqual(view.requirementStates.map(state=>state.requiredFieldCoverage.covered),[[fieldId],[fieldId]]);
  assert.deepEqual(view.requirementStates.map(state=>state.requirementStatus),["eligible_for_confirmation","eligible_for_confirmation"]);
});

test("fact alone or fabricated accepted status without a live match cannot satisfy a requirement",async()=>{
  const data=baseCase();
  data.workflowState!.documentMatches=[];
  const view=await buildCaseWorkflowView(data);
  assert.equal(view.requirementStates[0].engineFulfillment,"missing");
  assert.equal(view.requirementStates[0].requirementStatus,"missing");
  assert.equal(view.requirementStates[0].requiredFieldCoverage.missing[0],fieldId);
});

test("rejected recognition cannot fulfill a requirement and court ordered obligations remain required",async()=>{
  const data=baseCase();
  data.facts[0].recognition="rejected";
  data.workflowState!.requirements[0].requirement="court_ordered";
  const state=(await buildCaseWorkflowView(data)).requirementStates[0];
  assert.equal(state.required,true);
  assert.deepEqual(state.requiredFieldCoverage.covered,[]);
  assert.deepEqual(state.requiredFieldCoverage.missing,[fieldId]);
  assert.equal(state.engineFulfillment,"partial");
});

test("stale document hash or wrong page role cannot count as accepted evidence",async()=>{
  const data=baseCase();
  data.documents[0].sha256="c".repeat(64);
  const changed=await buildCaseWorkflowView(data);
  assert.equal(changed.requirementStates[0].engineFulfillment,"stale");
  data.documents[0].sha256="a".repeat(64);
  data.pages[0].role="administrative";
  const wrongRole=await buildCaseWorkflowView(data);
  assert.equal(wrongRole.requirementStates[0].engineFulfillment,"stale");
  assert.notEqual(wrongRole.requirementStates[0].reception[0].primaryStatus,"read_complete");
});

test("workflow confirmation is current only for the exact requirement, match, and fact dependencies",async()=>{
  const data=baseCase();
  const initial=await buildCaseWorkflowView(data);
  assert.equal(initial.requirementStates[0].requirementStatus,"eligible_for_confirmation");
  data.workflowState!.requirementConfirmations.push({requirementId:"requirement-1",fingerprint:initial.requirementFingerprints["requirement-1"],actor:"caseworker",at:"2025-12-31T00:00:00Z",reason:"Evidence reviewed"});
  assert.equal((await buildCaseWorkflowView(data)).requirementStates[0].requirementStatus,"satisfied");

  data.facts.push(fact(2,"fact2","200","corrected Balance 200"));
  const corrected=await buildCaseWorkflowView(data);
  assert.notEqual(corrected.requirementFingerprints["requirement-1"],initial.requirementFingerprints["requirement-1"]);
  assert.equal(corrected.requirementStates[0].staffDisposition,"stale");
  assert.equal(corrected.requirementStates[0].requirementStatus,"stale");

  const sameIdCorrection=baseCase(),before=await buildCaseWorkflowView(sameIdCorrection);
  sameIdCorrection.facts[0]={...sameIdCorrection.facts[0],value:"200",rawValue:"200"};
  const after=await buildCaseWorkflowView(sameIdCorrection);
  assert.notEqual(after.requirementFingerprints["requirement-1"],before.requirementFingerprints["requirement-1"]);

  data.workflowState!.requirements[0]=applyRequirementOverride(data.workflowState!.requirements[0],{operation:"change_period",expectedId:"requirement-1",period:"6 months",reason:"Period reviewed"});
  const overrideView=await buildCaseWorkflowView(data);
  assert.equal(overrideView.requirementStates[0].staffDisposition,"stale");
  data.workflowState!.documentMatches[0]={...data.workflowState!.documentMatches[0],state:"unlinked",version:3};
  const unlinked=await buildCaseWorkflowView(data);
  assert.equal(unlinked.requirementStates[0].staffDisposition,"stale");
  assert.equal(unlinked.requirementStates[0].requirementStatus,"stale");
});

test("period coverage uses bounded valid calendar ranges",async()=>{
  const data=baseCase();
  data.workflowState!.documentMatches[0].coveredPeriod={start:"2025-01",end:"2025-11"};
  assert.equal((await buildCaseWorkflowView(data)).requirementStates[0].engineFulfillment,"partial");
  data.workflowState!.documentMatches[0].coveredPeriod={start:"2025-00",end:"9999-12"};
  assert.equal((await buildCaseWorkflowView(data)).requirementStates[0].engineFulfillment,"conflict");
});
