import test from "node:test";
import assert from "node:assert/strict";
import { createCase,currentFacts,normalizeMoney,reviewFact,type Fact } from "../lib/domain.ts";
import { buildCourtPackage } from "../lib/exports.ts";
import { DRAFT_RULESET } from "../lib/domain.ts";

function fixture(unit:string|null="천원"){
  const data=createCase("synthetic unit review","synthetic-case","2026-10-27");
  data.documents=[{id:"synthetic-source",name:"synthetic source",sha256:"a".repeat(64),status:"active",pages:[1]}];
  data.pages=[{documentId:"synthetic-source",page:1,role:"evidence"}];
  const fact:Fact={id:"fact-v1",logicalId:"asset:refund",version:1,subjectId:"asset-1",key:"asset.refund_value",value:"250",rawValue:"250",sourceUnit:unit,numeric:unit?normalizeMoney("250",unit):{...normalizeMoney("250","unknown"),normalizationStatus:"review_required"},state:"verified",recognition:"accepted",refs:[{documentId:"synthetic-source",page:1,quote:"합성 보험 환급금과 단위의 원문",sourceHash:"a".repeat(64)}],validation:[],createdAt:"2026-10-27T00:00:00.000Z"};
  data.facts=[fact];
  data.assets=[{id:"asset-1",kind:"insurance",label:"synthetic insurance",grossValue:normalizeMoney("250",unit??"unknown"),factIds:[fact.id],recognition:"accepted"}];
  return data;
}
const reviewer={actor:"synthetic reviewer",reason:"원문 단위 및 값 대조"};

test("원장 금액만 정정해도 이전 정규화 금액을 유지하지 않는다",()=>{
  const before=fixture(),after=reviewFact(before,"fact-v1",{...reviewer,value:"360"}),fact=currentFacts(after)[0];
  assert.equal(fact.value,"360");assert.equal(fact.rawValue,"360");assert.equal(fact.numeric?.rawValue,"360");assert.equal(fact.numeric?.amountWon,"360000");
  assert.equal(fact.sourceUnit,"천원");assert.equal(fact.recognition,"unreviewed");assert.equal(fact.state,"reported");assert.equal(fact.sourceVerification,undefined);
  assert.equal(before.facts[0].numeric?.amountWon,"250000");assert.deepEqual(after.assets[0].factIds,["fact-v1"],"changed evidence requires explicit object remapping");
});

test("숫자가 같아도 원문 단위 정정은 금액과 증거 연결을 갱신한다",()=>{
  const before=fixture(),after=reviewFact(before,"fact-v1",{...reviewer,sourceUnit:"만원"}),fact=currentFacts(after)[0];
  assert.equal(fact.value,"250");assert.equal(fact.sourceUnit,"만원");assert.equal(fact.numeric?.amountWon,"2500000");assert.equal(fact.recognition,"unreviewed");
  assert.deepEqual(after.assets[0].factIds,["fact-v1"]);assert.equal(before.facts[0].sourceUnit,"천원");
  const workbook=buildCourtPackage(after,DRAFT_RULESET).workbook.find(s=>s.name==="사실과인정")!;
  const unitIndex=workbook.rows[0].findIndex(c=>c.value==="원문 단위");assert.ok(unitIndex>=0);assert.equal(workbook.rows[1][unitIndex].value,"만원");
});

test("미확인 단위는 기본 원화가 되지 않고 명시 정정만 단위 경고를 닫는다",()=>{
  const before=fixture(null);before.facts[0].validation=[{code:"MONETARY_UNIT_MISSING",message:"단위 미확인",severity:"warning"}];
  const missing=reviewFact(before,"fact-v1",{...reviewer,value:"360"}),mf=currentFacts(missing)[0];
  assert.equal(mf.numeric?.amountWon,null);assert.equal(mf.numeric?.normalizationStatus,"review_required");assert.ok(mf.validation.some(v=>v.code==="NORMALIZATION_REVIEW"));
  const fixed=reviewFact(before,"fact-v1",{...reviewer,sourceUnit:"원",state:"verified"}),ff=currentFacts(fixed)[0];
  assert.equal(ff.numeric?.amountWon,"250");assert.equal(ff.recognition,"unreviewed");assert.ok(ff.validation.some(v=>v.code==="RESOLVED_MONETARY_UNIT_MISSING"));
  const foreign=currentFacts(reviewFact(fixture(),"fact-v1",{...reviewer,sourceUnit:"USD"}))[0];
  assert.equal(foreign.numeric?.amountWon,null);assert.equal(foreign.numeric?.normalizationStatus,"invalid");assert.equal(foreign.sourceUnit,"USD");
});

test("원문 단위 검토는 숫자가 아닌 필드의 의미와 기존 검토 동작을 보존한다",()=>{
  const data=fixture();data.facts[0]={...data.facts[0],key:"debt.interest_rate",value:"4.5",rawValue:"4.5",sourceUnit:"%",numeric:undefined};
  const reviewed=currentFacts(reviewFact(data,"fact-v1",{...reviewer,value:"5.0",sourceUnit:"%"}))[0];
  assert.equal(reviewed.numeric,undefined);assert.equal(reviewed.sourceUnit,"%");
  assert.throws(()=>reviewFact(data,"fact-v1",{...reviewer,sourceUnit:42 as unknown as string}),/원문 단위/);
  const same=reviewFact(fixture(),"fact-v1",{...reviewer,value:"250",sourceUnit:"천원",state:"verified"});
  assert.deepEqual(same.assets[0].factIds,[currentFacts(same)[0].id]);assert.equal(currentFacts(same)[0].recognition,"accepted");
});
