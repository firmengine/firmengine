import test from "node:test";
import assert from "node:assert/strict";
import { assessDocumentFilingReadiness } from "../lib/document-filing-readiness.ts";

// Synthetic visible text only. This does not prove DOCX byte parity or court approval.
const unapproved = [
  "[확인 필요] 원문", "[불일치] 123", "[상충]", "[검토 필요]",
  "[미관찰]", "[미상]", "[승인전]", "[누락]", "[오인식]",
  "[판독]", "[배분]", "[미확정]", "[원문만]", "[원천만]",
  "[검토완료]", "source-only", "source-only_bad",
] as const;
const normal = ["0", "0원", "2,400,000원", "일반 설명에서 source-only를 단어로 사용", "정상 문장", "[정상확인]"] as const;

function inspect(text: string, placement: "paragraph" | "table" = "paragraph") {
  const form = { code: "D5110", reconstruction: true, approvalStatus: "reviewer_pending", unresolvedTokens: [] };
  const document = { kind: "repayment_plan", name: "synthetic-D5110.docx", form,
    ...(placement === "paragraph" ? { paragraphs: [text] } : { tables: [{ rows: [["0", text]] }] }) };
  const report = assessDocumentFilingReadiness({ mode: "final", documents: [document] });
  assert.equal(report.officialParity, "not_verified");
  assert.equal(report.readyForElectronicFiling, false);
  return report;
}

test("A2-DOC r76: all visible unresolved/approval markers are reported, even with empty unresolvedTokens", () => {
  for (const value of unapproved) {
    for (const placement of ["paragraph", "table"] as const) {
      const out = inspect(value, placement);
      assert.ok(out.documents[0].reasons.includes("unresolved_markers_present"), `${placement}: ${value}`);
      assert.ok(out.reasons.includes("unresolved_markers_present"), `${placement}: ${value}`);
    }
  }
});

test("A2-DOC r76: explicit 0, valid amount and explanatory source-only sentence do not turn into missing values", () => {
  for (const value of normal) {
    const out = inspect(value);
    assert.equal(out.documents[0].reasons.includes("unresolved_markers_present"), false, value);
  }
});

test("A2-DOC r76: metadata unresolvedTokens remain a separate trigger without visible placeholders", () => {
  const report = assessDocumentFilingReadiness({ mode: "final", documents: [{
    kind: "repayment_plan", name: "synthetic-D5110.docx", paragraphs: ["0"],
    form: { code: "D5110", reconstruction: true, unresolvedTokens: ["approved_monthly_income"] },
  }] });
  assert.ok(report.documents[0].reasons.includes("unresolved_markers_present"));
  assert.equal(report.readyForElectronicFiling, false);
});
