import test from "node:test";
import assert from "node:assert/strict";
import { inspectExportRecoveryEvidence } from "../lib/export-recovery-evidence.mjs";

// R25: synthetic error envelopes and projected records, not real D1/R2 reads.
const SHA = "a".repeat(64), ID = "artifact-aaaaaaaa", REQ = "request-aaaaaaaa";
const KEY = "cases/synthetic-case/artifacts/" + ID;
function fixture() { return {
  receipt:{caseId:"synthetic-case",requestId:REQ,status:"uncertain",mode:"draft",
    caseRevision:3,sourceDataVersion:7,referenceSha256:SHA,
    artifactIdsJson:JSON.stringify([ID]),manifestFingerprint:SHA},
  caseSnapshot:{caseId:"synthetic-case",revision:3,sourceDataVersion:7,referenceSha256:SHA},
  artifactRows:[{id:ID,caseId:"synthetic-case",revision:3,objectKey:KEY,hash:SHA}],
  objectProofs:[{objectKey:KEY,exists:true,verifiedSha256:SHA}],
  manifest:{requestId:REQ,artifactIds:[ID],fingerprint:SHA},
  auditEvents:["document_writer.prepared","export.generated"].map(type=>({
    type,caseId:"synthetic-case",requestId:REQ,revision:3})),
};}
const cases = [
  ["fully observed consistent source stays review-only",()=>{},"evidence_consistent_review_required",null],
  ["unobserved current source is not a stale source",x=>{x.caseSnapshot=null;},"inconclusive","CURRENT_SOURCE_NOT_OBSERVED"],
  ["empty current source projection is incomplete",x=>{x.caseSnapshot={};},"inconclusive","CURRENT_SOURCE_PARTIAL_NOT_OBSERVED"],
  ["null source revision is incomplete",x=>{x.caseSnapshot.revision=null;},"inconclusive","CURRENT_SOURCE_PARTIAL_NOT_OBSERVED"],
  ["observed revision zero is invalid",x=>{x.caseSnapshot.revision=0;},"conflict","CURRENT_SOURCE_INVALID"],
  ["observed malformed reference hash is invalid",x=>{x.caseSnapshot.referenceSha256="bad";},"conflict","CURRENT_SOURCE_INVALID"],
  ["D1 503 error envelope cannot masquerade as a changed source",x=>{x.caseSnapshot={error:"D1 unavailable",status:503};},"conflict","CURRENT_SOURCE_INVALID"],
  ["D1 429 status envelope is an invalid source",x=>{x.caseSnapshot={status:429};},"conflict","CURRENT_SOURCE_INVALID"],
  ["valid changed revision is genuinely stale",x=>{x.caseSnapshot.revision=4;},"stale","SOURCE_OR_REFERENCE_STALE"],
  ["different observed case ID is a cross-case conflict",x=>{x.caseSnapshot.caseId="other-case";},"conflict","CASE_ID_CONFLICT"],
  ["manifest timeout envelope is invalid, not historical",x=>{x.manifest={error:"read timeout",status:503};},"conflict","MANIFEST_INVALID"],
  ["missing manifest request identity is unobserved",x=>{x.manifest={};},"inconclusive","MANIFEST_REQUEST_NOT_OBSERVED"],
  ["raw persisted manifest needs explicit projection, not guessed requestId",x=>{
    x.manifest={exportRequestId:REQ,files:[{id:ID,status:"current",hash:SHA}]};
  },"inconclusive","MANIFEST_REQUEST_NOT_OBSERVED"],
  ["null manifest request identity is unobserved",x=>{x.manifest={requestId:null};},"inconclusive","MANIFEST_REQUEST_NOT_OBSERVED"],
  ["a different fully observed manifest belongs to history",x=>{
    x.manifest.requestId="request-bbbbbbbb";
  },"historical","HISTORICAL_OR_OTHER_MANIFEST"],
  ["a manifest array is invalid, not historical",x=>{x.manifest=[];},"conflict","MANIFEST_INVALID"],
];
for (const [name,mutate,expected,code] of cases) {
  test("R25 D1/R2 triage input states: "+name,()=>{
    const input=fixture();mutate(input);
    const result=inspectExportRecoveryEvidence(input);
    assert.equal(result.classification,expected,JSON.stringify(result));
    if (code) assert.ok(result.codes.includes(code),JSON.stringify(result.codes));
    for (const permission of ["canDelete","canReplay","canMarkCommitted","canApprove"])
      assert.equal(result[permission],false);
  });
}
