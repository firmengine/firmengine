import test from "node:test";
import assert from "node:assert/strict";
import {auditBusinessSourceEvidence} from "../lib/business-source-evidence.ts";
import {calculateCase} from "../lib/assessment.ts";
import {createCase,normalizeMoney,type Fact} from "../lib/domain.ts";

const COST="business_costs_and_ledgers::income.business_cost.";
const RULES={id:"synthetic",status:"source_verified" as const,sources:[]};
function fixture(){
 const data=createCase("synthetic business evidence","synthetic-business-periods","2026-10-30");
 const sha="a".repeat(64),quote="synthetic evidence record";
 data.documents=[{id:"doc",sha256:sha,name:"synthetic.pdf",status:"active",pages:[1]}];
 data.pages=[{documentId:"doc",page:1,role:"evidence",text:quote}];
 data.context.inventoryComplete.income="yes";
 data.context.filingPeriod={start:"2026-01-01",end:"2026-12-31"};
 data.context.incomePeriodReviewed=true;
 const add=(id:string,canonicalFieldId:string,value:string,recognition:"accepted"|"unreviewed"="accepted")=>{
  const row:Fact={id,logicalId:id,version:1,subjectId:"cost-record",canonicalFieldId,key:"business.source_only."+id,
   value,rawValue:value,...(canonicalFieldId.endsWith("gross_amount")?{numeric:normalizeMoney(value),sourceUnit:"KRW"}:{}),
   state:"verified",recognition,validation:[],refs:[{documentId:"doc",page:1,quote,sourceHash:sha}]};
  data.facts.push(row);
  return row;
 };
 add("cost",COST+"gross_amount","420000");
 return {data,add};
}
test("conflicting historical and current dates cannot suppress source-only current-income review",()=>{
 const {data,add}=fixture();
 add("start-old",COST+"period_start","2024-01-01");
 add("start-current",COST+"period_start","2026-02-01");
 add("end",COST+"period_end","2026-02-28");
 const audit=auditBusinessSourceEvidence(data);
 assert.equal(audit.rows[0].periodOverlap,"unknown");
 assert.equal(audit.summary.zeroIncomeWouldBeUnsupported,true);
 assert.equal(calculateCase(data,RULES).monthlyIncomeWon,null);
});
test("an unreviewed historical date cannot be used to infer that business cost is out-of-period",()=>{
 const {data,add}=fixture();
 add("start",COST+"period_start","2024-01-01","unreviewed");
 add("end",COST+"period_end","2024-01-31");
 const audit=auditBusinessSourceEvidence(data);
 assert.equal(audit.rows[0].periodOverlap,"unknown");
 assert.equal(audit.summary.zeroIncomeWouldBeUnsupported,true);
 assert.equal(calculateCase(data,RULES).monthlyIncomeWon,null);
});
test("one source-backed verified historical period remains visible without silently treating it as current",()=>{
 const {data,add}=fixture();
 add("start",COST+"period_start","2024-01-01");
 add("end",COST+"period_end","2024-01-31");
 const audit=auditBusinessSourceEvidence(data);
 assert.equal(audit.rows[0].periodOverlap,"outside");
 assert.equal(audit.summary.zeroIncomeWouldBeUnsupported,false);
});
test("a typed business amount lacking source facts does not clear a source-only business blocker",()=>{
 const {data,add}=fixture();
 add("start",COST+"period_start","2026-02-01");
 add("end",COST+"period_end","2026-02-28");
 data.incomes=[{id:"unsourced",kind:"business",label:"unverified handwritten",
  net:normalizeMoney("999999"),amountBasis:"monthly",recognition:"accepted",factIds:[]}];
 const audit=auditBusinessSourceEvidence(data);
 assert.equal(audit.summary.noCurrentBusinessIncomeCandidate,true);
 assert.equal(audit.summary.zeroIncomeWouldBeUnsupported,true);
 assert.equal(calculateCase(data,RULES).monthlyIncomeWon,null);
});
