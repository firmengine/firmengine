import test from "node:test";
import assert from "node:assert/strict";
import { createCase, normalizeMoney, type CaseData, type Fact } from "../lib/domain.ts";
import { executeCaseNodes } from "../lib/case-execution.ts";
import { CURRENT_RULESET } from "../lib/legal-rules.ts";

function fixture() {
  const data=createCase("Synthetic disposal","synthetic-disposal","2026-10-29");
  data.context.ruleReleaseId=CURRENT_RULESET.id;
  data.structuredTest={mode:"assumed_extracted_synthetic",scenarioId:data.context.id,sourceRecords:[]};
  return data;
}
function addAmount(data:CaseData,assetId:string,key:string,amount:string,id:string){
  const numeric=normalizeMoney(amount),recordId=`source-${id}`;
  data.structuredTest!.sourceRecords.push({id:recordId,recordType:"hypothetical_assumption",recordId:assetId,data:{amount:{fieldId:key,presence:"present",value:{currency:"KRW",minorUnits:amount,unit:"KRW"},rawValue:amount,sourceUnit:"KRW",currency:"KRW",origin:"scenario_assumption"}}});
  const fact:Fact={id,logicalId:id,version:1,subjectId:assetId,key,value:{currency:"KRW",minorUnits:amount,unit:"KRW"},numeric,rawValue:amount,sourceUnit:"KRW",state:"reported",recognition:"unreviewed",refs:[],structuredRefs:[{sourceRecordId:recordId,jsonPointer:"/amount/value"}],validation:[]};
  data.facts.push(fact);return id;
}
function addScenario(data:CaseData,id:string,assetId:string,values:{sale?:string|null;payoff?:string|null;costs?:string|null}){
  data.disposalScenarios??=[];
  const factIds:string[]=[];
  const add=(field:"saleAmount"|"securedPayoff"|"costs",key:string,value:string|null|undefined)=>{
    if(value!==undefined&&value!==null)factIds.push(addAmount(data,id,key,value,`${id}-${field}`));
    return value===undefined?undefined:value===null?null:normalizeMoney(value);
  };
  data.disposalScenarios.push({id,assetId,intent:"proposed",saleAmount:add("saleAmount","disposal.saleAmount",values.sale),securedPayoff:add("securedPayoff","disposal.securedPayoff",values.payoff),costs:add("costs","disposal.costs",values.costs),factIds,recognition:"unreviewed"});
}

test("no disposal scenario or disposal trigger yields no calculation and no auto order",()=>{
  const result=executeCaseNodes(fixture());
  assert.equal(result.disposalResults,undefined);
  assert.notEqual(result.plan.routes.find(route=>route.workflowId==="WF-40")?.state,"confirmed");
  assert.ok(!result.plan.calculationTasks.some(task=>task.id==="disposal_conservation"));
});

test("explicit incomplete scenario returns blocked needs-evidence result",()=>{
  const data=fixture();data.assets.push({id:"asset-a",kind:"vehicle",label:"Synthetic vehicle",factIds:[]});
  addScenario(data,"scenario-a","asset-a",{});
  const result=executeCaseNodes(data);
  assert.equal(result.disposalResults?.length,1);
  assert.equal(result.disposalResults?.[0].tool,"calculate_disposal");
  assert.equal(result.disposalResults?.[0].status,"blocked");
  assert.equal(result.disposalResults?.[0].calculation.status,"needs_evidence");
  assert.ok(result.disposalResults?.[0].reasons.includes("DISPOSAL_SALEAMOUNT_MISSING_OR_INVALID"));
  assert.equal(result.disposalResults?.[0].disposalApprovalInferred,false);
});

test("explicit zero inputs calculate conservatively while unreviewed scenario stays provisional",()=>{
  const data=fixture();data.assets.push({id:"asset-a",kind:"deposit",label:"Synthetic deposit",grossValue:normalizeMoney("999999999"),factIds:[]});
  addScenario(data,"scenario-zero","asset-a",{sale:"0",payoff:"0",costs:"0"});
  const result=executeCaseNodes(data).disposalResults?.[0];
  assert.equal(result?.status,"provisional");
  assert.equal(result?.calculation.saleWon,"0");
  assert.equal(result?.calculation.successorCashWon,"0");
  assert.equal(result?.factIds.length,3);
});

test("negative values and source conflicts block disposal arithmetic",()=>{
  const negative=fixture();negative.assets.push({id:"asset-a",kind:"vehicle",label:"Synthetic vehicle",factIds:[]});
  addScenario(negative,"scenario-negative","asset-a",{sale:"-1",payoff:"0",costs:"0"});
  assert.equal(executeCaseNodes(negative).disposalResults?.[0].status,"blocked");

  const conflict=fixture();conflict.assets.push({id:"asset-a",kind:"vehicle",label:"Synthetic vehicle",factIds:[]});
  addScenario(conflict,"scenario-conflict","asset-a",{sale:"100",payoff:"10",costs:"0"});
  conflict.disposalScenarios![0].factIds.push(addAmount(conflict,"scenario-conflict","disposal.saleAmount","200","conflict-sale"));
  const blocked=executeCaseNodes(conflict).disposalResults?.[0];
  assert.equal(blocked?.status,"blocked");
  assert.ok(blocked?.reasons.includes("DISPOSAL_SALEAMOUNT_SOURCE_CONFLICT_OR_MISSING"));
});

test("unlinked same-scope conflicting fact and inconsistent fact value/numeric block arithmetic",()=>{
  const unlinked=fixture();unlinked.assets.push({id:"asset-a",kind:"vehicle",label:"Synthetic vehicle",factIds:[]});
  addScenario(unlinked,"scenario-unlinked","asset-a",{sale:"100",payoff:"10",costs:"0"});
  addAmount(unlinked,"scenario-unlinked","disposal.saleAmount","200","unlinked-sale");
  const unlinkedResult=executeCaseNodes(unlinked).disposalResults?.[0];
  assert.equal(unlinkedResult?.status,"blocked");
  assert.ok(unlinkedResult?.reasons.includes("DISPOSAL_SALEAMOUNT_SOURCE_CONFLICT_OR_MISSING"));

  const inconsistent=fixture();inconsistent.assets.push({id:"asset-a",kind:"vehicle",label:"Synthetic vehicle",factIds:[]});
  addScenario(inconsistent,"scenario-inconsistent","asset-a",{sale:"100",payoff:"10",costs:"0"});
  const sale=inconsistent.facts.find(fact=>fact.id==="scenario-inconsistent-saleAmount")!;
  sale.numeric=normalizeMoney("99");
  const inconsistentResult=executeCaseNodes(inconsistent).disposalResults?.[0];
  assert.equal(inconsistentResult?.status,"blocked");
});

test("proposed scenario contradicting explicit case.disposals false requests qualification and never calculates",()=>{
  const data=fixture();data.assets.push({id:"asset-a",kind:"vehicle",label:"Synthetic vehicle",factIds:[]});
  Object.assign(data.context,{disposals:false});
  addScenario(data,"scenario-false-conflict","asset-a",{sale:"100",payoff:"10",costs:"0"});
  const result=executeCaseNodes(data),disposal=result.disposalResults?.[0];
  assert.equal(result.plan.routes.find(route=>route.workflowId==="WF-40")?.state,"conflict");
  assert.equal(disposal?.status,"blocked");
  assert.equal(disposal?.calculation.status,"needs_evidence");
  assert.equal(disposal?.calculation.saleWon,null);
  assert.ok(disposal?.reasons.includes("DISPOSAL_CASE_STATUS_CONFLICT"));
  assert.ok(result.plan.qualificationRequests.some(request=>request.workflowId==="WF-40"&&request.features.includes("case.disposals")));
});

test("multiple asset scenarios stay separately bound and do not use asset valuations as sale amounts",()=>{
  const data=fixture();
  data.assets.push({id:"asset-a",kind:"vehicle",label:"Asset A",grossValue:normalizeMoney("900"),factIds:[]},{id:"asset-b",kind:"deposit",label:"Asset B",grossValue:normalizeMoney("700"),factIds:[]});
  addScenario(data,"scenario-a","asset-a",{sale:"100",payoff:"40",costs:"5"});
  addScenario(data,"scenario-b","asset-b",{sale:"50",payoff:"0",costs:"0"});
  const results=executeCaseNodes(data).disposalResults!;
  assert.equal(results.length,2);
  assert.deepEqual(results.map(item=>item.assetId),["asset-a","asset-b"]);
  assert.deepEqual(results.map(item=>item.calculation.saleWon),["100","50"]);
  assert.ok(results.every(item=>item.tool==="calculate_disposal"&&item.courtApprovalInferred===false));
});
