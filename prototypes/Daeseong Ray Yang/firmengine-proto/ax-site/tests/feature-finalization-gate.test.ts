import test from "node:test";
import assert from "node:assert/strict";
import {finalWorkflowBlockers} from "../lib/document-workflow-gate.ts";

test("final generation blocks only explicit reviewed source field gaps",()=>{
 const blockers=finalWorkflowBlockers({workflowAdopted:true,requirements:[{requirementId:"REQ-1",required:true,requirementStatus:"satisfied"}],
   featureGaps:[{canonicalFieldId:"debt_certificate::principal_balance",code:"REQUIRED_CANONICAL_FIELD_NOT_OBSERVED"}]});
 assert.ok(blockers.includes("feature:debt_certificate::principal_balance:REQUIRED_CANONICAL_FIELD_NOT_OBSERVED"));
 assert.ok(!blockers.some(value=>value.startsWith("requirement:")));
});
test("drafts and legacy unadopted workflow are unaffected by the final-only gap route",()=>{
 const input={workflowAdopted:false,featureGaps:[{canonicalFieldId:"field",code:"UNVERIFIED"}]};
 assert.deepEqual(finalWorkflowBlockers(input),[]);
 assert.deepEqual(finalWorkflowBlockers({workflowAdopted:true,featureGaps:[]}),[]);
});
test("existing rejected legal result stays blocking",()=>{
 const out=finalWorkflowBlockers({workflowAdopted:true,legalChecks:[{checkId:"R1",state:"current",disposition:"rejected"}]});
 assert.ok(out.includes("legal:R1:rejected"));
});
