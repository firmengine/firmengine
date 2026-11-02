import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,mkdtempSync,rmSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {tmpdir} from "node:os";
import {join} from "node:path";

// The tested CAS fragment is extracted directly from the production
// saveCase() implementation; this is not a live D1, HTTP or R2 test.
const source=readFileSync(new URL("../lib/server-store.ts",import.meta.url),"utf8");
const begin=source.indexOf("const headGuard=expectedHeads?(");
const end=source.indexOf("const batch:D1PreparedStatement[]=",begin);
assert.ok(begin>=0&&end>begin,"staff head CAS source fragment missing");
const compile=new Function("expectedHeads","data","expected",
  source.slice(begin,end)+"\nreturn {headGuard,headParams};");

const A="a".repeat(64),B="b".repeat(64);
const original={
 dataVersion:7,calculationRunId:"calc-A",legalReviewRunId:"legal-A",
 referenceSha256:A,referenceId:"ref-A1",referenceRevision:10
};
function fixture(){
 const folder=mkdtempSync(join(tmpdir(),"a4-staff-cas-"));
 const file=join(folder,"test.sqlite");
 const a=new DatabaseSync(file),b=new DatabaseSync(file);
 for(const db of [a,b])db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=1000");
 a.exec(`CREATE TABLE cases(id TEXT PRIMARY KEY,revision INTEGER,storage_token TEXT);
 CREATE TABLE case_data_change_state(case_id TEXT PRIMARY KEY,data_version INTEGER);
 CREATE TABLE case_calculation_runs(id TEXT PRIMARY KEY,reference_sha256 TEXT);
 CREATE TABLE case_calculation_heads(case_id TEXT PRIMARY KEY,run_id TEXT,data_version INTEGER,case_revision INTEGER);
 CREATE TABLE case_legal_review_heads(case_id TEXT PRIMARY KEY,review_run_id TEXT,data_version INTEGER,case_revision INTEGER,calculation_run_id TEXT);
 CREATE TABLE legal_reference_releases(id TEXT PRIMARY KEY,revision INTEGER,sha256 TEXT,status TEXT);
 INSERT INTO cases VALUES('case-A',3,'token-A');
 INSERT INTO case_data_change_state VALUES('case-A',7);
 INSERT INTO case_calculation_runs VALUES('calc-A','${A}');
 INSERT INTO case_calculation_heads VALUES('case-A','calc-A',7,3);
 INSERT INTO case_legal_review_heads VALUES('case-A','legal-A',7,3,'calc-A');
 INSERT INTO legal_reference_releases VALUES('ref-A1',10,'${A}','active');`);
 return {a,b,close(){a.close();b.close();rmSync(folder,{recursive:true,force:true})}};
}
function switchRelease(db,id,revision,sha){
 db.exec("BEGIN IMMEDIATE");
 try{db.prepare("UPDATE legal_reference_releases SET status='superseded' WHERE status='active'").run();
     db.prepare("INSERT INTO legal_reference_releases VALUES(?,?,?,'active')").run(id,revision,sha);
     db.exec("COMMIT");}
 catch(error){db.exec("ROLLBACK");throw error;}
}
function commit(db,expectedHeads=original){
 const {headGuard,headParams}=compile(expectedHeads,{context:{id:"case-A"}},3);
 // This SQL exercises the real headGuard text/bind ordering in isolation.
 return db.prepare("UPDATE cases SET storage_token='token-new' WHERE id=? AND revision=? AND storage_token=?"+headGuard)
  .run("case-A",3,"token-A",...headParams).changes;
}
function scenario(label,change,want){
 test(label,()=>{
  const f=fixture();
  try{
   change?.(f);
   assert.equal(commit(f.a),want);
   assert.equal(f.a.prepare("SELECT storage_token FROM cases WHERE id='case-A'").get().storage_token,
    want?"token-new":label.includes("token changed")?"token-B":"token-A");
  }finally{f.close()}
 });
}
test("extracted source guard contains active identity epoch comparison",()=>{
 const sql=compile(original,{context:{id:"case-A"}},3).headGuard;
 assert.match(sql,/legal_reference_releases/);
 assert.match(sql,/ar\.id=\?/);assert.match(sql,/ar\.revision=\?/);
 assert.match(sql,/ar\.sha256=\?/);
});
scenario("healthy reference epoch allows CAS",null,1);
scenario("A->B approval invalidates paused staff writer",f=>switchRelease(f.b,"ref-B",11,B),0);
scenario("A->B->A restores SHA but not old approval identity",f=>{switchRelease(f.b,"ref-B",11,B);switchRelease(f.b,"ref-A3",12,A)},0);
scenario("same hash different approval ID also invalidates",f=>switchRelease(f.b,"ref-A2",11,A),0);
scenario("source version changed blocks CAS",f=>f.b.prepare("UPDATE case_data_change_state SET data_version=8").run(),0);
scenario("calculation run changed blocks CAS",f=>f.b.prepare("UPDATE case_calculation_heads SET run_id='calc-B'").run(),0);
scenario("legal review changed blocks CAS",f=>f.b.prepare("UPDATE case_legal_review_heads SET review_run_id='legal-B'").run(),0);
scenario("other worker token changed blocks CAS",f=>f.b.prepare("UPDATE cases SET storage_token='token-B'").run(),0);
test("two sequential workers yield one CAS owner",()=>{
 const f=fixture();
 try{assert.equal(commit(f.a),1);assert.equal(commit(f.b),0)}finally{f.close()}
});
test("missing approval schema fails closed, not successful update",()=>{
 const f=fixture();
 try{f.b.exec("DROP TABLE legal_reference_releases");
     assert.throws(()=>commit(f.a),/no such table/);
     assert.equal(f.a.prepare("SELECT storage_token FROM cases").get().storage_token,"token-A")}
 finally{f.close()}
});
