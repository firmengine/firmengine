import test from "node:test";
import assert from "node:assert/strict";
import { conflictingObservedFactIds, type ObservedTemporalFact } from "../lib/observed-period-collision.ts";

type Row = ObservedTemporalFact & { display: string };
const row = (id: string, display: string, start?: string, end?: string, extra: Partial<Row> = {}): Row =>
  ({ id, display, subjectId: "synthetic-subject", key: "income.net", logicalId: id, periodStart: start, periodEnd: end, ...extra });
const detect = (rows: Row[]) => [...conflictingObservedFactIds(rows, r => r.display)].sort();

test("different complete calendar months are independent observations, not value conflicts", () => {
  assert.deepEqual(detect([row("jan","100","2026-01-01","2026-01-31"),row("feb","200","2026-02-01","2026-02-28")]), []);
});
test("same and overlapping periods with differing readings remain conflicts", () => {
  assert.deepEqual(detect([row("a","100","2026-01-01","2026-01-31"),row("b","200","2026-01-01","2026-01-31")]), ["a","b"]);
  assert.deepEqual(detect([row("a","100","2026-01-01","2026-01-20"),row("b","200","2026-01-20","2026-02-01")]), ["a","b"]);
});
test("unknown, partial or malformed dates never suppress a competing reading", () => {
  assert.deepEqual(detect([row("a","100"),row("b","200")]), ["a","b"]);
  assert.deepEqual(detect([row("a","100","2026-01-01"),row("b","200","2026-02-01","2026-02-28")]), ["a","b"]);
  assert.deepEqual(detect([row("a","100","2026-02-99","2026-02-99"),row("b","200","2026-03-01","2026-03-31")]), ["a","b"]);
});
test("equal values and different subjects do not conflict", () => {
  assert.deepEqual(detect([row("a","100"),row("b","100")]), []);
  assert.deepEqual(detect([row("a","100"),row("b","200",undefined,undefined,{subjectId:"different"})]), []);
});
test("independent statement paragraphs keep their logical identity", () => {
  assert.deepEqual(detect([row("a","A",undefined,undefined,{key:"statement.text",logicalId:"doc:paragraph:1"}),row("b","B",undefined,undefined,{key:"statement.text",logicalId:"doc:paragraph:2"})]), []);
});
test("only an overlapping pair in three temporal observations is highlighted", () => {
  assert.deepEqual(detect([row("a","100","2026-01-01","2026-01-31"),row("b","200","2026-02-01","2026-02-28"),row("c","300","2026-02-15","2026-03-05")]), ["b","c"]);
});
