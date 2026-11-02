/** A3 r83 diagnostic RED tests. Synthetic only; lawyer/accountant must decide
 * whether and when each new registration fact invalidates reviewed monthly net.
 * Never merge as a legal policy change without real Node/CI and human approval.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {businessNetReviewBasis} from "../lib/business-net-reconciliation.ts";
import {createCase,type Fact} from "../lib/domain.ts";

function fixture(){
 const data=createCase("Synthetic A3 registration dependency","a3-r83-synthetic","2026-11-01");
 const add=(id:string,canonicalFieldId:string,value:string):Fact=>{
  const f:Fact={
   id,logicalId:id,version:1,subjectId:"synthetic-registration-row",
   key:"synthetic.source."+id,canonicalFieldId,value,rawValue:value,
   state:"verified",recognition:"accepted",validation:[],refs:[]
  };
  data.facts.push(f);return f;
 };
 const reg=add("synthetic-reg-id","business_registration::business_id","1234567890");
 const proposal={
  sourceFactIds:[reg.id],month:"2026-09",payerIdentityId:"1234567890",
  grossWon:"3000",costWon:"1000",netWon:"2000",
  referenceSha256:"a".repeat(64),referenceRuleId:"synthetic-only-rule"
 };
 return {data,add,proposal};
}

test("A3 r83 CONTROL changing a sourceFactId member changes review basis",()=>{
 const {data,add,proposal}=fixture();
 const before=businessNetReviewBasis(data,proposal);
 add("synthetic-extra","business_registration::opening_date","2026-01-01");
 const unchanged=businessNetReviewBasis(data,proposal);
 assert.equal(unchanged,before,"current sourceFactIds-only snapshot control");
 data.facts.find(f=>f.id==="synthetic-reg-id")!.value="0000000000";
 const after=businessNetReviewBasis(data,proposal);
 assert.notEqual(after,before,"selected source Fact edits must change the basis");
});

test("A3 r83 RED: new closed-status evidence should require review of existing net",()=>{
 const {data,add,proposal}=fixture();
 const before=businessNetReviewBasis(data,proposal);
 add("synthetic-closed-status","business_registration::status","closed");
 const after=businessNetReviewBasis(data,proposal);
 assert.notEqual(after,before,
  "new status on the registration row must enter a review dependency or be explicitly excluded by approved policy");
});

test("A3 r83 RED: new joint-operator evidence should require income attribution review",()=>{
 const {data,add,proposal}=fixture();
 const before=businessNetReviewBasis(data,proposal);
 add("synthetic-joint-operator","business_registration::joint_operators","synthetic other operator");
 const after=businessNetReviewBasis(data,proposal);
 assert.notEqual(after,before,
  "new joint-operator evidence must be reviewed before continuing a prior attribution");
});
