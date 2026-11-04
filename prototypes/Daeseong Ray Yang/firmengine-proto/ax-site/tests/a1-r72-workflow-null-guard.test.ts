import test from "node:test";
import assert from "node:assert/strict";
import { invalidWorkflowArrayFields } from "../lib/case-workflow-contract.ts";

test("A1-IT-011 preserves omitted old workflow fields without inventing approvals", () => {
  assert.deepEqual(invalidWorkflowArrayFields(undefined), []);
  assert.deepEqual(invalidWorkflowArrayFields({schema:"case-workflow/1",version:3,requirements:[]}), []);
  assert.deepEqual(invalidWorkflowArrayFields({futureExtension:{unknown:true}}), []);
});
test("A1-IT-011 rejects explicit null as unresolved rather than empty", () => {
  assert.deepEqual(invalidWorkflowArrayFields({tasks:null}), ["tasks"]);
  assert.deepEqual(invalidWorkflowArrayFields({requirements:null}), ["requirements"]);
  assert.deepEqual(invalidWorkflowArrayFields(null), ["workflowState"]);
});
test("A1-IT-011 rejects malformed fields without modifying the original payload", () => {
  const legacy = {tasks:0, documentMatches:{}, legalDispositions:"unknown", futureExtension:{keep:true}};
  const original=JSON.stringify(legacy);
  assert.deepEqual(invalidWorkflowArrayFields(legacy), ["documentMatches","tasks","legalDispositions"]);
  assert.equal(JSON.stringify(legacy), original);
  assert.deepEqual(invalidWorkflowArrayFields([]), ["workflowState"]);
});
