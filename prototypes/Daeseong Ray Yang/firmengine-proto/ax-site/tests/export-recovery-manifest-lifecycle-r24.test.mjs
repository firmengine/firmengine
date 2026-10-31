import test from "node:test";
import assert from "node:assert/strict";
import { inspectExportRecoveryEvidence } from "../lib/export-recovery-evidence.mjs";

// Synthetic recovery observations ONLY. No customer material or real R2/D1 reads.
const SHA="a".repeat(64), ID="artifact-aaaaaaaa", REQ="request-aaaaaaaa";
const KEY="cases/synthetic-case/artifacts/"+ID;
function fixture() { return {
  receipt:{caseId:"synthetic-case",requestId:REQ,status:"uncertain",mode:"draft",
    caseRevision:3,sourceDataVersion:7,referenceSha256:SHA,
    artifactIdsJson:JSON.stringify([ID]),manifestFingerprint:SHA},
  caseSnapshot:{caseId:"synthetic-case",revision:3,sourceDataVersion:7,referenceSha256:SHA},
  artifactRows:[{id:ID,caseId:"synthetic-case",revision:3,objectKey:KEY,hash:SHA}],
  objectProofs:[{objectKey:KEY,exists:true,verifiedSha256:SHA}],
  manifest:{requestId:REQ,artifactIds:[ID],fingerprint:SHA,caseRevision:3,
    sourceDataVersionAtExport:7,mode:"draft",
    files:[{id:ID,hash:SHA,status:"current"}],
    documentWriter:{caseId:"synthetic-case",caseRevision:3,mode:"draft",
      referenceRelease:{sha256:SHA}}},
  auditEvents:["document_writer.prepared","export.generated"].map(type=>({
    type,caseId:"synthetic-case",requestId:REQ,revision:3})),
}; }
const cases=[
  ["baseline observed lifecycle is still review-only",()=>{},"evidence_consistent_review_required",null],
  ["explicit invalidation cannot be classified as current",x=>{x.manifest.files[0].status="invalidated";},"conflict","MANIFEST_FILES_NOT_CURRENT_OR_CONFLICT"],
  ["archived file cannot be classified as current",x=>{x.manifest.files[0].status="archived";},"conflict","MANIFEST_FILES_NOT_CURRENT_OR_CONFLICT"],
  ["old writer revision cannot be treated as matched",x=>{x.manifest.documentWriter.caseRevision=2;},"conflict","WRITER_RECEIPT_SOURCE_CONFLICT"],
  ["changed reference release cannot reuse writer receipt",x=>{x.manifest.documentWriter.referenceRelease.sha256="b".repeat(64);},"conflict","WRITER_RECEIPT_SOURCE_CONFLICT"],
  ["explicitly null writer is a conflict not an approval",x=>{x.manifest.documentWriter=null;},"conflict","WRITER_RECEIPT_SOURCE_CONFLICT"],
  ["old original source version in manifest is a conflict",x=>{x.manifest.sourceDataVersionAtExport=6;},"conflict","MANIFEST_SOURCE_IDENTITY_CONFLICT"],
  ["manifest file identity swapped despite matching plan",x=>{x.manifest.files[0].id="artifact-bbbbbbbb";},"conflict","MANIFEST_FILES_NOT_CURRENT_OR_CONFLICT"],
  ["observed empty files conflicts with reserved nonempty plan",x=>{x.manifest.files=[];},"conflict","MANIFEST_FILES_NOT_CURRENT_OR_CONFLICT"],
  ["file hash conflicts with observed SQL",x=>{x.manifest.files[0].hash="b".repeat(64);},"conflict","MANIFEST_FILES_NOT_CURRENT_OR_CONFLICT"],
  ["export mode difference blocks same-request evidence",x=>{x.manifest.mode="final";},"conflict","MANIFEST_SOURCE_IDENTITY_CONFLICT"],
  ["old reduced projection stays read-only without invented status",x=>{
    delete x.manifest.files; delete x.manifest.documentWriter;
    delete x.manifest.caseRevision; delete x.manifest.sourceDataVersionAtExport;
    delete x.manifest.mode;
  },"evidence_consistent_review_required",null],
];
for (const [name,mutate,classification,code] of cases) {
  test("R24 observed manifest lifecycle: "+name,()=>{
    const x=fixture(); mutate(x);
    const out=inspectExportRecoveryEvidence(x);
    assert.equal(out.classification,classification);
    if(code)assert.ok(out.codes.includes(code),out.codes.join(","));
    for(const flag of ["canDelete","canReplay","canMarkCommitted","canApprove"])
      assert.equal(out[flag],false);
  });
}
