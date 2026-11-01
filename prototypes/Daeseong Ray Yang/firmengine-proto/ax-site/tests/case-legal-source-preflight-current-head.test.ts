import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync,type SQLInputValue} from "node:sqlite";
import {inspectLegalAutomationSourceReadiness} from "../lib/case-legal-source-preflight.ts";
import referenceRelease from "../lib/reference-release.json" with {type:"json"};
import type {CaseData} from "../lib/domain.ts";

// Fully synthetic cases, facts and normalized page heads: never client OCR.
const CURRENT_SHA=referenceRelease.sha256;
const OTHER_SHA=CURRENT_SHA==="a".repeat(64)?"b".repeat(64):"a".repeat(64);
const INPUT_A="c".repeat(64),INPUT_B="d".repeat(64);
const SOURCE=JSON.stringify({featureSnapshot:{
 legacySnapshotFallback:false,sourceHeads:[{documentId:"doc-synthetic",page:1}]
}});
function fixture(){
 const sqlite=new DatabaseSync(":memory:");
 sqlite.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE cases(id TEXT PRIMARY KEY,revision INTEGER NOT NULL);
 CREATE TABLE case_data_change_state(case_id TEXT PRIMARY KEY REFERENCES cases(id),data_version INTEGER NOT NULL);
 CREATE TABLE case_calculation_runs(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES cases(id),
  data_version INTEGER NOT NULL,case_revision INTEGER NOT NULL,input_sha256 TEXT NOT NULL,
  reference_sha256 TEXT NOT NULL,source_heads_json TEXT NOT NULL);
 CREATE TABLE case_calculation_heads(case_id TEXT PRIMARY KEY REFERENCES cases(id),
  run_id TEXT NOT NULL REFERENCES case_calculation_runs(id),data_version INTEGER NOT NULL,
  case_revision INTEGER NOT NULL,input_sha256 TEXT NOT NULL);
 CREATE TABLE consultation_heads(case_id TEXT PRIMARY KEY,active_run_id TEXT,revision INTEGER NOT NULL);
 CREATE TABLE consultation_runs(id TEXT PRIMARY KEY,case_id TEXT,consultation_revision INTEGER,status TEXT);
 INSERT INTO cases VALUES('synthetic-current',3),('synthetic-foreign',3);
 INSERT INTO case_data_change_state VALUES('synthetic-current',7),('synthetic-foreign',7);`);
 const add=sqlite.prepare("INSERT INTO case_calculation_runs VALUES(?,?,?,?,?,?,?)");
 add.run("run-current","synthetic-current",7,3,INPUT_A,CURRENT_SHA,SOURCE);
 add.run("run-foreign","synthetic-foreign",7,3,INPUT_A,CURRENT_SHA,SOURCE);
 add.run("run-old-ref","synthetic-current",7,3,INPUT_B,OTHER_SHA,SOURCE);
 const swap=(runId:string,inputSha=INPUT_A)=>
  sqlite.prepare("UPDATE case_calculation_heads SET run_id=?,input_sha256=? WHERE case_id='synthetic-current'").run(runId,inputSha);
 sqlite.prepare("INSERT INTO case_calculation_heads VALUES(?,?,?,?,?)")
  .run("synthetic-current","run-current",7,3,INPUT_A);
 const db={prepare(sql:string){
  let values:SQLInputValue[]=[];
  const stmt={bind(...args:SQLInputValue[]){values=args;return stmt;},
   async first<T>(){return sqlite.prepare(sql).get(...values) as T??null;}};
  return stmt;
 }} as unknown as D1Database;
 const data={context:{id:"synthetic-current",revision:3},
  documents:[{id:"doc-synthetic",status:"active"}],
  pages:[{documentId:"doc-synthetic",page:1,role:"evidence"}],
  workflowState:{requirements:[]}} as unknown as CaseData;
 const inspect=()=>inspectLegalAutomationSourceReadiness(db,data,true);
 return {sqlite,data,swap,inspect};
}
async function checked(mutator:(f:ReturnType<typeof fixture>)=>void,expected:boolean){
 const f=fixture();try{mutator(f);const result=await f.inspect();
  assert.equal(result.ready,expected);
  if(!expected){assert.equal(result.status,"review_required");
   assert.ok(result.blockers.includes("NORMALIZED_SOURCE_FALLBACK_UNVERIFIED"));}
 }finally{f.sqlite.close();}
}
test("matching current source calculation snapshot allows only advisory source preflight",async()=>
 checked(()=>{},true));
test("foreign case Run alias is not accepted as this case's normalized OCR source",async()=>
 checked(f=>f.swap("run-foreign"),false));
test("same case Head/Run input SHA mismatch cannot pass source preflight",async()=>
 checked(f=>f.swap("run-current",INPUT_B),false));
test("source dataVersion increased without recalculation cannot pass source preflight",async()=>
 checked(f=>f.sqlite.prepare("UPDATE case_data_change_state SET data_version=8 WHERE case_id='synthetic-current'").run(),false));
test("case revision increased without recalculation cannot pass source preflight",async()=>
 checked(f=>f.sqlite.prepare("UPDATE cases SET revision=4 WHERE id='synthetic-current'").run(),false));
test("Head points to old reference release with identical normalized page heads: hold",async()=>
 checked(f=>f.swap("run-old-ref",INPUT_B),false));
test("Head metadata revision differs from current revision: hold",async()=>
 checked(f=>f.sqlite.prepare("UPDATE case_calculation_heads SET case_revision=4 WHERE case_id='synthetic-current'").run(),false));
