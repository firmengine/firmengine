import test from "node:test";
import assert from "node:assert/strict";
import {checkSelectedIncomePeriodCoverage} from "../lib/income-period-coverage.ts";

// Entirely synthetic; never a real customer, court finding, or accepted income.
const period={start:"2026-01-01",end:"2026-01-31"};
const input=(monthRows:unknown[])=>({
  selectedPeriod:period,
  evidenceCutoff:"2026-02-02",
  monthRows:monthRows as ReadonlyArray<Readonly<Record<string,string>>>,
});
const one=(value:unknown)=>[{period:"2026-01",net_income:value}];
for(const [label,rows] of [
  ["SQL null amount",one(null)],
  ["numeric JSON zero instead of string zero",one(0)],
  ["boolean instead of money",one(true)],
  ["null row",[null]],
  ["non-object row",[0]],
  ["invalid grouped money",one("2,40,000")],
] as Array<[string,unknown[]]>) {
  test("malformed persisted D5103 month row: "+label,()=>{
    const got=checkSelectedIncomePeriodCoverage(input(rows));
    assert.equal(got.status,"review_required");
    assert.ok(got.codes.includes("D5103_MONTH_EVIDENCE_UNRESOLVED"));
    assert.deepEqual(got.missingMonths,["2026-01"]);
    assert.deepEqual(got.invalidRowIndices,[0]);
  });
}
test("valid explicit textual zero remains observed zero, not null",()=>{
  const got=checkSelectedIncomePeriodCoverage(input(one("0")));
  assert.equal(got.status,"complete");
  assert.deepEqual(got.missingMonths,[]);
  assert.deepEqual(got.invalidRowIndices,[]);
});
test("valid monthly 2,400,000 textual money remains complete",()=>{
  const got=checkSelectedIncomePeriodCoverage(input(one("2,400,000")));
  assert.equal(got.status,"complete");
});
