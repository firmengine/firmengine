import test from "node:test";
import assert from "node:assert/strict";
import { reconcileExportEvidence } from "../lib/export-reconciliation.ts";

const H = "a".repeat(64);
const keyB = "cases/synthetic-one/artifacts/B";
const keyA = "cases/synthetic-one/artifacts/A";
const row = (id: string, caseId: string, objectKey: string, revision = 4) =>
  ({id, caseId, objectKey, revision, hash: H});
const base = () => ({
  caseId: "synthetic-one", currentRevision: 4,
  manifest: [{id:"B",hash:H,status:"current"}],
  artifactRows: [row("B","synthetic-one",keyB)],
  receipts: [{requestId:"request-B",status:"committed" as const,artifactIds:["B"]}],
  objectProofs: [{objectKey:keyB,exists:true as const,verifiedSha256:H}]
});
const codes = (out: ReturnType<typeof reconcileExportEvidence>) => out.issues.map(x=>x.code);

test("ordinary same-case SQL and R2 bytes remain verifiable", () => {
  const out = reconcileExportEvidence(base());
  assert.deepEqual(codes(out), []);
  assert.equal(out.currentArtifactsVerified,true);
  assert.equal(out.autoDeleteAllowed,false);
});

test("foreign-case SQL artifact ID X aliasing current B R2 object blocks verification", () => {
  const x = base();
  const out = reconcileExportEvidence({...x,artifactRows:[...x.artifactRows,row("X","synthetic-two",keyB)]});
  assert.deepEqual(codes(out),["FOREIGN_CASE_OBJECT_KEY_ALIAS"]);
  assert.equal(out.currentArtifactsVerified,false);
  assert.deepEqual(out.issues,[{code:"FOREIGN_CASE_OBJECT_KEY_ALIAS",autoDeleteAllowed:false}]);
});

test("foreign-case alias outcome is independent of row arrival order", () => {
  const x = base(),foreign=row("X","synthetic-two",keyB);
  const out = reconcileExportEvidence({...x,artifactRows:[foreign,...x.artifactRows]});
  assert.deepEqual(codes(out),["FOREIGN_CASE_OBJECT_KEY_ALIAS"]);
  assert.equal(out.currentArtifactsVerified,false);
});

test("unrelated foreign case key never appears as a cross-case finding", () => {
  const x = base();
  const out = reconcileExportEvidence({...x,artifactRows:[...x.artifactRows,row("X","synthetic-two","cases/synthetic-two/artifacts/X")]});
  assert.deepEqual(codes(out),[]);
  assert.equal(out.currentArtifactsVerified,true);
});

test("foreign alias to historical A is preserved but does not falsely stale current B", () => {
  const x = base();
  const out = reconcileExportEvidence({...x,
    artifactRows:[row("A","synthetic-one",keyA,3),...x.artifactRows,row("X","synthetic-two",keyA)],
    receipts:[...x.receipts,{requestId:"request-A",status:"committed" as const,artifactIds:["A"]}],
    objectProofs:[...x.objectProofs,{objectKey:keyA,exists:true as const,verifiedSha256:H}]
  });
  assert.deepEqual(codes(out),["FOREIGN_CASE_OBJECT_KEY_ALIAS"]);
  assert.equal(out.currentArtifactsVerified,true);
  assert.equal(out.autoDeleteAllowed,false);
});

test("multiple foreign rows sharing one current object key yield one non-identifying warning", () => {
  const x = base();
  const out = reconcileExportEvidence({...x,
    artifactRows:[...x.artifactRows,row("X","synthetic-two",keyB),row("Y","synthetic-three",keyB)]});
  assert.deepEqual(codes(out),["FOREIGN_CASE_OBJECT_KEY_ALIAS"]);
  assert.equal(out.currentArtifactsVerified,false);
  assert.equal(out.issues[0].artifactId,undefined);
  assert.equal(out.issues[0].requestId,undefined);
});

test("foreign alias of noncurrent R2 key requires investigation without claiming B stale", () => {
  const x = base();
  const out = reconcileExportEvidence({...x,
    artifactRows:[...x.artifactRows,row("X","synthetic-two","cases/synthetic-one/artifacts/Z")]});
  assert.deepEqual(codes(out),["FOREIGN_CASE_OBJECT_KEY_ALIAS"]);
  assert.equal(out.currentArtifactsVerified,true);
  assert.ok(out.issues.every(issue=>issue.autoDeleteAllowed===false));
});
