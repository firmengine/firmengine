import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDocumentPreflight } from "../lib/document-preflight.ts";
import { FORM_CONTRACTS } from "../lib/form-contracts.ts";

// Purely synthetic required-field contract. No real client/fact/Word source.
// The field is registered in D5103; this probes only generic status classification.
const original = FORM_CONTRACTS.D5103;
if (!original) throw new Error("D5103 contract is missing");
const fields = original.fields.filter((field) => field.token === "client_name");
if (fields.length !== 1) throw new Error("client_name contract must be unique");
const contract = { ...original, fields, repeatGroups: [] };
const identity = {
  evaluationId: "SYN-A2-R64",
  evaluationResultHash: "synthetic-evaluation-hash",
  referenceBundleHash: "synthetic-reference-hash",
  templateHash: contract.templateHash,
  documentEditsHash: "synthetic-edits-hash",
};
const review = (value: unknown, mode: "draft" | "final") =>
  evaluateDocumentPreflight({
    formCode: "D5103",
    contract,
    identity,
    mode,
    bindings: { scalars: { client_name: value as string }, rows: {} },
  });

const pending = [
  "[미관찰]", "[미상]", "[승인전]", "[원문만]", "[원천만]",
  "[source-only]", "source-only", "source-only: 2400000",
];
test("A2-DOC r64: unresolved/source-only synthetic required field blocks final review", async () => {
  for (const marker of pending) {
    const result = await review(marker, "final");
    assert.equal(result.status, "blocked", marker);
    assert.ok(result.blockers.some((issue) =>
      issue.code === "FIELD_UNRESOLVED" && issue.token === "client_name"), marker);
  }
});

test("A2-DOC r64: draft remains explicitly unresolved instead of reporting ready", async () => {
  for (const marker of pending) {
    const result = await review(marker, "draft");
    assert.equal(result.status, "draft_with_unresolved", marker);
    assert.ok(result.warnings.some((issue) =>
      issue.code === "FIELD_UNRESOLVED" && issue.token === "client_name"), marker);
  }
});

test("A2-DOC r64: prior fail-closed statuses remain blocked in final review", async () => {
  for (const marker of ["[확인 필요]", "[상충]", "[누락]", "[검토 필요]", "[검토완료]"]) {
    const result = await review(marker, "final");
    assert.equal(result.status, "blocked", marker);
  }
});

test("A2-DOC r64: plain observed and explicit string zero are not null/missing", async () => {
  for (const value of ["가상인", "0"]) {
    const result = await review(value, "final");
    assert.equal(result.status, "ready", value);
    assert.equal(result.blockers.length, 0);
  }
});
// This narrow status-parser contract does not certify D5103/D5110/D5111 templates,
// applicant identity, statutory acceptance or human approval.
