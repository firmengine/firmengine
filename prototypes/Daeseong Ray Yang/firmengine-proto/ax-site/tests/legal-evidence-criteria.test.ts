import test from "node:test";
import assert from "node:assert/strict";
import {LEGAL_EVIDENCE_POLICY_REFERENCE_ID,LEGAL_EVIDENCE_POLICY_SEED,legalEvidenceCriterion,legalEvidenceInventory,validateLegalEvidencePolicy} from "../lib/legal-evidence-criteria.ts";
import {referenceRecord,validateReferenceValue} from "../lib/reference-registry.ts";
const criterion={checkId:"DOC-01",reviewStatus:"approved_for_evidence_routing",requiredCanonicalFieldGroups:[["payroll_payslip::income.payroll.net_pay"]],requiredCalculationOutputs:["monthlyIncomeWon"],
 sourceUrls:["https://www.law.go.kr/"],courtIds:["seoul"],effectiveFrom:null,effectiveTo:null,
 reason:"법률 전문가가 원문·사건별 요건·피처를 대조한 계약"} as const;
test("all 95 legal checks are visible but never automatically marked evidence-complete",()=>{
 const rows=legalEvidenceInventory("seoul","2026-10-30");
 assert.equal(rows.length,95);assert.ok(rows.every(row=>row.status==="unmapped"));
 assert.ok(rows.every(row=>row.noAutomaticLegalApproval===true));
 const record=referenceRecord(LEGAL_EVIDENCE_POLICY_REFERENCE_ID);assert.equal(record?.editable,true);
 validateReferenceValue(record!,LEGAL_EVIDENCE_POLICY_SEED);
});
test("exact canonical field group, calculation and official authority can be approved in reference proposal",()=>{
 const policy={schemaVersion:LEGAL_EVIDENCE_POLICY_SEED.schemaVersion,checks:[{...criterion,requiredCanonicalFieldGroups:criterion.requiredCanonicalFieldGroups.map(g=>[...g]),
  requiredCalculationOutputs:[...criterion.requiredCalculationOutputs],sourceUrls:[...criterion.sourceUrls],courtIds:[...criterion.courtIds]}]};
 validateLegalEvidencePolicy(policy);assert.equal(policy.checks.length,1);
 assert.equal(legalEvidenceCriterion("DOC-01","seoul","2026-10-30").status,"unmapped");
});
test("unknown canonical id, duplicate checks and untrusted authority must fail closed",()=>{
 const base=JSON.parse(JSON.stringify({schemaVersion:"legal-risk-evidence-contracts/1",checks:[criterion]}));
 base.checks[0].requiredCanonicalFieldGroups=[["invalid::fiction"]];
 assert.throws(()=>validateLegalEvidencePolicy(base),/INVALID_/);
 const duplicate=JSON.parse(JSON.stringify({schemaVersion:"legal-risk-evidence-contracts/1",checks:[criterion,criterion]}));
 assert.throws(()=>validateLegalEvidencePolicy(duplicate),/INVALID_/);
 const url=JSON.parse(JSON.stringify({schemaVersion:"legal-risk-evidence-contracts/1",checks:[criterion]}));
 url.checks[0].sourceUrls=["https://example.com"];
 assert.throws(()=>validateLegalEvidencePolicy(url),/INVALID_/);
});
