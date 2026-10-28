import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { assertProcessJobRows,buildProcessJobSelect,parseProcessJobIds,parseProcessJobIdsQuery,rescuePlanInScope,isCurrentEvidenceJob } from "../lib/process-job-scope.ts";

test("process allowlist parsing fails closed for empty, duplicate, malformed, or oversized scopes",()=>{
  assert.equal(parseProcessJobIds(undefined),undefined);
  assert.throws(()=>parseProcessJobIds([]),{status:400});
  assert.throws(()=>parseProcessJobIds(["page-a","page-a"]),{status:400});
  assert.throws(()=>parseProcessJobIds(["page-a",""]),{status:400});
  assert.deepEqual(parseProcessJobIdsQuery("page-a,page-b"),["page-a","page-b"]);
  assert.throws(()=>parseProcessJobIdsQuery(""),{status:400});
});

test("scoped SQL ignores earlier unrelated pending jobs and reaches only allowlisted pending/expired jobs",()=>{
  const sqlite=new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE documents(id TEXT,case_id TEXT,ready INTEGER,original_key TEXT,sha256 TEXT);
    CREATE TABLE page_jobs(id TEXT,case_id TEXT,document_id TEXT,page INTEGER,role TEXT,status TEXT,stage TEXT,lease_until TEXT,image_key TEXT);`);
  sqlite.prepare("INSERT INTO documents(id,case_id,ready) VALUES(?,?,?)").run("doc","case-a",1);
  const insert=sqlite.prepare("INSERT INTO page_jobs VALUES(?,?,?,?,?,?,?,?,?)");
  insert.run("unrelated-first","case-a","doc",1,"evidence","pending","extract",null,"image-1");
  insert.run("selected-terminal","case-a","doc",2,"evidence","completed","completed",null,"image-2");
  insert.run("selected-expired","case-a","doc",3,"evidence","processing","extract","2020-01-01T00:00:00Z","image-3");
  insert.run("heldout","case-a","doc",4,"filed_form","pending","extract",null,"image-4");
  const query=(ids:string[],apiKey=true)=>buildProcessJobSelect("case-a",ids,"2026-10-27T00:00:00Z",apiKey);
  const terminal=sqlite.prepare(query(["selected-terminal"]).sql).get(...query(["selected-terminal"]).params);
  assert.equal(terminal,undefined,"a terminal selected job returns idle even when an unrelated job is pending");
  const selected=sqlite.prepare(query(["selected-expired"]).sql).get(...query(["selected-expired"]).params) as {id:string};
  assert.equal(selected.id,"selected-expired","an expired lease remains claimable when allowlisted");
  assert.equal(sqlite.prepare(query(["heldout"]).sql).get(...query(["heldout"]).params),undefined,"held-out roles are never selected");
  const foreign=query(["foreign-job"]);
  assert.equal(sqlite.prepare(foreign.sql).get(...foreign.params),undefined,"foreign IDs cannot match another case's job");
  sqlite.close();
});

test("pre-claim validation rejects foreign and held-out IDs before any claim",()=>{
  const ids=["job-a"];
  assert.throws(()=>assertProcessJobRows(ids,[],()=>true),{status:400});
  assert.throws(()=>assertProcessJobRows(ids,[{id:"other-job",document_id:"doc",page:2,role:"evidence"}],()=>true),{status:400});
  assert.throws(()=>assertProcessJobRows(ids,[{id:"job-a",document_id:"doc",page:2,role:"filed_form"}],()=>true),{status:400});
  assert.throws(()=>assertProcessJobRows(ids,[{id:"job-a",document_id:"doc",page:2,role:"evidence"}],()=>false),{status:400});
  assert.doesNotThrow(()=>assertProcessJobRows(ids,[{id:"job-a",document_id:"doc",page:2,role:"evidence"}],()=>true));
});

test("new client documents may be scoped after evidence classification without belonging to a sample",()=>{
  const row={document_id:"new-client-document",page:1},data={documents:[{id:row.document_id,status:"active",sha256:"unseen-source-hash",pages:[1]}],pages:[{documentId:row.document_id,page:1,role:"evidence"}]};
  assert.equal(isCurrentEvidenceJob(row,data,()=>"unknown"),true,"an unknown sample hash is not an unknown current page role");
  assert.equal(isCurrentEvidenceJob(row,data,()=>"filed_form"),false);
  assert.equal(isCurrentEvidenceJob(row,data,()=>"administrative"),false);
  assert.equal(isCurrentEvidenceJob(row,{...data,documents:[{...data.documents[0],status:"deleted"}]},()=>"unknown"),false);
  assert.equal(isCurrentEvidenceJob(row,{...data,pages:[{...data.pages[0],role:"unknown"}]},()=>"unknown"),false);
  assert.equal(isCurrentEvidenceJob({...row,page:2},data,()=>"unknown"),false);
});

test("persisted rescue plans are visible only when their owning job is allowlisted",()=>{
  const rows=[{id:"job-a",documentId:"doc",page:2},{id:"job-b",documentId:"doc",page:3}];
  assert.equal(rescuePlanInScope({documentId:"doc",page:2},rows,["job-a"]),true);
  assert.equal(rescuePlanInScope({documentId:"doc",page:3},rows,["job-a"]),false);
  assert.equal(rescuePlanInScope({documentId:"other",page:2},rows,["job-a"]),false);
});

test("scoped case progress completes independently of unrelated pending jobs and validates new-client evidence",async()=>{
  const code=ts.transpileModule(readFileSync(new URL("../lib/case-response.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const data={context:{revision:1},documents:[{id:"doc",status:"active",sha256:"new-client-source",pages:[1,2]}],pages:[{documentId:"doc",page:1,role:"evidence"},{documentId:"doc",page:2,role:"evidence"}],facts:[],incomes:[],debts:[],assets:[],transactions:[]};
  const rows=[{id:"outside",documentId:"doc",page:1,role:"evidence",status:"pending"},{id:"selected",documentId:"doc",page:2,role:"evidence",status:"completed"}];
  const outsideRescue={documentId:"doc",page:1,planId:"outside-plan"};
  const dependencies:Record<string,unknown>={"./server-store":{getCase:async()=>data,jobs:async()=>rows,persistedRescuePlans:async()=>[outsideRescue]},"./sample-manifest":{samplePageRole:()=>({role:"unknown"})},"./process-job-scope":await import("../lib/process-job-scope.ts")};
  const module={exports:{} as Record<string,any>};
  new Function("require","module","exports",code)((name:string)=>dependencies[name]??{},module,module.exports);
  const progress=await module.exports.caseProgress("case",{stage:"idle",remaining:999,rescue:outsideRescue},["selected"]);
  assert.equal(progress.remaining,0);assert.equal(progress.jobs.total,1);assert.equal(progress.jobs.globalTotal,2);assert.equal(progress.rescue,undefined);
  assert.deepEqual(progress.jobs.byStatus,{completed:1});
  await assert.rejects(module.exports.caseProgress("case",{stage:"status"},["foreign"]),{status:400});
  data.pages[1].role="unknown";
  await assert.rejects(module.exports.caseProgress("case",{stage:"status"},["selected"]),{status:400});
});

test("process route forwards bounded job scopes to next and status, rejecting empty scope before work",async()=>{
  const root=fileURLToPath(new URL("../",import.meta.url));
  const output=ts.transpileModule(readFileSync(root+"app/api/cases/[id]/process/route.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const captured:{next:string[][];status:(string[]|undefined)[]}={next:[],status:[]};
  class HttpError extends Error {status:number;constructor(status:number,message:string){super(message);this.status=status;}}
  const pipeline={processNext:async(_id:string,ids?:string[])=>{if(ids)captured.next.push(ids);return {stage:"idle",remaining:0};},reconcileCase:async()=>({}),retryFailed:async()=>({}),retryPage:async()=>({}),reverifyPage:async()=>({}),reviewLegal:async()=>({})};
  const dependencies:Record<string,any>={
    "../../../../../lib/case-response":{caseProgress:async(_id:string,_result:any,ids?:string[])=>{captured.status.push(ids);return {jobs:{scopeIds:ids??[]}};}},
    "../../../../../lib/classification-inspection":{inspectClassificationJob:async()=>({})},
    "../../../../../lib/json-response":{jsonResponse:(value:any,_request:any,init:any)=>Response.json(value,init)},
    "../../../../../lib/page-job-inspection":{inspectStoredPageJob:async()=>({}),reprojectCasePage:async()=>({})},
    "../../../../../lib/reprojection":{PAGE_PROJECTION_VERSION:"synthetic",ReprojectionError:class extends Error{} ,reprojectStoredPage:()=>({})},
    "../../../../../lib/server-store":{actor:async()=>"synthetic",db:()=>({}),errorResponse:(error:any)=>Response.json({error:error.message},{status:error instanceof HttpError?error.status:500}),event:async()=>{},HttpError,jsonBody:async(request:Request)=>request.json(),now:()=>"2026-10-27",requireSameOrigin:()=>{},saveCase:async()=>{}},
    "../../../../../lib/pipeline":pipeline,
    "../../../../../lib/document-agent-registry":await import("../lib/document-agent-registry.ts"),
    "../../../../../lib/process-job-scope":await import("../lib/process-job-scope.ts"),
  };
  const module={exports:{} as Record<string,any>};
  new Function("require","module","exports",output)((name:string)=>{if(Object.hasOwn(dependencies,name))return dependencies[name];throw new Error(`Unexpected import ${name}`);},module,module.exports);
  const route=module.exports as {GET(request:Request,context:any):Promise<Response>;POST(request:Request,context:any):Promise<Response>};
  const context={params:Promise.resolve({id:"case-a"})};
  const status=await route.GET(new Request("https://synthetic.invalid/process?jobIds=job-a,job-b"),context);
  assert.equal(status.status,200);assert.deepEqual(captured.status[0],["job-a","job-b"]);
  const valid=await route.POST(new Request("https://synthetic.invalid/process",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"next",jobIds:["job-a"]})}),context);
  assert.equal(valid.status,200);assert.deepEqual(captured.next,[ ["job-a"] ]);
  const invalid=await route.POST(new Request("https://synthetic.invalid/process",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"next",jobIds:[]})}),context);
  assert.equal(invalid.status,400);assert.equal(captured.next.length,1);
});
