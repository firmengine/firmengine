import test from "node:test";
import assert from "node:assert/strict";
import { inspectExportRecoveryEvidence } from "../lib/export-recovery-evidence.mjs";

// Entirely synthetic: error envelopes model failed reads, not observed database rows.
const H = "a".repeat(64);
const ID = "artifact-aaaaaaaa", REQ = "request-aaaaaaaa";
const KEY = "cases/synthetic-case/artifacts/" + ID;
function fixture() {
  return {
    receipt: {caseId:"synthetic-case", requestId:REQ, status:"uncertain",
      caseRevision:3, sourceDataVersion:7, referenceSha256:H,
      artifactIdsJson:JSON.stringify([ID]), manifestFingerprint:H},
    caseSnapshot: {caseId:"synthetic-case", revision:3, sourceDataVersion:7, referenceSha256:H},
    artifactRows:[{id:ID,caseId:"synthetic-case",revision:3,objectKey:KEY,hash:H}],
    objectProofs:[{objectKey:KEY,exists:true,verifiedSha256:H}],
    manifest:{requestId:REQ,artifactIds:[ID],fingerprint:H},
    auditEvents:["document_writer.prepared","export.generated"].map(type=>({
      type,caseId:"synthetic-case",requestId:REQ,revision:3})),
  };
}
const malformed = [
  ["D1 503 wrapper", x => {x.artifactRows={status:503,error:"synthetic"};}, "SQL_ROWS_INVALID"],
  ["D1 row null", x => {x.artifactRows=[null];}, "SQL_ROWS_INVALID"],
  ["R2 429 wrapper", x => {x.objectProofs={status:429,error:"synthetic"};}, "R2_PROOFS_INVALID"],
  ["R2 proof null", x => {x.objectProofs=[null];}, "R2_PROOFS_INVALID"],
  ["audit timeout wrapper", x => {x.auditEvents={error:"synthetic-timeout"};}, "AUDIT_EVENTS_INVALID"],
  ["audit event null", x => {x.auditEvents=[null];}, "AUDIT_EVENTS_INVALID"],
];
for (const [name,mutate,code] of malformed) {
  test("malformed recovery observation cannot crash: "+name, () => {
    const x=fixture(); mutate(x);
    const out=inspectExportRecoveryEvidence(x);
    assert.equal(out.classification,"conflict");
    assert.ok(out.codes.includes(code),out.codes.join(","));
    for(const flag of ["canDelete","canReplay","canMarkCommitted","canApprove"])
      assert.equal(out[flag],false);
  });
}
const controls=[
  ["D1 null unobserved",x=>{x.artifactRows=null;},"inconclusive","SQL_ROWS_NOT_OBSERVED"],
  ["D1 empty observed",x=>{x.artifactRows=[];},"inconclusive","R2_WITHOUT_SQL_ROW"],
  ["R2 null unobserved",x=>{x.objectProofs=null;},"inconclusive","R2_PROOFS_NOT_OBSERVED"],
  ["R2 empty observed",x=>{x.objectProofs=[];},"inconclusive","R2_PROOF_UNKNOWN"],
  ["audit empty observed",x=>{x.auditEvents=[];},"inconclusive","AUDIT_EVENTS_OBSERVED_INCOMPLETE"],
  ["valid uncertain receipt",()=>{},"evidence_consistent_review_required",null],
];
for(const [name,mutate,want,code] of controls) {
  test("recovery classification control: "+name,()=>{
    const x=fixture();mutate(x);const out=inspectExportRecoveryEvidence(x);
    assert.equal(out.classification,want);
    if(code)assert.ok(out.codes.includes(code),out.codes.join(","));
    assert.equal(out.canApprove,false);
    assert.equal(out.canReplay,false);
  });
}
