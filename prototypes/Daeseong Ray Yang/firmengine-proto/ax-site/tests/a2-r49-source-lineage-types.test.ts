import test from "node:test";
import assert from "node:assert/strict";
import { checkSelectedIncomePeriodCoverage } from "../lib/income-period-coverage.ts";

// Invented data only: these are application data-integrity checks, never legal
// recognition, an official D5103 field requirement, or permission to file.
const base = {
  period: "2026-01", net_income: "2,400,000",
  source_id: "SYN-INCOME-01", source_stream_id: "SYN-WAGE",
  source_fact_ids: "SYN-FACT-01", source_review_status: "accepted",
  source_calc_role: "period_income_observation",
};
const run = (change: Record<string, unknown> = {}, evidenceCutoff: string | null = "2026-01-31") =>
  checkSelectedIncomePeriodCoverage({
    selectedPeriod: { start: "2026-01-01", end: "2026-01-31" },
    monthRows: [{...base, ...change} as Record<string, string>],
    inspectSourceStreams: true, evidenceCutoff,
  });

const cases: Array<{name: string;change: Record<string, unknown>;expected: "complete" | "review_required";code?:string;cutoff?:string|null}> = [
  {name:"valid observed wage month",change:{},expected:"complete"},
  {name:"observed string zero",change:{net_income:"0"},expected:"complete"},
  {name:"source ID numeric zero",change:{source_id:0},expected:"review_required",code:"D5103_SOURCE_LINEAGE_UNRESOLVED"},
  {name:"source ID array",change:{source_id:[]},expected:"review_required",code:"D5103_SOURCE_LINEAGE_UNRESOLVED"},
  {name:"stream ID array",change:{source_stream_id:[]},expected:"review_required",code:"D5103_SOURCE_LINEAGE_UNRESOLVED"},
  {name:"Fact IDs array",change:{source_fact_ids:["SYN-FACT-01"]},expected:"review_required",code:"D5103_SOURCE_LINEAGE_UNRESOLVED"},
  {name:"Fact IDs numeric zero",change:{source_fact_ids:0},expected:"review_required",code:"D5103_SOURCE_LINEAGE_UNRESOLVED"},
  {name:"Fact IDs null",change:{source_fact_ids:null},expected:"review_required",code:"D5103_SOURCE_LINEAGE_UNRESOLVED"},
  {name:"Fact IDs whitespace",change:{source_fact_ids:"  "},expected:"review_required",code:"D5103_SOURCE_LINEAGE_UNRESOLVED"},
  {name:"Fact IDs comma only",change:{source_fact_ids:", ,"},expected:"review_required",code:"D5103_SOURCE_LINEAGE_UNRESOLVED"},
  {name:"Fact IDs empty member",change:{source_fact_ids:"SYN-A,,SYN-B"},expected:"review_required",code:"D5103_SOURCE_LINEAGE_UNRESOLVED"},
  {name:"tax comparison source",change:{source_calc_role:"historical_tax_comparison"},expected:"review_required",code:"D5103_SOURCE_REVIEW_REQUIRED"},
  {name:"unclassified source",change:{source_calc_role:"unmapped"},expected:"review_required",code:"D5103_SOURCE_REVIEW_REQUIRED"},
  {name:"null calculation role",change:{source_calc_role:null},expected:"review_required",code:"D5103_SOURCE_REVIEW_REQUIRED"},
  {name:"gross turnover source",change:{source_calc_role:"gross_turnover_only"},expected:"review_required",code:"D5103_SOURCE_REVIEW_REQUIRED"},
  {name:"unreviewed evidence",change:{source_review_status:"unreviewed"},expected:"review_required",code:"D5103_SOURCE_REVIEW_REQUIRED"},
  {name:"invalid month",change:{period:"2026-13"},expected:"review_required",code:"D5103_MONTH_EVIDENCE_UNRESOLVED"},
  {name:"null net income",change:{net_income:null},expected:"review_required",code:"D5103_MONTH_EVIDENCE_UNRESOLVED"},
  {name:"unobserved cutoff",change:{},expected:"review_required",code:"D5103_EVIDENCE_CUTOFF_UNOBSERVED",cutoff:null},
  {name:"valid two Fact IDs",change:{source_fact_ids:"SYN-FACT-01,SYN-FACT-02"},expected:"complete"},
];
for (const c of cases) {
  test("A2 r49: " + c.name, () => {
    const result = run(c.change, c.cutoff === undefined ? "2026-01-31" : c.cutoff);
    assert.equal(result.status, c.expected);
    if (c.code) assert.ok(result.codes.includes(c.code),c.name);
  });
}

test("A2 r49: wage 12 months must not mask business 11 months", () => {
  const months = Array.from({length:12},(_,i)=>"2026-"+String(i+1).padStart(2,"0"));
  const rows = months.map((period,i)=>({...base,period,source_id:"SYN-WAGE-"+i,source_fact_ids:"SYN-WAGE-FACT-"+i}));
  rows.push(...months.slice(0,11).map((period,i)=>({...base,period,source_id:"SYN-BIZ-"+i,source_stream_id:"SYN-BIZ",source_fact_ids:"SYN-BIZ-FACT-"+i})));
  const result=checkSelectedIncomePeriodCoverage({selectedPeriod:{start:"2026-01-01",end:"2026-12-31"},monthRows:rows,evidenceCutoff:"2026-12-31",inspectSourceStreams:true});
  assert.equal(result.status,"review_required");
  assert.deepEqual(result.sourceMissingMonths,[{streamId:"SYN-BIZ",missingMonths:["2026-12"]}]);
});
test("A2 r49: a Fact reused across streams remains review-required", () => {
  const rows=[{...base},{...base,source_id:"SYN-BIZ-01",source_stream_id:"SYN-BIZ"}];
  const result=checkSelectedIncomePeriodCoverage({selectedPeriod:{start:"2026-01-01",end:"2026-01-31"},monthRows:rows,evidenceCutoff:"2026-01-31",inspectSourceStreams:true});
  assert.ok(result.codes.includes("D5103_CROSS_STREAM_FACT_REVIEW_REQUIRED"));
  assert.deepEqual(result.sharedFactIds,["SYN-FACT-01"]);
});
test("A2 r49: employer switch 6+6 is still pending human period review, not legally invalidated", () => {
  const months=Array.from({length:12},(_,i)=>"2026-"+String(i+1).padStart(2,"0"));
  const rows=months.map((period,i)=>({...base,period,source_id:"SYN-WORK-"+i,source_stream_id:i<6?"SYN-EMPLOYER-A":"SYN-EMPLOYER-B",source_fact_ids:"SYN-FACT-"+i}));
  const result=checkSelectedIncomePeriodCoverage({selectedPeriod:{start:"2026-01-01",end:"2026-12-31"},monthRows:rows,evidenceCutoff:"2026-12-31",inspectSourceStreams:true});
  assert.ok(result.codes.includes("D5103_SOURCE_STREAM_COVERAGE_REVIEW_REQUIRED"));
  // Review-required here is a known false-positive candidate until a human
  // authorizes each source's observation window; do not call it a legal failure.
});
