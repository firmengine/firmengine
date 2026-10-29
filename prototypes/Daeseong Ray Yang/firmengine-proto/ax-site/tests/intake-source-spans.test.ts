import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { ConsultationNote } from "../lib/intake-types.ts";
import { buildIntakeSourceSpans, INTAKE_SOURCE_SPAN_MAX_CHARS, INTAKE_SOURCE_SPAN_MAX_COUNT, resolveIntakeSourceSpanRefs } from "../lib/intake-source-spans.ts";

function note(text: string, id = "note-1", sequence = 1, supersedesId: string | null = null): ConsultationNote {
  return { id, caseId: "synthetic-case", sequence, text, textSha256: createHash("sha256").update(text).digest("hex"), occurredAt: null, createdAt: "2026-10-29T00:00:00.000Z", actor: "synthetic-test", supersedesId };
}

test("spans preserve every whitespace, punctuation mark, digit, and UTF-16 source range", () => {
  const text = "A  12,500원입니다.\r\n\t다음 문장!🙂\n끝.";
  const spans = buildIntakeSourceSpans([note(text)]);
  assert.equal(spans.map(span => span.text).join(""), text);
  assert.equal(spans[0].start, 0);
  assert.equal(spans.at(-1)?.end, text.length);
  for (const span of spans) assert.equal(text.slice(span.start, span.end), span.text);
});

test("a repeated sentence span resolves to unique exact surrounding source context", () => {
  const text = "첫 진술입니다. 차량이 있습니다. 두 번째 진술입니다. 차량이 있습니다. 마지막입니다.";
  const source = note(text), span = buildIntakeSourceSpans([source]).find(item => item.text === "차량이 있습니다. ")!;
  const resolved = resolveIntakeSourceSpanRefs({ claims: [{ featureId: "asset.vehicle_owned", refs: [{ sourceSpanId: span.id }] }] }, [source]) as { claims: { refs: { noteId: string; quote: string }[] }[] };
  const quote = resolved.claims[0].refs[0].quote;
  assert.equal(quote, text);
  assert.equal(source.text.indexOf(quote), 0);
  assert.equal(source.text.indexOf(quote, 1), -1);
});

test("short dialogue notes split at each sentence/line and label-only spans attach to the utterance", () => {
  const text = "상담사:\n현재 급여는 월 250만 원입니다.\n의뢰인:\n보험 환급금은 잘 모릅니다. 차량은 없습니다.";
  const spans = buildIntakeSourceSpans([note(text)]);
  assert.ok(spans.length >= 3);
  assert.equal(spans.map(span => span.text).join(""), text);
  assert.ok(!spans.some(span => /^(?:상담사|의뢰인):\s*$/u.test(span.text.trim())));
  assert.ok(spans.some(span => span.text.includes("250만 원")));
  assert.ok(spans.some(span => span.text.includes("환급금")));
});

test("superseded notes never produce spans or resolve as evidence", () => {
  const old = note("이전에는 차량이 있다고 했습니다.", "note-1", 1);
  const correction = note("정정합니다. 제 차량은 없습니다.", "note-2", 2, old.id);
  const spans = buildIntakeSourceSpans([old, correction]);
  assert.ok(spans.length > 0);
  assert.ok(spans.every(span => span.noteId === correction.id));
  assert.throws(() => resolveIntakeSourceSpanRefs({ claims: [{ refs: [{ sourceSpanId: "span:1:0:16" }] }] }, [old, correction]), /INTAKE_UNKNOWN_SOURCE_SPAN/);
});

test("long active notes are fully covered without any span exceeding the bounded unit size", () => {
  const text = Array.from({ length: 400 }, (_, index) => `항목 ${index + 1}: 금액 123,456원입니다.\n`).join("");
  const spans = buildIntakeSourceSpans([note(text)]);
  assert.ok(spans.length > 1);
  assert.ok(spans.every(span => span.text.length <= INTAKE_SOURCE_SPAN_MAX_CHARS));
  assert.equal(spans.map(span => span.text).join(""), text);
  assert.equal(spans[0].start, 0);
  assert.equal(spans.at(-1)?.end, text.length);
});

test("pathological punctuation is coalesced to a bounded span enum without losing source text", () => {
  const text = Array.from({ length: 1_200 }, (_, index) => `사실${index}. `).join("");
  const spans = buildIntakeSourceSpans([note(text)]);
  assert.ok(spans.length <= INTAKE_SOURCE_SPAN_MAX_COUNT);
  assert.ok(spans.every(span => span.text.length <= INTAKE_SOURCE_SPAN_MAX_CHARS));
  assert.equal(spans.map(span => span.text).join(""), text);
});

test("expanded exact quotes never exceed the 4,000-character evidence bound", () => {
  const repeated = `${"A".repeat(1_400)} 동일한 진술입니다.\n`;
  const text = `서문.\n${repeated}${repeated}${repeated}마지막 구별 문장입니다.`;
  const source = note(text), spans = buildIntakeSourceSpans([source]);
  const repeatedSpan = spans.find(span => span.text === repeated)!;
  assert.ok(repeatedSpan);
  const resolved = resolveIntakeSourceSpanRefs({ claims: [{ refs: [{ sourceSpanId: repeatedSpan.id }] }] }, [source]) as { claims: { refs: { quote: string }[] }[] };
  const quote = resolved.claims[0].refs[0].quote;
  assert.ok(quote.length <= 4_000);
  assert.equal(source.text.indexOf(quote, source.text.indexOf(quote) + 1), -1);
});

test("a surrogate pair at the left context edge cannot produce a 4,001-character quote", () => {
  const repeatedUnit = `${"A".repeat(1_498)}!\n`;
  const firstUnit = `${"A".repeat(249)}🙂${"A".repeat(1_247)}!\n`;
  const source = note(`${"P".repeat(250)}${firstUnit}${repeatedUnit}${repeatedUnit}${repeatedUnit}`);
  const span = buildIntakeSourceSpans([source]).find(item => item.text === repeatedUnit)!;
  assert.ok(span);
  // The first unique context would need to cross the emoji boundary by one code unit;
  // a 4,000-character quote cannot prove uniqueness, so resolution must fail closed.
  assert.throws(() => resolveIntakeSourceSpanRefs({ claims: [{ refs: [{ sourceSpanId: span.id }] }] }, [source]), /INTAKE_AMBIGUOUS_SOURCE_SPAN/);
});
