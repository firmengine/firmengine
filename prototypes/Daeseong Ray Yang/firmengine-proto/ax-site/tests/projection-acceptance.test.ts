import test from "node:test";
import assert from "node:assert/strict";
import { createCase,normalizeMoney,type CaseData,type Fact } from "../lib/domain.ts";
import { applyFactProjection,invalidateFactSupport } from "../lib/fact-object-projection.ts";
import { reduceCaseCommand } from "../lib/case-commands.ts";
import { commandHash,type CaseCommand } from "../lib/case-command-contract.ts";

const actor={actor:"synthetic reviewer",roles:["case_editor","caseworker_review","lawyer_review"],at:"2026-10-29T00:00:00.000Z"};
const command=(target:Record<string,unknown>,patch:Record<string,unknown>,baseValueHash?:string,commandType:"fact.correct"|"fact.review"="fact.correct"):CaseCommand=>({commandId:"projection-acceptance-1",commandType,payloadVersion:1,expectedRevision:1,expectedStateFingerprint:`case-state/1:${"a".repeat(64)}`,target,patch,reason:"원문과 고용주 연결을 다시 확인",...(baseValueHash?{baseValueHash}:{})} as CaseCommand);
function incomeCase():CaseData{
  const data=createCase("Synthetic income projection","projection-acceptance","2026-10-29");
  data.documents=[{id:"doc-1",name:"Synthetic payroll source",sha256:"a".repeat(64),status:"active",pages:[1]}];data.pages=[{documentId:"doc-1",page:1,role:"evidence",text:"income source"}];
  const fact=(id:string,subjectId:string,key:string,value:string):Fact=>({id,logicalId:`${subjectId}:${key}`,version:1,subjectId,key,value,sourceUnit:"원",numeric:key.endsWith("net")?normalizeMoney(value,"원"):undefined,asOf:"2026-09-30",state:"verified",recognition:"unreviewed",refs:[{documentId:"doc-1",page:1,quote:"income source",sourceHash:"a".repeat(64)}],validation:[]});
  data.facts=[fact("income-a-net","income-a","income.net","100"),fact("income-b-net","income-b","income.net","200")];
  data.incomes=[{id:"income-a",kind:"wage",label:"Synthetic payroll A",employer:"Employer A",payerIdentityId:"payer-A",net:normalizeMoney("100","원"),periodStart:"2026-09-01",periodEnd:"2026-09-30",amountBasis:"monthly",recognition:"accepted",factIds:["income-a-net"]},{id:"income-b",kind:"wage",label:"Synthetic payroll B",employer:"Employer B",payerIdentityId:"payer-B",net:normalizeMoney("200","원"),periodStart:"2026-09-01",periodEnd:"2026-09-30",amountBasis:"monthly",recognition:"accepted",factIds:["income-b-net"]}];
  return data;
}

test("AT09 correction cannot choose between same-field facts attached to different employers",async()=>{
  const data=incomeCase(),old=data.facts[0]!,hash=await commandHash({value:old.value,sourceUnit:old.sourceUnit??old.numeric?.unit??null});
  // A shared source fact is attached to two typed income candidates; employer identity cannot break the tie automatically.
  data.incomes[1]!.factIds=[old.id];
  const result=await reduceCaseCommand(data,command({factId:old.id},{value:"150"},hash),actor);
  assert.equal(result.data.incomes[0]!.net?.amountWon,"100");assert.equal(result.data.incomes[1]!.net?.amountWon,"200");
  assert.equal(result.data.incomes[0]!.recognition,"unreviewed");assert.equal(result.data.incomes[1]!.recognition,"unreviewed");
  assert.equal((result.impact.projectionBlockers as {code:string}[]|undefined)?.[0]?.code,"AMBIGUOUS_TARGET");
  assert.ok((result.data.workflowState?.reviewHistory.at(-1)?.before as {resetReviews:{key:string;prior:unknown}[]}).resetReviews.some(entry=>entry.key==="incomes.income-a.recognition"&&entry.prior==="accepted"));
  assert.equal(result.data.workflowState?.projectionBlockers.some(blocker=>blocker.factIds.includes(old.id)),true);
  assert.equal(result.data.workflowState?.tasks.some(task=>task.type==="projection_remap"),true);
});

test("AT09 projection blocks when the typed employer or payer changes across the correction",()=>{
  const before=incomeCase(),after=structuredClone(before);after.facts.push({...before.facts[0]!,id:"income-a-net-v2",version:2,supersedes:"income-a-net",value:"150",numeric:normalizeMoney("150","원"),state:"reported",recognition:"unreviewed"});after.incomes[0]!.factIds=["income-a-net-v2"];after.incomes[0]!.employer="Employer B";after.incomes[0]!.payerIdentityId="payer-B";
  const result=applyFactProjection(before,after,["income-a-net"],["income-a-net-v2"]);
  assert.equal(result.projection.updates.length,0);assert.equal(result.projection.blockers[0]!.code,"AMBIGUOUS_TARGET");assert.equal(result.data.incomes[0]!.net?.amountWon,"100");
  assert.equal(result.data.incomes[0]!.recognition,"unreviewed");
});

test("successful numeric projection resets typed approval and audits its prior value",()=>{
  const before=incomeCase(),after=structuredClone(before);after.facts.push({...before.facts[0]!,id:"income-a-net-v2",version:2,supersedes:"income-a-net",value:"150",numeric:normalizeMoney("150","원"),state:"reported",recognition:"unreviewed"});after.incomes[0]!.factIds=["income-a-net-v2"];
  const result=applyFactProjection(before,after,["income-a-net"],["income-a-net-v2"]);
  assert.equal(result.data.incomes[0]!.net?.amountWon,"150");assert.equal(result.data.incomes[0]!.recognition,"unreviewed");assert.ok(result.audit.resetReviews.some(entry=>entry.key==="incomes.income-a.recognition"&&entry.prior==="accepted"));
});

test("AT11 correction with another same-field source leaves the typed value for explicit reconciliation",()=>{
  const before=incomeCase();before.incomes[0]!.factIds=["income-a-net","income-b-net"];
  const after=structuredClone(before);after.facts.push({...before.facts[0]!,id:"income-a-net-v2",version:2,supersedes:"income-a-net",value:"150",numeric:normalizeMoney("150","원"),state:"reported",recognition:"unreviewed"});after.incomes[0]!.factIds=["income-a-net-v2","income-b-net"];
  const result=applyFactProjection(before,after,["income-a-net"],["income-a-net-v2"]);
  assert.equal(result.projection.updates.length,0);assert.equal(result.projection.blockers[0]!.code,"SURVIVING_SUPPORT_REVIEW");assert.deepEqual(result.projection.blockers[0]!.candidateFactIds,["income-a-net-v2","income-b-net"]);assert.equal(result.data.incomes[0]!.net?.amountWon,"100");
});

test("AT11 withdrawal removes the withdrawn fact from current support and requires review of survivors",()=>{
  const before=incomeCase();before.incomes[0]!.factIds=["income-a-net","income-b-net"];
  const after=structuredClone(before);const original=after.facts[0]!;after.facts.push({...original,id:"income-a-net-v2",version:2,supersedes:original.id,state:"retracted",recognition:"rejected"});
  const result=invalidateFactSupport(before,after,"income-a-net","income-a-net-v2");
  assert.deepEqual(result.data.incomes[0]!.factIds,["income-b-net"]);assert.equal(result.data.incomes[0]!.net?.amountWon,"100");assert.equal(result.data.incomes[0]!.recognition,"unreviewed");assert.equal(result.projection.blockers[0]!.code,"SURVIVING_SUPPORT_REVIEW");assert.deepEqual(result.projection.blockers[0]!.candidateFactIds,["income-a-net-v2","income-b-net"]);assert.equal(result.audit.invalidatedArtifacts.length,0);
});

test("AT11 fact retraction preserves the amount and surviving evidence, but removes acceptance and creates a remap task",async()=>{
  const data=incomeCase();data.incomes[0]!.factIds=["income-a-net","income-b-net"];
  const result=await reduceCaseCommand(data,command({factId:"income-a-net"},{state:"retracted"},undefined,"fact.review"),actor);
  assert.equal(result.data.incomes[0]!.net?.amountWon,"100");assert.deepEqual(result.data.incomes[0]!.factIds,["income-b-net"]);assert.equal(result.data.incomes[0]!.recognition,"unreviewed");
  assert.equal(result.impact.projectionBlockers!==undefined,true);assert.equal(result.data.workflowState?.projectionBlockers.some(blocker=>blocker.code==="SURVIVING_SUPPORT_REVIEW"),true);assert.equal(result.data.workflowState?.tasks.some(task=>task.type==="projection_remap"),true);
  assert.equal(result.data.facts.find(fact=>fact.id==="income-a-net")?.state,"verified","old source history remains intact");assert.equal(result.data.facts.find(fact=>fact.supersedes==="income-a-net")?.state,"retracted");
});

test("AT11 dispute also drops accepted object authority until surviving support is checked",async()=>{
  const data=incomeCase();data.incomes[0]!.factIds=["income-a-net","income-b-net"];
  const result=await reduceCaseCommand(data,command({factId:"income-a-net"},{state:"disputed"},undefined,"fact.review"),actor);
  assert.equal(result.data.incomes[0]!.net?.amountWon,"100");assert.equal(result.data.incomes[0]!.recognition,"unreviewed");const disputed=result.data.facts.find(fact=>fact.supersedes==="income-a-net")!;assert.ok(result.data.incomes[0]!.factIds.includes(disputed.id));assert.ok(result.data.incomes[0]!.factIds.includes("income-b-net"));
  assert.equal(result.data.workflowState?.tasks.some(task=>task.type==="projection_remap"),true);
});
