import { MODULE_CONTRACTS } from "../lib/module-contracts.ts";
import { DEPENDENCY_NODES } from "../lib/dependency-graph.ts";

export interface ContractIssue { code: "duplicate_id" | "missing_producer" | "cycle" | "missing_unit" | "unmapped_field"; id: string; detail: string; }
export function validateModuleContracts(contracts: typeof MODULE_CONTRACTS = MODULE_CONTRACTS): ContractIssue[] {
  const issues: ContractIssue[] = [], ids = new Set<string>();
  for (const field of contracts.fieldCrosswalk) {
    if (ids.has(field.fieldId)) issues.push({ code: "duplicate_id", id: field.fieldId, detail: "field ID appears more than once" });
    ids.add(field.fieldId);
    if (!field.producer.trim()) issues.push({ code: "missing_producer", id: field.fieldId, detail: "field has no declared producer" });
    if (!field.unit || field.unit === "unknown") issues.push({ code: "missing_unit", id: field.fieldId, detail: "unit must be explicit; unknown unit is not a resolved contract" });
    if (!field.consumerMapping.status) issues.push({ code: "unmapped_field", id: field.fieldId, detail: "consumer mapping status is absent" });
  }
  const calculations = new Set(contracts.groups.calculations.map(calc => calc.id));
  for (const workflow of contracts.groups.workflows) for (const calc of workflow.produces) {
    if (!calculations.has(calc)) issues.push({ code: "missing_producer", id: workflow.id, detail: `references missing calculation ${calc}` });
  }
  // Detect cycles among explicit calculation-to-calculation dependencies only.
  const calcIds = new Set(contracts.groups.calculations.map(calc => calc.id));
  const edges = new Map(contracts.groups.calculations.map(calc => [calc.id, calc.dependsOn.filter(dep => calcIds.has(dep))]));
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) { issues.push({ code: "cycle", id, detail: "calculation dependency cycle" }); return; }
    if (visited.has(id)) return;
    visiting.add(id); for (const dep of edges.get(id) ?? []) visit(dep); visiting.delete(id); visited.add(id);
  };
  for (const id of calcIds) visit(id);
  // Every contract source is traceable to one of the current catalogs.
  if (DEPENDENCY_NODES.length < contracts.fieldCrosswalk.length) issues.push({ code: "missing_producer", id: "dependency-graph", detail: "field graph nodes do not cover all field contracts" });
  return issues;
}
if (process.argv[1]?.endsWith("validate-module-contracts.ts")) {
  const issues = validateModuleContracts();
  console.log(JSON.stringify({ ok: issues.length === 0, issueCount: issues.length, issues }, null, 2));
  if (issues.length) process.exitCode = 1;
}
