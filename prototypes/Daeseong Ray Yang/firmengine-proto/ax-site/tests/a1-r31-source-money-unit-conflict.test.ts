import test from "node:test";
import assert from "node:assert/strict";
import {normalizeMoney,moneyValue} from "../lib/domain.ts";
import {calculationSourceCellIssues} from "../lib/ocr-calculation-input.ts";

// Synthetic source only. No client record or OCR output is committed.
test("literal won amounts cannot be rescaled by a conflicting OCR unit",()=>{
  for(const [raw,unit] of [
    ["250원","천원"],
    ["250 KRW","만원"],
    ["0원","천원"],
  ] as const){
    const n=normalizeMoney(raw,unit);
    assert.equal(n.normalizationStatus,"invalid",`${raw}/${unit}`);
    assert.equal(n.amountWon,null);
    assert.equal(moneyValue(n),null);
    assert.ok(calculationSourceCellIssues(
      {value:raw,unit,quote:raw,sourceState:"present",confidence:"clear"},
      {datatype:"money"}
    ).includes("SOURCE_MONEY_NOT_EXACT_KRW"));
  }
});

test("zero, exact KRW, decimal thousands and foreign currency remain distinct",()=>{
  assert.equal(normalizeMoney("250","천원").amountWon,"250000");
  assert.equal(normalizeMoney("250원","원").amountWon,"250");
  assert.equal(normalizeMoney("250원","KRW").amountWon,"250");
  assert.equal(normalizeMoney("250 KRW","원").amountWon,"250");
  assert.equal(normalizeMoney("2.5","만원").amountWon,"25000");
  assert.equal(normalizeMoney("0","천원").amountWon,"0");
  assert.equal(normalizeMoney("250","만원","USD").normalizationStatus,"review_required");
  assert.equal(normalizeMoney(null,"만원").normalizationStatus,"missing");
  assert.equal(normalizeMoney("250만원","만원").normalizationStatus,"invalid");
});
