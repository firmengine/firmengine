import test from "node:test";
import assert from "node:assert/strict";
import { inspectExportRecoveryEvidence } from "../lib/export-recovery-evidence.mjs";

// All inputs are synthetic; D1/R2 observations are deliberately simulated.
const SHA = "a".repeat(64);
const PLAN_ID = "artifact-aaaaaaaa";
const KEY = "cases/synthetic-case/artifacts/" + PLAN_ID;
function fixture() {
  return {
    receipt: {caseId:"synthetic-case",requestId:"request-aaaaaaaa",status:"uncertain",
      caseRevision:3,sourceDataVersion:7,referenceSha256:SHA,
      artifactIdsJson:JSON.stringify([PLAN_ID]),manifestFingerprint:SHA},
    caseSnapshot:{caseId:"synthetic-case",revision:3,sourceDataVersion:7,referenceSha256:SHA},
    artifactRows:[{id:PLAN_ID,caseId:"synthetic-case",revision:3,objectKey:KEY,hash:SHA}],
    objectProofs:[{objectKey:KEY,exists:true,verifiedSha256:SHA}],
    manifest:{requestId:"request-aaaaaaaa",artifactIds:[PLAN_ID],fingerprint:SHA},
    auditEvents:["document_writer.prepared","export.generated"].map(type=>({
      type,caseId:"synthetic-case",requestId:"request-aaaaaaaa",revision:3})),
  };
}
function verify(mutate, expected, code) {
  const input=fixture();
  mutate(input);
  const result=inspectExportRecoveryEvidence(input);
  assert.equal(result.classification,expected);
  if(code) assert.ok(result.codes.includes(code),code+" absent: "+result.codes.join(","));
  for(const key of ["canDelete","canReplay","canMarkCommitted","canApprove"])
    assert.equal(result[key],false,"must remain read-only: "+key);
}
test("valid matching evidence still requires human review",()=>verify(
  ()=>{},"evidence_consistent_review_required"));
test("foreign case different artifact ID cannot share planned R2 object key",()=>verify(
  x=>x.artifactRows.push({id:"artifact-bbbbbbbb",caseId:"foreign-case",
    revision:3,objectKey:KEY,hash:SHA}),
  "conflict","SQL_OBJECT_KEY_ALIAS_CONFLICT"));
test("different artifact ID in same case cannot share planned object key",()=>verify(
  x=>x.artifactRows.push({id:"artifact-bbbbbbbb",caseId:"synthetic-case",
    revision:3,objectKey:KEY,hash:SHA}),
  "conflict","SQL_OBJECT_KEY_ALIAS_CONFLICT"));
test("old revision artifact ID cannot reuse planned object key",()=>verify(
  x=>x.artifactRows.push({id:"artifact-bbbbbbbb",caseId:"synthetic-case",
    revision:2,objectKey:KEY,hash:SHA}),
  "conflict","SQL_OBJECT_KEY_ALIAS_CONFLICT"));
test("foreign case same artifact ID remains blocked",()=>verify(
  x=>x.artifactRows.push({id:PLAN_ID,caseId:"foreign-case",
    revision:3,objectKey:KEY,hash:SHA}),
  "conflict","SQL_OBJECT_KEY_ALIAS_CONFLICT"));
test("unrelated foreign artifact with distinct key remains independent",()=>verify(
  x=>x.artifactRows.push({id:"artifact-bbbbbbbb",caseId:"foreign-case",
    revision:3,objectKey:"cases/foreign-case/artifacts/artifact-bbbbbbbb",hash:SHA}),
  "evidence_consistent_review_required"));
test("unrelated same-case artifact with distinct key remains independent",()=>verify(
  x=>x.artifactRows.push({id:"artifact-bbbbbbbb",caseId:"synthetic-case",
    revision:3,objectKey:"cases/synthetic-case/artifacts/artifact-bbbbbbbb",hash:SHA}),
  "evidence_consistent_review_required"));
test("duplicate planned artifact is still blocked by original contract",()=>verify(
  x=>x.artifactRows.push({...x.artifactRows[0]}),
  "conflict","SQL_ROW_DUPLICATE"));
test("unobserved SQL list is not treated as empty",()=>verify(
  x=>{x.artifactRows=null;},"inconclusive","SQL_ROWS_NOT_OBSERVED"));
test("malformed R2 observation remains a conflict",()=>verify(
  x=>{x.objectProofs={status:503,error:"synthetic"};},
  "conflict","R2_PROOFS_INVALID"));
test("changed source version remains stale",()=>verify(
  x=>{x.caseSnapshot.sourceDataVersion=8;},
  "stale","SOURCE_OR_REFERENCE_STALE"));
test("missing R2 evidence remains incomplete",()=>verify(
  x=>{x.objectProofs=[];},
  "inconclusive","R2_PROOF_UNKNOWN"));
