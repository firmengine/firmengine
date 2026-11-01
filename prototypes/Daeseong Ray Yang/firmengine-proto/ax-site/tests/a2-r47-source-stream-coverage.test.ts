import test from "node:test";
import assert from "node:assert/strict";
import { checkSelectedIncomePeriodCoverage } from "../lib/income-period-coverage.ts";

// Entirely invented payroll/business streams; not legal income recognition.
const months=Array.from({length:12},(_,i)=>"2026-"+String(i+1).padStart(2,"0"));
const selectedPeriod={start:"2026-01-01",end:"2026-12-31"};
const row=(stream:string,month:string,value="2,400,000",extra:Record<string,string>={})=>({
  source_id:stream+"-"+month,source_stream_id:stream,source_fact_ids:"SYN-"+stream+"-"+month,
  source_review_status:"accepted",source_calc_role:"period_income_observation",
  entity:"synthetic",period:month,net_income:value,...extra,
});
const check=(rows:ReadonlyArray<Record<string,string>>,cutoff:string|null="2026-12-31",inspect=true)=>
  checkSelectedIncomePeriodCoverage({selectedPeriod,evidenceCutoff:cutoff,inspectSourceStreams:inspect,monthRows:rows});
const cases:[string,Record<string,string>[],string,string|null][]=[
  ["single full stream",months.map(m=>row("W",m)),"complete",null],
  ["single missing last month",months.slice(0,11).map(m=>row("W",m)),"review_required","D5103_SELECTED_PERIOD_COVERAGE_GAP"],
  ["wage 12 and business 11", [...months.map(m=>row("W",m)),...months.slice(0,11).map(m=>row("B",m,"1,000,000"))],"review_required","D5103_SOURCE_STREAM_COVERAGE_REVIEW_REQUIRED"],
  ["wage 12 and business 1", [...months.map(m=>row("W",m)),row("B","2026-01","1,000,000")],"review_required","D5103_SOURCE_STREAM_COVERAGE_REVIEW_REQUIRED"],
  ["employer change 6 plus 6 requires manual scope review", [...months.slice(0,6).map(m=>row("W1",m)),...months.slice(6).map(m=>row("W2",m))],"review_required","D5103_SOURCE_STREAM_COVERAGE_REVIEW_REQUIRED"],
  ["two complete independent streams", [...months.map(m=>row("W",m)),...months.map(m=>row("B",m,"1,000,000"))],"complete",null],
  ["two different businesses B1 full and B2 11 months", [...months.map(m=>row("B1",m,"1,000,000")),...months.slice(0,11).map(m=>row("B2",m,"700,000"))],"review_required","D5103_SOURCE_STREAM_COVERAGE_REVIEW_REQUIRED"],
  ["two different businesses both complete", [...months.map(m=>row("B1",m,"1,000,000")),...months.map(m=>row("B2",m,"700,000"))],"complete",null],
  ["source-only business cannot silently complete", [...months.map(m=>row("W",m)),row("B","2026-03","1,000,000",{source_review_status:"unreviewed"})],"review_required","D5103_SOURCE_REVIEW_REQUIRED"],
  ["VAT gross-only cannot become recognized income", [...months.map(m=>row("W",m)),row("B","2026-03","1,000,000",{source_calc_role:"gross_turnover_only"})],"review_required","D5103_SOURCE_REVIEW_REQUIRED"],
  ["unlinked Fact cannot establish a complete month", [...months.map(m=>row("W",m)),row("B","2026-03","1,000,000",{source_fact_ids:""})],"review_required","D5103_SOURCE_LINEAGE_UNRESOLVED"],
  ["missing stream identifier is not a separate recognized payer", [...months.map(m=>row("W",m)),row("B","2026-03","1,000,000",{source_stream_id:""})],"review_required","D5103_SOURCE_LINEAGE_UNRESOLVED"],
  ["explicit zero remains a valid observation",months.map(m=>row("W",m,"0")),"complete",null],
];
for(const [name,rows,status,code] of cases)test(name,()=>{
  const observed=check(rows);
  assert.equal(observed.status,status);
  if(code)assert.ok(observed.codes.includes(code),JSON.stringify(observed));
});
test("source missing in wage12 plus business11 is precisely December",()=>{
 const observed=check([...months.map(m=>row("W",m)),...months.slice(0,11).map(m=>row("B",m,"1,000,000"))]);
 assert.deepEqual(observed.sourceMissingMonths,[{streamId:"B",missingMonths:["2026-12"]}]);
});
test("missing cutoff is never interpreted as complete",()=>assert.ok(check(months.map(m=>row("W",m)),null).codes.includes("D5103_EVIDENCE_CUTOFF_UNOBSERVED")));
test("legacy source-neutral helper mode retains existing contract",()=>{
 const original=months.map(period=>({period,net_income:"0"}));
 assert.equal(check(original,"2026-12-31",false).status,"complete");
});

test("same Fact across two full source streams must remain a human review conflict",()=>{
 const inputs=[...months.map(m=>row("B1",m,"1,000,000")),...months.map(m=>row("B2",m,"700,000"))];
 inputs[12].source_fact_ids=inputs[0].source_fact_ids;
 const observed=check(inputs);
 assert.equal(observed.status,"review_required");
 assert.ok(observed.codes.includes("D5103_CROSS_STREAM_FACT_REVIEW_REQUIRED"));
 assert.deepEqual(observed.sharedFactIds,["SYN-B1-2026-01"]);
});
