import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const trace=[
 {id:"AT-49",file:"tests/reference-registry.test.ts",name:"activation rejects impossible term ordering, future effective dates and stale review bases before writing"},
 {id:"AT-50",file:"tests/reference-application-consumer.test.ts",name:"overlapping bundles stay unresolved and only explicit applicability adds a finalization gate"},
 {id:"AT-51",file:"tests/reference-release-restore.test.ts",name:"restoring an older reference release creates a new row, preserves case artifacts, and leaves case application gated for fresh bundle review"},
 {id:"AT-52",file:"tests/reference-registry.test.ts",name:"stale proposal clients cannot insert a change against an unexpected active release"},
 {id:"AT-53",file:"tests/reference-route-auth.test.ts",name:"an actor without reference_approve is rejected before release activation"},
 {id:"AT-54",file:"tests/reference-registry.test.ts",name:"activation binds authority, effective date, reviewer and value into the new immutable release identity"},
 {id:"AT-55",file:"tests/reference-registry.test.ts",name:"proposal fingerprints bind approval to exact proposal contents and optional four-eyes policy"},
 {id:"AT-56",file:"tests/reference-pure-modules.test.ts",name:"monitor separates paused execution, first observation, failures, no change and attachment-only changes"},
 {id:"AT-57",file:"tests/legal-monitor-store.test.ts",name:"failed and deferred sources retain the last successful observation"},
 {id:"AT-58",file:"tests/legal-monitor-store.test.ts",name:"attachment-only changes create distinct history snapshots even when the parent hash is unchanged"},
 {id:"AT-59",file:"tests/reference-route-auth.test.ts",name:"impact preview is read-only, limited to requested owner-authorized cases, and exposes unknown dependencies without mutating files"},
 {id:"AT-60",file:"tests/reference-pure-modules.test.ts",name:"transaction candidates retain counterexamples and mark incomplete periods unknown"},
 {id:"AT-61",file:"tests/reference-pure-modules.test.ts",name:"transaction candidates retain counterexamples and mark incomplete periods unknown"},
 {id:"AT-62",file:"tests/transactions.test.ts",name:"loan inflow mixed with other funds stays an unallocated source and does not infer the later withdrawal's purpose"},
 {id:"AT-73",file:"tests/app-roles.test.ts",name:"verified owner bootstrap and audited grants do not let ordinary staff self-assign roles"},
] as const;

test("AT-49 through AT-62 and AT-73 trace to exact scenario tests",()=>{
 assert.deepEqual(trace.map(item=>item.id),[...Array.from({length:14},(_,i)=>`AT-${49+i}`),"AT-73"]);
 for(const item of trace){const source=readFileSync(new URL(`../${item.file}`,import.meta.url),"utf8");assert.ok(source.includes(`test("${item.name}"`)||source.includes(`test('${item.name}'`),`${item.id} must point to the exact named test in ${item.file}`);}
});
