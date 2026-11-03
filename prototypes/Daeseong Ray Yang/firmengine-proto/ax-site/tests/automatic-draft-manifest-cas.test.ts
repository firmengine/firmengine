import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {buildAutomaticDraftManifestCas} from "../lib/automatic-draft-manifest-cas.ts";

function fixture(){
 const db=new DatabaseSync(":memory:");
 db.exec([
  "CREATE TABLE cases(id TEXT PRIMARY KEY,revision INTEGER NOT NULL);",
  "CREATE TABLE case_data_change_state(case_id TEXT PRIMARY KEY,data_version INTEGER NOT NULL);",
  "CREATE TABLE case_calculation_runs(id TEXT PRIMARY KEY,reference_sha256 TEXT NOT NULL);",
  "CREATE TABLE case_calculation_heads(case_id TEXT PRIMARY KEY,data_version INTEGER,case_revision INTEGER,run_id TEXT);",
  "CREATE TABLE case_legal_review_heads(case_id TEXT PRIMARY KEY,data_version INTEGER,case_revision INTEGER,calculation_run_id TEXT,review_run_id TEXT);",
  "CREATE TABLE case_legal_automation_jobs(id TEXT PRIMARY KEY,case_id TEXT,data_version INTEGER,case_revision INTEGER,calculation_run_id TEXT,legal_review_run_id TEXT,status TEXT,lease_token TEXT,lease_until TEXT);",
  "CREATE TABLE case_automatic_document_runs(id TEXT PRIMARY KEY,case_id TEXT,legal_review_run_id TEXT,data_version INTEGER,case_revision INTEGER,status TEXT,artifacts_json TEXT,reason TEXT,updated_at TEXT);",
  "CREATE TABLE analyses(id TEXT PRIMARY KEY,case_id TEXT,revision INTEGER,type TEXT,payload TEXT,at TEXT);",
  "INSERT INTO cases VALUES('synthetic-case',4);",
  "INSERT INTO case_data_change_state VALUES('synthetic-case',5);",
  "INSERT INTO case_calculation_runs VALUES('calc-v5','aaaaaaaa');",
  "INSERT INTO case_calculation_runs VALUES('calc-v6','aaaaaaaa');",
  "INSERT INTO case_calculation_heads VALUES('synthetic-case',5,4,'calc-v5');",
  "INSERT INTO case_legal_review_heads VALUES('synthetic-case',5,4,'calc-v5','legal-v5');",
  "INSERT INTO case_legal_automation_jobs VALUES('job-v5','synthetic-case',5,4,'calc-v5','legal-v5','running','lease-v5','2026-10-30T06:00:00Z');",
  "INSERT INTO case_automatic_document_runs VALUES('auto-draft:legal-v5','synthetic-case','legal-v5',5,4,'pending','[]',NULL,NULL);"
 ].join("\n"));
 return db;
}
const input={caseId:"synthetic-case",caseRevision:4,dataVersion:5,
 calculationRunId:"calc-v5",legalReviewRunId:"legal-v5",jobId:"job-v5",
 leaseToken:"lease-v5",referenceSha256:"aaaaaaaa",runId:"auto-draft:legal-v5",
 artifactsJson:'[{"id":"synthetic-artifact"}]',receiptJson:'{"source":"synthetic"}',
 at:"2026-10-30T05:00:00Z"};
function commit(db:DatabaseSync){
 const cas=buildAutomaticDraftManifestCas(input);
 db.exec("BEGIN IMMEDIATE");
 let counts:number[];
 try{
  const one=db.prepare(cas.receiptSql).run(...cas.receiptParams).changes;
  const two=db.prepare(cas.finishSql).run(...cas.finishParams).changes;
  counts=[Number(one),Number(two)];
  db.exec("COMMIT");
 }catch(e){db.exec("ROLLBACK");throw e;}
 return {counts,receiptCount:Number((db.prepare("SELECT COUNT(*) AS n FROM analyses").get() as {n:number}).n),
  status:(db.prepare("SELECT status FROM case_automatic_document_runs").get() as {status:string}).status};
}
test("current source/calculation/legal heads and lease finish one draft and receipt",()=>{
 const db=fixture();
 assert.deepEqual(commit(db),{counts:[1,1],receiptCount:1,status:"complete"});
 db.close();
});
for(const [label,mutate] of [
 ["source revision changes during rendering", "UPDATE cases SET revision=5; UPDATE case_data_change_state SET data_version=6;"],
 ["OCR version changes without case revision","UPDATE case_data_change_state SET data_version=6;"],
 ["worker lease is replaced","UPDATE case_legal_automation_jobs SET lease_token='another-worker';"],
 ["worker lease expires","UPDATE case_legal_automation_jobs SET lease_until='2026-10-30T04:59:59Z';"],
 ["calculator head is replaced","UPDATE case_calculation_heads SET run_id='calc-v6';"],
 ["legal review head is replaced","UPDATE case_legal_review_heads SET review_run_id='other-review';"],
 ["reference release no longer matches","UPDATE case_calculation_runs SET reference_sha256='bbbbbbbb' WHERE id='calc-v5';"],
] as const){
 test(label+" blocks stale receipt and status completion",()=>{
  const db=fixture();db.exec(mutate);
  assert.deepEqual(commit(db),{counts:[0,0],receiptCount:0,status:"pending"});
  db.close();
 });
}
test("already finished draft cannot create a second receipt",()=>{
 const db=fixture();db.exec("UPDATE case_automatic_document_runs SET status='complete';");
 assert.deepEqual(commit(db),{counts:[0,0],receiptCount:0,status:"complete"});
 db.close();
});
