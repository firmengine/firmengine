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
