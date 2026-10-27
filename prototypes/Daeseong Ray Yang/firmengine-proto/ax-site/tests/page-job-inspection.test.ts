import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source=readFileSync(new URL("../lib/page-job-inspection.ts",import.meta.url),"utf8");
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;

function load(saved:any){
  const job={id:"job-1",caseId:"case-1",documentId:"doc-1",page:2,role:"evidence",status:"completed",stage:"completed",leaseUntil:null,imageKey:"image-key",imageHash:"b".repeat(64),cacheKey:"historical-cache",result:JSON.stringify(saved)};
  const row={...job,case_id:"case-1",image_key:job.imageKey,image_hash:job.imageHash,cache_key:job.cacheKey,lease_until:job.leaseUntil,document_sha256:"a".repeat(64),ready:1,original_key:"cases/case-1/documents/doc-1/original/source.pdf",active_processing_jobs:0};
  const data={context:{id:"case-1"},documents:[{id:"doc-1",status:"active",sha256:"a".repeat(64)}]};
  const modules:Record<string,unknown>={
    "./domain":{},"./reprojection":{prepareStoredReadReprojection:()=>({provenance:{documentId:"doc-1",documentSha256:"a".repeat(64),page:2,mappingVersion:"income",promptVersion:"historical-prompt",model:"gpt-6-luna",ruleReleaseId:"rules",verificationPasses:0,storedReceiptCount:0}}),hasCurrentProjection:()=>false},
    "./server-store":{db:()=>({prepare:()=>({bind:()=>({first:async()=>row})})}),bucket:()=>({get:async()=>({arrayBuffer:async()=>new ArrayBuffer(1)})}),getCase:async()=>data,HttpError:class extends Error{},sha256:async()=>"a".repeat(64)},
  };
  const mod={exports:{} as Record<string,any>};new Function("require","module","exports",output)((name:string)=>modules[name],mod,mod.exports);return mod.exports.inspectStoredPageJob("case-1","job-1");
}

test("stored page inspection exposes exact extraction passes and a conservative bound-provenance summary",async()=>{
  const pass={model:"gpt-6-luna",promptVersion:"legacy-extract-1",promptHash:"c".repeat(64),sourceHash:"a".repeat(64),baseImageHash:"b".repeat(64),verifiedAt:"2026-10-26T00:00:00.000Z"};
  const value=await load({read:{documentType:"synthetic",records:[],warnings:[],complete:true},extractionPasses:[pass],reverification:{requestedAt:"2026-10-27T00:00:00.000Z",verificationPromptVersion:"luna-evidence-3.13.0"}});
  assert.equal(value.historicalProvenance.extractionPassCount,1);assert.equal(value.historicalProvenance.hasBoundExtractionProvenance,true);
  assert.deepEqual(value.stored.extractionPasses,[pass]);assert.deepEqual(value.stored.reverification,{requestedAt:"2026-10-27T00:00:00.000Z",verificationPromptVersion:"luna-evidence-3.13.0"});
});

test("missing or source-mismatched extraction metadata is reported as unbound without being invented",async()=>{
  const absent=await load({read:{complete:true},verifierPasses:[]});assert.equal(absent.historicalProvenance.extractionPassCount,0);assert.equal(absent.historicalProvenance.hasBoundExtractionProvenance,false);assert.equal(absent.stored.extractionPasses,undefined);
  const mismatch=await load({extractionPasses:[{model:"gpt-6-luna",promptVersion:"legacy",promptHash:"d".repeat(64),sourceHash:"f".repeat(64),baseImageHash:"b".repeat(64),verifiedAt:"2026-10-26T00:00:00.000Z"}]});assert.equal(mismatch.historicalProvenance.hasBoundExtractionProvenance,false);
});
