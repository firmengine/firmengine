import test from "node:test";
import assert from "node:assert/strict";
import {INTAKE_CATALOG_SEED} from "../lib/intake-catalog.ts";
import {auditIntakeDocumentContracts} from "../lib/intake-document-contract-audit.ts";
test("85 source types stay traceable without accidentally making OCR candidate a legal proof",()=>{
 const report=auditIntakeDocumentContracts(INTAKE_CATALOG_SEED,"a".repeat(64));
 assert.equal(report.summary.total,85);
 assert.equal(report.summary.noOcrCandidates,0);
 assert.equal(new Set(report.documents.map(x=>x.documentTypeId)).size,85);
 assert.ok(report.documents.every(x=>x.requiredSourceLabels.length>0));
 assert.ok(report.documents.every(x=>x.ocrCandidateCanonicalIds.length>0));
 assert.ok(report.documents.every(x=>!x.legalSufficiencyInferred));
 assert.ok(report.summary.sourceMappingUnreviewed>0);
});
test("only a single requested document can be inspected without altering the contract",()=>{
 const result=auditIntakeDocumentContracts(INTAKE_CATALOG_SEED,"a".repeat(64),{documentTypeId:"salary_withholding"});
 assert.equal(result.documents.length,1);
 assert.ok(result.documents[0].directRuleIds.includes("INTAKE-003"));
 assert.ok(result.documents[0].ocrCandidateCanonicalIds.length>0);
 assert.throws(()=>auditIntakeDocumentContracts(INTAKE_CATALOG_SEED,"a".repeat(64),{documentTypeId:"invented"}),/UNKNOWN_/);
});
