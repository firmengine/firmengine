// A2 r78 synthetic-only: reviewed-schedule duplicate debt identities.
// A ledger status is technical integrity only, never legal approval or filing authorization.
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMoney } from "../lib/domain.ts";
import { buildRepaymentPlanModel } from "../lib/repayment-plan-model.ts";

const M = value => normalizeMoney(value);
function fixture(months, kind, options = {}) {
  const first = {
    id: "SYN-DEBT-A", creditor: "Synthetic A",
    principal: M(options.zero ? "0" : "100"), interest: M("0"),
    priority: "ordinary", classification: "ordinary", factIds: ["SYN-FACT-A"],
  };
  const second = {
    ...first, creditor: "Synthetic B",
    principal: M(kind === "different-balance" ? "500" : "100"),
    factIds: ["SYN-FACT-B"],
  };
  const data = {
    context: {
      revision: 8, planMonths: months, monthlyTrusteeFee: M("0"),
      paymentSchedule: {
        reviewed: true, expectedInstallments: months,
        phases: [{
          id: "SYN-PHASE", firstInstallment: 1, lastInstallment: months,
          firstPaymentDate: "2026-12-31", monthlyAvailableWon: "10",
          allocations: [{ creditorId: "SYN-DEBT-A", principalWon: options.zero ? "0" : "1", interestWon: "0" }],
        }],
      },
    },
    debts: kind === "different-balance" || kind === "different-fact" ? [first, second] : [first],
  };
  const calculation = {
    caseRevision: options.stale ? 7 : 8,
    planTotalWon: options.zero ? "0" : String(months),
    monthlyPaymentWon: "10", allocations: [],
  };
  return buildRepaymentPlanModel(data, calculation);
}

for (const months of [36, 48, 60]) {
  for (const kind of ["different-balance", "different-fact"]) {
    test(`r78 ${months} reviewed months block duplicated ID (${kind})`, () => {
      const result = fixture(months, kind);
      assert.equal(result.status, "blocked");
      assert.deepEqual(result.issues, ["REVIEWED_DUPLICATE_SOURCE_DEBT_ID"]);
      assert.equal(result.rows.length, 0);
    });
  }
  test(`r78 ${months} reviewed months retain unique-ID complete technical ledger`, () => {
    const result = fixture(months, "unique");
    assert.equal(result.status, "complete");
    assert.deepEqual(result.issues, []);
    assert.equal(result.rows.filter(row => row.claimClass === "ordinary").length, months);
    assert.equal(result.rows.filter(row => row.claimClass === "ordinary")
      .reduce((sum, row) => sum + BigInt(row.principalWon) + BigInt(row.interestWon), 0n), BigInt(months));
  });
  test(`r78 ${months} reviewed months preserve explicit zero`, () => {
    const result = fixture(months, "unique", { zero: true });
    assert.equal(result.status, "complete");
    assert.equal(result.rows.filter(row => row.claimClass === "ordinary")
      .reduce((sum, row) => sum + BigInt(row.principalWon) + BigInt(row.interestWon), 0n), 0n);
  });
  test(`r78 ${months} reviewed months retain stale revision block`, () => {
    const result = fixture(months, "unique", { stale: true });
    assert.equal(result.status, "blocked");
    assert.ok(result.issues.includes("CALCULATION_SNAPSHOT_STALE"));
  });
}

test.todo("r78 reviewed tax classified claims without scheduled payment: manual legal and source classification review");
test.todo("r78 reviewed per-debt cumulative payments exceeding observed principal: no silent balance clamp");
test.todo("r78 18 calc / SQL feature lineage / D5110-D5111 actual DOCX readback, staging D1, CI, lawyer approval");
