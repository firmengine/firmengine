import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { INTAKE_CATALOG_SEED } from "../lib/intake-catalog.ts";
import { validateIntakeCatalog } from "../lib/intake-engine.ts";
import type { IntakeCatalog } from "../lib/intake-types.ts";
import { isOfficialMonitorUrl } from "../lib/legal-monitor-core.ts";
import { intakeMonitorProjection, intakeReferenceRecords } from "../lib/intake-reference.ts";
import { readIntakeReferences, intakeReferenceMonitorRules, intakeReferenceMonitorScope } from "../lib/intake-reference-store.ts";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const seed = () => validateIntakeCatalog(structuredClone(INTAKE_CATALOG_SEED));
class MemoryD1 {
  readonly sqlite = new DatabaseSync(":memory:");
  readonly queries: string[] = [];
  constructor() { this.sqlite.exec(readFileSync(new URL("../drizzle/0004_broken_gorgon.sql", import.meta.url), "utf8")); }
  prepare(sql: string) {
    this.queries.push(sql);
    assert.match(sql, /^\s*SELECT\b/i, "the bridge must never issue a write");
    const tables = [...sql.matchAll(/\b(?:FROM|JOIN)\s+(\w+)/gi)].map(match => match[1]);
    assert.ok(tables.length > 0 && tables.every(table => ["intake_catalog_head", "intake_catalog_versions"].includes(table)), "the bridge reads actual catalogue tables only; no case/consultation reads");
    let values: SQLInputValue[] = [];
    const statement = {
      bind(...args: unknown[]) { values = args as SQLInputValue[]; return statement; },
      first: async <T>(): Promise<T | null> => (this.sqlite.prepare(sql).get(...values) ?? null) as T | null,
    };
    return statement;
  }
  get database() { return this as unknown as D1Database; }
  save(catalog: IntakeCatalog, activate = true) {
    const hash = digest(catalog);
    this.sqlite.prepare("INSERT INTO intake_catalog_versions(version,schema_version,payload,sha256,actor,created_at) VALUES(?,?,?,?,?,?)").run(catalog.version, catalog.schemaVersion, JSON.stringify(catalog), hash, "synthetic-reviewer", "2026-10-29T00:00:00Z");
    if (activate) this.sqlite.prepare("INSERT INTO intake_catalog_head(id,version,sha256) VALUES('default',?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,sha256=excluded.sha256").run(catalog.version, hash);
    return hash;
  }
  close() { this.sqlite.close(); }
}

test("no-head fallback exposes the real catalogue without seeding or reading cases", async () => {
  const database = new MemoryD1();
  try {
    const result = await readIntakeReferences(database.database);
    assert.equal(result.initialized, false); assert.equal(result.active, null); assert.equal(result.readOnly, true);
    assert.deepEqual(result.catalog, seed()); assert.equal(result.catalogSha256, digest(seed()));
    assert.deepEqual(result.counts, { features: seed().features.length, documents: seed().documents.length, rules: seed().rules.length, sources: seed().sources.length, enabledRules: seed().rules.filter(rule=>rule.enabled).length });
    assert.equal(result.records.length, intakeReferenceRecords(seed()).length);
    assert.equal((database.sqlite.prepare("SELECT COUNT(*) AS n FROM intake_catalog_versions").get() as {n:number}).n, 0);
    assert.equal((database.sqlite.prepare("SELECT COUNT(*) AS n FROM intake_catalog_head").get() as {n:number}).n, 0);
    assert.equal(database.queries.length, 1);
    assert.equal(result.mutationEndpoint, "/api/checklist-catalog");
  } finally { database.close(); }
});

test("the actual active immutable version wins over seed and later unactivated revisions", async () => {
  const database = new MemoryD1();
  try {
    database.save(seed());
    const active = seed(); active.version = seed().version+1; active.documents[0].name = "검토하여 바꾼 서류 이름";
    const hash = database.save(active);
    const later = seed(); later.version = seed().version+2; later.title = "현재 판본이 아닌 검토자료"; database.save(later, false);
    const result = await readIntakeReferences(database.database);
    assert.equal(result.initialized, true); assert.equal(result.catalogVersion, active.version); assert.equal(result.catalogSha256, hash);
    assert.deepEqual(result.catalog, active); assert.deepEqual(result.active, active);
    assert.equal(result.records.find(row => row.id === `intake.document.${active.documents[0].id}`)?.title, active.documents[0].name);
    assert.ok(result.records.every(row => row.catalogVersion === active.version));
  } finally { database.close(); }
});

test("stored head, version metadata, schema and payload hashes must agree", async () => {
  const corruptions = [
    "UPDATE intake_catalog_head SET sha256='" + "f".repeat(64) + "'",
    "UPDATE intake_catalog_head SET version=999",
    "UPDATE intake_catalog_versions SET sha256='" + "e".repeat(64) + "'",
    "UPDATE intake_catalog_versions SET schema_version='incorrect-schema'",
    "UPDATE intake_catalog_versions SET payload='{bad json'",
  ];
  for (const sql of corruptions) {
    const database = new MemoryD1();
    try { database.save(seed()); database.sqlite.exec(sql); await assert.rejects(readIntakeReferences(database.database), /INTAKE_CATALOG_INTEGRITY_FAILED/); }
    finally { database.close(); }
  }
  const database = new MemoryD1();
  try {
    database.save(seed()); const altered = seed(); altered.documents[0].name = "해시를 유지한 변조";
    database.sqlite.prepare("UPDATE intake_catalog_versions SET payload=?").run(JSON.stringify(altered));
    await assert.rejects(readIntakeReferences(database.database), /INTAKE_CATALOG_INTEGRITY_FAILED/);
  } finally { database.close(); }
});

test("a correctly hashed invalid catalogue is rejected by the existing engine validator", async () => {
  const database = new MemoryD1();
  try {
    const malformed = seed(); malformed.rules[0].documents[0].documentTypeId = "missing_document"; database.save(malformed);
    await assert.rejects(readIntakeReferences(database.database), /INTAKE_CATALOG_INTEGRITY_FAILED/);
  } finally { database.close(); }
});

test("views preserve actual features, requirements, jurisdictions and source locators", () => {
  const catalog = seed(), before = JSON.stringify(catalog), records = intakeReferenceRecords(catalog);
  for (const [kind, values] of [["feature", catalog.features], ["document", catalog.documents], ["rule", catalog.rules], ["source", catalog.sources]] as const) {
    for (const value of values) assert.deepEqual(records.find(row => row.id === `intake.${kind}.${value.id}`)?.value, value);
  }
  const seoulBusan = records.find(row => row.id === "intake.rule.INTAKE-053")!;
  assert.deepEqual(seoulBusan.courtIds, ["seoul", "busan"]);
  assert.equal(seoulBusan.effectiveFrom, catalog.rules.find(row => row.id === "INTAKE-053")!.effectiveFrom);
  const source = records.find(row => row.id === "intake.source.SRC-INTAKE-SEOUL-402")!;
  assert.equal(source.effectiveFrom, null, "checkedAt must not become an effective date");
  (seoulBusan.value as IntakeCatalog["rules"][number]).documents[0].period = "test-only projection mutation";
  assert.equal(JSON.stringify(catalog), before, "projection cannot mutate the actual catalogue snapshot");
});

test("rule and feature monitor lineage includes required and alternative document sources", () => {
  const catalog = seed();
  const rule = catalog.rules.find(row => row.id === "INTAKE-015")!;
  const alternative = catalog.documents.find(row => row.id === "creditor_request_copy")!;
  const extra = { ...catalog.sources[0], id: "SRC-SYNTHETIC-ALTERNATIVE", url: "https://slb.scourt.go.kr/synthetic-alternative-guidance" };
  catalog.sources.push(extra); alternative.sourceIds = [extra.id];
  const records = intakeReferenceRecords(validateIntakeCatalog(catalog));
  for (const id of [`intake.rule.${rule.id}`, "intake.feature.debt.financial"]) {
    const row = records.find(item => item.id === id)!;
    assert.ok(row.sourceIds.includes(extra.id)); assert.ok(row.sourceUrls.includes(extra.url));
  }
  assert.ok(records.find(row => row.id === `intake.rule.${rule.id}`)!.sourceIds.includes("SRC-INTAKE-SC-GUIDE"));
});

test("monitor excludes office URLs, preserves official issuing guidance and disabled rule state", async () => {
  const database = new MemoryD1();
  try {
    const catalog = seed(); catalog.rules[0].enabled = false; database.save(catalog);
    const result = await readIntakeReferences(database.database), projection = intakeMonitorProjection(result.records);
    assert.equal(result.counts.enabledRules, catalog.rules.filter(rule=>rule.enabled).length);
    assert.ok(result.records.some(row => row.id === `intake.rule.${catalog.rules[0].id}` && !row.enabled));
    assert.ok(!projection.some(row => row.id === `intake.rule.${catalog.rules[0].id}`));
    assert.ok(projection.some(row => row.sourceUrls.some(url => new URL(url).hostname.endsWith("gov.kr"))));
    assert.ok(!projection.some(row => row.sourceUrls.some(url => url.includes("chatgpt.site"))));
    assert.deepEqual(result.monitoring.excludedSources.map(source => source.sourceId), catalog.sources.filter(source=>!isOfficialMonitorUrl(source.url)).map(source=>source.id));
    const scope = await intakeReferenceMonitorScope(database.database);
    assert.equal(scope.catalogVersion, catalog.version); assert.equal(scope.catalogSha256, digest(catalog)); assert.equal(scope.initialized, true);
    assert.deepEqual(scope.rules, projection); assert.deepEqual(await intakeReferenceMonitorRules(database.database), projection);
  } finally { database.close(); }
});

test("uninitialized monitor reads use the real seed and never create a catalogue", async () => {
  const database = new MemoryD1();
  try {
    const scope = await intakeReferenceMonitorScope(database.database);
    assert.equal(scope.initialized, false); assert.equal(scope.rules.length, intakeMonitorProjection(intakeReferenceRecords(seed())).length); assert.equal(scope.catalogSha256, digest(seed()));
    assert.equal((database.sqlite.prepare("SELECT COUNT(*) AS n FROM intake_catalog_versions").get() as {n:number}).n, 0);
  } finally { database.close(); }
});

test("reference HTTP surface exposes GET only and delegates mutations to the existing catalogue", () => {
  const route = readFileSync(new URL("../app/api/intake-reference/route.ts", import.meta.url), "utf8");
  assert.match(route, /export async function GET\(/);
  assert.doesNotMatch(route, /export (?:async )?function (?:POST|PUT|PATCH|DELETE)\(/);
  assert.doesNotMatch(route, /bootstrapIntakeReferences|saveIntakeReference|saveIntakeCatalog/);
});
