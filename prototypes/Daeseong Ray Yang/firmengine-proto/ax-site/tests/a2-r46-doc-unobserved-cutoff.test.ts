import test from "node:test";
import assert from "node:assert/strict";
import {checkSelectedIncomePeriodCoverage} from "../lib/income-period-coverage.ts";

// Entirely invented D5103 observations. These tests do not certify legal recognition.
const selected=(start="2026-10-01",end="2026-10-31")=>({start,end});
const month=(period:string,net_income:unknown="2,400,000")=>({period,net_income,entity:"synthetic wage"});
const fullYear=Array.from({length:12},(_,i)=>month("2026-"+String(i+1).padStart(2,"0")));
const samples:[string,unknown,"not_applicable"|"complete"|"review_required",string|null][]=[
  ["null cutoff does not prove observed month",{selectedPeriod:selected(),monthRows:[month("2026-10")],evidenceCutoff:null},"review_required","D5103_EVIDENCE_CUTOFF_UNOBSERVED"],
  ["undefined cutoff not coerced to month end",{selectedPeriod:selected(),monthRows:[month("2026-10")]},"review_required","D5103_EVIDENCE_CUTOFF_UNOBSERVED"],
  ["12 monthly rows but cutoff unknown",{selectedPeriod:selected("2026-01-01","2026-12-31"),monthRows:fullYear,evidenceCutoff:null},"review_required","D5103_EVIDENCE_CUTOFF_UNOBSERVED"],
  ["explicit month end is valid observation boundary",{selectedPeriod:selected(),monthRows:[month("2026-10")],evidenceCutoff:"2026-10-31"},"complete",null],
  ["mid month cutoff is not full month",{selectedPeriod:selected(),monthRows:[month("2026-10")],evidenceCutoff:"2026-10-30"},"review_required","D5103_SELECTED_PERIOD_AFTER_EVIDENCE_CUTOFF"],
  ["invalid cutoff is not unobserved",{selectedPeriod:selected(),monthRows:[month("2026-10")],evidenceCutoff:"2026-10-40"},"review_required","D5103_EVIDENCE_CUTOFF_INVALID"],
  ["literal zero remains observed",{selectedPeriod:selected(),monthRows:[month("2026-10","0")],evidenceCutoff:"2026-10-31"},"complete",null],
  ["numeric zero is malformed in binding",{selectedPeriod:selected(),monthRows:[month("2026-10",0)],evidenceCutoff:"2026-10-31"},"review_required","D5103_MONTH_EVIDENCE_UNRESOLVED"],
  ["null money is missing not zero",{selectedPeriod:selected(),monthRows:[month("2026-10",null)],evidenceCutoff:"2026-10-31"},"review_required","D5103_MONTH_EVIDENCE_UNRESOLVED"],
  ["Jan missing from selected range",{selectedPeriod:selected("2026-01-01","2026-12-31"),monthRows:fullYear.slice(1),evidenceCutoff:"2026-12-31"},"review_required","D5103_SELECTED_PERIOD_COVERAGE_GAP"],
  ["Dec missing from selected range",{selectedPeriod:selected("2026-01-01","2026-12-31"),monthRows:fullYear.slice(0,11),evidenceCutoff:"2026-12-31"},"review_required","D5103_SELECTED_PERIOD_COVERAGE_GAP"],
  ["selected 11 months is not forced to 12",{selectedPeriod:selected("2026-01-01","2026-11-30"),monthRows:fullYear.slice(0,11),evidenceCutoff:"2026-11-30"},"complete",null],
  ["rows without selected period",{monthRows:[month("2026-10")],evidenceCutoff:null},"review_required","D5103_SELECTED_PERIOD_MISSING"],
  ["no rows and no selected period",{monthRows:[],evidenceCutoff:null},"not_applicable",null],
  ["leap February 28 not yet month end",{selectedPeriod:selected("2028-02-01","2028-02-29"),monthRows:[month("2028-02")],evidenceCutoff:"2028-02-28"},"review_required","D5103_SELECTED_PERIOD_AFTER_EVIDENCE_CUTOFF"],
  ["leap February 29 is month end",{selectedPeriod:selected("2028-02-01","2028-02-29"),monthRows:[month("2028-02")],evidenceCutoff:"2028-02-29"},"complete",null]
];
for(const [name,input,status,code] of samples){
  test(name,()=>{const actual=checkSelectedIncomePeriodCoverage(input as Parameters<typeof checkSelectedIncomePeriodCoverage>[0]);
    assert.equal(actual.status,status);
    if(code)assert.ok(actual.codes.includes(code),JSON.stringify(actual));
  });
}
// TODO (separate P1): source-wise month union can mask missing months in another source.
