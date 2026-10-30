import test from "node:test";
import assert from "node:assert/strict";
import {bindCanonicalSourceField,canonicalProjectionKey} from "../lib/canonical-field-binding.ts";
import {documentFieldContract} from "../lib/document-agent-registry.ts";
import {buildOcrChainMatrix} from "../lib/ocr-chain-matrix.ts";
import {INTAKE_CATALOG_SEED} from "../lib/intake-catalog.ts";
import {projectPage,type PageRead} from "../lib/extraction.ts";

const source=(key:string,id:string,value:string,unit:string|null="KRW")=>({
 key,canonicalFieldId:id,label:key,value,unit,quote:key+" "+value,bbox:[0.1,0.1,0.5,0.2],
 confidence:"clear" as const,sourceState:"present" as const
});
test("all 85 OCR documents have physical DB field identities and source contracts",()=>{
 const matrix=buildOcrChainMatrix(INTAKE_CATALOG_SEED,"a".repeat(64),{limit:85});
 assert.equal(matrix.totalDocuments,85);
 assert.equal(matrix.documents.length,85);
 assert.ok(matrix.documents.every(d=>d.routes.length&&d.routes.every(r=>r.fields.length)));
 const count=matrix.documents.reduce((sum,d)=>sum+d.routes.reduce((n,r)=>n+r.fields.length,0),0);
 assert.ok(count>=1808,"Expected legacy 1789 OCR field slots and 19 supplemental fields; found "+count);
});
test("exact ID and key mismatch never binds a field to a different amount",()=>{
 const c=documentFieldContract("shared-document:bank_statement@bank_transactions");
 const bound=bindCanonicalSourceField({key:"counterparty",canonicalFieldId:"bank_transactions::amount"},c);
 assert.equal(bound.canonicalFieldId,null);
 assert.equal(canonicalProjectionKey(c,bound,"transaction"),null);
});
test("multiple month rows remain distinct and feed the same income calculation schema",()=>{
 const read:PageRead={documentType:"shared-document:salary_statement@payroll_payslip",complete:true,warnings:[],records:[
 {category:"income",label:"September",fields:[
 source("income.payroll.net_pay","payroll_payslip::income.payroll.net_pay","1800000"),
 source("gross_total","salary_statement::gross_total","2000000"),
 source("income.payroll.pay_period_start","payroll_payslip::income.payroll.pay_period_start","2026-09-01",null),
 source("income.payroll.pay_period_end","payroll_payslip::income.payroll.pay_period_end","2026-09-30",null)]},
 {category:"income",label:"October",fields:[
 source("income.payroll.net_pay","payroll_payslip::income.payroll.net_pay","1750000"),
 source("income.payroll.pay_period_start","payroll_payslip::income.payroll.pay_period_start","2026-10-01",null),
 source("income.payroll.pay_period_end","payroll_payslip::income.payroll.pay_period_end","2026-10-31",null)]}
 ]};
 const result=projectPage(read,"doc",1,"a".repeat(64));
 assert.equal(result.incomes.length,2);
 assert.deepEqual(result.incomes.map(v=>v.net?.amountWon),["1800000","1750000"]);
 assert.equal(result.incomes[0].gross?.amountWon,"2000000");
 assert.deepEqual(result.incomes.map(v=>v.periodStart),["2026-09-01","2026-10-01"]);
 assert.ok(result.facts?.some(x=>x.key==="income.net"));
 assert.ok(result.facts?.some(x=>x.key==="income.gross"));
});
test("current debt principal and interest feed separate legal calculation amounts",()=>{
 const read:PageRead={documentType:"shared-document:debt_certificate@debt_certificate",complete:true,warnings:[],records:[{
  category:"debt",label:"Claim",fields:[
  source("creditor","debt_certificate::creditor","은행",null),
  {...source("principal_balance","debt_certificate::principal_balance","15000000"),quote:"현재 원금 잔액 15000000원"},
  source("interest_balance","debt_certificate::interest_balance","320000"),
  source("as_of_date","debt_certificate::as_of_date","2026-10-25",null),
  source("claim_cause","debt_certificate::claim_cause","대출계약",null)]
 }]};
 const result=projectPage(read,"doc",1,"a".repeat(64));
 assert.equal(result.debts[0]?.principal?.amountWon,"15000000");
 assert.equal(result.debts[0]?.interest?.amountWon,"320000");
 assert.ok(result.facts?.some(x=>x.key==="debt.cause"));
 assert.ok(result.facts?.some(x=>x.key==="debt.interest"));
 assert.ok(result.facts?.some(x=>x.key==="debt.principal_balance"));
});
test("unknown typed amount ID remains only a raw observation",()=>{
 const read:PageRead={documentType:"shared-document:bank_statement@bank_transactions",complete:true,warnings:[],records:[{
  category:"transaction",label:"Wire",fields:[
  source("account_id","bank_transactions::account_id","acc",null),
  source("amount","debt_certificate::principal_balance","999999999")]
 }]};
 const result=projectPage(read,"doc",1,"a".repeat(64));
 assert.equal(result.transactions.length,0);
 assert.ok(result.facts?.some(x=>String(x.key).includes("unbound_source")));
});

test("salary total deductions are an exact, review-only income expense and form candidate",()=>{
 const c=documentFieldContract("shared-document:salary_statement@payroll_payslip")!;
 const id="salary_statement::total_deductions";
 const item=c.fields.find(f=>f.global_field_id===id)!;
 const bound=bindCanonicalSourceField({key:"total_deductions",canonicalFieldId:id},c);
 assert.equal(canonicalProjectionKey(c,bound,"income"),"expenses");
 const result=buildOcrChainMatrix(INTAKE_CATALOG_SEED,"a".repeat(64),{documentTypeId:"salary_statement"});
 assert.ok(result.documents.some(d=>d.routes.some(r=>r.fields.some(f=>f.canonicalFieldId===id&&f.formCandidates.includes("D5103.month.expense"))));
});
