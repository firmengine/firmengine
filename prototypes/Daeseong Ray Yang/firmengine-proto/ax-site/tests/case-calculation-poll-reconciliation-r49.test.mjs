import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspectCaseCalculationPollRecovery} from '../lib/case-calculation-poll-reconciliation.ts';
const A='a'.repeat(64), B='b'.repeat(64);
const NOW=Date.parse('2026-11-01T04:45:00Z');
// Mirrors the main candidate selection SQL. This is a local regression,
// not a live Cron or Cloudflare D1 execution.
const CANDIDATES_SQL=[
 'SELECT state.case_id AS caseId,state.data_version AS dataVersion,',
 'current_case.revision AS caseRevision FROM case_data_change_state state',
 'JOIN cases current_case ON current_case.id=state.case_id',
 'LEFT JOIN case_calculation_heads calculated ON calculated.case_id=state.case_id',
 'LEFT JOIN case_calculation_runs calc_run ON calc_run.id=calculated.run_id',
 'LEFT JOIN case_calculation_poll_jobs poll ON poll.case_id=state.case_id',
 'WHERE (calculated.case_id IS NULL OR calculated.data_version<state.data_version',
 'OR calculated.case_revision<>current_case.revision OR calc_run.reference_sha256 IS NULL',
 'OR calc_run.reference_sha256<>?) AND state.last_changed_at<=?',
 'AND (poll.case_id IS NULL OR poll.data_version<>state.data_version',
 'OR poll.case_revision<>current_case.revision OR poll.reference_sha256<>?',
 "OR (poll.status='retry_wait' AND poll.next_attempt_at<=?)",
 "OR (poll.status='running' AND poll.lease_until<=?))",
 'AND state.case_id=? ORDER BY state.last_changed_at,state.case_id LIMIT 1'
].join(' ');
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'firmengine-a4-r49-')),path=join(dir,'fixture.db');
 const a=new DatabaseSync(path),b=new DatabaseSync(path);
 for(const db of [a,b])db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=2000');
 a.exec(`CREATE TABLE cases(id TEXT PRIMARY KEY,revision INTEGER NOT NULL);
 CREATE TABLE case_data_change_state(case_id TEXT PRIMARY KEY,data_version INTEGER NOT NULL,last_changed_at TEXT NOT NULL);
 CREATE TABLE case_calculation_runs(id TEXT PRIMARY KEY,case_id TEXT NOT NULL,data_version INTEGER NOT NULL,case_revision INTEGER NOT NULL,reference_sha256 TEXT NOT NULL,input_sha256 TEXT,status TEXT NOT NULL);
 CREATE TABLE case_calculation_heads(case_id TEXT PRIMARY KEY,run_id TEXT NOT NULL,data_version INTEGER NOT NULL,case_revision INTEGER NOT NULL,input_sha256 TEXT);
 CREATE TABLE case_calculation_poll_jobs(case_id TEXT PRIMARY KEY,data_version INTEGER NOT NULL,case_revision INTEGER NOT NULL,reference_sha256 TEXT NOT NULL,status TEXT NOT NULL,attempts INTEGER NOT NULL,lease_token TEXT,lease_until TEXT,next_attempt_at TEXT,last_error TEXT,updated_at TEXT);`);
 a.prepare('INSERT INTO cases VALUES(?,?)').run('synthetic-case',4);
 a.prepare('INSERT INTO case_data_change_state VALUES(?,?,?)').run('synthetic-case',7,'2026-11-01T04:00:00Z');
 a.prepare('INSERT INTO case_calculation_runs VALUES(?,?,?,?,?,?,?)').run('run-7','synthetic-case',7,4,A,A,'computed');
 a.prepare('INSERT INTO case_calculation_heads VALUES(?,?,?,?,?)').run('synthetic-case','run-7',7,4,A);
 a.prepare('INSERT INTO case_calculation_poll_jobs VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('synthetic-case',7,4,A,'running',1,'worker-A','2026-11-01T04:05:00Z',null,null,'2026-11-01T04:00:00Z');
 return {a,b,close(){a.close();b.close();rmSync(dir,{recursive:true,force:true})}};
}
function d1(db,fail=false){return {prepare(sql){return {bind(...args){return {async first(){if(fail)throw new Error('D1_503');return db.prepare(sql).get(...args)??null;}}}}}}}
function candidates(db,ref=A){return db.prepare(CANDIDATES_SQL).all(ref,'2026-11-01T04:35:00Z',ref,'2026-11-01T04:45:00Z','2026-11-01T04:45:00Z','synthetic-case');}
const inspect=(f,ref=A)=>inspectCaseCalculationPollRecovery(d1(f.b),{caseId:'synthetic-case',activeReferenceSha256:ref,now:NOW});

test('head persisted, DELETE not applied: Cron cannot see ghost running poll',async()=>{const f=fixture();try{assert.equal(candidates(f.b).length,0);const r=await inspect(f);assert.equal(r.finding,'poll_running_with_current_head');assert.equal(r.lease,'expired');assert.equal(r.approved,false);assert.equal(r.writePerformed,false);}finally{f.close()}});
test('two WAL connections see same committed head and ghost lease',async()=>{const f=fixture();try{assert.equal(candidates(f.a).length,0);assert.equal((await inspect(f)).headCurrent,true);assert.equal(f.b.prepare('SELECT lease_token FROM case_calculation_poll_jobs').get().lease_token,'worker-A')}finally{f.close()}});
test('updated source v8 still makes old head eligible; never report current',async()=>{const f=fixture();try{f.a.exec('UPDATE case_data_change_state SET data_version=8');assert.equal(candidates(f.b).length,1);assert.equal((await inspect(f)).finding,'head_not_current')}finally{f.close()}});
test('reference release changed without source version makes old head stale',async()=>{const f=fixture();try{assert.equal(candidates(f.b,B).length,1);const r=await inspect(f,B);assert.equal(r.finding,'head_not_current');assert.equal(r.headCurrent,false);}finally{f.close()}});
test('missing poll row must not be treated as confirmed release ACK',async()=>{const f=fixture();try{f.a.exec('DELETE FROM case_calculation_poll_jobs');assert.equal(candidates(f.b).length,0);const r=await inspect(f);assert.equal(r.finding,'poll_absent_head_current');assert.equal(r.approved,false);}finally{f.close()}});
test('head deleted => pending due work, not completion',async()=>{const f=fixture();try{f.a.exec('DELETE FROM case_calculation_heads');assert.equal(candidates(f.b).length,1);assert.equal((await inspect(f)).finding,'head_unobserved')}finally{f.close()}});
test('source ref changed in poll only => conflict, not current poll',async()=>{const f=fixture();try{f.a.prepare('UPDATE case_calculation_poll_jobs SET reference_sha256=?').run(B);const r=await inspect(f);assert.equal(r.finding,'poll_source_conflict');assert.equal(r.headCurrent,true);}finally{f.close()}});
test('current head with failed poll is not assumed successful operator outcome',async()=>{const f=fixture();try{f.a.exec("UPDATE case_calculation_poll_jobs SET status='failed'");const r=await inspect(f);assert.equal(r.finding,'poll_failed_with_current_head');assert.equal(r.approved,false);}finally{f.close()}});
test('source version zero is distinct from observed current source',async()=>{const f=fixture();try{f.a.exec('UPDATE case_data_change_state SET data_version=0');const r=await inspect(f);assert.equal(r.finding,'source_unobserved');assert.equal(r.headCurrent,null);}finally{f.close()}});
test('missing active reference remains unobserved, no optimistic fallback',async()=>{const f=fixture();try{const r=await inspect(f,null);assert.equal(r.finding,'active_reference_unobserved');assert.equal(r.headCurrent,null);}finally{f.close()}});
test('missing run referenced by head is insufficient proof',async()=>{const f=fixture();try{f.a.exec('DELETE FROM case_calculation_runs');assert.equal((await inspect(f)).finding,'head_unobserved')}finally{f.close()}});
test('malformed lease_until is unobserved instead of expired',async()=>{const f=fixture();try{f.a.exec("UPDATE case_calculation_poll_jobs SET lease_until='not-a-time'");const r=await inspect(f);assert.equal(r.finding,'poll_running_with_current_head');assert.equal(r.lease,'unobserved')}finally{f.close()}});
test('independent case ID never leaks first case evidence',async()=>{const f=fixture();try{f.a.prepare('INSERT INTO cases VALUES(?,?)').run('other-case',1);const r=await inspectCaseCalculationPollRecovery(d1(f.b),{caseId:'other-case',activeReferenceSha256:A,now:NOW});assert.equal(r.finding,'source_unobserved');assert.equal(r.caseId,'other-case');}finally{f.close()}});
test('SELECT 503 never transforms into absence or approval',async()=>{const f=fixture();try{await assert.rejects(inspectCaseCalculationPollRecovery(d1(f.b,true),{caseId:'synthetic-case',activeReferenceSha256:A}),/D1_503/);}finally{f.close()}});

test('r50 head input digest mismatch is not current even with matching run and source',async()=>{const f=fixture();try{f.a.prepare('UPDATE case_calculation_heads SET input_sha256=?').run(B);const r=await inspect(f);assert.equal(r.finding,'head_input_conflict');assert.equal(r.headCurrent,false);assert.equal(r.approved,false);assert.equal(r.writePerformed,false);}finally{f.close()}});
test('r50 missing digest is unobserved not computed success',async()=>{const f=fixture();try{f.a.exec('UPDATE case_calculation_heads SET input_sha256=NULL');const r=await inspect(f);assert.equal(r.finding,'head_input_unobserved');assert.equal(r.headCurrent,null);}finally{f.close()}});
test('r50 malformed run digest is distinct from an observed conflict',async()=>{const f=fixture();try{f.a.exec("UPDATE case_calculation_runs SET input_sha256='0'");const r=await inspect(f);assert.equal(r.finding,'head_input_unobserved');assert.equal(r.headCurrent,null);}finally{f.close()}});
test('r50 absent poll row cannot override head/run digest conflict',async()=>{const f=fixture();try{f.a.prepare('UPDATE case_calculation_runs SET input_sha256=?').run(B);f.a.exec('DELETE FROM case_calculation_poll_jobs');const r=await inspect(f);assert.equal(r.finding,'head_input_conflict');assert.equal(r.headCurrent,false);}finally{f.close()}});

test('r51 stored computed run status is visible but does not imply approval',async()=>{const f=fixture();try{const r=await inspect(f);assert.equal(r.storedRunStatus,'computed');assert.equal(r.headCurrent,true);assert.equal(r.approved,false);}finally{f.close()}});
test('r51 provisional run remains provisional even with current head',async()=>{const f=fixture();try{f.a.exec("UPDATE case_calculation_runs SET status='provisional'");const r=await inspect(f);assert.equal(r.storedRunStatus,'provisional');assert.equal(r.headCurrent,true);assert.equal(r.approved,false);}finally{f.close()}});
test('r51 missing-calculation run is not a completed calculation',async()=>{const f=fixture();try{f.a.exec("UPDATE case_calculation_runs SET status='missing'");const r=await inspect(f);assert.equal(r.storedRunStatus,'missing');assert.equal(r.headCurrent,true);assert.equal(r.approved,false);}finally{f.close()}});
test('r51 invalid stored run status is conflicting evidence, not approval',async()=>{const f=fixture();try{f.a.exec("UPDATE case_calculation_runs SET status='successful'");const r=await inspect(f);assert.equal(r.storedRunStatus,'conflict');assert.equal(r.approved,false);}finally{f.close()}});
test('r51 NULL running lease owner cannot be treated as an expired owned lease',async()=>{const f=fixture();try{f.a.exec("UPDATE case_calculation_poll_jobs SET lease_token=NULL");const r=await inspect(f);assert.equal(r.lease,'unobserved');assert.equal(r.approved,false);}finally{f.close()}});
test('r51 empty running lease token is unobserved despite past lease_until',async()=>{const f=fixture();try{f.a.exec("UPDATE case_calculation_poll_jobs SET lease_token=''");const r=await inspect(f);assert.equal(r.lease,'unobserved');assert.equal(r.writePerformed,false);}finally{f.close()}});

test('r52 NULL poll status is response-loss simulation, not a persisted SQLite NULL',async()=>{const f=fixture();try{const adapter={prepare(sql){return {bind(...args){return {async first(){return {...f.b.prepare(sql).get(...args),pollStatus:null};}}}}}};const r=await inspectCaseCalculationPollRecovery(adapter,{caseId:'synthetic-case',activeReferenceSha256:A,now:NOW});assert.equal(r.finding,'poll_state_unobserved');assert.equal(r.approved,false);assert.equal(r.writePerformed,false);}finally{f.close()}});
test('r52 blank poll status is unobserved',async()=>{const f=fixture();try{f.a.exec("UPDATE case_calculation_poll_jobs SET status=' '");const r=await inspect(f);assert.equal(r.finding,'poll_state_unobserved');}finally{f.close()}});
test('r52 unknown persisted poll status is conflict',async()=>{const f=fixture();try{f.a.exec("UPDATE case_calculation_poll_jobs SET status='unexpected_success'");const r=await inspect(f);assert.equal(r.finding,'poll_state_conflict');assert.equal(r.headCurrent,true);assert.equal(r.approved,false);}finally{f.close()}});
test('r52 retry_wait with current head is not generic observed success',async()=>{const f=fixture();try{f.a.exec("UPDATE case_calculation_poll_jobs SET status='retry_wait'");const r=await inspect(f);assert.equal(r.finding,'poll_retry_wait_with_current_head');assert.equal(r.approved,false);}finally{f.close()}});
test('r52 normal running and failed statuses remain explicit',async()=>{const f=fixture();try{assert.equal((await inspect(f)).finding,'poll_running_with_current_head');f.a.exec("UPDATE case_calculation_poll_jobs SET status='failed'");assert.equal((await inspect(f)).finding,'poll_failed_with_current_head');}finally{f.close()}});


test('r53 stale head + running NULL deadline is stranded and stays unobserved',async()=>{const f=fixture();try{f.a.exec('UPDATE case_calculation_heads SET data_version=6');f.a.exec('UPDATE case_calculation_poll_jobs SET lease_until=NULL');const r=await inspect(f);assert.equal(r.finding,'poll_running_deadline_unobserved');assert.equal(r.headCurrent,false);assert.equal(r.lease,'unobserved');assert.equal(r.writePerformed,false);}finally{f.close()}});
test('r53 stale head + running malformed lease deadline remains uncertain',async()=>{const f=fixture();try{f.a.exec('UPDATE case_calculation_heads SET data_version=6');f.a.exec("UPDATE case_calculation_poll_jobs SET lease_until='bad-date'");const r=await inspect(f);assert.equal(r.finding,'poll_running_deadline_unobserved');assert.equal(r.approved,false);}finally{f.close()}});
test('r53 stale head + retry_wait NULL next_attempt_at is not a due task',async()=>{const f=fixture();try{f.a.exec('UPDATE case_calculation_heads SET data_version=6');f.a.exec("UPDATE case_calculation_poll_jobs SET status='retry_wait',lease_token=NULL,lease_until=NULL,next_attempt_at=NULL");const r=await inspect(f);assert.equal(r.finding,'poll_retry_deadline_unobserved');assert.equal(r.headCurrent,false);}finally{f.close()}});
test('r53 stale head + retry_wait malformed deadline remains unobserved',async()=>{const f=fixture();try{f.a.exec('UPDATE case_calculation_heads SET data_version=6');f.a.exec("UPDATE case_calculation_poll_jobs SET status='retry_wait',lease_token=NULL,lease_until=NULL,next_attempt_at='not-a-time'");const r=await inspect(f);assert.equal(r.finding,'poll_retry_deadline_unobserved');assert.equal(r.writePerformed,false);}finally{f.close()}});
test('r53 stale head + running NULL owner is not a confirmed owned lease',async()=>{const f=fixture();try{f.a.exec('UPDATE case_calculation_heads SET data_version=6');f.a.exec("UPDATE case_calculation_poll_jobs SET lease_token=NULL");const r=await inspect(f);assert.equal(r.finding,'poll_running_owner_unobserved');assert.equal(r.lease,'unobserved');assert.equal(r.approved,false);}finally{f.close()}});
test('r53 stale head + valid owned lease remains ordinary head_not_current',async()=>{const f=fixture();try{f.a.exec('UPDATE case_calculation_heads SET data_version=6');const r=await inspect(f);assert.equal(r.finding,'head_not_current');assert.equal(r.headCurrent,false);}finally{f.close()}});
test('r53 stale head + due retry_wait with valid timestamp is not unknown deadline',async()=>{const f=fixture();try{f.a.exec('UPDATE case_calculation_heads SET data_version=6');f.a.exec("UPDATE case_calculation_poll_jobs SET status='retry_wait',lease_token=NULL,lease_until=NULL,next_attempt_at='2026-11-01T04:05:00.000Z'");const r=await inspect(f);assert.equal(r.finding,'head_not_current');}finally{f.close()}});
