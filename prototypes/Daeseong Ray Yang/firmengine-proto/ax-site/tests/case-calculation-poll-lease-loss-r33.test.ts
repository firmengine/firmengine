import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync,type SQLInputValue} from "node:sqlite";
import {readFileSync,readdirSync} from "node:fs";
import {drainCaseDataUpdates} from "../lib/case-data-recompute.ts";

// Public synthetic case only. This is a local SQLite contract test, NOT staging D1.
const NOW=Date.parse("2026-10-31T12:42:00.000Z");
const ID="lease-loss-synthetic";
function fixture(){
  const sqlite=new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  const migrations=new URL("../drizzle/",import.meta.url);
  for(const name of readdirSync(migrations).filter(n=>/^\d{4}.*\.sql$/.test(n)).sort())
    sqlite.exec(readFileSync(new URL(name,migrations),"utf8"));
  sqlite.prepare("INSERT INTO cases(id,name,owner,revision,payload,created_at,updated_at,storage_token) VALUES(?,?, 'owner',1,'{}','at','at','token')").run(ID,ID);
  sqlite.prepare("UPDATE case_data_change_state SET last_changed_at=? WHERE case_id=?")
    .run("2026-10-31T12:20:00.000Z",ID);
  const database={prepare(sql:string){
    let values:SQLInputValue[]=[];
    const stmt={
      bind(...args:SQLInputValue[]){values=args;return stmt;},
      async first<T>(){return (sqlite.prepare(sql).get(...values)??null) as T|null;},
      async all<T>(){return {results:sqlite.prepare(sql).all(...values) as T[]};},
      async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};}
    };
    return stmt;
  }} as unknown as D1Database;
  return {sqlite,database,close:()=>sqlite.close()};
}
test("lost calculation poll lease is reported as superseded, not a fake retry receipt",async()=>{
  const f=fixture();
  try{
    let signalStart:()=>void=()=>{};
    let rejectLoad:(err:Error)=>void=()=>{};
    const entered=new Promise<void>(resolve=>{signalStart=resolve;});
    const inFlight=drainCaseDataUpdates(f.database,{caseId:ID,limit:1,now:()=>NOW,
      loadCase:async()=>{signalStart();return new Promise<never>((_,reject)=>{rejectLoad=reject;});}});
    await entered;
    const held=f.sqlite.prepare("SELECT status,lease_token FROM case_calculation_poll_jobs WHERE case_id=?").get(ID) as {status:string;lease_token:string};
    assert.equal(held.status,"running");
    assert.ok(held.lease_token);
    f.sqlite.prepare("UPDATE case_calculation_poll_jobs SET lease_token=?,lease_until=? WHERE case_id=?")
      .run("replacement-worker-token","2026-10-31T12:50:00.000Z",ID);
    rejectLoad(new Error("CALCULATION_SYNTHETIC_FAILURE"));
    const result=await inFlight;
    assert.equal(result.scanned,1);
    assert.equal(result.results[0].status,"superseded");
    const remaining=f.sqlite.prepare("SELECT status,lease_token,last_error FROM case_calculation_poll_jobs WHERE case_id=?").get(ID) as {status:string;lease_token:string;last_error:string|null};
    assert.equal(remaining.status,"running");
    assert.equal(remaining.lease_token,"replacement-worker-token");
    assert.equal(remaining.last_error,null);
    assert.deepEqual(f.sqlite.prepare("PRAGMA foreign_key_check").all(),[]);
  }finally{f.close();}
});
test("current lease owner records retry_wait on an ordinary calculation failure",async()=>{
  const f=fixture();
  try{
    const result=await drainCaseDataUpdates(f.database,{caseId:ID,limit:1,now:()=>NOW,
      loadCase:async()=>{throw new Error("CALCULATION_SYNTHETIC_FAILURE");}});
    assert.equal(result.results[0].status,"retry_wait");
    const job=f.sqlite.prepare("SELECT status,attempts,last_error,lease_token FROM case_calculation_poll_jobs WHERE case_id=?").get(ID) as {status:string;attempts:number;last_error:string;lease_token:string|null};
    assert.equal(job.status,"retry_wait");
    assert.equal(job.attempts,1);
    assert.equal(job.last_error,"CALCULATION_SYNTHETIC_FAILURE");
    assert.equal(job.lease_token,null);
  }finally{f.close();}
});
test("current lease owner may still persist terminal failure at max attempts",async()=>{
  const f=fixture();
  try{
    const result=await drainCaseDataUpdates(f.database,{caseId:ID,limit:1,now:()=>NOW,
      loadCase:async()=>{
        f.sqlite.prepare("UPDATE case_calculation_poll_jobs SET attempts=5 WHERE case_id=?").run(ID);
        throw new Error("CALCULATION_SYNTHETIC_FAILURE");
      }});
    assert.equal(result.results[0].status,"failed");
    const job=f.sqlite.prepare("SELECT status,attempts,next_attempt_at,lease_token FROM case_calculation_poll_jobs WHERE case_id=?").get(ID) as {status:string;attempts:number;next_attempt_at:string|null;lease_token:string|null};
    assert.equal(job.status,"failed");
    assert.equal(job.attempts,5);
    assert.equal(job.next_attempt_at,null);
    assert.equal(job.lease_token,null);
  }finally{f.close();}
});
