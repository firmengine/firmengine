// A2 r72 synthetic-only regression. No clients, OCR images, keys or approval inference.
// Intended command in ax-site: node --experimental-strip-types --test tests/a2-r72-law-default-plan-source-conservation.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMoney } from "../lib/domain.ts";
import { buildRepaymentPlanModel } from "../lib/repayment-plan-model.ts";

function syntheticDefault(months, edit = () => {}) {
  const data = {
    context: {
      revision: 8, planMonths: months, paymentSchedule: null,
      monthlyTrusteeFee: normalizeMoney("0"),
    },
    debts: [
      { id: "SYN-A", principal: normalizeMoney("1000"), interest: normalizeMoney("0"),
        classification: "ordinary", priority: "ordinary", factIds: ["SYN-F1"] },
      { id: "SYN-B", principal: normalizeMoney("1000"), interest: normalizeMoney("0"),
        classification: "ordinary", priority: "ordinary", factIds: ["SYN-F2"] },
    ],
  };
  const calculation = {
    caseRevision: 8, planTotalWon: String(months * 2), monthlyPaymentWon: "2",
    ordinaryRepaymentBudgetWon: "2",
    allocations: [
      { debtId: "SYN-A", allocatedPrincipalWon: String(months), allocatedInterestWon: "0", factIds: ["SYN-F1"] },
      { debtId: "SYN-B", allocatedPrincipalWon: String(months), allocatedInterestWon: "0", factIds: ["SYN-F2"] },
    ],
  };
  edit(data, calculation);
  return buildRepaymentPlanModel(data, calculation);
}

for (const months of [36, 48, 60]) {
  test(`r72 ordinary two-debt ${months}-month fixture conserves principal without legal approval`, () => {
    const result = syntheticDefault(months);
    assert.equal(result.status, "provisional");
    assert.deepEqual(result.issues, []);
    const ordinary = result.rows.filter(row => row.claimClass === "ordinary");
    assert.equal(ordinary.length, months * 2);
    assert.equal(ordinary.reduce((n, row) => n + BigInt(row.principalWon) + BigInt(row.interestWon), 0n), BigInt(months * 2));
  });

  test(`r72 explicit null principal ${months} is missing, never silently zero`, () => {
    const result = syntheticDefault(months, data => { data.debts[0].principal = null; });
    assert.equal(result.status, "blocked");
    assert.deepEqual(result.issues, ["DEFAULT_ALLOCATION_SOURCE_BALANCE_MISSING"]);
    assert.equal(result.rows.length, 0);
  });

  test(`r72 explicit null interest ${months} is missing, never silently zero`, () => {
    const result = syntheticDefault(months, data => { data.debts[0].interest = null; });
    assert.equal(result.status, "blocked");
    assert.deepEqual(result.issues, ["DEFAULT_ALLOCATION_SOURCE_BALANCE_MISSING"]);
    assert.equal(result.rows.length, 0);
  });

  test(`r72 plan snapshot ${months} cannot disagree with credited allocation total`, () => {
    const result = syntheticDefault(months, (_data, calculation) => { calculation.planTotalWon = "999"; });
    assert.equal(result.status, "blocked");
    assert.deepEqual(result.issues, ["DEFAULT_ALLOCATION_TOTAL_MISMATCH"]);
    assert.equal(result.rows.length, 0);
  });

  test(`r72 missing allocations ${months} cannot imply observed payment distribution`, () => {
    const result = syntheticDefault(months, (_data, calculation) => { calculation.allocations = []; });
    assert.equal(result.status, "blocked");
    assert.deepEqual(result.issues, ["DEFAULT_ALLOCATION_TOTAL_MISMATCH"]);
    assert.equal(result.rows.length, 0);
  });

  test(`r72 r71 duplicate-ID regression ${months} remains blocked`, () => {
    const result = syntheticDefault(months, (_data, calculation) => {
      calculation.allocations.push({ ...calculation.allocations[0] });
      calculation.monthlyPaymentWon = "3";
    });
    assert.equal(result.status, "blocked");
    assert.ok(result.issues.includes("DEFAULT_ALLOCATION_DUPLICATE_DEBT_ID"));
  });

  test(`r72 r65 stale-calculation regression ${months} remains blocked`, () => {
    const result = syntheticDefault(months, (_data, calculation) => { calculation.caseRevision = 7; });
    assert.equal(result.status, "blocked");
    assert.ok(result.issues.includes("CALCULATION_SNAPSHOT_STALE"));
  });

  test(`r72 explicit zero ${months} is not treated as missing or legally accepted`, () => {
    const result = syntheticDefault(months, (_data, calculation) => {
      calculation.planTotalWon = "0";
      calculation.monthlyPaymentWon = "0";
      calculation.allocations = calculation.allocations.map(row => ({
        ...row, allocatedPrincipalWon: "0", allocatedInterestWon: "0",
      }));
    });
    assert.equal(result.status, "provisional");
    assert.equal(result.rows.filter(row => row.claimClass === "ordinary")
      .reduce((n, row) => n + BigInt(row.principalWon) + BigInt(row.interestWon), 0n), 0n);
  });
}

// The following are independent residual legal/accounting risks, not passing tests.
// Assessment already issues PRIORITY_CLAIM_SCHEDULE_COVERAGE_REQUIRED; ledger-only
// default outputs do not currently carry that issue. Human review before fail-closed
// contract changes, because payment and classification policies are involved.
test.todo("r72 separately treated priority/estate claim requires an explicit reviewed schedule");
test.todo("r72 total allocation exceeding one creditor source balance requires independent review");
