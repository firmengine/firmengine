import test from "node:test";
import assert from "node:assert/strict";
import {projectPage,type PageRead} from "../lib/extraction.ts";
import {applyExtraction,createCase,normalizeMoney} from "../lib/domain.ts";
import {calculateCase,monthlyIncome} from "../lib/assessment.ts";

const hash="a".repeat(64),rules={id:"synthetic-business",status:"source_verified" as const,sources:[]};
const money=(key:string,canonicalFieldId:string,value:string)=>({
 key,canonicalFieldId,label:key,value,unit:"KRW",quote:key+" "+value,
 bbox:[0.1,0.1,0.6,0.2] as [number,number,number,number],
 confidence:"clear" as const,sourceState:"present" as const
});
const date=(key:string,canonicalFieldId:string,value:string)=>({
 ...money(key,canonicalFieldId,value),unit:null
});
function withSource(read:PageRead){
 const data=createCase("Synthetic VAT/tax source comparison","synthetic-business-provenance","2026-10-30");
 data.documents=[{id:"source-doc",name:"synthetic.pdf",sha256:hash,status:"active",pages:[1]}];
 data.pages=[{documentId:"source-doc",page:1,role:"evidence",
  text:read.records.flatMap(r=>r.fields.map(f=>f.quote??"")).join(" | ")}];
 const extracted=projectPage(read,"source-doc",1,hash);
 const persisted=applyExtraction(data,extracted);
 persisted.facts=persisted.facts.map(f=>({...f,state:"verified" as const,recognition:"accepted" as const}));
 persisted.incomes=persisted.incomes.map(i=>({...i,recognition:"accepted" as const}));
 persisted.context.inventoryComplete.income="yes";
 persisted.context.filingPeriod={start:"2025-01-01",end:"2025-12-31"};
 persisted.context.incomePeriodReviewed=true;
 return {data:persisted,extracted};
}
function vatRead():PageRead{return{
 documentType:"shared-document:vat_certificate@business_sales_vat",complete:true,warnings:[],
 records:[{category:"income",label:"VAT 2025",fields:[
  money("income.sales.gross_sales","business_sales_vat::income.sales.gross_sales","50000000"),
  date("income.sales.reporting_period_start","business_sales_vat::income.sales.reporting_period_start","2025-01-01"),
  date("income.sales.reporting_period_end","business_sales_vat::income.sales.reporting_period_end","2025-12-31")
 ]}]
};}
function taxRead():PageRead{return{
 documentType:"shared-document:income_amount_certificate@tax_income",complete:true,warnings:[],
 records:[{category:"income",label:"Tax 2025",fields:[
  money("gross_receipts","tax_income::gross_receipts","50000000"),
  money("necessary_expenses","tax_income::necessary_expenses","20000000"),
  money("income_after_expenses","tax_income::income_after_expenses","30000000"),
  date("period_start","tax_income::period_start","2025-01-01"),
  date("period_end","tax_income::period_end","2025-12-31")
 ]}]
};}
test("VAT gross turnover remains review evidence even after unsupported net/expense insertion",()=>{
 const {data,extracted}=withSource(vatRead());
 assert.equal(extracted.incomes[0]?.sourceCalculationRole,"gross_turnover_only");
 assert.equal(extracted.incomes[0]?.gross?.amountWon,"50000000");
 assert.equal(monthlyIncome({
  ...extracted.incomes[0],net:normalizeMoney("30000000"),
  expenses:normalizeMoney("20000000"),amountBasis:"period_total"
 }).value,null);
 data.incomes[0]={...data.incomes[0],sourceCalculationRole:"period_income_observation",
  net:normalizeMoney("30000000"),expenses:normalizeMoney("20000000"),amountBasis:"period_total",
  aggregationReviewed:true,aggregationTreatment:"independent_source",aggregationReviewReason:"unlinked entry"};
 const calculation=calculateCase(data,rules);
 assert.equal(calculation.monthlyIncomeWon,null);
 assert.equal(calculation.incomeRows[0].monthlyWon,null);
 assert.ok(calculation.issues.some(x=>x.includes("INCOME_VAT_TURNOVER_NOT_NET_INCOME")));
});
test("historical tax net cannot become current monthly income from recognition alone",()=>{
 const {data,extracted}=withSource(taxRead());
 assert.equal(extracted.incomes[0]?.sourceCalculationRole,"historical_tax_comparison");
 assert.equal(monthlyIncome(extracted.incomes[0]).value?.toString(),"2500000");
 const unresolved=calculateCase(data,rules);
 assert.equal(unresolved.monthlyIncomeWon,null);
 assert.ok(unresolved.issues.some(x=>x.includes("INCOME_HISTORICAL_TAX_PERIOD_USE_REVIEW_REQUIRED")));
 data.incomes[0]={...data.incomes[0],aggregationTreatment:"series_observation",aggregationReviewed:true,
  aggregationReviewReason:"Period and source duplication reviewed against case evidence"};
 const reviewed=calculateCase(data,rules);
 assert.equal(reviewed.incomeRows[0].monthlyWon,"2500000");
 assert.equal(reviewed.monthlyIncomeWon,"2500000");
});
test("VAT gross-only evidence without costs never reports a zero business income",()=>{
 const {data}=withSource(vatRead());
 const result=calculateCase(data,rules);
 assert.equal(result.monthlyIncomeWon,null);
 assert.equal(result.incomeRows[0].monthlyWon,null);
});
