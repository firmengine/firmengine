import test from "node:test";
import assert from "node:assert/strict";
import { createCase } from "../lib/domain.ts";
import { reduceCaseCommand } from "../lib/case-commands.ts";
import { PROCEDURE_STATES, validateProcedureEvent } from "../lib/case-procedure-events.ts";

const actor={actor:"reviewer-1",roles:["case_editor","caseworker_review"],at:"2026-10-29T00:00:00.000Z"};
function command(state:string,extra:Record<string,unknown>={}){
 return {commandId:`procedure-${state}`,commandType:"procedure.record" as const,payloadVersion:1 as const,expectedRevision:1,expectedStateFingerprint:`case-state/1:${"a".repeat(64)}`,target:{},patch:{state,occurredAt:"2026-10-28T10:00:00.000Z",sourceDocumentIds:["court-doc"],courtReference:"서울회생법원 2026개회12345",relatedFields:["case.status"],artifactIds:[],...extra},reason:"법원 문서를 확인하여 진행 상태를 기록합니다."};
}
function caseFixture(){
 const data=createCase("Procedure acceptance","procedure-case","2026-10-29");
 data.documents=[{id:"court-doc",name:"Court notice",sha256:"a".repeat(64),status:"active",pages:[1]}];
 data.pages=[{documentId:"court-doc",page:1,role:"evidence",text:"synthetic court notice"}];
 data.exportManifest={caseRevision:1,mode:"draft",requiredKinds:[],files:[],reviews:{caseworker:null,lawyer:null}};
 return data;
}

test("submitted procedure event requires current court evidence and is stored with actor, reason and timestamps",async()=>{
 const data=caseFixture();
 const result=await reduceCaseCommand(data,command("submitted"),actor);
 const event=result.data.workflowState?.procedureEvents[0];
 assert.ok(event);assert.equal(event.state,"submitted");assert.equal(event.actor,actor.actor);assert.equal(event.reason,"법원 문서를 확인하여 진행 상태를 기록합니다.");assert.equal(event.courtReference,"서울회생법원 2026개회12345");assert.deepEqual(event.sourceDocumentIds,["court-doc"]);assert.equal(event.occurredAt,"2026-10-28T10:00:00.000Z");assert.equal(event.recordedAt,actor.at);
});

test("correction request creates a durable court-correction task linked to evidence",async()=>{
 const result=await reduceCaseCommand(caseFixture(),command("correction_requested"),actor);
 assert.equal(result.data.workflowState?.procedureEvents[0]?.state,"correction_requested");
 const task=result.data.workflowState?.tasks.find(item=>item.type==="court_correction");
 assert.ok(task);assert.equal(task.status,"open");assert.deepEqual(task.evidenceIds,["court-doc"]);assert.match(task.reason,/법원 문서/);
});

test("procedure validation rejects missing basis and evidence from another case",()=>{
 const event={id:"event-1",state:"received" as const,occurredAt:"2026-10-28T10:00:00.000Z",recordedAt:actor.at,actor:actor.actor,sourceDocumentIds:[],courtReference:null,reason:"received",relatedFields:[],artifactIds:[]};
 assert.throws(()=>validateProcedureEvent(event,["court-doc"],[]),/법원 절차 상태에는 접수·사건 번호와 근거 문서/);
 assert.throws(()=>validateProcedureEvent({...event,sourceDocumentIds:["foreign-doc"],courtReference:"case-123"},["court-doc"],[]),/같은 사건의 보관 자료/);
});

test("every recorded procedure state preserves the selected evidence and never auto-advances to court approval",()=>{
 for(const state of PROCEDURE_STATES){
  const courtState=["submitted","received","correction_requested","amended","approved","discontinued","discharged"].includes(state);
  const event={id:`event-${state}`,state,occurredAt:"2026-10-28T10:00:00.000Z",recordedAt:actor.at,actor:actor.actor,sourceDocumentIds:["court-doc"],courtReference:courtState?"case-123":null,reason:"문서 확인 후 상태를 수동 기록",relatedFields:["case.status"],artifactIds:[]};
  const result=validateProcedureEvent(event,["court-doc"],[]);
  assert.equal(result.state,state);assert.deepEqual(result.sourceDocumentIds,["court-doc"]);assert.deepEqual(result.relatedFields,["case.status"]);
 }
});
