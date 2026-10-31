import test from "node:test";
import assert from "node:assert/strict";
import { createCase, normalizeMoney, type Fact } from "../lib/domain.ts";
import { auditMaterialCalculatorSources } from "../lib/material-calculation-source-gate.ts";

const sourceId = "payroll_payslip::income.payroll.net_pay";
function fixture() {
 const data = createCase("Synthetic financial source","synthetic-a1-r29-cross-category","2026-10-31");
 const hash = "b".repeat(64);
 data.documents = [{id:"doc-synthetic",name:"synthetic-only.pdf",sha256:hash,status:"active",pages:[1]}];
 data.pages = [{documentId:"doc-synthetic",page:1,role:"evidence",text:"Synthetic salary amount 100"}];
 const fact: Fact = {id:"fact-payroll",logicalId:"fact-payroll",version:1,subjectId:"income-1",
   key:"income.net",value:"100",rawValue:"100",sourceUnit:"KRW",canonicalFieldId:sourceId,
   fieldObservation:{sourceState:"present"} as Fact["fieldObservation"],
   numeric:normalizeMoney("100"),state:"verified",recognition:"accepted",
   refs:[{documentId:"doc-synthetic",page:1,quote:"Synthetic salary amount 100",sourceHash:hash}],validation:[]};
 data.facts = [fact];
 data.incomes = [{id:"income-1",kind:"wage",label:"Synthetic wage",net:normalizeMoney("100"),
   amountBasis:"monthly",recurring:"yes",recognition:"accepted",factIds:[fact.id]}];
 return data;
}
test("one payroll observation referenced by one income is valid",()=>{
 const data=fixture();
 assert.deepEqual(auditMaterialCalculatorSources(data).issues,[]);
});
test("same payroll factId counted as a cash asset of the same amount must require review",()=>{
 const data=fixture();
 data.assets=[{id:"asset-1",kind:"deposit",label:"Synthetic cash",grossValue:normalizeMoney("100"),
   recognition:"unreviewed",factIds:["fact-payroll"]}];
 const issues=auditMaterialCalculatorSources(data).issues;
 assert.equal(issues.length,1);
 assert.equal(issues[0].code,"CALC_INPUT_MULTIPLE_TYPED_MATCHES");
});
test("same payroll factId counted as a debt principal of the same amount must require review",()=>{
 const data=fixture();
 data.debts=[{id:"debt-1",creditor:"Synthetic",principal:normalizeMoney("100"),interest:normalizeMoney("0"),
   secured:"no",classification:"ordinary",priority:"ordinary",asOf:data.context.asOf, factIds:["fact-payroll"]}];
 const issues=auditMaterialCalculatorSources(data).issues;
 assert.equal(issues.length,1);
 assert.equal(issues[0].code,"CALC_INPUT_MULTIPLE_TYPED_MATCHES");
});
test("same fact referenced for a different-valued documentary cross-check is not double-counted by this guard",()=>{
 const data=fixture();
 data.assets=[{id:"asset-1",kind:"deposit",label:"Synthetic cash",grossValue:normalizeMoney("250"),
   recognition:"unreviewed",factIds:["fact-payroll"]}];
 assert.deepEqual(auditMaterialCalculatorSources(data).issues,[]);
});
test("existing within-category double-use guard remains active",()=>{
 const data=fixture();
 data.incomes.push({...data.incomes[0],id:"income-2",factIds:["fact-payroll"]});
 assert.equal(auditMaterialCalculatorSources(data).issues[0]?.code,"CALC_INPUT_MULTIPLE_TYPED_MATCHES");
});
