import type {CaseData} from "./domain.ts";
import {runCaseCalculatorNode} from "./case-agent.ts";
import {getCaseDataUpdateState} from "./case-data-watch.ts";
import {persistCaseCalculationFeatures} from "./case-calculation-feature-store.ts";
import {buildCaseFeatureSnapshot} from "./case-feature-snapshot.ts";

export const CASE_DATA_QUIET_PERIOD_MS=600_000;
type Clock=()=>number;
const instant=(value:string|null|undefined)=>{
  if(!value)return null;
  const iso=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)?value.replace(" ","T")+"Z":value;
  const time=Date.parse(iso);return Number.isFinite(time)?time:null;
};
/** Pure clock-based policy; computed writes do not extend the source quiet time. */
export function caseDataQuietWindow(lastChangedAt:string|null|undefined,now=Date.now()){
  const changed=instant(lastChangedAt);
  if(changed===null)return {isQuiet:false,dueAt:null,remainingMs:null};
  const due=changed+CASE_DATA_QUIET_PERIOD_MS;
  return {isQuiet:now>=due,dueAt:new Date(due).toISOString(),remainingMs:Math.max(0,due-now)};
}
export async function getCaseDataRecomputeEligibility(database:D1Database,input:{caseId:string;now?:Clock}){
  const state=await getCaseDataUpdateState(database,{caseId:input.caseId});
  return {...state,...caseDataQuietWindow(state.lastChangedAt,(input.now??Date.now)())};
}

async function sourceHeads(database:D1Database,caseId:string){
  const consultation=await database.prepare("SELECT active_run_id AS activeRunId,revision FROM consultation_heads WHERE case_id = ?").bind(caseId).first<{activeRunId:string|null;revision:number}>();
  const extraction=(await database.prepare("SELECT source_document_id AS documentId,page,run_id AS runId,case_revision AS caseRevision FROM case_extraction_heads WHERE case_id = ? ORDER BY source_document_id,page").bind(caseId).all<{documentId:string;page:number;runId:string;caseRevision:number}>()).results;
  return {consultationRunId:consultation?.activeRunId??null,consultationRevision:consultation?.revision??0,extractionHeads:extraction};
}

/** Original deterministic calculator only. No OCR, advisory model or recognition transition. */
export async function recomputeCaseDataUpdate(database:D1Database,input:{caseId:string;loadCase:()=>Promise<CaseData>;now?:Clock}){
  const state=await getCaseDataRecomputeEligibility(database,input);
  if(!state.dataVersion||!state.lastChangedAt)return {caseId:input.caseId,status:"no_source_version" as const,dataVersion:state.dataVersion};
  if(!state.isQuiet)return {caseId:input.caseId,status:"debouncing" as const,dataVersion:state.dataVersion,dueAt:state.dueAt,remainingMs:state.remainingMs};
  const head=await database.prepare("SELECT run_id AS runId,data_version AS dataVersion,case_revision AS caseRevision FROM case_calculation_heads WHERE case_id = ?").bind(input.caseId).first<{runId:string;dataVersion:number;caseRevision:number}>();
  if(head&&head.dataVersion===state.dataVersion&&head.caseRevision===state.currentCaseRevision)return {caseId:input.caseId,status:"current" as const,dataVersion:state.dataVersion,runId:head.runId};
  const loaded=await input.loadCase();
  if(loaded.context.id!==input.caseId||loaded.context.revision!==state.currentCaseRevision)return {caseId:input.caseId,status:"superseded" as const,dataVersion:state.dataVersion};
  let snapshot:Awaited<ReturnType<typeof buildCaseFeatureSnapshot>>;
  try{snapshot=await buildCaseFeatureSnapshot(database,{caseData:loaded});}
  catch(error){if(error instanceof Error&&error.message==="CASE_REVISION_MISMATCH")return {caseId:input.caseId,status:"superseded" as const,dataVersion:state.dataVersion};throw error;}
  if(snapshot.sourceDataVersion!==state.dataVersion)return {caseId:input.caseId,status:"superseded" as const,dataVersion:state.dataVersion};
  const data=snapshot.caseData;
  const sources={...await sourceHeads(database,input.caseId),featureSnapshot:{inputOrigin:snapshot.inputOrigin,legacySnapshotFallback:snapshot.legacySnapshotFallback,warnings:snapshot.warnings,sourceHeads:snapshot.sourceHeads,legalRecognition:snapshot.legalRecognition}},before=await getCaseDataRecomputeEligibility(database,input);
  if(before.dataVersion!==state.dataVersion||before.currentCaseRevision!==state.currentCaseRevision||!before.isQuiet)return {caseId:input.caseId,status:"superseded" as const,dataVersion:state.dataVersion};
  const calculator=await runCaseCalculatorNode(data);
  const after=await getCaseDataRecomputeEligibility(database,input);
  if(after.dataVersion!==state.dataVersion||after.currentCaseRevision!==data.context.revision||!after.isQuiet)return {caseId:input.caseId,status:"superseded" as const,dataVersion:state.dataVersion};
  try{
    const saved=await persistCaseCalculationFeatures(database,{caseId:input.caseId,dataVersion:state.dataVersion,caseRevision:data.context.revision,inputSha256:calculator.receipt.inputSha256,execution:calculator.execution,sourceHeads:sources,referenceRelease:calculator.receipt.referenceRelease});
    return {caseId:input.caseId,status:"computed" as const,dataVersion:state.dataVersion,caseRevision:data.context.revision,runId:saved.runId,features:saved.features,calculationStatus:saved.status,missingCount:saved.missingCount,headPromoted:saved.headPromoted,assessmentStatus:calculator.execution.assessment.status};
  }catch(error){if(error instanceof Error&&error.message.includes("CALCULATION_VERSION_MISMATCH"))return {caseId:input.caseId,status:"superseded" as const,dataVersion:state.dataVersion};throw error;}
}

/** Durable source-state versus computed-head scan; an external worker may poll it. */
export async function drainCaseDataUpdates(database:D1Database,input:{caseId?:string;limit?:number;loadCase:(caseId:string)=>Promise<CaseData>;now?:Clock}){
  const limit=Math.min(10,Math.max(1,Number.isSafeInteger(input.limit)?input.limit!:3));
  const rows=(await database.prepare(`SELECT state.case_id AS caseId,state.data_version AS dataVersion,state.last_changed_at AS lastChangedAt
    FROM case_data_change_state AS state
    LEFT JOIN case_calculation_heads AS calculated ON calculated.case_id = state.case_id
    JOIN cases AS current_case ON current_case.id = state.case_id
    WHERE (calculated.case_id IS NULL OR calculated.data_version < state.data_version OR calculated.case_revision <> current_case.revision)
    ${input.caseId?"AND state.case_id = ?":""}
    ORDER BY state.last_changed_at,state.case_id LIMIT ?`).bind(...(input.caseId?[input.caseId,limit]:[limit])).all<{caseId:string;dataVersion:number;lastChangedAt:string}>()).results;
  const results=[];
  for(const row of rows){
    try{results.push(await recomputeCaseDataUpdate(database,{caseId:row.caseId,loadCase:()=>input.loadCase(row.caseId),now:input.now}));}
    catch(error){results.push({caseId:row.caseId,dataVersion:row.dataVersion,status:"failed" as const,error:error instanceof Error?error.message:"CASE_DATA_RECOMPUTE_FAILED"});}
  }
  return {scanned:rows.length,computed:results.filter(row=>row.status==="computed").length,debouncing:results.filter(row=>row.status==="debouncing").length,results};
}
export const drainDueCaseDataUpdates=drainCaseDataUpdates;
