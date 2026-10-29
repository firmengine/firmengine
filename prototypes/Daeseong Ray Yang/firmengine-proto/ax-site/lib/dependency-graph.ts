import { MODULE_CONTRACTS } from "./module-contracts.ts";

export interface DependencyNode { id: string; kind: "field" | "calculation" | "workflow" | "intake_rule"; produces: string[]; dependsOn: string[]; unit?: string | null; }
export const DEPENDENCY_NODES: DependencyNode[] = [
  ...MODULE_CONTRACTS.fieldCrosswalk.map(field => ({ id: field.fieldId, kind: "field" as const, produces: [field.fieldId], dependsOn: [] as string[], unit: field.unit })),
  ...MODULE_CONTRACTS.groups.calculations.map(calc => ({ id: calc.id, kind: "calculation" as const, produces: calc.outputs, dependsOn: [...calc.inputs, ...calc.dependsOn] })),
  ...MODULE_CONTRACTS.groups.workflows.map(workflow => ({ id: workflow.id, kind: "workflow" as const, produces: workflow.produces, dependsOn: workflow.blockedBy })),
  ...MODULE_CONTRACTS.groups.intakeRules.map(rule => ({ id: rule.id, kind: "intake_rule" as const, produces: rule.featureIds, dependsOn: rule.documentIds })),
];

export function dependencyGraph() { return DEPENDENCY_NODES; }
