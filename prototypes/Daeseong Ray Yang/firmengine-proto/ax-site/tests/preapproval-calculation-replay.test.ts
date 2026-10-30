import test from 'node:test';
import assert from 'node:assert/strict';
import {auditStoredCalculationReplay} from '../lib/preapproval-calculation-replay.ts';
const execution = {assessment:{calculation:{monthlyIncomeWon:'3000000',incomeRows:[{id:'one',monthlyWon:'3000000'}],presentValueWon:null}},proposals:{livingCost:{status:'proposal'}},courtApprovalInferred:false};
const make=(outputPath:string,value:unknown,extra:Record<string,unknown>={})=>({calculationId:'income_aggregation',outputPath,outputName:'monthlyIncomeWon',valueJson:JSON.stringify(value),status:'computed',sourceFactIdsJson:'["f1"]',...extra});
const run=(rows:any[])=>auditStoredCalculationReplay({execution,rows,currentFactIds:new Set(['f1'])});
test('exact SQL stored scalar, nested row and proposals all replay',()=>{
  const out=run([make('/assessment/calculation/monthlyIncomeWon','3000000'),make('/assessment/calculation/incomeRows/0/monthlyWon','3000000'),make('/proposals/livingCost/status','proposal')]);
  assert.equal(out.valid,true); assert.equal(out.storedRows,3);
});
test('stale SQL values are rejected; null and zero stay distinct',()=>{
  const out=run([make('/assessment/calculation/monthlyIncomeWon','0'),make('/assessment/calculation/presentValueWon',0)]);
  assert.equal(out.valid,false); assert.equal(out.issueCountByCode.OUTPUT_VALUE_MISMATCH,2);
});
test('missing current source facts and malformed JSON are not accepted',()=>{
  const out=run([make('/assessment/calculation/monthlyIncomeWon','3000000',{valueJson:'{bad',sourceFactIdsJson:'["unknown"]'})]);
  assert.equal(out.issueCountByCode.STORED_JSON_INVALID,1); assert.equal(out.issueCountByCode.SOURCE_FACT_NOT_CURRENT,1);
});
test('bad paths and duplicate physical outputs fail closed',()=>{
  const row=make('/assessment/calculation/monthlyIncomeWon','3000000');
  const out=run([row,row,make('/assessment/calculation/fiction','5'),make('not/a/pointer','1')]);
  assert.equal(out.issueCountByCode.DUPLICATE_OUTPUT_PATH,1);
  assert.equal(out.issueCountByCode.RUNTIME_OUTPUT_MISSING,1);
  assert.equal(out.issueCountByCode.INVALID_POINTER,1);
});
test('stored won field cannot disagree with stored value',()=>{
  const out=run([make('/assessment/calculation/monthlyIncomeWon','3000000',{valueWon:'3000001'})]);
  assert.equal(out.issueCountByCode.STORED_WON_MISMATCH,1);
});

test('empty persisted calculation output is not a passing replay',()=>{
  const out=run([]);
  assert.equal(out.valid,false);
  assert.equal(out.issueCountByCode.EMPTY_STORED_OUTPUTS,1);
  assert.equal(out.courtApprovalInferred,false);
});
test('missing one expected calculated row is detected even when all existing values match',()=>{
  const scalar=make('/assessment/calculation/monthlyIncomeWon','3000000');
  const expectedOutputs=[
    {calculationId:'income_aggregation',outputPath:'/assessment/calculation/monthlyIncomeWon'},
    {calculationId:'income_aggregation',outputPath:'/assessment/calculation/presentValueWon'},
  ];
  const partial=auditStoredCalculationReplay({execution,rows:[scalar],currentFactIds:new Set(['f1']),expectedOutputs});
  assert.equal(partial.valid,false);
  assert.equal(partial.issueCountByCode.EXPECTED_OUTPUT_NOT_PERSISTED,1);
  const complete=auditStoredCalculationReplay({execution,rows:[scalar,make('/assessment/calculation/presentValueWon',null,{status:'missing'})],currentFactIds:new Set(['f1']),expectedOutputs});
  assert.equal(complete.valid,true);
  assert.equal(complete.storedRows,2);
});
test('expected-path identity includes calculationId and does not count duplicate declarations twice',()=>{
  const outputPath='/assessment/calculation/monthlyIncomeWon';
  const expectedOutputs=[{calculationId:'other_engine',outputPath},{calculationId:'other_engine',outputPath}];
  const out=auditStoredCalculationReplay({execution,rows:[make(outputPath,'3000000')],currentFactIds:new Set(['f1']),expectedOutputs});
  assert.equal(out.valid,false);
  assert.equal(out.issueCountByCode.EXPECTED_OUTPUT_NOT_PERSISTED,1);
});
test('explicit observed zero and unknown/null are not conflated by complete expected-row replay',()=>{
  const expectedOutputs=[
    {calculationId:'income_aggregation',outputPath:'/assessment/calculation/incomeRows/0/monthlyWon'},
    {calculationId:'income_aggregation',outputPath:'/assessment/calculation/presentValueWon'},
  ];
  const zeroExecution={...execution,assessment:{calculation:{...execution.assessment.calculation,incomeRows:[{id:'one',monthlyWon:'0'}]}}};
  const rows=[make('/assessment/calculation/incomeRows/0/monthlyWon','0'),make('/assessment/calculation/presentValueWon',null,{status:'missing'})];
  const out=auditStoredCalculationReplay({execution:zeroExecution,rows,currentFactIds:new Set(['f1']),expectedOutputs});
  assert.equal(out.valid,true);
  const corrupted=auditStoredCalculationReplay({execution:zeroExecution,rows:[rows[0],{...rows[1],valueJson:'"0"'}],currentFactIds:new Set(['f1']),expectedOutputs});
  assert.equal(corrupted.valid,false);
  assert.equal(corrupted.issueCountByCode.OUTPUT_VALUE_MISMATCH,1);
});
