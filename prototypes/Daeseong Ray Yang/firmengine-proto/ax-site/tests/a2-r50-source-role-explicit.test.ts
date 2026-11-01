import test from "node:test";
import assert from "node:assert/strict";
import { createCase } from "../lib/domain.ts";
import type { IncomeSource } from "../lib/domain.ts";
import type { CalculationResult } from "../lib/assessment.ts";
import { buildFormBindings, MISSING_FORM_VALUE } from "../lib/form-mapping.ts";
import { checkSelectedIncomePeriodCoverage } from "../lib/income-period-coverage.ts";

// Invented values only. The mapper fixture has NO observed Fact and must NEVER
// be mistaken for a legitimate actual income/Word/D1 integration test.
const period={start:"2026-01-01",end:"2026-01-31"};
const roles: Array<{label:string;role:IncomeSource["sourceCalculationRole"];expectedRole:string;expectedStatus:"complete"|"review_required"}>=[
  {label:"missing semantic role",role:undefined,expectedRole:"",expectedStatus:"review_required"},
  {label:"explicit observed net-income role",role:"period_income_observation",expectedRole:"period_income_observation",expectedStatus:"complete"},
  {label:"VAT gross-turnover comparison",role:"gross_turnover_only",expectedRole:"gross_turnover_only",expectedStatus:"review_required"},
  {label:"historical comprehensive tax comparison",role:"historical_tax_comparison",expectedRole:"historical_tax_comparison",expectedStatus:"review_required"},
];

function bindingsFor(role:IncomeSource["sourceCalculationRole"]){
  const data=createCase("Synthetic income semantic role", "SYN-A2-R50", "2026-11-01");
  const source:IncomeSource={
    id:"SYN-WAGE-01",kind:"wage",label:"Synthetic wage",factIds:["SYN-FACT-01"],
    recognition:"accepted",periodStart:period.start,periodEnd:period.end,amountBasis:"monthly",
    ...(role!==undefined?{sourceCalculationRole:role}:{}),
  };
  data.incomes.push(source);
  const calculation={
    incomeRows:[{id:source.id,label:source.label,monthlyWon:"2400000",reasons:[]}],
    incomeGroups:[{id:"SYN-STREAM-WAGE",label:"Synthetic wage",sourceIds:[source.id],
      monthlyObservedAverageWon:"2400000",observedMonths:1,reasons:[]}],
    debtRows:[],assetRows:[],allocations:[],monthlyIncomeWon:null,
    debtPrincipalWon:null,debtInterestWon:null,securedDebtWon:null,unsecuredDebtWon:null,
    recognizedLivingCostWon:null,disposableIncomeWon:null,ordinaryRepaymentBudgetWon:null,
    monthlyPaymentWon:null,planTotalWon:null,liquidationValueWon:null,presentValueWon:null,
  } as unknown as CalculationResult;
  const result=buildFormBindings(data,calculation);
  const row=result.rows.month?.[0];
  assert.ok(row,"a typed synthetic income row must remain visible for review");
  assert.equal(row.net_income,MISSING_FORM_VALUE,"Fact-less mapping MUST NOT itself certify income");
  assert.equal(row.source_stream_id,"SYN-STREAM-WAGE");
  assert.equal(row.source_fact_ids,"SYN-FACT-01");
  return row;
}

for(const entry of roles){
  test("A2 r50 mapping source role: "+entry.label,()=>{
    const row=bindingsFor(entry.role);
    assert.equal(row.source_calc_role,entry.expectedRole);
    // A synthetic display amount is injected ONLY to isolate role->coverage.
    // Actual Fact/typed/calculation/D1/Word E2E remains unverified.
    const evidenceRow={...row,net_income:"2,400,000"};
    const outcome=checkSelectedIncomePeriodCoverage({
      selectedPeriod:period,monthRows:[evidenceRow],
      evidenceCutoff:"2026-01-31",inspectSourceStreams:true,
    });
    assert.equal(outcome.status,entry.expectedStatus);
    if(entry.expectedStatus==="review_required"){
      assert.ok(outcome.codes.includes("D5103_SOURCE_REVIEW_REQUIRED"));
    }
  });
}

test("A2 r50: an explicitly observed zero is still numeric zero, not missing",()=>{
  const row={...bindingsFor("period_income_observation"),net_income:"0"};
  const outcome=checkSelectedIncomePeriodCoverage({
    selectedPeriod:period,monthRows:[row],evidenceCutoff:"2026-01-31",inspectSourceStreams:true,
  });
  assert.equal(outcome.status,"complete");
});

test("A2 r50: unobserved cutoff is separate from missing role",()=>{
  const row={...bindingsFor(undefined),net_income:"2,400,000"};
  const outcome=checkSelectedIncomePeriodCoverage({
    selectedPeriod:period,monthRows:[row],evidenceCutoff:null,inspectSourceStreams:true,
  });
  assert.equal(outcome.status,"review_required");
  assert.ok(outcome.codes.includes("D5103_SOURCE_REVIEW_REQUIRED"));
  assert.ok(outcome.codes.includes("D5103_EVIDENCE_CUTOFF_UNOBSERVED"));
});
