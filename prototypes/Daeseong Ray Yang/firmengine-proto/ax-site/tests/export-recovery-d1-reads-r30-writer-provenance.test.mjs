import test from "node:test";
import assert from "node:assert/strict";
import {projectExportRecoveryD1Reads} from "../lib/export-recovery-d1-reads.mjs";

// Synthetic D1/event/Manifest facts only. No customer data or cloud access.
const C="case-synthetic",R="request-aaaaaaaa",I="artifact-aaaaaaaa";
const H="a".repeat(64),B="b".repeat(64);
const fresh=()=>({
  caseId:C,caseRevision:3,mode:"draft",referenceRelease:{sha256:H},
  artifactHashes:[H],inputSha256:H,evaluationId:H,evaluationResultHash:H,
  bindingsSha256:H,documentEditsHash:H,generatorVersion:"synthetic-v1",
  formContractVersion:"synthetic-contract"
});
function fixture(){
  const writer=fresh();
  return {
    receiptRow:{case_id:C,request_id:R,request_hash:H,mode:"draft",
      case_revision:3,source_data_version:7,reference_sha256:H,status:"committed",
      artifact_ids_json:JSON.stringify([I]),manifest_fingerprint:H},
    artifactRows:[{id:I,case_id:C,revision:3,
      object_key:`cases/${C}/artifacts/${I}`,hash:H}],
    caseData:{context:{id:C,revision:3},exportManifest:{
      exportRequestId:R,documentWriter:writer,
      files:[{id:I,kind:"application",name:"draft.docx",hash:H,status:"current"}]}},
    auditRows:[{case_id:C,type:"export.generated",detail:JSON.stringify({
      requestId:R,revision:3,mode:"draft",
      files:[{id:I,hash:H,kind:"application"}],writerReceipt:fresh()})}]
  };
}
function event(x,fn){
  const detail=JSON.parse(x.auditRows[0].detail);
  fn(detail);
  x.auditRows[0].detail=JSON.stringify(detail);
}
const checks=[
  ["matched writer digest / provenance",()=>{},null,null],
  ["event writer hash contradicts generated file",
    x=>event(x,d=>{d.writerReceipt.artifactHashes=[B];}),
    "conflict","D1_EXPORT_AUDIT_WRITER_ARTIFACT_HASH_CONFLICT"],
  ["writer digest array is empty",
    x=>event(x,d=>{d.writerReceipt.artifactHashes=[];}),
    "conflict","D1_EXPORT_AUDIT_WRITER_HASHES_INVALID"],
  ["writer digest is malformed",
    x=>event(x,d=>{d.writerReceipt.artifactHashes=["bad"];}),
    "conflict","D1_EXPORT_AUDIT_WRITER_HASHES_INVALID"],
  ["writer digest shape is invalid",
    x=>event(x,d=>{d.writerReceipt.artifactHashes="invalid";}),
    "conflict","D1_EXPORT_AUDIT_WRITER_HASHES_INVALID"],
  ["explicit null writer digest is not observed",
    x=>event(x,d=>{d.writerReceipt.artifactHashes=null;}),
    "inconclusive","D1_EXPORT_AUDIT_WRITER_HASHES_NOT_OBSERVED"],
  ["event writer input differs from stored writer",
    x=>event(x,d=>{d.writerReceipt.inputSha256=B;}),
    "conflict","D1_EXPORT_AUDIT_MANIFEST_WRITER_CONFLICT"],
  ["stored writer evaluation differs from event",
    x=>{x.caseData.exportManifest.documentWriter.evaluationResultHash=B;},
    "conflict","D1_EXPORT_AUDIT_MANIFEST_WRITER_CONFLICT"],
  ["stored writer bindings digest differs",
    x=>{x.caseData.exportManifest.documentWriter.bindingsSha256=B;},
    "conflict","D1_EXPORT_AUDIT_MANIFEST_WRITER_CONFLICT"],
  ["stored writer file hashes contradict export event",
    x=>{x.caseData.exportManifest.documentWriter.artifactHashes=[B];},
    "conflict","D1_EXPORT_AUDIT_MANIFEST_WRITER_CONFLICT"],
  ["stored writer hash array malformed",
    x=>{x.caseData.exportManifest.documentWriter.artifactHashes=[1];},
    "conflict","D1_EXPORT_AUDIT_MANIFEST_WRITER_HASHES_INVALID"],
  ["explicit null stored writer hashes not observed",
    x=>{x.caseData.exportManifest.documentWriter.artifactHashes=null;},
    "inconclusive","D1_EXPORT_AUDIT_MANIFEST_WRITER_HASHES_NOT_OBSERVED"],
  ["upper-case equivalent event file hashes",
    x=>event(x,d=>{d.writerReceipt.artifactHashes=[H.toUpperCase()];}),
    null,null],
  ["upper-case equivalent stored writer hashes",
    x=>{x.caseData.exportManifest.documentWriter.artifactHashes=[H.toUpperCase()];},
    null,null],
  ["different manifest request is not re-bound to this event",
    x=>{x.caseData.exportManifest.exportRequestId="request-bbbbbbbb";
      x.caseData.exportManifest.documentWriter.inputSha256=B;},
    null,null]
];
for(const [title,mutate,classification,code] of checks){
  test(title+" is fail-closed",()=>{
    const x=fixture();mutate(x);
    const out=projectExportRecoveryD1Reads(x);
    assert.equal(out.classification??null,classification,JSON.stringify(out.codes));
    if(code) {
      assert.ok(out.codes.includes(code),JSON.stringify(out.codes));
      assert.equal(out.auditEvents,undefined);
      for(const key of ["canDelete","canReplay","canMarkCommitted","canApprove"])
        assert.equal(out[key],false,key);
    } else {
      assert.equal(out.auditEvents.length,1);
    }
  });
}
