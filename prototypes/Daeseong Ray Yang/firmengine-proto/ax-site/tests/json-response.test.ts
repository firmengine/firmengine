import test from "node:test";
import assert from "node:assert/strict";
import { jsonResponse } from "../lib/json-response.ts";

test("Worker 전송 경계에서 한 번만 압축하도록 본문은 원본 JSON으로 보존한다", async () => {
  const request = new Request("https://example.test/api/cases/demo", { headers: { "Accept-Encoding": "br, gzip" } });
  const payload = { values: Array.from({ length: 1000 }, (_, i) => ({ id: i, text: "synthetic repeated evidence payload" })) };
  const response = jsonResponse(payload, request, { status: 202, headers: { "Cache-Control": "no-store" } });
  assert.equal(response.status, 202);
  assert.equal(response.headers.get("Content-Encoding"), "gzip");
  assert.match(response.headers.get("Vary") ?? "", /Accept-Encoding/);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.match(response.headers.get("Content-Type") ?? "", /application\/json/);
  const raw=await response.arrayBuffer();
  assert.equal(new TextDecoder().decode(raw).startsWith("{"),true);
  const wire=new Blob([raw]).stream().pipeThrough(new CompressionStream("gzip"));
  const stream = wire.pipeThrough(new DecompressionStream("gzip"));
  const decoded = JSON.parse(await new Response(stream).text());
  assert.equal(decoded.values.length, 1000);
});

test("JSON response honors gzip quality zero and remains ordinary JSON", async () => {
  const request = new Request("https://example.test/api/cases/demo", { headers: { "Accept-Encoding": "gzip;q=0, br" } });
  const response = jsonResponse({ ok: true }, request);
  assert.equal(response.headers.get("Content-Encoding"), null);
  assert.deepEqual(await response.json(), { ok: true });
});
