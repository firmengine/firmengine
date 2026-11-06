import test from "node:test";
import assert from "node:assert/strict";
import { deriveRequirementStatus, type DocumentMatch } from "../lib/document-fulfillment.ts";
import type { CaseRequirement } from "../lib/case-requirements.ts";
import type { SubjectLink } from "../lib/party-identity.ts";

// Synthetic identifiers and periods only; does not exercise a court decision or real files.
const link = {
  linkId: "link-synthetic",
  status: "confirmed",
  version: 1,
  typedEntityId: "income-synthetic",
} as SubjectLink;

async function fulfillment(
  periods: Array<[string, string]>,
  requiredPeriod = "2026-01~2026-12",
) {
  const requirement = {
    requirementId: "req-synthetic",
    requiredPeriod,
    requiredFieldGroups: [["synthetic.monthly_income"]],
    noRequiredFieldsApproved: false,
    alternatives: [],
    mappingRequired: false,
    retired: false,
    waivedByReview: false,
    notApplicableConfirmed: false,
    staffDisposition: null,
  } as unknown as CaseRequirement;
  const matches: DocumentMatch[] = periods.map(([start, end], index) => ({
    matchId: `match-${index}`,
    requirementId: requirement.requirementId,
    subjectLinkId: link.linkId,
    documentId: `doc-${index}`,
    pageIds: [`doc-${index}:1`],
    coveredPeriod: {start, end},
    sourceDocumentHash: `sha-${index}`,
    state: "accepted",
    version: 2,
    reason: "synthetic verified-match assumption",
    staffReviewer: "staff-synthetic",
    dispositionFingerprint: null,
  }));
  return deriveRequirementStatus({
    requirement, matches, subjectLink: link,
    currentDocumentHashes: Object.fromEntries(matches.map(m => [m.documentId, m.sourceDocumentHash])),
    requiredFieldGroupsMet: true,
    applicability: "confirmed",
    staffConfirmationRequired: true,
    legalReview: false,
  });
}

test("a complete twelve-month document from the wrong calendar year remains partial", async () => {
  const result = await fulfillment([["2025-01", "2025-12"]]);
  assert.equal(result.engineFulfillment, "partial");
  assert.equal(result.requirementStatus, "partial");
  assert.equal(result.staffDisposition, "unreviewed");
});

test("old full year plus six months of requested year does not complete a dated request", async () => {
  const result = await fulfillment([["2025-01", "2025-12"], ["2026-01", "2026-06"]]);
  assert.equal(result.engineFulfillment, "partial");
});

test("a full twelve-month future period does not satisfy a past dated request", async () => {
  const result = await fulfillment([["2027-01", "2027-12"]]);
  assert.equal(result.engineFulfillment, "partial");
});

test("two disjoint accepted documents together cover the requested twelve months", async () => {
  const result = await fulfillment([["2026-01", "2026-06"], ["2026-07", "2026-12"]]);
  assert.equal(result.engineFulfillment, "complete");
  assert.equal(result.requirementStatus, "eligible_for_confirmation");
  assert.equal(result.staffDisposition, "unreviewed");
});

test("an unanchored 12 months requirement retains the existing count-only behavior", async () => {
  const result = await fulfillment([["2025-01", "2025-12"]], "12 months");
  assert.equal(result.engineFulfillment, "complete");
  assert.equal(result.requirementStatus, "eligible_for_confirmation");
});

test("a missing month within an explicit required range remains partial", async () => {
  const result = await fulfillment([["2026-01", "2026-05"], ["2026-07", "2026-12"]]);
  assert.equal(result.engineFulfillment, "partial");
});
