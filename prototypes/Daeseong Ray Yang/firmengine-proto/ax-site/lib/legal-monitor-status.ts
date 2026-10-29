export interface MonitorSourceObservation { sourceId:string; status:"success"|"partial"|"failed"; bodyHash?:string|null; attachmentHashes?:readonly string[]; observedAt?:string }
export interface MonitorSourceStatus { sourceId:string; state:"first_observation"|"unchanged"|"content_changed"|"attachment_changed"|"partial_failure"|"failed"; baselineUpdated:boolean; changed:boolean }
/** Configured intent and scheduler execution are independent signals. */
export function monitorSchedulerStatus(configured:boolean, scheduler:{enabled:boolean;lastSuccessAt?:string|null;nextRunAt?:string|null}) {
 return {configured,enabled:scheduler.enabled,lastSuccessAt:scheduler.lastSuccessAt??null,nextRunAt:scheduler.nextRunAt??null,running:configured&&scheduler.enabled};
}
export function classifyMonitorObservation(current:MonitorSourceObservation, previous?:MonitorSourceObservation):MonitorSourceStatus {
 if(current.status==="failed") return {sourceId:current.sourceId,state:"failed",baselineUpdated:false,changed:false};
 if(current.status==="partial") return {sourceId:current.sourceId,state:"partial_failure",baselineUpdated:false,changed:false};
 if(!previous) return {sourceId:current.sourceId,state:"first_observation",baselineUpdated:true,changed:false};
 if(previous.status!=="success") return {sourceId:current.sourceId,state:"first_observation",baselineUpdated:true,changed:false};
 const content=current.bodyHash!==previous.bodyHash;
 const attachments=[...(current.attachmentHashes??[])].sort().join("|")!==[...(previous.attachmentHashes??[])].sort().join("|");
 return {sourceId:current.sourceId,state:content?"content_changed":attachments?"attachment_changed":"unchanged",baselineUpdated:true,changed:content||attachments};
}
export interface MonitorRunStatus { status:string; completedAt?:string|null }
/** User-entered schedule intent is never treated as proof of an executing scheduler. */
export function projectMonitorSchedule(config?:Readonly<Record<string,unknown>>,runs:readonly MonitorRunStatus[]=[]) {
  const observed=config?.observedRuntime;
  const runtimeStatus=observed==="enabled"||observed==="disabled"?observed:"unverified";
  const lastSuccess=runs.find(run=>run.status==="complete");
  const lastFailure=runs.find(run=>run.status==="failed"||run.status==="partial");
  return {
    cadence:"daily",timezone:"Asia/Seoul",hour:9,notification:"chatgpt_and_in_app",
    configured:config?.configured===true,desiredConfigured:config?.configured===true,
    automationId:typeof config?.automationId==="string"?config.automationId:null,
    runtimeStatus,schedulerEnabled:runtimeStatus==="enabled"?true:runtimeStatus==="disabled"?false:null,
    lastSuccessAt:lastSuccess?.completedAt??null,
    lastFailure:lastFailure?{status:lastFailure.status,at:lastFailure.completedAt??null}:null,
  } as const;
}
