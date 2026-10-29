import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { createCase } from "../lib/domain.ts";
import { caseWorkflow } from "../lib/case-workflow-state.ts";
import * as domain from "../lib/domain.ts";
import * as referenceContext from "../lib/reference-context.ts";
import * as referenceApplication from "../lib/reference-application.ts";
import * as referenceRuntime from "../lib/reference-runtime.ts";
import * as reactiveEvaluation from "../lib/reactive-evaluation.ts";
import * as calculatorTools from "../lib/calculator-tools.ts";
import * as executionCatalog from "../lib/execution-catalog.ts";
import * as legalRules from "../lib/legal-rules.ts";
import * as processingReadiness from "../lib/processing-readiness.ts";
import { documentEditBaseHash } from "../lib/case-commands.ts";
import { currentExportReviews,manifestFingerprint } from "../lib/domain.ts";
import referenceRelease from "../lib/reference-release.json" with { type: "json" };
import { prepareCaseSchemaMigration,CASE_SCHEMA_MIGRATION_VERSION } from "../lib/case-schema-migration.ts";
import { canonicalSha256 } from "../lib/structured-case-import.ts";

const actor = { actor: "synthetic-staff", roles: ["case_editor", "caseworker_review"], at: "2026-10-29T00:00:00.000Z" };
const fingerprint = `case-state/1:${"a".repeat(64)}`;
const root=fileURLToPath(new URL("../",import.meta.url));
const nodeRequire=createRequire(import.meta.url);
type CaseCommand=import("../lib/case-command-contract.ts").CaseCommand;
type Store={getCase(id:string):Promise<import("../lib/domain.ts").CaseData>;saveCase(data:import("../lib/domain.ts").CaseData,revision:number,previous:import("../lib/domain.ts").CaseData,mutation?:unknown):Promise<unknown>;caseStateFingerprint(data:import("../lib/domain.ts").CaseData):Promise<string>;[key:string]:unknown};
function loadTs<T>(file:string,mocks:Record<string,unknown>={},cache=new Map<string,{exports:Record<string,unknown>}>()):T {
  const absolute=file.endsWith(".ts")||file.endsWith(".json")?file:`${file}.ts`;
  if(cache.has(absolute))return cache.get(absolute)!.exports as T;
  if(absolute.endsWith(".json"))return JSON.parse(readFileSync(absolute,"utf8")) as T;
  const output=ts.transpileModule(readFileSync(absolute,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const commonJsModule={exports:{} as Record<string,unknown>};cache.set(absolute,commonJsModule);
  new Function("require","module","exports",output)((name:string)=>{
    if(Object.hasOwn(mocks,name))return mocks[name];
    if(name==="cloudflare:workers")return {env:{DB:undefined,BUCKET:undefined}};
    if(name.startsWith("node:"))return nodeRequire(name);
    if(name.startsWith(".")){
      const resolved=new URL(name,`file://${absolute}`).pathname;
      const path=resolved.endsWith(".ts")||resolved.endsWith(".json")?resolved:`${resolved}.ts`;
      return loadTs(path,mocks,cache);
    }
    return nodeRequire(name);
  },commonJsModule,commonJsModule.exports);
  return commonJsModule.exports as T;
}
function setup(){
  const sqlite=new DatabaseSync(":memory:");
  for(const name of ["0000_chunky_cardiac.sql","0001_case_storage_token.sql","0007_case_commands.sql"])sqlite.exec(readFileSync(root+"drizzle/"+name,"utf8"));
  const data=domain.createCase("Workflow orchestration",crypto.randomUUID(),"2026-10-29");
  sqlite.prepare("INSERT INTO cases (id,name,owner,revision,payload,created_at,updated_at,storage_token) VALUES (?,?,?,?,?,?,?,?)").run(data.context.id,data.context.caseName,"synthetic-owner",data.context.revision,JSON.stringify(data),"synthetic","synthetic","initial-token");
  const objects=new Map<string,Uint8Array>();
  const bucket={async put(key:string,value:ReadableStream<Uint8Array>|Uint8Array|ArrayBuffer){const bytes=value instanceof ReadableStream?new Uint8Array(await new Response(value).arrayBuffer()):new Uint8Array(value instanceof ArrayBuffer?value:value);objects.set(key,bytes);return{};},async get(key:string){const bytes=objects.get(key);return bytes?{arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}:null;},async delete(key:string){objects.delete(key);}};
  const db={prepare(sql:string){return{bind(...params:SQLInputValue[]){return{async first(){return sqlite.prepare(sql).get(...params)??null;},async run(){const result=sqlite.prepare(sql).run(...params);return{meta:{changes:Number(result.changes)}};},async all(){return{results:sqlite.prepare(sql).all(...params)};}};}};},async batch(commands:Array<{run():Promise<{meta:{changes:number}}>}>){sqlite.exec("BEGIN IMMEDIATE");try{const results=[];for(const command of commands)results.push(await command.run());sqlite.exec("COMMIT");return results;}catch(error){try{sqlite.exec("ROLLBACK");}catch{}throw error;}}};
  const dependencies:Record<string,unknown>={"cloudflare:workers":{env:{DB:db,BUCKET:bucket}},"../app/chatgpt-auth":{getChatGPTUser:async()=>({userId:"synthetic-owner"})},"./domain":domain,"./legal-rules":legalRules,"./processing-readiness":processingReadiness,"./execution-catalog.ts":executionCatalog,"./reactive-evaluation.ts":{...reactiveEvaluation},"./calculator-tools.ts":calculatorTools,"./reference-runtime.ts":referenceRuntime,"./reference-context.ts":referenceContext,"./reference-application.ts":referenceApplication,"./reference-release.json":{default:referenceRelease}};
  const output=ts.transpileModule(readFileSync(root+"lib/server-store.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};new Function("require","module","exports",output)((name:string)=>{if(Object.hasOwn(dependencies,name))return dependencies[name];throw new Error(`Unexpected server-store dependency ${name}`);},mod,mod.exports);
  return{sqlite,objects,data,store:mod.exports as Store};
}
function command(commandType: CaseCommand["commandType"], patch: Record<string, unknown>, target: Record<string, unknown> = {}): CaseCommand {
  return loadTs<typeof import("../lib/case-command-contract.ts")>(root+"lib/case-command-contract.ts").parseCaseCommand({ commandId: "workflow-command-1", commandType, payloadVersion: 1, expectedRevision: 1, expectedStateFingerprint: fingerprint, target, patch, reason: "integration fixture" });
}

test("real command reducer saves a context change and invalidates prior human review state", async () => {
  const before = createCase("Workflow integration", "synthetic-owner", "2026-10-29");
  before.context.ruleApplicationReviewed = true;
  before.workflowState = caseWorkflow({ reviewHistory: [] });
  const reducer=loadTs<typeof import("../lib/case-commands.ts")>(root+"lib/case-commands.ts").reduceCaseCommand;
  const { data, impact } = await reducer(before, command("context.update", { context: { asOf: "2026-10-28" } }), actor);
  assert.equal(data.context.revision, before.context.revision + 1);
  assert.equal(data.context.asOf, "2026-10-28");
  assert.equal(data.context.ruleApplicationReviewed, false);
  assert.equal(data.workflowState?.reviewHistory.length, 1);
  assert.ok((impact.reviewInvalidation as unknown[]).some((item) => (item as { key?: string }).key === "ruleApplicationReviewed"));
});

test("workflow GET projection reports requirement states without changing case state", async () => {
  const data = createCase("Workflow projection", "synthetic-owner", "2026-10-29");
  data.workflowState=caseWorkflow({requirements:[{requirementId:"req-1",originKey:"source",intakeRunId:"run-1",intakeDocumentTypeId:"bank_statement",subjectLinkId:null,scopeKey:"case",requiredPeriod:"2026-01",purposeCode:"bank_statement",requirement:"required_when_applicable",alternativePolicy:"none",intakeStatus:"requested",requiredFieldGroups:[],optionalFieldIds:[],matchedRuleIds:[],sourceClaimIds:[],sourceIds:[],mappingRequired:true,crosswalkId:null,familyId:null,crosswalkVersion:null,availableFieldIds:[],noRequiredFieldsApproved:false,typedTargets:[],workflowIds:[],alternatives:[],override:"automatic",overrideReason:null,waivedByReview:false,notApplicableConfirmed:false,retired:false,overrideReviewer:null,overrideBasisRefs:[]} as unknown as import("../lib/case-requirements.ts").CaseRequirement]});
  const before = structuredClone(data);
  const view = await loadTs<typeof import("../lib/case-workflow-view.ts")>(root+"lib/case-workflow-view.ts").buildCaseWorkflowView(data);
  assert.equal(view.requirementStates.length, 1);
  assert.equal(view.requirementStates[0].requirementId, "req-1");
  assert.equal(view.requirementStates[0].engineFulfillment, "mapping_required");
  assert.equal(view.requirementCompleteness.total, 1);
  assert.equal(view.requirementCompleteness.complete, false);
  assert.deepEqual(data, before);
});

test("synthetic source cases reject human recognition commands", async () => {
  const data = createCase("Synthetic immutable", "synthetic-owner", "2026-10-29");
  data.structuredTest = { mode: "assumed_extracted_synthetic", sourceRecords: [] };
  const reducer=loadTs<typeof import("../lib/case-commands.ts")>(root+"lib/case-commands.ts").reduceCaseCommand;
  await assert.rejects(() => reducer(data, command("object.review", { recognition: "accepted" }, { collection: "incomes", objectId: "income-1" }), actor), /원본 평가 사건|합성 사건|합성 객체/);
});

type CommandResponse={committed?:boolean;duplicate?:boolean;[key:string]:unknown};
function commandService(h:ReturnType<typeof setup>,options:{revokeBeforeCommit?:boolean}={}) {
  let roleReads=0;
  const rolesForActor=async(actorId:string,scopeId:string)=>{
    roleReads++;
    if(options.revokeBeforeCommit&&roleReads>1)return [];
    return actorId==="synthetic-owner"&&scopeId===h.data.context.id?["case_editor","caseworker_review"]:[];
  };
  const contract=loadTs<typeof import("../lib/case-command-contract.ts")>(root+"lib/case-command-contract.ts");
  const caseCommands=loadTs<typeof import("../lib/case-commands.ts")>(root+"lib/case-commands.ts");
  const legacyCommand=loadTs<typeof import("../lib/legacy-case-command.ts")>(root+"lib/legacy-case-command.ts");
  const workflowView=loadTs<typeof import("../lib/case-workflow-view.ts")>(root+"lib/case-workflow-view.ts");
  const realReducer=caseCommands.reduceCaseCommand;
  const reducer=options.revokeBeforeCommit?async(...args:Parameters<typeof realReducer>)=>{
    const result=await realReducer(...args);
    h.sqlite.prepare("UPDATE app_role_grants SET status='revoked' WHERE actor_id=? AND role='case_editor'").run("synthetic-owner");
    return result;
  }:realReducer;
  const mocks:Record<string,unknown>={
    "./case-command-contract":contract,
    "./case-commands":{...caseCommands,reduceCaseCommand:reducer},
    "./server-store":h.store,
    "./app-roles":{rolesForActor},
    "./intake-store":{getConsultationView:async()=>({run:null}),getIntakeCatalog:async()=>({catalog:{documents:[]}})},
    "./case-workflow-view":workflowView,
    "./case-response":{caseResponse:async(id:string)=>({case:await h.store.getCase(id)})},
    "./reference-runtime":referenceRuntime,
    "./calculator-tools":calculatorTools,
    "./execution-catalog":executionCatalog,
    "./execution-catalog.ts":executionCatalog,
    "./reference-release.json":{default:referenceRelease},
    "./domain":domain,
    "./legacy-case-command":legacyCommand,
    "./processing-readiness":processingReadiness,
  };
  return loadTs<{executeCaseCommand:(id:string,raw:unknown)=>Promise<CommandResponse>;executeLegacyCaseCommand:(id:string,body:Record<string,unknown>)=>Promise<CommandResponse>}>(root+"lib/case-command-store.ts",mocks);
}

async function grantCaseEditor(h:ReturnType<typeof setup>) {
  h.sqlite.prepare("INSERT INTO app_role_grants (actor_id,role,scope_id,status,effective_from,effective_to,granted_by,reason,policy_revision,created_at,revoked_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run("synthetic-owner","case_editor",h.data.context.id,"active","2000-01-01T00:00:00.000Z",null,"synthetic-admin","integration fixture",1,"2000-01-01T00:00:00.000Z",null);
  h.sqlite.prepare("INSERT INTO app_role_grants (actor_id,role,scope_id,status,effective_from,effective_to,granted_by,reason,policy_revision,created_at,revoked_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run("synthetic-owner","caseworker_review",h.data.context.id,"active","2000-01-01T00:00:00.000Z",null,"synthetic-admin","integration fixture",1,"2000-01-01T00:00:00.000Z",null);
}

test("command orchestration commits context, receipt and recompute job atomically and resolves same-ID retry", async () => {
  const h=setup();await grantCaseEditor(h);
  const service=commandService(h),before=await h.store.getCase(h.data.context.id);
  const raw={commandId:"orchestration-cmd-1",commandType:"context.update",payloadVersion:1,expectedRevision:before.context.revision,expectedStateFingerprint:await h.store.caseStateFingerprint(before),target:{},patch:{context:{asOf:"2026-10-28"}},reason:"integration edit"};
  const first=await service.executeCaseCommand(h.data.context.id,raw);
  assert.equal(first.committed,true);assert.equal(first.duplicate,false);
  assert.equal((await h.store.getCase(h.data.context.id)).context.asOf,"2026-10-28");
  assert.equal((h.sqlite.prepare("SELECT COUNT(*) AS n FROM case_mutation_receipts WHERE case_id=? AND command_id=?").get(h.data.context.id,raw.commandId) as {n:number}).n,1);
  assert.equal((h.sqlite.prepare("SELECT COUNT(*) AS n FROM events WHERE case_id=? AND type='case.command_committed'").get(h.data.context.id) as {n:number}).n,1);
  assert.equal((h.sqlite.prepare("SELECT COUNT(*) AS n FROM case_recompute_jobs WHERE case_id=?").get(h.data.context.id) as {n:number}).n,1);
  const retry=await service.executeCaseCommand(h.data.context.id,raw);assert.equal(retry.duplicate,true);
  await assert.rejects(()=>service.executeCaseCommand(h.data.context.id,{...raw,patch:{context:{asOf:"2026-10-27"}}}),/같은 명령 식별자/);
  const current=await h.store.getCase(h.data.context.id);
  await assert.rejects(()=>service.executeCaseCommand(h.data.context.id,{...raw,commandId:"orchestration-cmd-2",expectedRevision:current.context.revision,expectedStateFingerprint:fingerprint}),/상태가 바뀌었습니다/);
  h.sqlite.close();
});

test("document edit command loads field bases from the current writer manifest and invalidates prior export review",async()=>{
  const h=setup();await grantCaseEditor(h);
  const data=await h.store.getCase(h.data.context.id),artifact={id:"artifact-current",kind:"application",name:"current.docx",hash:"artifact-hash",status:"current"};
  const manifest={caseRevision:data.context.revision,mode:"final",requiredKinds:["application"],files:[artifact],reviews:{caseworker:null,lawyer:null}} as unknown as import("../lib/domain.ts").ExportManifest;
  const base={artifactId:artifact.id,artifactHash:artifact.hash,formCode:"D5100",fieldId:"statement",rowId:null,kind:"prose",value:"Generated statement",baseValueHash:"unused"};
  manifest.documentWriter={fieldBases:[base] as never} as never;
  manifest.reviews.caseworker={actor:"synthetic-owner",at:"2026-10-29T00:00:00Z",caseRevision:data.context.revision,manifestFingerprint:manifestFingerprint(manifest)};
  manifest.reviews.lawyer={actor:"synthetic-lawyer",at:"2026-10-29T00:01:00Z",caseRevision:data.context.revision,manifestFingerprint:manifestFingerprint(manifest)};
  data.exportManifest=manifest;
  h.sqlite.prepare("UPDATE cases SET payload=? WHERE id=?").run(JSON.stringify(data),data.context.id);
  const service=commandService(h),current=await h.store.getCase(data.context.id);
  const raw={commandId:"document-edit-command",commandType:"document.edit",payloadVersion:1,expectedRevision:current.context.revision,expectedStateFingerprint:await h.store.caseStateFingerprint(current),target:{artifactId:artifact.id,fieldId:"statement"},patch:{baseValue:base.value,value:"Human reviewed statement"},baseValueHash:await documentEditBaseHash({artifactId:artifact.id,fieldId:"statement",rowId:null,value:base.value}),reason:"clarified prose"};
  await service.executeCaseCommand(data.context.id,raw);
  const saved=await h.store.getCase(data.context.id);
  assert.equal(saved.workflowState?.documentEdits.at(-1)?.value,"Human reviewed statement");
  assert.equal(saved.workflowState?.documentEdits.at(-1)?.artifactId,artifact.id);
  assert.equal(saved.context.revision,current.context.revision+1);
  assert.equal(currentExportReviews(saved).caseworker,null,"a prose edit makes the previous generated manifest review non-current");
  h.sqlite.close();
});

test("role revocation during command reduction prevents the SQLite commit", async () => {
  const h=setup();await grantCaseEditor(h);
  const service=commandService(h,{revokeBeforeCommit:true}),before=await h.store.getCase(h.data.context.id);
  const raw={commandId:"revocation-cmd-1",commandType:"context.update",payloadVersion:1,expectedRevision:before.context.revision,expectedStateFingerprint:await h.store.caseStateFingerprint(before),target:{},patch:{context:{asOf:"2026-10-28"}},reason:"integration edit"};
  await assert.rejects(()=>service.executeCaseCommand(h.data.context.id,raw),/권한이 변경되었습니다/);
  assert.equal((await h.store.getCase(h.data.context.id)).context.asOf,before.context.asOf);
  assert.equal((h.sqlite.prepare("SELECT COUNT(*) AS n FROM case_mutation_receipts WHERE command_id=?").get(raw.commandId) as {n:number}).n,0);
  h.sqlite.close();
});

test("legacy changed-value review becomes an idempotent fact correction and leaves it unreviewed", async () => {
  const h=setup();await grantCaseEditor(h);
  const fact:import("../lib/domain.ts").Fact={id:"fact-original",logicalId:"fact-logical-1",version:1,subjectId:"applicant",key:"employment_note",value:"old wording",state:"extracted",recognition:"unreviewed",refs:[],validation:[]};
  const original=await h.store.getCase(h.data.context.id),data=structuredClone(original);data.facts.push({...fact});data.context.revision++;
  await h.store.saveCase(data,original.context.revision,original);
  const service=commandService(h),current=await h.store.getCase(h.data.context.id);
  const body={action:"review_fact",commandId:"legacy-correction-1",revision:current.context.revision,expectedStateFingerprint:await h.store.caseStateFingerprint(current),factId:fact.id,value:"corrected wording",state:"verified",recognition:"accepted",actor:"client-ignored",reason:"compare source and correct transcription"};
  const first=await service.executeLegacyCaseCommand(h.data.context.id,body);
  assert.equal(first.committed,true);
  const corrected=(await h.store.getCase(h.data.context.id)).facts.find(item=>item.logicalId===fact.logicalId&&item.version===2)!;
  assert.equal(corrected.value,"corrected wording");
  assert.equal(corrected.state,"extracted");
  assert.equal(corrected.recognition,"unreviewed");
  const retry=await service.executeLegacyCaseCommand(h.data.context.id,body);assert.equal(retry.duplicate,true);
  const originalReceiptRead=h.store.readCommandReceipt as (id:string,commandId:string)=>Promise<unknown>;
  let firstReceiptRead=true;
  h.store.readCommandReceipt=async(id:string,commandId:string)=>{
    // Simulate the initial read racing the commit. The next snapshot already
    // supersedes fact-original, while the subsequent receipt lookup sees it.
    if(firstReceiptRead){firstReceiptRead=false;return null;}
    return originalReceiptRead(id,commandId);
  };
  const racingRetry=await service.executeLegacyCaseCommand(h.data.context.id,body);
  assert.equal(racingRetry.duplicate,true);
  assert.equal((h.sqlite.prepare("SELECT COUNT(*) AS n FROM case_mutation_receipts WHERE case_id=? AND command_id=?").get(h.data.context.id,body.commandId) as {n:number}).n,1);
  await assert.rejects(()=>service.executeLegacyCaseCommand(h.data.context.id,{...body,value:"different correction"}),/같은 명령 식별자/);
  h.sqlite.close();
});

test("schema migration uses durable command CAS and one immutable receipt across retries",async()=>{
 const h=setup();await grantCaseEditor(h);
 const service=commandService(h),before=await h.store.getCase(h.data.context.id);
 const plan=await prepareCaseSchemaMigration(before,{caseId:before.context.id,expectedRevision:before.context.revision,expectedInputSha256:await canonicalSha256(before),migrationVersion:CASE_SCHEMA_MIGRATION_VERSION,mode:"deterministic"},[before.context.id]);
 const raw={commandId:"schema-migrate-1",commandType:"schema.migrate",payloadVersion:1,expectedRevision:before.context.revision,expectedStateFingerprint:await h.store.caseStateFingerprint(before),target:{},patch:{planId:plan.planId,sourceSha256:plan.sourceSha256,migrationVersion:plan.migrationVersion,mode:plan.mode},reason:"compare defaults-only migration preview"};
 const first=await service.executeCaseCommand(before.context.id,raw);assert.equal(first.committed,true);
 const after=await h.store.getCase(before.context.id),receipts=(after as typeof after&{caseSchemaMigrations:unknown[]}).caseSchemaMigrations;
 assert.equal(after.context.revision,before.context.revision+1);assert.deepEqual(after.facts,before.facts);assert.deepEqual(after.incomes,before.incomes);assert.deepEqual(after.exportManifest,before.exportManifest);assert.equal(receipts.length,1);
 assert.equal((await service.executeCaseCommand(before.context.id,raw)).duplicate,true);
 assert.equal((h.sqlite.prepare("SELECT COUNT(*) AS n FROM case_mutation_receipts WHERE case_id=?").get(before.context.id) as {n:number}).n,1);
 const fresh=await prepareCaseSchemaMigration(after,{caseId:after.context.id,expectedRevision:after.context.revision,expectedInputSha256:await canonicalSha256(after),migrationVersion:CASE_SCHEMA_MIGRATION_VERSION,mode:"deterministic"},[after.context.id]);
 await service.executeCaseCommand(after.context.id,{...raw,commandId:"schema-migrate-2",expectedRevision:after.context.revision,expectedStateFingerprint:await h.store.caseStateFingerprint(after),patch:{planId:fresh.planId,sourceSha256:fresh.sourceSha256,migrationVersion:fresh.migrationVersion,mode:fresh.mode}});
 assert.deepEqual((await h.store.getCase(after.context.id) as typeof after&{caseSchemaMigrations:unknown[]}).caseSchemaMigrations,receipts);
 await assert.rejects(()=>service.executeCaseCommand(after.context.id,{...raw,commandId:"schema-migrate-stale"}),/사건 상태가 바뀌었습니다/);
 h.sqlite.close();
});

test("source correction durably reprojects income and invalidates prior approval before recomputing",async()=>{
 const h=setup();await grantCaseEditor(h);const original=await h.store.getCase(h.data.context.id),seed=structuredClone(original);
 seed.facts=[{id:"wage-net",logicalId:"wage-net",version:1,subjectId:"wage-1",key:"income.net",value:"100",sourceUnit:"원",numeric:domain.normalizeMoney("100","원"),asOf:"2026-09-30",state:"verified",recognition:"unreviewed",refs:[],validation:[]}];
 seed.incomes=[{id:"wage-1",kind:"wage",label:"Synthetic wage",employer:"Synthetic employer",net:domain.normalizeMoney("100","원"),periodStart:"2026-09-01",periodEnd:"2026-09-30",amountBasis:"monthly",recognition:"accepted",factIds:["wage-net"]}];
 seed.context.incomePeriodReviewed=true;seed.context.revision++;
 await h.store.saveCase(seed,original.context.revision,original);
 const before=await h.store.getCase(seed.context.id),contract=loadTs<typeof import("../lib/case-command-contract.ts")>(root+"lib/case-command-contract.ts");
 const service=commandService(h),raw={commandId:"typed-correction-1",commandType:"fact.correct",payloadVersion:1,expectedRevision:before.context.revision,expectedStateFingerprint:await h.store.caseStateFingerprint(before),target:{factId:"wage-net"},patch:{value:"150"},baseValueHash:await contract.commandHash({value:"100",sourceUnit:"원"}),reason:"원문 금액을 대조한 전용 통합 시험"};
 assert.equal((await service.executeCaseCommand(seed.context.id,raw)).committed,true);
 const after=await h.store.getCase(seed.context.id),fact=domain.currentFacts(after).find(item=>item.logicalId==="wage-net")!;
 assert.equal(fact.value,"150");assert.equal(fact.recognition,"unreviewed");assert.equal(after.incomes[0].net?.amountWon,"150");assert.equal(after.incomes[0].recognition,"unreviewed");assert.deepEqual(after.incomes[0].factIds,[fact.id]);assert.equal(after.context.incomePeriodReviewed,false);
 const job=h.sqlite.prepare("SELECT status FROM case_recompute_jobs WHERE case_id=?").get(seed.context.id) as {status:string};assert.equal(job.status,"complete");
 const row=h.sqlite.prepare("SELECT payload FROM analyses WHERE case_id=? AND revision=? AND type='derived_evaluation' ORDER BY at DESC LIMIT 1").get(seed.context.id,after.context.revision) as {payload:string};assert.equal(JSON.parse(row.payload).status,"complete");
 assert.equal((await service.executeCaseCommand(seed.context.id,raw)).duplicate,true);h.sqlite.close();
});

test("court procedure lifecycle is appended through durable commands without duplicate correction tasks",async()=>{
 const h=setup();await grantCaseEditor(h);const original=await h.store.getCase(h.data.context.id),seed=structuredClone(original);
 seed.documents=[{id:"court-notice",name:"Synthetic court notice",sha256:"a".repeat(64),status:"active",pages:[1]}];seed.pages=[{documentId:"court-notice",page:1,role:"evidence",text:"Synthetic court history"}];seed.context.revision++;
 await h.store.saveCase(seed,original.context.revision,original);const service=commandService(h);
 for(const state of ["submitted","received","correction_requested","amended","approved","discontinued","discharged"]){
  const before=await h.store.getCase(seed.context.id),raw={commandId:`court-event-${state}`,commandType:"procedure.record",payloadVersion:1,expectedRevision:before.context.revision,expectedStateFingerprint:await h.store.caseStateFingerprint(before),target:{},patch:{state,occurredAt:"2026-10-28T10:00:00Z",sourceDocumentIds:["court-notice"],courtReference:"synthetic-court-case",artifactIds:[]},reason:"전용 시험에서 확인 문서를 연결하여 기록"};
  assert.equal((await service.executeCaseCommand(seed.context.id,raw)).committed,true);assert.equal((await service.executeCaseCommand(seed.context.id,raw)).duplicate,true);
 }
 const current=await h.store.getCase(seed.context.id);assert.equal(current.workflowState?.procedureEvents.length,7);assert.equal(current.workflowState?.tasks.filter(task=>task.type==="court_correction").length,1);assert.ok(current.workflowState?.procedureEvents.every(event=>event.sourceDocumentIds[0]==="court-notice"&&event.actor==="synthetic-owner"&&!!event.recordedAt));
 const raw={commandId:"court-event-no-proof",commandType:"procedure.record",payloadVersion:1,expectedRevision:current.context.revision,expectedStateFingerprint:await h.store.caseStateFingerprint(current),target:{},patch:{state:"amended",occurredAt:"2026-10-28T10:00:00Z",sourceDocumentIds:[],courtReference:null,artifactIds:[]},reason:"증거 없는 보정 제출은 거절"};
 await assert.rejects(()=>service.executeCaseCommand(seed.context.id,raw),/법원 절차 상태/);h.sqlite.close();
});
