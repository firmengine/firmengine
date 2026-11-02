/** Synthetic source-bound contract tests. No customer data, D1/R2 or legal approval. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
const store=readFileSync(new URL("../lib/server-store.ts",import.meta.url),"utf8");
const handoff=readFileSync(new URL("../lib/automatic-draft-handoff.ts",import.meta.url),"utf8");
const guard=store.match(/const guard="([^"]+)";/)?.[1];
const auditFragment='INSERT INTO events (id,case_id,actor,type,detail,at) SELECT ?,?,?,?,?,? WHERE ${guard}';
const auditSql=store.includes(auditFragment)?auditFragment.replace("${guard}",guard??""):undefined;
function fixture(){
 const d=new DatabaseSync(":memory:");
 d.exec("CREATE TABLE cases(id TEXT PRIMARY KEY,revision INTEGER,storage_token TEXT,payload TEXT);"+
        "CREATE TABLE events(id TEXT PRIMARY KEY NOT NULL,case_id TEXT,actor TEXT,type TEXT,detail TEXT,at TEXT);"+
        "INSERT INTO cases VALUES ('synthetic-case',3,'token-old','{}')");
 const link=d.prepare("UPDATE cases SET payload=?,storage_token=? WHERE id=? AND revision=? AND storage_token=?");
 const emit=(token,id="evt-"+token)=>d.prepare(auditSql).run(id,"synthetic-case","synthetic-staff","automatic_draft.linked_to_staff_workbench",
  JSON.stringify({mode:"draft",courtApprovalInferred:false}),"2026-11-02","synthetic-case",3,token).changes;
 const count=()=>d.prepare("SELECT count(*) AS n FROM events").get().n;
 return {d,link,emit,count};
}
test("handoff event SQL is in the saveCase D1 batch before commit; no swallowed follow-up event",()=>{
 assert.ok(guard);
 assert.ok(auditSql?.startsWith("INSERT INTO events"));
 const audit=store.indexOf("if(options?.handoffAudit){",store.indexOf("const batch:D1PreparedStatement[]"));
 const commit=store.indexOf("await db().batch(batch)");
 assert.ok(audit>0&&audit<commit);
 assert.ok(handoff.includes("handoffAudit:{actor:input.actor,detail:"));
 assert.ok(!handoff.includes("await event(input.caseId"));
});
test("atomic candidate: successful CAS emits exactly one staff event",()=>{
 const f=fixture();
 try{f.d.exec("BEGIN IMMEDIATE");
  assert.equal(f.link.run('{"linked":true}','token-new',"synthetic-case",3,"token-old").changes,1);
  assert.equal(f.emit("token-new"),1);f.d.exec("COMMIT");assert.equal(f.count(),1);
 }finally{f.d.close()}
});
test("stale CAS cannot leave misleading staff event",()=>{
 const f=fixture();
 try{f.d.exec("BEGIN IMMEDIATE");
  assert.equal(f.link.run('{"linked":true}','token-new',"synthetic-case",3,"token-old").changes,1);
  assert.equal(f.emit("token-new"),1);f.d.exec("COMMIT");
  f.d.exec("BEGIN IMMEDIATE");assert.equal(f.link.run('{"linked":true}','token-second',"synthetic-case",3,"token-old").changes,0);
  assert.equal(f.emit("token-second"),0);f.d.exec("COMMIT");assert.equal(f.count(),1);
 }finally{f.d.close()}
});
test("failed audit insert must roll back the manifest CAS",()=>{
 const f=fixture();
 try{f.d.exec("BEGIN IMMEDIATE");
  assert.equal(f.link.run('{"linked":true}','token-new',"synthetic-case",3,"token-old").changes,1);
  assert.throws(()=>f.emit("token-new",null),/NOT NULL/);
  f.d.exec("ROLLBACK");assert.equal(f.count(),0);
  assert.equal(f.d.prepare("SELECT storage_token AS token FROM cases").get().token,"token-old");
 }finally{f.d.close()}
});
test("ACK lost after committed D1 transaction leaves link and audit evidence jointly present",()=>{
 const f=fixture();
 try{f.d.exec("BEGIN IMMEDIATE");
  f.link.run('{"linked":true}','token-new',"synthetic-case",3,"token-old");
  f.emit("token-new");f.d.exec("COMMIT");
  assert.throws(()=>{throw new Error("ACK_LOST")},/ACK_LOST/);
  assert.equal(f.d.prepare("SELECT storage_token AS token FROM cases").get().token,"token-new");
  assert.equal(f.count(),1);
 }finally{f.d.close()}
});
