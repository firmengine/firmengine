import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Static source contract; it is not a D1 migration application or a legal recognition test.
const drizzle = readFileSync(new URL("../db/schema.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../drizzle/0022_preapproval_court_correction_items.sql", import.meta.url), "utf8");
const table = drizzle.split("export const caseCourtCorrectionItemVersions=sqliteTable(")[1]?.split("export const caseCourtCorrectionItemHeads=sqliteTable(")[0] ?? "";

test("court correction item ordinal CHECK mirrors the shipped 0022 SQL boundaries", () => {
  const declared = /check\(\s*"case_correction_item_no_range"\s*,\s*sql`\$\{t\.itemNo\}\s*>=\s*(\d+)\s+AND\s+\$\{t\.itemNo\}\s*<=\s*(\d+)`\s*\)/.exec(table);
  const shipped = /item_no\s+INTEGER\s+NOT NULL\s+CHECK\(\s*item_no\s*>=\s*(\d+)\s+AND\s+item_no\s*<=\s*(\d+)\s*\)/i.exec(migration);
  assert.ok(shipped, "shipped migration must retain the DB-side range constraint");
  assert.ok(declared, "Drizzle should expose the same constraint, not just a column type");
  assert.deepEqual(declared.slice(1), shipped.slice(1), "Drizzle and migration limits must agree");
  assert.deepEqual(shipped.slice(1), ["1", "500"]);
});

test("court correction version foreign-key intent remains aligned with 0022 SQL", () => {
  assert.match(table, /caseId:text\("case_id"\)\.notNull\(\)\.references\(\(\)=>cases\.id\)/);
  assert.match(table, /orderDocumentId:text\("order_document_id"\)\.notNull\(\)\.references\(\(\)=>documents\.id\)/);
  assert.match(migration, /case_id\s+TEXT\s+NOT NULL\s+REFERENCES\s+cases\(id\)/i);
  assert.match(migration, /order_document_id\s+TEXT\s+NOT NULL\s+REFERENCES\s+documents\(id\)/i);
});
