import test from "node:test";
import assert from "node:assert/strict";
import {buildCalculationInputAudit} from "../lib/calculation-input-audit.ts";
import {buildFeatureLineageAudit} from "../lib/feature-lineage-audit.ts";
import {INTAKE_CATALOG_SEED} from "../lib/intake-catalog.ts";
import {CALCULATION_SPECS} from "../lib/execution-catalog.ts";
const audit=()=>buildCalculationInputAudit(buildFeatureLineageAudit(INTAKE_CATALOG_SEED,"a".repeat(64),{limit:1000}).fields);
test("all 18 calculator contracts are enumerated with full canonical input or unresolved classification",()=>{
 const a=audit();assert.equal(a.moduleCount,18);assert.equal(a.registeredFieldCount,693);
 assert.equal(a.contractInputPaths,CALCULATION_SPECS.reduce((n,s)=>n+s.inputs.length,0));
 assert.ok(a.modules.every(m=>m.declaredInputs.length>0&&m.declaredInputs.every(x=>x.category&&x.missingPolicy)));
 assert.equal(a.completeness,"not_all_inputs_mapped_or_verified");assert.equal(a.courtApprovalInferred,false);
});
test("wage source amounts, time windows, identity and human aggregation are distinct input contracts",()=>{
 const a=audit(),income=a.modules.find(m=>m.calculationId==="income_average")!;
 const find=(s:string)=>income.declaredInputs.find(f=>f.path===s)!;
 assert.equal(find("income.net").category,"direct_canonical_ocr");
 assert.ok(find("income.net").canonicalFieldIds.includes("payroll_payslip::income.payroll.net_pay"));
 assert.equal(find("income.amountBasis").category,"derived_from_ocr_review_required");
 const combine=a.modules.find(m=>m.calculationId==="income_aggregation")!;
 assert.equal(combine.declaredInputs.find(x=>x.path==="income.payerIdentityId")?.category,"typed_case_input_with_no_direct_canonical_ocr_mapping");
 assert.equal(combine.declaredInputs.find(x=>x.path==="income.aggregationTreatment")?.category,"typed_case_input_with_no_direct_canonical_ocr_mapping");
});
test("debt and asset unproven legal classification cannot become an OCR numeric input",()=>{
 const a=audit(),asset=a.modules.find(m=>m.calculationId==="asset_liquidation")!;
 assert.equal(asset.declaredInputs.find(x=>x.path==="asset.ownershipBps")?.category,"derived_from_ocr_review_required");
 assert.equal(asset.declaredInputs.find(x=>x.path==="asset.securedPayoffScope")?.category,"typed_case_input_with_no_direct_canonical_ocr_mapping");
 const debt=a.modules.find(m=>m.calculationId==="debt_cap")!;
 assert.equal(debt.declaredInputs.find(x=>x.path==="debt.classification")?.category,"typed_case_input_with_no_direct_canonical_ocr_mapping");
 assert.equal(debt.declaredInputs.find(x=>x.path==="context.asOf")?.category,"reviewed_case_context_not_ocr");
});
