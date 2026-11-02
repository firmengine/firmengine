import test from "node:test";
import assert from "node:assert/strict";
import { auditStoredCalculationStatusGate } from "../lib/preapproval-stored-status-gate.ts";

// Purely synthetic status rows. The gate is independent from source/replay validity.
const inspect = (...statuses: string[]) => auditStoredCalculationStatusGate({
  rows: statuses.map(status => ({status})), readComplete: true,
});

test("A2 r69: explicit zero and inapplicable rows are observed, never legally approved", () => {
  const result = inspect("computed", "not_applicable");
  assert.equal(result.reviewRequired, false);
  assert.equal(result.state, "no_unresolved_status_observed");
  assert.equal(result.counts.computed, 1);
  assert.equal(result.counts.not_applicable, 1);
  assert.equal(result.legalAcceptanceInferred, false);
  assert.equal(result.courtApprovalInferred, false);
});
test("A2 r69: blocked raw Won stays a separate blocking status even when replay-valid", () => {
  const result = inspect("computed", "blocked");
  assert.equal(result.reviewRequired, true);
  assert.equal(result.state, "stored_unresolved");
  assert.equal(result.counts.blocked, 1);
});
test("A2 r69: null represented as missing is not coerced to zero", () => {
  const result = inspect("missing");
  assert.equal(result.reviewRequired, true);
  assert.equal(result.counts.missing, 1);
  assert.equal(result.counts.computed, 0);
});
test("A2 r69: provisional amount cannot be mistaken for completed", () => {
  const result = inspect("provisional");
  assert.equal(result.reviewRequired, true);
  assert.equal(result.counts.provisional, 1);
});
test("A2 r69: conflicting explicit-zero sources are still conflicts", () => {
  const result = inspect("computed", "conflict");
  assert.equal(result.reviewRequired, true);
  assert.equal(result.counts.conflict, 1);
});
test("A2 r69: source-only is not an approved stored computation status", () => {
  const result = inspect("source-only");
  assert.equal(result.reviewRequired, true);
  assert.equal(result.counts.invalid, 1);
});
test("A2 r69: unobserved, zero-row or truncated reads never pass", () => {
  for (const input of [
    {rows: null, readComplete: false},
    {rows: [], readComplete: true},
    {rows: [{status:"computed"}], readComplete: false},
  ]) {
    const result = auditStoredCalculationStatusGate(input);
    assert.equal(result.state, "unobserved");
    assert.equal(result.reviewRequired, true);
    assert.equal(result.unresolvedCount, null);
  }
});
test("A2 r69: independent counts and no raw monetary/Fact data in diagnostics", () => {
  const result = inspect("computed", "blocked", "blocked", "missing", "provisional", "not_applicable");
  assert.deepEqual(result.counts, {
    computed:1, provisional:1, blocked:2, missing:1, conflict:0, not_applicable:1, invalid:0,
  });
  assert.equal(result.unresolvedCount, 4);
  assert.equal(JSON.stringify(result).includes("SYN-FACT"), false);
});

// Actual readiness builder integration regression: no mock of production builder.
import { buildPreApprovalReadiness } from "../lib/approval-readiness.ts";
function syntheticReadinessInput(storedStatus: ReturnType<typeof inspect>) {
  return {
    data: {context: {id:"SYN-CASE",revision:8},documents:[],workflowState:{procedureEvents:[]}},
    facts:[],
    assessment:{calculation:{traces:[],issues:[]},findings:[]},
    sourceHead:{caseRevision:8,sourceDataVersion:4,calculationRunId:"SYN-RUN",calculationCurrent:true,referenceSha256:"SYN-REF"},
    monitor:{consultationChecklistMaterialized:true,consultationStatus:"current",workflowAdopted:true,
      workflowProjectionStatus:"current",unclassifiedPageJobs:0,requirements:[],workflowRequests:[]},
    legalReview:{runId:"SYN-LEGAL",complete:true,headStale:false,caseRevision:8,currentDataVersion:4,
      dataVersion:4,calculationRunId:"SYN-RUN",expectedCheckIds:[],checks:[]},
    expectedRiskIds:[],storedFeatureReadiness:storedStatus,
  } as unknown as Parameters<typeof buildPreApprovalReadiness>[0];
}
test("A2 r69: replay-consistent blocked feature yields an urgent independent readiness task", () => {
  const clean=buildPreApprovalReadiness(syntheticReadinessInput(inspect("computed","not_applicable")));
  const blocked=buildPreApprovalReadiness(syntheticReadinessInput(inspect("computed","blocked")));
  assert.equal(clean.status,"lawyer_approval_review_pending");
  assert.equal(blocked.status,"supplement_or_recalculation_required");
  assert.equal(blocked.calculation.persistedCurrent,true);
  assert.equal(blocked.legalReview.current,true);
  assert.ok(blocked.tasks.some(x=>x.id==="calculation:stored-feature-status"&&x.priority==="urgent"));
  assert.equal(blocked.autoApproval,false);
  assert.equal(blocked.readyForElectronicFiling,false);
});
test("A2 r69: explicit missing/provisional remains distinct from zero and not applicable", () => {
  for (const status of ["missing","provisional","conflict","source-only"]) {
    const result=buildPreApprovalReadiness(syntheticReadinessInput(inspect("computed",status)));
    assert.equal(result.status,"supplement_or_recalculation_required",status);
    assert.ok(result.tasks.some(x=>x.id==="calculation:stored-feature-status"));
    assert.equal(result.autoApproval,false);
  }
});
