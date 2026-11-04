import test from "node:test";
import assert from "node:assert/strict";
import { createCase, normalizeMoney } from "../lib/domain.ts";
import { assessCase } from "../lib/assessment.ts";
import { CURRENT_RULESET } from "../lib/legal-rules.ts";

/** Synthetic-only: numerical comparison is not a court finding or human approval. */
function fixture(name: string, assetReviewed: boolean, presentValueReviewed: boolean) {
 const data = createCase("Synthetic liquidation review", "synthetic-a1-r29-" + name, "2026-10-31");
 data.context.inventoryComplete.asset = "yes";
 data.context.approvedPresentValue = normalizeMoney("120");
 data.context.presentValueBasis = "Synthetic present-value calculation rationale";
 data.context.assetValuationBasisReviewed = assetReviewed;
 data.context.presentValueReviewed = presentValueReviewed;
 return data;
}
function liquidationOutcome(data: ReturnType<typeof fixture>) {
 const assessment = assessCase(data, CURRENT_RULESET);
 assert.equal(assessment.calculation.liquidationComparison, "met", "numeric comparison remains separate");
 const finding = assessment.findings.find(item => item.id === "liquidation");
 assert.ok(finding);
 return { outcome: finding.outcome, trace: assessment.calculation.traces.find(item => item.id === "liquidation_comparison")?.status, canFinalize: assessment.generationGate.canFinalize };
}
test("numeric present value alone does not count as approved liquidation coverage", () => {
 const result = liquidationOutcome(fixture("unreviewed-both", false, false));
 assert.equal(result.outcome, "review_required");
 assert.equal(result.trace, "provisional");
 assert.equal(result.canFinalize, false);
});
test("unreviewed present value alone keeps liquidation result pending", () => {
 assert.equal(liquidationOutcome(fixture("unreviewed-pv", true, false)).outcome, "review_required");
});
test("unreviewed asset valuation alone keeps liquidation result pending", () => {
 assert.equal(liquidationOutcome(fixture("unreviewed-asset", false, true)).outcome, "review_required");
});
test("both explicit reviews allow an independent numerical finding, never a court approval", () => {
 const result = liquidationOutcome(fixture("reviewed-both", true, true));
 assert.equal(result.trace, "calculated");
 assert.equal(result.outcome, "pass");
});
