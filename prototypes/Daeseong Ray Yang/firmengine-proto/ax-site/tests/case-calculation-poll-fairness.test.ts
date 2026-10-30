import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync,type SQLInputValue} from "node:sqlite";
import {readFileSync,readdirSync} from "node:fs";
import {drainCaseDataUpdates,caseCalculationPollHealth,retryFailedCaseCalculationPoll} from "../lib/case-data-recompute.ts";

const NOW=Date.parse("2026-10-30T12:00:00.000Z");
function fixture(){
 const sqlite=new DatabaseSync(":memory:");
 sqlite.exec("PRAGMA foreign_keys=ON");
 const dir=new URL("../drizzle/",import.meta.url);
 for(const name of readdirSync(dir).filter(n=>/^\d{4}.*\.sql$/.test(n)).sort())
   sqlite.exec(readFileSync(new URL(name,dir),"utf8"));
 for(const id of ["due-a","due-b","not-due"]){
  sqlite.prepare("INSERT INTO cases(id,name,owner,revision,payload,created_at,updated_at,storage_token) VALUES(?,?, 'owner',1,'{}','at','at','token')").run(id,id);
  sqlite.prepare("UPDATE case_data_change_state SET last_changed_at=? WHERE case_id=?")
   .run(id==="not-due"?"2026-10-30T11:55:00.000Z":"2026-10-30T11:40:00.000Z",id);
 }
 const database={prepare(sql:string){let values:SQLInputValue[]=[];const s={
  bind(...args:SQLInputValue[]){values=args;return s;},
  async first<T>(){return sqlite.prepare(sql).get(...values) as T??null;},
  async all<T>(){return {results:sqlite.prepare(sql).all(...values) as T[]};},
  async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};}
 };return s;}} as unknown as D1Database;
 const calls:string[]=[];
 const poll=(caseId?:string)=>drainCaseDataUpdates(database,{caseId,limit:1,now:()=>NOW,
  loadCase:async id=>{calls.push(id);throw new Error("CALCULATION_SYNTHETIC_FAILURE");}});
 return {sqlite,database,calls,poll,close:()=>sqlite.close()};
}
test("a not-yet-quiet case cannot consume one Cron scan slot ahead of due cases",async()=>{
 const f=fixture();try{
  const a=await f.poll();assert.equal(a.scanned,1);assert.equal(a.results[0].status,"retry_wait");assert.deepEqual(f.calls,["due-a"]);
  const b=await f.poll();assert.equal(b.scanned,1);assert.equal(b.results[0].status,"retry_wait");assert.deepEqual(f.calls,["due-a","due-b"]);
  const none=await f.poll();assert.equal(none.scanned,0);assert.equal(f.calls.length,2);
  assert.equal((await caseCalculationPollHealth(f.database,"due-a")).attempts,1);
  assert.equal((await caseCalculationPollHealth(f.database,"not-due")).status,"no_poll_error");
  assert.deepEqual(f.sqlite.prepare("PRAGMA foreign_key_check").all(),[]);
 }finally{f.close();}
});
test("a repeated failure stops after five attempts, without starving other cases",async()=>{
 const f=fixture();try{
  await f.poll("due-a");
  for(let n=2;n<=5;n++){
   f.sqlite.prepare("UPDATE case_calculation_poll_jobs SET next_attempt_at='2000-01-01T00:00:00Z' WHERE case_id='due-a'").run();
   const state=await f.poll("due-a");
   assert.equal(state.scanned,1);
   assert.equal(state.results[0].status,n===5?"failed":"retry_wait");
  }
  const blocked=await f.poll("due-a");assert.equal(blocked.scanned,0);
  const other=await f.poll();assert.equal(other.results[0].caseId,"due-b");
  const status=await caseCalculationPollHealth(f.database,"due-a");
  assert.equal(status.status,"failed");assert.equal(status.attempts,5);
  assert.equal(status.errorCode,"CALCULATION_SYNTHETIC_FAILURE");
 }finally{f.close();}
});
test("a new source version clears an old failed case cooldown and resets attempts",async()=>{
 const f=fixture();try{
  await f.poll("due-a");
  f.sqlite.prepare("UPDATE case_calculation_poll_jobs SET status='failed',attempts=5,next_attempt_at=NULL WHERE case_id='due-a'").run();
  assert.equal((await f.poll("due-a")).scanned,0);
  f.sqlite.prepare("UPDATE case_data_change_state SET data_version=data_version+1 WHERE case_id='due-a'").run();
  const fresh=await f.poll("due-a");
  assert.equal(fresh.scanned,1);assert.equal(fresh.results[0].status,"retry_wait");
  assert.equal((await caseCalculationPollHealth(f.database,"due-a")).attempts,1);
 }finally{f.close();}
});
test("two schedulers cannot claim one case/version at the same instant",async()=>{
 const f=fixture();try{
  const tasks=await Promise.all([f.poll("due-a"),f.poll("due-a")]);
  assert.equal(f.calls.filter(id=>id==="due-a").length,1);
  assert.equal(tasks.reduce((count,t)=>count+t.results.filter(r=>r.status==="retry_wait").length,0),1);
 }finally{f.close();}
});

test("staff may recover a current failed calculation case without changing source version",async()=>{
 const f=fixture();try{
  await f.poll("due-a");
  f.sqlite.prepare("UPDATE case_calculation_poll_jobs SET status='failed',attempts=5,next_attempt_at=NULL WHERE case_id='due-a'").run();
  const before=f.sqlite.prepare("SELECT data_version AS version FROM case_data_change_state WHERE case_id='due-a'").get() as {version:number};
  const recovered=await retryFailedCaseCalculationPoll(f.database,{caseId:"due-a",expectedDataVersion:before.version});
  assert.equal(recovered.status,"retry_wait");
  assert.equal((await caseCalculationPollHealth(f.database,"due-a")).attempts,0);
  assert.equal((f.sqlite.prepare("SELECT data_version AS version FROM case_data_change_state WHERE case_id='due-a'").get() as {version:number}).version,before.version);
  await assert.rejects(retryFailedCaseCalculationPoll(f.database,{caseId:"due-a",expectedDataVersion:before.version}),/CASE_CALCULATION_POLL_NO_CURRENT_FAILED_JOB/);
  await assert.rejects(retryFailedCaseCalculationPoll(f.database,{caseId:"due-a",expectedDataVersion:before.version+1}),/CASE_CALCULATION_POLL_RETRY_STALE_SOURCE/);
 }finally{f.close();}
});
