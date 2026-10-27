import test from "node:test";
import assert from "node:assert/strict";
import { projectPage, type PageRead, type ReadField } from "../lib/extraction.ts";

const hash="a".repeat(64);
const field=(key:string,value:string,quote:string,unit:string|null="원",confidence:ReadField["confidence"]="clear"):ReadField=>({key,label:key,value,quote,unit,confidence,bbox:[.1,.2,.4,.25]});
const insurance=(fields:ReadField[],extra:ReadField[][]=[]):PageRead=>({documentType:"insurance",complete:true,warnings:[],records:[...[fields,...extra].map((row,i)=>({category:"asset" as const,label:`synthetic policy ${i+1}`,fields:[field("kind","insurance","보험 계약","보험"),field("label",`synthetic policy ${i+1}`,"보험 계약명"),...row]}))]});
const project=(read:PageRead)=>projectPage(read,"synthetic-insurance",1,hash);

test("explicit expected surrender amount labels retain their source amount without converting premiums",()=>{
  for(const label of ["현재 해지환급 예상액","해약 환급예상금액","해지시 환급예정액","해지환급금 예상액"]){
    const result=project(insurance([field("surrender_value","825",`${label} 825원`)]));
    assert.equal(result.assets?.[0].grossValue?.amountWon,"825",label);
    const wrong=project(insurance([field("surrender_value","826",`${label} 825원`)]));
    assert.equal(wrong.assets?.[0].grossValue,null,label);
  }
  assert.equal(project(insurance([field("surrender_value","825","납입 예정 보험료 825원")])).assets?.[0].grossValue,null);
});

test("surrender_value stays a raw fact while filling the typed insurance value slot",()=>{
  const result=project(insurance([field("surrender_value","250","예상 해약환급금 250원")]));
  assert.equal(result.assets?.[0].grossValue?.amountWon,"250");
  assert.equal(result.facts?.find(f=>f.key==="asset.surrender_value")?.value,"250");
  assert.ok(!result.facts?.some(f=>f.key==="asset.refund_value"));
});

test("surrender_refund is a typed alias while its source fact key stays unchanged",()=>{
  const result=project(insurance([field("surrender_refund","275","해약환급금 275원")]));
  assert.equal(result.assets?.[0].grossValue?.amountWon,"275");
  assert.ok(result.facts?.some(f=>f.key==="asset.surrender_refund"&&f.value==="275"));
});

test("explicit zero surrender value is preserved and missing unit remains unresolved",()=>{
  const zero=project(insurance([field("surrender_value","0","해약환급금 0원")]));
  assert.equal(zero.assets?.[0].grossValue?.amountWon,"0");
  const noUnit=project(insurance([field("surrender_value","250","해약환급금 250",null)]));
  assert.equal(noUnit.assets?.[0].grossValue?.amountWon,null);
  assert.equal(noUnit.assets?.[0].grossValue?.normalizationStatus,"review_required");
});

test("unclear or semantically wrong explicit surrender slot blocks gross fallback",()=>{
  for(const candidate of [
    field("surrender_value","250","해약환급금 250원","원","uncertain"),
    field("surrender_value","250","납입 보험료 250원"),
  ]){
    const result=project(insurance([candidate,field("gross_value","300","해약환급금 300원")]));
    assert.equal(result.assets?.[0].grossValue,null);
  }
});

test("conflicting surrender aliases block typed value; identical aliases agree",()=>{
  const conflict=project(insurance([field("surrender_value","250","해약환급금 250원"),field("refund_value","300","예상 해약환급금 300원")]));
  assert.equal(conflict.assets?.[0].grossValue,null);
  const same=project(insurance([field("surrender_value","250","해약환급금 250원"),field("refund_value","250","예상 해약환급금 250원")]));
  assert.equal(same.assets?.[0].grossValue?.amountWon,"250");
});

test("insurance premium and coverage are not substituted for surrender value",()=>{
  const result=project(insurance([field("monthly_premium","80","월 보험료 80원"),field("coverage_amount","900","보장금액 900원"),field("gross_value","900","보험 가입금액 900원")]));
  assert.equal(result.assets?.[0].grossValue,null);
  assert.equal(result.facts?.find(f=>f.key==="asset.monthly_premium")?.value,"80");
  assert.equal(result.facts?.find(f=>f.key==="asset.coverage_amount")?.value,"900");
});

test("policy loans remain source observations and never become automatic surrender deductions",()=>{
  const result=project(insurance([field("surrender_value","250","해약환급금 250원"),field("policy_loan_balance","40","보험계약대출 잔액 40원")]));
  assert.equal(result.assets?.[0].grossValue?.amountWon,"250");
  assert.equal(result.assets?.[0].securedPayoff,null);
  assert.equal(result.assets?.[0].securedPayoffScope,"unknown");
  assert.equal(result.assets?.[0].recognition,"unreviewed");
  assert.equal(result.facts?.find(f=>f.key==="asset.policy_loan_balance")?.numeric?.amountWon,"40");
  const specific=project(insurance([field("loan_balance","40","보험약관대출 현재 잔액 40원")]));
  assert.equal(specific.assets?.[0].securedPayoff,null);
  assert.equal(specific.facts?.find(f=>f.key==="asset.loan_balance")?.numeric?.amountWon,"40");
  const otherRow=project(insurance([field("surrender_value","250","해약환급금 250원")],[[field("policy_loan_balance","40","보험계약대출 잔액 40원")]]));
  assert.ok(otherRow.assets?.every(a=>a.securedPayoff===null));
});

test("the typed surrender value requires an agreeing local source amount and valid row coordinates",()=>{
  for(const candidate of [
    field("surrender_value","300","해약환급금 250원"),
    field("surrender_value","250","해약환급금 2500원"),
    field("surrender_value","250","해약환급금 250천원"),
    {...field("surrender_value","250","해약환급금 250원"),bbox:null},
    {...field("surrender_value","250","해약환급금 250원"),bbox:[.4,.2,.1,.25]},
    {...field("surrender_value","250","해약환급금 250원"),value:null},
  ])assert.equal(project(insurance([candidate,field("gross_value","250","해약환급금 250원")])).assets?.[0].grossValue,null);
  const scaled=project(insurance([field("surrender_value","1,250","해약환급금 1,250천원","천원")]));
  assert.equal(scaled.assets?.[0].grossValue?.amountWon,"1250000");
  const ambiguous=project(insurance([field("surrender_value","250","해약환급금 250원 / 해약환급금 300원")]));
  assert.equal(ambiguous.assets?.[0].grossValue,null);
});

test("fully namespaced insurance surrender fields retain raw keys and same-row selection",()=>{
  const result=project(insurance([field("insurance.surrender_value","250","해약환급금 250원")]));
  assert.equal(result.assets?.[0].grossValue?.amountWon,"250");
  assert.ok(result.facts?.some(f=>f.key==="insurance.surrender_value"));
});

test("contract_holder remains an observation and is not converted to applicant identity",()=>{
  const result=project(insurance([field("contract_holder","Synthetic Holder","계약자 Synthetic Holder")]));
  assert.ok(result.facts?.some(f=>f.key==="asset.contract_holder"&&f.value==="Synthetic Holder"));
  assert.equal(result.assets?.[0].grossValue,null);
});
