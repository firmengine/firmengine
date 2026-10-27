import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import ts from "typescript";
import * as documentRouting from "../lib/document-routing.ts";

const root=fileURLToPath(new URL("../",import.meta.url));
class TestHttpError extends Error {status:number;constructor(status:number,message:string){super(message);this.status=status;}}
const hash=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
function fixture(options:{staleSource?:boolean}={}){
  const caseId="case-synthetic",documentId="doc-synthetic",page=1,sourceHash="a".repeat(64),bytes=new TextEncoder().encode("synthetic page bytes"),imageHash=hash(bytes),imageKey=`cases/${caseId}/documents/${documentId}/pages/${page}/${imageHash}`;
  const read={documentType:"debt_certificate",records:[{category:"debt",label:"hint",fields:[{key:"creditor",label:"creditor",value:"Synthetic Bank",unit:null,quote:"creditor Synthetic Bank",confidence:"clear",bbox:null}]}],warnings:[],complete:true};
  const checks=[{recordIndex:0,fieldIndex:0,status:"agrees",value:"Synthetic Bank",unit:null,quote:"creditor Synthetic Bank",reason:"match"}];
  const job:any={id:`${documentId}:${page}`,case_id:caseId,document_id:documentId,page,role:"evidence",document_type:"debt_certificate",image_key:imageKey,image_hash:imageHash,stage:"verify",attempts:1,result:JSON.stringify({read,firstRead:read,extractionRead:read}),cache_key:"synthetic-cache",ready:1,status:"pending",lease_until:null,error:null};
  const caseData:any={context:{id:caseId,revision:1},documents:[{id:documentId,sha256:sourceHash,name:"synthetic.pdf",status:"active",pages:[page]}],pages:[{documentId,page,role:"evidence"}],facts:[],incomes:[],debts:[],assets:[],transactions:[],household:{}};
  let apiKeyConfigured=true,lunaCalls=0,verifierCalls=0,saveCalls=0,imageBytes=bytes,omitted=false,forceTargets=false;const events:any[]=[];
  const db={prepare(sql:string){return {bind(...params:any[]){return {
    async first(){if(sql.includes("SELECT p.*"))return job.status==="pending"||job.status==="processing"&&job.lease_until<params[1]?{...job}:null;if(sql.includes("SELECT id FROM page_jobs"))return job.status==="processing"&&job.lease_until===params[1]?{id:job.id}:null;if(sql.includes("COUNT(*) AS n"))return {n:job.status==="pending"||job.status==="processing"?1:0};return null;},
    async run(){if(sql.includes("SET status = 'processing'")){job.status="processing";job.lease_until=params[0];return {meta:{changes:1}};}if(sql.includes("SET status = 'pending',stage = 'commit'")&&sql.includes("result = ?")){job.status="pending";job.stage="commit";job.result=params[0];if(sql.includes("cache_key = ?"))job.cache_key=params[1];job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET status = 'pending',stage = 'commit'")){job.status="pending";job.stage="commit";job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET status = 'pending',stage = 'extract'")){job.status="pending";job.stage="extract";job.result=params[0];job.cache_key=null;job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET status = 'pending',stage = 'verify'")){job.status="pending";job.stage="verify";job.result=params[0];job.cache_key=params[1];job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET stage = 'commit'")){job.stage="commit";job.result=params[0];job.cache_key=params[1];return {meta:{changes:1}};}if(sql.includes("SET status = ?,stage = 'completed'")){job.status=params[0];job.stage="completed";job.result=params[1];job.cache_key=params[2];job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET status = 'error'")){job.status="error";job.lease_until=null;return {meta:{changes:1}};}return {meta:{changes:1}};},
  };}};}};
  const modules:Record<string,any>={
    "./document-routing":documentRouting,
    "./domain":{AI_MODEL:"gpt-6-luna",applyExtraction:(c:any)=>c,currentFacts:()=>[],extractionCacheKey:()=>"synthetic-cache",touchCase:(c:any)=>c,validSourceRef:()=>true},
    "./luna":{callLuna:async({agent}:any)=>{lunaCalls++;if(agent==="evidence_extractor")return {value:{...read,records:[{...read.records[0],fields:[{...read.records[0].fields[0],value:"New synthetic reading"}]}]},usage:{inputTokens:1,outputTokens:1}};verifierCalls++;if(verifierCalls>1)throw new Error("commit retry must not invoke a second verifier");return {value:{checks,omittedRows:omitted,warnings:[]},usage:{inputTokens:1,outputTokens:1}};},imageContent:(content:any)=>content},
    "./extraction":{applyFirstVerification:(r:any)=>({read:r,targets:forceTargets?[{recordIndex:0,fieldIndex:0,status:"ambiguous",value:null,unit:null,quote:null,reason:"synthetic",missingFirstCheck:true}]:[]}),applyTargetedRepair:()=>({}),CLASSIFY_SCHEMA:{},DOC_FIELDS:{debt_certificate:""},EXTRACT_INSTRUCTIONS:"",PAGE_COMPLETENESS_INSTRUCTIONS:"",getRepairTargets:()=>[],PAGE_SCHEMA:{},PROMPT_VERSION:"luna-evidence-3.3.0",preserveAgreedFieldsAfterOmission:()=>read,projectPage:()=>({facts:[],pages:[]}),validatePageRead:(x:any)=>x,VERIFY_SCHEMA:{}},
    "./server-store":{bucket:()=>({get:async()=>({arrayBuffer:async()=>imageBytes.buffer.slice(imageBytes.byteOffset,imageBytes.byteOffset+imageBytes.byteLength),httpMetadata:{contentType:"image/jpeg"}})}),connection:()=>({apiKeyConfigured}),db:()=>db,event:async(_id:string,type:string,payload:any)=>{events.push({type,payload});},getCase:async()=>structuredClone(options.staleSource?{...caseData,documents:[{...caseData.documents[0],sha256:"b".repeat(64)}]}:caseData),HttpError:TestHttpError,now:()=>"2026-10-27T00:00:00.000Z",saveCase:async()=>{saveCalls++;if(saveCalls<=3)throw new TestHttpError(409,"revision conflict");}},
    "./legal-rules":{CURRENT_RULESET:{id:"synthetic-rules"},LEGAL_CATALOG:[],RISK_CATALOG:[]},"./assessment":{assessCase:()=>({findings:[]})},"./workflow-rules":{WORKFLOW_RULES:[],LEGACY_DOCUMENT_TYPES:[]},"./transaction-review":{scanTransactions:()=>[]},"./income-resolution":{resolveIncomeRows:()=>({rows:[],issues:[],duplicates:[]})},"./sample-manifest":{samplePageRole:()=>({role:"evidence"})},"./retry-page-policy":{canRetryEvidencePage:()=>true},"./reprojection":{PAGE_PROJECTION_VERSION:"synthetic-projection-v1"},"./legal-exceptions.json":{default:{scenarios:[]}},"./source-verification":{createPreservedOmissionReceipts:()=>[],createSourceVerificationReceipts:()=>[],sourceVerificationFieldLocation:()=>null,sourceVerificationReceiptMatches:()=>true},
  };
  const code=readFileSync(root+"lib/pipeline.ts","utf8"),output=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,module={exports:{} as Record<string,any>};
  new Function("require","module","exports",output)((name:string)=>{if(Object.hasOwn(modules,name))return modules[name];throw new Error(`Unexpected dependency ${name}`);},module,module.exports);
  return {processNext:module.exports.processNext,job,caseData,setApiKey:(v:boolean)=>{apiKeyConfigured=v;},setImageBytes:(v:Uint8Array<ArrayBuffer>)=>{imageBytes=v;},setOmitted:(v:boolean)=>{omitted=v;},setForceTargets:(v:boolean)=>{forceTargets=v;},get lunaCalls(){return lunaCalls;},get saveCalls(){return saveCalls;},events,sourceHash};
}

test("검증 후 CAS 충돌은 읽기·검증 checkpoint를 보존하고 다음 요청은 Luna 없이 완료한다",async()=>{
  const f=fixture();
  const ready=await f.processNext("case-synthetic");assert.equal(ready.stage,"commit_ready");
  assert.equal(f.lunaCalls,1);assert.equal(f.job.status,"pending");assert.equal(f.job.stage,"commit");assert.equal(f.saveCalls,0);
  const saved=JSON.parse(f.job.result);assert.equal(saved.commit.sourceHash,f.sourceHash);assert.equal(saved.commit.projectionVersion,"synthetic-projection-v1");assert.equal(saved.commit.review.checks.length,1);assert.equal(saved.commit.verifierPasses.length,1);
  f.setApiKey(false);
  const retry=await f.processNext("case-synthetic");assert.equal(retry.stage,"commit_retry");assert.equal(retry.commitRetryCount,1);
  assert.equal(f.lunaCalls,1);assert.equal(f.job.status,"pending");assert.equal(f.job.stage,"commit");
  assert.ok(f.events.some(e=>e.type==="page.commit_retry"&&e.payload.commitRetryCount===1));
  const result=await f.processNext("case-synthetic");
  assert.equal(f.lunaCalls,1);assert.equal(result.stage,"verified");assert.equal(f.job.status,"completed");
});

test("checkpoint 이후 저장된 페이지 이미지 bytes가 바뀌면 commit을 거부한다",async()=>{
  const f=fixture();f.job.stage="commit";f.job.status="pending";
  const saved=JSON.parse(f.job.result||"{}");saved.commit={read:{documentType:"debt_certificate",records:[],warnings:[],complete:true},review:{checks:[],omittedRows:false,warnings:[]},disagreements:0,verifierPasses:[],sourceHash:f.sourceHash,imageKey:f.job.image_key,imageHash:f.job.image_hash,cacheKey:"synthetic-cache",projectionVersion:"synthetic-projection-v1",documentId:f.job.document_id,page:f.job.page,role:f.job.role};f.job.result=JSON.stringify(saved);
  f.setImageBytes(new TextEncoder().encode("changed synthetic page bytes"));f.setApiKey(false);
  await assert.rejects(f.processNext("case-synthetic"),{status:409});assert.equal(f.lunaCalls,0);assert.equal(f.job.status,"error");
});

test("source hash가 변경된 commit checkpoint는 모델 호출 없이 거부한다",async()=>{
  const f=fixture({staleSource:true});f.job.stage="commit";f.job.status="pending";
  const saved=JSON.parse(f.job.result||"{}");
  saved.commit={read:{documentType:"debt_certificate",records:[],warnings:[],complete:true},review:{checks:[],omittedRows:false,warnings:[]},disagreements:0,verifierPasses:[],sourceHash:f.sourceHash,imageKey:f.job.image_key,imageHash:f.job.image_hash,cacheKey:"synthetic-cache",projectionVersion:"synthetic-projection-v1",documentId:f.job.document_id,page:f.job.page,role:f.job.role};f.job.result=JSON.stringify(saved);
  f.setApiKey(false);
  await assert.rejects(f.processNext("case-synthetic"),{status:409});assert.equal(f.lunaCalls,0);assert.equal(f.job.status,"error");
});

test("구버전 verify read는 superseded로 분리한 뒤 현재 prompt로 다시 추출한다",async()=>{
  const f=fixture();f.job.cache_key="legacy-3.2-cache";
  const oldRead=JSON.parse(f.job.result).read;
  const queued=await f.processNext("case-synthetic");assert.equal(queued.stage,"legacy_read_superseded");assert.equal(f.lunaCalls,0);assert.equal(f.job.stage,"extract");
  const extracted=await f.processNext("case-synthetic");assert.equal(extracted.stage,"extracted");assert.equal(f.lunaCalls,1);assert.equal(f.job.stage,"verify");
  const saved=JSON.parse(f.job.result);assert.equal(saved.supersededRead.records[0].fields[0].value,oldRead.records[0].fields[0].value);assert.equal(saved.read.records[0].fields[0].value,"New synthetic reading");assert.equal(saved.extractionRead.records[0].fields[0].value,"New synthetic reading");
  assert.ok(f.events.some(e=>e.type==="page.read_superseded"));
});

test("누락행 재추출 분기에도 superseded provenance를 보존한다",async()=>{
  const f=fixture();f.job.cache_key="legacy-3.2-cache";
  await f.processNext("case-synthetic");await f.processNext("case-synthetic");
  f.setOmitted(true);const result=await f.processNext("case-synthetic");
  assert.equal(result.stage,"retry_missing_rows");const saved=JSON.parse(f.job.result);
  assert.equal(saved.supersededCacheKey,"legacy-3.2-cache");assert.equal(saved.supersededRead.records[0].fields[0].value,"Synthetic Bank");
});

test("targeted repair 분기에도 superseded provenance를 보존한다",async()=>{
  const f=fixture();f.job.cache_key="legacy-3.2-cache";
  await f.processNext("case-synthetic");await f.processNext("case-synthetic");
  f.setForceTargets(true);const result=await f.processNext("case-synthetic");
  assert.equal(result.stage,"targeted_retry");const saved=JSON.parse(f.job.result);
  assert.equal(saved.supersededCacheKey,"legacy-3.2-cache");assert.equal(saved.supersededRead.records[0].fields[0].value,"Synthetic Bank");
});
