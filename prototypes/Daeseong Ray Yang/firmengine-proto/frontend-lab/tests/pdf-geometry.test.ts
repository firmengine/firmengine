import test from "node:test";
import assert from "node:assert/strict";
import { clientToViewportPoint, rectangleFromPoints, transformRectangle } from "../src/pdf-geometry.ts";

test("pointer positions follow CSS scaling and clamp to the rendered page", () => {
  const bounds = { x: 100, y: 200, width: 300, height: 400 }, viewport = { width: 600, height: 800 };
  assert.deepEqual(clientToViewportPoint({ x: 250, y: 300 }, bounds, viewport), { x: 300, y: 200 });
  assert.deepEqual(clientToViewportPoint({ x: 20, y: 999 }, bounds, viewport), { x: 0, y: 800 });
  assert.equal(clientToViewportPoint({ x: 0, y: 0 }, { ...bounds, width: 0 }, viewport), null);
  assert.equal(clientToViewportPoint({ x: NaN, y: 0 }, bounds, viewport), null);
});
test("reverse drags clamp to PDF crop bounds without losing their nonzero origin", () => {
  const bounds = { x: 10, y: 20, width: 100, height: 200 };
  assert.deepEqual(rectangleFromPoints({ x: 100, y: 200 }, { x: -10, y: 10 }, bounds), { x: 10, y: 20, width: 90, height: 180 });
  assert.equal(rectangleFromPoints({ x: 10, y: 20 }, { x: 10, y: 80 }, bounds), null);
  assert.equal(rectangleFromPoints({ x: Infinity, y: 20 }, { x: 50, y: 80 }, bounds), null);
});
test("PDF-coordinate annotations retain the same source rectangle across zoom and quarter turns", () => {
  const source = { x: 10, y: 20, width: 30, height: 40 }, saved = structuredClone(source);
  assert.deepEqual(transformRectangle(source, point => ({ x: point.x * 2, y: (100 - point.y) * 2 })), { x: 20, y: 80, width: 60, height: 80 });
  assert.deepEqual(transformRectangle(source, point => ({ x: point.y * 2, y: point.x * 2 })), { x: 40, y: 20, width: 80, height: 60 });
  assert.deepEqual(transformRectangle(source, point => ({ x: 200 - point.x, y: point.y })), { x: 160, y: 20, width: 30, height: 40 });
  assert.deepEqual(source, saved);
});
