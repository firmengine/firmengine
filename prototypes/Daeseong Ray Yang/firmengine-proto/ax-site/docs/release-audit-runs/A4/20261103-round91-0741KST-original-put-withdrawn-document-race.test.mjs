/** A4 r91: synthetic WAL negative control, no D1/R2/HTTP/legal approval. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const putSql='UPDATE documents SET original_key = ?,ready = 1 WHERE id = ? AND case_id = ? AND ready = 0 AND sha256 = ?';
const withdrawSql="UPDATE page_jobs SET status='withdrawn',lease_until=NULL WHERE case_id=? AND document_id=? AND EXISTS (SELECT 1 FROM cases WHERE id=? AND revision=? AND storage_token=?)";
const guardSql=putSql+" AND EXISTS (SELECT 1 FROM page_jobs p WHERE p.case_id=documents.case_id AND p.document_id=documents.id AND p.status<>'withdrawn') AND NOT EXISTS (SELECT 1 FROM page_jobs p WHERE p.case_id=documents.case_id AND p.document_id=documents.id AND p.status='withdrawn')";
const hash='a'.repeat(64), key='cases/SYNTH-C/documents/DOC-A/original/synthetic';
function fixture(fn){
 const folder=mkdtempSync(join(tmpdir(),'a4-r91-')),path=join(folder,'wal.sqlite');
 const a=new DatabaseSync(path),b=new DatabaseSync(path);
 try{
  for(const d of [a,b])d.exec('PRAGMA journal_mode=WAL;PRAGMA busy_timeout=1000;');
  a.exec('CREATE TABLE cases(id TEXT PRIMARY KEY,revision INTEGER,storage_token TEXT,payload TEXT);CREATE TABLE documents(id TEXT PRIMARY KEY,case_id TEXT,sha256 TEXT,original_key TEXT,ready INTEGER);CREATE TABLE page_jobs(id TEXT PRIMARY KEY,case_id TEXT,document_id TEXT,status TEXT,lease_until TEXT);');
  a.prepare('INSERT INTO cases VALUES(?,?,?,?)').run('SYNTH-C',1,'t1',JSON.stringify({documents:[{id:'DOC-A',status:'active'},{id:'DOC-B',status:'active'}]}));
  for(const id of ['DOC-A','DOC-B']){a.prepare('INSERT INTO documents VALUES(?,?,?,?,?)').run(id,'SYNTH-C',hash,null,0);for(let n=1;n<=2;n++)a.prepare('INSERT INTO page_jobs VALUES(?,?,?,?,?)').run(id+":"+n,'SYNTH-C',id,n===1?'awaiting_upload':'held',null)}
  const put=(d=a,sql=putSql,id='DOC-A')=>d.prepare(sql).run(key,id,'SYNTH-C',hash).changes;
  const withdraw=(id='DOC-A')=>{b.exec('BEGIN IMMEDIATE');try{const r=b.prepare('SELECT payload FROM cases WHERE id=?').get('SYNTH-C');const p=JSON.parse(r.payload);p.documents=p.documents.map(x=>x.id===id?{...x,status:'deleted'}:x);b.prepare('UPDATE cases SET revision=2,storage_token=?,payload=? WHERE id=?').run('t2',JSON.stringify(p),'SYNTH-C');const n=b.prepare(withdrawSql).run('SYNTH-C',id,'SYNTH-C',2,'t2').changes;b.exec('COMMIT');return n;}catch(e){b.exec('ROLLBACK');throw e}};
  const state=(id='DOC-A')=>({doc:a.prepare('SELECT ready,original_key FROM documents WHERE id=?').get(id),jobs:a.prepare('SELECT status FROM page_jobs WHERE document_id=?').all(id).map(x=>x.status),active:JSON.parse(a.prepare('SELECT payload FROM cases').get().payload).documents.some(x=>x.id===id&&x.status==='active')});
  return fn({a,b,put,withdraw,state});
 }finally{a.close();b.close();rmSync(folder,{recursive:true,force:true});}
}
test('main exact SQL permits ready=1 after competing worker withdraws document',()=>fixture(({put,withdraw,state})=>{assert.equal(withdraw(),2);assert.equal(put(),1);assert.equal(state().active,false);assert.equal(state().doc.ready,1);assert.deepEqual(state().jobs,['withdrawn','withdrawn']);}));
test('comparison guard blocks withdrawn document, not a proposed production fix',()=>fixture(({put,withdraw,state})=>{withdraw();assert.equal(put(undefined,guardSql),0);assert.equal(state().doc.ready,0);}));
test('comparison guard keeps active held/evidence upload possible',()=>fixture(({put})=>{assert.equal(put(undefined,guardSql),1);}));
test('withdrawal of unrelated document does not block active document',()=>fixture(({put,withdraw})=>{withdraw('DOC-B');assert.equal(put(undefined,guardSql),1);}));
test('SHA change before CAS rejects stale incoming original',()=>fixture(({a,put})=>{a.prepare('UPDATE documents SET sha256=? WHERE id=?').run('b'.repeat(64),'DOC-A');assert.equal(put(),0);}));
test('two independent connections: ready=0 is one-winner CAS',()=>fixture(({put,b})=>{assert.equal(put(),1);assert.equal(put(b),0);}));
test('even a missing OCR page job does not block current original PUT SQL',()=>fixture(({a,put})=>{a.prepare('DELETE FROM page_jobs WHERE document_id=?').run('DOC-A');assert.equal(put(undefined,guardSql),0);assert.equal(put(),1);}));
test('withdrawal after original PUT still leaves ready=1 SQL pointer on inactive document',()=>fixture(({put,withdraw,state})=>{put();withdraw();assert.equal(state().doc.ready,1);assert.equal(state().active,false);}));
const root=process.env.A4_AX_SITE_ROOT??resolve(dirname(fileURLToPath(import.meta.url)),'../../../');
if(process.env.A4_CHECK_SOURCE==='1')test('audited code SQL literals still match main source',()=>{
 const putRoute=readFileSync(resolve(root,'app/api/cases/[id]/documents/[doc]/route.ts'),'utf8');
 const command=readFileSync(resolve(root,'lib/case-command-store.ts'),'utf8');
 assert.ok(putRoute.includes(putSql));
 assert.ok(command.includes("UPDATE page_jobs SET status='withdrawn',lease_until=NULL WHERE case_id=? AND document_id=? AND "+"$"+"{guard}"));
});
