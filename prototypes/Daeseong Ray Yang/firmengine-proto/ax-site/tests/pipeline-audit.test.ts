import test from "node:test";
import assert from "node:assert/strict";
import { applyConfirmedCorrection,applyFirstVerification,applyTargetedRepair,getRepairTargets,preserveAgreedFieldsAfterOmission,projectPage,PAGE_COMPLETENESS_INSTRUCTIONS,PROMPT_VERSION,VERIFY_SCHEMA } from "../lib/extraction.ts";
import { extractionCacheKey } from "../lib/domain.ts";
import type { PageRead,ReadField } from "../lib/extraction.ts";

const reading=(value:string,unit:string|null,quote:string)=>({status:"corrected",value,unit,quote});
function source():ReadField{return {key:"principal",label:"원금",value:"500",unit:"원",quote:"원금 500원",confidence:"uncertain",bbox:[0,0,1,1]};}

test("단위가 다른 재판독 교정은 숫자가 같아도 확정하지 않는다",()=>{
  const f=source();
  assert.equal(applyConfirmedCorrection(f,reading("500","원","원금 500원"),reading("500","만원","원금 500만원")),false);
  assert.equal(f.unit,"원");assert.equal(f.confidence,"uncertain");
});

test("인용 표현이 달라도 두 판독의 값·단위가 일치하고 둘 다 인용을 제시하면 교정한다",()=>{
  const f=source();
  assert.equal(applyConfirmedCorrection(f,reading("500","만원","원금 500만원"),reading("500","만원","잔액 500만원")),true);
  assert.equal(f.unit,"만원");assert.equal(f.confidence,"clear");
});

test("독립 재판독이 값·단위·인용을 모두 반복해야 금액 단위를 함께 교정한다",()=>{
  const f=source(),candidate=reading("500","만원","원금 500만원");
  assert.equal(applyConfirmedCorrection(f,candidate,{...candidate}),true);
  assert.equal(f.value,"500");assert.equal(f.unit,"만원");assert.equal(f.quote,"원금 500만원");assert.equal(f.confidence,"clear");
});

test("검증 응답 스키마가 단위 판독을 명시적으로 수집한다",()=>{
  const properties=(VERIFY_SCHEMA.properties as {checks:{items:{properties:Record<string,unknown>}}}).checks.items.properties;
  assert.ok("unit" in properties);
});

test("인용 없는 record label은 채권자·소득원·재산명으로 승격되지 않는다",()=>{
  const quoted=(key:string,value:string|null,unit:string|null=null):ReadField=>({key,label:key,value,unit,quote:value===null?null:`${key}: ${value}`,confidence:"clear",bbox:[0,0,1,1]});
  const read:PageRead={documentType:"synthetic",complete:true,warnings:[],records:[
    {category:"debt",label:"모델이 붙인 가짜 은행명",fields:[quoted("principal","500","만원")]},
    {category:"income",label:"근거 없는 직장명",fields:[quoted("net","100","만원")]},
    {category:"asset",label:"추정 부동산명",fields:[quoted("gross_value","1000","만원")]},
  ]};
  const p=projectPage(read,"synthetic-doc",1,"a".repeat(64));
  assert.equal(p.debts?.length??0,0);assert.equal(p.incomes?.[0].label,"");assert.equal(p.assets?.[0].label,"");
  assert.ok(p.warnings?.some(w=>w.includes("명시된 채권자")));
  assert.ok(!p.facts?.some(f=>f.key==="debt.creditor"||f.key==="income.label"||f.key==="asset.label"));
});

test("보증 한도·청구액은 별도 원문 사실로 보존하고 principal·법적 포함 판단에 섞지 않는다",()=>{
  const quoted=(key:string,value:string,unit:string|null="원"):ReadField=>({key,label:key,value,unit,quote:`${key} ${value}${unit??""}`,confidence:"clear",bbox:[0,0,1,1]});
  const read:PageRead={documentType:"debt_certificate",complete:true,warnings:[],records:[{category:"debt",label:"금융기관 채권행",fields:[
    quoted("creditor","은행A"),quoted("principal","10000000"),quoted("liability_role","guarantor",null),quoted("claim_nature","contingent",null),quoted("underlying_debt_id","주채무-7",null),quoted("guarantee_for","홍길동",null),quoted("recourse_status","unpaid",null),quoted("guarantee_limit","3000000"),quoted("guarantee_amount","2000000"),
  ]}]};
  const p=projectPage(read,"synthetic-debt",1,"b".repeat(64)),d=p.debts![0];
  assert.equal(d.principal?.amountWon,"10000000");assert.equal(d.guaranteeDetails?.sourceGuaranteeLimit?.amountWon,"3000000");assert.equal(d.guaranteeDetails?.sourceGuaranteeAmount?.amountWon,"2000000");
  assert.equal(d.guaranteeDetails?.liabilityRole,"guarantor");assert.equal(d.guaranteeDetails?.claimNature,"contingent");assert.equal(d.guaranteeDetails?.underlyingDebtId,"주채무-7");assert.equal(d.guaranteeDetails?.recourseStatus,"unpaid");
  assert.equal(d.guaranteeDetails?.capTreatment,"unknown");assert.equal(d.guaranteeDetails?.capTreatmentReviewed,false);assert.equal(d.legalReview,"unreviewed");
  assert.ok(p.facts?.some(f=>f.key==="debt.guarantee_for"&&f.value==="홍길동"));assert.ok(p.facts?.some(f=>f.key==="debt.guarantee_limit"&&f.numeric?.amountWon==="3000000"));
});

test("추출 프롬프트 버전이 바뀌어 이전 캐시키와 격리된다",()=>{
  const input={documentId:"doc",documentHash:"a".repeat(64),pages:[1],mappingVersion:"debt_certificate",model:"gpt-6-luna",ruleReleaseId:"test"};
  const current=extractionCacheKey({...input,promptVersion:PROMPT_VERSION});
  for(const priorVersion of ["luna-evidence-3.0.1","luna-evidence-3.3.0"]){
    assert.notEqual(current,extractionCacheKey({...input,promptVersion:priorVersion}));
  }
  assert.match(PROMPT_VERSION,/^luna-evidence-\d+\.\d+\.\d+$/);
  assert.match(PAGE_COMPLETENESS_INSTRUCTIONS,/한 페이지 이미지에 실제로 보이는 행·셀/);assert.match(PAGE_COMPLETENESS_INSTRUCTIONS,/문서 전체의 총 N건/);
});

test("repair 대상은 최초 불일치와 누락 check뿐이며 최초 agrees는 뒤의 응답으로 훼손되지 않는다",()=>{
  const field=(key:string,value:string):ReadField=>({key,label:key,value,unit:"원",quote:`${key} ${value}원`,confidence:"clear",bbox:[0,0,1,1]});
  const read:PageRead={documentType:"debt_certificate",complete:true,warnings:[],records:[{category:"debt",label:"대출",fields:[field("creditor","은행"),field("principal","500"),field("interest","0")]}]};
  const first=[
    {recordIndex:0,fieldIndex:0,status:"agrees" as const,value:"은행",unit:"원",quote:"creditor 은행",reason:"일치"},
    {recordIndex:0,fieldIndex:1,status:"corrected" as const,value:"500",unit:"원",quote:"principal 500원",reason:"단위 확인"},
  ];
  const targets=getRepairTargets(read,first);assert.deepEqual(targets.map(x=>[x.recordIndex,x.fieldIndex,x.missingFirstCheck]),[[0,1,false],[0,2,true]]);
  const initial=applyFirstVerification(read,first);assert.equal(initial.read.records[0].fields[0].confidence,"clear");assert.equal(initial.read.records[0].fields[1].confidence,"uncertain");assert.equal(initial.read.records[0].fields[2].confidence,"uncertain");
  const repaired=applyTargetedRepair(initial.read,first,[
    {recordIndex:0,fieldIndex:0,status:"ambiguous",value:"다른기관",unit:null,quote:"",reason:"대상 아님"},
    {recordIndex:0,fieldIndex:1,status:"corrected",value:"500",unit:"원",quote:"principal 500원",reason:"재확인"},
    {recordIndex:0,fieldIndex:2,status:"agrees",value:"0",unit:"원",quote:"interest 0원",reason:"누락된 첫 검증을 원문 agrees로 보완"},
  ]);
  assert.equal(repaired.read.records[0].fields[0].value,"은행");assert.equal(repaired.read.records[0].fields[0].confidence,"clear");
  assert.equal(repaired.read.records[0].fields[1].confidence,"clear");assert.equal(repaired.read.records[0].fields[2].confidence,"clear");assert.equal(repaired.disagreements,0);
});

test("첫 교정 응답의 값·단위·인용 중 하나라도 null 또는 불일치면 두 번째 합의로 확정하지 않는다",()=>{
  const field:ReadField={key:"principal",label:"원금",value:"500",unit:"원",quote:"원금 500원",confidence:"uncertain",bbox:null};
  const first={recordIndex:0,fieldIndex:0,status:"corrected" as const,value:"500",unit:null,quote:null,reason:"첫 응답 불완전"};
  const second={...first,unit:"원",quote:"원금 500원"};
  const r=applyTargetedRepair({documentType:"x",complete:true,warnings:[],records:[{category:"debt",label:"d",fields:[field]}]},[first],[second]);
  assert.equal(r.read.records[0].fields[0].confidence,"uncertain");assert.equal(r.disagreements,1);
});

test("첫 agrees의 값·단위·인용 검증이 추출값과 다르면 확정하지 않으며 누락 check는 독립 agrees로 해소된다",()=>{
  const mk=(key:string,value:string):ReadField=>({key,label:key,value,unit:"원",quote:`${key} ${value}원`,confidence:"uncertain",bbox:null});
  const read:PageRead={documentType:"x",complete:true,warnings:[],records:[{category:"debt",label:"d",fields:[mk("principal","500"),mk("interest","0")]}]};
  const first=[{recordIndex:0,fieldIndex:0,status:"agrees" as const,value:"500",unit:"만원",quote:"원금 500만원",reason:"잘못된 단위 agrees"}];
  const initial=applyFirstVerification(read,first);
  assert.equal(initial.read.records[0].fields[0].confidence,"uncertain");
  assert.equal(initial.targets.length,2);
  const repaired=applyTargetedRepair(initial.read,first,[
    {recordIndex:0,fieldIndex:0,status:"agrees",value:"500",unit:"원",quote:"원금 500원",reason:"원문 일치"},
    {recordIndex:0,fieldIndex:1,status:"agrees",value:"0",unit:"원",quote:"이자 0원",reason:"누락된 첫 검증을 보완"},
  ]);
  assert.equal(repaired.read.records[0].fields[0].confidence,"uncertain");
  assert.equal(repaired.read.records[0].fields[1].confidence,"clear");
});

test("누락행 재추출은 기존 합의 필드를 새 행에 보존하고 연결할 수 없으면 페이지를 partial로 남긴다",()=>{
  const confirmed=(key:string,value:string):ReadField=>({key,label:key,value,unit:null,quote:`${key} ${value}`,confidence:"clear",bbox:null});
  const baseline:PageRead={documentType:"debt_certificate",complete:true,warnings:[],records:[{category:"debt",label:"행",fields:[confirmed("contract_id","C-1"),confirmed("creditor","은행A"),confirmed("principal","500")]}]};
  const checks=[0,1,2].map(fieldIndex=>({recordIndex:0,fieldIndex,status:"agrees" as const,value:baseline.records[0].fields[fieldIndex].value,unit:null,quote:baseline.records[0].fields[fieldIndex].quote,reason:"원문 일치"}));
  const reread:PageRead={documentType:"debt_certificate",complete:true,warnings:[],records:[{category:"debt",label:"행 재추출",fields:[confirmed("contract_id","C-1"),confirmed("creditor","은행A")]}]};
  const merged=preserveAgreedFieldsAfterOmission(baseline,checks,reread);
  assert.equal(merged.complete,true);assert.ok(merged.records[0].fields.some(f=>f.key==="principal"&&f.value==="500"&&f.confidence==="clear"));
  assert.equal(reread.records[0].fields.some(f=>f.key==="principal"),false,"원시 누락행 재추출 snapshot은 baseline 필드 병합으로 변형되지 않아야 합니다.");
  const unmatched=preserveAgreedFieldsAfterOmission(baseline,checks,{...reread,records:[{...reread.records[0],fields:[confirmed("contract_id","C-2")]}]});
  assert.equal(unmatched.complete,false);assert.ok(unmatched.warnings.length);
});
