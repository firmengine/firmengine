import test from "node:test";
import assert from "node:assert/strict";
import type { PageRead } from "../lib/extraction.ts";
import { bindVerificationChecks,indexedVerificationRead } from "../lib/verification-bindings.ts";

const read:PageRead={documentType:"synthetic",complete:true,warnings:[],records:[
  {category:"other",label:"title",fields:[{key:"document_title",label:"document title",value:"Synthetic title",unit:null,quote:"Title",confidence:"clear",bbox:null}]},
  {category:"statement",label:"author",fields:[
    {key:"author_role",label:"author role",value:"applicant",unit:null,quote:"Author is applicant",confidence:"clear",bbox:null},
    {key:"applicant_intent",label:"applicant intent",value:"I apply",unit:null,quote:"I apply",confidence:"clear",bbox:null},
  ]},
]};
const check=(recordIndex:number,fieldIndex:number,value:string)=>({recordIndex,fieldIndex,meaningStatus:"supported",status:"agrees",value,unit:null,quote:value,reason:"synthetic"});

test("verifier serialization carries explicit zero-based record and field coordinates",()=>{
  const indexed=indexedVerificationRead(read);
  assert.deepEqual(indexed.records.map(r=>r.recordIndex),[0,1]);
  assert.deepEqual(indexed.records.map(r=>r.fields.map(f=>f.fieldIndex)),[[0],[0,1]]);
  assert.equal(indexed.records[1].fields[0].key,"author_role");
});

test("bound checks preserve valid coordinates and repairs are restricted to requested targets",()=>{
  const valid=bindVerificationChecks(read,[check(0,0,"Synthetic title"),check(1,0,"applicant")]);
  assert.deepEqual(valid.bindingIssues,[]);assert.deepEqual(valid.checks.map(c=>[c.recordIndex,c.fieldIndex]),[[0,0],[1,0]]);
  const repair=bindVerificationChecks(read,[check(1,0,"applicant")],[{recordIndex:1,fieldIndex:0}]);
  assert.deepEqual(repair.bindingIssues,[]);assert.equal(repair.checks.length,1);
  const extra=bindVerificationChecks(read,[check(1,0,"applicant"),check(1,1,"I apply")],[{recordIndex:1,fieldIndex:0}]);
  assert.deepEqual(extra.checks,[]);assert.ok(extra.bindingIssues.includes("CHECK_OUTSIDE_REPAIR_TARGETS:1:1"));
});

test("one negative or out-of-range coordinate discards every check in that pass",()=>{
  for(const invalid of [
    {recordIndex:-1,fieldIndex:0},
    {recordIndex:1,fieldIndex:-1},
    {recordIndex:2,fieldIndex:0},
    {recordIndex:1,fieldIndex:2},
  ]){
    const result=bindVerificationChecks(read,[check(0,0,"Synthetic title"),{...check(invalid.recordIndex,invalid.fieldIndex,"bad" )}]);
    assert.deepEqual(result.checks,[]);assert.ok(result.bindingIssues.length>0);
  }
});

test("duplicate coordinates discard the entire pass instead of accepting a usable-looking subset",()=>{
  const result=bindVerificationChecks(read,[check(1,0,"applicant"),check(1,0,"applicant")]);
  assert.deepEqual(result.checks,[]);assert.ok(result.bindingIssues.includes("DUPLICATE_CHECK_COORDINATE:1:0"));
});
