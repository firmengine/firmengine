import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { GUARDED_CASE_AUDIT_EVENT_INSERT_SQL, caseAuditEventBindings,
  type CaseExportAuditEvent } from "../lib/case-audit-event-batch.ts";

const caseId = "synthetic-export-case", actorId = "synthetic-user";
const events: CaseExportAuditEvent[] = [
  {type:"document_writer.prepared",detail:{mode:"draft",sourceDataVersion:4,referenceSha256:"a".repeat(64)}},
  {type:"export.generated",detail:{mode:"draft",files:[{id:"synthetic-artifact",hash:"b".repeat(64)}]}}
];
function harness() {
  const sql=new DatabaseSync(":memory:");
  sql.exec("CREATE TABLE cases(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,storage_token TEXT NOT NULL,payload TEXT NOT NULL); " +
    "CREATE TABLE events(id TEXT PRIMARY KEY,case_id TEXT NOT NULL,actor TEXT NOT NULL,type TEXT NOT NULL,detail TEXT NOT NULL,at TEXT NOT NULL);");
  sql.prepare("INSERT INTO cases VALUES (?,?,?,?)").run(caseId,7,"before",JSON.stringify({exportManifest:null}));
  return sql;
}
function auditInsert(sql:DatabaseSync,token:string,eventIdPrefix:string) {
  for(const [idx,event] of events.entries()) {
    const params=caseAuditEventBindings({eventId:eventIdPrefix+"-"+idx,caseId,actorId,event,
      at:"2026-10-30T09:40:00Z",revision:7,storageToken:token});
    sql.prepare(GUARDED_CASE_AUDIT_EVENT_INSERT_SQL).run(...params);
  }
}
function row(sql:DatabaseSync){return sql.prepare("SELECT * FROM cases WHERE id = ?").get(caseId) as {storage_token:string,payload:string};}
function auditRows(sql:DatabaseSync){return sql.prepare("SELECT id,type,detail FROM events ORDER BY type").all() as {id:string,type:string,detail:string}[];}

test("committed manifest and both audit events are atomic",()=>{
  const sql=harness();try{
    sql.exec("BEGIN IMMEDIATE");
    const result=sql.prepare("UPDATE cases SET payload=?,storage_token=? WHERE id=? AND revision=? AND storage_token=?")
      .run(JSON.stringify({exportManifest:{files:["synthetic-artifact"]}}),"after",caseId,7,"before");
    assert.equal(result.changes,1);
    auditInsert(sql,"after","event-1"); sql.exec("COMMIT");
    assert.equal(row(sql).storage_token,"after");
    assert.deepEqual(auditRows(sql).map(r=>r.type),["document_writer.prepared","export.generated"]);
    assert.deepEqual(JSON.parse(auditRows(sql)[1].detail).files,[{id:"synthetic-artifact",hash:"b".repeat(64)}]);
  }finally{sql.close();}
});

test("stale manifest CAS produces no events",()=>{
  const sql=harness();try{
    sql.exec("BEGIN IMMEDIATE");
    const updated=sql.prepare("UPDATE cases SET storage_token=? WHERE id=? AND revision=? AND storage_token=?")
      .run("stale",caseId,7,"wrong-token");
    assert.equal(updated.changes,0);
    auditInsert(sql,"stale","event-stale");sql.exec("COMMIT");
    assert.equal(row(sql).storage_token,"before");assert.equal(auditRows(sql).length,0);
  }finally{sql.close();}
});

test("audit write failure rolls back manifest CAS as a unit",()=>{
  const sql=harness();try{
    sql.prepare("INSERT INTO events VALUES (?,?,?,?,?,?)").run("dupe-0",caseId,actorId,"already.there","{}","2026-10-30T09:39:00Z");
    sql.exec("BEGIN IMMEDIATE");
    try{
      sql.prepare("UPDATE cases SET storage_token=? WHERE id=? AND revision=? AND storage_token=?")
        .run("after",caseId,7,"before");
      auditInsert(sql,"after","dupe");
      assert.fail("expected unique constraint failure");
    } catch(error){assert.match(String(error),/UNIQUE constraint/);sql.exec("ROLLBACK");}
    assert.equal(row(sql).storage_token,"before");
    assert.equal(auditRows(sql).length,1);
  }finally{sql.close();}
});

test("lost HTTP acknowledgement AFTER D1 commit cannot erase committed audit evidence",()=>{
  const sql=harness();try{
    sql.exec("BEGIN IMMEDIATE");
    sql.prepare("UPDATE cases SET storage_token=? WHERE id=? AND revision=? AND storage_token=?")
      .run("after",caseId,7,"before");auditInsert(sql,"after","event-ack");sql.exec("COMMIT");
    assert.throws(()=>{throw new Error("ACK_LOST_AFTER_COMMIT");},/ACK_LOST_AFTER_COMMIT/);
    assert.equal(row(sql).storage_token,"after");assert.equal(auditRows(sql).length,2);
  }finally{sql.close();}
});

test("duplicate stale execution does not emit second pair",()=>{
  const sql=harness();try{
    sql.exec("BEGIN IMMEDIATE");
    sql.prepare("UPDATE cases SET storage_token=? WHERE id=? AND revision=? AND storage_token=?").run("after",caseId,7,"before");
    auditInsert(sql,"after","event-first");sql.exec("COMMIT");
    sql.exec("BEGIN IMMEDIATE");
    const n=sql.prepare("UPDATE cases SET storage_token=? WHERE id=? AND revision=? AND storage_token=?")
      .run("again",caseId,7,"before").changes;
    assert.equal(n,0);auditInsert(sql,"again","event-retry");sql.exec("COMMIT");
    assert.equal(auditRows(sql).length,2);
  }finally{sql.close();}
});

test("invalid or unapproved legal/court event types fail closed",()=>{
  assert.throws(()=>caseAuditEventBindings({eventId:"a",caseId,actorId,
    event:{type:"court.approved" as CaseExportAuditEvent["type"],detail:{}},
    at:"2026-10-30",revision:7,storageToken:"after"}),/EXPORT_AUDIT_EVENT_INVALID/);
  assert.throws(()=>caseAuditEventBindings({eventId:"a",caseId,actorId,
    event:{type:"export.generated",detail:undefined},
    at:"2026-10-30",revision:7,storageToken:"after"}),/EXPORT_AUDIT_EVENT_DETAIL_INVALID/);
});
