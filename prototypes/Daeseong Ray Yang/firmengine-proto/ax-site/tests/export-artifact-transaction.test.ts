import test from "node:test";
import assert from "node:assert/strict";
import { commitExportArtifactTransaction } from "../lib/export-artifact-transaction.ts";

type RecordRow = { id: string; objectKey: string; kind: string };
type Artifact = { record: RecordRow; objectKey: string; bytes: Uint8Array; mime: string };

function fixture(): {
  artifacts: Artifact[];
  objects: Map<string, Uint8Array>;
  rows: Map<string, RecordRow>;
  manifest: string[];
  other: { record: RecordRow; objectKey: string };
} {
  const artifacts = ["doc-a", "doc-b"].map((id): Artifact => {
    const objectKey = `cases/case-1/artifacts/${id}`;
    return { record: { id, objectKey, kind: id }, objectKey, bytes: new TextEncoder().encode(id), mime: "application/octet-stream" };
  });
  const other = { record: { id: "other-export", objectKey: "cases/case-1/artifacts/other-export", kind: "other" }, objectKey: "cases/case-1/artifacts/other-export" };
  return { artifacts, objects: new Map([[other.objectKey, new Uint8Array([9])]]), rows: new Map([[other.record.id, other.record]]), manifest: [other.record.id], other };
}

function removeOwnedRows(rows: Map<string, RecordRow>, records: readonly RecordRow[]) {
  for (const record of records) {
    const current = rows.get(record.id);
    if (current?.objectKey === record.objectKey) rows.delete(record.id);
  }
}

test("partial upload failure removes the ambiguous target and earlier invocation uploads", async () => {
  const h = fixture(), failure = new Error("upload failed after writing bytes");
  let uploadCount = 0;
  await assert.rejects(commitExportArtifactTransaction({
    artifacts: h.artifacts,
    upload: async (key, bytes) => {
      h.objects.set(key, bytes);
      uploadCount++;
      if (uploadCount === 2) throw failure;
    },
    persistRecords: async () => assert.fail("records must not persist after upload failure"),
    commitManifest: async () => assert.fail("manifest must not commit after upload failure"),
    deleteRecords: async (records) => removeOwnedRows(h.rows, records),
    deleteObject: async (key) => { h.objects.delete(key); },
  }), (error) => error === failure);
  assert.equal(h.objects.has(h.artifacts[0].objectKey), false);
  assert.equal(h.objects.has(h.artifacts[1].objectKey), false);
  assert.equal(h.rows.has(h.other.record.id), true);
});

test("partial record persistence failure removes this invocation rows and objects only", async () => {
  const h = fixture(), failure = new Error("database batch failed after first insert");
  await assert.rejects(commitExportArtifactTransaction({
    artifacts: h.artifacts,
    upload: async (key, bytes) => { h.objects.set(key, bytes); },
    persistRecords: async (records) => {
      h.rows.set(records[0]!.id, records[0]!);
      throw failure;
    },
    commitManifest: async () => assert.fail("manifest must not commit after insert failure"),
    deleteRecords: async (records) => removeOwnedRows(h.rows, records),
    deleteObject: async (key) => { h.objects.delete(key); },
  }), (error) => error === failure);
  assert.deepEqual([...h.rows.keys()], [h.other.record.id]);
  assert.deepEqual([...h.objects.keys()], [h.other.objectKey]);
});

test("manifest commit outcome uncertainty preserves staged records for reconciliation", async () => {
  const h = fixture(), conflict = Object.assign(new Error("case changed"), { status: 409 });
  await assert.rejects(commitExportArtifactTransaction({
    artifacts: h.artifacts,
    upload: async (key, bytes) => { h.objects.set(key, bytes); },
    persistRecords: async (records) => { for (const record of records) h.rows.set(record.id, record); },
    commitManifest: async () => { throw conflict; },
    deleteRecords: async (records) => removeOwnedRows(h.rows, records),
    deleteObject: async (key) => { h.objects.delete(key); },
  }), (error) => error === conflict && (error as Error & { status: number }).status === 409);
  assert.deepEqual([...h.rows.keys()], [h.other.record.id, "doc-a", "doc-b"]);
  assert.deepEqual([...h.objects.keys()], [h.other.objectKey, h.artifacts[0]!.objectKey, h.artifacts[1]!.objectKey]);
  assert.deepEqual(h.manifest, [h.other.record.id], "a known rejected commit needs later orphan reconciliation");
});

test("successful manifest commit preserves rows and objects and returns commit result", async () => {
  const h = fixture();
  let committed = false;
  const result = await commitExportArtifactTransaction({
    artifacts: h.artifacts,
    upload: async (key, bytes) => { h.objects.set(key, bytes); },
    persistRecords: async (records) => { for (const record of records) h.rows.set(record.id, record); },
    commitManifest: async (records) => { h.manifest = records.map((record) => record.id); committed = true; return "saved"; },
    deleteRecords: async (records) => removeOwnedRows(h.rows, records),
    deleteObject: async (key) => { h.objects.delete(key); },
  });
  assert.equal(result, "saved");
  assert.equal(committed, true);
  assert.deepEqual(h.manifest, ["doc-a", "doc-b"]);
  assert.ok(h.rows.has("doc-a") && h.rows.has("doc-b"));
  assert.ok(h.objects.has(h.artifacts[0]!.objectKey) && h.objects.has(h.artifacts[1]!.objectKey));
});

test("cleanup failures are reported while the original failure and other exports are preserved", async () => {
  const h = fixture(), conflict = new Error("manifest CAS conflict"), observed: unknown[] = [];
  const first = h.artifacts[0]!, second = h.artifacts[1]!;
  await assert.rejects(commitExportArtifactTransaction({
    artifacts: h.artifacts,
    upload: async (key, bytes) => { h.objects.set(key, bytes); },
    persistRecords: async (records) => { for (const record of records) h.rows.set(record.id, record); throw conflict; },
    commitManifest: async () => assert.fail("manifest not attempted after persistence failure"),
    deleteRecords: async () => { throw new Error("row cleanup unavailable"); },
    deleteObject: async (key) => {
      if (key === first.objectKey) throw new Error("one object cleanup unavailable");
      h.objects.delete(key);
    },
    onCleanupFailure: (report) => { observed.push(report); },
  }), (error) => error === conflict && (error as Error & { artifactCleanupErrors?: unknown[] }).artifactCleanupErrors?.length === 2);
  assert.equal(observed.length, 1);
  assert.equal(h.rows.has(h.other.record.id), true);
  assert.equal(h.objects.has(h.other.objectKey), true);
  assert.equal(h.objects.has(first.objectKey), true, "failed deletion is visible to cleanup reporting");
  assert.equal(h.objects.has(second.objectKey), false, "cleanup continued after a different deletion failed");
});

test("post-commit logging failure propagates without deleting committed export artifacts", async () => {
  const h = fixture(), loggingError = new Error("event write failed");
  await assert.rejects(commitExportArtifactTransaction({
    artifacts: h.artifacts,
    upload: async (key, bytes) => { h.objects.set(key, bytes); },
    persistRecords: async (records) => { for (const record of records) h.rows.set(record.id, record); },
    commitManifest: async (records) => { h.manifest = records.map((record) => record.id); return "committed"; },
    deleteRecords: async (records) => removeOwnedRows(h.rows, records),
    deleteObject: async (key) => { h.objects.delete(key); },
    afterCommit: async () => { throw loggingError; },
  }), (error) => error === loggingError);
  assert.deepEqual(h.manifest, ["doc-a", "doc-b"]);
  assert.ok(h.rows.has("doc-a") && h.rows.has("doc-b"));
  assert.ok(h.objects.has(h.artifacts[0]!.objectKey) && h.objects.has(h.artifacts[1]!.objectKey));
});


test("D1 manifest committed but acknowledgement lost never deletes referenced R2 or SQL rows", async () => {
  const h = fixture(), ackLost = new Error("D1_COMMIT_ACK_LOST");
  const reports: unknown[] = [];
  await assert.rejects(commitExportArtifactTransaction({
    artifacts: h.artifacts,
    upload: async (key, bytes) => { h.objects.set(key, bytes); },
    persistRecords: async (records) => { for (const row of records) h.rows.set(row.id, row); },
    commitManifest: async (records) => {
      h.manifest = records.map(row => row.id); // Authoritative D1 commit completed.
      throw ackLost; // A transport failure hides success from the writer.
    },
    deleteRecords: async () => assert.fail("never delete live DB rows on uncertain commit"),
    deleteObject: async () => assert.fail("never delete live R2 bytes on uncertain commit"),
    onCommitUncertain: (report) => { reports.push(report); },
  }), error => error === ackLost);
  assert.deepEqual(h.manifest, ["doc-a", "doc-b"]);
  assert.ok(h.rows.has("doc-a") && h.rows.has("doc-b"));
  assert.ok(h.objects.has(h.artifacts[0]!.objectKey) && h.objects.has(h.artifacts[1]!.objectKey));
  assert.equal(reports.length, 1, "operator should be told reconciliation is required");
});

test("failure of uncertain-commit reporting cannot trigger destructive cleanup", async () => {
  const h = fixture(), ackLost = new Error("D1_RESPONSE_UNAVAILABLE");
  await assert.rejects(commitExportArtifactTransaction({
    artifacts: h.artifacts,
    upload: async (key, bytes) => { h.objects.set(key, bytes); },
    persistRecords: async (records) => { for (const row of records) h.rows.set(row.id, row); },
    commitManifest: async (records) => { h.manifest = records.map(row => row.id); throw ackLost; },
    deleteRecords: async () => assert.fail("no destructive cleanup"),
    deleteObject: async () => assert.fail("no destructive cleanup"),
    onCommitUncertain: async () => { throw new Error("EVENT_LOG_UNAVAILABLE"); },
  }), error => error === ackLost);
  assert.deepEqual(h.manifest, ["doc-a", "doc-b"]);
  assert.ok(h.rows.has("doc-a") && h.rows.has("doc-b"));
  assert.ok(h.objects.has(h.artifacts[0]!.objectKey) && h.objects.has(h.artifacts[1]!.objectKey));
});
