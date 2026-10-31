import test from "node:test";
import assert from "node:assert/strict";
import { guardIncomeTotalAgainstDecisionConflict as guard } from "../lib/income-decision-conflict-gate.ts";

const cases: { label: string; amount: bigint | null; issues: string[]; expected: bigint | null }[] = [
  { label: "reviewed stable income", amount: 2400000n, issues: [], expected: 2400000n },
  { label: "explicit zero with no conflict", amount: 0n, issues: [], expected: 0n },
  { label: "missing stays null", amount: null, issues: [], expected: null },
  { label: "same Fact review conflict blocks nominal amount", amount: 4800000n, issues: ["INCOME_SAME_FACT_REVIEW_CONFLICT:SYN-A,SYN-B"], expected: null },
  { label: "same Fact conflict blocks explicit zero", amount: 0n, issues: ["INCOME_SAME_FACT_REVIEW_CONFLICT:SYN-A,SYN-B"], expected: null },
  { label: "unqualified conflict code also blocks", amount: 2400000n, issues: ["INCOME_SAME_FACT_REVIEW_CONFLICT"], expected: null },
  { label: "conflict among other warnings blocks", amount: 2400000n, issues: ["INCOME_NAME_MATCH_IS_NOT_IDENTITY:SYN-A,SYN-B", "INCOME_SAME_FACT_REVIEW_CONFLICT:SYN-A,SYN-B"], expected: null },
  { label: "mere payer-name ambiguity remains separate from this guard", amount: 2400000n, issues: ["INCOME_NAME_MATCH_IS_NOT_IDENTITY:SYN-A,SYN-B"], expected: 2400000n },
  { label: "similarly named but distinct code does not block", amount: 2400000n, issues: ["INCOME_SAME_FACT_REVIEW_CONFLICTING:SYN-A,SYN-B"], expected: 2400000n },
  { label: "prefix without colon does not match", amount: 2400000n, issues: ["INCOME_SAME_FACT_REVIEW_CONFLICT_extra"], expected: 2400000n },
];
for (const row of cases) test(row.label, () => assert.equal(guard(row.amount, row.issues), row.expected));
