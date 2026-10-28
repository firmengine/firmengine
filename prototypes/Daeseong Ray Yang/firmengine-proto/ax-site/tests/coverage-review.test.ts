import test from "node:test";
import assert from "node:assert/strict";
import { validateMissingFieldCues, shouldRetryMissingSource, MISSING_FIELD_REVIEW_INSTRUCTIONS, MAX_MISSING_FIELD_CUES } from "../lib/coverage-review.ts";
import { VERIFY_SCHEMA } from "../lib/extraction.ts";

const cue=(overrides:Record<string,unknown>={})=>({canonicalFieldId:"debt_certificate::creditor",sourceState:"present",quote:"채권자 예시은행",bbox:[.1,.1,.3,.16],...overrides});
const read=(fields:Array<{canonicalFieldId?:string|null;bbox?:number[]|null}> = [])=>({documentType:"debt_certificate",records:[{fields}]});

test("verifier schema requires source-only missingFields cues",()=>{
  const props=VERIFY_SCHEMA.properties as Record<string,unknown>;
  assert.ok("missingFields" in props);
  const required=(VERIFY_SCHEMA.required as string[]);
  assert.ok(required.includes("missingFields"));
  assert.match(MISSING_FIELD_REVIEW_INSTRUCTIONS,/실제로 보이는 필드·행·셀/);
  assert.match(MISSING_FIELD_REVIEW_INSTRUCTIONS,/재추출 위치 후보이며 사실·값·비적용 결정·검증 증명이 아니다/);
});

test("cue validation rejects wrong-family IDs, unanchored text, and invalid geometry",()=>{
  const result=validateMissingFieldCues(read(),[
    cue({canonicalFieldId:"payroll::gross"}),
    cue({quote:null}),
    cue({bbox:[.8,.2,.2,.4]}),
    cue({canonicalFieldId:null}),
  ]);
  assert.deepEqual(result.cues,[]);
  assert.equal(result.diagnostics.includes("missing_field_id_unbound"),true);
  assert.equal(result.diagnostics.includes("missing_field_quote_missing"),true);
  assert.equal(result.diagnostics.includes("missing_field_bbox_invalid"),true);
});

test("same field ID and overlapping source region identify an existing occurrence, while a second row survives",()=>{
  const first=[.1,.1,.3,.16],secondRow=[.1,.4,.3,.46];
  const result=validateMissingFieldCues(read([{canonicalFieldId:"debt_certificate::creditor",bbox:first}]),[
    cue({bbox:[.11,.11,.31,.17]}),
    cue({bbox:[.12,.12,.32,.18]}),
    cue({bbox:secondRow,quote:"채권자 다른예시은행"}),
    cue({bbox:[.11,.41,.31,.47],quote:"채권자 다른예시은행"}),
  ]);
  assert.equal(result.cues.length,1);
  assert.deepEqual(result.cues[0].bbox,secondRow);
  assert.equal(result.cues[0].sourceState,"present");
  assert.equal("value" in result.cues[0],false);
  assert.ok(result.diagnostics.includes("missing_field_occurrence_already_read"));
  assert.ok(result.diagnostics.includes("missing_field_duplicate_region"));
});

test("cues are bounded and retry policy is independent of unrelated attempt counts",()=>{
  const many=Array.from({length:MAX_MISSING_FIELD_CUES+2},(_,index)=>cue({bbox:[.01,.01+index*.01,.02,.015+index*.01],quote:`채권자 ${index}`}));
  const bounded=validateMissingFieldCues(read(),many);
  assert.equal(bounded.cues.length,MAX_MISSING_FIELD_CUES);
  assert.ok(bounded.diagnostics.includes("missing_field_limit_reached"));
  assert.equal(shouldRetryMissingSource({omittedRows:false,validMissingFieldCount:1,omissionRetried:false,isReverification:false}),true);
  assert.equal(shouldRetryMissingSource({omittedRows:true,validMissingFieldCount:0,omissionRetried:false,isReverification:false}),true);
  assert.equal(shouldRetryMissingSource({omittedRows:true,validMissingFieldCount:2,omissionRetried:true,isReverification:false}),false);
  assert.equal(shouldRetryMissingSource({omittedRows:true,validMissingFieldCount:2,omissionRetried:false,isReverification:true}),false);
  assert.equal(shouldRetryMissingSource({omittedRows:false,validMissingFieldCount:0,omissionRetried:false,isReverification:false}),false);
});
