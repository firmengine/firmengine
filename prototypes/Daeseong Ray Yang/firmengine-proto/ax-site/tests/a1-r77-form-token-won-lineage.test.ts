import test from "node:test";
import assert from "node:assert/strict";
import {createCase} from "../lib/domain.ts";
import {projectLawgraphDocumentFields} from "../lib/lawgraph-document-field-projection.ts";

// All values are synthetic. A wrong OCR grouping cannot be blessed by a
// numerical equality after deleting arbitrary commas or embedded spaces.
function row(printed:unknown,computed:unknown,subjectId:string|null="synthetic-income-A"){
 const data=createCase("synthetic A1 r77 money lineage","synthetic-a1-r77","2026-11-02");
 const fields=projectLawgraphDocumentFields({
  data,
  bindings:{scalars:{monthly_income:"100"},rows:{month:[{net_income:String(printed??"")}]}} as any,
  calculation:{incomeRows:[{id:"synthetic-income-A"}],debtRows:[],assetRows:[]},
  calculationRows:[{id:"CF-synthetic",outputName:"incomeRows.monthlyWon",
    subjectId,rowOrdinal:0,value:computed,status:"computed",sourceFactIds:[]}]
 });
 const result=fields.find(field=>field.formCode==="D5103"&&field.token==="month.net_income");
 assert.ok(result,"D5103 repeated-row token should be projected");
 return result;
}
test("A1-DATA-015: malformed comma groups and interior spaces are not calculation lineage",()=>{
 for(const [rendered,calculated] of [
  ["1,00","100"],["1,,000","1000"],["10,00","1000"],
  ["1 00","100"],["100","1,00"],["1,00","1,00"]
 ] as const){
  const field=row(rendered,calculated);
  assert.deepEqual(field.calcFeatureRefs,[],rendered+" / "+calculated);
  assert.equal((field.citation as any).status,"lineage_review_required");
  assert.equal((field.citation as any).manualReviewRequired,true);
 }
});
test("A1-DATA-015: genuine canonical amounts, explicit zero and negatives preserve lineage",()=>{
 for(const [rendered,calculated] of [
  ["100","100"],["1,000","1000"],["₩1,000원","1000"],["0",0],["-100","-100"]
 ] as const){
  const field=row(rendered,calculated);
  assert.deepEqual(field.calcFeatureRefs,["CF-synthetic"]);
  assert.equal((field.citation as any).status,"linked_calculation");
 }
});
test("A1-DATA-015: a different subject cannot borrow a valid same-value source",()=>{
 const field=row("100","100","synthetic-income-B");
 assert.deepEqual(field.calcFeatureRefs,[]);
 assert.equal((field.citation as any).manualReviewRequired,true);
});
