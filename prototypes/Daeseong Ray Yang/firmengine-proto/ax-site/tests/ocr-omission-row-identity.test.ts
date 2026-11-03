import test from "node:test";
import assert from "node:assert/strict";
import {preserveAgreedFieldsAfterOmission, type PageRead, type FieldReviewCheck} from "../lib/extraction.ts";

// Synthetic-only audit cases. No customer data or OCR truth set.
const field=(key:string,value:string)=>({
  key,label:key,value,quote:`synthetic ${key} ${value}`,unit:"원",
  confidence:"clear" as const,bbox:null,canonicalFieldId:null,
  sourceState:"present" as const,applicability:"applicable" as const,applicabilityQuote:null,
});
const row=(label:string,fields:ReturnType<typeof field>[])=>({category:"transaction" as const,label,fields});
const read=(records:ReturnType<typeof row>[]):PageRead=>({documentType:"bank_transactions",records,warnings:[],complete:true});
const agrees=(recordIndex:number,fieldIndex:number,f:ReturnType<typeof field>):FieldReviewCheck=>({
  recordIndex,fieldIndex,categoryStatus:"supported",meaningStatus:"supported",status:"agrees",
  value:f.value,unit:f.unit,quote:f.quote,bbox:null,reason:"synthetic independent agreement",
});

test("different sole row must never inherit prior verified amount without an identity anchor",()=>{
 const old=field("amount","100"),baseline=read([row("synthetic transaction A",[old])]);
 const reread=read([row("synthetic transaction B",[field("date","2026-09-02")])]);
 const result=preserveAgreedFieldsAfterOmission(baseline,[agrees(0,0,old)],reread);
 assert.equal(result.complete,false);
 assert.deepEqual(result.records[0]?.fields.map(x=>x.key),["date"]);
 assert.match(result.warnings.join(" "),/안전하게 연결하지 못했습니다/);
});
test("same generic row label does not establish identity when the only agreed field was omitted",()=>{
 const old=field("amount","100"),baseline=read([row("transaction",[old])]);
 const reread=read([row("transaction",[field("date","2026-09-02")])]);
 const result=preserveAgreedFieldsAfterOmission(baseline,[agrees(0,0,old)],reread);
 assert.equal(result.complete,false);
 assert.deepEqual(result.records[0]?.fields.map(x=>x.key),["date"]);
});
test("unique verified account anchors permit safe reconstruction after row reorder",()=>{
 const a=[field("account_id","A-0001"),field("amount","100")];
 const b=[field("account_id","B-0001"),field("amount","200")];
 const baseline=read([row("transaction A",a),row("transaction B",b)]);
 const checks=[agrees(0,0,a[0]!),agrees(0,1,a[1]!),agrees(1,0,b[0]!),agrees(1,1,b[1]!)];
 const reread=read([row("transaction B",[field("account_id","B-0001")]),row("transaction A",[field("account_id","A-0001")])]);
 const result=preserveAgreedFieldsAfterOmission(baseline,checks,reread);
 assert.equal(result.complete,true);
 assert.equal(result.records[0]?.fields.find(x=>x.key==="amount")?.value,"200");
 assert.equal(result.records[1]?.fields.find(x=>x.key==="amount")?.value,"100");
});
test("ambiguous duplicate anchor must remain partial",()=>{
 const a=[field("account_id","SAME"),field("amount","100")];
 const b=[field("account_id","SAME"),field("amount","200")];
 const result=preserveAgreedFieldsAfterOmission(
   read([row("transaction A",a),row("transaction B",b)]),
   [agrees(0,0,a[0]!),agrees(0,1,a[1]!),agrees(1,0,b[0]!),agrees(1,1,b[1]!)],
   read([row("transaction B",[field("account_id","SAME")]),row("transaction A",[field("account_id","SAME")])]),
 );
 assert.equal(result.complete,false);
 assert.ok(result.records.every(r=>r.fields.every(f=>f.key!=="amount")));
});
test("verified anchor with conflicting reread amount does not silently overwrite it",()=>{
 const id=field("account_id","A-0001"),amount=field("amount","100");
 const result=preserveAgreedFieldsAfterOmission(
   read([row("transaction A",[id,amount])]),
   [agrees(0,0,id),agrees(0,1,amount)],
   read([row("transaction A",[field("account_id","A-0001"),field("amount","900")])]),
 );
 assert.equal(result.complete,false);
 assert.equal(result.records[0]?.fields.find(f=>f.key==="amount")?.value,"900");
});
