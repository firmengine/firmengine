import test from "node:test";
import assert from "node:assert/strict";
import {projectExportRecoveryD1Reads} from "../lib/export-recovery-d1-reads.mjs";

// Public synthetic identities only. No D1/R2/HTTP request or legal approval.
const C="case-synthetic",R="request-aaaaaaaa",I="artifact-aaaaaaaa";
const H="a".repeat(64),B="b".repeat(64);
const writer=()=>({
  schemaVersion:"document-writer-receipt/2",caseId:C,caseRevision:3,
  mode:"draft",referenceRelease:{sha256:H},artifactHashes:[H],
  inputSha256:H,evaluationId:H,evaluationResultHash:H,
  bindingsSha256:H,documentEditsHash:H,generatorVersion:"synthetic-v1",
  formContractVersion:"synthetic-contract"
});
const fixture=()=>({
  receiptRow:{case_id:C,request_id:R,request_hash:H,mode:"draft",
    case_revision:3,source_data_version:7,reference_sha256:H,status:"committed",
    artifact_ids_json:JSON.stringify([I]),manifest_fingerprint:H},
  artifactRows:[{id:I,case_id:C,revision:3,
    object_key:`cases/${C}/artifacts/${I}`,hash:H}],
  caseData:{context:{id:C,revision:3},exportManifest:{
    exportRequestId:R,caseRevision:3,sourceDataVersionAtExport:7,
    mode:"draft",documentWriter:writer(),files:[
      {id:I,kind:"application",name:"draft.docx",hash:H,status:"current"}]}},
  auditRows:[{case_id:C,type:"export.generated",detail:JSON.stringify({
    requestId:R,revision:3,mode:"draft",
    files:[{id:I,hash:H,kind:"application"}],writerReceipt:writer()})}]
});
const cases=[
  ["fully matching current manifest",()=>{},null,null],
  ["stored writer foreign case",x=>{x.caseData.exportManifest.documentWriter.caseId="foreign-case";},"conflict","D1_EXPORT_AUDIT_MANIFEST_WRITER_SOURCE_CONFLICT"],
  ["stored writer obsolete revision",x=>{x.caseData.exportManifest.documentWriter.caseRevision=2;},"conflict","D1_EXPORT_AUDIT_MANIFEST_WRITER_SOURCE_CONFLICT"],
  ["stored writer wrong mode",x=>{x.caseData.exportManifest.documentWriter.mode="final";},"conflict","D1_EXPORT_AUDIT_MANIFEST_WRITER_SOURCE_CONFLICT"],
  ["stored writer changed reference",x=>{x.caseData.exportManifest.documentWriter.referenceRelease.sha256=B;},"conflict","D1_EXPORT_AUDIT_MANIFEST_WRITER_SOURCE_CONFLICT"],
  ["stored writer case missing",x=>{delete x.caseData.exportManifest.documentWriter.caseId;},"inconclusive","D1_EXPORT_AUDIT_MANIFEST_WRITER_SOURCE_NOT_OBSERVED"],
  ["stored writer revision null",x=>{x.caseData.exportManifest.documentWriter.caseRevision=null;},"inconclusive","D1_EXPORT_AUDIT_MANIFEST_WRITER_SOURCE_NOT_OBSERVED"],
  ["stored writer mode absent",x=>{delete x.caseData.exportManifest.documentWriter.mode;},"inconclusive","D1_EXPORT_AUDIT_MANIFEST_WRITER_SOURCE_NOT_OBSERVED"],
  ["stored writer reference not observed",x=>{delete x.caseData.exportManifest.documentWriter.referenceRelease;},"inconclusive","D1_EXPORT_AUDIT_MANIFEST_WRITER_SOURCE_NOT_OBSERVED"],
  ["manifest revision moved",x=>{x.caseData.exportManifest.caseRevision=4;},"conflict","D1_EXPORT_AUDIT_MANIFEST_SOURCE_CONFLICT"],
  ["manifest OCR version changed",x=>{x.caseData.exportManifest.sourceDataVersionAtExport=8;},"conflict","D1_EXPORT_AUDIT_MANIFEST_SOURCE_CONFLICT"],
  ["manifest mode changed",x=>{x.caseData.exportManifest.mode="final";},"conflict","D1_EXPORT_AUDIT_MANIFEST_SOURCE_CONFLICT"],
  ["manifest file invalidated",x=>{x.caseData.exportManifest.files[0].status="invalidated";},"conflict","MANIFEST_FILES_NOT_CURRENT_OR_CONFLICT"],
  ["manifest file archived",x=>{x.caseData.exportManifest.files[0].status="archived";},"conflict","MANIFEST_FILES_NOT_CURRENT_OR_CONFLICT"],
  ["manifest file status unobserved",x=>{delete x.caseData.exportManifest.files[0].status;},"inconclusive","D1_EXPORT_AUDIT_MANIFEST_FILE_STATUS_NOT_OBSERVED"],
  ["manifest file status explicit null",x=>{x.caseData.exportManifest.files[0].status=null;},"inconclusive","D1_EXPORT_AUDIT_MANIFEST_FILE_STATUS_NOT_OBSERVED"],
  ["historical manifest never made current",x=>{
    x.caseData.exportManifest.exportRequestId="request-bbbbbbbb";
    x.caseData.exportManifest.documentWriter.caseId="foreign-case";
  },null,null]
];
for(const [name,mutate,classification,code] of cases)
  test("R32 stored writer source: "+name,()=>{
    const input=fixture();mutate(input);
    const out=projectExportRecoveryD1Reads(input);
    assert.equal(out.classification??null,classification,JSON.stringify(out.codes));
    if(code){
      assert.ok(out.codes.includes(code),JSON.stringify(out.codes));
      assert.equal(out.auditEvents,undefined);
      for(const key of ["canDelete","canReplay","canMarkCommitted","canApprove"])
        assert.equal(out[key],false,key);
    }else{
      assert.equal(out.auditEvents.length,1);
      assert.equal(out.auditEvents[0].requestId,R);
    }
  });
