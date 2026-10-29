import test from "node:test";
import assert from "node:assert/strict";
import * as referenceImpact from "../lib/reference-impact.ts";
import { readFileSync } from "node:fs";
import ts from "typescript";
const routeOutput=ts.transpileModule(readFileSync(new URL("../app/api/reference-data/route.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function routeHarness(canApprove=true){
 const calls:{role?:string;actor?:string;fingerprint?:string;fourEyes?:boolean;bundleIds?:unknown;bundleBase?:string;restoreTarget?:string;restoreActor?:string}={};
 const env={FIRMENGINE_REFERENCE_FOUR_EYES:"true"};
 class HttpError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status;}}
 const m={exports:{} as {GET:(request:Request)=>Promise<Response>;POST:(request:Request)=>Promise<Response>}};
 const mocks:Record<string,unknown>={
  "../../../lib/server-store":{db:()=>({}),errorResponse:(e:Error&{status?:number})=>Response.json({error:e.message},{status:e.status??500}),HttpError,jsonBody:async(r:Request)=>r.json(),requireHumanActor:async()=>"human",requireSameOrigin:()=>{}},
  "../../../lib/reference-registry.ts":{REFERENCE_RELEASE:{id:"release",sha256:"hash"},referenceRecordsPage:()=>({})},
  "../../../lib/reference-store.ts":{activateReferenceChange:async(_db:unknown,id:string,sha:string,actor:string,fingerprint:string,policy:{fourEyesRequired:boolean})=>{calls.actor=actor;calls.fingerprint=fingerprint;calls.fourEyes=policy.fourEyesRequired;return {id,sha};},approveReferenceBundle:async(_db:unknown,input:{artifactIds:unknown;expectedActiveSha256:string},actor:string)=>{calls.bundleIds=input.artifactIds;calls.bundleBase=input.expectedActiveSha256;calls.actor=actor;return {bundleReview:{status:"verified"}};},restoreReferenceRelease:async(_db:unknown,input:{targetSha256:string;expectedActiveSha256:string;reason:string},actor:string)=>{calls.restoreTarget=input.targetSha256;calls.restoreActor=actor;return {sha256:"new-active"};},previewReferenceReleaseRestore:async()=>({changedReferenceIds:["x"]}),listReferenceReleaseHistory:async()=>[],bootstrapReferenceData:async()=>({}),listPendingReferenceChanges:async()=>[],proposeReferenceChange:async(_db:unknown,input:unknown,actor:string)=>{calls.actor=actor;return {status:"pending_review"};},referenceStorageStatus:async()=>({})},
  "../../../lib/reference-context.ts":{loadReferenceSnapshot:async()=>({})},
  "../../../lib/reference-runtime.ts":{currentReferenceSnapshot:()=>undefined},
  "../../../lib/app-roles.ts":{requireAppRole:async(role:string)=>{calls.role=role;if(!canApprove)throw new HttpError(403,"HUMAN_ROLE_REQUIRED");return "reviewer";}},
  "../../../lib/reference-impact.ts":referenceImpact,
  "cloudflare:workers":{env},
 };
 new Function("require","module","exports",routeOutput)((name:string)=>{if(name in mocks)return mocks[name];throw new Error(`Unexpected import ${name}`);},m,m.exports);
 return {handlers:m.exports,calls};
}
test("reference activation route requires the designated approval role and forwards current fingerprints",async()=>{
 const {handlers,calls}=routeHarness();
 const response=await handlers.POST(new Request("https://example.test/api/reference-data",{method:"POST",body:JSON.stringify({action:"activate",proposalId:"p1",expectedActiveSha256:"base",expectedProposalFingerprint:"candidate"})}));
 assert.equal(response.status,200);assert.equal(calls.role,"reference_approve");assert.equal(calls.actor,"reviewer");assert.equal(calls.fingerprint,"candidate");assert.equal(calls.fourEyes,true);
});
test("proposal submission remains a human-authored pending candidate without an approval grant",async()=>{
 const {handlers,calls}=routeHarness();
 const response=await handlers.POST(new Request("https://example.test/api/reference-data",{method:"POST",body:JSON.stringify({action:"propose",id:"r",value:1})}));
 assert.equal(response.status,200);assert.equal(calls.role,undefined);assert.equal(calls.actor,"human");
});

test("an actor without reference_approve is rejected before release activation",async()=>{
 const {handlers,calls}=routeHarness(false);
 const response=await handlers.POST(new Request("https://example.test/api/reference-data",{method:"POST",body:JSON.stringify({action:"activate",proposalId:"p1",expectedActiveSha256:"base",expectedProposalFingerprint:"candidate"})}));
 assert.equal(response.status,403);assert.equal(calls.role,"reference_approve");assert.equal(calls.actor,undefined);
});
test("bundle compatibility approval requires reference_approve and binds the submitted active snapshot",async()=>{
 const {handlers,calls}=routeHarness();const response=await handlers.POST(new Request("https://example.test/api/reference-data",{method:"POST",body:JSON.stringify({action:"approve_bundle",artifactIds:["law.a"],expectedActiveSha256:"active-sha",reason:"Reviewed exact artifact set"})}));
 assert.equal(response.status,200);assert.equal(calls.role,"reference_approve");assert.equal(calls.actor,"reviewer");assert.deepEqual(calls.bundleIds,["law.a"]);assert.equal(calls.bundleBase,"active-sha");
 const denied=routeHarness(false);const rejected=await denied.handlers.POST(new Request("https://example.test/api/reference-data",{method:"POST",body:JSON.stringify({action:"approve_bundle",artifactIds:["law.a"],expectedActiveSha256:"active-sha",reason:"Reviewed exact artifact set"})}));assert.equal(rejected.status,403);assert.equal(denied.calls.actor,undefined);
});

test("impact preview is read-only, limited to requested owner-authorized cases, and exposes unknown dependencies without mutating files",async()=>{
 class HttpError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status;}}
 const reads:string[]=[],proposal={id:"proposal-1",referenceId:"changed-rule",oldValue:1,value:2,reason:"reviewed source change",sourceUrls:["https://law.go.kr"],effectiveFrom:"2026-01-01",applicationContract:{dateBasis:"applicationDate",jurisdiction:"court-a",effectiveTo:null,transition:{status:"unknown" as const}},baseSha256:"b".repeat(64),basisType:"official_source",status:"pending_review",createdAt:"2026-10-29",actor:"author"};
 const db={prepare(sql:string){const statement={bind(){return statement;},async first(){reads.push(sql);if(sql.includes("legal_reference_changes"))return{payload:JSON.stringify(proposal),status:"pending_review"};if(sql.includes("FROM cases"))return{owner:"reviewer"};return null;}};return statement;}};
 const mockData={context:{id:"case-1",applicationDate:"2026-06-01",asOf:"2026-06-01",courtId:"court-a"},exportManifest:{files:[{id:"file-old",kind:"application",name:"old.docx",hash:"x",status:"current"}]}};
 const mocks:Record<string,unknown>={
  "../../../lib/server-store":{db:()=>db,errorResponse:(e:Error&{status?:number})=>Response.json({error:e.message},{status:e.status??500}),HttpError,jsonBody:async(r:Request)=>r.json(),requireHumanActor:async()=>"reviewer",requireSameOrigin:()=>{},getCase:async()=>mockData,caseExtras:async()=>({derivedEvaluation:{status:"complete",execution:{referenceApplication:{status:"resolved",artifactIds:["changed-rule"]}}}})},
  "../../../lib/reference-registry.ts":{REFERENCE_RELEASE:{id:"release",sha256:"hash"},referenceRecordsPage:()=>({}),referenceRecord:()=>({courtIds:["court-a"]})},
  "../../../lib/reference-store.ts":{getPendingReferenceChange:async()=>proposal,referenceStorageStatus:async()=>({}),listPendingReferenceChanges:async()=>[]},
  "../../../lib/reference-context.ts":{loadReferenceSnapshot:async()=>({}),inspectReferenceSnapshotBundle:()=>({})},"../../../lib/reference-runtime.ts":{currentReferenceSnapshot:()=>undefined},
  "../../../lib/app-roles.ts":{requireAppRole:async()=>"reviewer"},"../../../lib/reference-impact.ts":await import("../lib/reference-impact.ts"),"cloudflare:workers":{env:{}}
 };
 const mod={exports:{} as {GET:(request:Request)=>Promise<Response>}};new Function("require","module","exports",routeOutput)((name:string)=>{if(name in mocks)return mocks[name];throw new Error(`Unexpected import ${name}`);},mod,mod.exports);
 const res=await mod.exports.GET(new Request("https://example.test/api/reference-data?action=impact&proposalId=proposal-1&caseId=case-1"));assert.equal(res.status,200);
 const result=await res.json() as {impact:{affected:string[];unknown:string[];tasks:unknown[]};details:{matchingArtifactIds:string[];currentArtifactIds:string[]}[];caseWrites:number;submittedOrCurrentArtifactsChanged:boolean};
 assert.deepEqual(result.impact.unknown,["case-1"]);assert.deepEqual(result.impact.affected,[]);assert.deepEqual(result.impact.tasks,[]);assert.deepEqual(result.details[0].matchingArtifactIds,["changed-rule"]);assert.deepEqual(result.details[0].currentArtifactIds,["file-old"]);assert.equal(result.caseWrites,0);assert.equal(result.submittedOrCurrentArtifactsChanged,false);assert.ok(reads.every(sql=>sql.includes("WHERE id=?")),"queries are restricted to the explicitly requested proposal and case IDs");
});

test("historic release restore requires reference_approve and forwards the previewed base",async()=>{
 const {handlers,calls}=routeHarness();const response=await handlers.POST(new Request("https://example.test/api/reference-data",{method:"POST",body:JSON.stringify({action:"restore_release",targetSha256:"historic-sha",expectedActiveSha256:"current-sha",reason:"Restore following source recheck"})}));assert.equal(response.status,200);assert.equal(calls.role,"reference_approve");assert.equal(calls.restoreTarget,"historic-sha");assert.equal(calls.restoreActor,"reviewer");
 calls.role=undefined;const preview=await handlers.GET(new Request("https://example.test/api/reference-data?action=restore_preview&targetSha256=historic-sha&expectedActiveSha256=current-sha"));assert.equal(preview.status,200);assert.equal(calls.role,"reference_approve");
 const denied=routeHarness(false);const rejected=await denied.handlers.POST(new Request("https://example.test/api/reference-data",{method:"POST",body:JSON.stringify({action:"restore_release",targetSha256:"historic-sha",expectedActiveSha256:"current-sha",reason:"Restore following source recheck"})}));assert.equal(rejected.status,403);assert.equal(denied.calls.restoreActor,undefined);
});
