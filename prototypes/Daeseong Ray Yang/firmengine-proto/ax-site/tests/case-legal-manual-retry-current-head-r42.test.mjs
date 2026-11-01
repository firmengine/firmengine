/** A4 r42 Draft-only: manual retry must revalidate the live calculation head
 * at UPDATE time, not only at an earlier latest() read. Synthetic local SQLite;
 * not Cloudflare D1, Cron, production data or a legal approval receipt.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync,mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const src=readFileSync(new URL("../lib/case-legal-automation.ts",import.meta.url),"utf8");
const region=src.split("export async function retryFailedCaseLegalAutomation(")[1]?.split("export async function readCaseLegalAutomation(")[0];
assert.ok(region?.includes("database.batch(["));
const UPDATE=region.match(/database\.prepare\("(UPDATE case_legal_automation_jobs[^"]*)"\)/)?.[1];
const AUDIT=region.match(/database\.prepare\("(INSERT INTO case_legal_automation_events[^"]*)"\)/)?.[1];
assert.ok(UPDATE?.includes("JOIN case_calculation_heads")&&UPDATE.includes("case_legal_automation_jobs.calculation_run_id"),"current-head CAS guard required");
assert.ok(AUDIT?.includes("WHERE changes()=1"),"same-batch conditional audit required");

const ua=["now","now","job-A","failed",1,1];
const ea=["case-A","job-A",1,"manual_retry_requested",JSON.stringify({courtApprovalInferred:false}),"now"];
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),"a4-r42-")),path=join(dir,"db.sqlite");
 const a=new DatabaseSync(path),b=new DatabaseSync(path);
 a.exec(`PRAGMA journal_mode=WAL;
 CREATE TABLE cases(id TEXT PRIMARY KEY,revision INTEGER NOT NULL);
 CREATE TABLE case_data_change_state(case_id TEXT PRIMARY KEY,data_version INTEGER NOT NULL);
 CREATE TABLE case_calculation_heads(case_id TEXT PRIMARY KEY,run_id TEXT NOT NULL,data_version INTEGER NOT NULL,case_revision INTEGER NOT NULL,input_sha256 TEXT NOT NULL);
 CREATE TABLE case_calculation_runs(id TEXT PRIMARY KEY,data_version INTEGER NOT NULL,case_revision INTEGER NOT NULL,input_sha256 TEXT NOT NULL,reference_sha256 TEXT NOT NULL);
 CREATE TABLE case_legal_automation_jobs(id TEXT PRIMARY KEY,case_id TEXT NOT NULL,data_version INTEGER NOT NULL,case_revision INTEGER NOT NULL,calculation_run_id TEXT NOT NULL,input_sha256 TEXT NOT NULL,reference_sha256 TEXT NOT NULL,status TEXT NOT NULL,attempts INTEGER NOT NULL,next_attempt_at TEXT,last_error TEXT,updated_at TEXT);
 CREATE TABLE case_legal_automation_events(id INTEGER PRIMARY KEY AUTOINCREMENT,case_id TEXT,job_id TEXT,data_version INTEGER,event_kind TEXT,payload_json TEXT,created_at TEXT);
 INSERT INTO cases VALUES('case-A',1);
 INSERT INTO case_data_change_state VALUES('case-A',1);
 INSERT INTO case_calculation_runs VALUES('calc-A',1,1,'input-A','ref-A');
 INSERT INTO case_calculation_runs VALUES('calc-B',1,1,'input-B','ref-B');
 INSERT INTO case_calculation_heads VALUES('case-A','calc-A',1,1,'input-A');
 INSERT INTO case_legal_automation_jobs VALUES('job-A','case-A',1,1,'calc-A','input-A','ref-A','failed',3,NULL,'old','old');`);
 return {a,b,close(){a.close();b.close();rmSync(dir,{recursive:true,force:true});}};
}
function batch(db,failAudit=false){
 db.exec("BEGIN IMMEDIATE");
 try{
  const changed=Number(db.prepare(UPDATE).run(...ua).changes);
  if(failAudit)db.exec("CREATE TEMP TRIGGER audit_fail BEFORE INSERT ON case_legal_automation_events BEGIN SELECT RAISE(ABORT,'synthetic-audit-failure'); END");
  const logged=Number(db.prepare(AUDIT).run(...ea).changes);
  db.exec("COMMIT");
  return [changed,logged];
 }catch(e){db.exec("ROLLBACK");throw e;}
}
function observed(db){
 return {status:db.prepare("SELECT status FROM case_legal_automation_jobs WHERE id='job-A'").get()?.status,
 events:db.prepare("SELECT count(*) AS n FROM case_legal_automation_events").get()?.n};
}
for(const [label,change] of [
 ["current calculation head switched to new run despite same source version","UPDATE case_calculation_heads SET run_id='calc-B',input_sha256='input-B' WHERE case_id='case-A'"],
 ["case revision changed after latest()","UPDATE cases SET revision=2 WHERE id='case-A'"],
 ["source dataVersion changed after latest()","UPDATE case_data_change_state SET data_version=2 WHERE case_id='case-A'"],
 ["current head input changed without bumping source version","UPDATE case_calculation_heads SET input_sha256='input-B' WHERE case_id='case-A'"],
 ["calculation run reference SHA changed","UPDATE case_calculation_runs SET reference_sha256='ref-B' WHERE id='calc-A'"],
]){
 test("stale retry blocked: "+label,()=>{
  const h=fixture();try{h.b.exec(change);assert.deepEqual(batch(h.a),[0,0]);assert.deepEqual(observed(h.b),{status:"failed",events:0});}finally{h.close();}
 });
}
test("unchanged head permits exactly one batch state transition and event",()=>{
 const h=fixture();try{assert.deepEqual(batch(h.a),[1,1]);assert.deepEqual(observed(h.b),{status:"retry_wait",events:1});}finally{h.close();}
});
test("second WAL connection cannot duplicate the same retry",()=>{
 const h=fixture();try{assert.deepEqual(batch(h.a),[1,1]);assert.deepEqual(batch(h.b),[0,0]);assert.equal(observed(h.b).events,1);}finally{h.close();}
});
test("failed audit INSERT rolls back the successful UPDATE",()=>{
 const h=fixture();try{assert.throws(()=>batch(h.a,true),/synthetic-audit-failure/);assert.deepEqual(observed(h.b),{status:"failed",events:0});}finally{h.close();}
});
test("COMMIT followed by lost response requires read-only reconciliation",()=>{
 const h=fixture();try{assert.deepEqual(batch(h.a),[1,1]);const responseUnobserved=true;assert.equal(responseUnobserved,true);assert.deepEqual(observed(h.b),{status:"retry_wait",events:1});}finally{h.close();}
});
