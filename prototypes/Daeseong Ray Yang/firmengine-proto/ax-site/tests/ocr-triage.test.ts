import test from "node:test";
import assert from "node:assert/strict";
import { summarizePageOcrTriage, requirementTriageStatus } from "../lib/ocr-triage.ts";
import type { PageFieldCoverage, FieldObservation, SourceState, VerificationState } from "../lib/field-observation.ts";
import type { MissingFieldCue } from "../lib/coverage-review.ts";
const hash="a".repeat(64);
const mk=(state:SourceState,verificationState:VerificationState="unverified",other:Partial<FieldObservation>={}):FieldObservation=>({
  version:"field-observation-2",catalogRelease:"synthetic",catalogSha256:hash,binding:"explicit_id",documentId:"doc-1",page:2,sourceSha256:hash,
  familyId:"synthetic",recordIndex:0,fieldIndex:0,origin:"source_read",canonicalFieldId:"test::money",label:"Amount",
  rawValue:"1200",rawUnit:"원",sourceState:state,verificationState,extractionState:"value_read",quote:"금액 1200원",bbox:[.1,.1,.3,.2],
  applicability:{sourceClaim:"unknown",quote:null,caseDecision:"unreviewed"},subjectRole:null,temporalRole:null,issues:[],...other,
});
const coverage=(observations:FieldObservation[],completeReadClaim=true):PageFieldCoverage=>({
  version:"field-observation-2",documentId:"doc-1",page:2,sourceSha256:hash,familyId:"synthetic",catalogRelease:"synthetic",
  catalogSha256:hash,completeReadClaim,observations,
});
const run=(os:FieldObservation[],cues:MissingFieldCue[]=[],omittedRows=false,complete=true)=>summarizePageOcrTriage({
  coverage:coverage(os,complete),validatedMissingCues:cues,omittedRows,
});
test("cross-read support is not legal acceptance",()=>{
  const r=run([mk("present","supported")]);assert.equal(r.counts.read_supported,1);assert.equal(r.caseNotApplicableConfirmed,false);assert.equal(r.legalRecognition,"unreviewed");
});
test("readable but unverified field is pending, not approved",()=>{assert.equal(run([mk("present")]).counts.pending_verification,1);});
test("catalog gap is unknown, never proven source omission or N/A",()=>{
  const r=run([mk("unknown","unverified",{origin:"catalog_gap",recordIndex:null,fieldIndex:null,rawValue:null,quote:null,bbox:null})]);
  assert.equal(r.counts.not_observed,1);assert.equal(r.counts.source_omitted,0);assert.equal(r.counts.not_applicable_source_claim,0);
});
test("source-anchored missing cue is omission, invalid cue is not",()=>{
  const good=run([], [{canonicalFieldId:"test::money",sourceState:"present",quote:"금액 1200원",bbox:[.1,.1,.3,.2]}]);
  const bad=run([], [{canonicalFieldId:null,sourceState:"present",quote:null,bbox:null}]);
  assert.equal(good.counts.source_omitted,1);assert.equal(bad.counts.source_omitted,0);
});
test("wrong field, mismatch, and corrected candidate remain misrecognition diagnostics",()=>{
  for(const s of ["wrong_field","value_mismatch","corrected"] as const){
    const r=run([mk("present",s)]);assert.equal(r.counts.misrecognized,1);assert.equal(r.findings[0].correctionCandidate,s==="corrected");
  }
});
test("only quoted explicit-none can become unreviewed source N/A claim",()=>{
  const r=run([mk("explicit_none","unverified",{rawValue:null,applicability:{sourceClaim:"not_applicable",quote:"해당 없음",caseDecision:"unreviewed"},quote:"재산 해당 없음"})]);
  assert.equal(r.counts.not_applicable_source_claim,1);assert.equal(r.caseNotApplicableConfirmed,false);
});
test("blank, zero, and explicit none without a claim are not N/A",()=>{
  const r=run([mk("blank","unverified",{rawValue:null}),mk("present","supported",{rawValue:"0",quote:"잔액 0원"}),
    mk("explicit_none","unverified",{rawValue:null,applicability:{sourceClaim:"unknown",quote:null,caseDecision:"unreviewed"}})]);
  assert.equal(r.counts.source_blank,1);assert.equal(r.counts.read_supported,1);assert.equal(r.counts.explicit_none_unreviewed,1);
  assert.equal(r.counts.not_applicable_source_claim,0);
});
test("masked and illegible are unreadable rather than missing",()=>{
  const r=run([mk("masked"),mk("illegible")],[{canonicalFieldId:"test::money",sourceState:"masked",quote:"[마스킹]",bbox:[.1,.3,.3,.4]}]);
  assert.equal(r.counts.unreadable,3);assert.equal(r.counts.source_omitted,0);
});
test("source conflict cannot be normal read",()=>{assert.equal(run([mk("conflicting")]).counts.conflict,1);});
test("unlocated row omission stays suspected only on incomplete read",()=>{
  const r=run([],[],true,false),complete=run([],[],true,true);
  assert.equal(r.counts.suspected_omission,1);assert.equal(r.counts.source_omitted,0);assert.equal(complete.counts.suspected_omission,0);
});
test("required document missing and staff-reviewed N/A are separate states",()=>{
  assert.equal(requirementTriageStatus("missing"),"missing_document");
  assert.equal(requirementTriageStatus("partial"),"partial_document");
  assert.equal(requirementTriageStatus("not_applicable_confirmed"),"not_applicable_confirmed");
  assert.equal(requirementTriageStatus("waived_by_review"),"waived");
  assert.equal(requirementTriageStatus("qualification_needed"),"unresolved");
});
