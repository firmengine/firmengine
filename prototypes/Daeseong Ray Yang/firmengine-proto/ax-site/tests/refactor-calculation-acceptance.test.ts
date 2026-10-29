import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createCase,normalizeMoney,type CaseData } from "../lib/domain.ts";
import { CURRENT_RULESET } from "../lib/legal-rules.ts";
import { calculateCase,assessCase,allocateProRata } from "../lib/assessment.ts";
import { executeCaseNodes } from "../lib/case-execution.ts";
import { buildRepaymentPlanModel } from "../lib/repayment-plan-model.ts";
import { reconcilePlanLedger } from "../lib/plan-reconciliation.ts";
import { shortenedTermBasisFingerprint } from "../lib/legal-proposals.ts";
import { buildLegalProposals } from "../lib/legal-proposals.ts";
import { disposalApplicabilityBasisFingerprint,disposalApplicabilityBasisFactIds,evaluateDisposalApplicability } from "../lib/disposal-applicability.ts";
import { reduceCaseCommand } from "../lib/case-commands.ts";
import { createSourceVerificationReceipts,type PageRead,type Check,type ReviewPass } from "../lib/source-verification.ts";
import { installReferenceProvider,type ReferenceSnapshot } from "../lib/reference-runtime.ts";

const outcomes:{id:string;status:"passed"|"blocked"|"failed";expected:string;actual?:unknown;reason?:string;error?:string}[]=[];
function acceptance(id:string,expected:string,run:()=>unknown|Promise<unknown>,blockedReason?:string){
 test(`${id} · ${expected}`,async()=>{try{const actual=await run();outcomes.push({id,status:blockedReason?"blocked":"passed",expected,actual,...(blockedReason?{reason:blockedReason}:{})});}catch(error){outcomes.push({id,status:"failed",expected,error:String(error)});throw error;}});
}
function base(name:string,term:number|null=null):CaseData{
 const d=createCase(`synthetic unit ${name}`,`synthetic-unit-${name}`,"2026-10-27");
 d.context.ruleReleaseId=CURRENT_RULESET.id;d.context.ruleApplicationReviewed=true;
 d.context.inventoryComplete={income:"yes",debt:"yes",asset:"yes"};
 d.context.planMonths=term;
 d.incomes=[{id:"wage",kind:"wage",label:"synthetic wage",net:normalizeMoney("3000000"),amountBasis:"monthly",periodStart:"2026-09-01",periodEnd:"2026-09-30",recurring:"yes",recognition:"accepted",factIds:[]}];
 d.documents=[{id:"unit-source",name:"synthetic-unit.pdf",sha256:"a".repeat(64),status:"active",pages:[1]}];d.pages=[{documentId:"unit-source",page:1,role:"evidence",text:"synthetic unit values"}];
 const commonFact=(id:string,subjectId:string,key:string,value:string)=>{d.facts.push({id,logicalId:id,version:1,subjectId,key,value,rawValue:value,numeric:normalizeMoney(value),sourceUnit:"KRW",state:"extracted",recognition:"unreviewed",refs:[{documentId:"unit-source",page:1,quote:"synthetic unit values",sourceHash:"a".repeat(64)}],validation:[]});return id;};
 d.incomes[0]!.factIds=[commonFact("unit-income-net","wage","income.net","3000000")];
 d.household={recognizedLivingCost:normalizeMoney("2000000"),livingCostIncludesAdditional:true,recognition:"accepted",factIds:[commonFact("unit-household-cost","household","household.recognized_living_cost","2000000")]};
 d.context.filingPeriod={start:"2026-09-01",end:"2026-09-30"};d.context.incomePeriodReviewed=true;
 d.context.monthlyTrusteeFee=normalizeMoney("50000");d.context.monthlyPriorityPayment=normalizeMoney("150000");d.context.monthlyEstatePayment=normalizeMoney("0");
 return d;
}
function addDebt(d:CaseData,id:string,principal:string,classification:"ordinary"|"secured"|"tax"|"estate"="ordinary",priority:"ordinary"|"priority"|"estate"="ordinary"){
 const documentId=`doc-${id}`,quote=`synthetic source ${id} principal ${principal}`;
 d.documents.push({id:documentId,name:`${id}.pdf`,sha256:(id.charCodeAt(0).toString(16).padStart(2,"0")).repeat(32).slice(0,64),status:"active",pages:[1]});
 d.pages.push({documentId,page:1,role:"evidence",text:quote});
 const p=`${id}-principal`,i=`${id}-interest`,sha=d.documents.at(-1)!.sha256;
 d.facts.push({id:p,logicalId:p,version:1,subjectId:id,key:"debt.principal",value:principal,rawValue:principal,numeric:normalizeMoney(principal),sourceUnit:"KRW",state:"extracted",recognition:"unreviewed",refs:[{documentId,page:1,quote,sourceHash:sha}],validation:[]});
 d.facts.push({id:i,logicalId:i,version:1,subjectId:id,key:"debt.interest",value:"0",rawValue:"0",numeric:normalizeMoney("0"),sourceUnit:"KRW",state:"extracted",recognition:"unreviewed",refs:[{documentId,page:1,quote,sourceHash:sha}],validation:[]});
 d.debts.push({id,contractId:`contract-${id}`,creditor:`Synthetic ${id}`,principal:normalizeMoney(principal),interest:normalizeMoney("0"),secured:"no",classification,priority,asOf:d.context.asOf,factIds:[p,i]});
}
acceptance("AT-23","가용 1,000,000원과 일반채권 예산 800,000원을 분리한다",()=>{
 const d=base("at23",null);d.context.monthlyTrusteeFee=normalizeMoney("50000");d.context.monthlyPriorityPayment=normalizeMoney("150000");d.context.monthlyEstatePayment=normalizeMoney("0");
 const c=calculateCase(d,CURRENT_RULESET);assert.equal(c.disposableIncomeWon,"1000000");assert.equal(c.ordinaryRepaymentBudgetWon,"800000");assert.equal(c.monthlyIncomeWon,"3000000");
 return {disposableIncomeWon:c.disposableIncomeWon,ordinaryRepaymentBudgetWon:c.ordinaryRepaymentBudgetWon};
});
acceptance("AT-24","우선 지급액 unknown은 0이 아니라 미확정 예산으로 유지한다",()=>{
 const d=base("at24");d.context.monthlyPriorityPayment=null;const c=calculateCase(d,CURRENT_RULESET);
 assert.equal(c.ordinaryRepaymentBudgetWon,null);assert.ok(c.issues.includes("PLAN_COST_OR_PRIORITY_PAYMENT_MISSING"));assert.ok(c.traces.find(t=>t.id==="ordinary_budget")?.inputs.find(x=>x.label==="우선채권 월 변제")?.value===null);
 return {ordinaryRepaymentBudgetWon:c.ordinaryRepaymentBudgetWon,issues:c.issues.filter(x=>x.includes("PRIORITY")||x.includes("PLAN_COST"))};
});
acceptance("AT-25","absent or stale no-disposal declarations remain unknown; a current reviewed declaration marks WF-40 not-applicable without calculating disposal",()=>{
 const d=base("at25");addDisposalAssetBasis(d);const unknown=executeCaseNodes(d);const unknownRoute=unknown.plan.routes.find(i=>i.workflowId==="WF-40");assert.equal(unknown.disposalApplicability.status,"unknown");assert.equal(unknownRoute?.state,"needs_qualification");assert.ok(!("disposalResults" in unknown));
 const factIds=disposalApplicabilityBasisFactIds(d),basisFingerprint=disposalApplicabilityBasisFingerprint(d);
 d.context.disposalApplicabilityReview={disposition:"not_applicable",status:"candidate",reason:"Synthetic unit review: no asset disposal scenario applies.",basisFingerprint,factIds};
 const candidate=executeCaseNodes(d);assert.equal(candidate.disposalApplicability.status,"candidate");assert.equal(candidate.plan.routes.find(i=>i.workflowId==="WF-40")?.state,"needs_qualification");
 d.context.disposalApplicabilityReview={...d.context.disposalApplicabilityReview,status:"confirmed",reviewedBy:"synthetic-unit-reviewer",reviewedAt:"2026-10-27T12:00:00.000Z"};
 const confirmed=executeCaseNodes(d),route=confirmed.plan.routes.find(i=>i.workflowId==="WF-40");assert.equal(confirmed.disposalApplicability.status,"confirmed");assert.equal(route?.state,"not_applicable");assert.ok(route?.applicabilityReason?.includes("no asset disposal"));assert.ok(!("disposalResults" in confirmed));
 d.facts.find(f=>f.id===factIds[0])!.value="changed current asset fact";
 const stale=executeCaseNodes(d);assert.equal(stale.disposalApplicability.status,"stale");assert.equal(stale.plan.routes.find(i=>i.workflowId==="WF-40")?.state,"needs_qualification");
 return {unknown:{status:unknown.disposalApplicability.status,state:unknownRoute?.state},candidate:{status:candidate.disposalApplicability.status,state:candidate.plan.routes.find(i=>i.workflowId==="WF-40")?.state},confirmed:{status:confirmed.disposalApplicability.status,state:route?.state,reason:route?.applicabilityReason},stale:{status:stale.disposalApplicability.status,state:stale.plan.routes.find(i=>i.workflowId==="WF-40")?.state},disposalCalculationProduced:false};
});
acceptance("AT-26","사업순소득과 생계비의 같은 경비 후보는 중복 공제 검토를 만든다",()=>{
 const d=base("at26");d.context.planMonths=36;d.household.additionalLivingCost=normalizeMoney("50000");delete d.household.livingCostIncludesAdditional;
 const x=executeCaseNodes(d);assert.ok(x.calculationContract.warnings.includes("POSSIBLE_DUPLICATE_LIVING_COST_DEDUCTION_REVIEW"));assert.equal(x.assessment.calculation.recognizedLivingCostWon,null);assert.ok(x.assessment.generationGate.reasons.some(r=>r.includes("CALCULATION_CONTRACT_REVIEW:POSSIBLE_DUPLICATE_LIVING_COST_DEDUCTION_REVIEW")));
 return {warning:x.calculationContract.warnings.find(w=>w.includes("DUPLICATE")),recognizedLivingCostWon:x.assessment.calculation.recognizedLivingCostWon};
});
acceptance("AT-27","처음 12회 800,000원과 이후 24회 950,000원의 총액은 32,400,000원이다",()=>{
 const d=base("at27",36);d.context.monthlyTrusteeFee=normalizeMoney("0");d.context.monthlyPriorityPayment=normalizeMoney("0");d.context.monthlyEstatePayment=normalizeMoney("0");d.context.approvedMonthlyPayment=normalizeMoney("900000");d.context.allocationBasis="principal_then_interest_pro_rata";d.context.allocationBasisReviewed=false;
 addDebt(d,"a","40000000");
 const payments=Array.from({length:36},(_,i)=>({month:i+1,amount:i<12?"800000":"950000"}));
 d.context.paymentSchedule={reviewed:true,reviewReason:"synthetic phase totals",expectedInstallments:36,phases:[{id:"phase-1",firstInstallment:1,lastInstallment:12,monthlyAvailableWon:"800000",allocations:[{creditorId:"a",principalWon:"800000",interestWon:"0"}]},{id:"phase-2",firstInstallment:13,lastInstallment:36,monthlyAvailableWon:"950000",allocations:[{creditorId:"a",principalWon:"950000",interestWon:"0"}]}]};
 const c=calculateCase(d,CURRENT_RULESET),ledger=buildRepaymentPlanModel(d,c),r=reconcilePlanLedger(d,c,ledger);
 const sum=ledger.rows.filter(x=>x.claimClass==="ordinary").reduce((n,row)=>n+BigInt(row.principalWon)+BigInt(row.interestWon),0n);
 assert.equal(sum,32400000n);assert.equal(ledger.rows.filter(x=>x.claimClass==="ordinary").length,36);assert.equal(r.totals.ordinaryWon,"32400000");assert.equal(r.status,"reconciled");
 return {months:payments.length,ordinaryTotalWon:sum.toString(),reconciliation:r.status};
});
function priorityFixture(term:number,monthly:string){
 const d=base(`priority-${term}-${monthly}`,term);d.context.monthlyTrusteeFee=normalizeMoney("0");d.context.monthlyPriorityPayment=normalizeMoney(monthly);d.context.monthlyEstatePayment=normalizeMoney("0");d.context.approvedMonthlyPayment=normalizeMoney("0");addDebt(d,"P1","1800000","tax","priority");
 d.context.paymentSchedule={reviewed:true,reviewReason:"synthetic priority coverage unit fixture",expectedInstallments:term,phases:Array.from({length:term},(_,i)=>({id:`p-${i+1}`,firstInstallment:i+1,lastInstallment:i+1,monthlyAvailableWon:monthly,allocations:[{creditorId:"P1",principalWon:monthly,interestWon:"0"}]}))};
 const c=calculateCase(d,CURRENT_RULESET),calc={...c,planTotalWon:"0",monthlyPaymentWon:monthly,ordinaryRepaymentBudgetWon:"0"};return {d,calc,ledger:buildRepaymentPlanModel(d,calc)};
}
acceptance("AT-28","FULL-BY-12 with zero installments reports 1,800,000 uncovered, deadline 12 and blocked",()=>{
 const {d,calc,ledger}=priorityFixture(12,"0"),r=reconcilePlanLedger(d,calc,ledger,{priorityPolicies:{P1:{deadlineInstallment:12,applicability:"confirmed"}}});
 assert.equal(r.priorityCoverage.P1?.uncoveredWon,"1800000");assert.equal(r.priorityCoverage.P1?.deadlineInstallment,12);assert.equal(r.priorityCoverage.P1?.status,"blocked");
 return r.priorityCoverage.P1;
});
acceptance("AT-29","FULL-BY-12 monthly 125,000 reports 1,500,000 scheduled and 300,000 uncovered; unknown applicability adds legal review",()=>{
 const {d,calc,ledger}=priorityFixture(12,"125000");const known=reconcilePlanLedger(d,calc,ledger,{priorityPolicies:{P1:{deadlineInstallment:12,applicability:"confirmed"}}});
 assert.deepEqual(known.priorityCoverage.P1,{scheduledWon:"1500000",uncoveredWon:"300000",deadlineInstallment:12,status:"blocked"});
 const unknown=reconcilePlanLedger(d,calc,ledger,{priorityPolicies:{P1:{deadlineInstallment:12,applicability:"unknown"}}});assert.equal(unknown.priorityCoverage.P1?.status,"unknown");assert.ok(unknown.legalReviewTasks?.includes("PRIORITY_COVERAGE_POLICY_REVIEW:P1"));
 return {confirmed:known.priorityCoverage.P1,unknown:unknown.priorityCoverage.P1,legalReviewTasks:unknown.legalReviewTasks};
});
acceptance("AT-30","800,000 actual monthly ordinary budget blocks a 1,000,000 manual phase without another funding source",()=>{
 const d=base("at30",1);d.household.recognizedLivingCost=normalizeMoney("2150000");const hh=d.facts.find(f=>f.id==="unit-household-cost")!;hh.value="2150000";hh.rawValue="2150000";hh.numeric=normalizeMoney("2150000");d.context.monthlyTrusteeFee=normalizeMoney("50000");d.context.monthlyPriorityPayment=normalizeMoney("0");d.context.monthlyEstatePayment=normalizeMoney("0");d.context.approvedMonthlyPayment=normalizeMoney("800000");addDebt(d,"a","1000000");d.context.paymentSchedule={reviewed:true,reviewReason:"synthetic over-budget test",expectedInstallments:1,phases:[{id:"too-high",firstInstallment:1,lastInstallment:1,monthlyAvailableWon:"1000000",allocations:[{creditorId:"a",principalWon:"1000000",interestWon:"0"}]}]};
 const c=calculateCase(d,CURRENT_RULESET),ledger=buildRepaymentPlanModel(d,c),r=reconcilePlanLedger(d,c,ledger);assert.equal(c.ordinaryRepaymentBudgetWon,"800000");assert.ok(r.issues.includes("CATEGORY_BUDGET_EXCEEDED:1:ordinary"));assert.equal(r.status,"blocked");
 return {actualBudgetWon:c.ordinaryRepaymentBudgetWon,scheduledWon:"1000000",issues:r.issues};
});
acceptance("AT-31","a debt paid off at installment 1 is not overpaid at installment 2 and remaining budget is explicit",()=>{
 const d=base("at31",2);d.context.monthlyTrusteeFee=normalizeMoney("0");d.context.monthlyPriorityPayment=normalizeMoney("0");d.context.monthlyEstatePayment=normalizeMoney("0");d.context.approvedMonthlyPayment=normalizeMoney("100");addDebt(d,"a","100");
 d.context.paymentSchedule={reviewed:true,reviewReason:"synthetic payoff sequence",expectedInstallments:2,phases:[{id:"m1",firstInstallment:1,lastInstallment:1,monthlyAvailableWon:"200",allocations:[{creditorId:"a",principalWon:"100",interestWon:"0"}]},{id:"m2",firstInstallment:2,lastInstallment:2,monthlyAvailableWon:"200",allocations:[{creditorId:"a",principalWon:"0",interestWon:"0"}]}]};
 const c=calculateCase(d,CURRENT_RULESET),ledger=buildRepaymentPlanModel(d,c),r=reconcilePlanLedger(d,c,ledger);assert.equal(ledger.rows.find(x=>x.installment===2&&x.debtId==="a")?.balanceAfter,"0");assert.ok(!r.issues.some(x=>x.startsWith("PAYMENT_EXCEEDS_CLAIM")));assert.equal(r.unallocatedBudgets["2:schedule_total"],"200");
 return {installment2Balance:"0",unallocatedScheduleBudgetWon:r.unallocatedBudgets["2:schedule_total"],issues:r.issues};
});
acceptance("AT-32","allocateProRata is ID-stable under c,a,b input order: a=34, b=33, c=33",()=>{
 const expected=[{id:"a",amountWon:"34"},{id:"b",amountWon:"33"},{id:"c",amountWon:"33"}];
 for(const input of [["a","b","c"],["c","a","b"],["b","c","a"]]){const result=allocateProRata("100",input.map(id=>({id,amountWon:"100"}))).sort((a,b)=>a.id.localeCompare(b.id));assert.deepEqual(result,expected);assert.equal(result.reduce((n,x)=>n+BigInt(x.amountWon),0n),100n);}
 return expected;
});
acceptance("AT-33","phase gap, overlap and non-contiguous dates each produce an explicit schedule blocker",()=>{
 const make=(phases:any[])=>{const d=base("at33",2);d.context.monthlyTrusteeFee=normalizeMoney("0");d.context.monthlyPriorityPayment=normalizeMoney("0");d.context.monthlyEstatePayment=normalizeMoney("0");d.context.approvedMonthlyPayment=normalizeMoney("0");addDebt(d,"a","1000");d.context.paymentSchedule={reviewed:true,reviewReason:"synthetic schedule topology",expectedInstallments:2,phases};const c=calculateCase(d,CURRENT_RULESET);return buildRepaymentPlanModel(d,c).issues;};
 const phase=(id:string,first:number,last:number,date:string)=>({id,firstInstallment:first,lastInstallment:last,firstPaymentDate:date,monthlyAvailableWon:"100",allocations:[{creditorId:"a",principalWon:"0",interestWon:"0"}]});
 const gap=make([phase("x",1,1,"2026-01-15"),phase("y",3,3,"2026-02-15")]);assert.ok(gap.includes("MISSING_OR_DUPLICATE_MONTH"));
 const overlap=make([phase("x",1,2,"2026-01-15"),phase("y",2,2,"2026-02-15")]);assert.ok(overlap.includes("MISSING_OR_DUPLICATE_MONTH"));
 const date=make([phase("x",1,1,"2026-01-15"),phase("y",2,2,"2026-03-15")]);assert.ok(date.includes("PHASE_PAYMENT_DATES_NOT_CONTIGUOUS"));
 return {gap,overlap,date};
});
acceptance("AT-34","plan_term passes at 35/36, requires review at 37/59/60, fails at 61; Seoul shortened-term remains separate",()=>{
 const outcomes=([35,36,37,59,60,61] as const).map(months=>{const d=base(`term-${months}`,months);const a=assessCase(d,CURRENT_RULESET);return {months,outcome:a.findings.find(x=>x.id==="plan_term")?.outcome,shortened:a.findings.find(x=>x.id==="seoul_424_shortened_term")?.outcome??null};});
 assert.deepEqual(outcomes.map(x=>x.outcome),["pass","pass","review_required","review_required","review_required","fail"]);assert.notEqual(outcomes[0]?.shortened,"pass");return outcomes;
});
acceptance("AT-35","nominal total does not substitute for missing present-value basis; finalization remains blocked",()=>{
 const d=base("at35",36);d.context.approvedMonthlyPayment=normalizeMoney("100000");d.context.approvedPresentValue=null;d.context.presentValueBasis=undefined;d.context.presentValueReviewed=false;
 const a=assessCase(d,CURRENT_RULESET);assert.equal(a.calculation.presentValueWon,null);assert.equal(a.calculation.liquidationComparison,"unknown");assert.equal(a.generationGate.canFinalize,false);assert.ok(a.generationGate.reasons.some(r=>r.includes("PRESENT_VALUE")||r.includes("현재가치")));
 return {planTotalWon:a.calculation.planTotalWon,presentValueWon:a.calculation.presentValueWon,liquidationComparison:a.calculation.liquidationComparison,canFinalize:a.generationGate.canFinalize};
});
function singleParentFact(d:CaseData,value:"yes"|"no"){
 const quote=`synthetic unit source statutory single parent ${value}`,documentId="statutory-proof",hash="d".repeat(64),bbox:[number,number,number,number]=[.1,.2,.4,.25];
 d.documents=[{id:documentId,name:"synthetic-unit-proof.pdf",sha256:hash,status:"active",pages:[1]}];d.pages=[{documentId,page:1,role:"evidence",text:quote}];
 const field={key:"legal.seoul424.statutory_single_parent",value,unit:null,quote,confidence:"clear" as const,bbox};
 const read:PageRead={documentType:"synthetic_unit",complete:true,records:[{category:"application",fields:[field]}]};
 const check:Check={recordIndex:0,fieldIndex:0,categoryStatus:"supported",meaningStatus:"supported",status:"agrees",value,unit:null,quote,bbox};
 const pass:ReviewPass={kind:"verify",checks:[check],model:"gpt-6-luna",promptVersion:"synthetic-unit-test",promptHash:"e".repeat(64),verifiedAt:"2026-10-27T00:00:00.000Z"};
 const [proof]=createSourceVerificationReceipts({documentId,page:1,sourceHash:hash,promptVersion:pass.promptVersion,verifiedAt:pass.verifiedAt,originalRead:read,read,passes:[pass]});
 if(!proof)throw new Error("synthetic unit proof creation failed");
 const id="single-parent-fact";d.facts.push({id,logicalId:id,version:1,subjectId:"applicant",key:field.key,value,rawValue:value,state:"verified",recognition:"accepted",refs:[{documentId,page:1,quote,sourceHash:hash,bbox}],validation:[],sourceVerification:{...proof,factBinding:{id,logicalId:id,version:1}}});return id;
}
function addDisposalAssetBasis(d:CaseData){
 const id="unit-asset",factId="unit-asset-fact";d.assets.push({id,kind:"deposit",label:"Synthetic unit asset",grossValue:normalizeMoney("1000000"),securedPayoff:normalizeMoney("0"),disposalCosts:normalizeMoney("0"),protectedValue:normalizeMoney("0"),ownershipBps:10000,asOf:d.context.asOf,valuationBasis:"synthetic unit value",recognition:"unreviewed",factIds:[factId]});
 d.facts.push({id:factId,logicalId:factId,version:1,subjectId:id,key:"asset.gross_value",value:"1000000",rawValue:"1000000",numeric:normalizeMoney("1000000"),sourceUnit:"KRW",state:"extracted",recognition:"unreviewed",refs:[{documentId:"unit-source",page:1,quote:"synthetic unit values",sourceHash:"a".repeat(64)}],validation:[]});
}

test("no-disposal review confirmation requires a human role and is prohibited for synthetic cases",async()=>{
 const data=base("nondisposal-review");addDisposalAssetBasis(data);data.structuredTest={mode:"assumed_extracted_synthetic",scenarioId:data.context.id,sourceRecords:[{id:"record",recordType:"unit",recordId:data.context.id,data:{}}]};data.evaluationClone={sourceCaseId:"synthetic-approved-source",sourceInputSha256:"b".repeat(64),createdAt:"2026-10-27T00:00:00.000Z",finalSubmissionProhibited:true};const factIds=disposalApplicabilityBasisFactIds(data),review={disposition:"not_applicable" as const,status:"candidate" as const,reason:"Synthetic unit no-disposal basis",basisFingerprint:disposalApplicabilityBasisFingerprint(data),factIds};data.context.disposalApplicabilityReview=review;
 const command={commandId:"no-disposal-review-01",commandType:"context.update" as const,payloadVersion:1 as const,expectedRevision:data.context.revision,expectedStateFingerprint:"case-state/1:"+"a".repeat(64),target:{},patch:{context:{disposalApplicabilityReview:{...review,status:"confirmed"}}},reason:"Confirm current no-disposal scope"};
 await assert.rejects(()=>reduceCaseCommand(data,command,{actor:"unit-editor",roles:["case_editor"],at:"2026-10-27T12:00:00.000Z"}),(error:unknown)=>!!error&&typeof error==="object"&&"code" in error&&(error as {code:string}).code==="HUMAN_ROLE_REQUIRED");
 await assert.rejects(()=>reduceCaseCommand(data,command,{actor:"unit-reviewer",roles:["case_editor","caseworker_review"],at:"2026-10-27T12:00:00.000Z"}),(error:unknown)=>!!error&&typeof error==="object"&&"code" in error&&(error as {code:string}).code==="SYNTHETIC_REVIEW_PROHIBITED");
 const ordinary=base("nondisposal-human-adoption");addDisposalAssetBasis(ordinary);const ordinaryFactIds=disposalApplicabilityBasisFactIds(ordinary),ordinaryReview={disposition:"not_applicable" as const,status:"candidate" as const,reason:"Unit no-disposal basis",basisFingerprint:disposalApplicabilityBasisFingerprint(ordinary),factIds:ordinaryFactIds};ordinary.context.disposalApplicabilityReview=ordinaryReview;
 const humanCommand={...command,commandId:"no-disposal-review-02",expectedRevision:ordinary.context.revision,patch:{context:{disposalApplicabilityReview:{...ordinaryReview,status:"confirmed"}}}};const adopted=await reduceCaseCommand(ordinary,humanCommand,{actor:"unit-caseworker",roles:["case_editor","caseworker_review"],at:"2026-10-27T12:00:00.000Z"});assert.equal(adopted.data.context.disposalApplicabilityReview?.status,"confirmed");assert.equal(adopted.data.context.disposalApplicabilityReview?.reviewedBy,"unit-caseworker");assert.equal(evaluateDisposalApplicability(adopted.data).status,"confirmed");
});

test("no-disposal confirmation becomes stale when cited document, page role, or active reference changes",()=>{
 const data=base("nondisposal-basis-invalidation");addDisposalAssetBasis(data);
 const fact=data.facts.find(item=>item.id==="unit-asset-fact")!;fact.structuredRefs=[{sourceRecordId:"asset-record",jsonPointer:"/assets/0"}];
 const snapshot=(id:string,revision:number,sha256:string):ReferenceSnapshot=>({id,revision,sha256,values:{},bundleReview:undefined});
 installReferenceProvider(()=>snapshot("active-release",1,"c".repeat(64)));
 try{
  const factIds=disposalApplicabilityBasisFactIds(data),review={disposition:"not_applicable" as const,status:"confirmed" as const,reason:"Reviewed inventory and current asset evidence",basisFingerprint:disposalApplicabilityBasisFingerprint(data),factIds,reviewedBy:"unit-reviewer",reviewedAt:"2026-10-27T12:00:00.000Z"};
  data.context.disposalApplicabilityReview=review;assert.equal(evaluateDisposalApplicability(data).status,"confirmed");
  const unchanged=structuredClone(data);unchanged.documents.find(item=>item.id==="unit-source")!.sha256="f".repeat(64);assert.equal(evaluateDisposalApplicability(unchanged).status,"stale","current source hash changes must invalidate review");
  const changedRole=structuredClone(data);changedRole.pages.find(page=>page.documentId==="unit-source")!.role="administrative";assert.equal(evaluateDisposalApplicability(changedRole).status,"stale","page role changes must invalidate review");
  const changedReference=structuredClone(data);installReferenceProvider(()=>snapshot("active-release",2,"d".repeat(64)));assert.equal(evaluateDisposalApplicability(changedReference).status,"stale","active reference snapshot changes must invalidate review");
  const changedStructuredRef=structuredClone(data);changedStructuredRef.facts.find(item=>item.id==="unit-asset-fact")!.structuredRefs=[{sourceRecordId:"asset-record",jsonPointer:"/assets/1"}];assert.equal(evaluateDisposalApplicability(changedStructuredRef).status,"stale","structured source scope changes must invalidate review");
 }finally{installReferenceProvider(()=>undefined);}
});
acceptance("AT-75","Seoul 35-month unit candidate is distinct from plan_term and requires a matching current shortenedTermReview",()=>{
 const d=base("at75",35);d.context.courtId="seoul";d.context.applicant={name:"synthetic unit applicant"};const id=singleParentFact(d,"yes");
 const candidate=assessCase(d,CURRENT_RULESET),candidateProposal=buildLegalProposals(d);assert.equal(candidate.findings.find(x=>x.id==="plan_term")?.outcome,"pass");assert.equal(candidate.findings.find(x=>x.id==="seoul_424_shortened_term")?.outcome,"review_required");assert.equal(candidateProposal.termCandidate.status,"candidate_for_human_review");
 const basisFingerprint=shortenedTermBasisFingerprint(d);d.context.shortenedTermReview={months:35,ruleReleaseId:CURRENT_RULESET.id,reason:"synthetic unit evidence review only",basisFingerprint};
 const reviewed=assessCase(d,CURRENT_RULESET);assert.equal(reviewed.findings.find(x=>x.id==="seoul_424_shortened_term")?.outcome,"pass");assert.equal(reviewed.findings.find(x=>x.id==="plan_term")?.outcome,"pass");assert.ok(!reviewed.generationGate.canFinalize,"other final requirements remain independently gated");
 return {factId:id,candidate:candidateProposal.termCandidate.status,unreviewed:candidate.findings.find(x=>x.id==="seoul_424_shortened_term")?.outcome,reviewed:reviewed.findings.find(x=>x.id==="seoul_424_shortened_term")?.outcome,canFinalize:reviewed.generationGate.canFinalize};
});
acceptance("AT-76","changing the shortened-term candidate fact invalidates the old review fingerprint while plan_term remains pass",()=>{
 const d=base("at76",35);d.context.courtId="seoul";d.context.applicant={name:"synthetic unit applicant"};const id=singleParentFact(d,"yes");d.context.shortenedTermReview={months:35,ruleReleaseId:CURRENT_RULESET.id,reason:"synthetic unit evidence review only",basisFingerprint:shortenedTermBasisFingerprint(d)};
 const before=assessCase(d,CURRENT_RULESET);assert.equal(before.findings.find(x=>x.id==="seoul_424_shortened_term")?.outcome,"pass");
 const fact=d.facts.find(x=>x.id===id)!;fact.value="no";fact.rawValue="no";const after=assessCase(d,CURRENT_RULESET);
 assert.notEqual(shortenedTermBasisFingerprint(d),d.context.shortenedTermReview!.basisFingerprint);assert.notEqual(after.findings.find(x=>x.id==="seoul_424_shortened_term")?.outcome,"pass");assert.equal(after.findings.find(x=>x.id==="plan_term")?.outcome,"pass");assert.equal(after.generationGate.canFinalize,false);
 return {shortenedOutcome:after.findings.find(x=>x.id==="seoul_424_shortened_term")?.outcome,planTerm:after.findings.find(x=>x.id==="plan_term")?.outcome,canFinalize:after.generationGate.canFinalize};
});

const resultPath=process.env.FIRMENGINE_AT_RESULTS_PATH;
if(resultPath){test("acceptance matrix result trace is written outside the source tree",()=>{fs.mkdirSync(path.dirname(resultPath),{recursive:true});fs.writeFileSync(resultPath,JSON.stringify({schemaVersion:"refactor-calculation-acceptance/v1",source:"FirmEngine_AX_Refactoring_Backlog(2).json",acceptanceScenarios:outcomes},null,2)+"\n");assert.equal(outcomes.length,15);assert.ok(outcomes.every(x=>x.status!=="failed"));});}
