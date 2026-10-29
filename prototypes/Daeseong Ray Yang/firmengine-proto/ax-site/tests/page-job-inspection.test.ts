import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { isEvidenceModel } from "../lib/domain.ts";
import { hasBoundExtractionProvenance, parseHistoricalReadProvenance, requireReprojectionProvenance } from "../lib/reprojection.ts";
import { isValidSourceBBox, validatePageRead } from "../lib/extraction.ts";
import { isSourceReadModel } from "../lib/domain.ts";
import { summarizePageOcrQuality } from "../lib/ocr-quality.ts";

const source=readFileSync(new URL("../lib/page-job-inspection.ts",import.meta.url),"utf8");
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;

function load(saved:any,action="inspectStoredPageJob",alreadyApplied=false,overrides:Record<string,unknown>={}){
  const job={id:"job-1",caseId:"case-1",documentId:"doc-1",page:2,role:"evidence",status:"completed",stage:"completed",leaseUntil:null,imageKey:"image-key",imageHash:"b".repeat(64),cacheKey:"historical-cache",result:JSON.stringify(saved),error:null,documentType:"income",...overrides};
  const row={...job,case_id:"case-1",image_key:job.imageKey,image_hash:job.imageHash,cache_key:job.cacheKey,lease_until:job.leaseUntil,document_sha256:String(overrides.document_sha256??"a".repeat(64)),ready:Number(overrides.ready??1),original_key:String(overrides.original_key??"cases/case-1/documents/doc-1/original/source.pdf"),active_processing_jobs:Number(overrides.active_processing_jobs??0)};
  const data={context:{id:"case-1"},documents:[{id:"doc-1",status:"active",sha256:"a".repeat(64),pages:[2]}],pages:[{documentId:"doc-1",page:2,role:"evidence"}]};
  const modules:Record<string,unknown>={
<<<<<<< HEAD
    "./domain":{isEvidenceModel},"./extraction":{validatePageRead,isValidSourceBBox},"./sample-manifest":{samplePageRole:()=>({role:String(overrides.samplePageRole??"evidence")})},"./reprojection":{parseHistoricalReadProvenance,prepareStoredReadReprojection:()=>({provenance:{documentId:"doc-1",documentSha256:"a".repeat(64),page:2,mappingVersion:"income",promptVersion:"historical-prompt",model:"gpt-6-luna",ruleReleaseId:"rules",verificationPasses:0,storedReceiptCount:0}}),hasCurrentProjection:()=>alreadyApplied,hasBoundExtractionProvenance,requireReprojectionProvenance},
=======
    "./domain":{},"./domain.ts":{isSourceReadModel},"./ocr-quality.ts":{summarizePageOcrQuality},"./extraction":{validatePageRead,isValidSourceBBox},"./sample-manifest":{samplePageRole:()=>({role:String(overrides.samplePageRole??"evidence")})},"./reprojection":{parseHistoricalReadProvenance,prepareStoredReadReprojection:()=>({provenance:{documentId:"doc-1",documentSha256:"a".repeat(64),page:2,mappingVersion:"income",promptVersion:"historical-prompt",model:"gpt-6-luna",ruleReleaseId:"rules",verificationPasses:0,storedReceiptCount:0}}),hasCurrentProjection:()=>alreadyApplied,hasBoundExtractionProvenance,requireReprojectionProvenance},
>>>>>>> 0bd8e7efd6adea4c78d2840b85651760d12ade82
    "./server-store":{db:()=>({prepare:()=>({bind:()=>({first:async()=>row})})}),bucket:()=>({get:async()=>({arrayBuffer:async()=>new ArrayBuffer(1)})}),getCase:async()=>data,HttpError:class extends Error{},sha256:async()=>"a".repeat(64)},
  };
  const mod={exports:{} as Record<string,any>};new Function("require","module","exports",output)((name:string)=>modules[name],mod,mod.exports);return mod.exports[action]("case-1","job-1");
}

const mismatchError="원문 판독의 문서 family가 라우팅 계약과 일치하지 않아 판독 결과를 보존하고 사람 검토를 요청했습니다.";
const validRead={documentType:"synthetic-other",records:[{category:"other",label:"Synthetic record",fields:[{key:"value",label:"Value",value:"synthetic",unit:null,quote:"Synthetic source quote",confidence:"uncertain",bbox:[0,0,0.5,0.5]}]}],warnings:[],complete:false};
const taskRunId="123e4567-e89b-42d3-a456-426614174000";
const extractionTask={schemaVersion:"document-task-envelope-1",runId:taskRunId,taskId:"123e4567-e89b-42d3-a456-426614174001",taskRole:"family_extractor",caseId:"case-1",pageJobId:"job-1",documentId:"doc-1",sourceSha256:"a".repeat(64),imageSha256:"a".repeat(64),sentImageSha256:["a".repeat(64)],page:2,familyId:"synthetic_family",familyContractId:"synthetic_family",canonicalFieldIds:[],logicalBoundaryStatus:"page_only_unverified",logicalDocumentId:null,catalogRelease:"synthetic-catalog",catalogReleaseSha256:"d".repeat(64),registryVersion:"synthetic-registry",promptVersion:"prompt-1",model:"gpt-6-luna",modelContextIndependence:"separate_task_context_same_model",verificationVisibility:"source_only",legalApproval:"not_provided"};
const extractionPass={model:"gpt-6-luna",promptVersion:"prompt-1",promptHash:"c".repeat(64),usedVariants:[],sourceHash:"a".repeat(64),baseImageHash:"a".repeat(64),verifiedAt:"2026-10-26T00:00:00.000Z"};
const boundOverrides={status:"review_required",stage:"failed",error:mismatchError,imageHash:"a".repeat(64),imageKey:`cases/case-1/documents/doc-1/pages/2/${"a".repeat(64)}`,cacheKey:JSON.stringify(["doc-1","a".repeat(64),[2],"income","prompt","gpt-6-luna","rules"])};
const familyHeld=()=>load({read:validRead,extractionPasses:[extractionPass]},"inspectPreservedFamilyRead",false,boundOverrides);
const familyHeldWithoutCache=(task:Record<string,unknown>=extractionTask,cacheKey:unknown=null,taskRun:unknown=taskRunId)=>load({taskRunId:taskRun,read:validRead,rawRead:validRead,extractionPasses:[{...extractionPass,agentTask:task}]},"inspectPreservedFamilyRead",false,{...boundOverrides,cacheKey});

test("stored page inspection exposes exact extraction passes and a conservative bound-provenance summary",async()=>{
  const pass={model:"gpt-6-luna",promptVersion:"legacy-extract-1",promptHash:"c".repeat(64),sourceHash:"a".repeat(64),baseImageHash:"b".repeat(64),verifiedAt:"2026-10-26T00:00:00.000Z"};
  const value=await load({read:{documentType:"synthetic",records:[],warnings:[],complete:true},extractionPasses:[pass],reverification:{requestedAt:"2026-10-27T00:00:00.000Z",verificationPromptVersion:"luna-evidence-3.13.0"}});
  assert.equal(value.historicalProvenance.extractionPassCount,1);assert.equal(value.historicalProvenance.hasBoundExtractionProvenance,true);
  assert.equal(value.stored.sourceQuality.independentlyScored,false);assert.equal(value.stored.sourceQuality.accuracyPercent,null);
  assert.deepEqual(value.stored.extractionPasses,[pass]);assert.deepEqual(value.stored.reverification,{requestedAt:"2026-10-27T00:00:00.000Z",verificationPromptVersion:"luna-evidence-3.13.0"});
});

test("missing or source-mismatched extraction metadata is reported as unbound without being invented",async()=>{
  const absent=await load({read:{complete:true},verifierPasses:[]});assert.equal(absent.historicalProvenance.extractionPassCount,0);assert.equal(absent.historicalProvenance.hasBoundExtractionProvenance,false);assert.equal(absent.stored.extractionPasses,undefined);
  const mismatch=await load({extractionPasses:[{model:"gpt-6-luna",promptVersion:"legacy",promptHash:"d".repeat(64),sourceHash:"f".repeat(64),baseImageHash:"b".repeat(64),verifiedAt:"2026-10-26T00:00:00.000Z"}]});assert.equal(mismatch.historicalProvenance.hasBoundExtractionProvenance,false);
});

test("mutation guard rejects legacy provenance even when a current projection marker exists",async()=>{
  await assert.rejects(load({read:{complete:true},sourceReceiptCount:99},"reprojectCasePage",true),{status:409});
  const pass={model:"gpt-6-luna",promptVersion:"legacy-extract-1",promptHash:"c".repeat(64),sourceHash:"a".repeat(64),baseImageHash:"b".repeat(64),verifiedAt:"2026-10-26T00:00:00.000Z"};
  const allowed=await load({read:{complete:true},extractionPasses:[pass]},"reprojectCasePage",true);
  assert.equal(allowed.alreadyApplied,true);
});

test("preserved family-mismatch read is exposed only as an unverified diagnostic with source-bound payload",async()=>{
  const value=await familyHeld();
  assert.equal(value.mode,"preserved_unverified_extraction");assert.equal(value.job.status,"review_required");
  assert.equal(value.notice.includes("승인된 결과가 아닙니다"),true);assert.deepEqual(value.extraction,validRead);
});

test("first family hold with null cache key uses only the persisted task envelope, without synthesizing cache provenance",async()=>{
  const value=await familyHeldWithoutCache();
  assert.equal(value.mode,"preserved_unverified_extraction");assert.deepEqual(value.extraction,validRead);
  assert.equal(Object.hasOwn(value,"historicalProvenance"),false);assert.equal(Object.hasOwn(value.job,"cacheKey"),false);
});

test("null-cache task fallback rejects missing or mismatched task identity and malformed cache never falls back",async()=>{
  await assert.rejects(familyHeldWithoutCache({}));
  await assert.rejects(familyHeldWithoutCache(extractionTask,null,null));
  for(const [key,value] of [["runId","123e4567-e89b-42d3-a456-426614174002"],["taskId","not-a-uuid"],["caseId","case-2"],["pageJobId","job-2"],["documentId","doc-2"],["page",3],["sourceSha256","f".repeat(64)],["imageSha256","f".repeat(64)],["model","other-model"],["promptVersion","other-prompt"]] as const){
    await assert.rejects(familyHeldWithoutCache({...extractionTask,[key]:value}));
  }
  await assert.rejects(familyHeldWithoutCache(extractionTask,null,taskRunId.replace("000","999")));
  await assert.rejects(familyHeldWithoutCache(extractionTask,"not-json"));
  await assert.rejects(familyHeldWithoutCache(extractionTask,"[]"));
});

test("wrong failed-state/error or foreign-case bindings fail closed; normal completed inspector stays separate",async()=>{
  await assert.rejects(load({read:validRead,extractionPasses:[extractionPass]},"inspectPreservedFamilyRead",false,{...boundOverrides,error:"other failure"}));
  await assert.rejects(load({read:validRead,extractionPasses:[extractionPass]},"inspectPreservedFamilyRead",false,{...boundOverrides,caseId:"case-2"}));
  await assert.rejects(load({read:validRead,extractionPasses:[extractionPass]},"inspectPreservedFamilyRead",false,{...boundOverrides,documentId:"doc-2"}));
  await assert.rejects(load({read:validRead,extractionPasses:[extractionPass]},"inspectPreservedFamilyRead",false,{...boundOverrides,cacheKey:JSON.stringify(["doc-1","a".repeat(64),[3],"income","prompt","gpt-6-luna","rules"])}));
  await assert.rejects(load({read:validRead,extractionPasses:[extractionPass]},"inspectPreservedFamilyRead",false,{...boundOverrides,document_sha256:"f".repeat(64)}));
  await assert.rejects(load({read:validRead,extractionPasses:[extractionPass]},"inspectPreservedFamilyRead",false,{...boundOverrides,ready:0}));
  await assert.rejects(load({read:validRead,extractionPasses:[extractionPass]},"inspectPreservedFamilyRead",false,{...boundOverrides,imageHash:"b".repeat(64),imageKey:`cases/case-1/documents/doc-1/pages/2/${"b".repeat(64)}`}));
  await assert.rejects(load({read:validRead,extractionPasses:[extractionPass]},"inspectPreservedFamilyRead",false,{...boundOverrides,samplePageRole:"filed_form"}));
  await assert.rejects(load({read:validRead,extractionPasses:[extractionPass]},"inspectPreservedFamilyRead",false,{...boundOverrides,samplePageRole:"administrative"}));
  await assert.rejects(load({read:validRead,extractionPasses:[extractionPass]},"inspectPreservedFamilyRead",false,{...boundOverrides,active_processing_jobs:1}));
  const completed=await load({read:validRead});assert.deepEqual(completed.stored.read,validRead);
});

test("malformed bbox and unbound extraction provenance are unavailable to failed-read diagnostics",async()=>{
  const invalid={...validRead,records:[{...validRead.records[0],fields:[{...validRead.records[0].fields[0],bbox:[0,0,2,2]}]}]};
  const inverted={...validRead,records:[{...validRead.records[0],fields:[{...validRead.records[0].fields[0],bbox:[0.5,0.5,0.25,0.75]}]}]};
  const pass={...extractionPass,sourceHash:"f".repeat(64)};
  await assert.rejects(load({read:invalid,extractionPasses:[extractionPass]},"inspectPreservedFamilyRead",false,boundOverrides));
  await assert.rejects(load({read:inverted,extractionPasses:[extractionPass]},"inspectPreservedFamilyRead",false,boundOverrides));
  await assert.rejects(load({read:validRead,extractionPasses:[pass]},"inspectPreservedFamilyRead",false,boundOverrides));
});

test("Terra failed-read provenance is preserved only when both task and pass match the new model",async()=>{
  const terraTask={...extractionTask,model:"gpt-6.1-terra"};
  const read=await load({taskRunId,read:validRead,rawRead:validRead,extractionPasses:[{...extractionPass,model:"gpt-6.1-terra",agentTask:terraTask}]} ,"inspectPreservedFamilyRead",false,{...boundOverrides,cacheKey:null});
  assert.equal(read.mode,"preserved_unverified_extraction");
  await assert.rejects(load({taskRunId,read:validRead,extractionPasses:[{...extractionPass,agentTask:terraTask}]} ,"inspectPreservedFamilyRead",false,{...boundOverrides,cacheKey:null}));
});
