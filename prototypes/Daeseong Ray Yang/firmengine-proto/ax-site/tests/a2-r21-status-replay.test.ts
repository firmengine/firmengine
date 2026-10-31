import test from "node:test";
import assert from "node:assert/strict";
import {auditStoredCalculationReplay} from "../lib/preapproval-calculation-replay.ts";
/** Purely synthetic SQL feature objects; no real case, recognition, or D1. */
function audit(value:unknown,status:string,won:string|null){
 const p="/assessment/calculation/monthlyIncomeWon";
 return auditStoredCalculationReplay({execution:{assessment:{calculation:{monthlyIncomeWon:value}}},rows:[{
   calculationId:"income_average",outputName:"monthlyIncomeWon",outputPath:p,
   valueJson:JSON.stringify(value),valueWon:won,status,sourceFactIdsJson:"[]"
 }],currentFactIds:new Set<string>(),expectedOutputs:[{calculationId:"income_average",outputPath:p}]});
}
test("unobserved null is never a computed financial output",()=>{
 assert.equal(audit(null,"computed",null).issueCountByCode.STORED_STATUS_VALUE_CONFLICT,1);
});
test("unknown cannot be provisional financial output",()=>{
 assert.equal(audit("unknown","provisional",null).issueCountByCode.STORED_STATUS_VALUE_CONFLICT,1);
});
test("known value cannot be missing or blocked by producer",()=>{
 assert.equal(audit("0","missing","0").issueCountByCode.STORED_STATUS_VALUE_CONFLICT,1);
 assert.equal(audit(2400000,"blocked","2400000").issueCountByCode.STORED_STATUS_VALUE_CONFLICT,1);
});
test("null unknown zero and not-applicable remain distinct",()=>{
 assert.equal(audit(null,"missing",null).valid,true);
 assert.equal(audit("unknown","blocked",null).valid,true);
 assert.equal(audit("0","computed","0").valid,true);
 assert.equal(audit(0,"provisional","0").valid,true);
 assert.equal(audit(null,"not_applicable",null).valid,true);
});
