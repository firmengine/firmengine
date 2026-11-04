import test from "node:test";
import assert from "node:assert/strict";
import {INTAKE_CATALOG_SEED} from "../lib/intake-catalog.ts";
import {buildFeatureLineageAudit} from "../lib/feature-lineage-audit.ts";
import {MATERIAL_CALCULATION_SOURCES} from "../lib/material-calculation-source-gate.ts";
import {OCR_DECLARED_FORM_TARGETS} from "../lib/ocr-chain-matrix.ts";

const inventory=()=>buildFeatureLineageAudit(INTAKE_CATALOG_SEED,"a".repeat(64),{limit:1000});
const field=(id:string)=>{
  const result=inventory().fields.find(row=>row.canonicalFieldId===id);
  assert.ok(result,"canonical ID must be registered: "+id);
  return result;
};

test("person, relationship and service-kind fields are not artificially assigned a fact period",()=>{
  for(const id of [
    "conditional_education_childcare::conditional.education.relation",
    "conditional_medical_expense::conditional.medical.applicant_relation",
    "conditional_medical_expense::conditional.medical.patient",
    "conditional_medical_expense::conditional.medical.provider",
    "conditional_medical_expense::conditional.medical.service_kind",
    "conditional_nonstandard_income_or_household_event::conditional.change.affected_person",
    "bank_transactions::account_id",
    "business_costs_and_ledgers::income.business_cost.expense_category"
  ]){
    assert.equal(field(id).sourceRequirements.periodIdentity,false,id);
    assert.equal(field(id).sourceRequirements.subjectIdentity,true,id);
  }
});

test("actual dated costs, subsidies and change events still require period identity",()=>{
  for(const id of [
    "conditional_education_childcare::conditional.education.subsidy",
    "conditional_medical_expense::conditional.medical.billed_cost",
    "conditional_medical_expense::conditional.medical.expected_recurring_cost",
    "conditional_medical_expense::conditional.medical.paid_cost",
    "conditional_medical_expense::conditional.medical.reimbursement",
    "conditional_nonstandard_income_or_household_event::conditional.change.duration_end",
    "conditional_nonstandard_income_or_household_event::conditional.change.event_kind",
    "conditional_nonstandard_income_or_household_event::conditional.change.expense_delta",
    "payroll_payslip::income.payroll.net_pay"
  ]) assert.equal(field(id).sourceRequirements.periodIdentity,true,id);
});

test("medical and education evidence remains source-only, not a legal, financial or official-form approval",()=>{
  const inventoryResult=inventory();
  const index=inventoryResult.fields.map(row=>row.canonicalFieldId);
  const start=index.indexOf("conditional_education_childcare::conditional.education.relation");
  const end=index.indexOf("conditional_nonstandard_income_or_household_event::conditional.change.expense_delta");
  assert.equal(end-start+1,20);
  const section=inventoryResult.fields.slice(start,end+1);
  assert.equal(section.reduce((sum,row)=>sum+row.sourceSlots,0),44);
  assert.ok(section.every(row=>row.typedProjections.length===0));
  assert.ok(section.every(row=>row.forms.every(form=>form.token==="")));
  assert.ok(section.every(row=>!OCR_DECLARED_FORM_TARGETS[row.canonicalFieldId]));
  assert.equal(inventoryResult.legalApprovalInferred,false);
  assert.equal(inventoryResult.officialEformParity,"not_verified");
});

test("paid medical expense remains context-only, not an automatically accepted monthly living cost",()=>{
  const paid=MATERIAL_CALCULATION_SOURCES.find(row=>
    row.id==="conditional_medical_expense::conditional.medical.paid_cost");
  assert.ok(paid);
  assert.equal(paid.policy,"context_only");
  assert.equal(paid.destination,null);
  const billed=MATERIAL_CALCULATION_SOURCES.find(row=>
    row.id==="conditional_medical_expense::conditional.medical.billed_cost");
  assert.equal(billed,undefined);
});
