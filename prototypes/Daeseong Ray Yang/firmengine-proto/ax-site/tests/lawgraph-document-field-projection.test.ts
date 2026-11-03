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


test("form lineage never treats provisional or noncurrent calculator sources as independently reviewed",()=>{
 const data=createCase("합성 법률 서식 계보 경계","synthetic-form-lineage-boundary","2026-10-30");
 data.facts=[];
 const fields=(status:string,sourceFactIds:string[],displayValue="100")=>projectLawgraphDocumentFields({
  data,bindings:{scalars:{monthly_income:displayValue},rows:{}},
  calculation:{incomeRows:[],debtRows:[],assetRows:[]},
  calculationRows:[{id:"calc-source-1",outputName:"monthlyIncomeWon",subjectId:null,rowOrdinal:null,
   value:"100",status,sourceFactIds}]
 }).find(field=>field.token==="monthly_income"&&field.formCode==="D5103");
 const computed=fields("computed",[]);
 assert.ok(computed);assert.equal((computed?.citation as any).status,"linked_calculation");
 assert.equal((computed?.citation as any).manualReviewRequired,false);
 const provisional=fields("provisional",[]);
 assert.ok(provisional);assert.deepEqual(provisional?.calcFeatureRefs,["calc-source-1"]);
 assert.equal((provisional?.citation as any).calculationStatus,"provisional");
 assert.equal((provisional?.citation as any).manualReviewRequired,true);
 const stale=fields("computed",["withdrawn-fact"]);
 assert.ok(stale);assert.deepEqual(stale?.sourceFactIds,["withdrawn-fact"]);
 assert.equal((stale?.citation as any).manualReviewRequired,true);
 const blocked=fields("blocked",[]);
 assert.ok(blocked);assert.deepEqual(blocked?.calcFeatureRefs,[]);
 assert.equal((blocked?.citation as any).manualReviewRequired,true);
 const absent=fields("computed",[],"[확인 필요]");
 assert.ok(absent);assert.equal((absent?.citation as any).status,"missing_value");
 assert.equal((absent?.citation as any).manualReviewRequired,true);
});
