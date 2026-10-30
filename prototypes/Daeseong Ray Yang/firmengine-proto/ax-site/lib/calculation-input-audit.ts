/** Exact path contract between 18 calculation modules and current canonical OCR keys.
 * This is a read-only dependency audit, not a computation or legal eligibility verdict.
 * Never bind by labels, fuzzy names, or 'same amount' heuristics.
 */
import type {CalculationSpec} from "./execution-catalog.ts";
import {getCalculationSpecs} from "./execution-catalog.ts";
export const CALCULATION_INPUT_AUDIT_VERSION="calculator-input-compatibility/1";
type Lineage={canonicalFieldId:string;typedProjections:readonly {recordCategory:string;key:string;caseFactKey:string;sourceFamilyId?:string}[]};
const normalized=(s:string)=>s.replace(/([a-z0-9])([A-Z])/g,"$1_$2").toLowerCase();
/** A derived path is NEVER an exact OCR field. The calculator must validate its evidence/semantics. */
const DERIVED:Readonly<Record<string,readonly string[]>>={
  "income.amount_basis":["income.period_start","income.period_end"],
  "income.period_months":["income.period_start","income.period_end"],
  "asset.ownership_bps":["asset.ownership_share"],
  "debt.principal":["debt.principal_balance"],
  "asset.gross_value":["asset.surrender_value"],
};
const CASE_TYPES=new Set(["income","debt","asset","transaction","household"]);
/** Some declared calculation keys deliberately address validated Fact rows, NOT
 * properties on CaseData.context or CaseData.household. Do not pretend
 * that reading context.planApprovalDate from the context object succeeds.
 */
const FACT_ONLY_PATHS=new Set(["context.plan_approval_date","household.minor_children","household.single_parent"]);

export function buildCalculationInputAudit(
 sourceFields:readonly Lineage[],specs:readonly CalculationSpec[]=getCalculationSpecs()
){
 const map=new Map<string,Set<string>>();
 for(const field of sourceFields)for(const t of field.typedProjections){
  const key=normalized(t.caseFactKey),candidates=map.get(key)??new Set<string>();
  candidates.add(field.canonicalFieldId);map.set(key,candidates);
 }
 const modules=specs.map(spec=>({
  calculationId:spec.id,title:spec.title,executor:spec.executor,dependencies:spec.dependsOn,
  outputs:spec.outputs,declaredInputs:spec.inputs.map(path=>{
   const key=normalized(path),primary=[...(map.get(key)??new Set<string>())].sort(),
     derived=primary.length?[]:[...new Set((DERIVED[key]??[]).flatMap(other=>[...(map.get(other)??[])]) )].sort();
   const root=path.split(".")[0];
   const category=primary.length?"direct_canonical_ocr" :
     derived.length?"derived_from_ocr_review_required":
     FACT_ONLY_PATHS.has(key)?"source_verified_legal_fact_not_case_property":
     root==="context"?"reviewed_case_context_not_ocr":
     CASE_TYPES.has(root)?"typed_case_input_with_no_direct_canonical_ocr_mapping":
     "calculation_or_legal_decision_input_not_direct_ocr";
   return {path,category,canonicalFieldIds:primary,derivedCandidateFieldIds:derived,
     format:"Only explicit source ID, quoted value/unit, source row/period and reviewed typed case input may feed arithmetic.",
     missingPolicy:category==="direct_canonical_ocr"?"requires_valid_source_and_case_approval":"never_impute_from_similar_named_ocr_or_zero",
     legalApprovalInferred:false};
  })
 }));
 const rows=modules.flatMap(m=>m.declaredInputs.map(f=>({calculationId:m.calculationId,...f})));
 const tally=(category:string)=>rows.filter(f=>f.category===category).length;
 return {schemaVersion:CALCULATION_INPUT_AUDIT_VERSION,moduleCount:modules.length,registeredFieldCount:sourceFields.length,
  contractInputPaths:rows.length,directPaths:tally("direct_canonical_ocr"),
  derivedCandidatePaths:tally("derived_from_ocr_review_required"),
  unboundTypedInputPaths:tally("typed_case_input_with_no_direct_canonical_ocr_mapping"),
  reviewedContextPaths:tally("reviewed_case_context_not_ocr"),
  sourceVerifiedFactPaths:tally("source_verified_legal_fact_not_case_property"),
  otherLegalAndToolPaths:tally("calculation_or_legal_decision_input_not_direct_ocr"),
  completeness:"not_all_inputs_mapped_or_verified",
  automaticCalculationApproval:false,courtApprovalInferred:false,modules};
}
