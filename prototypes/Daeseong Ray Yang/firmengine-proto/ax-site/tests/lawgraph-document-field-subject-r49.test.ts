import test from "node:test";
import assert from "node:assert/strict";
import {createCase} from "../lib/domain.ts";
import {projectLawgraphDocumentFields} from "../lib/lawgraph-document-field-projection.ts";

// Synthetic values only. Repeated rows must be anchored to the exact subject, not ordinal/value alone.
function run(featureSubjectId:string|null,outputName="incomeRows.monthlyWon",expectedSubjectId="synthetic-income-B",ordinal:number|null=0){
  const data=createCase("synthetic A1 r49 token lineage","synthetic-r49-case","2026-11-01");
  const bindings={scalars:{monthly_income:"100"},rows:{month:[{net_income:"100"}]}} as any;
  const rows=[{id:"synthetic-calc-feature",outputName,subjectId:featureSubjectId,rowOrdinal:ordinal,
    value:"100",status:"computed",sourceFactIds:[]}];
  const fields=projectLawgraphDocumentFields({data,bindings,
    calculation:{incomeRows:expectedSubjectId?[{id:expectedSubjectId}]:[],debtRows:[],assetRows:[]},
    calculationRows:rows});
  return {row:fields.find(x=>x.formCode==="D5103"&&x.token==="month.net_income"),
    scalar:fields.find(x=>x.formCode==="D5103"&&x.token==="monthly_income")};
}
test("A1-DATA-015: exact matching repeated income subject and ordinal can link",()=>{
  const {row}=run("synthetic-income-B");
  assert.ok(row);assert.equal(row.subjectId,"synthetic-income-B");
  assert.deepEqual(row.calcFeatureRefs,["synthetic-calc-feature"]);
  assert.equal((row.citation as any).status,"linked_calculation");
});
test("A1-DATA-015: null calculation subject cannot bind a named repeated row by ordinal and value",()=>{
  const {row}=run(null);
  assert.ok(row);assert.deepEqual(row.calcFeatureRefs,[]);
  assert.equal((row.citation as any).status,"lineage_review_required");
  assert.equal((row.citation as any).manualReviewRequired,true);
});
test("A1-DATA-015: different calculation subject never binds an unrelated repeated row",()=>{
  const {row}=run("synthetic-income-A");
  assert.ok(row);assert.deepEqual(row.calcFeatureRefs,[]);
  assert.equal((row.citation as any).manualReviewRequired,true);
});
test("A1-DATA-015: missing expected row subject cannot borrow a null-subject calculation row",()=>{
  const {row}=run(null,"incomeRows.monthlyWon","",0);
  assert.ok(row);assert.deepEqual(row.calcFeatureRefs,[]);
  assert.equal((row.citation as any).manualReviewRequired,true);
});
test("A1-DATA-015: scalar calculation requires null row ordinal and null subject",()=>{
  const valid=run(null,"monthlyIncomeWon","synthetic-income-B",null).scalar;
  assert.ok(valid);assert.deepEqual(valid.calcFeatureRefs,["synthetic-calc-feature"]);
  assert.equal((valid.citation as any).status,"linked_calculation");
  const foreign=run("synthetic-income-A","monthlyIncomeWon","synthetic-income-B",null).scalar;
  assert.ok(foreign);assert.deepEqual(foreign.calcFeatureRefs,[]);
  assert.equal((foreign.citation as any).status,"lineage_review_required");
});
test("A1-DATA-015: repeated row with wrong ordinal stays unresolved",()=>{
  const {row}=run("synthetic-income-B","incomeRows.monthlyWon","synthetic-income-B",1);
  assert.ok(row);assert.deepEqual(row.calcFeatureRefs,[]);
  assert.equal((row.citation as any).manualReviewRequired,true);
});
