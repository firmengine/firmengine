/** A4 r92 regression candidate: SQLite WAL is NOT staging D1/R2.
 * All cases, SHA values, and object keys are synthetic.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync,rmSync,readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const baseSql="UPDATE documents SET original_key = ?,ready = 1 WHERE id = ? AND case_id = ? AND ready = 0 AND sha256 = ?";
const fencedSql=baseSql+" AND EXISTS (SELECT 1 FROM cases c WHERE c.id = documents.case_id AND c.revision = ? AND c.storage_token = ?)";
const sha="a".repeat(64),key="cases/SYNTH-C/documents/DOC-A/original/synthetic";
function withTwoWorkers(callback,{pointer=false}={}){
  const dir=mkdtempSync(join(tmpdir(),"a4-r92-")),path=join(dir,"data.sqlite");
  const a=new DatabaseSync(path),b=new DatabaseSync(path);
  try{
    for(const db of [a,b])db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=1000;");
    a.exec("CREATE TABLE cases(id TEXT PRIMARY KEY,revision INTEGER,storage_token TEXT,payload TEXT);CREATE TABLE documents(id TEXT PRIMARY KEY,case_id TEXT,sha256 TEXT,original_key TEXT,ready INTEGER);CREATE TABLE page_jobs(id TEXT PRIMARY KEY,case_id TEXT,document_id TEXT,status TEXT);");
    const payload=pointer?{_storage:"r2-case-v1",caseId:"SYNTH-C",revision:1,key:"cases/SYNTH-C/state/a.json",sha256:sha,summary:{documents:1,facts:0,status:"needs_evidence"}}:{context:{id:"SYNTH-C",revision:1},documents:[{id:"DOC-A",status:"active"}]};
    a.prepare("INSERT INTO cases VALUES(?,?,?,?)").run("SYNTH-C",1,"TOKEN-1",JSON.stringify(payload));
    a.prepare("INSERT INTO documents VALUES(?,?,?,?,?)").run("DOC-A","SYNTH-C",sha,null,0);
    a.prepare("INSERT INTO page_jobs VALUES(?,?,?,?)").run("DOC-A:1","SYNTH-C","DOC-A","awaiting_upload");
    const snapshot=()=>a.prepare("SELECT revision,storage_token FROM cases WHERE id='SYNTH-C'").get();
    const commit=(db,snap,guard=true)=>db.prepare(guard?fencedSql:baseSql).run(...(guard?[key,"DOC-A","SYNTH-C",sha,snap.revision,snap.storage_token]:[key,"DOC-A","SYNTH-C",sha])).changes;
    const write=(rev,token,withdrawn=false)=>{b.exec("BEGIN IMMEDIATE");try{
      const row=b.prepare("SELECT payload FROM cases WHERE id='SYNTH-C'").get(),p=JSON.parse(row.payload);
      if(!pointer){p.context.revision=rev;if(withdrawn)p.documents[0].status="deleted";}
      b.prepare("UPDATE cases SET revision=?,storage_token=?,payload=? WHERE id='SYNTH-C'").run(rev,token,JSON.stringify(p));
      if(withdrawn)b.prepare("UPDATE page_jobs SET status='withdrawn' WHERE document_id='DOC-A'").run();
      b.exec("COMMIT");
    }catch(error){b.exec("ROLLBACK");throw error;}};
    return callback({a,b,snapshot,commit,write});
  }finally{a.close();b.close();rmSync(dir,{recursive:true,force:true});}
}
test("route and exported snapshot identity contain final SQL epoch guard",()=>{
  const route=readFileSync(new URL("../app/api/cases/[id]/documents/[doc]/route.ts",import.meta.url),"utf8");
  const server=readFileSync(new URL("../lib/server-store.ts",import.meta.url),"utf8");
  assert.ok(route.includes(fencedSql));
  assert.ok(route.includes("bind(key,doc,id,r.sha256,r.sourceRevision,r.sourceToken).run()"));
  assert.ok(route.includes("c.revision=? AND c.storage_token=? WHERE d.id = ?"));
  assert.ok(server.includes("export function caseSnapshotIdentity("));
  assert.ok(server.includes("caseSnapshots.get(data)"));
});
test("normal original pointer commit survives source-epoch guard",()=>withTwoWorkers(({a,snapshot,commit})=>{
  assert.equal(commit(a,snapshot()),1);
}));
test("old baseline wrongly accepts the document after withdrawal",()=>withTwoWorkers(({a,snapshot,commit,write})=>{
  const old=snapshot();write(2,"TOKEN-2",true);assert.equal(commit(a,old,false),1);
}));
test("new final CAS rejects the document after withdrawal",()=>withTwoWorkers(({a,snapshot,commit,write})=>{
  const old=snapshot();write(2,"TOKEN-2",true);assert.equal(commit(a,old),0);
}));
test("review-only token change at same revision rejects old upload",()=>withTwoWorkers(({a,snapshot,commit,write})=>{
  const old=snapshot();write(1,"TOKEN-2",false);assert.equal(commit(a,old),0);
}));
test("unrelated case revision change is conservatively rejected",()=>withTwoWorkers(({a,snapshot,commit,write})=>{
  const old=snapshot();write(2,"TOKEN-2",false);assert.equal(commit(a,old),0);
}));
test("two independent workers cannot both claim ready=0",()=>withTwoWorkers(({a,b,snapshot,commit})=>{
  const same=snapshot();assert.equal(commit(a,same),1);assert.equal(commit(b,same),0);
}));
test("R2-backed large-case payload is guarded without JSON document-list SQL",()=>withTwoWorkers(({a,snapshot,commit})=>{
  assert.equal(commit(a,snapshot()),1);
},{pointer:true}));
