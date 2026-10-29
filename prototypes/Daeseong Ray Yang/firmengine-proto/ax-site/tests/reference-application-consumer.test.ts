import test from "node:test";
import assert from "node:assert/strict";
import { createCase } from "../lib/domain.ts";
import { executeCaseNodes } from "../lib/case-execution.ts";
import { resolveReferenceApplicationForCase } from "../lib/reference-context.ts";
import { completeDerivedEvaluation, pendingDerivedEvaluation } from "../lib/reactive-evaluation.ts";
import type { ReferenceBundle } from "../lib/reference-bundle.ts";
import { runWithReferenceSnapshot as useSnapshot } from "../lib/reference-context.ts";
import { parseContextPatch } from "../lib/context-validation.ts";
const digest="a".repeat(64);
const bundle=(id:string,from:string,to:string,jurisdiction="seoul"):ReferenceBundle=>({id,revision:"1",sha256:digest,compatibility:"verified",artifacts:[{id:"statute-1",revision:"1",sha256:digest,effectiveFrom:from,effectiveTo:to,jurisdiction,dateBasis:"applicationDate",transition:{status:"declared"}}]});
function fixture(date:string,court="seoul") { const data=createCase("synthetic reference resolution","case-reference-test",date);data.context.courtId=court;const context=data.context as typeof data.context & {referenceApplicationRequired?:boolean;referenceBundleId?:string;referenceDateBasis?:string;referenceEffectiveDate?:string};context.referenceApplicationRequired=true;context.referenceBundleId="active";context.referenceDateBasis="applicationDate";context.referenceEffectiveDate=date;return data; }
const snapshot={id:"release-r1",revision:1,sha256:digest,values:{}};
test("case context accepts explicit reference declarations and rejects incomplete or invalid declarations",()=>{
 const explicit=parseContextPatch({referenceApplicationRequired:true,referenceBundleId:"release-r1",referenceArtifactIds:["statute-1"],referenceDateBasis:"applicationDate",referenceEffectiveDate:"2024-06-01"});
 assert.equal(explicit.referenceApplicationRequired,true);assert.deepEqual(explicit.referenceArtifactIds,["statute-1"]);
 assert.throws(()=>parseContextPatch({referenceApplicationRequired:true,referenceBundleId:"release-r1",referenceArtifactIds:["statute-1"]}),/기준 적용을 확정하려면/);
 assert.throws(()=>parseContextPatch({referenceApplicationRequired:true,referenceBundleId:"release-r1",referenceArtifactIds:["statute-1"],referenceDateBasis:"filing",referenceEffectiveDate:"2024-02-31"}));
 const caseData=createCase("date basis synthetic","reference-date-basis","2024-06-01");assert.throws(()=>parseContextPatch({referenceApplicationRequired:true,referenceBundleId:"release-r1",referenceArtifactIds:["statute-1"],referenceDateBasis:"applicationDate",referenceEffectiveDate:"2024-07-01"},caseData.context),/선택한 사건 날짜 기준/);
});
test("case consumer resolves an explicit past application and leaves future or court-mismatched references unresolved",()=>useSnapshot(snapshot,()=>{
 const past=resolveReferenceApplicationForCase(fixture("2024-06-01"),[bundle("active","2020-01-01","2024-12-31")]);
 assert.equal(past.status,"resolved");assert.equal(past.selectedBundleId,"active");assert.equal(past.finalGate,null);assert.deepEqual(past.artifactIds,["statute-1"]);
 const actual=executeCaseNodes(fixture("2024-06-01"),{referenceBundles:[bundle("active","2020-01-01","2024-12-31")]});
 assert.equal(actual.referenceApplication.status,"resolved");
 const pending=pendingDerivedEvaluation({revision:1,storageToken:"token",inputSha256:digest,generatedAt:"2026-10-28T00:00:00Z",referenceApplication:past});
 const completed=completeDerivedEvaluation(pending,actual,digest);
 assert.equal(completed.referenceApplication?.selectedBundleHash,digest);
 const future=resolveReferenceApplicationForCase(fixture("2025-01-01"),[bundle("active","2020-01-01","2024-12-31")]);
 assert.equal(future.status,"unresolved");assert.equal(future.finalGate,"REFERENCE_APPLICATION_UNRESOLVED");
 const court=resolveReferenceApplicationForCase(fixture("2024-06-01","busan"),[bundle("active","2020-01-01","2024-12-31")]);
 assert.equal(court.status,"unresolved");assert.ok(court.reasonCodes.includes("no_compatible_bundle"));
}));
test("overlapping bundles stay unresolved and only explicit applicability adds a finalization gate",()=>useSnapshot(snapshot,()=>{
 const data=fixture("2024-06-01");(data.context as typeof data.context & {referenceBundleId?:string}).referenceBundleId=undefined;
 const overlap=resolveReferenceApplicationForCase(data,[bundle("active","2020-01-01","2025-12-31"),bundle("second","2024-01-01","2026-12-31")]);
 assert.equal(overlap.status,"unresolved");assert.ok(overlap.reasonCodes.includes("overlapping_applicability"));
 const legacy=createCase("legacy synthetic case","case-reference-legacy","2024-06-01");
 const legacyExecution=executeCaseNodes(legacy);
 assert.equal(legacyExecution.referenceApplication.applicable,false);assert.equal(legacyExecution.referenceApplication.finalGate,null);
 const requiredExecution=executeCaseNodes(data);
 assert.equal(requiredExecution.referenceApplication.applicable,true);assert.ok(requiredExecution.assessment.generationGate.reasons.includes("REFERENCE_APPLICATION_UNRESOLVED"));
}));
