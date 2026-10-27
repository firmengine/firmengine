import test from "node:test";
import assert from "node:assert/strict";
import { canRetryEvidencePage } from "../lib/retry-page-policy.ts";

test("실제 이미지 판독으로 초기 유형 힌트가 바뀐 증빙을 재판독할 수 있다", () => {
  assert.equal(canRetryEvidencePage(
    {role:"evidence",document_type:"debt_certificate"},
    {role:"evidence",documentType:"credit_report"}, "evidence"), true);
  assert.equal(canRetryEvidencePage(
    {role:"evidence",document_type:"debt_certificate"},
    {role:"evidence",documentType:"health_insurance_arrears"}, "unknown"), true);
});

test("문서 유형이 같아도 제출본·행정자료·미확정 역할과 분리된 정답 원본은 재판독하지 않는다", () => {
  for (const role of ["filed_form","administrative","unknown"]) {
    assert.equal(canRetryEvidencePage({role,document_type:"debt_certificate"},{role:"evidence",documentType:"debt_certificate"},"evidence"),false);
    assert.equal(canRetryEvidencePage({role:"evidence"},{role},"evidence"),false);
  }
  for (const role of ["filed_form","administrative"]) assert.equal(canRetryEvidencePage({role:"evidence"},{role:"evidence"},role),false);
  assert.equal(canRetryEvidencePage({role:"evidence"},undefined,"evidence"),false);
});
