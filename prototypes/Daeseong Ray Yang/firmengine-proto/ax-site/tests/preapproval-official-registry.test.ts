import test from "node:test";
import assert from "node:assert/strict";
import cases from "./fixtures/preapproval-source-cases-20261030.json" with {type:"json"};
import {getCalculationSpecs} from "../lib/execution-catalog.ts";
import {LEGAL_CATALOG,RISK_CATALOG} from "../lib/legal-rules.ts";
import exceptions from "../lib/legal-exceptions.json" with {type:"json"};
import {WORKFLOW_RULES} from "../lib/workflow-rules.ts";
import {buildApprovalIssueGraph} from "../lib/approval-issue-graph.ts";

/** Contract integrity against real application registries. No fabricated court outcome. */
const specs=getCalculationSpecs();
const modules=new Map(specs.map(s=>[s.id,s]));
const legalIds=new Set(LEGAL_CATALOG.map(r=>r.id));
const exceptionIds=new Set(exceptions.scenarios.map(r=>r.id));

test("the actual FirmEngine registers 18 calculation modules, 91 input uses, 95 risks, 46 workflows and 46 exceptions",()=>{
 assert.equal(specs.length,18);
 assert.equal(specs.reduce((total,calc)=>total+calc.inputs.length,0),91);
 assert.equal(new Set(specs.flatMap(calc=>calc.inputs)).size,78);
 assert.equal(specs.reduce((total,calc)=>total+calc.outputs.length,0),42);
 assert.equal(RISK_CATALOG.length,95);
 assert.equal(WORKFLOW_RULES.length,46);
 assert.equal(exceptions.scenarios.length,46);
 assert.equal(new Set(specs.map(x=>x.id)).size,18);
 assert.equal(cases.cases.length,40);
});
test("all reconstructed scenario identifiers and source URLs are unique and explicit",()=>{
 const ids=cases.cases.map(s=>s.id),urls=Object.values(cases.sources).map(s=>s.url);
 assert.equal(new Set(ids).size,ids.length);
 assert.ok(urls.length>=8);
 assert.ok(urls.every(url=>/^https:\/\//.test(url)));
 assert.ok(cases.cases.every(s=>s.expected==="evidence_or_lawyer_review_not_court_approval"));
});
for(const scenario of cases.cases) {
 test("official-source reconstruction mapping: "+scenario.id,()=>{
  assert.ok(["P1_DOCUMENTS","P2_EVIDENCE","P3_CALCULATIONS","P4_LEGAL","P5_CORRECTIONS"].includes(scenario.stage),scenario.stage);
  assert.ok(legalIds.has(scenario.legalRuleId),scenario.legalRuleId);
  assert.ok(exceptionIds.has(scenario.exceptionId),scenario.exceptionId);
  assert.ok(Object.hasOwn(cases.sources,scenario.sourceId),scenario.sourceId);
  assert.equal(scenario.expected,"evidence_or_lawyer_review_not_court_approval");
  assert.ok(scenario.description.length>=10);
  if(scenario.calculation!==null){
   const calc=modules.get(scenario.calculation.id);
   assert.ok(calc,"missing actual calculation spec "+scenario.calculation.id);
   assert.ok(calc.inputs.includes(scenario.calculation.inputPath),
    scenario.id+" cannot read expected input "+scenario.calculation.inputPath);
   assert.ok(calc.outputs.includes(scenario.calculation.outputName),
    scenario.id+" cannot produce declared output "+scenario.calculation.outputName);
  }
 });
}
test("no undocumented risk ID gets passed by the candidate-only graph",()=>{
 const graph=buildApprovalIssueGraph({risks:RISK_CATALOG,contracts:[],facts:[],
  sourceValidAcceptedFactIds:new Set(),calculation:{ } as any,
  calculations:specs,legalCurrent:false,legalChecks:[]});
 assert.equal(graph.totalRisks,95);
 assert.equal(graph.approvedEvidenceRoutes,0);
 assert.equal(graph.unmappedOrOutOfScope,95);
 assert.ok(graph.units.every(x=>x.legalCheck.status==="not_currently_reviewed"&&x.courtApprovalInferred===false));
});
