/** Synthetic-only output-equivalence and latency benchmark; never an OCR accuracy test. */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { applyExtraction,createCase,currentFacts,type CaseData } from "../lib/domain.ts";
import { projectPage,type ReadField,type PageRead } from "../lib/extraction.ts";
import { assessCase } from "../lib/assessment.ts";
import { CURRENT_RULESET } from "../lib/legal-rules.ts";
import { evaluateWorkflow } from "../lib/workflow-rules.ts";

const baselinePath=process.argv[2],reportPath=process.argv[3];
if(!baselinePath)throw new Error("Provide a source snapshot of the previous workflow implementation.");
const previous=await import(pathToFileURL(baselinePath).href) as {evaluateWorkflow:typeof evaluateWorkflow};
const sourceSha="b".repeat(64);
let data=createCase("Synthetic workflow benchmark","synthetic-workflow-benchmark","2026-10-27");
const totalPages=70;
data.documents=[{id:"synthetic-document",name:"synthetic-fixture.pdf",sha256:sourceSha,status:"active",pages:Array.from({length:totalPages},(_,i)=>i+1)}];
const fld=(key:string,value:string,unit:string|null=null):ReadField=>({key,label:key,value,unit,quote:`${key}: ${value}${unit??""}`,confidence:"clear",bbox:[0,0,1,1]});
for(let page=1;page<=totalPages;page++){
  const r:PageRead=page<=50?{documentType:"asset_valuation_evidence",complete:true,warnings:[],records:[{category:"asset",label:`합성재산 ${page}`,fields:[fld("kind","business"),fld("label",`합성재산 ${page}`),fld("gross_value",String(1000000+page),"원"),fld("ownership_bps","10000"),fld("secured_payoff","0","원"),fld("disposal_costs","0","원"),fld("protected_value","0","원"),fld("as_of","2026-10-27"),fld("valuation_basis","합성 평가")]}]}:{documentType:"salary_statement",complete:true,warnings:[],records:[{category:"income",label:`합성급여 ${page}`,fields:[fld("kind","wage"),fld("label",`합성급여 ${page}`),fld("employer",`합성직장 ${page}`),fld("payer_identity_id",`SYNTHETIC-PAYER-${page}`),fld("net",String(2000000+page),"원"),fld("amount_basis","monthly"),fld("period_start","2026-09-01"),fld("period_end","2026-09-30"),fld("period_months","1"),fld("recurring","yes")]}]};
  data.pages.push({documentId:"synthetic-document",page,role:"evidence",documentType:r.documentType,text:r.records.flatMap(row=>row.fields.map(f=>f.quote)).join("\n"),imageUrl:`/synthetic/${page}.png`});
  data=applyExtraction(data,projectPage(r,"synthetic-document",page,sourceSha));
}
for(const fact of currentFacts(data)){fact.state="verified";fact.recognition="accepted";fact.reviewer="synthetic-benchmark";}
data.assets.forEach(a=>{a.recognition="accepted";});data.incomes.forEach(i=>{i.recognition="accepted";});
data.context.inventoryComplete={income:"yes",debt:"yes",asset:"yes"};
const assessment=assessCase(data,CURRENT_RULESET);
const oldResult=previous.evaluateWorkflow(data),newResult=evaluateWorkflow(data,assessment);
assert.deepEqual(newResult,oldResult,"Workflow optimization changed a status/value/source/next-action.");
function measure(fn:(data:CaseData)=>unknown){const times:number[]=[];for(let i=0;i<3;i++){const started=performance.now();fn(data);times.push(performance.now()-started);}return times.sort((a,b)=>a-b)[1];}
const before=measure(previous.evaluateWorkflow),after=measure(d=>evaluateWorkflow(d,assessment));
const report={scope:"synthetic deterministic workflow; not OCR accuracy or total end-to-end runtime",generatedAt:new Date().toISOString(),facts:currentFacts(data).length,typedObjects:data.assets.length+data.incomes.length,workflowItems:newResult.items.length,resultBytes:new TextEncoder().encode(JSON.stringify(newResult)).length,resultsExactlyEquivalent:true,runsPerVariant:3,baselineMedianMs:Number(before.toFixed(2)),optimizedMedianMs:Number(after.toFixed(2)),speedup:Number((before/after).toFixed(2)),additionalModelCalls:0};
if(reportPath)await writeFile(reportPath,JSON.stringify(report,null,2)+"\n");
process.stdout.write(JSON.stringify(report)+"\n");
