import test from "node:test";
import assert from "node:assert/strict";
import {projectPage,type PageRead} from "../lib/extraction.ts";
import {applyExtraction,createCase} from "../lib/domain.ts";

// Independent synthetic OCR rows. They must never be flattened or summed.
const sourceHash="b".repeat(64);
const field=(key:string,value:string|null)=>({
 key,label:key,value,unit:null,quote:key+" "+(value??"unreadable"),
 confidence:"clear" as const,bbox:[0.1,0.1,0.5,0.2] as [number,number,number,number],
 sourceState:value===null?"illegible" as const:"present" as const
});
const record=(label:string,values:[string,string|null][])=>({
 category:"household" as const,label,fields:values.map(([key,value])=>field(key,value))
});
const extract=(records:PageRead["records"])=>projectPage({
 documentType:"unknown",records,warnings:[],complete:true
},"household-doc",1,sourceHash);

test("one household total and multiple individual members preserve all fact rows, without adding person-count values",()=>{
 const result=extract([
  record("household total",[["reported_members","3"]]),
  record("member A",[["member_name","synthetic applicant"]]),
  record("member B",[["member_name","synthetic dependent"]]),
 ]);
 assert.equal(result.household?.reportedMembers,3);
 assert.equal(result.household?.factIds.length,3);
 assert.equal(result.facts?.length,3);
 assert.equal(new Set(result.household?.factIds).size,3);
});
test("two apparent household totals are NOT last-record-wins, even when equal",()=>{
 for(const values of [["1","2"],["1","1"]]){
  const result=extract([
   record("member-one",[["reported_members",values[0]]]),
   record("member-two",[["reported_members",values[1]]]),
  ]);
  assert.equal(result.household?.reportedMembers,null);
  assert.equal(result.household?.factIds.length,2);
  assert.equal(result.facts?.length,2);
  assert.ok(result.warnings?.some(x=>x.includes("복수 행")));
 }
});
test("member-only records retain evidence without fabricating a household total",()=>{
 const result=extract([
  record("applicant",[["member_name","synthetic applicant"]]),
  record("child",[["member_name","synthetic child"]]),
 ]);
 assert.equal(result.household?.reportedMembers,undefined);
 assert.equal(result.household?.factIds.length,2);
});
test("unreadable single total is not treated as zero or as non-applicable",()=>{
 const result=extract([record("unreadable total",[["reported_members",null]])]);
 assert.equal(result.household?.reportedMembers,null);
 assert.ok(result.warnings?.some(x=>x.includes("누락·오인식")));
});

test("separate pages with conflicting household totals invalidate auto-count instead of overwriting the first",()=>{
 const data=createCase("synthetic household source conflict","synthetic-household-conflict","2026-10-30");
 data.documents=[
  {id:"doc-A",name:"first.pdf",sha256:sourceHash,status:"active",pages:[1]},
  {id:"doc-B",name:"second.pdf",sha256:sourceHash,status:"active",pages:[1]}
 ];
 data.pages=[
  {documentId:"doc-A",page:1,role:"evidence",text:"reported_members 3"},
  {documentId:"doc-B",page:1,role:"evidence",text:"reported_members 2"}
 ];
 const reading=(value:string):PageRead=>({
  documentType:"unknown",complete:true,warnings:[],
  records:[record("household total",[["reported_members",value]])]
 });
 const first=applyExtraction(data,projectPage(reading("3"),"doc-A",1,sourceHash));
 assert.equal(first.household.reportedMembers,3);
 const second=applyExtraction(first,projectPage(reading("2"),"doc-B",1,sourceHash));
 assert.equal(second.household.reportedMembers,null);
 assert.equal(second.household.recognition,"unreviewed");
 assert.ok(second.household.factIds.length>=2);
 assert.ok(second.extractionWarnings?.some(x=>x.includes("복수·상충")));
});
