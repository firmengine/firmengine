import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { commitExportArtifactTransaction } from "../../../lib/export-artifact-transaction.ts";

// An isolated reproduction of app/api/cases/[id]/export/route.ts lines 95,
// 103-135: every HTTP POST allocates new artifact IDs, commits a manifest,
// then emits two event rows outside the durable commit. This is NOT a
// full Next.js/Cloudflare/D1/R2 integration test.
test("a lost post-commit audit event makes a successful export look failed and retry creates another artifact", async () => {
  const objects = new Map<string, Uint8Array>();
  const rows = new Map<string, { id: string; objectKey: string }>();
  let manifestId = "";
  const priorArtifactIds: string[] = [];
  let attempts = 0;
  async function requestLikePost(): Promise<string> {
    attempts++;
    const id = randomUUID();  // matches route.ts generated.map(file=>({...file,id:crypto.randomUUID()}))
    const objectKey = `cases/synthetic/artifacts/${id}`;
    const record = { id, objectKey };
    await commitExportArtifactTransaction({
      artifacts: [{ record, objectKey, bytes: new Uint8Array([1,2,3]), mime: "application/octet-stream" }],
      upload: async (key, bytes) => { objects.set(key, bytes); },
      persistRecords: async (entries) => { entries.forEach(entry => rows.set(entry.id, entry)); },
      commitManifest: async () => { manifestId = id; return id; },
      deleteRecords: async (entries) => { entries.forEach(entry => rows.delete(entry.id)); },
      deleteObject: async key => { objects.delete(key); },
    });
    priorArtifactIds.push(id);
    // route.ts line 135: event('document_writer.prepared') then event('export.generated')
    if (attempts === 1) throw new Error("synthetic D1 events INSERT failure after manifest commit");
    return id;
  }
  await assert.rejects(requestLikePost(), /events INSERT failure/);
  assert.equal(rows.size, 1, "first response failed but artifact and manifest were committed");
  assert.equal(objects.size, 1);
  const retryId = await requestLikePost();
  assert.equal(rows.size, 2, "retry produced a second unrelated artifact row");
  assert.equal(objects.size, 2, "retry wrote a second R2 object");
  assert.equal(manifestId, retryId);
  assert.notEqual(priorArtifactIds[0], priorArtifactIds[1]);
  assert.ok(rows.has(priorArtifactIds[0]!));
  assert.ok(rows.has(priorArtifactIds[1]!));
});
