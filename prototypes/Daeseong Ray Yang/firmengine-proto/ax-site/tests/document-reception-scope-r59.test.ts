import test from "node:test";
import assert from "node:assert/strict";
import { aggregateDocumentReception, type DocumentReceptionInput } from "../lib/document-fulfillment.ts";

// All data are synthetic and do not represent actual submitted documents.
const document={id:"doc-A",status:"active" as const,originalReady:true,pagesReady:true};
const page=(documentId:string,n:number,status="completed")=>({documentId,page:n,role:"evidence",status,imageReady:true});
const receive=(pages:DocumentReceptionInput["pages"],requiredPages:number[],fieldIssues:DocumentReceptionInput["fieldIssues"]=[]) =>
  aggregateDocumentReception({document,pages,requiredPages,fieldIssues,sourceRevision:"synthetic-1"});
test("a foreign document's same page number cannot satisfy the requested document",()=>{
  const view=receive([page("doc-B",1)],[1]);
  assert.equal(view.primaryStatus,"attention_required");
  assert.deepEqual(view.requiredPageCoverage.completed,[]);
  assert.deepEqual(view.requiredPageCoverage.missing,[1]);
  assert.ok(view.readingIssues.some(x=>x.code==="document_scope_mismatch"));
});
test("mixed A page 1 and B page 2 do not complete a two-page A request",()=>{
  const view=receive([page("doc-A",1),page("doc-B",2)],[1,2]);
  assert.equal(view.primaryStatus,"attention_required");
  assert.deepEqual(view.requiredPageCoverage.completed,[1]);
  assert.deepEqual(view.requiredPageCoverage.missing,[2]);
});
test("a foreign failed row remains a scope error rather than changing A counts",()=>{
  const view=receive([page("doc-A",1),page("doc-B",3,"review_required")],[1]);
  assert.equal(view.primaryStatus,"attention_required");
  assert.deepEqual(view.processingCountsByStatus,{completed:1});
  assert.ok(view.readingIssues.some(x=>x.code==="document_scope_mismatch"));
});
test("foreign field issues are not attributed to the local document",()=>{
  const view=receive([page("doc-A",1)],[1],[{documentId:"doc-B",page:1,fieldId:"synthetic",required:true,state:"missing"}]);
  assert.equal(view.primaryStatus,"attention_required");
  assert.ok(view.readingIssues.some(x=>x.code==="document_scope_mismatch"));
  assert.ok(!view.readingIssues.some(x=>x.code==="field_missing"));
});
test("one and two locally complete pages remain readable",()=>{
  for(const pages of [[page("doc-A",1)],[page("doc-A",1),page("doc-A",2)]]){
    const view=receive(pages,pages.map(x=>x.page));
    assert.equal(view.primaryStatus,"read_complete");
    assert.deepEqual(view.requiredPageCoverage.completed,pages.map(x=>x.page));
    assert.ok(!view.readingIssues.some(x=>x.code==="document_scope_mismatch"));
  }
});
test("missing local source page is not replaced by unknown zero or foreign page",()=>{
  const view=receive([], [1]);
  assert.equal(view.primaryStatus,"attention_required");
  assert.deepEqual(view.requiredPageCoverage.missing,[1]);
});
