// A2 r89: SYNTHETIC reviewed ledger rows only; no customer source, filing, legal recognition or D1.
import test from "node:test";
import assert from "node:assert/strict";
import { reconcilePlanLedger } from "../lib/plan-reconciliation.ts";

const CASES = [
  {id:"ordinary-valid",claimClass:"ordinary",debtPriority:"ordinary",funding:"ordinary_budget",valid:true},
  {id:"priority-valid",claimClass:"priority",debtPriority:"priority",funding:"priority_budget",valid:true},
  {id:"unknown-claim-class",claimClass:"other",debtPriority:"ordinary",funding:"ordinary_budget",issue:"INVALID_LEDGER_CLAIM_CLASS"},
  {id:"ordinary-wrong-funding",claimClass:"ordinary",debtPriority:"ordinary",funding:"priority_budget",issue:"LEDGER_FUNDING_SOURCE_MISMATCH"},
  {id:"priority-wrong-funding",claimClass:"priority",debtPriority:"priority",funding:"ordinary_budget",issue:"LEDGER_FUNDING_SOURCE_MISMATCH"},
  {id:"unknown-debt",claimClass:"ordinary",debtPriority:"none",funding:"ordinary_budget",issue:"LEDGER_DEBT_NOT_IN_CASE"},
  {id:"priority-disguised-ordinary",claimClass:"ordinary",debtPriority:"priority",funding:"ordinary_budget",issue:"LEDGER_CLAIM_CLASS_SOURCE_MISMATCH"},
  {id:"explicit-zero",claimClass:"ordinary",debtPriority:"ordinary",funding:"ordinary_budget",zero:true,valid:true},
];

function fixture(months, spec) {
  const unit = spec.zero ? "0" : "1", debtId=spec.debtPriority==="none"?"SYN-GHOST":"SYN-D";
  const debt = {id:"SYN-D",classification:spec.debtPriority,priority:spec.debtPriority,
    principal:{rawValue:String(months*Number(unit)),amountWon:String(months*Number(unit)),unit:"KRW",currency:"KRW",normalizationStatus:"exact"},
    interest:{rawValue:"0",amountWon:"0",unit:"KRW",currency:"KRW",normalizationStatus:"exact"},factIds:["SYN-F1"]};
  const data = {context:{revision:1,planMonths:months,
    monthlyTrusteeFee:{rawValue:"0",amountWon:"0",unit:"KRW",currency:"KRW",normalizationStatus:"exact"},
    monthlyPriorityPayment:{amountWon:"1"},
    paymentSchedule:{expectedInstallments:months,reviewed:true,
      phases:[{id:"SYN-P",firstInstallment:1,lastInstallment:months,monthlyAvailableWon:unit}]}},
    debts:spec.debtPriority==="none"?[]:[debt]};
  const ledger={status:"complete",issues:[],rows:Array.from({length:months},(_,index)=>({
    installment:index+1,paymentDate:null,phaseId:"SYN-P",debtId,
    claimClass:spec.claimClass,fundingSourceId:spec.funding,
    principalWon:unit,interestWon:"0",otherComponentWon:"0",
    balanceAfter:String((months-index-1)*Number(unit)),sourceIds:["SYN-F1"]}))};
  const calculation={caseRevision:1,ordinaryRepaymentBudgetWon:"1",monthlyPaymentWon:unit,disposableIncomeWon:"1",
    planTotalWon:spec.claimClass==="ordinary"?String(months*Number(unit)):"0"};
  return {data,ledger,calculation};
}
for(const months of [36,48,60]) for(const item of CASES){
  test(`A2 r89 ${months} months ${item.id} source class/funding invariant`,()=>{
    const {data,ledger,calculation}=fixture(months,item);
    const observed=reconcilePlanLedger(data,calculation,ledger);
    assert.equal(observed.status,item.valid?"reconciled":"blocked",JSON.stringify(observed.issues));
    if(item.issue)assert.ok(observed.issues.some(code=>code.startsWith(item.issue+":")),JSON.stringify(observed.issues));
    const independentlyPaid=BigInt(item.zero?0:months);
    assert.equal(observed.totals.totalWon,independentlyPaid.toString());
    if(item.claimClass==="other")assert.equal(observed.totals.trusteeFeeWon,"0",
      "Unknown claim class must not silently inflate trustee-fee amount");
    if(item.valid)assert.equal(observed.issues.length,0);
  });
}
test.todo("Real project-installed Node/CI and stacked #192/#194 reconciliation regressions");
test.todo("Same-case Fact identity and SQL feature row/plan-run SHA to ledger/D5110/D5111 parity");
test.todo("Attorney/calculation practitioner review of source claim classifications and effective court criteria");
