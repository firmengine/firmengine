import test from "node:test";
import assert from "node:assert/strict";
import { AI_MODEL,applyExtraction,createCase,currentFacts,factSourceLineageIssues,normalizeMoney } from "../lib/domain.ts";
import { projectPage,type PageRead,type ReadField } from "../lib/extraction.ts";
import { createSourceVerificationReceipts,type Check,type ReviewPass } from "../lib/source-verification.ts";
import { isSourceMoney } from "../lib/source-quantity.ts";
import type { Fact } from "../lib/domain.ts";

const hash="d".repeat(64),sourceId="unit-doc",when="2026-10-27T10:00:00.000Z",promptHash="f".repeat(64);
const field=(key:string,value:string,unit:string|null,quote:string):ReadField=>({key,label:key,value,unit,quote,confidence:"clear",bbox:[.1,.2,.4,.25]});
function insurance(fields:ReadField[]):PageRead{return{documentType:"insurance",complete:true,warnings:[],records:[{category:"asset",label:"synthetic",fields:[field("kind","insurance",null,"보험 계약"),field("label","synthetic",null,"계약명 synthetic"),...fields]}]};}

test("보험 가입금액·보험료 및 세금·담보 관련 금액은 원문 단위를 보존하고 환급금과 분리한다",()=>{
  const projected=projectPage(insurance([
    field("coverage_amount","25000","천원","가입금액 25000천원"),
    field("monthly_premium","300","천원","월 보험료 300천원"),
    field("refund_value","75","만원","해약환급금 75만원"),
    field("tax_amount","12","만원","세금 12만원"),
    field("secured_recovery","8","천원","담보 회수액 8천원"),
  ]),sourceId,1,hash);
  const byKey=new Map(projected.facts?.map(f=>[f.key,f]));
  assert.equal(byKey.get("asset.coverage_amount")?.sourceUnit,"천원");assert.equal(byKey.get("asset.coverage_amount")?.numeric?.amountWon,"25000000");
  assert.equal(byKey.get("asset.monthly_premium")?.numeric?.amountWon,"300000");
  assert.equal(byKey.get("asset.tax_amount")?.numeric?.amountWon,"120000");
  assert.equal(byKey.get("asset.secured_recovery")?.numeric?.amountWon,"8000");
  assert.equal(projected.assets?.[0].grossValue?.amountWon,"750000");
});

test("재무키의 누락·외화 단위는 원화 정규화에서 차단되고 원문 단위는 남는다",()=>{
  for(const [key,unit,status] of [["secured_amount",null,"review_required"],["disputed_amount","USD","invalid"]] as const){
    const p=projectPage({documentType:"other",complete:true,warnings:[],records:[{category:"debt",label:"synthetic",fields:[field("creditor","synthetic creditor",null,"채권자 synthetic creditor"),field(key,"100",unit,`금액 100 ${unit??""}`)]}]},sourceId,1,hash);
    const fact=p.facts?.find(f=>f.key===`debt.${key}`);
    assert.equal(fact?.sourceUnit,unit);assert.equal(fact?.numeric?.amountWon,null);assert.equal(fact?.numeric?.normalizationStatus,status);
  }
});

test("날짜·수량·전화번호는 KRW 단위처럼 보이는 메타데이터만으로 금액이 되지 않는다",()=>{
  for(const key of ["date","period_months","count","phone_number","identity_id","interest_rate","tax_year","payment_count","interest_rate_percent","income_period_months","claim_number"]){
    assert.equal(isSourceMoney(key,"원"),false,key);
  }
  assert.equal(isSourceMoney("misc_recovery_amount","천원"),true);
  assert.equal(isSourceMoney("misc_recovery_amount","USD"),true,"foreign unit still identifies a monetary quantity, but cannot be normalized");
  assert.equal(isSourceMoney("security_deposit",null),true,"lease alias remains monetary without a known source unit");
  assert.equal(isSourceMoney("rent_per_month",null),true,"monthly rent alias remains monetary without a known source unit");
  const read:PageRead={documentType:"other",complete:true,warnings:[],records:[{category:"person",label:"synthetic",fields:[field("phone_number","01012345678","원","연락처 01012345678"),field("date","2026-10-27","원","기준일 2026-10-27"),field("count","3","원","건수 3")]}]};
  const p=projectPage(read,sourceId,1,hash);
  assert.ok(p.facts?.every(f=>!f.numeric));assert.deepEqual(p.facts?.map(f=>f.sourceUnit),["원","원","원"]);
});

test("source receipt and projection use the same monetary classification",()=>{
  const read:PageRead={documentType:"insurance",complete:true,warnings:[],records:[{category:"asset",label:"synthetic",fields:[field("coverage_amount","25","천원","가입금액 25천원"),field("phone_number","01012345678",null,"연락처 01012345678")]}]};
  const checks:Check[]=read.records[0].fields.map((f,fieldIndex)=>({recordIndex:0,fieldIndex,meaningStatus:"supported",status:"agrees",value:f.value,unit:f.unit,quote:f.quote}));
  const pass:ReviewPass={kind:"verify",checks,model:AI_MODEL,promptVersion:"luna-evidence-test",promptHash,verifiedAt:when};
  const receipts=createSourceVerificationReceipts({documentId:sourceId,page:1,sourceHash:hash,promptVersion:pass.promptVersion,verifiedAt:when,originalRead:read,read,passes:[pass]});
  assert.deepEqual(receipts.map(r=>r.field.key),["coverage_amount","phone_number"]);
  const p=projectPage(read,sourceId,1,hash);
  assert.equal(p.facts?.find(f=>f.key==="asset.coverage_amount")?.numeric?.amountWon,"25000");
  assert.equal(p.facts?.find(f=>f.key==="asset.phone_number")?.numeric,undefined);
  for(const unit of [null,"USD"]){
    const unsupported:PageRead={documentType:"other",complete:true,warnings:[],records:[{category:"asset",label:"synthetic",fields:[field("tax_amount","25",unit,"세금액 25")]}]};
    const unsupportedPass:ReviewPass={...pass,checks:[{recordIndex:0,fieldIndex:0,meaningStatus:"supported",status:"agrees",value:"25",unit,quote:"세금액 25"}]};
    assert.equal(createSourceVerificationReceipts({documentId:sourceId,page:1,sourceHash:hash,promptVersion:pass.promptVersion,verifiedAt:when,originalRead:unsupported,read:unsupported,passes:[unsupportedPass]}).length,0);
  }
  const foreign:PageRead={documentType:"other",complete:true,warnings:[],records:[{category:"asset",label:"synthetic",fields:[field("misc_recovery_amount","25","USD","recovery amount 25 USD")]}]};
  const foreignPass:ReviewPass={...pass,checks:[{recordIndex:0,fieldIndex:0,meaningStatus:"supported",status:"agrees",value:"25",unit:"USD",quote:"recovery amount 25 USD"}]};
  assert.equal(createSourceVerificationReceipts({documentId:sourceId,page:1,sourceHash:hash,promptVersion:pass.promptVersion,verifiedAt:when,originalRead:foreign,read:foreign,passes:[foreignPass]}).length,0);
});

test("sourceUnit changes create a new fact version and invalidate the prior machine proof",()=>{
  const data=createCase("synthetic","court","2026-10-27");data.documents=[{id:sourceId,name:"synthetic",sha256:hash,status:"active",pages:[1]}];data.pages=[{documentId:sourceId,page:1,role:"evidence"}];
  const quote="가입금액 25천원";
  const make=(unit:string):Partial<Fact>=>({id:"model-fact",logicalId:"asset:coverage",subjectId:"asset",key:"asset.coverage_amount",value:"25",rawValue:"25",sourceUnit:unit,numeric:normalizeMoney("25",unit),state:"extracted",recognition:"unreviewed",refs:[{documentId:sourceId,page:1,quote,sourceHash:hash}],validation:[]});
  let saved=applyExtraction(data,{facts:[make("천원")]});
  let fact=currentFacts(saved)[0];
  const read:PageRead={documentType:"insurance",complete:true,warnings:[],records:[{category:"asset",label:"synthetic",fields:[field("coverage_amount","25","천원",quote)]}]};
  const pass:ReviewPass={kind:"verify",checks:[{recordIndex:0,fieldIndex:0,meaningStatus:"supported",status:"agrees",value:"25",unit:"천원",quote}],model:AI_MODEL,promptVersion:"luna-evidence-test",promptHash,verifiedAt:when};
  const [receipt]=createSourceVerificationReceipts({documentId:sourceId,page:1,sourceHash:hash,promptVersion:pass.promptVersion,verifiedAt:when,originalRead:read,read,passes:[pass]});
  fact.state="verified";fact.sourceVerification={...receipt,factBinding:{id:fact.id,logicalId:fact.logicalId,version:fact.version}};
  assert.deepEqual(factSourceLineageIssues(saved,[fact.id]),[]);
  const legacy=structuredClone(saved),legacyFact=currentFacts(legacy)[0];delete legacyFact.sourceUnit;
  const legacyId=legacyFact.id;const sameUnitReread=applyExtraction(legacy,{facts:[make("천원")]});
  assert.equal(currentFacts(sameUnitReread)[0].id,legacyId,"legacy source unit is recovered from its verified proof/numeric unit without needlessly versioning it");
  assert.ok(currentFacts(sameUnitReread)[0].sourceVerification);
  fact.sourceUnit="만원";
  assert.ok(factSourceLineageIssues(saved,[fact.id]).includes("SOURCE_VERIFICATION_RECEIPT_INVALID"));
  fact.sourceUnit="천원";
  saved=applyExtraction(saved,{facts:[make("만원")]});
  const current=currentFacts(saved)[0];assert.equal(current.sourceUnit,"만원");assert.equal(current.state,"extracted");assert.equal(current.sourceVerification,undefined);assert.notEqual(current.id,fact.id);
});

