// Synthetic-only D5110 numeric readback assertions. Not actual DOCX bytes or court approval.
import test from "node:test";
import assert from "node:assert/strict";
import { assessDocumentFilingReadiness } from "../lib/document-filing-readiness.ts";

const HEADERS = ["① 월소득", "② 생계비", "③ 가용소득", "④ 회생위원 보수", "⑤ 실제 가용소득", "⑥ 변제개월", "⑦ 총변제액"];
function inspect(values) {
  const report = assessDocumentFilingReadiness({
    mode: "final",
    documents: [{
      kind: "repayment_plan", name: "SYN-D5110.docx",
      tables: [{ headers: HEADERS, rows: [values] }],
      form: { code: "D5110", reconstruction: true, approvalStatus: "reviewer_pending", unresolvedTokens: [] },
    }],
  });
  assert.equal(report.readyForElectronicFiling, false);
  assert.equal(report.officialParity, "not_verified");
  return report.documents[0].formulaStatus;
}
for (const months of [36, 48, 60]) {
  test(`A2 r82 D5110 ${months}m correct grouping and KRW suffix stay arithmetically consistent`, () => {
    assert.equal(inspect(["1,000원", "400", "600", "100", "500", String(months), String(500 * months)]), "consistent");
  });
  test(`A2 r82 D5110 ${months}m malformed comma and embedded unit do not become consistent`, () => {
    for (const values of [
      ["1,00", "40", "60", "10", "50", String(months), String(50 * months)],
      ["1,234,56", "123456", "0", "0", "0", String(months), "0"],
      ["1원0", "4", "6", "1", "5", String(months), String(5 * months)],
      ["0 0", "0", "0", "0", "0", String(months), "0"],
      ["12₩34", "34", "1200", "0", "1200", String(months), String(1200 * months)],
    ]) assert.equal(inspect(values), "unknown", JSON.stringify(values));
  });
}
test("A2 r82 D5110 use BigInt for more than Number.MAX_SAFE_INTEGER", () => {
  const big = 9007199254740993n, a = big - 1n;
  assert.equal(inspect([big.toString(), "1", a.toString(), "0", a.toString(), "36", (a * 36n).toString()]), "consistent");
});
test("A2 r82 explicit negative shortfall remains distinct from malformed output", () => {
  assert.equal(inspect(["0", "100", "-100", "0", "-100", "36", "-3600"]), "consistent_negative_shortfall");
});
test.todo("A2 r82 regenerate and ZIP/XML re-read real D5110/D5111 Word bytes and compare every cell");
test.todo("A2 r82 verify reviewer-approved official Seoul court layout and case-specific effective-date selection");
test.todo("A2 r82 full project Node CI, staging D1/R2/Cron and Fact owner/revision lineage");
