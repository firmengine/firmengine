import test from "node:test";
import assert from "node:assert/strict";
import { classifyOcrField, summarizePageOcrQuality, scoreIndependentOcr } from "../lib/ocr-quality.ts";
const bbox=[0.1,0.2,0.3,0.28];
const source=(partial:Record<string,unknown>={})=>({documentId:"doc-synth",page:1,sourceSha256:"a".repeat(64),canonicalFieldId:"debt_certificate::principal",value:"1,000,000",unit:"원",quote:"원금 1,000,000원",bbox,sourceState:"present",confidence:"clear",verificationState:"supported",applicability:"unknown",...partial});
const gold=(id:string,field:string,state:"present"|"not_applicable"|"not_provided"|"blank"|"unreadable",extra:Record<string,unknown>={})=>({id,documentId:"doc-synth",page:1,sourceSha256:"a".repeat(64),canonicalFieldId:field,independentlyReviewed:true as const,state,...extra});
test("field statuses separate corrected misread, explicit source-none, and blank",()=>{
  assert.equal(classifyOcrField(source()).status,"cross_read_agreed");
  assert.equal(classifyOcrField(source({verificationState:"corrected"})).status,"misrecognition_corrected");
  assert.equal(classifyOcrField(source({verificationState:"wrong_field"})).status,"misrecognition_unresolved");
  assert.equal(classifyOcrField(source({sourceState:"blank",value:null})).status,"source_blank");
  assert.equal(classifyOcrField(source({sourceState:"masked",value:null})).status,"source_obscured");
  assert.equal(classifyOcrField(source({sourceState:"explicit_none",value:null,applicability:"unknown"})).status,"source_none_unreviewed");
  assert.equal(classifyOcrField(source({sourceState:"explicit_none",value:null,quote:"해당 없음",applicability:"not_applicable",applicabilityQuote:"해당 없음"})).status,"not_applicable_source_claim");
  assert.equal(classifyOcrField(source({sourceState:"not_seen",value:null})).status,"needs_review");
});
test("missing cue is omission only when source says it is visible and is anchored",()=>{
  const base={records:[{fields:[source()]}]};
  const res=summarizePageOcrQuality(base,[
    {canonicalFieldId:"debt_certificate::interest",sourceState:"present",quote:"이자 5000원",bbox},
    {canonicalFieldId:"debt_certificate::tax",sourceState:"explicit_none",quote:"없음",bbox},
    {canonicalFieldId:"debt_certificate::blank",sourceState:"blank",quote:"공란",bbox},
    {canonicalFieldId:"debt_certificate::invalid",sourceState:"present",quote:null,bbox},
  ]);
  assert.equal(res.counts.omission_suspected,1);
  assert.equal(res.counts.source_none_unreviewed,1);
  assert.equal(res.counts.source_blank,1);
  assert.equal(res.independentlyScored,false);
  assert.equal(res.accuracyPercent,null);
});
test("strict blind score distinguishes omission / wrong value / not applicable and empty",()=>{
  const g=[gold("a","f1","present",{expectedValue:"1,000,000",expectedUnit:"원"}),gold("b","f2","present",{expectedValue:"35",expectedUnit:"개월"}),gold("c","f3","present",{expectedValue:"2026-10-06"}),gold("d","f4","not_applicable"),gold("e","f5","not_provided"),gold("f","f6","blank")];
  const obs=[source({canonicalFieldId:"f1",value:"1000000"}),source({canonicalFieldId:"f2",value:"36",unit:"개월"}),source({canonicalFieldId:"f4",value:null,sourceState:"explicit_none",quote:"해당 없음",applicability:"not_applicable",applicabilityQuote:"해당 없음"}),source({canonicalFieldId:"f5",value:null,sourceState:"not_seen"})];
  const r=scoreIndependentOcr(g,obs);
  assert.equal(r.denominator,3);assert.equal(r.counts.correct,1);assert.equal(r.counts.misrecognition,1);assert.equal(r.counts.omission,1);assert.equal(r.counts.not_applicable_confirmed,1);assert.equal(r.counts.not_provided,1);assert.equal(r.counts.source_blank,1);assert.equal(r.accuracyPercent,33.33);
});
test("no gold is no score, and unsafe gold is rejected",()=>{
  assert.equal(scoreIndependentOcr([],[]).accuracyPercent,null);
  assert.throws(()=>scoreIndependentOcr([gold("x","f1","present")],[]),/INDEPENDENT_GOLD/);
  assert.throws(()=>scoreIndependentOcr([gold("x","f1","present",{expectedValue:"1"}),gold("x","f2","present",{expectedValue:"2"})],[]),/DUPLICATE/);
});
test("ambiguous duplicate field observations are not silently picked",()=>{
  const r=scoreIndependentOcr([gold("x","f1","present",{expectedValue:"2"})],[source({canonicalFieldId:"f1",value:"2"}),source({canonicalFieldId:"f1",value:"3"})]);
  assert.equal(r.counts.unresolved_ambiguity,1);assert.equal(r.accuracyPercent,0);
});

test("false not-applicable or false blank on visible gold is misrecognition, not omission",()=>{
 const g=[gold("a","f1","present",{expectedValue:"500"}),gold("b","f2","present",{expectedValue:"42"})];
 const o=[source({canonicalFieldId:"f1",value:null,sourceState:"explicit_none",applicability:"not_applicable"}),source({canonicalFieldId:"f2",value:null,sourceState:"blank"})];
 const r=scoreIndependentOcr(g,o);assert.equal(r.counts.misrecognition,2);assert.equal(r.counts.omission,0);
});
test("wrong person or period is misrecognition despite matching amount; score by logical document",()=>{
 const g=[gold("a","amount","present",{expectedValue:"123,456",expectedUnit:"원",expectedSubjectId:"debtor_1",expectedAsOf:"2026-10-01",logicalDocumentId:"doc-A"}),gold("b","f2","present",{expectedValue:"1",logicalDocumentId:"doc-B"})];
 const o=[source({canonicalFieldId:"amount",value:"123456",subjectId:"debtor_2",asOf:"2026-10-01"}),source({canonicalFieldId:"f2",value:"1"})];
 const r=scoreIndependentOcr(g,o);assert.equal(r.counts.misrecognition,1);assert.equal(r.counts.correct,1);assert.deepEqual(r.byDocument.map(x=>[x.documentId,x.accuracyPercent]),[["doc-A",0],["doc-B",100]]);
});
