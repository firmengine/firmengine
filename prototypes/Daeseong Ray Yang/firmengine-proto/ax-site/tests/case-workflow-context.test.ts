import test from "node:test";
import assert from "node:assert/strict";
import {collectCaseWorkflowPageTypes,currentCaseWorkflowContext} from "../lib/case-workflow-context.ts";

test("same page with two conflicting document families is explicitly unknown",()=>{
 const page=collectCaseWorkflowPageTypes([
  {documentId:"doc-1",page:1,documentTypeId:"salary"},
  {documentId:"doc-1",page:1,documentTypeId:"bank"},
  {documentId:"doc-2",page:2,documentTypeId:"debt"},
  {documentId:"doc-2",page:2,documentTypeId:"debt"}
 ]);
 assert.deepEqual(page,[
  {documentId:"doc-1",page:1,documentTypeId:null},
  {documentId:"doc-2",page:2,documentTypeId:"debt"}
 ]);
});
test("empty type is not silently certified as a matching primary proof",()=>{
 assert.deepEqual(collectCaseWorkflowPageTypes([{documentId:"doc-1",page:3,documentTypeId:null}]),
  [{documentId:"doc-1",page:3,documentTypeId:null}]);
 assert.throws(()=>collectCaseWorkflowPageTypes([{documentId:"doc",page:-1,documentTypeId:"debt"}]),/PAGE_SCOPE/);
});
function mockDB(input:{runId:string|null;catalogVersion:number|null;alertCount:number;pageTypes:{documentId:string;page:number;documentTypeId:string|null}[]}){
 return {prepare(sql:string){
  let args:unknown[]=[];
  const query={bind(...values:unknown[]){args=values;return query;},async all<T>(){
    if(sql.includes("document_instances"))return {results:input.pageTypes as T[]};
    throw new Error("unexpected query "+sql);
  },async first<T>(){
   if(sql.includes("legal_monitor_alerts"))return {count:input.alertCount,latest:"2026-10-30T00:00:00Z"} as T;
   if(sql.includes("consultation_heads"))return {runId:input.runId,catalogVersion:input.catalogVersion} as T;
   throw new Error("unexpected query "+sql);
  }};
  return query;
 }} as unknown as D1Database;
}
test("staff / legal / final export consult the same current run, page identities and policy state",async()=>{
 const data={
  runId:"consult-new",catalogVersion:85,alertCount:1,
  pageTypes:[{documentId:"salary-1",page:1,documentTypeId:"payroll"}]
 };
 const shared=await currentCaseWorkflowContext(mockDB(data),"synthetic-case",85);
 assert.equal(shared.activeIntakeRunId,"consult-new");
 assert.equal(shared.activeIntakeCatalogVersion,85);
 assert.equal(shared.pendingCourtPolicyChange,true);
 assert.equal(shared.pageTypes[0].documentTypeId,"payroll");
});
test("a stale or absent consultation cannot silently make older substitutes current",async()=>{
 const stale=await currentCaseWorkflowContext(mockDB({
  runId:null,catalogVersion:null,alertCount:0,pageTypes:[]
 }),"synthetic-case",85);
 assert.equal(stale.activeIntakeRunId,null);
 assert.equal(stale.activeIntakeCatalogVersion,null);
 assert.deepEqual(stale.pageTypes,[]);
 // reconcileDocumentSubstitution sees current run explicitly, not undefined.
 assert.notEqual(stale.activeIntakeRunId,"prior-consultation-run");
});
