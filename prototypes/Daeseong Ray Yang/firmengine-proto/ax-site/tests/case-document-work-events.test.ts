import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readdirSync,readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

test("page receipt / OCR progress has a separate monotone cursor and does not reset calculation quiet time",()=>{
  const root=fileURLToPath(new URL("../",import.meta.url));
  const sqlite=new DatabaseSync(":memory:");
  try{
    for(const file of readdirSync(root+"drizzle").filter(n=>n.endsWith(".sql")).sort())
      sqlite.exec(readFileSync(root+"drizzle/"+file,"utf8"));
    const at="2026-10-30T00:00:00.000Z",caseId="synthetic-case",documentId="synthetic-document";
    sqlite.prepare("INSERT INTO cases(id,name,owner,revision,storage_token,payload,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)")
      .run(caseId,"Synthetic","tester",1,"token-1",'{}',at,at);
    sqlite.prepare("INSERT INTO documents(id,case_id,name,sha256,page_count,ready,created_at) VALUES(?,?,?,?,?,?,?)")
      .run(documentId,caseId,"Synthetic file","a".repeat(64),1,0,at);
    sqlite.prepare("INSERT INTO page_jobs(id,case_id,document_id,page,role,status,stage,updated_at) VALUES(?,?,?,?,?,?,?,?)")
      .run("page-1",caseId,documentId,1,"evidence","pending","waiting",at);
    const before=(sqlite.prepare("SELECT data_version FROM case_data_change_state WHERE case_id=?").get(caseId) as {data_version:number}).data_version;
    sqlite.prepare("UPDATE page_jobs SET status='processing',stage='extract' WHERE id='page-1'").run();
    sqlite.prepare("UPDATE page_jobs SET status='completed',stage='completed' WHERE id='page-1'").run();
    const after=(sqlite.prepare("SELECT data_version FROM case_data_change_state WHERE case_id=?").get(caseId) as {data_version:number}).data_version;
    assert.equal(after,before,"Page state transitions cannot trigger unnecessary recalculation");
    const events=sqlite.prepare("SELECT id,event_kind,source_id,after_state FROM case_document_work_events WHERE case_id=? ORDER BY id").all(caseId) as Array<{id:number;event_kind:string;source_id:string;after_state:string}>;
    assert.deepEqual(events.map(e=>e.event_kind),["document_registered","page_job_created","page_job_changed","page_job_changed"]);
    assert.equal(events.at(-1)?.after_state,"completed:completed");
    assert.ok(events.every((e,i)=>i===0||e.id>events[i-1].id));
  }finally{sqlite.close();}
});
