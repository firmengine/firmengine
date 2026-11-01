import test from "node:test";
import assert from "node:assert/strict";
import { stableFormRowIds } from "../lib/document-writer.ts";
import { MISSING_FORM_VALUE, type FormBindings } from "../lib/form-mapping.ts";
import type { CaseData } from "../lib/domain.ts";
import type { ExecutionSnapshot } from "../lib/reactive-evaluation.ts";

const debts=[{id:"synthetic-debt-a",creditor:"Synthetic A",secured:"no",classification:"ordinary",factIds:[]},{id:"synthetic-debt-b",creditor:"Synthetic B",secured:"no",classification:"ordinary",factIds:[]}];
const data={debts,documents:[],facts:[]} as unknown as CaseData;
const execution={assessment:{calculation:{debtRows:[{id:"synthetic-debt-a"},{id:"synthetic-debt-b"}],assetRows:[],incomeRows:[]}}} as unknown as ExecutionSnapshot;
function bindings(creditor: Array<{assignment_order?:string|null}>|undefined):FormBindings {
  return {scalars:{},rows:{...(creditor?{creditor:creditor as Record<string,string>[]}:{})}} as FormBindings;
}

test("assignment row IDs reject missing original creditor row bindings",()=>{
  assert.deepEqual(stableFormRowIds("assignment",data,execution,bindings(undefined)),[]);
});
test("assignment row IDs reject undefined, null and blank source field and keep valid row",()=>{
  for(const source of [undefined,null,"","   ",MISSING_FORM_VALUE]){
    assert.deepEqual(stableFormRowIds("assignment",data,execution,bindings([{assignment_order:source},{assignment_order:"Synthetic assignment notice"}])),["synthetic-debt-b"]);
  }
});
test("assignment row IDs keep present source and unchanged creditor IDs",()=>{
  const linked=bindings([{assignment_order:MISSING_FORM_VALUE},{assignment_order:"Synthetic assignment notice"}]);
  assert.deepEqual(stableFormRowIds("assignment",data,execution,linked),["synthetic-debt-b"]);
  assert.deepEqual(stableFormRowIds("creditor",data,execution,linked),["synthetic-debt-a","synthetic-debt-b"]);
});
