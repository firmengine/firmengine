// A2 r71 synthetic cases only; no real data or legal approval.
// node --experimental-strip-types --test tests/a2-r71-default-plan-allocation-integrity.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMoney } from "../lib/domain.ts";
import { buildRepaymentPlanModel } from "../lib/repayment-plan-model.ts";
function fixture(months, edit=()=>{}) {
 const data={context:{revision:8,planMonths:months,paymentSchedule:null,monthlyTrusteeFee:normalizeMoney("0")},debts:[
 {id:"SYN-A",principal:normalizeMoney("1000"),interest:normalizeMoney("0"),priority:"ordinary",classification:"ordinary",factIds:["SYN-F1"]},
 {id:"SYN-B",principal:normalizeMoney("1000"),interest:normalizeMoney("0"),priority:"ordinary",classification:"ordinary",factIds:["SYN-F2"]}]};
 const calc={caseRevision:8,planTotalWon:String(months*2),monthlyPaymentWon:"2",ordinaryRepaymentBudgetWon:"2",disposableIncomeWon:"2",allocations:[
 {debtId:"SYN-A",allocatedPrincipalWon:String(months),allocatedInterestWon:"0",factIds:["SYN-F1"]},
 {debtId:"SYN-B",allocatedPrincipalWon:String(months),allocatedInterestWon:"0",factIds:["SYN-F2"]}]};
 edit(data,calc);
 return buildRepaymentPlanModel(data,calc);
}
for(const n of [36,48,60]){
 test(`r71 valid ${n} month two creditor rows conserved`,()=>{const x=fixture(n),rows=x.rows.filter(r=>r.claimClass==="ordinary");assert.equal(x.status,"provisional");assert.equal(rows.length,n*2);assert.equal(rows.reduce((s,r)=>s+BigInt(r.principalWon)+BigInt(r.interestWon),0n),BigInt(n*2));});
 test(`r71 duplicate debt allocation ${n} blocked even within 3 Won budget`,()=>{const x=fixture(n,(d,c)=>{c.allocations.push({...c.allocations[0]});c.monthlyPaymentWon="3";});assert.equal(x.status,"blocked");assert.ok(x.issues.includes("DEFAULT_ALLOCATION_DUPLICATE_DEBT_ID"));assert.equal(x.rows.length,0);});
 test(`r71 negative amount ${n} blocked`,()=>{const x=fixture(n,(d,c)=>{c.allocations[0].allocatedPrincipalWon="-"+n;});assert.equal(x.status,"blocked");assert.ok(x.issues.includes("DEFAULT_ALLOCATION_INVALID"));});
 test(`r71 noncanonical amount ${n} blocked`,()=>{const x=fixture(n,(d,c)=>{c.allocations[0].allocatedPrincipalWon="00"+n;});assert.equal(x.status,"blocked");assert.ok(x.issues.includes("DEFAULT_ALLOCATION_INVALID"));});
}
test("r71 invalid raw debt balance fails closed instead of throwing",()=>{const x=fixture(36,d=>{d.debts[0].principal={amountWon:"9,00"};});assert.equal(x.status,"blocked");assert.ok(x.issues.includes("DEFAULT_DEBT_BALANCE_INVALID"));});
test("r71 calculation revision mismatch remains blocked",()=>{const x=fixture(36,(d,c)=>{c.caseRevision=7;});assert.equal(x.status,"blocked");assert.ok(x.issues.includes("CALCULATION_SNAPSHOT_STALE"));});
test("r71 explicit zero monthly proposal and allocations remain zero",()=>{const x=fixture(36,(d,c)=>{c.monthlyPaymentWon="0";c.allocations=c.allocations.map(a=>({...a,allocatedPrincipalWon:"0"}));});assert.equal(x.status,"provisional");assert.equal(x.rows.filter(r=>r.claimClass==="ordinary").reduce((s,r)=>s+BigInt(r.principalWon),0n),0n);});
test("r71 null proposal is not auto-imputed as zero",()=>{const x=fixture(36,(d,c)=>{c.monthlyPaymentWon=null;});assert.equal(x.status,"provisional");assert.ok(!x.issues.some(s=>s.startsWith("DEFAULT_ORDINARY_MONTHLY_PROPOSAL_EXCEEDED")));});
