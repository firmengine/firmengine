import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import ts from "typescript";
import * as documentRouting from "../lib/document-routing.ts";

const root=fileURLToPath(new URL("../",import.meta.url));
const pipelineOutput=ts.transpileModule(readFileSync(root+"lib/pipeline.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
class TestHttpError extends Error {status:number;constructor(status:number,message:string){super(message);this.status=status;}}
const hash=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
function fixture(options:{staleSource?:boolean;initialStage?:string;timeoutExtractor?:boolean}={}){
  const caseId="case-synthetic",documentId="doc-synthetic",page=1,sourceHash="a".repeat(64),bytes=new TextEncoder().encode("synthetic page bytes"),imageHash=hash(bytes),imageKey=`cases/${caseId}/documents/${documentId}/pages/${page}/${imageHash}`;
  const read={documentType:"debt_certificate",records:[{category:"debt",label:"hint",fields:[{key:"creditor",label:"creditor",value:"Synthetic Bank",unit:null,quote:"creditor Synthetic Bank",confidence:"clear",bbox:null}]}],warnings:[],complete:true};
  const checks=[{recordIndex:0,fieldIndex:0,status:"agrees",value:"Synthetic Bank",unit:null,quote:"creditor Synthetic Bank",reason:"match"}];
  const job:any={id:`${documentId}:${page}`,case_id:caseId,document_id:documentId,page,role:"evidence",document_type:"debt_certificate",image_key:imageKey,image_hash:imageHash,stage:options.initialStage??"verify",attempts:1,result:JSON.stringify({read,firstRead:read,extractionRead:read}),cache_key:options.initialStage==="waiting"?null:"synthetic-cache",ready:1,status:"pending",lease_until:null,error:null};
  const caseData:any={context:{id:caseId,revision:1},documents:[{id:documentId,sha256:sourceHash,name:"synthetic.pdf",status:"active",pages:[page]}],pages:[{documentId,page,role:"evidence"}],facts:[],incomes:[],debts:[],assets:[],transactions:[],household:{}};
  let apiKeyConfigured=true,lunaCalls=0,verifierCalls=0,saveCalls=0,imageBytes=bytes,omitted=false,forceTargets=false,timeoutExtractor=!!options.timeoutExtractor,allowRepeatedVerifier=false,allowRegionalReceipts=false,extractionValue="New synthetic reading",checkStatus="agrees";const events:any[]=[],derivativeRows:any[]=[];
  const db={prepare(sql:string){return {bind(...params:any[]){return {
    async first(){if(sql.includes("SELECT p.*"))return job.status==="pending"||job.status==="processing"&&job.lease_until<params[1]?{...job}:null;if(sql.includes("SELECT id FROM page_jobs"))return job.status==="processing"&&job.lease_until===params[1]?{id:job.id}:null;if(sql.includes("COUNT(*) AS n"))return {n:job.status==="pending"||job.status==="processing"?1:0};return null;},
    async all(){return {results:sql.includes("page_derivatives")?derivativeRows:[]};},
    async run(){if(sql.includes("SET status = 'processing'")){job.status="processing";job.lease_until=params[0];return {meta:{changes:1}};}if(sql.includes("SET status = 'pending',stage = 'commit'")&&sql.includes("result = ?")){job.status="pending";job.stage="commit";job.result=params[0];if(sql.includes("cache_key = ?"))job.cache_key=params[1];job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET status = 'pending',stage = 'commit'")){job.status="pending";job.stage="commit";job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET status = 'pending',stage = 'extract'")){job.status="pending";job.stage="extract";job.result=params[0];job.cache_key=null;job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET status = 'pending',stage = 'region_verify'")){job.status="pending";job.stage="region_verify";job.result=params[0];job.cache_key=params[1];job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET status = 'pending',stage = 'region_extract'")){job.status="pending";job.stage="region_extract";job.result=params[0];job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET status = 'pending',stage = 'verify'")){job.status="pending";job.stage="verify";job.result=params[0];if(sql.includes("cache_key = ?"))job.cache_key=params[1];job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET stage = 'commit'")){job.stage="commit";job.result=params[0];job.cache_key=params[1];return {meta:{changes:1}};}if(sql.includes("SET status = ?,stage = 'completed'")){job.status=params[0];job.stage="completed";job.result=params[1];job.cache_key=params[2];job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET status = 'error'")){job.status="error";job.lease_until=null;return {meta:{changes:1}};}return {meta:{changes:1}};},
  };}};}};
  const modules:Record<string,any>={
    "./document-routing":documentRouting,
    "./domain":{AI_MODEL:"gpt-6-luna",applyExtraction:(c:any)=>c,currentFacts:()=>[],extractionCacheKey:()=>"synthetic-cache",touchCase:(c:any)=>c,validSourceRef:()=>true},
    "./luna":{callLuna:async({agent}:any)=>{lunaCalls++;if(agent==="evidence_extractor"){if(timeoutExtractor)throw new DOMException("synthetic timeout","TimeoutError");return {value:{...read,records:[{...read.records[0],fields:[{...read.records[0].fields[0],value:extractionValue,bbox:extractionValue==="Synthetic Bank"?[0,0,1,1]:null}]}]},usage:{inputTokens:1,outputTokens:1}};}verifierCalls++;if(verifierCalls>1&&!allowRepeatedVerifier)throw new Error("commit retry must not invoke a second verifier");return {value:{checks:checks.map(check=>({...check,status:checkStatus})),omittedRows:omitted,warnings:[]},usage:{inputTokens:1,outputTokens:1}};},imageContent:(content:any)=>content},
    "./extraction":{applyFirstVerification:(r:any,c:any)=>{const next=structuredClone(r);next.records.forEach((record:any,ri:number)=>record.fields.forEach((field:any,fi:number)=>{const found=c?.filter((x:any)=>x.recordIndex===ri&&x.fieldIndex===fi)??[];field.confidence=found.length===1&&found[0].status==="agrees"&&found[0].value===field.value&&found[0].unit===field.unit?"clear":"uncertain";}));return {read:next,targets:forceTargets?[{recordIndex:0,fieldIndex:0,status:"ambiguous",value:null,unit:null,quote:null,reason:"synthetic",missingFirstCheck:true}]:[]};},applyTargetedRepair:()=>({}),CLASSIFY_SCHEMA:{},DOC_FIELDS:{debt_certificate:""},EXTRACT_INSTRUCTIONS:"",PAGE_COMPLETENESS_INSTRUCTIONS:"",getRepairTargets:()=>[],PAGE_SCHEMA:{},PROMPT_VERSION:"luna-evidence-3.3.0",preserveAgreedFieldsAfterOmission:()=>read,projectPage:()=>({facts:[],pages:[]}),validatePageRead:(x:any)=>x,VERIFY_SCHEMA:{}},
    "./server-store":{bucket:()=>({get:async()=>({arrayBuffer:async()=>imageBytes.buffer.slice(imageBytes.byteOffset,imageBytes.byteOffset+imageBytes.byteLength),httpMetadata:{contentType:"image/jpeg"}})}),connection:()=>({apiKeyConfigured}),db:()=>db,event:async(_id:string,type:string,payload:any)=>{events.push({type,payload});},getCase:async()=>structuredClone(options.staleSource?{...caseData,documents:[{...caseData.documents[0],sha256:"b".repeat(64)}]}:caseData),HttpError:TestHttpError,now:()=>"2026-10-27T00:00:00.000Z",saveCase:async()=>{saveCalls++;if(saveCalls<=3)throw new TestHttpError(409,"revision conflict");}},
    "./legal-rules":{CURRENT_RULESET:{id:"synthetic-rules"},LEGAL_CATALOG:[],RISK_CATALOG:[]},"./assessment":{assessCase:()=>({findings:[]})},"./workflow-rules":{WORKFLOW_RULES:[],LEGACY_DOCUMENT_TYPES:[]},"./transaction-review":{scanTransactions:()=>[]},"./income-resolution":{resolveIncomeRows:()=>({rows:[],issues:[],duplicates:[]})},"./sample-manifest":{samplePageRole:()=>({role:"evidence"})},"./retry-page-policy":{canRetryEvidencePage:()=>true},"./reprojection":{PAGE_PROJECTION_VERSION:"synthetic-projection-v1"},"./legal-exceptions.json":{default:{scenarios:[]}},"./source-verification":{createPreservedOmissionReceipts:()=>[],createSourceVerificationReceipts:(input:any)=>{if(!allowRegionalReceipts||input.passes.length!==1)return [];const pass=input.passes[0],out:any[]=[];input.read.records.forEach((record:any,ri:number)=>record.fields.forEach((field:any,fi:number)=>{const proof=pass.checks.find((check:any)=>check.recordIndex===ri&&check.fieldIndex===fi&&check.status==="agrees"&&check.value===field.value&&check.unit===field.unit&&check.quote);if(proof&&field.confidence==="clear")out.push({field:{recordCategory:record.category,key:field.key,value:field.value,unit:field.unit,quote:field.quote},fieldFingerprint:`${ri}:${fi}:${pass.promptHash}`,proofReadIndexes:[{pass:pass.kind,recordIndex:ri,fieldIndex:fi}],source:{documentId:"doc-synthetic",page:1,sha256:"a".repeat(64)},verifiedAt:pass.verifiedAt,promptVersion:pass.promptVersion,extractionReading:{value:field.value,unit:field.unit,quote:field.quote},verificationQuotes:[proof.quote]});}));return out;},sourceVerificationFieldLocation:(receipt:any)=>({recordIndex:receipt.proofReadIndexes[0].recordIndex,fieldIndex:receipt.proofReadIndexes[0].fieldIndex}),sourceVerificationReceiptMatches:()=>true},
  };
  const module={exports:{} as Record<string,any>};
  new Function("require","module","exports",pipelineOutput)((name:string)=>{if(Object.hasOwn(modules,name))return modules[name];throw new Error(`Unexpected dependency ${name}`);},module,module.exports);
  return {processNext:module.exports.processNext,mergeRegionalResults:module.exports.mergeRegionalResults,job,caseData,setApiKey:(v:boolean)=>{apiKeyConfigured=v;},setImageBytes:(v:Uint8Array<ArrayBuffer>)=>{imageBytes=v;},setOmitted:(v:boolean)=>{omitted=v;},setForceTargets:(v:boolean)=>{forceTargets=v;},setTimeoutExtractor:(v:boolean)=>{timeoutExtractor=v;},allowRepeatedVerifier:()=>{allowRepeatedVerifier=true;},allowRegionalReceipts:()=>{allowRegionalReceipts=true;},setExtractionValue:(v:string)=>{extractionValue=v;},setCheckStatus:(v:string)=>{checkStatus=v;},setDerivatives:(planId:string)=>{derivativeRows.splice(0,derivativeRows.length,...[1,2,3,4].map(i=>({variant_hash:hash(bytes),variant:`rescue-incomplete_extraction-${i}`,object_key:`variant-${i}`,bbox:JSON.stringify([0,(i-1)*.25,1,Math.min(1,i*.25+.025)]),transform:"{}"})));},get lunaCalls(){return lunaCalls;},get saveCalls(){return saveCalls;},events,sourceHash};
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

test("waiting extraction timeout persists an identified rescue plan and resumes it without another model call",async()=>{
  const f=fixture({initialStage:"waiting",timeoutExtractor:true});
  const timedOut=await f.processNext("case-synthetic");
  assert.equal(timedOut.stage,"incomplete_read_rescue");assert.equal(timedOut.rescue.reason,"incomplete_extraction");
  const persisted=JSON.parse(f.job.result);assert.ok(persisted.rescuePlan.planId);assert.equal(persisted.rescuePlan.sourceHash,f.sourceHash);assert.equal(persisted.rescuePlan.baseImageHash,f.job.image_hash);
  const resumed=await f.processNext("case-synthetic");assert.equal(resumed.stage,"rescue_resume");assert.equal(resumed.rescue.planId,persisted.rescuePlan.planId);assert.equal(f.lunaCalls,1);
});

test("incomplete extraction reads and independently verifies one bounded region per persisted stage",async()=>{
  const f=fixture({initialStage:"waiting",timeoutExtractor:true});f.allowRepeatedVerifier();
  const timedOut=await f.processNext("case-synthetic");const planId=timedOut.rescue.planId;f.setDerivatives(planId);f.setTimeoutExtractor(false);
  const extractorStages=await f.processNext("case-synthetic");assert.equal(extractorStages.stage,"region_extracted");assert.equal(f.job.stage,"region_verify");
  for(let region=0;region<4;region++){
    const verified=await f.processNext("case-synthetic");
    if(region<3){assert.equal(verified.stage,"region_verified");assert.equal(f.job.stage,"region_extract");const extracted=await f.processNext("case-synthetic");assert.equal(extracted.stage,"region_extracted");assert.equal(f.job.stage,"region_verify");}
    else {assert.equal(verified.stage,"regions_complete");assert.equal(f.job.stage,"verify");}
  }
  const beforeFinal=f.lunaCalls,final=await f.processNext("case-synthetic");assert.equal(final.stage,"commit_ready");assert.equal(f.lunaCalls,beforeFinal);assert.equal(JSON.parse(f.job.result).verifierPasses.length,4);assert.equal(JSON.parse(f.job.result).extractionPasses.length,4);
});

test("regional receipts preserve each single-call proof and corrections stay uncertain",async()=>{
  async function finish(f:ReturnType<typeof fixture>){const timeout=await f.processNext("case-synthetic");f.setDerivatives(timeout.rescue.planId);f.setTimeoutExtractor(false);await f.processNext("case-synthetic");for(let i=0;i<4;i++){const verified=await f.processNext("case-synthetic");if(i<3)await f.processNext("case-synthetic");else assert.equal(verified.stage,"regions_complete");}await f.processNext("case-synthetic");return JSON.parse(f.job.result);}
  const agrees=fixture({initialStage:"waiting",timeoutExtractor:true});agrees.allowRepeatedVerifier();agrees.allowRegionalReceipts();agrees.setExtractionValue("Synthetic Bank");
  const agreedResult=await finish(agrees);assert.equal(agreedResult.regionResults.length,4);assert.ok(agreedResult.regionResults.every((region:any)=>region.pass.checks.length===1&&region.receipts.length===1));assert.ok(agreedResult.regionResults.every((region:any)=>region.receipts[0].proofReadIndexes[0].recordIndex===0&&region.receipts[0].proofReadIndexes[0].fieldIndex===0));assert.equal(agreedResult.read.records.length,1);assert.equal(agreedResult.commit.read.records[0].fields[0].confidence,"clear");assert.equal(agreedResult.commit.review.checks.length,1);
  const corrected=fixture({initialStage:"waiting",timeoutExtractor:true});corrected.allowRepeatedVerifier();corrected.allowRegionalReceipts();corrected.setExtractionValue("Synthetic Bank");corrected.setCheckStatus("corrected");
  const correctedResult=await finish(corrected);assert.ok(correctedResult.regionResults.every((region:any)=>region.receipts.length===0));assert.equal(correctedResult.commit.read.records[0].fields[0].confidence,"uncertain");
});

test("regional merge uses explicit document-family consensus and only collapses overlapping exact rows",()=>{
  const f=fixture(),region=(documentType:string,value:string,bbox:[number,number,number,number])=>{const checks=[{recordIndex:0,fieldIndex:0,status:"agrees",value,unit:null,quote:"same visible row",reason:"match"}];return {read:{documentType,records:[{category:"debt",label:"creditor row",fields:[{key:"creditor",label:"creditor",value,unit:null,quote:"same visible row",confidence:"clear",bbox:[0,0,1,1]}]}],warnings:[],complete:true},review:{checks,omittedRows:false,warnings:[]},pass:{kind:"verify",checks,model:"gpt-6-luna",promptVersion:"synthetic",promptHash:"f".repeat(64),verifiedAt:"2026-10-27T00:00:00.000Z"},bbox};};
  const topTitle=f.mergeRegionalResults([region("debt_certificate","Same",[0,0,1,.4]),region("unknown","Same",[0,.3,1,.6]),region("unknown","Same",[0,.7,1,.9]),region("unknown","Different",[0,.3,1,.6])]);
  assert.equal(topTitle.read.documentType,"debt_certificate");assert.equal(topTitle.read.records.length,3);assert.equal(topTitle.review.checks.length,3);assert.equal(topTitle.passes.length,4);
  const conflict=f.mergeRegionalResults([region("health_insurance_arrears","same",[0,0,1,.4]),region("debt_certificate","same",[0,.3,1,.6]),region("unknown","same",[0,.7,1,.9]),region("unknown","same",[0,.8,1,1])]);
  assert.equal(conflict.read.documentType,"unknown");assert.equal(conflict.read.complete,false);assert.ok(conflict.read.warnings.some((warning:string)=>warning.includes("상충")));
  const uncatalogued=f.mergeRegionalResults([region("salary_statement","same",[0,0,1,.4]),region("salary_statement","same",[0,.3,1,.6]),region("unknown","same",[0,.6,1,.8]),region("unknown","same",[0,.8,1,1])]);assert.equal(uncatalogued.read.documentType,"salary_statement");assert.equal(uncatalogued.read.complete,true);
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
