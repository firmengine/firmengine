import test from "node:test";
import assert from "node:assert/strict";
import {projectExportRecoveryD1Reads,inspectExportRecoveryFromD1Reads} from "../lib/export-recovery-d1-reads.mjs";
// Synthetic input only; these tests make no D1/R2/HTTP requests.
const denies = result => {
  for (const field of ["canDelete","canReplay","canMarkCommitted","canApprove"])
    assert.equal(result[field],false,field);
};
const negative = [
  ["null read wrapper",null,"inconclusive","D1_READ_INPUT_NOT_OBSERVED"],
  ["unobserved read wrapper",undefined,"inconclusive","D1_RECEIPT_NOT_OBSERVED"],
  ["503 error wrapper",{status:503,error:"synthetic"},"conflict","D1_READ_INPUT_INVALID"],
  ["429 status wrapper",{status:429},"conflict","D1_READ_INPUT_INVALID"],
  ["timeout error wrapper",{error:"timeout"},"conflict","D1_READ_INPUT_INVALID"],
  ["native Error wrapper",new Error("synthetic timeout"),"conflict","D1_READ_INPUT_INVALID"],
  ["array wrapper",[],"conflict","D1_READ_INPUT_INVALID"],
  ["scalar wrapper",503,"conflict","D1_READ_INPUT_INVALID"],
  ["empty object",{},"inconclusive","D1_RECEIPT_NOT_OBSERVED"],
  ["observed absent receipt",{receiptRow:null},"inconclusive","D1_RECEIPT_OBSERVED_ABSENT"],
  ["nested D1 503",{receiptRow:{case_id:"case-synthetic",request_id:"request-aaaaaaaa"},artifactRows:{status:503}},"conflict","D1_ARTIFACT_ROWS_SHAPE_INVALID"],
  ["nested R2 429",{receiptRow:{case_id:"case-synthetic",request_id:"request-aaaaaaaa"},r2BytesProofs:{status:429}},"conflict","R2_PROBE_ROWS_SHAPE_INVALID"],
  ["nested audit timeout",{receiptRow:{case_id:"case-synthetic",request_id:"request-aaaaaaaa"},auditRows:{error:"timeout"}},"conflict","D1_AUDIT_ROWS_SHAPE_INVALID"]
];
for (const [name,input,expected,code] of negative) {
  test(name+" preserves exact distinction and fail-closed flags",()=>{
    const out=projectExportRecoveryD1Reads(input);
    assert.equal(out.classification,expected,JSON.stringify(out.codes));
    assert.ok(out.codes.includes(code),JSON.stringify(out.codes));
    denies(out);
  });
}
test("valid receipt row is still projected without mutating row",()=>{
  const source={case_id:"case-synthetic",request_id:"request-aaaaaaaa",
    request_hash:"a".repeat(64),mode:"draft",case_revision:3,
    source_data_version:7,reference_sha256:"a".repeat(64),
    status:"uncertain",artifact_ids_json:'["artifact-aaaaaaaa"]',
    manifest_fingerprint:"b".repeat(64)};
  const before=structuredClone(source);
  const out=projectExportRecoveryD1Reads({receiptRow:source});
  assert.equal(out.receipt.caseRevision,3);
  assert.equal(out.receipt.requestId,"request-aaaaaaaa");
  assert.deepEqual(source,before);
});
test("top-level D1 503 cannot reach verifier and never auto-recovers",async()=>{
  const out=await inspectExportRecoveryFromD1Reads({error:"D1 unavailable",status:503},
    async()=>{throw Error("hash must not run")});
  assert.equal(out.classification,"conflict");
  assert.ok(out.codes.includes("D1_READ_INPUT_INVALID"));
  denies(out);
});
