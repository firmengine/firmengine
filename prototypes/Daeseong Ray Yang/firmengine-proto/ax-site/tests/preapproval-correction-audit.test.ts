import test from "node:test";
import assert from "node:assert/strict";
import {createCase,type CaseData,type Fact} from "../lib/domain.ts";
import {auditPreapprovalCourtCorrections} from "../lib/preapproval-correction-audit.ts";

function fixture():{data:CaseData;facts:Fact[];valid:Set<string>} {
 const data=createCase("synthetic court correction","synthetic-cor-1","2026-10-30");
 data.documents=[{id:"court-order",name:"synthetic-court-order.pdf",sha256:"c".repeat(64),status:"active",pages:[1]},
  {id:"bank",name:"synthetic-bank.pdf",sha256:"a".repeat(64),status:"active",pages:[1]}];
 data.workflowState={schema:"case-workflow/1",version:1,requirements:[],subjectLinks:[],documentMatches:[],tasks:[],
  legalDispositions:[],procedureEvents:[{
   id:"cor-1",state:"correction_requested",occurredAt:"2026-10-29T00:00:00.000Z",
   recordedAt:"2026-10-29T00:00:00.000Z",actor:"court",courtReference:"synthetic-ref",
   sourceDocumentIds:["court-order"],reason:"payroll and asset docs",relatedFields:["income.net","asset.gross_value"],artifactIds:[],
  }],projectionBlockers:[],reviewHistory:[],decisions:[],documentEdits:[],requirementConfirmations:[]};
 const fact=(id:string,key:string,value:string):Fact=>({id,logicalId:id,version:1,subjectId:"synthetic",key,value,
  state:"verified",recognition:"accepted",refs:[{documentId:"bank",page:1,quote:"synthetic",sourceHash:"a".repeat(64)}],
  validation:[]});
 const facts=[fact("income-1","income.net","3200000"),fact("asset-1","asset.gross_value","1000000"),
  fact("deadline-1","court.correctionDeadline","2026-11-12")];
 return {data,facts,valid:new Set(["income-1","deadline-1"])};
}
test("per-item checks report verified wage vs unreviewed asset without satisfying a court order",()=>{
 const {data,facts,valid}=fixture();
 const r=auditPreapprovalCourtCorrections(data,facts,valid);
 assert.equal(r.courtOrderCount,1);
 assert.equal(r.orders[0].itemizationState,"itemized_candidate_needs_human_mapping");
 assert.equal(r.orders[0].requestedFields[0].status,"verified_evidence_candidate");
 assert.equal(r.orders[0].requestedFields[1].status,"unreviewed_or_conflicting_evidence");
 assert.equal(r.orders[0].courtOrderSatisfied,false);
 assert.equal(r.orders[0].disposition,"missing_or_unreviewed_correction_evidence");
});
test("deadline date from a fact is candidate only until specifically linked to that court order",()=>{
 const {data,facts,valid}=fixture();
 const r=auditPreapprovalCourtCorrections(data,facts,valid);
 assert.equal(r.orders[0].deadlineEvidenceCandidates[0].date,"2026-11-12");
 assert.equal(r.orders[0].deadlineAssignedToThisOrder,false);
 assert.equal(r.orders[0].responseToThisOrderConfirmed,false);
});
test("a correction event lacking an original active court document is explicitly blocked",()=>{
 const {data,facts,valid}=fixture();
 data.documents[0].status="deleted";
 const order=auditPreapprovalCourtCorrections(data,facts,valid).orders[0];
 assert.deepEqual(order.missingCourtDocuments,["court-order"]);
 assert.equal(order.disposition,"court_order_source_or_itemization_missing");
});
test("unitemized order must not be considered satisfied even if numeric facts exist",()=>{
 const {data,facts,valid}=fixture();data.workflowState!.procedureEvents[0].relatedFields=[];
 const order=auditPreapprovalCourtCorrections(data,facts,valid).orders[0];
 assert.equal(order.itemizationState,"unitemized_court_order");
 assert.equal(order.courtOrderSatisfied,false);
});
test("a later amended event is NOT automatically joined to a correction without order identity",()=>{
 const {data,facts,valid}=fixture();
 data.workflowState!.procedureEvents.push({...data.workflowState!.procedureEvents[0],state:"amended",id:"cor-answer",
  sourceDocumentIds:["bank"],relatedFields:["income.net"]});
 const r=auditPreapprovalCourtCorrections(data,facts,valid);
 assert.equal(r.unboundAmendmentCount,1);
 assert.deepEqual(r.orders[0].unrelatedAmendmentEvents,["cor-answer"]);
 assert.equal(r.orders[0].responseToThisOrderConfirmed,false);
});
test("no actual court correction results in no official requested action",()=>{
 const {data,facts,valid}=fixture();data.workflowState!.procedureEvents=[];
 const r=auditPreapprovalCourtCorrections(data,facts,valid);
 assert.equal(r.courtOrderCount,0);assert.deepEqual(r.orders,[]);
});
