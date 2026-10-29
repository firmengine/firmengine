import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import ts from "typescript";
import type { MonitorCandidate, MonitorDiscovery, MonitorObservation, MonitorRunOptions, MonitorRunResult } from "../lib/legal-monitor-core.ts";
import { isOfficialMonitorUrl } from "../lib/legal-monitor-core.ts";

type CoreOptions = MonitorRunOptions & { pendingDiscoveries?: MonitorDiscovery[] };
type CoreResult = MonitorRunResult & { pendingDiscoveries?: MonitorDiscovery[] };
type Row = Record<string, string | number | null>;
const source = { id: "synthetic-court-source", title: "Synthetic court notice", agent: "court_documents" as const, url: "https://slb.scourt.go.kr/synthetic-notice", kind: "court_notice" as const, officialDomains: ["scourt.go.kr"] };
const epoch = Date.parse("2026-10-28T01:00:00.000Z");
const hash = (value: string) => value.repeat(64);
const schema = readFileSync(new URL("../drizzle/0006_legal_reference_monitor.sql", import.meta.url), "utf8");
const output = ts.transpileModule(readFileSync(new URL("../lib/legal-monitor-store.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

/** Actual SQLite transaction semantics with a D1-shaped API; never opens a file. */
class MemoryD1 {
  readonly sqlite = new DatabaseSync(":memory:");
  readonly statements: string[] = [];
  fail?: (sql: string) => boolean;
  beforeWrite?: (sql: string) => void;
  constructor() { this.sqlite.exec(schema); }
  prepare(sql: string) {
    let values: SQLInputValue[] = [];
    const execute = () => {
      this.statements.push(sql);
      this.beforeWrite?.(sql);
      if (this.fail?.(sql)) throw new Error("SYNTHETIC_PERSISTENCE_FAILURE");
      const result = this.sqlite.prepare(sql).run(...values);
      return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
    };
    const statement = {
      sql, execute,
      bind(...args: unknown[]) { values = args as SQLInputValue[]; return statement; },
      first: async <T>(column?: string): Promise<T | null> => {
        this.statements.push(sql);
        const row = this.sqlite.prepare(sql).get(...values);
        return (row ? column ? row[column] : row : null) as T | null;
      },
      all: async <T>() => { this.statements.push(sql); return { results: this.sqlite.prepare(sql).all(...values) as T[], success: true, meta: {} }; },
      run: async () => execute(),
    };
    return statement;
  }
  async batch(statements: Array<{ execute(): unknown }>) {
    this.sqlite.exec("BEGIN");
    try {
      const results = statements.map(statement => statement.execute());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
  rows(table: string): Row[] { assert.match(table, /^legal_monitor_[a-z_]+$/); return this.sqlite.prepare(`SELECT * FROM ${table}`).all() as Row[]; }
  payload<T>(table: string): T[] { return this.rows(table).map(row => JSON.parse(String(row.payload)) as T); }
  close() { this.sqlite.close(); }
}

function observation(parentHash = hash("a"), attachmentHash = hash("b"), at = new Date(epoch).toISOString()): MonitorObservation {
  return { sourceId: source.id, url: source.url, sha256: parentHash, rawSha256: parentHash, fetchedAt: at, contentType: "text/html", title: source.title, textExcerpt: "Synthetic test-only court publication", attachments: [{ url: "https://slb.scourt.go.kr/synthetic-form.pdf", title: "Synthetic form", sha256: attachmentHash, fetchedAt: at, status: "verified" }], discoveredLinks: [] };
}
function candidate(id: string, item: MonitorObservation, kind: MonitorCandidate["kind"] = "source_changed"): MonitorCandidate {
  return { id, agent: source.agent, sourceId: source.id, kind, status: "unconfirmed_change", title: "Synthetic change", summary: "Synthetic review required", affectedRuleIds: ["param.synthetic"], previousHash: hash("a"), currentHash: kind === "attachment_changed" ? item.attachments[0].sha256! : item.sha256, effectiveDate: null, promulgatedDate: null, sourceUrls: [source.url], evidence: ["Synthetic hash evidence"], requiresHumanReview: true };
}
function result(overrides: Partial<CoreResult> = {}): CoreResult {
  return { observations: [], candidates: [], sourceHealth: [], status: "complete", nextCursor: null, processedSources: 1, totalSources: 1, requests: 1, bytes: 100, discoveryStatus: "not_requested", analysisStatus: "not_requested", discoveryUrls: [], pendingDiscoveries: [], ...overrides };
}
interface StoreApi {
  runStoredLegalMonitor(input?: { agent?: "legislation" | "court_documents" | "all"; cursor?: number; maxSources?: number }): Promise<{ newAlertCount: number; nextCursor: number | null; [key: string]: unknown }>;
}
interface Fixture {
  database: MemoryD1;
  coreOptions: CoreOptions[];
  readonly now: string;
  readonly discoveryCalls: number;
  readonly coreCalls: number;
  advance(ms: number): void;
  discover(items: MonitorDiscovery[]): void;
  failDiscovery(fail: boolean): void;
  run: StoreApi["runStoredLegalMonitor"];
}
function fixture(run: (options: CoreOptions, fixture: Fixture) => Promise<CoreResult> | CoreResult): Fixture {
  const database = new MemoryD1();
  let clock = epoch, discoveryCalls = 0, coreCalls = 0, discoveryFailure = false;
  let discoveries: MonitorDiscovery[] = [];
  const coreOptions: CoreOptions[] = [];
  class HttpError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
  class ClockDate extends Date { static now() { return clock; } }
  const module = { exports: {} as StoreApi };
  const f = {
    database, coreOptions,
    get now() { return new Date(clock).toISOString(); },
    get discoveryCalls() { return discoveryCalls; },
    get coreCalls() { return coreCalls; },
    advance(ms: number) { clock += ms; },
    discover(items: MonitorDiscovery[]) { discoveries = items; },
    failDiscovery(fail: boolean) { discoveryFailure = fail; },
    run: (input?: Parameters<StoreApi["runStoredLegalMonitor"]>[0]) => module.exports.runStoredLegalMonitor(input),
  };
  const mocks: Record<string, unknown> = {
    "cloudflare:workers": { env: {} },
    "./server-store": { db: () => database, HttpError, now: () => f.now },
    "./legal-monitor-core.ts": { isOfficialMonitorUrl, runLegalMonitor: async (options: CoreOptions) => { coreCalls++; coreOptions.push(options); return run(options, f); } },
    "./intake-reference-store.ts": { intakeReferenceMonitorScope: async () => ({rules:[],catalogVersion:1,catalogSha256:"c".repeat(64),initialized:true}) },
    "./legal-monitor-sources.ts": { LEGAL_MONITOR_SOURCES: [source], LEGAL_MONITOR_SOURCE_POLICY: { automaticRuleActivation: false } },
    "./legal-monitor-provider.ts": { makeLegalMonitorProvider: () => ({ discover: async () => { discoveryCalls++; if (discoveryFailure) throw new Error("SYNTHETIC_DISCOVERY_FAILURE"); return structuredClone(discoveries); }, analyze: async () => ({ summary: "Synthetic review" }), usage: () => ({ input_tokens: 0, output_tokens: 0 }) }) },
    "./reference-registry.ts": { referenceMonitorRules: () => [{ id: "param.synthetic", title: "Synthetic criterion", category: "court_practice", sourceIds: [source.id], sourceUrls: [source.url] }] },
    "./reference-store.ts": { referenceHash: async (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex") },
    "./reference-runtime.ts": { referenceIdentity: () => ({ id: "synthetic-release", revision: 1, sha256: hash("f") }) },
  };
  new Function("require", "module", "exports", "Date", output)((name: string) => {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected import in isolated monitor test: ${name}`);
  }, module, module.exports, ClockDate);
  return f;
}
async function discoverFromCore(options: CoreOptions) {
  if (!options.discover) return [];
  return options.discover({ agent: options.agent ?? "all", sources: options.sources, rules: options.rules, since: null, allowedDomains: ["scourt.go.kr"], signal: new AbortController().signal });
}
function seedObservation(database: MemoryD1, item: MonitorObservation) {
  database.sqlite.prepare("INSERT INTO legal_monitor_observations (source_id,sha256,payload,fetched_at) VALUES (?,?,?,?)").run(item.sourceId, item.sha256, JSON.stringify(item), item.fetchedAt);
}
function seedState(database: MemoryD1) {
  const state = { cursor: 0, discoveryUrls: [], lastSearchAttemptAt: new Date(epoch).toISOString() };
  database.sqlite.prepare("INSERT INTO legal_monitor_state (id,payload,updated_at) VALUES (?,?,?)").run("all", JSON.stringify(state), new Date(epoch).toISOString());
  return state;
}
function assertMonitorOnlyWrites(database: MemoryD1) {
  const writes = database.statements.filter(sql => /^\s*(?:INSERT|UPDATE|DELETE|REPLACE)/i.test(sql));
  assert.ok(writes.length > 0);
  for (const sql of writes) {
    const table = sql.match(/^\s*(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|UPDATE|DELETE\s+FROM|REPLACE\s+INTO)\s+([a-z_]+)/i)?.[1];
    assert.ok(table?.startsWith("legal_monitor_"), `monitor wrote an unrelated table: ${sql}`);
  }
}

test("alert insertion failure rolls back its observation and history baseline atomically", async t => {
  const old = observation(), changed = observation(hash("c"));
  const f = fixture(() => result({ observations: [changed], candidates: [candidate("synthetic-alert", changed)] }));
  t.after(() => f.database.close());
  seedObservation(f.database, old);
  const priorState = seedState(f.database);
  f.database.fail = sql => /INSERT(?:\s+OR\s+IGNORE)?\s+INTO\s+legal_monitor_alerts/i.test(sql);
  await assert.rejects(f.run());
  assert.deepEqual(f.database.payload<MonitorObservation>("legal_monitor_observations"), [old]);
  assert.equal(f.database.rows("legal_monitor_observation_history").length, 0);
  assert.equal(f.database.rows("legal_monitor_alerts").length, 0);
  assert.deepEqual(f.database.payload("legal_monitor_state"), [priorState]);
  assert.equal(f.database.rows("legal_monitor_runs")[0].status, "failed");
  assert.equal(f.database.rows("legal_monitor_locks").length, 0);
  assertMonitorOnlyWrites(f.database);
});

test("failed and deferred sources retain the last successful observation", async t => {
  const old = observation();
  const f = fixture(() => result({ status: "partial", sourceHealth: [{ sourceId: source.id, status: "failed", message: "Synthetic fetch failure", checkedAt: new Date(epoch).toISOString() }] }));
  t.after(() => f.database.close());
  seedObservation(f.database, old);
  const run = await f.run();
  assert.equal(run.newAlertCount, 0);
  assert.deepEqual(f.database.payload<MonitorObservation>("legal_monitor_observations"), [old]);
  assert.equal(f.database.rows("legal_monitor_observation_history").length, 0);
  assert.equal(f.database.rows("legal_monitor_alerts").length, 0);
  assertMonitorOnlyWrites(f.database);
});

test("attachment-only changes create distinct history snapshots even when the parent hash is unchanged", async t => {
  let iteration = 0;
  const f = fixture(async options => {
    await discoverFromCore(options);
    const item = observation(hash("a"), iteration++ ? hash("c") : hash("b"));
    return result({ observations: [item], candidates: iteration === 2 ? [candidate("synthetic-attachment-alert", item, "attachment_changed")] : [], discoveryStatus: options.discover ? "complete" : "not_requested" });
  });
  t.after(() => f.database.close());
  await f.run();
  f.advance(60_000);
  const second = await f.run();
  const history = f.database.rows("legal_monitor_observation_history");
  assert.equal(history.length, 2);
  assert.equal(new Set(history.map(row => row.sha256)).size, 2, "history key must bind attachment hashes as well as parent text");
  assert.deepEqual(new Set(history.map(row => JSON.parse(String(row.payload)).attachments[0].sha256)), new Set([hash("b"), hash("c")]));
  assert.equal(second.newAlertCount, 1);
  assert.equal(f.database.payload<MonitorObservation>("legal_monitor_observations")[0].sha256, hash("a"));
  assert.equal(f.database.payload<MonitorObservation>("legal_monitor_observations")[0].attachments[0].sha256, hash("c"));
  assert.equal(f.discoveryCalls, 1);
  assertMonitorOnlyWrites(f.database);
});

test("pending discoveries survive cursor continuation without a second provider search on the same Korean day", async t => {
  const pending: MonitorDiscovery[] = [{ url: "https://slb.scourt.go.kr/synthetic-new-form", title: "Synthetic deferred form", agent: "court_documents" }];
  let iteration = 0;
  const f = fixture(async (options, fixture) => {
    iteration++;
    if (iteration === 1) {
      assert.equal(fixture.discoveryCalls, 0, "store must not search before the bounded core run begins");
      const found = await discoverFromCore(options);
      assert.deepEqual(found, pending);
      return result({ status: "partial", nextCursor: 1, discoveryStatus: "complete", pendingDiscoveries: found });
    }
    if (iteration === 2) {
      assert.equal(options.discover, undefined);
      assert.deepEqual(options.pendingDiscoveries, pending);
      return result({ discoveryUrls: [pending[0].url], pendingDiscoveries: [] });
    }
    await discoverFromCore(options);
    return result({ discoveryStatus: options.discover ? "complete" : "not_requested" });
  });
  t.after(() => f.database.close());
  f.discover(pending);
  assert.equal((await f.run()).nextCursor, 1);
  assert.deepEqual(f.database.payload<{ pendingDiscoveries: MonitorDiscovery[] }>("legal_monitor_state")[0].pendingDiscoveries, pending);
  await f.run();
  assert.equal(f.coreOptions[1].cursor, 1);
  assert.deepEqual(f.database.payload<{ pendingDiscoveries: MonitorDiscovery[] }>("legal_monitor_state")[0].pendingDiscoveries, []);
  await f.run();
  assert.equal(f.discoveryCalls, 1);
  f.advance(86_400_000);
  await f.run();
  assert.equal(f.discoveryCalls, 2, "a new Korean date allows the next daily search");
  assertMonitorOnlyWrites(f.database);
});

test("a discovered queue is durable before a later core interruption and resumes without another paid search", async t => {
  const found: MonitorDiscovery = { url: "https://slb.scourt.go.kr/synthetic-durable-notice", title: "Synthetic durable notice", agent: "court_documents" };
  let iteration = 0;
  const f = fixture(async (options, fixture) => {
    if (++iteration === 1) {
      await discoverFromCore(options);
      const state = fixture.database.payload<{ pendingDiscoveries: MonitorDiscovery[]; lastSearchSucceededAt: string }>("legal_monitor_state")[0];
      assert.equal(state.pendingDiscoveries[0].url, found.url);
      assert.equal(state.pendingDiscoveries[0].baselineOnly, true);
      assert.equal(state.pendingDiscoveries[0].discoveredAt, fixture.now);
      assert.equal(state.lastSearchSucceededAt, fixture.now);
      throw new Error("SYNTHETIC_CORE_INTERRUPTION");
    }
    assert.equal(options.discover, undefined);
    assert.equal(options.pendingDiscoveries?.[0].url, found.url);
    assert.equal(options.pendingDiscoveries?.[0].baselineOnly, true);
    return result({ discoveryUrls: [found.url] });
  });
  t.after(() => f.database.close());
  f.discover([found]);
  await assert.rejects(f.run());
  assert.equal(f.database.rows("legal_monitor_observations").length, 0);
  assert.equal(f.database.rows("legal_monitor_alerts").length, 0);
  assert.equal(f.database.rows("legal_monitor_locks").length, 0);
  assert.equal(f.database.payload<{ pendingDiscoveries: MonitorDiscovery[] }>("legal_monitor_state")[0].pendingDiscoveries.length, 1);
  await f.run();
  assert.equal(f.discoveryCalls, 1);
  assert.deepEqual(f.database.payload<{ pendingDiscoveries: MonitorDiscovery[] }>("legal_monitor_state")[0].pendingDiscoveries, []);
  assertMonitorOnlyWrites(f.database);
});

test("a failed discovered document remains queued for tomorrow without creating an immediate continuation loop", async t => {
  const pending: MonitorDiscovery = { url: "https://slb.scourt.go.kr/synthetic-retry-notice", title: "Synthetic retry notice", agent: "court_documents", lastAttemptAt: new Date(epoch).toISOString(), retryAfter: "2026-10-28T15:00:00.000Z" };
  const f = fixture(() => result({ status: "partial", nextCursor: null, pendingDiscoveries: [pending] }));
  t.after(() => f.database.close());
  seedState(f.database);
  const summary = await f.run();
  assert.equal(summary.nextCursor, null);
  assert.equal(summary.pendingDiscoveryCount, 1);
  assert.equal(f.database.payload<{ pendingDiscoveries: MonitorDiscovery[] }>("legal_monitor_state")[0].pendingDiscoveries[0].retryAfter, pending.retryAfter);
  assert.equal(f.discoveryCalls, 0);
  assertMonitorOnlyWrites(f.database);
});

test("a new Korean day resets an unfinished default cursor while same-day continuations retain it", async t => {
  const f = fixture(async options => {
    await discoverFromCore(options);
    return result({ status: "partial", nextCursor: 3, totalSources: 10, discoveryStatus: options.discover ? "complete" : "not_requested" });
  });
  t.after(() => f.database.close());
  await f.run(); await f.run();
  f.advance(86_400_000);
  await f.run();
  assert.deepEqual(f.coreOptions.map(options => options.cursor), [0, 3, 0]);
  assert.equal(f.discoveryCalls, 2);
  assertMonitorOnlyWrites(f.database);
});

test("a cold-start search failure does not establish an empty baseline before the first successful search", async t => {
  const found: MonitorDiscovery = { url: "https://slb.scourt.go.kr/synthetic-first-discovery", title: "Synthetic initial baseline", agent: "court_documents" };
  const f = fixture(async (options, fixture) => {
    try { await discoverFromCore(options); }
    catch { return result({ status: "partial", discoveryStatus: "failed" }); }
    assert.equal(options.discoveryBaselineUrls, undefined);
    const pending = fixture.database.payload<{ pendingDiscoveries: MonitorDiscovery[] }>("legal_monitor_state")[0].pendingDiscoveries;
    assert.equal(pending[0].baselineOnly, true);
    return result({ status: "partial", discoveryStatus: "complete", pendingDiscoveries: pending });
  });
  t.after(() => f.database.close());
  f.discover([found]); f.failDiscovery(true);
  await f.run();
  const failedState = f.database.payload<Record<string, unknown>>("legal_monitor_state")[0];
  assert.equal(Object.hasOwn(failedState, "discoveryUrls"), false);
  assert.equal(Object.hasOwn(failedState, "lastSearchSucceededAt"), false);
  f.advance(86_400_000); f.failDiscovery(false);
  await f.run();
  assert.equal(f.discoveryCalls, 2);
  assert.equal(f.database.rows("legal_monitor_alerts").length, 0);
  assert.equal(f.database.payload<{ pendingDiscoveries: MonitorDiscovery[] }>("legal_monitor_state")[0].pendingDiscoveries[0].baselineOnly, true);
  assertMonitorOnlyWrites(f.database);
});

test("a rediscovered URL preserves its existing retry and baseline metadata in the immediate checkpoint", async t => {
  const pending: MonitorDiscovery = { url: "https://slb.scourt.go.kr/synthetic-overlap", title: "Existing queued document", agent: "court_documents", baselineOnly: false, discoveredAt: "2026-10-27T01:00:00.000Z", lastAttemptAt: "2026-10-27T02:00:00.000Z", retryAfter: "2026-10-28T15:00:00.000Z" };
  const f = fixture(async options => { await discoverFromCore(options); throw new Error("SYNTHETIC_AFTER_CHECKPOINT"); });
  t.after(() => f.database.close());
  const state = { pendingDiscoveries: [pending], discoveryUrls: [], lastSearchAttemptAt: "2026-10-27T01:00:00.000Z" };
  f.database.sqlite.prepare("INSERT INTO legal_monitor_state (id,payload,updated_at) VALUES (?,?,?)").run("all", JSON.stringify(state), state.lastSearchAttemptAt);
  f.discover([{ url: pending.url, title: "New search title", agent: "court_documents" }]);
  await assert.rejects(f.run());
  assert.deepEqual(f.database.payload<{ pendingDiscoveries: MonitorDiscovery[] }>("legal_monitor_state")[0].pendingDiscoveries, [pending]);
  assert.equal(f.discoveryCalls, 1);
  assertMonitorOnlyWrites(f.database);
});

test("an active competing lease prevents provider calls, run creation and data writes", async t => {
  const f = fixture(() => result());
  t.after(() => f.database.close());
  f.database.sqlite.prepare("INSERT INTO legal_monitor_locks (id,token,expires_at) VALUES (?,?,?)").run("legal-monitor", "other-run", new Date(epoch + 300_000).toISOString());
  await assert.rejects(f.run(), (error: unknown) => (error as { status?: number }).status === 409);
  assert.equal(f.coreCalls, 0);
  assert.equal(f.discoveryCalls, 0);
  for (const table of ["legal_monitor_runs", "legal_monitor_observations", "legal_monitor_observation_history", "legal_monitor_alerts", "legal_monitor_state"]) assert.equal(f.database.rows(table).length, 0, table);
  assert.equal(f.database.rows("legal_monitor_locks")[0].token, "other-run");
  assertMonitorOnlyWrites(f.database);
});

test("a writer whose lease was replaced during collection cannot commit or delete the successor lease", async t => {
  const changed = observation(hash("c"));
  const f = fixture((_options, fixture) => {
    fixture.database.sqlite.prepare("UPDATE legal_monitor_locks SET token=?,expires_at=? WHERE id='legal-monitor'").run("successor-run", new Date(epoch + 300_000).toISOString());
    return result({ observations: [changed], candidates: [candidate("stale-alert", changed)] });
  });
  t.after(() => f.database.close());
  const priorState = seedState(f.database);
  await assert.rejects(f.run());
  for (const table of ["legal_monitor_observations", "legal_monitor_observation_history", "legal_monitor_alerts"]) assert.equal(f.database.rows(table).length, 0, table);
  assert.deepEqual(f.database.payload("legal_monitor_state"), [priorState]);
  assert.equal(f.database.rows("legal_monitor_locks")[0].token, "successor-run");
  assertMonitorOnlyWrites(f.database);
});

test("an expired lease is fenced even when its token has not yet been replaced", async t => {
  const changed = observation(hash("c"));
  const f = fixture((_options, fixture) => {
    fixture.advance(151_000);
    return result({ observations: [changed], candidates: [candidate("expired-alert", changed)] });
  });
  t.after(() => f.database.close());
  const priorState = seedState(f.database);
  await assert.rejects(f.run());
  for (const table of ["legal_monitor_observations", "legal_monitor_observation_history", "legal_monitor_alerts"]) assert.equal(f.database.rows(table).length, 0, table);
  assert.deepEqual(f.database.payload("legal_monitor_state"), [priorState]);
  assertMonitorOnlyWrites(f.database);
});

test("run-row insertion failure releases its lease through the same cleanup boundary", async t => {
  const f = fixture(() => result());
  t.after(() => f.database.close());
  f.database.fail = sql => /INSERT\s+INTO\s+legal_monitor_runs/i.test(sql);
  await assert.rejects(f.run());
  assert.equal(f.coreCalls, 0);
  assert.equal(f.discoveryCalls, 0);
  assert.equal(f.database.rows("legal_monitor_runs").length, 0);
  assert.equal(f.database.rows("legal_monitor_locks").length, 0);
  assertMonitorOnlyWrites(f.database);
});
