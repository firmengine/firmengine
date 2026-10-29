import test from "node:test";
import assert from "node:assert/strict";
import { FORM_CONTRACTS, buildFormContractRegistry } from "../lib/form-contracts.ts";
import { evaluateDocumentPreflight } from "../lib/document-preflight.ts";
import { mergeDocumentEdits, computeDocumentIdentity, type DocumentEdit } from "../lib/document-edits.ts";
import { finalWorkflowBlockers } from "../lib/document-workflow-gate.ts";
import { buildDocumentFieldBases } from "../lib/document-field-bases.ts";
import { commandHash } from "../lib/case-command-contract.ts";
import type { FormBindings } from "../lib/form-mapping.ts";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import { createCase } from "../lib/domain.ts";
import { buildFormBindings } from "../lib/form-mapping.ts";
import type { CalculationResult } from "../lib/assessment.ts";
const identity={evaluationId:"eval-1",evaluationResultHash:"a".repeat(64),referenceBundleHash:"b".repeat(64),templateHash:FORM_CONTRACTS.D5106.templateHash,documentEditsHash:"c".repeat(64)};
test("final workflow gate blocks projection and active required obligations but preserves legacy cases",()=>{
 assert.deepEqual(finalWorkflowBlockers({workflowAdopted:false,projectionBlockers:[{}],requirements:[{requirementId:"r",required:true,requirementStatus:"missing"}]}),[]);
 const blocked=finalWorkflowBlockers({workflowAdopted:true,projectionBlockers:[{}],requirements:[
  {requirementId:"ok",required:true,requirementStatus:"satisfied"},
  {requirementId:"missing",required:true,requirementStatus:"eligible_for_confirmation"},
  {requirementId:"retired",required:true,retired:true,requirementStatus:"retired"},
  {requirementId:"recommended",required:false,requirementStatus:"missing"},
 ],legalChecks:[{checkId:"old",state:"stale",disposition:"rejected"},{checkId:"current",state:"current",disposition:"needs_review"}]});
 assert.deepEqual(blocked,["projection:1","requirement:missing:eligible_for_confirmation","legal:current:needs_review"]);
 assert.deepEqual(finalWorkflowBlockers({workflowAdopted:true,requirements:[{requirementId:"waived",required:true,requirementStatus:"waived_by_review"},{requirementId:"na",required:true,requirementStatus:"not_applicable_confirmed"}],legalChecks:[{checkId:"resolved",state:"current",disposition:"accepted"}]}),[]);
});
test("editable field bases bind only current artifact hashes and stable repeat row IDs",async()=>{
 const data=createCase("field bases","field-bases","2026-10-29"),debtIds=["debt-long-1","debt-long-2"];
 const execution={formBindings:{scalars:{statement:"현재 문안"},rows:{creditor:[{number:"1"},{number:"2"}]}},assessment:{calculation:{debtRows:debtIds.map(id=>({id}))}}} as any;
 const bases=await buildDocumentFieldBases({data,execution,formResults:[{artifactKind:"creditors",formCode:"D5106"}],artifacts:[{id:"artifact-current",hash:"e".repeat(64),kind:"creditors"},{id:"not-a-form",hash:"f".repeat(64),kind:"rendered_json"}]});
 const numberBases=bases.filter(base=>base.fieldId==="creditor.number");assert.deepEqual(numberBases.map(base=>base.rowId),debtIds);assert.ok(numberBases.every(base=>base.artifactId==="artifact-current"&&base.artifactHash==="e".repeat(64)));
 for(const base of bases)assert.equal(base.baseValueHash,await commandHash({artifactId:base.artifactId,fieldId:base.fieldId,rowId:base.rowId,value:base.value}));
 assert.ok(!bases.some(base=>base.artifactId==="not-a-form"));
});
test("contract registry covers every current DOCX token and distinguishes app requirements from portal parity",async()=>{
 const registry=buildFormContractRegistry();assert.equal(Object.keys(registry).length,18);
 for(const contract of Object.values(registry)) {
  const path=`public/templates/${contract.code}.docx`,bytes=new Uint8Array(await readFile(path)),digest=await crypto.subtle.digest("SHA-256",bytes),actualHash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
  assert.equal(actualHash,contract.templateHash,`template hash ${contract.code}`);
  const archive=unzipSync(bytes);
  const xml=Object.entries(archive).filter(([name])=>name.startsWith("word/")&&name.endsWith(".xml")).map(([,bytes])=>strFromU8(bytes)).join("\n");
  const actual=[...new Set([...xml.matchAll(/\{\{([\w.]+)\}\}/g)].map(match=>match[1]))].sort();
  assert.deepEqual(contract.fields.map(f=>f.token).sort(),actual,`token inventory ${contract.code}`);
 }
 assert.ok(registry.D5106.fields.some(f=>f.token==="creditor.principal"));
 assert.ok(registry.D5106.repeatGroups.some(g=>g.id==="creditor"&&g.fields.includes("principal")&&g.identitySource==="CaseData debtId"));
 assert.equal(registry.D5106.fields.find(f=>f.token==="client_name")?.requiredness,"required");
 assert.ok(registry.D5106.fields.filter(f=>f.token!=="client_name").every(f=>f.requiredness!=="required"));
});
test("preflight consumes generated form bindings and accepts numeric zero as a supplied value",async()=>{
 const data=createCase("Synthetic form preflight","form-preflight","2026-10-29");data.context.applicant={name:"김하늘"} as typeof data.context.applicant;
 const calculation={debtRows:[],allocations:[],incomeGroups:[],debtPrincipalWon:"0",debtInterestWon:"0",securedDebtWon:"0",unsecuredDebtWon:"0",monthlyIncomeWon:"0",recognizedLivingCostWon:"0",disposableIncomeWon:"0",ordinaryRepaymentBudgetWon:"0",monthlyPaymentWon:"0",planTotalWon:"0",liquidationValueWon:"0",presentValueWon:"0"} as unknown as CalculationResult;
 const bindings=buildFormBindings(data,calculation);assert.equal(bindings.scalars.client_name,"김하늘");assert.equal(bindings.scalars.total_principal,"0");
 const contract={...FORM_CONTRACTS.D5100,fields:FORM_CONTRACTS.D5100.fields.filter(f=>["client_name","total_principal"].includes(f.token)).map(f=>({...f,requiredness:(f.token==="client_name"?"required":"optional") as "required"|"optional"}))};
 const preflight=await evaluateDocumentPreflight({formCode:"D5100",bindings,identity:{...identity,templateHash:FORM_CONTRACTS.D5100.templateHash},mode:"final",contract});
 assert.equal(preflight.status,"ready",JSON.stringify(preflight.blockers));
});
test("preflight accepts long reordered repeat rows and creates stable fingerprint",async()=>{
 const rows=Array.from({length:400},(_,i)=>({number:String(400-i),entity:`Creditor ${i}`,principal:String(i*1000)}));
 const bindings:FormBindings={scalars:{client_name:"Applicant",total_principal:String(399*400/2*1000)},rows:{creditor:rows}};
 const contract={...FORM_CONTRACTS.D5106,fields:FORM_CONTRACTS.D5106.fields.filter(f=>["client_name","total_principal","creditor.number","creditor.entity","creditor.principal"].includes(f.token)).map(f=>({...f,requiredness:"optional" as const}))};
 const result=await evaluateDocumentPreflight({formCode:"D5106",bindings,identity,mode:"draft",contract});
 assert.equal(result.status,"ready");assert.equal(result.blockers.length,0);assert.match(result.contractHash,/^[a-f0-9]{64}$/);
 const wrongTotal=await evaluateDocumentPreflight({formCode:"D5106",bindings:{...bindings,scalars:{...bindings.scalars,total_principal:"0"}},identity,mode:"final",contract});
 assert.ok(wrongTotal.blockers.some(issue=>issue.code==="REPEAT_ROW_TOTAL_MISMATCH"));
});
test("missing required values and unknown repeat fields block final preflight",async()=>{
 const contract={...FORM_CONTRACTS.D5106,fields:[{token:"client_name",kind:"source" as const,requiredness:"required" as const,source:"public-template-token" as const}],repeatGroups:[{id:"creditor",fields:["number"],identitySource:"CaseData debtId"}]};
 const bindings:FormBindings={scalars:{client_name:"[확인 필요]",alien:"bad"},rows:{creditor:[{number:"1",secret:"x"}]}};
 const result=await evaluateDocumentPreflight({formCode:"D5106",bindings,identity,mode:"final",contract});
 assert.equal(result.status,"blocked");assert.ok(result.blockers.some(x=>x.code==="FIELD_UNRESOLVED"));assert.ok(result.blockers.some(x=>x.code==="UNKNOWN_TOKEN"));assert.ok(result.blockers.some(x=>x.code==="UNKNOWN_ROW_TOKEN"));
});
test("preflight accepts zero, warns on unknown applicability, and blocks only application required fields",async()=>{
 const contract={...FORM_CONTRACTS.D5106,fields:[
  {token:"client_name",kind:"source" as const,requiredness:"required" as const,source:"app"},
  {token:"creditor.entity",kind:"source" as const,requiredness:"conditional" as const,source:"app",requiredWhen:"each emitted row"},
  {token:"creditor.principal",kind:"derived" as const,requiredness:"conditional" as const,source:"app",requiredWhen:"each emitted row"},
  {token:"creditor.phone",kind:"source" as const,requiredness:"unverified" as const,source:"template"},
  {token:"total_principal",kind:"derived" as const,requiredness:"optional" as const,source:"app"},
 ],repeatGroups:[{id:"creditor",fields:["entity","principal","phone"],identitySource:"CaseData debtId"}]};
 const bindings:FormBindings={scalars:{client_name:"김하늘",total_principal:"0"},rows:{creditor:[{entity:"김하늘의 긴 한글 채권자 법인명 주식회사 동해금융",principal:"0",phone:"[확인 필요]"}]}};
 const result=await evaluateDocumentPreflight({formCode:"D5106",bindings,identity,mode:"final",contract});
 assert.equal(result.status,"ready");assert.equal(result.blockers.length,0);assert.ok(result.warnings.some(w=>w.code==="FIELD_UNRESOLVED"&&w.token==="creditor.phone"));
 const draft=await evaluateDocumentPreflight({formCode:"D5106",bindings:{...bindings,rows:{creditor:[{entity:"[확인 필요]",principal:"0",phone:"[확인 필요]"}]}},identity,mode:"draft",contract});
 assert.equal(draft.status,"draft_with_unresolved");assert.ok(draft.warnings.some(w=>w.token==="creditor.entity"));
 const missing=await evaluateDocumentPreflight({formCode:"D5106",bindings:{...bindings,scalars:{client_name:"[확인 필요]",total_principal:"0"}},identity,mode:"final",contract});
 assert.equal(missing.status,"blocked");assert.ok(missing.blockers.some(b=>b.token==="client_name"));
});
test("three-way edits preserve prose, conflict on concurrent edits, orphan deleted rows and redirect amount edits",()=>{
 const base:DocumentEdit[]=[{fieldId:"statement",value:"base",kind:"prose"},{fieldId:"principal",rowId:"d1",value:"100",kind:"source"},{fieldId:"note",rowId:"d1",value:"old",kind:"prose"},{fieldId:"memo",value:"before",kind:"prose"}];
 const user:DocumentEdit[]=[{fieldId:"statement",value:"user revision",kind:"prose"},{fieldId:"principal",rowId:"d1",value:"120",kind:"source"},{fieldId:"note",rowId:"d1",value:"my note",kind:"prose"},{fieldId:"memo",value:"user memo",kind:"prose"}];
 const next:DocumentEdit[]=[{fieldId:"statement",value:"base",kind:"prose"},{fieldId:"principal",rowId:"d1",value:"110",kind:"source"},{fieldId:"memo",value:"new generated",kind:"prose"}];
 const merged=mergeDocumentEdits(base,user,next);
 assert.deepEqual(merged.overlays.map(e=>e.fieldId),["statement"]);assert.equal(merged.conflicts.length,2);assert.equal(merged.orphaned[0]?.rowId,"d1");assert.equal(merged.redirectedCommands[0]?.fieldId,"principal");
});
test("stable debt IDs preserve prose across reordered rows and never attach it by row number",()=>{
 const base:DocumentEdit[]=[{fieldId:"note",rowId:"debt-A",value:"검토 문장",kind:"prose"},{fieldId:"note",rowId:"debt-B",value:"다른 채권 문장",kind:"prose"}];
 const user:DocumentEdit[]=[{fieldId:"note",rowId:"debt-A",value:"수정된 한국어 설명",kind:"prose"},{fieldId:"note",rowId:"debt-B",value:"다른 채권 문장",kind:"prose"}];
 const next:DocumentEdit[]=[{fieldId:"note",rowId:"debt-B",value:"다른 채권 문장",kind:"prose"},{fieldId:"note",rowId:"debt-A",value:"검토 문장",kind:"prose"}];
 const merged=mergeDocumentEdits(base,user,next);assert.deepEqual(merged.overlays.map(e=>[e.rowId,e.value]),[["debt-A","수정된 한국어 설명"]]);assert.equal(merged.conflicts.length,0);assert.equal(merged.orphaned.length,0);
});
test("artifact identity includes evaluation, template, parent artifact and prose edit digest but excludes redirected source edits",async()=>{
 const base={formId:"D5100",templateHash:"a",evaluationId:"e1",evaluationResultHash:"b",documentEdits:[],requiredKinds:["application"]};
 const a=await computeDocumentIdentity(base),b=await computeDocumentIdentity({...base,evaluationId:"e2"}),c=await computeDocumentIdentity({...base,documentEdits:[{fieldId:"statement",value:"edited",kind:"prose"}]}),d=await computeDocumentIdentity({...base,parentArtifactId:"artifact-1"}),e=await computeDocumentIdentity({...base,documentEdits:[{fieldId:"principal",rowId:"debt-1",value:"120",kind:"source"}]});
 assert.notEqual(a.artifactIdentityHash,b.artifactIdentityHash);assert.notEqual(a.artifactIdentityHash,c.artifactIdentityHash);assert.notEqual(a.artifactIdentityHash,d.artifactIdentityHash);assert.equal(a.artifactIdentityHash,e.artifactIdentityHash);
});
