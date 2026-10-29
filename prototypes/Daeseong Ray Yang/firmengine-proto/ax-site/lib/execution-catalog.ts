import decisionTables from "./reference-decision-tables.json" with { type: "json" };
import { readReferenceValue, referenceIdentity } from "./reference-runtime.ts";
import { WORKFLOW_RULES, getWorkflowRules } from "./workflow-rules.ts";
import { LEGAL_CATALOG, RISK_CATALOG, CURRENT_RULESET } from "./legal-rules.ts";
import legalExceptions from "./legal-exceptions.json" with {type:"json"};
import sourceContracts from "./document-agent-field-contracts.json" with { type: "json" };
import type { ArtifactKind } from "./domain.ts";

/** Executable boundaries, not a second implementation of the arithmetic. */
export const EXECUTION_CONTRACT_VERSION = "case-execution/1.1.0";
export interface CalculationSpec {
  id: string; title: string; executor: string; inputs: string[]; dependsOn: string[]; resultPaths: string[];
  outputs: string[]; documents: ArtifactKind[]; formBindings: string[];
  formula: string; rounding: string; decisionBoundary: string;
}
/** The full formula, condition, rounding and form mappings live in the reference table. */
export const CALCULATION_SPECS = decisionTables.calculations as unknown as readonly CalculationSpec[];
export const WORKFLOW_CALCULATIONS: Readonly<Record<string, readonly string[]>> = decisionTables.workflowCalculations;
export function getCalculationSpecs(): readonly CalculationSpec[] {
  return CALCULATION_SPECS.map(row => readReferenceValue(`calculation.${row.id}`, row));
}

export function executionCatalog() {
  const workflows=getWorkflowRules().map(rule=>({...rule,calculationIds:WORKFLOW_CALCULATIONS[rule.id]??[],node:"case_planner"}));
  return {
    version:EXECUTION_CONTRACT_VERSION,ruleReleaseId:CURRENT_RULESET.id,
    referenceRelease:referenceIdentity(),calculations:getCalculationSpecs(),workflows,
    legalRules:LEGAL_CATALOG.map(rule=>({...rule,node:"legal_review",workflowIds:WORKFLOW_RULES.filter(w=>w.ruleIds.includes(rule.id)).map(w=>w.id),automaticCourtDecision:false})),
    risks:RISK_CATALOG.map(risk=>({...risk,node:"legal_review",automaticCourtDecision:false})),
    sourceFamilies:Object.values(sourceContracts.families),
    exceptions:legalExceptions.scenarios.map(scenario=>({...scenario,node:"legal_review",automaticCourtDecision:false})),
    scope:"현재 저장소의 규칙·산식·문서·추출 명세. 모든 현실 사건이나 모든 법원 재량을 구현했다는 뜻이 아님.",
  };
}
