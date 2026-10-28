import test from "node:test";
import assert from "node:assert/strict";
import { createCase, normalizeMoney, type CaseData, type Fact } from "../lib/domain.ts";
import { canonicalSha256, storedCaseMatchesImport, STRUCTURED_CASE_IMPORT_SCHEMA, structuredCaseManifestSha256, validateStructuredCaseImport } from "../lib/structured-case-import.ts";

function fixture(): CaseData {
  const scenarioId = "synthetic-eval-import-fixture-v1";
  const data = createCase("Synthetic import fixture", scenarioId, "2026-10-28");
  const value = { currency: "KRW", minorUnits: "100000", unit: "KRW" };
  const sourceRecordId = `${scenarioId}-source-1`;
  data.structuredTest = { mode: "assumed_extracted_synthetic", scenarioId, sourceRecords: [{ id: sourceRecordId, recordType: "income", recordId: `${scenarioId}-income-1`, data: { net: { fieldId: "income.net", presence: "present", value, rawValue: "100000", sourceUnit: "KRW" } } }] };
  const fact: Fact = { id: `${scenarioId}-fact-1`, logicalId: `${scenarioId}-fact-1`, version: 1, subjectId: `${scenarioId}-income-1`, key: "income.net", value, rawValue: "100000", sourceUnit: "KRW", numeric: normalizeMoney("100000", "KRW", "KRW"), state: "reported", recognition: "unreviewed", refs: [], structuredRefs: [{ sourceRecordId, jsonPointer: "/net/value" }], validation: [] };
  data.facts.push(fact);
  data.incomes.push({ id: fact.subjectId, kind: "wage", label: "synthetic income", net: normalizeMoney("100000", "KRW", "KRW"), amountBasis: "monthly", periodMonths: 1, recognition: "unreviewed", factIds: [fact.id] });
  return data;
}

async function envelope(caseData = fixture()) {
  const scenarioId = caseData.context.id;
  const entry = { scenarioId, caseData, caseDataSha256: await canonicalSha256(caseData) };
  const manifestSha256 = await structuredCaseManifestSha256([entry]);
  const body = { schemaVersion: STRUCTURED_CASE_IMPORT_SCHEMA, manifestSha256, cases: [entry] };
  return { body, bodySha256: await canonicalSha256(body) };
}

test("canonical hashing is key-order stable and manifest binds ordered case hashes", async () => {
  assert.equal(await canonicalSha256({ b: 2, a: 1 }), await canonicalSha256({ a: 1, b: 2 }));
  const { body, bodySha256 } = await envelope();
  const accepted = await validateStructuredCaseImport(body, bodySha256);
  assert.equal(accepted.cases.length, 1);
  assert.notEqual(body.manifestSha256, bodySha256);
  const projected = await structuredCaseManifestSha256([{ scenarioId: "synthetic-extra-v1", caseDataSha256: "a".repeat(64), ignored: "not part of contract" } as { scenarioId: string; caseDataSha256: string } & { ignored: string }]);
  assert.equal(projected, await canonicalSha256({ schemaVersion: STRUCTURED_CASE_IMPORT_SCHEMA, cases: [{ scenarioId: "synthetic-extra-v1", caseDataSha256: "a".repeat(64) }] }));
});

test("idempotent retry verifies both marker and exact stored CaseData; changed stored data conflicts", async () => {
  const { body } = await envelope();
  const entry = body.cases[0]!;
  const stored = structuredClone(entry.caseData);
  (stored.structuredTest as NonNullable<CaseData["structuredTest"]> & { datasetManifestSha256: string; caseDataSha256: string }).datasetManifestSha256 = body.manifestSha256;
  (stored.structuredTest as NonNullable<CaseData["structuredTest"]> & { datasetManifestSha256: string; caseDataSha256: string }).caseDataSha256 = entry.caseDataSha256;
  assert.equal(await storedCaseMatchesImport(stored, entry, body.manifestSha256), true);
  stored.incomes[0]!.label = "modified after import";
  assert.equal(await storedCaseMatchesImport(stored, entry, body.manifestSha256), false);
});

test("rejects missing or wrong canonical body and per-case hashes", async () => {
  const { body, bodySha256 } = await envelope();
  await assert.rejects(() => validateStructuredCaseImport(body, null), /hash headers/);
  await assert.rejects(() => validateStructuredCaseImport(body, "0".repeat(64)), /body hash mismatch/);
  const changed = structuredClone(body); changed.cases[0]!.caseData.context.caseName += " changed";
  const changedHash = await canonicalSha256(changed);
  await assert.rejects(() => validateStructuredCaseImport(changed, changedHash), /Case data hash mismatch/);
  assert.equal(bodySha256.length, 64);
});

test("rejects non-synthetic IDs, duplicate scenarios, and manifest tampering", async () => {
  const { body } = await envelope();
  const badId = structuredClone(body); badId.cases[0]!.scenarioId = "real-client-case-1";
  await assert.rejects(async () => validateStructuredCaseImport(badId, await canonicalSha256(badId)), /synthetic namespace/);
  const duplicate = structuredClone(body); duplicate.cases.push(structuredClone(duplicate.cases[0]!));
  await assert.rejects(async () => validateStructuredCaseImport(duplicate, await canonicalSha256(duplicate)), /unique/);
  const badManifest = structuredClone(body); badManifest.manifestSha256 = "f".repeat(64);
  await assert.rejects(async () => validateStructuredCaseImport(badManifest, await canonicalSha256(badManifest)), /manifest hash mismatch/);
});

test("rejects PDFs, pages, and fabricated human or legal acceptance", async () => {
  for (const mutate of [
    (data: CaseData) => { data.documents.push({ id: "doc", sha256: "0".repeat(64), name: "synthetic.pdf", type: "application", status: "active", pages: [1] }); },
    (data: CaseData) => { data.pages.push({ documentId: "doc", page: 1, role: "evidence" }); },
    (data: CaseData) => { data.facts[0]!.state = "verified"; },
    (data: CaseData) => { data.facts[0]!.recognition = "accepted"; },
    (data: CaseData) => { data.incomes[0]!.recognition = "accepted"; },
    (data: CaseData) => { data.context.ruleApplicationReviewed = true; },
    (data: CaseData) => { data.context.approvedMonthlyPayment = normalizeMoney("100000", "KRW", "KRW"); },
  ]) {
    const data = fixture(); mutate(data); const { body } = await envelope(data);
    await assert.rejects(async () => validateStructuredCaseImport(body, await canonicalSha256(body)), /forbidden/);
  }
});

test("rejects expected outputs and invalid or missing source pointers", async () => {
  const expected = fixture() as CaseData & { expectedCalculation?: unknown };
  expected.expectedCalculation = { monthlyIncomeWon: "100000" };
  let batch = await envelope(expected);
  await assert.rejects(async () => validateStructuredCaseImport(batch.body, batch.bodySha256), /forbidden/);
  for (const mutate of [
    (data: CaseData) => { data.facts[0]!.structuredRefs = []; },
    (data: CaseData) => { data.facts[0]!.value = { currency: "KRW", minorUnits: "100001", unit: "KRW" }; },
    (data: CaseData) => { (data.structuredTest!.sourceRecords[0]!.data as Record<string, any>).net.presence = "unknown"; },
    (data: CaseData) => { (data.structuredTest!.sourceRecords[0]!.data as Record<string, any>).net.presence = "unknown"; (data.structuredTest!.sourceRecords[0]!.data as Record<string, any>).net.value = "unbound non-null"; },
  ]) {
    const data = fixture(); mutate(data); batch = await envelope(data);
    await assert.rejects(async () => validateStructuredCaseImport(batch.body, batch.bodySha256), /Unbound synthetic fact/);
  }
});
