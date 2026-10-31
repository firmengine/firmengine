import test from "node:test";
import assert from "node:assert/strict";
import {projectExportRecoveryD1Reads} from "../lib/export-recovery-d1-reads.mjs";

// Synthetic D1/event/Manifest data only. No customer records, cloud calls or secrets.
const C="case-synthetic",R="request-aaaaaaaa",I="artifact-aaaaaaaa";
const H="a".repeat(64),B="b".repeat(64);
const writer=()=>({
  schemaVersion:"document-writer-receipt/2",caseId:C,caseRevision:3,mode:"draft",
  referenceRelease:{sha256:H},artifactHashes:[H],inputSha256:H,
  evaluationId:H,evaluationResultHash:H,bindingsSha256:H,documentEditsHash:H,
  generatorVersion:"synthetic-v1",formContractVersion:"synthetic-contract"
});
function fixture(){
  return {
    receiptRow:{case_id:C,request_id:R,request_hash:H,mode:"draft",
      case_revision:3,source_data_version:7,reference_sha256:H,status:"committed",
      artifact_ids_json:JSON.stringify([I]),manifest_fingerprint:H},
    artifactRows:[{id:I,case_id:C,revision:3,
      object_key:`cases/${C}/artifacts/${I}`,hash:H}],
    caseData:{context:{id:C,revision:3},exportManifest:{
      exportRequestId:R,documentWriter:writer(),
      files:[{id:I,kind:"application",name:"draft.docx",hash:H,status:"current"}]}},
    auditRows:[{case_id:C,type:"export.generated",detail:JSON.stringify({
      requestId:R,revision:3,mode:"draft",
      files:[{id:I,hash:H,kind:"application"}],writerReceipt:writer()})}]
  };
}
function event(x,fn){
  const detail=JSON.parse(x.auditRows[0].detail);
  fn(detail);
  x.auditRows[0].detail=JSON.stringify(detail);
}
const checks=[
  ["fully observed v2 writer",()=>{},null,null],
  ["event writer artifact hashes omitted",x=>event(x,d=>{delete d.writerReceipt.artifactHashes;}),"inconclusive","D1_EXPORT_AUDIT_WRITER_HASHES_NOT_OBSERVED"],
  ["event writer artifact hashes null",x=>event(x,d=>{d.writerReceipt.artifactHashes=null;}),"inconclusive","D1_EXPORT_AUDIT_WRITER_HASHES_NOT_OBSERVED"],
  ["stored writer artifact hashes omitted",x=>{delete x.caseData.exportManifest.documentWriter.artifactHashes;},"inconclusive","D1_EXPORT_AUDIT_MANIFEST_WRITER_HASHES_NOT_OBSERVED"],
  ["stored writer artifact hashes null",x=>{x.caseData.exportManifest.documentWriter.artifactHashes=null;},"inconclusive","D1_EXPORT_AUDIT_MANIFEST_WRITER_HASHES_NOT_OBSERVED"],
  ["event input SHA omitted",x=>event(x,d=>{delete d.writerReceipt.inputSha256;}),"inconclusive","D1_EXPORT_AUDIT_WRITER_FIELD_NOT_OBSERVED"],
  ["stored input SHA omitted",x=>{delete x.caseData.exportManifest.documentWriter.inputSha256;},"inconclusive","D1_EXPORT_AUDIT_WRITER_FIELD_NOT_OBSERVED"],
  ["event schema omitted",x=>event(x,d=>{delete d.writerReceipt.schemaVersion;}),"inconclusive","D1_EXPORT_AUDIT_WRITER_FIELD_NOT_OBSERVED"],
  ["stored schema omitted",x=>{delete x.caseData.exportManifest.documentWriter.schemaVersion;},"inconclusive","D1_EXPORT_AUDIT_WRITER_FIELD_NOT_OBSERVED"],
  ["event evaluation result omitted",x=>event(x,d=>{delete d.writerReceipt.evaluationResultHash;}),"inconclusive","D1_EXPORT_AUDIT_WRITER_FIELD_NOT_OBSERVED"],
  ["stored bindings omitted",x=>{delete x.caseData.exportManifest.documentWriter.bindingsSha256;},"inconclusive","D1_EXPORT_AUDIT_WRITER_FIELD_NOT_OBSERVED"],
  ["event input SHA explicit null",x=>event(x,d=>{d.writerReceipt.inputSha256=null;}),"inconclusive","D1_EXPORT_AUDIT_WRITER_FIELD_NOT_OBSERVED"],
  ["stored generator version explicit null",x=>{x.caseData.exportManifest.documentWriter.generatorVersion=null;},"inconclusive","D1_EXPORT_AUDIT_WRITER_FIELD_NOT_OBSERVED"],
  ["stored writer receipt absent",x=>{delete x.caseData.exportManifest.documentWriter;},"inconclusive","D1_EXPORT_AUDIT_MANIFEST_WRITER_NOT_OBSERVED"],
  ["same malformed input SHA on both sides",x=>{x.caseData.exportManifest.documentWriter.inputSha256="bad";event(x,d=>{d.writerReceipt.inputSha256="bad";});},"conflict","D1_EXPORT_AUDIT_WRITER_CONTRACT_INVALID"],
  ["matching obsolete schema on both sides",x=>{x.caseData.exportManifest.documentWriter.schemaVersion="legacy";event(x,d=>{d.writerReceipt.schemaVersion="legacy";});},"conflict","D1_EXPORT_AUDIT_WRITER_CONTRACT_INVALID"],
  ["matching empty generator on both sides",x=>{x.caseData.exportManifest.documentWriter.generatorVersion="";event(x,d=>{d.writerReceipt.generatorVersion="";});},"conflict","D1_EXPORT_AUDIT_WRITER_CONTRACT_INVALID"],
  ["event rendered hash contradicts file",x=>event(x,d=>{d.writerReceipt.artifactHashes=[B];}),"conflict","D1_EXPORT_AUDIT_WRITER_ARTIFACT_HASH_CONFLICT"],
  ["manifest rendered hash contradicts event",x=>{x.caseData.exportManifest.documentWriter.artifactHashes=[B];},"conflict","D1_EXPORT_AUDIT_MANIFEST_WRITER_CONFLICT"],
  ["equivalent hash capitalization is accepted",x=>event(x,d=>{d.writerReceipt.artifactHashes=[H.toUpperCase()];}),null,null],
  ["different historical Manifest is not rebound",x=>{x.caseData.exportManifest.exportRequestId="request-bbbbbbbb";x.caseData.exportManifest.documentWriter.inputSha256=B;},null,null]
];
for(const [name,mutate,classification,code] of checks)
  test(name+" remains fail-closed",()=>{
    const x=fixture();mutate(x);
    const result=projectExportRecoveryD1Reads(x);
    assert.equal(result.classification??null,classification,JSON.stringify(result.codes));
    if(code){
      assert.ok(result.codes.includes(code),JSON.stringify(result.codes));
      assert.equal(result.auditEvents,undefined);
      for(const key of ["canDelete","canReplay","canMarkCommitted","canApprove"])
        assert.equal(result[key],false,key);
    }else{
      assert.equal(result.auditEvents.length,1);
      assert.equal(result.auditEvents[0].requestId,R);
    }
  });
