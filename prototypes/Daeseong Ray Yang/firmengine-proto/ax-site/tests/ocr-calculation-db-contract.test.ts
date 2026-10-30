import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { INTAKE_CATALOG_SEED } from "../lib/intake-catalog.ts";
import { buildSharedDocumentCatalog,sharedDocumentFieldContract } from "../lib/shared-document-catalog.ts";
import { bindCanonicalSourceField, canonicalProjectionKey } from "../lib/canonical-field-binding.ts";
import { calculationSourceCellIssues } from "../lib/ocr-calculation-input.ts";
import { persistPageExtractionRows,listCaseExtractionRows } from "../lib/extraction-row-store.ts";
import { projectPage,type PageRead } from "../lib/extraction.ts";
import { monthlyIncome,calculateCase } from "../lib/assessment.ts";
import { createCase,normalizeMoney } from "../lib/domain.ts";

const SHA="a".repeat(64),IMAGE="b".repeat(64);
const cell=(key:string,id:string,value:string,unit:string|null="KRW",quote=key+" "+value)=>({
  key,canonicalFieldId:id,label:key,value,unit,quote,sourceState:"present" as const,
  confidence:"clear" as const,bbox:[0.1,0.1,0.6,0.2] as [number,number,number,number]
});
const date=(k:string,id:string,v:string)=>cell(k,id,v,null);
const rule={id:"synthetic",status:"source_verified" as const,sources:[]};

test("all 1,808 stored OCR schema slots have exact canonical IDs, compatible primitive types, and 693 unique IDs",()=>{
 const catalog=buildSharedDocumentCatalog(INTAKE_CATALOG_SEED,SHA),seen=new Set<string>();
 let count=0,typed=0;
 for(const d of catalog.documents)for(const family of d.allowedFamilyIds){
  const contract=sharedDocumentFieldContract(d.documentTypeId,family);
  assert.ok(contract);
  for(const definition of contract.fields){
   count++;seen.add(definition.global_field_id);
   const mapping=bindCanonicalSourceField({key:definition.local_id,canonicalFieldId:definition.global_field_id},contract);
   assert.equal(mapping.canonicalFieldId,definition.global_field_id);
   assert.equal(mapping.binding,"explicit_id");
   const numeric=definition.datatype.startsWith("money"),integer=definition.datatype==="integer",dated=definition.datatype==="date",timed=definition.datatype==="datetime";
   const value=numeric?"102030":integer?"12":dated?"2026-10-30":timed?"2026-10-30 15:20:00":"source value";
   const stored={value,unit:numeric?"KRW":null,quote:definition.local_id+" "+value,confidence:"clear" as const,sourceState:"present"};
   assert.deepEqual(calculationSourceCellIssues(stored,definition),[],definition.global_field_id);
   const candidates=["person","income","debt","asset","transaction","household","business","statement","other"]
     .flatMap(category=>canonicalProjectionKey(contract,mapping,category)?[category]:[]);
   assert.ok(candidates.length<=1,definition.global_field_id+" must not feed multiple typed entities");
   if(candidates.length)typed++;
  }
 }
 assert.equal(catalog.documents.length,85);
 assert.equal(count,1808);
 assert.equal(seen.size,693);
 assert.ok(typed>0);
});

test("the current OCR canonical ID may not impersonate a different entity's key",()=>{
 const contract=sharedDocumentFieldContract("salary_statement","payroll_payslip")!;
 const bound=bindCanonicalSourceField({key:"asset.net_pay",canonicalFieldId:"payroll_payslip::income.payroll.net_pay"},contract);
 assert.equal(bound.canonicalFieldId,null);
 assert.ok(bound.issues.includes("canonical_id_key_conflict"));
 assert.equal(canonicalProjectionKey(contract,bound,"income"),null);
});

test("stored source format prevents missing units, foreign currency, malformed dates and decimals becoming calculations",()=>{
 const present=(value:string,unit:string|null,datatype:string)=>calculationSourceCellIssues({value,unit,quote:value,sourceState:"present",confidence:"clear"},{datatype});
 assert.deepEqual(present("0","KRW","money"),[]);
 assert.ok(present("1500",null,"money").includes("SOURCE_MONETARY_UNIT_MISSING"));
 assert.ok(present("1500","USD","money").includes("SOURCE_MONEY_NOT_EXACT_KRW"));
 assert.ok(present("2026-02-30",null,"date").includes("SOURCE_DATE_INVALID"));
 assert.ok(present("2026-10-10 99:22",null,"datetime").includes("SOURCE_DATETIME_INVALID"));
 assert.ok(present("1.25",null,"integer").includes("SOURCE_INTEGER_FORMAT_REVIEW"));
 assert.deepEqual(calculationSourceCellIssues({value:null,unit:null,quote:null,sourceState:"explicit_none"}, {datatype:"money"}),[]);
});

test("the exact pay-period source record reaches the real monthly calculator without an invented basis",()=>{
 const read:PageRead={documentType:"shared-document:salary_statement@payroll_payslip",complete:true,warnings:[],records:[
  {category:"income",label:"2026-09",fields:[
   cell("income.payroll.net_pay","payroll_payslip::income.payroll.net_pay","1800000"),
   date("income.payroll.pay_period_start","payroll_payslip::income.payroll.pay_period_start","2026-09-01"),
   date("income.payroll.pay_period_end","payroll_payslip::income.payroll.pay_period_end","2026-09-30")
  ]},
  {category:"income",label:"2026-10",fields:[
   cell("income.payroll.net_pay","payroll_payslip::income.payroll.net_pay","1750000"),
   date("income.payroll.pay_period_start","payroll_payslip::income.payroll.pay_period_start","2026-10-01"),
   date("income.payroll.pay_period_end","payroll_payslip::income.payroll.pay_period_end","2026-10-31")
  ]}
 ]};
 const out=projectPage(read,"salary-file",1,SHA);
 assert.equal(out.incomes.length,2);
 assert.deepEqual(out.incomes.map(i=>i.amountBasis),["period_total","period_total"]);
 assert.deepEqual(out.incomes.map(i=>i.kind),["wage","wage"]);
 assert.deepEqual(out.incomes.map(i=>monthlyIncome(i).value?.toString()),["1800000","1750000"]);
 assert.deepEqual(out.incomes.map(i=>i.label),["2026-09","2026-10"]);
 assert.deepEqual(out.incomes.map(i=>i.recognition),["unreviewed","unreviewed"]);
});

test("months with the same employer name and no verified payer identifier do not become a false monthly average",()=>{
 const read:PageRead={documentType:"shared-document:salary_statement@payroll_payslip",complete:true,warnings:[],records:[
  {category:"income",label:"2026-09",fields:[
    cell("income.payroll.employer","payroll_payslip::income.payroll.employer","동명이인 회사",null),
    cell("income.payroll.net_pay","payroll_payslip::income.payroll.net_pay","1800000"),
    date("income.payroll.pay_period_start","payroll_payslip::income.payroll.pay_period_start","2026-09-01"),
    date("income.payroll.pay_period_end","payroll_payslip::income.payroll.pay_period_end","2026-09-30")]},
  {category:"income",label:"2026-10",fields:[
    cell("income.payroll.employer","payroll_payslip::income.payroll.employer","동명이인 회사",null),
    cell("income.payroll.net_pay","payroll_payslip::income.payroll.net_pay","1750000"),
    date("income.payroll.pay_period_start","payroll_payslip::income.payroll.pay_period_start","2026-10-01"),
    date("income.payroll.pay_period_end","payroll_payslip::income.payroll.pay_period_end","2026-10-31")]}
 ]};
 const out=projectPage(read,"wage-file",1,SHA),data=createCase("Synthetic","wage-case","2026-10-30");
 data.documents=[{id:"wage-file",name:"synthetic.pdf",sha256:SHA,status:"active",pages:[1]}];
 data.pages=out.pages??[];
 data.facts=(out.facts??[]).map(f=>({...f,logicalId:f.logicalId!,version:1,state:"verified" as const,recognition:"accepted" as const,validation:f.validation??[]})) as typeof data.facts;
 data.incomes=out.incomes.map(v=>({...v,recognition:"accepted" as const,recurring:"yes" as const}));
 data.context.inventoryComplete.income="yes";
 const calc=calculateCase(data,rule);
 assert.equal(calc.monthlyIncomeWon,null);
 assert.ok(calc.issues.some(issue=>issue.startsWith("INCOME_PAYER_IDENTITY_REVIEW_REQUIRED")));
});

test("tax annual gross/cost/net is arithmetically compatible but is NOT added as current income without explicit recognition",()=>{
 const read:PageRead={documentType:"shared-document:income_amount_certificate@tax_income",complete:true,warnings:[],records:[{
   category:"income",label:"2025 income",fields:[
    cell("gross_receipts","tax_income::gross_receipts","50000000"),
    cell("necessary_expenses","tax_income::necessary_expenses","20000000"),
    cell("income_after_expenses","tax_income::income_after_expenses","30000000"),
    date("period_start","tax_income::period_start","2025-01-01"),
    date("period_end","tax_income::period_end","2025-12-31")
   ]
 }]};
 const out=projectPage(read,"tax-file",1,SHA);
 assert.equal(out.incomes.length,1);
 assert.equal(out.incomes[0].gross?.amountWon,"50000000");
 assert.equal(out.incomes[0].expenses?.amountWon,"20000000");
 assert.equal(out.incomes[0].net?.amountWon,"30000000");
 assert.equal(out.incomes[0].sourceCalculationRole,"historical_tax_comparison");
 assert.equal(monthlyIncome(out.incomes[0]).value?.toString(),"2500000");
 const data=createCase("Synthetic tax","tax-case","2026-10-30");
 data.documents=[{id:"tax-file",name:"tax.pdf",sha256:SHA,status:"active",pages:[1]}];
 data.pages=out.pages??[];
 data.facts=(out.facts??[]).map(f=>({...f,logicalId:f.logicalId!,version:1,state:"verified" as const,recognition:"unreviewed" as const,validation:f.validation??[]})) as typeof data.facts;
 data.incomes=out.incomes;data.context.inventoryComplete.income="yes";
 const calculated=calculateCase(data,rule);
 assert.equal(calculated.incomeRows[0].monthlyWon,null);
 assert.ok(calculated.issues.some(issue=>issue.includes("INCOME_HISTORICAL_TAX_RECOGNITION_REQUIRED")));
});

test("VAT gross receipts never become net disposable income without period-matched verified costs",()=>{
 const read:PageRead={documentType:"shared-document:vat_certificate@business_sales_vat",complete:true,warnings:[],records:[{
  category:"income",label:"FY25 business turnover",fields:[
   cell("income.sales.gross_sales","business_sales_vat::income.sales.gross_sales","50000000"),
   date("income.sales.reporting_period_start","business_sales_vat::income.sales.reporting_period_start","2025-01-01"),
   date("income.sales.reporting_period_end","business_sales_vat::income.sales.reporting_period_end","2025-12-31")
 ]}]};
 const out=projectPage(read,"vat-file",1,SHA);
 assert.equal(out.incomes.length,1);
 assert.equal(out.incomes[0].sourceCalculationRole,"gross_turnover_only");
 assert.equal(out.incomes[0].gross?.amountWon,"50000000");
 assert.equal(out.incomes[0].net,null);
 assert.equal(out.incomes[0].expenses,null);
 assert.equal(monthlyIncome(out.incomes[0]).value,null);
});

test("debt principal and interest are separate; original principal is not current debt",()=>{
 const debt:PageRead={documentType:"shared-document:debt_certificate@debt_certificate",complete:true,warnings:[],records:[
 {category:"debt",label:"current",fields:[
   cell("creditor","debt_certificate::creditor","은행",null),
   cell("principal_balance","debt_certificate::principal_balance","12000000","KRW","현재 원금 잔액 12000000원"),
   cell("interest_balance","debt_certificate::interest_balance","400000"),
   date("as_of_date","debt_certificate::as_of_date","2026-10-30"),
   cell("original_principal","debt_certificate::original_principal","20000000")
 ]}]};
 const out=projectPage(debt,"debt-file",1,SHA);
 assert.equal(out.debts.length,1);
 assert.equal(out.debts[0].principal?.amountWon,"12000000");
 assert.equal(out.debts[0].interest?.amountWon,"400000");
 assert.ok(out.facts?.some(f=>f.canonicalFieldId==="debt_certificate::original_principal"));
 assert.equal(out.debts[0].legalReview,"unreviewed");
});

test("malformed date does not become a trusted pay period or a monthly amount",()=>{
 const read:PageRead={documentType:"shared-document:salary_statement@payroll_payslip",complete:true,warnings:[],records:[
 {category:"income",label:"invalid",fields:[
   cell("income.payroll.net_pay","payroll_payslip::income.payroll.net_pay","1800000"),
   date("income.payroll.pay_period_start","payroll_payslip::income.payroll.pay_period_start","2026-02-30"),
   date("income.payroll.pay_period_end","payroll_payslip::income.payroll.pay_period_end","2026-02-28")
 ]}]};
 const out=projectPage(read,"invalid-date",1,SHA);
 assert.ok(out.facts?.some(f=>f.validation?.some(v=>v.code==="SOURCE_DATE_INVALID")));
 assert.equal(out.incomes[0].amountBasis,"unknown");
 assert.equal(monthlyIncome(out.incomes[0]).value,null);
});

function setupSql(){
 const sql=new DatabaseSync(":memory:");sql.exec("PRAGMA foreign_keys=ON");
 for(const migration of ["0000_chunky_cardiac.sql","0001_case_storage_token.sql","0008_normalized_extractions.sql","0016_source_field_coverage.sql"])
  sql.exec(readFileSync(new URL("../drizzle/"+migration,import.meta.url),"utf8"));
 sql.prepare("INSERT INTO cases (id,name,owner,revision,payload,created_at,updated_at,storage_token) VALUES ('case-1','Synthetic','owner',1,'{}','at','at','token')").run();
 sql.prepare("INSERT INTO documents (id,case_id,name,sha256,page_count,ready,created_at) VALUES ('doc-1','case-1','salary.pdf',?,1,1,'at')").run(SHA);
 const database={
  prepare(command:string){let args:SQLInputValue[]=[];const stmt={
    bind(...values:SQLInputValue[]){args=values;return stmt;},
    async first<T>(){return sql.prepare(command).get(...args) as T??null;},
    async all<T>(){return {results:sql.prepare(command).all(...args) as T[]};},
    async run(){const result=sql.prepare(command).run(...args);return{meta:{changes:Number(result.changes)}};}
  };return stmt;},
  async batch(statements:Array<{run():Promise<unknown>}>){sql.exec("BEGIN IMMEDIATE");try{const out=[];for(const stmt of statements)out.push(await stmt.run());sql.exec("COMMIT");return out;}catch(error){sql.exec("ROLLBACK");throw error;}}
 } as unknown as D1Database;
 return {sql,database};
}
test("physical SQL storage -> read_json -> exact page projection -> BigInt monthly calculation is value- and ID-compatible",async()=>{
 const {sql,database}=setupSql();
 try{
  const read:PageRead={documentType:"shared-document:salary_statement@payroll_payslip",complete:true,warnings:[],records:[{
   category:"income",label:"2026-09",fields:[
    cell("income.payroll.net_pay","payroll_payslip::income.payroll.net_pay","1800000"),
    date("income.payroll.pay_period_start","payroll_payslip::income.payroll.pay_period_start","2026-09-01"),
    date("income.payroll.pay_period_end","payroll_payslip::income.payroll.pay_period_end","2026-09-30")
   ]
  }]};
  const saved=await persistPageExtractionRows(database,{caseId:"case-1",documentId:"doc-1",page:1,read,sourceHash:SHA,imageHash:IMAGE,
   model:"gpt-6.1-terra",caseRevision:1,stage:"committed",classification:{documentTypeId:"salary_statement",familyId:"payroll_payslip"}});
  const sqlRead=sql.prepare("SELECT read_json,read_sha256 FROM extraction_runs WHERE id=?").get(saved.runId) as {read_json:string;read_sha256:string};
  assert.equal(sqlRead.read_sha256,createHash("sha256").update(sqlRead.read_json).digest("hex"));
  const raw=JSON.parse(sqlRead.read_json) as PageRead;
  const restored=projectPage(raw,"doc-1",1,SHA);
  const view=await listCaseExtractionRows(database,{caseId:"case-1"});
  assert.equal(view.records.length,1);
  assert.equal(view.records[0].fields.find(f=>f.key==="income.payroll.net_pay")?.projectionKey,"net");
  assert.equal(restored.incomes[0].amountBasis,"period_total");
  assert.equal(monthlyIncome(restored.incomes[0]).value?.toString(),"1800000");
  assert.deepEqual(sql.prepare("PRAGMA foreign_key_check").all(),[]);
 }finally{sql.close();}
});
