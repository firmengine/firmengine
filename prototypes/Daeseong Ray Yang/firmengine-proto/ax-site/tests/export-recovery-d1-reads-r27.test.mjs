import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {EXPORT_RECOVERY_RECEIPT_SELECT_SQL,EXPORT_RECOVERY_AUDIT_SELECT_SQL,
  exportRecoveryArtifactSelect,projectExportRecoveryD1Reads,
  inspectExportRecoveryFromD1Reads} from "../lib/export-recovery-d1-reads.mjs";

// ALL records in this file are synthetic, including D1 rows, event payloads and R2 GET proofs.
const H="a".repeat(64),I="artifact-aaaaaaaa",R="request-aaaaaaaa",C="case-synthetic";
const writer={caseId:C,caseRevision:3,mode:"draft",referenceRelease:{sha256:H}};
const canonical=v=>v===undefined?"null":Array.isArray(v)?
  "["+v.map(canonical).join(",")+"]":v&&typeof v==="object"?
  "{"+Object.entries(v).filter(([,x])=>x!==undefined).sort(([a],[b])=>a.localeCompare(b))
    .map(([k,x])=>JSON.stringify(k)+":"+canonical(x)).join(",")+"}":JSON.stringify(v);
const commandHash=async value=>createHash("sha256").update(canonical(value)).digest("hex");
async function fixture(){
  const files=[{id:I,kind:"application",name:"draft.docx",hash:H}];
  const manifestFingerprint=await commandHash({caseId:C,requestId:R,mode:"draft",
    caseRevision:3,sourceDataVersion:7,referenceSha256:H,files});
  return {
    caseData:{context:{id:C,revision:3},exportManifest:{exportRequestId:R,
      caseRevision:3,sourceDataVersionAtExport:7,mode:"draft",
      files:files.map(f=>({...f,status:"current"})),documentWriter:writer}},
    caseSnapshot:{caseId:C,revision:3,sourceDataVersion:7,referenceSha256:H},
    receiptRow:{case_id:C,request_id:R,request_hash:H,mode:"draft",
      case_revision:3,source_data_version:7,reference_sha256:H,status:"committed",
      artifact_ids_json:JSON.stringify([I]),manifest_fingerprint:manifestFingerprint},
    artifactRows:[{id:I,case_id:C,revision:3,object_key:`cases/${C}/artifacts/${I}`,hash:H}],
    r2BytesProofs:[{objectKey:`cases/${C}/artifacts/${I}`,exists:true,
      verification:"r2-get-byte-sha256",bytesHash:H}],
    auditRows:[{case_id:C,type:"document_writer.prepared",actor:"staff",
      at:"2026-10-31T06:00:00Z",detail:JSON.stringify(writer)},
      {case_id:C,type:"export.generated",actor:"staff",
        at:"2026-10-31T06:00:00Z",
        detail:JSON.stringify({revision:3,requestId:R,writerReceipt:writer})}]
  };
}
const denied=out=>{
  for(const key of ["canDelete","canReplay","canMarkCommitted","canApprove"])
    assert.equal(out[key],false,key);
};
async function verify(mutate,expected,code){
  const input=await fixture(); mutate(input);
  const out=await inspectExportRecoveryFromD1Reads(input,commandHash);
  assert.equal(out.classification,expected,JSON.stringify(out.codes));
  assert.ok(out.codes.includes(code),`expected ${code}, got ${out.codes}`);
  denied(out);
}
test("D1 receipt SELECT includes reserved artifact IDs and remains read-only",()=>{
  assert.match(EXPORT_RECOVERY_RECEIPT_SELECT_SQL,/artifact_ids_json AS artifactIdsJson/);
  assert.match(EXPORT_RECOVERY_RECEIPT_SELECT_SQL,/WHERE case_id=\? AND request_id=\?/);
  assert.match(EXPORT_RECOVERY_AUDIT_SELECT_SQL,/FROM events WHERE case_id=\?/);
  const q=exportRecoveryArtifactSelect(C,[I]);
  assert.equal(q.args[0],JSON.stringify([I]));
  assert.deepEqual(q.args,[JSON.stringify([I]),C,JSON.stringify([I])]);
  assert.match(q.sql,/object_key IN/);
});
test("SQL artifact select rejects missing/duplicate/injected identifiers",()=>{
  for(const [id,ids] of [["",[I]],[C,[]],[C,[I,I]],[C,["x'); DROP TABLE artifacts;--"]]])
    assert.throws(()=>exportRecoveryArtifactSelect(id,ids),/QUERY_IDENTITY_INVALID/);
});
test("the actual writer event has no requestId; NEVER manufacture its proof",async()=>{
  const input=await fixture();
  const projected=projectExportRecoveryD1Reads(input);
  assert.deepEqual(projected.auditEvents,[{type:"export.generated",
    caseId:C,requestId:R,revision:3}]);
  assert.equal(projected.writerEvents,1);
  const out=await inspectExportRecoveryFromD1Reads(input,commandHash);
  assert.equal(out.classification,"inconclusive");
  assert.ok(out.codes.includes("AUDIT_EVENTS_OBSERVED_INCOMPLETE"));
  assert.ok(out.codes.includes("D1_WRITER_EVENT_REQUEST_BINDING_UNPROVEN"));
  denied(out);
});
const cases=[
  ["R2 HEAD or SQL digest cannot impersonate independent GET byte SHA",
    x=>{x.r2BytesProofs[0].verification="r2-head";},"inconclusive","R2_BYTES_NOT_VERIFIED"],
  ["wrong GET byte SHA remains conflict",x=>{x.r2BytesProofs[0].bytesHash="b".repeat(64);},
    "conflict","R2_BYTES_HASH_CONFLICT"],
  ["R2 bytes exist but observed SQL zero rows",x=>{x.artifactRows=[];},
    "inconclusive","R2_WITHOUT_SQL_ROW"],
  ["D1 503 response envelope not interpreted as empty rows",x=>{x.artifactRows={status:503};},
    "conflict","D1_ARTIFACT_ROWS_SHAPE_INVALID"],
  ["R2 429 response envelope not interpreted as absent",x=>{x.r2BytesProofs={status:429};},
    "conflict","R2_PROBE_ROWS_SHAPE_INVALID"],
  ["malformed D1 event detail JSON",x=>{x.auditRows[0].detail="{";},
    "conflict","D1_AUDIT_DETAIL_JSON_INVALID"],
  ["foreign case audit event must not be attached",x=>{x.auditRows[0].case_id="case-other";},
    "conflict","D1_AUDIT_ROW_IDENTITY_INVALID"],
  ["original source revision advanced",x=>{x.caseSnapshot.revision=4;},
    "stale","SOURCE_OR_REFERENCE_STALE"],
  ["D1 receipt observed absent",x=>{x.receiptRow=null;},
    "inconclusive","D1_RECEIPT_OBSERVED_ABSENT"],
  ["D1 receipt not observed",x=>{x.receiptRow=undefined;},
    "inconclusive","D1_RECEIPT_NOT_OBSERVED"],
  ["R2 read not observed",x=>{x.r2BytesProofs=null;},
    "inconclusive","R2_PROOFS_NOT_OBSERVED"],
  ["artifact SQL read not observed",x=>{x.artifactRows=null;},
    "inconclusive","SQL_ROWS_NOT_OBSERVED"],
  ["audit events not observed",x=>{x.auditRows=null;},
    "inconclusive","AUDIT_EVENTS_NOT_OBSERVED"],
  ["observed empty audit events",x=>{x.auditRows=[];},
    "inconclusive","AUDIT_EVENTS_OBSERVED_INCOMPLETE"],
  ["uncertain request not promoted to committed",x=>{x.receiptRow.status="uncertain";},
    "inconclusive","STORED_RECEIPT_NOT_COMMITTED"],
  ["same R2 key claimed by another case",x=>{x.artifactRows.push({
    id:"artifact-bbbbbbbb",case_id:"case-other",revision:3,
    object_key:`cases/${C}/artifacts/${I}`,hash:H});},
    "conflict","SQL_OBJECT_KEY_ALIAS_CONFLICT"],
  ["invalidated manifest file cannot be approved",x=>{x.caseData.exportManifest.files[0].status="invalidated";},
    "conflict","MANIFEST_FILES_NOT_CURRENT_OR_CONFLICT"],
];
for(const [name,mutate,expected,code] of cases)
  test(name,()=>verify(mutate,expected,code));
