import test from "node:test";
import assert from "node:assert/strict";
import {INTAKE_CATALOG_SEED} from "../lib/intake-catalog.ts";
import {buildFeatureLineageAudit,auditLegalRiskContracts,auditCourtPracticeGaps,evaluateCaseFieldLineage} from "../lib/feature-lineage-audit.ts";
const sha="a".repeat(64);
test("one record for each of the 693 active canonical fields, including 19 supplemental fields",()=>{
 const r=buildFeatureLineageAudit(INTAKE_CATALOG_SEED,sha,{limit:1000});
 assert.equal(r.summary.documentTypes,85);
 assert.equal(r.summary.canonicalFieldIds,693);
 assert.equal(r.summary.sourceSlots,1808);
 assert.equal(new Set(r.fields.map(f=>f.canonicalFieldId)).size,693);
 assert.ok(r.fields.every(f=>f.database.missingTable==="extraction_field_coverage"&&f.forms.length>0));
 assert.equal(r.legalApprovalInferred,false);
});
test("known salary and debt keys reach explicit typed case candidates; premium is not surrender",()=>{
 const r=buildFeatureLineageAudit(INTAKE_CATALOG_SEED,sha,{limit:1000});
 const get=(id:string)=>r.fields.find(f=>f.canonicalFieldId===id)!;
 assert.ok(get("payroll_payslip::income.payroll.net_pay").typedProjections.some(p=>p.caseFactKey==="income.net"));
 assert.ok(get("debt_certificate::interest_balance").typedProjections.some(p=>p.caseFactKey==="debt.interest"));
 assert.equal(get("insurance_policy_asset::total_premium").typedProjections.length,0);
 assert.equal(get("debt_certificate::original_principal").calculations.length,0);
});
test("law check gaps are explicitly unresolved, not grounds for automatic legal pass",()=>{
 assert.equal(auditLegalRiskContracts().riskChecks,95);
 assert.equal(auditLegalRiskContracts().featurelessRiskChecks,88);
 assert.ok(auditCourtPracticeGaps().gaps.some(x=>x.condition==="business_income"));
});
test("only expressly reviewed case-required canonical IDs become missing-evidence blocker candidates",()=>{
 const r=buildFeatureLineageAudit(INTAKE_CATALOG_SEED,sha,{limit:1000});
 const d={context:{id:"synthetic-case",revision:1},facts:[],workflowState:{requirements:[{
  requirementId:"R1",retired:false,waivedByReview:false,notApplicableConfirmed:false,mappingRequired:false,
  crosswalkReview:{reviewer:"staff"},requiredFieldGroups:[["debt_certificate::principal_balance"]]
 }]}} as unknown as Parameters<typeof evaluateCaseFieldLineage>[0];
 const a=evaluateCaseFieldLineage(d,r.fields,{limit:1000});
 assert.equal(a.summary.requiredBlocked,1);
 assert.equal(a.summary.requiredFieldIds,1);
 assert.ok(a.fields.find(f=>f.canonicalFieldId==="debt_certificate::principal_balance")?.blockerCandidates.includes("REQUIRED_CANONICAL_FIELD_NOT_OBSERVED"));
 assert.equal(a.fields.find(f=>f.canonicalFieldId==="debt_certificate::original_principal")?.blockerCandidates.length,0);
});

test("shared extension IDs repeated across distinct OCR families are merged, not rejected",()=>{
 const result=buildFeatureLineageAudit(INTAKE_CATALOG_SEED,sha,{limit:1000});
 const row=result.fields.find(f=>f.canonicalFieldId==="income_source_inventory::income_source_id");
 assert.ok(row);
 assert.ok(row.familyIds.includes("employment_relationship"));
 assert.ok(row.familyIds.includes("current_nonwage_income"));
 assert.ok(row.familyIds.includes("business_current_income_summary"));
 assert.equal(new Set(row.familyIds).size,row.familyIds.length);
 assert.equal(result.summary.canonicalFieldIds,693);
 assert.equal(result.summary.sourceSlots,1808);
});
