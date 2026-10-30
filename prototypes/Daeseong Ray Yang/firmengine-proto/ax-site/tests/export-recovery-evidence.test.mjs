import test from "node:test";
import assert from "node:assert/strict";
import { inspectExportRecoveryEvidence } from "../lib/export-recovery-evidence.mjs";

const H = "a".repeat(64);
const KEY = "cases/synthetic-case/artifacts/artifact-aaaaaaaa";
function fixture() {
  return {
    receipt: {caseId:"synthetic-case",requestId:"request-aaaaaaaa",status:"uncertain",
      caseRevision:3,sourceDataVersion:7,referenceSha256:H,
      artifactIdsJson:JSON.stringify(["artifact-aaaaaaaa"]),manifestFingerprint:H},
    caseSnapshot: {caseId:"synthetic-case",revision:3,sourceDataVersion:7,referenceSha256:H},
    artifactRows:[{id:"artifact-aaaaaaaa",caseId:"synthetic-case",revision:3,objectKey:KEY,hash:H}],
    objectProofs:[{objectKey:KEY,exists:true,verifiedSha256:H}],
    manifest:{requestId:"request-aaaaaaaa",artifactIds:["artifact-aaaaaaaa"],fingerprint:H},
    auditEvents:[{type:"document_writer.prepared",caseId:"synthetic-case",requestId:"request-aaaaaaaa",revision:3},
      {type:"export.generated",caseId:"synthetic-case",requestId:"request-aaaaaaaa",revision:3}],
  };
}
function expect(mutator, classification, issue) {
  const input=fixture(); mutator(input);
  const out=inspectExportRecoveryEvidence(input);
  assert.equal(out.classification, classification);
  if(issue) assert.ok(out.codes.includes(issue), issue + " missing: " + out.codes.join(","));
  for(const flag of ["canDelete","canReplay","canMarkCommitted","canApprove"])
    assert.equal(out[flag], false, "read-only decision " + flag);
}
test("uncertain receipt + SQL/R2/manifest/audit consistency requires manual review", () =>
  expect(() => {}, "evidence_consistent_review_required"));
test("committed receipt still never authorizes reuse or legal approval", () =>
  expect(x=>{x.receipt.status="committed";}, "evidence_consistent_review_required"));
test("NULL reserved plan is unobserved, not observed empty", () =>
  expect(x=>{x.receipt.artifactIdsJson=null;}, "unplanned", "PLAN_NOT_OBSERVED"));
test("observed empty artifact plan is invalid", () =>
  expect(x=>{x.receipt.artifactIdsJson="[]";}, "conflict", "PLAN_OBSERVED_EMPTY"));
test("garbled JSON plan cannot be considered a known zero", () =>
  expect(x=>{x.receipt.artifactIdsJson="{";}, "conflict", "PLAN_INVALID"));
test("duplicate reserved artifact IDs block evidence", () =>
  expect(x=>{x.receipt.artifactIdsJson=JSON.stringify(["artifact-aaaaaaaa","artifact-aaaaaaaa"]);},
    "conflict", "PLAN_INVALID_OR_DUPLICATE_ID"));
test("R2 success but SQL row absent is partial not committed", () =>
  expect(x=>{x.artifactRows=[];}, "inconclusive", "R2_WITHOUT_SQL_ROW"));
test("no R2 probes is unknown, not R2 object absent", () =>
  expect(x=>{x.objectProofs=[];}, "inconclusive", "R2_PROOF_UNKNOWN"));
test("explicit R2 missing observation remains partial", () =>
  expect(x=>{x.objectProofs[0].exists=false;}, "inconclusive", "R2_OBJECT_OBSERVED_MISSING"));
test("R2 byte SHA mismatch is conflicting evidence", () =>
  expect(x=>{x.objectProofs[0].verifiedSha256="b".repeat(64);},
    "conflict", "R2_BYTES_HASH_CONFLICT"));
test("historical A after manifest B cannot become current again", () =>
  expect(x=>{x.manifest.requestId="request-bbbbbbbb";},
    "historical", "HISTORICAL_OR_OTHER_MANIFEST"));
test("source-only OCR version change marks old export stale", () =>
  expect(x=>{x.caseSnapshot.sourceDataVersion=8;}, "stale", "SOURCE_OR_REFERENCE_STALE"));
test("contradictory duplicate R2 probes are not last-writer-wins", () =>
  expect(x=>{x.objectProofs.push({...x.objectProofs[0],exists:false});},
    "conflict", "R2_PROOF_CONFLICT"));
test("observed audit array empty differs from audit unobserved", () =>
  expect(x=>{x.auditEvents=[];}, "inconclusive", "AUDIT_EVENTS_OBSERVED_INCOMPLETE"));
test("foreign-case SQL row is never accepted", () =>
  expect(x=>{x.artifactRows[0].caseId="foreign-case";},
    "conflict", "SQL_IDENTITY_OR_HASH_CONFLICT"));
test("SQL rows unobserved differs from SQL zero rows", () =>
  expect(x=>{x.artifactRows=null;}, "inconclusive", "SQL_ROWS_NOT_OBSERVED"));
test("new manifest substituted artifact list is conflict", () =>
  expect(x=>{x.manifest.artifactIds=["artifact-bbbbbbbb"];},
    "conflict", "MANIFEST_PLAN_CONFLICT"));
test("R2 proof collection unobserved is not a missing object", () =>
  expect(x=>{x.objectProofs=null;}, "inconclusive", "R2_PROOFS_NOT_OBSERVED"));
test("SQL null hash is conflict, not a diagnostic runtime crash", () =>
  expect(x=>{x.artifactRows[0].hash=null;}, "conflict", "SQL_IDENTITY_OR_HASH_CONFLICT"));
test("same type of audit event from another request is not receipt evidence", () =>
  expect(x=>{x.auditEvents[0].requestId="request-bbbbbbbb";},
    "inconclusive", "AUDIT_EVENTS_OBSERVED_INCOMPLETE"));
test("same request event from another case is not receipt evidence", () =>
  expect(x=>{x.auditEvents[1].caseId="foreign-case";},
    "inconclusive", "AUDIT_EVENTS_OBSERVED_INCOMPLETE"));
test("R2 success with SQL collection unobserved cannot assert an orphan", () => {
  const input=fixture(); input.artifactRows=null;
  const out=inspectExportRecoveryEvidence(input);
  assert.equal(out.classification,"inconclusive");
  assert.ok(out.codes.includes("SQL_ROWS_NOT_OBSERVED"));
  assert.equal(out.codes.includes("R2_WITHOUT_SQL_ROW"),false);
  assert.equal(out.canDelete,false);
});
