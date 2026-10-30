import test from "node:test";
import assert from "node:assert/strict";
import {repaymentPlanLedgerAnnex} from "../lib/document-annexes.ts";
import type {CaseData} from "../lib/domain.ts";
import type {CalculationResult} from "../lib/assessment.ts";
import type {PlanLedger} from "../lib/repayment-plan-model.ts";
import type {PlanReconciliation} from "../lib/plan-reconciliation.ts";

const UNKNOWN="[확인 필요]";
function sample(options:{row?:Record<string,unknown>;totals?:Record<string,unknown>;budgets?:Record<string,unknown>;months?:number;ledgerStatus?:"complete"|"provisional"|"blocked"}={}){
 const row={installment:1,paymentDate:"2026-11-30",phaseId:"P1",debtId:"D1",claimClass:"ordinary",principalWon:"10",interestWon:"0",otherComponentWon:"0",fundingSourceId:"ordinary_budget",balanceAfter:"90",sourceIds:[],...options.row};
 const amounts={principalWon:"10",interestWon:"0",otherComponentWon:"0",totalWon:"10",ordinaryWon:"10",priorityWon:"0",estateWon:"0",trusteeFeeWon:"0",...options.totals};
 const data={context:{planMonths:options.months??1}} as unknown as CaseData;
 const calculation={monthlyPaymentWon:"10"} as unknown as CalculationResult;
 const ledger={status:options.ledgerStatus??"complete",rows:[row],issues:[]} as unknown as PlanLedger;
 const review={status:"reconciled",issues:[],totals:amounts,unallocatedBudgets:options.budgets??{"1:disposable_income":"0"},priorityPayoffInstallment:{},priorityCoverage:{}} as unknown as PlanReconciliation;
 return repaymentPlanLedgerAnnex(data,calculation,ledger,review);
}
test("reviewed full plan renders known amount and 0 without changing values",()=>{
 const normal=sample();assert.equal(normal.status,"source_backed");assert.equal(normal.rows[0]?.[3],"10");assert.equal(normal.rows[0]?.[5],"10");
 const zero=sample({row:{principalWon:"0",balanceAfter:"0"},totals:{principalWon:"0",ordinaryWon:"0",totalWon:"0"}});
 assert.equal(zero.status,"source_backed");assert.equal(zero.rows[0]?.[3],"0");assert.equal(zero.rows[0]?.[5],"0");
});
test("BigInt plan amounts remain exact beyond Number.MAX_SAFE_INTEGER",()=>{
 const big="900719925474099312345";const actual=sample({row:{principalWon:big,balanceAfter:"0"},totals:{principalWon:big,ordinaryWon:big,totalWon:big}});
 assert.equal(actual.status,"source_backed");assert.equal(actual.rows[0]?.[5],big);assert.equal(actual.summary?.rows.at(-1)?.[7],big);
});
test("missing or malformed principal/interest never throw or render a false amount",()=>{
 for(const row of [{principalWon:"INVALID"},{principalWon:null},{interestWon:null},{interestWon:"1.2"}]){
  const actual=sample({row});assert.equal(actual.status,"blocked");assert.equal(actual.rows[0]?.[5],UNKNOWN);
  assert.equal(actual.summary?.rows.at(-1)?.[7],UNKNOWN);
 }
});
test("malformed remaining balance or expense must make annex unresolved",()=>{
 for(const row of [{balanceAfter:"unknown"},{otherComponentWon:"N/A"}]){
  const actual=sample({row});assert.equal(actual.status,"blocked");
  assert.ok(actual.notes.some(v=>v.includes("대조를 완료하지")));
 }
});
test("missing/invalid residual budgets and reconciliation totals do not become zero or crash",()=>{
 for(const budgets of [{},{"1:disposable_income":"?"}]){
  const actual=sample({budgets});assert.equal(actual.status,"blocked");assert.equal(actual.summary?.rows.at(-1)?.[8],UNKNOWN);
 }
 const badTotals=sample({totals:{ordinaryWon:"N/A"}});assert.equal(badTotals.status,"blocked");assert.equal(badTotals.summary?.rows.at(-1)?.[6],UNKNOWN);
});
test("incomplete plan term and provisional ledger never present as source-backed",()=>{
 assert.equal(sample({months:2}).status,"blocked");
 assert.equal(sample({ledgerStatus:"provisional"}).status,"blocked");
});
