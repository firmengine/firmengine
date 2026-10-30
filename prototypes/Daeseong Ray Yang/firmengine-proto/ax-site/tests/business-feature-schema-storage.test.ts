import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync,type SQLInputValue} from "node:sqlite";
import canonical from "../lib/canonical-field-id-index.json" with {type:"json"};
import {BUSINESS_SOURCE_MONEY_ROLES,BUSINESS_SOURCE_PERIOD_FIELDS,auditBusinessSourceEvidence} from "../lib/business-source-evidence.ts";
import {sharedDocumentFieldContract} from "../lib/shared-document-catalog.ts";
import {bindCanonicalSourceField,canonicalProjectionKey} from "../lib/canonical-field-binding.ts";
import {persistPageExtractionRows,listCaseExtractionRows} from "../lib/extraction-row-store.ts";
import {projectPage,type PageRead} from "../lib/extraction.ts";
import {createCase,applyExtraction} from "../lib/domain.ts";

const SHA="a".repeat(64),IMAGE="b".repeat(64);
test("693 canonical OCR IDs cover every business money/date role and preserve exact money schema",()=>{
 assert.equal(canonical.ids.length,693);
 const idSet=new Set(canonical.ids);
 const moneyIds=Object.keys(BUSINESS_SOURCE_MONEY_ROLES),periodIds=Object.values(BUSINESS_SOURCE_PERIOD_FIELDS).flat();
 assert.equal(moneyIds.length,11);
 for(const id of [...moneyIds,...periodIds]){
  assert.ok(idSet.has(id),id);
  const [family]=id.split("::");
  const doc=family==="business_sales_vat"?"vat_certificate":"business_income_report";
  const contract=sharedDocumentFieldContract(doc,family);
  assert.ok(contract,id);
  const definition=contract.fields.find(f=>f.global_field_id===id);
  assert.ok(definition,id);
  const binding=bindCanonicalSourceField({key:definition.local_id,canonicalFieldId:id},contract);
  assert.equal(binding.canonicalFieldId,id);
  if(moneyIds.includes(id)){
   assert.ok(definition.datatype.startsWith("money"),id);
   assert.equal(definition.canonical_unit,"KRW",id);
  }else assert.equal(definition.datatype,"date",id);
  if(family==="business_costs_and_ledgers"){
   assert.equal(canonicalProjectionKey(contract,binding,"income"),null,"Raw costs may not be typed net automatically");
  }
 }
 const receipts=sharedDocumentFieldContract("business_income_report","business_current_income_summary")!;
 assert.equal(receipts.fields.find(f=>f.global_field_id==="business_current_income_summary::income.self_employment.net_receipt")?.temporal_role,"event_date");
 assert.equal(BUSINESS_SOURCE_MONEY_ROLES["business_costs_and_ledgers::income.business_cost.tax_component"],"input_vat");
});

function testDb(){
 const sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys=ON");
 for(const name of ["0000_chunky_cardiac.sql","0001_case_storage_token.sql","0008_normalized_extractions.sql","0016_source_field_coverage.sql"])
  sqlite.exec(readFileSync(new URL("../drizzle/"+name,import.meta.url),"utf8"));
 sqlite.prepare("INSERT INTO cases (id,name,owner,revision,payload,created_at,updated_at,storage_token) VALUES ('case-1','Synthetic','owner',1,'{}','at','at','token')").run();
 sqlite.prepare("INSERT INTO documents (id,case_id,name,sha256,page_count,ready,created_at) VALUES ('doc-1','case-1','Synthetic.pdf',?,1,1,'at')").run(SHA);
 const database={prepare(sql:string){
  let values:SQLInputValue[]=[];
  const stmt={bind(...args:SQLInputValue[]){values=args;return stmt;},
   async first<T>(){return sqlite.prepare(sql).get(...values) as T??null;},
   async all<T>(){return {results:sqlite.prepare(sql).all(...values) as T[]};},
   async run(){const r=sqlite.prepare(sql).run(...values);return {meta:{changes:Number(r.changes)}};}};
  return stmt;
 },async batch(statements:Array<{run():Promise<unknown>}>){
  sqlite.exec("BEGIN IMMEDIATE");try{const r=[];for(const x of statements)r.push(await x.run());sqlite.exec("COMMIT");return r;}
  catch(e){sqlite.exec("ROLLBACK");throw e;}
 }} as unknown as D1Database;
 return {sqlite,database};
}
const cell=(key:string,value:string,unit:string|null)=>({
 key,label:key,value,unit,quote:key+" "+value,bbox:[0.1,0.1,0.7,0.2] as [number,number,number,number],
 confidence:"clear" as const,sourceState:"present" as const
});
test("D1 normalized extraction retains two business costs as distinct rows and never creates approved typed income",async()=>{
 const {sqlite,database}=testDb();try{
  const read:PageRead={documentType:"shared-document:business_income_report@business_costs_and_ledgers",
   complete:true,warnings:[],records:["500000","250000"].map((amount,i)=>({
    category:"business" as const,label:"source cost "+i,fields:[
     cell("income.business_cost.gross_amount",amount,"KRW"),
     cell("income.business_cost.period_start","2026-01-01",null),
     cell("income.business_cost.period_end","2026-01-31",null)]
   }))};
  const original=JSON.stringify(read);
  const stored=await persistPageExtractionRows(database,{caseId:"case-1",documentId:"doc-1",page:1,
   read,sourceHash:SHA,imageHash:IMAGE,model:"synthetic-ocr",caseRevision:1,stage:"committed",
   classification:{documentTypeId:"business_income_report",familyId:"business_costs_and_ledgers",
    documentTypeName:"사업 경비",documentCatalogVersion:2,documentCatalogSha256:"c".repeat(64)}});
  assert.equal(stored.records,2);assert.equal(stored.features,6);assert.equal(JSON.stringify(read),original);
  const view=await listCaseExtractionRows(database,{caseId:"case-1",limit:5});
  assert.equal(view.totalRecords,2);
  assert.deepEqual(view.records.map(r=>r.recordOrdinal),[0,1]);
  assert.deepEqual(view.records.map(r=>r.fields[0].value),["500000","250000"]);
  assert.ok(view.records.every(r=>r.fields.length===3&&r.fields[0].expected.datatype==="money"));
  assert.ok(view.records.every(r=>r.fields[0].projectionKey===null));
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(),[]);
  const data=createCase("Synthetic","case-1","2026-01-31");
  data.documents=[{id:"doc-1",name:"Synthetic.pdf",sha256:SHA,status:"active",pages:[1]}];
  data.pages=[{documentId:"doc-1",page:1,role:"evidence",text:read.records.flatMap(r=>r.fields.map(f=>f.quote??"")).join(" | ")}];
  const extracted=projectPage(read,"doc-1",1,SHA);
  assert.equal(extracted.incomes.length,0,"Cost evidence is not an income");
  const result=applyExtraction(data,extracted);
  const report=auditBusinessSourceEvidence(result);
  assert.equal(report.total,2);
  assert.equal(new Set(report.rows.map(r=>r.sourceRecordId)).size,2);
 }finally{sqlite.close();}
});
