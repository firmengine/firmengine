import test from "node:test";
import assert from "node:assert/strict";
import {
  createCase,
  currentExportReviews,
  manifestFingerprint,
  manifestIssues,
  REQUIRED_ARTIFACT_KINDS,
  reviewExport,
  type ArtifactKind,
} from "../lib/domain.ts";
import { newExportManifest } from "../lib/exports.ts";

/** Synthetic identifiers only; no person or court decision is modeled. */
function reviewFixture() {
  const data = createCase("Synthetic two-person review", "audit-independent-actors", "2026-10-30");
  const kinds: ArtifactKind[] = [
    ...REQUIRED_ARTIFACT_KINDS, "repayment_schedule", "bank_accounts", "leases",
  ];
  const files = [...new Set(kinds)].map((kind) => ({
    id: kind, kind, name: kind + ".docx", hash: "synthetic-sha-" + kind, status: "current" as const,
  }));
  data.exportManifest = newExportManifest(data.context.revision, files, data, "final");
  assert.deepEqual(manifestIssues(data), [], "the synthetic final manifest must be complete");
  return data;
}

test("the final lawyer document reviewer must differ from the original caseworker", () => {
  const base = reviewFixture();
  const fingerprint = manifestFingerprint(base.exportManifest!);
  const staff = reviewExport(base, "caseworker", "reviewer-with-both-grants", fingerprint);
  assert.throws(
    () => reviewExport(staff, "lawyer", "reviewer-with-both-grants", fingerprint),
    /서로 다른 사람/,
  );
  assert.equal(staff.exportManifest!.reviews.lawyer, null, "a blocked review must not edit the case");
  const lawyer = reviewExport(staff, "lawyer", "independent-lawyer", fingerprint);
  assert.equal(currentExportReviews(lawyer).lawyer?.actor, "independent-lawyer");
});

test("legacy two-role approvals recorded under the same actor are not current lawyer approval", () => {
  const base = reviewFixture();
  const fingerprint = manifestFingerprint(base.exportManifest!);
  const staff = reviewExport(base, "caseworker", "staff-one", fingerprint);
  const signed = reviewExport(staff, "lawyer", "lawyer-two", fingerprint);
  const legacy = structuredClone(signed);
  legacy.exportManifest!.reviews.lawyer!.actor = "staff-one";
  assert.ok(legacy.exportManifest!.reviews.lawyer, "historical receipt remains unchanged");
  assert.equal(currentExportReviews(legacy).caseworker?.actor, "staff-one");
  assert.equal(currentExportReviews(legacy).lawyer, null, "same-person approval must not be current");
  assert.equal(currentExportReviews(signed).lawyer?.actor, "lawyer-two");
});

test("stale or draft reviews still do not become current after reviewer separation", () => {
  const base = reviewFixture();
  const fingerprint = manifestFingerprint(base.exportManifest!);
  assert.throws(() => reviewExport(base, "lawyer", "lawyer-two", fingerprint), /담당자 검수/);
  const staff = reviewExport(base, "caseworker", "staff-one", fingerprint);
  assert.throws(() => reviewExport(staff, "lawyer", "lawyer-two", "stale-hash"), /생성물 집합이 변경/);
  const signed = reviewExport(staff, "lawyer", "lawyer-two", fingerprint);
  const reReviewed = reviewExport(signed, "caseworker", "staff-one", fingerprint);
  assert.equal(currentExportReviews(reReviewed).lawyer, null);
  const draft = reviewFixture();
  draft.exportManifest!.mode = "draft";
  assert.throws(
    () => reviewExport(draft, "caseworker", "staff-one", manifestFingerprint(draft.exportManifest!)),
    /최종 검토본/,
  );
});
