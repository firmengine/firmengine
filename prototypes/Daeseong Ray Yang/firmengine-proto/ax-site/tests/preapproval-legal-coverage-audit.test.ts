import test from "node:test";
import assert from "node:assert/strict";
import {auditPreapprovalLegalCatalog} from "../lib/preapproval-legal-coverage-audit.ts";
import {LEGAL_CATALOG,RISK_CATALOG} from "../lib/legal-rules.ts";
import legalExceptions from "../lib/legal-exceptions.json" with {type:"json"};
import prior from "./fixtures/preapproval-source-cases-20261030.json" with {type:"json"};
import bridges from "./fixtures/preapproval-module-coverage-bridges-20261030.json" with {type:"json"};
const data={context:{id:"synthetic-unmapped",revision:1,applicationDate:"2026-10-30",courtId:"seoul"},facts:[],documents:[]} as any;
const input=(facts:any[]=[],accepted:string[]=[])=>({
 caseData:data,facts,sourceValidatedAcceptedFactIds:new Set(accepted),
 rules:LEGAL_CATALOG,exceptions:legalExceptions.scenarios
});
test("all 50 legal rule families and 46 exceptions are individually retained when the case has no source evidence",()=>{
 const a=auditPreapprovalLegalCatalog(input());
 assert.equal(a.registeredRules,50);assert.equal(a.registeredExceptions,46);
 assert.equal(new Set(a.rules.map(x=>x.ruleId)).size,50);
 assert.equal(new Set(a.exceptions.map(x=>x.exceptionId)).size,46);
 assert.equal(a.unrecognizedRuleReferenceIds.length,0);
 assert.equal(a.rules.filter(r=>r.status==="evidence_or_mapping_review_required").length,49);
 assert.equal(a.rules.find(r=>r.ruleId==="KR-PR-050")?.status,"postapproval_deferred");
 assert.ok(a.exceptions.every(e=>!e.automaticallySatisfied&&!e.courtApprovalInferred));
 assert.equal(a.courtApprovalInferred,false);
});
test("catalog gaps left by prior 42 mapping cases remain visible and are not mislabeled as deep tested law",()=>{
 const explored=[...prior.cases,...bridges.cases];
 const knownRuleIds=new Set(explored.map(x=>x.legalRuleId)),knownExceptionIds=new Set(explored.map(x=>x.exceptionId));
 const x=auditPreapprovalLegalCatalog(input());
 assert.equal(x.rules.filter(r=>!knownRuleIds.has(r.ruleId)).length,19);
 assert.equal(x.exceptions.filter(e=>!knownExceptionIds.has(e.exceptionId)).length,20);
});
test("exact source key with unaccepted value is a candidate, not legal approval",()=>{
 const facts=[{id:"f1",key:"applicant.address",state:"extracted",recognition:"unreviewed",value:"Seoul"}];
 const x=auditPreapprovalLegalCatalog(input(facts));
 const r=x.rules.find(y=>y.ruleId==="KR-PR-002")!;
 const f=r.features.find(y=>y.featureKey==="applicant.address")!;
 assert.equal(f.status,"source_unverified_or_unaccepted");
 assert.deepEqual(f.observedFactIds,["f1"]);
 assert.equal(r.legalFinding,null);
});
test("accepted exact fact still cannot establish legal applicability or court decision",()=>{
 const facts=[{id:"f1",key:"applicant.address",state:"verified",recognition:"accepted",value:"Seoul"}];
 const x=auditPreapprovalLegalCatalog(input(facts,["f1"]));
 const f=x.rules.find(y=>y.ruleId==="KR-PR-002")!.features.find(y=>y.featureKey==="applicant.address")!;
 assert.equal(f.status,"source_supported_needs_legal_application");
 assert.equal(x.rules.find(y=>y.ruleId==="KR-PR-002")!.applicability.courtAndHistoricalApplicabilityReviewed,false);
 assert.equal(x.courtApprovalInferred,false);
});
test("catalog-derived legal questions are ranked by number of rules depending on missing features",()=>{
 const x=auditPreapprovalLegalCatalog(input());
 assert.ok(x.unansweredEvidenceQuestions.length>20);
 assert.ok(x.unansweredEvidenceQuestions.every(y=>y.affectedRuleIds.length>=1));
 assert.ok(x.unansweredEvidenceQuestions.every((y,i,a)=>i===0||a[i-1].affectedRuleIds.length>=y.affectedRuleIds.length));
});
test("post-approval exception scenarios stay inventoried but out of current execution scope",()=>{
 const x=auditPreapprovalLegalCatalog(input());
 for(const id of ["EL-40","EL-46"]){
  const r=x.exceptions.find(e=>e.exceptionId===id)!;
  assert.equal(r.executionScope,"postapproval_deferred");
  assert.equal(r.triggerEvaluation,"not_executed_by_this_audit");
 }
 assert.equal(RISK_CATALOG.length,95);
});


test("stale caller accepted IDs cannot validate retracted, disputed, null, or errored Facts",()=>{
  // The accepted ID set comes from a different stage and may be stale. Only
  // a current verified, recognized, nonempty source may be marked supported.
  const invalid=[
    {state:"retracted",recognition:"rejected",value:"synthetic"},
    {state:"verified",recognition:"disputed",value:"synthetic"},
    {state:"verified",recognition:"accepted",value:null},
    {state:"verified",recognition:"accepted",value:undefined},
    {state:"verified",recognition:"accepted",value:" "},
    {state:"verified",recognition:"accepted",value:"synthetic",validation:[{severity:"error",code:"SYNTHETIC_BAD_SOURCE"}]},
  ];
  for(const patch of invalid){
    const fact={id:"f1",key:"applicant.address",state:"verified",recognition:"accepted",value:"synthetic",...patch};
    const audit=auditPreapprovalLegalCatalog(input([fact],["f1"]));
    const feature=audit.rules.find(row=>row.ruleId==="KR-PR-002")!.features.find(row=>row.featureKey==="applicant.address")!;
    assert.equal(feature.status,"source_unverified_or_unaccepted",JSON.stringify(patch));
    assert.equal(audit.courtApprovalInferred,false);
  }
  for(const value of [0,false]){
    const fact={id:"f1",key:"applicant.address",state:"verified",recognition:"accepted",value};
    const audit=auditPreapprovalLegalCatalog(input([fact],["f1"]));
    const feature=audit.rules.find(row=>row.ruleId==="KR-PR-002")!.features.find(row=>row.featureKey==="applicant.address")!;
    assert.equal(feature.status,"source_supported_needs_legal_application");
    assert.equal(audit.rules.find(row=>row.ruleId==="KR-PR-002")!.legalFinding,null);
  }
});
