import test from "node:test";
import assert from "node:assert/strict";
import { createCase } from "../lib/domain.ts";
import { reduceCaseCommand } from "../lib/case-commands.ts";
import type { CaseCommand } from "../lib/case-command-contract.ts";

/** Synthetic source-free approval intent: not a court approval or a real customer. */
const fixture = () => createCase("Synthetic calculation decision", "audit-a1-r39-decision-independent", "2026-11-01");
const authority = (actor: string) => ({
  actor, roles: ["case_editor", "caseworker_review"], at: "2026-11-01T00:00:00.000Z",
});
const command = (commandType: "decision.propose" | "decision.adopt", target: Record<string, unknown>, patch: Record<string, unknown>): CaseCommand => ({
  commandId: "audit-r39-" + commandType.replace(".", "-"), commandType, payloadVersion: 1,
  expectedRevision: 1, expectedStateFingerprint: "case-state/1:" + "a".repeat(64),
  target, patch, reason: "Independent synthetic accounting review",
});
async function proposed() {
  return (await reduceCaseCommand(
    fixture(), command("decision.propose", { path: "planMonths" }, { value: 36 }), authority("staff-one"),
  )).data;
}
test("A1-LAW-015: proposer cannot adopt their own calculation decision, including case/space variants", async () => {
  const before = await proposed();
  const entry = before.workflowState!.decisions.at(-1)!;
  const adopt = command("decision.adopt", { proposalId: entry.id }, {});
  for (const actor of ["staff-one", " staff-one ", "STAFF-ONE"]) {
    await assert.rejects(
      reduceCaseCommand(before, adopt, authority(actor)),
      (error: unknown) => (error as { code?: string }).code === "INDEPENDENT_REVIEW_REQUIRED",
    );
  }
  assert.equal(before.workflowState!.decisions.at(-1)!.status, "proposed");
  assert.equal(before.context.planMonths, null);
});
test("A1-LAW-015: independent approver can adopt a fresh proposal without retroactively changing proposer", async () => {
  const before = await proposed();
  const entry = before.workflowState!.decisions.at(-1)!;
  const result = await reduceCaseCommand(
    before, command("decision.adopt", { proposalId: entry.id }, {}), authority("reviewer-two"),
  );
  assert.equal(result.data.workflowState!.decisions.at(-1)!.status, "adopted");
  assert.equal(result.data.workflowState!.decisions.at(-1)!.actor, "staff-one");
  assert.equal(result.data.context.planMonths, 36);
  assert.equal(before.workflowState!.decisions.at(-1)!.status, "proposed");
});
test("A1-LAW-015: a legacy proposal without a proposer is never silently accepted", async () => {
  const before = await proposed();
  before.workflowState!.decisions.at(-1)!.actor = "";
  await assert.rejects(
    reduceCaseCommand(before, command("decision.adopt", { proposalId: before.workflowState!.decisions.at(-1)!.id }, {}), authority("reviewer-two")),
    (error: unknown) => (error as { code?: string }).code === "INDEPENDENT_REVIEW_REQUIRED",
  );
});
test("A1-LAW-015: independent actor does not override stale basis or missing proposal", async () => {
  const before = await proposed();
  const entry = before.workflowState!.decisions.at(-1)!;
  const stale = structuredClone(before);
  stale.workflowState!.decisions.at(-1)!.baseFingerprint = "stale";
  await assert.rejects(
    reduceCaseCommand(stale, command("decision.adopt", { proposalId: entry.id }, {}), authority("reviewer-two")),
    (error: unknown) => (error as { code?: string }).code === "CASE_STATE_CONFLICT",
  );
  await assert.rejects(reduceCaseCommand(before, command("decision.adopt", { proposalId: "missing" }, {}), authority("reviewer-two")));
});
