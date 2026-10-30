import test from "node:test";
import assert from "node:assert/strict";
import { reconcileExportEvidence } from "../lib/export-reconciliation.ts";

const H = "a".repeat(64), B = "b".repeat(64);
const row = (id: string, caseId="case-1", revision=3, hash=H) =>
  ({ id, caseId, revision, objectKey:"cases/"+caseId+"/artifacts/"+id, hash });
const proof = (id: string, hash: string | null = H) =>
  ({ objectKey:"cases/case-1/artifacts/"+id, exists:true, verifiedSha256:hash });
const base = () => ({caseId:"case-1",currentRevision:3,manifest:[{id:"B",hash:H,status:"current"}],artifactRows:[row("B")],receipts:[{requestId:"req-B",status:"committed" as const,artifactIds:["B"]}],objectProofs:[proof("B")]});
const codes = (result: ReturnType<typeof reconcileExportEvidence>) => result.issues.map(issue => issue.code);

test("current SQL, case revision, manifest hash and byte SHA all agree", () => {
  const out=reconcileExportEvidence(base());
  assert.deepEqual(codes(out), []);
  assert.equal(out.currentArtifactsVerified,true);
  assert.equal(out.autoDeleteAllowed,false);
});
test("current manifest without SQL artifact is blocked", () => {
  const out=reconcileExportEvidence({...base(),artifactRows:[]});
  assert.deepEqual(codes(out),["CURRENT_SQL_MISSING","COMMITTED_SQL_MISSING"]);
  assert.equal(out.currentArtifactsVerified,false);
});
test("A committed then B current: historical artifact must not be auto-deleted", () => {
  const input=base();
  const out=reconcileExportEvidence({...input,artifactRows:[row("A"),row("B")],receipts:[{requestId:"req-A",status:"committed" as const,artifactIds:["A"]},...input.receipts],objectProofs:[proof("A"),proof("B")]});
  assert.deepEqual(codes(out),[]);
  assert.equal(out.currentArtifactsVerified,true);
});
test("unknown upload outcome and unreferenced SQL row are retained for investigation", () => {
  const input=base();
  const out=reconcileExportEvidence({...input,artifactRows:[row("orphan"),row("B")],receipts:[...input.receipts,{requestId:"retry-A",status:"uncertain" as const,artifactIds:["orphan"]}],objectProofs:[proof("B")]});
  assert.deepEqual(codes(out),["UNCERTAIN_COMMIT_PRESERVE","R2_PROOF_UNKNOWN"]);
  assert.ok(out.issues.every(x=>x.autoDeleteAllowed===false));
});
test("SQL row not in any receipt or manifest is only a preserve candidate", () => {
  const input=base();
  const out=reconcileExportEvidence({...input,artifactRows:[row("orphan"),row("B")],objectProofs:[proof("orphan"),proof("B")]});
  assert.ok(codes(out).includes("UNREFERENCED_SQL_PRESERVE"));
  assert.equal(out.autoDeleteAllowed,false);
});
test("false R2 HEAD does not grant delete permission", () => {
  const out=reconcileExportEvidence({...base(),objectProofs:[{objectKey:row("B").objectKey,exists:false}]});
  assert.deepEqual(codes(out),["R2_OBJECT_MISSING"]);
  assert.equal(out.currentArtifactsVerified,false);
  assert.equal(out.autoDeleteAllowed,false);
});
test("R2 HEAD success without reading bytes is insufficient to verify hash", () => {
  const out=reconcileExportEvidence({...base(),objectProofs:[proof("B",null)]});
  assert.deepEqual(codes(out),["R2_BYTES_UNVERIFIED"]);
  assert.equal(out.currentArtifactsVerified,false);
});
test("R2 bytes hash mismatch blocks verification despite matching SQL and manifest", () => {
  const out=reconcileExportEvidence({...base(),objectProofs:[proof("B",B)]});
  assert.deepEqual(codes(out),["R2_BYTES_HASH_MISMATCH"]);
  assert.equal(out.currentArtifactsVerified,false);
});
test("same artifact id in different case cannot clear current/committed proof", () => {
  const out=reconcileExportEvidence({...base(),artifactRows:[row("B","case-2")]});
  assert.deepEqual(codes(out),["CURRENT_OTHER_CASE","COMMITTED_OTHER_CASE"]);
  assert.equal(out.currentArtifactsVerified,false);
});
test("stale revision cannot be treated as current, even with matching hash", () => {
  const out=reconcileExportEvidence({...base(),artifactRows:[row("B","case-1",2)]});
  assert.deepEqual(codes(out),["CURRENT_REVISION_MISMATCH"]);
  assert.equal(out.currentArtifactsVerified,false);
});
test("manifest hash mismatch stays blocked even though R2 equals SQL", () => {
  const out=reconcileExportEvidence({...base(),manifest:[{id:"B",hash:B,status:"current"}]});
  assert.deepEqual(codes(out),["CURRENT_HASH_MISMATCH"]);
  assert.equal(out.currentArtifactsVerified,false);
});
test("claimed request and missing R2 proof preserve rather than delete", () => {
  const input=base();
  const out=reconcileExportEvidence({...input,receipts:[...input.receipts,{requestId:"req-C",status:"claimed" as const,artifactIds:[]}],objectProofs:[]});
  assert.deepEqual(codes(out),["CLAIMED_REQUEST_PRESERVE","R2_PROOF_UNKNOWN"]);
  assert.equal(out.autoDeleteAllowed,false);
});

test("no current manifest files must not be considered verified", () => {
  const out=reconcileExportEvidence({...base(),manifest:[]});
  assert.ok(codes(out).includes("CURRENT_MANIFEST_EMPTY"));
  assert.equal(out.currentArtifactsVerified,false);
});
test("two SQL rows pointing to the same object key require manual review", () => {
  const input=base();
  const duplicate={...row("A"),objectKey:row("B").objectKey};
  const out=reconcileExportEvidence({...input,artifactRows:[duplicate,row("B")]});
  assert.ok(codes(out).includes("DUPLICATE_OBJECT_KEY"));
  assert.equal(out.autoDeleteAllowed,false);
});

test("duplicate object key detected even when the current row is visited first", () => {
  const input=base();
  const duplicate={...row("A"),objectKey:row("B").objectKey};
  const out=reconcileExportEvidence({...input,artifactRows:[row("B"),duplicate]});
  assert.ok(codes(out).includes("DUPLICATE_OBJECT_KEY"));
  assert.equal(out.currentArtifactsVerified,false);
});
test("an SQL artifact row cannot claim a different case's R2 prefix", () => {
  const bad={...row("B"),objectKey:"cases/case-2/artifacts/B"};
  const out=reconcileExportEvidence({...base(),artifactRows:[bad],objectProofs:[{objectKey:bad.objectKey,exists:true,verifiedSha256:H}]});
  assert.deepEqual(codes(out),["OBJECT_KEY_SCOPE_MISMATCH"]);
  assert.equal(out.currentArtifactsVerified,false);
});
