import test from "node:test";
import assert from "node:assert/strict";
import { observeField, pageFieldCoverage, type ObservationInput } from "../lib/field-observation.ts";
import { projectPage, validatePageRead, type PageRead } from "../lib/extraction.ts";
import { applyExtraction, createCase, currentFacts, reviewFact } from "../lib/domain.ts";

const source = {documentId: "doc", page: 1, sourceSha256: "a".repeat(64)};
const field = (overrides: Partial<ObservationInput> = {}): ObservationInput => ({key: "creditor", label: "채권자", value: "테스트은행", unit: null, quote: "채권자 테스트은행", bbox: [.1,.1,.4,.2], confidence: "clear", canonicalFieldId: "debt_certificate::creditor", sourceState: "present", applicability: "unknown", applicabilityQuote: null, ...overrides});
const read = (fields: ObservationInput[]): PageRead => ({documentType: "debt_certificate", complete: true, warnings: [], records: [{category: "debt", label: "채무", fields}]});
function persist(fields: ObservationInput[]) {
  const c = createCase("회귀검증", "case", "2026-10-27");
  c.documents = [{id: "doc", sha256: source.sourceSha256, name: "증명서", status: "active", pages: [1]}];
  c.pages = [{documentId: "doc", page: 1, role: "evidence", documentType: "debt_certificate"}];
  return applyExtraction(c, projectPage(read(fields), "doc", 1, source.sourceSha256));
}

test("null, blank, mask, zero and explicit none do not become one state", () => {
  const legacy = observeField("debt_certificate", field({value: null, sourceState: undefined, confidence: "uncertain"}), source, 0, 0);
  assert.equal(legacy.sourceState, "unknown"); assert.equal(legacy.applicability.sourceClaim, "unknown");
  const blank = observeField("debt_certificate", field({value: null, sourceState: "blank", applicability: "not_applicable", applicabilityQuote: null}), source, 0, 0);
  assert.equal(blank.sourceState, "blank"); assert.equal(blank.extractionState, "source_empty"); assert.equal(blank.applicability.sourceClaim, "unknown");
  assert.equal(observeField("debt_certificate", field({value: "0"}), source, 0, 0).sourceState, "present");
  const masked = observeField("debt_certificate", field({value: "***", sourceState: "masked"}), source, 0, 0);
  assert.equal(masked.rawValue, "***"); assert.equal(masked.extractionState, "source_obscured");
  const absent = observeField("debt_certificate", field({value: "해당 없음", quote: "채권자 해당 없음", sourceState: "explicit_none", applicability: "not_applicable", applicabilityQuote: "해당 없음"}), source, 0, 0);
  assert.equal(absent.applicability.sourceClaim, "not_applicable"); assert.equal(absent.applicability.caseDecision, "unreviewed"); assert.equal(absent.rawValue, "해당 없음");
});
test("state claims need anchors and cannot contradict a value", () => {
  assert.equal(observeField("debt_certificate", field({sourceState: "blank"}), source, 0, 0).sourceState, "unknown");
  assert.equal(observeField("debt_certificate", field({sourceState: "blank", value: null, quote: null}), source, 0, 0).sourceState, "unknown");
  assert.equal(observeField("debt_certificate", field({sourceState: "present", value: null}), source, 0, 0).sourceState, "unknown");
});
test("N/A source claims require explicit source-none evidence, not a blank, missing slot, or zero", () => {
  const blank = observeField("debt_certificate", field({value: null, sourceState: "blank", quote: "현재 원금잔액 [빈칸]", applicability: "not_applicable", applicabilityQuote: "현재 원금잔액"}), source, 0, 0);
  assert.equal(blank.sourceState, "blank"); assert.equal(blank.applicability.sourceClaim, "unknown");
  const missing = observeField("debt_certificate", field({value: null, sourceState: "not_seen", quote: "현재 원금잔액", applicability: "not_applicable", applicabilityQuote: "현재 원금잔액"}), source, 0, 0);
  assert.equal(missing.applicability.sourceClaim, "unknown");
  const zero = observeField("debt_certificate", field({value: "0", quote: "현재 원금잔액 0원", applicability: "not_applicable", applicabilityQuote: "현재 원금잔액 0원"}), source, 0, 0);
  assert.equal(zero.sourceState, "present"); assert.equal(zero.applicability.sourceClaim, "unknown");
  const explicit = observeField("debt_certificate", field({value: null, sourceState: "explicit_none", quote: "현재 원금잔액 해당 없음", applicability: "not_applicable", applicabilityQuote: "해당 없음"}), source, 0, 0);
  assert.equal(explicit.sourceState, "explicit_none"); assert.equal(explicit.rawValue, null); assert.equal(explicit.applicability.sourceClaim, "not_applicable");
  assert.equal(explicit.extractionState, "source_empty", "an explicit absence claim is not a successfully extracted value");
});
test("canonical binding rejects cross-family and same-family wrong-key claims", () => {
  assert.equal(observeField("debt_certificate", field(), source, 0, 0).canonicalFieldId, "debt_certificate::creditor");
  assert.equal(observeField("payroll_payslip", field(), source, 0, 0).canonicalFieldId, null);
  const wrong = observeField("debt_certificate", field({canonicalFieldId: "debt_certificate::debtor"}), source, 0, 0);
  assert.equal(wrong.canonicalFieldId, null); assert.ok(wrong.issues.includes("canonical_id_key_conflict"));
});
test("missing catalog output is unknown source coverage, never source blank or N/A", () => {
  const coverage = pageFieldCoverage({...read([]), complete: false}, source);
  assert.ok(coverage.observations.length > 0);
  for (const o of coverage.observations) {
    assert.equal(o.origin, "catalog_gap"); assert.equal(o.sourceState, "unknown"); assert.equal(o.extractionState, "not_observed"); assert.equal(o.applicability.sourceClaim, "unknown"); assert.equal(o.rawValue, null);
  }
});
test("all null-state observations survive projection and persistence with their exact source", () => {
  const data = persist([field({value: null, sourceState: "blank"})]);
  const f = currentFacts(data)[0];
  assert.ok(f); assert.equal(f.value, null); assert.equal(f.canonicalFieldId, "debt_certificate::creditor"); assert.equal(f.fieldObservation?.sourceState, "blank"); assert.equal(f.recognition, "unreviewed"); assert.equal(f.numeric, undefined);
  assert.equal(data.pages[0].fieldCoverage?.sourceSha256, source.sourceSha256); assert.equal(data.debts.length, 0);
});
test("independent verification disposition survives the guarded persistence roundtrip", () => {
  const data = persist([field({verificationState: "wrong_field"})]);
  assert.equal(currentFacts(data)[0]?.fieldObservation?.verificationState, "wrong_field");
});
test("manual changes preserve prior reading but invalidate current automated observation", () => {
  const data = persist([field()]), prior = currentFacts(data)[0];
  const next = reviewFact(data, prior.id, {value: "다른 은행", actor: "reviewer", reason: "원본 대조"});
  const updated = currentFacts(next)[0];
  assert.equal(next.pages[0].fieldCoverage?.observations[0].supersededByHumanFactId, updated.id);
  assert.equal(updated.fieldObservation, undefined); assert.equal(updated.canonicalFieldId, undefined);
  assert.equal(next.facts.find(f => f.id === prior.id)?.fieldObservation?.rawValue, "테스트은행");
});
test("invalid observation enum is rejected without weakening old read compatibility", () => {
  assert.throws(() => validatePageRead(read([field({sourceState: "not_applicable_reviewed" as never})])));
  assert.ok(validatePageRead(read([field({sourceState: undefined, canonicalFieldId: undefined, applicability: undefined})])));
});


test("unsupported applicability assertion cannot suppress a readable value", () => {
  const f=field({key:"principal",label:"원금",value:"1200",unit:"원",quote:"원금 1200원",canonicalFieldId:null,applicability:"not_applicable",applicabilityQuote:null});
  const projection=projectPage(read([field(),f]), "doc", 1, source.sourceSha256);
  assert.equal(projection.facts?.[1].fieldObservation?.applicability.sourceClaim,"unknown");
  assert.equal(projection.debts?.[0].principal?.amountWon,"1200");
});
