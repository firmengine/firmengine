import test from "node:test";
import assert from "node:assert/strict";
import { createCase, normalizeMoney, type Fact } from "../lib/domain.ts";
import { auditMaterialCalculatorSources } from "../lib/material-calculation-source-gate.ts";

/** Synthetic OCR fact + one typed debt; no client documents or real names. */
function setup(canonicalFieldId: string, amount = "100") {
  const data = createCase("A3 synthetic unverified source", "a3-r15-synthetic-case", "2026-10-31");
  const hash = "a".repeat(64), quote = "synthetic amount " + amount;
  data.documents = [{ id: "source", name: "synthetic.pdf", sha256: hash, status: "active", pages: [1] }];
  data.pages = [{ documentId: "source", page: 1, role: "evidence", text: quote }];
  const fact: Fact = {
    id: "source-fact", logicalId: "source-fact", version: 1, subjectId: "source-debt-row",
    key: canonicalFieldId === "debt_certificate::principal_balance" ? "debt.principal_balance" : "debt.interest",
    canonicalFieldId, value: amount, rawValue: amount, sourceUnit: "KRW",
    numeric: normalizeMoney(amount), fieldObservation: { sourceState: "present" } as Fact["fieldObservation"],
    state: "verified", recognition: "accepted",
    refs: [{ documentId: "source", page: 1, quote, sourceHash: hash }], validation: [],
  };
  data.facts = [fact];
  data.debts = [{
    id: "typed-debt", creditor: "synthetic creditor", secured: "no", classification: "ordinary",
    principal: normalizeMoney(amount), interest: normalizeMoney(amount), legalReview: "unreviewed",
    factIds: [fact.id],
  }];
  return data;
}

const materialDebtIds = [
  "debt_certificate::principal_balance",
  "debt_certificate::interest_balance",
] as const;

test("reported and extracted debt facts do not clear the material amount source gate", () => {
  for (const id of materialDebtIds) for (const state of ["reported", "extracted"] as const)
    for (const recognition of ["accepted", "unreviewed"] as const) {
      const data = setup(id);
      data.facts[0].state = state;
      data.facts[0].recognition = recognition;
      const report = auditMaterialCalculatorSources(data);
      assert.equal(report.issueCount, 1, `${id}/${state}/${recognition}`);
      assert.equal(report.issues[0].code, "CALC_INPUT_SOURCE_INVALID");
      assert.equal(report.automaticLegalRecognition, false);
      assert.equal(report.automaticInclusion, false);
    }
});

test("verified original amounts can reconcile without implying legal approval", () => {
  for (const id of materialDebtIds) for (const recognition of ["accepted", "unreviewed"] as const) {
    const data = setup(id);
    data.facts[0].recognition = recognition;
    const report = auditMaterialCalculatorSources(data);
    assert.equal(report.issueCount, 0, `${id}/${recognition}`);
    assert.equal(report.automaticLegalRecognition, false);
    assert.equal(report.automaticInclusion, false);
  }
});

test("disputed, rejected, conflicting and missing source states remain distinct failures", () => {
  const cases = [
    { state: "disputed" as const, recognition: "accepted" as const, sourceState: "present" as const, expected: "CALC_INPUT_SOURCE_INVALID" },
    { state: "verified" as const, recognition: "rejected" as const, sourceState: "present" as const, expected: "CALC_INPUT_SOURCE_INVALID" },
    { state: "verified" as const, recognition: "accepted" as const, sourceState: "conflicting" as const, expected: "CALC_INPUT_AMOUNT_INVALID" },
    { state: "verified" as const, recognition: "accepted" as const, sourceState: "not_seen" as const, expected: "CALC_INPUT_AMOUNT_INVALID" },
  ];
  for (const item of cases) {
    const data = setup(materialDebtIds[0]);
    data.facts[0].state = item.state;
    data.facts[0].recognition = item.recognition;
    data.facts[0].fieldObservation = { ...data.facts[0].fieldObservation!, sourceState: item.sourceState };
    const report = auditMaterialCalculatorSources(data);
    assert.equal(report.issueCount, 1);
    assert.equal(report.issues[0].code, item.expected);
  }
});

test("verified true zero remains zero rather than becoming missing", () => {
  for (const id of materialDebtIds) {
    const data = setup(id, "0");
    const report = auditMaterialCalculatorSources(data);
    assert.equal(report.issueCount, 0);
    assert.deepEqual(report.issues, []);
  }
});
