import test from "node:test";
import assert from "node:assert/strict";
import { createCase, DRAFT_RULESET, currentFacts, factLineageIssues, factSourceLineageIssues, normalizeMoney, type Fact } from "../lib/domain.ts";
import { assessCase, calculateCase } from "../lib/assessment.ts";
import { buildCourtPackage } from "../lib/exports.ts";
import { evaluateWorkflow } from "../lib/workflow-rules.ts";

function fixture() {
  const data = createCase("합성 구조자료 테스트", "synthetic-structured-source", "2026-10-28");
  const envelope = { fieldId: "income.net", presence: "present", value: { currency: "KRW", minorUnits: "100000", unit: "KRW" }, rawValue: "100000", sourceUnit: "KRW" };
  data.structuredTest = { mode: "assumed_extracted_synthetic", scenarioId: "synthetic-scenario-a", sourceRecords: [{ id: "source-field-1", recordType: "income", recordId: "income-row-1", data: { net: envelope } }] };
  const fact: Fact = { id: "fact-income-net", logicalId: "income-row-1:net", version: 1, subjectId: "income-row-1", key: "income.net", value: structuredClone(envelope.value), rawValue: envelope.rawValue, sourceUnit: "KRW", numeric: normalizeMoney("100000", "KRW", "KRW"), state: "reported", recognition: "unreviewed", refs: [], structuredRefs: [{ sourceRecordId: "source-field-1", jsonPointer: "/net/value" }], validation: [] };
  data.facts.push(fact);
  data.incomes = [{ id: "income-row-1", kind: "wage", label: "Synthetic wage", net: normalizeMoney("100000", "KRW", "KRW"), amountBasis: "monthly", periodMonths: 1, recognition: "unreviewed", factIds: [fact.id] }];
  data.context.inventoryComplete = { income: "no", debt: "unknown", asset: "unknown" };
  return data;
}

test("synthetic structured refs bind exact values and stay unverified/unaccepted", () => {
  const data = fixture(), fact = currentFacts(data)[0]!;
  assert.deepEqual(factSourceLineageIssues(data, [fact.id]), ["SOURCE_VERIFICATION_REQUIRED"]);
  assert.deepEqual(factLineageIssues(data, [fact.id]).sort(), ["LEGAL_RECOGNITION_REQUIRED", "SOURCE_VERIFICATION_REQUIRED"]);
  assert.equal(data.facts[0]!.sourceVerification, undefined);
  const result = calculateCase(data, DRAFT_RULESET);
  assert.equal(result.monthlyIncomeWon, "100000");
  assert.ok(result.traces.some(trace => trace.id === `income:${data.incomes[0]!.id}` && trace.status === "provisional"));
});

test("workflow surfaces structured data as pending proof rather than passing it", () => {
  const data = fixture();
  const workflow = evaluateWorkflow(data);
  assert.ok(workflow.items.some(item => item.documents.some(document => document.fields.some(field => field.structuredRefs?.length))));
  assert.ok(workflow.items.every(item => item.status !== "pass"));
  const assessment = assessCase(data,DRAFT_RULESET);
  assert.equal(assessment.generationGate.canGenerateDraft,true);
  assert.equal(assessment.generationGate.canFinalize,false);
  const draft = buildCourtPackage(data,DRAFT_RULESET,assessment);
  assert.equal(draft.status,"draft");
  assert.ok(draft.documents.length>0);
});

test("structured refs reject changed values, wrong field identity, missing/conflict wrappers, numeric unit/currency/amount mismatch, and prototype traversal", () => {
  const invalid = (mutate: (data: ReturnType<typeof fixture>) => void) => {
    const data = fixture(); mutate(data);
    assert.ok(factSourceLineageIssues(data, [data.facts[0]!.id]).includes("SOURCE_REFERENCE_INVALID"));
  };
  invalid(data => { data.facts[0]!.value = { currency: "KRW", minorUnits: "100001", unit: "KRW" }; });
  invalid(data => { (data.structuredTest!.sourceRecords[0]!.data as Record<string, any>).net.fieldId = "debt.principal"; });
  invalid(data => { (data.structuredTest!.sourceRecords[0]!.data as Record<string, any>).net.presence = "unknown"; });
  invalid(data => { (data.structuredTest!.sourceRecords[0]!.data as Record<string, any>).net.presence = "conflict"; });
  invalid(data => { data.facts[0]!.numeric = normalizeMoney("100001", "KRW", "KRW"); });
  invalid(data => { data.facts[0]!.numeric = normalizeMoney("100000", "KRW", "USD"); });
  invalid(data => { data.facts[0]!.numeric = normalizeMoney("100000", "만원", "KRW"); });
  invalid(data => { data.facts[0]!.structuredRefs = [{ sourceRecordId: "source-field-1", jsonPointer: "/__proto__/value" }]; });
});

test("duplicate source record IDs and fabricated review metadata invalidate the synthetic link", () => {
  const data = fixture(); data.structuredTest!.sourceRecords.push(structuredClone(data.structuredTest!.sourceRecords[0]!));
  assert.ok(factSourceLineageIssues(data, [data.facts[0]!.id]).includes("SOURCE_REFERENCE_INVALID"));
  const reviewed = fixture(); reviewed.facts[0]!.sourceVerification = {} as NonNullable<Fact["sourceVerification"]>;
  assert.ok(factSourceLineageIssues(reviewed, [reviewed.facts[0]!.id]).includes("SOURCE_REFERENCE_INVALID"));
  const verified = fixture(); verified.facts[0]!.state = "verified";
  assert.ok(factSourceLineageIssues(verified, [verified.facts[0]!.id]).includes("SOURCE_REFERENCE_INVALID"));
  const accepted = fixture(); accepted.facts[0]!.recognition = "accepted";
  assert.ok(factSourceLineageIssues(accepted, [accepted.facts[0]!.id]).includes("SOURCE_REFERENCE_INVALID"));
});

test("structured refs are invalid on ordinary cases without the explicit synthetic test mode", () => {
  const data = fixture(); delete data.structuredTest;
  assert.ok(factSourceLineageIssues(data, [data.facts[0]!.id]).includes("SOURCE_REFERENCE_INVALID"));
});
