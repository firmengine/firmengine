import test from "node:test";
import assert from "node:assert/strict";
import { parseEvaluationInventoryQuery } from "../lib/evaluation-inventory.ts";
test("synthetic inventory preserves bounded keyset scope", () => {
  assert.deepEqual(parseEvaluationInventoryQuery(new URL("https://example.test/api/evaluation-cases?prefix=synthetic-v31-eval-&after=synthetic-v31-eval-z&limit=25")), { prefix:"synthetic-v31-eval-",after:"synthetic-v31-eval-z",limit:25 });
  for (const query of ["prefix=real-", "prefix=synthetic-%25", "prefix=synthetic-_", "prefix=synthetic-v31-&after=synthetic-v35-a", "limit=101", "limit=0", "limit=1.5", "after=non-evaluation-unit-case"]) {
    assert.throws(() => parseEvaluationInventoryQuery(new URL("https://example.test/api/evaluation-cases?"+query)));
  }
});
