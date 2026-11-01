// A2 r63 IT: executable SQL-only diagnostic, NOT a product acceptance gate.
// Uses the exact migration-0011 schema and SQL statements copied from
// lib/case-calculation-feature-store.ts at the audited main SHA.
// SQL cannot establish that the application's deterministic run ID ever collides:
// heterogeneous same-ID writes are synthetic prior-row contamination scenarios.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../drizzle/0011_case_calculation_features.sql', import.meta.url), 'utf8');
const RUN = 'calculation-SYN-R63';
const FEAT = `${RUN}:feature:00000000`;
const IN_SHA = 'a'.repeat(64);
const runSql = 'INSERT OR IGNORE INTO case_calculation_runs (id,case_id,data_version,case_revision,input_sha256,rule_release_id,reference_id,reference_revision,reference_sha256,contract_version,status,missing_json,raw_result_json,source_heads_json,source_heads_sha256,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
const featureSql = 'INSERT OR IGNORE INTO case_calculation_features (id,run_id,calculation_id,output_name,output_path,subject_id,row_ordinal,value_json,value_won,status,source_fact_ids_json,input_refs_json,formula) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)';
const headSql = 'INSERT INTO case_calculation_heads (case_id,run_id,data_version,case_revision,input_sha256,updated_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM cases c JOIN case_data_change_state s ON s.case_id=c.id WHERE c.id=? AND c.revision=? AND s.data_version=?) ON CONFLICT(case_id) DO UPDATE SET run_id=excluded.run_id,data_version=excluded.data_version,case_revision=excluded.case_revision,input_sha256=excluded.input_sha256,updated_at=excluded.updated_at WHERE excluded.data_version>=case_calculation_heads.data_version AND excluded.case_revision>=case_calculation_heads.case_revision';

function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  db.exec(`CREATE TABLE cases(id TEXT PRIMARY KEY,revision INTEGER NOT NULL);
    CREATE TABLE case_data_change_state(case_id TEXT PRIMARY KEY,data_version INTEGER NOT NULL);
    INSERT INTO cases VALUES('SYN-C1',1);
    INSERT INTO case_data_change_state VALUES('SYN-C1',5);`);
  db.exec(migration);
  function write({value='2400000', facts=['SYN-F1'], version=5, status='computed'}={}) {
    db.exec('BEGIN');
    try {
      const run = db.prepare(runSql).run(RUN,'SYN-C1',version,1,IN_SHA,'SYN-RULE','SYN-REF',1,'b'.repeat(64),'SYN-C',status,'{}','{}','{}','c'.repeat(64),'2026-11-02T00:00:00Z');
      const feat = db.prepare(featureSql).run(FEAT,RUN,'income_aggregation','monthlyIncomeWon','/assessment/calculation/monthlyIncomeWon',null,null,JSON.stringify(value),value,status,JSON.stringify(facts),'{}','synthetic-only');
      const head = db.prepare(headSql).run('SYN-C1',RUN,version,1,IN_SHA,'2026-11-02T00:00:00Z','SYN-C1',1,version);
      db.exec('COMMIT');
      return {runChanges:run.changes,featureChanges:feat.changes,headChanges:head.changes,stored:db.prepare('SELECT value_json,value_won,status,source_fact_ids_json FROM case_calculation_features WHERE id=?').get(FEAT)};
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  return {db,write};
}

test('A2 r63: first insert and exact replay preserve stored 2400000 won and Fact', () => {
  const {db,write}=fixture();
  const first=write(), again=write();
  assert.deepEqual([first.runChanges,first.featureChanges,first.headChanges],[1,1,1]);
  assert.deepEqual([again.runChanges,again.featureChanges,again.headChanges],[0,0,1]);
  assert.equal(again.stored.value_won,'2400000');
  assert.equal(again.stored.source_fact_ids_json,'["SYN-F1"]');
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  db.close();
});

test('A2 r63 KNOWN GAP: heterogeneous same-ID monetary row is ignored while head UPDATE succeeds', () => {
  const {db,write}=fixture();
  write();
  const replay=write({value:'9000000'});
  assert.deepEqual([replay.featureChanges,replay.headChanges],[0,1]);
  assert.equal(replay.stored.value_won,'2400000');
  db.close();
});

test('A2 r63 KNOWN GAP: heterogeneous same-ID Fact array is ignored while head UPDATE succeeds', () => {
  const {db,write}=fixture();
  write();
  const replay=write({facts:['SYN-F2']});
  assert.deepEqual([replay.featureChanges,replay.headChanges],[0,1]);
  assert.equal(replay.stored.source_fact_ids_json,'["SYN-F1"]');
  db.close();
});

test('A2 r63: stale source data_version=4 is rejected for head promotion', () => {
  const {db,write}=fixture();
  write();
  assert.equal(write({version:4}).headChanges,0);
  assert.equal(db.prepare('SELECT data_version FROM case_calculation_heads WHERE case_id=?').get('SYN-C1').data_version,5);
  db.close();
});

test('A2 r63: JSON null and explicit 0 can persist as distinct records without SQL semantic validation', () => {
  const {db,write}=fixture();
  write({value:'0'});
  const f=db.prepare('SELECT value_json,value_won,status FROM case_calculation_features WHERE id=?').get(FEAT);
  assert.equal(f.value_won,'0');assert.equal(f.value_json,'"0"');
  db.prepare('UPDATE case_calculation_features SET value_json=? WHERE id=?').run('null',FEAT);
  const corrupt=db.prepare('SELECT value_json,value_won,status FROM case_calculation_features WHERE id=?').get(FEAT);
  assert.deepEqual([corrupt.value_json,corrupt.value_won,corrupt.status],['null','0','computed']);
  db.close();
});

test.todo('A2-IT-008/015: add fail-closed existing-row equality/read-after-write verification BEFORE head promotion, with D1 concurrency tests');
