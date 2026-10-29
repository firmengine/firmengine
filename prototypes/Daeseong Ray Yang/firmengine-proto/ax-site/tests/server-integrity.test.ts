import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as nodeCrypto from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import type { SQLInputValue } from "node:sqlite";
import ts from "typescript";
import * as domain from "../lib/domain.ts";
import * as processingReadiness from "../lib/processing-readiness.ts";
import * as jsonResponses from "../lib/json-response.ts";
import * as classificationRecovery from "../lib/classification-recovery.ts";
import * as scanQuality from "../lib/scan-quality.ts";
import * as executionCatalog from "../lib/execution-catalog.ts";
import * as reactiveEvaluation from "../lib/reactive-evaluation.ts";
import * as calculatorTools from "../lib/calculator-tools.ts";
import * as legalRules from "../lib/legal-rules.ts";
import * as referenceRuntime from "../lib/reference-runtime.ts";
import * as exportArtifactTransaction from "../lib/export-artifact-transaction.ts";
import * as referenceApplication from "../lib/reference-application.ts";
import referenceRelease from "../lib/reference-release.json" with { type: "json" };
import type { CaseData, ExportManifest } from "../lib/domain.ts";

const root=fileURLToPath(new URL("../",import.meta.url));
const nodeRequire=createRequire(import.meta.url);
const loadTs=<T>(path:string,mocks:Record<string,unknown>={},cache=new Map<string,{exports:Record<string,unknown>}>()):T=>{
  const absolute=path.endsWith(".ts")||path.endsWith(".json")?path:`${path}.ts`;
  if(cache.has(absolute))return cache.get(absolute)!.exports as T;
  if(absolute.endsWith(".json"))return {__esModule:true,default:JSON.parse(readFileSync(absolute,"utf8"))} as T;
  const output=ts.transpileModule(readFileSync(absolute,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const commonJsModule={exports:{} as Record<string,unknown>};cache.set(absolute,commonJsModule);
  try{new Function("require","module","exports",output)((name:string)=>{
    if(Object.hasOwn(mocks,name))return mocks[name];
    if(name.startsWith("node:"))return nodeRequire(name);
    if(name==="cloudflare:workers")return {env:{DB:undefined,BUCKET:undefined}};
    if(name.startsWith(".")){const resolved=new URL(name,`file://${absolute}`).pathname;return loadTs(resolved.endsWith(".ts")||resolved.endsWith(".json")?resolved:`${resolved}.ts`,mocks,cache);}
    return nodeRequire(name);
  },commonJsModule,commonJsModule.exports);}catch(error){throw new Error(`Failed loading ${absolute}: ${error instanceof Error?error.message:String(error)}`,{cause:error});}
  return commonJsModule.exports as T;
};
const load=<T>(path:string,mocks:Record<string,unknown>):T=>{
  const dependencies:Record<string,unknown>={"./reference-runtime.ts":referenceRuntime,"./reference-context.ts":{resolveReferenceApplicationForCase:()=>null},"./reference-application.ts":{resolveReferenceApplicationForCase:()=>null},"./reference-release.json":{default:referenceRelease},"../../../../lib/reference-runtime.ts":referenceRuntime,"../../../../../lib/export-artifact-transaction.ts":exportArtifactTransaction,"../../../../../lib/case-workflow-view.ts":{buildCaseWorkflowView:async()=>({requirementStates:[]})},"../../../../../lib/document-workflow-gate.ts":{finalWorkflowBlockers:()=>[]},"../../../../../lib/document-field-bases.ts":{buildDocumentFieldBases:async()=>[]},"../../../../../lib/case-command-contract.ts":{commandHash:async(value:unknown)=>digest(new TextEncoder().encode(JSON.stringify(value)))},"../../../../../lib/legal-review-identity.ts":{legalReviewInputFingerprint:async()=>"synthetic",currentLegalDispositionOutcome:()=>"accepted"},"../../../../../lib/calculator-tools.ts":calculatorTools,"../../../../../lib/execution-catalog.ts":executionCatalog,...mocks};
  const output=ts.transpileModule(readFileSync(root+path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const commonJsModule={exports:{}};
  new Function("require","module","exports",output)((name:string)=>{if(Object.hasOwn(dependencies,name))return dependencies[name];throw new Error(`Unexpected dependency: ${name}`);},commonJsModule,commonJsModule.exports);
  return commonJsModule.exports as T;
};
type Store={getCase(id:string):Promise<CaseData>;saveCase(data:CaseData,revision:number,previous:CaseData):Promise<void>;caseStateFingerprint(data:CaseData):Promise<string>;[key:string]:unknown};
type Route={PUT(request:Request,context:{params:Promise<{id:string;doc:string}>}):Promise<Response>};
type CaseRoute={PATCH(request:Request,context:{params:Promise<{id:string}>}):Promise<Response>};
const digest=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
const requiredKinds=[...domain.REQUIRED_ARTIFACT_KINDS,"repayment_schedule"] as domain.ArtifactKind[];
const manifest=(revision:number,tag:string):ExportManifest=>({caseRevision:revision,mode:"final",requiredKinds,files:requiredKinds.map(kind=>({id:`${tag}-${kind}`,kind,name:`${kind}.docx`,hash:`synthetic-${tag}-${kind}`,status:"current"})),reviews:{caseworker:null,lawyer:null}});

function setup(beforeDerivativeInsert?:(sqlite:DatabaseSync,params:SQLInputValue[])=>void,derivedHooks:Record<string,unknown>=reactiveEvaluation as unknown as Record<string,unknown>){
  const sqlite=new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(root+"drizzle/0000_chunky_cardiac.sql","utf8"));
  const data=domain.createCase("Synthetic server integrity",crypto.randomUUID(),"2026-10-27");
  data.exportManifest=manifest(data.context.revision,"old");
  // Migrate an existing row: its empty default token must still participate in CAS.
  sqlite.prepare("INSERT INTO cases (id,name,owner,revision,payload,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(data.context.id,data.context.caseName,"synthetic-owner",data.context.revision,JSON.stringify(data),"synthetic","synthetic");
  sqlite.exec(readFileSync(root+"drizzle/0001_case_storage_token.sql","utf8"));
  sqlite.exec(readFileSync(root+"drizzle/0007_case_commands.sql","utf8"));
  const objects=new Map<string,{bytes:Uint8Array;mime:string}>();
  const bucket={
    async put(key:string,value:ReadableStream<Uint8Array>|Uint8Array|ArrayBuffer,options?:{httpMetadata?:{contentType?:string}}){
      const bytes=value instanceof ReadableStream?new Uint8Array(await new Response(value).arrayBuffer()):new Uint8Array(value instanceof ArrayBuffer?value:value);
      objects.set(key,{bytes,mime:options?.httpMetadata?.contentType||"application/octet-stream"});return {};
    },
    async get(key:string){const item=objects.get(key);return item?{arrayBuffer:async()=>item.bytes.buffer.slice(item.bytes.byteOffset,item.bytes.byteOffset+item.bytes.byteLength)}:null;},
    async delete(key:string){objects.delete(key);},
  };
  const db={prepare(sql:string){return {bind(...params:SQLInputValue[]){return {
    async first(){return sqlite.prepare(sql).get(...params)??null;},
    async run(){if(sql.includes("INSERT INTO page_derivatives")&&beforeDerivativeInsert)beforeDerivativeInsert(sqlite,params);const result=sqlite.prepare(sql).run(...params);return {meta:{changes:Number(result.changes)}};},
    async all(){return {results:sqlite.prepare(sql).all(...params)};},
  };}};},async batch(commands:Array<{run():Promise<unknown>}>){const results=[];for(const command of commands)results.push(await command.run());return results;}};
  let authenticatedUser:{userId:string}|null={userId:"synthetic-owner"};
  const store=load<Store>("lib/server-store.ts",{"cloudflare:workers":{env:{DB:db,BUCKET:bucket}},"../app/chatgpt-auth":{getChatGPTUser:async()=>authenticatedUser},"./domain":domain,"./legal-rules":legalRules,"./processing-readiness":processingReadiness,"./execution-catalog.ts":executionCatalog,"./reactive-evaluation.ts":derivedHooks,"./reference-application.ts":referenceApplication,"./reference-runtime.ts":referenceRuntime,"./calculator-tools.ts":calculatorTools});
  return {sqlite,data,objects,store,setAuthenticatedUser:(user:{userId:string}|null)=>{authenticatedUser=user;}};
}

function loadCommandStore(h:ReturnType<typeof setup>){
  const reducerMocks={"./assessment.ts":{assessCase:()=>({generationGate:{canFinalize:true}})},"./assessment":{assessCase:()=>({generationGate:{canFinalize:true}})},"./case-execution.ts":{executeCaseNodes:()=>({assessment:{generationGate:{canFinalize:true}}})}};
  const contract=loadTs<Record<string,unknown>>(root+"lib/case-command-contract.ts");
  const commands=loadTs<Record<string,unknown>>(root+"lib/case-commands.ts",reducerMocks);
  const legacy=loadTs<Record<string,unknown>>(root+"lib/legacy-case-command.ts");
  const rolesForActor=async(actorId:string,scopeId:string)=>{
    const rows=h.sqlite.prepare("SELECT role,status,effective_from AS effectiveFrom,effective_to AS effectiveTo,scope_id AS scopeId FROM app_role_grants WHERE actor_id=?").all(actorId) as {role:string;status:string;effectiveFrom:string;effectiveTo:string|null;scopeId:string}[];
    const at=new Date().toISOString();
    return [...new Set(rows.filter(row=>row.status==="active"&&row.effectiveFrom<=at&&(!row.effectiveTo||row.effectiveTo>at)&&(row.scopeId==="*"||row.scopeId===scopeId)).map(row=>row.role))];
  };
  const serverStore={...h.store,getProcessingReadiness:async()=>({complete:true})};
  const mocks:Record<string,unknown>={
    "./case-command-contract.ts":contract,"./case-command-contract":contract,
    "./case-commands.ts":commands,"./case-commands":commands,
    "./legacy-case-command.ts":legacy,"./legacy-case-command":legacy,
    "./server-store":serverStore,"./app-roles":{rolesForActor},
    "./intake-store":{getConsultationView:async()=>({run:null}),getIntakeCatalog:async()=>({catalog:{documents:[]}})},
    "./case-workflow-view.ts":{buildCaseWorkflowView:async()=>({requirementStates:[],requirementFingerprints:{},requirementCompleteness:{complete:true}})},
    "./case-response":{caseResponse:async(id:string)=>({case:await h.store.getCase(id)})},
    "./reference-runtime.ts":referenceRuntime,"./calculator-tools.ts":calculatorTools,
    "./execution-catalog.ts":executionCatalog,"./execution-catalog":executionCatalog,
    "./reference-release.json":{default:referenceRelease},"./domain.ts":domain,"./domain":domain,
  };
  return loadTs<{executeLegacyCaseCommand:(id:string,body:Record<string,unknown>)=>Promise<unknown>}>(root+"lib/case-command-store.ts",mocks);
}

async function grantReviewRoles(h:ReturnType<typeof setup>){
  const insert=h.sqlite.prepare("INSERT INTO app_role_grants (actor_id,role,scope_id,status,effective_from,effective_to,granted_by,reason,policy_revision,created_at,revoked_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
  for(const role of ["case_editor","caseworker_review"])insert.run("synthetic-owner",role,h.data.context.id,"active","2000-01-01T00:00:00.000Z",null,"synthetic-admin","server integrity test",1,"2000-01-01T00:00:00.000Z",null);
}

test("같은 사건 revision의 보관·검수 경합은 stale 저장을 거부한다",async()=>{
  const h=setup(),a=await h.store.getCase(h.data.context.id),b=await h.store.getCase(h.data.context.id);
  const archived=domain.archiveExport(a,a.exportManifest!.files[0].id);
  const staleReview=domain.reviewExport(b,"caseworker","synthetic reviewer",domain.manifestFingerprint(b.exportManifest!));
  await h.store.saveCase(archived,a.context.revision,a);
  await assert.rejects(h.store.saveCase(staleReview,b.context.revision,b),{status:409});
  const actual=await h.store.getCase(h.data.context.id);
  assert.equal(actual.context.revision,a.context.revision);assert.equal(actual.exportManifest!.files[0].status,"archived");assert.equal(actual.exportManifest!.reviews.caseworker,null);
  h.sqlite.close();
});

test("불러온 snapshot 없이 복제한 데이터는 CAS 저장을 허가하지 않는다",async()=>{
  const h=setup(),snapshot=await h.store.getCase(h.data.context.id),clone=structuredClone(snapshot);
  await assert.rejects(h.store.saveCase(clone,clone.context.revision,clone),{status:409});
  snapshot.exportManifest=manifest(snapshot.context.revision,"new");
  await h.store.saveCase(snapshot,snapshot.context.revision,snapshot);
  assert.equal((await h.store.getCase(snapshot.context.id)).exportManifest!.files[0].id,"new-application");
  h.sqlite.close();
});

test("successful save writes a current revision-and-token bound calculation; stale loaded objects cannot reuse it",async()=>{
  const h=setup(),before=await h.store.getCase(h.data.context.id),next=structuredClone(before);
  next.context.revision++;
  await h.store.saveCase(next,before.context.revision,before);
  const currentRow=h.sqlite.prepare("SELECT storage_token AS token,revision FROM cases WHERE id=?").get(next.context.id) as {token:string;revision:number};
  const currentEval=h.sqlite.prepare("SELECT payload FROM analyses WHERE case_id=? AND type='derived_evaluation' AND revision=? ORDER BY at DESC LIMIT 1").get(next.context.id,next.context.revision) as {payload:string};
  const envelope=JSON.parse(currentEval.payload);
  assert.equal(envelope.status,"complete");assert.equal(envelope.revision,currentRow.revision);assert.equal(envelope.storageToken,currentRow.token);
  if(envelope.executionPointer){
    h.objects.delete(envelope.executionPointer.key);
    const repaired=await (h.store as any).caseExtras(await h.store.getCase(next.context.id));
    assert.equal(repaired.derivedEvaluation.status,"complete","missing current R2 output is rebuilt from a durable pending marker");
    assert.notEqual(repaired.derivedEvaluation.executionPointer.key,envelope.executionPointer.key,"recovery writes a unique immutable pointer");
  }
  const firstRead=await (h.store as any).caseExtras(await h.store.getCase(next.context.id));assert.equal(firstRead.derivedEvaluation.execution.caseRevision,next.context.revision);
  const stale=await (h.store as any).caseExtras(before);
  assert.notEqual(stale.derivedEvaluation?.status,"complete","an old in-memory object cannot fetch the current or its stale prior-token result");
  const fresh=await h.store.getCase(next.context.id),current=await (h.store as any).caseExtras(fresh);
  assert.equal(current.derivedEvaluation.status,"complete");assert.equal(current.derivedEvaluation.storageToken,currentRow.token);
  h.sqlite.close();
});

test("a failed deterministic refresh leaves durable pending state and a later read retries it",async()=>{
  let shouldFail=true;const derivedHooks={...reactiveEvaluation,buildDerivedExecution:(data:CaseData)=>{if(shouldFail)throw new Error("synthetic evaluator failure");return reactiveEvaluation.buildDerivedExecution(data);}};
  const h=setup(undefined,derivedHooks),before=await h.store.getCase(h.data.context.id),next=structuredClone(before);next.context.revision++;
  await h.store.saveCase(next,before.context.revision,before);
  let payload=JSON.parse((h.sqlite.prepare("SELECT payload FROM analyses WHERE case_id=? AND type='derived_evaluation' AND revision=? ORDER BY at DESC LIMIT 1").get(next.context.id,next.context.revision) as {payload:string}).payload);
  assert.equal(payload.status,"pending","a successful case save cannot be mistaken for a completed calculation when evaluation fails");
  shouldFail=false;const refreshed=await (h.store as any).caseExtras(await h.store.getCase(next.context.id));
  assert.equal(refreshed.derivedEvaluation.status,"complete");assert.equal(refreshed.derivedEvaluation.execution.caseRevision,next.context.revision);
  payload=JSON.parse((h.sqlite.prepare("SELECT payload FROM analyses WHERE case_id=? AND type='derived_evaluation' AND revision=? ORDER BY at DESC LIMIT 1").get(next.context.id,next.context.revision) as {payload:string}).payload);assert.equal(payload.status,"complete");
  h.sqlite.close();
});

test("same-revision authoritative writes invalidate the derived cache through a new storage token and input digest",async()=>{
  const h=setup(),snapshot=await h.store.getCase(h.data.context.id);
  await h.store.saveCase(snapshot,snapshot.context.revision,snapshot);
  const first=h.sqlite.prepare("SELECT storage_token AS token FROM cases WHERE id=?").get(snapshot.context.id) as {token:string};
  const firstEnvelope=JSON.parse((h.sqlite.prepare("SELECT payload FROM analyses WHERE case_id=? AND type='derived_evaluation' AND revision=? ORDER BY at DESC LIMIT 1").get(snapshot.context.id,snapshot.context.revision) as {payload:string}).payload);
  const sameRevision=await h.store.getCase(snapshot.context.id);sameRevision.context.caseName="Updated synthetic case name";
  await h.store.saveCase(sameRevision,sameRevision.context.revision,sameRevision);
  const latest=h.sqlite.prepare("SELECT storage_token AS token FROM cases WHERE id=?").get(snapshot.context.id) as {token:string};
  const latestEnvelope=JSON.parse((h.sqlite.prepare("SELECT payload FROM analyses WHERE case_id=? AND type='derived_evaluation' AND revision=? AND json_extract(payload,'$.storageToken')=? ORDER BY at DESC LIMIT 1").get(snapshot.context.id,sameRevision.context.revision,latest.token) as {payload:string}).payload);
  assert.notEqual(latest.token,first.token);assert.notEqual(latestEnvelope.inputSha256,firstEnvelope.inputSha256);assert.equal(latestEnvelope.status,"complete");
  h.sqlite.close();
});

test("persisted derived snapshot keeps calculator and court-form values synchronized across income and fee edits",async()=>{
  const h=setup(),data=await h.store.getCase(h.data.context.id),amount="3500000",recordId="synthetic-income-row";
  const money=(value:string)=>({currency:"KRW",minorUnits:value,unit:"KRW"} as const);
  const normalized=(value:string)=>domain.normalizeMoney(value,"KRW","KRW");
  data.structuredTest={mode:"assumed_extracted_synthetic",scenarioId:"synthetic-derived-form",sourceRecords:[{id:"source-income-net",recordType:"income",recordId,data:{net:{fieldId:"income.net",presence:"present",value:money(amount),rawValue:amount,sourceUnit:"KRW",currency:"KRW"}}}]};
  data.facts=[{id:"fact-income-net",logicalId:"fact-income-net",version:1,subjectId:recordId,key:"income.net",value:money(amount),numeric:normalized(amount),sourceUnit:"KRW",state:"reported",recognition:"unreviewed",refs:[],structuredRefs:[{sourceRecordId:"source-income-net",jsonPointer:"/net/value"}],validation:[]}];
  data.incomes=[{id:recordId,kind:"wage",label:"Synthetic wage",net:normalized(amount),amountBasis:"monthly",periodStart:"2026-09-01",periodEnd:"2026-09-30",recurring:"yes",payerIdentityId:"synthetic-payer",recognition:"unreviewed",factIds:["fact-income-net"]}];
  data.context.inventoryComplete.income="yes";data.context.monthlyTrusteeFee=normalized("50000");data.context.revision++;
  await h.store.saveCase(data,data.context.revision-1,data);
  const first=await (h.store as any).caseExtras(await h.store.getCase(data.context.id)),firstExecution=first.derivedEvaluation.execution;
  assert.equal(firstExecution.assessment.calculation.monthlyIncomeWon,amount);assert.equal(firstExecution.formBindings.scalars.monthly_income,"3,500,000");assert.equal(firstExecution.formBindings.scalars.monthly_trustee_fee,"50,000");
  const current=await h.store.getCase(data.context.id),nextAmount="4200000",row=current.incomes[0];row.net=normalized(nextAmount);current.facts[0].value=money(nextAmount);current.facts[0].numeric=normalized(nextAmount);const sourceData=current.structuredTest!.sourceRecords[0].data as Record<string,any>;sourceData.net.value=money(nextAmount);sourceData.net.rawValue=nextAmount;current.context.monthlyTrusteeFee=normalized("60000");current.context.revision++;
  await h.store.saveCase(current,current.context.revision-1,current);
  const refreshed=await (h.store as any).caseExtras(await h.store.getCase(current.context.id)),execution=refreshed.derivedEvaluation.execution;
  assert.equal(execution.assessment.calculation.monthlyIncomeWon,nextAmount);assert.equal(execution.formBindings.scalars.monthly_income,"4,200,000");assert.equal(execution.formBindings.scalars.monthly_trustee_fee,"60,000");
  h.sqlite.close();
});

test("legal advisory analysis is current only when its calculator receipt matches the canonical case and reference snapshots",async()=>{
  const h=setup(),data=await h.store.getCase(h.data.context.id),currentHash=await calculatorTools.snapshotSha256(data);
  const insert=h.sqlite.prepare("INSERT INTO analyses (id,case_id,revision,type,payload,at) VALUES (?,?,?,?,?,?)");
  insert.run("advisory-stale",data.context.id,data.context.revision,"legal_advisory",JSON.stringify({checks:[],calculatorExecution:{inputSha256:"0".repeat(64),referenceRelease:{sha256:referenceRelease.sha256}}}),"2026-10-29T00:00:02Z");
  for(let batch=0;batch<16;batch++){
    const start=batch*6,count=batch===15?5:6,checks=legalRules.RISK_CATALOG.slice(start,start+count).map((risk:any)=>({id:risk.id,status:"missing",reason:"synthetic historical output",factIds:[],ruleIds:[],missingDocuments:[],nextAction:"review"}));
    insert.run(`advisory-current-${batch}`,data.context.id,data.context.revision,"legal_advisory",JSON.stringify({checks,calculatorExecution:{inputSha256:currentHash,referenceRelease:{sha256:referenceRelease.sha256},contractVersion:executionCatalog.EXECUTION_CONTRACT_VERSION}}),`2026-10-29T00:${String(batch).padStart(2,"0")}:03Z`);
  }
  insert.run("paid-clone-current",data.context.id,data.context.revision,"paid_clone",JSON.stringify({result:{name:"existing clone"}}),"2026-10-29T00:20:03Z");
  insert.run("legacy-legal-review",data.context.id,data.context.revision,"legal_review",JSON.stringify({checks:[{id:"old-check"}],calculatorExecution:{inputSha256:currentHash}}),"2026-10-29T00:21:03Z");
  insert.run("current-legal-review",data.context.id,data.context.revision,"legal_review",JSON.stringify({checks:[],calculatorExecution:{inputSha256:currentHash,referenceRelease:{sha256:referenceRelease.sha256},contractVersion:executionCatalog.EXECUTION_CONTRACT_VERSION}}),"2026-10-29T00:22:03Z");
  insert.run("engine-stale-legal-review",data.context.id,data.context.revision,"legal_review",JSON.stringify({checks:[],calculatorExecution:{inputSha256:currentHash,referenceRelease:{sha256:referenceRelease.sha256},contractVersion:"1.0.0"}}),"2026-10-29T00:23:03Z");
  insert.run("advisory-legacy",data.context.id,data.context.revision,"legal_advisory",JSON.stringify({checks:[]}),"2026-10-29T00:00:04Z");
  insert.run("advisory-reference-stale",data.context.id,data.context.revision,"legal_advisory",JSON.stringify({checks:[],calculatorExecution:{inputSha256:currentHash,referenceRelease:{sha256:"0".repeat(64)}}}),"2026-10-29T00:00:05Z");
  const extras=await (h.store as any).caseExtras(data);
  assert.equal(extras.inputIdentity.storageHashScheme,"json-stringify-sha256/v1");assert.equal(extras.inputIdentity.canonicalHashScheme,"canonical-json-sha256/v1");
  assert.equal(extras.analyses.filter((row:any)=>row.type==="legal_advisory").length,16,"all 16 current batches remain visible even though other analysis output is bounded");
  assert.equal(extras.legalReviewCoverage.currentCheckCount,95);
  assert.equal(extras.legalReviewCoverage.expectedCheckCount,95);assert.equal(extras.legalReviewCoverage.complete,true);assert.deepEqual(extras.legalReviewCoverage.missingCheckIds,[]);
  assert.deepEqual(extras.analyses.find((row:any)=>row.id==="paid-clone-current")?.payload,{result:{name:"existing clone"}});
  assert.equal(extras.analyses.some((row:any)=>row.id==="legacy-legal-review"),false,"legacy legal_review without reference hash stays excluded from current case reads");
  assert.equal(extras.analyses.some((row:any)=>row.id==="advisory-reference-stale"),false,"a matching case input cannot reuse an advisory from a different reference release");
  const api=load<{GET(request:Request,context:{params:Promise<{id:string}>}):Promise<Response>}>("app/api/cases/[id]/analyses/route.ts",{"../../../../../lib/server-store":h.store});
  const context={params:Promise.resolve({id:data.context.id})},base=`https://synthetic.invalid/api/cases/${data.context.id}/analyses`;
  const current=await (await api.GET(new Request(`${base}?limit=5`),context)).json() as any;
  assert.equal(current.analyses.length,5);assert.equal(current.complete,false);assert.ok(current.nextCursor);
  for(const limit of [0,-1,101])assert.equal((await api.GET(new Request(`${base}?limit=${limit}`),context)).status,400,`invalid analysis page size ${limit} is rejected`);
  const history=await (await api.GET(new Request(`${base}?limit=50&includeHistorical=true`),context)).json() as any;
  assert.equal(history.analyses.length,23);assert.equal(history.complete,true);
  assert.equal(history.analyses.find((row:any)=>row.id==="advisory-stale").staleReason,"calculator_input_hash_mismatch");
  assert.equal(history.analyses.find((row:any)=>row.id==="advisory-reference-stale").staleReason,"reference_release_hash_mismatch");
  assert.equal(history.analyses.find((row:any)=>row.id==="advisory-current-0").current,true);
  assert.equal(history.analyses.find((row:any)=>row.id==="legacy-legal-review").staleReason,"reference_release_hash_mismatch");
  assert.equal(history.analyses.find((row:any)=>row.id==="current-legal-review").current,true);
  assert.equal(history.analyses.find((row:any)=>row.id==="engine-stale-legal-review").staleReason,"engine_version_mismatch");
  assert.deepEqual(history.analyses.find((row:any)=>row.id==="paid-clone-current").payload,{result:{name:"existing clone"}});
  h.sqlite.close();
});

test("검수 API는 지문 누락과 재생성 전의 지문을 거부하고 현재 지문만 기록한다",async()=>{
  const h=setup(),prior=await h.store.getCase(h.data.context.id),oldFingerprint=domain.manifestFingerprint(prior.exportManifest!);
  prior.exportManifest=manifest(prior.context.revision,"new");await h.store.saveCase(prior,prior.context.revision,prior);
  await grantReviewRoles(h);
  const commandStore=loadCommandStore(h);
  const route=load<CaseRoute>("app/api/cases/[id]/route.ts",{
    "../../../../lib/reference-case-import":{prepareReferenceCaseImport:async()=>{throw new Error("unexpected reference import");},ReferenceImportError:class extends Error{status=400;}} ,"../../../../lib/domain":domain,"../../../../lib/assessment":{assessCase:()=>({generationGate:{canFinalize:true}})},"../../../../lib/legal-rules":{CURRENT_RULESET:{}},"../../../../lib/case-response":{caseResponse:async(c:CaseData)=>({case:c})},"../../../../lib/server-store":h.store,"../../../../lib/case-command-store":commandStore,"../../../../lib/object-editor":{},"../../../../lib/sample-manifest":{samplePageRole:()=>({role:"unknown"})},"../../../../lib/context-validation":{},"../../../../lib/json-response":jsonResponses,"../../../../lib/history-integrity-restore":{parseRestoreInput:()=>{throw new Error("history restore helper must not run in review API test");},buildRestorePlan:()=>{throw new Error("history restore helper must not run in review API test");}},
  });
  const context={params:Promise.resolve({id:prior.context.id})};let commandNo=0;
  const request=async(fingerprint?:string)=>{const current=await h.store.getCase(prior.context.id);return new Request("https://synthetic.invalid/api/cases/"+prior.context.id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"review_export",commandId:`server-integrity-review-${++commandNo}`,role:"caseworker",revision:current.context.revision,expectedStateFingerprint:await h.store.caseStateFingerprint(current),...(fingerprint===undefined?{}:{fingerprint})})});};
  assert.equal((await route.PATCH(await request(),context)).status,400);
  const staleResponse=await route.PATCH(await request(oldFingerprint),context);assert.equal(staleResponse.status,409,await staleResponse.clone().text());
  h.setAuthenticatedUser(null);
  assert.equal((await route.PATCH(await request(domain.manifestFingerprint(prior.exportManifest!)),context)).status,403);
  h.setAuthenticatedUser({userId:"private-site-service"});
  assert.equal((await route.PATCH(await request(domain.manifestFingerprint(prior.exportManifest!)),context)).status,403);
  assert.equal((await route.PATCH(new Request("https://synthetic.invalid/api/cases/"+prior.context.id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"review_fact",revision:prior.context.revision})}),context)).status,403);
  assert.equal((await route.PATCH(new Request("https://synthetic.invalid/api/cases/"+prior.context.id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"review_object",revision:prior.context.revision})}),context)).status,403);
  const unchanged=await h.store.getCase(prior.context.id);
  assert.equal(unchanged.context.revision,prior.context.revision);
  assert.equal(unchanged.exportManifest!.reviews.caseworker,null);
  h.setAuthenticatedUser({userId:"synthetic-owner"});
  const fingerprint=domain.manifestFingerprint(prior.exportManifest!);
  assert.equal((await route.PATCH(await request(fingerprint),context)).status,200);
  assert.equal((await h.store.getCase(prior.context.id)).exportManifest!.reviews.caseworker!.manifestFingerprint,fingerprint);
  h.sqlite.close();
});

test("같은 내용의 반복 출력과 다른 사건 출력은 독립된 파일과 검수 manifest로 저장된다",async()=>{
  const h=setup(),second=domain.createCase("Another synthetic case",crypto.randomUUID(),"2026-10-27");
  h.sqlite.prepare("INSERT INTO cases (id,name,owner,revision,payload,created_at,updated_at,storage_token) VALUES (?,?,?,?,?,?,?,?)").run(second.context.id,second.context.caseName,"synthetic-owner",second.context.revision,JSON.stringify(second),"synthetic","synthetic",crypto.randomUUID());
  const route=load<{POST(request:Request,context:{params:Promise<{id:string}>}):Promise<Response>}>("app/api/cases/[id]/export/route.ts",{
    "../../../../../lib/domain":domain,
    "../../../../../lib/document-writer":{prepareDocumentWrite:async({data}:{data:CaseData})=>({execution:{caseId:data.context.id,caseRevision:data.context.revision},receipt:{caseId:data.context.id,caseRevision:data.context.revision,mode:"draft",status:"review_required",referenceRelease:{id:referenceRelease.id,revision:referenceRelease.revision,sha256:referenceRelease.sha256}}}),finalizeDocumentWriterReceipt:async(receipt:Record<string,unknown>,files:Array<{hash:string}>)=>({...receipt,artifactHashes:files.map(file=>file.hash),formResults:[]})},
    "../../../../../lib/reference-context.ts":{loadReferenceSnapshot:async()=>({id:referenceRelease.id,revision:referenceRelease.revision,sha256:referenceRelease.sha256,values:{}})},
    "../../../../../lib/exports":{newExportManifest:(revision:number,files:ExportManifest["files"])=>({...manifest(revision,"test"),files})},
    "../../../../../lib/office-writer":{writeOfficePackage:async()=>[{id:"application-identical-content",kind:"application",name:"synthetic.docx",mime:"application/octet-stream",hash:"same-content-hash",bytes:new TextEncoder().encode("Identical synthetic content")}]},
    "../../../../../lib/legal-rules":{CURRENT_RULESET:{}},
    "../../../../../lib/server-store":h.store,
    "../../../../../lib/case-response":{caseResponse:async(c:CaseData)=>({case:c})},
    "../../../../../lib/json-response":jsonResponses,
  });
  const generate=(id:string)=>route.POST(new Request(`https://synthetic.invalid/api/cases/${id}/export`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"draft"})}),{params:Promise.resolve({id})});
  assert.equal((await generate(h.data.context.id)).status,200);
  const first=(await h.store.getCase(h.data.context.id)).exportManifest!.files[0].id;
  assert.equal((await generate(h.data.context.id)).status,200);
  const repeated=(await h.store.getCase(h.data.context.id)).exportManifest!.files[0].id;
  assert.equal((await generate(second.context.id)).status,200);
  const other=(await h.store.getCase(second.context.id)).exportManifest!.files[0].id;
  assert.equal(new Set([first,repeated,other]).size,3);
  assert.equal(h.sqlite.prepare("SELECT COUNT(*) AS n FROM artifacts").get()!.n,3);
  assert.equal([...h.objects.keys()].filter(key=>key.includes("/artifacts/")).length,3);
  assert.equal((await h.store.getCase(h.data.context.id)).exportManifest!.reviews.caseworker,null);
  h.sqlite.close();
});

test("final export checks adopted workflow requirements before rendering while legacy workflow remains delegated",async()=>{
  const h=setup(),caseId=h.data.context.id,adopted=await h.store.getCase(caseId);
  adopted.workflowState={schema:"case-workflow/1",version:1,requirements:[{requirementId:"required-proof",retired:false}],subjectLinks:[],documentMatches:[],tasks:[],legalDispositions:[],procedureEvents:[],projectionBlockers:[],reviewHistory:[],decisions:[],documentEdits:[],requirementConfirmations:[]} as any;
  h.sqlite.prepare("UPDATE cases SET payload=? WHERE id=?").run(JSON.stringify(adopted),caseId);
  let writes=0;
  const route=load<{POST(request:Request,context:{params:Promise<{id:string}>}):Promise<Response> }>("app/api/cases/[id]/export/route.ts",{
    "../../../../../lib/domain":domain,
    "../../../../../lib/exports":{newExportManifest:()=>{throw new Error("manifest must not be built when workflow obligations are incomplete");}},
    "../../../../../lib/office-writer":{writeOfficePackage:async()=>{throw new Error("render must not run when workflow obligations are incomplete");}},
    "../../../../../lib/document-writer":{prepareDocumentWrite:async()=>{writes++;throw new Error("writer must not run when workflow obligations are incomplete");},finalizeDocumentWriterReceipt:async()=>{throw new Error("writer must not run");}},
    "../../../../../lib/case-workflow-view.ts":{buildCaseWorkflowView:async()=>({requirementStates:[{requirementId:"required-proof",required:true,requirementStatus:"eligible_for_confirmation"}]})},
    "../../../../../lib/document-workflow-gate.ts":{finalWorkflowBlockers:(await import("../lib/document-workflow-gate.ts")).finalWorkflowBlockers},
    "../../../../../lib/reference-context.ts":{loadReferenceSnapshot:async()=>({id:referenceRelease.id,revision:referenceRelease.revision,sha256:referenceRelease.sha256,values:{}})},
    "../../../../../lib/legal-rules":{CURRENT_RULESET:{}},
    "../../../../../lib/server-store":h.store,
    "../../../../../lib/case-response":{caseResponse:async(c:CaseData)=>({case:c})},
    "../../../../../lib/json-response":jsonResponses,
  });
  const response=await route.POST(new Request(`https://synthetic.invalid/api/cases/${caseId}/export`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"final"})}),{params:Promise.resolve({id:caseId})});
  assert.equal(response.status,422);assert.equal(writes,0);
  h.sqlite.close();
});

test("내보내기 CAS 경합은 우승 manifest와 파일을 보존하고 실패 출력의 staging만 지운다",async()=>{
  const h=setup(),caseId=h.data.context.id,prior=await h.store.getCase(caseId);
  const winnerKey=`cases/${caseId}/artifacts/winner-file`,winnerBytes=new TextEncoder().encode("Synthetic winning export");
  h.objects.set(winnerKey,{bytes:winnerBytes,mime:"application/octet-stream"});
  h.sqlite.prepare("INSERT INTO artifacts (id,case_id,revision,name,kind,object_key,hash,mime,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run("winner-file",caseId,prior.context.revision,"winner.docx","application",winnerKey,"winner-hash","application/octet-stream","synthetic");
  const winner=manifest(prior.context.revision,"winner");
  const save= h.store.saveCase.bind(h.store);
  let raced=false;
  const routeStore={...h.store,saveCase:async(data:CaseData,revision:number,previous:CaseData)=>{
    if(!raced){
      raced=true;
      const concurrent=await h.store.getCase(caseId);
      concurrent.exportManifest=winner;
      await save(concurrent,concurrent.context.revision,concurrent);
    }
    return save(data,revision,previous);
  }};
  const route=load<{POST(request:Request,context:{params:Promise<{id:string}>}):Promise<Response> }>("app/api/cases/[id]/export/route.ts",{
    "../../../../../lib/domain":domain,
    "../../../../../lib/document-writer":{prepareDocumentWrite:async({data}:{data:CaseData})=>({execution:{caseId:data.context.id,caseRevision:data.context.revision},receipt:{caseId:data.context.id,caseRevision:data.context.revision,mode:"draft",status:"review_required",referenceRelease:{id:referenceRelease.id,revision:referenceRelease.revision,sha256:referenceRelease.sha256}}}),finalizeDocumentWriterReceipt:async(receipt:Record<string,unknown>,files:Array<{hash:string}>)=>({...receipt,artifactHashes:files.map(file=>file.hash),formResults:[]})},
    "../../../../../lib/reference-context.ts":{loadReferenceSnapshot:async()=>({id:referenceRelease.id,revision:referenceRelease.revision,sha256:referenceRelease.sha256,values:{}})},
    "../../../../../lib/exports":{newExportManifest:(revision:number,files:ExportManifest["files"])=>({...manifest(revision,"loser"),files})},
    "../../../../../lib/office-writer":{writeOfficePackage:async()=>[{id:"application-synthetic",kind:"application",name:"staged.docx",mime:"application/octet-stream",hash:"staged-hash",bytes:new TextEncoder().encode("Synthetic losing export")}]},
    "../../../../../lib/legal-rules":{CURRENT_RULESET:{}},
    "../../../../../lib/server-store":routeStore,
    "../../../../../lib/case-response":{caseResponse:async(c:CaseData)=>({case:c})},
    "../../../../../lib/json-response":jsonResponses,
  });
  const response=await route.POST(new Request(`https://synthetic.invalid/api/cases/${caseId}/export`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"draft"})}),{params:Promise.resolve({id:caseId})});
  assert.equal(response.status,409);
  const actual=await h.store.getCase(caseId);
  assert.equal(actual.exportManifest!.files[0]!.id,"winner-application");
  const artifactRows=h.sqlite.prepare("SELECT id,object_key FROM artifacts WHERE case_id = ? ORDER BY id").all(caseId) as {id:string;object_key:string}[];
  assert.deepEqual(artifactRows.map(row=>({id:row.id,object_key:row.object_key})),[{id:"winner-file",object_key:winnerKey}]);
  assert.deepEqual([...h.objects.keys()].filter(key=>key.includes("/artifacts/")).sort(),[winnerKey]);
  h.sqlite.close();
});

// Cloudflare's fixed-length stream is represented by an in-memory stream here;
// the route's explicit byte-length check remains active in these synthetic tests.
Reflect.set(globalThis,"FixedLengthStream",class {readable:ReadableStream;writable:WritableStream;constructor(){const stream=new TransformStream();this.readable=stream.readable;this.writable=stream.writable;}});
function documentSetup(ready:boolean){
  const h=setup(),bytes=new TextEncoder().encode("Synthetic immutable original"),hash=digest(bytes),doc="synthetic-doc",originalKey=`cases/${h.data.context.id}/documents/${doc}/original/existing`;
  h.data.documents=[{id:doc,name:"synthetic.pdf",sha256:hash,status:"active",pages:[1]}];h.data.pages=[{documentId:doc,page:1,role:"evidence"}];
  h.sqlite.prepare("UPDATE cases SET payload = ? WHERE id = ?").run(JSON.stringify(h.data),h.data.context.id);
  h.sqlite.prepare("INSERT INTO documents (id,case_id,name,sha256,page_count,original_key,ready,created_at) VALUES (?,?,?,?,?,?,?,?)").run(doc,h.data.context.id,"synthetic.pdf",hash,1,ready?originalKey:null,ready?1:0,"synthetic");
  if(ready)h.objects.set(originalKey,{bytes,mime:"application/pdf"});
  const route=load<Route>("app/api/cases/[id]/documents/[doc]/route.ts",{"node:crypto":nodeCrypto,"../../../../../../lib/server-store":h.store,"../../../../../../lib/scan-quality":scanQuality,"../../../../../../lib/classification-recovery":classificationRecovery,"../../../../../../lib/sample-manifest":{samplePageRole:()=>({role:"unknown"})}});
  const put=(body:Uint8Array)=>route.PUT(new Request(`https://synthetic.invalid/api/cases/${h.data.context.id}/documents/${doc}?kind=original`,{method:"PUT",headers:{"Content-Type":"application/pdf","Content-Length":String(body.byteLength)},body:new Uint8Array(body)}),{params:Promise.resolve({id:h.data.context.id,doc})});
  return {...h,bytes,doc,originalKey,put};
}

function derivativeSetup(options:{changePlanAtInsert?:boolean;classification?:boolean;role?:string;recipeVersion?:"luma-levels-v2"}={}){
  const h=setup(options.changePlanAtInsert?(sqlite)=>{
    const row=sqlite.prepare("SELECT result FROM page_jobs WHERE id = ?").get("synthetic-doc:1") as {result:string};
    const result=JSON.parse(row.result);result.rescuePlan.planId="stale-plan";
    sqlite.prepare("UPDATE page_jobs SET result = ? WHERE id = ?").run(JSON.stringify(result),"synthetic-doc:1");
  }:undefined);
  h.sqlite.exec(readFileSync(root+"drizzle/0002_page_derivatives.sql","utf8"));
  h.sqlite.exec(readFileSync(root+"drizzle/0003_derivative_plan_id.sql","utf8"));
  const reason=options.classification?"classification_unknown":"incomplete_extraction",role=options.role??"evidence";
  const bytes=new TextEncoder().encode("Synthetic immutable original"),sourceHash=digest(bytes),doc="synthetic-doc",page=1,planId="plan-current",baseHash=digest(new TextEncoder().encode("Synthetic page image")),boxes:[[number,number,number,number]]=[[0,0,1,1]];
  h.data.documents=[{id:doc,name:"synthetic.pdf",sha256:sourceHash,status:"active",pages:[page]}];h.data.pages=[{documentId:doc,page,role:role as any}];
  h.sqlite.prepare("UPDATE cases SET payload = ? WHERE id = ?").run(JSON.stringify(h.data),h.data.context.id);
  h.sqlite.prepare("INSERT INTO documents (id,case_id,name,sha256,page_count,original_key,ready,created_at) VALUES (?,?,?,?,?,?,?,?)").run(doc,h.data.context.id,"synthetic.pdf",sourceHash,1,"synthetic-original",1,"synthetic");
  h.objects.set("synthetic-original",{bytes,mime:"application/pdf"});
  h.sqlite.prepare("INSERT INTO page_jobs (id,case_id,document_id,page,role,document_type,image_key,image_hash,status,stage,attempts,lease_until,cache_key,result,error,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(`${doc}:${page}`,h.data.context.id,doc,page,role,"debt_certificate","synthetic-page",baseHash,"pending","extract",0,null,null,JSON.stringify({rescuePlan:{planId,documentId:doc,page,sourceHash,baseImageHash:baseHash,reason,boxes,...(options.recipeVersion?{recipeVersion:options.recipeVersion}:{})}}),null,"synthetic");
  const route=load<Route>("app/api/cases/[id]/documents/[doc]/route.ts",{"node:crypto":nodeCrypto,"../../../../../../lib/server-store":h.store,"../../../../../../lib/scan-quality":scanQuality,"../../../../../../lib/classification-recovery":classificationRecovery,"../../../../../../lib/sample-manifest":{samplePageRole:()=>({role:"unknown"})}});
  const upload=(variant:string,image:Uint8Array,overrides:Record<string,string>={})=>{
    const spec=scanQuality.rescueSpecs({reason,boxes,sourceHash,baseImageHash:baseHash,recipeVersion:options.recipeVersion}).find(item=>item.variant===variant)!;
    const request=new Request(`https://synthetic.invalid/api/cases/${h.data.context.id}/documents/${doc}?kind=variant&page=${page}`,{method:"PUT",headers:{"Content-Type":"image/jpeg","x-rescue-plan-id":planId,"x-source-hash":sourceHash,"x-base-image-hash":baseHash,"x-variant":variant,"x-source-bbox":JSON.stringify(spec.bbox),"x-transform":JSON.stringify({method:"canvas-crop-v1",rotation:spec.rotation,contrast:spec.contrast,...(options.recipeVersion?{tone:spec.tone,recipeVersion:spec.recipeVersion}:{})}),...overrides},body:new Uint8Array(image)});
    return route.PUT(request,{params:Promise.resolve({id:h.data.context.id,doc})});
  };
  return {...h,doc,page,planId,sourceHash,baseHash,upload};
}

test("해시가 다른 원본 재전송은 기존 객체·ready 상태를 손상하지 않는다",async()=>{
  const h=documentSetup(true),response=await h.put(new TextEncoder().encode("Synthetic wrong original"));
  assert.equal(response.status,422);assert.deepEqual(h.objects.get(h.originalKey)!.bytes,h.bytes);assert.equal(h.objects.size,1);
  const row=h.sqlite.prepare("SELECT original_key,ready FROM documents WHERE id = ?").get(h.doc)!;assert.equal(row.ready,1);assert.equal(row.original_key,h.originalKey);
  h.sqlite.close();
});

test("같은 원본의 재전송은 idempotent이며 기존 key를 유지한다",async()=>{
  const h=documentSetup(true),response=await h.put(h.bytes);
  assert.equal(response.status,200);assert.equal((await response.json() as {idempotent?:boolean}).idempotent,true);assert.equal(h.objects.size,1);assert.deepEqual(h.objects.get(h.originalKey)!.bytes,h.bytes);
  assert.equal(h.sqlite.prepare("SELECT original_key FROM documents WHERE id = ?").get(h.doc)!.original_key,h.originalKey);
  h.sqlite.close();
});

test("동시에 도착한 같은 원본 중 하나만 등록하고 나머지 staging 객체는 제거한다",async()=>{
  const h=documentSetup(false),responses=await Promise.all([h.put(h.bytes),h.put(h.bytes)]);
  assert.ok(responses.every(r=>r.status===200));const bodies=await Promise.all(responses.map(r=>r.json() as Promise<{idempotent?:boolean}>));assert.equal(bodies.filter(b=>b.idempotent).length,1);
  const row=h.sqlite.prepare("SELECT original_key,ready FROM documents WHERE id = ?").get(h.doc)!;assert.equal(row.ready,1);assert.equal(h.objects.size,1);assert.deepEqual(h.objects.get(String(row.original_key))!.bytes,h.bytes);
  h.sqlite.close();
});

test("잘못된 최초 업로드와 정상 업로드의 경합도 정상 원본을 삭제하지 않는다",async()=>{
  const h=documentSetup(false),responses=await Promise.all([h.put(new TextEncoder().encode("Synthetic wrong bytes")),h.put(h.bytes)]);
  assert.deepEqual(responses.map(r=>r.status),[422,200]);const row=h.sqlite.prepare("SELECT original_key,ready FROM documents WHERE id = ?").get(h.doc)!;
  assert.equal(row.ready,1);assert.equal(h.objects.size,1);assert.deepEqual(h.objects.get(String(row.original_key))!.bytes,h.bytes);
  h.sqlite.close();
});

test("같은 바이트의 서로 다른 재판독 슬롯은 별도 SQLite 행과 R2 객체로 저장된다",async()=>{
  const h=derivativeSetup(),image=new TextEncoder().encode("same crop bytes");
  const first=await h.upload("rescue-incomplete_extraction-1",image),second=await h.upload("rescue-incomplete_extraction-2",image);
  assert.equal(first.status,200);assert.equal(second.status,200);
  const rows=h.sqlite.prepare("SELECT variant,variant_hash,object_key,id FROM page_derivatives ORDER BY variant").all() as {variant:string;variant_hash:string;object_key:string;id:string}[];
  assert.equal(rows.length,2);assert.notEqual(rows[0].variant,rows[1].variant);assert.equal(rows[0].variant_hash,rows[1].variant_hash);assert.notEqual(rows[0].id,rows[1].id);assert.notEqual(rows[0].object_key,rows[1].object_key);
  assert.ok(h.objects.has(rows[0].object_key));assert.ok(h.objects.has(rows[1].object_key));assert.deepEqual(h.objects.get(rows[0].object_key)!.bytes,image);assert.deepEqual(h.objects.get(rows[1].object_key)!.bytes,image);
  h.sqlite.close();
});

test("재판독 슬롯은 같은 이미지에만 idempotent이며 슬롯 안의 다른 이미지는 409",async()=>{
  const h=derivativeSetup(),image=new TextEncoder().encode("slot one"),other=new TextEncoder().encode("different image");
  assert.equal((await h.upload("rescue-incomplete_extraction-1",image)).status,200);
  const repeated=await h.upload("rescue-incomplete_extraction-1",image);assert.equal(repeated.status,200);assert.equal((await repeated.json() as {idempotent?:boolean}).idempotent,true);
  assert.equal((await h.upload("rescue-incomplete_extraction-1",other)).status,409);
  const rows=h.sqlite.prepare("SELECT variant,object_key FROM page_derivatives").all() as {variant:string;object_key:string}[];assert.equal(rows.length,1);assert.equal(rows[0].variant,"rescue-incomplete_extraction-1");assert.deepEqual(h.objects.get(rows[0].object_key)!.bytes,image);assert.equal(h.objects.size,2);
  h.sqlite.close();
});

test("변형 업로드는 잘못된 geometry와 만료된 rescue plan을 거부한다",async()=>{
  const h=derivativeSetup(),image=new TextEncoder().encode("candidate");
  const wrong=await h.upload("rescue-incomplete_extraction-1",image,{"x-source-bbox":JSON.stringify([.1,.1,.9,.9])});assert.equal(wrong.status,400);
  const stale=await h.upload("rescue-incomplete_extraction-1",image,{"x-rescue-plan-id":"old-plan"});assert.equal(stale.status,409);
  assert.equal(h.sqlite.prepare("SELECT COUNT(*) AS n FROM page_derivatives").get()!.n,0);assert.equal(h.objects.size,1);
  h.sqlite.close();
});

test("R2 저장 뒤 INSERT 전 rescue plan이 바뀌면 stale derivative를 등록하지 않고 staging key를 지운다",async()=>{
  const h=derivativeSetup({changePlanAtInsert:true}),image=new TextEncoder().encode("candidate");
  const response=await h.upload("rescue-incomplete_extraction-1",image);
  assert.equal(response.status,409);assert.equal(h.sqlite.prepare("SELECT COUNT(*) AS n FROM page_derivatives").get()!.n,0);assert.equal(h.objects.size,1);
  const job=h.sqlite.prepare("SELECT json_extract(result,'$.rescuePlan.planId') AS plan FROM page_jobs WHERE id = ?").get("synthetic-doc:1") as {plan:string};assert.equal(job.plan,"stale-plan");
  h.sqlite.close();
});

test("unknown page can upload only a saved classification rescue candidate",async()=>{
  const h=derivativeSetup({classification:true,role:"unknown"}),image=new TextEncoder().encode("synthetic classification crop");
  assert.equal((await h.upload("rescue-classification_unknown-1",image)).status,200);
  assert.equal(h.sqlite.prepare("SELECT COUNT(*) AS n FROM page_derivatives").get()!.n,1);
  h.sqlite.close();
});

test("versioned classification tone transform must match the saved recipe exactly",async()=>{
  const h=derivativeSetup({classification:true,role:"unknown",recipeVersion:"luma-levels-v2"}),image=new TextEncoder().encode("synthetic classification crop");
  const wrong=await h.upload("rescue-classification_unknown-2",image,{"x-transform":JSON.stringify({method:"canvas-crop-v1",rotation:90,contrast:1,tone:"neutral",recipeVersion:"luma-levels-v2"})});assert.equal(wrong.status,400);
  const accepted=await h.upload("rescue-classification_unknown-2",image);assert.equal(accepted.status,200);
  const row=h.sqlite.prepare("SELECT transform FROM page_derivatives WHERE variant = ?").get("rescue-classification_unknown-2") as {transform:string};assert.equal(JSON.parse(row.transform).tone,"luma-levels-v2");h.sqlite.close();
});

test("unknown role cannot upload ordinary extraction rescue candidates",async()=>{
  const h=derivativeSetup({role:"unknown"}),image=new TextEncoder().encode("synthetic candidate");
  assert.equal((await h.upload("rescue-incomplete_extraction-1",image)).status,409);
  assert.equal(h.sqlite.prepare("SELECT COUNT(*) AS n FROM page_derivatives").get()!.n,0);h.sqlite.close();
});

test("filed-form role never enters classification rescue storage",async()=>{
  const h=derivativeSetup({classification:true,role:"filed_form"}),image=new TextEncoder().encode("synthetic held form");
  const response=await h.upload("rescue-classification_unknown-1",image);
  assert.equal((await response.json() as {heldOut?:boolean}).heldOut,true);
  assert.equal(h.sqlite.prepare("SELECT COUNT(*) AS n FROM page_derivatives").get()!.n,0);h.sqlite.close();
});
