/** A4 r44 draft: Node SQLite WAL, source-derived failure-state SQL only.
 * Negative control reproduces main's separate commits; staging D1 remains untested.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,mkdtempSync,rmSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {join} from "node:path";
import {tmpdir} from "node:os";
const source=readFileSync(new URL("../lib/case-legal-automation.ts",import.meta.url),"utf8");
const from=source.indexOf("// Draft A4 r44:");
const to=source.indexOf('return {caseId:job.caseId,status,errorCode:code,retryAfter:delay};',from);
assert.ok(from>=0&&to>from,"failure batch source must be available");
const section=source.slice(from,to);
const updateLiteral=section.match(/"UPDATE case_legal_automation_jobs SET status=\?,lease_token=NULL[^"\n]+"/);
const auditLiteral=section.match(/"INSERT INTO case_legal_automation_events\([^"\n]+ WHERE changes\(\)=1"/);
assert.ok(updateLiteral&&auditLiteral,"must test actual production SQL literals");
const UPDATE=JSON.parse(updateLiteral[0]), AUDIT=JSON.parse(auditLiteral[0]);
const NOW="2026-11-01T08:00:00.000Z";
const ARGS=["retry_wait","2026-11-01T08:01:00.000Z","LEGAL_STAGE_FAILED",NOW,"job","lease",NOW];
const AUDIT_ARGS=["case","job",1,"retry_wait",JSON.stringify({code:"LEGAL_STAGE_FAILED",retryAfter:"2026-11-01T08:01:00.000Z"}),NOW];
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),"a4-r44-")),path=join(dir,"db.sqlite");
 const a=new DatabaseSync(path),b=new DatabaseSync(path);
 a.exec(`PRAGMA journal_mode=WAL;
 CREATE TABLE case_legal_automation_jobs(id TEXT PRIMARY KEY,status TEXT,lease_token TEXT,lease_until TEXT,
 next_attempt_at TEXT,last_error TEXT,updated_at TEXT);
 CREATE TABLE case_legal_automation_events(id INTEGER PRIMARY KEY,case_id TEXT,job_id TEXT,data_version INTEGER,
 event_kind TEXT,payload_json TEXT,created_at TEXT);
 INSERT INTO case_legal_automation_jobs VALUES('job','running','lease','2099-01-01T00:00:00.000Z',NULL,NULL,'2026-10-31T00:00:00.000Z');`);
 return {a,b,close(){a.close();b.close();rmSync(dir,{recursive:true,force:true});}};
}
function current(db){return {status:db.prepare("SELECT status FROM case_legal_automation_jobs WHERE id='job'").get().status,
 events:db.prepare("SELECT COUNT(*) AS n FROM case_legal_automation_events").get().n};}
function run(db,inject503=false){
 db.exec("BEGIN IMMEDIATE");
 try{
  const updated=Number(db.prepare(UPDATE).run(...ARGS).changes);
  if(inject503)db.exec("CREATE TEMP TRIGGER synthetic_503 BEFORE INSERT ON case_legal_automation_events BEGIN SELECT RAISE(ABORT,'synthetic-503'); END;");
  const audited=Number(db.prepare(AUDIT).run(...AUDIT_ARGS).changes);
  db.exec("COMMIT");return [updated,audited];
 }catch(e){db.exec("ROLLBACK");throw e;}
}
test("normal failure-state transition has exactly one event",()=>{
 const f=fixture();try{assert.deepEqual(run(f.a),[1,1]);assert.deepEqual(current(f.b),{status:"retry_wait",events:1});}finally{f.close();}
});
test("audit SQL 503 rolls back failure state and preserves running lease",()=>{
 const f=fixture();try{assert.throws(()=>run(f.a,true),/synthetic-503/);assert.deepEqual(current(f.b),{status:"running",events:0});}finally{f.close();}
});
test("source-derived lease CAS blocks another worker",()=>{
 const f=fixture();try{f.b.exec("UPDATE case_legal_automation_jobs SET lease_token='another'");
 assert.deepEqual(run(f.a),[0,0]);assert.deepEqual(current(f.b),{status:"running",events:0});}finally{f.close();}
});
test("expired lease is not permitted to publish failure",()=>{
 const f=fixture();try{f.b.exec("UPDATE case_legal_automation_jobs SET lease_until='2026-10-31T00:00:00.000Z'");
 assert.deepEqual(run(f.a),[0,0]);assert.deepEqual(current(f.b),{status:"running",events:0});}finally{f.close();}
});
test("duplicate committed failure does not duplicate event",()=>{
 const f=fixture();try{assert.deepEqual(run(f.a),[1,1]);assert.deepEqual(run(f.b),[0,0]);
 assert.deepEqual(current(f.a),{status:"retry_wait",events:1});}finally{f.close();}
});
test("lost HTTP ACK after COMMIT remains unobserved to caller",()=>{
 const f=fixture();try{assert.deepEqual(run(f.a),[1,1]);const responseSeen=false;
 assert.equal(responseSeen,false);assert.deepEqual(current(f.b),{status:"retry_wait",events:1});}finally{f.close();}
});
test("negative control: split UPDATE succeeds when audit fails",()=>{
 const f=fixture();try{
  const OLD="UPDATE case_legal_automation_jobs SET status=?,lease_token=NULL,lease_until=NULL,next_attempt_at=?,last_error=?,updated_at=? WHERE id=? AND lease_token=? AND status='running'";
  assert.equal(f.a.prepare(OLD).run(...ARGS.slice(0,-1)).changes,1);
  assert.throws(()=>{throw Error("synthetic-503");},/synthetic-503/);
  assert.deepEqual(current(f.b),{status:"retry_wait",events:0});
 }finally{f.close();}
});
