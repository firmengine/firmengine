import test from "node:test";
import assert from "node:assert/strict";
import { parseContextPatch,parseHouseholdPatch } from "../lib/context-validation.ts";
import { createCase,normalizeMoney } from "../lib/domain.ts";
test("문자열 false나 숫자를 검토 승인 boolean으로 허용하지 않는다",()=>{
  assert.throws(()=>parseContextPatch({ruleApplicationReviewed:"false"}));
  assert.throws(()=>parseContextPatch({assetValuationBasisReviewed:1}));
  assert.deepEqual(parseContextPatch({ruleApplicationReviewed:false}),{ruleApplicationReviewed:false});
});
test("입력값과 정규화 금액·실제 날짜·기간을 검증한다",()=>{
  assert.throws(()=>parseContextPatch({monthlyTrusteeFee:{...normalizeMoney("1000"),amountWon:"0"}}));
  assert.throws(()=>parseContextPatch({applicationDate:"2026-02-31"}));
  assert.throws(()=>parseContextPatch({filingPeriod:{start:"2026-10-27",end:"2026-01-01"}}));
  assert.equal(parseContextPatch({monthlyTrusteeFee:normalizeMoney(null)}).monthlyTrusteeFee?.amountWon,null);
});
test("가구 판단에 존재하지 않는 사실 ID를 연결하지 않는다",()=>{
  assert.throws(()=>parseHouseholdPatch({factIds:["invented"]},createCase()));
});
test("소득 대표기간 변경·해제는 과거 검토를 상속하지 않고 검토 boolean을 엄격히 구별한다",()=>{
  assert.deepEqual(parseContextPatch({filingPeriod:null}),{filingPeriod:null,incomePeriodReviewed:false});
  assert.deepEqual(parseContextPatch({filingPeriod:{start:"2026-01-01",end:"2026-12-31"}}),{filingPeriod:{start:"2026-01-01",end:"2026-12-31"},incomePeriodReviewed:false});
  assert.throws(()=>parseContextPatch({incomePeriodReviewed:"false"}));
  assert.throws(()=>parseContextPatch({filingPeriod:null,incomePeriodReviewed:true}),/대표기간/);
  assert.throws(()=>parseContextPatch({filingPeriod:{start:"2026-01-01",end:""}}));
  assert.equal(parseContextPatch({filingPeriod:{start:"2026-01-01",end:"2026-12-31"},incomePeriodReviewed:true}).incomePeriodReviewed,true);
});
