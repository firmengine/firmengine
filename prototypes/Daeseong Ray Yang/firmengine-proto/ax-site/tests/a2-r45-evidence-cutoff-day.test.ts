import test from "node:test";
import assert from "node:assert/strict";
import {checkSelectedIncomePeriodCoverage} from "../lib/income-period-coverage.ts";

// Fully invented synthetic source-month values. No legal recognition or court rules.
const cases = [
  [
    "10/01 cannot establish whole 10th month",
    "2026-10-01",
    "2026-10-31",
    "2026-10-01",
    [
      "2026-10"
    ],
    [
      "2026-10"
    ]
  ],
  [
    "10/30 cannot establish whole 10th month",
    "2026-10-01",
    "2026-10-31",
    "2026-10-30",
    [
      "2026-10"
    ],
    [
      "2026-10"
    ]
  ],
  [
    "10/31 establishes 10th month",
    "2026-10-01",
    "2026-10-31",
    "2026-10-31",
    [
      "2026-10"
    ],
    []
  ],
  [
    "11/01 establishes prior 10th month",
    "2026-10-01",
    "2026-10-31",
    "2026-11-01",
    [
      "2026-10"
    ],
    []
  ],
  [
    "leap February 28 is still partial",
    "2028-02-01",
    "2028-02-29",
    "2028-02-28",
    [
      "2028-02"
    ],
    [
      "2028-02"
    ]
  ],
  [
    "leap February 29 is whole month",
    "2028-02-01",
    "2028-02-29",
    "2028-02-29",
    [
      "2028-02"
    ],
    []
  ],
  [
    "ordinary February 28 is whole month",
    "2026-02-01",
    "2026-02-28",
    "2026-02-28",
    [
      "2026-02"
    ],
    []
  ],
  [
    "November cutoff before December",
    "2026-11-01",
    "2026-12-31",
    "2026-11-30",
    [
      "2026-11",
      "2026-12"
    ],
    [
      "2026-12"
    ]
  ],
  [
    "unknown cutoff is not inferred (known helper blind spot)",
    "2026-10-01",
    "2026-10-31",
    null,
    [
      "2026-10"
    ],
    []
  ],
  [
    "zero is explicit observation with end-month cutoff",
    "2026-10-01",
    "2026-10-31",
    "2026-10-31",
    [
      "2026-10"
    ],
    []
  ],
  [
    "partial October and future November both unresolved",
    "2026-09-01",
    "2026-11-30",
    "2026-10-10",
    [
      "2026-09",
      "2026-10",
      "2026-11"
    ],
    [
      "2026-10",
      "2026-11"
    ]
  ]
] as Array<[string,string,string,string|null,string[],string[]]>;
for (const [label,start,end,cutoff,observed,expectedFuture] of cases) {
  test(label,()=>{
    const actual=checkSelectedIncomePeriodCoverage({
      selectedPeriod:{start,end},evidenceCutoff:cutoff,
      monthRows:observed.map(period=>({period,net_income:label.startsWith("zero")?"0":"2,400,000"}))
    });
    assert.deepEqual(actual.futureMonths,expectedFuture);
    assert.equal(actual.status,expectedFuture.length?"review_required":"complete");
    assert.equal(actual.codes.includes("D5103_SELECTED_PERIOD_AFTER_EVIDENCE_CUTOFF"),expectedFuture.length>0);
  });
}
