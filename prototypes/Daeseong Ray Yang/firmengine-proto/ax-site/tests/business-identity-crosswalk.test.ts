import test from "node:test";
import assert from "node:assert/strict";
import {businessIdentityCrosswalk} from "../lib/business-identity-crosswalk.ts";
import {createCase,normalizeMoney,type Fact} from "../lib/domain.ts";
const reg="business_registration::",cost="business_costs_and_ledgers::income.business_cost.";
const VAT="business_sales_vat::income.sales.";
function fixture(){
 const d=createCase("Synthetic cross-document business identities","business-identity-fixture","2026-10-30");
 const sha="e".repeat(64),quote="synthetic company name and source details";
 d.documents=[{id:"registration-doc",name:"registration.pdf",sha256:sha,status:"active",pages:[1]},
              {id:"cost-doc",name:"costs.pdf",sha256:sha,status:"active",pages:[1]},
              {id:"vat-doc",name:"sales.pdf",sha256:sha,status:"active",pages:[1]}];
 for(const doc of d.documents)d.pages.push({documentId:doc.id,page:1,role:"evidence",text:quote});
 const add=(id:string,subjectId:string,docId:string,canonicalFieldId:string,value:string,money=false,recognition:"accepted"|"unreviewed"="accepted")=>{
  const fact:Fact={id,logicalId:id,version:1,subjectId,key:"source."+id,canonicalFieldId,value,rawValue:value,
   ...(money?{numeric:normalizeMoney(value),sourceUnit:"KRW"}:{}),
   state:"verified",recognition,validation:[],refs:[{documentId:docId,page:1,quote,sourceHash:sha}]};
  d.facts.push(fact);return fact;
 };
 return {d,add};
}
test("same company name in VAT and cost evidence never creates automatic registration ownership",()=>{
 const {d,add}=fixture();
 add("business-id","registration","registration-doc",reg+"business_id","123-45-67890");
 add("registered-name","registration","registration-doc",reg+"business_entity","ABC synthetic");
 add("vat-name","vat-row","vat-doc",VAT+"business_entity","ABC synthetic");
 add("vat-amount","vat-row","vat-doc",VAT+"gross_sales","3200000",true);
 add("cost-name","cost-row","cost-doc",cost+"business_entity","ABC synthetic");
 add("cost-amount","cost-row","cost-doc",cost+"gross_amount","1200000",true);
 const result=businessIdentityCrosswalk(d);
 assert.equal(result.registrationRows.length,1);
 assert.equal(result.registrationRows[0].verifiedSource,true);
 assert.equal(result.businessSourceRows.length,2);
 assert.equal(result.requiredHumanCrosswalkRows,2);
 assert.ok(result.businessSourceRows.every(row=>row.registrationFactId===null));
 assert.ok(result.businessSourceRows.every(row=>row.ownerNameObserved==="ABC synthetic"));
 assert.ok(result.businessSourceRows.every(row=>row.identityStatus==="unverified_cross_document_identity"));
 assert.equal(result.automaticIdentityApproval,false);
});
test("masked business registration cannot be treated as complete ID evidence",()=>{
 const {d,add}=fixture();
 add("masked","registration","registration-doc",reg+"business_id","123-**-*****");
 const result=businessIdentityCrosswalk(d);
 assert.equal(result.registrationRows.length,1);
 assert.equal(result.registrationRows[0].verifiedSource,false);
 assert.equal(result.automaticIdentityApproval,false);
});
test("a source record without a verified entity name remains review-required",()=>{
 const {d,add}=fixture();
 add("cost-amount","expense","cost-doc",cost+"gross_amount","900000",true);
 add("unverified-name","expense","cost-doc",cost+"business_entity","Same name",false,"unreviewed");
 const row=businessIdentityCrosswalk(d).businessSourceRows[0];
 assert.equal(row.ownerNameObserved,null);
 assert.equal(row.ownerEvidenceVerified,false);
 assert.equal(row.amountFactIds.length,1);
 assert.equal(row.registrationFactId,null);
});
test("two separate business registrations stay separate even if labels match",()=>{
 const {d,add}=fixture();
 add("id-1","reg-1","registration-doc",reg+"business_id","1234567890");
 add("id-2","reg-2","registration-doc",reg+"business_id","9876543210");
 add("cost-name","cost-row","cost-doc",cost+"business_entity","Synthetic",false);
 add("cost-amount","cost-row","cost-doc",cost+"gross_amount","750000",true);
 const result=businessIdentityCrosswalk(d);
 assert.equal(result.registrationRows.length,2);
 assert.equal(result.businessSourceRows.length,1);
 assert.equal(result.businessSourceRows[0].registrationFactId,null);
});

// A3 #121-140: audited source identity and provenance negative cases.
// These assert read-only review boundaries; no calculation or legal approval.
test("changed registration ID without matching source raw value is not verified",()=>{
 const {d,add}=fixture();
 const row=add("business-id","reg-row","registration-doc",reg+"business_id","123-45-67890");
 row.rawValue="987-65-43210";
 const result=businessIdentityCrosswalk(d);
 assert.equal(result.registrationRows.length,1);
 assert.equal(result.registrationRows[0].verifiedSource,false);
 assert.equal(result.registrationRows[0].reviewOnly,true);
 assert.equal(result.automaticIdentityApproval,false);
});
test("registration status, joint operator and dates survive when its ID was not observed",()=>{
 const {d,add}=fixture();
 add("status","reg-row","registration-doc",reg+"status","closed");
 add("joint","reg-row","registration-doc",reg+"joint_operators","Partner A");
 add("opening","reg-row","registration-doc",reg+"opening_date","2025-01-01");
 const result=businessIdentityCrosswalk(d);
 assert.equal(result.registrationRows.length,1);
 assert.equal(result.registrationRows[0].registrationFactId,"");
 assert.equal(result.registrationRows[0].businessIdObserved,null);
 assert.deepEqual(result.registrationRows[0].contextFactIds,["joint","opening","status"]);
 assert.equal(result.registrationRows[0].verifiedSource,false);
 assert.equal(result.automaticIdentityApproval,false);
});
test("same document-local row ID in VAT and cost documents remains two separate staff crosswalk candidates",()=>{
 const {d,add}=fixture(),same="local-row-1";
 add("vat-name",same,"vat-doc",VAT+"business_entity","VAT synthetic");
 add("vat-amount",same,"vat-doc",VAT+"gross_sales","3000000",true);
 add("cost-name",same,"cost-doc",cost+"business_entity","Cost synthetic");
 add("cost-amount",same,"cost-doc",cost+"gross_amount","1000000",true);
 const result=businessIdentityCrosswalk(d);
 assert.equal(result.requiredHumanCrosswalkRows,2);
 assert.equal(result.businessSourceRows.length,2);
 const vat=result.businessSourceRows.find(row=>row.family==="business_sales_vat")!;
 const expense=result.businessSourceRows.find(row=>row.family==="business_costs_and_ledgers")!;
 assert.deepEqual(vat.amountFactIds,["vat-amount"]);
 assert.deepEqual(expense.amountFactIds,["cost-amount"]);
 assert.deepEqual(vat.ownerFactIds,["vat-name"]);
 assert.deepEqual(expense.ownerFactIds,["cost-name"]);
 assert.ok(result.businessSourceRows.every(row=>row.registrationFactId===null));
 assert.equal(result.automaticIdentityApproval,false);
});
test("accepted owner name with mismatching raw source cannot be marked verified",()=>{
 const {d,add}=fixture();
 const owner=add("owner","vat-record","vat-doc",VAT+"business_entity","New normalized name");
 owner.rawValue="Different original OCR name";
 add("gross","vat-record","vat-doc",VAT+"gross_sales","1200000",true);
 const result=businessIdentityCrosswalk(d);
 assert.equal(result.businessSourceRows.length,1);
 assert.deepEqual(result.businessSourceRows[0].ownerFactIds,["owner"]);
 assert.equal(result.businessSourceRows[0].ownerEvidenceVerified,false);
 assert.equal(result.businessSourceRows[0].ownerNameObserved,null);
 assert.equal(result.businessSourceRows[0].identityStatus,"unverified_cross_document_identity");
});
