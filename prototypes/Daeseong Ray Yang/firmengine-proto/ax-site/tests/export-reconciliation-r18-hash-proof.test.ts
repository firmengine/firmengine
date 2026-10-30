import test from "node:test";
import assert from "node:assert/strict";
import { reconcileExportEvidence } from "../lib/export-reconciliation.ts";

const H = "a".repeat(64);
const artifact = (id: string, hash = H) =>
  ({ id, caseId: "case-A4", revision: 3, objectKey: "cases/case-A4/artifacts/" + id, hash });
const proof = (id: string, sha: string | null = H) =>
  ({ objectKey: artifact(id).objectKey, exists: true as const, verifiedSha256: sha });
const base = () => ({
  caseId: "case-A4", currentRevision: 3,
  manifest: [{ id: "B", hash: H, status: "current" }],
  artifactRows: [artifact("B")],
  receipts: [{ requestId: "request-B", status: "committed" as const, artifactIds: ["B"] }],
  objectProofs: [proof("B")],
});
const codes = (out: ReturnType<typeof reconcileExportEvidence>) => out.issues.map(i => i.code);

test("valid single current byte SHA-256 remains verified, without delete permission", () => {
  const out = reconcileExportEvidence(base());
  assert.equal(out.currentArtifactsVerified, true);
  assert.deepEqual(codes(out), []);
  assert.equal(out.autoDeleteAllowed, false);
});
test("identical malformed manifest, SQL and alleged R2 hash cannot prove bytes", () => {
  const out = reconcileExportEvidence({ ...base(),
    manifest: [{ id: "B", hash: "bad", status: "current" }],
    artifactRows: [artifact("B", "bad")], objectProofs: [proof("B", "bad")] });
  assert.equal(out.currentArtifactsVerified, false);
  for (const code of ["CURRENT_MANIFEST_HASH_INVALID", "CURRENT_SQL_HASH_INVALID", "R2_BYTES_SHA_INVALID"])
    assert.ok(codes(out).includes(code as any), code);
  assert.equal(out.autoDeleteAllowed, false);
});
test("identical duplicate current manifest entry blocks current verification", () => {
  const input = base();
  const out = reconcileExportEvidence({ ...input, manifest: [...input.manifest, ...input.manifest] });
  assert.equal(out.currentArtifactsVerified, false);
  assert.ok(codes(out).includes("CURRENT_MANIFEST_DUPLICATE_ID"));
});
test("malformed manifest SHA is rejected even if SQL and R2 match each other", () => {
  const out = reconcileExportEvidence({ ...base(), manifest: [{ id: "B", hash: "x", status: "current" }] });
  assert.equal(out.currentArtifactsVerified, false);
  assert.ok(codes(out).includes("CURRENT_MANIFEST_HASH_INVALID"));
});
test("malformed SQL SHA is rejected even when stored R2 proof is well formed", () => {
  const out = reconcileExportEvidence({ ...base(), artifactRows: [artifact("B", "x")] });
  assert.equal(out.currentArtifactsVerified, false);
  assert.ok(codes(out).includes("CURRENT_SQL_HASH_INVALID"));
});
test("malformed actual-byte SHA evidence cannot confirm an otherwise valid artifact", () => {
  const out = reconcileExportEvidence({ ...base(), objectProofs: [proof("B", "x")] });
  assert.equal(out.currentArtifactsVerified, false);
  assert.ok(codes(out).includes("R2_BYTES_SHA_INVALID"));
});
test("missing R2 byte proof stays unknown, not false and not zero", () => {
  const out = reconcileExportEvidence({ ...base(), objectProofs: [] });
  assert.equal(out.currentArtifactsVerified, false);
  assert.ok(codes(out).includes("R2_PROOF_UNKNOWN"));
});
test("two distinct current artifacts with valid proof remain verified", () => {
  const input = base();
  const out = reconcileExportEvidence({ ...input,
    manifest: [...input.manifest, { id: "C", hash: H, status: "current" }],
    artifactRows: [...input.artifactRows, artifact("C")],
    objectProofs: [...input.objectProofs, proof("C")] });
  assert.equal(out.currentArtifactsVerified, true);
  assert.deepEqual(codes(out), []);
});
