import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {DatabaseSync,type SQLInputValue} from "node:sqlite";
import {CASE_DATA_QUIET_MS,getCaseDataUpdateState,listCaseDataUpdates} from "../lib/case-data-watch.ts";

const directory=new URL("../drizzle/",import.meta.url),watchSql=readFileSync(new URL("0010_case_data_watch.sql",directory),"utf8");
function setup(){
  const sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys=ON");
  for(const name of readdirSync(directory).filter(name=>/^\d+.*\.sql$/.test(name)&&Number(name.slice(0,4))<10).sort())sqlite.exec(readFileSync(new URL(name,directory),"utf8"));
  const addCase=(id:string)=>sqlite.prepare("INSERT INTO cases (id,name,owner,revision,payload,created_at,updated_at,storage_token) VALUES (?,?,'owner',1,'{}','at','at','token')").run(id,id);
  const addDocument=(caseId:string)=>sqlite.prepare("INSERT INTO documents (id,case_id,name,sha256,page_count,ready,created_at) VALUES (?,?,? ,?,1,1,'at')").run('doc-'+caseId,caseId,'source.pdf','a'.repeat(64));
  addCase("case-1");addDocument("case-1");sqlite.exec(watchSql);
  const database={prepare(sql:string){let values:SQLInputValue[]=[];const statement={bind(...args:SQLInputValue[]){assert.ok(args.length<=100,"D1 query parameter budget exceeded");values=args;return statement;},async first<T>(){return sqlite.prepare(sql).get(...values) as T??null;},async all<T>(){return{results:sqlite.prepare(sql).all(...values) as T[]};},async run(){const result=sqlite.prepare(sql).run(...values);return{meta:{changes:Number(result.changes)}};}};return statement;}} as unknown as D1Database;
  const eventCount=()=>Number((sqlite.prepare("SELECT COUNT(*) AS n FROM case_data_change_events").get() as {n:number}).n);
  const addExtraction=(runId:string,caseId="case-1")=>{
    sqlite.prepare("INSERT OR IGNORE INTO extraction_schema_versions (id,sha256,contract_version,payload_json,created_at) VALUES ('schema-1',?,'version','{}','at')").run('s'.repeat(64));
    sqlite.prepare("INSERT OR IGNORE INTO document_instances (id,case_id,source_document_id,page,boundary_status,created_at) VALUES (?,?,?,1,'page_only','at')").run('instance-'+caseId,caseId,'doc-'+caseId);
    sqlite.prepare("INSERT INTO extraction_runs (id,case_id,document_instance_id,schema_id,stage,model,source_hash,image_hash,read_sha256,read_json,case_revision,created_at) VALUES (?,?,?,'schema-1','extracted','gpt-6.1-terra',?,?,?,'{}',1,'at')").run(runId,caseId,'instance-'+caseId,'a'.repeat(64),'b'.repeat(64),'c'.repeat(64));
    sqlite.prepare("INSERT INTO extraction_records (id,run_id,ordinal,category,label) VALUES (?,?,0,'other','source row')").run('record-'+runId,runId);
    sqlite.prepare("INSERT INTO extracted_features (id,record_id,schema_id,ordinal,field_key,label,raw_value_json,confidence,quote,bbox_json,raw_field_json,binding_status,validation_status,validation_json) VALUES (?,?,'schema-1',0,'value','Value','\"1\"','clear','1','null','{}','unbound','unbound','[]')").run('feature-'+runId,'record-'+runId);
  };
  const promote=(runId:string,caseId="case-1")=>sqlite.prepare("INSERT INTO case_extraction_heads (case_id,source_document_id,page,run_id,case_revision,updated_at) VALUES (?,?,1,?,1,'at') ON CONFLICT(case_id,source_document_id,page) DO UPDATE SET run_id=excluded.run_id,updated_at=excluded.updated_at").run(caseId,'doc-'+caseId,runId);
  const addRequirementRun=(id:string,caseId="case-1")=>sqlite.prepare("INSERT INTO consultation_runs (id,case_id,fingerprint,case_revision,case_storage_token,consultation_revision,catalog_version,status,actor,created_at,updated_at) VALUES (?,?,?,1,'token',1,2,'completed','owner','at','at')").run(id,caseId,id);
  const requirementCatalog=()=>{
    sqlite.prepare("INSERT INTO intake_catalog_versions (version,schema_version,payload,sha256,actor,created_at) VALUES (2,'catalog','{}','catalog-hash','owner','at')").run();
    sqlite.prepare("INSERT INTO shared_document_types (id,name,category,issuer,purpose,collection_mode,routing_status,catalog_version,catalog_sha256,payload_json,updated_at) VALUES ('type-1','Source','category','issuer','purpose','client_evidence','ready',2,'catalog-hash','{}','at')").run();
    sqlite.prepare("INSERT INTO shared_document_type_versions (catalog_sha256,document_type_id,catalog_version,name,category,issuer,purpose,collection_mode,routing_status,payload_json,created_at) VALUES ('catalog-hash','type-1',2,'Source','category','issuer','purpose','client_evidence','ready','{}','at')").run();
  };
  const addRequirement=(runId:string,id:string,caseId="case-1")=>sqlite.prepare("INSERT INTO case_document_requirements (consultation_run_id,requirement_id,case_id,document_type_id,document_name,subject_id,subject_label,required_period,requirement,status,catalog_version,catalog_sha256,raw_json,raw_sha256,created_at) VALUES (?,?,?,'type-1','Source','subject','Subject','current','recommended','requested',2,'catalog-hash','{}','raw-hash','at')").run(runId,id,caseId);
  return{sqlite,database,addCase,addDocument,eventCount,addExtraction,promote,addRequirementRun,requirementCatalog,addRequirement,close:()=>sqlite.close()};
}

test("existing cases receive one explicit baseline, and repeated migration/read calls never reset or acknowledge it",async()=>{
  const h=setup();try{
    const before=await getCaseDataUpdateState(h.database,{caseId:"case-1"});assert.equal(before.dataVersion,1);assert.equal(h.eventCount(),1);assert.equal(before.quietMs,600000);assert.equal(before.quietMs,CASE_DATA_QUIET_MS);
    assert.equal(Date.parse(before.dueAt)-Date.parse(before.lastChangedAt),600000);assert.equal(before.isQuiet,false);
    h.sqlite.exec(watchSql);const again=await getCaseDataUpdateState(h.database,{caseId:"case-1"});assert.deepEqual(again,before);assert.equal(h.eventCount(),1);
    const first=await listCaseDataUpdates(h.database,{caseId:"case-1"});assert.equal(first.events[0].eventKind,"baseline");assert.equal(first.acknowledgesChanges,false);
    assert.deepEqual(await listCaseDataUpdates(h.database,{caseId:"case-1"}),first);assert.equal(h.eventCount(),1);
  }finally{h.close();}
});

test("raw SQL source updates create monotone per-case notifications, while cache-only writes do not reset quiet time",async()=>{
  const h=setup();try{
    h.addCase("case-2");h.addDocument("case-2");const other=await getCaseDataUpdateState(h.database,{caseId:"case-2"});
    const before=await getCaseDataUpdateState(h.database,{caseId:"case-1"});
    h.sqlite.prepare("UPDATE cases SET payload='cache-only',storage_token='derived-token',updated_at='later' WHERE id='case-1'").run();assert.equal((await getCaseDataUpdateState(h.database,{caseId:"case-1"})).dataVersion,before.dataVersion);
    h.sqlite.prepare("UPDATE cases SET revision=revision+1 WHERE id='case-1'").run();
    h.sqlite.prepare("UPDATE documents SET name='changed source.pdf' WHERE id='doc-case-1'").run();
    const after=await getCaseDataUpdateState(h.database,{caseId:"case-1"});assert.equal(after.dataVersion,before.dataVersion+2);assert.equal(after.currentCaseRevision,2);assert.ok(after.lastEventId>before.lastEventId);
    assert.deepEqual(await getCaseDataUpdateState(h.database,{caseId:"case-2"}),other);
    const delta=await listCaseDataUpdates(h.database,{caseId:"case-1",afterEventId:before.lastEventId,limit:1});assert.equal(delta.events.length,1);assert.equal(delta.hasMore,true);
    const rest=await listCaseDataUpdates(h.database,{caseId:"case-1",afterEventId:delta.nextAfterEventId,limit:1});assert.equal(rest.events.length,1);assert.equal(rest.hasMore,false);
    assert.ok([...delta.events,...rest.events].every(event=>event.caseId==="case-1"));
  }finally{h.close();}
});

test("uncommitted extraction history is quiet; head changes and direct active feature/record writes are detected",async()=>{
  const h=setup();try{
    const start=h.eventCount();h.addExtraction("run-1");assert.equal(h.eventCount(),start,"immutable pre-head rows must not create one notification per OCR field");
    h.promote("run-1");assert.equal(h.eventCount(),start+1);
    h.sqlite.prepare("UPDATE extracted_features SET raw_value_json='\"2\"' WHERE id='feature-run-1'").run();assert.equal(h.eventCount(),start+2);
    h.sqlite.prepare("UPDATE extraction_records SET label='corrected record' WHERE id='record-run-1'").run();assert.equal(h.eventCount(),start+3);
    h.addExtraction("run-2");assert.equal(h.eventCount(),start+3);h.promote("run-2");assert.equal(h.eventCount(),start+4);
    h.sqlite.prepare("UPDATE extracted_features SET raw_value_json='\"3\"' WHERE id='feature-run-1'").run();assert.equal(h.eventCount(),start+4,"inactive historical run edits do not dirty the current source head");
    h.promote("run-2");assert.equal(h.eventCount(),start+4,"idempotent head writes are not source changes");
    h.sqlite.prepare("UPDATE extracted_features SET raw_value_json='\"4\"' WHERE id='feature-run-2'").run();assert.equal(h.eventCount(),start+5);
    h.sqlite.exec("BEGIN; UPDATE extracted_features SET raw_value_json='\"rollback\"' WHERE id='feature-run-2'; ROLLBACK;");assert.equal(h.eventCount(),start+5,"notification and source write roll back in the same transaction");
    assert.deepEqual(h.sqlite.prepare("PRAGMA foreign_key_check").all(),[]);
  }finally{h.close();}
});

test("only active consultation requirements dirty a case; activating a new run detects the replacement set",async()=>{
  const h=setup();try{
    h.requirementCatalog();h.addRequirementRun("run-a");h.addRequirementRun("run-b");
    const before=h.eventCount();h.addRequirement("run-a","req-a");h.addRequirement("run-b","req-b");assert.equal(h.eventCount(),before);
    h.sqlite.prepare("INSERT INTO consultation_heads (case_id,revision,active_run_id,updated_at) VALUES ('case-1',1,'run-a','at')").run();assert.equal(h.eventCount(),before+1);
    h.sqlite.prepare("UPDATE case_document_requirements SET status='legal_review' WHERE requirement_id='req-b'").run();assert.equal(h.eventCount(),before+1);
    h.sqlite.prepare("UPDATE case_document_requirements SET status='qualification_needed' WHERE requirement_id='req-a'").run();assert.equal(h.eventCount(),before+2);
    h.sqlite.prepare("UPDATE consultation_heads SET active_run_id='run-b' WHERE case_id='case-1'").run();assert.equal(h.eventCount(),before+3);
    h.sqlite.prepare("DELETE FROM case_document_requirements WHERE requirement_id='req-a'").run();assert.equal(h.eventCount(),before+3);
    h.sqlite.prepare("UPDATE case_document_requirements SET status='requested' WHERE requirement_id='req-b'").run();assert.equal(h.eventCount(),before+4);
  }finally{h.close();}
});

test("watch queries fail explicitly for invalid cursors, missing cases and a missing baseline",async()=>{
  const h=setup();try{
    await assert.rejects(listCaseDataUpdates(h.database,{afterEventId:-1}),/INVALID_CASE_DATA_WATCH_CURSOR/);
    await assert.rejects(listCaseDataUpdates(h.database,{limit:201}),/INVALID_CASE_DATA_WATCH_LIMIT/);
    await assert.rejects(getCaseDataUpdateState(h.database,{caseId:"missing"}),/CASE_DATA_WATCH_CASE_NOT_FOUND/);
    h.sqlite.prepare("DELETE FROM case_data_change_state WHERE case_id='case-1'").run();
    await assert.rejects(getCaseDataUpdateState(h.database,{caseId:"case-1"}),/CASE_DATA_WATCH_BASELINE_MISSING/);
  }finally{h.close();}
});

test("a bounded global page can include many cases without exceeding D1 parameter limits",async()=>{
  const h=setup();try{
    for(let i=0;i<160;i++)h.addCase("many-case-"+i);
    const page=await listCaseDataUpdates(h.database,{limit:200});assert.equal(page.events.length,161);assert.equal(page.states.length,161);assert.equal(page.hasMore,false);
    assert.equal(new Set(page.states.map(state=>state.caseId)).size,161);
    assert.ok(page.events.every((event,index)=>index===0||event.eventId>page.events[index-1].eventId));
  }finally{h.close();}
});
