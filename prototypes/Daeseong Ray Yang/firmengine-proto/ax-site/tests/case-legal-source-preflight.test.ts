import test from "node:test";
import assert from "node:assert/strict";
import {evaluateLegalSourceReadiness} from "../lib/case-legal-source-preflight.ts";
const ready=()=>({
 activeDocumentCount:1,evidencePages:["doc-a:1"],processingComplete:true,
 normalizedPages:["doc-a:1"],legacySnapshotFallback:false,
 consultationPending:false,workflowIntakeMismatch:false
});
test("verified and normalized evidence proceeds to legal AI",()=>{
 const result=evaluateLegalSourceReadiness(ready());assert.equal(result.ready,true);
 assert.deepEqual(result.blockers,[]);
});
test("unfinished OCR waits without calling the advisory model",()=>{
 const result=evaluateLegalSourceReadiness({...ready(),processingComplete:false,normalizedPages:[]});
 assert.equal(result.status,"waiting_evidence");assert.equal(result.retryable,true);
 assert.ok(result.blockers.includes("SOURCE_PAGE_VERIFICATION_PENDING"));
});
test("even completed OCR without the current normalized head never permits legal AI",()=>{
 const result=evaluateLegalSourceReadiness({...ready(),normalizedPages:[]});
 assert.equal(result.status,"review_required");assert.equal(result.ready,false);
 assert.ok(result.blockers.includes("CURRENT_EVIDENCE_PAGE_HEAD_MISSING"));
});
test("legacy head fallback requires human review rather than silent legal acceptance",()=>{
 const result=evaluateLegalSourceReadiness({...ready(),legacySnapshotFallback:true});
 assert.equal(result.status,"review_required");assert.equal(result.retryable,false);
 assert.ok(result.blockers.includes("NORMALIZED_SOURCE_FALLBACK_UNVERIFIED"));
});
test("new unprocessed consultation and stale adopted workflow prevent old legal AI review",()=>{
 const a=evaluateLegalSourceReadiness({...ready(),consultationPending:true});
 assert.ok(a.blockers.includes("CONSULTATION_REANALYSIS_REQUIRED"));assert.equal(a.ready,false);
 const b=evaluateLegalSourceReadiness({...ready(),workflowIntakeMismatch:true});
 assert.ok(b.blockers.includes("WORKFLOW_INTAKE_RUN_STALE"));assert.equal(b.ready,false);
});
test("source-free case must not trigger 95 advisory API checks",()=>{
 const result=evaluateLegalSourceReadiness({...ready(),activeDocumentCount:0,evidencePages:[],normalizedPages:[]});
 assert.equal(result.status,"waiting_evidence");assert.ok(result.blockers.includes("SOURCE_DOCUMENT_REQUIRED"));
});
