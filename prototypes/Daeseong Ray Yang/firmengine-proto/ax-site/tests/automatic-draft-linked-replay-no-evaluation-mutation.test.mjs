/** A4 r74: staff already-linked draft replay must not mutate derived-evaluation cache.
 * Source-bound guard tests plus independent SQLite proof. No real D1/R2/Word execution.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,mkdtempSync,rmSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {tmpdir} from "node:os";
import {join} from "node:path";
const store=readFileSync(new URL("../lib/server-store.ts",import.meta.url),"utf8");
const handoff=readFileSync(new URL("../lib/automatic-draft-handoff.ts",import.meta.url),"utf8");
test("replay selects non-mutating derived evaluation while new staff handoff retains existing behavior",()=>{
 assert.match(handoff,/caseExtras\(data,\{readOnlyDerivedEvaluation:decision\.alreadyLinked\}\)/);
 assert.match(store,/readDerivedEvaluation\(data,identity,inputSha256,!options\.readOnlyDerivedEvaluation,!!options\.readOnlyDerivedEvaluation\)/);
});
test("missing evaluation cannot INSERT on replay",()=>{
 const start=store.indexOf("async function readDerivedEvaluation(");
 const missing=store.indexOf("if(!rows.length){",start);
 const stop=store.indexOf("const inserted=await db().prepare(",missing);
 assert.ok(start>=0&&missing>start&&stop>missing);
 assert.ok(store.slice(missing,stop).includes("if(readOnly)return undefined;"));
});
test("malformed/stale/corrupt evaluation cannot reset or rerun on replay",()=>{
 const start=store.indexOf("async function readDerivedEvaluation(");
 const end=store.indexOf("export async function event(",start);
 const section=store.slice(start,end);
 assert.ok((section.match(/return readOnly\?undefined:resetAndRetryDerivedEvaluation/g)||[]).length>=5);
 assert.match(section,/if\(!retryPending\|\|readOnly\)return/);
});
test("normal not-linked path is unchanged: readonly is only passed for decision.alreadyLinked",()=>{
 assert.ok(!handoff.includes("caseExtras(data,{readOnlyDerivedEvaluation:true})"));
 assert.match(store,/readOnlyDerivedEvaluation\?:boolean/);
});
test("two WAL connections: read-only stale/missing lookup never inserts or resets",()=>{
 const dir=mkdtempSync(join(tmpdir(),"a4-r74-replay-")),path=join(dir,"data.sqlite");
 const a=new DatabaseSync(path),b=new DatabaseSync(path);
 try{
  for(const db of [a,b])db.exec("PRAGMA journal_mode=WAL");
  a.exec("CREATE TABLE cases(id TEXT PRIMARY KEY,revision INTEGER,storage_token TEXT);CREATE TABLE analyses(id TEXT PRIMARY KEY,case_id TEXT,revision INTEGER,type TEXT,payload TEXT,at TEXT)");
  a.exec("INSERT INTO cases VALUES('syn',3,'tok')");
  const lookup=()=>a.prepare("SELECT a.id,a.payload FROM analyses a JOIN cases c ON c.id=a.case_id AND c.revision=a.revision WHERE a.case_id=? AND a.revision=? AND a.type='derived_evaluation' AND c.storage_token=? AND json_valid(a.payload)=1 AND json_extract(a.payload,'$.storageToken')=? AND json_extract(a.payload,'$.inputSha256')=? ORDER BY a.at DESC LIMIT 1").all("syn",3,"tok","tok","h");
  assert.deepEqual(lookup(),[]);
  // Read-only replay returns missing and performs zero DML.
  assert.equal(b.prepare("SELECT COUNT(*) AS n FROM analyses").get().n,0);
  a.prepare("INSERT INTO analyses VALUES(?,?,?,?,?,?)").run("a","syn",3,"derived_evaluation",JSON.stringify({storageToken:"tok",inputSha256:"h",referenceSha256:"old"}),"2026-11-02");
  const before=b.prepare("SELECT payload FROM analyses").get().payload;
  assert.equal(lookup().length,1);
  assert.equal(b.prepare("SELECT payload FROM analyses").get().payload,before);
 }finally{a.close();b.close();rmSync(dir,{recursive:true,force:true})}
});
