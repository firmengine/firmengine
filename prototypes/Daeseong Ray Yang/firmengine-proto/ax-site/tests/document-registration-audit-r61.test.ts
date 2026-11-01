import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { prepareDocumentRegistrationAudit } from "../lib/document-register-audit.ts";

const SHA = "a".repeat(64);
function fixture() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(`CREATE TABLE cases(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,storage_token TEXT NOT NULL);
    CREATE TABLE documents(id TEXT PRIMARY KEY,case_id TEXT NOT NULL,sha256 TEXT NOT NULL,page_count INTEGER NOT NULL);
    CREATE TABLE events(id TEXT PRIMARY KEY,case_id TEXT NOT NULL,actor TEXT NOT NULL,type TEXT NOT NULL,detail TEXT NOT NULL,at TEXT NOT NULL);`);
  sql.prepare("INSERT INTO cases VALUES(?,?,?)").run("case-r61", 3, "token-current");
  sql.prepare("INSERT INTO documents VALUES(?,?,?,?)").run("doc-r61", "case-r61", SHA, 2);
  const d1 = { prepare: (query: string) => ({
    bind: (...args: unknown[]) => ({
      run: () => ({meta: {changes: Number(sql.prepare(query).run(...args as any[]).changes)}})
    })
  })};
  const input = {caseId: "case-r61", caseRevision: 3, storageToken: "token-current",
    eventId: "evt-r61", actor: "synthetic-actor", at: "2026-11-02T00:54:00+09:00",
    documentId: "doc-r61", sha256: SHA, pageCount: 2};
  return {sql, d1, input};
}
test("matching case head and document produce the linked registration event", () => {
  const f = fixture();
  assert.equal(prepareDocumentRegistrationAudit(f.d1 as never, f.input).run().meta.changes, 1);
  const row = f.sql.prepare("SELECT actor,type,detail FROM events WHERE id=?").get("evt-r61") as any;
  assert.equal(row.actor, "synthetic-actor");
  assert.equal(row.type, "document.registered");
  assert.deepEqual(JSON.parse(row.detail), {documentId: "doc-r61", sha256: SHA, pageCount: 2});
});
test("stale revision, token, document id, SHA or page count cannot produce an event", () => {
  const substitutions = [{caseRevision: 2}, {storageToken: "old"}, {documentId: "other"},
    {sha256: "b".repeat(64)}, {pageCount: 1}];
  for (const [i, patch] of substitutions.entries()) {
    const f = fixture();
    const result = prepareDocumentRegistrationAudit(f.d1 as never, {...f.input, ...patch, eventId: `evt-${i}`}).run();
    assert.equal(result.meta.changes, 0, JSON.stringify(patch));
    assert.equal((f.sql.prepare("SELECT count(*) as n FROM events").get() as any).n, 0);
  }
});
test("synthetic event-write failure rolls back a same-transaction case revision update", () => {
  const f = fixture();
  f.sql.exec("BEGIN TRANSACTION");
  try {
    f.sql.prepare("UPDATE cases SET revision=4,storage_token='token-new' WHERE id='case-r61'").run();
    const audit = prepareDocumentRegistrationAudit(f.d1 as never,
      {...f.input, caseRevision: 4, storageToken: "token-new", eventId: "evt-r61"});
    assert.equal(audit.run().meta.changes, 1);
    assert.throws(() => audit.run()); // duplicate event ID simulates a failure inside the batch
    throw new Error("synthetic D1 batch abort");
  } catch {
    f.sql.exec("ROLLBACK");
  }
  const head = f.sql.prepare("SELECT revision,storage_token FROM cases WHERE id='case-r61'").get() as any;
  assert.equal(head.revision, 3);
  assert.equal(head.storage_token, "token-current");
  assert.equal((f.sql.prepare("SELECT count(*) as n FROM events").get() as any).n, 0);
});
