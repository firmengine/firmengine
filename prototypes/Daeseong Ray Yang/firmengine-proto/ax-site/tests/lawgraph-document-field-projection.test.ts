import test from "node:test";
import assert from "node:assert/strict";
import {createCase} from "../lib/domain.ts";
import {projectLawgraphDocumentFields} from "../lib/lawgraph-document-field-projection.ts";
test("LawGraph saved form values preserve exact calculator run and source-unknown distinction",()=>{
 const data=createCase("합성 문서 필드 연결 검증","synthetic-document-lineage","2026-10-30");
 data.context.applicant={name:"가상 신청인"};
 data.facts=[];
 const bindings={scalars:{client_name:"가상 신청인",monthly_income:"3,000,000"},rows:{}} as any;
 const result=projectLawgraphDocumentFields({data,bindings,calculation:{incomeRows:[],debtRows:[],assetRows:[]},
  calculationRows:[{id:"calc-feature-1",outputName:"monthlyIncomeWon",subjectId:null,rowOrdinal:null,value:"3000000",status:"computed",sourceFactIds:["source-f1"]}]});
 const inc=result.find(r=>r.token==="monthly_income"&&r.formCode==="D5103");
 assert.ok(inc);assert.deepEqual(inc?.calcFeatureRefs,["calc-feature-1"]);
 assert.deepEqual(inc?.sourceFactIds,["source-f1"]);
 const identity=result.find(r=>r.token==="client_name"&&r.formCode==="D5100");
 assert.ok(identity);assert.equal((identity?.citation as any)?.status,"case_context");
 const absent=result.find(r=>r.token==="total_principal"&&r.formCode==="D5106");
 assert.ok(absent);assert.deepEqual(absent?.calcFeatureRefs,[]);
 assert.equal((absent?.citation as any)?.status,"missing_value");
});


// A2 synthetic-only regression: technical amount equality is not Fact ownership
// or acceptance. The form value and calculator reference remain visible for review.
test("A2 r91: unknown or malformed calculation Fact IDs require manual form-lineage review",()=>{
 const data=createCase("합성 Fact 계보 검증","synthetic-a2-r91","2026-11-03");
 data.facts=[];
 const render=(ids:unknown,displayed:string|null,stored:string)=>{
  const results=projectLawgraphDocumentFields({
   data,
   bindings:{scalars:{monthly_income:displayed},rows:{}} as any,
   calculation:{incomeRows:[],debtRows:[],assetRows:[]},
   calculationRows:[{id:"SYN-RUN-A:FEATURE-1",outputName:"monthlyIncomeWon",
    subjectId:null,rowOrdinal:null,value:stored,status:"computed",
    sourceFactIds:ids as string[]}]
  });
  const row=results.find(r=>r.formCode==="D5103"&&r.token==="monthly_income");
  assert.ok(row);return row;
 };
 for(const [label,ids,displayed,stored,expectedIds] of [
  ["absent",["SYN-UNKNOWN"],"1,000원","1000",["SYN-UNKNOWN"]],
  ["foreign",["SYN-OTHER-CASE"],"1,000원","1000",["SYN-OTHER-CASE"]],
  ["string-not-array","SYN-UNKNOWN","1,000원","1000",[]],
  ["number-not-array",42,"1,000원","1000",[]],
  ["mixed-array",["SYN-UNKNOWN",42],"1,000원","1000",["SYN-UNKNOWN"]],
  ["explicit-zero",["SYN-UNKNOWN"],"0원","0",["SYN-UNKNOWN"]]
 ] as const){
  const row=render(ids,displayed,stored);
  assert.equal((row.citation as any).status,"lineage_review_required",label);
  assert.equal((row.citation as any).manualReviewRequired,true,label);
  assert.deepEqual(row.sourceFactIds,expectedIds,label);
  assert.deepEqual(row.calcFeatureRefs,["SYN-RUN-A:FEATURE-1"],label);
  assert.equal(row.value,displayed,label);
 }
 const unobserved=render(["SYN-UNKNOWN"],null,"0");
 assert.equal((unobserved.citation as any).status,"missing_value");
 assert.equal((unobserved.citation as any).manualReviewRequired,true);
 assert.equal(unobserved.value,null);
});
