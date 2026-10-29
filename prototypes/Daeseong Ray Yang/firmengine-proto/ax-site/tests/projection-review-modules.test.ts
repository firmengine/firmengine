import test from "node:test";
import assert from "node:assert/strict";
import { createCase, currentFacts, normalizeMoney, type Fact } from "../lib/domain.ts";
import { applyFactProjection, projectFactCorrections } from "../lib/fact-object-projection.ts";
import { canonicalJson as canonicalDependencyJson, deriveReviewDependencies, reviewDependenciesCurrent } from "../lib/review-dependencies.ts";
import { recordLegalCheckDisposition, legalCheckDispositionState } from "../lib/legal-check-dispositions.ts";

function fixture(){
  const data=createCase("synthetic projection","synthetic-case","2026-10-29");
  const mk=(id:string,value:string):Fact=>({id,logicalId:"debt-1:principal",version:id==="f1"?1:2,...(id==="f2"?{supersedes:"f1"}:{}),subjectId:"debt-1",key:"debt.principal",value,sourceUnit:"원",numeric:normalizeMoney(value,"원"),asOf:"2026-10-01",state:id==="f1"?"verified":"reported",recognition:"unreviewed",refs:[],validation:[]});
  data.facts=[mk("f1","100")];data.debts=[{id:"debt-1",creditor:"synthetic creditor",principal:normalizeMoney("100","원"),secured:"unknown",classification:"unknown",factIds:["f1"]}];
  return data;
}
test("fact correction proposes only uniquely mapped exact numeric value and invalidates dependent views",()=>{
  const before=fixture(),after=structuredClone(before);after.facts.push({...before.facts[0]!,id:"f2",version:2,supersedes:"f1",value:"200",numeric:normalizeMoney("200","원"),state:"reported"});after.debts[0]!.factIds=["f2"];
  const p=projectFactCorrections({before,after,oldFactIds:["f1"],newFactIds:["f2"]});
  assert.equal(p.updates.length,1);assert.equal(p.updates[0]!.numeric!.amountWon,"200");assert.deepEqual(p.invalidates,["schedule","allowance","reference_review","artifacts"]);
});
test("ambiguous and unknown period/unit mappings become explicit history-preserving blockers",()=>{
  const before=fixture(),after=structuredClone(before);after.facts.push({...before.facts[0],id:"f2",version:2,supersedes:"f1",value:"200",numeric:normalizeMoney("200","원"),state:"reported"},{...before.facts[0],id:"f3",version:2,supersedes:"f1",value:"300",numeric:normalizeMoney("300","원"),state:"reported"});
  assert.equal(projectFactCorrections({before,after,oldFactIds:["f1"],newFactIds:["f2","f3"]}).blockers[0].code,"AMBIGUOUS_FACT");
  after.facts[1]!.sourceUnit=null;after.facts[1]!.numeric=undefined;
  assert.equal(projectFactCorrections({before,after,oldFactIds:["f1"],newFactIds:["f2"]}).blockers[0].code,"UNKNOWN_UNIT_OR_PERIOD");
});
test("review dependency fingerprint ignores self-review metadata and binds source evidence with canonical SHA256",async()=>{
  const canonical=canonicalDependencyJson({z:1,nested:{y:true,x:"text"},a:[1,"two"]});assert.doesNotThrow(()=>JSON.parse(canonical));assert.equal(canonical,canonicalDependencyJson({a:[1,"two"],nested:{x:"text",y:true},z:1}));
  const a=fixture(),one=await deriveReviewDependencies(a,{factIds:["f1"],artifactKinds:["repayment_plan"]});
  const b=structuredClone(a);b.context.revision+=1;b.context.ruleApplicationReviewed=!b.context.ruleApplicationReviewed;
  assert.equal(reviewDependenciesCurrent(one,await deriveReviewDependencies(b,{factIds:["f1"],artifactKinds:["repayment_plan"]})),true);
  b.facts[0]!.value="101";
  assert.equal(reviewDependenciesCurrent(one,await deriveReviewDependencies(b,{factIds:["f1"],artifactKinds:["repayment_plan"]})),false);
  const sourceChanged=structuredClone(a);sourceChanged.facts[0]!.refs=[{documentId:"new-source",page:2,quote:"new quote",sourceHash:"source-hash-2"}];
  assert.equal(reviewDependenciesCurrent(one,await deriveReviewDependencies(sourceChanged,{factIds:["f1"],artifactKinds:["repayment_plan"]})),false);
  const artifactBound=structuredClone(a);artifactBound.exportManifest={caseRevision:1,requiredKinds:["repayment_plan"],files:[{id:"plan1",kind:"repayment_plan",name:"plan",hash:"artifact-hash-1",status:"current"}],reviews:{caseworker:null,lawyer:null}};
  const artifactOne=await deriveReviewDependencies(artifactBound,{factIds:["f1"],artifactKinds:["repayment_plan"]});artifactBound.exportManifest.files[0]!.hash="artifact-hash-2";
  assert.equal(reviewDependenciesCurrent(artifactOne,await deriveReviewDependencies(artifactBound,{factIds:["f1"],artifactKinds:["repayment_plan"]})),false,"selected artifact hashes are dependencies");
  assert.match(one.fingerprint,/^review-dependencies\/1:sha256:[a-f0-9]{64}$/);
});
test("legal disposition requires human evidence/reason and goes stale on dependency changes",()=>{
  const run={id:"run1",checkId:"eligibility",subjectFingerprint:"subject1",dependencyFingerprint:"deps1",status:"pass",factIds:["f1"],source:"ai" as const};
  assert.throws(()=>recordLegalCheckDisposition(run,{status:"accepted",evidenceFactIds:[],reason:"",actor:"",role:"lawyer",dependencyFingerprint:"deps1"}));
  const d=recordLegalCheckDisposition(run,{status:"accepted",evidenceFactIds:["f1"],reason:"원문과 적용 요건 대조",actor:"synthetic lawyer",role:"lawyer",dependencyFingerprint:"deps1"});
  assert.equal(legalCheckDispositionState(d,[run],{subjectFingerprint:"subject1",dependencyFingerprint:"deps1"}),"current");
  assert.equal(legalCheckDispositionState(d,[run],{subjectFingerprint:"subject1",dependencyFingerprint:"deps2"}),"stale");
  assert.equal(legalCheckDispositionState(d,[run,{...run,id:"run2",status:"fail"}],{subjectFingerprint:"subject1",dependencyFingerprint:"deps1"}),"conflict");
  assert.equal(legalCheckDispositionState(d,[run],{subjectFingerprint:"subject1",dependencyFingerprint:"deps1"},{truncated:true}),"coverage_incomplete");
});

test("applyFactProjection replaces current ID and projects typed money while preserving source history",()=>{
  const before=fixture();before.facts[0].refs=[{documentId:"source-old",page:1,quote:"old",sourceHash:"oldhash"}];
  const after=structuredClone(before);after.facts.push({...before.facts[0],id:"f2",version:2,supersedes:"f1",value:"200",numeric:normalizeMoney("200","원"),refs:[{documentId:"source-new",page:2,quote:"corrected",sourceHash:"newhash"}],state:"reported",recognition:"unreviewed"});after.debts[0].factIds=["f2"];
  after.context.paymentSchedule={reviewed:true,reviewReason:"prior review",expectedInstallments:1,phases:[]};after.context.allocationBasisReviewed=true;after.context.referenceReviewSha256="old-review";
  after.exportManifest={caseRevision:1,mode:"final",requiredKinds:[],files:[{id:"artifact1",kind:"repayment_plan",name:"plan",hash:"hash",status:"current"}],reviews:{caseworker:{actor:"x",at:"x",caseRevision:1,manifestFingerprint:"x"},lawyer:null}};
  const applied=applyFactProjection(before,after,["f1"],["f2"]);
  assert.equal(applied.data.debts[0].principal?.amountWon,"200");assert.deepEqual(applied.data.debts[0].factIds,["f2"]);
  assert.deepEqual(currentFacts(applied.data).map(f=>f.id),["f2"],"the newly superseding version is the only current fact");
  assert.equal(applied.data.facts.find(f=>f.id==="f1")?.refs[0].sourceHash,"oldhash");assert.equal(applied.data.facts.find(f=>f.id==="f2")?.refs[0].sourceHash,"newhash");
  assert.equal(applied.data.context.paymentSchedule?.reviewed,false);assert.equal(applied.data.context.allocationBasisReviewed,false);assert.equal(applied.data.context.referenceReviewSha256,undefined);
  assert.deepEqual(applied.audit.invalidatedArtifacts,["artifact1"]);assert.equal(applied.audit.resetReviews.find(x=>x.key==="paymentSchedule")?.prior && (applied.audit.resetReviews.find(x=>x.key==="paymentSchedule")?.prior as {reviewed:boolean}).reviewed,true);
});

test("applyFactProjection blocks retracted sources, accepted manual decisions, and unrelated assignee metadata",()=>{
  const before=fixture(),after=structuredClone(before);after.facts.push({...before.facts[0],id:"f2",version:2,supersedes:"f1",value:"200",numeric:normalizeMoney("200","원"),state:"reported",recognition:"unreviewed"});after.debts[0].factIds=["f2"];
  const manual=structuredClone(before);manual.facts[0].recognition="accepted";
  assert.equal(applyFactProjection(manual,after,["f1"],["f2"]).projection.blockers[0].code,"MANUAL_OVERRIDE");
  const override=structuredClone(before);override.debts[0].principal=normalizeMoney("150","원");
  assert.equal(applyFactProjection(override,after,["f1"],["f2"]).projection.blockers[0].code,"MANUAL_OVERRIDE");
  const retracted=structuredClone(before);retracted.facts[0].state="retracted";
  assert.equal(applyFactProjection(retracted,after,["f1"],["f2"]).projection.blockers[0].code,"NO_TYPED_TARGET");
  const assigneeOnly=structuredClone(after);assigneeOnly.context.applicant={name:"synthetic assignee"};
  assert.equal(applyFactProjection(before,assigneeOnly,["f1"],["f2"]).projection.updates.length,1);
});
