import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

/** Execute the actual GitHub source through a deterministic dependency boundary.
 * This is an isolated synthetic route test, NOT a D1/Sites/browser integration test.
 */
function loadSource(path:string,resolve:(specifier:string)=>unknown):Record<string,any>{
  const source=readFileSync(new URL("../"+path,import.meta.url),"utf8");
  const javascript=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const localModule={exports:{} as Record<string,any>};
  new Function("require","module","exports",javascript)(resolve,localModule,localModule.exports);
  return localModule.exports;
}
class HttpError extends Error{
  constructor(readonly status:number,message:string){super(message);}
}
test("case read access is scoped to a human actor and the specific case",async()=>{
  let actor:string|null="synthetic-staff",roles:string[]=[],scope="",roleChecks=0;
  const access=loadSource("lib/case-read-access.ts",name=>{
    if(name.endsWith("server-store.ts"))return {
      HttpError,requireHumanActor:async()=>{if(!actor)throw new HttpError(403,"HUMAN_REQUIRED");return actor;}
    };
    if(name.endsWith("app-roles.ts"))return {
      rolesForActor:async(_actor:string,caseId:string)=>{roleChecks++;scope=caseId;return roles;}
    };
    throw new Error("Unexpected module: "+name);
  }).requireCaseReadAccess as (caseId:string)=>Promise<string>;
  const denied=async(expected:string,caseId="case-A")=>{
    await assert.rejects(access(caseId),(e:unknown)=>e instanceof Error&&e.message===expected);
  };
  await denied("CASE_READ_ROLE_REQUIRED");
  assert.equal(scope,"case-A");
  for(const role of ["case_editor","caseworker_review","lawyer_review"]){
    roles=[role];assert.equal(await access("case-B"),"synthetic-staff");
    assert.equal(scope,"case-B");
  }
  roles=["role_admin"];await denied("CASE_READ_ROLE_REQUIRED");
  actor=null;roles=["case_editor"];const before=roleChecks;
  await denied("HUMAN_REQUIRED");assert.equal(roleChecks,before);
  actor="synthetic-staff";await denied("CASE_READ_INVALID_ID","");
});
test("workflow, requirements and case GET refuse a foreign case before any data read",async()=>{
  const paths=[
    "app/api/cases/[id]/workflow/route.ts",
    "app/api/cases/[id]/requirements/route.ts",
    "app/api/cases/[id]/route.ts"
  ];
  for(const path of paths){
    let checks=0,reads=0;
    const route=loadSource(path,name=>{
      if(name.endsWith("case-read-access.ts"))
        return {requireCaseReadAccess:async()=>{checks++;throw new HttpError(403,"CASE_READ_ROLE_REQUIRED");}};
      if(name.endsWith("case-workflow-server"))
        return {caseWorkflowResponse:async()=>{reads++;return {caseId:"synthetic",requirementStates:[],workflow:{requirements:[]}};}};
      if(name.endsWith("case-response"))
        return {caseResponse:async()=>{reads++;return {caseId:"synthetic"};}};
      if(name.endsWith("json-response"))
        return {jsonResponse:(body:unknown)=>Response.json(body)};
      if(name.endsWith("server-store"))
        return {errorResponse:(e:unknown)=>Response.json({error:e instanceof Error?e.message:"unexpected"},{status:e instanceof HttpError?e.status:500})};
      return {};
    });
    const response=await route.GET(
      new Request("https://synthetic.invalid/api/cases/case-A"),
      {params:Promise.resolve({id:"case-A"})}
    ) as Response;
    assert.equal(response.status,403,path);
    assert.equal(checks,1,path);
    assert.equal(reads,0,path);
  }
});
test("permitted synthetic GET still delegates to the original data path",async()=>{
  for(const path of ["app/api/cases/[id]/workflow/route.ts","app/api/cases/[id]/requirements/route.ts","app/api/cases/[id]/route.ts"]){
    let checks=0,reads=0;
    const route=loadSource(path,name=>{
      if(name.endsWith("case-read-access.ts"))return {requireCaseReadAccess:async()=>{checks++;return "synthetic-staff";}};
      if(name.endsWith("case-workflow-server"))return {caseWorkflowResponse:async()=>{reads++;return {caseId:"synthetic",requirementStates:[],workflow:{requirements:[]}};}};
      if(name.endsWith("case-response"))return {caseResponse:async()=>{reads++;return {caseId:"synthetic"};}};
      if(name.endsWith("json-response"))return {jsonResponse:(body:unknown)=>Response.json(body)};
      if(name.endsWith("server-store"))return {errorResponse:(e:unknown)=>Response.json({error:String(e)},{status:500})};
      return {};
    });
    const response=await route.GET(new Request("https://synthetic.invalid/api/cases/case-A"),{params:Promise.resolve({id:"case-A"})}) as Response;
    assert.equal(response.status,200,path);
    assert.equal(checks,1,path);
    assert.equal(reads,1,path);
  }
});
