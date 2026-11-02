import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { INTAKE_CATALOG_SEED } from "../lib/intake-catalog.ts";
import { validateIntakeClaims } from "../lib/intake-engine.ts";
import type { ConsultationNote, IntakeState } from "../lib/intake-types.ts";

// Only artificial words and identifiers. This test never imports customer evidence.
const sentence = "가상 신청인의 소득자료를 상담했습니다.";
const note: ConsultationNote = {
  id: "synthetic-note", caseId: "synthetic-case", sequence: 1,
  text: sentence, textSha256: createHash("sha256").update(sentence).digest("hex"),
  occurredAt: "2026-11-03", createdAt: "2026-11-03T00:00:00Z",
  actor: "synthetic-fixture", supersedesId: null,
};
const feature = INTAKE_CATALOG_SEED.features.find(item => item.scope === "income");
assert.ok(feature, "A synthetic income feature must be available in the catalog");

function validateSubject(subjectId: string, state: IntakeState = "present") {
  return validateIntakeClaims({ claims: [{
    featureId: feature!.id, subjectId, subjectLabel: "합성 소득원",
    state, temporal: "current", refs: [{ noteId: note.id, quote: sentence }],
  }] }, [note], INTAKE_CATALOG_SEED);
}

test("schema-compatible consultation subject IDs remain distinguishable", () => {
  for (const id of ["income:wage1", "income:loan.12-5", "income:a_b:c"]) {
    assert.equal(validateSubject(id)[0].subjectId, id);
  }
  assert.equal(validateSubject("income:none", "absent")[0].subjectId, "income:none");
  assert.equal(validateSubject("scope:none", "absent")[0].subjectId, "income:none");
});

test("server rejects subject IDs excluded by the classifier output schema", () => {
  for (const id of [
    "income:", "income:  ", "income:person A", "income:x/../y",
    "income:가족", "income:x\n", "income:" + "a".repeat(121),
    "asset:car",
  ]) {
    assert.throws(() => validateSubject(id), /INTAKE_SUBJECT_SCOPE_MISMATCH/, JSON.stringify(id));
  }
});

test("a positive claim cannot use the explicit negative subject", () => {
  assert.throws(() => validateSubject("income:none"), /INTAKE_NEGATIVE_SUBJECT_PRESENT/);
});
