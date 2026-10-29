import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { taskDashboardQuery } from "../lib/task-dashboard-query.ts";
import { mergeCaseTasks, type CaseTask } from "../lib/case-tasks.ts";
import { createCase } from "../lib/domain.ts";
import { reduceCaseCommand } from "../lib/case-commands.ts";
import { caseWorkflow } from "../lib/case-workflow-state.ts";

const baseTask=(id:string,dependencyFingerprint:string):CaseTask=>({id,dedupeKey:"requirement:req-1",type:"requirement",title:"요구 자료 확인",ownerId:null,dueAt:null,waitingOn:null,blockedBy:[],status:"open",dependencyFingerprint,evidenceIds:[],reason:"근거 확인",createdAt:"2026-10-29T00:00:00.000Z",updatedAt:"2026-10-29T00:00:00.000Z",history:[]});

test("AT-20 task filters use the same owner/status relation for visible rows and total",()=>{
  const sqlite=new DatabaseSync(":memory:");
  try{
    sqlite.exec("CREATE TABLE cases(id TEXT PRIMARY KEY,name TEXT); CREATE TABLE case_tasks(id TEXT PRIMARY KEY,case_id TEXT,dedupe_key TEXT,type TEXT,owner_id TEXT,due_at TEXT,waiting_on TEXT,blocked_by TEXT,status TEXT,dependency_fingerprint TEXT,payload TEXT,created_at TEXT,updated_at TEXT);");
    sqlite.prepare("INSERT INTO cases VALUES(?,?)").run("case-a","사건 A");
    const insert=sqlite.prepare("INSERT INTO case_tasks VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)");
    const rows=[
      ["open-owner", "staff-a","open"],["waiting-owner","staff-a","waiting"],["open-other","staff-b","open"],["open-unassigned",null,"open"],
    ] as const;
    for(const [id,owner,status] of rows)insert.run(id,"case-a",`task:${id}`,"requirement",owner,null,null,"[]",status,"dep",JSON.stringify({title:id,reason:"test"}),"2026-10-29T00:00:00Z","2026-10-29T00:00:00Z");
    const filtered=taskDashboardQuery({ownerId:"staff-a",status:"open",limit:10,offset:0});
    const first=sqlite.prepare(filtered.sql).get(...filtered.params as (string|number|null)[]) as {total:number;items:string};
    assert.equal(first.total,1);assert.deepEqual(JSON.parse(first.items).map((row:{id:string})=>row.id),["open-owner"]);
    const page=taskDashboardQuery({ownerId:"staff-a",status:"all",limit:1,offset:1});
    const second=sqlite.prepare(page.sql).get(...page.params as (string|number|null)[]) as {total:number;items:string};
    assert.equal(second.total,2);assert.deepEqual(JSON.parse(second.items).map((row:{id:string})=>row.id),["waiting-owner"]);
    const unassigned=taskDashboardQuery({ownerId:"unassigned",status:"open",limit:10,offset:0});
    const third=sqlite.prepare(unassigned.sql).get(...unassigned.params as (string|number|null)[]) as {total:number;items:string};
    assert.equal(third.total,1);assert.equal(JSON.parse(third.items)[0].id,"open-unassigned");
  }finally{sqlite.close();}
});

test("AT-21 repeated blocker refreshes the existing task by dedupe key",()=>{
  const initial=baseTask("stable-task-id","dependency-v1");initial.ownerId="staff-a";initial.status="in_progress";initial.history=[{at:initial.updatedAt,actor:"staff-a",status:"in_progress",reason:"started"}];
  const repeated=mergeCaseTasks([initial],[{...baseTask("new-transient-id","dependency-v2"),title:"Updated requirement review",updatedAt:"2026-10-30T00:00:00.000Z"}]);
  assert.equal(repeated.length,1);assert.equal(repeated[0].id,"stable-task-id");assert.equal(repeated[0].dependencyFingerprint,"dependency-v2");assert.equal(repeated[0].title,"Updated requirement review");assert.equal(repeated[0].ownerId,"staff-a");assert.deepEqual(repeated[0].history,initial.history);
});

test("AT-22 assignee-only task update preserves calculation inputs and legal approval records",async()=>{
  const data=createCase("Task update acceptance","task-update-case","2026-10-29"),task=baseTask("task-1","dep-1");
  data.context.ruleApplicationReviewed=true;data.context.referenceReviewSha256="a".repeat(64);data.context.incomePeriodReviewed=true;data.context.paymentSchedule={reviewed:true,reviewReason:"checked",expectedInstallments:1,phases:[]};
  data.workflowState=caseWorkflow({tasks:[task],legalDispositions:[{checkId:"check-1",runId:"run-1",subjectFingerprint:"subject",dependencyFingerprint:"dependency",status:"accepted",evidenceFactIds:["fact-1"],reason:"reviewed",actor:"lawyer-a",role:"lawyer",at:"2026-10-29T00:00:00.000Z"}]});
  const beforeContext=structuredClone(data.context),beforeIncome=structuredClone(data.incomes),beforeDebts=structuredClone(data.debts),beforeApprovals=structuredClone(data.workflowState.legalDispositions);
  const command={commandId:"task-owner-change-1",commandType:"task.update" as const,payloadVersion:1 as const,expectedRevision:1,expectedStateFingerprint:`case-state/1:${"b".repeat(64)}`,target:{taskId:task.id},patch:{ownerId:"staff-b"},reason:"담당자 배정 변경"};
  const result=await reduceCaseCommand(data,command,{actor:"staff-editor",roles:["case_editor"],at:"2026-10-30T00:00:00.000Z"});
  assert.equal(result.data.workflowState?.tasks[0]?.ownerId,"staff-b");
  assert.deepEqual(result.data.context,beforeContext);assert.deepEqual(result.data.incomes,beforeIncome);assert.deepEqual(result.data.debts,beforeDebts);
  assert.deepEqual(result.data.workflowState?.legalDispositions,beforeApprovals);
});

test("AT-67 legacy and forward workflow fields survive normalization without dropping stored data",()=>{
  const legacy=caseWorkflow({schema:"case-workflow/1",version:4,requirements:[],subjectLinks:[],documentMatches:[]} as never);
  assert.deepEqual(legacy.tasks,[]);assert.deepEqual(legacy.legalDispositions,[]);assert.equal(legacy.version,4);
  const forward=caseWorkflow({schema:"case-workflow/1",version:5,requirements:[],subjectLinks:[],documentMatches:[],futureWorkflowReceipt:{field:"preserve-me",nested:{value:7}}} as never) as typeof legacy&{futureWorkflowReceipt:unknown};
  const normalizedAgain=caseWorkflow(forward) as typeof forward;
  assert.deepEqual(normalizedAgain.futureWorkflowReceipt,{field:"preserve-me",nested:{value:7}});
  assert.deepEqual(normalizedAgain,forward);
});
