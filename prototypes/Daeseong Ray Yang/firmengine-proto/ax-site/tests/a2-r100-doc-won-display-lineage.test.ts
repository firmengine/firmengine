/** A2 r100 - synthetic display money/lineage contract, NOT a court-form or legal approval test. */
import test from "node:test";
import assert from "node:assert/strict";
import {createCase} from "../lib/domain.ts";
import {projectLawgraphDocumentFields} from "../lib/lawgraph-document-field-projection.ts";

type Case = {label:string;rendered:unknown;stored:unknown;links:boolean};
const cases:Case[]=[
 {label:"canonical plain integer",rendered:"120",stored:"120",links:true},
 {label:"correct thousands separator",rendered:"1,200원",stored:"1200",links:true},
 {label:"Won symbol and unit",rendered:"₩ 1,200원",stored:"1200",links:true},
 {label:"zero string",rendered:"0",stored:"0",links:true},
 {label:"number zero",rendered:0,stored:"0",links:true},
 {label:"negative integer syntax only",rendered:"-100",stored:"-100원",links:true},
 {label:"broken grouping 1,20",rendered:"1,20",stored:"120",links:false},
 {label:"equal malformed sides are not authoritative",rendered:"1,20",stored:"1,20",links:false},
 {label:"double comma",rendered:"1,,200",stored:"1200",links:false},
 {label:"embedded space",rendered:"1 200",stored:"1200",links:false},
 {label:"scientific notation",rendered:"1e3",stored:"1000",links:false},
 {label:"decimal Won not an integer",rendered:"12.5",stored:"12.5",links:false},
 {label:"null cannot equal zero",rendered:null,stored:"0",links:false},
 {label:"blank cannot equal zero",rendered:"",stored:"0",links:false},
 {label:"leading zero",rendered:"0012",stored:"12",links:false},
 {label:"unsafe numeric JS value",rendered:9007199254740992,stored:"9007199254740992",links:false}
];
for (const x of cases) {
 test("A2 r100 calculation form amount: "+x.label,()=>{
  const data=createCase("SYN A2 display check","synthetic-a2-won-display","2026-11-03");
  data.facts=[];
  const rows=projectLawgraphDocumentFields({
   data,
   bindings:{scalars:{monthly_income:x.rendered},rows:{}} as any,
   calculation:{incomeRows:[],debtRows:[],assetRows:[]},
   calculationRows:[{id:"SYN-CALC",outputName:"monthlyIncomeWon",subjectId:null,rowOrdinal:null,
    value:x.stored,status:"computed",sourceFactIds:["SYN-REF"]}]
  });
  const got=rows.find(row=>row.formCode==="D5103"&&row.token==="monthly_income");
  assert.ok(got,"D5103 monthly_income contract is present");
  assert.equal(got.calcFeatureRefs?.length===1,x.links);
  assert.equal((got.citation as any)?.status,x.links?"linked_calculation":x.rendered===null||x.rendered===""?"missing_value":"lineage_review_required");
  if(!x.links)assert.equal((got.citation as any)?.manualReviewRequired,true);
  assert.equal((got.citation as any)?.officialEformParity,"not_verified");
 });
}
test.todo("Project-installed Node TypeScript run/CI and live D1 SQL feature roundtrip");
test.todo("Combine #219 provisional manual-review and #205/#207/#209 Fact/run identity without overwriting");
test.todo("Actual D5103/D5106/D5110/D5111 DOCX ZIP/XML value/row readback and formal reviewer approval");
