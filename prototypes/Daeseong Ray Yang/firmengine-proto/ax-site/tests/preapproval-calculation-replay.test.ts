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
