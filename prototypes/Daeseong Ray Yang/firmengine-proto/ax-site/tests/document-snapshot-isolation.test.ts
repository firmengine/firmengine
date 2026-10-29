import test from "node:test";
import assert from "node:assert/strict";
import { createCase, DRAFT_RULESET } from "../lib/domain.ts";
import { buildDerivedExecution } from "../lib/reactive-evaluation.ts";
import { writeOfficePackage } from "../lib/office-writer.ts";
import { readRenderedDocx } from "../lib/office-writer.ts";

function freezeTree(value:unknown):void {
  if(value&&typeof value==="object"){
    Object.values(value).forEach(freezeTree);
    Object.freeze(value);
  }
}

test("rendering all documents preserves the saved execution snapshot and its binding digest",async()=>{
  const data=createCase("Document snapshot isolation","synthetic-render-isolation","2026-10-29");
  const execution=buildDerivedExecution(data);
  const before=JSON.stringify(execution);
  freezeTree(execution);
  const files=await writeOfficePackage({data,rules:DRAFT_RULESET,mode:"draft",preparedExecution:execution});
  assert.ok(files.some(file=>file.kind==="application"));
  assert.ok(files.some(file=>file.kind==="repayment_plan"));
  assert.equal(JSON.stringify(execution),before);
  assert.equal(Object.hasOwn(execution.formBindings!.scalars,"review_status"),false);
  assert.equal(Object.hasOwn(execution.formBindings!.scalars,"revision"),false);
});

test("the draft available-income formula displays its observed operands without approving income",async()=>{
  const data=createCase("Draft arithmetic display","synthetic-render-formula","2026-10-29");
  const execution=buildDerivedExecution(data);
  Object.assign(execution.formBindings!.scalars,{
    approved_monthly_income:"[확인 필요]",monthly_income:"800,000",recognized_living_cost:"1,500,000",
    monthly_trustee_fee:"0",repayment_months:"36",form_pre_fee_disposable:"-700,000",
    form_available_after_trustee:"-700,000",form_total_available_after_trustee:"-25,200,000",
    monthly_payment:"[확인 필요]",total_repayment:"[확인 필요]",
  });
  const before=JSON.stringify(execution.formBindings);
  const files=await writeOfficePackage({data,rules:DRAFT_RULESET,mode:"draft",preparedExecution:execution});
  const plan=files.find(file=>file.kind==="repayment_plan")!;
  const actual=readRenderedDocx(plan.bytes,execution.documentPayloads!.find(item=>item.kind==="repayment_plan")!);
  const table=actual.tables.find(item=>item.headers[0]==="① 월평균 수입")!;
  assert.deepEqual(table.rows[0],["800,000","1,500,000","-700,000","0","-700,000","36","-25,200,000"]);
  assert.ok(actual.paragraphs.some(text=>text.includes("법적 인정은 별도 검토")&&text.includes("음수는 부족액")));
  assert.equal(execution.formBindings!.scalars.monthly_payment,"[확인 필요]");
  assert.equal(execution.formBindings!.scalars.approved_monthly_income,"[확인 필요]");
  assert.equal(JSON.stringify(execution.formBindings),before);
});

test("physical form arithmetic keeps trustee fees separate and rejects inconsistent persisted totals",async()=>{
  const data=createCase("Trustee fee arithmetic","synthetic-fee-arithmetic","2026-10-29");
  const execution=buildDerivedExecution(data);
  Object.assign(execution.formBindings!.scalars,{
    approved_monthly_income:"[확인 필요]",monthly_income:"2,500,000",recognized_living_cost:"1,500,000",
    monthly_trustee_fee:"20,000",repayment_months:"12",form_pre_fee_disposable:"1,000,000",
    form_available_after_trustee:"980,000",form_total_available_after_trustee:"11,760,000",
    monthly_payment:"770,000",total_repayment:"9,240,000",
  });
  const files=await writeOfficePackage({data,rules:DRAFT_RULESET,mode:"draft",preparedExecution:execution});
  const rendered=JSON.parse(new TextDecoder().decode(files.find(file=>file.kind==="rendered_json")!.bytes));
  const plan=rendered.documents.find((document:{kind:string})=>document.kind==="repayment_plan");
  const table=plan.tables.find((table:{headers:string[]})=>table.headers[0]==="① 월평균 수입");
  assert.deepEqual(table.rows[0],["2,500,000","1,500,000","1,000,000","20,000","980,000","12","11,760,000"]);
  const readiness=rendered.filingReadiness.documents.find((document:{kind:string})=>document.kind==="repayment_plan");
  assert.equal(readiness.formulaStatus,"consistent");
  assert.equal(readiness.artifactSha256,files.find(file=>file.kind==="repayment_plan")!.hash);
  assert.equal(readiness.readyForElectronicFiling,false);
  assert.equal(execution.formBindings!.scalars.monthly_payment,"770,000");
  execution.formBindings!.scalars.form_total_available_after_trustee="11,759,999";
  await assert.rejects(writeOfficePackage({data,rules:DRAFT_RULESET,mode:"draft",preparedExecution:execution}),/OFFICIAL_FORM_ARITHMETIC_MISMATCH/);
});
