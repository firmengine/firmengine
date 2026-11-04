import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {assertNonSourceCaseChange} from "../lib/case-mutation-classifier.ts";
import type {CaseData} from "../lib/domain.ts";
const sample=():CaseData=>({
 context:{id:"synthetic-1",revision:3,asOf:"2026-10-30",courtId:"seoul"},
 facts:[{id:"fact-1",value:"1000000"}],
 workflowState:{schema:"case-workflow/1",version:1,requirements:[],documentMatches:[],
   legalDispositions:[],documentEdits:[],tasks:[]},
 exportManifest:{caseRevision:3,mode:"final",files:[{id:"doc-a",status:"current",hash:"hash"}],
   reviews:{caseworker:null,lawyer:null}}
} as unknown as CaseData);
test("lawyer disposition is a workflow mutation, not a source revision",()=>{
 const a=sample(),b=structuredClone(a);b.workflowState!.version+=1;
 b.workflowState!.legalDispositions.push({checkId:"DOC-01",status:"accepted",role:"lawyer"} as any);
 assert.doesNotThrow(()=>assertNonSourceCaseChange(a,b,"review_only","legalCheck.dispose"));
 b.facts[0].value="2000000";
 assert.throws(()=>assertNonSourceCaseChange(a,b,"review_only","legalCheck.dispose"),/CHANGED_EVIDENCE/);
});
test("manifest review and edited prose do not bypass source mutations",()=>{
 const a=sample(),b=structuredClone(a);b.workflowState!.version+=1;
 b.exportManifest!.reviews.lawyer={actor:"lawyer"} as any;
 assert.doesNotThrow(()=>assertNonSourceCaseChange(a,b,"review_only","document.review"));
 const d=structuredClone(a);d.workflowState!.version++;d.workflowState!.documentEdits.push({id:"edit"} as any);
 d.exportManifest!.files[0].status="invalidated";assert.doesNotThrow(()=>assertNonSourceCaseChange(a,d,"review_only","document.edit"));
 const f=structuredClone(a);f.exportManifest!.files=[{id:"new-doc",status:"current",hash:"other"}] as any;
 assert.throws(()=>assertNonSourceCaseChange(a,f,"review_only","document.review"),/CHANGED_EVIDENCE/);
});
test("generated artifacts only may change the manifest; an incoming source value may not",()=>{
 const a=sample(),b=structuredClone(a);b.exportManifest!.files=[{id:"generated",status:"current",hash:"g"}] as any;
 assert.doesNotThrow(()=>assertNonSourceCaseChange(a,b,"artifact_only"));
 b.facts[0].value="changed";
 assert.throws(()=>assertNonSourceCaseChange(a,b,"artifact_only"),/CHANGED_EVIDENCE/);
 assert.throws(()=>assertNonSourceCaseChange(a,a,"artifact_only"),/PREVIOUS_SNAPSHOT_REQUIRED/);
});
test("migration keeps normal source notifications but excludes strictly guarded review/manifest writes",()=>{
 const db=new DatabaseSync(":memory:");
 try{
   db.exec("CREATE TABLE cases(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,payload TEXT NOT NULL,storage_token TEXT NOT NULL);");
   db.exec("CREATE TABLE case_data_change_events(id INTEGER PRIMARY KEY,case_id TEXT,table_name TEXT,row_id TEXT,operation TEXT,event_kind TEXT,case_revision INTEGER,changed_at TEXT);");
   db.exec("INSERT INTO cases(id,revision,payload,storage_token) VALUES('synthetic',1,'{}','t1');");
   const sql=readFileSync(new URL("../drizzle/0021_workflow_only_source_watch.sql",import.meta.url),"utf8");
   db.exec(sql.replaceAll("--> statement-breakpoint",""));
   const events=()=>Number((db.prepare("SELECT COUNT(*) AS total FROM case_data_change_events").get() as any).total);
   db.exec("UPDATE cases SET payload='{\"review\":1}',storage_token='t2',mutation_category='review_only' WHERE id='synthetic';");
   db.exec("UPDATE cases SET mutation_category='source' WHERE id='synthetic';");
   assert.equal(events(),0);
   db.exec("UPDATE cases SET payload='{\"source\":2}',storage_token='t3' WHERE id='synthetic';");
   assert.equal(events(),1);
   db.exec("UPDATE cases SET payload='{\"artifact\":1}',storage_token='t4',mutation_category='artifact_only' WHERE id='synthetic';");
   db.exec("UPDATE cases SET mutation_category='source' WHERE id='synthetic';");
   assert.equal(events(),1);
   db.exec("UPDATE cases SET revision=revision+1,payload='{\"source\":3}',storage_token='t5' WHERE id='synthetic';");
   assert.equal(events(),2);
 }finally{db.close();}
});


test("business income source proposal is an append-only workflow event, not a new source revision",()=>{
 const a=sample();a.workflowState!.businessNetReviews=[];
 const b=structuredClone(a);b.workflowState!.version+=1;
 b.workflowState!.businessNetReviews=[{id:"business-review-1",status:"proposed"} as any];
 assert.doesNotThrow(()=>assertNonSourceCaseChange(a,b,"review_only","business.net.propose"));
 const forged=structuredClone(b);forged.facts[0].value="999999";
 assert.throws(()=>assertNonSourceCaseChange(a,forged,"review_only","business.net.propose"),/CHANGED_EVIDENCE/);
 const changedReview=structuredClone(b);changedReview.workflowState!.businessNetReviews=[{id:"business-review-1",status:"approved"} as any];
 assert.throws(()=>assertNonSourceCaseChange(a,changedReview,"review_only","business.net.propose"),/NOT_APPEND_ONLY/);
 const older=structuredClone(b),next=structuredClone(b);next.workflowState!.version+=1;
 next.workflowState!.businessNetReviews!.push({id:"business-review-2",status:"proposed"} as any);
 assert.doesNotThrow(()=>assertNonSourceCaseChange(older,next,"review_only","business.net.propose"));
 next.workflowState!.businessNetReviews![0]!.status="stale";
 assert.throws(()=>assertNonSourceCaseChange(older,next,"review_only","business.net.propose"),/NOT_APPEND_ONLY/);
});

test("lawyer dispositions cannot rewrite or remove an earlier human review in a review-only save",()=>{
 const before=sample();before.workflowState!.legalDispositions=[{checkId:"prior",status:"accepted",actor:"lawyer-prior"} as any];
 const valid=structuredClone(before);valid.workflowState!.version+=1;
 valid.workflowState!.legalDispositions.push({checkId:"next",status:"accepted",actor:"lawyer-next"} as any);
 assert.doesNotThrow(()=>assertNonSourceCaseChange(before,valid,"review_only","legalCheck.dispose"));
 const forged=structuredClone(valid);forged.workflowState!.legalDispositions[0]!.actor="forged";
 assert.throws(()=>assertNonSourceCaseChange(before,forged,"review_only","legalCheck.dispose"),/LEGAL_DISPOSITION_NOT_APPEND_ONLY/);
 const removed=structuredClone(valid);removed.workflowState!.legalDispositions.shift();
 assert.throws(()=>assertNonSourceCaseChange(before,removed,"review_only","legalCheck.dispose"),/LEGAL_DISPOSITION_NOT_APPEND_ONLY/);
 const addedTwice=structuredClone(valid);addedTwice.workflowState!.legalDispositions.push({checkId:"third",status:"needs_review"} as any);
 assert.throws(()=>assertNonSourceCaseChange(before,addedTwice,"review_only","legalCheck.dispose"),/LEGAL_DISPOSITION_NOT_APPEND_ONLY/);
});

test("document edit saves append one entry and preserve all earlier edits",()=>{
 const before=sample();before.workflowState!.documentEdits=[{id:"prior-edit",value:"original"} as any];
 const valid=structuredClone(before);valid.workflowState!.version+=1;
 valid.workflowState!.documentEdits.push({id:"new-edit",value:"updated"} as any);
 valid.exportManifest!.files[0]!.status="invalidated";
 valid.exportManifest!.reviews={caseworker:null,lawyer:null};
 assert.doesNotThrow(()=>assertNonSourceCaseChange(before,valid,"review_only","document.edit"));
 const forged=structuredClone(valid);(forged.workflowState!.documentEdits[0] as any).value="altered";
 assert.throws(()=>assertNonSourceCaseChange(before,forged,"review_only","document.edit"),/DOCUMENT_EDIT_NOT_APPEND_ONLY/);
 const removed=structuredClone(valid);removed.workflowState!.documentEdits.shift();
 assert.throws(()=>assertNonSourceCaseChange(before,removed,"review_only","document.edit"),/DOCUMENT_EDIT_NOT_APPEND_ONLY/);
 const extra=structuredClone(valid);extra.workflowState!.documentEdits.push({id:"third"} as any);
 assert.throws(()=>assertNonSourceCaseChange(before,extra,"review_only","document.edit"),/DOCUMENT_EDIT_NOT_APPEND_ONLY/);
});
