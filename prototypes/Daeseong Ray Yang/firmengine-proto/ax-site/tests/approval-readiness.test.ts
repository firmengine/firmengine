import test from "node:test";
import assert from "node:assert/strict";
import {buildPreApprovalReadiness,verifyStoredApprovalCalculationOutputs,type ApprovalReadinessInput} from "../lib/approval-readiness.ts";

function input():ApprovalReadinessInput{
 return {
  data:{
   context:{id:"synthetic-case",revision:4},
   documents:[{id:"doc-1",status:"active",name:"synthetic",sha256:"fake",pages:[1]}],
   workflowState:{procedureEvents:[]},
  } as unknown as ApprovalReadinessInput["data"],
  facts:[{id:"fact-net",key:"income.net",subjectId:"income-1",state:"verified",recognition:"accepted",
   periodStart:"2026-01-01",periodEnd:"2026-01-31",
   numeric:{normalizationStatus:"exact",amountWon:"3000000"},
   refs:[{documentId:"doc-1",page:1,sourceHash:"fake"}]}] as unknown as ApprovalReadinessInput["facts"],
  assessment:{
   findings:[{id:"feature-1",category:"evidence",outcome:"unknown",title:"지출 확인 필요",
    detail:"합성 미확정 지출",factIds:[],ruleSourceIds:[],nextAction:"기간·금액 확인"}],
   calculation:{issues:["RECOGNIZED_LIVING_COST_MISSING"],
    monthlyIncomeWon:"3000000",recognizedLivingCostWon:null,
    disposableIncomeWon:null,ordinaryRepaymentBudgetWon:null,
    totalDebtWon:"10000000",liquidationValueWon:null,
    planTotalWon:null,presentValueWon:null,liquidationComparison:"unknown",
    traces:[{id:"ordinary_budget",title:"변제예산",formula:"소득-생계비-비용",status:"blocked",resultWon:null,
     reasons:["missing living cost"],inputs:[
      {label:"소득",value:"3000000",factIds:["fact-net"]},
      {label:"생계비",value:null,factIds:[]},
     ]}]},
  } as unknown as ApprovalReadinessInput["assessment"],
  sourceHead:{caseRevision:4,sourceDataVersion:8,calculationRunId:"calc-1",calculationCurrent:true,referenceSha256:"ref-1"},
  monitor:{consultationChecklistMaterialized:true,consultationStatus:"current",workflowAdopted:true,
   workflowProjectionStatus:"current",unclassifiedPageJobs:0,requirements:[],
   workflowRequests:[{requirementId:"req-1",documentTypeId:"bank_statement",requiredPeriod:"2026-01",
    activeRequest:true,requirementStatus:"partial",substitutionStatus:"none",
    statusSource:"live_source_and_court_projection",sourceProofFields:["bank::balance"]}]},
  legalReview:{runId:"legal-1",complete:true,headStale:false,caseRevision:4,
   currentDataVersion:8,dataVersion:8,calculationRunId:"calc-1",
   expectedCheckIds:["DOC-01","COND-01"],checks:[
    {id:"DOC-01",status:"legal_review",reason:"변호사 검토",factIds:[],ruleIds:["KR-PR-011"],missingDocuments:[],nextAction:"검토"},
    {id:"COND-01",status:"missing",reason:"합성 증거누락",factIds:[],ruleIds:["KR-PR-027"],missingDocuments:["잔액증명서"],nextAction:"서류 요청"},
   ]},
  expectedRiskIds:["DOC-01","COND-01"],riskTitles:{"DOC-01":"신청서","COND-01":"재산"},
 };
}
test("existing fact amounts and formula trace are visible; missing never becomes zero",()=>{
 const r=buildPreApprovalReadiness(input());
 assert.equal(r.calculation.headline.monthlyIncomeWon,"3000000");
 assert.equal(r.calculation.headline.recognizedLivingCostWon,null);
 assert.equal(r.calculation.traces[0].formula,"소득-생계비-비용");
 assert.deepEqual(r.calculation.traces[0].inputs[0].factStates,[{id:"fact-net",state:"verified",recognition:"accepted"}]);
 assert.ok(r.calculation.missingInputQuestions.some(x=>x.inputLabel==="생계비"&&!x.simulationExecuted));
 assert.ok(r.tasks.some(x=>x.id==="trace:ordinary_budget"));
 assert.equal(r.courtDecision,"not_inferred");
 assert.equal(r.approvalProbability,null);
 assert.equal(r.autoApproval,false);
});
test("predicted correction differs from registered court correction",()=>{
 const d=input();
 d.data.workflowState!.procedureEvents.push({state:"correction_requested",id:"court-1",occurredAt:"2026-10-30",
  recordedAt:"2026-10-30",actor:"clerk",courtReference:"synthetic-court",reason:"synthetic correction",
  sourceDocumentIds:["doc-1"],relatedFields:[],artifactIds:[]});
 const r=buildPreApprovalReadiness(d);
 assert.equal(r.tasks.find(x=>x.id==="workflow:req-1")?.origin,"internal_candidate");
 assert.equal(r.tasks.find(x=>x.id==="workflow:req-1")?.isOfficialCourtCorrectionOrder,false);
 assert.equal(r.tasks.find(x=>x.id==="court:court-1")?.origin,"recorded_court_event");
 assert.equal(r.tasks.find(x=>x.id==="court:court-1")?.isOfficialCourtCorrectionOrder,true);
 assert.ok(r.tasks.some(x=>x.id==="risk:COND-01"&&x.nextAction.includes("잔액증명서")));
});
test("stale legal and missing document monitor fail closed",()=>{
 const d=input();d.legalReview!.headStale=true;d.monitor=null;
 const r=buildPreApprovalReadiness(d);
 assert.equal(r.legalReview.current,false);
 assert.equal(r.legalReview.reviewed,0);
 assert.ok(r.tasks.some(x=>x.id==="legal:head"));
 assert.ok(r.tasks.some(x=>x.id==="monitor:unavailable"));
});
test("OCR document candidate and unadopted consultation never grant fulfillment",()=>{
 const d=input();d.monitor!.workflowAdopted=false;d.monitor!.workflowRequests=[];
 d.monitor!.requirements=[{requirementId:"intake-1",documentTypeId:"payroll",documentName:"급여명세",
  period:"2026-01",requirement:"required_when_applicable",status:"requested",fieldPlanStatus:"materialized",
  observed:{stage:"ocr_committed_candidate",candidatePageCount:1,committedOcrPageCount:1}}];
 const r=buildPreApprovalReadiness(d);
 assert.ok(r.tasks.some(x=>x.id==="intake:intake-1"&&x.reason.includes("후보")));
 assert.ok(r.tasks.some(x=>x.id==="consultation:adoption"));
});
test("exclude any case with an approval or later terminal event",()=>{
 const d=input();d.data.workflowState!.procedureEvents.push({state:"approved",id:"court-approved",occurredAt:"2026-10-30",
  recordedAt:"2026-10-30",actor:"clerk",courtReference:"synthetic-court",reason:"synthetic decision",
  sourceDocumentIds:["doc-1"],relatedFields:[],artifactIds:[]});
 const r=buildPreApprovalReadiness(d);
 assert.equal(r.status,"out_of_scope");
 assert.equal(r.outOfScope,true);
 assert.deepEqual(r.tasks,[]);
 assert.equal(r.approvalProbability,null);
});
test("source confirmed zero and disputed amount remain distinct",()=>{
 const d=input();d.facts=[
  {...d.facts[0],id:"zero",numeric:{normalizationStatus:"exact",amountWon:"0"}},
  {...d.facts[0],id:"conflict",state:"disputed",recognition:"unreviewed",numeric:{normalizationStatus:"exact",amountWon:"500000"}},
 ];
 const r=buildPreApprovalReadiness(d);
 assert.ok(r.evidence.featureInventory.some(f=>f.id==="zero"&&f.amountWon==="0"));
 assert.ok(r.evidence.featureInventory.some(f=>f.id==="conflict"&&f.state==="disputed"));
 assert.equal(r.evidence.rejectedOrDisputedFacts,1);
});

test("discontinued before approval remains an in-scope pre-approval branch, not approved",()=>{
 const d=input();d.data.workflowState!.procedureEvents.push({state:"discontinued",id:"discontinued-1",
  occurredAt:"2026-10-30",recordedAt:"2026-10-30",actor:"clerk",courtReference:"synthetic-court",
  reason:"synthetic pre-approval discontinuance",sourceDocumentIds:["doc-1"],relatedFields:[],artifactIds:[]});
 const r=buildPreApprovalReadiness(d);
 assert.equal(r.outOfScope,false);
 assert.notEqual(r.status,"out_of_scope");
 assert.equal(r.autoApproval,false);
});

test("persisted financial outputs must exactly replay null and string amounts, not guess zeros",()=>{
 const d=input(),amounts=["monthlyIncomeWon","recognizedLivingCostWon"] as const;
 const rows=[
  {outputName:"monthlyIncomeWon",valueJson:JSON.stringify("3000000"),status:"computed"},
  {outputName:"recognizedLivingCostWon",valueJson:"null",status:"missing"},
 ];
 assert.equal(verifyStoredApprovalCalculationOutputs(d.assessment.calculation,rows,amounts).current,true);
 assert.ok(verifyStoredApprovalCalculationOutputs(d.assessment.calculation,[
  {...rows[0],valueJson:JSON.stringify("0")},rows[1]],amounts).issues.includes("CALCULATION_REPLAY_MISMATCH:monthlyIncomeWon"));
 assert.ok(verifyStoredApprovalCalculationOutputs(d.assessment.calculation,[rows[0]],amounts)
  .issues.includes("MISSING_OR_DUPLICATE_STORED_CALCULATION:recognizedLivingCostWon"));
 assert.equal(verifyStoredApprovalCalculationOutputs(d.assessment.calculation,[rows[0],rows[1],rows[1]],amounts).current,false);
});
test("malformed stored calculations cannot clear current approval check",()=>{
 const d=input(),r=verifyStoredApprovalCalculationOutputs(d.assessment.calculation,
  [{outputName:"monthlyIncomeWon",valueJson:"not-json",status:"computed"}],["monthlyIncomeWon"]);
 assert.equal(r.current,false);
 assert.ok(r.issues.includes("MALFORMED_STORED_CALCULATION:monthlyIncomeWon"));
});
