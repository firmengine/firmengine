import test from "node:test";
import assert from "node:assert/strict";
import { checkSelectedIncomePeriodCoverage } from "../lib/income-period-coverage.ts";

// Completely synthetic evidence; these checks do not approve a person's income.
const months=Array.from({length:12},(_,i)=>"2026-"+String(i+1).padStart(2,"0"));
const selectedPeriod={start:"2026-01-01",end:"2026-12-31"};
const row=(month:string,fact="FACT-"+month,extra:Record<string,string>={})=>({
  period:month,net_income:"2,400,000",source_id:"W-"+month,
  source_stream_id:"W",source_fact_ids:fact,
  source_review_status:"accepted",source_calc_role:"period_income_observation",...extra,
});
const complete=months.map(month=>row(month));
const inspect=(rows:ReadonlyArray<Record<string,string>>,cutoff:string|null="2026-12-31")=>
  checkSelectedIncomePeriodCoverage({selectedPeriod,monthRows:rows,evidenceCutoff:cutoff,inspectSourceStreams:true});

test("one source Fact repeated in the same month cannot complete silently",()=>{
  const result=inspect([...complete,row("2026-01")]);
  assert.equal(result.status,"review_required");
  assert.ok(result.codes.includes("D5103_REPEATED_FACT_REVIEW_REQUIRED"));
  assert.ok(result.codes.includes("D5103_REPEATED_SOURCE_ROW_REVIEW_REQUIRED"));
  assert.deepEqual(result.repeatedFactIds,["FACT-2026-01"]);
  assert.deepEqual(result.repeatedSourceRowIds,["W-2026-01"]);
});
test("one source Fact reused across two months requests review",()=>{
  const result=inspect([...complete.slice(0,1),row("2026-02","FACT-2026-01"),...complete.slice(2)]);
  assert.ok(result.codes.includes("D5103_REPEATED_FACT_REVIEW_REQUIRED"));
});
test("duplicate source-row ID with independent Facts remains unresolved",()=>{
  const result=inspect([...complete,row("2026-01","FACT-extra")]);
  assert.ok(result.codes.includes("D5103_REPEATED_SOURCE_ROW_REVIEW_REQUIRED"));
});
test("repeated Fact in one comma-delimited field remains unresolved",()=>{
  const result=inspect(complete.map((r,i)=>i?r:{...r,source_fact_ids:"FACT-2026-01,FACT-2026-01"}));
  assert.ok(result.codes.includes("D5103_REPEATED_FACT_REVIEW_REQUIRED"));
});
test("cross-stream Fact reuse still needs review",()=>{
  const business=months.map(month=>({...row(month,"BUS-"+month),source_id:"B-"+month,source_stream_id:"B"}));
  business[0].source_fact_ids="FACT-2026-01";
  const result=inspect([...complete,...business]);
  assert.ok(result.codes.includes("D5103_CROSS_STREAM_FACT_REVIEW_REQUIRED"));
});
test("unrelated independent Facts and zero income remain valid at this evidence-only gate",()=>{
  assert.equal(inspect(complete).status,"complete");
  assert.equal(inspect(months.map(month=>row(month,"FACT-"+month,{net_income:"0"}))).status,"complete");
});
test("reverse input order does not hide repeated source-row and Fact references",()=>{
  const rows=[...complete,row("2026-01")];
  for(const order of [rows,rows.slice().reverse()]){
    const result=inspect(order);
    assert.ok(result.codes.includes("D5103_REPEATED_FACT_REVIEW_REQUIRED"));
    assert.ok(result.codes.includes("D5103_REPEATED_SOURCE_ROW_REVIEW_REQUIRED"));
  }
});
test("missing December and cutoff remain independently unresolved",()=>{
  assert.ok(inspect(complete.slice(0,11)).codes.includes("D5103_SELECTED_PERIOD_COVERAGE_GAP"));
  assert.ok(inspect(complete,null).codes.includes("D5103_EVIDENCE_CUTOFF_UNOBSERVED"));
});
