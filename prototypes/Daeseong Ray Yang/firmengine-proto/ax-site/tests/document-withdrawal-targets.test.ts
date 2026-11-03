import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { documentWithdrawalStatements } from "../lib/document-withdrawal-targets.ts";

test("a withdrawn parent also targets all descendants, not unrelated documents", () => {
  assert.deepEqual(documentWithdrawalStatements("parent",["parent","child","grandchild"],id=>id),
    ["parent","child","grandchild"]);
  assert.deepEqual(documentWithdrawalStatements("parent",["parent"],id=>id),["parent"]);
  assert.deepEqual(documentWithdrawalStatements("parent",["parent","child","parent"],id=>id),["parent","child"]);
});

test("unproved or malformed withdrawal targets never create partial statements", () => {
  for (const affected of [undefined,[],["child"],["parent",null],["parent"," "]]) {
    let prepared=0;
    assert.throws(()=>documentWithdrawalStatements("parent",affected,()=>{prepared++;return true;}),
      /DOCUMENT_WITHDRAWAL_TARGETS_INVALID/);
    assert.equal(prepared,0);
  }
  assert.throws(()=>documentWithdrawalStatements("",[""],id=>id),/DOCUMENT_WITHDRAWAL_TARGETS_INVALID/);
});

test("SQLite CAS updates parent and descendant jobs without touching unrelated or stale-case jobs", () => {
  const sqlite=new DatabaseSync(":memory:");
  try {
    sqlite.exec("CREATE TABLE cases(id TEXT PRIMARY KEY,revision INTEGER,storage_token TEXT); CREATE TABLE page_jobs(id TEXT PRIMARY KEY,case_id TEXT,document_id TEXT,status TEXT,lease_until TEXT);");
    sqlite.prepare("INSERT INTO cases VALUES(?,?,?)").run("case-a",2,"token-2");
    const insert=sqlite.prepare("INSERT INTO page_jobs VALUES(?,?,?,?,?)");
    for (const [id,doc] of [["job-parent","parent"],["job-child","child"],["job-grandchild","grandchild"],["job-unrelated","unrelated"]])
      insert.run(id,"case-a",doc,"processing","lease");
    const update=sqlite.prepare("UPDATE page_jobs SET status='withdrawn',lease_until=NULL WHERE case_id=? AND document_id=? AND EXISTS (SELECT 1 FROM cases WHERE id=? AND revision=? AND storage_token=?)");
    const targets=documentWithdrawalStatements("parent",["parent","child","grandchild"],documentId=>documentId);
    for(const documentId of targets)update.run("case-a",documentId,"case-a",2,"token-2");
    const rows=sqlite.prepare("SELECT document_id,status,lease_until FROM page_jobs ORDER BY document_id").all() as {document_id:string;status:string;lease_until:string|null}[];
    assert.deepEqual(rows.map(row=>[row.document_id,row.status,row.lease_until]),[
      ["child","withdrawn",null],["grandchild","withdrawn",null],["parent","withdrawn",null],["unrelated","processing","lease"]
    ]);
    update.run("case-a","unrelated","case-a",1,"stale-token");
    assert.equal((sqlite.prepare("SELECT status FROM page_jobs WHERE document_id='unrelated'").get() as {status:string}).status,"processing");
  } finally { sqlite.close(); }
});
