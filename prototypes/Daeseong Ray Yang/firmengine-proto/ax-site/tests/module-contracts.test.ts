import { test } from "node:test";
import assert from "node:assert/strict";
import { MODULE_CONTRACTS } from "../lib/module-contracts.ts";
import { validateModuleContracts } from "../scripts/validate-module-contracts.ts";

test("module contract crosswalk covers all canonical extraction fields with evidenced mappings", () => {
  assert.equal(MODULE_CONTRACTS.fieldCrosswalk.length, 524);
  assert.equal(new Set(MODULE_CONTRACTS.fieldCrosswalk.map(field => field.fieldId)).size, 524);
  assert.equal(MODULE_CONTRACTS.fieldMappingSummary.runtime_mapped, 29);
  assert.equal(MODULE_CONTRACTS.fieldMappingSummary.source_only, 495);
  assert.ok(MODULE_CONTRACTS.fieldCrosswalk.every(field => field.producer && field.consumerMapping.status));
});
test("module contract graph validates cleanly", () => {
  assert.deepEqual(validateModuleContracts(), []);
});
test("validator reports unknown units and missing producers", () => {
  const broken = structuredClone(MODULE_CONTRACTS) as any;
  broken.fieldCrosswalk[0].unit = "unknown";
  broken.fieldCrosswalk[1].producer = "";
  const issues = validateModuleContracts(broken);
  assert.ok(issues.some(issue => issue.code === "missing_unit" && issue.id === broken.fieldCrosswalk[0].fieldId));
  assert.ok(issues.some(issue => issue.code === "missing_producer" && issue.id === broken.fieldCrosswalk[1].fieldId));
});
test("validator detects calculation cycles and missing workflow producers", () => {
  const broken = structuredClone(MODULE_CONTRACTS) as any;
  const calc = broken.groups.calculations[0];
  calc.dependsOn = [calc.id];
  broken.groups.workflows[0].produces = ["missing_calculation"];
  const issues = validateModuleContracts(broken);
  assert.ok(issues.some(issue => issue.code === "cycle"));
  assert.ok(issues.some(issue => issue.code === "missing_producer" && issue.detail.includes("missing_calculation")));
});
