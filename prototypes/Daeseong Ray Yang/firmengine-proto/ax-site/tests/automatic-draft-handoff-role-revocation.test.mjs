/** A4 r80 source-bound authorization race regression, synthetic only.
 * Run with Node 22 --experimental-strip-types --test. Never exercises D1/R2.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {HANDOFF_ROLE_GUARD_SQL,handoffRoleGuardParams} from "../lib/automatic-draft-role-guard.ts";
const handoff=readFileSync(new URL("../lib/automatic-draft-handoff.ts",import.meta.url),"utf8");
const store=readFileSync(new URL("../lib/server-store.ts",import.meta.url),"utf8");
const at="2026-11-02T11:00:00.000Z";
test("handoff route uses commit-time actor fence, not only preflight role check",()=>{
 assert.match(handoff,/mutationCategory:"artifact_only",handoffActor:input.actor/);
 assert.match(store,/if\(options\?\.expectedHeads&&\(!options\.handoffActor\?\.trim\(\)/);
 assert.match(store,/\+headGuard\+roleGuard\)\.bind/);
 assert.match(store,/\.\.\.headParams,\.\.\.roleParams/);
 assert.equal((HANDOFF_ROLE_GUARD_SQL.match(/app_role_grants/g)||[]).length,2);
 assert.equal(handoffRoleGuardParams("syn-actor","syn-case").length,6);
});
function fixture(){
 const db=new DatabaseSync(":memory:");
 db.exec("CREATE TABLE cases(id TEXT PRIMARY KEY,storage_token TEXT);"+
  "CREATE TABLE app_role_grants(actor_id TEXT,role TEXT,scope_id TEXT,status TEXT,effective_from TEXT,effective_to TEXT,PRIMARY KEY(actor_id,role,scope_id));"+
  "INSERT INTO cases VALUES('syn-case','before');"+
  "INSERT INTO app_role_grants VALUES('syn-actor','case_editor','syn-case','active','2026-11-01T00:00:00.000Z',NULL);"+
  "INSERT INTO app_role_grants VALUES('syn-actor','caseworker_review','syn-case','active','2026-11-01T00:00:00.000Z',NULL)");
 return db;
}
const baseline="UPDATE cases SET storage_token='after' WHERE id='syn-case' AND storage_token='before'";
function update(db,guarded=true){
 const sql=baseline+(guarded?HANDOFF_ROLE_GUARD_SQL:"");
 return db.prepare(sql).run(...(guarded?handoffRoleGuardParams("syn-actor","syn-case"):[])).changes;
}
test("normal two active scoped grants permit one CAS, not lawyer approval",()=>{
 const d=fixture();try{assert.equal(update(d),1);assert.equal(update(d),0);}finally{d.close()}
});
test("revoked caseworker grant cannot win even when main CAS would",()=>{
 const a=fixture(),b=fixture();try{
  for(const d of [a,b])d.exec("UPDATE app_role_grants SET status='revoked' WHERE role='caseworker_review'");
  assert.equal(update(a,false),1);assert.equal(update(b,true),0);
 }finally{a.close();b.close()}
});
test("revoked editor grant cannot win even when main CAS would",()=>{
 const a=fixture(),b=fixture();try{
  for(const d of [a,b])d.exec("UPDATE app_role_grants SET status='revoked' WHERE role='case_editor'");
  assert.equal(update(a,false),1);assert.equal(update(b,true),0);
 }finally{a.close();b.close()}
});
test("a wildcard role grant remains valid under scoped role authorization",()=>{
 const d=fixture();try{d.exec("UPDATE app_role_grants SET scope_id='*' WHERE role='caseworker_review'");assert.equal(update(d),1);}finally{d.close()}
});
test("wrong case / expired review grants are not active",()=>{
 for(const sql of [
  "UPDATE app_role_grants SET scope_id='other-case' WHERE role='caseworker_review'",
  "UPDATE app_role_grants SET effective_to='2026-11-02T10:59:59.000Z' WHERE role='caseworker_review'",
  "UPDATE app_role_grants SET effective_from='2099-01-01T00:00:00.000Z' WHERE role='caseworker_review'"
 ]){
  const d=fixture();try{d.exec(sql);assert.equal(update(d),0);}finally{d.close()}
 }
});
test("DB clock rejects grant expired during pre-commit I/O (cached JS time is not an authorization epoch)",()=>{
 const d=fixture();try{
  const before=new Date(Date.now()-60_000).toISOString();
  const expired=new Date(Date.now()-30_000).toISOString();
  assert.ok(before<expired);
  d.prepare("UPDATE app_role_grants SET effective_to=? WHERE role='caseworker_review'").run(expired);
  assert.equal(update(d),0);
 }finally{d.close()}
});
test("rejects service fallback and empty actor before SQL",()=>{
 assert.throws(()=>handoffRoleGuardParams("private-site-service","syn-case"),/ACTOR_REQUIRED/);
 assert.throws(()=>handoffRoleGuardParams("","syn-case"),/ACTOR_REQUIRED/);
});
