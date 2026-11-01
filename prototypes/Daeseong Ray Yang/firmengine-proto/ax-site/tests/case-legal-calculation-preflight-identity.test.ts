import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync,type SQLInputValue} from "node:sqlite";
import {inspectLegalAutomationCalculationReadiness} from "../lib/case-legal-calculation-preflight.ts";
import referenceRelease from "../lib/reference-release.json" with {type:"json"};
import type {CaseData} from "../lib/domain.ts";

// Synthetic SQL records only. No actual client, OCR, court approval or model call.
const CURRENT_SHA=referenceRelease.sha256;
const OTHER_SHA=CURRENT_SHA==="a".repeat(64)?"b".repeat(64):"a".repeat(64);
const INPUT_A="c".repeat(64),INPUT_B="d".repeat(64);
function fixture(){
 const sqlite=new DatabaseSync(":memory:");
 sqlite.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE cases(id TEXT PRIMARY KEY,revision INTEGER NOT NULL);
 CREATE TABLE case_data_change_state(case_id TEXT PRIMARY KEY REFERENCES cases(id),data_version INTEGER NOT NULL);
 CREATE TABLE case_calculation_runs(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES cases(id),
  data_version INTEGER NOT NULL,case_revision INTEGER NOT NULL,input_sha256 TEXT NOT NULL,
  reference_sha256 TEXT NOT NULL,missing_json TEXT NOT NULL);
 CREATE TABLE case_calculation_heads(case_id TEXT PRIMARY KEY REFERENCES cases(id),
  run_id TEXT NOT NULL REFERENCES case_calculation_runs(id),data_version INTEGER NOT NULL,
  case_revision INTEGER NOT NULL,input_sha256 TEXT NOT NULL);
 INSERT INTO cases VALUES('synthetic-1',3),('synthetic-2',3);
 INSERT INTO case_data_change_state VALUES('synthetic-1',7),('synthetic-2',7);`);
 const run=sqlite.prepare("INSERT INTO case_calculation_runs VALUES(?,?,?,?,?,?,?)");
 run.run("run-1","synthetic-1",7,3,INPUT_A,CURRENT_SHA,'{"engineIssues":[]}');
 run.run("run-old-ref","synthetic-1",7,3,INPUT_B,OTHER_SHA,'{"engineIssues":[]}');
 run.run("run-foreign","synthetic-2",7,3,INPUT_B,CURRENT_SHA,'{"engineIssues":[]}');
 run.run("run-old-version","synthetic-1",6,3,INPUT_B,CURRENT_SHA,'{"engineIssues":[]}');
 sqlite.prepare("INSERT INTO case_calculation_heads VALUES(?,?,?,?,?)")
  .run("synthetic-1","run-1",7,3,INPUT_A);
 const db={prepare(sql:string){
  let values:SQLInputValue[]=[];
  const stmt={bind(...args:SQLInputValue[]){values=args;return stmt;},
   async first<T>(){return sqlite.prepare(sql).get(...values) as T??null;},
   async all<T>(){return{results:sqlite.prepare(sql).all(...values) as T[]};}};
  return stmt;
 }} as unknown as D1Database;
 const data={context:{id:"synthetic-1",revision:3,courtId:"",applicationDate:""}} as unknown as CaseData;
 const swap=(runId:string,inputSha=INPUT_B)=>
  sqlite.prepare("UPDATE case_calculation_heads SET run_id=?,input_sha256=? WHERE case_id='synthetic-1'").run(runId,inputSha);
 return {sqlite,db,data,swap};
}
test("matching calculation head/run/source/reference is eligible for deterministic preflight only",async()=>{
 const h=fixture();try{
  const result=await inspectLegalAutomationCalculationReadiness(h.db,h.data);
  assert.equal(result.ready,true);assert.equal(result.status,"ready");
 }finally{h.sqlite.close();}
});
test("same source revision but stale active reference cannot pass calculation preflight",async()=>{
 const h=fixture();try{
  h.swap("run-old-ref");
  const result=await inspectLegalAutomationCalculationReadiness(h.db,h.data);
  assert.equal(result.ready,false);assert.equal(result.status,"waiting_evidence");
  assert.ok(result.blockers.includes("CURRENT_CALCULATION_HEAD_MISSING"));
 }finally{h.sqlite.close();}
});
test("head/run input identity conflict cannot pass even when source/reference match",async()=>{
 const h=fixture();try{
  h.swap("run-1",INPUT_B);
  assert.equal((await inspectLegalAutomationCalculationReadiness(h.db,h.data)).ready,false);
 }finally{h.sqlite.close();}
});
test("foreign case run alias and stale run source-version cannot satisfy the current case",async()=>{
 const h=fixture();try{
  h.swap("run-foreign");
  assert.equal((await inspectLegalAutomationCalculationReadiness(h.db,h.data)).ready,false);
  h.swap("run-old-version");
  assert.equal((await inspectLegalAutomationCalculationReadiness(h.db,h.data)).ready,false);
 }finally{h.sqlite.close();}
});
test("a new source version still invalidates a previously current calculated head",async()=>{
 const h=fixture();try{
  h.sqlite.prepare("UPDATE case_data_change_state SET data_version=8 WHERE case_id='synthetic-1'").run();
  assert.equal((await inspectLegalAutomationCalculationReadiness(h.db,h.data)).ready,false);
 }finally{h.sqlite.close();}
});
