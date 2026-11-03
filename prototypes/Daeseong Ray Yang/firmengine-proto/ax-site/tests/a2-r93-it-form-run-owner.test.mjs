/** A2 r93 synthetic-only; not customer records, court-form approval or product E2E. */
import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {assertCalculationFormRunIdentity} from "../lib/calculation-form-run-identity.ts";

for (const months of [36,48,60]) {
 test(`A2 r93 ${months} months: matching case/revision/data version`,()=>{
  assert.doesNotThrow(()=>assertCalculationFormRunIdentity(
   {caseId:"SYN-A",caseRevision:7,dataVersion:3},
   {caseId:"SYN-A",caseRevision:7,dataVersion:3}));
 });
 test(`A2 r93 ${months} months: foreign case run blocked`,()=>{
  assert.throws(()=>assertCalculationFormRunIdentity(
   {caseId:"SYN-B",caseRevision:7,dataVersion:3},
   {caseId:"SYN-A",caseRevision:7,dataVersion:3}),/DOCUMENT_CALCULATION_RUN_CONTEXT_MISMATCH/);
 });
 test(`A2 r93 ${months} months: old case revision blocked`,()=>{
  assert.throws(()=>assertCalculationFormRunIdentity(
   {caseId:"SYN-A",caseRevision:6,dataVersion:3},
   {caseId:"SYN-A",caseRevision:7,dataVersion:3}),/DOCUMENT_CALCULATION_RUN_CONTEXT_MISMATCH/);
 });
 test(`A2 r93 ${months} months: old data version blocked`,()=>{
  assert.throws(()=>assertCalculationFormRunIdentity(
   {caseId:"SYN-A",caseRevision:7,dataVersion:2},
   {caseId:"SYN-A",caseRevision:7,dataVersion:3}),/DOCUMENT_CALCULATION_RUN_CONTEXT_MISMATCH/);
 });
 test(`A2 r93 ${months} months: missing/malformed run blocked`,()=>{
  const expected={caseId:"SYN-A",caseRevision:7,dataVersion:3};
  for (const run of [null,{caseId:"",caseRevision:7,dataVersion:3},
   {caseId:"SYN-A",caseRevision:null,dataVersion:3},
   {caseId:"SYN-A",caseRevision:7,dataVersion:"3"},
   {caseId:"SYN-A",caseRevision:7,dataVersion:NaN}])
   assert.throws(()=>assertCalculationFormRunIdentity(run,expected),/DOCUMENT_CALCULATION_RUN_CONTEXT_MISMATCH/);
 });
}
test("A2 r93 explicit integer zero is not silently null",()=>{
 assert.doesNotThrow(()=>assertCalculationFormRunIdentity(
  {caseId:"SYN-A",caseRevision:0,dataVersion:0},
  {caseId:"SYN-A",caseRevision:0,dataVersion:0}));
 assert.throws(()=>assertCalculationFormRunIdentity(
  {caseId:"SYN-A",caseRevision:0,dataVersion:0},
  {caseId:"SYN-A",caseRevision:1,dataVersion:0}),/DOCUMENT_CALCULATION_RUN_CONTEXT_MISMATCH/);
});
test("A2 r93 migration 0011 SQL readback: legacy run-id lookup is not a case-owner proof",()=>{
 const sqlite=new DatabaseSync(":memory:");
 try {
  sqlite.exec("PRAGMA foreign_keys=ON; CREATE TABLE cases(id TEXT PRIMARY KEY NOT NULL);");
  sqlite.exec(readFileSync(new URL("../drizzle/0011_case_calculation_features.sql",import.meta.url),"utf8"));
  sqlite.prepare("INSERT INTO cases(id) VALUES (?)").run("SYN-A");
  sqlite.prepare("INSERT INTO cases(id) VALUES (?)").run("SYN-B");
  const insertRun=sqlite.prepare("INSERT INTO case_calculation_runs (id,case_id,data_version,case_revision,input_sha256,rule_release_id,reference_id,reference_revision,reference_sha256,contract_version,status,missing_json,raw_result_json,source_heads_json,source_heads_sha256,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  for(const id of ["SYN-A","SYN-B"])insertRun.run("RUN-"+id,id,3,7,"0".repeat(64),"SYN-RULE","SYN-REF",1,"1".repeat(64),"SYN-CONTRACT","computed","[]","{}","{}","2".repeat(64),"2026-11-03T00:00:00Z");
  const insertFeature=sqlite.prepare("INSERT INTO case_calculation_features (id,run_id,calculation_id,output_name,output_path,subject_id,row_ordinal,value_json,value_won,status,source_fact_ids_json,input_refs_json,formula) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
  for(const id of ["SYN-A","SYN-B"])insertFeature.run("F-"+id,"RUN-"+id,"income_aggregation","monthlyIncomeWon","/result/monthlyIncomeWon",null,null,'"0"',"0","computed",JSON.stringify(["FACT-"+id]),"{}","synthetic");
  const legacy=sqlite.prepare("SELECT id,value_json FROM case_calculation_features WHERE run_id=?").all("RUN-SYN-B");
  assert.equal(legacy.length,1);
  assert.equal(legacy[0].id,"F-SYN-B","query returns other case's feature if caller supplies that run ID");
  const metadata=sqlite.prepare("SELECT case_id AS caseId,case_revision AS caseRevision,data_version AS dataVersion FROM case_calculation_runs WHERE id=?").get("RUN-SYN-B");
  assert.throws(()=>assertCalculationFormRunIdentity(metadata,{caseId:"SYN-A",caseRevision:7,dataVersion:3}),/DOCUMENT_CALCULATION_RUN_CONTEXT_MISMATCH/);
  assert.doesNotThrow(()=>assertCalculationFormRunIdentity(metadata,{caseId:"SYN-B",caseRevision:7,dataVersion:3}));
  const row=sqlite.prepare("SELECT value_json,value_won,source_fact_ids_json FROM case_calculation_features WHERE run_id=?").get("RUN-SYN-B");
  assert.equal(JSON.parse(row.value_json),"0");assert.equal(row.value_won,"0");
  assert.deepEqual(JSON.parse(row.source_fact_ids_json),["FACT-SYN-B"]);
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(),[]);
 } finally {sqlite.close();}
});
test.todo("D1 runtime/legal-automation API integration; head CAS, input SHA and source Fact validation");
test.todo("18 calculators / 91 input declarations / 42 outputs, D5103/D5110/D5111 real DOCX bytes");
test.todo("Official court templates, lawyer approval, staging D1/R2/Cron");
