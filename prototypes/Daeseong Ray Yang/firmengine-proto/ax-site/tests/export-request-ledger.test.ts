import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {claimExportRequest,commitExportRequest,markExportUncertain,inspectExportReceipt} from '../lib/export-request-ledger.ts';
const schema=readFileSync(new URL('../drizzle/0023_case_export_request_receipts.sql',import.meta.url),'utf8')
  .replaceAll('--> statement-breakpoint','');
const hash='a'.repeat(64),ref='b'.repeat(64);
const base={caseId:'synthetic',requestId:'request-0001',requestHash:hash,mode:'draft' as const,
  caseRevision:2,sourceDataVersion:4,referenceSha256:ref,storageToken:'token-2',
  claimToken:'claim-0001',at:'2026-10-30T11:40:00.000Z'};
function setup() { const db=new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  db.exec(`CREATE TABLE cases(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,storage_token TEXT NOT NULL);
    CREATE TABLE case_data_change_state(case_id TEXT PRIMARY KEY,data_version INTEGER NOT NULL);
    INSERT INTO cases VALUES ('synthetic',2,'token-2'),('other',2,'token-2');
    INSERT INTO case_data_change_state VALUES ('synthetic',4),('other',4);`);
  db.exec(schema); return db;
}
function run(db:DatabaseSync, statement:{sql:string;args:readonly unknown[]}) {
  return db.prepare(statement.sql).run(...statement.args as (string|number|null)[]).changes;
}
function lookup(db:DatabaseSync,req=base.requestId){
  return db.prepare(`SELECT case_id AS caseId,request_id AS requestId,request_hash AS requestHash,
    mode,case_revision AS caseRevision,source_data_version AS sourceDataVersion,
    reference_sha256 AS referenceSha256,status,manifest_fingerprint AS manifestFingerprint
    FROM case_export_request_receipts WHERE case_id=? AND request_id=?`).get('synthetic',req) as any;
}
test('unique identity prevents duplicate claim, including delayed A after B',()=>{
  const db=setup();assert.equal(run(db,claimExportRequest(base)),1);
  assert.equal(run(db,claimExportRequest(base)),0);
  assert.equal(run(db,claimExportRequest({...base,requestId:'request-0002',claimToken:'claim-0002'})),1);
  assert.equal(run(db,claimExportRequest(base)),0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM case_export_request_receipts').get()!.n,2);
  db.close();
});
test('stale OCR source, case revision or token cannot create a receipt',()=>{
  const db=setup();for(const change of [{sourceDataVersion:3},{caseRevision:3},{storageToken:'stale'}])
    assert.equal(run(db,claimExportRequest({...base,...change,requestId:'req-'+JSON.stringify(change).replace(/[^a-z0-9]/ig,'_')})),0);
  db.close();
});
test('failed argument validation rejects missing and ambiguous identity',()=>{
  for(const change of [{requestId:'x'},{caseRevision:1.5},{sourceDataVersion:0},{referenceSha256:'fake'},{claimToken:''},{requestHash:'bad'}])
    assert.throws(()=>claimExportRequest({...base,...change}));
});
test('only same case+claim token+new storage head may commit',()=>{
  const db=setup();assert.equal(run(db,claimExportRequest(base)),1);
  const commit=(x={})=>commitExportRequest({...base,newStorageToken:'new-token',
    artifactIds:['artifact-0001'],manifestFingerprint:'fingerprint-0001',...x});
  assert.equal(run(db,commit()),0,'case not committed yet');
  db.exec("UPDATE cases SET storage_token='new-token' WHERE id='synthetic'");
  assert.equal(run(db,commit({claimToken:'other-claim'})),0);
  assert.equal(run(db,commit()),1);
  assert.equal(run(db,commit()),0);
  assert.equal(lookup(db).status,'committed');db.close();
});
test('source version changes between claim and manifest batch abort commit',()=>{
  const db=setup();assert.equal(run(db,claimExportRequest(base)),1);
  db.exec("UPDATE cases SET storage_token='new-token' WHERE id='synthetic';UPDATE case_data_change_state SET data_version=5 WHERE case_id='synthetic'");
  assert.equal(run(db,commitExportRequest({...base,newStorageToken:'new-token',artifactIds:['artifact-0001'],manifestFingerprint:'f'})),0);
  assert.equal(lookup(db).status,'claimed');db.close();
});
test('manifest and ledger commit roll back together on audit failure',()=>{
  const db=setup();run(db,claimExportRequest(base));
  db.exec('CREATE TABLE events(id TEXT PRIMARY KEY)');
  db.exec("INSERT INTO events VALUES('event-1')");
  assert.throws(()=>{
    db.exec('BEGIN IMMEDIATE');try{
      db.exec("UPDATE cases SET storage_token='new-token' WHERE id='synthetic'");
      assert.equal(run(db,commitExportRequest({...base,newStorageToken:'new-token',artifactIds:['artifact-0001'],manifestFingerprint:'f'})),1);
      db.exec("INSERT INTO events VALUES('event-1')");db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}
  });
  assert.equal(lookup(db).status,'claimed');
  assert.equal(db.prepare("SELECT storage_token AS token FROM cases WHERE id='synthetic'").get()!.token,'token-2');db.close();
});
test('ambiguous response never reclaims claimed/uncertain request',()=>{
  const db=setup();run(db,claimExportRequest(base));
  assert.equal(run(db,markExportUncertain(base)),1);
  assert.equal(run(db,claimExportRequest(base)),0);
  assert.equal(inspectExportReceipt(lookup(db),{...base,manifestFingerprint:null}),'manual_reconciliation_required');db.close();
});
test('committed A after B remains historical, never new/current',()=>{
  const db=setup();run(db,claimExportRequest(base));
  db.exec("UPDATE cases SET storage_token='new-token' WHERE id='synthetic'");
  run(db,commitExportRequest({...base,newStorageToken:'new-token',artifactIds:['artifact-0001'],manifestFingerprint:'fingerprint-A'}));
  assert.equal(inspectExportReceipt(lookup(db),{...base,manifestFingerprint:'fingerprint-A'}),'verify_sql_and_r2_before_reuse');
  assert.equal(inspectExportReceipt(lookup(db),{...base,manifestFingerprint:'fingerprint-B'}),'historical_committed_do_not_reissue');
  assert.equal(inspectExportReceipt(lookup(db),{...base,requestHash:'c'.repeat(64),manifestFingerprint:'fingerprint-A'}),'identity_conflict');
  assert.equal(run(db,claimExportRequest({...base,storageToken:'new-token'})),0);
  db.close();
});
test('no receipt requires guarded claim; no cross-case reuse',()=>{
  assert.equal(inspectExportReceipt(null,{...base,manifestFingerprint:null}),'eligible_for_atomic_claim');
  const db=setup();run(db,claimExportRequest(base));
  assert.equal(inspectExportReceipt(lookup(db),{...base,caseId:'other',manifestFingerprint:null}),'identity_conflict');db.close();
});
test('bad artifact list cannot be committed',()=>{
  for(const artifacts of [[],['artifact-0001','artifact-0001'],['x']])
    assert.throws(()=>commitExportRequest({...base,newStorageToken:'new-token',artifactIds:artifacts,manifestFingerprint:'f'}));
});
