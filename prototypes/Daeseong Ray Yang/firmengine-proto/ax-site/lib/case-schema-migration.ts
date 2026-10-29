import { isProtectedCaseId } from "./protected-case.ts";
import type { CaseData } from "./domain.ts";
import { caseWorkflow } from "./case-workflow-state.ts";
import { canonicalSha256 } from "./structured-case-import.ts";

export const CASE_SCHEMA_MIGRATION_VERSION="case-workflow-contracts/1" as const;
export const CASE_SCHEMA_MIGRATION_RECEIPT_SCHEMA="case-schema-migration-receipt/1" as const;
export type MigrationMode="deterministic"|"document"|"propagation";
export interface CaseSchemaMigrationRequest {
  caseId:string;expectedRevision:number;expectedInputSha256:string;
  migrationVersion:typeof CASE_SCHEMA_MIGRATION_VERSION;mode:MigrationMode;
}
export interface CaseSchemaMigrationReceipt {
  schema:typeof CASE_SCHEMA_MIGRATION_RECEIPT_SCHEMA;receiptId:string;
  migrationVersion:typeof CASE_SCHEMA_MIGRATION_VERSION;caseId:string;sourceRevision:number;
  sourceSha256:string;resultStateSha256:string;mode:MigrationMode;changedFields:string[];appliedAt:string;
}
export interface CaseSchemaMigrationPlan {
  planId:string;migrationVersion:typeof CASE_SCHEMA_MIGRATION_VERSION;caseId:string;expectedRevision:number;
  sourceSha256:string;resultStateSha256:string;mode:MigrationMode;allowlistedCaseIds:string[];
  changedFields:string[];semanticDiff:{before:unknown;after:unknown};migratedSnapshot:CaseData;existingReceipt?:CaseSchemaMigrationReceipt;
}
const allowedModes=new Set<MigrationMode>(["deterministic","document","propagation"]);
type MigrationExtendedCase=CaseData&{caseSchemaMigrations?:CaseSchemaMigrationReceipt[]};
function fail(code:string):never{throw new Error(code);}
function same(a:unknown,b:unknown):boolean{return JSON.stringify(a)===JSON.stringify(b);}
export function assertWritableWorkflowSchema(data:Pick<CaseData,"workflowState">):void{
  const state=data.workflowState;
  if(state&&state.schema!=="case-workflow/1")fail("MIGRATION_UNSUPPORTED_WORKFLOW_SCHEMA");
  if(state&&state.version!==undefined&&(!Number.isSafeInteger(state.version)||state.version<1))fail("MIGRATION_WORKFLOW_COUNTER_INVALID");
}
async function validateScope(data:CaseData,request:CaseSchemaMigrationRequest,allowlistedCaseIds:readonly string[]):Promise<void>{
  if(!Array.isArray(allowlistedCaseIds)||allowlistedCaseIds.length<1||allowlistedCaseIds.length>52||new Set(allowlistedCaseIds).size!==allowlistedCaseIds.length||allowlistedCaseIds.some(id=>typeof id!=="string"||!id.trim()||id.length>128))fail("MIGRATION_EXPLICIT_CASE_SCOPE_REQUIRED");
  if(!allowlistedCaseIds.includes(data.context.id)||request.caseId!==data.context.id)fail("MIGRATION_CASE_NOT_ALLOWLISTED");
  if(await isProtectedCaseId(data.context.id))fail("MIGRATION_PROTECTED_CASE");
  if((data.structuredTest||data.referenceTest)&&!data.evaluationClone)fail("MIGRATION_ORIGINAL_FIXTURE_IMMUTABLE");
  if(!request||request.migrationVersion!==CASE_SCHEMA_MIGRATION_VERSION||!allowedModes.has(request.mode))fail("MIGRATION_VERSION_OR_MODE_UNSUPPORTED");
  if(!Number.isSafeInteger(request.expectedRevision)||request.expectedRevision<1||request.expectedRevision!==data.context.revision)fail("MIGRATION_REVISION_MISMATCH");
  if(!/^[a-f0-9]{64}$/i.test(request.expectedInputSha256))fail("MIGRATION_INPUT_HASH_INVALID");
}
function changedFieldList(before:unknown,after:unknown,prefix=""):string[]{
  if(same(before,after))return [];
  if(!before||!after||typeof before!=="object"||typeof after!=="object"||Array.isArray(before)||Array.isArray(after))return [prefix||"$"];
  const left=before as Record<string,unknown>,right=after as Record<string,unknown>;
  return [...new Set([...Object.keys(left),...Object.keys(right)])].flatMap(key=>changedFieldList(left[key],right[key],prefix?`${prefix}.${key}`:key)).sort();
}
function withoutCurrentReceipt(data:CaseData):CaseData{
  const copy=structuredClone(data) as MigrationExtendedCase;
  if(Array.isArray(copy.caseSchemaMigrations)){
    copy.caseSchemaMigrations=copy.caseSchemaMigrations.filter(receipt=>receipt.migrationVersion!==CASE_SCHEMA_MIGRATION_VERSION);
    if(!copy.caseSchemaMigrations.length)delete copy.caseSchemaMigrations;
  }
  return copy;
}
function semanticState(data:CaseData):CaseData{
  const copy=structuredClone(data) as MigrationExtendedCase&{clientStateFingerprint?:unknown};
  delete copy.caseSchemaMigrations;delete copy.clientStateFingerprint;delete (copy.context as unknown as {revision?:unknown}).revision;
  if(copy.workflowState)delete (copy.workflowState as unknown as {version?:unknown}).version;
  return copy;
}
const semanticStateSha256=(data:CaseData)=>canonicalSha256(semanticState(data));
async function migrateDefaults(data:CaseData):Promise<{snapshot:CaseData;changedFields:string[];semanticDiff:{before:unknown;after:unknown};resultStateSha256:string}>{
  const before=structuredClone(data),snapshot=structuredClone(data);
  assertWritableWorkflowSchema(snapshot);
  // Defaults-only normalization. It preserves existing fields and does not
  // derive facts, mappings, applicability, or staff/legal review receipts.
  snapshot.workflowState=caseWorkflow(snapshot.workflowState);
  const protectedBefore={documents:before.documents,pages:before.pages,facts:before.facts,context:before.context,incomes:before.incomes,debts:before.debts,assets:before.assets,household:before.household,transactions:before.transactions,exportManifest:before.exportManifest};
  const protectedAfter={documents:snapshot.documents,pages:snapshot.pages,facts:snapshot.facts,context:snapshot.context,incomes:snapshot.incomes,debts:snapshot.debts,assets:snapshot.assets,household:snapshot.household,transactions:snapshot.transactions,exportManifest:snapshot.exportManifest};
  if(!same(protectedBefore,protectedAfter))fail("MIGRATION_PROTECTED_SEMANTICS_CHANGED");
  return {snapshot,changedFields:changedFieldList(before.workflowState,snapshot.workflowState,"workflowState"),semanticDiff:{before:before.workflowState??null,after:snapshot.workflowState},resultStateSha256:await semanticStateSha256(snapshot)};
}
function migrationReceipt(data:CaseData):CaseSchemaMigrationReceipt|undefined{
  const records=(data as MigrationExtendedCase).caseSchemaMigrations;
  if(records!==undefined&&!Array.isArray(records))fail("MIGRATION_RECEIPT_STORE_INVALID");
  const matches=records?.filter(receipt=>receipt.migrationVersion===CASE_SCHEMA_MIGRATION_VERSION&&receipt.caseId===data.context.id)??[];
  if(matches.length>1)fail("MIGRATION_RECEIPT_DUPLICATED");
  return matches[0];
}
/** Prepare a per-case dry run. The caller supplies a bounded explicit ID list and the server-read hash/revision. */
export async function prepareCaseSchemaMigration(data:CaseData,request:CaseSchemaMigrationRequest,allowlistedCaseIds:readonly string[]):Promise<CaseSchemaMigrationPlan>{
  await validateScope(data,request,allowlistedCaseIds);
  const sourceSha256=await canonicalSha256(data);
  if(sourceSha256!==request.expectedInputSha256)fail("MIGRATION_SOURCE_HASH_MISMATCH");
  const prior=migrationReceipt(data);
  if(prior){
    if(prior.mode!==request.mode)fail("MIGRATION_RECEIPT_CONFLICT");
    const current=await migrateDefaults(withoutCurrentReceipt(data));
    if(current.resultStateSha256!==prior.resultStateSha256)fail("MIGRATION_RESULT_HASH_MISMATCH");
    return {planId:prior.receiptId,migrationVersion:request.migrationVersion,caseId:data.context.id,expectedRevision:data.context.revision,sourceSha256,resultStateSha256:prior.resultStateSha256,mode:prior.mode,allowlistedCaseIds:[...allowlistedCaseIds],changedFields:[],semanticDiff:{before:current.snapshot.workflowState,after:current.snapshot.workflowState},migratedSnapshot:structuredClone(data),existingReceipt:prior};
  }
  const migrated=await migrateDefaults(data);
  const planId=await canonicalSha256({schema:"case-schema-migration-plan/1",migrationVersion:request.migrationVersion,caseId:data.context.id,revision:data.context.revision,sourceSha256,mode:request.mode,allowlistedCaseIds:[...allowlistedCaseIds].sort()});
  return {planId,migrationVersion:request.migrationVersion,caseId:data.context.id,expectedRevision:data.context.revision,sourceSha256,resultStateSha256:migrated.resultStateSha256,mode:request.mode,allowlistedCaseIds:[...allowlistedCaseIds],changedFields:migrated.changedFields,semanticDiff:migrated.semanticDiff,migratedSnapshot:migrated.snapshot};
}
/** Apply only the exact prepared snapshot; a persisted receipt makes replay idempotent. */
export async function applyCaseSchemaMigration(data:CaseData,plan:CaseSchemaMigrationPlan,appliedAt:string):Promise<{data:CaseData;receipt:CaseSchemaMigrationReceipt;alreadyApplied:boolean}>{
  if(!Number.isFinite(Date.parse(appliedAt)))fail("MIGRATION_APPLIED_AT_INVALID");
  if(plan.migrationVersion!==CASE_SCHEMA_MIGRATION_VERSION||plan.caseId!==data.context.id||!plan.allowlistedCaseIds.includes(data.context.id)||plan.allowlistedCaseIds.length<1||plan.allowlistedCaseIds.length>52||!allowedModes.has(plan.mode))fail("MIGRATION_PLAN_SCOPE_INVALID");
  if(await isProtectedCaseId(data.context.id)||(data.structuredTest||data.referenceTest)&&!data.evaluationClone)fail("MIGRATION_TARGET_NOT_MUTABLE");
  const prior=migrationReceipt(data);
  if(prior){
    if(prior.receiptId!==plan.planId||prior.mode!==plan.mode||plan.existingReceipt&&plan.existingReceipt.receiptId!==prior.receiptId||!plan.existingReceipt&&(prior.sourceSha256!==plan.sourceSha256||prior.sourceRevision!==plan.expectedRevision))fail("MIGRATION_RECEIPT_CONFLICT");
    const replay=await semanticStateSha256(withoutCurrentReceipt(data));
    if(replay!==prior.resultStateSha256)fail("MIGRATION_RESULT_HASH_MISMATCH");
    return {data,receipt:prior,alreadyApplied:true};
  }
  if(data.context.revision!==plan.expectedRevision||await canonicalSha256(data)!==plan.sourceSha256)fail("MIGRATION_SOURCE_CHANGED");
  const current=await migrateDefaults(data);
  if(current.resultStateSha256!==plan.resultStateSha256||!same(current.changedFields,plan.changedFields))fail("MIGRATION_PLAN_RESULT_CHANGED");
  if(await semanticStateSha256(plan.migratedSnapshot)!==plan.resultStateSha256||!same(current.semanticDiff,plan.semanticDiff))fail("MIGRATION_PLAN_INTEGRITY_FAILED");
  const expectedPlanId=await canonicalSha256({schema:"case-schema-migration-plan/1",migrationVersion:plan.migrationVersion,caseId:plan.caseId,revision:plan.expectedRevision,sourceSha256:plan.sourceSha256,mode:plan.mode,allowlistedCaseIds:[...plan.allowlistedCaseIds].sort()});
  if(expectedPlanId!==plan.planId)fail("MIGRATION_PLAN_INTEGRITY_FAILED");
  const receipt:CaseSchemaMigrationReceipt={schema:CASE_SCHEMA_MIGRATION_RECEIPT_SCHEMA,receiptId:plan.planId,migrationVersion:plan.migrationVersion,caseId:plan.caseId,sourceRevision:plan.expectedRevision,sourceSha256:plan.sourceSha256,resultStateSha256:plan.resultStateSha256,mode:plan.mode,changedFields:[...plan.changedFields],appliedAt:new Date(appliedAt).toISOString()};
  const result=structuredClone(current.snapshot) as MigrationExtendedCase;
  result.caseSchemaMigrations=[...(result.caseSchemaMigrations??[]),receipt];
  return {data:result,receipt,alreadyApplied:false};
}
