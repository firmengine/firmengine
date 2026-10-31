import test from "node:test";
import assert from "node:assert/strict";
import {checkSelectedIncomePeriodCoverage as check} from "../lib/income-period-coverage.ts";
const period={start:"2026-01-01",end:"2026-12-31"};
const rows=(months:number[],net_income:string="2,400,000")=>months.map(m=>({period:"2026-"+String(m).padStart(2,"0"),net_income}));
const full=()=>rows(Array.from({length:12},(_,i)=>i+1));
const checkCode=(v:{codes:string[]},code:string)=>assert.ok(v.codes.includes(code),JSON.stringify(v));
test("12-month synthetic approved 2400000 monthly observation has complete selected coverage",()=>{
 const got=check({selectedPeriod:period,monthRows:full(),evidenceCutoff:"2027-01-10"});
 assert.equal(got.status,"complete");assert.deepEqual(got.missingMonths,[]);
 assert.equal(BigInt("2400000")*12n,28800000n);
});
test("first month missing from selected 12-month period",()=>{
 const got=check({selectedPeriod:period,monthRows:rows([2,3,4,5,6,7,8,9,10,11,12])});
 assert.equal(got.status,"review_required"); assert.deepEqual(got.missingMonths,["2026-01"]);
 assert.equal(BigInt("2400000")*11n,26400000n);checkCode(got,"D5103_SELECTED_PERIOD_COVERAGE_GAP");
});
test("last month missing from selected 12-month period",()=>{
 const got=check({selectedPeriod:period,monthRows:rows([1,2,3,4,5,6,7,8,9,10,11])});
 assert.deepEqual(got.missingMonths,["2026-12"]);checkCode(got,"D5103_SELECTED_PERIOD_COVERAGE_GAP");
});
test("interior month missing and duplicate source month cannot compensate",()=>{
 const got=check({selectedPeriod:period,monthRows:[...rows([1,2,3,4,5,6,7,8,9,10,11]),rows([11])[0]!]});
 assert.deepEqual(got.missingMonths,["2026-12"]);
});
test("11-month period explicitly chosen is not forced to twelve months",()=>{
 const got=check({selectedPeriod:{start:"2026-02-01",end:"2026-12-31"},monthRows:rows([2,3,4,5,6,7,8,9,10,11,12])});
 assert.equal(got.status,"complete");
});
test("0 KRW is observed zero not SQL null",()=>{
 const got=check({selectedPeriod:{start:"2026-01-01",end:"2026-01-31"},monthRows:rows([1],"0")});
 assert.equal(got.status,"complete");
});
test("null-like unresolved income is NOT equivalent to zero",()=>{
 const got=check({selectedPeriod:{start:"2026-01-01",end:"2026-01-31"},monthRows:rows([1],"[확인 필요]")});
 checkCode(got,"D5103_MONTH_EVIDENCE_UNRESOLVED");assert.deepEqual(got.missingMonths,["2026-01"]);
});
test("misgrouped 2,40,000 and negative expense/net fail evidence",()=>{
 const got=check({selectedPeriod:{start:"2026-01-01",end:"2026-02-28"},monthRows:[...rows([1],"2,40,000"),...rows([2],"-1000")]});
 assert.deepEqual(got.invalidRowIndices,[0,1]);assert.equal(got.missingMonths.length,2);
});
test("outside December previous-year source must not be selected silently",()=>{
 const got=check({selectedPeriod:period,monthRows:[...full(),{period:"2025-12",net_income:"2,400,000"}]});
 assert.deepEqual(got.outsideMonths,["2025-12"]);checkCode(got,"D5103_MONTH_OUTSIDE_SELECTED_PERIOD");
});
test("future months compared with explicitly supplied evidence cutoff",()=>{
 const got=check({selectedPeriod:period,monthRows:full(),evidenceCutoff:"2026-10-31"});
 assert.deepEqual(got.futureMonths,["2026-11","2026-12"]);checkCode(got,"D5103_SELECTED_PERIOD_AFTER_EVIDENCE_CUTOFF");
});
test("future months are not claimed when cutoff was not observed",()=>{
 const got=check({selectedPeriod:period,monthRows:full()});
 assert.deepEqual(got.futureMonths,[]);assert.equal(got.status,"complete");
});
test("invalid partial-month chosen boundary cannot authorize final month coverage",()=>{
 const got=check({selectedPeriod:{start:"2026-01-15",end:"2026-12-31"},monthRows:full()});
 checkCode(got,"D5103_SELECTED_PERIOD_INVALID");
});
test("invalid leap February end rejected in 2026",()=>{
 const got=check({selectedPeriod:{start:"2026-02-01",end:"2026-02-29"},monthRows:rows([2])});
 checkCode(got,"D5103_SELECTED_PERIOD_INVALID");
});
test("absence of period + observed month must stay review_required",()=>{
 const got=check({selectedPeriod:null,monthRows:rows([1])});
 checkCode(got,"D5103_SELECTED_PERIOD_MISSING");
});
test("absence of period and no month observations is not_applicable",()=>{
 const got=check({selectedPeriod:null,monthRows:[]});
 assert.equal(got.status,"not_applicable");
});
