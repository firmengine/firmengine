import test from "node:test";
import assert from "node:assert/strict";
import {projectPage,type PageRead} from "../lib/extraction.ts";
import {applyExtraction,createCase} from "../lib/domain.ts";
import {calculateCase} from "../lib/assessment.ts";

const hash="a".repeat(64);
const rules={id:"synthetic-tax-role-test",status:"source_verified" as const,sources:[]};
const money=(key:string,id:string,value:string)=>({
 key,canonicalFieldId:id,label:key,value,unit:"KRW",quote:key+" "+value,
 bbox:[0.1,0.1,0.6,0.2] as [number,number,number,number],
 confidence:"clear" as const,sourceState:"present" as const
});
function taxIncomeCase(){
 const read:PageRead={
  documentType:"shared-document:income_amount_certificate@tax_income",complete:true,warnings:[],
  records:[{category:"income",label:"Synthetic prior-year tax income",fields:[
   money("gross_receipts","tax_income::gross_receipts","50000000"),
   money("necessary_expenses","tax_income::necessary_expenses","20000000"),
   money("income_after_expenses","tax_income::income_after_expenses","30000000"),
   {...money("period_start","tax_income::period_start","2025-01-01"),unit:null},
   {...money("period_end","tax_income::period_end","2025-12-31"),unit:null}
  ]}]
 };
 let data=createCase("Synthetic tax income role regression","synthetic-tax-subject","2026-11-02");
 data.documents=[{id:"doc-tax",name:"synthetic.pdf",sha256:hash,status:"active",pages:[1]}];
 data.pages=[{documentId:"doc-tax",page:1,role:"evidence",text:read.records.flatMap(r=>r.fields.map(f=>f.quote??"")).join(" | ")}];
 data=applyExtraction(data,projectPage(read,"doc-tax",1,hash));
 data.facts=data.facts.map(f=>({...f,state:"verified" as const,recognition:"accepted" as const}));
 data.incomes=data.incomes.map(i=>({...i,recognition:"accepted" as const}));
 data.context.inventoryComplete.income="yes";
 data.context.filingPeriod={start:"2025-01-01",end:"2025-12-31"};
 data.context.incomePeriodReviewed=true;
 return data;
}

test("tax canonical Fact still needs period review if typed source role is relabeled",()=>{
 const data=taxIncomeCase();
 assert.equal(data.incomes[0]?.sourceCalculationRole,"historical_tax_comparison");
 data.incomes[0]={...data.incomes[0],sourceCalculationRole:"period_income_observation",
  aggregationReviewed:false,aggregationReviewReason:undefined,aggregationTreatment:"unknown"};
 const result=calculateCase(data,rules);
 assert.equal(result.incomeRows[0]?.monthlyWon,null);
 assert.ok(result.issues.some(x=>x.includes("INCOME_HISTORICAL_TAX_PERIOD_USE_REVIEW_REQUIRED")));
});

test("tax canonical role guard does not block an independently reviewed period mapping",()=>{
 const data=taxIncomeCase();
 data.incomes[0]={...data.incomes[0],sourceCalculationRole:"period_income_observation",
  aggregationReviewed:true,aggregationTreatment:"series_observation",
  aggregationReviewReason:"Synthetic documented period and duplication check; not court approval"};
 const result=calculateCase(data,rules);
 assert.equal(result.incomeRows[0]?.monthlyWon,"2500000");
});
