import test from "node:test";
import assert from "node:assert/strict";
import { preserveAgreedFieldsAfterOmission, type PageRead, type FieldReviewCheck } from "../lib/extraction.ts";

// Entirely synthetic rows; never source PDFs, customer data or OCR truth values.
const field=(key:string,value:string)=>({
  key,label:key,value,quote:`synthetic ${key} ${value}`,unit:"원",
  confidence:"clear" as const,bbox:null,canonicalFieldId:null,
  sourceState:"present" as const,applicability:"applicable" as const,applicabilityQuote:null,
});
const row=(label:string,fields:ReturnType<typeof field>[])=>({category:"transaction" as const,label,fields});
const read=(records:ReturnType<typeof row>[]):PageRead=>({documentType:"bank_transactions",records,warnings:[],complete:true});
const reviews=(page:PageRead):FieldReviewCheck[]=>
  page.records.flatMap((record,ri)=>record.fields.map((f,fi)=>({
    recordIndex:ri,fieldIndex:fi,categoryStatus:"supported" as const,
    meaningStatus:"supported" as const,status:"agrees" as const,
    value:f.value,unit:f.unit,quote:f.quote,bbox:null,reason:"synthetic independent agreement",
  })));

test("same verified account anchor in two baseline rows never assigns one omitted amount",()=>{
  const baseline=read([
    row("A",[field("account_id","SHARED"),field("amount","100")]),
    row("B",[field("account_id","SHARED"),field("amount","200")]),
  ]);
  const reread=read([row("unknown",[field("account_id","SHARED")])]);
  const result=preserveAgreedFieldsAfterOmission(baseline,reviews(baseline),reread);
  assert.equal(result.complete,false);
  assert.deepEqual(result.records[0]?.fields.map(f=>f.key),["account_id"]);
  assert.match(result.warnings.join(" "),/안전하게 연결하지 못했습니다/);
});
test("dropping dates leaves a shared account insufficient to choose a source row",()=>{
  const baseline=read([
    row("A",[field("account_id","SHARED"),field("date","2026-01-01"),field("amount","100")]),
    row("B",[field("account_id","SHARED"),field("date","2026-01-02"),field("amount","200")]),
  ]);
  const reread=read([row("unknown",[field("account_id","SHARED")])]);
  const result=preserveAgreedFieldsAfterOmission(baseline,reviews(baseline),reread);
  assert.equal(result.complete,false);
  assert.equal(result.records[0]?.fields.some(f=>f.key==="amount"),false);
});
test("shared account with independently distinct dates can reconstruct each row",()=>{
  const baseline=read([
    row("A",[field("account_id","SHARED"),field("date","2026-01-01"),field("amount","100")]),
    row("B",[field("account_id","SHARED"),field("date","2026-01-02"),field("amount","200")]),
  ]);
  const reread=read([
    row("A",[field("account_id","SHARED"),field("date","2026-01-01")]),
    row("B",[field("account_id","SHARED"),field("date","2026-01-02")]),
  ]);
  const result=preserveAgreedFieldsAfterOmission(baseline,reviews(baseline),reread);
  assert.equal(result.complete,true);
  assert.deepEqual(result.records.map(r=>r.fields.find(f=>f.key==="amount")?.value),["100","200"]);
});
test("unique accounts still permit reversed row order reconstruction",()=>{
  const baseline=read([
    row("A",[field("account_id","A0001"),field("amount","100")]),
    row("B",[field("account_id","B0001"),field("amount","200")]),
  ]);
  const reread=read([
    row("B",[field("account_id","B0001")]),
    row("A",[field("account_id","A0001")]),
  ]);
  const result=preserveAgreedFieldsAfterOmission(baseline,reviews(baseline),reread);
  assert.equal(result.complete,true);
  assert.deepEqual(result.records.map(r=>r.fields.find(f=>f.key==="amount")?.value),["200","100"]);
});
