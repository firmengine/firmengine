import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync,type SQLInputValue } from "node:sqlite";
import { readFileSync,readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { createCase } from "../lib/domain.ts";
import { CURRENT_RULESET,RISK_CATALOG } from "../lib/legal-rules.ts";
import { executeCaseNodes } from "../lib/case-execution.ts";
import { persistCaseCalculationFeatures } from "../lib/case-calculation-feature-store.ts";
import { persistCaseLawgraphReview,listCaseLawgraphReview,automatedDraftEligibility,AUTOMATIC_DRAFT_REQUIRED_OUTPUTS,type PersistCaseLawgraphReviewInput,type StoredLegalCheck } from "../lib/case-lawgraph-store.ts";

const checks=():StoredLegalCheck[]=>RISK_CATALOG.map(x=>({id:x.id,status:"pass",reason:"Synthetic unit-test condition only",factIds:[],ruleIds:[],missingDocuments:[],nextAction:""}));
function setup(){
  const sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys=ON");
  for(const name of readdirSync(new URL("../drizzle",import.meta.url)).filter(n=>/^\d+.*\.sql$/.test(n)).sort())sqlite.exec(readFileSync(new URL("../drizzle/"+name,import.meta.url),"utf8"));
  const db={prepare(sql:string){let values:SQLInputValue[]=[];const s={bind(...args:SQLInputValue[]){values=args;return s;},async first<T>(){return sqlite.prepare(sql).get(...values) as T??null;},async all<T>(){return{results:sqlite.prepare(sql).all(...values) as T[]};},async run(){const r=sqlite.prepare(sql).run(...values);return{meta:{changes:Number(r.changes)}};}};return s;},async batch(statements:Array<{run():Promise<unknown>}>){sqlite.exec("BEGIN IMMEDIATE");try{const out=[];for(const s of statements)out.push(await s.run());sqlite.exec("COMMIT");return out;}catch(e){sqlite.exec("ROLLBACK");throw e;}}} as unknown as D1Database;
  const version=(caseId:string)=>(sqlite.prepare("SELECT data_version FROM case_data_change_state WHERE case_id=?").get(caseId) as {data_version:number}).data_version;
  const initialize=async(caseId="synthetic-a")=>{
    const data=createCase("Synthetic legal review",caseId,"2026-10-29");data.context.ruleReleaseId=CURRENT_RULESET.id;
    sqlite.prepare("INSERT INTO cases(id,name,owner,revision,payload,created_at,updated_at,storage_token) VALUES(?,?,?,?,?,'at','at','token')").run(caseId,data.context.caseName,"owner",1,JSON.stringify(data));
    const inputSha256=createHash("sha256").update(JSON.stringify(data)).digest("hex"),dataVersion=version(caseId);
    const calculation=await persistCaseCalculationFeatures(db,{caseId,dataVersion,caseRevision:1,inputSha256,execution:executeCaseNodes(data)});
    const input:PersistCaseLawgraphReviewInput={caseId,dataVersion,caseRevision:1,calculationRunId:calculation.runId,inputSha256,model:"gpt-6.1-terra",checks:checks(),summary:"Synthetic review, not a legal conclusion",complete:true};
    return input;
  };
  return{sqlite,db,version,initialize,close:()=>sqlite.close()};
}

test("partial review retains conditions without falsely declaring completion or draft eligibility",async()=>{
  const h=setup();try{
    const input=await h.initialize(),partial={...input,checks:input.checks.slice(0,6),complete:false};
    const out=await persistCaseLawgraphReview(h.db,partial);assert.equal(out.complete,false);assert.equal(out.status,"partial");
    const view=await listCaseLawgraphReview(h.db,{caseId:input.caseId});assert.equal(view.checks.length,6);assert.equal(view.headStale,false);
    const gate=automatedDraftEligibility({checks:partial.checks,complete:false,calculationHeadCurrent:true,engineCanGenerateDraft:true,requiredCalculationFields:AUTOMATIC_DRAFT_REQUIRED_OUTPUTS.map(outputName=>({outputName,value:"0"}))});
    assert.equal(gate.eligible,false);assert.ok(gate.reasons.includes("LEGAL_REVIEW_INCOMPLETE"));assert.equal(gate.canFinalize,false);
    await assert.rejects(persistCaseLawgraphReview(h.db,{...partial,complete:true}),/LEGAL_REVIEW_COMPLETE_COVERAGE_REQUIRED/);
  }finally{h.close();}
});

test("complete conditions and per-creditor repeating document fields preserve arrays, null, zero and false with current calculation dependency",async()=>{
  const h=setup();try{
    const input=await h.initialize(),before=h.version(input.caseId);
    input.documentFields=[
      {formCode:"D5106",artifactKind:"creditors",token:"creditor.principal",subjectId:"debt-a",rowOrdinal:0,value:"0",valueKind:"derived",sourceFactIds:["fact-a"],citation:{documentId:"source-a",page:1}},
      {formCode:"D5106",artifactKind:"creditors",token:"creditor.principal",subjectId:"debt-b",rowOrdinal:1,value:null,valueKind:"derived"},
      {formCode:"D5110",artifactKind:"repayment_plan",token:"synthetic.array",subjectId:"debt-a",rowOrdinal:0,value:["0",null,false],valueKind:"source"},
    ];
    const a=await persistCaseLawgraphReview(h.db,input),b=await persistCaseLawgraphReview(h.db,input);assert.equal(a.runId,b.runId);assert.equal(a.checks,RISK_CATALOG.length);
    const view=await listCaseLawgraphReview(h.db,{caseId:input.caseId,expectedDataVersion:input.dataVersion,limit:500});
    assert.equal(view.complete,true);assert.equal(view.status,"conditions_passed");assert.equal(view.headStale,false);
    assert.deepEqual(view.documentFields.map(f=>f.value),["0",null,["0",null,false]]);assert.deepEqual(view.documentFields.slice(0,2).map(f=>f.subjectId),["debt-a","debt-b"]);
    assert.equal(view.courtApprovalInferred,false);assert.equal(view.canFinalize,false);assert.equal(h.version(input.caseId),before);
    assert.deepEqual(h.sqlite.prepare("PRAGMA foreign_key_check").all(),[]);
  }finally{h.close();}
});

test("draft eligibility requires all conditions, current calculation, engine gate, known required values and no explicit fail",()=>{
  const input={checks:checks(),complete:true,calculationHeadCurrent:true,engineCanGenerateDraft:true,requiredCalculationFields:AUTOMATIC_DRAFT_REQUIRED_OUTPUTS.map(outputName=>({outputName,value:"0",status:"provisional"}))};
  const candidate=automatedDraftEligibility(input);assert.equal(candidate.eligible,true);assert.equal(candidate.mode,"draft");assert.equal(candidate.courtApprovalInferred,false);assert.equal(candidate.canFinalize,false);
  assert.equal(automatedDraftEligibility({...input,calculationHeadCurrent:false}).eligible,false);
  assert.equal(automatedDraftEligibility({...input,engineCanGenerateDraft:false}).eligible,false);
  assert.equal(automatedDraftEligibility({...input,requiredCalculationFields:input.requiredCalculationFields.map((f,i)=>i?f:{...f,value:null})}).eligible,false);
  assert.equal(automatedDraftEligibility({...input,checks:input.checks.map((c,i)=>i?c:{...c,status:"fail"})}).eligible,false);
  assert.equal(automatedDraftEligibility({...input,explicitFailures:["source conflict"]}).eligible,false);
});

test("stale source versions preserve review history and never replace current review head",async()=>{
  const h=setup();try{
    const input=await h.initialize(),first=await persistCaseLawgraphReview(h.db,input);
    h.sqlite.prepare("UPDATE cases SET revision=revision+1 WHERE id=?").run(input.caseId);
    await assert.rejects(persistCaseLawgraphReview(h.db,{...input,summary:"Synthetic late result"}),/LEGAL_REVIEW_VERSION_MISMATCH/);
    const head=h.sqlite.prepare("SELECT review_run_id FROM case_legal_review_heads WHERE case_id=?").get(input.caseId) as {review_run_id:string};assert.equal(head.review_run_id,first.runId);
    assert.equal((h.sqlite.prepare("SELECT COUNT(*) AS n FROM case_legal_review_runs").get() as {n:number}).n,2);
    assert.equal((await listCaseLawgraphReview(h.db,{caseId:input.caseId})).headStale,true);
    await assert.rejects(listCaseLawgraphReview(h.db,{caseId:input.caseId,expectedDataVersion:input.dataVersion}),/LEGAL_REVIEW_VERSION_MISMATCH/);
  }finally{h.close();}
});

test("a replaced calculation dependency and foreign calculation refs cannot authorize a new current review",async()=>{
  const h=setup();try{
    const input=await h.initialize(),other=await h.initialize("synthetic-b");
    await persistCaseLawgraphReview(h.db,input);
    await assert.rejects(persistCaseLawgraphReview(h.db,{...input,calculationRunId:other.calculationRunId}),/LEGAL_REVIEW_CALCULATION_BINDING_MISMATCH/);
    const foreign=h.sqlite.prepare("SELECT id FROM case_calculation_features WHERE run_id=? LIMIT 1").get(other.calculationRunId) as {id:string};
    await assert.rejects(persistCaseLawgraphReview(h.db,{...input,documentFields:[{formCode:"D5106",artifactKind:"creditors",token:"creditor.principal",value:"0",valueKind:"derived",calcFeatureRefs:[foreign.id]}]}),/DOCUMENT_FIELD_CALCULATION_REFERENCE_MISMATCH/);
    h.sqlite.prepare("UPDATE case_calculation_heads SET run_id=? WHERE case_id=?").run(other.calculationRunId,input.caseId);
    await assert.rejects(persistCaseLawgraphReview(h.db,{...input,summary:"Synthetic wrong current calculation"}),/LEGAL_REVIEW_VERSION_MISMATCH/);
    assert.equal((await listCaseLawgraphReview(h.db,{caseId:other.caseId})).checks.length,0);
  }finally{h.close();}
});

test("automatic draft run identity is unique per review and migrations are safely repeatable",async()=>{
  const h=setup();try{
    const input=await h.initialize(),review=await persistCaseLawgraphReview(h.db,input),before=h.version(input.caseId);
    for(const id of ["draft-1","draft-2"])h.sqlite.prepare("INSERT OR IGNORE INTO case_automatic_document_runs (id,case_id,legal_review_run_id,data_version,case_revision,status,artifacts_json,created_at,updated_at) VALUES (?,?,?,?,?,'pending','[]','at','at')").run(id,input.caseId,review.runId,input.dataVersion,input.caseRevision);
    assert.equal((h.sqlite.prepare("SELECT COUNT(*) AS n FROM case_automatic_document_runs").get() as {n:number}).n,1);assert.equal(h.version(input.caseId),before);
    h.sqlite.exec(readFileSync(new URL("../drizzle/0012_case_lawgraph_reviews.sql",import.meta.url),"utf8"));
  }finally{h.close();}
});
