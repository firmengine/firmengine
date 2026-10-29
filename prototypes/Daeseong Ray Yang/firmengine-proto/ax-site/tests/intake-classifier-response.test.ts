import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { adaptIntakeClassifierResponse } from "../lib/intake-classifier-response.ts";
import { INTAKE_CATALOG_SEED } from "../lib/intake-catalog.ts";
import { validateIntakeClaims } from "../lib/intake-engine.ts";
import { resolveIntakeSourceSpanRefs, buildIntakeSourceSpans } from "../lib/intake-source-spans.ts";
import type { ConsultationNote } from "../lib/intake-types.ts";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
function fixture(text = "제 명의 차량을 소유하고 있고 자동차 보험도 가입했습니다."): { note: ConsultationNote; spans: ReturnType<typeof buildIntakeSourceSpans> } {
  const note: ConsultationNote = { id: "note-synthetic-1", caseId: "case-synthetic-1", sequence: 1, text, textSha256: hash(text), occurredAt: null, createdAt: "2026-10-29T00:00:00.000Z", actor: "synthetic-test", supersedesId: null };
  return { note, spans: buildIntakeSourceSpans([note]) };
}

test("nested subject claims flatten to validated claims with exact label and quote", () => {
  const { note, spans } = fixture(), span = spans[0];
  const response = { subjects: [{ subjectId: "asset:vehicle-1", subjectLabel: "신청인 차량", claims: [
    { featureId: "asset.vehicle_owned", state: "present", temporal: "current", refs: [{ sourceSpanId: span.id }] },
    { featureId: "asset.insurance", state: "present", temporal: "current", refs: [{ sourceSpanId: span.id }] },
  ] }], reviewedSourceSpanIds: [span.id] };
  const adapted = adaptIntakeClassifierResponse(response, spans, INTAKE_CATALOG_SEED);
  const claims = validateIntakeClaims(resolveIntakeSourceSpanRefs({ claims: adapted.claims }, [note]), [note], INTAKE_CATALOG_SEED);
  assert.equal(claims.length, 2);
  assert.ok(claims.every(claim => claim.subjectLabel === "신청인 차량"));
  assert.ok(claims.every(claim => claim.refs[0].quote === note.text));
});

test("empty nested subjects are retained in receipt without becoming claims", () => {
  const { spans } = fixture("상담사는 예약 일정을 설명했습니다.");
  const adapted = adaptIntakeClassifierResponse({ subjects: [{ subjectId: "debt:possible", subjectLabel: "확인할 수 있는 채무", claims: [] }], reviewedSourceSpanIds: [spans[0].id] }, spans, INTAKE_CATALOG_SEED);
  assert.deepEqual(adapted.claims, []);
  assert.deepEqual(adapted.classifierReceipt.unreferencedSubjectIds, ["debt:possible"]);
  assert.deepEqual(adapted.classifierReceipt.sourceSpanCoverage, { [spans[0].id]: [] });
});

test("case-scoped subjects require the fixed case ID and canonical label", () => {
  const { spans } = fixture(), span = spans[0], caseFeature = INTAKE_CATALOG_SEED.features.find(feature => feature.scope === "case")!.id;
  const subject = { subjectId: "case", subjectLabel: "신청인(사건 공통)", claims: [{ featureId: caseFeature, state: "present", temporal: "current", refs: [{ sourceSpanId: span.id }] }] };
  const adapted = adaptIntakeClassifierResponse({ subjects: [subject], reviewedSourceSpanIds: [span.id] }, spans, INTAKE_CATALOG_SEED);
  assert.equal(adapted.claims.length, 1);
  assert.throws(() => adaptIntakeClassifierResponse({ subjects: [{ ...subject, subjectLabel: "임의 사건" }], reviewedSourceSpanIds: [span.id] }, spans, INTAKE_CATALOG_SEED), /INTAKE_INVALID_CLASSIFIER_SUBJECT_LABEL/);
});

test("review acknowledgement requires each exact source span and server derives per-span feature coverage", () => {
  const { spans } = fixture("첫 문장입니다. 두 번째 문장입니다.");
  assert.equal(spans.length, 2);
  const base = { subjects: [{ subjectId: "asset:car", subjectLabel: "차량", claims: [{ featureId: "asset.vehicle_owned", state: "present", temporal: "current", refs: [{ sourceSpanId: spans[0].id }] }] }] };
  assert.throws(() => adaptIntakeClassifierResponse({ ...base, reviewedSourceSpanIds: [spans[0].id] }, spans, INTAKE_CATALOG_SEED), /INTAKE_CLASSIFIER_SPAN_REVIEW_MISMATCH/);
  assert.throws(() => adaptIntakeClassifierResponse({ ...base, reviewedSourceSpanIds: [spans[0].id, spans[0].id] }, spans, INTAKE_CATALOG_SEED), /INTAKE_DUPLICATE_SOURCE_SPAN_REVIEW/);
  assert.throws(() => adaptIntakeClassifierResponse({ ...base, reviewedSourceSpanIds: [spans[0].id, "span:999:0:1"] }, spans, INTAKE_CATALOG_SEED), /INTAKE_UNKNOWN_SOURCE_SPAN/);
  const adapted = adaptIntakeClassifierResponse({ ...base, reviewedSourceSpanIds: spans.map(span => span.id) }, spans, INTAKE_CATALOG_SEED);
  assert.deepEqual(adapted.classifierReceipt.sourceSpanCoverage, { [spans[0].id]: ["asset.vehicle_owned"], [spans[1].id]: [] });
});

test("cross-scope nesting, duplicate declarations, foreign refs, and claim overflow reject the whole response", () => {
  const { spans } = fixture(), span = spans[0], reviewedSourceSpanIds = [span.id];
  const validSubject = { subjectId: "asset:car", subjectLabel: "차량", claims: [{ featureId: "asset.vehicle_owned", state: "present", temporal: "current", refs: [{ sourceSpanId: span.id }] }] };
  const debtFeature = INTAKE_CATALOG_SEED.features.find(feature => feature.scope === "debt")!.id;
  assert.throws(() => adaptIntakeClassifierResponse({ subjects: [{ ...validSubject, claims: [{ ...validSubject.claims[0], featureId: debtFeature }] }], reviewedSourceSpanIds }, spans, INTAKE_CATALOG_SEED), /INTAKE_SUBJECT_SCOPE_MISMATCH/);
  assert.throws(() => adaptIntakeClassifierResponse({ subjects: [validSubject, validSubject], reviewedSourceSpanIds }, spans, INTAKE_CATALOG_SEED), /INTAKE_DUPLICATE_CLASSIFIER_SUBJECT/);
  assert.throws(() => adaptIntakeClassifierResponse({ subjects: [{ ...validSubject, claims: [{ ...validSubject.claims[0], refs: [{ sourceSpanId: "span:999:0:1" }] }] }], reviewedSourceSpanIds }, spans, INTAKE_CATALOG_SEED), /INTAKE_UNKNOWN_SOURCE_SPAN/);
  const repeatedClaims = Array.from({ length: 151 }, () => validSubject.claims[0]);
  const acrossGroups = [0, 1].map(index => ({ subjectId: `asset:car-${index}`, subjectLabel: "차량", claims: repeatedClaims }));
  assert.throws(() => adaptIntakeClassifierResponse({ subjects: acrossGroups, reviewedSourceSpanIds }, spans, INTAKE_CATALOG_SEED), /total claims limit/);
});
