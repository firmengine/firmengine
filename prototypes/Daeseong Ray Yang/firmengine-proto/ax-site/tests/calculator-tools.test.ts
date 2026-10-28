import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { createCase, normalizeMoney, type CaseData, type Json } from "../lib/domain.ts";
import { calculateCase } from "../lib/assessment.ts";
import { CURRENT_RULESET } from "../lib/legal-rules.ts";
import { buildCaseExecutionPlan } from "../lib/case-execution.ts";
import { CALCULATION_SPECS, executionCatalog, WORKFLOW_CALCULATIONS } from "../lib/execution-catalog.ts";
import { callCalculatorTool, snapshotSha256 } from "../lib/calculator-tools.ts";
import { createSiteCalculatorHandler } from "../lib/site-calculator-mcp.ts";
import { runCaseCalculatorNode } from "../lib/case-agent.ts";

function fixture() {
  const d=createCase("합성 계산도구 검증","synthetic-tool-case","2026-10-29");
  d.context.ruleReleaseId=CURRENT_RULESET.id;
  d.structuredTest={mode:"assumed_extracted_synthetic",scenarioId:d.context.id,sourceRecords:[]};
  function row(subject:string,values:Record<string,Json>,moneyKeys:string[]=[]){
    const record={id:`source-${subject}`,recordType:"hypothetical_assumption",recordId:subject,data:{} as Record<string,Json>};
    const ids:string[]=[];
    for(const [key,value] of Object.entries(values)){
      const id=`${subject}:${key}`,numeric=moneyKeys.includes(key)?normalizeMoney(String(value)):undefined;
      const factValue=numeric?{currency:"KRW",minorUnits:String(value),unit:"KRW"}:value;
      record.data[key]={fieldId:key,presence:"present",value:factValue,rawValue:String(value),...(numeric?{sourceUnit:"KRW",currency:"KRW"}:{}),origin:"scenario_assumption"};
      d.facts.push({id,logicalId:id,version:1,subjectId:subject,key,value:factValue,numeric,sourceUnit:numeric?"KRW":undefined,state:"reported",recognition:"unreviewed",refs:[],structuredRefs:[{sourceRecordId:record.id,jsonPointer:`/${key}/value`}],validation:[]});ids.push(id);
    }
    d.structuredTest!.sourceRecords.push(record);return ids;
  }
  d.incomes=[{id:"wage",kind:"wage",label:"합성 급여",net:normalizeMoney("3500000"),amountBasis:"monthly",periodStart:"2026-09-01",periodEnd:"2026-09-30",recurring:"yes",payerIdentityId:"synthetic-employer",recognition:"unreviewed",factIds:row("wage",{"income.net":"3500000","income.kind":"wage"},["income.net"])}];
  d.household={recognizedLivingCost:normalizeMoney("1550000"),livingCostIncludesAdditional:true,recognition:"unreviewed",factIds:row("household",{"household.recognized_living_cost":"1550000"},["household.recognized_living_cost"])};
  d.debts=[{id:"debt",creditor:"합성채권자",contractId:"synthetic-contract",principal:normalizeMoney("90000000"),interest:normalizeMoney("3000000"),secured:"no",classification:"ordinary",priority:"ordinary",legalReview:"unreviewed",asOf:d.context.asOf,factIds:row("debt",{"debt.principal_balance":"90000000","debt.interest":"3000000","debt.contract_id":"synthetic-contract","debt.creditor":"합성채권자"},["debt.principal_balance","debt.interest"])}];
  Object.assign(d.context,{inventoryComplete:{income:"yes",debt:"yes",asset:"yes"},planMonths:36,monthlyTrusteeFee:normalizeMoney("50000"),monthlyPriorityPayment:normalizeMoney("100000"),monthlyEstatePayment:normalizeMoney("200000"),allocationBasis:"principal_then_interest_pro_rata",filingPeriod:{start:"2026-09-01",end:"2026-09-30"}});
  return d;
}
const args=(data:CaseData)=>({caseData:data,expectedRevision:data.context.revision,ruleReleaseId:CURRENT_RULESET.id});

test("every stored workflow/rule/source family stays in the executable catalog; calculation dependency graph is closed",()=>{
  const catalog=executionCatalog();assert.equal(catalog.workflows.length,46);assert.equal(catalog.legalRules.length,50);assert.equal(catalog.risks.length,95);assert.equal(catalog.sourceFamilies.reduce((n,f)=>n+f.fields.length,0),524);
  assert.deepEqual(Object.keys(WORKFLOW_CALCULATIONS).sort(),catalog.workflows.map(w=>w.id).sort());
  const ids=new Set(CALCULATION_SPECS.map(s=>s.id));
  const visit=(id:string,stack:string[])=>{assert.ok(!stack.includes(id),`cycle ${id}`);const spec=CALCULATION_SPECS.find(s=>s.id===id)!;assert.ok(spec);for(const dep of spec.dependsOn){assert.ok(ids.has(dep));visit(dep,[...stack,id]);}};
  for(const id of ids)visit(id,[]);
  for(const workflow of catalog.workflows)for(const id of workflow.calculationIds)assert.ok(ids.has(id));
  for(const spec of CALCULATION_SPECS){assert.ok(spec.resultPaths.length,`${spec.id} declares at least one actual result path`);assert.ok(spec.resultPaths.every(path=>path.startsWith("/result/")),`${spec.id} paths are rooted in the shared tool response`);}
});

test("catalog result paths resolve against the actual shared tool response",async()=>{
  const d=fixture();d.context.paymentSchedule={reviewed:false,expectedInstallments:1,phases:[{id:"phase-1",firstInstallment:1,lastInstallment:1,firstPaymentDate:"2026-11-01",monthlyAvailableWon:"1600000",allocations:[{creditorId:"debt",principalWon:"100000",interestWon:"0"}]}]};
  const response=await callCalculatorTool("build_document_payload",args(d));assert.equal(response.ok,true);const result=(response as any).result;
  const read=(root:any,path:string)=>path.split("/").slice(1).reduce((value,key)=>value?.[key],root);
  for(const spec of CALCULATION_SPECS.filter(item=>item.id!=="disposal_conservation"))for(const path of spec.resultPaths)assert.notEqual(read(response,path),undefined,`${spec.id}: ${path}`);
  const disposal=await callCalculatorTool("calculate_disposal",{saleAmount:normalizeMoney("100"),securedPayoff:normalizeMoney("30"),costs:normalizeMoney("10")});assert.equal(disposal.ok,true);
  for(const path of CALCULATION_SPECS.find(item=>item.id==="disposal_conservation")!.resultPaths)assert.notEqual(read(disposal,path),undefined,path);
  assert.ok(result.documentPayloads.length>0);
});

test("disposable income, ordinary budget, tool result and document fields use the same arithmetic",async()=>{
  const d=fixture(),before=JSON.stringify(d),direct=calculateCase(d,CURRENT_RULESET);
  assert.equal(direct.disposableIncomeWon,"1950000");assert.equal(direct.ordinaryRepaymentBudgetWon,"1600000");assert.equal(direct.monthlyPaymentWon,"1600000");assert.equal(direct.planTotalWon,"57600000");
  const response=await callCalculatorTool("build_document_payload",args(d));assert.equal(response.ok,true);
  const result=(response as any).result;assert.deepEqual(result.assessment.calculation,direct);
  assert.equal(result.formBindings.scalars.monthly_disposable_income,"1,950,000");assert.equal(result.formBindings.scalars.ordinary_repayment_budget,"1,600,000");assert.equal(result.formBindings.scalars.total_repayment,"57,600,000");
  assert.equal(result.assessment.generationGate.canFinalize,false);assert.equal(result.plan.generationGate.canFinalize,false);assert.ok(result.documentPayloads.some((doc:any)=>doc.kind==="repayment_plan"));
  assert.equal(JSON.stringify(d),before);assert.equal((response as any).inputSha256,await snapshotSha256(d));
});

test("typed source selection changes documents and requests without clearing unreviewed conditions",()=>{
  const d=fixture();d.incomes[0].kind="rent";d.facts.find(f=>f.key==="income.kind")!.value="rent";
  ((d.structuredTest!.sourceRecords[0].data as any)["income.kind"]).value="rent";
  const plan=buildCaseExecutionPlan(d);
  assert.ok(plan.documents.some(doc=>doc.kind==="leases"));
  assert.ok(plan.routes.some(r=>r.workflowId==="WF-05"&&r.state==="candidate"));
  assert.ok(plan.evidenceRequests.some(r=>r.workflowId==="WF-05"));
  assert.ok(!plan.routes.some(r=>r.workflowId==="WF-05"&&r.state==="confirmed"));
});

test("missing fees block ordinary payment budget but preserve computable statutory-stage income",async()=>{
  const d=fixture();delete d.context.monthlyTrusteeFee;
  const result=await callCalculatorTool("calculate_case",args(d));assert.equal(result.ok,true);
  const c=(result as any).result.assessment.calculation;
  assert.equal(c.disposableIncomeWon,"1950000");assert.equal(c.ordinaryRepaymentBudgetWon,null);assert.equal(c.planTotalWon,null);
});

test("the legal agent calculator node records the exact MCP input snapshot and keeps partial values",async()=>{
  const d=fixture(),first=await runCaseCalculatorNode(d);
  assert.equal(first.receipt.tool,"calculate_case");assert.equal(first.receipt.inputSha256,await snapshotSha256(d));
  assert.equal(first.execution.assessment.calculation.ordinaryRepaymentBudgetWon,"1600000");
  assert.equal(first.context.calculatorExecution.modelPerformedArithmetic,false);
  delete d.context.monthlyTrusteeFee;
  const updated=await runCaseCalculatorNode(d);
  assert.notEqual(updated.receipt.inputSha256,first.receipt.inputSha256);
  assert.equal(updated.execution.assessment.calculation.disposableIncomeWon,"1950000");
  assert.equal(updated.execution.assessment.calculation.ordinaryRepaymentBudgetWon,null);
  assert.equal(updated.execution.assessment.generationGate.canFinalize,false);
});

test("tools reject stale revisions, unsupported rules, duplicated IDs and unsafe keys",async()=>{
  const d=fixture();
  for(const [input,code] of [[{...args(d),expectedRevision:2},"CASE_REVISION_MISMATCH"],[{...args(d),ruleReleaseId:"unknown"},"RULE_VERSION_MISMATCH"]] as const){const r=await callCalculatorTool("calculate_case",input);assert.equal(r.ok,false);assert.equal((r as any).error.code,code);}
  d.facts.push(d.facts[0]);assert.equal((await callCalculatorTool("calculate_case",args(d)) as any).error.code,"DUPLICATE_INPUT_ID");
  assert.equal((await callCalculatorTool("calculate_case",JSON.parse('{"__proto__":{}}')) as any).error.code,"UNSAFE_OBJECT_KEY");
  assert.equal((await callCalculatorTool("calculate_disposal",{saleAmount:normalizeMoney("10")}) as any).error.code,"INVALID_INPUT");
});

test("the official MCP stdio transport lists and executes the same readonly calculator tools",{timeout:30000},async()=>{
  const transport=new StdioClientTransport({command:process.execPath,args:["--experimental-strip-types","scripts/calculator-mcp.ts"],cwd:process.cwd(),stderr:"inherit"});
  const client=new Client({name:"firmengine-integration-test",version:"1.0.0"});
  try{
    await client.connect(transport);
    const list=await client.listTools();assert.deepEqual(list.tools.map(t=>t.name).sort(),["build_document_payload","calculate_case","calculate_disposal","get_execution_catalog","plan_case"]);
    assert.ok(list.tools.every(t=>t.annotations?.readOnlyHint===true));
    const input={saleAmount:normalizeMoney("1000000"),securedPayoff:normalizeMoney("1100000"),costs:normalizeMoney("20000")};
    const result=await client.callTool({name:"calculate_disposal",arguments:input});
    assert.equal(result.isError,undefined);assert.deepEqual(result.structuredContent,await callCalculatorTool("calculate_disposal",input));
    assert.equal((result.structuredContent as any).result.shortfallWon,"120000");assert.equal((result.structuredContent as any).result.conserved,true);
    const caseResult=await client.callTool({name:"calculate_case",arguments:args(fixture())});
    assert.equal((caseResult.structuredContent as any).result.assessment.calculation.ordinaryRepaymentBudgetWon,"1600000");
    const stale=await client.callTool({name:"calculate_case",arguments:{...args(fixture()),expectedRevision:2}});assert.equal(stale.isError,true);
  }finally{await client.close();await transport.close();}
});

test("hosted MCP resolves the current case DB snapshot and refuses stale revision or injected snapshots",async()=>{
  const d=fixture();let reads=0;
  const handler=createSiteCalculatorHandler(async(id)=>{assert.equal(id,d.context.id);reads++;return d;});
  const request=async(method:string,args:Record<string,unknown>={})=>{
    const params={...args,_meta:{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientInfo":{name:"test",version:"1"},"io.modelcontextprotocol/clientCapabilities":{}}};
    const response=await handler.fetch(new Request("https://example.invalid/mcp",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json, text/event-stream","MCP-Protocol-Version":"2026-07-28","Mcp-Method":method,...(typeof args.name==="string"?{"Mcp-Name":args.name}:{})},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})}));
    const body=await response.json() as any;assert.equal(response.status,200,JSON.stringify(body));return body;
  };
  try{
    const discover=await request("server/discover");assert.ok(discover.result.supportedVersions.includes("2026-07-28"));
    const list=await request("tools/list");assert.equal(list.result.tools.length,5);
    const calculated=await request("tools/call",{name:"calculate_case",arguments:{caseId:d.context.id,expectedRevision:1}});
    assert.equal(calculated.result.structuredContent.result.assessment.calculation.monthlyPaymentWon,"1600000");assert.equal(reads,1);
    d.context.revision=2;d.context.monthlyTrusteeFee=normalizeMoney("150000");
    const fresh=await request("tools/call",{name:"calculate_case",arguments:{caseId:d.context.id}});
    assert.equal(fresh.result.structuredContent.caseRevision,2);assert.equal(fresh.result.structuredContent.result.assessment.calculation.monthlyPaymentWon,"1500000");
    const stale=await request("tools/call",{name:"calculate_case",arguments:{caseId:d.context.id,expectedRevision:1}});assert.equal(stale.result.isError,true);
    const injected=await request("tools/call",{name:"calculate_case",arguments:{caseId:d.context.id,caseData:fixture()}});assert.ok(injected.error||injected.result?.isError);
  }finally{await handler.close();}
});
