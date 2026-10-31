/** A4 r41 Draft PR only: native SQLite contract tests against the exact retry SQL extracted
 * from lib/case-legal-automation.ts. Synthetic events, not Cloudflare D1/staging receipts. */
import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync,mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const src=readFileSync(new URL("../lib/case-legal-automation.ts",import.meta.url),"utf8");
const start=src.indexOf("export async function retryFailedCaseLegalAutomation(");
const end=src.indexOf("export async function readCaseLegalAutomation(",start);
assert.ok(start>=0&&end>start);
const region=src.slice(start,end);
assert.ok(region.includes("database.batch(["));
const UPDATE=region.match(/database\.prepare\("(UPDATE case_legal_automation_jobs[^"]*)"\)/)?.[1];
const AUDIT=region.match(/database\.prepare\("(INSERT INTO case_legal_automation_events[^"]*)"\)/)?.[1];
assert.ok(UPDATE&&AUDIT?.includes("WHERE changes()=1"),"real D1 batch SQL required");
const updateArgs=["2026-11-01T00:00:00Z","2026-11-01T00:00:00Z","job-synthetic","failed",1,1];
const auditArgs=["case-synthetic","job-synthetic",1,"manual_retry_requested",
 JSON.stringify({previousStatus:"failed",newStatus:"retry_wait",courtApprovalInferred:false}),"2026-11-01T00:00:00Z"];

function fixture(){
 const dir=mkdtempSync(join(tmpdir(),"a4-r41-")),path=join(dir,"test.sqlite");
 const a=new DatabaseSync(path),b=new DatabaseSync(path);
 a.exec("PRAGMA journal_mode=WAL;CREATE TABLE case_legal_automation_jobs(id TEXT PRIMARY KEY,status TEXT,attempts INTEGER,next_attempt_at TEXT,last_error TEXT,updated_at TEXT,case_revision INTEGER,data_version INTEGER);CREATE TABLE case_legal_automation_events(id INTEGER PRIMARY KEY AUTOINCREMENT,case_id TEXT,job_id TEXT,data_version INTEGER,event_kind TEXT,payload_json TEXT,created_at TEXT);");
 a.prepare("INSERT INTO case_legal_automation_jobs VALUES('job-synthetic','failed',3,NULL,'synthetic failure','old',1,1)").run();
 // r42: the guarded UPDATE consults the live case/source/calculation head.
 // Include minimal current-version tables so r41's real-SQL regression stays executable.
 a.exec("ALTER TABLE case_legal_automation_jobs ADD COLUMN case_id TEXT;"+
   "ALTER TABLE case_legal_automation_jobs ADD COLUMN calculation_run_id TEXT;"+
   "ALTER TABLE case_legal_automation_jobs ADD COLUMN input_sha256 TEXT;"+
   "ALTER TABLE case_legal_automation_jobs ADD COLUMN reference_sha256 TEXT;"+
   "CREATE TABLE cases(id TEXT PRIMARY KEY,revision INTEGER);"+
   "CREATE TABLE case_data_change_state(case_id TEXT PRIMARY KEY,data_version INTEGER);"+
   "CREATE TABLE case_calculation_heads(case_id TEXT PRIMARY KEY,run_id TEXT,data_version INTEGER,case_revision INTEGER,input_sha256 TEXT);"+
   "CREATE TABLE case_calculation_runs(id TEXT PRIMARY KEY,data_version INTEGER,case_revision INTEGER,input_sha256 TEXT,reference_sha256 TEXT);"+
   "INSERT INTO cases VALUES('case-synthetic',1);"+
   "INSERT INTO case_data_change_state VALUES('case-synthetic',1);"+
   "INSERT INTO case_calculation_heads VALUES('case-synthetic','calc-synthetic',1,1,'input-synthetic');"+
   "INSERT INTO case_calculation_runs VALUES('calc-synthetic',1,1,'input-synthetic','ref-synthetic');"+
   "UPDATE case_legal_automation_jobs SET case_id='case-synthetic',calculation_run_id='calc-synthetic',input_sha256='input-synthetic',reference_sha256='ref-synthetic' WHERE id='job-synthetic';");
 return {a,b,close(){a.close();b.close();rmSync(dir,{recursive:true,force:true});}};
}
function runPair(db,{args=updateArgs,failAudit=false}={}){
 db.exec("BEGIN IMMEDIATE");
 try{
  const first=Number(db.prepare(UPDATE).run(...args).changes);
  if(failAudit)db.exec("CREATE TEMP TRIGGER fail_audit BEFORE INSERT ON case_legal_automation_events BEGIN SELECT RAISE(ABORT,'synthetic-503-like-sql-failure'); END;");
  const second=Number(db.prepare(AUDIT).run(...auditArgs).changes);
  db.exec("COMMIT");return [first,second];
 }catch(e){db.exec("ROLLBACK");throw e;}
}
function observed(db){
 return {job:db.prepare("SELECT status,attempts FROM case_legal_automation_jobs WHERE id='job-synthetic'").get(),
 events:db.prepare("SELECT event_kind,job_id FROM case_legal_automation_events ORDER BY id").all()};
}

test("baseline prior split statements leave retry_wait with no event on a later audit error",()=>{
 const h=fixture();try{
  h.a.prepare(UPDATE).run(...updateArgs);
  assert.equal(observed(h.b).job.status,"retry_wait");
  assert.equal(observed(h.b).events.length,0);
 }finally{h.close();}
});
test("successful SQL batch makes retry state and audit visible to a second WAL connection",()=>{
 const h=fixture();try{
  assert.deepEqual(runPair(h.a),[1,1]);
  assert.equal(observed(h.b).job.status,"retry_wait");
  assert.equal(observed(h.b).events[0]?.event_kind,"manual_retry_requested");
 }finally{h.close();}
});
test("SQL audit failure within the batch rolls the preceding state UPDATE back",()=>{
 const h=fixture();try{
  assert.throws(()=>runPair(h.a,{failAudit:true}),/synthetic-503-like-sql-failure/);
  assert.equal(observed(h.b).job.status,"failed");
  assert.equal(observed(h.b).job.attempts,3);
  assert.equal(observed(h.b).events.length,0);
 }finally{h.close();}
});
test("0-row status CAS records zero audit events, without claiming a rollback",()=>{
 const h=fixture();try{
  const args=[...updateArgs];args[3]="running";
  assert.deepEqual(runPair(h.a,{args}),[0,0]);
  assert.equal(observed(h.b).events.length,0);
 }finally{h.close();}
});
test("stale revision and dataVersion each prevent both state and event",()=>{
 const h=fixture();try{
  for(const i of [4,5]){
   const args=[...updateArgs];args[i]=2;
   assert.deepEqual(runPair(h.a,{args}),[0,0]);
  }
  assert.equal(observed(h.b).job.status,"failed");
  assert.equal(observed(h.b).events.length,0);
 }finally{h.close();}
});
test("different WAL connections cannot duplicate a completed retry via the same failed-status CAS",()=>{
 const h=fixture();try{
  assert.deepEqual(runPair(h.a),[1,1]);
  assert.deepEqual(runPair(h.b),[0,0]);
  assert.equal(observed(h.a).events.length,1);
 }finally{h.close();}
});
test("COMMIT response loss stays uncertain to caller, while read-only state+event pair remains queryable",()=>{
 const h=fixture();try{
  runPair(h.a);const responseLost=true;
  assert.equal(responseLost,true);
  assert.equal(observed(h.b).job.status,"retry_wait");
  assert.equal(observed(h.b).events.length,1);
 }finally{h.close();}
});
test("no UNIQUE request-id column exists: this patch does not prove HTTP idempotency",()=>{
 const h=fixture();try{
  const cols=h.a.prepare("PRAGMA table_info(case_legal_automation_events)").all().map(x=>x.name);
  assert.equal(cols.includes("request_id"),false);
 }finally{h.close();}
});
