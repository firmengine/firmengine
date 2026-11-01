import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {AUTOMATIC_DRAFT_CURRENT_HEAD_SQL as headSql,AUTOMATIC_DRAFT_EXISTING_RUN_SQL as draftSql} from "../lib/automatic-draft-current-head.ts";

const ddl=[
 "CREATE TABLE cases(id TEXT PRIMARY KEY,revision INTEGER)",
 "CREATE TABLE case_data_change_state(case_id TEXT PRIMARY KEY REFERENCES cases(id),data_version INTEGER)",
 "CREATE TABLE case_calculation_runs(id TEXT PRIMARY KEY,case_id TEXT REFERENCES cases(id),data_version INTEGER,case_revision INTEGER,input_sha256 TEXT,reference_sha256 TEXT)",
 "CREATE TABLE case_calculation_heads(case_id TEXT PRIMARY KEY REFERENCES cases(id),run_id TEXT REFERENCES case_calculation_runs(id),data_version INTEGER,case_revision INTEGER,input_sha256 TEXT)",
 "CREATE TABLE case_legal_review_runs(id TEXT PRIMARY KEY,case_id TEXT REFERENCES cases(id),data_version INTEGER,case_revision INTEGER,calculation_run_id TEXT REFERENCES case_calculation_runs(id))",
 "CREATE TABLE case_legal_review_heads(case_id TEXT PRIMARY KEY REFERENCES cases(id),review_run_id TEXT REFERENCES case_legal_review_runs(id),data_version INTEGER,case_revision INTEGER,calculation_run_id TEXT REFERENCES case_calculation_runs(id))",
 "CREATE TABLE case_legal_automation_jobs(id TEXT PRIMARY KEY,case_id TEXT REFERENCES cases(id),data_version INTEGER,case_revision INTEGER,calculation_run_id TEXT REFERENCES case_calculation_runs(id),legal_review_run_id TEXT REFERENCES case_legal_review_runs(id),reference_sha256 TEXT,lease_token TEXT,lease_until TEXT,status TEXT)",
 "CREATE TABLE case_automatic_document_runs(id TEXT PRIMARY KEY,case_id TEXT REFERENCES cases(id),legal_review_run_id TEXT REFERENCES case_legal_review_runs(id),data_version INTEGER,case_revision INTEGER,status TEXT,artifacts_json TEXT)",
 "INSERT INTO cases VALUES('a',3),('b',3)",
 "INSERT INTO case_data_change_state VALUES('a',7),('b',7)",
 "INSERT INTO case_calculation_runs VALUES('calc-A','a',7,3,'input-A','ref-A'),('calc-B','b',7,3,'input-B','ref-A')",
 "INSERT INTO case_calculation_heads VALUES('a','calc-A',7,3,'input-A')",
 "INSERT INTO case_legal_review_runs VALUES('legal-A','a',7,3,'calc-A'),('legal-B','b',7,3,'calc-B')",
 "INSERT INTO case_legal_review_heads VALUES('a','legal-A',7,3,'calc-A')",
 "INSERT INTO case_legal_automation_jobs VALUES('job-A','a',7,3,'calc-A','legal-A','ref-A','lease-A','2026-11-03T00:00:00Z','running')",
 "INSERT INTO case_automatic_document_runs VALUES('draft-A','a','legal-A',7,3,'complete','[]')"
].join(";")+";";
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),"a4-r67-")),path=join(dir,"db.sqlite");
 const a=new DatabaseSync(path),b=new DatabaseSync(path);
 a.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON");
 b.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON");
 a.exec(ddl);
 return {a,b,close(){a.close();b.close();rmSync(dir,{recursive:true,force:true})}};
}
function status(db){
 const r=db.prepare(headSql).get("job-A","a");
 if(!r||r.revision!==3||r.dataVersion!==7||r.calculationRunId!=="calc-A"||r.reviewRunId!=="legal-A"||r.leaseToken!=="lease-A"||r.status!=="running"||!r.leaseUntil||r.leaseUntil<="2026-11-02T00:00:00Z")return "blocked";
 const d=db.prepare(draftSql).get("legal-A","a");
 if(d&&(d.dataVersion!==7||d.caseRevision!==3))return "blocked";
 return d?.status==="complete"?"replay_candidate":"render_candidate";
}
test("matching case, source, calculation, legal head and lease is a draft replay candidate, not approval",()=>{
 const f=fixture();try{assert.equal(status(f.a),"replay_candidate")}finally{f.close()}
});
const mutations=[
 ["calc head stale source","UPDATE case_calculation_heads SET data_version=6"],
 ["calc head stale revision","UPDATE case_calculation_heads SET case_revision=2"],
 ["legal head stale source","UPDATE case_legal_review_heads SET data_version=6"],
 ["legal head stale revision","UPDATE case_legal_review_heads SET case_revision=2"],
 ["legal head foreign calc","UPDATE case_legal_review_heads SET calculation_run_id='calc-B'"],
 ["legal run foreign calc","UPDATE case_legal_review_runs SET calculation_run_id='calc-B' WHERE id='legal-A'"],
 ["legal run foreign case","UPDATE case_legal_review_runs SET case_id='b' WHERE id='legal-A'"],
 ["job stale source","UPDATE case_legal_automation_jobs SET data_version=6"],
 ["job foreign calc","UPDATE case_legal_automation_jobs SET calculation_run_id='calc-B'"],
 ["job foreign legal review","UPDATE case_legal_automation_jobs SET legal_review_run_id='legal-B'"],
 ["calc SHA mismatch","UPDATE case_calculation_runs SET input_sha256='other' WHERE id='calc-A'"],
 ["source change","UPDATE case_data_change_state SET data_version=8 WHERE case_id='a'"],
 ["worker lease replaced","UPDATE case_legal_automation_jobs SET lease_token='lease-B'"],
 ["existing draft source stale","UPDATE case_automatic_document_runs SET data_version=6"],
 ["existing draft revision stale","UPDATE case_automatic_document_runs SET case_revision=2"]
];
for(const [label,sql] of mutations)test(label+" fails closed",()=>{
 const f=fixture();try{
  f.b.exec("BEGIN IMMEDIATE");f.b.exec(sql);f.b.exec("COMMIT");
  assert.equal(status(f.a),"blocked");
 }finally{f.close()}
});
test("two WAL connections: stale head after commit cannot be reused as complete draft",()=>{
 const f=fixture();try{
  assert.equal(status(f.a),"replay_candidate");
  f.b.exec("BEGIN IMMEDIATE");f.b.exec("UPDATE case_calculation_heads SET data_version=6");f.b.exec("COMMIT");
  assert.equal(status(f.a),"blocked");
 }finally{f.close()}
});
