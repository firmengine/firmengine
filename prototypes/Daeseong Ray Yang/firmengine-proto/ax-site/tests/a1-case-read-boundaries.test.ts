import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import ts from "typescript";

/** Isolated API/SQLite synthetic tests: not D1, R2, browser or CI acceptance. */
class HttpError extends Error {
  constructor(readonly status:number,message:string){super(message);}
}
function load(path:string,mock:(name:string)=>unknown):Record<string,any>{
  const source=readFileSync(new URL("../"+path,import.meta.url),"utf8");
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const local={exports:{} as Record<string,any>};
  new Function("require","module","exports",js)(mock,local,local.exports);
  return local.exports;
}
const failed=(error:unknown)=>new Response(JSON.stringify({error:String(error)}),{status:error instanceof HttpError?error.status:500});
test("case document original/page GET denies an ungranted actor before case or R2 reads",async()=>{
  for(const kind of ["original","page"]){
    for(const roles of [[],["role_admin"]]){
      let caseReads=0,objectReads=0,scoped="";
      const route=load("app/api/cases/[id]/documents/[doc]/route.ts",name=>{
        if(name.endsWith("app-roles.ts"))return {rolesForActor:async(_who:string,caseId:string)=>{scoped=caseId;return roles;}};
        if(name.endsWith("server-store"))return {
          requireHumanActor:async()=> "synthetic-worker",getCase:async()=>{caseReads++;throw new Error("unauthorized read");},
          db:()=>{throw new Error("unauthorized DB read");},bucket:()=>{objectReads++;throw new Error("unauthorized R2 read");},
          HttpError,errorResponse:failed
        };
        return {};
      });
      const response=await route.GET(new Request("https://example.invalid/api/cases/A/documents/D?kind="+kind),{params:Promise.resolve({id:"case-A",doc:"doc-D"})}) as Response;
      assert.equal(response.status,403);
      assert.equal(scoped,"case-A");
      assert.equal(caseReads,0);
      assert.equal(objectReads,0);
    }
  }
});
test("case document GET needs a person; permitted case reader still receives the object",async()=>{
  for(const role of ["case_editor","caseworker_review","lawyer_review"]){
    let caseReads=0,objectReads=0;
    const route=load("app/api/cases/[id]/documents/[doc]/route.ts",name=>{
      if(name.endsWith("app-roles.ts"))return {rolesForActor:async()=>[role]};
      if(name.endsWith("server-store"))return {
        requireHumanActor:async()=> "synthetic-worker",
        getCase:async()=>{caseReads++;return {documents:[{id:"doc-D",status:"active"}]};},
        db:()=>({prepare:()=>({bind:()=>({first:async()=>({id:"doc-D",name:"synthetic",page_count:1,original_key:"synthetic/object"})})})}),
        bucket:()=>({get:async()=>{objectReads++;return {body:new Uint8Array([1,2,3]),writeHttpMetadata:()=>{}};}}),
        HttpError,errorResponse:failed
      };
      return {};
    });
    const response=await route.GET(new Request("https://example.invalid/api/cases/A/documents/D"),{params:Promise.resolve({id:"case-A",doc:"doc-D"})}) as Response;
    assert.equal(response.status,200);assert.equal(caseReads,1);assert.equal(objectReads,1);
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[1,2,3]);
  }
  const denied=load("app/api/cases/[id]/documents/[doc]/route.ts",name=>{
    if(name.endsWith("server-store"))return {requireHumanActor:async()=>{throw new HttpError(403,"HUMAN_REQUIRED");},HttpError,errorResponse:failed};
    if(name.endsWith("app-roles.ts"))return {rolesForActor:async()=>{throw new Error("must not check grants for a service user");}};
    return {};
  });
  const response=await denied.GET(new Request("https://example.invalid/api/cases/A/documents/D"),{params:Promise.resolve({id:"case-A",doc:"doc-D"})}) as Response;
  assert.equal(response.status,403);
});
test("workspace returns only current per-case grants, and computes scoped total",async()=>{
  const sqlite=new DatabaseSync(":memory:");
  try{
    sqlite.exec("CREATE TABLE cases(id TEXT PRIMARY KEY,name TEXT,payload TEXT,revision INTEGER,updated_at TEXT);CREATE TABLE app_role_grants(actor_id TEXT,role TEXT,scope_id TEXT,status TEXT,effective_from TEXT,effective_to TEXT);");
    const ic=sqlite.prepare("INSERT INTO cases VALUES(?,?,?,?,?)");
    for(let i=1;i<=3;i++)ic.run("case-"+i,"Synthetic "+i,JSON.stringify({documents:[],facts:[]}),1,"2026-10-30T0"+i+":00:00Z");
    const ig=sqlite.prepare("INSERT INTO app_role_grants VALUES(?,?,?,?,?,?)");
    for(const g of [
      ["staffA","case_editor","case-1","active","2026-10-01",null],
      ["staffB","lawyer_review","case-2","active","2026-10-01",null],
      ["everyone","caseworker_review","*","active","2026-10-01",null],
      ["admin","role_admin","*","active","2026-10-01",null],
      ["revoked","case_editor","case-3","revoked","2026-10-01",null],
      ["expired","case_editor","case-3","active","2026-10-01","2026-10-30"],
      ["future","case_editor","case-3","active","2026-11-01",null],
    ])ig.run(...g);
    let who="staffA",scopes:string[]=[];
    const route=load("app/api/workspace/route.ts",name=>{
      if(name.endsWith("app-roles.ts"))return {rolesForActor:async(_id:string,scope:string)=>{scopes.push(scope);return [];}};
      if(name.endsWith("server-store"))return {
        requireHumanActor:async()=>who,now:()=> "2026-10-31T00:00:00Z",
        db:()=>({prepare:(sql:string)=>({bind:(...values:any[])=>({
          all:async()=>({results:sqlite.prepare(sql).all(...values)}),
          first:async()=>sqlite.prepare(sql).get(...values)
        })})}),caseSummary:()=>({documents:0,facts:0,status:"needs_evidence"}),
        connection:()=>({}),errorResponse:failed
      };
      if(name.endsWith("reference-runtime.ts"))return {currentReferenceSnapshot:()=>null};
      if(name.endsWith("legal-rules"))return {CURRENT_RULESET:{},LEGAL_CATALOG:[],RISK_CATALOG:[]};
      if(name.endsWith("sample-manifest"))return {BENCHMARK:{}};
      if(name.endsWith("chatgpt-auth"))return {getChatGPTUser:async()=>({displayName:"Synthetic"})};
      return {};
    });
    for(const [actor,ids] of [
      ["staffA",["case-1"]],["staffB",["case-2"]],["everyone",["case-3","case-2","case-1"]],
      ["admin",[]],["revoked",[]],["expired",[]],["future",[]]
    ] as const){
      who=actor;
      const response=await route.GET() as Response;
      assert.equal(response.status,200,actor);
      const data=await response.json() as {cases:{id:string}[],totalCount:number,possiblyTruncated:boolean};
      assert.deepEqual(data.cases.map(x=>x.id),ids,actor);
      assert.equal(data.totalCount,ids.length,actor);
      assert.equal(data.possiblyTruncated,false);
    }
    assert.equal(scopes.length,7);assert.ok(scopes.every(x=>x==="*"));
  }finally{sqlite.close();}
});
test("workspace requires authenticated human before any database read",async()=>{
  let reads=0;
  const route=load("app/api/workspace/route.ts",name=>{
    if(name.endsWith("server-store"))return {
      requireHumanActor:async()=>{throw new HttpError(403,"HUMAN_REQUIRED");},
      db:()=>{reads++;throw Error("unauthorized read");},errorResponse:failed
    };
    return {};
  });
  const response=await route.GET() as Response;
  assert.equal(response.status,403);assert.equal(reads,0);
});
