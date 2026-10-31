import test from "node:test";
import assert from "node:assert/strict";
import {createCase,normalizeMoney} from "../lib/domain.ts";
import {calculateCase} from "../lib/assessment.ts";
import {buildFormBindings,MISSING_FORM_VALUE} from "../lib/form-mapping.ts";

// Synthetic-only facts and calendar months; not a legal recognition decision.
const rules={id:"SYN-r23",status:"source_verified" as const,sources:[]};
type Sample={month:string;amount:string};
const months=Array.from({length:12},(_,i)=>`2026-${String(i+1).padStart(2,"0")}`);
const rows=(ms:string[],amount="2400000"):Sample[]=>ms.map(month=>({month,amount}));
function fixture(samples:Sample[],window?:{start:string;end:string}){
 const data=createCase("synthetic audit","SYN-r23-only","2027-03-01");
 const quotes=samples.map(s=>`SYN source ${s.month} ${s.amount}`);
 data.documents=[{id:"SYN-doc",name:"synthetic.txt",sha256:"a".repeat(64),status:"active",pages:[1]}];
 data.pages=[{documentId:"SYN-doc",page:1,role:"evidence",text:quotes.join(" | ")}];
 data.facts=samples.map((s,i)=>({
  id:"F-"+s.month,logicalId:"F-"+s.month,version:1,subjectId:"I-"+s.month,
  key:"income.net",value:s.amount,rawValue:s.amount,numeric:normalizeMoney(s.amount),
  sourceUnit:"KRW",state:"verified" as const,recognition:"accepted" as const,
  refs:[{documentId:"SYN-doc",page:1,quote:quotes[i]}],validation:[]
 }));
 data.incomes=samples.map(s=>{
  const [y,m]=s.month.split("-").map(Number);
  return {id:"I-"+s.month,kind:"wage" as const,label:"SYN wage",payerIdentityId:"SYN-payer",
   net:normalizeMoney(s.amount),amountBasis:"monthly" as const,
   periodStart:s.month+"-01",periodEnd:new Date(Date.UTC(y,m,0)).toISOString().slice(0,10),
   periodMonths:1,recurring:"yes" as const,recognition:"accepted" as const,factIds:["F-"+s.month]};
 });
 data.context.inventoryComplete.income="yes";
 data.context.incomePeriodReviewed=true;
 if(window)data.context.filingPeriod=window;
 const calculation=calculateCase(data,rules);
 return {calculation,form:buildFormBindings(data,calculation)};
}
const period={start:"2026-01-01",end:"2026-12-31"};
const monthRow=(form:ReturnType<typeof buildFormBindings>,month:string)=>form.rows.month.find(row=>row.period===month);
test("A2 r23: future and prior source rows stay visible but their amounts cannot enter selected-period D5103",()=>{
 const {form}=fixture(rows(["2025-12",...months,"2027-01"]),period);
 assert.equal(monthRow(form,"2025-12")?.net_income,MISSING_FORM_VALUE);
 assert.equal(monthRow(form,"2027-01")?.net_income,MISSING_FORM_VALUE);
 assert.equal(monthRow(form,"2027-01")?.revenue,MISSING_FORM_VALUE);
 assert.equal(monthRow(form,"2026-12")?.net_income,"2,400,000");
});
test("A2 r23: all twelve complete selected months retain their typed monetary values",()=>{
 const {calculation,form}=fixture(rows(months),period);
 assert.equal(calculation.monthlyIncomeWon,"2400000");
 assert.equal(form.rows.month.length,12);
 assert.ok(months.every(m=>monthRow(form,m)?.net_income==="2,400,000"));
});
test("A2 r23: 11 of 12 months leaves case income null while preserving source-only 11 rows",()=>{
 const {calculation,form}=fixture(rows(months.slice(0,11)),period);
 assert.equal(calculation.monthlyIncomeWon,null);
 assert.ok(calculation.issues.includes("INCOME_PERIOD_COVERAGE_INCOMPLETE"));
 assert.equal(form.scalars.approved_monthly_income,MISSING_FORM_VALUE);
 assert.equal(form.rows.month.length,11);
});
test("A2 r23: explicit in-period zero remains zero, out-of-period zero stays source-only",()=>{
 const {form}=fixture(rows(["2026-01","2027-01"],"0"),period);
 assert.equal(monthRow(form,"2026-01")?.net_income,"0");
 assert.equal(monthRow(form,"2027-01")?.net_income,MISSING_FORM_VALUE);
});
test("A2 r23: invalid selected window does not attest income; absent selection leaves previews not approvals",()=>{
 const invalid=fixture(rows(["2026-01"]),{start:"2026-01-15",end:"2026-12-31"});
 assert.equal(monthRow(invalid.form,"2026-01")?.net_income,MISSING_FORM_VALUE);
 const absent=fixture(rows(["2026-01"]));
 assert.equal(monthRow(absent.form,"2026-01")?.net_income,"2,400,000");
 assert.equal(absent.form.scalars.approved_monthly_income,MISSING_FORM_VALUE);
});

// A2 r24 lawyer boundary: observed income is not approved until a representative period is selected.
test("A2 r24: no selected representative period cannot create approved monthly income even with 12 observations",()=>{
 const {calculation,form}=fixture(rows(months));
 assert.ok(calculation.issues.includes("INCOME_REPRESENTATIVE_PERIOD_NOT_SELECTED"));
 assert.equal(form.scalars.approved_monthly_income,MISSING_FORM_VALUE);
 assert.equal(form.rows.month.length,12); // source-only preview is preserved
});
