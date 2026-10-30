import test from "node:test";
import assert from "node:assert/strict";
import {auditBusinessSourceEvidence} from "../lib/business-source-evidence.ts";
import {calculateCase} from "../lib/assessment.ts";
import {buildFormBindings,MISSING_FORM_VALUE} from "../lib/form-mapping.ts";
import {createCase,normalizeMoney,type Fact} from "../lib/domain.ts";
const RULES={id:"synthetic",status:"source_verified" as const,sources:[]};
const prefix="business_costs_and_ledgers::income.business_cost.";
function make(){
 const data=createCase("Synthetic current business source","business-overlap-source","2026-10-30");
 const sha="b".repeat(64),q="synthetic reviewed finance";
 data.documents=[{id:"doc",name:"synthetic.pdf",sha256:sha,status:"active",pages:[1]}];
 data.pages=[{documentId:"doc",page:1,role:"evidence",text:q}];
 data.context.inventoryComplete.income="yes";
 data.context.filingPeriod={start:"2026-10-01",end:"2026-10-31"};data.context.incomePeriodReviewed=true;
 const add=(id:string,subjectId:string,key:string,value:string,money:boolean)=>{
  const row:Fact={id,logicalId:id,version:1,subjectId,key:"business.input."+id,
   ...(key.includes("::")?{canonicalFieldId:key}:{}),value,rawValue:value,
   ...(money?{numeric:normalizeMoney(value),sourceUnit:"KRW"}:{}),
   state:"verified",recognition:"accepted",refs:[{documentId:"doc",page:1,quote:q,sourceHash:sha}],validation:[]};
  data.facts.push(row);
  return id;
 };
 const net=add("net","current-net","income.net","3000000",true);
 data.incomes=[{id:"current-net",kind:"business",label:"accepted current business",
  net:normalizeMoney("3000000"),amountBasis:"monthly",
  periodStart:"2026-10-01",periodEnd:"2026-10-31",recognition:"accepted",factIds:[net]}];
 const cost=(id:string,date="2026-10-01",end="2026-10-31")=>{
  const rec="cost-"+id;
  const amount=add(id,rec,prefix+"gross_amount","800000",true);
  add(id+"-start",rec,prefix+"period_start",date,false);
  add(id+"-end",rec,prefix+"period_end",end,false);
  return amount;
 };
 return {data,cost};
}
test("accepted net for another source cannot clear unconnected current business cost",()=>{
 const {data,cost}=make();
 cost("unlinked");
 const audit=auditBusinessSourceEvidence(data);
 assert.equal(audit.summary.noCurrentBusinessIncomeCandidate,false);
 assert.equal(audit.summary.unreconciledCurrentSourceFacts,1);
 assert.equal(audit.summary.zeroIncomeWouldBeUnsupported,true);
 const result=calculateCase(data,RULES);
 assert.equal(result.monthlyIncomeWon,null);
 assert.equal(buildFormBindings(data,result).scalars.monthly_business_income,MISSING_FORM_VALUE);
});
test("explicit cost source fact reference on accepted net source satisfies source coverage (not legal cost recognition)",()=>{
 const {data,cost}=make();
 const id=cost("linked");
 data.incomes[0].factIds.push(id);
 const audit=auditBusinessSourceEvidence(data);
 assert.equal(audit.summary.unreconciledCurrentSourceFacts,0);
 assert.equal(audit.summary.zeroIncomeWouldBeUnsupported,false);
 assert.equal(calculateCase(data,RULES).monthlyIncomeWon,"3000000");
});
test("historical out-of-period costs remain auditable but cannot be silently counted as current",()=>{
 const {data,cost}=make();cost("old","2025-10-01","2025-10-31");
 const audit=auditBusinessSourceEvidence(data);
 assert.equal(audit.summary.outsideSelectedPeriod,1);
 assert.equal(audit.summary.unreconciledCurrentSourceFacts,0);
 assert.equal(calculateCase(data,RULES).monthlyIncomeWon,"3000000");
});
test("source linkage remains incomplete when only one of two distinct current expense rows is attached",()=>{
 const {data,cost}=make();
 const first=cost("first"),second=cost("second");
 data.incomes[0].factIds.push(first);
 const audit=auditBusinessSourceEvidence(data);
 assert.equal(audit.summary.unreconciledCurrentSourceFacts,1);
 assert.ok(audit.rows.some(x=>x.factId===second&&x.linkedBusinessIncomeIds.length===0));
 assert.equal(calculateCase(data,RULES).monthlyIncomeWon,null);
});
