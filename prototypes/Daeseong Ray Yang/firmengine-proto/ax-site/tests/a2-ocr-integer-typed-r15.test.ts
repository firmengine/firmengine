import test from "node:test";
import assert from "node:assert/strict";
import {calculationSourceCellIssues} from "../lib/ocr-calculation-input.ts";

/** Synthetic observations only; no client OCR or legal approval implied. */
const issues=(value:string|null,sourceState="present",datatype="integer")=>calculationSourceCellIssues({
  value,unit:datatype==="money"?"KRW":null,
  quote:value===null?null:"합성 자료 "+value,confidence:"clear",sourceState
},{datatype});

test("typed integer input cannot silently discard OCR punctuation or a sign",()=>{
  for(const raw of ["1,,2","1,2",",12","12,","12,34","1,234","+12","-12"," 12 ","12.0","1e3"]){
    assert.ok(issues(raw).includes("SOURCE_INTEGER_FORMAT_REVIEW"),raw);
  }
});

test("integer source and typed parser share the JS safe integer boundary",()=>{
  for(const raw of ["9007199254740992","9007199254740993","999999999999999999999999999999"]){
    assert.ok(issues(raw).includes("SOURCE_INTEGER_UNSAFE_RANGE"),raw);
  }
  for(const raw of ["0","12","00012","9007199254740991"]){
    assert.deepEqual(issues(raw),[],raw);
    assert.ok(Number.isSafeInteger(Number(raw)),raw);
  }
});

test("unknown and null remain source states; money gate is not weakened",()=>{
  assert.deepEqual(issues(null,"unknown"),[]);
  assert.deepEqual(issues("1,,2","not_applicable"),[]);
  assert.deepEqual(issues("0","present"),[]);
  assert.ok(issues("1,00,0000","present","money").includes("SOURCE_MONEY_GROUPING_INVALID"));
  assert.deepEqual(issues("1,000,000","present","money"),[]);
});
