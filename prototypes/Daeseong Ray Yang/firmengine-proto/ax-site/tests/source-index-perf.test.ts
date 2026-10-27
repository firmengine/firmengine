import test from "node:test";
import assert from "node:assert/strict";
import { createCase, createCaseReadIndex, currentFacts, factSourceLineageIssues, validSourceRef } from "../lib/domain.ts";

test("large request-scoped source index groups facts once and memoizes lineage per current fact",()=>{
  const data=createCase("Synthetic large source index","synthetic-source-index","2026-10-27");
  data.documents=[{id:"doc",name:"synthetic evidence",sha256:"a".repeat(64),status:"active",pages:[1]}];
  data.pages=[{documentId:"doc",page:1,role:"evidence"}];
  const ref={documentId:"doc",page:1,quote:"quoted synthetic field"};
  for(let i=0;i<4000;i++)data.facts.push({id:"f"+i,logicalId:"f"+i,version:1,subjectId:"s"+i,key:"synthetic.field",value:"synthetic",state:"extracted",recognition:"unreviewed",refs:[ref],validation:[]});
  const index=createCaseReadIndex(data);
  assert.equal(currentFacts(data,index).length,4000);
  for(const fact of index.current)assert.deepEqual(factSourceLineageIssues(data,[fact.id],index),["SOURCE_VERIFICATION_REQUIRED"]);
  assert.equal(index.lineageById.size,4000);
  for(const fact of index.current)factSourceLineageIssues(data,[fact.id],index);
  assert.equal(index.lineageById.size,4000,"repeat calls reuse only this explicit request index");
  assert.equal(validSourceRef(data,ref,index),true);
});

test("indexes do not leak across snapshots after in-place source edits and cloned cases",()=>{
  const data=createCase("Synthetic source mutation","synthetic-source-mutation","2026-10-27");
  data.documents=[{id:"doc",name:"synthetic evidence",sha256:"b".repeat(64),status:"active",pages:[1]}];
  data.pages=[{documentId:"doc",page:1,role:"evidence"}];
  const ref={documentId:"doc",page:1,sourceHash:"b".repeat(64),quote:"quoted synthetic field"};
  data.facts=[{id:"f",logicalId:"f",version:1,subjectId:"s",key:"synthetic.field",value:"synthetic",state:"verified",recognition:"unreviewed",refs:[ref],validation:[]}];
  const prior=createCaseReadIndex(data);
  assert.deepEqual(factSourceLineageIssues(data,["f"],prior),[]);
  const next=structuredClone(data);
  next.documents[0].status="deleted";
  const fresh=createCaseReadIndex(next);
  assert.ok(factSourceLineageIssues(next,["f"],fresh).includes("SOURCE_REFERENCE_INVALID"));
  assert.throws(()=>currentFacts(next,prior),/different case snapshot/);
});
