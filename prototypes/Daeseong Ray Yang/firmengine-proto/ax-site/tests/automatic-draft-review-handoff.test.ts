import test from "node:test";
import assert from "node:assert/strict";
import {validateAutoDraftHandoff} from "../lib/automatic-draft-review-handoff.ts";
const hash="a".repeat(64),reference="b".repeat(64),caseInput="c".repeat(64);
function fixture(){
 const art={id:"auto-doc-1",name:"검토초안.docx",kind:"application",hash,
   mime:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
   objectKey:"cases/test-case/artifacts/auto-doc-1"};
 const writer={schemaVersion:"document-writer-receipt/2",mode:"draft",caseId:"test-case",caseRevision:7,
   inputSha256:caseInput,referenceRelease:{sha256:reference},courtApprovalInferred:false,
   readyForElectronicFiling:false,outputPurpose:"review",artifactHashes:[hash],
   fieldBases:[{artifactId:art.id,artifactHash:hash,kind:"prose",fieldId:"statement",value:"old",baseValueHash:"h"}]};
 const run={id:"auto-draft:legal-1",caseId:"test-case",legalReviewRunId:"legal-1",dataVersion:9,
   caseRevision:7,status:"complete",artifactsJson:JSON.stringify([art])};
 return {run,receipt:{schemaVersion:"automatic-draft-writer-receipt/1",documentRunId:run.id,
   caseId:"test-case",legalReviewRunId:"legal-1",dataVersion:9,caseRevision:7,calculationRunId:"calc-1",
   writerReceipt:writer},stored:[{...art,caseId:"test-case",revision:7}],
  current:{caseId:"test-case",caseRevision:7,dataVersion:9,legalReviewRunId:"legal-1",
   calculationRunId:"calc-1",referenceSha256:reference,caseInputSha256:caseInput}
 } as any;
}
test("staff handoff keeps original artifact ID and hash, and never promotes to final",()=>{
 const f=fixture();const result=validateAutoDraftHandoff(f);
 assert.deepEqual(result.artifacts.map(x=>[x.id,x.hash]),[["auto-doc-1",hash]]);
 assert.equal(result.mode,"draft");assert.equal(result.courtApprovalInferred,false);
 assert.equal(result.writerReceipt.fieldBases![0].artifactId,"auto-doc-1");
});
test("stale source, calculator, legal review or reference blocks adoption",()=>{
 for(const property of ["dataVersion","caseRevision","calculationRunId","legalReviewRunId","referenceSha256"]){
  const f=fixture();(f.current as any)[property]="stale";
  assert.throws(()=>validateAutoDraftHandoff(f),/MISMATCH|INVALID/);
 }
});
test("replaced R2 artifact ID/hash, unknown scope and missing edit bases block adoption",()=>{
 const f=fixture();f.stored[0].hash="d".repeat(64);
 assert.throws(()=>validateAutoDraftHandoff(f),/DB_MISMATCH/);
 const g=fixture();g.receipt.writerReceipt.fieldBases=[];
 assert.throws(()=>validateAutoDraftHandoff(g),/FIELD_BASES_INVALID/);
 const h=fixture();h.run.artifactsJson=JSON.stringify([{...JSON.parse(h.run.artifactsJson)[0],objectKey:"cases/foreign/artifacts/auto-doc-1"}]);
 assert.throws(()=>validateAutoDraftHandoff(h),/ARTIFACT_INTEGRITY/);
});
test("an old uncaptured writer receipt cannot be relabeled as an already approved draft",()=>{
 const f=fixture();f.receipt.writerReceipt.mode="final";
 assert.throws(()=>validateAutoDraftHandoff(f),/WRITER_RECEIPT_INVALID/);
});
