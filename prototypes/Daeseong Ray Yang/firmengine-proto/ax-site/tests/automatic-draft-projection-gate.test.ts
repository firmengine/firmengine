import test from "node:test";
import assert from "node:assert/strict";
import {assessAutomaticDraftProjection,projectionRepairRequired,type ProjectionExpectation,type ProjectionFieldIdentity} from "../lib/automatic-draft-projection-gate.ts";
const expected:ProjectionExpectation[]=[
 {formCode:"D5100",token:"client_name",valueKind:"source",repeatGroup:null},
 {formCode:"D5100",token:"court_name",valueKind:"source",repeatGroup:null},
 {formCode:"D5106",token:"client_name",valueKind:"source",repeatGroup:null},
 {formCode:"D5106",token:"creditor.number",valueKind:"layout",repeatGroup:"creditor"},
 {formCode:"D5106",token:"creditor.entity",valueKind:"source",repeatGroup:"creditor"},
 {formCode:"D5106",token:"creditor.principal",valueKind:"source",repeatGroup:"creditor"}
];
const fields:ProjectionFieldIdentity[]=[
 {formCode:"D5100",token:"client_name",valueKind:"source",rowOrdinal:null,subjectId:null},
 {formCode:"D5100",token:"court_name",valueKind:"source",rowOrdinal:null,subjectId:null},
 {formCode:"D5106",token:"client_name",valueKind:"source",rowOrdinal:null,subjectId:null},
 {formCode:"D5106",token:"creditor.number",valueKind:"layout",rowOrdinal:0,subjectId:"debt-1"},
 {formCode:"D5106",token:"creditor.entity",valueKind:"source",rowOrdinal:0,subjectId:"debt-1"},
 {formCode:"D5106",token:"creditor.principal",valueKind:"source",rowOrdinal:0,subjectId:"debt-1"}
];
test("complete token identities allow structural review draft but never e-filing",()=>{
 const r=assessAutomaticDraftProjection({expected,fields,claimedPersistedCount:6});
 assert.equal(r.eligible,true);assert.deepEqual(r.blockers,[]);
 assert.equal(r.legalApprovalInferred,false);assert.equal(r.readyForElectronicFiling,false);
});
test("empty, failed, missing scalar, wrong persisted count and missing contract block",()=>{
 for(const input of [
  {expected,fields:[]},
  {expected,fields,projectionError:"FORM_BINDINGS_UNAVAILABLE"},
  {expected,fields:fields.slice(1)},
  {expected,fields,claimedPersistedCount:7},
  {expected:[],fields}
 ])assert.equal(assessAutomaticDraftProjection(input).eligible,false);
});
test("duplicate token, truncated repeating row, unknown token, wrong kind and bad ordinal block",()=>{
 for(const rows of [
  [...fields,fields[0]],
  fields.filter(f=>f.token!=="creditor.principal"),
  [...fields,{formCode:"D5106",token:"unexpected",valueKind:"source",rowOrdinal:0}],
  fields.map(f=>f.token==="creditor.entity"?{...f,valueKind:"derived"}:f),
  fields.map(f=>f.token==="creditor.entity"?{...f,rowOrdinal:null}:f),
  fields.map(f=>f.token==="client_name"&&f.formCode==="D5100"?{...f,subjectId:"foreign"}:f),
 ])assert.equal(assessAutomaticDraftProjection({expected,fields:rows}).eligible,false);
});
test("repeat groups with zero rows are structurally optional for drafts, not legal completeness",()=>{
 const rows=fields.filter(f=>f.rowOrdinal===null);
 assert.equal(assessAutomaticDraftProjection({expected,fields:rows}).eligible,true);
});
test("only an actual projection diagnostic allows same-source operator repair",()=>{
 assert.equal(projectionRepairRequired({documentProjectionBlockers:["DOCUMENT_FIELD_PROJECTION_EMPTY"]}),true);
 assert.equal(projectionRepairRequired({documentFieldProjectionError:"UNAVAILABLE"}),true);
 assert.equal(projectionRepairRequired({blockers:["LAWGRAPH_FORM_FIELD_PROJECTION_REQUIRED"]}),true);
 assert.equal(projectionRepairRequired({documentFieldCount:0,reviewRunId:"legal-review-1"}),true);
 assert.equal(projectionRepairRequired({documentFieldCount:0,reviewRunId:null}),false);
 assert.equal(projectionRepairRequired({blockers:["LEGAL_EVIDENCE_MISSING"]}),false);
 assert.equal(projectionRepairRequired(null),false);
});

test("repeating creditor row cannot mix principal from another subject",()=>{
 const mixed=fields.map(f=>f.formCode==="D5106"&&f.token==="creditor.principal"
   ?{...f,subjectId:"debt-2"}:f);
 const result=assessAutomaticDraftProjection({expected,fields:mixed,claimedPersistedCount:fields.length});
 assert.equal(result.eligible,false);
 assert.deepEqual(result.blockers,["DOCUMENT_FIELD_PROJECTION_REPEAT_SUBJECT_MISMATCH"]);
 assert.equal(result.readyForElectronicFiling,false);
});
test("repeating creditor row cannot silently mix null and verified subjects",()=>{
 const mixed=fields.map(f=>f.formCode==="D5106"&&f.token==="creditor.principal"
   ?{...f,subjectId:null}:f);
 const result=assessAutomaticDraftProjection({expected,fields:mixed});
 assert.equal(result.eligible,false);
 assert.ok(result.blockers.includes("DOCUMENT_FIELD_PROJECTION_REPEAT_SUBJECT_MISMATCH"));
});
test("different repeated rows keep independent subject identities",()=>{
 const duplicated=fields.filter(f=>f.formCode==="D5106"&&f.token.startsWith("creditor.")).map(f=>({
   ...f,rowOrdinal:1,subjectId:"debt-2"
 }));
 const result=assessAutomaticDraftProjection({expected,fields:[...fields,...duplicated]});
 assert.equal(result.eligible,true);
 assert.equal(result.repeatedRowCount,2);
});
