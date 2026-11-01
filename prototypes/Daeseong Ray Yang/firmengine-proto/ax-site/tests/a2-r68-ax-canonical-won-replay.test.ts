import test from "node:test";
import assert from "node:assert/strict";
import { auditStoredCalculationReplay } from "../lib/preapproval-calculation-replay.ts";

// Synthetic-only. Data replay validity NEVER means calculated amount is approved.
const PATH = "/assessment/calculation/monthlyIncomeWon";
const calcId = "income_average";
type SyntheticRow = { value: unknown; status: string; valueWon: string | null; factIdsJson?: string };
function check({ value, status, valueWon, factIdsJson = '["SYN-F1"]' }: SyntheticRow) {
  return auditStoredCalculationReplay({
    execution: { assessment: { calculation: { monthlyIncomeWon: value } } },
    rows: [{
      id: "SYN-ROW", calculationId: calcId, outputName: "monthlyIncomeWon",
      outputPath: PATH, valueJson: JSON.stringify(value), valueWon,
      status, sourceFactIdsJson: factIdsJson,
    }],
    currentFactIds: new Set(["SYN-F1", "SYN-F2"]),
    expectedOutputs: [{ calculationId: calcId, outputPath: PATH, sourceFactIds: ["SYN-F1"] }],
  });
}
test("A2 r68: blocked noncanonical raw Won is consistent data lineage, not a computed amount", () => {
  for (const value of ["00", "-0", "-00", "00100", "-01", "9,00", "1 000", "[미관찰]"]) {
    const result = check({ value, status: "blocked", valueWon: null });
    assert.equal(result.valid, true, JSON.stringify({ value, issues: result.issues }));
    assert.equal(result.courtApprovalInferred, false);
    assert.equal(result.issueCountByCode.STORED_WON_MISMATCH, undefined);
    assert.equal(result.issueCountByCode.STORED_STATUS_VALUE_CONFLICT, undefined);
  }
});
test("A2 r68: canonical, zero and large integer string are represented exactly", () => {
  for (const value of ["2400000", "0", "-100", "9007199254740992"]) {
    const result = check({ value, status: "computed", valueWon: value });
    assert.equal(result.valid, true, value);
    assert.equal(result.courtApprovalInferred, false);
  }
  assert.equal(check({ value: null, status: "missing", valueWon: null }).valid, true);
  assert.equal(check({ value: "unknown", status: "missing", valueWon: null }).valid, true);
  assert.equal(check({ value: "0", status: "conflict", valueWon: "0" }).valid, true);
});
test("A2 r68: legacy computed malformed money cannot pass with null or raw Won column", () => {
  for (const { value, valueWon } of [
    { value: "00100", valueWon: "00100" },
    { value: "9,00", valueWon: null },
    { value: "-0", valueWon: null },
  ]) {
    const result = check({ value, valueWon, status: "computed" });
    assert.equal(result.valid, false, value);
    assert.equal(result.issueCountByCode.STORED_STATUS_VALUE_CONFLICT, 1);
  }
});
test("A2 r68: a blocked raw amount may not falsely persist a Won number", () => {
  const result = check({ value: "00100", status: "blocked", valueWon: "00100" });
  assert.equal(result.valid, false);
  assert.equal(result.issueCountByCode.STORED_WON_MISMATCH, 1);
  assert.equal(result.issueCountByCode.STORED_STATUS_VALUE_CONFLICT, undefined);
});
test("A2 r68: provenance mismatch still fails although observed amount is blocked", () => {
  const result = check({ value: "00100", status: "blocked", valueWon: null, factIdsJson: '["SYN-F2"]' });
  assert.equal(result.valid, false);
  assert.equal(result.issueCountByCode.STORED_FACT_LINEAGE_MISMATCH, 1);
  assert.equal(result.courtApprovalInferred, false);
});
test("A2 r68: nonmoney not-applicable false remains a legal nonapproval", () => {
  const path = "/courtApprovalInferred";
  const result = auditStoredCalculationReplay({
    execution: { courtApprovalInferred: false },
    rows: [{ id: "SYN-META", calculationId: "calculation_meta", outputName: "courtApprovalInferred",
      outputPath: path, valueJson: "false", valueWon: null,
      status: "not_applicable", sourceFactIdsJson: "[]" }],
    currentFactIds: new Set<string>(),
    expectedOutputs: [{ calculationId: "calculation_meta", outputPath: path, sourceFactIds: [] }],
  });
  assert.equal(result.valid, true);
  assert.equal(result.courtApprovalInferred, false);
});
