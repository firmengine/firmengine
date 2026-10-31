/** A4 r43 Draft: execute SQL literals extracted from the proposed legal transition.
 * Synthetic SQLite only. A D1 batch/transaction and worker ACK still require staging.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,mkdtempSync,rmSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {join} from "node:path";
import {tmpdir} from "node:os";

const source=readFileSync(new URL("../lib/case-legal-automation.ts",import.meta.url),"utf8");
const transition=source.slice(source.indexOf("async function transition("),source.indexOf("async function gatherChecks("));
assert.ok(transition.startsWith("async function transition("));
assert.match(transition,/database\.batch\(\[/);
const updateMatch=transition.match(/"UPDATE case_legal_automation_jobs SET status=\?,attempts=0[^"\n]+"/);
const auditMatch=transition.match(/"INSERT INTO case_legal_automation_events\([^"\n]+ WHERE changes\(\)=1"/);
assert.ok(updateMatch&&auditMatch,"must test production SQL literals, not alternate SQL");
const UPDATE=JSON.parse(updateMatch[0]),AUDIT=JSON.parse(auditMatch[0]);
const now="2026-11-01T00:00:00.000Z";
const args=["pending",null,3,95,null,null,'{"courtApprovalInferred":false}',null,now,
 "job", "lease-current",now,"case",1,1,"calc-A","sha-A"];
const auditArgs=["case","job",1,"pending",'{"courtApprovalInferred":false}',now];
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),"a4-transition-r43-")),path=join(dir,"case.db");
 const a=new DatabaseSync(path),b=new DatabaseSync(path);
 a.exec(`PRAGMA journal_mode=WAL;
 CREATE TABLE cases(id TEXT PRIMARY KEY,revision INTEGER);
 CREATE TABLE case_data_change_state(case_id TEXT PRIMARY KEY,data_version INTEGER);
 CREATE TABLE case_calculation_heads(case_id TEXT PRIMARY KEY,run_id TEXT,input_sha256 TEXT);
 CREATE TABLE case_legal_automation_jobs(id TEXT PRIMARY KEY,case_id TEXT,case_revision INTEGER,data_version INTEGER,
 calculation_run_id TEXT,input_sha256 TEXT,status TEXT,attempts INTEGER,lease_token TEXT,lease_until TEXT,
 next_attempt_at TEXT,completed_checks INTEGER,expected_checks INTEGER,legal_review_run_id TEXT,
 document_run_id TEXT,outcome_json TEXT,last_error TEXT,updated_at TEXT);
 CREATE TABLE case_legal_automation_events(id INTEGER PRIMARY KEY AUTOINCREMENT,case_id TEXT,job_id TEXT,
 data_version INTEGER,event_kind TEXT,payload_json TEXT,created_at TEXT);
 INSERT INTO cases VALUES('case',1);
 INSERT INTO case_data_change_state VALUES('case',1);
 INSERT INTO case_calculation_heads VALUES('case','calc-A','sha-A');
 INSERT INTO case_legal_automation_jobs VALUES('job','case',1,1,'calc-A','sha-A','running',2,
 'lease-current','2099-01-01T00:00:00.000Z',NULL,0,95,NULL,NULL,'{}',NULL,'2026-10-30T00:00:00.000Z');`);
 return {a,b,close(){a.close();b.close();rmSync(dir,{recursive:true,force:true});}};
}
function perform(db,failAudit=false){
 db.exec("BEGIN IMMEDIATE");
 try{
  const changed=Number(db.prepare(UPDATE).run(...args).changes);
  if(failAudit)db.exec("CREATE TEMP TRIGGER failed_event BEFORE INSERT ON case_legal_automation_events BEGIN SELECT RAISE(ABORT,'synthetic-503'); END;");
  const audited=Number(db.prepare(AUDIT).run(...auditArgs).changes);
  db.exec("COMMIT");return [changed,audited];
 }catch(e){db.exec("ROLLBACK");throw e;}
}
function inspect(db){return {status:db.prepare("SELECT status FROM case_legal_automation_jobs WHERE id='job'").get().status,
 count:db.prepare("SELECT COUNT(*) AS count FROM case_legal_automation_events").get().count};}
test("normal source-derived batch emits one transition and one audit",()=>{
 const f=fixture();try{assert.deepEqual(perform(f.a),[1,1]);assert.deepEqual(inspect(f.b),{status:"pending",count:1});}finally{f.close();}
});
test("audit SQL 503 rolls back legal job status for second connection",()=>{
 const f=fixture();try{assert.throws(()=>perform(f.a,true),/synthetic-503/);assert.deepEqual(inspect(f.b),{status:"running",count:0});}finally{f.close();}
});
test("source dataVersion changed before CAS emits zero transition/events",()=>{
 const f=fixture();try{f.b.exec("UPDATE case_data_change_state SET data_version=2");assert.deepEqual(perform(f.a),[0,0]);assert.deepEqual(inspect(f.b),{status:"running",count:0});}finally{f.close();}
});
test("head changed before CAS emits zero transition/events",()=>{
 const f=fixture();try{f.b.exec("UPDATE case_calculation_heads SET run_id='calc-B'");assert.deepEqual(perform(f.a),[0,0]);assert.deepEqual(inspect(f.b),{status:"running",count:0});}finally{f.close();}
});
test("wrong or expired lease cannot update either durable record",()=>{
 const f=fixture();try{f.a.exec("UPDATE case_legal_automation_jobs SET lease_token='other'");assert.deepEqual(perform(f.b),[0,0]);assert.deepEqual(inspect(f.a),{status:"running",count:0});}finally{f.close();}
});
test("duplicate batch after first commit produces no duplicate event",()=>{
 const f=fixture();try{assert.deepEqual(perform(f.a),[1,1]);assert.deepEqual(perform(f.b),[0,0]);assert.deepEqual(inspect(f.a),{status:"pending",count:1});}finally{f.close();}
});
test("lost HTTP acknowledgement remains uncertain to caller, not proof of rollback",()=>{
 const f=fixture();try{perform(f.a);const responseObserved=false;assert.equal(responseObserved,false);assert.deepEqual(inspect(f.b),{status:"pending",count:1});}finally{f.close();}
});
