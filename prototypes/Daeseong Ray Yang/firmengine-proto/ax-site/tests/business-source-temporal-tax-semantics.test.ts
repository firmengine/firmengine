import test from "node:test";
import assert from "node:assert/strict";
import {auditBusinessSourceEvidence} from "../lib/business-source-evidence.ts";
import {buildBusinessMonthlyWorkbench} from "../lib/business-monthly-workbench.ts";
import {createCase,normalizeMoney,type Fact} from "../lib/domain.ts";

const C="business_current_income_summary::income.self_employment.";
const E="business_costs_and_ledgers::income.business_cost.";
function fixture(){
 const d=createCase("Synthetic date and VAT semantics","business-schema-event-case","2026-10-30");
 const sha="c".repeat(64),q="synthetic documented source value";
 d.documents=[{id:"doc",sha256:sha,status:"active",name:"synthetic.pdf",pages:[1]}];
 d.pages=[{documentId:"doc",page:1,role:"evidence",text:q}];
 d.context.filingPeriod={start:"2026-01-01",end:"2026-12-31"};
 d.context.inventoryComplete.income="yes";
 const add=(id:string,subjectId:string,canonicalFieldId:string,value:string,money:boolean)=>{
  const fact:Fact={id,logicalId:id,version:1,subjectId,key:"evidence."+id,canonicalFieldId,
   value,rawValue:value,...(money?{numeric:normalizeMoney(value),sourceUnit:"KRW"}:{}),
   state:"verified",recognition:"accepted",validation:[],
   refs:[{documentId:"doc",page:1,quote:q,sourceHash:sha}]};
  d.facts.push(fact);
 };
 return {d,add};
}
test("actual net cash receipt is event-dated, not automatically service-period monthly income",()=>{
 const {d,add}=fixture();
 add("receipt","contract-row",C+"net_receipt","1700000",true);
 add("start","contract-row",C+"service_period_start","2026-01-01",false);
 add("end","contract-row",C+"service_period_end","2026-01-31",false);
 const audit=auditBusinessSourceEvidence(d),row=audit.rows[0];
 assert.equal(row.role,"net_cash_received");
 assert.equal(row.periodStart,null);
 assert.equal(row.periodEnd,null);
 assert.equal(row.periodOverlap,"unknown");
 assert.equal(audit.summary.unreconciledCurrentSourceFacts,1);
 const monthly=buildBusinessMonthlyWorkbench(d);
 assert.equal(monthly.unassignedSourceFacts.length,1);
 assert.equal(monthly.months[0].arithmeticDifferenceWon,null);
});
test("expense tax component is INPUT VAT, never collected sales VAT or automatic deductible cost",()=>{
 const {d,add}=fixture();
 add("vat-input","expense-row",E+"tax_component","120000",true);
 add("start","expense-row",E+"period_start","2026-01-01",false);
 add("end","expense-row",E+"period_end","2026-01-31",false);
 const audit=auditBusinessSourceEvidence(d);
 assert.equal(audit.rows[0].role,"input_vat");
 const worksheet=buildBusinessMonthlyWorkbench(d);
 assert.equal(worksheet.months[0].receiptAndTaxFacts.length,1);
 assert.equal(worksheet.months[0].receiptAndTaxFacts[0],"vat-input");
 assert.equal(worksheet.months[0].sumRawCostLinesWon,null);
 assert.equal(worksheet.months[0].arithmeticDifferenceWon,null);
});
