import test from "node:test";
import assert from "node:assert/strict";
import {auditBusinessSourceEvidence} from "../lib/business-source-evidence.ts";
import {calculateCase} from "../lib/assessment.ts";
import {createCase,normalizeMoney,type Fact} from "../lib/domain.ts";
const rules={id:"synthetic",status:"source_verified" as const,sources:[]};
const cost="business_costs_and_ledgers::income.business_cost.";
const sales="business_sales_vat::income.sales.";
function fixture(){
 const data=createCase("synthetic cost/turnover records","business-source-audit-test","2026-10-30");
 const sha="d".repeat(64);
 data.documents=[{id:"source",name:"synthetic.pdf",status:"active",sha256:sha,pages:[1]}];
 data.pages=[{documentId:"source",page:1,role:"evidence",text:"Synthetic business cost observation and period"}];
 data.context.inventoryComplete.income="yes";
 data.context.filingPeriod={start:"2025-01-01",end:"2025-12-31"};
 data.context.incomePeriodReviewed=true;
 const add=(id:string,subjectId:string,canonicalFieldId:string,value:string,isMoney=false)=>{
  const fact:Fact={id,logicalId:id,version:1,subjectId,canonicalFieldId,key:"business.source_only."+canonicalFieldId,
   value,rawValue:value,...(isMoney?{sourceUnit:"KRW",numeric:normalizeMoney(value)}:{}),
   state:"verified",recognition:"accepted",
   refs:[{documentId:"source",page:1,quote:"Synthetic business cost observation and period",sourceHash:sha}],
   validation:[]};
  data.facts.push(fact);
 };
 const costRow=(subjectId:string,value:string,start:string,end:string)=>{
  add(subjectId+"-amount",subjectId,cost+"gross_amount",value,true);
  add(subjectId+"-start",subjectId,cost+"period_start",start);
  add(subjectId+"-end",subjectId,cost+"period_end",end);
 };
 return{data,add,costRow};
}
test("a verified expense-only business record cannot quietly establish zero monthly income",()=>{
 const {data,costRow}=fixture();
 costRow("expense-jan","800000","2025-01-01","2025-01-31");
 const audit=auditBusinessSourceEvidence(data);
 assert.equal(audit.summary.sourceMoneyFacts,1);
 assert.equal(audit.summary.currentlyRelevant,1);
 assert.equal(audit.summary.zeroIncomeWouldBeUnsupported,true);
 assert.equal(audit.rows[0].role,"cost_line");
 assert.equal(audit.rows[0].amountWon,"800000");
 assert.equal(audit.rows[0].periodOverlap,"inside");
 const c=calculateCase(data,rules);
 assert.equal(c.monthlyIncomeWon,null);
 assert.equal(c.disposableIncomeWon,null);
 assert.ok(c.issues.includes("INCOME_BUSINESS_SOURCE_ONLY_REQUIRES_RECONCILIATION"));
});
test("repeatable expense rows stay distinct and paged without summing into net income",()=>{
 const {data,costRow}=fixture();
 costRow("expense-jan","800000","2025-01-01","2025-01-31");
 costRow("expense-feb","750000","2025-02-01","2025-02-28");
 const first=auditBusinessSourceEvidence(data,undefined,{limit:1,offset:0});
 const second=auditBusinessSourceEvidence(data,undefined,{limit:1,offset:1});
 assert.equal(first.total,2);
 assert.equal(first.nextOffset,1);
 assert.equal(second.nextOffset,null);
 assert.notEqual(first.rows[0].factId,second.rows[0].factId);
 assert.deepEqual([first.rows[0].amountWon,second.rows[0].amountWon],["750000","800000"]);
 assert.equal(first.automaticNetCalculation,false);
 assert.equal(calculateCase(data,rules).monthlyIncomeWon,null);
});
test("an explicitly out-of-period historical ledger remains visible without blocking current zero inventory",()=>{
 const {data,costRow}=fixture();
 costRow("old-expense","800000","2024-01-01","2024-01-31");
 const audit=auditBusinessSourceEvidence(data);
 assert.equal(audit.rows[0].periodOverlap,"outside");
 assert.equal(audit.summary.zeroIncomeWouldBeUnsupported,false);
 assert.equal(calculateCase(data,rules).monthlyIncomeWon,"0");
});
test("source-only VAT taxable/exempt sales do not auto-sum or prove a business net",()=>{
 const {data,add}=fixture();
 add("taxable","vat-row",sales+"taxable_sales","1300000",true);
 add("exempt","vat-row",sales+"exempt_sales","600000",true);
 add("start","vat-row",sales+"reporting_period_start","2025-01-01");
 add("end","vat-row",sales+"reporting_period_end","2025-01-31");
 const audit=auditBusinessSourceEvidence(data);
 assert.equal(audit.total,2);
 assert.equal(audit.summary.zeroIncomeWouldBeUnsupported,true);
 assert.ok(audit.rows.every(x=>x.role==="turnover_component"&&x.periodOverlap==="inside"));
 assert.equal(calculateCase(data,rules).monthlyIncomeWon,null);
});
test("source-only business facts with verified exclusions do not silently re-enter income",()=>{
 const {data,costRow}=fixture();
 costRow("excluded","500000","2025-02-01","2025-02-28");
 data.facts.find(f=>f.id==="excluded-amount")!.recognition="rejected";
 const audit=auditBusinessSourceEvidence(data);
 assert.equal(audit.total,1);
 assert.equal(audit.summary.zeroIncomeWouldBeUnsupported,false);
 assert.equal(calculateCase(data,rules).monthlyIncomeWon,"0");
});

test("source-only business money rejects stale raw, unit and conflicting OCR without losing source blocker",()=>{
  const {data,costRow}=fixture();
  costRow("recheck-january","800000","2025-01-01","2025-01-31");
  const cases:Array<{label:string;edit:(f:Fact)=>void}>=[
    {label:"fact/raw updated without numeric",edit:f=>{f.value="700000";f.rawValue="700000";}},
    {label:"raw updated only",edit:f=>{f.rawValue="700000";}},
    {label:"unit changed",edit:f=>{f.sourceUnit="만원";}},
    {label:"OCR conflicting",edit:f=>{f.fieldObservation={sourceState:"conflicting"} as NonNullable<Fact["fieldObservation"]>;}},
    {label:"OCR not seen",edit:f=>{f.fieldObservation={sourceState:"not_seen"} as NonNullable<Fact["fieldObservation"]>;}},
    {label:"OCR explicit none",edit:f=>{f.fieldObservation={sourceState:"explicit_none"} as NonNullable<Fact["fieldObservation"]>;}}
  ];
  for(const scenario of cases){
    const altered=structuredClone(data);
    const source=altered.facts.find(f=>f.id==="recheck-january-amount")!;
    scenario.edit(source);
    const audit=auditBusinessSourceEvidence(altered);
    assert.equal(audit.rows[0].verifiedAndAcceptedSource,false,scenario.label);
    assert.equal(audit.rows[0].amountWon,null,scenario.label);
    assert.equal(audit.summary.zeroIncomeWouldBeUnsupported,true,scenario.label);
    assert.equal(audit.automaticNetCalculation,false);
  }
});
test("exact 0 is observed money but never legal net income",()=>{
  const {data,costRow}=fixture();
  costRow("zero-expense","0","2025-01-01","2025-01-31");
  const observed=auditBusinessSourceEvidence(data);
  assert.equal(observed.rows[0].amountWon,"0");
  assert.equal(observed.rows[0].verifiedAndAcceptedSource,true);
  assert.equal(observed.rows[0].use,"source_only_not_legally_approved");
  assert.equal(observed.summary.zeroIncomeWouldBeUnsupported,true);
  data.facts.find(f=>f.id==="zero-expense-amount")!.recognition="unreviewed";
  const pending=auditBusinessSourceEvidence(data);
  assert.equal(pending.rows[0].amountWon,"0");
  assert.equal(pending.rows[0].verifiedAndAcceptedSource,false);
  assert.equal(pending.automaticNetCalculation,false);
});
