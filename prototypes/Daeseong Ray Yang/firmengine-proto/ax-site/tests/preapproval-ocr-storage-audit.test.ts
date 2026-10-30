import test from "node:test";
import assert from "node:assert/strict";
import {createCase,type CaseData} from "../lib/domain.ts";
import canonical from "../lib/canonical-field-id-index.json" with {type:"json"};
import {inspectPreapprovalOcrStorage} from "../lib/preapproval-ocr-storage-audit.ts";

const hash="a".repeat(64);
function fixture(pages:number[]=[1]):CaseData {
 const d=createCase("synthetic OCR source audit","synthetic-ocr-case","2026-10-30");
 d.documents=[{id:"doc",name:"synthetic.pdf",sha256:hash,status:"active",pages}];
 d.pages=pages.map(page=>({documentId:"doc",page,role:"evidence",text:"synthetic"}));
 return d;
}
function database(data:CaseData,options:{
 heads?:Array<Record<string,unknown>>;
 coverage?:Array<Record<string,unknown>>;
 fail?:boolean;
}={}){
 const defaultHeads=[{documentId:"doc",page:1,headCaseRevision:data.context.revision,sourceHash:hash,stage:"committed",dbHash:hash}];
 const defaultCoverage=[{canonicalFieldId:canonical.ids[0],schemaSlots:1,observed:1,requiresReview:0,notObservedSlots:0}];
 return {prepare(sql:string){
  if(options.fail)throw Error("SYNTHETIC_SQL_UNAVAILABLE");
  return {bind(...args:unknown[]){
   assert.equal(args[0],data.context.id);
   assert.equal(args[1],data.context.id);
   return {async all(){
    return {results:sql.includes("SELECT c.canonical_field_id AS canonicalFieldId")?
      options.coverage??defaultCoverage:options.heads??defaultHeads};
   }};
  }};
 }} as unknown as D1Database;
}
test("actual committed OCR status counts only active source pages and registered field IDs",async()=>{
 const d=fixture(),result=await inspectPreapprovalOcrStorage(database(d),d);
 assert.equal(result.status,"observed_page_coverage_only");
 assert.equal(result.registeredCanonicalCount,693);
 assert.equal(result.expectedEvidencePages,1);
 assert.equal(result.currentCommittedPages,1);
 assert.equal(result.byCanonicalField[0].canonicalFieldId,canonical.ids[0]);
 assert.equal(result.byCanonicalField[0].status,"observed_source_only");
 assert.equal(result.legalAcceptanceInferred,false);
 assert.equal(result.sourceVerificationInferred,false);
});
test("missing second source page is an explicit gap, not a completed OCR case",async()=>{
 const d=fixture([1,2]),result=await inspectPreapprovalOcrStorage(database(d),d);
 assert.equal(result.status,"source_integrity_or_page_gap");
 assert.deepEqual(result.missingOrInvalidPages.map(x=>x.page),[2]);
});
test("bad source hash or uncommitted OCR heads cannot be used for legal readiness",async()=>{
 const d=fixture(),result=await inspectPreapprovalOcrStorage(database(d,{heads:[{documentId:"doc",page:1,headCaseRevision:d.context.revision,
  sourceHash:"z".repeat(64),dbHash:hash,stage:"committed"}]}),d);
 assert.equal(result.status,"source_integrity_or_page_gap");
 assert.equal(result.currentCommittedPages,0);
 assert.equal(result.unexpectedOrInvalidHeads.length,1);
});
test("unknown extra canonical OCR ID is never silently accepted",async()=>{
 const d=fixture(),result=await inspectPreapprovalOcrStorage(database(d,{coverage:[
  {canonicalFieldId:"fiction::not_registered",schemaSlots:1,observed:1,requiresReview:0,notObservedSlots:0}]}),d);
 assert.equal(result.status,"source_integrity_or_page_gap");
 assert.deepEqual(result.unknownCanonicalIds,["fiction::not_registered"]);
});
test("no active source is different from 693 missing or legally irrelevant facts",async()=>{
 const d=fixture();d.documents[0].status="deleted";
 const result=await inspectPreapprovalOcrStorage(database(d),d);
 assert.equal(result.status,"no_active_documents");
 assert.equal(result.registeredCanonicalCount,693);
 assert.equal(result.applicableCanonicalCount,0);
 assert.equal(result.expectedEvidencePages,0);
});
test("raw OCR error cannot be reported as a legally complete case",async()=>{
 const d=fixture();
 await assert.rejects(()=>inspectPreapprovalOcrStorage(database(d,{fail:true}),d),/SYNTHETIC_SQL_UNAVAILABLE/);
});
