import test from "node:test";
import assert from "node:assert/strict";
import { createCase } from "../lib/domain.ts";
import { caseWorkflow } from "../lib/case-workflow-state.ts";
import { makeCaseTask } from "../lib/case-tasks.ts";
import { workflowHealth } from "../lib/workflow-health.ts";

test("workflow health counts retry waits, failures, superseded work and open task ages without source data",async()=>{
 const data=createCase("private name excluded","synthetic-owner","2026-10-29");
 const task=await makeCaseTask({type:"review",subject:"f1",title:"private title excluded",dependency:{},at:"2026-10-27T00:00:00Z"});task.dueAt="2026-10-28";
 data.workflowState=caseWorkflow({tasks:[task,{...task,id:"closed",dedupeKey:"closed",status:"resolved"}]});
 const before=structuredClone(data),at="2026-10-29T00:00:00Z";
 const jobs=["pending","retry_wait","failed","superseded","complete"].map((status,index)=>({id:`job-${index}`,status,attempts:2,createdAt:"2026-10-28T00:00:00Z",updatedAt:at}));
 const health=workflowHealth({data,jobs,commands:[{commandId:"cmd-1",commandType:"fact.correct",revision:2,at}],stateFingerprint:"case-state/test",jobsTruncated:true,commandsTruncated:false,requiredUnresolved:1,reconciliationIssues:["budget mismatch"],now:at});
 assert.equal(health.status,"failed");assert.equal(health.evaluation.pending,2);assert.equal(health.evaluation.failed,1);assert.equal(health.evaluation.superseded,1);assert.equal(health.evaluation.completed[0].saveToEvaluationMs,86400000);
 assert.deepEqual(health.tasks,{open:1,unassigned:1,overdue:1,oldestAgeMs:172800000});assert.equal(health.coverage.jobsTruncated,true);assert.equal(health.coverage.monitorRuntime,"not_observed");
 assert.equal(health.recovery.modelCallsStarted,0);assert.equal(JSON.stringify(health).includes("private"),false);assert.deepEqual(data,before);
});

test("empty or partial diagnostics do not invent monitor success or negative latency",()=>{
 const data=createCase("fixture","synthetic-owner","2026-10-29");
 const health=workflowHealth({data,stateFingerprint:"state",jobs:[{id:"bad-clock",status:"complete",attempts:1,createdAt:"2026-10-30",updatedAt:"2026-10-29"}],commands:[],jobsTruncated:false,commandsTruncated:true,requiredUnresolved:2,reconciliationIssues:[],now:"2026-10-29T00:00:00Z"});
 assert.equal(health.status,"review_required");assert.equal(health.evaluation.completed[0].saveToEvaluationMs,null);assert.equal(health.tasks.oldestAgeMs,null);assert.equal(health.coverage.commandsTruncated,true);
});
