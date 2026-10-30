import test from "node:test";
import assert from "node:assert/strict";
import precedents from "./fixtures/preapproval-judicial-precedents-20261030.json" with {type:"json"};
import {LEGAL_CATALOG} from "../lib/legal-rules.ts";
import exceptions from "../lib/legal-exceptions.json" with {type:"json"};
import {buildPreApprovalReadiness} from "../lib/approval-readiness.ts";
import {createCase} from "../lib/domain.ts";

const rules=new Set(LEGAL_CATALOG.map(x=>x.id)),scenarios=new Set(exceptions.scenarios.map(x=>x.id));
test("3 actual Supreme Court precedents map only to registered preapproval issues",()=>{
 assert.equal(precedents.cases.length,3);
 const ids=precedents.cases.map(c=>c.id);
 assert.equal(new Set(ids).size,ids.length);
 for(const row of precedents.cases){
  assert.ok(row.ruleIds.every(id=>rules.has(id)),row.id);
  assert.ok(row.exceptionIds.every(id=>scenarios.has(id)),row.id);
  assert.ok(row.sourceUrl.startsWith("https://"),row.id);
  assert.ok(row.requiredChecks.length>=4,row.id);
  assert.ok(row.prohibitedInferences.includes("court_approval_granted"),row.id);
 }
});
test("a pending correction is recorded but does not establish that the court will dismiss or approve",()=>{
 const data=createCase("synthetic public precedent","synthetic-2015ma657","2026-10-30");
 data.workflowState={
  schema:"case-workflow/1",version:1,requirements:[],subjectLinks:[],documentMatches:[],
  tasks:[],legalDispositions:[],procedureEvents:[{
   id:"synthetic-correction",state:"correction_requested",occurredAt:"2026-10-30T00:00:00Z",
   recordedAt:"2026-10-30T00:00:00Z",actor:"court-recorded",sourceDocumentIds:["synthetic-order"],
   courtReference:"synthetic-case-reference",reason:"추가 설명 자료 제출 요청",
   relatedFields:["asset.ownership"],artifactIds:[],
  }],projectionBlockers:[],reviewHistory:[],decisions:[],documentEdits:[],requirementConfirmations:[]
 };
 const r=buildPreApprovalReadiness({
  data,facts:[],assessment:{findings:[],calculation:{traces:[],issues:[],liquidationComparison:"unknown"}} as any,
  sourceHead:{caseRevision:data.context.revision,sourceDataVersion:1,calculationRunId:null,calculationCurrent:false,referenceSha256:null},
  monitor:null,legalReview:null,expectedRiskIds:["KR-PR-049"],
 });
 assert.ok(r.tasks.some(t=>t.id==="court:synthetic-correction"&&t.origin==="recorded_court_event"));
 assert.equal(r.autoApproval,false);
 assert.equal(r.courtDecision,"not_inferred");
 assert.equal(r.approvalProbability,null);
});
