import type { ConsultationNote } from "./intake-types.ts";

/** Small enough to leave room for exact surrounding context during server resolution. */
export const INTAKE_SOURCE_SPAN_MAX_CHARS = 1_800;
export const INTAKE_SOURCE_SPAN_MAX_COUNT = 512;
const QUOTE_MAX_CHARS = 4_000;
const MIN_MEANINGFUL_UNIT_CHARS = 20;

export interface IntakeSourceSpan {
  id: string;
  noteId: string;
  start: number;
  end: number;
  text: string;
}

function fail(code: string, detail: string): never { throw new Error(`${code}: ${detail}`); }
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function safeBoundary(text: string, offset: number): number {
  if (offset > 0 && offset < text.length) {
    const before = text.charCodeAt(offset - 1), after = text.charCodeAt(offset);
    if (before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff) return offset - 1;
  }
  return offset;
}
function naturalBoundaryEnd(text: string, index: number): number | null {
  const ch = text[index];
  if (ch === "\r") return index + (text[index + 1] === "\n" ? 2 : 1);
  if (ch === "\n") return index + 1;
  if (".!?。！？".includes(ch ?? "") && (index + 1 === text.length || /\s/u.test(text[index + 1]))) {
    let end = index + 1;
    while (text[end] === " " || text[end] === "\t") end++;
    return end;
  }
  return null;
}
function hardSplit(text: string, start: number, end: number): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  while (end - start > INTAKE_SOURCE_SPAN_MAX_CHARS) {
    const cap = safeBoundary(text, start + INTAKE_SOURCE_SPAN_MAX_CHARS);
    const lower = start + Math.floor((cap - start) * 0.55);
    let boundary = -1;
    for (let cursor = lower; cursor < cap; cursor++) {
      if (/\s/u.test(text[cursor])) boundary = cursor + 1;
    }
    let next = safeBoundary(text, boundary > start ? boundary : cap);
    const tailLength = end - next;
    if (tailLength > 0 && tailLength < MIN_MEANINGFUL_UNIT_CHARS) {
      const adjusted = safeBoundary(text, end - MIN_MEANINGFUL_UNIT_CHARS);
      if (adjusted > start && adjusted < next) next = adjusted;
    }
    if (next <= start) fail("INTAKE_SOURCE_SPAN_NO_PROGRESS", `${start}:${end}`);
    ranges.push({ start, end: next });
    start = next;
  }
  if (start < end) ranges.push({ start, end });
  return ranges;
}
function isShortUnit(text: string): boolean {
  const trimmed = text.trim();
  return !trimmed || /^(?:상담사|의뢰인|신청인|고객|상담원)\s*:\s*$/u.test(trimmed);
}
function mergeShortUnits(text: string, ranges: { start: number; end: number }[]): { start: number; end: number }[] {
  const result: { start: number; end: number }[] = [];
  for (let index = 0; index < ranges.length; index++) {
    const current = ranges[index];
    if (!isShortUnit(text.slice(current.start, current.end))) { result.push(current); continue; }
    const previous = result.at(-1);
    const next = ranges[index + 1];
    if (previous && current.end - previous.start <= INTAKE_SOURCE_SPAN_MAX_CHARS) {
      previous.end = current.end;
    } else if (next) {
      const combined = hardSplit(text, current.start, next.end);
      result.push(...combined);
      index++;
    } else if (previous) {
      result.pop();
      result.push(...hardSplit(text, previous.start, current.end));
    } else {
      result.push(current);
    }
  }
  // A hard split can leave a tiny tail. Attach it to its predecessor when bounded.
  for (let index = result.length - 1; index > 0; index--) {
    const current = result[index], previous = result[index - 1];
    if (isShortUnit(text.slice(current.start, current.end)) && current.end - previous.start <= INTAKE_SOURCE_SPAN_MAX_CHARS) {
      previous.end = current.end;
      result.splice(index, 1);
    }
  }
  return result;
}
function limitSpanCount(notes: ConsultationNote[], perNote: Map<string, { start: number; end: number }[]>): Map<string, { start: number; end: number }[]> {
  const all = [...perNote.values()].reduce((total, ranges) => total + ranges.length, 0);
  if (all <= INTAKE_SOURCE_SPAN_MAX_COUNT) return perNote;
  const totalChars = notes.reduce((total, note) => total + note.text.length, 0);
  const targetChars = Math.max(1, Math.ceil(totalChars / Math.max(1, INTAKE_SOURCE_SPAN_MAX_COUNT - notes.length)));
  const bounded = new Map<string, { start: number; end: number }[]>();
  for (const note of notes) {
    const ranges = perNote.get(note.id) ?? [], grouped: { start: number; end: number }[] = [];
    let start: number | null = null, end = 0;
    const flush = () => { if (start !== null) grouped.push({ start, end }); start = null; };
    for (const range of ranges) {
      const length = range.end - range.start;
      if (start !== null && (end - start >= targetChars || end - start + length > INTAKE_SOURCE_SPAN_MAX_CHARS)) flush();
      if (start === null) start = range.start;
      end = range.end;
    }
    flush();
    bounded.set(note.id, grouped);
  }
  return bounded;
}
function activeNotes(notes: ConsultationNote[]): ConsultationNote[] {
  const superseded = new Set(notes.flatMap(note => note.supersedesId ? [note.supersedesId] : []));
  return notes.filter(note => !superseded.has(note.id)).sort((a, b) => a.sequence - b.sequence || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Partition every active note into stable, exact source spans. Boundaries favor
 * sentence and line endings, but every code unit remains represented once.
 */
export function buildIntakeSourceSpans(notes: ConsultationNote[]): IntakeSourceSpan[] {
  const active = activeNotes(notes);
  const sequences = new Set<number>();
  const perNote = new Map<string, { start: number; end: number }[]>();
  for (const note of active) {
    if (typeof note.sequence !== "number" || !Number.isSafeInteger(note.sequence) || note.sequence < 1) fail("INTAKE_INVALID_SOURCE_SPAN_SEQUENCE", note.id);
    if (sequences.has(note.sequence)) fail("INTAKE_DUPLICATE_SOURCE_SPAN_SEQUENCE", String(note.sequence));
    sequences.add(note.sequence);
    if (typeof note.text !== "string" || !note.text.length) fail("INTAKE_INVALID_SOURCE_SPAN_NOTE", note.id);
    const rawRanges: { start: number; end: number }[] = [];
    let start = 0;
    for (let cursor = 0; cursor < note.text.length; cursor++) {
      const naturalEnd = naturalBoundaryEnd(note.text, cursor);
      if (naturalEnd === null) continue;
      rawRanges.push(...hardSplit(note.text, start, naturalEnd));
      start = naturalEnd;
      cursor = naturalEnd - 1;
    }
    rawRanges.push(...hardSplit(note.text, start, note.text.length));
    const noteRanges = mergeShortUnits(note.text, rawRanges);
    if (noteRanges.map(range => note.text.slice(range.start, range.end)).join("") !== note.text || noteRanges[0]?.start !== 0 || noteRanges.at(-1)?.end !== note.text.length || noteRanges.some(range => range.end - range.start > INTAKE_SOURCE_SPAN_MAX_CHARS)) {
      fail("INTAKE_SOURCE_SPAN_COVERAGE_FAILED", note.id);
    }
    perNote.set(note.id, noteRanges);
  }
  const bounded = limitSpanCount(active, perNote), spans: IntakeSourceSpan[] = [];
  for (const note of active) for (const range of bounded.get(note.id) ?? []) {
    spans.push({ id: `span:${note.sequence}:${range.start}:${range.end}`, noteId: note.id, start: range.start, end: range.end, text: note.text.slice(range.start, range.end) });
  }
  if (spans.length > INTAKE_SOURCE_SPAN_MAX_COUNT) fail("INTAKE_SOURCE_SPAN_COUNT_EXCEEDED", String(spans.length));
  return spans;
}

function uniqueQuote(note: ConsultationNote, span: IntakeSourceSpan): string {
  const text = note.text;
  let left = span.start, right = span.end;
  const unique = (quote: string, start: number) => quote.length > 0 && text.indexOf(quote) === start && text.indexOf(quote, start + 1) < 0;
  for (;;) {
    const quote = text.slice(left, right);
    if (quote.length <= QUOTE_MAX_CHARS && unique(quote, left)) return quote;
    if (right - left >= QUOTE_MAX_CHARS || left === 0 && right === text.length) break;
    const room = QUOTE_MAX_CHARS - (right - left);
    let addLeft = Math.min(250, left, Math.floor(room / 2));
    let addRight = Math.min(250, text.length - right, room - addLeft);
    if (!addLeft && addRight < room) addRight = Math.min(text.length - right, room);
    if (!addRight && addLeft < room) addLeft = Math.min(left, room);
    const previousLeft = left, previousRight = right;
    const nextLeft = safeBoundary(text, left - addLeft);
    const nextRight = safeBoundary(text, right + addRight);
    if (nextRight - nextLeft <= QUOTE_MAX_CHARS) {
      left = nextLeft;
      right = nextRight;
    } else {
      // safeBoundary can extend the left edge by one UTF-16 code unit. Keep the
      // original left edge if that would breach the quote bound.
      right = safeBoundary(text, Math.min(text.length, right + addRight));
    }
    if (left === previousLeft && right === previousRight) break;
  }
  fail("INTAKE_AMBIGUOUS_SOURCE_SPAN", `${span.noteId}:${span.id}`);
}

/** Convert span-only model references to the existing exact-quote public contract. */
export function resolveIntakeSourceSpanRefs(raw: unknown, notes: ConsultationNote[]): unknown {
  const active = activeNotes(notes), noteMap = new Map(active.map(note => [note.id, note]));
  const spans = buildIntakeSourceSpans(notes), spanMap = new Map(spans.map(span => [span.id, span]));
  if (!isRecord(raw) || Object.keys(raw).length !== 1 || !Object.hasOwn(raw, "claims")) fail("INTAKE_INVALID_SOURCE_SPAN_RESULT", "classifier result");
  const rows: unknown = raw.claims;
  if (!Array.isArray(rows)) fail("INTAKE_INVALID_SOURCE_SPAN_RESULT", "claims");
  const claims = rows.map((claim, claimIndex) => {
    if (!isRecord(claim) || !Array.isArray(claim.refs)) fail("INTAKE_INVALID_SOURCE_SPAN_RESULT", `claims[${claimIndex}]`);
    const refs = claim.refs.map((ref, refIndex) => {
      if (!isRecord(ref) || Object.keys(ref).length !== 1 || !Object.hasOwn(ref, "sourceSpanId") || typeof ref.sourceSpanId !== "string") {
        fail("INTAKE_INVALID_SOURCE_SPAN_REF", `claims[${claimIndex}].refs[${refIndex}]`);
      }
      const span = spanMap.get(ref.sourceSpanId);
      if (!span) fail("INTAKE_UNKNOWN_SOURCE_SPAN", ref.sourceSpanId);
      const note = noteMap.get(span.noteId);
      if (!note || note.text.slice(span.start, span.end) !== span.text) fail("INTAKE_INVALID_SOURCE_SPAN", ref.sourceSpanId);
      return { noteId: note.id, quote: uniqueQuote(note, span) };
    });
    return { ...claim, refs };
  });
  return { claims };
}
