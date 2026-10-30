import test from "node:test";
import assert from "node:assert/strict";
import {createCase,normalizeMoney,type Fact} from "../lib/domain.ts";
import {calculateCase} from "../lib/assessment.ts";
import {auditMaterialCalculatorSources,MATERIAL_CALCULATION_SOURCES} from "../lib/material-calculation-source-gate.ts";
const rules={id:"test-reviewed",status:"source_verified" as const,sources:[]};
function setup(id:string,value:string){
 const data=createCase("synthetic material source","source-case","2026-10-30");
 const docId="doc-source",quote="source value "+value,hash="a".repeat(64);
 data.documents=[{id:docId,name:"fixture.pdf",sha256:hash,status:"active",pages:[1]}];
 data.pages=[{documentId:docId,page:1,role:"evidence",text:quote}];
 const fact={id:"fact-1",logicalId:"fact-1",version:1,subjectId:"source-row",key:"asset.balance",value,rawValue:value,sourceUnit:"KRW",
   canonicalFieldId:id,fieldObservation:{sourceState:"present"} as Fact["fieldObservation"],numeric:normalizeMoney(value),
   state:"verified" as const,recognition:"accepted" as const,refs:[{documentId:docId,page:1,quote,sourceHash:hash}],validation:[]};
 data.facts=[fact];return data;
}
test("all 29 material source IDs are unique and source-contract enumerated",()=>{
 assert.equal(MATERIAL_CALCULATION_SOURCES.length,29);
 assert.equal(new Set(MATERIAL_CALCULATION_SOURCES.map(x=>x.id)).size,29);
});
test("a saved bank balance with no typed applicant asset cannot silently become zero assets",()=>{
 const data=setup("bank_account_balance::balance","1000000");
 const audit=auditMaterialCalculatorSources(data);
 assert.equal(audit.issueCount,1);
 assert.equal(audit.issues[0].code,"CALC_INPUT_UNCONNECTED_MATERIAL");
 const result=calculateCase(data,rules);
 assert.ok(result.issues.some(issue=>issue.includes("CALC_INPUT_UNCONNECTED_MATERIAL:bank_account_balance::balance")));
 assert.equal(result.liquidationValueWon,null,"Unrepresented account balance cannot become zero liquidation value");
 assert.equal(result.liquidationComparison,"unknown");
});
test("source-backed typed asset with exactly equal normalized numeric input resolves the gap",()=>{
 const data=setup("bank_account_balance::balance","1000000");
 data.assets=[{id:"asset-1",kind:"deposit",label:"account ownership reviewed separately",
   grossValue:normalizeMoney("1000000"),factIds:["fact-1"],recognition:"unreviewed"}];
 assert.equal(auditMaterialCalculatorSources(data).issueCount,0);
 data.assets[0].grossValue=normalizeMoney("999999");
 assert.equal(auditMaterialCalculatorSources(data).issues[0].code,"CALC_INPUT_AMOUNT_MISMATCH");
});
test("missing source money or third-party legal context never gets summed as a guessed principal",()=>{
 const invalid=setup("tax_public_arrear::principal_arrear","90000");
 invalid.facts[0].numeric=normalizeMoney("bad");
 assert.equal(auditMaterialCalculatorSources(invalid).issues[0].code,"CALC_INPUT_AMOUNT_INVALID");
 const legal=setup("guarantee_joint_claim::guarantee_claimed","5000000");
 const report=auditMaterialCalculatorSources(legal);
 assert.equal(report.issueCount,0);
 assert.deepEqual(report.contextOnlyIds,["guarantee_joint_claim::guarantee_claimed"]);
});

test("unconnected source income does not appear as zero in a completed income inventory",()=>{
 const data=setup("current_nonwage_income::income.other.net_received","2200000");
 data.context.inventoryComplete.income="yes";
 const c=calculateCase(data,rules);
 assert.ok(c.issues.some(issue=>issue.startsWith("CALC_INPUT_UNCONNECTED_MATERIAL:current_nonwage_income::income.other.net_received")));
 assert.equal(c.monthlyIncomeWon,null);
 assert.equal(c.disposableIncomeWon,null);
 assert.equal(c.ordinaryRepaymentBudgetWon,null);
 assert.equal(c.monthlyPaymentWon,null);
});
test("unconnected current principal must block debt totals and both debt caps",()=>{
 const data=setup("debt_certificate::principal_balance","900000");
 data.context.inventoryComplete.debt="yes";
 const c=calculateCase(data,rules);
 assert.ok(c.issues.some(issue=>issue.startsWith("CALC_INPUT_UNCONNECTED_MATERIAL:debt_certificate::principal_balance")));
 assert.equal(c.debtPrincipalWon,null);
 assert.equal(c.debtInterestWon,null);
 assert.equal(c.totalDebtWon,null);
 assert.equal(c.securedDebtWon,null);
 assert.equal(c.unsecuredDebtWon,null);
});
test("bank balance not included in a reported complete asset inventory blocks liquidation comparison",()=>{
 const data=setup("bank_account_balance::balance","1000000");
 data.context.inventoryComplete.asset="yes";
 data.context.approvedPresentValue=normalizeMoney("2000000");
 data.context.presentValueBasis="Reviewer-provided present-value basis";
 data.context.presentValueReviewed=true;
 data.context.assetValuationBasisReviewed=true;
 const c=calculateCase(data,rules);
 assert.equal(c.liquidationValueWon,null);
 assert.equal(c.liquidationComparison,"unknown");
 assert.equal(c.traces.find(x=>x.id==="liquidation_comparison")?.status,"blocked");
});
test("context-only third-party observations must not become typed balances or zero blockers",()=>{
 const data=setup("guarantee_joint_claim::guarantee_claimed","5000000");
 data.context.inventoryComplete.income="yes";
 data.context.inventoryComplete.debt="yes";
 data.context.inventoryComplete.asset="yes";
 const c=calculateCase(data,rules);
 assert.ok(!c.issues.some(issue=>issue.includes("CALC_INPUT_UNCONNECTED_MATERIAL")));
 assert.equal(c.monthlyIncomeWon,"0");
 assert.equal(c.totalDebtWon,"0");
 assert.equal(c.liquidationValueWon,"0");
});
