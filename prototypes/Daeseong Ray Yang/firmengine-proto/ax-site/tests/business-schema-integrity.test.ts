import test from "node:test";
import assert from "node:assert/strict";
import {businessSchemaIntegrityAudit} from "../lib/business-schema-integrity.ts";
import {BUSINESS_SOURCE_MONEY_ROLES,BUSINESS_SOURCE_PERIOD_FIELDS} from "../lib/business-source-evidence.ts";
import {getCalculationSpecs} from "../lib/execution-catalog.ts";

test("11 business OCR amount fields, 6 source dates and all 91 declared calculator inputs remain consistent",()=>{
 const result=businessSchemaIntegrityAudit();
 assert.equal(result.registeredCanonicalFields,693);
 assert.equal(result.businessMoneyFields,11);
 assert.equal(result.periodBoundaryFields,6);
 assert.equal(result.validatedSourceConsumers,17);
 assert.equal(result.registeredCalculations,18);
 assert.equal(result.registeredCalculationInputSlots,91);
 assert.deepEqual(result.issues,[],"A new source schema mismatch must fail the regression");
 assert.equal(result.compatibleStaticContracts,true);
});
test("static schema contract inspection never impersonates physical D1, court e-form or legal approval verification",()=>{
 const result=businessSchemaIntegrityAudit();
 assert.equal(result.physicalD1RowsInspected,false);
 assert.equal(result.caseFactsInspected,false);
 assert.equal(result.courtOfficialFormFieldsVerified,false);
 assert.equal(result.legalApprovalInferred,false);
});
test("input VAT is separate from sales VAT and a net receipt is not a cost input",()=>{
 assert.equal(BUSINESS_SOURCE_MONEY_ROLES["business_costs_and_ledgers::income.business_cost.tax_component"],"input_vat");
 assert.equal(BUSINESS_SOURCE_MONEY_ROLES["business_sales_vat::income.sales.vat_collected"],"vat_collected");
 assert.equal(BUSINESS_SOURCE_MONEY_ROLES["business_current_income_summary::income.self_employment.net_receipt"],"net_cash_received");
 assert.deepEqual(Object.keys(BUSINESS_SOURCE_PERIOD_FIELDS).sort(),[
  "business_costs_and_ledgers","business_current_income_summary","business_sales_vat"].sort());
 const form=getCalculationSpecs().find(spec=>spec.id==="form_projection");
 assert.ok(form?.formBindings.includes("scalars.monthly_business_income"));
});
