import test from "node:test";
import assert from "node:assert/strict";
import {buildApprovalIssueGraph,type ApprovalIssueGraphInput} from "../lib/approval-issue-graph.ts";
function input():ApprovalIssueGraphInput{
 return {risks:[{id:"R1",title:"synthetic risk",current_rule_ids:["LAW-1"],required_features:["asset.value"]}],
 contracts:[{checkId:"R1",status:"approved_evidence_route",
  requiredCanonicalFieldGroups:[["A","B"],["C"]],requiredCalculationOutputs:["liquidationValueWon"]}],
 facts:[{id:"fact-A",canonicalFieldId:"A",state:"verified",recognition:"accepted"},
  {id:"fact-C",canonicalFieldId:"C",state:"extracted",recognition:"unreviewed"}] as any,
 sourceValidAcceptedFactIds:new Set(["fact-A"]),
 calculation:{liquidationValueWon:null} as any,
 calculations:[{id:"calc1",outputs:["liquidationValueWon"],inputs:[],dependsOn:[]},
  {id:"calc2",outputs:["comparison"],inputs:["liquidationValueWon"],dependsOn:["calc1"]}],
 legalCurrent:true,
 legalChecks:[{id:"R1",status:"missing",reason:"missing C",factIds:["fact-A"],
  ruleIds:["LAW-1"],missingDocuments:["source-C"],nextAction:"request C"}]};
}
test("exact canonical OR groups preserve unaccepted observations and downstream calculation dependencies",()=>{
 const r=buildApprovalIssueGraph(input()),unit=r.units[0];
 assert.equal(unit.evidenceGroups[0].status,"supported_by_current_source");
 assert.equal(unit.evidenceGroups[1].status,"observed_not_accepted");
 assert.deepEqual(unit.evidenceGroups[1].observedFactIds,["fact-C"]);
 assert.equal(unit.calculationOutputs[0].status,"missing");
 assert.deepEqual(unit.calculationOutputs[0].affectedCalculationIds,["calc1","calc2"]);
 assert.equal(r.missingOrUnacceptedFeatureGroups,1);
 assert.equal(r.missingCalculationOutputs,1);
 assert.equal(unit.courtApprovalInferred,false);
});
test("unapproved evidence contracts never invent statutory mandatory fields or calculations",()=>{
 const d=input();d.contracts=[{...d.contracts[0],status:"unmapped"}];
 const unit=buildApprovalIssueGraph(d).units[0];
 assert.equal(unit.evidenceRoute,"unmapped_or_not_applicable");
 assert.deepEqual(unit.evidenceGroups,[]);
 assert.deepEqual(unit.calculationOutputs,[]);
 assert.deepEqual(unit.questions,[]);
});
test("stale legal review never becomes the current judgment",()=>{
 const d=input();d.legalCurrent=false;
 assert.equal(buildApprovalIssueGraph(d).units[0].legalCheck.status,"not_currently_reviewed");
});
test("unknown calculation output names fail explicitly instead of pretending to be computed",()=>{
 const d=input();d.contracts=[{...d.contracts[0],requiredCalculationOutputs:["unknownOutput"]}];
 assert.equal(buildApprovalIssueGraph(d).units[0].calculationOutputs[0].status,"undeclared_output");
});
