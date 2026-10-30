import test from "node:test";
import assert from "node:assert/strict";
import {parseAutomaticDraftArtifacts,automaticDraftHandoffDecision,
 type AutomaticDraftArtifact,type AutomaticDraftRow,type AutomaticDraftHead
} from "../lib/automatic-draft-handoff-contract.ts";
const caseId="synthetic-handoff",hash="a".repeat(64);
const artifacts=():AutomaticDraftArtifact[]=>[
 {id:"form-a",kind:"application",name:"신청서.docx",hash,mime:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",objectKey:"cases/"+caseId+"/artifacts/form-a"},
 {id:"render-json",kind:"rendered_json",name:"rendered.json",hash,mime:"application/json",objectKey:"cases/"+caseId+"/artifacts/render-json"},
 {id:"zip-a",kind:"package_zip",name:"package.zip",hash,mime:"application/zip",objectKey:"cases/"+caseId+"/artifacts/zip-a"}
];
const base=()=>{
 const a=artifacts(),row:AutomaticDraftRow={
  id:"auto-draft:legal-1",caseId,legalReviewRunId:"legal-1",dataVersion:3,
  caseRevision:7,status:"complete",artifactsJson:JSON.stringify(a)
 };
 const head:AutomaticDraftHead={dataVersion:3,calculationRunId:"calc-1",legalReviewRunId:"legal-1",
  calculationCaseRevision:7,legalCaseRevision:7,referenceSha256:"b".repeat(64)};
 return {row,head,caseId,caseRevision:7,currentReferenceSha256:"b".repeat(64),
  artifacts:a,existingCurrentFiles:[],existingMode:null,existingOrigin:null,pendingEdits:false};
};
test("draft handoff requires unique immutable IDs, kinds, paths and SHA",()=>{
 const a=artifacts();
 assert.deepEqual(parseAutomaticDraftArtifacts(JSON.stringify(a),caseId),a);
 assert.throws(()=>parseAutomaticDraftArtifacts(JSON.stringify([{...a[0],kind:"rendered_json"},a[1],a[2]]),caseId),/INVALID_ARTIFACT/);
 assert.throws(()=>parseAutomaticDraftArtifacts(JSON.stringify(a.map((f,i)=>i?f:{...f,hash:"bad"})),caseId),/INVALID_ARTIFACT/);
 assert.throws(()=>parseAutomaticDraftArtifacts(JSON.stringify(a.filter(f=>f.kind!=="package_zip")),caseId),/MANDATORY_RENDERED/);
});
test("a verified same-version auto draft is a candidate, not a final approval",()=>{
 const d=automaticDraftHandoffDecision(base());assert.equal(d.eligible,true);
 assert.equal(d.alreadyLinked,false);assert.deepEqual(d.blockers,[]);
});
test("source, calculation, legal and rule release drift all block staff adoption",()=>{
 const checks=[
  {head:{...base().head,dataVersion:4}},
  {head:{...base().head,legalReviewRunId:"legal-old"}},
  {head:{...base().head,calculationCaseRevision:6}},
  {currentReferenceSha256:"c".repeat(64)}
 ];
 for(const part of checks){const d=automaticDraftHandoffDecision({...base(),...part});
  assert.equal(d.eligible,false);assert.ok(d.blockers.length);}
});
test("current final-review files and unapplied edits are never overwritten",()=>{
 const current=base();
 assert.equal(automaticDraftHandoffDecision({...current,existingCurrentFiles:[{id:"final",hash}]}).eligible,false);
 assert.equal(automaticDraftHandoffDecision({...current,pendingEdits:true}).eligible,false);
});
test("retrying exactly the already-linked case draft does not create new artifacts",()=>{
 const s=base();
 const res=automaticDraftHandoffDecision({...s,existingMode:"draft",
  existingCurrentFiles:s.artifacts.map(a=>({id:a.id,hash:a.hash})),
  existingOrigin:{runId:s.row.id,legalReviewRunId:s.row.legalReviewRunId,
   calculationRunId:s.head.calculationRunId,sourceDataVersion:s.row.dataVersion,
   caseRevision:s.row.caseRevision,linkedBy:"staff",linkedAt:"2026-10-30"}});
 assert.equal(res.eligible,true);assert.equal(res.alreadyLinked,true);
});
