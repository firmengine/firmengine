/** A4 round 90, synthetic source-level negative-control. No Cloudflare D1/R2, HTTP, n8n, law or human approval. */
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";

async function reproduce(routeSource) {
  const code = routeSource
    .replace(/^import .*;\s*$/gm, "")
    .replace("export async function POST(request:Request,{params}:{params:Promise<{id:string}>})",
             "async function POST(request,{params})");
  if (!code.includes("async function POST(request,{params})"))
    throw Error("A4_R90_ROUTE_SIGNATURE_CHANGED");
  const clone = value => JSON.parse(JSON.stringify(value));
  const s = {
    caseData: {context:{id:"SYNTH-CASE",revision:0},documents:[],pages:[]},
    docs:new Map(),jobs:new Map(),events:[],deleted:[],uuids:0,claims:[]
  };
  const db = () => ({
    prepare(sql) {
      let args = [];
      const stmt = {
        sql,
        bind(...a) { args=a; return stmt; },
        async run() {
          let changes=0;
          if (sql.startsWith("INSERT INTO documents")) {
            const [id,caseId,name,sha256,pageCount]=args;
            s.docs.set(id,{id,caseId,name,sha256,pageCount,ready:0}); changes=1;
          } else if (sql.startsWith("INSERT INTO page_jobs")) {
            const [jid,caseId,documentId,page]=args;
            s.jobs.set(jid,{caseId,documentId,page});changes=1;
          } else if (sql.startsWith("DELETE FROM page_jobs")) {
            const [documentId,caseId]=args;
            for(const [jid,j] of s.jobs) if(j.documentId===documentId&&j.caseId===caseId){s.jobs.delete(jid);changes++;}
            s.deleted.push("jobs:"+documentId);
          } else if (sql.startsWith("DELETE FROM documents")) {
            const [id,caseId]=args,d=s.docs.get(id);
            if(d&&d.caseId===caseId&&d.ready===0){s.docs.delete(id);changes=1;}
            s.deleted.push("document:"+id);
          } else throw Error("A4_R90_UNEXPECTED_SQL:"+sql);
          return {meta:{changes}};
        }
      };
      return stmt;
    },
    async batch(stmts) {return Promise.all(stmts.map(x=>x.run()));}
  });
  const deps = {
    db,crypto:{randomUUID:()=> "SYNTH-"+(++s.uuids)},
    SAMPLE_SHA256:"0".repeat(64),
    samplePageRole:(_,page)=>({page,role:"evidence",documentType:null}),
    now:()=> "2026-11-03T06:40:44+09:00",
    Response:{json:(body,options)=>({status:options?.status??200,body})},
    requireSameOrigin:()=>{},
    getCase:async()=>clone(s.caseData),
    jsonBody:async req=>req.data,
    touchCase:c=>{const n=clone(c);n.context.revision++;return n;},
    // Barrier forces TWO requests to read the same initial revision before
    // either CAS completes. A succeeds; B's CAS rejects with HTTP 409.
    saveCase:(n,expected)=>new Promise((resolve,reject)=>{
      s.claims.push({n,expected,resolve,reject});
      if(s.claims.length===2) {
        const [first,second]=s.claims;
        if(first.expected!==s.caseData.context.revision) throw Error("A4_R90_BAD_INITIAL_REVISION");
        s.caseData=clone(first.n);first.resolve({saved:true});
        second.reject(Object.assign(Error("CAS_REJECTED"),{status:409}));
      }
    }),
    event:async(id,type,detail)=>s.events.push({id,type,detail}),
    errorResponse:e=>({status:e.status??500,body:{error:e.message}}),
    HttpError:class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
  };
  const POST=new Function("deps", "with(deps){"+code+"\nreturn POST;}")(deps);
  const make=()=>({data:{sha256:"b".repeat(64),pageCount:2,name:"synthetic.pdf"}});
  const send=()=>POST(make(),{params:Promise.resolve({id:"SYNTH-CASE"})});
  const responsePair=await Promise.all([send(),send()]);
  const retry=await send();
  const activeIds=s.caseData.documents.map(x=>x.id);
  return {
    responseStatuses:responsePair.map(x=>x.status),
    retryStatus:retry.status,retryIdempotent:retry.body.idempotent===true,
    activeDocuments:activeIds.length,sqlDocuments:s.docs.size,
    ocrJobs:s.jobs.size,auditEvents:s.events.length,
    orphanDocuments:[...s.docs.keys()].filter(x=>!activeIds.includes(x)),
    deleted:s.deleted
  };
}
function verify(result,expectOrphan){
  const fail=(name,expected,actual)=>{if(JSON.stringify(expected)!==JSON.stringify(actual))throw Error(name+" expected="+JSON.stringify(expected)+" actual="+JSON.stringify(actual));};
  fail("responses",[201,409],result.responseStatuses);
  fail("retry-status",200,result.retryStatus);
  fail("retry-idempotent",true,result.retryIdempotent);
  fail("active-documents",1,result.activeDocuments);
  fail("sql-documents",expectOrphan?2:1,result.sqlDocuments);
  fail("ocr-jobs",expectOrphan?4:2,result.ocrJobs);
  fail("events",1,result.auditEvents);
  fail("orphan-count",expectOrphan?1:0,result.orphanDocuments.length);
  return {checks:8,allMatched:true};
}

const defaultPath=resolve(dirname(fileURLToPath(import.meta.url)),"../../../app/api/cases/[id]/documents/route.ts");
const routeSource=readFileSync(process.env.A4_R90_ROUTE_PATH??defaultPath,"utf8");
const result=await reproduce(routeSource);
const expectation=process.env.A4_R90_EXPECT_ORPHAN==="1";
const verdict=verify(result,expectation);
process.stdout.write(JSON.stringify({scenario:"A4_R90_TWO_WORKERS_SAME_SHA_CAS",expectation:expectation?"candidate_orphan":"main_cleanup",...result,...verdict},null,2)+"\n");
