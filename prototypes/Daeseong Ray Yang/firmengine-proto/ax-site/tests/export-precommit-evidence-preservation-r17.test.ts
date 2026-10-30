import test from "node:test";
import assert from "node:assert/strict";
import { commitExportArtifactTransaction } from "../lib/export-artifact-transaction.ts";

// A4 R17: all artifacts, rows and failures are synthetic. No real D1/R2/network.
const target = "cases/synthetic-r17/artifacts/a";
const artifact = { record: {id:"a"}, objectKey:target, bytes:new Uint8Array([1,2,3]), mime:"application/octet-stream" };
function fixture(stage:"upload"|"persist"|"commit"|"success", preserve:boolean) {
  const objects=new Map<string,Uint8Array>(), rows=new Set<string>(), trace:string[]=[];
  const error=new Error("synthetic-"+stage+"-ack-lost");
  const input={
    artifacts:[artifact],preservePreCommitFailureEvidence:preserve,
    upload:async(key:string,bytes:Uint8Array)=>{objects.set(key,bytes);trace.push("upload");if(stage==="upload")throw error;},
    persistRecords:async(records:readonly {id:string}[])=>{for(const r of records)rows.add(r.id);trace.push("persist");if(stage==="persist")throw error;},
    commitManifest:async()=>{trace.push("commit");if(stage==="commit")throw error;return "saved";},
    deleteRecords:async(records:readonly {id:string}[])=>{trace.push("delete_sql");for(const r of records)rows.delete(r.id);},
    deleteObject:async(key:string)=>{trace.push("delete_r2");objects.delete(key);},
    onPreCommitUncertain:()=>{trace.push("precommit_uncertain");},
    onCommitUncertain:()=>{trace.push("commit_uncertain");},
  };
  return {input,objects,rows,trace,error};
}
for(const stage of ["upload","persist"] as const){
  test(`durable export retains R2/SQL evidence after ${stage} ACK loss`,async()=>{
    const h=fixture(stage,true);
    await assert.rejects(commitExportArtifactTransaction(h.input),e=>e===h.error);
    assert.equal(h.objects.has(target),true);
    assert.equal(h.rows.has("a"),stage==="persist");
    assert.deepEqual(h.trace.includes("delete_sql"),false);
    assert.deepEqual(h.trace.includes("delete_r2"),false);
    assert.equal(h.trace.filter(x=>x==="precommit_uncertain").length,1);
  });
}
test("default legacy mode still performs scoped precommit cleanup",async()=>{
  const h=fixture("persist",false);
  await assert.rejects(commitExportArtifactTransaction(h.input),e=>e===h.error);
  assert.equal(h.objects.has(target),false);
  assert.equal(h.rows.has("a"),false);
  assert.equal(h.trace.includes("precommit_uncertain"),false);
});
test("manifest ACK loss retains both records and objects regardless of mode",async()=>{
  const h=fixture("commit",true);
  await assert.rejects(commitExportArtifactTransaction(h.input),e=>e===h.error);
  assert.equal(h.objects.has(target),true);
  assert.equal(h.rows.has("a"),true);
  assert.equal(h.trace.includes("commit_uncertain"),true);
  assert.equal(h.trace.includes("precommit_uncertain"),false);
  assert.equal(h.trace.includes("delete_r2"),false);
});
test("successful export does not enter either uncertainty callback",async()=>{
  const h=fixture("success",true);
  assert.equal(await commitExportArtifactTransaction(h.input),"saved");
  assert.equal(h.objects.has(target),true);
  assert.equal(h.rows.has("a"),true);
  assert.equal(h.trace.includes("commit_uncertain"),false);
  assert.equal(h.trace.includes("precommit_uncertain"),false);
});
test("precommit warning callback failure cannot authorize deletion",async()=>{
  const h=fixture("upload",true);
  h.input.onPreCommitUncertain=()=>{throw new Error("audit unavailable");};
  await assert.rejects(commitExportArtifactTransaction(h.input),e=>e===h.error);
  assert.equal(h.objects.has(target),true);
  assert.equal(h.trace.includes("delete_r2"),false);
});
