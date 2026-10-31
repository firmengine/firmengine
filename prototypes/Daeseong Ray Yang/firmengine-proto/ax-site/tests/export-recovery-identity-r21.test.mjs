import test from "node:test";
import assert from "node:assert/strict";
import { inspectExportRecoveryEvidence } from "../lib/export-recovery-evidence.mjs";

// Entirely synthetic: no customer document, OCR fact, or real court data.
const H="a".repeat(64), ID="artifact-aaaaaaaa", REQ="request-aaaaaaaa";
function fixture() { return {
  receipt:{caseId:"synthetic-case",requestId:REQ,status:"uncertain",caseRevision:3,
    sourceDataVersion:7,referenceSha256:H,artifactIdsJson:JSON.stringify([ID]),manifestFingerprint:H},
  caseSnapshot:{caseId:"synthetic-case",revision:3,sourceDataVersion:7,referenceSha256:H},
  artifactRows:[{id:ID,caseId:"synthetic-case",revision:3,
    objectKey:"cases/synthetic-case/artifacts/"+ID,hash:H}],
  objectProofs:[{objectKey:"cases/synthetic-case/artifacts/"+ID,exists:true,verifiedSha256:H}],
  manifest:{requestId:REQ,artifactIds:[ID],fingerprint:H},
  auditEvents:["document_writer.prepared","export.generated"].map(type=>({
    type,caseId:"synthetic-case",requestId:REQ,revision:3})),
}; }
function mirroredBadIdentity(field,value) {
  const x=fixture();
  if(field==="caseId") {
    x.receipt.caseId=x.caseSnapshot.caseId=x.artifactRows[0].caseId=value;
    x.artifactRows[0].objectKey=x.objectProofs[0].objectKey="cases/"+value+"/artifacts/"+ID;
    for(const ev of x.auditEvents)ev.caseId=value;
  } else if(field==="caseRevision") {
    x.receipt.caseRevision=x.caseSnapshot.revision=x.artifactRows[0].revision=value;
    for(const ev of x.auditEvents)ev.revision=value;
  } else if(field==="sourceDataVersion") {
    x.receipt.sourceDataVersion=x.caseSnapshot.sourceDataVersion=value;
  } else if(field==="referenceSha256") {
    x.receipt.referenceSha256=x.caseSnapshot.referenceSha256=value;
  }
  return x;
}
const cases=[
  ["empty case ID", "caseId","", "conflict","RECEIPT_SOURCE_IDENTITY_INVALID"],
  ["zero case revision","caseRevision",0,"conflict","RECEIPT_SOURCE_IDENTITY_INVALID"],
  ["fractional revision","caseRevision",3.5,"conflict","RECEIPT_SOURCE_IDENTITY_INVALID"],
  ["string source version","sourceDataVersion","7","conflict","RECEIPT_SOURCE_IDENTITY_INVALID"],
  ["bad reference SHA","referenceSha256","bad","conflict","RECEIPT_SOURCE_IDENTITY_INVALID"],
  ["NULL source version","sourceDataVersion",null,"inconclusive","RECEIPT_SOURCE_NOT_OBSERVED"],
  ["NULL reference SHA","referenceSha256",null,"inconclusive","RECEIPT_SOURCE_NOT_OBSERVED"],
];
for(const [name,field,value,want,code] of cases){
  test("mirrored invalid recovery identity: "+name,()=>{
    const out=inspectExportRecoveryEvidence(mirroredBadIdentity(field,value));
    assert.equal(out.classification,want);
    assert.ok(out.codes.includes(code),"missing "+code+": "+out.codes.join(","));
    for(const flag of ["canDelete","canReplay","canMarkCommitted","canApprove"])
      assert.equal(out[flag],false);
  });
}
test("valid synthetic snapshot remains read-only manual review",()=>{
  const out=inspectExportRecoveryEvidence(fixture());
  assert.equal(out.classification,"evidence_consistent_review_required");
  assert.equal(out.canApprove,false);
});
