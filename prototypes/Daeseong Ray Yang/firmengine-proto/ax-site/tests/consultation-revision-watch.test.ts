import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync,readdirSync} from "node:fs";

function fixture(){
 const sqlite=new DatabaseSync(":memory:");
 sqlite.exec("PRAGMA foreign_keys=ON");
 const dir=new URL("../drizzle/",import.meta.url);
 for(const name of readdirSync(dir).filter(n=>/^\d{4}.*\.sql$/.test(n)).sort())
  sqlite.exec(readFileSync(new URL(name,dir),"utf8"));
 sqlite.prepare("INSERT INTO cases(id,name,owner,revision,payload,storage_token,created_at,updated_at) VALUES('synthetic-intake','Synthetic','owner',1,'{}','token','at','at')").run();
 sqlite.prepare("INSERT INTO consultation_heads(case_id,revision,active_run_id,updated_at) VALUES('synthetic-intake',0,NULL,'at')").run();
 const state=()=>{
  const version=(sqlite.prepare("SELECT data_version AS version FROM case_data_change_state WHERE case_id='synthetic-intake'").get() as {version:number}).version;
  const events=(sqlite.prepare("SELECT event_kind AS kind FROM case_data_change_events WHERE case_id='synthetic-intake' ORDER BY id").all() as {kind:string}[]).map(e=>e.kind);
  return {version,events};
 };
 const run=()=>sqlite.prepare("INSERT INTO consultation_runs(id,case_id,fingerprint,case_revision,case_storage_token,consultation_revision,catalog_version,status,actor,created_at,updated_at) VALUES('run-1','synthetic-intake','hash',1,'token',0,1,'complete','staff','at','at')").run();
 return {sqlite,state,run,close:()=>sqlite.close()};
}
test("consultation edit with no active analysis is a source change, not an invisible no-op",()=>{
 const f=fixture();try{
  const before=f.state();
  f.sqlite.prepare("UPDATE consultation_heads SET revision=1,active_run_id=NULL WHERE case_id='synthetic-intake'").run();
  assert.equal(f.state().version,before.version+1);
  assert.equal(f.state().events.at(-1),"consultation_changed");
  const unchanged=f.state();
  f.sqlite.prepare("UPDATE consultation_heads SET revision=1 WHERE case_id='synthetic-intake'").run();
  assert.deepEqual(f.state(),unchanged);
 }finally{f.close();}
});
test("active consultation replaced by a new note creates exactly one notification",()=>{
 const f=fixture();try{
  f.run();
  f.sqlite.prepare("UPDATE consultation_heads SET active_run_id='run-1' WHERE case_id='synthetic-intake'").run();
  const before=f.state();
  f.sqlite.prepare("UPDATE consultation_heads SET revision=1,active_run_id=NULL WHERE case_id='synthetic-intake'").run();
  assert.equal(f.state().version,before.version+1);
  assert.equal(f.state().events.at(-1),"consultation_changed");
 }finally{f.close();}
});
test("activation/deactivation are correctly labeled; rollback discards pending event",()=>{
 const f=fixture();try{
  f.run();f.sqlite.prepare("UPDATE consultation_heads SET active_run_id='run-1' WHERE case_id='synthetic-intake'").run();
  assert.equal(f.state().events.at(-1),"requirements_activated");
  f.sqlite.prepare("UPDATE consultation_heads SET active_run_id=NULL WHERE case_id='synthetic-intake'").run();
  assert.equal(f.state().events.at(-1),"requirements_deactivated");
  const before=f.state();
  f.sqlite.exec("BEGIN");
  f.sqlite.prepare("UPDATE consultation_heads SET revision=1 WHERE case_id='synthetic-intake'").run();
  assert.equal(f.state().version,before.version+1);
  f.sqlite.exec("ROLLBACK");
  assert.deepEqual(f.state(),before);
  assert.deepEqual(f.sqlite.prepare("PRAGMA foreign_key_check").all(),[]);
 }finally{f.close();}
});
