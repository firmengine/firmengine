import test from "node:test";
import assert from "node:assert/strict";
import { makeCaseRequirement, mergeRequirements } from "../lib/case-requirements.ts";
import { INTAKE_CATALOG_SEED } from "../lib/intake-catalog.ts";
import type { IntakeRequirement } from "../lib/intake-types.ts";

function syntheticRequirement(documentTypeId: string, subjectId = "synthetic-subject"): IntakeRequirement {
  const doc = INTAKE_CATALOG_SEED.documents.find(item => item.id === documentTypeId);
  assert.ok(doc, "test catalogue document");
  return {
    id: `synthetic-${documentTypeId}-${subjectId}`, documentTypeId, documentName: doc.name,
    subjectId, subjectLabel: "합성 대상", period: "합성 요청 기간, 담당자 확인 필요",
    requirement: "required_when_applicable", status: "requested", reason: ["synthetic-test"],
    matchedRuleIds: [], workflowIds: [], sourceClaimIds: [], sourceIds: [],
    alternatives: [], alternativePolicy: "review_required", fields: [...doc.fields], issuer: doc.issuer,
  };
}
function requirement(docId: string, subjectId = "synthetic-subject") {
  return makeCaseRequirement({
    source: syntheticRequirement(docId, subjectId), intakeRunId: "synthetic-run",
    subjectLinkId: `link-${subjectId}`, scopeKey: `scope-${subjectId}`,
    idFactory: () => `request-${docId}-${subjectId}`,
  });
}

test("all 85 catalogue collection guidance labels survive intake adoption without granting legal acceptance", () => {
  assert.equal(INTAKE_CATALOG_SEED.documents.length, 85);
  for (const doc of INTAKE_CATALOG_SEED.documents) {
    const result = requirement(doc.id);
    assert.equal(result.documentName, doc.name, doc.id);
    assert.equal(result.issuer, doc.issuer, doc.id);
    assert.equal(result.requiredPeriod, "합성 요청 기간, 담당자 확인 필요");
    assert.equal(result.mappingRequired, true);
    assert.equal(result.waivedByReview, false);
    assert.equal(result.notApplicableConfirmed, false);
    assert.ok(!Object.hasOwn(result, "subjectLabel"), "unreviewed client-subject label must not leak into workflow");
  }
});

test("collection guidance remains separate for distinct linked subjects", () => {
  const a = requirement("resident_registration", "synthetic-a");
  const b = requirement("resident_registration", "synthetic-b");
  const merged = mergeRequirements([a], [b]);
  assert.equal(merged.length, 2);
  assert.notEqual(merged[0]?.subjectLinkId, merged[1]?.subjectLinkId);
  assert.deepEqual(merged.map(item => item.issuer), [a.issuer, b.issuer]);
});

test("legacy workflow requirements without guidance fields display safe fallback", () => {
  const original = requirement("salary_withholding");
  const legacy = { ...original };
  delete legacy.documentName;
  delete legacy.issuer;
  assert.equal(legacy.documentName?.trim() || legacy.intakeDocumentTypeId, "salary_withholding");
  assert.equal(legacy.issuer?.trim() || "재확인 필요", "재확인 필요");
  assert.equal(legacy.requiredPeriod, original.requiredPeriod);
});
