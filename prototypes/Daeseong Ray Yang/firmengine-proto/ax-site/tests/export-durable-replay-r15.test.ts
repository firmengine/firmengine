import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inspectExportReceipt } from "../lib/export-request-ledger.ts";
import { inspectExportRequestReplay } from "../lib/export-request-replay.ts";
import type { ExportManifest } from "../lib/domain.ts";

/** A4 R15: a receipt fingerprint and valid SQL/R2 bytes are not enough if
 * the current manifest was archived, has a missing writer receipt, or carries
 * a different legal/source/case identity. This is an isolated contract test:
 * no Cloudflare D1/R2 or HTTP worker is exercised. */
const requestId="11111111-2222-4333-8444-555555555555";
const referenceSha256="a".repeat(64), hash="b".repeat(64);
const identity={caseId:"synthetic-replay-case",requestId,requestHash:"c".repeat(64),
  mode:"draft" as const,caseRevision:7,sourceDataVersion:4,referenceSha256};
const receipt={...identity,status:"committed" as const,manifestFingerprint:"current-fingerprint"};

function manifest():ExportManifest {
  return {caseRevision:7,mode:"draft",requiredKinds:["application"],
    exportRequestId:requestId,sourceDataVersionAtExport:4,
    files:[{id:"artifact-synthetic",kind:"application",name:"application.docx",hash,status:"current"}],
    reviews:{caseworker:null,lawyer:null},
    documentWriter:{caseRevision:7,mode:"draft",referenceRelease:{id:"r",revision:1,sha256:referenceSha256}} as ExportManifest["documentWriter"]};
}
function decisions(current:ExportManifest) {
  const receiptDecision=inspectExportReceipt(receipt,{...identity,manifestFingerprint:"current-fingerprint"});
  const manifestDecision=inspectExportRequestReplay({requestId,manifest:current,
    caseRevision:7,mode:"draft",sourceDataVersion:4,referenceSha256});
  return {receiptDecision,manifestDecision};
}

test("durable receipt can be reused only with a current valid export manifest",()=>{
  assert.deepEqual(decisions(manifest()),{receiptDecision:"verify_sql_and_r2_before_reuse",manifestDecision:"reuse"});
});
test("archived artifact never reopens through a committed receipt",()=>{
  const m=manifest();m.files[0]!.status="archived";
  assert.deepEqual(decisions(m),{receiptDecision:"verify_sql_and_r2_before_reuse",manifestDecision:"conflict"});
});
test("missing writer proof is not upgraded by a matching receipt",()=>{
  const m=manifest();delete m.documentWriter;
  assert.equal(decisions(m).manifestDecision,"conflict");
});
test("stale source, reference, mode and case revision remain blocked",()=>{
  for(const change of [
    (m:ExportManifest)=>{m.sourceDataVersionAtExport=5;},
    (m:ExportManifest)=>{m.mode="final";},
    (m:ExportManifest)=>{m.caseRevision=8;},
    (m:ExportManifest)=>{if(m.documentWriter?.referenceRelease)m.documentWriter.referenceRelease.sha256="d".repeat(64);}
  ]){const m=manifest();change(m);assert.equal(decisions(m).manifestDecision,"conflict");}
});
test("empty manifest cannot be reused with a committed receipt",()=>{
  const m=manifest();m.files=[];
  assert.equal(decisions(m).manifestDecision,"conflict");
});
test("HTTP replay branch is wired to the shared manifest gate before SQL/R2 proof",()=>{
  const route=readFileSync(new URL("../app/api/cases/[id]/export/route.ts",import.meta.url),"utf8");
  const branchStart=route.indexOf('if(decision==="verify_sql_and_r2_before_reuse")');
  const sharedGate=route.indexOf("inspectExportRequestReplay({",branchStart);
  const sqlProof=route.indexOf("SELECT hash,object_key AS objectKey,revision FROM artifacts",branchStart);
  assert.ok(branchStart>=0 && sharedGate>branchStart && sqlProof>sharedGate,
    "durable replay must reject stale manifest before reading SQL/R2 and returning HTTP success");
});
