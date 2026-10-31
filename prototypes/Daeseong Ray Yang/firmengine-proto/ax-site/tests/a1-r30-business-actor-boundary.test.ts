import test from "node:test";
import assert from "node:assert/strict";
import {adoptBusinessNet,BUSINESS_NET_REVIEW_VERSION,type BusinessNetReview} from "../lib/business-net-reconciliation.ts";
import type {CaseData} from "../lib/domain.ts";

/** Deliberately source-incomplete fixture: actor independence must be checked
 * before source or policy validation; this is not a legal recognition test. */
function syntheticCase(proposer:string):{data:CaseData;review:BusinessNetReview}{
 const review:BusinessNetReview={
  schemaVersion:BUSINESS_NET_REVIEW_VERSION,id:"synthetic-review",incomeId:"synthetic-income",
  status:"proposed",month:"2026-01",businessRegistrationFactId:"synthetic-registration",
  grossFactId:"synthetic-gross",costFactIds:["synthetic-cost"],
  sourceFactIds:["synthetic-registration","synthetic-gross","synthetic-cost"],
  payerIdentityId:"synthetic-payer",grossWon:"100",costWon:"0",netWon:"100",
  referenceSha256:"a".repeat(64),referenceRuleId:"synthetic-rule",
  basisSnapshot:"synthetic-not-approved",basisSha256:"b".repeat(64),
  proposer,proposedAt:"2026-10-31T00:00:00Z",reason:"Synthetic proposal, never a recognized source"
 };
 const data={workflowState:{businessNetReviews:[review]},incomes:[]} as unknown as CaseData;
 return {data,review};
}

for(const [label,proposer,reviewer] of [
 ["exact self approval","same-user","same-user"],
 ["padded reviewer is same actor","same-user"," same-user "],
 ["padded proposer is same actor"," same-user ","same-user"],
 ["missing proposal actor cannot be approved","","lawyer-user"],
 ["whitespace-only proposal actor cannot be approved","   ","lawyer-user"]
] as const){
 test("A1 r30 denies "+label+" before material approval",()=>{
  const {data,review}=syntheticCase(proposer);
  assert.throws(
   ()=>adoptBusinessNet(data,review.id,reviewer,
    "Independent review reason with synthetic text only",
    "2026-10-31T00:00:01Z"),
   /BUSINESS_REVIEW_APPROVAL_INVALID/
  );
  assert.equal(review.status,"proposed");
  assert.equal(data.incomes.length,0);
 });
}
