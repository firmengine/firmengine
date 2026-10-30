import test from "node:test";
import assert from "node:assert/strict";
import { INTAKE_CATALOG_SEED } from "../lib/intake-catalog.ts";
import { buildFeatureLineageAudit } from "../lib/feature-lineage-audit.ts";

const audit = () => buildFeatureLineageAudit(INTAKE_CATALOG_SEED, "a".repeat(64), { limit: 1000 });
const field = (rows: ReturnType<typeof audit>["fields"], id: string) => {
 const result = rows.find(item => item.canonicalFieldId === id);
 assert.ok(result, "missing registered canonical source: " + id);
 return result;
};

test("bank transaction's five exact typed keys expose a review-only case-execution candidate", () => {
 const result = audit();
 const sourceToCase = {
  "bank_transactions::account_id": "transaction.account_id",
  "bank_transactions::amount": "transaction.amount",
  "bank_transactions::counterparty": "transaction.counterparty",
  "bank_transactions::direction": "transaction.direction",
  "bank_transactions::transaction_datetime": "transaction.date",
 } as const;
 for (const [id, target] of Object.entries(sourceToCase)) {
  const row = field(result.fields, id);
  assert.equal(row.sourceSlots, 13, "each of 13 document routes must remain separate");
  assert.ok(row.typedProjections.some(item => item.caseFactKey === target), id);
  assert.ok(row.calculations.some(item => item.id === "transaction_review"
    && item.status === "depends_on_verified_case_objects_not_raw_ocr"), id);
  assert.equal(row.legal.approvalInferred, false);
  assert.ok(row.forms.every(item => !item.token), "direct official form token must not be inferred");
 }
 assert.equal(result.legalApprovalInferred, false);
});

test("bank account balance cannot silently become cash asset or transaction income", () => {
 const result = audit();
 for (const id of [
  "bank_account_balance::balance",
  "bank_account_balance::balance_as_of",
  "bank_account_balance::currency",
  "bank_account_balance::institution",
  "bank_account_balance::issue_date",
  "bank_transactions::post_balance",
 ]) {
  const row = field(result.fields, id);
  assert.equal(row.typedProjections.length, 0, id);
  assert.equal(row.calculations.length, 0, id);
  assert.ok(row.gaps.includes("CASE_TYPED_CONSUMER_NOT_DECLARED"), id);
 }
});

test("transaction receipt identifier and statement period fields remain evidence-only", () => {
 const result = audit();
 for (const id of [
  "bank_transactions::transaction_id",
  "bank_transactions::issue_date",
  "bank_transactions::period_start",
  "bank_transactions::period_end",
  "bank_transactions::memo",
  "bank_transactions::transaction_nature",
 ]) {
  const row = field(result.fields, id);
  assert.equal(row.sourceSlots, 13, id);
  assert.equal(row.typedProjections.length, 0, id);
  assert.equal(row.calculations.length, 0, id);
 }
});

test("business inventory book value and condition remain source evidence, not liquidation approval", () => {
 const result = audit();
 for (const id of [
  "business_asset_inventory::acquisition_date",
  "business_asset_inventory::book_value",
  "business_asset_inventory::condition",
 ]) {
  const row = field(result.fields, id);
  assert.equal(row.sourceSlots, 1);
  assert.equal(row.typedProjections.length, 0);
  assert.equal(row.calculations.length, 0);
 }
});
