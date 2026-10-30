import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { EXPORT_SOURCE_VERSION_CAS_SQL, exportSourceVersionCASParams } from "../lib/export-source-version-guard.ts";

function fixture() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(`CREATE TABLE cases (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, storage_token TEXT NOT NULL, payload TEXT NOT NULL);
    CREATE TABLE case_data_change_state (case_id TEXT PRIMARY KEY, data_version INTEGER NOT NULL);
    INSERT INTO cases VALUES ('synthetic-case',7,'old','{}');
    INSERT INTO case_data_change_state VALUES ('synthetic-case',4);`);
  return sql;
}
function commit(sql: DatabaseSync, dataVersion: number, token = "old") {
  return sql.prepare("UPDATE cases SET payload = ?, storage_token = ? WHERE id = ? AND revision = ? AND storage_token = ? AND " + EXPORT_SOURCE_VERSION_CAS_SQL)
    .run('{"exportManifest":{"files":["synthetic"]}}', "new", "synthetic-case", 7, token,
      ...exportSourceVersionCASParams("synthetic-case", dataVersion)).changes;
}
function get(sql: DatabaseSync) {
  return sql.prepare("SELECT storage_token AS token,payload FROM cases WHERE id = 'synthetic-case'").get() as {token:string,payload:string};
}

test("same source version and case token allow exactly one atomic export manifest CAS", () => {
  const sql=fixture();try {
    assert.equal(commit(sql,4),1);
    assert.equal(get(sql).token,"new");
    assert.equal(commit(sql,4),0,"stale storage token rejects duplicate attempt");
  }finally {sql.close();}
});

test("OCR data-version changes without case revision block stale export", () => {
  const sql=fixture();try {
    sql.prepare("UPDATE case_data_change_state SET data_version=5 WHERE case_id='synthetic-case'").run();
    assert.equal(commit(sql,4),0);
    assert.equal(get(sql).token,"old");
    assert.equal(JSON.parse(get(sql).payload).exportManifest,undefined);
  }finally {sql.close();}
});

test("fresh source version can commit, stale one cannot", () => {
  const sql=fixture();try {
    sql.prepare("UPDATE case_data_change_state SET data_version=5 WHERE case_id='synthetic-case'").run();
    assert.equal(commit(sql,5),1);
    assert.equal(get(sql).token,"new");
  }finally {sql.close();}
});

test("missing source-state row fails closed", () => {
  const sql=fixture();try {
    sql.prepare("DELETE FROM case_data_change_state WHERE case_id='synthetic-case'").run();
    assert.equal(commit(sql,4),0);
    assert.equal(get(sql).token,"old");
  }finally {sql.close();}
});

test("unrelated case mutation never unlocks a stale source snapshot", () => {
  const sql=fixture();try {
    sql.prepare("UPDATE case_data_change_state SET data_version=5 WHERE case_id='synthetic-case'").run();
    sql.prepare("INSERT INTO cases VALUES ('other-case',7,'old','{}')").run();
    sql.prepare("INSERT INTO case_data_change_state VALUES ('other-case',4)").run();
    assert.equal(commit(sql,4),0);
    assert.equal(get(sql).token,"old");
  }finally {sql.close();}
});

test("version parameters reject missing, negative, fractional, and untrusted inputs", () => {
  assert.deepEqual(exportSourceVersionCASParams("synthetic-case",4),["synthetic-case",4]);
  for(const version of [-1,0.5,Number.NaN,Number.POSITIVE_INFINITY,Number.MAX_SAFE_INTEGER+1]) {
    assert.throws(()=>exportSourceVersionCASParams("synthetic-case",version),/EXPORT_SOURCE_VERSION_INVALID/);
  }
  assert.throws(()=>exportSourceVersionCASParams("",4),/EXPORT_SOURCE_VERSION_INVALID/);
});

test("baseline revision-only CAS reproduces stale-export acceptance (negative control)", () => {
  const sql=fixture();try {
    sql.prepare("UPDATE case_data_change_state SET data_version=5 WHERE case_id='synthetic-case'").run();
    const oldCAS=sql.prepare("UPDATE cases SET payload=?,storage_token=? WHERE id=? AND revision=? AND storage_token=?")
      .run('{"exportManifest":{"files":["stale"]}}',"new","synthetic-case",7,"old");
    assert.equal(oldCAS.changes,1,"old case-only CAS incorrectly accepts changed OCR source");
    assert.deepEqual(JSON.parse(get(sql).payload).exportManifest.files,["stale"]);
  }finally {sql.close();}
});
