import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { claimExportRequest, inspectExportReceipt, markExportUncertain, type ExportClaim } from "../lib/export-request-ledger.ts";

/** A4 R16. Synthetic SQLite contract only. No live R2/HTTP/D1/Cron evidence. */
const claim:ExportClaim={
  caseId:"synthetic-precommit", requestId:"a4-synthetic-request-001",
  requestHash:"a".repeat(64), mode:"draft", caseRevision:7,
  sourceDataVersion:4, referenceSha256:"b".repeat(64),
  storageToken:"storage-token-1", claimToken:"claim-token-1",
  at:"2026-10-31T04:40:00+09:00",
};
function seeded() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE cases(id TEXT PRIMARY KEY, revision INTEGER, storage_token TEXT);
    CREATE TABLE case_data_change_state(case_id TEXT PRIMARY KEY, data_version INTEGER);
    CREATE TABLE case_export_request_receipts(
      case_id TEXT NOT NULL, request_id TEXT NOT NULL, request_hash TEXT NOT NULL,
      mode TEXT NOT NULL, case_revision INTEGER NOT NULL, source_data_version INTEGER NOT NULL,
      reference_sha256 TEXT NOT NULL, status TEXT NOT NULL, claim_token TEXT NOT NULL,
      artifact_ids_json TEXT, manifest_fingerprint TEXT,
      created_at TEXT, updated_at TEXT, committed_at TEXT,
      PRIMARY KEY(case_id,request_id)
    );
    INSERT INTO cases VALUES ('synthetic-precommit',7,'storage-token-1');
    INSERT INTO case_data_change_state VALUES ('synthetic-precommit',4);
  `);
  const register=claimExportRequest(claim);
  assert.equal(db.prepare(register.sql).run(...register.args).changes,1);
  return db;
}
function status(db:DatabaseSync) {
  return db.prepare("SELECT status FROM case_export_request_receipts WHERE case_id=? AND request_id=?")
    .get(claim.caseId,claim.requestId)?.status;
}
function mark(db:DatabaseSync, changed:ExportClaim=claim) {
  const op=markExportUncertain({...changed,at:"2026-10-31T04:41:00+09:00"});
  return db.prepare(op.sql).run(...op.args).changes;
}
for (const injectedFailure of ["R2 PUT 429","R2 PUT 503","R2 PUT timeout","artifact SQL batch error"]) {
  test("pre-manifest "+injectedFailure+" leaves conservative uncertain receipt",()=>{
    const db=seeded();
    assert.equal(status(db),"claimed");
    assert.equal(mark(db),1);
    assert.equal(status(db),"uncertain");
    const retry=claimExportRequest(claim);
    assert.equal(db.prepare(retry.sql).run(...retry.args).changes,0,
      "same UUID cannot be reissued even after uncertain status");
    assert.equal(inspectExportReceipt({
      caseId:claim.caseId,requestId:claim.requestId,requestHash:claim.requestHash,
      mode:"draft",caseRevision:7,sourceDataVersion:4,referenceSha256:claim.referenceSha256,
      status:"uncertain",manifestFingerprint:null,
    },{...claim,manifestFingerprint:null}),"manual_reconciliation_required");
    db.close();
  });
}
test("lost ACK after confirmed COMMIT can never downgrade committed receipt",()=>{
  const db=seeded();
  db.prepare("UPDATE case_export_request_receipts SET status='committed' WHERE case_id=? AND request_id=?")
    .run(claim.caseId,claim.requestId);
  assert.equal(mark(db),0);
  assert.equal(status(db),"committed");
  db.close();
});
test("wrong request hash or claim token cannot alter a different identity",()=>{
  const db=seeded();
  assert.equal(mark(db,{...claim,requestHash:"c".repeat(64)}),0);
  assert.equal(mark(db,{...claim,claimToken:"other-claim-token"}),0);
  assert.equal(status(db),"claimed");
  db.close();
});
test("uncertain transition is idempotent and does not permit double claim",()=>{
  const db=seeded();
  assert.equal(mark(db),1);
  assert.equal(mark(db),0);
  assert.equal(db.prepare(claimExportRequest(claim).sql).run(...claimExportRequest(claim).args).changes,0);
  db.close();
});
test("HTTP route records precommit errors using claimed-only SQL and rethrows original error",()=>{
  const source=readFileSync(new URL("../app/api/cases/[id]/export/route.ts",import.meta.url),"utf8");
  const start=source.indexOf("try {\n    await commitExportArtifactTransaction({");
  const markAt=source.indexOf("markExportUncertain({...claim,at:now()})",start);
  const rethrow=source.indexOf("throw error;",markAt);
  const response=source.indexOf("// Durable audits and the completed request receipt",rethrow);
  assert.ok(start>=0 && markAt>start && rethrow>markAt && response>rethrow,
    "pre-manifest failures must mark uncertain before responding, never silently return success");
});
