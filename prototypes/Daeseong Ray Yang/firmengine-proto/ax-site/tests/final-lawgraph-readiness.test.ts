import test from "node:test";
import assert from "node:assert/strict";
import {finalLawgraphBlockers,type FinalLegalInputs} from "../lib/final-lawgraph-readiness.ts";
const ready=():FinalLegalInputs=>({
 review:{runId:"legal-1",complete:true,headStale:false,currentDataVersion:2,currentCaseRevision:3,caseRevision:3,
  calculationRunId:"calc-1",inputSha256:"a".repeat(64),expectedCheckIds:["R1","R2"],documentFieldCount:3,
  checks:[{id:"R1",status:"pass",factIds:["f1"]},{id:"R2",status:"legal_review",factIds:["f2"]}]},
 currentCaseRevision:3,calculationRunId:"calc-1",calculationInputSha256:"a".repeat(64),
 currentReferenceSha256:"b".repeat(64),calculationReferenceSha256:"b".repeat(64),
 expected:[{id:"R1",required_features:["income.net"],implementation:{may_auto_clear:true}},{id:"R2",required_features:[],implementation:{may_auto_clear:false}}],
 humanDispositions:[{checkId:"R2",state:"current",disposition:"accepted"}]
});
test("current immutable legal and calculator run may pass internal final-review gate",()=>assert.deepEqual(finalLawgraphBlockers(ready()),[]));
test("95-item catalog incompleteness and outdated source or reference block final copy",()=>{
 const a=ready();a.review.checks.pop();assert.ok(finalLawgraphBlockers(a).some(v=>v.includes("LAWGRAPH_CHECK_MISSING")));
 const b=ready();b.review.headStale=true;b.calculationReferenceSha256="c".repeat(64);
 const problems=finalLawgraphBlockers(b);
 assert.ok(problems.includes("LAWGRAPH_SOURCE_VERSION_STALE"));assert.ok(problems.includes("LAWGRAPH_REFERENCE_RELEASE_STALE"));
});
test("AI-only manual checks cannot replace lawyer review, rejected/stale human review is blocked",()=>{
 const a=ready();a.humanDispositions=[];assert.ok(finalLawgraphBlockers(a).some(v=>v==="LAWGRAPH_HUMAN_DECISION_REQUIRED:R2"));
 const b=ready();b.humanDispositions=[{checkId:"R2",state:"stale",disposition:"accepted"}];assert.ok(finalLawgraphBlockers(b).length);
 const c=ready();c.review.checks[1].status="fail";assert.ok(finalLawgraphBlockers(c).some(v=>v==="LAWGRAPH_CHECK_UNRESOLVED:R2:fail"));
});

test("empty persisted form-token lineage blocks final even with passing legal findings",()=>{
 const a=ready();a.review.documentFieldCount=0;
 assert.ok(finalLawgraphBlockers(a).includes("LAWGRAPH_FORM_FIELD_PROJECTION_MISSING"));
});
