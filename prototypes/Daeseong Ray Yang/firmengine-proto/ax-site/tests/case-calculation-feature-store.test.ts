import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync,type SQLInputValue } from "node:sqlite";
import { readFileSync,readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { createCase,applyExtraction } from "../lib/domain.ts";
import { projectPage,type PageRead } from "../lib/extraction.ts";
import { executeCaseNodes } from "../lib/case-execution.ts";
import { CURRENT_RULESET } from "../lib/legal-rules.ts";
import { persistCaseCalculationFeatures,listCaseCalculationFeatures,calculationFeatureRows,type PersistCaseCalculationFeaturesInput } from "../lib/case-calculation-feature-store.ts";

function caseData(id="case-a",withDebt=false){
  let data=createCase("Synthetic calculation rows",id,"2026-10-29");data.context.ruleReleaseId=CURRENT_RULESET.id;
  if(withDebt){
    const hash="a".repeat(64);data.documents.push({id:"source-"+id,name:"Synthetic.pdf",sha256:hash,status:"active",pages:[1]});
    const field=(key:string,value:string,unit:string|null=null)=>({key,label:key,value,unit,quote:`${key}: ${value}`,confidence:"clear" as const,bbox:[0.1,0.1,0.3,0.2],sourceState:"present" as const});
    const read:PageRead={documentType:"debt_certificate",complete:true,warnings:[],records:[{category:"debt",label:"Synthetic obligation",fields:[field("creditor","Synthetic creditor"),field("principal","1000","KRW"),field("interest","0","KRW"),field("as_of","2026-10-29")]}]};
    data=applyExtraction(data,projectPage(read,"source-"+id,1,hash));
  }
  return data;
}
function setup(){
  const sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys=ON");
  for(const name of readdirSync(new URL("../drizzle",import.meta.url)).filter(n=>/^\d+.*\.sql$/.test(n)).sort())sqlite.exec(readFileSync(new URL("../drizzle/"+name,import.meta.url),"utf8"));
  let beforeBatch:(()=>void)|undefined;
  const db={prepare(sql:string){let values:SQLInputValue[]=[];const s={bind(...args:SQLInputValue[]){values=args;return s;},async first<T>(){return sqlite.prepare(sql).get(...values) as T??null;},async all<T>(){return{results:sqlite.prepare(sql).all(...values) as T[]};},async run(){const r=sqlite.prepare(sql).run(...values);return{meta:{changes:Number(r.changes)}};}};return s;},async batch(statements:Array<{run():Promise<unknown>}>){beforeBatch?.();beforeBatch=undefined;sqlite.exec("BEGIN IMMEDIATE");try{const out=[];for(const s of statements)out.push(await s.run());sqlite.exec("COMMIT");return out;}catch(e){sqlite.exec("ROLLBACK");throw e;}}} as unknown as D1Database;
  const save=(data:ReturnType<typeof createCase>)=>{
    sqlite.prepare("INSERT INTO cases (id,name,owner,revision,payload,created_at,updated_at,storage_token) VALUES (?,?,?,?,?,?,?,?)").run(data.context.id,data.context.caseName,"owner",data.context.revision,JSON.stringify(data),"at","at","token");
    for(const d of data.documents)sqlite.prepare("INSERT INTO documents (id,case_id,name,sha256,page_count,ready,created_at) VALUES (?,?,?,?,?,1,'at')").run(d.id,data.context.id,d.name,d.sha256,d.pages.length);
  };
  const version=(id:string)=>(sqlite.prepare("SELECT data_version FROM case_data_change_state WHERE case_id=?").get(id) as {data_version:number}).data_version;
  const args=(data:ReturnType<typeof createCase>):PersistCaseCalculationFeaturesInput=>({caseId:data.context.id,dataVersion:version(data.context.id),caseRevision:data.context.revision,inputSha256:createHash("sha256").update(JSON.stringify(data)).digest("hex"),execution:executeCaseNodes(data),sourceHeads:{sourceRevision:data.context.revision,documentIds:data.documents.map(d=>d.id)}});
  return{sqlite,db,save,version,args,race:(id:string)=>{beforeBatch=()=>sqlite.prepare("UPDATE cases SET revision=revision+1 WHERE id=?").run(id);},close:()=>sqlite.close()};
}
test("missing engine outputs remain null with explicit status; metadata false is preserved and derived writes do not reset source watch",async()=>{
  const h=setup();try{
    const data=caseData();h.save(data);const input=h.args(data),before=h.version(data.context.id);
    const receipt=await persistCaseCalculationFeatures(h.db,input),out=await listCaseCalculationFeatures(h.db,{caseId:data.context.id,expectedDataVersion:before,limit:500});
    assert.equal(h.version(data.context.id),before);assert.equal(out.headStale,false);assert.equal(out.runId,receipt.runId);
    const missing=out.features.find(f=>f.outputName==="disposableIncomeWon")!;
    assert.equal(missing.value,null);assert.equal(missing.valueWon,null);assert.ok(["missing","blocked","conflict"].includes(missing.status));
    const approvalScope=out.features.find(f=>f.outputName==="courtApprovalInferred")!;assert.equal(approvalScope.value,false);assert.equal(approvalScope.status,"not_applicable");
    assert.equal(out.courtApprovalInferred,false);assert.equal(out.currentCaseRevision,data.context.revision);
    assert.deepEqual(h.sqlite.prepare("PRAGMA foreign_key_check").all(),[]);
  }finally{h.close();}
});
test("available provisional debt components and zero interest are persisted from the existing engine with formula and fact lineage",async()=>{
  const h=setup();try{
    const data=caseData("case-debt",true);h.save(data);const input=h.args(data),original=JSON.stringify(input.execution);
    const direct=input.execution.assessment.calculation.debtRows[0];assert.equal(direct.totalWon,"1000");
    await persistCaseCalculationFeatures(h.db,input);assert.equal(JSON.stringify(input.execution),original);
    const out=await listCaseCalculationFeatures(h.db,{caseId:data.context.id,limit:500});
    const total=out.features.find(f=>f.outputName==="debtRows.totalWon")!;assert.equal(total.value,direct.totalWon);assert.equal(total.status,"provisional");assert.ok(total.sourceFactIds.length>0);
    const interest=out.features.find(f=>f.outputName==="debtRows.interestWon")!;assert.equal(interest.value,"0");assert.equal(interest.valueWon,"0");
    const trace=out.features.find(f=>f.outputName==="traces.resultWon"&&f.subjectId===direct.id)!;
    assert.equal(trace.value,"1000");assert.ok(trace.formula.length>0);assert.ok(trace.sourceFactIds.length>0);assert.ok(trace.inputRefs.traceInputs.length>0);
    assert.equal(out.features.filter(f=>f.outputName==="totalDebtWon")[0].value,null,"incomplete inventory is not replaced by sum of available rows");
  }finally{h.close();}
});
test("identical result is idempotent, source versions retain immutable history, and case filters isolate results",async()=>{
  const h=setup();try{
    const a=caseData("case-a",true),b=caseData("case-b");h.save(a);h.save(b);
    const initial=h.args(a),one=await persistCaseCalculationFeatures(h.db,initial),two=await persistCaseCalculationFeatures(h.db,initial);assert.equal(one.runId,two.runId);
    assert.equal((h.sqlite.prepare("SELECT COUNT(*) AS n FROM case_calculation_runs").get() as {n:number}).n,1);
    assert.equal((await listCaseCalculationFeatures(h.db,{caseId:b.context.id})).totalFeatures,0);
    h.sqlite.prepare("UPDATE cases SET revision=revision+1 WHERE id=?").run(a.context.id);a.context.revision++;
    const next=h.args(a),three=await persistCaseCalculationFeatures(h.db,next);assert.notEqual(one.runId,three.runId);
    assert.equal((h.sqlite.prepare("SELECT COUNT(*) AS n FROM case_calculation_runs").get() as {n:number}).n,2);
    const view=await listCaseCalculationFeatures(h.db,{caseId:a.context.id,limit:1});assert.equal(view.runId,three.runId);assert.equal(view.nextOffset,1);assert.equal(view.features.length,1);
  }finally{h.close();}
});
test("stale data-version/revision results retain history but cannot advance the active head",async()=>{
  const h=setup();try{
    const data=caseData("case-race",true);h.save(data);const first=h.args(data),receipt=await persistCaseCalculationFeatures(h.db,first);
    const changed={...first,inputSha256:"d".repeat(64)};h.race(data.context.id);
    await assert.rejects(persistCaseCalculationFeatures(h.db,changed),/CALCULATION_VERSION_MISMATCH/);
    const head=h.sqlite.prepare("SELECT run_id FROM case_calculation_heads WHERE case_id=?").get(data.context.id) as {run_id:string};assert.equal(head.run_id,receipt.runId);
    assert.equal((h.sqlite.prepare("SELECT COUNT(*) AS n FROM case_calculation_runs").get() as {n:number}).n,2);
    const stale=await listCaseCalculationFeatures(h.db,{caseId:data.context.id});assert.equal(stale.headStale,true);
    await assert.rejects(listCaseCalculationFeatures(h.db,{caseId:data.context.id,expectedDataVersion:first.dataVersion}),/CALCULATION_VERSION_MISMATCH/);
  }finally{h.close();}
});
test("execution identity mismatches and out-of-bounds reads fail closed; no separate arithmetic is introduced",async()=>{
  const h=setup();try{
    const data=caseData();h.save(data);const input=h.args(data);
    await assert.rejects(persistCaseCalculationFeatures(h.db,{...input,caseId:"foreign"}),/CALCULATION_EXECUTION_BINDING_MISMATCH/);
    const features=calculationFeatureRows(input.execution);assert.ok(features.some(f=>f.outputPath.startsWith("/proposals/")));
    assert.ok(features.every(f=>f.value!==undefined));
    await assert.rejects(listCaseCalculationFeatures(h.db,{caseId:data.context.id,limit:501}),/INVALID_CALCULATION_FEATURE_QUERY/);
    h.sqlite.exec(readFileSync(new URL("../drizzle/0011_case_calculation_features.sql",import.meta.url),"utf8"));
  }finally{h.close();}
});
