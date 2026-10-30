import test from "node:test";
import assert from "node:assert/strict";
import {assembleBusinessMonthEvidence} from "../lib/business-monthly-workbench.ts";
import type {BusinessSourceMoneyRow,BusinessMoneyRole} from "../lib/business-source-evidence.ts";
const period={start:"2026-01-01",end:"2026-12-31"};
const end=(month:number)=>new Date(Date.UTC(2026,month,0)).toISOString().slice(0,10);
function row(month:number,role:BusinessMoneyRole,amount:string,id:string,patch:Partial<BusinessSourceMoneyRow>={}):BusinessSourceMoneyRow{
 const m=String(month).padStart(2,"0");
 return {factId:id,canonicalFieldId:"synthetic::"+role,role,sourceRecordId:id,
 sourceDocumentIds:["synthetic"],sourcePages:[1],amountWon:amount,observedState:"present",reviewState:"accepted",
 verifiedAndAcceptedSource:true,periodStart:`2026-${m}-01`,periodEnd:end(month),periodOverlap:"inside",
 linkedBusinessIncomeIds:[],use:"source_only_not_legally_approved",...patch};
}
test("complete twelve months with repeated expense rows preserve exactly one reviewed-source diagnostic per month",()=>{
 const input=Array.from({length:12},(_,i)=>{
   const m=i+1;
   return [row(m,"turnover_total","3000000","sales-"+m),
     row(m,"cost_line","1000000","cost-a-"+m),row(m,"cost_line","500000","cost-b-"+m)];
 }).flat();
 const result=assembleBusinessMonthEvidence(input,period);
 assert.equal(result.expectedMonths,12);
 assert.equal(result.months.length,12);
 assert.equal(result.incompleteSourceCoverage,false);
 assert.ok(result.months.every(month=>month.sourceGrossWon==="3000000"));
 assert.ok(result.months.every(month=>month.sumRawCostLinesWon==="1500000"));
 assert.ok(result.months.every(month=>month.arithmeticDifferenceWon==="1500000"));
 assert.ok(result.months.every(month=>month.legalNetApproved===false));
 assert.ok(result.months.every(month=>month.gaps.includes("BUSINESS_IDENTITY_NOT_CROSSWALKED")));
 assert.equal(result.months.flatMap(month=>month.costLineFacts).length,24);
});
test("eleven months never impersonate a complete twelve-month income history",()=>{
 const rows=Array.from({length:11},(_,i)=>[row(i+1,"turnover_total","1000000","revenue-"+i),
 row(i+1,"cost_line","250000","expense-"+i)]).flat();
 const result=assembleBusinessMonthEvidence(rows,period);
 assert.equal(result.months.length,12);
 assert.equal(result.months[11].month,"2026-12");
 assert.equal(result.months[11].arithmeticDifferenceWon,null);
 assert.ok(result.months[11].gaps.includes("BUSINESS_MONTH_NO_SOURCE_ROWS"));
 assert.equal(result.incompleteSourceCoverage,true);
});
test("two totals in the same month cannot be summed as one business turnover",()=>{
 const rows=[row(1,"turnover_total","3000000","gross-source-a"),
 row(1,"turnover_total","3200000","gross-source-b"),row(1,"cost_line","1000000","expense")];
 const a=assembleBusinessMonthEvidence(rows,{start:"2026-01-01",end:"2026-01-31"}).months[0];
 assert.equal(a.sourceGrossWon,null);
 assert.equal(a.arithmeticDifferenceWon,null);
 assert.ok(a.gaps.includes("BUSINESS_GROSS_TOTAL_MULTIPLE"));
 assert.equal(a.revenueGrossFacts.length,2);
});
test("aggregate cost and itemized cost cannot both be deducted",()=>{
 const rows=[row(1,"turnover_total","3000000","gross"),row(1,"cost_line","1000000","cost"),
 row(1,"cost_summary","1000000","summary")];
 const a=assembleBusinessMonthEvidence(rows,{start:"2026-01-01",end:"2026-01-31"}).months[0];
 assert.equal(a.sumRawCostLinesWon,null);
 assert.equal(a.arithmeticDifferenceWon,null);
 assert.ok(a.gaps.includes("BUSINESS_COST_TOTAL_AND_LINES_OVERLAP"));
});
test("multiple cost amounts from one source record are not treated as independent invoices",()=>{
 const rows=[row(1,"turnover_total","3000000","gross"),row(1,"cost_line","1000000","cost-a",{sourceRecordId:"same-row"}),
 row(1,"cost_line","1000000","cost-b",{sourceRecordId:"same-row"})];
 const a=assembleBusinessMonthEvidence(rows,{start:"2026-01-01",end:"2026-01-31"}).months[0];
 assert.ok(a.gaps.includes("BUSINESS_COST_ROW_AMOUNT_AMBIGUOUS"));
 assert.equal(a.sumRawCostLinesWon,null);
 assert.equal(a.arithmeticDifferenceWon,null);
});
test("taxable and exempt components do not substitute for a certified gross sales total",()=>{
 const rows=[row(1,"turnover_component","2000000","taxable"),
 row(1,"turnover_component","1000000","exempt"),row(1,"cost_line","1000000","expense")];
 const a=assembleBusinessMonthEvidence(rows,{start:"2026-01-01",end:"2026-01-31"}).months[0];
 assert.equal(a.sourceGrossWon,null);
 assert.equal(a.arithmeticDifferenceWon,null);
 assert.deepEqual(a.componentSalesFacts,["taxable","exempt"]);
});
test("unverified or unreadable money never silently enters the arithmetic preview",()=>{
 const rows=[row(1,"turnover_total","3000000","gross",{verifiedAndAcceptedSource:false}),
 row(1,"cost_line","1000000","cost")];
 const a=assembleBusinessMonthEvidence(rows,{start:"2026-01-01",end:"2026-01-31"}).months[0];
 assert.equal(a.arithmeticDifferenceWon,null);
 assert.ok(a.gaps.includes("BUSINESS_SOURCE_VALUE_UNVERIFIED"));
});
test("partial-month and annual evidence remain unassigned instead of being coerced to January",()=>{
 const rows=[row(1,"turnover_total","3000000","partial",{periodStart:"2026-01-15"}),
 row(1,"cost_line","1000000","annual",{periodStart:"2026-01-01",periodEnd:"2026-12-31"})];
 const a=assembleBusinessMonthEvidence(rows,period);
 assert.equal(a.unassignedSourceFacts.length,2);
 assert.equal(a.months[0].arithmeticDifferenceWon,null);
 assert.equal(a.incompleteSourceCoverage,true);
});
test("2025 historic rows remain traceable but do not contribute to 2026 months",()=>{
 const a=assembleBusinessMonthEvidence([
 row(1,"turnover_total","5000000","historic",{periodStart:"2025-01-01",periodEnd:"2025-01-31",periodOverlap:"outside"})
 ],period);
 assert.equal(a.outsideSelectedPeriodFactIds.length,1);
 assert.equal(a.months[0].sourceGrossWon,null);
 assert.equal(a.incompleteSourceCoverage,true);
});
test("cash receipts/withholding/collected VAT never become gross sales or deductible expenses",()=>{
 const rows=[row(1,"net_cash_received","2000000","deposit"),row(1,"withheld_tax","200000","withholding"),
 row(1,"vat_collected","300000","vat")];
 const a=assembleBusinessMonthEvidence(rows,{start:"2026-01-01",end:"2026-01-31"}).months[0];
 assert.equal(a.sourceGrossWon,null);assert.equal(a.sumRawCostLinesWon,null);
 assert.equal(a.arithmeticDifferenceWon,null);
 assert.equal(a.receiptAndTaxFacts.length,3);
});
