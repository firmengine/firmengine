import test from "node:test";
import assert from "node:assert/strict";
import { assessDocumentFilingReadiness } from "../lib/document-filing-readiness.ts";

const consistentD5110 = {
  kind: "repayment_plan",
  name: "05_repayment_plan.docx",
  title: "변제계획안",
  form: {
    code: "D5110",
    reconstruction: true,
    approvalStatus: "reviewer_pending",
    unresolvedTokens: [],
  },
  tables: [{
    title: "기본 가용소득 산식",
    headers: ["① 월평균 수입", "② 월평균 생계비", "③ 가용소득", "④ 월 회생위원 보수", "⑤ 실제 가용소득", "⑥ 변제횟수", "⑦ 총 실제 가용소득"],
    rows: [["800,000", "1,500,000", "-700,000", "0", "-700,000", "12", "-8,400,000"]],
  }],
};

test("arithmetic consistency is reported separately from reconstructed e-form readiness", () => {
  const report = assessDocumentFilingReadiness({ mode: "draft", documents: [consistentD5110] });
  const [plan] = report.documents;
  assert.equal(plan.formulaStatus, "consistent_negative_shortfall");
  assert.equal(plan.eformCode, "D5110");
  assert.equal(plan.officialParity, "not_verified");
  assert.equal(plan.readyForElectronicFiling, false);
  assert.ok(plan.reasons.includes("official_layout_reconstructed_unverified"));
  assert.equal(report.readyForElectronicFiling, false);
});

test("negative shortfall is distinct from an inconsistent calculation", () => {
  const inconsistent = structuredClone(consistentD5110);
  inconsistent.tables[0].rows[0][2] = "-699,999";
  const report = assessDocumentFilingReadiness({ mode: "draft", documents: [inconsistent] });
  assert.equal(report.documents[0].formulaStatus, "inconsistent");
  assert.equal(report.documents[0].readyForElectronicFiling, false);
});

test("missing D5110 arithmetic table stays unknown and final mode cannot override readiness", () => {
  const report = assessDocumentFilingReadiness({
    mode: "final",
    documents: [{
      kind: "repayment_plan",
      name: "05_repayment_plan.docx",
      form: { code: "D5110", reconstruction: true, unresolvedTokens: [] },
      tables: [],
    }],
  });
  assert.equal(report.documents[0].formulaStatus, "unknown");
  assert.equal(report.documents[0].readyForElectronicFiling, false);
  assert.equal(report.mode, "final");
  assert.equal(report.readyForElectronicFiling, false);
});

test("unresolved markers and internal appendices are reported per document", () => {
  const report = assessDocumentFilingReadiness({ mode: "final", documents: [
    { kind: "repayment_schedule", name: "12_repayment_schedule.docx", title: "변제계획 제안 회차표 (자동 계산·승인 전)", paragraphs: ["EXPLICIT_ALLOCATION_BASIS_REQUIRED"] },
    { kind: "repayment_plan", name: "05_repayment_plan.docx", title: "변제계획안", paragraphs: ["계산 및 원문 근거 검토 부록", "월 변제예정액 [확인 필요]"], form: { code: "D5110", reconstruction: true } },
  ] });
  assert.ok(report.documents[0].reasons.includes("generated_schedule_without_official_template"));
  assert.ok(report.documents[0].reasons.includes("unresolved_markers_present"));
  assert.ok(report.documents[1].reasons.includes("internal_review_content_present"));
  assert.ok(report.documents[1].reasons.includes("unresolved_markers_present"));
  assert.equal(report.readyForElectronicFiling, false);
});
