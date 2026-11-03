/** A3 r71 — diagnostic-only RED tests, not release-ready and not an approved rule.
 * Exact canonical contracts from the current registry. No real OCR values or
 * customers. Proposed error semantics must be reviewed before any runtime
 * change, especially for raw Korean date ranges and refund/payment direction.
 *
 * Two tests deliberately fail against the current main gate. Do not merge
 * this diagnostic PR until normalization policy and regression expectations
 * are approved and implemented. Source-only evidence must never be discarded.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { sharedDocumentFieldContract } from "../lib/shared-document-catalog.ts";
import { calculationSourceCellIssues } from "../lib/ocr-calculation-input.ts";

const definition=(documentId:string,familyId:string,canonicalFieldId:string)=>{
  const contract=sharedDocumentFieldContract(documentId,familyId);
  assert.ok(contract,"registered document family must exist");
  const field=contract.fields.find(f=>f.global_field_id===canonicalFieldId);
  assert.ok(field,"canonical source ID must exist: "+canonicalFieldId);
  return field;
};
const source=(value:string|null,unit:string|null,sourceState="present")=>({
  value,unit,sourceState,quote:"SYNTHETIC source label and original value",
  confidence:"clear" as const
});
const range=()=>definition("salary_withholding","wage_withholding_tax",
  "wage_withholding_tax::income.tax.employment_start_end");
const settlement=()=>definition("salary_withholding","wage_withholding_tax",
  "wage_withholding_tax::income.tax.year_end_adjustment");

test("A3 r71 control: garnishment monetary amount requires source unit; source-only zero and unseen remain distinct",()=>{
  const money=definition("litigation_record","account_garnishment","account_garnishment::garnishment_amount");
  assert.ok(calculationSourceCellIssues(source("12000",null),money).includes("SOURCE_MONETARY_UNIT_MISSING"));
  assert.deepEqual(calculationSourceCellIssues(source("0","KRW"),money),[]);
  assert.deepEqual(calculationSourceCellIssues(source(null,null,"not_seen"),money),[]);
});
test("A3 r71 control: valid range and nonnumeric settlement status are retained as observations",()=>{
  assert.deepEqual(calculationSourceCellIssues(source("2025-01-01/2025-12-31",null),range()),[]);
  assert.deepEqual(calculationSourceCellIssues(source("pending",null),settlement()),[]);
});
test("A3 P2 EXPECTED RED: non-date or reversed employment range must require a human review marker",()=>{
  for(const invalid of ["not/a/range","2025-12-31/2025-01-01","2025-02-29/2025-03-01"]){
    const issues=calculationSourceCellIssues(source(invalid,null),range());
    assert.ok(issues.length>0,"date_range accepted without source format review: "+invalid);
  }
});
test("A3 P2 EXPECTED RED: numeric settlement without currency cannot pass the same source format gate",()=>{
  const missing=calculationSourceCellIssues(source("1234",null),settlement());
  assert.ok(missing.includes("SOURCE_MONETARY_UNIT_MISSING"),
    "numeric money_or_status lacks a source unit; do not silently infer KRW or a refund direction");
  const foreign=calculationSourceCellIssues(source("1234","USD"),settlement());
  assert.ok(foreign.includes("SOURCE_MONEY_NOT_EXACT_KRW"),
    "foreign numeric settlement remains source evidence, not an exact KRW calculation");
});
