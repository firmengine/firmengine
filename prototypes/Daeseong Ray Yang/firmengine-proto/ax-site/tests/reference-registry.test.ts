import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  REFERENCE_RECORDS, REFERENCE_RELEASE, referenceRecord, currentReferenceRecord,
  referenceMonitorRules, validateReferenceValue, type ReferenceRecord,
} from "../lib/reference-registry.ts";
import {
  loadReferenceSnapshot, runWithReferenceSnapshot, seedReferenceSnapshot,
} from "../lib/reference-context.ts";
import {
  currentReferenceSnapshot, referenceSnapshotHash, type ReferenceSnapshot,
} from "../lib/reference-runtime.ts";
import { referenceParameter } from "../lib/reference-parameters.ts";
import { proposeReferenceChange, activateReferenceChange, referenceHash } from "../lib/reference-store.ts";

type Json = Record<string, unknown>;
function readJson<T>(path: string): T { return JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8")) as T; }
function required(id: string): ReferenceRecord {
  const record = referenceRecord(id);
  assert.ok(record, `missing reference record ${id}`);
  return record;
}
const ordinaryId = "param.national.term.ordinary_months";
const maximumId = "param.national.term.exceptional_max_months";
const outflowId = "param.policy.transaction.outflow_threshold_won";
const officialSource = "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=synthetic-test";

interface ReleaseRow { id: string; revision: number; sha256: string; seedSha256: string; payload: string }
interface StoredProposal { payload: string; status: string }
/** Synthetic, in-memory boundary: no case store, credentials or remote database. */
function fakeDatabase(active: ReleaseRow | null, proposal?: StoredProposal) {
  const writes: Array<{ sql: string; args: unknown[] }> = [];
  function prepare(sql: string) {
    let args: unknown[] = [];
    const statement = {
      sql,
      get args() { return args; },
      bind(...values: unknown[]) { args = values; return statement; },
      async first() {
        if (sql.includes("FROM legal_reference_releases")) return active;
        if (sql.includes("FROM legal_reference_changes")) return proposal ?? null;
        throw new Error(`Unexpected synthetic read: ${sql}`);
      },
      async run() { writes.push({ sql, args }); return { success: true, meta: { changes: 1 } }; },
    };
    return statement;
  }
  const database = {
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      writes.push(...statements.map(statement => ({ sql: statement.sql, args: statement.args })));
      return statements.map(() => ({ success: true, meta: { changes: 1 } }));
    },
  } as unknown as D1Database;
  return { database, writes };
}
function seedRow(): ReleaseRow {
  return { ...seedReferenceSnapshot(), seedSha256: REFERENCE_RELEASE.sha256, payload: JSON.stringify({ values: {} }) };
}
async function reviewedRow(values: Record<string, unknown>, metadata?: ReferenceSnapshot["metadata"]): Promise<ReleaseRow> {
  const provenance = metadata ?? Object.fromEntries(Object.keys(values).map(id => [id, {
    sourceUrls: [officialSource], effectiveFrom: "2026-10-01", reason: "Synthetic reviewed test change",
    reviewedAt: "2026-10-28T00:00:00Z", reviewedBy: "synthetic-reviewer", recordSha256: "b".repeat(64), basisType: "official_source",
  }]));
  return {
    id: "synthetic-reviewed-release", revision: 2, seedSha256: REFERENCE_RELEASE.sha256,
    sha256: await referenceSnapshotHash(REFERENCE_RELEASE.sha256, values, provenance),
    payload: JSON.stringify({ values, metadata: provenance }),
  };
}

test("all existing semantic catalogs are retained losslessly with their source pointers", () => {
  const catalogs = [
    ["lib/legal-catalog.json", "rules", "legal_rule", 50],
    ["lib/risk-catalog.json", "entries", "risk", 95],
    ["lib/legal-exceptions.json", "scenarios", "exception", 46],
    ["lib/reference-decision-tables.json", "workflows", "workflow", 46],
    ["lib/reference-decision-tables.json", "calculations", "calculation", 18],
    ["lib/reference-decision-tables.json", "agents", "agent_contract", 7],
  ] as const;
  for (const [path, key, kind, expectedCount] of catalogs) {
    const originals = readJson<Record<string, Json[]>>(path)[key];
    assert.equal(originals.length, expectedCount, path);
    assert.equal(REFERENCE_RECORDS.filter(record => record.kind === kind).length, originals.length + (kind === "agent_contract" ? 3 : 0), kind);
    for (const [index, original] of originals.entries()) {
      const matches = REFERENCE_RECORDS.filter(record => record.kind === kind && record.consumers.some(consumer => consumer.path === path && consumer.jsonPointer === `/${key}/${index}`));
      assert.equal(matches.length, 1, `${path} ${index}`);
      assert.deepEqual(matches[0].value, original, `${path} ${index}`);
    }
  }
  for (const path of ["lib/document-agent-field-contracts.json", "lib/field-applicability-contracts.json"]) {
    const { families } = readJson<{ families: Record<string, Json & { fields: Json[] | Record<string, Json> }> }>(path);
    assert.equal(Object.keys(families).length, 48, path);
    let expectedFields = 0;
    for (const [familyId, family] of Object.entries(families)) {
      const { fields, ...metadata } = family;
      const familyRows = REFERENCE_RECORDS.filter(record => record.kind === "document_family" && record.consumers.some(consumer => consumer.path === path && consumer.jsonPointer === `/families/${familyId}`));
      assert.equal(familyRows.length, 1, familyId);
      assert.deepEqual(familyRows[0].value, metadata);
      const entries = Object.entries(fields ?? {});
      expectedFields += entries.length;
      for (const [fieldId, field] of entries) {
        const fieldRows = REFERENCE_RECORDS.filter(record => record.kind === "field_contract" && record.consumers.some(consumer => consumer.path === path && consumer.jsonPointer === `/families/${familyId}/fields/${fieldId}`));
        assert.equal(fieldRows.length, 1, `${familyId}.${fieldId}`);
        assert.deepEqual(fieldRows[0].value, field);
      }
    }
    assert.equal(expectedFields, 524, path);
    assert.equal(REFERENCE_RECORDS.filter(record => record.kind === "field_contract" && record.consumers.some(consumer => consumer.path === path)).length, expectedFields);
  }
});

test("release digest and counts bind every unique record, including MCP implementation criteria", async () => {
  assert.equal(new Set(REFERENCE_RECORDS.map(record => record.id)).size, REFERENCE_RECORDS.length);
  assert.equal(REFERENCE_RELEASE.recordCount, REFERENCE_RECORDS.length);
  assert.equal(await referenceHash(REFERENCE_RECORDS), REFERENCE_RELEASE.sha256);
  const counts = Object.fromEntries([...new Set(REFERENCE_RECORDS.map(record => record.kind))].sort().map(kind => [kind, REFERENCE_RECORDS.filter(record => record.kind === kind).length]));
  assert.deepEqual(REFERENCE_RELEASE.byKind, counts);
  for (const path of ["scripts/calculator-mcp.ts", "lib/assessment.ts", "lib/transaction-review.ts", "lib/debt-resolution.ts", "lib/asset-resolution.ts"]) {
    const candidates = REFERENCE_RECORDS.filter(record => record.kind === "code_criterion" && record.consumers.some(consumer => consumer.path === path));
    assert.ok(candidates.length > 0, `executable criteria missing for ${path}`);
    assert.ok(candidates.every(record => !record.editable && record.runtimeMode === "compiled_guard"));
  }
});

test("source URLs are normalized and transitive workflow and exception authority is monitorable", () => {
  assert.ok(REFERENCE_RECORDS.every(record => record.sourceUrls.every(url => typeof url === "string")), "top-level source URLs must be strings, not imported source objects");
  const legalRules = new Map(REFERENCE_RECORDS.filter(record => record.kind === "legal_rule").map(record => [record.id, record]));
  for (const record of REFERENCE_RECORDS.filter(record => ["workflow", "exception"].includes(record.kind))) {
    const value = record.value as { ruleIds?: string[]; ruleRefs?: string[] };
    const linkedRules = (value.ruleIds ?? value.ruleRefs ?? []).map(id => legalRules.get(id)).filter((row): row is ReferenceRecord => !!row);
    for (const source of new Set(linkedRules.flatMap(rule => rule.sourceIds))) assert.ok(record.sourceIds.includes(source), `${record.id} missing source ${source}`);
    for (const url of new Set(linkedRules.flatMap(rule => rule.sourceUrls))) assert.ok(record.sourceUrls.includes(url), `${record.id} missing URL ${url}`);
  }
  const monitored = referenceMonitorRules();
  assert.ok(monitored.some(record => record.id === "workflow.WF-01" && record.sourceUrls.length > 0));
  assert.ok(monitored.every(record => !record.id.startsWith("code.")));
});

test("court/date scope and inherited verification are retained without promoting business policy into law", () => {
  const seoul = required("KR-PR-042");
  assert.deepEqual(seoul.courtIds, ["seoul"]);
  assert.equal(seoul.effectiveFrom, "2026-10-01");
  assert.match(String((seoul.value as Json).applies_to), /최초 신청/);
  assert.deepEqual(required("KR-PR-006").courtIds, []);
  assert.deepEqual(required("KR-PR-001").courtIds, [], "mixed nationwide and Seoul scope cannot become Seoul-only");
  assert.equal(required(outflowId).category, "application_policy");
  assert.equal(required("param.national.debt_caps.secured_won").category, "statute");
  assert.equal(required("param.seoul.living.median_income_tables").verification, "unverified");
  const risks = readJson<{ entries: Array<{ id: string; authority: string }> }>("lib/risk-catalog.json").entries;
  for (const risk of risks) {
    const row = required(`risk.${risk.id}`);
    assert.equal((row.value as Json).authority, risk.authority);
    if (["STATUTE", "SEOUL_PRACTICE", "PUBLIC_JUDGMENT"].includes(risk.authority)) assert.notEqual(row.category, "application_policy", `${risk.id} authority must not collapse to business policy`);
    assert.notEqual(row.verification, "source_verified", `${risk.id} was not reverified by inventory import`);
  }
});

test("every advertised editable seed validates, while compiled formulas and safety policies cannot be remotely edited", () => {
  const editable = REFERENCE_RECORDS.filter(record => record.editable);
  assert.ok(editable.length > 0);
  for (const record of editable) assert.doesNotThrow(() => validateReferenceValue(record, record.value), record.id);
  const locked = REFERENCE_RECORDS.filter(record => record.lockedSafetyInvariant || record.id.startsWith("param.compiled_policy.") || record.id.startsWith("param.formula."));
  assert.ok(locked.length > 20);
  for (const record of locked) {
    assert.equal(record.editable, false, record.id);
    assert.throws(() => validateReferenceValue(record, record.value), /REFERENCE_RECORD_REQUIRES_CODE_RELEASE/, record.id);
  }
  const code = REFERENCE_RECORDS.find(record => record.kind === "code_criterion")!;
  assert.throws(() => validateReferenceValue(code, code.value), /REFERENCE_RECORD_REQUIRES_CODE_RELEASE/);
});

test("parameter approval enforces money strings, positive periods, exact ratios and actual calendar dates", () => {
  const invalid: Array<[string, unknown]> = [
    ["param.national.debt_caps.secured_won", 1_500_000_000],
    ["param.national.debt_caps.secured_won", "1.5e9"],
    ["param.national.debt_caps.secured_won", "-1"],
    [ordinaryId, 0], [maximumId, 1201],
    ["param.seoul.shortened_term.senior_age_min", 0],
    ["param.seoul.shortened_term.wage_history_years", 0],
    ["param.seoul.living.baseline_ratio", { numerator: 3, denominator: 0 }],
    ["param.seoul.living.baseline_ratio", { numerator: 3.5, denominator: 5 }],
    ["param.national.debt_caps.comparison", "automatically_pass"],
    ["param.national.ruleset.effective_from", "2026-02-31"],
    ["param.national.ruleset.effective_from", "tomorrow"],
    ["param.national.objection_minimum.source_url", "javascript:alert(1)"],
    ["param.national.objection_minimum.source_url", "https://scourt.go.kr.attacker.invalid/rule"],
  ];
  for (const [id, value] of invalid) assert.throws(() => validateReferenceValue(required(id), value), `${id} accepted ${JSON.stringify(value)}`);
  assert.doesNotThrow(() => validateReferenceValue(required("param.national.ruleset.effective_from"), "2028-02-29"));
});

test("median-income updates accept seven integer-KRW strings for new years and reject float or incomplete tables", () => {
  const record = required("param.seoul.living.median_income_tables");
  const valid = { "2028": Array.from({ length: 7 }, (_, index) => String(3_000_000 + index)) };
  assert.doesNotThrow(() => validateReferenceValue(record, valid));
  for (const value of [
    {}, { "2028": Array(7).fill(3_000_000) }, { "2028": Array(7).fill("3000000.5") },
    { "2028": Array(7).fill("0") }, { "2028": Array(6).fill("3000000") }, { invalid: Array(7).fill("3000000") },
  ]) assert.throws(() => validateReferenceValue(record, value), /INVALID_REFERENCE_VALUE/);
});

test("nested supplementary money and decimal ratios preserve their numeric-string contracts", () => {
  const record = required("param.seoul.living.supplementary");
  type Supplementary = { embedded_housing: Record<string, string>; other_living: Record<string, string> };
  const valid = structuredClone(record.value) as Supplementary;
  valid.embedded_housing["1"] = "300000";
  valid.other_living.incomeMedianRatioExclusiveFloor = "1.75";
  assert.doesNotThrow(() => validateReferenceValue(record, valid));
  for (const amount of ["NaN", "-1", "3e5", "300000.5"]) {
    const invalid = structuredClone(record.value) as Supplementary;
    invalid.embedded_housing["1"] = amount;
    assert.throws(() => validateReferenceValue(record, invalid), `accepted nested money ${amount}`);
  }
  for (const ratio of ["NaN", "-0.1", "1e2"]) {
    const invalid = structuredClone(record.value) as Supplementary;
    invalid.other_living.incomeMedianRatioExclusiveFloor = ratio;
    assert.throws(() => validateReferenceValue(record, invalid), `accepted nested ratio ${ratio}`);
  }
});

test("editable prompt review preserves its declared placeholder contract", () => {
  const prompt = REFERENCE_RECORDS.find(record => record.kind === "prompt" && record.editable);
  assert.ok(prompt);
  assert.doesNotThrow(() => validateReferenceValue(prompt, `${String(prompt.value)}\nSynthetic editorial clarification.`));
  assert.throws(() => validateReferenceValue(prompt, `${String(prompt.value)} {{injectedPlaceholder}}`), /REFERENCE_PROMPT_PLACEHOLDERS_CHANGED/);
});

test("seed records and nested values cannot be mutated through exported lookup or current-record views", () => {
  const table = required("param.seoul.living.median_income_tables");
  assert.ok(Object.isFrozen(REFERENCE_RELEASE));
  assert.ok(Object.isFrozen(REFERENCE_RECORDS));
  assert.ok(Object.isFrozen(table));
  assert.throws(() => { (table.value as Record<string, string[]>)["2026"][0] = "1"; }, TypeError);
  assert.throws(() => { table.sourceUrls.push("https://unapproved.invalid"); }, TypeError);
  const view = currentReferenceRecord(table.id)!;
  assert.throws(() => { (view.value as Record<string, string[]>)["2026"].push("1"); }, TypeError);
  assert.equal(referenceParameter<Record<string, string[]>>(table.id)["2026"].length, 7);
});

test("parallel and nested request snapshots retain separate parameter values and restore their parent context", async () => {
  assert.equal(currentReferenceSnapshot(), undefined);
  const results = await Promise.all([48, 72].map(months => runWithReferenceSnapshot({ id: `synthetic-${months}`, revision: 2, sha256: String(months).repeat(32), values: { [maximumId]: months } }, async () => {
    await Promise.resolve();
    assert.equal(referenceParameter(maximumId), months);
    runWithReferenceSnapshot(seedReferenceSnapshot(), () => assert.equal(referenceParameter(maximumId), 60));
    await Promise.resolve();
    return [currentReferenceSnapshot()?.id, referenceParameter(maximumId)];
  })));
  assert.deepEqual(results, [["synthetic-48", 48], ["synthetic-72", 72]]);
  assert.equal(currentReferenceSnapshot(), undefined);
  assert.equal(referenceParameter(maximumId), 60);
});

test("request boundaries freeze nested values even when a caller supplied a shallow-frozen container", () => {
  const ratio = { numerator: 3, denominator: 5 };
  const values = Object.freeze({ "param.seoul.living.baseline_ratio": ratio });
  const snapshot = Object.freeze({ id: "synthetic-shallow-frozen", revision: 2, sha256: "c".repeat(64), values });
  runWithReferenceSnapshot(snapshot, () => {
    assert.ok(Object.isFrozen(ratio));
    assert.throws(() => { ratio.numerator = 4; }, TypeError);
    assert.equal(referenceParameter<{ numerator: number }>("param.seoul.living.baseline_ratio").numerator, 3);
  });
});

test("active snapshot load verifies its digest and rejects unknown IDs, locked guards and missing provenance", async () => {
  const row = await reviewedRow({ [ordinaryId]: 24 });
  const loaded = await loadReferenceSnapshot(fakeDatabase(row).database);
  assert.equal(loaded.values[ordinaryId], 24);
  assert.equal(loaded.sha256, row.sha256);
  assert.ok(Object.isFrozen(loaded.values));
  const tampered = { ...row };
  const parsed = JSON.parse(tampered.payload) as { values: Record<string, unknown> };
  parsed.values[ordinaryId] = 25;
  tampered.payload = JSON.stringify(parsed);
  await assert.rejects(loadReferenceSnapshot(fakeDatabase(tampered).database), /REFERENCE_RELEASE_INTEGRITY_FAILED/);
  await assert.rejects(loadReferenceSnapshot(fakeDatabase(await reviewedRow({ "param.unknown": 1 })).database), /UNKNOWN_REFERENCE_ID/);
  await assert.rejects(loadReferenceSnapshot(fakeDatabase(await reviewedRow({ "param.compiled_policy.finalization": required("param.compiled_policy.finalization").value })).database), /REFERENCE_RECORD_REQUIRES_CODE_RELEASE/);
  await assert.rejects(loadReferenceSnapshot(fakeDatabase(await reviewedRow({ [ordinaryId]: 24 }, {})).database), /REFERENCE_CHANGE_PROVENANCE_MISSING/);
});

test("seed fallback accepts an unprovisioned store but refuses stale reviewed releases and invalid seed payloads", async () => {
  assert.deepEqual(await loadReferenceSnapshot(), seedReferenceSnapshot());
  assert.deepEqual(await loadReferenceSnapshot(fakeDatabase(null).database), seedReferenceSnapshot());
  const oldSeed = { ...seedRow(), seedSha256: "d".repeat(64) };
  assert.deepEqual(await loadReferenceSnapshot(fakeDatabase(oldSeed).database), seedReferenceSnapshot());
  await assert.rejects(loadReferenceSnapshot(fakeDatabase({ ...oldSeed, revision: 2 }).database), /REFERENCE_RELEASE_CODE_MISMATCH/);
  await assert.rejects(loadReferenceSnapshot(fakeDatabase({ ...seedRow(), payload: JSON.stringify({ values: { [ordinaryId]: 24 } }) }).database), /REFERENCE_RELEASE_INTEGRITY_FAILED/);
});

test("stale proposal clients cannot insert a change against an unexpected active release", async () => {
  const { database, writes } = fakeDatabase(seedRow());
  await assert.rejects(proposeReferenceChange(database, { id: ordinaryId, value: 24, reason: "Synthetic reviewed statutory change", sourceUrls: [officialSource], expectedActiveSha256: "0".repeat(64) }, "synthetic-author"), /REFERENCE_RELEASE_CONFLICT/);
  assert.equal(writes.length, 0);
});

test("legal proposals require official authority while business policy can cite its internal rationale", async () => {
  const { database, writes } = fakeDatabase(seedRow());
  const base = { value: "700000", reason: "Synthetic business review threshold change", sourceUrls: [] };
  const policy = await proposeReferenceChange(database, { ...base, id: outflowId }, "synthetic-author");
  assert.equal(policy.basisType, "internal_policy");
  assert.equal(policy.status, "pending_review");
  assert.equal(writes.length, 1);
  await assert.rejects(proposeReferenceChange(database, { ...base, id: "param.national.debt_caps.secured_won" }, "synthetic-author"), /OFFICIAL_REFERENCE_SOURCE_REQUIRED/);
  await assert.rejects(proposeReferenceChange(database, { ...base, id: ordinaryId, value: 24, sourceUrls: ["https://scourt.go.kr.attacker.invalid/"] }, "synthetic-author"), /OFFICIAL_REFERENCE_SOURCE_REQUIRED/);
});

test("proposal effective dates must exist in the calendar rather than normalize into another month", async () => {
  const { database, writes } = fakeDatabase(seedRow());
  await assert.rejects(proposeReferenceChange(database, { id: ordinaryId, value: 24, reason: "Synthetic effective date review", sourceUrls: [officialSource], effectiveFrom: "2026-02-31" }, "synthetic-author"), /INVALID_REFERENCE_EFFECTIVE_DATE/);
  assert.equal(writes.length, 0);
});

test("activation binds authority, effective date, reviewer and value into the new immutable release identity", async () => {
  const candidate = { referenceId: ordinaryId, value: 24, baseSha256: REFERENCE_RELEASE.sha256, sourceUrls: [officialSource], effectiveFrom: "2026-10-01", reason: "Synthetic reviewed term change", basisType: "official_source" };
  const { database, writes } = fakeDatabase(seedRow(), { payload: JSON.stringify(candidate), status: "pending_review" });
  const active = await activateReferenceChange(database, "synthetic-proposal", REFERENCE_RELEASE.sha256, "synthetic-human-reviewer");
  assert.equal(active.revision, 2);
  assert.notEqual(active.sha256, REFERENCE_RELEASE.sha256);
  assert.equal(active.sha256, await referenceSnapshotHash(REFERENCE_RELEASE.sha256, active.values, active.metadata));
  assert.equal(active.metadata?.[ordinaryId].reviewedBy, "synthetic-human-reviewer");
  assert.equal(active.metadata?.[ordinaryId].effectiveFrom, "2026-10-01");
  assert.deepEqual(active.metadata?.[ordinaryId].sourceUrls, [officialSource]);
  assert.equal(writes.length, 3);
  runWithReferenceSnapshot(active, () => {
    const current = currentReferenceRecord(ordinaryId)!;
    assert.equal(current.value, 24);
    assert.equal(current.effectiveFrom, "2026-10-01");
    assert.deepEqual(current.sourceUrls, [officialSource]);
    assert.equal(current.seedRecordSha256, required(ordinaryId).sha256);
    assert.notEqual(current.sha256, required(ordinaryId).sha256);
  });
  const changedMetadata = { ...active.metadata, [ordinaryId]: { ...active.metadata![ordinaryId], effectiveFrom: "2026-10-02" } };
  assert.notEqual(await referenceSnapshotHash(REFERENCE_RELEASE.sha256, active.values, changedMetadata), active.sha256);
  assert.equal(required(ordinaryId).value, 36);
});

test("activation rejects impossible term ordering, future effective dates and stale review bases before writing", async () => {
  for (const [candidate, expected] of [
    [{ referenceId: ordinaryId, value: 61, effectiveFrom: "2026-10-01", baseSha256: REFERENCE_RELEASE.sha256 }, /REFERENCE_TERM_INVARIANT/],
    [{ referenceId: ordinaryId, value: 24, effectiveFrom: "9999-12-31", baseSha256: REFERENCE_RELEASE.sha256 }, /REFERENCE_CHANGE_NOT_YET_EFFECTIVE/],
    [{ referenceId: ordinaryId, value: 24, effectiveFrom: "2026-10-01", baseSha256: "e".repeat(64) }, /REFERENCE_RELEASE_CONFLICT/],
  ] as const) {
    const { database, writes } = fakeDatabase(seedRow(), { payload: JSON.stringify({ ...candidate, sourceUrls: [officialSource], reason: "Synthetic reviewed change", basisType: "official_source" }), status: "pending_review" });
    await assert.rejects(activateReferenceChange(database, "synthetic-proposal", REFERENCE_RELEASE.sha256, "synthetic-reviewer"), expected);
    assert.equal(writes.length, 0);
  }
});
