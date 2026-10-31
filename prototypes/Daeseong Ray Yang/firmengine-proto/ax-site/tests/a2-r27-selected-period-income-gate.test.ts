import test from "node:test";
import assert from "node:assert/strict";
import {createCase, normalizeMoney} from "../lib/domain.ts";
import {calculateCase} from "../lib/assessment.ts";

/** Synthetic input only: never a court-recognized income or real OCR document. */
const rules={id:"SYN-r27",status:"source_verified" as const,sources:[]};
const allMonths=Array.from({length:12},(_,index)=>`2026-${String(index+1).padStart(2,"0")}`);
const selected={start:"2026-01-01",end:"2026-12-31"};
function syntheticCase(months:string[],period:{start:string;end:string},amount="2400000"){
 const data=createCase("synthetic A2 audit","SYN-r27-only","2027-03-01");
 const quotes=months.map(month=>`SYN wage month ${month} amount ${amount}`);
 data.documents=[{id:"SYN-doc",name:"synthetic.txt",sha256:"a".repeat(64),status:"active",pages:[1]}];
 data.pages=[{documentId:"SYN-doc",page:1,role:"evidence",text:quotes.join(" | ")}];
 data.facts=months.map((month,index)=>({
   id:"F-"+month,logicalId:"F-"+month,version:1,subjectId:"I-"+month,
   key:"income.net",value:amount,rawValue:amount,numeric:normalizeMoney(amount),
   sourceUnit:"KRW",state:"verified" as const,recognition:"accepted" as const,
   refs:[{documentId:"SYN-doc",page:1,quote:quotes[index]}],validation:[]
 }));
 data.incomes=months.map(month=>{
   const [year,index]=month.split("-").map(Number);
   return {id:"I-"+month,kind:"wage" as const,label:"SYN wage",payerIdentityId:"SYN-payer",
     net:normalizeMoney(amount),amountBasis:"monthly" as const,
     periodStart:month+"-01",periodEnd:new Date(Date.UTC(year,index,0)).toISOString().slice(0,10),
     periodMonths:1,recurring:"yes" as const,recognition:"accepted" as const,factIds:["F-"+month]};
 });
 data.context.inventoryComplete.income="yes";
 data.context.incomePeriodReviewed=true;
 data.context.filingPeriod=period;
 return calculateCase(data,rules);
}
test("A2-r27 valid 12-month source retains observable computed monthly income",()=>{
 const result=syntheticCase(allMonths,selected);
 assert.equal(result.monthlyIncomeWon,"2400000");
 assert.ok(!result.issues.includes("INCOME_FILING_PERIOD_INVALID"));
});
test("A2-r27 invalid selected partial first/last month cannot produce case-wide computed income",()=>{
 for(const period of [{start:"2026-01-15",end:"2026-12-31"},{start:"2026-01-01",end:"2026-12-15"}]){
  const result=syntheticCase(allMonths,period);
  assert.ok(result.issues.includes("INCOME_FILING_PERIOD_INVALID"),JSON.stringify(period));
  assert.equal(result.monthlyIncomeWon,null,JSON.stringify(period));
  assert.equal(result.incomeRows.length,12);
 }
});
test("A2-r27 selected period with an impossible end date remains unresolved",()=>{
 const result=syntheticCase(allMonths.slice(0,2),{start:"2026-01-01",end:"2026-02-30"});
 assert.equal(result.monthlyIncomeWon,null);
 assert.ok(result.issues.includes("INCOME_FILING_PERIOD_INVALID"));
});
test("A2-r27 first, middle and last missing month remain unknown, not zero",()=>{
 for(const subset of [allMonths.slice(1),allMonths.filter(m=>m!=="2026-06"),allMonths.slice(0,11)]){
  const result=syntheticCase(subset,selected);
  assert.equal(result.monthlyIncomeWon,null);
  assert.ok(result.issues.includes("INCOME_PERIOD_COVERAGE_INCOMPLETE"));
 }
});
test("A2-r27 explicit observed zero is distinct from missing month",()=>{
 const observedZero=syntheticCase(allMonths,selected,"0");
 assert.equal(observedZero.monthlyIncomeWon,"0");
 const absent=syntheticCase(allMonths.slice(0,11),selected,"0");
 assert.equal(absent.monthlyIncomeWon,null);
});
