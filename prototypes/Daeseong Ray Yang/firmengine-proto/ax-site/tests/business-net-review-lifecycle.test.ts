import test from "node:test";
import assert from "node:assert/strict";
import {installReferenceProvider,type ReferenceSnapshot} from "../lib/reference-runtime.ts";
import {BUSINESS_INCOME_POLICY_ID,BUSINESS_INCOME_POLICY_VERSION,validateBusinessIncomePolicy} from "../lib/business-income-policy.ts";
import {createCase,normalizeMoney,type CaseData,type Fact} from "../lib/domain.ts";
import {caseWorkflow} from "../lib/case-workflow-state.ts";
import {proposeBusinessNet,adoptBusinessNet,preflightBusinessNet,reviewedBusinessIncomeIds,type BusinessNetSelection} from "../lib/business-net-reconciliation.ts";
import {calculateCase} from "../lib/assessment.ts";
import {buildFormBindings,MISSING_FORM_VALUE} from "../lib/form-mapping.ts";

let reference:ReferenceSnapshot|undefined;
installReferenceProvider(()=>reference);
const testRule={
 id:"synthetic-2026-business-expense",courtId:"seoul",effectiveFrom:"2026-01-01",effectiveTo:null,
 approvedCostCategories:["원재료비","사업장임차료"],
 vatTreatment:"gross_and_costs_as_source_stated_after_human_vat_review",
 sourceUrls:["https://www.law.go.kr/"],
 reason:"공식 근거와 원문 금액을 검토한 사건별 합성 사업 경비 인식 규칙의 테스트"
};
function setPolicy(){
 reference={id:"synthetic-reference/1",revision:1,sha256:"e".repeat(64),
  values:{[BUSINESS_INCOME_POLICY_ID]:{schemaVersion:BUSINESS_INCOME_POLICY_VERSION,rules:[testRule]}},
  metadata:{[BUSINESS_INCOME_POLICY_ID]:{
   sourceUrls:["https://www.law.go.kr/"],effectiveFrom:"2026-01-01",
   reason:"Official source test",reviewedAt:"2026-10-30T00:00:00Z",
   reviewedBy:"synthetic-lawyer",recordSha256:"d".repeat(64),basisType:"official_source"
  }},
  bundleReview:{status:"verified",basedOnSha256:"e".repeat(64),artifactIds:[],
   artifacts:[],reason:"Synthetic approved test reference",reviewedAt:"2026-10-30T00:00:00Z",reviewedBy:"synthetic-lawyer"}};
}
const SHA="a".repeat(64),REG="business_registration::business_id";
const VAT="business_sales_vat::income.sales.",COST="business_costs_and_ledgers::income.business_cost.";
const rules={id:"synthetic",status:"source_verified" as const,sources:[]};
function input(month=1,filingStart="2026-01-01",filingEnd="2026-12-31"){
 const d=createCase("Synthetic business monthly review","business-monthly-case","2026-10-30");
 d.context.filingPeriod={start:filingStart,end:filingEnd};
 d.context.incomePeriodReviewed=true;d.context.inventoryComplete={income:"yes",debt:"yes",asset:"yes"};
 d.workflowState=caseWorkflow();
 d.household={recognizedLivingCost:normalizeMoney("0"),recognizedMembers:1,
  livingCostIncludesAdditional:true,recognition:"accepted",factIds:[]};
 d.context.monthlyTrusteeFee=normalizeMoney("0");d.context.monthlyPriorityPayment=normalizeMoney("0");
 d.context.monthlyEstatePayment=normalizeMoney("0");d.context.approvedMonthlyPayment=normalizeMoney("1000000");
 d.context.planMonths=36;
 const selection=appendMonth(d,month);
 return {d,selection};
}
function appendMonth(d:CaseData,month:number,existingRegistration?:string):BusinessNetSelection{
 const m=String(month).padStart(2,"0"),periodStart="2026-"+m+"-01";
 const periodEnd=new Date(Date.UTC(2026,month,0)).toISOString().slice(0,10);
 const regFactId=existingRegistration??"registration-id";
 const docIds=["registration", "vat-"+m,"cost-a-"+m,"cost-b-"+m];
 for(const id of docIds){
  if(d.documents.some(x=>x.id===id))continue;
  d.documents.push({id,name:id+".pdf",sha256:SHA,status:"active",pages:[1]});
  d.pages.push({documentId:id,page:1,role:"evidence",text:""});
 }
 const add=(doc:string,id:string,subject:string,canonicalFieldId:string,value:string,monetary=false)=>{
  const quote=canonicalFieldId+" "+value;
  const page=d.pages.find(p=>p.documentId===doc)!;page.text+=(page.text?" | ":"")+quote;
  const fact:Fact={id,logicalId:id,version:1,subjectId:subject,canonicalFieldId,
   key:canonicalFieldId,value,rawValue:value,
   ...(monetary?{sourceUnit:"KRW",numeric:normalizeMoney(value),
    fieldObservation:{sourceState:"present"} as Fact["fieldObservation"]}:{}),
   state:"verified",recognition:"accepted",validation:[],
   refs:[{documentId:doc,page:1,quote,sourceHash:SHA}]};
  d.facts.push(fact);return id;
 };
 if(!existingRegistration)add("registration",regFactId,"registered-business",REG,"123-45-67890");
 const src="vat-"+m;
 const gross=add(src,"gross-"+m,src,VAT+"gross_sales","3000000",true);
 const vatOwner=add(src,"vat-owner-"+m,src,VAT+"business_entity","Synthetic Co");
 const vatStart=add(src,"vat-start-"+m,src,VAT+"reporting_period_start",periodStart);
 const vatEnd=add(src,"vat-end-"+m,src,VAT+"reporting_period_end",periodEnd);
 const vatCollected=add(src,"vat-tax-"+m,src,VAT+"vat_collected","300000",true);
 d.incomes.push({id:src,kind:"business",label:"VAT raw receipt",gross:normalizeMoney("3000000"),
  expenses:null,net:null,sourceCalculationRole:"gross_turnover_only",amountBasis:"unknown",
  recognition:"unreviewed",factIds:[gross,vatOwner,vatStart,vatEnd,vatCollected],
  periodStart,periodEnd});
 const costSources=[["cost-a-"+m,"1000000","원재료비"],["cost-b-"+m,"500000","사업장임차료"]];
 const costs=costSources.map(([doc,amount,category])=>{
  const name="cost-"+doc;
  const id=add(doc,name,doc,COST+"gross_amount",amount,true);
  add(doc,"owner-"+doc,doc,COST+"business_entity","Synthetic Co");
  add(doc,"start-"+doc,doc,COST+"period_start",periodStart);
  add(doc,"end-"+doc,doc,COST+"period_end",periodEnd);
  add(doc,"category-"+doc,doc,COST+"expense_category",category);
  return id;
 });
 return {month:"2026-"+m,businessRegistrationFactId:regFactId,grossFactId:gross,costFactIds:costs};
}
async function adopt(d:CaseData,s:BusinessNetSelection){
 const proposal=await proposeBusinessNet(d,s,"담당자 원문 대조 후 법률 검토 제안","staff","2026-10-30T00:00:00Z");
 d.workflowState!.businessNetReviews.push(proposal);
 const {review,income}=adoptBusinessNet(d,proposal.id,"synthetic-lawyer",
  "해당 등록사업자와 매출·경비 원문행 동일성 및 부가세·공제 인정 기준 확인","2026-10-30T00:00:01Z");
 d.workflowState!.businessNetReviews[d.workflowState!.businessNetReviews.length-1]=review;
 d.incomes.push(income);
 return {proposal,review,income};
}
test("policy is OFF by default and never permits an automatic legal business income",()=>{
 reference=undefined;
 const {d,selection}=input(1);
 assert.throws(()=>preflightBusinessNet(d,selection),/BUSINESS_OFFICIAL_REFERENCE_REVIEW_REQUIRED/);
 assert.equal(d.incomes[0].sourceCalculationRole,"gross_turnover_only");
 const c=calculateCase(d,rules);
 assert.equal(c.monthlyIncomeWon,null);
});
test("approved official-rule, explicit source amounts, two expense categories and lawyer receipt produce only one typed income",async()=>{
 setPolicy();
 const {d,selection}=input(1,"2026-01-01","2026-01-31");
 const {review,income}=await adopt(d,selection);
 assert.equal(income.gross?.amountWon,"3000000");
 assert.equal(income.expenses?.amountWon,"1500000");
 assert.equal(income.net?.amountWon,"1500000");
 assert.equal(review.status,"approved");
 assert.equal(reviewedBusinessIncomeIds(d).has(income.id),true);
 const c=calculateCase(d,rules);
 assert.equal(c.monthlyIncomeWon,"1500000",JSON.stringify(c.issues));
 assert.equal(c.incomeRows.length,1,"Original VAT source-only row may not be counted twice");
 assert.equal(c.monthlyPaymentWon,"1000000");
 assert.equal(c.planTotalWon,"36000000");
 const form=buildFormBindings(d,c);
 assert.equal(form.scalars.monthly_business_income,"1,500,000");
 assert.equal(form.scalars.monthly_income,"1,500,000");
 assert.equal(form.scalars.monthly_payment,"1,000,000");
 assert.equal(form.rows.month.length,1);
 assert.equal(form.rows.month[0].net_income,"1,500,000");
});
test("one registration ID may support 12 approved distinct months but one money source cannot be reused twice",async()=>{
 setPolicy();
 const {d,selection}=input(1);
 await adopt(d,selection);
 for(let month=2;month<=12;month++){
  const monthSelection=appendMonth(d,month,selection.businessRegistrationFactId);
  await adopt(d,monthSelection);
 }
 assert.equal(d.workflowState!.businessNetReviews.length,12);
 assert.equal(reviewedBusinessIncomeIds(d).size,12);
 const c=calculateCase(d,rules);
 assert.equal(c.monthlyIncomeWon,"1500000",JSON.stringify(c.issues));
 assert.equal(c.incomeRows.length,12);
 const form=buildFormBindings(d,c);
 assert.equal(form.rows.month.length,12);
 assert.equal(form.scalars.monthly_business_income,"1,500,000");
 assert.throws(()=>preflightBusinessNet(d,selection),/BUSINESS_MONTH_OR_SOURCE_ALREADY_APPROVED/);
});
test("changed gross or policy reference invalidates review and blocks legal monthly income",async()=>{
 setPolicy();
 const {d,selection}=input(1,"2026-01-01","2026-01-31");
 const {income}=await adopt(d,selection);
 assert.equal(reviewedBusinessIncomeIds(d).has(income.id),true);
 d.facts.find(f=>f.id===selection.grossFactId)!.value="3200000";
 assert.equal(reviewedBusinessIncomeIds(d).has(income.id),false);
 assert.equal(calculateCase(d,rules).monthlyIncomeWon,null);
 setPolicy();
 const untouched=input(1,"2026-01-01","2026-01-31");
 const {income:other}=await adopt(untouched.d,untouched.selection);
 reference={...reference!,sha256:"c".repeat(64)};
 assert.equal(reviewedBusinessIncomeIds(untouched.d).has(other.id),false);
 assert.equal(calculateCase(untouched.d,rules).monthlyIncomeWon,null);
});
test("only explicitly covered cost categories can be reviewed; duplicate cost IDs are rejected",()=>{
 setPolicy();
 const {d,selection}=input(1);
 const expense=d.facts.find(f=>f.id===selection.costFactIds[1])!;
 const category=d.facts.find(f=>f.subjectId===expense.subjectId&&f.canonicalFieldId===COST+"expense_category")!;
 category.value="개인 사치성 지출";
 assert.throws(()=>preflightBusinessNet(d,selection),/BUSINESS_EXPENSE_CATEGORY_NOT_APPROVED/);
 category.value="사업장임차료";
 assert.throws(()=>preflightBusinessNet(d,{...selection,costFactIds:[selection.costFactIds[0],selection.costFactIds[0]]}),/BUSINESS_REVIEW_SELECTION_INVALID/);
});
test("policy validator rejects absent official sources and malformed cost approval",()=>{
 const valid={schemaVersion:BUSINESS_INCOME_POLICY_VERSION,rules:[testRule]};
 validateBusinessIncomePolicy(valid);
 assert.throws(()=>validateBusinessIncomePolicy({schemaVersion:BUSINESS_INCOME_POLICY_VERSION,
  rules:[{...testRule,sourceUrls:["https://fake.example"]}]}),/INVALID_BUSINESS_INCOME_POLICY/);
});
