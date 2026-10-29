import test from "node:test";
import assert from "node:assert/strict";
import { createCase,type CaseData } from "../lib/domain.ts";
import { canonicalSha256 } from "../lib/structured-case-import.ts";
import { cloneEvaluationCase,evaluationCloneMatchesSource } from "../lib/case-migration.ts";
import { caseWorkflow } from "../lib/case-workflow-state.ts";

function whitelistedSource(){
  const source=createCase("Synthetic fixture source","synthetic-unit-case-v1","2026-10-29");
  source.structuredTest={mode:"assumed_extracted_synthetic",scenarioId:source.context.id,sourceRecords:[{id:"record-1",recordType:"case",recordId:source.context.id,data:{}}]};
  return source;
}

test("evaluation clone verifies the whitelisted source hash and leaves the source unchanged",async()=>{
  const source=whitelistedSource(),caseDataSha256=await canonicalSha256(source),datasetManifestSha256="a".repeat(64);
  const marker=source.structuredTest! as NonNullable<typeof source.structuredTest> & {datasetManifestSha256?:string;caseDataSha256?:string};
  marker.datasetManifestSha256=datasetManifestSha256;
  marker.caseDataSha256=caseDataSha256;
  const original=await canonicalSha256(source);
  const approved={cases:[{caseId:source.context.id,caseDataSha256,datasetManifestSha256}]};
  const clone=await cloneEvaluationCase(source,"evaluation-clone-unitcase01","2026-10-29T12:00:00.000Z",approved);
  assert.equal(await canonicalSha256(source),original);
  assert.equal(clone.context.id,"evaluation-clone-unitcase01");
  assert.equal(clone.evaluationClone?.sourceCaseId,source.context.id);
  assert.equal(clone.evaluationClone?.sourceInputSha256,caseDataSha256);
  assert.equal(clone.evaluationClone?.finalSubmissionProhibited,true);
  assert.notEqual(clone.workflowState,source.workflowState);
  assert.deepEqual(clone.documents,source.documents);
  assert.deepEqual(clone.pages,source.pages);
  assert.deepEqual(clone.facts,source.facts);
  await assert.rejects(()=>cloneEvaluationCase(source,"evaluation-clone-unitcase02","2026-10-29T12:00:00.000Z",{cases:[{...approved.cases[0]!,caseDataSha256:"0".repeat(64)}]}),/EVALUATION_SOURCE_HASH_MISMATCH/);
  await assert.rejects(()=>cloneEvaluationCase(source,"ordinary-case-id","2026-10-29T12:00:00.000Z",approved),/EVALUATION_CLONE_ID_REQUIRED/);
});

test("an existing evaluation target only matches its original whitelisted source",()=>{
  const source=whitelistedSource(),clone=structuredClone(source);
  clone.context.id="evaluation-clone-unitcase01";
  clone.evaluationClone={sourceCaseId:source.context.id,sourceInputSha256:"b".repeat(64),createdAt:"2026-10-29T12:00:00.000Z",finalSubmissionProhibited:true};
  assert.equal(evaluationCloneMatchesSource(clone,source,"b".repeat(64)),true);
  const other=whitelistedSource();other.context.id="synthetic-other-source-v1";
  assert.equal(evaluationCloneMatchesSource(clone,other,"b".repeat(64)),false);
  assert.equal(evaluationCloneMatchesSource(clone,source,"c".repeat(64)),false);
  const invalid=structuredClone(clone);(invalid.evaluationClone as unknown as {finalSubmissionProhibited:boolean}).finalSubmissionProhibited=false;
  assert.equal(evaluationCloneMatchesSource(invalid as CaseData,source,"b".repeat(64)),false);
});
