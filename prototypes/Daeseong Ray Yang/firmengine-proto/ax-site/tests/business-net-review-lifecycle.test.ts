import test from "node:test";
import assert from "node:assert/strict";
import {installReferenceProvider,type ReferenceSnapshot} from "../lib/reference-runtime.ts";
import {BUSINESS_INCOME_POLICY_ID,BUSINESS_INCOME_POLICY_VERSION,validateBusinessIncomePolicy} from "../lib/business-income-policy.ts";
import {createCase,normalizeMoney,type CaseData,type Fact} from "../lib/domain.ts";
import {caseWorkflow} from "../lib/case-workflow-state.ts";
import {reduceCaseCommand} from "../lib/case-commands.ts";
import type {CaseCommand} from "../lib/case-command-contract.ts";
import {proposeBusinessNet,adoptBusinessNet,preflightBusinessNet,reviewedBusinessIncomeIds,type BusinessNetSelection} from "../lib/business-net-reconciliation.ts";
import {calculateCase} from "../lib/assessment.ts";
import {buildFormBindings,MISSING_FORM_VALUE} from "../lib/form-mapping.ts";
import {buildRepaymentPlanModel} from "../lib/repayment-plan-model.ts";
import {reconcilePlanLedger} from "../lib/plan-reconciliation.ts";

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
 d.context.asOf="2026-12-31"; // Synthetic historical coverage checkpoint, not production current date.
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
 d.workflowState!.businessNetReviews!.push(proposal);
 const {review,income}=adoptBusinessNet(d,proposal.id,"synthetic-lawyer",
  "해당 등록사업자와 매출·경비 원문행 동일성 및 부가세·공제 인정 기준 확인","2026-10-30T00:00:01Z");
 d.workflowState!.businessNetReviews![d.workflowState!.businessNetReviews!.length-1]=review;
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
 assert.equal(form.scalars.approved_monthly_income,"1,500,000","Source-only VAT evidence must not masquerade as a second missing reviewed net row");
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
 assert.equal(d.workflowState!.businessNetReviews!.length,12);
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


test("case command keeps source facts immutable; lawyer-only adoption is persisted and auditable",async()=>{
 setPolicy();
 const {d,selection}=input(1,"2026-01-01","2026-01-31");
 const beforeFacts=JSON.stringify(d.facts);
 const command=(type:CaseCommand["commandType"],target:Record<string,unknown>,patch:Record<string,unknown>):CaseCommand=>({
  commandId:"business-review-command-"+type.replaceAll(".","-"),
  commandType:type,payloadVersion:1,expectedRevision:d.context.revision,
  expectedStateFingerprint:"case-state/1:"+"f".repeat(64),
  target,patch,reason:"Case facts, business identity and cost source evidence explicitly reviewed"
 });
 const proposed=await reduceCaseCommand(d,
  command("business.net.propose",{},{
    businessRegistrationFactId:selection.businessRegistrationFactId,grossFactId:selection.grossFactId,
    costFactIds:selection.costFactIds,month:selection.month
  }),{actor:"synthetic-caseworker",roles:["case_editor"],at:"2026-10-30T00:00:00Z"});
 assert.equal(proposed.data.workflowState?.businessNetReviews?.length,1);
 assert.equal(proposed.data.context.revision,d.context.revision,"Preparing source-backed net must not reset the 10-minute source quiet window");
 assert.equal(JSON.stringify(proposed.data.facts),beforeFacts);
 const reviewId=proposed.data.workflowState!.businessNetReviews![0].id;
 await assert.rejects(reduceCaseCommand(proposed.data,
  command("business.net.adopt",{reviewId},{}),{actor:"caseworker",roles:["case_editor","caseworker_review"],at:"2026-10-30T00:00:01Z"}),/지정된 사람 검토 권한/);
 const adopted=await reduceCaseCommand(proposed.data,
  command("business.net.adopt",{reviewId},{}),
  {actor:"synthetic-lawyer",roles:["case_editor","lawyer_review"],at:"2026-10-30T00:00:02Z"});
 assert.equal(adopted.data.workflowState!.businessNetReviews![0].status,"approved");
 assert.equal(adopted.data.context.incomePeriodReviewed,false,"New approved income invalidates previous representative period review");
 assert.equal(adopted.data.context.ruleApplicationReviewed,false,"Lawyer adoption does not silently reapprove all statutory application");
 assert.equal(adopted.data.incomes.filter(x=>x.sourceCalculationRole==="period_income_observation").length,1);
 assert.equal(JSON.stringify(adopted.data.facts),beforeFacts);
 assert.equal(reviewedBusinessIncomeIds(adopted.data).size,1);
});

test("a source period after the case as-of date cannot become reviewed present income",()=>{
 setPolicy();
 const {d,selection}=input(11);
 d.context.asOf="2026-10-30";
 assert.throws(()=>preflightBusinessNet(d,selection),/BUSINESS_SOURCE_PERIOD_AFTER_CASE_AS_OF/);
});

test("raw source money, normalized unit and typed amount must agree before any reviewed net can be proposed",()=>{
 setPolicy();
 const {d,selection}=input(1,"2026-01-01","2026-01-31");
 const gross=d.facts.find(f=>f.id===selection.grossFactId)!;
 gross.value="3200000";
 assert.throws(()=>preflightBusinessNet(d,selection),/BUSINESS_RAW_NUMERIC_SOURCE_MISMATCH/);
 gross.value="3000000";
 gross.numeric!.rawValue="3200000";
 assert.throws(()=>preflightBusinessNet(d,selection),/BUSINESS_RAW_NUMERIC_SOURCE_MISMATCH/);
 gross.numeric!.rawValue="3000000";
 gross.sourceUnit="만원";
 assert.throws(()=>preflightBusinessNet(d,selection),/BUSINESS_RAW_NUMERIC_SOURCE_MISMATCH/);
});
test("a staff proposal cannot also be adopted by the same actor, even if the actor has lawyer role",async()=>{
 setPolicy();
 const {d,selection}=input(1,"2026-01-01","2026-01-31");
 const proposal=await proposeBusinessNet(d,selection,
  "The two source row identities need independent legal expense review",
  "same-user","2026-10-30T00:00:00Z");
 d.workflowState!.businessNetReviews!.push(proposal);
 assert.throws(()=>adoptBusinessNet(d,proposal.id,"same-user",
   "No self-review permitted under source and legal policy",
   "2026-10-30T00:00:01Z"),/BUSINESS_REVIEW_APPROVAL_INVALID/);
});

test("twelve approved business source-months reconcile D5103, D5110, creditor allocation and liquidation without inventing money",async()=>{
 setPolicy();
 const {d,selection}=input(1);
 await adopt(d,selection);
 for(let month=2;month<=12;month++)await adopt(d,appendMonth(d,month,selection.businessRegistrationFactId));
 const refDoc="creditor-proof",refQuote="Synthetic verified principal, interest and financial asset";
 d.documents.push({id:refDoc,name:"synthetic-claim-asset.pdf",sha256:SHA,status:"active",pages:[1]});
 d.pages.push({documentId:refDoc,page:1,role:"evidence",text:refQuote});
 const moneyFact=(id:string,subject:string,key:string,won:string)=>{
  const f:Fact={id,logicalId:id,version:1,subjectId:subject,key,value:won,rawValue:won,
    numeric:normalizeMoney(won),sourceUnit:"KRW",state:"verified",recognition:"accepted",
    refs:[{documentId:refDoc,page:1,quote:refQuote,sourceHash:SHA}],validation:[]};
  d.facts.push(f);return id;
 };
 const principal=moneyFact("debt-principal","debt-1","debt.principal_balance","100000000");
 const interest=moneyFact("debt-interest","debt-1","debt.interest","0");
 d.debts=[{id:"debt-1",creditor:"Synthetic bank",contractId:"A-1",principal:normalizeMoney("100000000"),
  interest:normalizeMoney("0"),secured:"no",classification:"ordinary",priority:"ordinary",asOf:d.context.asOf,
  legalReview:"accepted",factIds:[principal,interest]}];
 const gross=moneyFact("asset-gross","asset-1","asset.gross_value","1000000");
 const payoff=moneyFact("asset-payoff","asset-1","asset.secured_payoff","0");
 const costs=moneyFact("asset-cost","asset-1","asset.disposal_costs","0");
 const exempt=moneyFact("asset-exempt","asset-1","asset.protected_value","0");
 d.assets=[{id:"asset-1",kind:"deposit",label:"Synthetic deposit",grossValue:normalizeMoney("1000000"),
  securedPayoff:normalizeMoney("0"),disposalCosts:normalizeMoney("0"),protectedValue:normalizeMoney("0"),
  ownershipBps:10000,asOf:d.context.asOf,valuationBasis:"source-reviewed synthetic valuation",
  recognition:"accepted",factIds:[gross,payoff,costs,exempt]}];
 d.context.approvedPresentValue=normalizeMoney("30000000");
 d.context.presentValueBasis="Synthetic independently reviewed present value";
 d.context.presentValueReviewed=true;
 d.context.assetValuationBasisReviewed=true;
 d.context.allocationBasis="principal_then_interest_pro_rata";
 d.context.allocationBasisReviewed=true;
 d.context.ruleApplicationReviewed=true;
 d.context.incomePeriodReviewed=true;
 const calculation=calculateCase(d,rules);
 assert.equal(calculation.monthlyIncomeWon,"1500000",JSON.stringify(calculation.issues));
 assert.equal(calculation.planTotalWon,"36000000");
 assert.equal(calculation.totalDebtWon,"100000000");
 assert.equal(calculation.liquidationValueWon,"1000000");
 assert.equal(calculation.presentValueWon,"30000000");
 assert.equal(calculation.liquidationComparison,"met");
 assert.equal(calculation.allocations.length,1);
 assert.equal(calculation.allocations[0].totalWon,"36000000");
 const ledger=buildRepaymentPlanModel(d,calculation);
 const reconciliation=reconcilePlanLedger(d,calculation,ledger);
 const forms=buildFormBindings(d,calculation,undefined,ledger,reconciliation);
 assert.equal(forms.rows.month.length,12);
 assert.ok(forms.rows.month.every(row=>row.net_income==="1,500,000"));
 assert.equal(forms.scalars.monthly_business_income,"1,500,000");
 assert.equal(forms.scalars.approved_monthly_income,"1,500,000");
 assert.equal(forms.scalars.monthly_payment,"1,000,000");
 assert.equal(forms.scalars.total_repayment,"36,000,000");
 assert.equal(forms.scalars.total_principal,"100,000,000");
 assert.equal(forms.scalars.liquidation_value,"1,000,000");
 assert.equal(forms.rows.creditor.length,1);
 assert.equal(forms.rows.creditor[0].total_payment,"36,000,000");
 assert.equal(reconciliation.status,"reconciled",JSON.stringify(reconciliation.issues));
});
