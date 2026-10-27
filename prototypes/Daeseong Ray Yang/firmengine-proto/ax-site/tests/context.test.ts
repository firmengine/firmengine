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
test("단축기간 검토는 실제 개월·판본·근거·입력 바인딩을 검증하고 명시 철회를 허용한다",()=>{
  const review={months:24,ruleReleaseId:"current-release",reason:"사건 자료를 검토함",basisFingerprint:"{\"planMonths\":24}"};
  assert.deepEqual(parseContextPatch({shortenedTermReview:review}),{shortenedTermReview:review});
  assert.deepEqual(parseContextPatch({shortenedTermReview:null}),{shortenedTermReview:null});
  assert.throws(()=>parseContextPatch({shortenedTermReview:{...review,months:36}}));
  assert.throws(()=>parseContextPatch({shortenedTermReview:{...review,reason:"  "}}));
  assert.throws(()=>parseContextPatch({shortenedTermReview:{...review,basisFingerprint:""}}));
});
