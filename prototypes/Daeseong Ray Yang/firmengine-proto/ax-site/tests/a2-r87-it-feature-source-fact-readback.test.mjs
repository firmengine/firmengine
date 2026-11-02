// A2 r87 IT: synthetic SQL feature readback shape tests. Not legal recognition.
import test from "node:test";
import assert from "node:assert/strict";
import {decodeStoredCalculationEvidence} from "../lib/calculation-form-evidence-decoder.ts";

const invalid = [
  ["JSON string scalar", '"SYN-F1"', "CALCULATION_FORM_FACT_IDS_INVALID"],
  ["numeric scalar", "42", "CALCULATION_FORM_FACT_IDS_INVALID"],
  ["JSON null", "null", "CALCULATION_FORM_FACT_IDS_INVALID"],
  ["object scalar", "{}", "CALCULATION_FORM_FACT_IDS_INVALID"],
  ["numeric ID element", "[42]", "CALCULATION_FORM_FACT_IDS_INVALID"],
  ["null ID element", "[null]", "CALCULATION_FORM_FACT_IDS_INVALID"],
  ["duplicate IDs", '["SYN-F1","SYN-F1"]', "CALCULATION_FORM_FACT_IDS_INVALID"],
  ["empty ID", '[""]', "CALCULATION_FORM_FACT_IDS_INVALID"],
  ["space-only ID", '[" "]', "CALCULATION_FORM_FACT_IDS_INVALID"],
  ["padded ID", '[" SYN-F1 "]', "CALCULATION_FORM_FACT_IDS_INVALID"],
  ["malformed ID JSON", "{", "CALCULATION_FORM_EVIDENCE_JSON_INVALID"],
];
for (const [label, factIdsJson, code] of invalid) test("A2 r87 reject " + label, () => {
  assert.throws(() => decodeStoredCalculationEvidence({valueJson:"100",factIdsJson}), new RegExp(code));
});
for (const [label,valueJson,expected] of [
  ["zero","0",0], ["null","null",null], ["unknown",'"unknown"',"unknown"],
  ["valid positive money string",'"100"',"100"],
]) test("A2 r87 preserve " + label, () => {
  assert.deepEqual(decodeStoredCalculationEvidence({valueJson,factIdsJson:"[]"}),
    {value:expected,sourceFactIds:[]});
});
test("A2 r87 valid unique IDs preserved", () => {
  assert.deepEqual(decodeStoredCalculationEvidence({valueJson:"0",factIdsJson:'["SYN-F1","SYN-F2"]'}),
    {value:0,sourceFactIds:["SYN-F1","SYN-F2"]});
});
test("A2 r87 malformed numeric JSON rejected", () => {
  assert.throws(() => decodeStoredCalculationEvidence({valueJson:"{",factIdsJson:"[]"}),
    /CALCULATION_FORM_EVIDENCE_JSON_INVALID/);
});
test.todo("Fact IDs exist and are owned by case with current recognition and calculation revision");
test.todo("Real staging D1 and API readback through listCaseCalculationFeatures");
test.todo("Actual D5103/D5110/D5111 DOCX ZIP amount readback and lawyer approval");
