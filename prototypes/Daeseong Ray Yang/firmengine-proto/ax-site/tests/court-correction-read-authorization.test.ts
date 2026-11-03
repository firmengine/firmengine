import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const routePath=new URL("../app/api/cases/[id]/correction-items/route.ts",import.meta.url);

type Scenario={
 roles:readonly string[];
 actor?:string|null;
 requestCaseId?:string;
};
class HttpError extends Error{
 constructor(public status:number,message:string){super(message);}
}
function routeHarness(scenario:Scenario){
 const calls={origin:0,authorization:0,caseReads:0,itemReads:0,scope:""};
 const server={
  db:()=>({}),
  errorResponse:(error:unknown)=>Response.json({error:error instanceof Error?error.message:"UNKNOWN"},
   {status:error instanceof HttpError?error.status:500}),
  getCase:async(id:string)=>{calls.caseReads++;return{context:{id,revision:1},documents:[]};},
  HttpError,
  jsonBody:async()=>({}),
  requireSameOrigin:()=>{calls.origin++;},
  requireHumanActor:async()=>{
   calls.authorization++;
   if(!scenario.actor)throw new HttpError(403,"HUMAN_ROLE_REQUIRED");
   return scenario.actor;
  },
 };
 const role={
  requireAppRole:async()=>{if(!scenario.roles.includes("caseworker_review"))throw new HttpError(403,"HUMAN_ROLE_REQUIRED");return scenario.actor;},
  rolesForActor:async(_actor:string,scopeId:string)=>{calls.scope=scopeId;return scenario.roles;},
 };
 const deps:Record<string,unknown>={
  "../../../../../lib/server-store.ts":server,
  "../../../../../lib/app-roles.ts":role,
  "../../../../../lib/intake-store.ts":{getIntakeCatalog:async()=>({catalog:{documents:[]}})},
  "../../../../../lib/preapproval-correction-item-store.ts":{
   readCourtCorrectionItems:async()=>{calls.itemReads++;return{count:1,courtApprovalInferred:false};},
   upsertCourtCorrectionItem:async()=>({unchanged:false}),
  },
 };
 const output=ts.transpileModule(readFileSync(routePath,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
 }).outputText;
 const mod:{exports:Record<string,unknown>}={exports:{}};
 new Function("require","module","exports",output)((name:string)=>{
  if(!Object.hasOwn(deps,name))throw new Error("Unknown route dependency: "+name);
  return deps[name];
 },mod,mod.exports);
 return {GET:mod.exports.GET as (request:Request,context:unknown)=>Promise<Response>,calls};
}
const call=async(roles:readonly string[],actor:string|null="synthetic-actor")=>{
 const h=routeHarness({roles,actor});
 const response=await h.GET(new Request("https://example.test/api/cases/synthetic-case-01/correction-items"),
  {params:Promise.resolve({id:"synthetic-case-01"})});
 return {status:response.status,body:await response.json(),calls:h.calls};
};
test("court correction item read denies a human without any case-scoped review role before case DB access",async()=>{
 const r=await call([]);
 assert.equal(r.status,403);
 assert.equal(r.calls.origin,1);
 assert.equal(r.calls.authorization,1);
 assert.equal(r.calls.scope,"synthetic-case-01");
 assert.equal(r.calls.caseReads,0);
 assert.equal(r.calls.itemReads,0);
});
test("court correction read denies service identity before reading case data",async()=>{
 const r=await call(["case_editor"],null);
 assert.equal(r.status,403);
 assert.equal(r.calls.caseReads,0);
 assert.equal(r.calls.itemReads,0);
});
for(const role of ["case_editor","caseworker_review","lawyer_review"]){
 test("court correction item read permits scoped "+role+" without inferring court compliance",async()=>{
  const r=await call([role]);
  assert.equal(r.status,200);
  assert.equal(r.calls.scope,"synthetic-case-01");
  assert.equal(r.calls.caseReads,1);
  assert.equal(r.calls.itemReads,1);
  assert.deepEqual(r.body,{count:1,courtApprovalInferred:false});
 });
}
test("unrelated administrative grant alone does not authorize correction item read",async()=>{
 const r=await call(["role_admin"]);
 assert.equal(r.status,403);
 assert.equal(r.calls.caseReads,0);
});
