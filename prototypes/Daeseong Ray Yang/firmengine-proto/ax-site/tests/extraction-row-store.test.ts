import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { createHash } from "node:crypto";
import { persistPageExtractionRows,listCaseExtractionRows,listCaseExtractionCoverage,type PersistPageExtractionRowsInput } from "../lib/extraction-row-store.ts";
import type { PageRead } from "../lib/extraction.ts";
import {projectPage} from "../lib/extraction.ts";
import {createCase,applyExtraction} from "../lib/domain.ts";
import {calculateCase} from "../lib/assessment.ts";
import {CURRENT_RULESET} from "../lib/legal-rules.ts";

const hash="a".repeat(64),imageHash="b".repeat(64);
function setup(){
  const sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys=ON");
  for(const name of ["0000_chunky_cardiac.sql","0001_case_storage_token.sql","0008_normalized_extractions.sql","0016_source_field_coverage.sql"])sqlite.exec(readFileSync(new URL("../drizzle/"+name,import.meta.url),"utf8"));
  sqlite.prepare("INSERT INTO cases (id,name,owner,revision,payload,created_at,updated_at,storage_token) VALUES ('case-1','Synthetic','owner',1,'{}','at','at','token')").run();
  sqlite.prepare("INSERT INTO documents (id,case_id,name,sha256,page_count,ready,created_at) VALUES ('doc-1','case-1','Synthetic.pdf',?,2,1,'at')").run(hash);
  let beforeBatch:(()=>void)|undefined;
  let beforeSelect:((sql:string)=>void)|undefined;
  const database={prepare(sql:string){let values:SQLInputValue[]=[];const statement={bind(...args:SQLInputValue[]){values=args;return statement;},async first<T>(){return sqlite.prepare(sql).get(...values) as T??null;},async all<T>(){beforeSelect?.(sql);return{results:sqlite.prepare(sql).all(...values) as T[]};},async run(){const result=sqlite.prepare(sql).run(...values);return{meta:{changes:Number(result.changes)}};}};return statement;},async batch(statements:Array<{run():Promise<unknown>}>){beforeBatch?.();beforeBatch=undefined;sqlite.exec("BEGIN IMMEDIATE");try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec("COMMIT");return results;}catch(error){sqlite.exec("ROLLBACK");throw error;}}} as unknown as D1Database;
  return{sqlite,database,race:()=>{beforeBatch=()=>sqlite.prepare("UPDATE cases SET revision=revision+1 WHERE id='case-1'").run();},onSelect:(hook:(sql:string)=>void)=>{beforeSelect=hook;},close:()=>sqlite.close()};
}
const sourceRead=():PageRead=>({documentType:"shared-document:bank_statement@bank_transactions",complete:false,warnings:["Synthetic only"],records:[
  {category:"transaction",label:"row A",fields:[
    {key:"amount",label:"Amount",value:"0",unit:"KRW",quote:"0",bbox:[0.1,0.1,0.2,0.2],confidence:"clear",canonicalFieldId:"bank_transactions::amount",sourceState:"present",applicability:"applicable",applicabilityQuote:null},
    {key:"account_id",label:"Masked",value:null,unit:null,quote:"masked",bbox:[0.1,0.2,0.2,0.3],confidence:"unreadable",sourceState:"masked"},
    {key:"other_blank",label:"Blank",value:null,unit:null,quote:"blank cell",bbox:[0.1,0.3,0.2,0.4],confidence:"clear",sourceState:"blank"},
    {key:"other_none",label:"None",value:null,unit:null,quote:"No entry",bbox:[0.1,0.4,0.2,0.5],confidence:"clear",sourceState:"explicit_none"},
  ]},
  {category:"transaction",label:"row B",fields:[{key:"amount",label:"Amount",value:"15",unit:"KRW",quote:"15",bbox:[0.1,0.5,0.2,0.6],confidence:"clear",sourceState:"present"}]},
]});
function input(read=sourceRead(),overrides:Partial<PersistPageExtractionRowsInput>={}):PersistPageExtractionRowsInput{return{caseId:"case-1",documentId:"doc-1",page:1,pageJobId:"job-1",read,sourceHash:hash,imageHash,model:"gpt-6.1-terra",caseRevision:1,stage:"committed",classification:{documentTypeId:"bank_statement",documentTypeName:"계좌 거래내역",familyId:"bank_transactions",documentCatalogVersion:2,documentCatalogSha256:"c".repeat(64)},...overrides};}
const count=(h:ReturnType<typeof setup>,table:string)=>(h.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as {n:number}).n;

test("normalized writer preserves every repeated row, null source state, unit and original JSON while populating physical schema fields",async()=>{
  const h=setup();try{
    const read=sourceRead(),before=JSON.stringify(read),result=await persistPageExtractionRows(h.database,input(read));
    assert.equal(result.records,2);assert.equal(result.features,5);assert.equal(result.headPromoted,true);assert.equal(JSON.stringify(read),before);
    assert.equal(count(h,"extraction_schema_fields"),12);assert.equal(count(h,"extraction_records"),2);assert.equal(count(h,"extracted_features"),5);assert.equal(count(h,"extraction_field_coverage"),12);
    const stored=h.sqlite.prepare("SELECT read_json,read_sha256 FROM extraction_runs WHERE id=?").get(result.runId) as {read_json:string;read_sha256:string};
    assert.equal(stored.read_json,before);assert.equal(stored.read_sha256,createHash("sha256").update(before).digest("hex"));
    const output=await listCaseExtractionRows(h.database,{caseId:"case-1",expectedRevision:1});
    assert.deepEqual(output.records.map(r=>r.recordOrdinal),[0,1]);
    assert.deepEqual(output.records[0].fields.map(f=>f.value),["0",null,null,null]);
    assert.deepEqual(output.records[0].fields.map(f=>f.sourceState),["present","masked","blank","explicit_none"]);
    assert.equal(output.records[0].fields[0].expected.datatype,"money");assert.equal(output.records[0].fields[0].bindingStatus,"bound_exact_id");
    assert.equal(output.records[1].fields[0].bindingStatus,"bound_exact_key");assert.equal(output.records[0].source.documentTypeName,"계좌 거래내역");
    assert.equal(output.legalRecognition,"not_provided");assert.equal(output.courtApprovalInferred,false);
    assert.deepEqual(h.sqlite.prepare("PRAGMA foreign_key_check").all(),[]);
  }finally{h.close();}
});

test("identical reads are idempotent; a changed read retains history and advances only the committed page head",async()=>{
  const h=setup();try{
    const first=await persistPageExtractionRows(h.database,input()),again=await persistPageExtractionRows(h.database,input());
    assert.equal(first.runId,again.runId);assert.equal(count(h,"extraction_runs"),1);assert.equal(count(h,"extracted_features"),5);
    const changed=sourceRead();changed.records[1].fields[0].value="16";
    const pending=await persistPageExtractionRows(h.database,input(changed,{stage:"extracted"}));
    assert.equal(pending.headPromoted,false);assert.equal((await listCaseExtractionRows(h.database,{caseId:"case-1"})).records[1].fields[0].value,"15");
    const committed=await persistPageExtractionRows(h.database,input(changed));assert.notEqual(first.runId,committed.runId);
    assert.equal(count(h,"extraction_runs"),3);assert.equal((await listCaseExtractionRows(h.database,{caseId:"case-1"})).records[1].fields[0].value,"16");
  }finally{h.close();}
});

test("stale revision and wrong source bindings cannot promote an active read; a race retains the prior head",async()=>{
  const h=setup();try{
    const initial=await persistPageExtractionRows(h.database,input());
    await assert.rejects(persistPageExtractionRows(h.database,input(sourceRead(),{caseRevision:2})),/CASE_REVISION_MISMATCH/);
    await assert.rejects(persistPageExtractionRows(h.database,input(sourceRead(),{sourceHash:"d".repeat(64)})),/EXTRACTION_SOURCE_BINDING_MISMATCH/);
    const changed=sourceRead();changed.records[1].fields[0].value="17";h.race();
    await assert.rejects(persistPageExtractionRows(h.database,input(changed)),/CASE_REVISION_MISMATCH/);
    const head=h.sqlite.prepare("SELECT run_id FROM case_extraction_heads").get() as {run_id:string};assert.equal(head.run_id,initial.runId);
    await assert.rejects(listCaseExtractionRows(h.database,{caseId:"case-1",expectedRevision:1}),/CASE_REVISION_MISMATCH/);
    const output=await listCaseExtractionRows(h.database,{caseId:"case-1",expectedRevision:2});assert.equal(output.records[0].source.headCaseRevision,1);
  }finally{h.close();}
});

test("schema mismatch and unknown field IDs are preserved as unbound source rows, never inferred into another legal field",async()=>{
  const h=setup();try{
    const read=sourceRead();read.records[0].fields[0].canonicalFieldId="debt_certificate::principal_balance";
    read.records[1].fields[0].unit=null;
    await persistPageExtractionRows(h.database,input(read));
    const result=await listCaseExtractionRows(h.database,{caseId:"case-1"});
    assert.equal(result.records[0].fields[0].canonicalFieldId,null);assert.equal(result.records[0].fields[0].validationStatus,"unbound");
    assert.deepEqual(result.records[0].fields[0].validation,["CANONICAL_FIELD_NOT_IN_SCHEMA"]);
    assert.equal(result.records[1].fields[0].validationStatus,"source_review_required");assert.ok(result.records[1].fields[0].validation.includes("SOURCE_MONETARY_UNIT_MISSING"));
    assert.equal(result.records[1].fields[0].value,"15");
  }finally{h.close();}
});

test("document-specific decimal quantity uses its real extension schema, not a KRW balance",async()=>{
  const h=setup();try{
    const read:PageRead={documentType:"shared-document:crypto_transactions@bank_transactions",records:[{category:"transaction",label:"coin transfer",fields:[{key:"quantity",label:"Native quantity",value:"0.001230",unit:"BTC",quote:"0.001230 BTC",confidence:"clear",bbox:[0,0,1,1],canonicalFieldId:"crypto_transactions::quantity",sourceState:"present"}]}],complete:true,warnings:[]};
    await persistPageExtractionRows(h.database,input(read,{classification:{documentTypeId:"crypto_transactions",documentTypeName:"가상자산 매매·입출고 내역",familyId:"bank_transactions",documentCatalogVersion:2,documentCatalogSha256:"c".repeat(64)}}));
    const result=await listCaseExtractionRows(h.database,{caseId:"case-1",documentTypeId:"crypto_transactions",limit:1});
    assert.equal(result.records[0].fields[0].expected.datatype,"quantity");assert.equal(result.records[0].fields[0].unit,"BTC");assert.equal(result.records[0].fields[0].value,"0.001230");
    assert.equal(result.records[0].fields[0].validationStatus,"source_only");
    assert.equal((await listCaseExtractionRows(h.database,{caseId:"case-1",documentTypeId:"bank_statement"})).totalRecords,0);
  }finally{h.close();}
});

test("physical migration is idempotent and record pagination is bounded and deterministic",async()=>{
  const h=setup();try{
    h.sqlite.exec(readFileSync(new URL("../drizzle/0008_normalized_extractions.sql",import.meta.url),"utf8"));
    await persistPageExtractionRows(h.database,input());
    const a=await listCaseExtractionRows(h.database,{caseId:"case-1",limit:1}),b=await listCaseExtractionRows(h.database,{caseId:"case-1",limit:1,offset:1});
    assert.equal(a.nextOffset,1);assert.equal(b.nextOffset,null);assert.equal(a.records[0].recordOrdinal,0);assert.equal(b.records[0].recordOrdinal,1);
    await assert.rejects(listCaseExtractionRows(h.database,{caseId:"case-1",limit:51}),/INVALID_EXTRACTION_ROW_QUERY/);
  }finally{h.close();}
});

test("a 2,200-cell plural OCR page returns all rows and all fields rather than silently dropping fields after 2,000",async()=>{
  const h=setup();try{
    const read:PageRead={
      documentType:"shared-document:bank_statement@bank_transactions",
      complete:true,warnings:[],
      records:Array.from({length:11},(_,ri)=>({
        category:"other" as const,label:"synthetic-record-"+ri,
        fields:Array.from({length:200},(_,fi)=>({
          key:"unknown_field_"+fi,label:"synthetic field "+fi,
          value:"record-"+ri+"-field-"+fi,unit:null,
          quote:"source record "+ri+" field "+fi,confidence:"clear" as const,
          bbox:[0.1,0.1,0.2,0.2] as [number,number,number,number],
          sourceState:"present" as const
        }))
      }))
    };
    const stored=await persistPageExtractionRows(h.database,input(read));
    assert.equal(stored.records,11);assert.equal(stored.features,2200);
    const output=await listCaseExtractionRows(h.database,{caseId:"case-1",limit:25});
    assert.equal(output.totalRecords,11);
    assert.equal(output.featuresTruncated,false);
    assert.equal(output.records.reduce((n,r)=>n+r.fields.length,0),2200);
    assert.ok(output.records.every(row=>row.fieldCount===200&&row.fields.length===200));
    assert.equal(output.records[10].fields[199].value,"record-10-field-199");
    assert.equal(new Set(output.records.flatMap(row=>row.fields.map(field=>field.featureId))).size,2200);
  }finally{h.close();}
});

test("nullable canonical amount owner roles preserve every debt schema field and allow exact canonical foreign keys",async()=>{
  const h=setup();try{
    const read:PageRead={documentType:"shared-document:debt_certificate@debt_certificate",complete:true,warnings:[],records:[{category:"debt",label:"Synthetic creditor",fields:[{key:"principal_balance",label:"Current principal",value:"1000",unit:"KRW",quote:"Current principal 1000 KRW",bbox:[0.1,0.1,0.3,0.2],confidence:"clear",canonicalFieldId:"debt_certificate::principal_balance",sourceState:"present"}]}]};
    const result=await persistPageExtractionRows(h.database,input(read,{classification:{documentTypeId:"debt_certificate",documentTypeName:"채권자별 부채증명·채무잔액 확인자료",familyId:"debt_certificate",documentCatalogVersion:2,documentCatalogSha256:"c".repeat(64)}}));
    const schema=h.sqlite.prepare("SELECT COUNT(*) AS n FROM extraction_schema_fields WHERE schema_id=?").get(result.schemaId) as {n:number};assert.equal(schema.n,13);
    const amount=h.sqlite.prepare("SELECT amount_owner_role FROM extraction_schema_fields WHERE schema_id=? AND canonical_field_id='debt_certificate::principal_balance'").get(result.schemaId) as {amount_owner_role:string|null};assert.equal(amount.amount_owner_role,null);
    const view=await listCaseExtractionRows(h.database,{caseId:"case-1"});assert.equal(view.records[0].fields[0].canonicalFieldId,"debt_certificate::principal_balance");assert.equal(view.records[0].fields[0].expected.amountOwnerRole,null);
    assert.deepEqual(h.sqlite.prepare("PRAGMA foreign_key_check").all(),[]);
  }finally{h.close();}
});

test("every schema field has a page-coverage row even if OCR did not observe it",async()=>{
  const h=setup();try{
    const read:PageRead={documentType:"shared-document:debt_certificate@debt_certificate",complete:true,warnings:[],
      records:[{category:"debt",label:"claim",fields:[{key:"principal_balance",canonicalFieldId:"debt_certificate::principal_balance",
        label:"balance",value:"0",unit:"KRW",quote:"원금 0원",bbox:[0.1,0.1,0.4,0.2],confidence:"clear",sourceState:"present"}]}]};
    const result=await persistPageExtractionRows(h.database,input(read,{classification:{documentTypeId:"debt_certificate",documentTypeName:"부채증명서",familyId:"debt_certificate",documentCatalogVersion:2,documentCatalogSha256:"c".repeat(64)}}));
    assert.equal(result.features,1);assert.equal(result.expectedFields,13);assert.equal(result.notObservedOnPage,12);
    const coverage=await listCaseExtractionCoverage(h.database,{caseId:"case-1",documentTypeId:"debt_certificate"});
    assert.equal(coverage.totalFields,13);
    assert.equal(coverage.rows.find(v=>v.canonicalFieldId==="debt_certificate::principal_balance")?.observationStatus,"observed_source_only");
    assert.equal(coverage.rows.find(v=>v.canonicalFieldId==="debt_certificate::interest_balance")?.observationStatus,"not_observed_on_page");
    assert.equal(count(h,"extracted_features"),1);assert.equal(count(h,"extraction_field_coverage"),13);
  }finally{h.close();}
});
test("canonical ID disagreeing with OCR key is rejected consistently across storage and case projection",async()=>{
  const h=setup();try{
    const read=sourceRead();read.records[0].fields[0].canonicalFieldId="bank_transactions::amount";read.records[0].fields[0].key="counterparty";
    await persistPageExtractionRows(h.database,input(read));
    const view=await listCaseExtractionRows(h.database,{caseId:"case-1"});
    assert.equal(view.records[0].fields[0].canonicalFieldId,null);
    assert.equal(view.records[0].fields[0].projectionKey,null);
    assert.ok(view.records[0].fields[0].validation.includes("CANONICAL_ID_KEY_CONFLICT"));
  }finally{h.close();}
});


test("physically stored two-month OCR payroll rows roundtrip through SQL source cells and deterministic monthly calculator",async()=>{
 const h=setup();try{
  const sourceField=(key:string,id:string,value:string,unit:string|null)=>({
   key,canonicalFieldId:id,label:key,value,unit,quote:key+" "+value,
   bbox:[0.1,0.1,0.4,0.2],confidence:"clear" as const,sourceState:"present" as const
  });
  const wageRow=(month:string,last:string,net:string)=>({category:"income" as const,label:month,fields:[
    sourceField("income.payroll.employer","payroll_payslip::income.payroll.employer","Employer A",null),
    sourceField("income.payroll.net_pay","payroll_payslip::income.payroll.net_pay",net,"KRW"),
    sourceField("income.payroll.pay_period_start","payroll_payslip::income.payroll.pay_period_start",month+"-01",null),
    sourceField("income.payroll.pay_period_end","payroll_payslip::income.payroll.pay_period_end",month+"-"+last,null),
  ]});
  const read:PageRead={documentType:"shared-document:salary_statement@payroll_payslip",complete:true,warnings:[],records:[
   wageRow("2026-09","30","2000000"),wageRow("2026-10","31","2500000")
  ]};
  await persistPageExtractionRows(h.database,input(read,{
   classification:{documentTypeId:"salary_statement",documentTypeName:"Synthetic salary",familyId:"payroll_payslip",
    documentCatalogVersion:2,documentCatalogSha256:"c".repeat(64)}
  }));
  const stored=await listCaseExtractionRows(h.database,{caseId:"case-1",documentTypeId:"salary_statement",expectedRevision:1});
  assert.equal(stored.totalRecords,2);
  assert.deepEqual(stored.records.map(r=>r.fields.find(f=>f.key==="income.payroll.net_pay")?.value),["2000000","2500000"]);
  assert.ok(stored.records.every(r=>r.fields.some(f=>f.canonicalFieldId==="payroll_payslip::income.payroll.net_pay"&&f.projectionKey==="net")));
  const reconstructed:PageRead={documentType:read.documentType,complete:true,warnings:[],records:stored.records.map(r=>({
   category:r.category as "income",label:r.label,fields:r.fields.map(f=>({
    key:f.key,label:f.label,value:f.value as string|null,unit:f.unit,quote:f.quote,
    confidence:f.confidence as "clear"|"uncertain"|"unreadable",bbox:f.bbox as number[]|null,
    canonicalFieldId:f.canonicalFieldId,sourceState:f.sourceState as "present"
   }))
  }))};
  const documentPageQuotes=read.records.flatMap(r=>r.fields.map(f=>f.quote)).join(" | ");
  let data=createCase("SQL roundtrip synthetic","case-1","2026-10-27");
  data.documents=[{id:"doc-1",name:"Synthetic salary.pdf",sha256:hash,status:"active",pages:[1]}];
  data.pages=[{documentId:"doc-1",page:1,role:"evidence",text:documentPageQuotes}];
  const projected=projectPage(reconstructed,"doc-1",1,hash);
  assert.deepEqual(projected.incomes.map(x=>x.net?.amountWon),["2000000","2500000"]);
  assert.deepEqual(projected.incomes.map(x=>x.periodStart),["2026-09-01","2026-10-01"]);
  data=applyExtraction(data,projected);
  data.facts=data.facts.map(f=>({...f,state:"verified",recognition:"accepted"}));
  data.incomes=data.incomes.map(s=>({...s,recognition:"accepted"}));
  data.context.inventoryComplete.income="yes";
  const cannotMerge=calculateCase(data,CURRENT_RULESET);
  assert.equal(cannotMerge.monthlyIncomeWon,null,"same employer name alone is not an approved payer identity");
  data.incomes=data.incomes.map(s=>({...s,aggregationTreatment:"series_observation",aggregationReviewed:true,aggregationReviewReason:"Synthetic review verified two sequential months belong to the same employer"}));
  const result=calculateCase(data,CURRENT_RULESET);
  assert.equal(result.monthlyIncomeWon,"2250000");
  assert.equal(result.incomeGroups.length,1);
  assert.equal(result.incomeGroups[0].observedMonths,2);
  assert.deepEqual(result.incomeRows.map(x=>x.monthlyWon),["2000000","2500000"]);
 }finally{h.close();}
});

test("stored unknown-unit money remains in the source SQL but cannot become a transaction amount",async()=>{
 const h=setup();try{
  const raw:PageRead={documentType:"shared-document:bank_statement@bank_transactions",complete:true,warnings:[],records:[{
   category:"transaction",label:"unscaled-amount",fields:[
    {key:"amount",canonicalFieldId:"bank_transactions::amount",label:"amount",
     value:"1000000",unit:null,quote:"거래금액 1000000",bbox:[0.1,0.1,0.3,0.2],confidence:"clear",sourceState:"present"}
   ]
  }]};
  await persistPageExtractionRows(h.database,input(raw));
  const result=await listCaseExtractionRows(h.database,{caseId:"case-1"});
  assert.equal(result.records.length,1);
  const amount=result.records[0].fields.find(f=>f.key==="amount")!;
  assert.equal(amount.value,"1000000");
  assert.equal(amount.validationStatus,"source_review_required");
  assert.ok(amount.validation.includes("SOURCE_MONETARY_UNIT_MISSING"));
  assert.equal(projectPage(raw,"doc-1",1,hash).transactions.length,0);
 }finally{h.close();}
});

test("same-revision OCR page head change during feature read rejects stale rows",async()=>{
  const h=setup();try{
    const original=await persistPageExtractionRows(h.database,input());
    const changed=sourceRead();changed.records[1].fields[0].value="27";
    const replacement=await persistPageExtractionRows(h.database,input(changed));
    assert.notEqual(original.runId,replacement.runId);
    h.sqlite.prepare("UPDATE case_extraction_heads SET run_id=? WHERE case_id='case-1' AND source_document_id='doc-1' AND page=1").run(original.runId);
    let moved=false;
    h.onSelect(sql=>{
      if(!moved&&sql.startsWith("SELECT f.*")){
        moved=true;
        h.sqlite.prepare("UPDATE case_extraction_heads SET run_id=? WHERE case_id='case-1' AND source_document_id='doc-1' AND page=1").run(replacement.runId);
      }
    });
    await assert.rejects(listCaseExtractionRows(h.database,{caseId:"case-1",expectedRevision:1}),/CASE_REVISION_MISMATCH/);
    assert.equal(moved,true);
    assert.equal((h.sqlite.prepare("SELECT revision FROM cases WHERE id='case-1'").get() as {revision:number}).revision,1);
    const refreshed=await listCaseExtractionRows(h.database,{caseId:"case-1",expectedRevision:1});
    assert.equal(refreshed.records[1].fields[0].value,"27");
  }finally{h.close();}
});
