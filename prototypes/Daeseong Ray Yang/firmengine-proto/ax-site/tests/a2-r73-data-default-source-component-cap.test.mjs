// A2 r73 synthetic-only, no actual cases or approvals. Candidate is stacked on #172.
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMoney } from "../lib/domain.ts";
import { buildRepaymentPlanModel } from "../lib/repayment-plan-model.ts";

function fixture(months=36,edit=()=>{}){
 const M=(v)=>v===null?null:normalizeMoney(v);
 const data={
  context:{revision:8,planMonths:months,paymentSchedule:null,monthlyTrusteeFee:M("0")},
  debts:[
   {id:"SYN-A",principal:M("100"),interest:M("20"),priority:"ordinary",classification:"ordinary",factIds:["SYN-F-A"]},
   {id:"SYN-B",principal:M("100"),interest:M("20"),priority:"ordinary",classification:"ordinary",factIds:["SYN-F-B"]},
  ],
 };
 const calculation={
  caseRevision:8,planTotalWon:"120",monthlyPaymentWon:"120",
  allocations:[
   {debtId:"SYN-A",allocatedPrincipalWon:"50",allocatedInterestWon:"10",factIds:["SYN-F-A"]},
   {debtId:"SYN-B",allocatedPrincipalWon:"50",allocatedInterestWon:"10",factIds:["SYN-F-B"]},
  ],
 };
 edit(data,calculation,M);
 return buildRepaymentPlanModel(data,calculation);
}
for(const months of [36,48,60]){
 test(`r73 ${months} months normal sum=120 Won remains only provisional`,()=>{
  const result=fixture(months);
  assert.equal(result.status,"provisional");
  assert.deepEqual(result.issues,[]);
  assert.equal(result.rows.filter(r=>r.claimClass==="ordinary").reduce((n,r)=>n+BigInt(r.principalWon)+BigInt(r.interestWon),0n),120n);
 });
 test(`r73 ${months} months principal allocation exceeds observed principal`,()=>{
  const result=fixture(months,(data,_calc,M)=>{data.debts[0].principal=M("20");});
  assert.equal(result.status,"blocked");
  assert.deepEqual(result.issues,["DEFAULT_ALLOCATION_EXCEEDS_SOURCE_COMPONENT"]);
  assert.equal(result.rows.length,0);
 });
 test(`r73 ${months} months interest allocation exceeds observed interest`,()=>{
  const result=fixture(months,(data,_calc,M)=>{data.debts[0].interest=M("5");});
  assert.equal(result.status,"blocked");
  assert.deepEqual(result.issues,["DEFAULT_ALLOCATION_EXCEEDS_SOURCE_COMPONENT"]);
 });
 test(`r73 ${months} months component-swapped totals still require review`,()=>{
  const result=fixture(months,(data,_calc,M)=>{data.debts[0].principal=M("20");data.debts[0].interest=M("100");});
  assert.equal(result.status,"blocked");
  assert.deepEqual(result.issues,["DEFAULT_ALLOCATION_EXCEEDS_SOURCE_COMPONENT"]);
 });
 test(`r73 ${months} months exact source component cap is not blocked`,()=>{
  const result=fixture(months,(data,_calc,M)=>{data.debts[0].principal=M("50");data.debts[0].interest=M("10");});
  assert.equal(result.status,"provisional");
 });
 test(`r73 ${months} months null interest still blocks without zero filling`,()=>{
  const result=fixture(months,data=>{data.debts[0].interest=null;});
  assert.equal(result.status,"blocked");
  assert.deepEqual(result.issues,["DEFAULT_ALLOCATION_SOURCE_BALANCE_MISSING"]);
 });
 test(`r73 ${months} months explicit zero is distinct from null`,()=>{
  const result=fixture(months,(data,calc,M)=>{
   data.debts[0].interest=M("0");
   calc.allocations[0].allocatedInterestWon="0";
   calc.planTotalWon="110";
  });
  assert.equal(result.status,"provisional");
 });
 test(`r73 ${months} months large BigInt Won compares without JS number loss`,()=>{
  const result=fixture(months,(data,calc,M)=>{
   const huge="9007199254740995";
   data.debts[0].principal=M(huge);
   calc.allocations[0].allocatedPrincipalWon=huge;
   calc.planTotalWon=(BigInt(huge)+70n).toString();
   calc.monthlyPaymentWon=calc.planTotalWon;
  });
  assert.equal(result.status,"provisional");
 });
}
// Data lineage may include supporting facts that are not debt.factIds.
// Do not implement a policy-free equality shortcut; verify producer consumers first.
test.todo("r73 allocation source Fact IDs absent despite source debt Fact IDs");
test.todo("r73 allocation source Fact IDs reference unrelated or withdrawn Fact");
test.todo("r73 priority/estate claim default schedule needs separate reviewed treatment");
