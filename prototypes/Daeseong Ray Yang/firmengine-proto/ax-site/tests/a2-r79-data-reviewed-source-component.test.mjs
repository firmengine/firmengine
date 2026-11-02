// A2 r79: synthetic-only reviewed ledger source-component guard regression.
 // No source OCR, customer facts, legal approval, or production case data.
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMoney } from "../lib/domain.ts";
import { buildRepaymentPlanModel } from "../lib/repayment-plan-model.ts";

function fixture(months, kind) {
 const debt = {
  id: "SYN-DEBT-A", creditor: "Synthetic creditor",
  principal: normalizeMoney("100"), interest: normalizeMoney("0"),
  secured: "no", classification: "ordinary", priority: "ordinary",
  factIds: ["SYN-FACT-A"]
 };
 if (kind === "missing-principal") debt.principal = normalizeMoney(null);
 if (kind === "missing-interest") debt.interest = normalizeMoney(null);
 if (kind === "invalid-principal") debt.principal = normalizeMoney("1..2");
 if (kind === "zero") debt.principal = normalizeMoney("0");
 const debts = [debt];
 if (kind === "duplicate-id") debts.push({
  ...debt, creditor: "Synthetic second creditor",
  principal: normalizeMoney("300"), factIds: ["SYN-FACT-B"]
 });
 const data = {
  context: {
   revision: 8, planMonths: months,
   monthlyTrusteeFee: normalizeMoney("0"),
   paymentSchedule: {
    reviewed: true, expectedInstallments: months,
    phases: [{
     id: "SYN-PHASE", firstInstallment: 1, lastInstallment: months,
     firstPaymentDate: "2026-12-31", monthlyAvailableWon: "1",
     allocations: [{
      creditorId: "SYN-DEBT-A",
      principalWon: kind === "zero" ? "0" : "1", interestWon: "0"
     }]
    }]
   }
  },
  debts
 };
 const calculation = {
  caseRevision: kind === "stale" ? 7 : 8,
  planTotalWon: kind === "zero" ? "0" : String(months),
  monthlyPaymentWon: "1", allocations: []
 };
 return buildRepaymentPlanModel(data, calculation);
}
for (const months of [36, 48, 60]) {
 for (const kind of ["missing-principal", "missing-interest", "invalid-principal"]) {
  test(`r79 ${months} reviewed ${kind}: must block, not impute zero`, () => {
   const result = fixture(months, kind);
   assert.equal(result.status, "blocked");
   assert.deepEqual(result.issues, ["REVIEWED_SOURCE_DEBT_COMPONENT_UNRESOLVED"]);
   assert.equal(result.rows.length, 0);
  });
 }
 test(`r79 ${months} reviewed observed source components: technical complete only`, () => {
  const result = fixture(months, "valid");
  assert.equal(result.status, "complete");
  assert.deepEqual(result.issues, []);
  assert.equal(result.rows.filter(x=>x.claimClass==="ordinary").length, months);
  assert.equal(result.rows.filter(x=>x.claimClass==="ordinary").reduce((n,x)=>n+BigInt(x.principalWon),0n), BigInt(months));
 });
 test(`r79 ${months} reviewed explicit zero remains distinct`, () => {
  const result = fixture(months, "zero");
  assert.equal(result.status, "complete");
  assert.equal(result.rows.filter(x=>x.claimClass==="ordinary").reduce((n,x)=>n+BigInt(x.principalWon),0n),0n);
 });
 test(`r79 ${months} reviewed duplicate debt ID remains blocked`, () => {
  const result = fixture(months, "duplicate-id");
  assert.equal(result.status, "blocked");
  assert.ok(result.issues.includes("REVIEWED_DUPLICATE_SOURCE_DEBT_ID"));
 });
 test(`r79 ${months} stale revision remains blocked`, () => {
  const result = fixture(months, "stale");
  assert.equal(result.status, "blocked");
  assert.ok(result.issues.includes("CALCULATION_SNAPSHOT_STALE"));
 });
}
test.todo("r79 reviewed tax-classified debt missing payment schedule: lawyer classification/priority review");
test.todo("r79 reviewed installments exceed observed principal: source component and payment treatment review");
test.todo("r79 empty/unowned/duplicate source Fact IDs: owner-resolution guard before approved documents");
test.todo("r79 actual Node runner, entire 18-module calculation, SQLite D1 API, D5110/D5111 DOCX readback");
