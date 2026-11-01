import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync, mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {DatabaseSync} from "node:sqlite";

// Source-extracted local V8 contract: we execute the actual release block, not a
// hand-written copy of its acknowledgement branching. NOT a staging D1 test.
const source=readFileSync(new URL("../lib/case-data-recompute.ts",import.meta.url),"utf8");
const start=source.indexOf("     let cleanupChanges:unknown;");
const end=source.indexOf("     results.push(value);",start);
assert.ok(start>=0&&end>start,"calculation poll cleanup guard must exist");
const snippet=source.slice(start,end+"     results.push(value);".length)
  .replace("let cleanupChanges:unknown","let cleanupChanges").replaceAll(" as const","");
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const execute=new AsyncFunction("database","row","lease","results","value",
  "for(let _once=0;_once<1;_once++){"+snippet+"}");

for(const [label,ack,expected] of [
  ["exactly one row",1,"computed"],
  ["lost ownership / zero rows",0,"superseded"],
  ["null receipt",null,"cleanup_unobserved"],
  ["missing changes",undefined,"cleanup_unobserved"],
  ["two rows",2,"cleanup_unobserved"],
  ["negative changes",-1,"cleanup_unobserved"],
  ["string one","1","cleanup_unobserved"],
  ["D1 503","throw","cleanup_unobserved"],
]){
  test("actual calculation cleanup block: "+label,async()=>{
    const results=[];let calls=0;
    const database={prepare(sql){
      assert.equal(sql,"DELETE FROM case_calculation_poll_jobs WHERE case_id=? AND lease_token=?");
      return {bind(caseId,token){
        assert.equal(caseId,"synthetic-case");assert.equal(token,"worker-A");
        return {async run(){calls++;if(ack==="throw")throw new Error("D1_503");return {meta:{changes:ack}};}};
      }};
    }};
    await execute(database,{caseId:"synthetic-case",dataVersion:7},"worker-A",results,
      {caseId:"synthetic-case",dataVersion:7,status:"computed"});
    assert.equal(calls,1);assert.equal(results.length,1);assert.equal(results[0].status,expected);
    if(expected==="cleanup_unobserved")assert.equal(results[0].error,"CASE_CALCULATION_POLL_RELEASE_ACK_UNOBSERVED");
  });
}

test("real SQLite WAL two connections: stale A DELETE cannot remove B lease",()=>{
  const dir=mkdtempSync(join(tmpdir(),"a4-r48-")),dbPath=join(dir,"lease.sqlite");
  let a,b;
  try{
    a=new DatabaseSync(dbPath);b=new DatabaseSync(dbPath);
    for(const db of [a,b])db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=2000;");
    a.exec("CREATE TABLE case_calculation_poll_jobs(case_id TEXT PRIMARY KEY,lease_token TEXT,status TEXT)");
    a.prepare("INSERT INTO case_calculation_poll_jobs VALUES(?,?,?)").run("synthetic-case","worker-A","running");
    b.prepare("UPDATE case_calculation_poll_jobs SET lease_token=? WHERE case_id=?")
      .run("worker-B","synthetic-case");
    const result=a.prepare("DELETE FROM case_calculation_poll_jobs WHERE case_id=? AND lease_token=?")
      .run("synthetic-case","worker-A");
    assert.equal(Number(result.changes),0);
    const persisted=b.prepare("SELECT lease_token AS token FROM case_calculation_poll_jobs WHERE case_id=?")
      .get("synthetic-case");
    assert.equal(persisted?.token,"worker-B");
  }finally{a?.close();b?.close();rmSync(dir,{recursive:true,force:true});}
});
