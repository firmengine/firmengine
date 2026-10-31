import test from "node:test";
import assert from "node:assert/strict";
import { FORM_CONTRACTS } from "../lib/form-contracts.ts";
import { evaluateDocumentPreflight } from "../lib/document-preflight.ts";

// Synthetic observations only. The test does NOT certify court form conformity.
type Code = "D5110" | "D5111";
type Inputs = { observed?: string; approved?: string | null; payment?: string; total?: string };
const issueCode = "PLAN_APPROVED_MONTHLY_INCOME_UNRESOLVED";
async function run(code: Code, mode: "draft" | "final", input: Inputs = {}) {
  const scalars: Record<string, string> = {
    client_name: "SYNTHETIC APPLICANT",
    monthly_income: input.observed ?? "[확인 필요]",
    approved_monthly_income: input.approved as string ?? "[확인 필요]",
    ...(input.payment !== undefined ? { monthly_payment: input.payment } : {}),
    ...(input.total !== undefined ? { total_repayment: input.total } : {}),
  };
  return evaluateDocumentPreflight({
    formCode: code, mode,
    identity: {
      evaluationId: "SYN-A2-R39",
      evaluationResultHash: "a".repeat(64),
      referenceBundleHash: "b".repeat(64),
      documentEditsHash: "c".repeat(64),
      templateHash: FORM_CONTRACTS[code].templateHash,
    },
    bindings: { scalars, rows: {} },
  });
}
const has = (issues: {code: string}[]) => issues.some(issue => issue.code === issueCode);

test("D5110: observed 2,400,000 without separately reviewed income blocks final", async () => {
  const result = await run("D5110", "final", {observed:"2,400,000",approved:"[확인 필요]"});
  assert.equal(has(result.blockers), true);
  assert.equal(result.status, "blocked");
});
test("D5111: SQL-style null approval is not zero", async () => {
  const result = await run("D5111", "final", {observed:"2,400,000",approved:null});
  assert.equal(has(result.blockers), true);
});
test("D5111: visible repayment without income approval blocks final", async () => {
  const result = await run("D5111", "final", {observed:"[확인 필요]",approved:"[확인 필요]",payment:"900,000"});
  assert.equal(has(result.blockers), true);
});
test("D5110: draft warns rather than blocking this gate", async () => {
  const result = await run("D5110", "draft", {observed:"2,400,000",approved:"[확인 필요]"});
  assert.equal(has(result.blockers), false);
  assert.equal(has(result.warnings), true);
});
test("D5110: explicit reviewed zero is preserved, not considered missing", async () => {
  const result = await run("D5110", "final", {observed:"0",approved:"0",payment:"0"});
  assert.equal(has(result.blockers), false);
});
test("D5111: reviewed positive income does not trigger this gate", async () => {
  const result = await run("D5111", "final", {observed:"2,400,000",approved:"2,400,000",payment:"900,000"});
  assert.equal(has(result.blockers), false);
});
test("D5110: entirely unobserved values are not silently promoted to zero", async () => {
  const result = await run("D5110", "final", {observed:"[확인 필요]",approved:"[확인 필요]"});
  assert.equal(has(result.blockers), false);
});
test("D5111: visible total repayment requires a distinct reviewed monthly income", async () => {
  const result = await run("D5111", "final", {observed:"[확인 필요]",approved:"[확인 필요]",total:"36,000,000"});
  assert.equal(has(result.blockers), true);
});
// Other existing blockers (e.g., legal plan arithmetic and missing creditor fields)
// remain independent; no test here asserts overall legal readiness or DOCX parity.
