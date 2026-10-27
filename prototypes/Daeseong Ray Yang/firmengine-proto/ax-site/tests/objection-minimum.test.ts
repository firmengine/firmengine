import test from "node:test";
import assert from "node:assert/strict";
import { evaluateObjectionMinimum, OBJECTION_MINIMUM_RULE_VERSION, type ObjectionMinimumInput } from "../lib/objection-minimum.ts";

const evidence = (amountWon: string | null, factId: string, sourceVerified = true, legallyAccepted = true) => ({ amountWon, factIds: [factId], sourceVerified, legallyAccepted });
function input(claimWon: string, planWon = "30000000"): ObjectionMinimumInput {
  return { asOf: "2026-10-02", ruleVersion: OBJECTION_MINIMUM_RULE_VERSION, courtObjection: "yes", conditionFactIds: ["approval-date", "objection"], claimTotalPresentValue: evidence(claimWon, "claims-pv"), planPresentValue: evidence(planWon, "plan-pv") };
}

test("§614 threshold changes at 50m and keeps exact fractions separate from display ceiling", () => {
  const below50 = evaluateObjectionMinimum(input("49999999", "2499999"));
  assert.equal(below50.status, "comparison");
  if (below50.status !== "comparison") return;
  assert.equal(below50.minimumExact.numeratorWon, "249999995");
  assert.equal(below50.minimumExact.denominator, "100");
  assert.equal(below50.minimumExact.ceilingWholeWon, "2500000");
  assert.equal(below50.comparison, "below_minimum");

  const at50 = evaluateObjectionMinimum(input("50000000", "2500000"));
  assert.equal(at50.status, "comparison");
  if (at50.status !== "comparison") return;
  assert.equal(at50.minimumExact.numeratorWon, "250000000");
  assert.equal(at50.minimumExact.denominator, "100");
  assert.equal(at50.comparison, "meets_minimum");
  assert.equal(at50.claimTotalPresentValueWon, "50000000");
  assert.equal(at50.planPresentValueWon, "2500000");
});

test("three percent plus one million and thirty million cap are exact", () => {
  const above50 = evaluateObjectionMinimum(input("50000001", "2500001"));
  assert.equal(above50.status, "comparison");
  if (above50.status !== "comparison") return;
  assert.equal(above50.minimumExact.numeratorWon, "250000003");
  assert.equal(above50.minimumExact.ceilingWholeWon, "2500001");
  assert.equal(above50.minimumExact.capApplied, false);

  const capped = evaluateObjectionMinimum(input("1000000000", "30000000"));
  assert.equal(capped.status, "comparison");
  if (capped.status !== "comparison") return;
  assert.equal(capped.minimumExact.numeratorWon, "3000000000");
  assert.equal(capped.minimumExact.denominator, "100");
  assert.equal(capped.minimumExact.ceilingWholeWon, "30000000");
  assert.equal(capped.minimumExact.capApplied, true);
});

test("no objection is not applicable; unknown objection, missing evidence or stale version is never zero", () => {
  assert.equal(evaluateObjectionMinimum({ ...input("0"), courtObjection: "no" }).status, "not_applicable");
  assert.equal(evaluateObjectionMinimum({ ...input("0"), courtObjection: "unknown" }).status, "unknown");
  assert.equal(evaluateObjectionMinimum({ ...input("0"), claimTotalPresentValue: null }).status, "unknown");
  assert.equal(evaluateObjectionMinimum({ ...input("0"), claimTotalPresentValue: evidence(null, "missing-claim") }).status, "unknown");
  assert.equal(evaluateObjectionMinimum({ ...input("0"), claimTotalPresentValue: evidence("0", "unaccepted-claim", true, false) }).status, "unknown");
  assert.equal(evaluateObjectionMinimum({ ...input("0"), conditionFactIds: [] }).status, "unknown");
  assert.equal(evaluateObjectionMinimum({ ...input("0"), ruleVersion: "older" }).status, "unsupported_version");
  assert.equal(evaluateObjectionMinimum({ ...input("0"), asOf: "2026-10-01" }).status, "unsupported_version");
  assert.equal(evaluateObjectionMinimum({ ...input("0"), asOf: null }).status, "unknown");
});
