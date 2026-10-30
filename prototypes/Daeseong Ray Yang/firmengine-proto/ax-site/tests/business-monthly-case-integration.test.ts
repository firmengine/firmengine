import test from "node:test";
import assert from "node:assert/strict";
import {buildBusinessMonthlyWorkbench} from "../lib/business-monthly-workbench.ts";
import {calculateCase} from "../lib/assessment.ts";
import {createCase,normalizeMoney,type Fact} from "../lib/domain.ts";

const RULES={id:"synthetic",status:"source_verified" as const,sources:[]};
const VAT="business_sales_vat::income.sales.";
const COST="business_costs_and_ledgers::income.business_cost.";
function fixture(count:number){
 const data=createCase("synthetic monthly evidence","monthly-business-case","2026-10-30");
 const sha="f".repeat(64),vatPages=Array.from({length:count},(_,i)=>i+1);
 const costPages=[...vatPages];
 data.documents=[
  {id:"vat",name:"synthetic-vat.pdf",sha256:sha,status:"active",pages:vatPages},
  {id:"costs",name:"synthetic-costs.pdf",sha256:sha,status:"active",pages:costPages}
 ];
 data.context.filingPeriod={start:"2026-01-01",end:"2026-12-31"};
 data.context.incomePeriodReviewed=true;data.context.inventoryComplete.income="yes";
 const insert=(doc:string,page:number,subjectId:string,id:string,canonicalFieldId:string,value:string,isMoney:boolean)=>{
  const quote=`Evidence ${doc} ${page}`;
  if(!data.pages.some(p=>p.documentId===doc&&p.page===page))
   data.pages.push({documentId:doc,page,role:"evidence",text:quote});
  const fact:Fact={id,logicalId:id,version:1,subjectId,canonicalFieldId,key:"source_only."+id,
   value,rawValue:value,...(isMoney?{numeric:normalizeMoney(value),sourceUnit:"KRW"}:{}),
   state:"verified",recognition:"accepted",validation:[],
   refs:[{documentId:doc,page,quote,sourceHash:sha}]};
  data.facts.push(fact);
 };
 for(let month=1;month<=count;month++){
  const m=String(month).padStart(2,"0");
  const start=`2026-${m}-01`,end=new Date(Date.UTC(2026,month,0)).toISOString().slice(0,10);
  const salesId="sales-"+m,costId="cost-"+m;
  insert("vat",month,salesId,salesId+"-amount",VAT+"gross_sales","3000000",true);
  insert("vat",month,salesId,salesId+"-start",VAT+"reporting_period_start",start,false);
  insert("vat",month,salesId,salesId+"-end",VAT+"reporting_period_end",end,false);
  insert("costs",month,costId,costId+"-amount",COST+"gross_amount","1000000",true);
  insert("costs",month,costId,costId+"-start",COST+"period_start",start,false);
  insert("costs",month,costId,costId+"-end",COST+"period_end",end,false);
 }
 return data;
}
test("12 months of valid money/period facts yield 12 source-only diagnostics but never legally recognized income",()=>{
 const data=fixture(12);
 const result=buildBusinessMonthlyWorkbench(data);
 assert.equal(result.expectedMonths,12);
 assert.equal(result.months.length,12);
 assert.equal(result.sourceMoneyFactCount,24);
 assert.equal(result.unassignedSourceFacts.length,0);
 assert.ok(result.months.every(month=>month.arithmeticDifferenceWon==="2000000"));
 assert.ok(result.months.every(month=>!month.legalNetApproved));
 assert.equal(result.legalIncomeApproved,false);
 assert.equal(result.incompleteSourceCoverage,false);
 const calculated=calculateCase(data,RULES);
 assert.equal(calculated.monthlyIncomeWon,null);
 assert.ok(calculated.issues.includes("INCOME_BUSINESS_SOURCE_ONLY_REQUIRES_RECONCILIATION"));
});
test("missing twelfth month appears as an explicit gap, not a 0 or averaged estimate",()=>{
 const data=fixture(11),view=buildBusinessMonthlyWorkbench(data);
 assert.equal(view.expectedMonths,12);
 assert.equal(view.months[11].month,"2026-12");
 assert.equal(view.months[11].arithmeticDifferenceWon,null);
 assert.equal(view.incompleteSourceCoverage,true);
 assert.ok(view.months[11].gaps.includes("BUSINESS_MONTH_NO_SOURCE_ROWS"));
 assert.equal(calculateCase(data,RULES).monthlyIncomeWon,null);
});
test("two competing VAT source rows in the same month require human reconciliation",()=>{
 const data=fixture(1);
 const original=data.facts.find(f=>f.id==="sales-01-amount")!;
 data.facts.push({...original,id:"extra-gross",logicalId:"extra-gross",subjectId:"different-sales-row",
  value:"3500000",rawValue:"3500000",numeric:normalizeMoney("3500000")});
 const a=buildBusinessMonthlyWorkbench(data).months[0];
 assert.ok(a.gaps.includes("BUSINESS_GROSS_TOTAL_MULTIPLE"));
 assert.equal(a.sourceGrossWon,null);
 assert.equal(a.arithmeticDifferenceWon,null);
});
