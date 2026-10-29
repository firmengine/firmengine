import test from "node:test";
import assert from "node:assert/strict";
import { createCase } from "../lib/domain.ts";
import { caseWorkflow } from "../lib/case-workflow-state.ts";
import { legalReviewInputFingerprint,currentLegalDispositionOutcome,projectLegalRunConflicts } from "../lib/legal-review-identity.ts";
import { finalWorkflowBlockers } from "../lib/document-workflow-gate.ts";

function fixture(){
 const data=createCase("Review identity","review-identity","2026-10-29");
 data.workflowState=caseWorkflow();
 return data;
}
const reference="1".repeat(64),contract="execution-contract-test/1";

test("legal-review fingerprint ignores revision, assignment, disposition and review-cycle metadata",async()=>{
 const data=fixture(),before=await legalReviewInputFingerprint(data,reference,contract);
 data.context.revision++;
 data.workflowState!.tasks.push({id:"task-1",kind:"review",title:"Review",description:"",status:"open",assignedTo:"reviewer-a",createdAt:"2026-10-29T00:00:00Z"} as never);
 data.workflowState!.legalDispositions.push({checkId:"check-1",runId:"old",subjectFingerprint:"s",status:"accepted",evidenceFactIds:["fact"],reason:"reviewed",actor:"reviewer",role:"lawyer",at:"2026-10-29T00:00:00Z",dependencyFingerprint:"old-dep"});
 data.context.ruleApplicationReviewed=true;
 assert.equal(await legalReviewInputFingerprint(data,reference,contract),before);
});

test("legal-review fingerprint changes when case facts, source bytes, calculation context, or rule release changes",async()=>{
 const data=fixture(),base=await legalReviewInputFingerprint(data,reference,contract);
 data.context.planMonths=36;
 assert.notEqual(await legalReviewInputFingerprint(data,reference,contract),base);
 delete data.context.planMonths;
 data.context.ruleReleaseId="new-rule-release";
 assert.notEqual(await legalReviewInputFingerprint(data,reference,contract),base);
 data.context.ruleReleaseId="draft";
 data.documents.push({id:"doc",name:"source.pdf",sha256:"a".repeat(64),status:"active",pages:[1]});
 assert.notEqual(await legalReviewInputFingerprint(data,reference,contract),base);
 data.documents[0]!.sha256="b".repeat(64);
 assert.notEqual(await legalReviewInputFingerprint(data,reference,contract),base);
 assert.notEqual(await legalReviewInputFingerprint(data,"2".repeat(64),contract),base);
 assert.notEqual(await legalReviewInputFingerprint(data,reference,"execution-contract-test/2"),base);
});

test("stale accepted reviews cannot clear final blockers; rejected reviews remain blocking",()=>{
 const disposition={checkId:"rule-1",runId:"run-old",subjectFingerprint:"subject",dependencyFingerprint:"input-old",status:"accepted" as const};
 const newRun={checkId:"rule-1",id:"run-new",subjectFingerprint:"subject",dependencyFingerprint:"input-new",status:"pass"};
 const outcome=currentLegalDispositionOutcome(disposition,[newRun]);
 assert.equal(outcome,"needs_review");
 assert.ok(finalWorkflowBlockers({workflowAdopted:true,legalChecks:[{checkId:"rule-1",state:"current",disposition:outcome}]}).includes("legal:rule-1:needs_review"));
 const rejected={...disposition,status:"rejected" as const};
 const rejectedOutcome=currentLegalDispositionOutcome(rejected,[newRun]);
 assert.equal(rejectedOutcome,"rejected");
 assert.ok(finalWorkflowBlockers({workflowAdopted:true,legalChecks:[{checkId:"rule-1",state:"current",disposition:rejectedOutcome}]}).includes("legal:rule-1:rejected"));
 const current={...disposition,runId:"run-new",dependencyFingerprint:"input-new"};
 assert.equal(currentLegalDispositionOutcome(current,[newRun]),"accepted");
 assert.deepEqual(finalWorkflowBlockers({workflowAdopted:true,legalChecks:[{checkId:"rule-1",state:"current",disposition:"accepted"}]}),[]);
});

test("same-subject current runs expose outcome conflict and evidence without letting an acceptance clear it",()=>{
 const runs=[
  {id:"run-pass",checkId:"rule-1",subjectFingerprint:"same-subject",dependencyFingerprint:"dep",status:"pass",factIds:["fact-a"]},
  {id:"run-fail",checkId:"rule-1",subjectFingerprint:"same-subject",dependencyFingerprint:"dep",status:"fail",factIds:["fact-b"]},
  {id:"run-other",checkId:"rule-2",subjectFingerprint:"other-subject",dependencyFingerprint:"dep",status:"pass",factIds:["fact-c"]},
 ];
 const projected=projectLegalRunConflicts(runs);
 assert.equal(projected[0]?.conflict,true);assert.deepEqual(projected[0]?.conflictingStatuses,["fail","pass"]);
 assert.deepEqual(projected[0]?.conflictingRunIds,["run-fail","run-pass"]);assert.deepEqual(projected[0]?.conflictingFactIds,["fact-a","fact-b"]);
 assert.equal(projected[2]?.conflict,false);
 const accepted={checkId:"rule-1",runId:"run-pass",subjectFingerprint:"same-subject",dependencyFingerprint:"dep",status:"accepted" as const};
 assert.equal(currentLegalDispositionOutcome(accepted,runs),"needs_review");
 assert.ok(finalWorkflowBlockers({workflowAdopted:true,legalChecks:[{checkId:"rule-1",state:"current",disposition:currentLegalDispositionOutcome(accepted,runs)}]}).some(item=>item==="legal:rule-1:needs_review"));
});
