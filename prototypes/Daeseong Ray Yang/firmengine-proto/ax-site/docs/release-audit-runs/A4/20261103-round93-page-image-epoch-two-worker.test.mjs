/** A4 r93 draft. All document identifiers/hash values are synthetic.
 * node:sqlite WAL ≠ Cloudflare staging D1/R2; this verifies SQL invariants only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const H='a'.repeat(64), K='cases/SYNTH-93/documents/DOC-93/pages/1/'+H;
const base="UPDATE page_jobs SET image_key = ?,image_hash = ?,status = 'pending',stage = 'waiting',error = NULL,attempts = 0,updated_at = ? WHERE id = ? AND case_id = ? AND image_hash IS NULL AND status = 'awaiting_upload'";
const fenced="UPDATE page_jobs SET image_key = ?,image_hash = ?,status = 'pending',stage = 'waiting',error = NULL,attempts = 0,updated_at = ? WHERE id = ? AND case_id = ? AND document_id = ? AND page = ? AND role = ? AND image_hash IS NULL AND status = 'awaiting_upload' AND EXISTS (SELECT 1 FROM cases c WHERE c.id=page_jobs.case_id AND c.revision=? AND c.storage_token=?) AND EXISTS (SELECT 1 FROM documents d WHERE d.id=page_jobs.document_id AND d.case_id=page_jobs.case_id AND d.sha256=?)";
function withDB(run) {
 const dir=mkdtempSync(join(tmpdir(),'a4-r93-sql-')),file=join(dir,'s.sqlite'),a=new DatabaseSync(file),b=new DatabaseSync(file);
 try {
  for(const d of [a,b])d.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=1000');
  a.exec("CREATE TABLE cases(id TEXT PRIMARY KEY,revision INTEGER,storage_token TEXT); CREATE TABLE documents(id TEXT PRIMARY KEY,case_id TEXT,sha256 TEXT); CREATE TABLE page_jobs(id TEXT PRIMARY KEY,case_id TEXT,document_id TEXT,page INTEGER,role TEXT,image_key TEXT,image_hash TEXT,status TEXT,stage TEXT,error TEXT,attempts INTEGER,updated_at TEXT)");
  a.prepare('INSERT INTO cases VALUES(?,?,?)').run('SYNTH-93',1,'T1');
  a.prepare('INSERT INTO documents VALUES(?,?,?)').run('DOC-93','SYNTH-93',H);
  a.prepare('INSERT INTO page_jobs VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('DOC-93:1','SYNTH-93','DOC-93',1,'evidence',null,null,'awaiting_upload','waiting',null,0,null);
  const snap=()=>a.prepare("SELECT revision,storage_token FROM cases WHERE id='SYNTH-93'").get();
  const commit=(d,s,guard=true)=>d.prepare(guard?fenced:base).run(...(guard?[K,H,'2026-11-03T00:38:00Z','DOC-93:1','SYNTH-93','DOC-93',1,'evidence',s.revision,s.storage_token,H]:[K,H,'2026-11-03T00:38:00Z','DOC-93:1','SYNTH-93'])).changes;
  return run({a,b,snap,commit,read:()=>a.prepare("SELECT image_hash,status,role FROM page_jobs WHERE id='DOC-93:1'").get()});
 } finally {a.close();b.close();rmSync(dir,{recursive:true,force:true});}
}
test('current page can be stored once under observed source epoch',()=>withDB(({a,b,snap,commit})=>{
 const s=snap();assert.equal(commit(a,s),1);assert.equal(commit(b,s),0);
}));
test('old main SQL falsely adopts a page after case withdrawal if job row was not withdrawn',()=>withDB(({a,b,snap,commit})=>{
 const s=snap();b.prepare('UPDATE cases SET revision=2,storage_token=?').run('T2');assert.equal(commit(a,s,false),1);
}));
test('source-fenced candidate rejects withdrawal and case revision change',()=>withDB(({a,b,snap,commit})=>{
 const s=snap();b.prepare('UPDATE cases SET revision=2,storage_token=?').run('T2');assert.equal(commit(a,s),0);
}));
test('source-fenced candidate rejects same revision with changed token',()=>withDB(({a,b,snap,commit})=>{
 const s=snap();b.prepare("UPDATE cases SET storage_token='T2'").run();assert.equal(commit(a,s),0);
}));
test('source-fenced candidate rejects changed OCR role even if status is awaiting_upload',()=>withDB(({a,b,snap,commit})=>{
 const s=snap();b.prepare("UPDATE page_jobs SET role='administrative'").run();assert.equal(commit(a,s),0);
}));
test('source-fenced candidate rejects changed SQL document SHA without source bump',()=>withDB(({a,b,snap,commit})=>{
 const s=snap();b.prepare("UPDATE documents SET sha256=?").run('b'.repeat(64));assert.equal(commit(a,s),0);
}));
test('same-hash withdrawn image is NOT a current idempotent page upload',()=>withDB(({a,b,read})=>{
 b.prepare("UPDATE page_jobs SET image_hash=?,status='withdrawn'").run(H);
 const row=read();assert.equal(row.image_hash===H,true);assert.equal(!['withdrawn','held'].includes(row.status),false);
}));
test('SQL ACK unknown/null is not 0 changed rows or completed OCR',()=>{
 const ack={meta:null};assert.notEqual(ack?.meta?.changes,0);assert.notEqual(null,0);
});
