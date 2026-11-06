import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Synthetic-only, dependency-free gate expression regression. This exercises the
// exact checked-in gate expression, NOT the full case-execution/Word or D1 stack.
function compileGate(file, variable) {
  const source = readFileSync(new URL("../lib/" + file, import.meta.url), "utf8");
  const line = source.split("\n").find((item) => item.includes("const " + variable + "="));
  assert.ok(line, "release gate missing: " + variable);
  const expression = line.slice(line.indexOf("=", line.indexOf("const " + variable + "=")) + 1).trim().replace(/;$/, "");
  return new Function("planValidationApplies", "planLedger", "planReconciliation", "hasExplicitSchedule", "data", "input", "assessment", "calculationContract", "return (" + expression + ");");
}
const gates = [
  ["case-execution.ts", "planBlockers"],
  ["office-writer.ts", "planIssues"]
];
const cases = [
  { label: "reviewed-complete", ledger: "complete", applicable: true, expected: [] },
  { label: "provisional-without-issues", ledger: "provisional", applicable: true, expected: ["PLAN_LEDGER_NOT_REVIEWED"] },
  { label: "blocked-amount", ledger: "blocked", applicable: true, expected: ["SYN-BLOCKED"] },
  { label: "provisional-and-legal-hold", ledger: "provisional", applicable: true, reviewTask: "SYN-LEGAL-HOLD", expected: ["PLAN_LEDGER_NOT_REVIEWED", "SYN-LEGAL-HOLD"] },
  { label: "not-applicable", ledger: "provisional", applicable: false, expected: [] },
  { label: "explicit-unreviewed", ledger: "complete", applicable: true, explicit: true, expected: ["PAYMENT_SCHEDULE_REVIEW_REQUIRED"] },
  { label: "explicit-zero-is-not-null", ledger: "provisional", applicable: true, planTotal: "0", expected: ["PLAN_LEDGER_NOT_REVIEWED"] }
];
for (const [file, variable] of gates) {
  for (const months of [36, 48, 60]) {
    for (const fixture of cases) {
      test(file + " " + months + "m " + fixture.label, () => {
        const gate = compileGate(file, variable);
        const data = { context: { planMonths: months, paymentSchedule: { phases: fixture.explicit ? [{}] : [], reviewed: false, reviewReason: "" } } };
        const ledger = { status: fixture.ledger, issues: fixture.ledger === "blocked" ? ["SYN-BLOCKED"] : [] };
        const reconciliation = { status: fixture.ledger === "blocked" ? "blocked" : "reconciled", issues: fixture.ledger === "blocked" ? ["SYN-BLOCKED"] : [], legalReviewTasks: fixture.reviewTask ? [fixture.reviewTask] : [] };
        const observed = gate(fixture.applicable, ledger, reconciliation, !!fixture.explicit, data, { data }, { calculation: { planTotalWon: fixture.planTotal ?? "1" } }, {});
        assert.deepEqual(observed, fixture.expected);
      });
    }
  }
}
test.todo("Actual executeCase with raw/Fact/typed/SQL features, 18 modules and 42 outputs");
test.todo("Actual office DOCX generation, ZIP/XML parse and official template version comparison");
test.todo("Staging D1/R2/Cron + human accounting and attorney legal approval");
