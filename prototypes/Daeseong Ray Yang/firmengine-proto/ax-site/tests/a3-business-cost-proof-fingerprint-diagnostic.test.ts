/** A3 r81 RED diagnostic only: source-only cost payment evidence vs reviewed-net basis.
 * These assertions express independent safety expectations, not approved
 * accounting/legal expense-recognition rules. Keep Draft until staff/lawyer
 * approve the intended invalidation policy and run this with Node 22+.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {installReferenceProvider,type ReferenceSnapshot} from "../lib/reference-runtime.ts";
import {BUSINESS_INCOME_POLICY_ID,BUSINESS_INCOME_POLICY_VERSION} from "../lib/business-income-policy.ts";
import {createCase,normalizeMoney,type Fact} from "../lib/domain.ts";
import {caseWorkflow} from "../lib/case-workflow-state.ts";
import {preflightBusinessNet} from "../lib/business-net-reconciliation.ts";

const SHA="a".repeat(64);
const REG="business_registration::business_id";
const VAT="business_sales_vat::income.sales.";
const COST="business_costs_and_ledgers::income.business_cost.";
let snapshot:ReferenceSnapshot|undefined;
installReferenceProvider(()=>snapshot);
function installSyntheticPolicy(){
 const rule={
  id:"a3-synthetic-cost-policy",courtId:"seoul",effectiveFrom:"2026-01-01",effectiveTo:null,
  approvedCostCategories:["원재료비"],vatTreatment:"gross_and_costs_as_source_stated_after_human_vat_review",
  sourceUrls:["https://www.law.go.kr/"],reason:"Synthetic reference fixture only"
 };
 snapshot={id:"synthetic-a3-source/1",revision:1,sha256:"e".repeat(64),
  values:{[BUSINESS_INCOME_POLICY_ID]:{schemaVersion:BUSINESS_INCOME_POLICY_VERSION,rules:[rule]}},
  metadata:{[BUSINESS_INCOME_POLICY_ID]:{
   sourceUrls:["https://www.law.go.kr/"],effectiveFrom:"2026-01-01",
   reason:"Synthetic test only",reviewedAt:"2026-10-30T00:00:00Z",
   reviewedBy:"synthetic-reviewer",recordSha256:"d".repeat(64),basisType:"official_source"
  }},
  bundleReview:{status:"verified",basedOnSha256:"e".repeat(64),artifactIds:[],
   artifacts:[],reason:"Synthetic tested reference",reviewedAt:"2026-10-30T00:00:00Z",
   reviewedBy:"synthetic-reviewer"}};
}
function fixture(){
 installSyntheticPolicy();
 const data=createCase("Synthetic A3 business expense source row","a3-cost-proof-diagnostic","2026-10-30");
 data.context.filingPeriod={start:"2026-09-01",end:"2026-09-30"};
 data.context.asOf="2026-12-31";
 data.workflowState=caseWorkflow();
 for(const id of ["registration","vat","cost"]){
  data.documents.push({id,name:id+".pdf",sha256:SHA,status:"active",pages:[1]});
  data.pages.push({documentId:id,page:1,role:"evidence",text:""});
 }
 const add=(documentId:string,id:string,subjectId:string,canonicalFieldId:string,value:string,monetary=false)=>{
  const quote=canonicalFieldId+" "+value;
  data.pages.find(page=>page.documentId===documentId)!.text+=" | "+quote;
  const fact:Fact={id,logicalId:id,version:1,subjectId,canonicalFieldId,key:canonicalFieldId,
   value,rawValue:value,...(monetary?{sourceUnit:"KRW",numeric:normalizeMoney(value),
     fieldObservation:{sourceState:"present"} as Fact["fieldObservation"]}:{}),
   state:"verified",recognition:"accepted",validation:[],
   refs:[{documentId,page:1,quote,sourceHash:SHA}]};
  data.facts.push(fact);
  return fact;
 };
 add("registration","reg","registered-business",REG,"123-45-67890");
 add("vat","gross","sales-row",VAT+"gross_sales","3000000",true);
 add("vat","sales-owner","sales-row",VAT+"business_entity","Synthetic Co");
 add("vat","sales-start","sales-row",VAT+"reporting_period_start","2026-09-01");
 add("vat","sales-end","sales-row",VAT+"reporting_period_end","2026-09-30");
 add("cost","cost-amount","expense-row",COST+"gross_amount","1000000",true);
 add("cost","cost-owner","expense-row",COST+"business_entity","Synthetic Co");
 add("cost","cost-start","expense-row",COST+"period_start","2026-09-01");
 add("cost","cost-end","expense-row",COST+"period_end","2026-09-30");
 add("cost","cost-category","expense-row",COST+"expense_category","원재료비");
 const selection={month:"2026-09",businessRegistrationFactId:"reg",grossFactId:"gross",costFactIds:["cost-amount"]};
 return {data,selection,add};
}
test("CONTROL: one selected cost row does not double count and the net is source-only until approved",()=>{
 const {data,selection}=fixture();
 const result=preflightBusinessNet(data,selection);
 assert.equal(result.grossWon,"3000000");
 assert.equal(result.costWon,"1000000");
 assert.equal(result.netWon,"2000000");
 assert.ok(result.sourceFactIds.includes("cost-amount"));
 assert.ok(result.sourceFactIds.includes("cost-category"));
});
for(const [suffix,value] of [
 ["payment_status","unpaid"],
 ["payment_date","2026-11-20"],
 ["supplier","Different payee"]
] as const){
 test("RED diagnostic: later cost "+suffix+" evidence must trigger explicit review of approved basis",()=>{
  const {data,selection,add}=fixture();
  const before=preflightBusinessNet(data,selection);
  const id="later-"+suffix;
  add("cost",id,"expense-row",COST+suffix,value);
  const after=preflightBusinessNet(data,selection);
  // Current main is expected to leave these outside sourceFactIds.
  // The assertion is intentionally RED pending policy review; do not merge
  // this as a production gate without distinguishing cash/accrual accounting.
  assert.ok(after.sourceFactIds.includes(id),"A new exact cost source should be visible in the review basis");
  assert.notEqual(after.basisSnapshot,before.basisSnapshot,"New material source must invalidate a stale review");
 });
}
