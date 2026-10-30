import test from "node:test";
import assert from "node:assert/strict";
import baseCases from "./fixtures/preapproval-source-cases-20261030.json" with {type:"json"};
import extraCases from "./fixtures/preapproval-module-coverage-bridges-20261030.json" with {type:"json"};
import judicialCases from "./fixtures/preapproval-judicial-precedents-20261030.json" with {type:"json"};
import intake from "../lib/reference-intake-catalog.json" with {type:"json"};
import canonical from "../lib/canonical-field-id-index.json" with {type:"json"};
import exceptions from "../lib/legal-exceptions.json" with {type:"json"};
import {RISK_CATALOG,LEGAL_CATALOG} from "../lib/legal-rules.ts";
import {getCalculationSpecs,WORKFLOW_CALCULATIONS} from "../lib/execution-catalog.ts";
import {WORKFLOW_RULES} from "../lib/workflow-rules.ts";

const modules=getCalculationSpecs();
const scenarios=[...baseCases.cases,...extraCases.cases];
const registry=new Map(modules.map(m=>[m.id,m]));
const legalIds=new Set(LEGAL_CATALOG.map(r=>r.id));
const exceptionIds=new Set(exceptions.scenarios.map(x=>x.id));

test("complete declared catalog: 85 intake docs, 693 OCR, 18/91/42 calculators, 50 rules, 95 risks, 46 workflows, 46 exceptions",()=>{
 assert.equal(intake.documents.length,85);
 assert.equal(canonical.ids.length,693);
 assert.equal(new Set(canonical.ids).size,693);
 assert.equal(modules.length,18);
 assert.equal(modules.reduce((n,c)=>n+c.inputs.length,0),91);
 assert.equal(new Set(modules.flatMap(c=>c.inputs)).size,78);
 assert.equal(modules.reduce((n,c)=>n+c.outputs.length,0),42);
 assert.equal(LEGAL_CATALOG.length,50);
 assert.equal(RISK_CATALOG.length,95);
 assert.equal(WORKFLOW_RULES.length,46);
 assert.equal(exceptions.scenarios.length,46);
});
test("each of 18 module identifiers has a real law/reconstructed scenario showing exact input+output declared path",()=>{
 assert.equal(scenarios.length,42);
 const covered=new Set<string>();
 for(const row of scenarios) {
  assert.ok(legalIds.has(row.legalRuleId),row.id+":law");
  assert.ok(exceptionIds.has(row.exceptionId),row.id+":exception");
  if(!row.calculation)continue;
  const spec=registry.get(row.calculation.id);
  assert.ok(spec,row.id+":unknown calculator");
  assert.ok(spec.inputs.includes(row.calculation.inputPath),row.id+":unknown input");
  assert.ok(spec.outputs.includes(row.calculation.outputName),row.id+":unknown output");
  covered.add(row.calculation.id);
 }
 assert.deepEqual([...covered].sort(),modules.map(x=>x.id).sort());
});
test("no orphan calculation dependency or workflow module binding exists",()=>{
 const ids=new Set(modules.map(x=>x.id));
 const legal=new Set(LEGAL_CATALOG.map(x=>x.id));
 const wfs=new Set(WORKFLOW_RULES.map(w=>w.id));
 for(const spec of modules)for(const upstream of spec.dependsOn)
  assert.ok(ids.has(upstream),spec.id+":dangling upstream "+upstream);
 for(const workflow of WORKFLOW_RULES)for(const ruleId of workflow.ruleIds)
  assert.ok(legal.has(ruleId),workflow.id+":dangling legal "+ruleId);
 for(const [workflowId,calcIds]of Object.entries(WORKFLOW_CALCULATIONS)) {
  assert.ok(wfs.has(workflowId),workflowId+":dangling workflow");
  for(const id of calcIds)assert.ok(ids.has(id),workflowId+":dangling calculator "+id);
 }
 for(const risk of RISK_CATALOG)for(const id of risk.current_rule_ids??[])
  assert.ok(legal.has(id),risk.id+":dangling risk legal rule "+id);
 for(const scenario of exceptions.scenarios)for(const id of scenario.ruleRefs)
  assert.ok(legal.has(id),scenario.id+":dangling exception legal rule "+id);
});
test("registry covers EVERY legal risk and exception ID, while examples remain merely representative",()=>{
 assert.equal(new Set(RISK_CATALOG.map(x=>x.id)).size,95);
 assert.equal(new Set(exceptions.scenarios.map(x=>x.id)).size,46);
 assert.equal(judicialCases.cases.length,3);
 const sampledRules=new Set(scenarios.map(x=>x.legalRuleId));
 assert.ok(sampledRules.size<LEGAL_CATALOG.length,"not every legal rule has yet been reconstructed as a deep case");
 const sampledExceptions=new Set(scenarios.map(x=>x.exceptionId));
 assert.ok(sampledExceptions.size<exceptions.scenarios.length,"not every exception has a deep executable case");
});
