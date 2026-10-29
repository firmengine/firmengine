import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {DatabaseSync,type SQLInputValue} from "node:sqlite";
import {buildCaseFeatureSnapshot} from "../lib/case-feature-snapshot.ts";
import {persistPageExtractionRows} from "../lib/extraction-row-store.ts";
import {projectPage,type PageRead} from "../lib/extraction.ts";
import {createCase,applyExtraction,DRAFT_RULESET,type CaseData} from "../lib/domain.ts";
import {calculateCase} from "../lib/assessment.ts";

const sourceHash="a".repeat(64),imageHash="b".repeat(64),directory=new URL("../drizzle/",import.meta.url);
const sourceRead=(principal="100000"):PageRead=>({documentType:"shared-document:debt_certificate@debt_certificate",complete:true,warnings:[],records:[{category:"debt",label:"Current debt",fields:[
  {key:"creditor",label:"Creditor",value:"Synthetic Bank",unit:null,quote:"Synthetic Bank",confidence:"clear",bbox:[0.1,0.1,0.4,0.2],canonicalFieldId:"debt_certificate::creditor",sourceState:"present"},
  {key:"principal_balance",label:"Current principal",value:principal,unit:"원",quote:"현재 원금잔액 "+principal+"원",confidence:"clear",bbox:[0.1,0.2,0.4,0.3],canonicalFieldId:"debt_certificate::principal_balance",sourceState:"present"},
  {key:"interest",label:"Interest",value:"1000",unit:"원",quote:"이자 1000원",confidence:"clear",bbox:[0.1,0.3,0.4,0.4],sourceState:"present"},
  {key:"as_of",label:"As of",value:"2026-10-29",unit:null,quote:"기준일 2026-10-29",confidence:"clear",bbox:[0.1,0.4,0.4,0.5],sourceState:"present"},
]}]});
function setup(){
  const sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys=ON");
  for(const name of readdirSync(directory).filter(name=>/^\d+.*\.sql$/.test(name)&&Number(name.slice(0,4))<=10).sort())sqlite.exec(readFileSync(new URL(name,directory),"utf8"));
  const database={prepare(sql:string){let values:SQLInputValue[]=[];const statement={bind(...args:SQLInputValue[]){assert.ok(args.length<=100);values=args;return statement;},async first<T>(){return sqlite.prepare(sql).get(...values) as T??null;},async all<T>(){return{results:sqlite.prepare(sql).all(...values) as T[]};},async run(){const result=sqlite.prepare(sql).run(...values);return{meta:{changes:Number(result.changes)}};}};return statement;},async batch(statements:Array<{run():Promise<unknown>}>){sqlite.exec("BEGIN IMMEDIATE");try{const out=[];for(const statement of statements)out.push(await statement.run());sqlite.exec("COMMIT");return out;}catch(error){sqlite.exec("ROLLBACK");throw error;}}} as unknown as D1Database;
  const base=createCase("Synthetic normalized source","case-1","2026-10-29");
  base.documents=[{id:"doc-1",name:"source.pdf",sha256:sourceHash,status:"active",pages:[1]}];base.pages=[{documentId:"doc-1",page:1,role:"evidence"}];
  let data=applyExtraction(base,projectPage(sourceRead(),"doc-1",1,sourceHash));
  data.context.inventoryComplete.debt="yes";
  sqlite.prepare("INSERT INTO cases (id,name,owner,revision,payload,created_at,updated_at,storage_token) VALUES ('case-1','Synthetic','owner',?,'{}','at','at','token')").run(data.context.revision);
  sqlite.prepare("INSERT INTO documents (id,case_id,name,sha256,page_count,ready,created_at) VALUES ('doc-1','case-1','source.pdf',?,1,1,'at')").run(sourceHash);
  const commit=async(read:PageRead)=>persistPageExtractionRows(database,{caseId:"case-1",documentId:"doc-1",page:1,read,sourceHash,imageHash,caseRevision:data.context.revision,model:"gpt-6.1-terra",stage:"committed",classification:{documentTypeId:"debt_certificate",documentTypeName:"Current debt",familyId:"debt_certificate",documentCatalogVersion:2,documentCatalogSha256:"c".repeat(64)}});
  const next=async(read:PageRead)=>{data=applyExtraction(data,projectPage(read,"doc-1",1,sourceHash));sqlite.prepare("UPDATE cases SET revision=? WHERE id='case-1'").run(data.context.revision);return commit(read);};
  return{sqlite,database,get data(){return data;},commit,next,close:()=>sqlite.close()};
}

test("validated SQL source snapshots preserve exact IDs and human decisions without granting acceptance",async()=>{
  const h=setup();try{
    await h.commit(sourceRead());
    h.data.facts[0].state="verified";h.data.facts[0].recognition="accepted";h.data.facts[0].reviewer="human-reviewer";
    const before=structuredClone(h.data),result=await buildCaseFeatureSnapshot(h.database,{caseData:h.data});
    assert.equal(result.inputOrigin,"normalized_rows_validated_case_snapshot");assert.equal(result.legacySnapshotFallback,false);assert.equal(result.sourceHeads.length,1);assert.equal(result.sourceHeads[0].features,4);
    assert.deepEqual(result.caseData,before);assert.deepEqual(h.data,before);assert.equal(result.caseData.facts.filter(fact=>fact.recognition==="accepted").length,1);
    assert.equal(calculateCase(result.caseData,DRAFT_RULESET).debtRows[0].principalWon,"100000");
  }finally{h.close();}
});

test("direct normalized feature or schema tampering blocks rather than calculating an older CaseData amount",async()=>{
  const h=setup();try{
    await h.commit(sourceRead());
    h.sqlite.prepare("UPDATE extracted_features SET raw_value_json='\"999999\"' WHERE field_key='principal_balance'").run();
    await assert.rejects(buildCaseFeatureSnapshot(h.database,{caseData:h.data}),/SOURCE_INTEGRITY_MISMATCH/);
    assert.equal(h.data.debts[0].principal?.amountWon,"100000","the adapter neither reuses it as a valid current result nor silently rewrites the old case");
    h.sqlite.prepare("UPDATE extracted_features SET raw_value_json='\"100000\"' WHERE field_key='principal_balance'").run();
    h.sqlite.prepare("UPDATE extraction_schema_fields SET datatype='string' WHERE canonical_field_id='debt_certificate::principal_balance'").run();
    await assert.rejects(buildCaseFeatureSnapshot(h.database,{caseData:h.data}),/SOURCE_INTEGRITY_MISMATCH/);
  }finally{h.close();}
});

test("new legitimate committed reads update calculations while an unprojected replacement head is explicit conflict",async()=>{
  const h=setup();try{
    await h.commit(sourceRead());await h.commit(sourceRead("150000"));
    await assert.rejects(buildCaseFeatureSnapshot(h.database,{caseData:h.data}),/PROJECTION_CONFLICT/);
    await h.next(sourceRead("150000"));
    const result=await buildCaseFeatureSnapshot(h.database,{caseData:h.data});
    assert.equal(calculateCase(result.caseData,DRAFT_RULESET).debtRows[0].principalWon,"150000");assert.equal(result.caseData.context.revision,h.data.context.revision);
    assert.ok(result.caseData.facts.every(fact=>fact.recognition!=="accepted"));
  }finally{h.close();}
});

test("typed case drift blocks even if original raw normalized rows have not changed",async()=>{
  const h=setup();try{
    await h.commit(sourceRead());const changed=structuredClone(h.data);changed.debts[0].principal={...changed.debts[0].principal!,rawValue:"900000",amountWon:"900000"};
    await assert.rejects(buildCaseFeatureSnapshot(h.database,{caseData:changed}),/PROJECTION_CONFLICT/);
  }finally{h.close();}
});

test("cases without normalized heads return an explicit isolated legacy fallback",async()=>{
  const h=setup();try{
    await h.commit(sourceRead());const other=createCase("Other case","case-2","2026-10-29");
    h.sqlite.prepare("INSERT INTO cases (id,name,owner,revision,payload,created_at,updated_at,storage_token) VALUES ('case-2','Other','owner',1,'{}','at','at','token')").run();
    const result=await buildCaseFeatureSnapshot(h.database,{caseData:other});assert.equal(result.legacySnapshotFallback,true);assert.equal(result.inputOrigin,"legacy_case_snapshot");assert.equal(result.sourceHeads.length,0);assert.equal(result.caseData.debts.length,0);
    assert.ok(result.warnings.some(warning=>warning.includes("legacy_case_snapshot_fallback")));
  }finally{h.close();}
});
