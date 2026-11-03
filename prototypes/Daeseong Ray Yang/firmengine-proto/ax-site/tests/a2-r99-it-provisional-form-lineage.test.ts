/** A2 r99 synthetic-only regression: source-linked calculation is not a legal approval. */
import test from "node:test";
import assert from "node:assert/strict";
import {createCase} from "../lib/domain.ts";
import {projectLawgraphDocumentFields} from "../lib/lawgraph-document-field-projection.ts";

function fixture(value: unknown, status: string, sourceIds: string[] = ["SYN-FACT"]) {
  const data=createCase("합성 A2 원천-서식 검증","synthetic-a2-provisional-only","2026-11-03");
  data.facts=[];
  const bindings={scalars:{monthly_income:value},rows:{}} as any;
  const results=projectLawgraphDocumentFields({
    data,bindings,calculation:{incomeRows:[],debtRows:[],assetRows:[]},
    calculationRows:[{id:"SYN-CALC",outputName:"monthlyIncomeWon",subjectId:null,rowOrdinal:null,
      value:"900000",status,sourceFactIds:sourceIds}]
  });
  const row=results.find(r=>r.formCode==="D5103"&&r.token==="monthly_income");
  assert.ok(row);
  return row;
}

test("A2 r99: provisional calculator input remains linked but requires human review",()=>{
  const row=fixture("900000","provisional");
  assert.equal(row.citation.status,"linked_calculation");
  assert.equal(row.citation.calculationStatus,"provisional");
  assert.equal(row.citation.manualReviewRequired,true);
  assert.equal(row.value,"900000");
  assert.deepEqual(row.sourceFactIds,["SYN-FACT"]);
});
test("A2 r99: computed status retains technical link, not legal certification",()=>{
  const row=fixture("900000","computed");
  assert.equal(row.citation.status,"linked_calculation");
  assert.equal(row.citation.manualReviewRequired,false);
  assert.equal(row.citation.officialEformParity,"not_verified");
});
for(const state of ["blocked","conflict","missing"]){
  test(`A2 r99: ${state} calculator input does not link`,()=>{
    const row=fixture("900000",state);
    assert.equal(row.citation.status,"lineage_review_required");
    assert.equal(row.citation.manualReviewRequired,true);
  });
}
test("A2 r99: missing binding remains missing, not numeric zero",()=>{
  const row=fixture(null,"computed");
  assert.equal(row.citation.status,"missing_value");
  assert.equal(row.value,null);
  assert.equal(row.citation.manualReviewRequired,true);
});
test("A2 r99: mismatching displayed amount cannot claim calculated lineage",()=>{
  const row=fixture("900001","computed");
  assert.equal(row.citation.status,"lineage_review_required");
  assert.equal(row.citation.manualReviewRequired,true);
});

test.todo("A2 r99: entire project Node runner, staging D1 and real D5103 DOCX roundtrip");
test.todo("A2 r99: official court template and human lawyer / accounting approval");
