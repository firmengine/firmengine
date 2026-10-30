import test from "node:test";
import assert from "node:assert/strict";
import gaps from "./fixtures/preapproval-uncovered-legal-cases-20261030.json" with {type:"json"};
import original from "./fixtures/preapproval-source-cases-20261030.json" with {type:"json"};
import bridges from "./fixtures/preapproval-module-coverage-bridges-20261030.json" with {type:"json"};
import {LEGAL_CATALOG} from "../lib/legal-rules.ts";
import exceptions from "../lib/legal-exceptions.json" with {type:"json"};
import {auditPreapprovalLegalCatalog} from "../lib/preapproval-legal-coverage-audit.ts";

const data={context:{id:"no-evidence-fixture",revision:1,courtId:"seoul",applicationDate:"2026-10-30"},facts:[]} as any;
const inspection=auditPreapprovalLegalCatalog({caseData:data,facts:[],
 sourceValidatedAcceptedFactIds:new Set(),rules:LEGAL_CATALOG,exceptions:exceptions.scenarios});
const recorded=[...original.cases,...bridges.cases];
test("the 39 supplemental legal gap cases cover exactly previously missing 19 rules and 20 exceptions",()=>{
 const ru=new Set(recorded.map(x=>x.legalRuleId)),ex=new Set(recorded.map(x=>x.exceptionId));
 const missingRules=LEGAL_CATALOG.filter(r=>!ru.has(r.id)).map(r=>r.id);
 const missingExceptions=exceptions.scenarios.filter(e=>!ex.has(e.id)).map(e=>e.id);
 assert.equal(gaps.cases.length,39);
 assert.equal(gaps.classes.ruleNegative,19);assert.equal(gaps.classes.exceptionNegative,20);
 assert.deepEqual(gaps.cases.filter(x=>x.kind==="rule_missing_evidence").map(x=>x.ruleId).sort(),missingRules.sort());
 assert.deepEqual(gaps.cases.filter(x=>x.kind==="exception_trigger_not_executed").map(x=>x.exceptionId).sort(),missingExceptions.sort());
});
for(const row of gaps.cases) {
 test("no-evidence case rejects automatic legal sufficiency: "+row.scenarioId,()=>{
  if(row.kind==="rule_missing_evidence") {
   const current=inspection.rules.find(x=>x.ruleId===row.ruleId);
   assert.ok(current);
   assert.equal(current.sourceUrl,row.sourceUrl);
   assert.deepEqual(current.features.map(x=>x.featureKey),row.demandedFeatureKeys);
   assert.ok(current.features.every(x=>x.validatedAcceptedFactIds.length===0));
   assert.deepEqual(current.missingOrUnacceptedFeatureKeys,row.demandedFeatureKeys);
   assert.equal(current.applicability.courtAndHistoricalApplicabilityReviewed,false);
   assert.equal(current.legalFinding,null);
  }else{
   const current=inspection.exceptions.find(x=>x.exceptionId===row.exceptionId);
   assert.ok(current);
   assert.deepEqual(current.ruleIds,row.ruleIds);
   assert.equal(current.triggerEvaluation,"not_executed_by_this_audit");
   assert.equal(current.automaticallySatisfied,false);
   assert.equal(current.executionScope,row.stage==="OUT_OF_SCOPE_POST_APPROVAL"?"postapproval_deferred":"preapproval_candidate_only");
  }
  assert.equal(row.courtApprovalInferred,false);
 });
}
