import * as legalReviewIdentity from "../lib/legal-review-identity.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import ts from "typescript";
import * as classificationRecovery from "../lib/classification-recovery.ts";
import * as documentRouting from "../lib/document-routing.ts";
import * as applicantIdentity from "../lib/applicant-identity.ts";
import * as pageRefresh from "../lib/page-refresh.ts";
import * as verificationBindings from "../lib/verification-bindings.ts";
import * as scanQuality from "../lib/scan-quality.ts";
import * as processJobScope from "../lib/process-job-scope.ts";
import * as sourceVerificationIdentity from "../lib/source-verification-identity.ts";
import * as documentAgentRegistry from "../lib/document-agent-registry.ts";
import * as coverageReview from "../lib/coverage-review.ts";
import * as regionalSource from "../lib/regional-source.ts";
import * as sourceNatureContext from "../lib/source-nature-context.ts";
import * as referencePrompts from "../lib/reference-prompts.ts";
import { EXECUTION_CONTRACT_VERSION } from "../lib/execution-catalog.ts";
import { EXTRACT_INSTRUCTIONS, SOURCE_BBOX_INSTRUCTIONS } from "../lib/extraction.ts";
import fieldContractData from "../lib/document-agent-field-contracts.json" with { type: "json" };

const root=fileURLToPath(new URL("../",import.meta.url));
const pipelineOutput=ts.transpileModule(readFileSync(root+"lib/pipeline.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
class TestHttpError extends Error {status:number;constructor(status:number,message:string){super(message);this.status=status;}}
const hash=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
function fixture(options:{staleSource?:boolean;initialStage?:string;timeoutExtractor?:boolean;timeoutVerifier?:boolean;classifications?:any[];initialRole?:string;readDocumentType?:string;missingFields?:any[];classification?:any;classificationRecovery?:any}={}){
  const caseId="case-synthetic",documentId="doc-synthetic",page=1,sourceBytes=new TextEncoder().encode("synthetic original PDF bytes"),sourceHash=hash(sourceBytes),bytes=new TextEncoder().encode("synthetic page bytes"),imageHash=hash(bytes),imageKey=`cases/${caseId}/documents/${documentId}/pages/${page}/${imageHash}`;
  const read={documentType:options.readDocumentType??"debt_certificate",records:[{category:"debt",label:"hint",fields:[{key:"creditor",label:"creditor",value:"Synthetic Bank",unit:null,quote:"creditor Synthetic Bank",confidence:"clear",bbox:null}]}],warnings:[],complete:true};
  const checks=[{recordIndex:0,fieldIndex:0,categoryStatus:"supported",meaningStatus:"supported",status:"agrees",value:"Synthetic Bank",unit:null,quote:"creditor Synthetic Bank",reason:"match"}];
  const classificationState={...(options.classification?{classification:options.classification}:{}),...(options.classificationRecovery?{classificationRecovery:{read:options.classificationRecovery,sourceHash,baseImageHash:imageHash,imageHashes:[]}}:{})};
  const job:any={id:`${documentId}:${page}`,case_id:caseId,document_id:documentId,page,role:options.initialRole??"evidence",document_type:options.initialRole==="unknown"?null:"debt_certificate",image_key:imageKey,image_hash:imageHash,original_key:`cases/${caseId}/documents/${documentId}/original/source.pdf`,source_sha256:sourceHash,stage:options.initialStage??"verify",attempts:1,result:JSON.stringify({read,firstRead:read,extractionRead:read,...classificationState}),cache_key:options.initialStage==="waiting"?null:"synthetic-cache",ready:1,status:"pending",lease_until:null,error:null};
  const caseData:any={context:{id:caseId,revision:1},documents:[{id:documentId,sha256:sourceHash,name:"synthetic.pdf",status:"active",pages:[page]}],pages:[{documentId,page,role:options.initialRole??"evidence"}],facts:[],incomes:[],debts:[],assets:[],transactions:[],household:{}};
  let apiKeyConfigured=true,lunaCalls=0,extractorCalls=0,verifierCalls=0,lastVerifierCall:any=null,lastExtractorCall:any=null,saveCalls=0,saveFails=true,savedCase:any=null,imageBytes=bytes,omitted=false,forceTargets=false,timeoutExtractor=!!options.timeoutExtractor,allowRepeatedVerifier=false,allowRegionalReceipts=false,extractionValue="New synthetic reading",checkStatus="agrees";const events:any[]=[],derivativeRows:any[]=[],modelCalls:any[]=[];
  const db={prepare(sql:string){return {bind(...params:any[]){return {
    async first(){if(sql.includes("SELECT p.*"))return job.status==="pending"||job.status==="processing"&&job.lease_until<params[1]?{...job}:null;if(sql.includes("SELECT id FROM page_jobs"))return job.status==="processing"&&job.lease_until===params[1]?{id:job.id}:null;if(sql.includes("COUNT(*) AS n"))return {n:job.status==="pending"||job.status==="processing"?1:0};return null;},
    async all(){return {results:sql.includes("page_derivatives")?derivativeRows:[]};},
    async run(){if(sql.includes("SET role = ?,document_type = ?")){job.role=params[0];job.document_type=params[1];job.status=params[2];job.stage=params[3];job.result=params[4];job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET status = 'review_required',stage = 'classify'")){job.status="review_required";job.stage="classify";job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET status = 'review_required',stage = 'failed'")){job.status="review_required";job.stage="failed";job.error=params[0];if(sql.includes("result = ?"))job.result=params[1];job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET result = ?,updated_at = ?")){job.result=params[0];return {meta:{changes:1}};}if(sql.includes("SET status = 'pending',lease_until = NULL")){job.status="pending";job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET status = 'processing'")){job.status="processing";job.lease_until=params[0];return {meta:{changes:1}};}if(sql.includes("SET status = 'pending',stage = 'repair'")){job.status="pending";job.stage="repair";job.result=params[0];job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET status = 'pending',stage = 'commit'")&&sql.includes("result = ?")){job.status="pending";job.stage="commit";job.result=params[0];if(sql.includes("cache_key = ?"))job.cache_key=params[1];job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET status = 'pending',stage = 'commit'")){job.status="pending";job.stage="commit";job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET status = 'pending',stage = 'extract'")){job.status="pending";job.stage="extract";job.result=params[0];job.cache_key=null;job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET status = 'pending',stage = 'region_verify'")){job.status="pending";job.stage="region_verify";job.result=params[0];job.cache_key=params[1];job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET status = 'pending',stage = 'region_extract'")){job.status="pending";job.stage="region_extract";job.result=params[0];job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET status = 'pending',stage = 'verify'")){job.status="pending";job.stage="verify";job.result=params[0];if(sql.includes("cache_key = ?"))job.cache_key=params[1];job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET stage = 'commit'")){job.stage="commit";job.result=params[0];job.cache_key=params[1];return {meta:{changes:1}};}if(sql.includes("SET status = ?,stage = 'completed'")){job.status=params[0];job.stage="completed";job.result=params[1];job.cache_key=params[2];job.lease_until=null;return {meta:{changes:1}};}if(sql.includes("SET status = 'error'")){job.status="error";job.lease_until=null;return {meta:{changes:1}};}return {meta:{changes:1}};},
  };}};}};
  const modules:Record<string,any>={
    "./reference-prompts.ts":referencePrompts,
    "./case-agent":{runCaseCalculatorNode:()=>{throw new Error("legal review not used by extraction fixture");}},
    "./legal-review-identity.ts":legalReviewIdentity,
    "./calculator-tools":{snapshotSha256:()=>{throw new Error("legal review not used by extraction fixture");}},
    "./case-execution": {buildCaseExecutionPlan:()=>({evidenceRequests:[]}),executeCaseNodes:()=>{throw new Error("Unexpected legal review in page commit test");},agentExecutionContext:()=>{throw new Error("Unexpected legal review packet in page commit test");}},
    "./regional-source":regionalSource,"./coverage-review":coverageReview,"./classification-recovery":classificationRecovery,"./source-nature-context":sourceNatureContext,"./document-routing":documentRouting,"./document-agent-registry":documentAgentRegistry,"./document-agent-field-contracts.json":fieldContractData,"./applicant-identity":applicantIdentity,"./page-refresh":pageRefresh,"./verification-bindings":verificationBindings,"./statement-paragraphs":{sourceStatementText:()=>undefined},
    "./legal-review-packet":{LEGAL_REVIEW_BATCH_SIZE:6,buildLegalReviewPacket:()=>({text:"{}",payload:{},providedFactIds:[],coverage:{}}),gateLegalReviewChecks:()=>[]},"./execution-catalog.ts":{EXECUTION_CONTRACT_VERSION},"./process-job-scope":processJobScope,
    "./domain":{AI_MODEL:"gpt-6-luna",applyExtraction:(c:any)=>c,currentFacts:(c:any)=>c.facts??[],extractionCacheKey:()=>"synthetic-cache",touchCase:(c:any)=>c,validSourceRef:()=>true},
    "./luna":{callLuna:async(args:any)=>{const {agent}=args;lunaCalls++;modelCalls.push(args);if(agent.startsWith("document_classifier")){return {value:options.classifications?.shift()??{role:"unknown",familyId:null,catalogRelease:"catalog-release-v2.2.0",boundaryObservation:"mixed_or_unknown",boundaryQuote:null,confidence:"low",reason:"synthetic ambiguous",titleQuote:null,issuerQuote:null,structureQuote:null},usage:{inputTokens:1,outputTokens:1}};}if(agent==="evidence_extractor"){extractorCalls++;lastExtractorCall=args;if(timeoutExtractor)throw new DOMException("synthetic timeout","TimeoutError");return {value:{...read,records:[{...read.records[0],fields:[{...read.records[0].fields[0],value:extractionValue,bbox:extractionValue==="Synthetic Bank"?[0,0,1,1]:null}]}]},usage:{inputTokens:1,outputTokens:1}};}lastVerifierCall=args;verifierCalls++;if(options.timeoutVerifier)throw new DOMException("synthetic verification timeout","TimeoutError");if(verifierCalls>1&&!allowRepeatedVerifier)throw new Error("commit retry must not invoke a second verifier");return {value:{checks:checks.map(check=>({...check,status:checkStatus})),omittedRows:omitted,missingFields:options.missingFields??[],warnings:[]},usage:{inputTokens:1,outputTokens:1}};},imageContent:(content:any)=>content},
    "./extraction":{applyFirstVerification:(r:any,c:any)=>{const next=structuredClone(r);next.records.forEach((record:any,ri:number)=>record.fields.forEach((field:any,fi:number)=>{const found=c?.filter((x:any)=>x.recordIndex===ri&&x.fieldIndex===fi)??[];field.confidence=found.length===1&&found[0].meaningStatus==="supported"&&found[0].status==="agrees"&&found[0].value===field.value&&found[0].unit===field.unit?"clear":"uncertain";}));return {read:next,targets:forceTargets?[{recordIndex:0,fieldIndex:0,meaningStatus:"unclear",status:"ambiguous",value:null,unit:null,quote:null,reason:"synthetic",missingFirstCheck:true}]:[]};},applyTargetedRepair:()=>({}),CLASSIFY_SCHEMA:{},DOC_FIELDS:{debt_certificate:""},EXTRACT_INSTRUCTIONS,SOURCE_BBOX_INSTRUCTIONS,PAGE_COMPLETENESS_INSTRUCTIONS:"",getRepairTargets:()=>[],PAGE_SCHEMA:{},PROMPT_VERSION:"luna-evidence-3.20.0",preserveAgreedFieldsAfterOmission:()=>read,projectPage:()=>({facts:[],pages:[]}),sourceInstructions:()=>"",validatePageRead:(x:any)=>x,VERIFY_SCHEMA:{}},
    "./server-store":{bucket:()=>({head:async(key:string)=>key.includes("/original/")?{key}:null,get:async()=>({arrayBuffer:async()=>imageBytes.buffer.slice(imageBytes.byteOffset,imageBytes.byteOffset+imageBytes.byteLength),httpMetadata:{contentType:"image/jpeg"}})}),connection:()=>({apiKeyConfigured}),db:()=>db,event:async(_id:string,type:string,payload:any)=>{events.push({type,payload});},getCase:async()=>structuredClone(options.staleSource?{...caseData,documents:[{...caseData.documents[0],sha256:"b".repeat(64)}]}:caseData),HttpError:TestHttpError,now:()=>"2026-10-27T00:00:00.000Z",saveCase:async(data:any)=>{savedCase=structuredClone(data);saveCalls++;if(saveFails&&saveCalls<=3)throw new TestHttpError(409,"revision conflict");if(options.initialRole)Object.assign(caseData,structuredClone(data));}},
    "./legal-rules":{CURRENT_RULESET:{id:"synthetic-rules"},LEGAL_CATALOG:[],RISK_CATALOG:[]},"./assessment":{assessCase:()=>({findings:[]})},"./workflow-rules":{WORKFLOW_RULES:[],LEGACY_DOCUMENT_TYPES:[]},"./transaction-review":{scanTransactions:()=>[]},"./income-resolution":{resolveIncomeRows:()=>({rows:[],issues:[],duplicates:[]})},"./sample-manifest":{samplePageRole:()=>({role:"evidence"})},"./retry-page-policy":{canRetryEvidencePage:()=>true},"./reprojection":{PAGE_PROJECTION_VERSION:"synthetic-projection-v1"},"./scan-quality":scanQuality,"./legal-exceptions.json":{default:{scenarios:[]}},"./category-contract.ts":{RECORD_CATEGORY_POLICY_INSTRUCTIONS:"synthetic",RECORD_CATEGORIES:["other"],RECORD_CATEGORY_POLICY:{other:"synthetic"}},"./source-verification-identity":sourceVerificationIdentity,"./source-verification":{createPreservedOmissionReceipts:()=>[],createSourceVerificationReceipts:(input:any)=>{if(!allowRegionalReceipts||input.passes.length!==1)return [];const pass=input.passes[0],out:any[]=[];input.read.records.forEach((record:any,ri:number)=>record.fields.forEach((field:any,fi:number)=>{const proof=pass.checks.find((check:any)=>check.recordIndex===ri&&check.fieldIndex===fi&&check.status==="agrees"&&check.value===field.value&&check.unit===field.unit&&check.quote);if(proof&&field.confidence==="clear")out.push({field:{recordCategory:record.category,key:field.key,value:field.value,unit:field.unit,quote:field.quote},fieldFingerprint:`${ri}:${fi}:${pass.promptHash}`,proofReadIndexes:[{pass:pass.kind,recordIndex:ri,fieldIndex:fi}],source:{documentId:"doc-synthetic",page:1,sha256:"a".repeat(64)},verifiedAt:pass.verifiedAt,promptVersion:pass.promptVersion,extractionReading:{value:field.value,unit:field.unit,quote:field.quote},verificationQuotes:[proof.quote]});}));return out;},sourceVerificationFieldLocation:(receipt:any)=>({recordIndex:receipt.proofReadIndexes[0].recordIndex,fieldIndex:receipt.proofReadIndexes[0].fieldIndex}),sourceVerificationReceiptMatches:()=>true},
  };
  const module={exports:{} as Record<string,any>};
  new Function("require","module","exports",pipelineOutput)((name:string)=>{if(Object.hasOwn(modules,name))return modules[name];throw new Error(`Unexpected dependency ${name}`);},module,module.exports);
  return {processNext:module.exports.processNext,reconcileCase:module.exports.reconcileCase,mergeRegionalResults:module.exports.mergeRegionalResults,job,caseData,setSaveSuccess:()=>{saveFails=false;},get savedCase(){return savedCase;},setApiKey:(v:boolean)=>{apiKeyConfigured=v;},setImageBytes:(v:Uint8Array<ArrayBuffer>)=>{imageBytes=v;},setOmitted:(v:boolean)=>{omitted=v;},setForceTargets:(v:boolean)=>{forceTargets=v;},setTimeoutExtractor:(v:boolean)=>{timeoutExtractor=v;},setTimeoutVerifier:(v:boolean)=>{options.timeoutVerifier=true;},allowRepeatedVerifier:()=>{allowRepeatedVerifier=true;},allowRegionalReceipts:()=>{allowRegionalReceipts=true;},setExtractionValue:(v:string)=>{extractionValue=v;},setCheckStatus:(v:string)=>{checkStatus=v;},setClassificationDerivatives:(count=2)=>{derivativeRows.splice(0,derivativeRows.length,...[1,2].slice(0,count).map(i=>({variant_hash:hash(bytes),variant:`rescue-classification_unknown-${i}`,object_key:`variant-${i}`,bbox:JSON.stringify(i===1?[0,0,1,.45]:[0,0,1,1]),transform:"{}"})));},setDerivatives:(planId:string)=>{derivativeRows.splice(0,derivativeRows.length,...[1,2,3,4].map(i=>({variant_hash:hash(bytes),variant:`rescue-incomplete_extraction-${i}`,object_key:`variant-${i}`,bbox:JSON.stringify([0,(i-1)*.25,1,Math.min(1,i*.25+.025)]),transform:"{}"})));},get lunaCalls(){return lunaCalls;},get extractorCalls(){return extractorCalls;},get verifierCalls(){return verifierCalls;},get lastVerifierCall(){return lastVerifierCall;},get lastExtractorCall(){return lastExtractorCall;},get modelCalls(){return modelCalls;},get saveCalls(){return saveCalls;},events,sourceHash};
}

test("검증 후 CAS 충돌은 읽기·검증 checkpoint를 보존하고 다음 요청은 Luna 없이 완료한다",async()=>{
  const f=fixture();
  const ready=await f.processNext("case-synthetic");assert.equal(ready.stage,"commit_ready");
  assert.equal(f.lunaCalls,1);assert.equal(f.job.status,"pending");assert.equal(f.job.stage,"commit");assert.equal(f.saveCalls,0);
  const saved=JSON.parse(f.job.result);assert.equal(saved.commit.sourceHash,f.sourceHash);assert.equal(saved.commit.projectionVersion,"synthetic-projection-v1");assert.equal(saved.commit.review.checks.length,1);assert.equal(saved.commit.verifierPasses.length,1);assert.equal(saved.commit.verifierPasses[0].agentTask.taskRole,"source_verifier");assert.equal(saved.commit.verifierPasses[0].agentTask.verificationVisibility,"candidate_read_visible");assert.equal(saved.commit.verifierPasses[0].agentTask.modelContextIndependence,"separate_task_context_same_model");
  f.setApiKey(false);
  const retry=await f.processNext("case-synthetic");assert.equal(retry.stage,"commit_retry");assert.equal(retry.commitRetryCount,1);
  assert.equal(f.lunaCalls,1);assert.equal(f.job.status,"pending");assert.equal(f.job.stage,"commit");
  assert.ok(f.events.some(e=>e.type==="page.commit_retry"&&e.payload.commitRetryCount===1));
  const result=await f.processNext("case-synthetic");
  assert.equal(f.lunaCalls,1);assert.equal(result.stage,"verified");assert.equal(f.job.status,"completed");
});

test("reconcileCase는 OCR 인물행을 applicant CRUD context로 승격하지 않고 수동 입력은 보존한다",async()=>{
  const f=fixture();f.setSaveSuccess();
  f.caseData.facts=[
    {id:"family-name",logicalId:"family-name",version:1,subjectId:"family-row",key:"person.name",value:"Synthetic Relative",state:"extracted",recognition:"unreviewed",refs:[],validation:[]},
    {id:"creditor-address",logicalId:"creditor-address",version:1,subjectId:"creditor-row",key:"person.address",value:"Synthetic Creditor Address",state:"extracted",recognition:"unreviewed",refs:[],validation:[]},
    {id:"applicant-name",logicalId:"applicant-name",version:1,subjectId:"applicant-row",key:"person.name",value:"Synthetic Applicant",state:"extracted",recognition:"unreviewed",refs:[],validation:[]},
    {id:"statement-text",logicalId:"statement-text",version:1,subjectId:"statement-row",key:"statement.text",value:"Synthetic source paragraph",state:"extracted",recognition:"unreviewed",refs:[],validation:[]},
  ];
  await f.reconcileCase("case-synthetic");
  assert.equal(f.savedCase.context.applicant.name,undefined,"unique OCR names remain source observations; they are not persisted as user CRUD values");
  assert.equal(f.savedCase.context.applicant.address,undefined);
  assert.equal(f.savedCase.context.applicant.residentIdMasked,undefined);
  assert.equal(f.savedCase.context.applicant.statement,undefined,"automatic source text stays in the evidence ledger and is derived at form-binding time");
  f.caseData.context.applicant={name:"Manually Entered",address:"Manual Address",residentIdMasked:"900101-1******"};
  await f.reconcileCase("case-synthetic");
  assert.deepEqual(f.savedCase.context.applicant,{name:"Manually Entered",address:"Manual Address",residentIdMasked:"900101-1******",statement:undefined});
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

test("fetched image bytes whose digest differs from the bound job hash are rejected before a model call",async()=>{
  const f=fixture({initialStage:"waiting"});
  const beforeRevision=f.caseData.context.revision,beforeFacts=structuredClone(f.caseData.facts);
  f.setImageBytes(new TextEncoder().encode("different bytes under the same synthetic key"));
  await assert.rejects(f.processNext("case-synthetic"),{status:409});
  assert.equal(f.lunaCalls,0);assert.equal(f.extractorCalls,0);assert.equal(f.verifierCalls,0);
  assert.equal(f.caseData.context.revision,beforeRevision);assert.deepEqual(f.caseData.facts,beforeFacts);
});

test("a noncanonical case/document/page image key is rejected before fetch and model call",async()=>{
  const f=fixture({initialStage:"waiting"});f.job.image_key="cases/other/documents/other/pages/99/"+f.job.image_hash;
  await assert.rejects(f.processNext("case-synthetic"),{status:409});
  assert.equal(f.lunaCalls,0);assert.equal(f.extractorCalls,0);assert.equal(f.verifierCalls,0);
});

test("구버전 verify read는 superseded로 분리한 뒤 현재 prompt로 다시 추출한다",async()=>{
  const f=fixture({classification:{sourceNature:"copy",sourceNatureQuote:"copy notice"},classificationRecovery:{sourceNature:"synthetic_example",sourceNatureQuote:"bounded source note"}});f.job.cache_key="legacy-3.2-cache";
  const oldRead=JSON.parse(f.job.result).read;
  const queued=await f.processNext("case-synthetic");assert.equal(queued.stage,"legacy_read_superseded");assert.equal(f.lunaCalls,0);assert.equal(f.job.stage,"extract");
  const extracted=await f.processNext("case-synthetic");assert.equal(extracted.stage,"extracted");assert.equal(f.lunaCalls,1);assert.equal(f.job.stage,"verify");
  const saved=JSON.parse(f.job.result);assert.equal(saved.supersededRead.records[0].fields[0].value,oldRead.records[0].fields[0].value);assert.equal(saved.read.records[0].fields[0].value,"New synthetic reading");assert.equal(saved.extractionRead.records[0].fields[0].value,"New synthetic reading");assert.equal(saved.extractionPasses[0].agentTask.taskRole,"family_extractor");assert.equal(saved.extractionPasses[0].agentTask.familyId,"debt_certificate");assert.equal(saved.extractionPasses[0].agentTask.logicalBoundaryStatus,"page_only_unverified");
  assert.ok(f.events.some(e=>e.type==="page.read_superseded"));
  assert.ok(f.lastExtractorCall.input[0].content[0].text.includes('"sourceNature":"copy"'));
  assert.ok(f.lastExtractorCall.input[0].content[0].text.includes('"sourceNature":"synthetic_example"'));
});

test("reverify stage reuses the stored OCR exactly once, drops historical reviews, and binds the new pass to the current prompt",async()=>{
  const f=fixture({classification:{sourceNature:"copy",sourceNatureQuote:"copy notice"},classificationRecovery:{sourceNature:"synthetic_example",sourceNatureQuote:"bounded source note"}});const saved=JSON.parse(f.job.result);const read=saved.read,readHash=createHash("sha256").update(JSON.stringify(read)).digest("hex");
  const extractor={model:"gpt-6-luna",promptVersion:"legacy-extractor",promptHash:"c".repeat(64),sourceHash:f.sourceHash,baseImageHash:f.job.image_hash,usedVariants:[],verifiedAt:"2026-10-26T00:00:00.000Z"};
  f.job.stage="reverify";f.job.result=JSON.stringify({classification:saved.classification,classificationRecovery:saved.classificationRecovery,read,firstRead:read,extractionRead:read,extractionPasses:[extractor],review:{checks:[{recordIndex:0,fieldIndex:0,status:"ambiguous"}]},verifierPasses:[{kind:"verify",model:"gpt-6-luna",promptVersion:"legacy",promptHash:"d".repeat(64),verifiedAt:"2026-10-26T00:00:00.000Z",checks:[]},{kind:"repair",model:"gpt-6-luna",promptVersion:"legacy",promptHash:"e".repeat(64),verifiedAt:"2026-10-26T00:00:00.000Z",checks:[]}],sourceReceiptCount:12,reverification:{requestedAt:"2026-10-27T00:00:00.000Z",sourceHash:f.sourceHash,imageHash:f.job.image_hash,imageKey:f.job.image_key,currentCacheKey:"synthetic-cache",originalCacheKey:"legacy-cache",originalReadHash:readHash,originalExtractors:[{model:extractor.model,promptVersion:extractor.promptVersion,promptHash:extractor.promptHash,sourceHash:f.sourceHash,baseImageHash:f.job.image_hash,verifiedAt:extractor.verifiedAt}],verificationPromptVersion:"luna-evidence-3.11.0",verificationAttempts:0,repairAttempts:0}});
  const result=await f.processNext("case-synthetic");assert.equal(result.stage,"commit_ready");assert.equal(f.extractorCalls,0);assert.equal(f.verifierCalls,1);assert.equal(f.job.stage,"commit");
  const checkpoint=JSON.parse(f.job.result);assert.deepEqual(checkpoint.read,read);assert.deepEqual(checkpoint.extractionPasses,[extractor]);assert.equal(checkpoint.verifierPasses.length,1);assert.equal(checkpoint.verifierPasses[0].promptVersion,"luna-evidence-3.20.0");assert.equal(checkpoint.verifierPasses[0].kind,"verify");assert.equal(checkpoint.review.checks.length,1);assert.equal(checkpoint.commit.sourceHash,f.sourceHash);
  const input=JSON.parse(f.lastVerifierCall.input[0].content[0].text);assert.equal(input.read.records[0].recordIndex,0);assert.equal(input.read.records[0].fields[0].fieldIndex,0);assert.match(f.lastVerifierCall.instructions,/명시적 0-base recordIndex/);assert.deepEqual(input.sourceNatureDiagnostics.observations.map((x:any)=>x.sourceNature),["copy","synthetic_example"]);
});

test("a reverify checkpoint with stale current-prompt binding is rejected before any model call or extraction",async()=>{
  const f=fixture(),saved=JSON.parse(f.job.result);f.job.stage="reverify";f.job.result=JSON.stringify({read:saved.read,extractionRead:saved.read,reverification:{sourceHash:f.sourceHash,imageHash:f.job.image_hash,currentCacheKey:"stale-prompt-key",originalReadHash:createHash("sha256").update(JSON.stringify(saved.read)).digest("hex")}});
  await assert.rejects(f.processNext("case-synthetic"),{status:409});assert.equal(f.lunaCalls,0);assert.equal(f.extractorCalls,0);assert.equal(f.job.status,"error");
});

test("omitted rows during stored-read reverify remain review-required and never trigger a new OCR extraction",async()=>{
  const f=fixture(),saved=JSON.parse(f.job.result),read=saved.read,readHash=createHash("sha256").update(JSON.stringify(read)).digest("hex");
  f.job.stage="reverify";f.job.result=JSON.stringify({read,extractionPasses:[{model:"gpt-6-luna",promptVersion:"old",promptHash:"c".repeat(64),sourceHash:f.sourceHash,baseImageHash:f.job.image_hash,usedVariants:[],verifiedAt:"2026-10-26T00:00:00.000Z"}],reverification:{sourceHash:f.sourceHash,imageHash:f.job.image_hash,imageKey:f.job.image_key,currentCacheKey:"synthetic-cache",originalReadHash:readHash,verificationAttempts:0,repairAttempts:0}});f.setOmitted(true);
  const result=await f.processNext("case-synthetic"),checkpoint=JSON.parse(f.job.result);
  assert.equal(result.stage,"commit_ready");assert.equal(f.extractorCalls,0);assert.equal(checkpoint.rescuePlan,undefined);assert.equal(checkpoint.commit.read.complete,false);assert.ok(checkpoint.commit.read.warnings.some((warning:string)=>warning.includes("누락 가능성")));
});

test("reverify verification budget is persisted before the call and a canceled attempt cannot loop",async()=>{
  const f=fixture({timeoutVerifier:true}),saved=JSON.parse(f.job.result),read=saved.read;f.job.stage="reverify";f.job.result=JSON.stringify({read,extractionPasses:[{model:"gpt-6-luna",promptVersion:"old",promptHash:"c".repeat(64),sourceHash:f.sourceHash,baseImageHash:f.job.image_hash,usedVariants:[],verifiedAt:"2026-10-26T00:00:00.000Z"}],reverification:{sourceHash:f.sourceHash,imageHash:f.job.image_hash,imageKey:f.job.image_key,currentCacheKey:"synthetic-cache",originalReadHash:createHash("sha256").update(JSON.stringify(read)).digest("hex"),verificationAttempts:0,repairAttempts:0}});
  await assert.rejects(f.processNext("case-synthetic"));assert.equal(f.extractorCalls,0);assert.equal(f.verifierCalls,1);assert.equal(JSON.parse(f.job.result).reverification.verificationAttempts,1);
  f.job.status="pending";const exhausted=await f.processNext("case-synthetic");assert.equal(exhausted.stage,"reverify_budget_exhausted");assert.equal(f.verifierCalls,1);assert.equal(f.job.status,"review_required");assert.equal(f.job.stage,"failed");
});

test("a canceled targeted repair consumes its one durable budget and cannot be called again",async()=>{
  const f=fixture(),saved=JSON.parse(f.job.result),read=saved.read;f.job.stage="reverify";f.job.result=JSON.stringify({read,extractionPasses:[{model:"gpt-6-luna",promptVersion:"old",promptHash:"c".repeat(64),sourceHash:f.sourceHash,baseImageHash:f.job.image_hash,usedVariants:[],verifiedAt:"2026-10-26T00:00:00.000Z"}],reverification:{sourceHash:f.sourceHash,imageHash:f.job.image_hash,imageKey:f.job.image_key,currentCacheKey:"synthetic-cache",originalReadHash:createHash("sha256").update(JSON.stringify(read)).digest("hex"),verificationAttempts:0,repairAttempts:0}});f.setForceTargets(true);
  const targeted=await f.processNext("case-synthetic");assert.equal(targeted.stage,"targeted_retry");assert.equal(JSON.parse(f.job.result).reverification.verificationAttempts,1);f.setDerivatives(JSON.parse(f.job.result).rescuePlan.planId);f.setTimeoutVerifier(true);
  await assert.rejects(f.processNext("case-synthetic"));assert.equal(f.verifierCalls,2);assert.equal(JSON.parse(f.job.result).reverification.repairAttempts,1);assert.equal(f.extractorCalls,0);
  f.job.status="pending";const exhausted=await f.processNext("case-synthetic");assert.equal(exhausted.stage,"reverify_budget_exhausted");assert.equal(f.verifierCalls,2);assert.equal(f.job.status,"review_required");assert.equal(f.job.stage,"failed");
});

test("missing, null, NaN, negative, and string reverify counters fail closed before Luna",async()=>{
  for(const attempts of [undefined,null,NaN,-1,"0"]){
    const f=fixture(),saved=JSON.parse(f.job.result),read=saved.read;f.job.stage="reverify";
    f.job.result=JSON.stringify({read,extractionPasses:[{model:"gpt-6-luna",promptVersion:"old",promptHash:"c".repeat(64),sourceHash:f.sourceHash,baseImageHash:f.job.image_hash,usedVariants:[],verifiedAt:"2026-10-26T00:00:00.000Z"}],reverification:{sourceHash:f.sourceHash,imageHash:f.job.image_hash,imageKey:f.job.image_key,currentCacheKey:"synthetic-cache",originalReadHash:createHash("sha256").update(JSON.stringify(read)).digest("hex"),verificationAttempts:attempts,repairAttempts:0}});
    const result=await f.processNext("case-synthetic");assert.equal(result.stage,"reverify_budget_exhausted");assert.equal(f.verifierCalls,0);assert.equal(f.extractorCalls,0);assert.equal(f.job.status,"review_required");assert.equal(f.job.stage,"failed");
  }
  for(const attempts of [undefined,null,NaN,-1,"0"]){
    const f=fixture(),saved=JSON.parse(f.job.result),read=saved.read;f.job.stage="repair";
    f.job.result=JSON.stringify({read,review:{checks:[]},verifierPasses:[{kind:"verify",model:"gpt-6-luna",promptVersion:"luna-evidence-3.11.0",promptHash:"d".repeat(64),verifiedAt:"2026-10-27T00:00:00.000Z",checks:[]}],extractionPasses:[{model:"gpt-6-luna",promptVersion:"old",promptHash:"c".repeat(64),sourceHash:f.sourceHash,baseImageHash:f.job.image_hash,usedVariants:[],verifiedAt:"2026-10-26T00:00:00.000Z"}],reverification:{sourceHash:f.sourceHash,imageHash:f.job.image_hash,imageKey:f.job.image_key,currentCacheKey:"synthetic-cache",originalReadHash:createHash("sha256").update(JSON.stringify(read)).digest("hex"),verificationAttempts:1,repairAttempts:attempts}});
    const result=await f.processNext("case-synthetic");assert.equal(result.stage,"reverify_budget_exhausted");assert.equal(f.verifierCalls,0);assert.equal(f.extractorCalls,0);assert.equal(f.job.status,"review_required");assert.equal(f.job.stage,"failed");
  }
});

test("waiting extraction timeout persists an identified rescue plan and resumes it without another model call",async()=>{
  const f=fixture({initialStage:"waiting",timeoutExtractor:true});
  const timedOut=await f.processNext("case-synthetic");
  assert.equal(timedOut.stage,"incomplete_read_rescue");assert.equal(timedOut.rescue.reason,"incomplete_extraction");
  const persisted=JSON.parse(f.job.result);assert.ok(persisted.rescuePlan.planId);assert.equal(persisted.rescuePlan.sourceHash,f.sourceHash);assert.equal(persisted.rescuePlan.baseImageHash,f.job.image_hash);
  const resumed=await f.processNext("case-synthetic");assert.equal(resumed.stage,"rescue_resume");assert.equal(resumed.rescue.planId,persisted.rescuePlan.planId);assert.equal(f.lunaCalls,1);
});

test("incomplete extraction reads and independently verifies one bounded region per persisted stage",async()=>{
  const f=fixture({initialStage:"waiting",timeoutExtractor:true,classification:{sourceNature:"copy",sourceNatureQuote:"copy notice"},classificationRecovery:{sourceNature:"synthetic_example",sourceNatureQuote:"bounded source note"}});f.allowRepeatedVerifier();
  const timedOut=await f.processNext("case-synthetic");const planId=timedOut.rescue.planId;f.setDerivatives(planId);f.setTimeoutExtractor(false);
  const extractorStages=await f.processNext("case-synthetic");assert.equal(extractorStages.stage,"region_extracted");assert.equal(f.job.stage,"region_verify");
  for(let region=0;region<4;region++){
    const verified=await f.processNext("case-synthetic");
    if(region<3){assert.equal(verified.stage,"region_verified");assert.equal(f.job.stage,"region_extract");const extracted=await f.processNext("case-synthetic");assert.equal(extracted.stage,"region_extracted");assert.equal(f.job.stage,"region_verify");}
    else {assert.equal(verified.stage,"regions_complete");assert.equal(f.job.stage,"verify");}
  }
  const beforeFinal=f.lunaCalls,final=await f.processNext("case-synthetic");assert.equal(final.stage,"commit_ready");assert.equal(f.lunaCalls,beforeFinal);assert.equal(JSON.parse(f.job.result).verifierPasses.length,4);assert.equal(JSON.parse(f.job.result).extractionPasses.length,4);
  const routedCalls=f.modelCalls.filter((call:any)=>call.agent==="evidence_extractor"||call.agent==="source_verifier");assert.equal(routedCalls.length,9);assert.ok(routedCalls.every((call:any)=>call.input.flatMap((message:any)=>message.content??[]).some((part:any)=>typeof part.text==="string"&&part.text.includes('"sourceNature":"synthetic_example"')&&part.text.includes('"sourceNature":"copy"'))),"whole-page and bounded regional retry calls must receive both classifier observations");
  assert.ok(routedCalls.filter((call:any)=>call.agent==="source_verifier").every((call:any)=>call.input.flatMap((message:any)=>message.content??[]).some((part:any)=>typeof part.text==="string"&&part.text.includes("현재 영역 이미지 내부의 0~1 정규화 좌표"))),"regional verifier output must remain crop-local until the single server conversion");
});

test("source-nature context reaches normal extraction and verification without filtering image-backed values",async()=>{
  const f=fixture({initialStage:"extract",classification:{sourceNature:"copy",sourceNatureQuote:"copy notice"},classificationRecovery:{sourceNature:"synthetic_example",sourceNatureQuote:"bounded source note"}});f.setExtractionValue("Synthetic Bank");
  const extracted=await f.processNext("case-synthetic");assert.equal(extracted.stage,"extracted");
  assert.ok(f.lastExtractorCall.instructions.includes("untrusted"));assert.ok(f.lastExtractorCall.input[0].content[0].text.includes('"sourceNature":"synthetic_example"'));assert.ok(f.lastExtractorCall.input[0].content[0].text.includes('"sourceNature":"copy"'));
  assert.equal(JSON.parse(f.job.result).read.records[0].fields[0].value,"Synthetic Bank","a legitimate image-backed field value must not be removed because it contains a source-nature word");
  const verified=await f.processNext("case-synthetic");assert.equal(verified.stage,"commit_ready");
  const verifierInput=JSON.parse(f.lastVerifierCall.input[0].content[0].text);assert.deepEqual(verifierInput.sourceNatureDiagnostics.observations.map((x:any)=>x.sourceNature),["copy","synthetic_example"]);assert.ok(f.lastVerifierCall.instructions.includes("untrusted"));
});

test("regional receipts preserve each single-call proof and corrections stay uncertain",async()=>{
  async function finish(f:ReturnType<typeof fixture>){const timeout=await f.processNext("case-synthetic");f.setDerivatives(timeout.rescue.planId);f.setTimeoutExtractor(false);await f.processNext("case-synthetic");for(let i=0;i<4;i++){const verified=await f.processNext("case-synthetic");if(i<3)await f.processNext("case-synthetic");else assert.equal(verified.stage,"regions_complete");}await f.processNext("case-synthetic");return JSON.parse(f.job.result);}
  const agrees=fixture({initialStage:"waiting",timeoutExtractor:true});agrees.allowRepeatedVerifier();agrees.allowRegionalReceipts();agrees.setExtractionValue("Synthetic Bank");
  const agreedResult=await finish(agrees);assert.equal(agreedResult.regionResults.length,4);assert.ok(agreedResult.regionResults.every((region:any)=>region.pass.checks.length===1&&region.receipts.length===1));assert.ok(agreedResult.regionResults.every((region:any)=>region.receipts[0].proofReadIndexes[0].recordIndex===0&&region.receipts[0].proofReadIndexes[0].fieldIndex===0));assert.equal(agreedResult.read.records.length,1);assert.equal(agreedResult.commit.read.records[0].fields[0].confidence,"clear");assert.equal(agreedResult.commit.review.checks.length,1);
  const corrected=fixture({initialStage:"waiting",timeoutExtractor:true});corrected.allowRepeatedVerifier();corrected.allowRegionalReceipts();corrected.setExtractionValue("Synthetic Bank");corrected.setCheckStatus("corrected");
  const correctedResult=await finish(corrected);assert.ok(correctedResult.regionResults.every((region:any)=>region.receipts.length===0));assert.equal(correctedResult.commit.read.records[0].fields[0].confidence,"uncertain");
});

test("regional merge uses explicit document-family consensus and only collapses overlapping exact rows",()=>{
  const f=fixture(),region=(documentType:string,value:string,bbox:[number,number,number,number])=>{const checks=[{recordIndex:0,fieldIndex:0,categoryStatus:"supported",meaningStatus:"supported",status:"agrees",value,unit:null,quote:"same visible row",reason:"match"}];return {read:{documentType,records:[{category:"debt",label:"creditor row",fields:[{key:"creditor",label:"creditor",value,unit:null,quote:"same visible row",confidence:"clear",bbox:[0,0,1,1]}]}],warnings:[],complete:true},review:{checks,omittedRows:false,warnings:[]},pass:{kind:"verify",checks,model:"gpt-6-luna",promptVersion:"synthetic",promptHash:"f".repeat(64),verifiedAt:"2026-10-27T00:00:00.000Z"},bbox};};
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

test("원문 근거가 있는 누락 필드는 분류 시도 횟수와 무관하게 한 번 재추출한다",async()=>{
  const cue={canonicalFieldId:"debt_certificate::principal_balance",sourceState:"present",quote:"원금 잔액",bbox:[.1,.4,.4,.5]};
  const f=fixture({missingFields:[cue]});f.job.attempts=9;
  const result=await f.processNext("case-synthetic"),saved=JSON.parse(f.job.result);
  assert.equal(result.stage,"retry_missing_rows");assert.equal(saved.omissionRetry,true);
  assert.deepEqual(saved.review.missingFields,[cue]);assert.equal(f.verifierCalls,1);assert.equal(f.extractorCalls,0);
  assert.equal(saved.read.records[0].fields.some((field:any)=>field.key==="principal_balance"),false,"a recovery cue cannot create an extracted value");
});

test("다른 문서 family의 누락 주장은 재추출을 시작하거나 값으로 투영하지 않는다",async()=>{
  const f=fixture({missingFields:[{canonicalFieldId:"payroll::gross",sourceState:"present",quote:"급여",bbox:[.1,.4,.4,.5]}]});
  const result=await f.processNext("case-synthetic"),saved=JSON.parse(f.job.result);
  assert.equal(result.stage,"commit_ready");assert.equal(f.extractorCalls,0);assert.deepEqual(saved.review.missingFields,[]);
  assert.ok(saved.review.missingFieldDiagnostics.includes("missing_field_id_unbound"));
});

test("누락 재시도 후에도 남은 원문 후보는 완료로 감추거나 재추출 루프를 만들지 않는다",async()=>{
  const f=fixture({missingFields:[{canonicalFieldId:"debt_certificate::principal_balance",sourceState:"present",quote:"원금 잔액",bbox:[.1,.4,.4,.5]}]});
  const before=JSON.parse(f.job.result);before.omissionRetry=true;f.job.result=JSON.stringify(before);
  const result=await f.processNext("case-synthetic"),saved=JSON.parse(f.job.result);
  assert.equal(result.stage,"commit_ready");assert.equal(saved.commit.read.complete,false);
  assert.equal(saved.commit.review.missingFields.length,1);assert.equal(f.extractorCalls,0);assert.equal(f.verifierCalls,1);
});

test("영역 누락 후보는 원본 페이지 좌표로 변환하고 검토 상태에 보존한다",()=>{
  const f=fixture(),checks:any[]=[],read={documentType:"debt_certificate",records:[],warnings:[],complete:true};
  const cue={canonicalFieldId:"debt_certificate::principal_balance",sourceState:"present",quote:"원금 잔액",bbox:[.1,.2,.5,.4]};
  const region={read,review:{checks,omittedRows:false,missingFields:[cue],warnings:[]},pass:{kind:"verify",checks,model:"gpt-6-luna",promptVersion:"synthetic",promptHash:"f".repeat(64),verifiedAt:"2026-10-28T00:00:00Z"},bbox:[0,.5,1,1]};
  const merged=f.mergeRegionalResults([region]);
  assert.deepEqual(merged.review.missingFields[0].bbox,[.1,.6,.5,.7]);assert.equal(merged.read.complete,false);
});

test("targeted repair 분기에도 superseded provenance를 보존한다",async()=>{
  const f=fixture();f.job.cache_key="legacy-3.2-cache";
  await f.processNext("case-synthetic");await f.processNext("case-synthetic");
  f.setForceTargets(true);const result=await f.processNext("case-synthetic");
  assert.equal(result.stage,"targeted_retry");const saved=JSON.parse(f.job.result);
  assert.equal(saved.supersededCacheKey,"legacy-3.2-cache");assert.equal(saved.supersededRead.records[0].fields[0].value,"Synthetic Bank");
});


test("verification deadline preserves the first read and switches to durable regional rescue",async()=>{
  const f=fixture({timeoutVerifier:true}),before=JSON.parse(f.job.result).read;
  const result=await f.processNext("case-synthetic");
  assert.equal(result.stage,"incomplete_read_rescue");assert.equal(f.lunaCalls,1);
  const saved=JSON.parse(f.job.result);assert.deepEqual(saved.read,before);
  assert.equal(saved.rescuePlan.reason,"incomplete_extraction");assert.equal(f.job.status,"pending");
  assert.equal(saved.verifierPasses,undefined,"no verification receipt is invented for an interrupted call");
});

test("expired whole-page lease resumes with crops without paying for another full-page call",async()=>{
  for(const stage of ["extract","verify"]){
    const f=fixture({initialStage:stage});f.job.status="processing";f.job.lease_until="2026-10-26T23:00:00.000Z";
    const before=JSON.parse(f.job.result).read,result=await f.processNext("case-synthetic");
    assert.equal(result.stage,"incomplete_read_rescue");assert.equal(f.lunaCalls,0);
    assert.deepEqual(JSON.parse(f.job.result).read,before);assert.equal(f.job.status,"pending");
    assert.ok(f.events.some(e=>e.payload.reason==="expired_whole_page_lease"));
  }
  const active=fixture();active.job.status="processing";active.job.lease_until="2026-10-28T00:00:00.000Z";
  assert.equal((await active.processNext("case-synthetic")).stage,"idle");assert.equal(active.lunaCalls,0);
});

test("unknown or different family reads are preserved in actionable review state",async()=>{
  for(const observedType of ["unknown","credit_report"]){
    const f=fixture({initialStage:"verify",readDocumentType:observedType});f.setSaveSuccess();
    const result=await f.processNext("case-synthetic");
    assert.equal(result.stage,"family_read_review_required");
    assert.equal(f.job.status,"review_required");
    assert.equal(f.lunaCalls,0,"family mismatch is held before verifier routing");
    const saved=JSON.parse(f.job.result);
    assert.equal(saved.read.documentType,observedType);
    assert.equal(saved.rawRead.documentType,observedType);
    assert.ok(f.events.some(event=>event.type==="page.family_read_review_required"));
  }
});

test("unknown classification resumes via bounded crops then extracts without approving facts",async()=>{
  const f=fixture({initialStage:"waiting",initialRole:"unknown",readDocumentType:"payroll",classifications:[
    {role:"evidence",familyId:"payroll_payslip",catalogRelease:"catalog-release-v2.2.0",boundaryObservation:"single_page",boundaryQuote:"임금명세서",confidence:"high",reason:"Unclear scan",titleQuote:"임금명세서",issuerQuote:null,structureQuote:"지급 공제 실지급",evidenceRowsQuote:"기본급 3,000,000",administrativeStructureQuote:null,legibility:"low"},
    {role:"evidence",familyId:"payroll_payslip",catalogRelease:"catalog-release-v2.2.0",boundaryObservation:"single_page",boundaryQuote:"임금명세서",confidence:"high",reason:"Visible columns",titleQuote:"임금명세서",issuerQuote:null,structureQuote:"지급 공제 실지급",evidenceRowsQuote:"기본급 3,000,000",administrativeStructureQuote:null,legibility:"clear"},
  ]});f.setSaveSuccess();
  const first=await f.processNext("case-synthetic");assert.equal(first.stage,"classification_rescue");assert.equal(f.job.status,"pending");assert.equal(f.job.role,"unknown");assert.equal(f.lunaCalls,1);
  const before=JSON.parse(f.job.result);assert.equal(before.classificationAttempts,1);assert.equal(before.rescuePlan.reason,"classification_unknown");assert.equal(before.rescuePlan.recipeVersion,"luma-levels-v2");
  const wait=await f.processNext("case-synthetic");assert.equal(wait.stage,"rescue_resume");assert.equal(f.lunaCalls,1);
  f.setClassificationDerivatives(1);const partial=await f.processNext("case-synthetic");assert.equal(partial.stage,"rescue_resume");assert.equal(f.lunaCalls,1,"partial candidate upload must not spend recovery budget");
  f.setClassificationDerivatives();const recovered=await f.processNext("case-synthetic");assert.equal(recovered.stage,"classification_recovered");assert.equal(f.job.role,"evidence");assert.equal(f.job.stage,"extract");assert.equal(f.job.status,"pending");
  const routed=JSON.parse(f.job.result);assert.equal(routed.classificationAttempts,2);assert.equal(routed.rescuePlan,undefined);assert.equal(routed.classificationRecovery.imageHashes.length,2);
  assert.equal(f.caseData.facts.length,0,"routing must not mint source facts or verification receipts");
  const extracted=await f.processNext("case-synthetic");assert.equal(extracted.stage,"extracted");assert.equal(f.lunaCalls,3);assert.equal(JSON.parse(f.job.result).classificationAttempts,2);
});

test("malformed persisted classification budgets fail closed without a model call",async()=>{
  for(const invalid of [null,"1",-1,0.5]){
    const f=fixture({initialStage:"waiting",initialRole:"unknown"});f.setSaveSuccess();
    const saved=JSON.parse(f.job.result);saved.classificationAttempts=invalid;f.job.result=JSON.stringify(saved);
    const result=await f.processNext("case-synthetic");
    assert.equal(result.stage,"classification_budget_exhausted",`invalid counter ${String(invalid)} must stop`);
    assert.equal(f.job.status,"review_required");assert.equal(f.lunaCalls,0);
  }
  const legacy=fixture({initialStage:"waiting",initialRole:"unknown"});legacy.setSaveSuccess();
  const saved=JSON.parse(legacy.job.result);delete saved.classificationAttempts;legacy.job.result=JSON.stringify(saved);
  const result=await legacy.processNext("case-synthetic");
  assert.equal(result.stage,"classification_rescue","an absent legacy counter retains the intentional initial-attempt fallback");
  assert.equal(legacy.lunaCalls,1);
});

test("ambiguous recovery ends review-required and persisted budget prevents repeated paid calls",async()=>{
  const f=fixture({initialStage:"waiting",initialRole:"unknown"});f.setSaveSuccess();
  await f.processNext("case-synthetic");f.setClassificationDerivatives();await f.processNext("case-synthetic");
  assert.equal(f.job.role,"unknown");assert.equal(f.job.status,"review_required");assert.equal(f.lunaCalls,2);
  f.job.status="pending";const bounded=await f.processNext("case-synthetic");assert.equal(bounded.stage,"classification_budget_exhausted");assert.equal(f.lunaCalls,2);
});

test("recovery recognizing a filed form holds it without an extractor call",async()=>{
  const f=fixture({initialStage:"waiting",initialRole:"unknown",classifications:[
    {role:"unknown",familyId:null,catalogRelease:"catalog-release-v2.2.0",boundaryObservation:"mixed_or_unknown",boundaryQuote:null,confidence:"low",reason:"Uncertain"},
    {role:"filed_form",familyId:null,catalogRelease:"catalog-release-v2.2.0",boundaryObservation:"single_page",boundaryQuote:"신청서",confidence:"high",reason:"Court form",titleQuote:"신청서",issuerQuote:null,structureQuote:"법원 제출",evidenceRowsQuote:null,administrativeStructureQuote:null,legibility:"clear"},
  ]});f.setSaveSuccess();await f.processNext("case-synthetic");f.setClassificationDerivatives();await f.processNext("case-synthetic");
  assert.equal(f.job.role,"filed_form");assert.equal(f.job.status,"held");assert.equal(f.lunaCalls,2);
});

test("classification and upload waits cannot consume the bounded source-repair attempt",async()=>{
  const f=fixture();f.job.attempts=40;f.setForceTargets(true);
  const result=await f.processNext("case-synthetic");assert.equal(result.stage,"targeted_retry");assert.equal(f.lunaCalls,1);
  const done=fixture();done.job.attempts=40;done.setForceTargets(true);
  const state=JSON.parse(done.job.result);state.verifierPasses=[{kind:"repair",checks:[],model:"gpt-6-luna",promptVersion:"synthetic",promptHash:"synthetic",verifiedAt:"synthetic"}];done.job.result=JSON.stringify(state);
  const bounded=await done.processNext("case-synthetic");assert.equal(bounded.stage,"commit_ready","one actual prior repair still blocks a second paid repair");
});
