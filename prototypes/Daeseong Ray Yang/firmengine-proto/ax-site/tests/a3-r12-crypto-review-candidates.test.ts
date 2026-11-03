import test from "node:test";
import assert from "node:assert/strict";
import {INTAKE_CATALOG_SEED} from "../lib/intake-catalog.ts";
import {buildFeatureLineageAudit} from "../lib/feature-lineage-audit.ts";

const audit=()=>buildFeatureLineageAudit(INTAKE_CATALOG_SEED,"a".repeat(64),{limit:1000});
const field=(id:string)=>{const found=audit().fields.find(f=>f.canonicalFieldId===id);assert.ok(found,id);return found;};

test("crypto balance source-only IDs retain specialized review CANDIDATE without legal approval",()=>{
 for(const id of ["crypto_balance::available_quantity","crypto_balance::average_acquisition_price","crypto_balance::account_owner","crypto_balance::asset_symbol"]){
  const row=field(id);
  assert.ok(row.familyIds.includes("cash_deposit_asset"));
  assert.ok(row.legal.referenceReviewCandidates.includes("SEOUL-408"),id);
  assert.equal(row.legal.approvalInferred,false);
  assert.equal(row.typedProjections.length,0);
  assert.equal(row.forms.some(f=>!!f.token),false);
 }
});
test("securities extension receives review candidate even under shared asset family",()=>{
 const row=field("securities_balance::quantity");
 assert.ok(row.legal.referenceReviewCandidates.includes("SEOUL-408"));
 assert.equal(row.legal.approvalInferred,false);
});
test("generic cash/credit/assignment ID does not inherit crypto-specific candidate",()=>{
 for(const id of ["cash_deposit_asset::gross_value","credit_report::reported_amount","creditor_assignment_dispute::disputed_amount"]){
  const row=field(id);
  assert.equal(row.legal.referenceReviewCandidates.includes("SEOUL-408"),false,id);
 }
 const rows=audit();
 assert.equal(rows.summary.canonicalFieldIds,693);
 assert.equal(rows.summary.sourceSlots,1808);
 assert.equal(rows.legalApprovalInferred,false);
});
