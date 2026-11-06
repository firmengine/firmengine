// A2 r85 SYNTHETIC ONLY: exact form/calculator numeric lineage, not legal recognition.
import test from "node:test";
import assert from "node:assert/strict";
import {createCase} from "../lib/domain.ts";
import {projectLawgraphDocumentFields} from "../lib/lawgraph-document-field-projection.ts";

const CASES=[
 {label:"canonical zero",display:"0원",stored:"0",linked:true},
 {label:"canonical comma",display:"1,000원",stored:"1000",linked:true},
 {label:"negative canonical",display:"-12원",stored:"-12",linked:true},
 {label:"currency prefix",display:"₩ 1,000원",stored:"1000",linked:true},
 {label:"bad comma grouping",display:"1,00",stored:"100",linked:false},
 {label:"embedded unit",display:"1원2",stored:"12",linked:false},
 {label:"embedded space",display:"0 0",stored:"00",linked:false},
 {label:"embedded currency",display:"12₩34",stored:"1234",linked:false},
 {label:"double bad comma",display:"1,234,56",stored:"123456",linked:false},
 {label:"same malformed source and display",display:"1,00",stored:"1,00",linked:false},
 {label:"unobserved marker",display:"[미관찰]",stored:"0",linked:false},
 {label:"approval pending marker",display:"[승인전]",stored:"0",linked:false},
] as const;
for(const months of [36,48,60]){
 for(const c of CASES){
  test(`A2 DATA r85 ${months} months / ${c.label}: reject invented calculation link`,()=>{
   const data=createCase("합성 소득 금액 연결","SYN-LINEAGE","2026-11-03");
   data.context.planMonths=months;
   data.facts=[];
   const bindings={scalars:{monthly_income:c.display},rows:{}} as any;
   const result=projectLawgraphDocumentFields({data,bindings,calculation:{incomeRows:[],debtRows:[],assetRows:[]},
    calculationRows:[{id:"SYN-CALC-1",outputName:"monthlyIncomeWon",subjectId:null,rowOrdinal:null,
      value:c.stored,status:"computed",sourceFactIds:["SYN-FACT-1"]}]});
   const item=result.find(r=>r.token==="monthly_income"&&r.formCode==="D5103");
   assert.ok(item,"D5103 monthly_income token should be present");
   assert.deepEqual(item.calcFeatureRefs,c.linked?["SYN-CALC-1"]:[]);
   assert.equal((item.citation as any)?.status,c.linked?"linked_calculation":"lineage_review_required");
   if(!c.linked)assert.deepEqual(item.sourceFactIds,[]);
  });
 }
}
test.todo("Fact owner, revision and recognition need a run-bound resolver");
test.todo("SQL source_fact_ids_json to actual DOCX ZIP/XML readback needs E2E");
test.todo("2026-10-01 Seoul Guideline 424 case applicability requires lawyer approval");
