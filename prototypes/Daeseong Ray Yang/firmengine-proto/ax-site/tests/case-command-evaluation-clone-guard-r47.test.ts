import test from "node:test";
import assert from "node:assert/strict";
import {createCase,normalizeMoney,currentFacts,type Fact} from "../lib/domain.ts";
import {reduceCaseCommand} from "../lib/case-commands.ts";
import type {CaseCommand} from "../lib/case-command-contract.ts";

/** Synthetic fixtures only. No actual customer, OCR, or court information. */
const actor={actor:"reviewer-synthetic",roles:["case_editor","caseworker_review","lawyer_review"],at:"2026-11-01T00:00:00Z"};
function fixture() {
 const data=createCase("Synthetic standalone evaluation clone", "a1-r47-clone-guard", "2026-11-01");
 // This intentionally has evaluationClone alone, not structuredTest or referenceTest.
 data.evaluationClone={sourceCaseId:"a1-r47-source",sourceInputSha256:"a".repeat(64),createdAt:"2026-11-01T00:00:00Z",finalSubmissionProhibited:true};
 data.documents=[{id:"doc-a",name:"synthetic-evidence",sha256:"b".repeat(64),status:"active",pages:[1]}];
 data.pages=[{documentId:"doc-a",page:1,role:"evidence",text:"synthetic debt 100 KRW"}];
 const fact={id:"fact-a",logicalId:"debt-a:principal",version:1,subjectId:"debt-a",key:"debt.principal",value:"100",state:"verified",recognition:"unreviewed",refs:[{documentId:"doc-a",page:1,quote:"synthetic debt 100 KRW",sourceHash:"b".repeat(64)}],validation:[] } as Fact;
 data.facts=[fact];
 data.debts=[{id:"debt-a",creditor:"synthetic creditor",principal:normalizeMoney("100","원"),secured:"unknown",classification:"unknown",factIds:["fact-a"]}];
 return data;
}
function command(commandType:CaseCommand["commandType"],target:Record<string,unknown>,patch:Record<string,unknown>):CaseCommand{
 return {commandId:"a1-r47-"+commandType,payloadVersion:1,commandType,
  expectedRevision:1,expectedStateFingerprint:"case-state/1:"+"a".repeat(64),
  reason:"synthetic safety guard verification",target,patch} as CaseCommand;
}
test("standalone evaluation clone prohibits factual approval despite both human role grants",async()=>{
 const data=fixture();
 await assert.rejects(
  reduceCaseCommand(data,command("fact.review",{factId:"fact-a"},{state:"verified",recognition:"accepted"}),actor),
  {code:"SYNTHETIC_REVIEW_PROHIBITED"});
 assert.equal(currentFacts(data)[0]?.recognition,"unreviewed");
});
test("standalone evaluation clone prohibits typed debt acceptance",async()=>{
 const data=fixture();
 await assert.rejects(
  reduceCaseCommand(data,command("object.review",{collection:"debts",objectId:"debt-a"},{recognition:"accepted"}),actor),
  {code:"SYNTHETIC_REVIEW_PROHIBITED"});
 assert.equal(data.debts[0]?.legalReview,undefined);
});
test("standalone evaluation clone cannot record synthetic court submission",async()=>{
 const data=fixture();
 await assert.rejects(
  reduceCaseCommand(data,command("procedure.record",{},{
   state:"submitted",occurredAt:"2026-11-01",sourceDocumentIds:["doc-a"],
   courtReference:"synthetic-court-ref",relatedFields:[],artifactIds:[]
  }),actor),
  {code:"SYNTHETIC_FINAL_PROHIBITED"});
 assert.equal(data.workflowState?.procedureEvents.length??0,0);
});
