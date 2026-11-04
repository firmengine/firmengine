import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// Isolated source-handler test. The real database, authorization, browser and legal gate are NOT exercised.
const source = readFileSync(new URL("../app/api/cases/route.ts", import.meta.url), "utf8");
function fixture() {
  const saved = [];
  const sandbox = {
    createCase: name => ({ context: { id: "synthetic-r51-case", caseName: name, revision: 1, applicationDate: "2026-11-01", asOf: "2026-11-01", courtId: "seoul" }, documents: [] }),
    requireSameOrigin: () => {},
    jsonBody: async request => request.body,
    actor: async () => "synthetic-r51-actor",
    now: () => "2026-11-01T05:55:00.000Z",
    db: () => ({ prepare: sql => ({ bind: (...args) => ({ run: async () => { assert.match(sql, /INSERT INTO cases/); saved.push(JSON.parse(args[4])); return { meta: { changes: 1 } }; } }) }) }),
    event: async () => {},
    getCase: async () => saved.at(-1),
    CURRENT_RULESET: { id: "synthetic-rules" },
    caseResponse: async c => ({ case: c }),
    Response: { json: (body, options) => ({ status: options.status, body }) },
    errorResponse: error => { throw error; },
  };
  const runnable = source.replace(/^import .*;\r?\n/gm, "").replace("export async function POST(request:Request)", "async function POST(request)");
  assert.ok(runnable.includes("async function POST(request)"), "route declaration must stay testable");
  const handler = runInNewContext(runnable + "\nPOST", sandbox);
  return { handler, saved };
}

const scenarios = [
  ["omitted", { name: "synthetic r51" }, "unknown"],
  ["null", { courtId: null }, "unknown"],
  ["empty", { courtId: "" }, "unknown"],
  ["whitespace", { courtId: "   " }, "unknown"],
  ["explicit unknown", { courtId: "unknown" }, "unknown"],
  ["explicit seoul", { courtId: "seoul" }, "seoul"],
  ["spaced seoul", { courtId: " seoul " }, "seoul"],
  ["incheon", { courtId: "incheon" }, "incheon"],
  ["other court category", { courtId: "other" }, "other"],
];
for (const [label, body, expected] of scenarios) {
  test("create-case synthetic court routing: " + label, async () => {
    const { handler, saved } = fixture();
    const result = await handler({ body });
    assert.equal(result.status, 201);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].context.courtId, expected);
    assert.equal(result.body.case.context.courtId, expected);
  });
}

test("new-case and existing-case selectors expose an explicit unconfirmed court option", () => {
  const ui = readFileSync(new URL("../components/workspace.tsx", import.meta.url), "utf8");
  assert.match(ui, /<select name="courtId" defaultValue="unknown"><option value="unknown">관할 미확인/);
  assert.match(ui, /<select name="courtId" defaultValue=\{data\.context\.courtId\}><option value="unknown">관할 미확인/);
  assert.match(ui, /data\.context\.courtId === "unknown" \? "관할 미확인"/);
  assert.match(ui, /courtId: form\.get\("courtId"\)/);
});
