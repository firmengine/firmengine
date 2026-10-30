import test from "node:test";
import assert from "node:assert/strict";
import {projectPage,type PageRead} from "../lib/extraction.ts";
import {applyExtraction,createCase,normalizeMoney,type CaseData} from "../lib/domain.ts";
import {calculateCase,monthlyIncome,allocateProRata,liquidationContribution,calculateDisposal} from "../lib/assessment.ts";
import {parseExactOwnershipBps} from "../lib/source-quantity.ts";
import {calculationSourceCellIssues} from "../lib/ocr-calculation-input.ts";
import {documentFieldContract} from "../lib/document-agent-registry.ts";
import {canonicalProjectionKey,bindCanonicalSourceField} from "../lib/canonical-field-binding.ts";
import {scanTransactions} from "../lib/transaction-review.ts";
import {getCalculationSpecs} from "../lib/execution-catalog.ts";

const hash="d".repeat(64);
const field=(key:string,canonicalFieldId:string,value:string|null,unit:string|null="KRW",quote?:string)=>({
 key,canonicalFieldId,label:key,value,unit,quote:quote??key+" "+value,bbox:[0.1,0.1,0.5,0.2],
 confidence:"clear" as const,sourceState:value===null?"unknown" as const:"present" as const
});
const read=(documentType:string,category:"income"|"debt"|"asset"|"transaction",rows:ReturnType<typeof field>[][]):PageRead=>({
 documentType,complete:true,warnings:[],records:rows.map((fields,index)=>({category,label:"source-row-"+index,fields}))
});
const caseWithSource=(source:PageRead):{data:CaseData;raw:ReturnType<typeof projectPage>}=>{
 const data=createCase("synthetic canonical input","synthetic-ocr-input","2026-10-27");
 data.documents=[{id:"doc",name:"synthetic.pdf",sha256:hash,status:"active",pages:[1]}];
 data.pages=[{documentId:"doc",page:1,role:"evidence",text:source.records.flatMap(row=>row.fields.map(field=>field.quote??"")).join(" | ")}];
 const raw=projectPage(source,"doc",1,hash);
 return {data:applyExtraction(data,raw),raw};
};
const reviewed=(data:CaseData):CaseData=>{
 const next=structuredClone(data);
 next.facts=next.facts.map(f=>({...f,state:"verified",recognition:"accepted"}));
 next.incomes=next.incomes.map(f=>({...f,recognition:"accepted"}));
 next.debts=next.debts.map(f=>({...f,legalReview:"accepted"}));
 next.assets=next.assets.map(f=>({...f,recognition:"accepted"}));
 return next;
};
const rules={id:"synthetic-reviewed",status:"source_verified" as const,sources:[]};

test("all 18 registered calculation modules retain explicit input/output contracts",()=>{
 const specs=getCalculationSpecs();
 assert.equal(specs.length,18);
 for(const spec of specs){
  assert.ok(spec.id&&spec.inputs.length&&spec.outputs.length,spec.id);
  assert.ok(spec.resultPaths.length,spec.id);
 }
});

test("real stored payroll canonical fields project monthly money through typed source into deterministic engine",()=>{
 const source=read("shared-document:salary_statement@payroll_payslip","income",[[
  field("income.payroll.employer","payroll_payslip::income.payroll.employer","Employer A",null),
  field("income.payroll.net_pay","payroll_payslip::income.payroll.net_pay","2310000"),
  field("income.payroll.pay_period_start","payroll_payslip::income.payroll.pay_period_start","2026-10-01",null),
  field("income.payroll.pay_period_end","payroll_payslip::income.payroll.pay_period_end","2026-10-31",null)
 ]]);
 const {data,raw}=caseWithSource(source);
 assert.equal(raw.incomes[0].kind,"wage");
 assert.equal(raw.incomes[0].amountBasis,"period_total");
 assert.equal(raw.incomes[0].net?.amountWon,"2310000");
 assert.equal(raw.incomes[0].periodStart,"2026-10-01");
 data.context.inventoryComplete.income="yes";
 const computed=calculateCase(reviewed(data),rules);
 assert.equal(computed.monthlyIncomeWon,"2310000");
 assert.equal(computed.incomeRows[0].monthlyWon,"2310000");
});
test("part-month payslip does not divide a sum by an invented whole-month duration",()=>{
 const source=read("shared-document:salary_statement@payroll_payslip","income",[[
  field("income.payroll.net_pay","payroll_payslip::income.payroll.net_pay","2310000"),
  field("income.payroll.pay_period_start","payroll_payslip::income.payroll.pay_period_start","2026-10-15",null),
  field("income.payroll.pay_period_end","payroll_payslip::income.payroll.pay_period_end","2026-10-31",null)
 ]]);
 const {data,raw}=caseWithSource(source);
 assert.equal(raw.incomes[0].amountBasis,"period_total");
 const result=calculateCase(reviewed(data),rules);
 assert.equal(result.incomeRows[0].monthlyWon,null);
 assert.ok(result.issues.some(i=>i.startsWith("INCOME_PERIOD_DENOMINATOR_MISSING")));
});
test("explicit periodMonths cannot override a half-month or malformed OCR period",()=>{
 const source={id:"part",kind:"wage" as const,label:"Part month",net:normalizeMoney("1000000"),
  amountBasis:"period_total" as const,periodStart:"2026-10-15",periodEnd:"2026-10-31",periodMonths:1,factIds:[]};
 const half=monthlyIncome(source);
 assert.equal(half.value,null);
 assert.ok(half.reasons.includes("INCOME_PERIOD_NOT_COMPLETE_CALENDAR_MONTHS"));
 const bad=monthlyIncome({...source,periodStart:"2026-02-01",periodEnd:"2026-02-30"});
 assert.equal(bad.value,null);
 const full=monthlyIncome({...source,periodStart:"2026-10-01",periodEnd:"2026-10-31"});
 assert.equal(full.value,1000000n);
});

test("same-employer monthly observations cannot be merged by name unless separately human reviewed",()=>{
 const source=read("shared-document:salary_statement@payroll_payslip","income",[
  [field("income.payroll.employer","payroll_payslip::income.payroll.employer","Employer A",null),
   field("income.payroll.net_pay","payroll_payslip::income.payroll.net_pay","2000000"),
   field("income.payroll.pay_period_start","payroll_payslip::income.payroll.pay_period_start","2026-09-01",null),
   field("income.payroll.pay_period_end","payroll_payslip::income.payroll.pay_period_end","2026-09-30",null)],
  [field("income.payroll.employer","payroll_payslip::income.payroll.employer","Employer A",null),
   field("income.payroll.net_pay","payroll_payslip::income.payroll.net_pay","2500000"),
   field("income.payroll.pay_period_start","payroll_payslip::income.payroll.pay_period_start","2026-10-01",null),
   field("income.payroll.pay_period_end","payroll_payslip::income.payroll.pay_period_end","2026-10-31",null)]
 ]);
 const {data,raw}=caseWithSource(source);assert.equal(raw.incomes.length,2);
 data.context.inventoryComplete.income="yes";
 const unsafe=calculateCase(reviewed(data),rules);
 assert.equal(unsafe.monthlyIncomeWon,null);
 const accepted=reviewed(data);accepted.incomes=accepted.incomes.map(item=>({...item,aggregationTreatment:"series_observation",aggregationReviewed:true,aggregationReviewReason:"same legal employer, reviewed monthly records"}));
 const result=calculateCase(accepted,rules);
 assert.equal(result.monthlyIncomeWon,"2250000");
 assert.equal(result.incomeGroups[0].observedMonths,2);
});
test("current principal, interest and total claim keys bind correctly; original principal is never current principal",()=>{
 const contract=documentFieldContract("shared-document:debt_certificate@debt_certificate")!;
 const mapped=[["principal_balance","principal_balance"],["interest_balance","interest"],["total_claim","total"],["fees","costs"]];
 for(const [key,dest] of mapped){
  const f=contract.fields.find(f=>f.local_id===key)!;
  const binding=bindCanonicalSourceField({key,canonicalFieldId:f.global_field_id},contract);
  assert.equal(canonicalProjectionKey(contract,binding,"debt"),dest);
 }
 const source=read("shared-document:debt_certificate@debt_certificate","debt",[[
  field("creditor","debt_certificate::creditor","Bank A",null),
  field("contract_id","debt_certificate::contract_id","contract-1",null),
  field("original_principal","debt_certificate::original_principal","2000000"),
  field("principal_balance","debt_certificate::principal_balance","1000000","KRW","현재 원금 잔액 1000000원"),
  field("interest_balance","debt_certificate::interest_balance","30000","KRW","이자 잔액 30000원"),
  field("as_of_date","debt_certificate::as_of_date","2026-10-27",null)
 ]]);
 const {data,raw}=caseWithSource(source);
 assert.equal(raw.debts[0].principal?.amountWon,"1000000");
 assert.equal(raw.debts[0].interest?.amountWon,"30000");
 assert.ok(!raw.facts?.some(x=>x.key==="debt.principal"&&x.value==="2000000"));
 data.context.inventoryComplete.debt="yes";
 const r=calculateCase(reviewed(data),rules);
 assert.equal(r.debtRows[0].principalWon,"1000000");
 assert.equal(r.debtRows[0].interestWon,"30000");
});
test("claim fees remain distinct from principal and interest; cannot silently inflate balance",()=>{
 const source=read("shared-document:debt_certificate@debt_certificate","debt",[[
  field("creditor","debt_certificate::creditor","Bank A",null),
  field("principal_balance","debt_certificate::principal_balance","1000000","KRW","현재 원금 잔액 1000000원"),
  field("interest_balance","debt_certificate::interest_balance","30000","KRW","이자 잔액 30000원"),
  field("fees","debt_certificate::fees","5000","KRW","별도 비용 5000원"),
  field("as_of_date","debt_certificate::as_of_date","2026-10-27",null)
 ]]);
 const {data,raw}=caseWithSource(source);
 assert.ok(raw.facts?.some(x=>x.key==="debt.costs"));
 const result=calculateCase(reviewed(data),rules);
 assert.equal(result.debtRows[0].totalWon,null);
 assert.ok(result.issues.some(x=>x.includes("DEBT_SEPARATE_COST_REQUIRES_REVIEW")));
});
test("transaction timestamp projects to source day without destroying exact OCR timestamp",()=>{
 const source=read("shared-document:bank_statement@bank_transactions","transaction",[[
  field("transaction_datetime","bank_transactions::transaction_datetime","2026-10-27T17:20:45+09:00",null),
  field("account_id","bank_transactions::account_id","account-123",null),
  field("direction","bank_transactions::direction","out",null),
  field("amount","bank_transactions::amount","100000","KRW","거래금액 100000원")
 ]]);
 const {data,raw}=caseWithSource(source);
 assert.equal(raw.transactions[0].date,"2026-10-27");
 assert.ok(raw.facts?.some(x=>x.key==="transaction.date"&&x.value==="2026-10-27T17:20:45+09:00"));
 const result=scanTransactions(reviewed(data));
 assert.ok(!result.items.some(x=>x.id.startsWith("date:")));
 assert.ok(!result.items.some(x=>x.id.startsWith("field-conflict:transaction.date")));
});
test("wrong canonical ID never masquerades as a valid transaction amount fact",()=>{
 const source=read("shared-document:bank_statement@bank_transactions","transaction",[[
  field("amount","debt_certificate::principal_balance","100000")
 ]]);
 const {raw}=caseWithSource(source);
 assert.equal(raw.transactions.length,0);
 assert.ok(raw.facts?.some(x=>x.key==="transaction.unbound_source.amount"));
 assert.ok(!raw.facts?.some(x=>x.key==="transaction.amount"));
});
test("ownership share only exact ratios become integral bps",()=>{
 for(const [raw,unit,expected] of [
  ["50%",null,5000],["25.25%",null,2525],["1/4",null,2500],["0.5","ratio",5000],
  ["50",null,null],["1/3",null,null],["50.005%",null,null],
  ["101%",null,null],["0","bps",0]
 ] as [string,string|null,number|null][]){
  assert.equal(parseExactOwnershipBps({value:raw,unit}),expected,raw);
 }
 const source=read("shared-document:cash_holding_statement@cash_deposit_asset","asset",[[
  field("asset_kind","cash_deposit_asset::asset_kind","cash",null),
  field("gross_value","cash_deposit_asset::gross_value","1000000"),
  field("ownership_share","cash_deposit_asset::ownership_share","50%",null),
  field("as_of_date","cash_deposit_asset::as_of_date","2026-10-27",null),
  field("valuation_basis","cash_deposit_asset::valuation_basis","source stated",null)
 ]]);
 const r=projectPage(source,"doc",1,hash);
 assert.equal(r.assets[0]?.ownershipBps,5000);
});
test("money, date and datetime source contracts reject invalid input before arithmetic",()=>{
 for(const [fieldId,badValue,unit,reason] of [
  ["bank_transactions::amount","100.01","KRW","SOURCE_MONEY_NOT_EXACT_KRW"],
  ["bank_transactions::transaction_datetime","2026-02-30T13:30:00",null,"SOURCE_DATETIME_INVALID"],
  ["payroll_payslip::income.payroll.pay_period_end","2026-02-30",null,"SOURCE_DATE_INVALID"],
  ["payroll_payslip::income.payroll.net_pay","2300000",null,"SOURCE_MONETARY_UNIT_MISSING"]
 ] as [string,string,string|null,string][]){
  const defs=["bank_transactions","payroll_payslip"].map(f=>documentFieldContract("shared-document:"+(f==="bank_transactions"?"bank_statement@bank_transactions":"salary_statement@payroll_payslip"))!);
  const def=defs.flatMap(c=>c.fields).find(f=>f.global_field_id===fieldId)!;
  assert.ok(calculationSourceCellIssues({value:badValue,unit,quote:badValue,confidence:"clear",sourceState:"present"},def).includes(reason),fieldId);
 }
});
test("independent exact monetary formulas preserve conservation and missing-value block",()=>{
 assert.equal(monthlyIncome({id:"income",kind:"wage",label:"income",net:normalizeMoney("9000000"),amountBasis:"period_total",periodStart:"2026-01-01",periodEnd:"2026-03-31",factIds:[]}).value,3000000n);
 assert.equal(monthlyIncome({id:"income",kind:"wage",label:"income",net:normalizeMoney("9000000"),amountBasis:"unknown",factIds:[]}).value,null);
 const a=allocateProRata("5",[{id:"A",amountWon:"2"},{id:"B",amountWon:"2"},{id:"C",amountWon:"2"}]);
 assert.equal(a.reduce((sum,x)=>sum+BigInt(x.amountWon),0n),5n);
 const asset={id:"asset",kind:"cash" as const,label:"asset",grossValue:normalizeMoney("1000000"),ownershipBps:5000,securedPayoff:normalizeMoney("100000"),securedPayoffScope:"applicant_interest" as const,disposalCosts:normalizeMoney("10000"),protectedValue:normalizeMoney("0"),asOf:"2026-10-27",valuationBasis:"source stated",recognition:"accepted" as const,factIds:[]};
 assert.equal(liquidationContribution(asset,true,true).value,390000n);
 assert.equal(calculateDisposal({saleAmount:normalizeMoney("1000000"),securedPayoff:normalizeMoney("1100000"),costs:normalizeMoney("100000")}).shortfallWon,"200000");
});
