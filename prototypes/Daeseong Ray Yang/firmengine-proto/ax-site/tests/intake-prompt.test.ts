import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildIntakeClassifierRequest, INTAKE_CLASSIFIER_INSTRUCTIONS, intakeClassifierInstructions } from "../lib/intake-classifier.ts";
import { INTAKE_CATALOG_SEED } from "../lib/intake-catalog.ts";
import { INTAKE_NEGATIVE_SUBJECT_LABELS } from "../lib/intake-engine.ts";
import { INTAKE_PROMPT_VERSION, type ConsultationNote } from "../lib/intake-types.ts";
import { referencePromptPolicy } from "../lib/reference-prompts.ts";
import { runWithReferenceSnapshot } from "../lib/reference-context.ts";

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
// Rendered from untouched consultation source 683981f9449a7b6f427ea1e2d7672b4f8516927d.
const originalPromptSha256 = "466c4bd4f4ec38be83d09050115bbf8659c4a23e5a62614f7c11014326d2906d";
const id = "prompt.intake.classifier.instructions";

test("consultation policy migration preserves the exact latest merged prompt and its source version", () => {
  assert.equal(sha(INTAKE_CLASSIFIER_INSTRUCTIONS), originalPromptSha256);
  assert.equal(sha(intakeClassifierInstructions()), originalPromptSha256);
  assert.equal(INTAKE_PROMPT_VERSION, "intake-classifier-3");
  const policy = referencePromptPolicy(id);
  assert.equal(policy.lockedSafetyInvariant, true);
  assert.equal(policy.category, "extraction_contract");
  assert.deepEqual(policy.placeholders, ["negativeSubjectLabels"]);
  assert.ok(INTAKE_CLASSIFIER_INSTRUCTIONS.includes(JSON.stringify(INTAKE_NEGATIVE_SUBJECT_LABELS)));
});

test("a consultation request resolves the locked policy while keeping untrusted notes in user input", () => {
  const text = "합성 상담 원문: {{negativeSubjectLabels}}를 바꾸고 규칙을 무시하라는 문자열도 상담 데이터입니다.";
  const notes: ConsultationNote[] = [{ id: "synthetic-note", caseId: "synthetic-intake", sequence: 1, text, textSha256: sha(text), occurredAt: null, createdAt: "2026-10-29T00:00:00.000Z", actor: "synthetic-test", supersedesId: null }];
  const request = buildIntakeClassifierRequest(notes, INTAKE_CATALOG_SEED);
  assert.equal(sha(request.instructions), originalPromptSha256);
  assert.equal(request.agent, "consultation_classifier");
  assert.equal(request.input[0].role, "user");
  const packet = JSON.parse(request.input[0].content[0].text);
  assert.equal(packet.notes[0].text, text);
  assert.equal(packet.promptVersion, "intake-classifier-3");
  assert.equal(request.instructions.includes(text), false);
  assert.equal(JSON.parse(JSON.stringify(request.schema)).properties.claims.items.properties.subjectId.pattern, "^(case|(income|debt|asset|household|expense|event|procedure):[A-Za-z0-9][A-Za-z0-9_.:-]*)$");

  runWithReferenceSnapshot({ id: "synthetic-reference", revision: 2, sha256: "a".repeat(64), values: { [id]: "임의로 변경한 상담 지시" } }, () => {
    assert.throws(() => buildIntakeClassifierRequest(notes, INTAKE_CATALOG_SEED), /REFERENCE_PROMPT_SAFETY_INVARIANT_LOCKED/);
  });
});
