import test from "node:test";
import assert from "node:assert/strict";
import type { CaseExecution } from "../lib/case-agent.ts";
import { calculationFeatureRows } from "../lib/case-calculation-feature-store.ts";

// A2 r62 AX: synthetic calculation OUTPUTS, not extracted customer facts or approved income.
// The real serializer and reference catalog are used; engine arithmetic is not rerun.
function syntheticExecution(monthlyIncomeWon: unknown): CaseExecution {
  return {
    assessment: {
      calculation: {
        caseRevision: 1,
        computedBy: "deterministic-bigint",
        monthlyIncomeWon,
        incomeRows: [],
        incomeGroups: [],
        debtRows: [],
        assetRows: [],
        allocations: [],
        traces: [{ id: "income_group:SYN", status: "calculated", reasons: [], inputs: [], resultWon: monthlyIncomeWon }],
      },
    },
    proposals: { livingCost: null, objectionMinimum: null, termCandidate: null },
    courtApprovalInferred: false,
  } as unknown as CaseExecution;
}
function find(
  e: CaseExecution,
  name: string,
  subjectId?: string,
) {
  const matches = calculationFeatureRows(e).filter(
    f => f.outputName === name && (subjectId === undefined || f.subjectId === subjectId),
  );
  assert.equal(matches.length, 1, `exactly one synthetic feature expected: ${name} ${subjectId ?? ""}`);
  return matches[0];
}

test("A2 r62: raw Won semantics survive actual feature-row serialization", () => {
  const cases: Array<{ value: unknown; status: string; valueWon: string | null }> = [
    { value: "2400000", status: "computed", valueWon: "2400000" },
    { value: "0", status: "computed", valueWon: "0" },
    { value: null, status: "missing", valueWon: null },
    { value: "unknown", status: "missing", valueWon: null },
    { value: "9,00", status: "blocked", valueWon: null },
    { value: "1 000", status: "blocked", valueWon: null },
    { value: "[미관찰]", status: "blocked", valueWon: null },
    { value: 9007199254740992, status: "blocked", valueWon: null },
    { value: "9007199254740992", status: "computed", valueWon: "9007199254740992" },
  ];
  for (const { value, status, valueWon } of cases) {
    const e = syntheticExecution(value);
    const before = JSON.stringify(e);
    const f = find(e, "monthlyIncomeWon");
    assert.equal(f.status, status, JSON.stringify(value));
    assert.equal(f.valueWon, valueWon, JSON.stringify(value));
    assert.deepEqual(f.value, value, JSON.stringify(value));
    if (status === "blocked") assert.ok(f.reasons.includes("INVALID_MONETARY_FEATURE_VALUE"));
    assert.equal(JSON.stringify(e), before, "serializing must not rewrite the original engine result");
    assert.equal(find(e, "courtApprovalInferred").status, "not_applicable");
  }
});

test("A2 r62: malformed wage row and trace retain synthetic Fact lineage and do not become 0", () => {
  const e = syntheticExecution("2400000");
  const calc = e.assessment.calculation as unknown as {
    incomeRows: Record<string, unknown>[];
    traces: Record<string, unknown>[];
  };
  calc.incomeRows.push(
    { id: "SYN-W1", netIncomeWon: "9,00", sourceIds: ["SYN-S1"], factIds: ["SYN-F1"] },
    { id: "SYN-W2", netIncomeWon: "0", sourceIds: ["SYN-S2"], factIds: ["SYN-F2"] },
  );
  calc.traces.push(
    { id: "income:SYN-W1", status: "calculated", reasons: [], inputs: [{ factIds: ["SYN-F1"] }], resultWon: "9,00" },
    { id: "income:SYN-W2", status: "calculated", reasons: [], inputs: [{ factIds: ["SYN-F2"] }], resultWon: "0" },
  );
  const malformed = find(e, "incomeRows.netIncomeWon", "SYN-W1");
  assert.equal(malformed.outputPath, "/assessment/calculation/incomeRows/0/netIncomeWon");
  assert.equal(malformed.value, "9,00");
  assert.equal(malformed.valueWon, null);
  assert.equal(malformed.status, "blocked");
  assert.deepEqual(malformed.sourceFactIds, ["SYN-F1"]);
  assert.ok(malformed.reasons.includes("INVALID_MONETARY_FEATURE_VALUE"));
  const zero = find(e, "incomeRows.netIncomeWon", "SYN-W2");
  assert.equal(zero.valueWon, "0");
  assert.equal(zero.status, "computed");
  assert.deepEqual(zero.sourceFactIds, ["SYN-F2"]);
  const trace = find(e, "traces.resultWon", "SYN-W1");
  assert.equal(trace.valueWon, null);
  assert.equal(trace.status, "blocked");
  assert.deepEqual(trace.sourceFactIds, ["SYN-F1"]);
});

test("A2 r62: nested proposal Won is blocked without confusing legal approval or months", () => {
  const e = syntheticExecution("2400000");
  const p = e.proposals as unknown as Record<string, unknown>;
  p.livingCost = { status: "calculated", amountWon: "9,00" };
  p.termCandidate = { status: "calculated", termMonths: 36 };
  assert.equal(find(e, "proposals.livingCost.amountWon").status, "blocked");
  assert.equal(find(e, "proposals.livingCost.amountWon").valueWon, null);
  assert.equal(find(e, "proposals.termCandidate.termMonths").status, "computed");
  assert.equal(find(e, "proposals.termCandidate.termMonths").valueWon, null);
  assert.equal(find(e, "courtApprovalInferred").value, false);
  assert.equal(find(e, "courtApprovalInferred").status, "not_applicable");
});
