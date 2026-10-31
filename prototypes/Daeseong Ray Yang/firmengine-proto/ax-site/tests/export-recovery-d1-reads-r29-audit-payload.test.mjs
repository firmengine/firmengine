import test from "node:test";
import assert from "node:assert/strict";
import {projectExportRecoveryD1Reads} from "../lib/export-recovery-d1-reads.mjs";
// All rows, bytes hashes and event payloads are synthetic. No staging/HTTP calls.
const C="case-synthetic",R="request-aaaaaaaa",I="artifact-aaaaaaaa";
const H="a".repeat(64),B="b".repeat(64);
const writer={caseId:C,caseRevision:3,mode:"draft",referenceRelease:{sha256:H}};
const detail={requestId:R,revision:3,mode:"draft",
  files:[{id:I,hash:H,kind:"application"}],writerReceipt:writer};
const fixture=()=>({
  receiptRow:{case_id:C,request_id:R,request_hash:H,mode:"draft",
    case_revision:3,source_data_version:7,reference_sha256:H,status:"committed",
    artifact_ids_json:JSON.stringify([I]),manifest_fingerprint:H},
  artifactRows:[{id:I,case_id:C,revision:3,
    object_key:`cases/${C}/artifacts/${I}`,hash:H}],
  caseData:{context:{id:C,revision:3},exportManifest:{exportRequestId:R,
    files:[{id:I,hash:H,kind:"application",name:"draft.docx",status:"current"}]}},
  auditRows:[{case_id:C,type:"export.generated",detail:JSON.stringify(detail)}]
});
function changeEvent(input,change){
  const value=JSON.parse(input.auditRows[0].detail);change(value);
  input.auditRows[0].detail=JSON.stringify(value);
}
function denied(result){
  for(const key of ["canDelete","canReplay","canMarkCommitted","canApprove"])
    assert.equal(result[key],false,key);
}
test("matching export.generated binds one event, never writer-prepared",()=>{
  const x=fixture(),out=projectExportRecoveryD1Reads(x);
  assert.equal(out.classification,undefined);
  assert.equal(out.auditEvents.length,1);
  assert.equal(out.writerEvents,0);
});
const negatives=[
  ["event mode conflicts with receipt",x=>changeEvent(x,d=>{d.mode="final";}),"conflict","D1_EXPORT_AUDIT_SOURCE_CONFLICT"],
  ["event revision conflicts with receipt",x=>changeEvent(x,d=>{d.revision=2;}),"conflict","D1_EXPORT_AUDIT_SOURCE_CONFLICT"],
  ["event mode is unobserved",x=>changeEvent(x,d=>{delete d.mode;}),"inconclusive","D1_EXPORT_AUDIT_SOURCE_NOT_OBSERVED"],
  ["generated artifact ID is foreign",x=>changeEvent(x,d=>{d.files[0].id="artifact-bbbbbbbb";}),"conflict","D1_EXPORT_AUDIT_FILES_CONFLICT"],
  ["event has duplicate artifact IDs",x=>changeEvent(x,d=>{d.files.push({...d.files[0]});}),"conflict","D1_EXPORT_AUDIT_CONTENT_INVALID"],
  ["event hash malformed",x=>changeEvent(x,d=>{d.files[0].hash="wrong";}),"conflict","D1_EXPORT_AUDIT_CONTENT_INVALID"],
  ["event hash null is unobserved",x=>changeEvent(x,d=>{d.files[0].hash=null;}),"inconclusive","D1_EXPORT_AUDIT_FILE_FACT_NOT_OBSERVED"],
  ["event hash differs from SQL",x=>changeEvent(x,d=>{d.files[0].hash=B;}),"conflict","D1_EXPORT_AUDIT_SQL_HASH_CONFLICT"],
  ["event hash differs from manifest when SQL missing",x=>{x.artifactRows=null;changeEvent(x,d=>{d.files[0].hash=B;});},"conflict","D1_EXPORT_AUDIT_MANIFEST_FILES_CONFLICT"],
  ["embedded writer has wrong revision",x=>changeEvent(x,d=>{d.writerReceipt.caseRevision=4;}),"conflict","D1_EXPORT_AUDIT_WRITER_SOURCE_CONFLICT"],
  ["embedded writer reference missing",x=>changeEvent(x,d=>{delete d.writerReceipt.referenceRelease;}),"inconclusive","D1_EXPORT_AUDIT_WRITER_SOURCE_NOT_OBSERVED"],
  ["embedded writer missing",x=>changeEvent(x,d=>{delete d.writerReceipt;}),"inconclusive","D1_EXPORT_AUDIT_CONTENT_NOT_OBSERVED"],
  ["D1 planned IDs unobserved",x=>{x.receiptRow.artifact_ids_json=null;},"inconclusive","D1_EXPORT_AUDIT_PLAN_NOT_OBSERVED"],
  ["D1 planned IDs malformed",x=>{x.receiptRow.artifact_ids_json="{";},"conflict","D1_EXPORT_AUDIT_PLAN_INVALID"]
];
for(const [name,mutate,classification,code] of negatives)
  test(name+" does not fabricate an audit proof",()=>{
    const x=fixture();mutate(x);const out=projectExportRecoveryD1Reads(x);
    assert.equal(out.classification,classification,JSON.stringify(out.codes));
    assert.ok(out.codes.includes(code),JSON.stringify(out.codes));
    assert.equal(out.auditEvents,undefined);
    denied(out);
  });
for(const [name,mutate] of [
  ["other request",d=>{d.requestId="request-bbbbbbbb";}],
  ["legacy event without request ID",d=>{delete d.requestId;}]
])test(name+" is not bound to this request",()=>{
  const x=fixture();changeEvent(x,mutate);
  const out=projectExportRecoveryD1Reads(x);
  assert.equal(out.classification,undefined);
  assert.deepEqual(out.auditEvents,[]);
});
