// A2 r75 IT: synthetic-only canonical Fact ID replay; proposed guards are NOT Fact ownership or legal recognition.
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMoney } from "../lib/domain.ts";
import { buildRepaymentPlanModel } from "../lib/repayment-plan-model.ts";

function fixture(months, factIds, zeroInterest=false) {
  const M = value => normalizeMoney(value);
  const data = {
    context: {revision: 8, planMonths: months, paymentSchedule: null, monthlyTrusteeFee: M("0")},
    debts: [{id: "SYN-DEBT-A", principal: M("100"), interest: M(zeroInterest ? "0" : "20"),
      priority: "ordinary", classification: "ordinary", factIds: ["SYN-FACT-A"]}],
  };
  const calc = {caseRevision: 8, planTotalWon: zeroInterest ? "50" : "60", monthlyPaymentWon: "60",
    allocations: [{debtId: "SYN-DEBT-A", allocatedPrincipalWon: "50",
      allocatedInterestWon: zeroInterest ? "0" : "10", factIds}]};
  return buildRepaymentPlanModel(data, calc);
}

for (const months of [36, 48, 60]) {
  for (const [label, factIds] of [
    ["leading whitespace", [" SYN-FACT-A"]],
    ["trailing whitespace", ["SYN-FACT-A "]],
    ["repeated same ID", ["SYN-FACT-A", "SYN-FACT-A"]],
  ]) {
    test(`r75 ${months} months rejects ${label} before generating a plan`, () => {
      const plan = fixture(months, factIds);
      assert.equal(plan.status, "blocked");
      assert.deepEqual(plan.issues, ["DEFAULT_ALLOCATION_INVALID"]);
      assert.equal(plan.rows.length, 0);
    });
  }
  test(`r75 ${months} months canonical ID stays provisional (never approved)`, () => {
    const plan = fixture(months, ["SYN-FACT-A"]);
    assert.equal(plan.status, "provisional");
    assert.equal(plan.rows.filter(row => row.claimClass === "ordinary").length, months);
    assert.equal(plan.rows.find(row => row.debtId === "SYN-DEBT-A")?.sourceIds[0], "SYN-FACT-A");
  });
  test(`r75 ${months} months explicit interest zero remains zero`, () => {
    const plan = fixture(months, ["SYN-FACT-A"], true);
    assert.equal(plan.status, "provisional");
    assert.equal(plan.rows.filter(row => row.debtId === "SYN-DEBT-A").reduce((sum, row) => sum + BigInt(row.interestWon), 0n), 0n);
  });
}
test.todo("r75 a syntactically canonical Fact ID must exist in the active case Fact index");
test.todo("r75 unlinked, expired or withdrawn Fact ownership and SQL producer lineage must be independently verified");
test.todo("r75 real Node integration/CI/D1/D5110/D5111 output read-back and professional approval");
