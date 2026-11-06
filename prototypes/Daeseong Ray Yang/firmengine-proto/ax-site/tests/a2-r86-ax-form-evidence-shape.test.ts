// A2 r86: synthetic stored-feature evidence only; no customer/OCR data or legal approvals.
import test from "node:test";
import assert from "node:assert/strict";
import {decodeStoredCalculationEvidence} from "../lib/calculation-form-evidence-decoder.ts";

const CASES=[
  {name:"valid Fact ID",factIdsJson:'["SYN-F1"]',expected:"accepted"},
  {name:"explicit empty lineage stays empty (not approved)",factIdsJson:"[]",expected:"accepted"},
  {name:"JSON string instead of array",factIdsJson:'"SYN-F1"',expected:"CALCULATION_FORM_FACT_IDS_INVALID"},
  {name:"JSON number instead of array",factIdsJson:"42",expected:"CALCULATION_FORM_FACT_IDS_INVALID"},
  {name:"JSON null instead of array",factIdsJson:"null",expected:"CALCULATION_FORM_FACT_IDS_INVALID"},
  {name:"number mixed in array",factIdsJson:'["SYN-F1",42]',expected:"CALCULATION_FORM_FACT_IDS_INVALID"},
  {name:"duplicated Fact ID",factIdsJson:'["SYN-F1","SYN-F1"]',expected:"CALCULATION_FORM_FACT_IDS_INVALID"},
  {name:"empty ID",factIdsJson:'[""]',expected:"CALCULATION_FORM_FACT_IDS_INVALID"},
  {name:"leading/trailing whitespace",factIdsJson:'[" SYN-F1 "]',expected:"CALCULATION_FORM_FACT_IDS_INVALID"},
  {name:"invalid JSON",factIdsJson:"{",expected:"CALCULATION_FORM_EVIDENCE_JSON_INVALID"},
] as const;
for(const months of [36,48,60]){
  for(const c of CASES)test("A2 r86 "+months+"m: "+c.name,()=>{
    const input={valueJson:"100",factIdsJson:c.factIdsJson};
    if(c.expected==="accepted"){
      const evidence=decodeStoredCalculationEvidence(input);
      assert.equal(evidence.value,100);
      assert.ok(Array.isArray(evidence.sourceFactIds));
      assert.equal(evidence.sourceFactIds.length,c.name.startsWith("explicit empty")?0:1);
    }else{
      assert.throws(()=>decodeStoredCalculationEvidence(input),(error:unknown)=>error instanceof Error&&error.message===c.expected);
    }
  });
}
for(const [label,valueJson,value] of [
  ["explicit zero","0",0],
  ["null as unobserved","null",null],
  ["reported unknown marker",'"unknown"',"unknown"],
  ["structured object",'{"value":0}',{value:0}]
] as const)test("A2 r86 value fidelity: "+label,()=>{
  assert.deepEqual(decodeStoredCalculationEvidence({valueJson,factIdsJson:"[]"}).value,value);
});
test("A2 r86 malformed stored value JSON is independently blocked",()=>{
  assert.throws(()=>decodeStoredCalculationEvidence({valueJson:"{",factIdsJson:"[]"}),/CALCULATION_FORM_EVIDENCE_JSON_INVALID/);
});
test.todo("Check the Fact actually exists, same-case ownership, active recognition and run revision");
test.todo("Run D1 query, legal-automation gate and real D5103/D5110/D5111 DOCX ZIP readback");
test.todo("Lawyer and court-specific applicability review for Seoul Practice Guideline 424");
