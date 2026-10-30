/** P0-09: five-stage PRE-approval trace audit. This is not an independent legal verdict.
 * No fact, calc, court event, policy or human disposition is written by this module.
 */
import type { CaseData, Fact } from "./domain.ts";
import type { Assessment } from "./assessment.ts";
import {auditPreapprovalCourtCorrections} from "./preapproval-correction-audit.ts";

export const PREAPPROVAL_STAGE_VERSION = "preapproval-stage-audit/1" as const;
export type StageId = "P1_DOCUMENTS" | "P2_EVIDENCE" | "P3_CALCULATIONS" | "P4_LEGAL" | "P5_CORRECTIONS";
export type StoredCalcFeature = { calculationId: string; outputName: string; outputPath: string; status: string; valueJson: string; sourceFactIdsJson?: string; formula?: string };
export type CalcSpec = { id: string; inputs: readonly string[]; outputs: readonly string[]; dependsOn: readonly string[] };
export type Risk = { id: string; title?: string; current_rule_ids?: readonly string[] };
export type Exception = { id: string; trigger?: string; ruleRefs?: readonly string[]; features?: readonly string[] };
export type LegalCheck = { id: string; status: string; factIds?: readonly string[]; ruleIds?: readonly string[] };
export type DocumentView = {
  consultationStatus?: string; workflowAdopted?: boolean; workflowProjectionStatus?: string;
  requirements?: readonly { requirementId: string; documentTypeId: string; documentName: string; period: string; requirement: string; observed?: { stage?: string } }[];
  workflowRequests?: readonly { requirementId: string; documentTypeId: string; requiredPeriod: string; requirementStatus: string; activeRequest?: boolean }[];
};
export interface StageAuditInput {
  data: CaseData; facts: readonly Fact[]; assessment: Assessment;
  calculationSpecs: readonly CalcSpec[]; selectedCalculationIds: readonly string[];
  persistedCalculationFeatures: readonly StoredCalcFeature[] | null;
  persistedCalculationComplete: boolean; calculationHeadCurrent: boolean;
  risks: readonly Risk[]; exceptions: readonly Exception[]; legalChecks: readonly LegalCheck[];
  legalCurrent: boolean; documents: DocumentView | null;
  validSourceFactIds: ReadonlySet<string>;
  activeRuleIds?: readonly string[];
}
const uniq = (arr: readonly string[]) => [...new Set(arr)];
const nvl = (v: unknown) => v === null || v === undefined || v === "" || v === "unknown";
const get = (value: unknown, path: string): unknown => path.split(".").reduce<unknown>((o, k) => o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined, value);
function factInput(data: CaseData, facts: readonly Fact[], path: string) {
  const [root, ...segments] = path.split(".");
  const all = root === "income" ? data.incomes : root === "debt" ? data.debts : root === "asset" ? data.assets : root === "transaction" ? data.transactions : null;
  if (all) {
    const field = segments.join(".");
    const records = all.map((o) => ({ objectId: o.id, value: get(o, field), factIds: o.factIds }));
    return { path, lookup: root+"s[]", observation: records.some(row=>!nvl(row.value))?"observed_typed_value":"missing_typed_value",
      values: records.map(row=>({ objectId:row.objectId, value:row.value??null, factIds:[...row.factIds] })) };
  }
  if (root === "household" || root === "context") {
    const value = get(root === "household" ? data.household : data.context, segments.join("."));
    return {path,lookup:root,observation:nvl(value)?"missing_typed_value":"observed_typed_value",values:[{objectId:data.context.id,value:value??null,factIds:root==="household"?[...data.household.factIds]:[]}]};
  }
  const exact = facts.filter(f=>f.key===path);
  return {path,lookup:"current_facts_exact_key",observation:exact.length?"source_fact_candidate":"missing_source_fact",
    values:exact.map(f=>({objectId:f.subjectId,value:f.numeric?.amountWon??f.value,factIds:[f.id]}))};
}
const sourceTable = {
  P1_DOCUMENTS: ["consultation_heads", "case_document_requirements", "case_requirement_field_plans", "cases.payload.workflowState", "case_document_work_events"],
  P2_EVIDENCE: ["document_instances", "extraction_runs", "extraction_records", "extracted_features", "case_extraction_heads", "cases.payload.facts"],
  P3_CALCULATIONS: ["case_calculation_heads", "case_calculation_runs", "case_calculation_features", "reference_decision_tables.calculations"],
  P4_LEGAL: ["case_legal_review_heads", "case_legal_review_runs", "case_legal_conditions", "legal_catalog", "legal_exceptions"],
  P5_CORRECTIONS: ["cases.payload.workflowState.procedureEvents", "case_document_requirements", "case_legal_conditions", "case_automatic_document_runs"],
} as const;
const statusAllowed = new Set(["computed", "provisional", "blocked", "missing", "conflict", "not_applicable"]);
const tableRef = (stage: StageId) => ({stage,storedResources:[...sourceTable[stage]]});

/** Every one of the 18 calculation contracts and its 91 declared inputs is inventoried.
 * A feature is real only when its calculation ID AND exact declared output prefix match.
 * A selected module without a stored output is a gap, never a calculated zero.
 */
export function auditFivePreapprovalStages(input: StageAuditInput) {
  const {data,assessment,facts}=input;
  const active = new Set(input.selectedCalculationIds);
  const rows = input.persistedCalculationFeatures ?? [];
  const calculationModules = input.calculationSpecs.map(spec=>{
    const inputs=spec.inputs.map(path=>factInput(data,facts,path));
    const outputs=spec.outputs.map(output=>{
      // The existing feature serializer namespaces three legal proposal outputs.
      // Read the physical SQL field names, not the unprefixed planning contract.
      const proposalPrefix=spec.id==="living_cost_proposal"?"proposals.livingCost":
        spec.id==="objection_minimum"?"proposals.objectionMinimum":
        spec.id==="seoul_short_term"?"proposals.termCandidate":null;
      const matches=rows.filter(row=>row.calculationId===spec.id &&
        (row.outputName===output || row.outputName.startsWith(output+".") ||
        (proposalPrefix!==null&&(row.outputName===proposalPrefix||row.outputName.startsWith(proposalPrefix+".")))));
      const usable=matches.filter(row=>statusAllowed.has(row.status) && (()=>{try{JSON.parse(row.valueJson);return true;}catch{return false;}})());
      const hasUnknown=usable.some(row=>["missing","blocked","conflict"].includes(row.status));
      const state=matches.length===0?"not_persisted":usable.length!==matches.length?"invalid_persisted_row":hasUnknown?"stored_unresolved":"stored_observation_only";
      return {output,state,storedRows:matches.map(row=>({outputName:row.outputName,outputPath:row.outputPath,status:row.status,
        value: (()=>{try{return JSON.parse(row.valueJson);}catch{return null;}})(),
        sourceFactIds:(()=>{try{return JSON.parse(row.sourceFactIdsJson??"[]");}catch{return [];}})(),formula:row.formula??null}))};
    });
    const persisted=outputs.every(output=>output.state==="stored_observation_only");
    return {id:spec.id,declaredInputs:inputs,declaredOutputs:outputs,dependsOn:[...spec.dependsOn],
      selectedForCurrentCase:active.has(spec.id),outputPersistence:
        input.calculationHeadCurrent&&input.persistedCalculationComplete&&persisted?"observed_current_run":
        active.has(spec.id)?"selected_needs_output_or_review":"not_selected_or_not_applicable_unproven"};
  });
  const moduleIds=new Set(calculationModules.map(c=>c.id));
  const undeclaredSelected=uniq(input.selectedCalculationIds).filter(id=>!moduleIds.has(id));
  const duplicateModuleIds=uniq(input.calculationSpecs.map(s=>s.id).filter((id,i,all)=>all.indexOf(id)!==i));
  const docMonitor=input.documents;
  const docUnresolved=!docMonitor?null:docMonitor.workflowAdopted?
    (docMonitor.workflowRequests??[]).filter(row=>row.activeRequest!==false&&!['satisfied','not_applicable_confirmed','waived_by_review','retired'].includes(row.requirementStatus)):
    (docMonitor.requirements??[]).filter(row=>row.requirement!=="recommended");
  const currentLegal=new Map(input.legalCurrent?input.legalChecks.map(check=>[check.id,check]):[]);
  const riskReview=input.risks.map(risk=>({id:risk.id,title:risk.title??risk.id,ruleIds:[...(risk.current_rule_ids??[])],
    status:currentLegal.get(risk.id)?.status??"not_currently_reviewed",
    factIds:[...(currentLegal.get(risk.id)?.factIds??[])],
    reviewedCurrent:currentLegal.has(risk.id)}));
  const unknownLegalIds=input.legalChecks.filter(c=>!input.risks.some(r=>r.id===c.id)).map(c=>c.id);
  const knownFacts=facts.filter(f=>input.validSourceFactIds.has(f.id));
  const unresolvedFacts=facts.filter(f=>!input.validSourceFactIds.has(f.id));
  const recordedCorrections=(data.workflowState?.procedureEvents??[]).filter(e=>e.state==="correction_requested");
  const activeBeforeApproval=!(data.workflowState?.procedureEvents??[]).some(e=>["approved","discharged"].includes(e.state));
  const correctionDeadlines=facts.filter(f=>["court.correctionDeadline","corrections.deadline"].includes(f.key)&&input.validSourceFactIds.has(f.id));
  const sourceCurrent=!!input.documents && docMonitor?.workflowProjectionStatus==="current";
  const stage1={...tableRef("P1_DOCUMENTS"),state:!sourceCurrent?"unavailable":docUnresolved?.length?"needs_documents":"for_staff_review",
    consultedDocumentRequests:docMonitor?.requirements?.length??null,adoptedWorkflowRequests:docMonitor?.workflowRequests?.length??null,
    missingOrUnresolvedRequests:docUnresolved?.map(x=>({id:x.requirementId,documentTypeId:x.documentTypeId,
      period:"requiredPeriod" in x?x.requiredPeriod:x.period,status:"requirementStatus" in x?x.requirementStatus:x.requirement}))??[],
    legalReviewReferences:["KR-PR-011","KR-PR-012","KR-PR-047"],lawArticles:["KR-589","KR-595","KR-610"]};
  const stage2={...tableRef("P2_EVIDENCE"),state:unresolvedFacts.length?"source_verification_required":"source_observations_inspected",
    activeFactCount:facts.length,sourceVerifiedAndAcceptedCount:knownFacts.length,unverifiedOrUnacceptedCount:unresolvedFacts.length,
    unverifiedFactIds:unresolvedFacts.map(f=>f.id),sourceEvidenceIsNotLegalAcceptance:true,
    legalReviewReferences:["KR-PR-014","KR-PR-016","KR-PR-020","KR-PR-027"],lawArticles:["KR-589","KR-595"]};
  const gapModules=calculationModules.filter(c=>c.selectedForCurrentCase&&c.outputPersistence!=="observed_current_run");
  const stage3={...tableRef("P3_CALCULATIONS"),state:input.calculationHeadCurrent&&input.persistedCalculationComplete&&!gapModules.length&&!undeclaredSelected.length?"trace_inspected":"calculation_audit_required",
    declaredModuleCount:calculationModules.length,declaredInputCount:calculationModules.reduce((n,m)=>n+m.declaredInputs.length,0),
    declaredOutputCount:calculationModules.reduce((n,m)=>n+m.declaredOutputs.length,0),
    selectedModuleCount:active.size,missingSelectedModuleIds:gapModules.map(x=>x.id),undeclaredSelectedModuleIds:undeclaredSelected,duplicateModuleIds,
    persistedFeatureRows:input.persistedCalculationFeatures?.length??null,calculationHeadCurrent:input.calculationHeadCurrent,
    calculationFeatureReadComplete:input.persistedCalculationComplete,allModules:calculationModules,
    legalReviewReferences:["KR-PR-004","KR-PR-006","KR-PR-007","KR-PR-021","KR-PR-036","KR-PR-043","KR-PR-045"],
    lawArticles:["KR-579","KR-611","KR-614"]};
  const q=assessment.calculation;
  const statutoryPreflight=[
    {id:"KR-614-1-1",topic:"변제계획의 법률 적합성",state:"lawyer_review_required",value:null,inputs:["context.ruleReleaseId","context.ruleApplicationReviewed","assessment.findings"],legalRuleIds:["KR-PR-041","KR-PR-047"]},
    {id:"KR-614-1-2",topic:"공정·형평·수행가능성",state:"lawyer_review_required",value:q.ordinaryRepaymentBudgetWon,inputs:["ordinaryRepaymentBudgetWon","monthlyPaymentWon","planTotalWon","allocations","planReconciliation"],legalRuleIds:["KR-PR-036","KR-PR-040","KR-PR-048"]},
    {id:"KR-614-1-3",topic:"인가 전 비용·수수료 납부",state:"source_and_lawyer_review_required",value:null,inputs:["court.costOrder","payments.feesPaid","payments.receipts"],legalRuleIds:["KR-PR-046"]},
    {id:"KR-614-1-4",topic:"청산가치 보장",state:q.liquidationComparison==="unknown"?"calculation_input_missing":q.liquidationComparison==="not_met"?"numerical_shortfall_requires_review":"numerically_met_but_legal_review_required",
      value:q.liquidationComparison,inputs:["liquidationValueWon","presentValueWon","context.assetValuationBasisReviewed","context.presentValueReviewed"],legalRuleIds:["KR-PR-043"]},
    {id:"KR-614-2",topic:"이의 있는 사건의 추가 요건",state:"objection_evidence_and_lawyer_review_required",value:null,
      inputs:["context.courtObjection","proposals.objectionMinimum","claims.presentValue","plan.repaymentPresentValue"],legalRuleIds:["KR-PR-044","KR-PR-045"]},
  ];
  const deferredExceptions=input.exceptions.filter(x=>["EL-40","EL-46"].includes(x.id)).map(x=>x.id);
  const preapprovalExceptions=input.exceptions.filter(x=>!deferredExceptions.includes(x.id));
  const exceptionCoverage=input.exceptions.map(item=>({
    id:item.id,trigger:item.trigger??"",ruleIds:[...(item.ruleRefs??[])],
    candidateFeatures:[...(item.features??[])],
    stageDisposition:deferredExceptions.includes(item.id)?"deferred_postapproval":"requires_case_specific_lawyer_review",
    automaticallySatisfied:false as const,
    ruleApplicabilityApproved:false as const,
  }));
  const stage4={...tableRef("P4_LEGAL"),state:input.legalCurrent&&riskReview.every(r=>r.reviewedCurrent)?"lawyer_review_required":"legal_coverage_incomplete",
    expectedRiskCount:input.risks.length,currentRiskCount:riskReview.filter(r=>r.reviewedCurrent).length,
    notCurrentRiskIds:riskReview.filter(r=>!r.reviewedCurrent).map(r=>r.id),unknownLegalIds,
    exceptionScenarioCount:input.exceptions.length,exceptionCoverage,preapprovalExceptionIds:preapprovalExceptions.map(x=>x.id),deferredPostapprovalExceptionIds:deferredExceptions,
    riskChecks:riskReview,statutoryPreflight,legalReviewReferences:["KR-PR-043","KR-PR-044","KR-PR-045","KR-PR-046","KR-PR-048"],
    lawArticles:["KR-610","KR-611","KR-613","KR-614"]};
  const courtOrderAudit=auditPreapprovalCourtCorrections(data,facts,input.validSourceFactIds);
  const stage5={...tableRef("P5_CORRECTIONS"),state:!activeBeforeApproval?"outside_preapproval_scope":recordedCorrections.length?"court_order_itemization_required":"court_order_not_observed",
    courtOrderAudit,
    courtOrderEvents:recordedCorrections.map(e=>({id:e.id,at:e.occurredAt,sourceDocumentIds:[...e.sourceDocumentIds],courtReference:e.courtReference,
      reason:e.reason,relatedFields:[...e.relatedFields],deadlineEvidenceIds:correctionDeadlines.map(f=>f.id),
      itemLevelDeadlineAndResponseVerified:false})),
    correctionDeadlineFactIds:correctionDeadlines.map(f=>f.id),
    expectedCourtOrderItemizationMissing:recordedCorrections.length>0,
    predictedIssuesMustNotBeLabeledCourtOrders:true,
    legalReviewReferences:["KR-PR-049","KR-PR-047","KR-PR-038"],lawArticles:["KR-610","KR-613","KR-614"]};
  return {
    schemaVersion:PREAPPROVAL_STAGE_VERSION,caseId:data.context.id,caseRevision:data.context.revision,
    scope:"through_approval_only",lawyerMustReview:true,courtApprovalInferred:false as const,
    stages:[stage1,stage2,stage3,stage4,stage5] as const,
    coverage:{declaredCalculations:calculationModules.length,declaredCalculationInputs:stage3.declaredInputCount,
      declaredCalculationOutputs:stage3.declaredOutputCount,expectedRiskChecks:riskReview.length,
      registeredExceptionScenarios:input.exceptions.length,currentRiskChecks:stage4.currentRiskCount,
      unlinkedSelectedCalculations:[...gapModules.map(m=>m.id),...undeclaredSelected],
      sourceUnverifiedFactCount:unresolvedFacts.length,unresolvedDocuments:docUnresolved?.length??null,
      inferredCourtApproval:false as const},
    note:"All 18 declared calculators, 91 input declarations and 95 legal risks are inventoried; this is NOT proof that every output was invoked or every case is legally adequate. Missing outputs and unapproved evidence contracts remain review gaps.",
  };
}
