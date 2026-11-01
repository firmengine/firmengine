import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {AUTOMATIC_DRAFT_HANDOFF_HEAD_SQL as guarded} from "../lib/automatic-draft-handoff-head.ts";

// Exact head() SELECT from pre-fix main, for negative controls only.
const baseline =
 "SELECT s.data_version AS dataVersion,c.run_id AS calculationRunId,l.review_run_id AS legalReviewRunId,"+
 "c.case_revision AS calculationCaseRevision,l.case_revision AS legalCaseRevision,"+
 "r.reference_sha256 AS referenceSha256 "+
 "FROM case_data_change_state s "+
 "JOIN case_calculation_heads c ON c.case_id=s.case_id "+
 "JOIN case_calculation_runs r ON r.id=c.run_id "+
 "JOIN case_legal_review_heads l ON l.case_id=s.case_id "+
 "WHERE s.case_id=? AND c.data_version=s.data_version "+
 "AND l.data_version=s.data_version AND l.calculation_run_id=c.run_id";
const ddl=[
 "CREATE TABLE cases(id TEXT PRIMARY KEY,revision INTEGER NOT NULL)",
 "CREATE TABLE case_data_change_state(case_id TEXT PRIMARY KEY REFERENCES cases(id),data_version INTEGER NOT NULL)",
 "CREATE TABLE case_calculation_runs(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES cases(id),data_version INTEGER NOT NULL,case_revision INTEGER NOT NULL,input_sha256 TEXT NOT NULL,reference_sha256 TEXT NOT NULL)",
 "CREATE TABLE case_calculation_heads(case_id TEXT PRIMARY KEY REFERENCES cases(id),run_id TEXT NOT NULL REFERENCES case_calculation_runs(id),data_version INTEGER NOT NULL,case_revision INTEGER NOT NULL,input_sha256 TEXT NOT NULL)",
 "CREATE TABLE case_legal_review_runs(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES cases(id),data_version INTEGER NOT NULL,case_revision INTEGER NOT NULL,calculation_run_id TEXT NOT NULL REFERENCES case_calculation_runs(id),input_sha256 TEXT NOT NULL)",
 "CREATE TABLE case_legal_review_heads(case_id TEXT PRIMARY KEY REFERENCES cases(id),review_run_id TEXT NOT NULL REFERENCES case_legal_review_runs(id),data_version INTEGER NOT NULL,case_revision INTEGER NOT NULL,calculation_run_id TEXT NOT NULL REFERENCES case_calculation_runs(id),input_sha256 TEXT NOT NULL)",
 "INSERT INTO cases VALUES('case-A',3),('case-B',3)",
 "INSERT INTO case_data_change_state VALUES('case-A',7),('case-B',7)",
 "INSERT INTO case_calculation_runs VALUES('calc-A','case-A',7,3,'input-A','ref-A'),('calc-B','case-B',7,3,'input-B','ref-A')",
 "INSERT INTO case_calculation_heads VALUES('case-A','calc-A',7,3,'input-A')",
 "INSERT INTO case_legal_review_runs VALUES('legal-A','case-A',7,3,'calc-A','legal-input-A'),('legal-B','case-B',7,3,'calc-B','legal-input-B')",
 "INSERT INTO case_legal_review_heads VALUES('case-A','legal-A',7,3,'calc-A','legal-input-A')"
].join(";")+";";
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),"firmengine-a4-r68-")),path=join(dir,"synthetic.sqlite");
 const a=new DatabaseSync(path),b=new DatabaseSync(path);
 a.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON");
 b.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON");
 a.exec(ddl);
 return {a,b,close(){a.close();b.close();rmSync(dir,{recursive:true,force:true})}};
}
function head(db,sql=guarded){return db.prepare(sql).get("case-A")??null;}
function update(db,sql){db.exec("BEGIN IMMEDIATE");try{db.exec(sql);db.exec("COMMIT");}catch(e){db.exec("ROLLBACK");throw e;}}
test("matching case, source, calculation and legal run remains a handoff candidate (not approval)",()=>{
 const f=fixture();try{assert.equal(head(f.a,baseline)?.calculationRunId,"calc-A");assert.equal(head(f.a)?.legalReviewRunId,"legal-A");}finally{f.close()}
});
const faults=[
 ["calculation run foreign owner","UPDATE case_calculation_runs SET case_id='case-B' WHERE id='calc-A'"],
 ["calculation head foreign run","UPDATE case_calculation_heads SET run_id='calc-B',input_sha256='input-B' WHERE case_id='case-A';UPDATE case_legal_review_heads SET calculation_run_id='calc-B' WHERE case_id='case-A';UPDATE case_legal_review_runs SET calculation_run_id='calc-B' WHERE id='legal-A'"],
 ["calculation run old data version","UPDATE case_calculation_runs SET data_version=6 WHERE id='calc-A'"],
 ["calculation run old case revision","UPDATE case_calculation_runs SET case_revision=2 WHERE id='calc-A'"],
 ["calculation input SHA mismatch","UPDATE case_calculation_heads SET input_sha256='other' WHERE case_id='case-A'"],
 ["legal run foreign owner","UPDATE case_legal_review_runs SET case_id='case-B' WHERE id='legal-A'"],
 ["legal head foreign run","UPDATE case_legal_review_heads SET review_run_id='legal-B',calculation_run_id='calc-A',input_sha256='legal-input-B' WHERE case_id='case-A'"],
 ["legal run old data version","UPDATE case_legal_review_runs SET data_version=6 WHERE id='legal-A'"],
 ["legal run old case revision","UPDATE case_legal_review_runs SET case_revision=2 WHERE id='legal-A'"],
 ["legal run wrong calculation","UPDATE case_legal_review_runs SET calculation_run_id='calc-B' WHERE id='legal-A'"],
 ["legal input SHA mismatch","UPDATE case_legal_review_heads SET input_sha256='other' WHERE case_id='case-A'"],
 ["legal head old case revision","UPDATE case_legal_review_heads SET case_revision=2 WHERE case_id='case-A'"]
];
for(const [label,sql] of faults)test(label+" baseline reads while guarded blocks",()=>{
 const f=fixture();try{update(f.b,sql);assert.notEqual(head(f.a,baseline),null);assert.equal(head(f.a),null)}finally{f.close()}
});
test("source data version change remains blocked by both queries",()=>{
 const f=fixture();try{update(f.b,"UPDATE case_data_change_state SET data_version=8 WHERE case_id='case-A'");assert.equal(head(f.a,baseline),null);assert.equal(head(f.a),null)}finally{f.close()}
});
test("two WAL connections demonstrate read-time guard, not final commit atomicity",()=>{
 const f=fixture();try{assert.equal(head(f.a)?.legalReviewRunId,"legal-A");update(f.b,"UPDATE case_legal_review_runs SET case_id='case-B' WHERE id='legal-A'");assert.equal(head(f.a),null)}finally{f.close()}
});
