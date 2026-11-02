import test from "node:test";
import assert from "node:assert/strict";
import { stableFormRowIds } from "../lib/document-writer.ts";
import { MISSING_FORM_VALUE, type FormBindings } from "../lib/form-mapping.ts";
import type { CaseData } from "../lib/domain.ts";
import type { ExecutionSnapshot } from "../lib/reactive-evaluation.ts";

// Synthetic identifiers only; no client documents, OCR values or legal recognition.
const data={debts:[{id:"synthetic-debt-A"},{id:"synthetic-debt-B"}],documents:[],facts:[]} as unknown as CaseData;
const execution={assessment:{calculation:{debtRows:[{id:"synthetic-debt-A"},{id:"synthetic-debt-B"}],assetRows:[],incomeRows:[]}}} as unknown as ExecutionSnapshot;
const bindings=(a:string|null|undefined,b:string|null|undefined):FormBindings=>({
  scalars:{},rows:{creditor:[{assignment_order:a},{assignment_order:b}]}
}) as unknown as FormBindings;

test("whitespace-wrapped missing sentinel does not create assignment row identities",()=>{
  for(const value of [` ${MISSING_FORM_VALUE} `,`\n${MISSING_FORM_VALUE}\n`,`\t${MISSING_FORM_VALUE}\t`]){
    assert.deepEqual(stableFormRowIds("assignment",data,execution,bindings(value,"Synthetic assignment notice")),["synthetic-debt-B"]);
  }
});

test("missing, null and blank assignment values remain separate from present text",()=>{
  for(const value of [undefined,null,""," ",MISSING_FORM_VALUE]){
    assert.deepEqual(stableFormRowIds("assignment",data,execution,bindings(value,"Synthetic assignment notice")),["synthetic-debt-B"]);
  }
});

test("valid assignment IDs and independent creditor row identities are preserved",()=>{
  const b=bindings("Synthetic transfer A","Synthetic transfer B");
  assert.deepEqual(stableFormRowIds("assignment",data,execution,b),["synthetic-debt-A","synthetic-debt-B"]);
  assert.deepEqual(stableFormRowIds("creditor",data,execution,b),["synthetic-debt-A","synthetic-debt-B"]);
});
