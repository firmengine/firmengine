import test from "node:test";
import assert from "node:assert/strict";
import {INTAKE_CATALOG_SEED} from "../lib/intake-catalog.ts";
import {buildFeatureLineageAudit} from "../lib/feature-lineage-audit.ts";

const sha="a".repeat(64);
const rows=buildFeatureLineageAudit(INTAKE_CATALOG_SEED,sha,{limit:1000}).fields;
const field=(id:string)=>{const row=rows.find(value=>value.canonicalFieldId===id);assert.ok(row,"field missing: "+id);return row;};
const reviewIds=(id:string)=>field(id).sourceReviewConsumers.map(value=>value.id);

test("material asset gross value is context-only, not a typed asset or statutory liquidation value",()=>{
 const row=field("business_assets_liabilities::gross_value");
 assert.deepEqual(reviewIds(row.canonicalFieldId),["material_calculation_source_gate"]);
 assert.equal(row.sourceReviewConsumers[0].status,"source_context_only_no_automatic_inclusion");
 assert.equal(row.typedProjections.length,0);
 assert.equal(row.calculations.length,0);
});
test("business expense entity and category have exact preflight review routes without income auto-approval",()=>{
 assert.deepEqual(reviewIds("business_costs_and_ledgers::income.business_cost.business_entity"),[
   "business_identity_crosswalk","business_net_preflight"]);
 assert.deepEqual(reviewIds("business_costs_and_ledgers::income.business_cost.expense_category"),[
   "business_net_preflight"]);
 assert.ok(field("business_costs_and_ledgers::income.business_cost.expense_category").sourceReviewConsumers.every(x=>!x.status.includes("approved_net")));
});
test("business accounting basis and continuity are still unconsumed context requiring review",()=>{
 for(const key of ["accounting_basis","business_continuity_flag"]){
  const row=field("business_costs_and_ledgers::income.business_cost."+key);
  assert.deepEqual(row.sourceReviewConsumers,[]);
  assert.equal(row.typedProjections.length,0);
 }
});
test("cost amount is reviewed separately and input VAT never becomes an approved expense",()=>{
 const prefix="business_costs_and_ledgers::income.business_cost.";
 assert.deepEqual(reviewIds(prefix+"gross_amount"),[
  "material_calculation_source_gate","business_source_evidence_audit","business_net_preflight"]);
 assert.deepEqual(reviewIds(prefix+"tax_component"),["business_source_evidence_audit"]);
 assert.equal(field(prefix+"tax_component").calculations.length,0);
});
test("no false direct review route is invented for estimated market value",()=>{
 const row=field("business_asset_inventory::market_value");
 assert.equal(row.sourceReviewConsumers.length,0);
 assert.equal(row.typedProjections.length,0);
 assert.equal(row.forms.filter(f=>f.token).length,0);
});
