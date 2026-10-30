import test from "node:test";
import assert from "node:assert/strict";
import { commitOriginalUploadPointer, OriginalUploadCommitUncertain } from "../lib/original-upload-commit.ts";

const hash = "a".repeat(64);
const key = "cases/synthetic/doc/original/upload-1";
const row = (objectKey: string | null, ready = 1, sha256 = hash) => ({ original_key: objectKey, ready, sha256 });

test("normal pointer CAS retains the uploaded key", async () => {
  const result = await commitOriginalUploadPointer({ objectKey:key, expectedSha256:hash, writePointer:async()=>1, readPointer:async()=>{ throw Error("must not read"); } });
  assert.deepEqual(result, { retainObject:true });
});

test("CAS lost acknowledgement after successful SQL commit recovers and retains referenced R2 bytes", async () => {
  let committed = false;
  const result = await commitOriginalUploadPointer({ objectKey:key, expectedSha256:hash, writePointer:async()=>{ committed=true; throw Error("D1 response lost"); }, readPointer:async()=>committed?row(key):null });
  assert.deepEqual(result, { retainObject:true, recovered:true });
});

test("retry with a different R2 key does not delete the previously committed pointer", async () => {
  const result = await commitOriginalUploadPointer({ objectKey:key, expectedSha256:hash, writePointer:async()=>0, readPointer:async()=>row("cases/synthetic/doc/original/previous") });
  assert.deepEqual(result, { retainObject:false, idempotent:true });
});

test("failed D1 write, confirmed other concurrent winner: remove only our staging object", async () => {
  const result = await commitOriginalUploadPointer({ objectKey:key, expectedSha256:hash, writePointer:async()=>{throw Error("D1 response lost");}, readPointer:async()=>row("cases/synthetic/doc/original/other") });
  assert.deepEqual(result, { retainObject:false, idempotent:true });
});

test("ambiguous write plus unreadable D1 pointer keeps staging bytes for reconciliation", async () => {
  await assert.rejects(commitOriginalUploadPointer({ objectKey:key, expectedSha256:hash, writePointer:async()=>{throw Error("timeout");}, readPointer:async()=>{throw Error("read unavailable");} }), e => e instanceof OriginalUploadCommitUncertain && e.retainObject === true);
});

test("ambiguous write with a still-uncommitted row keeps staging bytes because a late commit is possible", async () => {
  await assert.rejects(commitOriginalUploadPointer({ objectKey:key, expectedSha256:hash, writePointer:async()=>{throw Error("timeout");}, readPointer:async()=>row(null,0) }), e => e instanceof OriginalUploadCommitUncertain && e.retainObject === true);
});

test("confirmed zero-row CAS with no winner remains a conflict and allows caller cleanup", async () => {
  await assert.rejects(commitOriginalUploadPointer({ objectKey:key, expectedSha256:hash, writePointer:async()=>0, readPointer:async()=>row(null,0) }), /ORIGINAL_UPLOAD_POINTER_CONFLICT/);
});

test("wrong hash never treats a different pointer as our acknowledged upload", async () => {
  await assert.rejects(commitOriginalUploadPointer({ objectKey:key, expectedSha256:hash, writePointer:async()=>0, readPointer:async()=>row("cases/synthetic/doc/original/other",1,"b".repeat(64)) }), /ORIGINAL_UPLOAD_POINTER_CONFLICT/);
});

test("confirmed zero-row CAS and unreadable D1 pointer propagates read failure", async () => {
  await assert.rejects(commitOriginalUploadPointer({ objectKey:key, expectedSha256:hash, writePointer:async()=>0, readPointer:async()=>{throw Error("read unavailable");} }), /read unavailable/);
});
