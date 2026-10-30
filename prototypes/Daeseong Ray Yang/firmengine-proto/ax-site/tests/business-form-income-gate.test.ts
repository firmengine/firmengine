import test from "node:test";
import assert from "node:assert/strict";
import {calculateCase} from "../lib/assessment.ts";
import {createCase,normalizeMoney,type Fact} from "../lib/domain.ts";
import {buildFormBindings,MISSING_FORM_VALUE} from "../lib/form-mapping.ts";
const rule={id:"synthetic",status:"source_verified" as const,sources:[]};
function seed(){
 const data=createCase("synthetic form gate","synthetic-form-gate","2026-10-30");
 const sha="a".repeat(64),quote="Verified synthetic source";
 data.documents=[{id:"document",name:"synthetic.pdf",sha256:sha,status:"active",pages:[1]}];
 data.pages=[{documentId:"document",page:1,role:"evidence",text:quote}];
 data.context.inventoryComplete.income="yes";
 data.context.filingPeriod={start:"2026-10-01",end:"2026-10-31"};
 data.context.incomePeriodReviewed=true;
 const add=(id:string,subjectId:string,key:string,value:string,numeric=false)=>{
  const f:Fact={id,logicalId:id,version:1,subjectId,key,
   ...(key.includes("::")?{canonicalFieldId:key}:{}),value,rawValue:value,
   ...(numeric?{numeric:normalizeMoney(value),sourceUnit:"KRW"}:{}),
   state:"verified",recognition:"accepted",refs:[{documentId:"document",page:1,quote,sourceHash:sha}],validation:[]};
  data.facts.push(f);return f.id;
 };
 return {data,add};
}
test("source-only business cost with no typed income cannot leak literal zero into D5103/D5110 monthly-business-income token",()=>{
 const {data,add}=seed();
 add("cost","cost-row","business_costs_and_ledgers::income.business_cost.gross_amount","800000",true);
 add("start","cost-row","business_costs_and_ledgers::income.business_cost.period_start","2026-10-01");
 add("end","cost-row","business_costs_and_ledgers::income.business_cost.period_end","2026-10-31");
 const c=calculateCase(data,rule),forms=buildFormBindings(data,c);
 assert.equal(c.monthlyIncomeWon,null);
 assert.equal(forms.scalars.monthly_business_income,MISSING_FORM_VALUE);
 assert.equal(forms.scalars.monthly_income,MISSING_FORM_VALUE);
 assert.notEqual(forms.scalars.monthly_business_income,"0");
});
test("accepted unrelated wage is not permission to fill missing business income with a fabricated zero",()=>{
 const {data,add}=seed();
 const id=add("wage","wage-1","income.net","2500000",true);
 data.incomes=[{id:"wage-1",kind:"wage",label:"synthetic wage",net:normalizeMoney("2500000"),
  amountBasis:"monthly",periodStart:"2026-10-01",periodEnd:"2026-10-31",
  recognition:"accepted",recurring:"yes",factIds:[id]}];
 add("cost","cost-row","business_costs_and_ledgers::income.business_cost.gross_amount","800000",true);
 add("start","cost-row","business_costs_and_ledgers::income.business_cost.period_start","2026-10-01");
 add("end","cost-row","business_costs_and_ledgers::income.business_cost.period_end","2026-10-31");
 const c=calculateCase(data,rule),forms=buildFormBindings(data,c);
 assert.equal(c.monthlyIncomeWon,null);
 assert.equal(forms.scalars.monthly_business_income,MISSING_FORM_VALUE);
});
test("single supported business net still maps to canonical monthly-business-income form scalar",()=>{
 const {data,add}=seed();
 const id=add("net","income-1","income.net","2400000",true);
 data.incomes=[{id:"income-1",kind:"business",label:"synthetic business",net:normalizeMoney("2400000"),
  amountBasis:"monthly",periodStart:"2026-10-01",periodEnd:"2026-10-31",
  recognition:"accepted",recurring:"yes",factIds:[id]}];
 const c=calculateCase(data,rule),forms=buildFormBindings(data,c);
 assert.equal(c.monthlyIncomeWon,"2400000");
 assert.equal(forms.scalars.monthly_business_income,"2,400,000");
});
