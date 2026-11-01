import test from "node:test";
import assert from "node:assert/strict";
import { FORM_CONTRACTS } from "../lib/form-contracts.ts";
import { evaluateDocumentPreflight } from "../lib/document-preflight.ts";
import type { FormBindings } from "../lib/form-mapping.ts";

// Entirely invented D5103 evidence rows. This tests internal token validation,
// not factual approval, legal recognition, DOCX parity, or document readiness.
const month=(i:number)=>({
  entity:"SYN-WAGE",period:"2026-"+String(i).padStart(2,"0"),
  revenue:"2,400,000",expense:"0",net_income:"2,400,000",
  source_id:"SYN-ROW-"+i,
  source_stream_id:"SYN-STREAM-WAGE",
  source_fact_ids:"SYN-FACT-"+i,
  source_review_status:"accepted",
  source_calc_role:"period_income_observation",
});
const bindings=(rows:Record<string,string>[]):FormBindings=>({
  scalars:{client_name:"가상 신청인"},
  rows:{month:rows},
});
async function preflight(code:"D5103"|"D5110"|"D5111",rows:Record<string,string>[]) {
  const contract=FORM_CONTRACTS[code];
  return evaluateDocumentPreflight({
    formCode:code,bindings:bindings(rows),contract,mode:"draft",
    identity:{evaluationId:"SYN-EVAL",evaluationResultHash:"SYN-EVAL",referenceBundleHash:"SYN-REF",templateHash:contract.templateHash,documentEditsHash:"SYN-EDIT"},
  });
}
const unknown=(result:Awaited<ReturnType<typeof preflight>>)=>result.blockers.filter(issue=>issue.code==="UNKNOWN_ROW_TOKEN");

test("D5103 accepts five provenance-only month keys without registering them as DOCX fields",async()=>{
  const result=await preflight("D5103",[month(1)]);
  assert.deepEqual(unknown(result),[]);
  const publicFields=FORM_CONTRACTS.D5103.repeatGroups.find(g=>g.id==="month")?.fields??[];
  for(const key of ["source_id","source_stream_id","source_fact_ids","source_review_status","source_calc_role"])assert.ok(!publicFields.includes(key),key);
});
test("shared month bindings do not invalidate D5110 and D5111 preflight",async()=>{
  for(const code of ["D5110","D5111"] as const)assert.deepEqual(unknown(await preflight(code,[month(1)])),[]);
});
test("all twelve synthetic month rows keep internal tokens distinct",async()=>{
  assert.deepEqual(unknown(await preflight("D5103",Array.from({length:12},(_,i)=>month(i+1)))),[]);
});
test("unexpected month field is still blocked",async()=>{
  const result=await preflight("D5103",[{...month(1),source_legal_approval:"yes"}]);
  assert.ok(unknown(result).some(issue=>issue.token==="month.source_legal_approval[0]"));
});
test("provenance keys cannot bypass validation in creditor rows",async()=>{
  const contract=FORM_CONTRACTS.D5110;
  const result=await evaluateDocumentPreflight({
    formCode:"D5110",contract,mode:"draft",
    bindings:{scalars:{client_name:"가상 신청인"},rows:{creditor:[{entity:"SYN-CREDITOR",principal:"100",source_id:"SYN-ROW"}]}},
    identity:{evaluationId:"SYN-EVAL",evaluationResultHash:"SYN-EVAL",referenceBundleHash:"SYN-REF",templateHash:contract.templateHash,documentEditsHash:"SYN-EDIT"},
  });
  assert.ok(unknown(result).some(issue=>issue.token==="creditor.source_id[0]"));
});
