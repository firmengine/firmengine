/** A3 r64 diagnostic-only red regression; Draft PR, not a release gate or authorized rule change.
 * The source document's subject/parcel identity must be reviewed before a
 * real_property_valuation::market_value Fact is allowed to justify a different
 * typed asset merely because factIds and monetary amounts match.
 * 
 * Expected status in main: first case RED until a legally reviewed and
 * source-backed subject-to-asset identity contract is specified. Do not
 * auto-require fact.subjectId === asset.id: those IDs may have different namespaces.
 * Tests are synthetic; no customer/OCR source data.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createCase, normalizeMoney, type Fact } from "../lib/domain.ts";
import { auditMaterialCalculatorSources } from "../lib/material-calculation-source-gate.ts";

function fixture(targetAssetId: string) {
  const data = createCase("synthetic asset identity audit", "a3-r64-synthetic", "2026-11-02");
  const documentId = "synthetic-document", sha = "a".repeat(64);
  const quote = "SYNTHETIC property A evaluation 1000000";
  data.documents = [{ id: documentId, name: "synthetic.pdf", sha256: sha, status: "active", pages: [1] }];
  data.pages = [{ documentId, page: 1, role: "evidence", text: quote }];
  const fact: Fact = {
    id: "valuation-fact-A", logicalId: "valuation-fact-A", version: 1,
    subjectId: "property-A", key: "asset.gross_value", value: "1000000", rawValue: "1000000",
    sourceUnit: "KRW", numeric: normalizeMoney("1000000"),
    canonicalFieldId: "real_property_valuation::market_value",
    fieldObservation: { sourceState: "present" } as Fact["fieldObservation"],
    state: "verified", recognition: "accepted",
    refs: [{ documentId, page: 1, quote, sourceHash: sha }], validation: []
  };
  data.facts = [fact];
  data.assets = [{
    id: targetAssetId, kind: "real_estate", label: "SYNTHETIC property " + targetAssetId,
    grossValue: normalizeMoney("1000000"), factIds: [fact.id], recognition: "unreviewed"
  }];
  return data;
}

test("A3 diagnostic control: exact verified fact amount can satisfy same-ID typed asset", () => {
  const result = auditMaterialCalculatorSources(fixture("property-A"));
  assert.equal(result.issueCount, 0);
});

test("A3 P1 candidate (EXPECTED RED): differing source parcel and typed asset require explicit identity review", () => {
  const result = auditMaterialCalculatorSources(fixture("property-B"));
  assert.ok(result.issueCount > 0,
    "A raw valuation Fact for property-A must not silently reconcile into a typed property-B asset solely by reusing factId and 1000000; require an approved canonical subject-to-asset identity link before production rule changes");
});
