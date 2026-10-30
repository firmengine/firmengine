import test from "node:test";
import assert from "node:assert/strict";
import {evaluateCasePolicyAlerts} from "../lib/case-policy-alert-scope.ts";
const alert=(sourceId:string,agent="court_documents",pending=1,latest="2026-10-30T00:00:00.000Z")=>
 ({sourceId,agent,pending,total:1,latest});
test("Busan-only court alert does not block a Seoul source-approved case",()=>{
 const events=[alert("watch-busan-home")];
 const seoul=evaluateCasePolicyAlerts({courtId:"seoul",groups:events});
 assert.equal(seoul.pending,false);
 assert.equal(seoul.pendingCount,0);
 assert.equal(seoul.latest,null);
 assert.equal(seoul.unrelatedCourtAlertCount,1);
 const busan=evaluateCasePolicyAlerts({courtId:"busan",groups:events});
 assert.equal(busan.pending,true);
 assert.equal(busan.unrelatedCourtAlertCount,0);
});
test("national law and unknown or ambiguous sources block all courts",()=>{
 for(const src of [alert("watch-current-rehabilitation-law","legislation"),
                     alert("unregistered:other:unknown"),alert("watch-court-forms")]){
   for(const courtId of ["seoul","busan","suwon","unknown"])
     assert.equal(evaluateCasePolicyAlerts({courtId,groups:[src]}).pending,true);
 }
});
test("subdocument of a registered court inherits its exclusively local court",()=>{
 const child=alert("watch-gwangju-practice-index:document:abcdef1234");
 assert.equal(evaluateCasePolicyAlerts({courtId:"seoul",groups:[child]}).pending,false);
 assert.equal(evaluateCasePolicyAlerts({courtId:"gwangju",groups:[child]}).pending,true);
});
test("acknowledged scoped alerts still retain review chronology without pending block",()=>{
 const row=alert("watch-busan-home","court_documents",0);
 const x=evaluateCasePolicyAlerts({courtId:"busan",groups:[row]});
 assert.equal(x.pending,false);
 assert.equal(x.latest,row.latest);
 const y=evaluateCasePolicyAlerts({courtId:"seoul",groups:[row]});
 assert.equal(y.latest,null);
});
test("unknown court and truncated source inventory are always fail-closed",()=>{
 assert.equal(evaluateCasePolicyAlerts({courtId:"?",groups:[alert("watch-busan-home")]}).pending,true);
 assert.equal(evaluateCasePolicyAlerts({courtId:"seoul",groups:[],truncated:true}).pending,true);
});
