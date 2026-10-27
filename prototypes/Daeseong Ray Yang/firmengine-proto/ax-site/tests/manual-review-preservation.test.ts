import test from "node:test";
import assert from "node:assert/strict";
import { applyExtraction, createCase, currentFacts, normalizeMoney, reviewFact, type ExtractionPayload, type Fact, type SourceRef } from "../lib/domain.ts";

const hash="a".repeat(64),box:SourceRef["bbox"]=[.2,.2,.4,.25];
function raw(overrides:Partial<Fact>={}):Partial<Fact>{return {id:"incoming-balance",logicalId:"rowA:principal_balance",subjectId:"rowA",key:"debt.principal_balance",value:"620",numeric:normalizeMoney("620","원"),refs:[{documentId:"doc",page:1,sourceHash:hash,quote:"원금잔액 620원",bbox:box}],...overrides};}
function payload(facts:Partial<Fact>[]):ExtractionPayload{return {facts,replacesPages:[{documentId:"doc",page:1}]};}
function fixture(state:"retracted"|"verified"="retracted",source=raw()){
  let data=createCase("synthetic manual decision","synthetic-case","2026-10-27");
  data.documents=[{id:"doc",name:"synthetic.pdf",sha256:hash,status:"active",pages:[1]}];
  data.pages=[{documentId:"doc",page:1,role:"evidence"}];
  data=applyExtraction(data,payload([source]));
  const fact=currentFacts(data)[0];
  data=reviewFact(data,fact.id,{state,recognition:state==="verified"?"accepted":"rejected",actor:"synthetic reviewer",reason:"synthetic original comparison"});
  return {data,decision:data.facts.at(-1)!};
}

test("reread preserves manual retraction across same logical ID and key-split migration",()=>{
  for(const logicalId of ["rowA:principal_balance","rowA:principal:candidate:legacy"]){
    const f=fixture("retracted",raw({logicalId}));
    const after=applyExtraction(f.data,payload([raw()]));
    assert.equal(currentFacts(after).length,0);assert.ok(after.facts.some(x=>x.id===f.decision.id&&x.reviewer));
    assert.ok(after.extractionWarnings?.some(x=>x.includes("철회한 동일 원문")));
  }
});

test("unique unchanged coordinates preserve a retraction after OCR value or row ordinal changes",()=>{
  const f=fixture(),source=raw({subjectId:"rowB",logicalId:"rowB:principal_balance",value:"610",numeric:normalizeMoney("610","원"),refs:[{documentId:"doc",page:1,sourceHash:hash,quote:"원금잔액 610원",bbox:box}]});
  assert.equal(currentFacts(applyExtraction(f.data,payload([source]))).length,0);
});

test("current-principal aliases retain the human disposition while generic principal remains distinct",()=>{
  const f=fixture();
  for(const key of ["debt.outstanding_principal","debt.outstandingPrincipal"]){
    const after=applyExtraction(f.data,payload([raw({key,logicalId:`rowA:${key}`})]));
    assert.equal(currentFacts(after).length,0);
  }
  for(const key of ["debt.principal","debt.original_principal","debt.current_balance","credit_report.principal_balance"]){
    assert.equal(currentFacts(applyExtraction(f.data,payload([raw({key,logicalId:`rowA:${key}`})]))).length,1);
  }
});

test("same unlocated quote in a different row remains an unlinked review candidate, not suppressed",()=>{
  const refs=[{documentId:"doc",page:1,sourceHash:hash,quote:"원금잔액 620원"}];
  const f=fixture("retracted",raw({refs}));
  const after=applyExtraction(f.data,payload([raw({subjectId:"rowB",logicalId:"rowB:principal_balance",refs})]));
  const other=currentFacts(after);assert.equal(other.length,1);assert.equal(other[0].subjectId,"rowB");assert.equal(other[0].state,"disputed");assert.equal(other[0].recognition,"unreviewed");
});

test("without coordinates even a reused row ordinal and identical quote cannot transfer manual review",()=>{
  const refs=[{documentId:"doc",page:1,sourceHash:hash,quote:"원금잔액 620원"}];
  for(const state of ["verified","retracted"] as const){
    const f=fixture(state,raw({refs})),after=applyExtraction(f.data,payload([raw({refs})]));
    const candidate=currentFacts(after).find(fact=>fact.id!==f.decision.id)!;
    assert.equal(candidate.state,"disputed");assert.equal(candidate.recognition,"unreviewed");
    if(state==="verified")assert.equal(currentFacts(after).find(fact=>fact.id===f.decision.id)?.recognition,"accepted");
    else assert.ok(after.facts.some(fact=>fact.id===f.decision.id&&fact.state==="retracted"));
  }
});

test("overlapping or shared broad boxes cannot suppress a different source row",()=>{
  const f=fixture();
  const overlap=raw({subjectId:"rowB",logicalId:"rowB:principal_balance",refs:[{documentId:"doc",page:1,sourceHash:hash,quote:"원금잔액 620원",bbox:[.3,.2,.5,.25]}]});
  assert.equal(currentFacts(applyExtraction(f.data,payload([overlap]))).length,1);
  const a=raw(),b=raw({id:"second",subjectId:"rowB",logicalId:"rowB:principal_balance"});
  const shared=currentFacts(applyExtraction(f.data,payload([a,b])));
  assert.equal(shared.length,2);assert.ok(shared.every(x=>x.state==="disputed"&&x.recognition==="unreviewed"));
});

test("row order cannot transfer a human decision by logical ID alone",()=>{
  const f=fixture();
  const moved=raw({refs:[{documentId:"doc",page:1,sourceHash:hash,quote:"원금잔액 470원",bbox:[.2,.7,.4,.75]}],value:"470",numeric:normalizeMoney("470","원")});
  const after=applyExtraction(f.data,payload([moved]));
  assert.equal(currentFacts(after).length,1);assert.equal(currentFacts(after)[0].state,"disputed");assert.notEqual(currentFacts(after)[0].logicalId,f.decision.logicalId);
});

test("unchanged manual approval survives, while changed value or source creates an unreviewed candidate",()=>{
  const f=fixture("verified"),same=applyExtraction(f.data,payload([raw()]));
  assert.deepEqual(currentFacts(same).map(x=>x.id),[f.decision.id]);
  for(const changed of [raw({value:"610",numeric:normalizeMoney("610","원")}),raw({refs:[{documentId:"doc",page:1,sourceHash:hash,quote:"다른 원문 620원",bbox:box}]})]){
    const after=applyExtraction(f.data,payload([changed])),facts=currentFacts(after);
    assert.equal(facts.find(x=>x.id===f.decision.id)?.recognition,"accepted");
    assert.equal(facts.find(x=>x.id!==f.decision.id)?.state,"disputed");assert.equal(facts.find(x=>x.id!==f.decision.id)?.recognition,"unreviewed");
  }
});

test("typed objects cannot be replaced using a field explicitly retracted by a person",()=>{
  const f=fixture();
  const after=applyExtraction(f.data,{...payload([raw()]),debts:[{id:"rowA",creditor:"Synthetic Creditor",principal:normalizeMoney("620","원"),interest:null,secured:"unknown",classification:"ordinary",asOf:"2026-10-27",factIds:["incoming-balance"],legalReview:"unreviewed"}]});
  assert.equal(after.debts.length,0);
});

test("legacy automatic heads cannot hide an earlier human approval or retraction",()=>{
  for(const state of ["verified","retracted"] as const){
    const f=fixture(state);
    f.data.facts.push({...f.decision,id:"legacy-auto-head",version:f.decision.version+1,supersedes:f.decision.id,state:"extracted",recognition:"unreviewed",reviewer:undefined,reviewReason:undefined});
    if(state==="verified")f.data.debts=[{id:"rowA",creditor:"Synthetic Creditor",principal:normalizeMoney("620","원"),interest:null,secured:"unknown",classification:"ordinary",asOf:"2026-10-27",factIds:[f.decision.id],legalReview:"accepted"}];
    const after=applyExtraction(f.data,payload([raw()]));
    if(state==="retracted")assert.equal(currentFacts(after).length,0);
    else {
      const fact=currentFacts(after)[0];assert.equal(fact.state,"verified");assert.equal(fact.recognition,"accepted");assert.equal(fact.reviewer,f.decision.reviewer);assert.equal(fact.reviewReason,f.decision.reviewReason);
      assert.deepEqual(after.debts[0].factIds,[fact.id]);assert.equal(after.debts[0].legalReview,"accepted");
      assert.ok(fact.validation.some(v=>v.code==="RESTORED_HUMAN_DECISION"&&v.message.includes(f.decision.id)));
      const changed=applyExtraction(f.data,payload([raw({value:"610",numeric:normalizeMoney("610","원")})]));
      assert.ok(currentFacts(changed).some(fact=>fact.reviewer===f.decision.reviewer));
      assert.deepEqual(currentFacts(changed).map(x=>x.state).sort(),["disputed","verified"]);
    }
  }
});
