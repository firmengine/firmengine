import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync,type SQLInputValue} from "node:sqlite";
import {readFileSync} from "node:fs";
import {createCase,type CaseData,type Fact} from "../lib/domain.ts";
import {upsertCourtCorrectionItem,readCourtCorrectionItems,validateCorrectionItemDraft,type CorrectionItemDraft} from "../lib/preapproval-correction-item-store.ts";
const docHash="a".repeat(64);
function setup(){
 const sqlite=new DatabaseSync(":memory:");
 sqlite.exec("PRAGMA foreign_keys=ON");
 sqlite.exec("CREATE TABLE cases(id TEXT PRIMARY KEY,revision INTEGER NOT NULL);"+
   "CREATE TABLE documents(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES cases(id),sha256 TEXT NOT NULL);"+
   "CREATE TABLE case_data_change_state(case_id TEXT PRIMARY KEY REFERENCES cases(id),data_version INTEGER NOT NULL)");
 sqlite.exec(readFileSync(new URL("../drizzle/0022_preapproval_court_correction_items.sql",import.meta.url),"utf8"));
 const data=createCase("synthetic staff draft","correction-fixture","2026-10-30");
 data.documents=[{id:"court",name:"synthetic-order.pdf",sha256:docHash,status:"active",pages:[1]},
   {id:"answer",name:"synthetic-answer.pdf",sha256:"b".repeat(64),status:"active",pages:[1]},
   {id:"receipt",name:"synthetic-receipt.pdf",sha256:"c".repeat(64),status:"active",pages:[1]}];
 data.pages=[{documentId:"court",page:1,role:"evidence",text:"submit the debt statement by 2026-11-09"}];
 data.facts=[{id:"deadline-1",logicalId:"deadline-1",version:1,subjectId:"court-order",
   key:"court.correctionDeadline",value:"2026-11-09",state:"verified",recognition:"accepted",
   refs:[{documentId:"court",page:1,quote:"2026-11-09",sourceHash:docHash}],validation:[]} as Fact];
 data.workflowState={procedureEvents:[
   {id:"court-order",state:"correction_requested",actor:"court",courtReference:"synthetic-ref",
     occurredAt:"2026-10-30",recordedAt:"2026-10-30",reason:"provide debt proof",relatedFields:["debt.principal_balance"],
     sourceDocumentIds:["court"],artifactIds:[]},
   {id:"received-answer",state:"received",actor:"staff",courtReference:"synthetic-ref",
     occurredAt:"2026-11-05",recordedAt:"2026-11-05",reason:"receipt from court",
     relatedFields:[],sourceDocumentIds:["answer","receipt"],artifactIds:[]},
 ]} as CaseData["workflowState"];
 sqlite.prepare("INSERT INTO cases VALUES (?,?)").run(data.context.id,data.context.revision);
 sqlite.prepare("INSERT INTO case_data_change_state VALUES (?,?)").run(data.context.id,1);
 for(const doc of data.documents)sqlite.prepare("INSERT INTO documents VALUES (?,?,?)").run(doc.id,data.context.id,doc.sha256);
 const db={prepare(sql:string){
   let args:SQLInputValue[]=[];
   const stmt={bind(...params:SQLInputValue[]){args=params;return stmt;},
     async first<T>(){return sqlite.prepare(sql).get(...args) as T??null;},
     async all<T>(){return {results:sqlite.prepare(sql).all(...args) as T[]};},
     async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};}};
   return stmt;
 },async batch(statements:Array<{run():Promise<unknown>}>){
   sqlite.exec("BEGIN IMMEDIATE");
   try{const out=[];for(const s of statements)out.push(await s.run());sqlite.exec("COMMIT");return out;}
   catch(error){sqlite.exec("ROLLBACK");throw error;}
 }} as unknown as D1Database;
 const draft:CorrectionItemDraft={
   courtEventId:"court-order",itemNo:1,orderDocumentId:"court",orderPage:1,
   orderQuote:"submit the debt statement by 2026-11-09",
   requiredCanonicalFieldIds:[],unmappedRequiredFieldLabels:["채무 잔액 근거"],requiredDocumentTypeIds:[],
   requiredPeriod:"2026-10",deadline:{date:"2026-11-09",sourceFactId:"deadline-1"},
   responseEventId:null,responseDocumentIds:[],receiptDocumentId:null,
   expectedCaseRevision:data.context.revision,expectedHeadId:null,reason:"법원 원본 문구 대조",
 };
 return {sqlite,data,db,draft};
}
test("staff source-backed order text and deadline bind to a current court event and active PDF",()=>{
 const {data,draft}=setup();
 const valid=validateCorrectionItemDraft(data,draft);
 assert.equal(valid.orderDocumentSha256,docHash);
 assert.equal(valid.payload.deadline?.date,"2026-11-09");
 assert.equal(valid.payload.requiredCanonicalFieldIds.length,0);
});
test("a deadline from a non-current or unaccepted fact cannot be substituted for an order date",()=>{
 const {data,draft}=setup();
 data.facts[0].recognition="unreviewed";
 assert.throws(()=>validateCorrectionItemDraft(data,draft),/CORRECTION_DEADLINE_NOT_SOURCE_BOUND/);
});
test("append-only D1 item revision, idempotent repeat, and read are review-only",async()=>{
 const {sqlite,data,db,draft}=setup();
 const first=await upsertCourtCorrectionItem(db,{data,draft,actorId:"staff-reviewer"});
 assert.equal(first.unchanged,false);
 const repeat=await upsertCourtCorrectionItem(db,{data,draft,actorId:"staff-reviewer"});
 assert.equal(repeat.versionId,first.versionId);
 assert.equal(repeat.unchanged,true);
 const list=await readCourtCorrectionItems(db,data);
 assert.equal(list.count,1);assert.equal(list.items[0].status,"itemized_needs_lawyer_and_court_receipt_review");
 assert.equal(list.items[0].courtOrderSatisfied,false);
 assert.equal((sqlite.prepare("SELECT count(*) AS n FROM case_court_correction_item_versions").get() as {n:number}).n,1);
});
test("a second item draft preserves history and requires exact predecessor ID",async()=>{
 const {sqlite,data,db,draft}=setup();
 const first=await upsertCourtCorrectionItem(db,{data,draft,actorId:"staff-reviewer"});
 const next={...draft,expectedHeadId:first.versionId,orderQuote:"submit the debt statement by 2026-11-09 (reviewed)",
   reason:"항목 상세화"};
 const result=await upsertCourtCorrectionItem(db,{data,draft:next,actorId:"staff-reviewer"});
 assert.notEqual(first.versionId,result.versionId);
 assert.equal((sqlite.prepare("SELECT count(*) AS n FROM case_court_correction_item_versions").get() as {n:number}).n,2);
 await assert.rejects(()=>upsertCourtCorrectionItem(db,{data,draft:{...next,expectedHeadId:first.versionId,reason:"stale revision"},actorId:"staff-reviewer"}),/CORRECTION_ITEM_CONCURRENT_CHANGE/);
});
test("an existing response event can be linked but never proves court acceptance",async()=>{
 const {data,db,draft}=setup();
 const reply={...draft,responseEventId:"received-answer",responseDocumentIds:["answer"],receiptDocumentId:"receipt"};
 const r=await upsertCourtCorrectionItem(db,{data,draft:reply,actorId:"staff-reviewer"});
 assert.equal(r.courtOrderSatisfied,false);
 const list=await readCourtCorrectionItems(db,data);
 assert.equal(list.items[0].draft?.receiptDocumentId,"receipt");
 assert.equal(list.items[0].courtOrderSatisfied,false);
});
test("response attachment without an explicit matching received event is rejected",()=>{
 const {data,draft}=setup();
 assert.throws(()=>validateCorrectionItemDraft(data,{...draft,receiptDocumentId:"receipt"}),/CORRECTION_RESPONSE_EVENT_REQUIRED/);
});
test("SQL source document hash mismatch prevents writing a court order item",async()=>{
 const {sqlite,data,db,draft}=setup();
 sqlite.prepare("UPDATE documents SET sha256=? WHERE id='court'").run("b".repeat(64));
 await assert.rejects(()=>upsertCourtCorrectionItem(db,{data,draft,actorId:"staff-reviewer"}),/CORRECTION_ORDER_STORAGE_HASH_MISMATCH/);
});
test("source-data version drift leaves earlier item visible but marked stale",async()=>{
 const {sqlite,data,db,draft}=setup();
 await upsertCourtCorrectionItem(db,{data,draft,actorId:"staff-reviewer"});
 sqlite.prepare("UPDATE case_data_change_state SET data_version=2 WHERE case_id=?").run(data.context.id);
 const r=await readCourtCorrectionItems(db,data);
 assert.equal(r.items[0].sourceCurrent,false);
 assert.equal(r.items[0].draft,null);
 assert.equal(r.items[0].courtOrderSatisfied,false);
});
test("non-human actor and synthetic provenance are forbidden to grant item review",async()=>{
 const {data,db,draft}=setup();
 await assert.rejects(()=>upsertCourtCorrectionItem(db,{data,draft,actorId:"private-site-service"}),/CORRECTION_HUMAN_REQUIRED/);
 data.structuredTest={mode:"assumed_extracted_synthetic",sourceRecords:[]};
 assert.throws(()=>validateCorrectionItemDraft(data,draft),/CORRECTION_SYNTHETIC_CASE_WRITE_FORBIDDEN/);
});

test("mutated court deadline source is invalidated on read without deleting historical item",async()=>{
 const {data,db,draft}=setup();
 await upsertCourtCorrectionItem(db,{data,draft,actorId:"staff-reviewer"});
 data.facts[0].recognition="unreviewed";
 const stored=await readCourtCorrectionItems(db,data);
 assert.equal(stored.count,1);
 assert.equal(stored.items[0].sourceCurrent,false);
 assert.equal(stored.items[0].courtOrderSatisfied,false);
});
test("revoked response receipt event invalidates current court-correction mapping",async()=>{
 const {data,db,draft}=setup();
 await upsertCourtCorrectionItem(db,{data,draft:{
  ...draft,responseEventId:"received-answer",responseDocumentIds:["answer"],receiptDocumentId:"receipt"
 },actorId:"staff-reviewer"});
 data.workflowState!.procedureEvents=data.workflowState!.procedureEvents.filter(e=>e.id!=="received-answer");
 const stored=await readCourtCorrectionItems(db,data);
 assert.equal(stored.items[0].sourceCurrent,false);
 assert.equal(stored.items[0].courtOrderSatisfied,false);
});

test("a real court correction order with no itemization is explicitly reported as unhandled",async()=>{
 const {data,db}=setup();
 const r=await readCourtCorrectionItems(db,data);
 assert.equal(r.actualOrderCount,1);
 assert.deepEqual(r.unitemizedCourtEventIds,["court-order"]);
 assert.equal(r.unresolvedCourtItemCount,1);
});
