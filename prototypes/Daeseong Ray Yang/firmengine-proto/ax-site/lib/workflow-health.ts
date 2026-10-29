import type { CaseData } from "./domain.ts";
import { caseWorkflow } from "./case-workflow-state.ts";

export interface HealthJob { id:string; status:string; attempts:number; createdAt:string; updatedAt:string }
export interface HealthCommand { commandId:string; commandType:string; revision:number; at:string }
/** Diagnostic projection deliberately excludes source values, notes, personal IDs and errors. */
export function workflowHealth(input:{data:CaseData;stateFingerprint:string;jobs:HealthJob[];commands:HealthCommand[];jobsTruncated:boolean;commandsTruncated:boolean;requiredUnresolved:number;reconciliationIssues:readonly string[];now:string}) {
  const workflow=caseWorkflow(input.data.workflowState),time=Date.parse(input.now);
  const elapsed=(from:string,to=input.now)=>{const duration=Date.parse(to)-Date.parse(from);return Number.isFinite(duration)&&duration>=0?duration:null;};
  const waiting=input.jobs.filter(job=>["pending","running","retry_wait"].includes(job.status));
  const failed=input.jobs.filter(job=>job.status==="failed"),stale=input.jobs.filter(job=>job.status==="superseded");
  const openTasks=workflow.tasks.filter(task=>!["resolved","dismissed"].includes(task.status));
  const completed=input.jobs.filter(job=>job.status==="complete").map(job=>({jobId:job.id,saveToEvaluationMs:elapsed(job.createdAt,job.updatedAt)}));
  const documentResults=input.data.exportManifest?.documentWriter?.formResults??[];
  const unresolvedDocumentFields=documentResults.reduce((count,form)=>count+form.unresolved.length,0);
  const currentArtifactIds=(input.data.exportManifest?.files??[]).filter(file=>file.status==="current").map(file=>({id:file.id,sha256:file.hash}));
  return {
    schema:"workflow-health/1" as const,observedAt:input.now,
    identity:{caseId:input.data.context.id,revision:input.data.context.revision,stateFingerprint:input.stateFingerprint},
    status:failed.length?"failed":waiting.length?"pending":input.requiredUnresolved||input.reconciliationIssues.length||workflow.projectionBlockers.length||unresolvedDocumentFields?"review_required":"complete",
    coverage:{jobsTruncated:input.jobsTruncated,commandsTruncated:input.commandsTruncated,monitorRuntime:"not_observed"},
    evaluation:{pending:waiting.length,failed:failed.length,superseded:stale.length,completed,oldestPendingAgeMs:waiting.length?Math.max(...waiting.map(job=>elapsed(job.createdAt)??0)):null,retryAttempts:input.jobs.reduce((n,job)=>n+job.attempts,0)},
    tasks:{open:openTasks.length,unassigned:openTasks.filter(task=>!task.ownerId).length,overdue:openTasks.filter(task=>task.dueAt&&Date.parse(`${task.dueAt}T23:59:59+09:00`)<time).length,oldestAgeMs:openTasks.length?Math.max(...openTasks.map(task=>elapsed(task.createdAt)??0)):null},
    blockers:{requirements:input.requiredUnresolved,projection:workflow.projectionBlockers.length,reconciliation:input.reconciliationIssues.length,unresolvedDocumentFields},
    commands:input.commands.map(command=>({commandId:command.commandId,commandType:command.commandType,revision:command.revision,at:command.at})),
    artifacts:currentArtifactIds,
    recovery:{responsibleRole:"case_editor",professionalReviewRole:"designated_human_reviewer",modelCallsStarted:0,automaticAttemptsLimit:5,manualRetryRequiresCurrentFingerprint:true},
  };
}
export type WorkflowHealth=ReturnType<typeof workflowHealth>;
