import test from "node:test";
import assert from "node:assert/strict";
import { createCase, normalizeMoney, type Fact } from "../lib/domain.ts";
import { canonicalSha256 } from "../lib/structured-case-import.ts";
import { applyCaseSchemaMigration, CASE_SCHEMA_MIGRATION_VERSION, prepareCaseSchemaMigration, type CaseSchemaMigrationRequest, type MigrationMode } from "../lib/case-schema-migration.ts";
import { caseWorkflow } from "../lib/case-workflow-state.ts";

function oldCase(id="ordinary-legacy-case"){
  const data=createCase("Legacy source preservation",id,"2026-10-29");
  data.documents=[{id:"doc-1",name:"source.pdf",sha256:"a".repeat(64),status:"active",pages:[1]}];
  data.pages=[{documentId:"doc-1",page:1,role:"evidence",text:"reported amount 100"}];
  const fact:Fact={id:"fact-1",logicalId:"balance",version:1,subjectId:"case",key:"bank.balance",value:"100",sourceUnit:"KRW",numeric:normalizeMoney("100","KRW"),state:"verified",recognition:"unreviewed",refs:[{documentId:"doc-1",page:1,quote:"reported amount 100",sourceHash:"a".repeat(64)}],validation:[]};
  data.facts=[fact];data.context.ruleApplicationReviewed=true;data.context.incomePeriodReviewed=true;
  data.workflowState={schema:"case-workflow/1",version:3,requirements:[],subjectLinks:[],documentMatches:[]} as never;
  // Emulate fields present on a newer stored workflow that this migration does not own.
  (data.workflowState as unknown as Record<string,unknown>).futureReceipt={keep:true,contract:"vNext"};
  return data;
}
async function requestFor(data:ReturnType<typeof oldCase>,mode:MigrationMode="deterministic"):Promise<CaseSchemaMigrationRequest>{return {caseId:data.context.id,expectedRevision:data.context.revision,expectedInputSha256:await canonicalSha256(data),migrationVersion:CASE_SCHEMA_MIGRATION_VERSION,mode};}

test("AT-63 explicit migration is idempotent, keeps one receipt, and creates no duplicate evidence or workflow rows",async()=>{
  const data=oldCase(),before=structuredClone(data),scope=[data.context.id],request=await requestFor(data);
  const plan=await prepareCaseSchemaMigration(data,request,scope);
  assert.ok(plan.changedFields.some(field=>field.startsWith("workflowState.")));
  const applied=await applyCaseSchemaMigration(data,plan,"2026-10-29T12:00:00.000Z");
  assert.equal(applied.alreadyApplied,false);assert.deepEqual(data,before,"preparation/apply do not mutate the loaded source object");
  assert.deepEqual(applied.data.facts,before.facts);assert.deepEqual(applied.data.documents,before.documents);assert.deepEqual(applied.data.pages,before.pages);
  assert.equal(applied.data.workflowState?.requirements.length,before.workflowState?.requirements.length);
  assert.equal(applied.data.workflowState?.tasks.length,(before.workflowState as unknown as {tasks?:unknown[]}|undefined)?.tasks?.length??0);
  assert.equal(applied.data.workflowState?.requirementConfirmations.length,0,"legacy review booleans are never promoted to requirement confirmations");
  assert.equal(applied.data.context.ruleApplicationReviewed,true);assert.equal(applied.data.context.incomePeriodReviewed,true);
  const persisted=structuredClone(applied.data);persisted.context.revision++;if(persisted.workflowState)persisted.workflowState.version++;
  const replay=await applyCaseSchemaMigration(persisted,plan,"2026-10-30T12:00:00.000Z");
  assert.equal(replay.alreadyApplied,true);assert.deepEqual(replay.receipt,applied.receipt);assert.deepEqual(replay.data,persisted);
  const repeatedRequest=await requestFor(persisted),repeatedPlan=await prepareCaseSchemaMigration(persisted,repeatedRequest,scope);
  assert.equal(repeatedPlan.planId,applied.receipt.receiptId);
  const repeatedApply=await applyCaseSchemaMigration(persisted,repeatedPlan,"2026-10-31T12:00:00.000Z");
  assert.equal(repeatedApply.alreadyApplied,true);assert.deepEqual(repeatedApply.receipt,applied.receipt);
  assert.equal((applied.data as unknown as {caseSchemaMigrations:{receiptId:string}[]}).caseSchemaMigrations.length,1);
});

test("migration requires explicit bounded scope, exact source hash/revision, and supported mode",async()=>{
  const data=oldCase(),request=await requestFor(data);
  await assert.rejects(prepareCaseSchemaMigration(data,request,[]),/MIGRATION_EXPLICIT_CASE_SCOPE_REQUIRED/);
  await assert.rejects(prepareCaseSchemaMigration(data,request,Array.from({length:53},(_,i)=>`case-${i}`)),/MIGRATION_EXPLICIT_CASE_SCOPE_REQUIRED/);
  await assert.rejects(prepareCaseSchemaMigration(data,request,["another-case"]),/MIGRATION_CASE_NOT_ALLOWLISTED/);
  await assert.rejects(prepareCaseSchemaMigration(data,{...request,expectedRevision:2},[data.context.id]),/MIGRATION_REVISION_MISMATCH/);
  await assert.rejects(prepareCaseSchemaMigration(data,{...request,expectedInputSha256:"b".repeat(64)},[data.context.id]),/MIGRATION_SOURCE_HASH_MISMATCH/);
  await assert.rejects(prepareCaseSchemaMigration(data,{...request,mode:"ocr" as MigrationMode},[data.context.id]),/MIGRATION_VERSION_OR_MODE_UNSUPPORTED/);
});

test("migration refuses protected/original synthetic fixtures and unknown future workflow schemas",async()=>{
  const ordinary=oldCase();
  const original=oldCase("synthetic-original-v1");original.structuredTest={mode:"assumed_extracted_synthetic",scenarioId:original.context.id,sourceRecords:[]};
  const originalRequest=await requestFor(original);
  await assert.rejects(prepareCaseSchemaMigration(original,originalRequest,[original.context.id]),/MIGRATION_ORIGINAL_FIXTURE_IMMUTABLE/);
  const protectedCase=oldCase("8429888a-1861-48b5-b1f4-66af1d36273e"),protectedRequest=await requestFor(protectedCase);
  await assert.rejects(prepareCaseSchemaMigration(protectedCase,protectedRequest,[protectedCase.context.id]),/MIGRATION_PROTECTED_CASE/);
  const future=structuredClone(ordinary);future.workflowState!.schema="case-workflow/2" as never;
  const futureRequest=await requestFor(future);
  await assert.rejects(prepareCaseSchemaMigration(future,futureRequest,[future.context.id]),/MIGRATION_UNSUPPORTED_WORKFLOW_SCHEMA/);
});

test("AT-67 defaults migration preserves future workflow fields and old defaults remain readable",async()=>{
  const data=oldCase(),request=await requestFor(data),plan=await prepareCaseSchemaMigration(data,request,[data.context.id]);
  const migrated=await applyCaseSchemaMigration(data,plan,"2026-10-29T12:00:00.000Z");
  assert.deepEqual((migrated.data.workflowState as unknown as Record<string,unknown>).futureReceipt,{keep:true,contract:"vNext"});
  assert.ok(Array.isArray(migrated.data.workflowState?.legalDispositions));assert.ok(Array.isArray(migrated.data.workflowState?.documentEdits));
  const forwardRoundTrip=caseWorkflow(migrated.data.workflowState);
  assert.deepEqual((forwardRoundTrip as unknown as Record<string,unknown>).futureReceipt,{keep:true,contract:"vNext"});
  const oldShape=caseWorkflow({schema:"case-workflow/1",version:7,requirements:[],subjectLinks:[],documentMatches:[]} as never);
  assert.equal(oldShape.version,7);assert.deepEqual(oldShape.requirementConfirmations,[]);assert.deepEqual(oldShape.tasks,[]);
  const missingCounter=oldCase("legacy-no-workflow-counter");
  missingCounter.workflowState={schema:"case-workflow/1",requirements:[],subjectLinks:[],documentMatches:[]} as never;
  const legacyPlan=await prepareCaseSchemaMigration(missingCounter,await requestFor(missingCounter),[missingCounter.context.id]);
  const upgraded=await applyCaseSchemaMigration(missingCounter,legacyPlan,"2026-10-29T12:00:00.000Z");
  assert.equal(upgraded.data.workflowState?.version,1,"absent legacy counter receives the current default");
});

test("apply rejects stale plans and mutated dry-run payloads",async()=>{
  const data=oldCase(),request=await requestFor(data),plan=await prepareCaseSchemaMigration(data,request,[data.context.id]);
  const changed=structuredClone(data);changed.context.caseName="Concurrent source update";
  await assert.rejects(applyCaseSchemaMigration(changed,plan,"2026-10-29T12:00:00.000Z"),/MIGRATION_SOURCE_CHANGED/);
  const forged=structuredClone(plan);forged.migratedSnapshot.facts=[];
  await assert.rejects(applyCaseSchemaMigration(data,forged,"2026-10-29T12:00:00.000Z"),/MIGRATION_PLAN_INTEGRITY_FAILED|MIGRATION_PLAN_RESULT_CHANGED/);
});
