import test from "node:test";
import assert from "node:assert/strict";
import {calculationSourceCellIssues} from "../lib/ocr-calculation-input.ts";
import {normalizeMoney} from "../lib/domain.ts";
import {projectPage,type PageRead} from "../lib/extraction.ts";

const cell=(value:string|null,unit:string|null="KRW",sourceState="present")=>({
  value,unit,quote:value===null?null:"합성 금액 "+value,confidence:"clear" as const,sourceState
});
const money={datatype:"money"};

test("malformed OCR thousands groups never become a calculation-ready source",()=>{
  for(const value of ["1,00,0000","1,,000","1,234,56","1,000,"]){
    const issues=calculationSourceCellIssues(cell(value),money);
    assert.ok(issues.includes("SOURCE_MONEY_GROUPING_INVALID"),value);
  }
  // The legacy normalizer is intentionally unchanged. OCR acceptance is gated separately.
  assert.equal(normalizeMoney("1,00,0000").amountWon,"1000000");
});
test("valid integer, KRW grouping, exact unit scaling and explicit zero remain valid",()=>{
  for(const value of ["0","1000000","1,000,000","+1,000원","-1,000"]){
    assert.deepEqual(calculationSourceCellIssues(cell(value),money),[],value);
  }
  assert.deepEqual(calculationSourceCellIssues(cell("1,000.5","천원"),money),[]);
  assert.equal(normalizeMoney("1,000.5","천원").amountWon,"1000500");
});
test("unknown/null is not zero and currency/rounding failures retain prior codes",()=>{
  assert.deepEqual(calculationSourceCellIssues(cell(null,null,"unknown"),money),[]);
  assert.ok(calculationSourceCellIssues(cell("100","USD"),money).includes("SOURCE_MONEY_NOT_EXACT_KRW"));
  assert.ok(calculationSourceCellIssues(cell("0.1"),money).includes("SOURCE_MONEY_NOT_EXACT_KRW"));
  assert.ok(calculationSourceCellIssues(cell("1,000",null),money).includes("SOURCE_MONETARY_UNIT_MISSING"));
});
test("real OCR -> Fact / typed income projection retains bad raw cell but blocks calculated net",()=>{
  const moneyField=(value:string)=>({
    key:"income.payroll.net_pay",canonicalFieldId:"payroll_payslip::income.payroll.net_pay",
    label:"급여 실수령",value,unit:"KRW",quote:"급여 실수령 "+value,
    bbox:[0.1,0.1,0.6,0.2],confidence:"clear" as const,sourceState:"present" as const
  });
  const periodField=(key:string,id:string,value:string)=>({
    key,canonicalFieldId:id,label:key,value,unit:null,quote:key+" "+value,
    bbox:[0.1,0.2,0.6,0.3],confidence:"clear" as const,sourceState:"present" as const
  });
  const asRead=(value:string):PageRead=>({
    documentType:"shared-document:salary_statement@payroll_payslip",
    complete:true,warnings:[],records:[{category:"income",label:"synthetic 2026-10",
      fields:[moneyField(value),
      periodField("income.payroll.pay_period_start","payroll_payslip::income.payroll.pay_period_start","2026-10-01"),
      periodField("income.payroll.pay_period_end","payroll_payslip::income.payroll.pay_period_end","2026-10-31")]}]
  });
  const bad=projectPage(asRead("1,00,0000"),"synthetic-doc",1,"a".repeat(64));
  assert.ok(bad.facts?.some(f=>f.validation?.some(v=>v.code==="SOURCE_MONEY_GROUPING_INVALID")));
  assert.ok(!bad.incomes?.some(i=>i.net?.amountWon==="1000000"));
  const good=projectPage(asRead("1,000,000"),"synthetic-doc",1,"a".repeat(64));
  assert.ok(good.incomes?.some(i=>i.net?.amountWon==="1000000"));
});
