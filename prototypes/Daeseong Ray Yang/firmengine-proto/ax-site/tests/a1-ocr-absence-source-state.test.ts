import test from "node:test";
import assert from "node:assert/strict";
import {observeField, type ObservationInput} from "../lib/field-observation.ts";

// Synthetic-only input; never use private OCR text or customer evidence here.
const source={documentId:"synthetic-doc",page:1,sourceSha256:"f".repeat(64)};
const field=(changes:Partial<ObservationInput>={}):ObservationInput=>({
  key:"creditor",label:"채권자",value:null,unit:"원",quote:"채권자 해당 없음",
  bbox:[.1,.1,.4,.2],confidence:"clear",canonicalFieldId:"debt_certificate::creditor",
  sourceState:"explicit_none",applicability:"not_applicable",applicabilityQuote:"해당 없음",...changes,
});

test("A1-DATA-003: numeric OCR token cannot be marked explicit absence, including zero",()=>{
  for(const [value,quote] of [
    ["100","채권자 100원"],["0","채권자 0원"],["1,200원","채권자 1,200원"],
    ["-100","채권자 -100원"],["20%","채권자 지분 20%"],
  ] as const){
    const row=observeField("debt_certificate",field({value,quote,applicabilityQuote:value}),source,0,0);
    assert.equal(row.rawValue,value);
    assert.equal(row.sourceState,"unknown",value);
    assert.equal(row.extractionState,"uncertain",value);
    assert.equal(row.applicability.sourceClaim,"unknown",value);
    assert.equal(row.applicability.caseDecision,"unreviewed");
    assert.ok(row.issues.includes("explicit_none_numeric_value_conflict"));
  }
});

test("A1-DATA-003: no record means coverage gap, not source absence or applicability",()=>{
  for(const overrides of [
    {},
    {sourceState:"present" as const,value:"3",quote:"채권자 3원",applicability:"applicable" as const,applicabilityQuote:"3원"},
  ]){
    const row=observeField("debt_certificate",field(overrides),source,null,null);
    assert.equal(row.origin,"catalog_gap");
    assert.equal(row.sourceState,"unknown");
    assert.equal(row.extractionState,"not_observed");
    assert.equal(row.applicability.sourceClaim,"unknown");
    assert.equal(row.applicability.caseDecision,"unreviewed");
    assert.ok(row.issues.includes("catalog_gap_claim_without_observation"));
  }
});

test("A1-DATA-003: anchored source-none remains a source claim only",()=>{
  for(const value of [null,"해당 없음"]){
    const row=observeField("debt_certificate",field({value}),source,0,0);
    assert.equal(row.sourceState,"explicit_none");
    assert.equal(row.extractionState,"source_empty");
    assert.equal(row.applicability.sourceClaim,"not_applicable");
    assert.equal(row.applicability.caseDecision,"unreviewed");
  }
});

test("A1-DATA-003: observed zero, blanks, unseen, obscured and conflicts stay distinct",()=>{
  const cases=[
    {changes:{value:"0",quote:"채권자 0원",sourceState:"present" as const,applicabilityQuote:"0원"},state:"present",extraction:"value_read"},
    {changes:{sourceState:"blank" as const},state:"blank",extraction:"source_empty"},
    {changes:{sourceState:"not_seen" as const,applicability:"unknown" as const},state:"not_seen",extraction:"not_observed"},
    {changes:{sourceState:"conflicting" as const,applicability:"unknown" as const},state:"conflicting",extraction:"conflict"},
    {changes:{sourceState:"masked" as const,value:"***",quote:"채권자 ***",applicability:"unknown" as const},state:"masked",extraction:"source_obscured"},
    {changes:{quote:null,bbox:null},state:"unknown",extraction:"uncertain"},
    {changes:{value:""},state:"unknown",extraction:"uncertain"},
  ];
  for(const one of cases){
    const row=observeField("debt_certificate",field(one.changes),source,0,0);
    assert.equal(row.sourceState,one.state);
    assert.equal(row.extractionState,one.extraction);
    assert.equal(row.applicability.sourceClaim,"unknown");
    assert.equal(row.applicability.caseDecision,"unreviewed");
  }
});
