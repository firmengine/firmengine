import test from "node:test";
import assert from "node:assert/strict";
import { createCase, currentFacts, normalizeMoney, type CaseData } from "../lib/domain.ts";
import { prepareReferenceCaseImport, referenceDatasetSha256, type ReferenceTestDataset } from "../lib/reference-case-import.ts";

const docHash = "a".repeat(64);
function fixture() {
  const data = createCase("합성 추출평가 reference import fixture", "target-case", "2026-10-28");
  data.documents = [{ id: "target-doc", name: `synthetic-${docHash.slice(0, 12)}.pdf`, sha256: docHash, status: "active", pages: [1] }];
  data.pages = [{ documentId: "target-doc", page: 1, role: "evidence", text: "source quote for reference data" }];
  data.context.applicant = { name: "old OCR name", address: "old OCR address", residentIdMasked: "old-mask", statement: "old statement" };
  data.facts.push({ id: "old-fact", logicalId: "old", version: 1, subjectId: "target-case", key: "income.monthly", value: "999", state: "reported", recognition: "unreviewed", refs: [{ documentId: "target-doc", page: 1, sourceHash: docHash, quote: "source quote" }], validation: [], createdAt: "2026-10-28T00:00:00.000Z" });
  const field = { fieldId: "field-1", canonicalKey: "reference.identity_residence_record.identity.name", rawSourceKey: "identity.name", subjectType: "case" as const, presenceState: "present" as const, value: "New source name", rawValue: "New source name", refs: [{ sourceCaseId: "source-case", sourceDocumentId: "source-doc", page: 1, sourceHash: docHash, quote: "source quote" }], sourceMetadata: { familyId: "identity_residence_record", localId: "identity.name", partyRole: "applicant", normalizedValue: "New source name" } };
  const dataset: ReferenceTestDataset = { schemaVersion: "firmengine-reference-test-dataset/v1", sourceCaseId: "source-case", version: "synthetic-v1", documents: [{ sourceDocumentId: "source-doc", targetDocumentId: "target-doc", sourceSha256: docHash, targetSha256: docHash, pages: [{ page: 1, sourceRole: "evidence", targetRole: "evidence" }] }], fields: [field], objects: { incomes: [], debts: [], assets: [], transactions: [] }, applicant: { fieldBindings: { name: "field-1" } } };
  return { data, dataset };
}
async function apply(data: CaseData, dataset: ReferenceTestDataset, expectedRevision = data.context.revision) {
  return prepareReferenceCaseImport({ data, targetCaseId: "target-case", expectedRevision, dataset, datasetSha256: await referenceDatasetSha256(dataset), importReason: "Synthetic source-data replacement validation", actor: "test-actor" });
}

test("source-bound reference import retires OCR facts, clears stale identity, and does not invent proof or review", async () => {
  const { data, dataset } = fixture();
  const result = await apply(data, dataset);
  assert.equal(result.data.context.revision, data.context.revision + 1);
  assert.equal(result.data.context.applicant?.name, "New source name");
  assert.equal(result.data.context.applicant?.address, undefined);
  assert.equal(currentFacts(result.data).some(fact => fact.id === "old-fact"), false);
  const retired = result.data.facts.find(fact => fact.supersedes === "old-fact")!;
  assert.equal(retired.state, "retracted");
  assert.equal(retired.recognition, "unreviewed");
  const imported = currentFacts(result.data).find(fact => fact.logicalId.startsWith("reference:"))!;
  assert.equal(imported.state, "reported");
  assert.equal(imported.recognition, "unreviewed");
  assert.equal(imported.sourceVerification, undefined);
  assert.equal(imported.reviewer, undefined);
  assert.equal(result.data.referenceTest?.finalSubmissionProhibited, true);
});

test("absent, masked, unknown, and conflicting observations remain explicit nulls and never become zero", async () => {
  const { data, dataset } = fixture();
  const states = ["absent", "masked", "unknown", "conflict"] as const;
  dataset.fields = states.map((presenceState, index) => ({ fieldId: `field-${index}`, canonicalKey: `reference.x.f${index}`, rawSourceKey: `f${index}`, subjectType: "case", presenceState, value: null, sourceMetadata: { familyId: "x", localId: `f${index}`, normalizedValue: null }, refs: [{ sourceCaseId: "source-case", sourceDocumentId: "source-doc", page: 1, sourceHash: docHash, quote: "source quote" }] }));
  delete dataset.applicant;
  const result = await apply(data, dataset);
  const imported = currentFacts(result.data).filter(fact => fact.logicalId.startsWith("reference:"));
  assert.deepEqual(imported.map(fact => fact.value), [null, null, null, null]);
  assert.deepEqual(imported.map(fact => fact.state), ["reported", "reported", "reported", "disputed"]);
  assert.ok(imported.every(fact => fact.numeric === undefined));
  assert.deepEqual(imported.map(fact => fact.validation[0]?.code), ["REFERENCE_ABSENT", "REFERENCE_MASKED", "REFERENCE_UNKNOWN", "REFERENCE_CONFLICT"]);
});

test("canonical digest, source map, target revision, and source metadata are binding gates", async () => {
  const { data, dataset } = fixture();
  const digest = await referenceDatasetSha256(dataset);
  await assert.rejects(() => prepareReferenceCaseImport({ data, targetCaseId: "target-case", expectedRevision: 99, dataset, datasetSha256: digest, importReason: "reason", actor: "actor" }), /revision changed/);
  await assert.rejects(() => prepareReferenceCaseImport({ data, targetCaseId: "target-case", expectedRevision: data.context.revision, dataset, datasetSha256: "0".repeat(64), importReason: "reason", actor: "actor" }), /digest does not match/);
  const changed = structuredClone(dataset); changed.documents[0]!.targetDocumentId = "other-doc";
  await assert.rejects(() => apply(data, changed), /exact synthetic document binding/);
  const metadataMismatch = structuredClone(dataset); metadataMismatch.fields[0]!.sourceMetadata!.normalizedValue = "different";
  await assert.rejects(() => apply(data, metadataMismatch), /normalizedValue must equal/);
});

test("numeric normalization requires source-explicit raw text and unit, including for structured values", async () => {
  const { data, dataset } = fixture();
  delete dataset.applicant;
  dataset.fields[0] = { ...dataset.fields[0]!, value: { amount: "3", currency: "KRW" }, rawValue: "3", sourceUnit: "thousand_won", numeric: normalizeMoney("3", "thousand_won", "KRW"), sourceMetadata: { ...dataset.fields[0]!.sourceMetadata!, normalizedValue: { amount: "3", currency: "KRW" } } };
  await assert.rejects(() => apply(data, dataset), /structured normalized amount must match/);
  dataset.fields[0]!.value = { amount: "3000", currency: "KRW" };
  dataset.fields[0]!.sourceMetadata!.normalizedValue = { amount: "3000", currency: "KRW" };
  assert.equal((await apply(data, dataset)).data.facts.at(-1)?.numeric?.amountWon, "3000");
  delete dataset.fields[0]!.sourceUnit;
  await assert.rejects(() => apply(data, dataset), /explicit raw source text and unit/);
});

test("same raw dataset is idempotent; previously imported data cannot be replayed after a later revision", async () => {
  const { data, dataset } = fixture();
  const first = await apply(data, dataset);
  const again = await apply(first.data, dataset);
  assert.equal(again.noOp, true);
  assert.equal(again.data.context.revision, first.data.context.revision);
  const laterDataset = structuredClone(dataset); laterDataset.version = "synthetic-v2";
  const second = await apply(first.data, laterDataset);
  await assert.rejects(() => apply(second.data, dataset), /already imported earlier/);
});
