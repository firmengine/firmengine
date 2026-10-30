import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync,type SQLInputValue} from "node:sqlite";
import {scanCaseSubstitutions,drainCaseSubstitutionWatch} from "../lib/case-substitution-watch.ts";
import {makeCaseRequirement} from "../lib/case-requirements.ts";
import type {CaseData} from "../lib/domain.ts";
import type {IntakeRequirement} from "../lib/intake-types.ts";

function harness(){
 const sql=new DatabaseSync(":memory:");
 sql.exec("PRAGMA foreign_keys=ON");
 sql.exec(`
 CREATE TABLE cases (id TEXT PRIMARY KEY,revision INTEGER NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE case_data_change_state(case_id TEXT PRIMARY KEY,data_version INTEGER NOT NULL);
 CREATE TABLE document_instances (source_document_id TEXT NOT NULL,page INTEGER NOT NULL,shared_document_type_id TEXT,case_id TEXT NOT NULL);
 CREATE TABLE legal_monitor_alerts (id TEXT PRIMARY KEY,created_at TEXT NOT NULL,acknowledged_at TEXT);
 CREATE TABLE consultation_heads(case_id TEXT PRIMARY KEY,active_run_id TEXT);
 CREATE TABLE consultation_runs(id TEXT PRIMARY KEY,status TEXT NOT NULL,catalog_version INTEGER NOT NULL);
 CREATE TABLE intake_catalog_head (id TEXT PRIMARY KEY,version INTEGER NOT NULL);
 `);
 sql.exec(readFileSync(new URL("../drizzle/0014_case_substitution_watch.sql",import.meta.url),"utf8"));
 sql.prepare("INSERT INTO cases VALUES ('case1',1,'2026-10-30T00:00:00.000Z')").run();
 sql.prepare("INSERT INTO case_data_change_state VALUES ('case1',1)").run();
 sql.prepare("INSERT INTO consultation_heads VALUES ('case1','run1')").run();
 sql.prepare("INSERT INTO consultation_runs VALUES ('run1','complete',3)").run();
 sql.prepare("INSERT INTO intake_catalog_head VALUES ('default',3)").run();
 const database={
  prepare(statement:string){
   let bound:SQLInputValue[]=[];
   const obj={
    bind(...params:SQLInputValue[]){bound=params;return obj;},
    async first<T>(){return (sql.prepare(statement).get(...bound)??null) as T|null;},
    async all<T>(){return {results:sql.prepare(statement).all(...bound) as T[]};},
    async run(){const result=sql.prepare(statement).run(...bound);return {meta:{changes:Number(result.changes)}};}
   };
   return obj;
  },
  async batch(statements:{run:()=>Promise<{meta:{changes:number}}> }[]){
   sql.exec("BEGIN");
   try{const values=[];for(const statement of statements)values.push(await statement.run());sql.exec("COMMIT");return values;}
   catch(e){sql.exec("ROLLBACK");throw e;}
  }
 } as unknown as D1Database;
 const source:IntakeRequirement={id:"r1",documentTypeId:"resident_registration",documentName:"Certificate",
  subjectId:"case",subjectLabel:"Applicant",period:"current",requirement:"required_when_applicable",status:"requested",
  reason:["identity"],matchedRuleIds:["INTAKE-001"],workflowIds:["WF-01"],sourceClaimIds:[],sourceIds:[],
  alternatives:[],alternativePolicy:"review_required",fields:["성명"],issuer:"office"};
 const requirement=makeCaseRequirement({source,intakeRunId:"run1",scopeKey:"case",idFactory:()=>"req1"});
 const data={
  context:{id:"case1",revision:1,asOf:"2026-10-30",courtId:"seoul"},
  workflowState:{schema:"case-workflow/1",version:1,requirements:[requirement],subjectLinks:[],documentMatches:[]},
  facts:[],documents:[],pages:[]
 } as unknown as CaseData;
 const getCase=async()=>structuredClone(data);
 const dbSource={getCase,getCatalogVersion:async()=>3};
 return {sql,database,data,dbSource,close:()=>sql.close()};
}
test("watcher migration, automatic activation, deduplicated repeat scans and immutable history",async()=>{
 const h=harness();try{
  const first=await scanCaseSubstitutions(h.database,{caseId:"case1",source:h.dbSource});
  assert.equal(first.status,"scanned");
  assert.equal(first.requirements,1);
  const row=h.sql.prepare("SELECT decision_status,active_request FROM case_substitution_request_states WHERE case_id='case1'").get() as {decision_status:string;active_request:number};
  assert.equal(row.decision_status,"original_required");
  assert.equal(row.active_request,1);
  const before=h.sql.prepare("SELECT COUNT(*) AS n FROM case_substitution_transition_events").get() as {n:number};
  await scanCaseSubstitutions(h.database,{caseId:"case1",source:h.dbSource});
  const after=h.sql.prepare("SELECT COUNT(*) AS n FROM case_substitution_transition_events").get() as {n:number};
  assert.equal(after.n,before.n);
  assert.deepEqual(h.sql.prepare("PRAGMA foreign_key_check").all(),[]);
 }finally{h.close();}
});
test("previously suppressed request is automatically restored on current proof failure",async()=>{
 const h=harness();try{
  h.sql.prepare(`INSERT INTO case_substitution_request_states
   (case_id,requirement_id,intake_run_id,original_document_type_id,decision_status,active_request,missing_fields_json,reason_codes_json,support_document_ids_json,evaluated_fingerprint,case_revision,source_data_version,catalog_version,evaluated_at)
   VALUES('case1','req1','run1','resident_registration','inactive_by_substitution',0,'[]','[]','[]','old',1,1,3,'2026-10-29T00:00:00Z')`).run();
  const result=await scanCaseSubstitutions(h.database,{caseId:"case1",source:h.dbSource});
  assert.equal(result.status,"scanned");assert.equal(result.restored,1);
  const row=h.sql.prepare("SELECT active_request FROM case_substitution_request_states WHERE requirement_id='req1'").get() as {active_request:number};
  assert.equal(row.active_request,1);
  const event=h.sql.prepare("SELECT from_active_request AS previous,to_active_request AS next FROM case_substitution_transition_events WHERE case_id='case1'").get() as {previous:number;next:number};
  assert.deepEqual(event,{previous:0,next:1});
 }finally{h.close();}
});
test("source-version movement is scanned without calculator quiet-period waiting",async()=>{
 const h=harness();try{
  await scanCaseSubstitutions(h.database,{caseId:"case1",source:h.dbSource});
  h.sql.prepare("UPDATE case_data_change_state SET data_version=2 WHERE case_id='case1'").run();
  const result=await drainCaseSubstitutionWatch(h.database,{caseId:"case1",limit:1,source:h.dbSource});
  assert.equal(result.scanned,1);
  const row=h.sql.prepare("SELECT source_data_version AS dataVersion FROM case_substitution_watch_heads WHERE case_id='case1'").get() as {dataVersion:number};
  assert.equal(row.dataVersion,2);
 }finally{h.close();}
});

test("idle cases with different court signals are not perpetually rescanned",async()=>{
 const h=harness();try{
  const initial=await scanCaseSubstitutions(h.database,{caseId:"case1",source:h.dbSource});
  assert.equal(initial.status,"scanned");
  const repeat=await drainCaseSubstitutionWatch(h.database,{caseId:"case1",limit:1,source:h.dbSource});
  assert.equal(repeat.scanned,0);
  assert.deepEqual(repeat.results,[]);
 }finally{h.close();}
});
test("new policy alert triggers a conservative rescan without changing source data",async()=>{
 const h=harness();try{
  await scanCaseSubstitutions(h.database,{caseId:"case1",source:h.dbSource});
  const before=(h.sql.prepare("SELECT data_version AS version FROM case_data_change_state WHERE case_id='case1'").get() as {version:number}).version;
  h.sql.prepare("INSERT INTO legal_monitor_alerts (id,created_at,acknowledged_at) VALUES (?,?,NULL)")
   .run("policy-change",new Date(Date.now()+60_000).toISOString());
  const result=await drainCaseSubstitutionWatch(h.database,{caseId:"case1",limit:1,source:h.dbSource});
  assert.equal(result.scanned,1);
  const after=(h.sql.prepare("SELECT data_version AS version FROM case_data_change_state WHERE case_id='case1'").get() as {version:number}).version;
  assert.equal(after,before);
 }finally{h.close();}
});
