import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {DatabaseSync,type SQLInputValue} from "node:sqlite";
import {createCase,normalizeMoney,type CaseData,type Fact} from "../lib/domain.ts";
import {CURRENT_RULESET} from "../lib/legal-rules.ts";
import {caseDataQuietWindow,recomputeCaseDataUpdate,drainDueCaseDataUpdates} from "../lib/case-data-recompute.ts";
import {getCaseDataUpdateState} from "../lib/case-data-watch.ts";

const START=Date.parse("2026-10-29T00:00:00Z"),directory=new URL("../drizzle/",import.meta.url);
function setup(withInputs=true){
  const sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys=ON");
  for(const name of readdirSync(directory).filter(name=>/^\d+.*\.sql$/.test(name)).sort())sqlite.exec(readFileSync(new URL(name,directory),"utf8"));
  const data=createCase("Synthetic provisional arithmetic","quiet-case","2026-10-29");data.context.ruleReleaseId=CURRENT_RULESET.id;
  if(withInputs){
    const docId="source-document",sourceHash="a".repeat(64);
    data.documents.push({id:docId,name:"synthetic-evidence",sha256:sourceHash,status:"active",pages:[1]});data.pages.push({documentId:docId,page:1,role:"evidence",documentType:"business_income"});
    const fact=(id:string,subjectId:string,key:string,value:string):Fact=>({id,logicalId:id,version:1,subjectId,key,value,rawValue:value,sourceUnit:"KRW",numeric:normalizeMoney(value),state:"extracted",recognition:"unreviewed",refs:[{documentId:docId,page:1,quote:value,sourceHash,bbox:[0.1,0.1,0.5,0.2]}],validation:[]});
    data.facts.push(fact("income-net","income-1","income.net","2500000"),fact("living-cost","household","household.recognized_living_cost","2000000"));
    data.incomes.push({id:"income-1",kind:"business",label:"Synthetic business",net:normalizeMoney("2500000"),amountBasis:"monthly",recognition:"unreviewed",factIds:["income-net"]});
    data.household={recognizedLivingCost:normalizeMoney("2000000"),livingCostIncludesAdditional:true,recognition:"unreviewed",factIds:["living-cost"]};
    data.context.monthlyTrusteeFee=normalizeMoney("0");data.context.monthlyPriorityPayment=normalizeMoney("0");data.context.monthlyEstatePayment=normalizeMoney("0");data.context.planMonths=36;
  }
  sqlite.prepare("INSERT INTO cases(id,name,owner,revision,payload,created_at,updated_at,storage_token) VALUES (?,?,?,1,?,?,?,'token')").run(data.context.id,data.context.caseName,"synthetic",JSON.stringify(data),"2026-10-29","2026-10-29");
  sqlite.prepare("UPDATE case_data_change_state SET last_changed_at=? WHERE case_id=?").run(new Date(START).toISOString(),data.context.id);
  let beforeBatch:(()=>void)|undefined;
  const database={prepare(sql:string){let params:SQLInputValue[]=[];const statement={bind(...values:SQLInputValue[]){params=values;return statement;},async first<T>(){return (sqlite.prepare(sql).get(...params)??null) as T|null;},async all<T>(){return {results:sqlite.prepare(sql).all(...params) as T[]};},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...params).changes)}};},_sql:sql,get _params(){return params;}};return statement;},async batch(statements:{_sql:string;_params:SQLInputValue[]}[]){const callback=beforeBatch;beforeBatch=undefined;callback?.();sqlite.exec("BEGIN");try{const result=statements.map(statement=>({meta:{changes:Number(sqlite.prepare(statement._sql).run(...statement._params).changes)}}));sqlite.exec("COMMIT");return result;}catch(error){sqlite.exec("ROLLBACK");throw error;}}} as unknown as D1Database;
  return {sqlite,database,data,loadCase:async()=>JSON.parse((sqlite.prepare("SELECT payload FROM cases WHERE id=?").get(data.context.id) as {payload:string}).payload) as CaseData,
    setBeforeBatch(callback:()=>void){beforeBatch=callback;},updateSource(at=START){const next=JSON.parse((sqlite.prepare("SELECT payload FROM cases WHERE id=?").get(data.context.id) as {payload:string}).payload) as CaseData;next.context.revision++;sqlite.prepare("UPDATE cases SET revision=?,payload=? WHERE id=?").run(next.context.revision,JSON.stringify(next),data.context.id);sqlite.prepare("UPDATE case_data_change_state SET last_changed_at=? WHERE case_id=?").run(new Date(at).toISOString(),data.context.id);},close:()=>sqlite.close()};
}

test("quiet policy waits the full ten minutes and handles UTC SQLite timestamps",()=>{
  assert.equal(caseDataQuietWindow("2026-10-29 00:00:00",START+599999).isQuiet,false);
  assert.deepEqual(caseDataQuietWindow("2026-10-29T00:00:00Z",START+600000),{isQuiet:true,dueAt:"2026-10-29T00:10:00.000Z",remainingMs:0});
});
test("no arithmetic or feature INSERT occurs before quiet; unreviewed valid inputs calculate once afterwards",async()=>{
  const h=setup();try{
    const initial=await getCaseDataUpdateState(h.database,{caseId:h.data.context.id});
    const waiting=await recomputeCaseDataUpdate(h.database,{caseId:h.data.context.id,loadCase:h.loadCase,now:()=>START+599999});assert.equal(waiting.status,"debouncing");
    assert.equal((h.sqlite.prepare("SELECT COUNT(*) AS n FROM case_calculation_runs").get() as {n:number}).n,0);
    const result=await recomputeCaseDataUpdate(h.database,{caseId:h.data.context.id,loadCase:h.loadCase,now:()=>START+600000});assert.equal(result.status,"computed");
    const value=h.sqlite.prepare("SELECT value_won,status FROM case_calculation_features WHERE output_name='disposableIncomeWon'").get() as {value_won:string;status:string};
    assert.equal(value.value_won,"500000");assert.equal(value.status,"provisional");
    const sourceHeads=JSON.parse((h.sqlite.prepare("SELECT source_heads_json FROM case_calculation_runs").get() as {source_heads_json:string}).source_heads_json);
    assert.equal(sourceHeads.featureSnapshot.inputOrigin,"legacy_case_snapshot");assert.equal(sourceHeads.featureSnapshot.legacySnapshotFallback,true);
    assert.equal(sourceHeads.featureSnapshot.legalRecognition,"not_provided");assert.deepEqual(sourceHeads.featureSnapshot.sourceHeads,[]);
    assert.ok(h.data.facts.every(fact=>fact.recognition==="unreviewed"));
    const after=await getCaseDataUpdateState(h.database,{caseId:h.data.context.id});assert.equal(after.dataVersion,initial.dataVersion);assert.equal(after.lastChangedAt,initial.lastChangedAt);
    assert.equal((await recomputeCaseDataUpdate(h.database,{caseId:h.data.context.id,loadCase:h.loadCase,now:()=>START+600001})).status,"current");
    assert.equal((h.sqlite.prepare("SELECT COUNT(*) AS n FROM case_calculation_runs").get() as {n:number}).n,1);
    assert.equal((await drainDueCaseDataUpdates(h.database,{loadCase:h.loadCase,now:()=>START+600001})).scanned,0);
  }finally{h.close();}
});
test("a new source edit restarts quiet time and missing inputs remain explicit derived nulls",async()=>{
  const h=setup(false);try{
    h.updateSource(START+300000);
    const waiting=await recomputeCaseDataUpdate(h.database,{caseId:h.data.context.id,loadCase:h.loadCase,now:()=>START+600000});assert.equal(waiting.status,"debouncing");
    assert.equal((h.sqlite.prepare("SELECT COUNT(*) AS n FROM case_calculation_features").get() as {n:number}).n,0);
    const due=await drainDueCaseDataUpdates(h.database,{loadCase:h.loadCase,now:()=>START+900000});assert.equal(due.computed,1);
    const value=h.sqlite.prepare("SELECT value_json,value_won,status FROM case_calculation_features WHERE output_name='disposableIncomeWon'").get() as {value_json:string;value_won:string|null;status:string};
    assert.equal(value.value_json,"null");assert.equal(value.value_won,null);assert.ok(["missing","blocked"].includes(value.status));
  }finally{h.close();}
});
test("a source update during feature persistence cannot replace the prior computed head",async()=>{
  const h=setup();try{
    await recomputeCaseDataUpdate(h.database,{caseId:h.data.context.id,loadCase:h.loadCase,now:()=>START+600000});
    const old=h.sqlite.prepare("SELECT * FROM case_calculation_heads").get();
    h.updateSource(START);
    h.setBeforeBatch(()=>h.updateSource(START+600000));
    const raced=await recomputeCaseDataUpdate(h.database,{caseId:h.data.context.id,loadCase:h.loadCase,now:()=>START+600000});
    assert.equal(raced.status,"superseded");assert.deepEqual(h.sqlite.prepare("SELECT * FROM case_calculation_heads").get(),old);
    assert.equal((h.sqlite.prepare("SELECT data_version FROM case_data_change_state WHERE case_id=?").get(h.data.context.id) as {data_version:number}).data_version,3);
    assert.deepEqual(h.sqlite.prepare("PRAGMA foreign_key_check").all(),[]);
  }finally{h.close();}
});
