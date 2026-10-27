import test from "node:test";
import assert from "node:assert/strict";
import { applyConfirmedCorrection,applyFirstVerification,applyTargetedRepair,DOC_FIELDS,getRepairTargets,isValidSourceBBox,preserveAgreedFieldsAfterOmission,projectPage,validatePageRead,EXTRACT_INSTRUCTIONS,PAGE_COMPLETENESS_INSTRUCTIONS,PROMPT_VERSION,VERIFY_SCHEMA } from "../lib/extraction.ts";
import { applyExtraction,createCase,currentFacts,extractionCacheKey } from "../lib/domain.ts";
import { observedSourceDetails } from "../lib/observed-source-details.ts";
import type { PageRead,ReadField } from "../lib/extraction.ts";

const reading=(value:string,unit:string|null,quote:string)=>({meaningStatus:"supported",status:"corrected",value,unit,quote});
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
  assert.ok("bbox" in properties);
  assert.deepEqual((properties.meaningStatus as {enum:string[]}).enum,["supported","wrong_field","unclear"]);
  assert.match(PROMPT_VERSION,/3\.14\.0$/);
});

test("값·단위·인용이 같아도 의미가 wrong_field면 확인 완료나 source receipt 기반 투영에 쓰지 않는다",()=>{
  const field:ReadField={key:"interest",label:"interest",value:"1234",unit:"원",quote:"연체이자 1234원",confidence:"clear",bbox:null};
  const read:PageRead={documentType:"debt_certificate",complete:true,warnings:[],records:[{category:"debt",label:"synthetic",fields:[field]}]};
  const check={recordIndex:0,fieldIndex:0,meaningStatus:"wrong_field" as const,status:"agrees" as const,value:"1234",unit:"원",quote:"연체이자 1234원",reason:"원문은 overdue interest이며 interest key 의미를 지지하지 않음"};
  const result=applyFirstVerification(read,[check]);assert.equal(result.read.records[0].fields[0].key,"interest");assert.equal(result.read.records[0].fields[0].confidence,"uncertain");assert.equal(result.targets.length,1);assert.equal(result.targets[0].bboxOnly,false);
  const missing={...check,meaningStatus:undefined};const missingResult=applyFirstVerification(read,[missing]);assert.equal(missingResult.read.records[0].fields[0].confidence,"uncertain");
});

test("bbox는 좌상단 원점의 유효한 모서리 좌표만 허용하고 추출 지침에 width/height가 아님을 명시한다",()=>{
  assert.equal(isValidSourceBBox([.1,.2,.3,.4]),true);
  for(const bad of [[.2,.2,.1,.4],[.1,.4,.3,.2],[.1,.2,.1,.4],[-.1,.2,.3,.4],[.1,.2,1.1,.4],[.1,.2,Number.NaN,.4]])assert.equal(isValidSourceBBox(bad),false);
  assert.match(EXTRACT_INSTRUCTIONS,/left, top, right, bottom/);assert.match(EXTRACT_INSTRUCTIONS,/좌표 끝점이지 x\/y\/너비\/높이가 아니다/);
});

test("잘못된 bbox는 자동변환하지 않고 bbox 전용 재확인으로 보내며 인용된 명확한 값을 보존한다",()=>{
  const field:ReadField={key:"coverage_amount",label:"가입금액",value:"synthetic",unit:"원",quote:"synthetic quoted amount",confidence:"clear",bbox:[.5,.4,.2,.6]};
  const read:PageRead={documentType:"insurance",complete:true,warnings:[],records:[{category:"asset",label:"synthetic",fields:[field]}]};
  const validated=validatePageRead(read);assert.deepEqual(validated.records[0].fields[0].bbox,[.5,.4,.2,.6]);assert.ok(validated.warnings.length);
  const projection=projectPage(validated,"synthetic-bbox",1,"a".repeat(64));assert.equal(projection.facts?.[0].refs?.[0].bbox,undefined,"malformed geometry never reaches source references");
  const first=[{recordIndex:0,fieldIndex:0,meaningStatus:"supported",status:"agrees" as const,value:"synthetic",unit:"원",quote:"synthetic quote",reason:"값 확인"}];
  const checked=applyFirstVerification(validated,first);assert.equal(checked.read.records[0].fields[0].value,"synthetic");assert.equal(checked.read.records[0].fields[0].confidence,"clear");assert.equal(checked.targets[0]?.bboxOnly,true);assert.equal(checked.targets[0]?.bboxIssue,true);
  const repaired=applyTargetedRepair(checked.read,first,[{...first[0],bbox:[.1,.2,.3,.4]}]);
  assert.equal(repaired.disagreements,0);assert.equal(repaired.read.records[0].fields[0].value,"synthetic");assert.equal(repaired.read.records[0].fields[0].confidence,"clear");assert.deepEqual(repaired.read.records[0].fields[0].bbox,[.1,.2,.3,.4]);assert.equal(repaired.read.warnings.some(w=>w.includes("bbox")),false);
});

test("bbox-only repair null은 허용하고 잘못된 수리 좌표는 값을 살린 채 review 상태로 남긴다",()=>{
  const f:ReadField={key:"coverage_amount",label:"가입금액",value:"synthetic",unit:"원",quote:"synthetic quote",confidence:"clear",bbox:[.6,.4,.2,.7]};
  const read:PageRead={documentType:"insurance",complete:true,warnings:[],records:[{category:"asset",label:"synthetic",fields:[f]}]};
  const first=[{recordIndex:0,fieldIndex:0,meaningStatus:"supported",status:"agrees" as const,value:"synthetic",unit:"원",quote:"synthetic quote",reason:"값 확인"}];
  const checked=applyFirstVerification(read,first);
  const noBox=applyTargetedRepair(checked.read,first,[{...first[0],bbox:null}]);assert.equal(noBox.disagreements,0);assert.equal(noBox.read.records[0].fields[0].bbox,null);assert.equal(noBox.read.records[0].fields[0].value,"synthetic");assert.equal(noBox.read.records[0].fields[0].confidence,"clear");
  for(const meaningStatus of [undefined,"wrong_field","unclear"] as const){
    const unsupportedMeaning=applyTargetedRepair(checked.read,first,[{...first[0],meaningStatus,bbox:null}]);
    assert.equal(unsupportedMeaning.disagreements,1);assert.equal(unsupportedMeaning.read.records[0].fields[0].bbox,null);assert.equal(unsupportedMeaning.read.records[0].fields[0].confidence,"clear","bbox-only failure preserves the already supported value without promoting semantic status");
  }
  const invalid=applyTargetedRepair(checked.read,first,[{...first[0],bbox:[.6,.4,.2,.7]}]);assert.equal(invalid.disagreements,1);assert.equal(invalid.read.records[0].fields[0].bbox,null);assert.equal(invalid.read.records[0].fields[0].value,"synthetic");assert.equal(invalid.read.records[0].fields[0].confidence,"clear");assert.ok(invalid.read.warnings.some(w=>w.includes("bbox")&&w.includes("보존")));
});

test("bbox 문제와 값 문제를 함께 가진 대상은 정상 이중 교정을 허용하되 잘못된 좌표는 계속 review로 남긴다",()=>{
  const f:ReadField={key:"text",label:"synthetic",value:"old reading",unit:null,quote:"old quote",confidence:"clear",bbox:[.5,.6,.2,.8]};
  const read:PageRead={documentType:"statement",complete:true,warnings:[],records:[{category:"statement",label:"synthetic",fields:[f]}]};
  const first=[{recordIndex:0,fieldIndex:0,meaningStatus:"supported",status:"corrected" as const,value:"corrected text",unit:null,quote:"source quote pass one",reason:"값과 단위 확인"}];
  const checked=applyFirstVerification(read,first);assert.equal(checked.targets[0]?.bboxIssue,true);assert.equal(checked.targets[0]?.bboxOnly,false);
  const fixed=applyTargetedRepair(checked.read,first,[{...first[0],bbox:[.1,.2,.3,.4]}]);assert.equal(fixed.disagreements,0);assert.equal(fixed.read.records[0].fields[0].value,"corrected text");assert.equal(fixed.read.records[0].fields[0].confidence,"clear");assert.deepEqual(fixed.read.records[0].fields[0].bbox,[.1,.2,.3,.4]);
  const unresolved=applyTargetedRepair(checked.read,first,[{...first[0],bbox:[.6,.8,.2,.3]}]);assert.equal(unresolved.disagreements,1);assert.equal(unresolved.read.records[0].fields[0].value,"corrected text");assert.equal(unresolved.read.records[0].fields[0].confidence,"clear");assert.equal(unresolved.read.records[0].fields[0].bbox,null);assert.ok(unresolved.read.warnings.some(w=>w.includes("좌표")));
});

test("statement.text는 서로 다른 원문 bbox를 가진 문단마다 독립 fact로 보존한다",()=>{
  const text=(value:string,quote:string,bbox:number[]|null):ReadField=>({key:"text",label:"statement text",value,unit:null,quote,confidence:"clear",bbox});
  const fields=[text("opening paragraph","opening paragraph citation",[.1,.1,.8,.2]),text("closing paragraph","closing paragraph citation",[.1,.3,.8,.4])];
  const read:PageRead={documentType:"client_statement",complete:true,warnings:[],records:[{category:"statement",label:"statement record",fields}]};
  const payload=projectPage(read,"synthetic-statement",1,"a".repeat(64));const facts=payload.facts?.filter(f=>f.key==="statement.text")??[];
  assert.deepEqual(facts.map(f=>f.value),["opening paragraph","closing paragraph"]);assert.equal(new Set(facts.map(f=>f.logicalId)).size,2);assert.ok(facts.every(f=>!f.validation?.some(v=>v.code==="FIELD_CONFLICT")));assert.deepEqual(facts.map(f=>f.refs?.[0].bbox),[[.1,.1,.8,.2],[.1,.3,.8,.4]]);
  const data=createCase("synthetic","synthetic","2026-10-27");data.documents=[{id:"synthetic-statement",name:"statement",sha256:"a".repeat(64),status:"active",pages:[1]}];data.pages=[{documentId:"synthetic-statement",page:1,role:"evidence"}];const applied=applyExtraction(data,payload),details=observedSourceDetails(applied,["statement.text"]);
  assert.equal(details.rows.length,2);assert.ok(details.rows.every(row=>row[7]==="원문 관측; 법적 인정 아님"));assert.ok(details.rows.every(row=>String(row[3]).startsWith("box-")));
});

test("statement.text without bbox keeps paragraph order in logical identity; exact text repeats remain distinct when no location proves duplication",()=>{
  const text=(value:string,index:number):ReadField=>({key:"statement.text",label:"paragraph",value,unit:null,quote:`quote ${index} for ${value}`,confidence:"clear",bbox:null});
  const read:PageRead={documentType:"client_statement",complete:true,warnings:[],records:[{category:"statement",label:"statement record",fields:[text("repeated paragraph",1),text("middle paragraph",2),text("repeated paragraph",3)]}]};
  const facts=projectPage(read,"synthetic-statement",1,"b".repeat(64)).facts?.filter(f=>f.key==="statement.text")??[];
  assert.deepEqual(facts.map(f=>f.value),["repeated paragraph","middle paragraph","repeated paragraph"]);assert.deepEqual(facts.map(f=>f.logicalId?.match(/paragraph:ordinal-\d+/)?.[0]),["paragraph:ordinal-1","paragraph:ordinal-2","paragraph:ordinal-3"]);assert.ok(facts.every(f=>!f.validation?.some(v=>v.code==="FIELD_CONFLICT")));
});

test("statement.text without bbox carries an explicitly quoted section anchor",()=>{
  const anchor:ReadField={key:"section_anchor",label:"section",value:"Background",unit:null,quote:"Section: Background",confidence:"clear",bbox:null};
  const paragraph:ReadField={key:"text",label:"statement text",value:"paragraph under heading",unit:null,quote:"paragraph under heading",confidence:"clear",bbox:null};
  const read:PageRead={documentType:"client_statement",complete:true,warnings:[],records:[{category:"statement",label:"statement record",fields:[anchor,paragraph]}]};
  const fact=projectPage(read,"synthetic-statement",1,"f".repeat(64)).facts?.find(f=>f.key==="statement.text");
  assert.ok(fact?.logicalId?.includes(":paragraph:section-"));assert.ok(fact?.logicalId?.endsWith("-ordinal-1"));
});

test("statement.text duplicates at the same bbox dedupe, but conflicting text at one bbox remains disputed",()=>{
  const text=(value:string,quote:string):ReadField=>({key:"text",label:"paragraph",value,unit:null,quote,confidence:"clear",bbox:[.2,.2,.8,.4]});
  const same:PageRead={documentType:"client_statement",complete:true,warnings:[],records:[{category:"statement",label:"statement record",fields:[text("same paragraph","same source quote"),text("same paragraph","same source quote")]}]};
  assert.equal(projectPage(same,"synthetic-statement",1,"c".repeat(64)).facts?.filter(f=>f.key==="statement.text").length,1);
  const conflict:PageRead={...same,records:[{...same.records[0],fields:[text("first reading","same region quote"),text("different reading","same region quote")]}]};
  const payload=projectPage(conflict,"synthetic-statement",1,"d".repeat(64)),candidates=payload.facts?.filter(f=>f.key==="statement.text")??[];
  assert.equal(candidates.length,2);assert.ok(candidates.every(f=>f.validation?.some(v=>v.code==="FIELD_CONFLICT")));assert.ok(candidates.every(f=>f.logicalId?.includes(":candidate:")));
  const data=createCase("synthetic","synthetic","2026-10-27");data.documents=[{id:"synthetic-statement",name:"statement",sha256:"d".repeat(64),status:"active",pages:[1]}];data.pages=[{documentId:"synthetic-statement",page:1,role:"evidence"}];
  const applied=applyExtraction(data,payload);assert.equal(currentFacts(applied).filter(f=>f.key==="statement.text").length,2);assert.ok(currentFacts(applied).filter(f=>f.key==="statement.text").every(f=>f.state==="disputed"));
});

test("source-only encumbrance, lease property, and insurance policy identifiers retain their namespaces",()=>{
  const quote=(key:string,value:string):ReadField=>({key,label:key,value,unit:null,quote:`${key}: ${value}`,confidence:"clear",bbox:null});
  const cases:[string,ReadField[],string[]][]=[
    ["bank_account",[quote("bank_account.seizure_status","확인중"),quote("bank_account.pledge_status","기재")],["bank_account.seizure_status","bank_account.pledge_status"]],
    ["lease",[quote("lease.property_address","masked address"),quote("lease.property_reference","unit reference")],["lease.property_address","lease.property_reference"]],
    ["insurance",[quote("insurance.policy_number","**-masked")],["insurance.policy_number"]],
  ];
  for(const [documentType,fields,expected] of cases){const read:PageRead={documentType,complete:true,warnings:[],records:[{category:"other",label:"source-only details",fields}]};const keys=projectPage(read,"synthetic-detail",1,"e".repeat(64)).facts?.map(f=>f.key)??[];assert.deepEqual(keys,expected);}
  assert.match(DOC_FIELDS.bank_account,/seizure_status/);assert.match(DOC_FIELDS.lease,/property_address/);assert.match(DOC_FIELDS.insurance,/policy_number/);
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
    {recordIndex:0,fieldIndex:0,meaningStatus:"supported",status:"agrees" as const,value:"은행",unit:"원",quote:"creditor 은행",reason:"일치"},
    {recordIndex:0,fieldIndex:1,meaningStatus:"supported",status:"corrected" as const,value:"500",unit:"원",quote:"principal 500원",reason:"단위 확인"},
  ];
  const targets=getRepairTargets(read,first);assert.deepEqual(targets.map(x=>[x.recordIndex,x.fieldIndex,x.missingFirstCheck]),[[0,1,false],[0,2,true]]);
  const initial=applyFirstVerification(read,first);assert.equal(initial.read.records[0].fields[0].confidence,"clear");assert.equal(initial.read.records[0].fields[1].confidence,"uncertain");assert.equal(initial.read.records[0].fields[2].confidence,"uncertain");
  const repaired=applyTargetedRepair(initial.read,first,[
    {recordIndex:0,fieldIndex:0,status:"ambiguous",value:"다른기관",unit:null,quote:"",reason:"대상 아님"},
    {recordIndex:0,fieldIndex:1,meaningStatus:"supported",status:"corrected",value:"500",unit:"원",quote:"principal 500원",reason:"재확인"},
    {recordIndex:0,fieldIndex:2,meaningStatus:"supported",status:"agrees",value:"0",unit:"원",quote:"interest 0원",reason:"누락된 첫 검증을 원문 agrees로 보완"},
  ]);
  assert.equal(repaired.read.records[0].fields[0].value,"은행");assert.equal(repaired.read.records[0].fields[0].confidence,"clear");
  assert.equal(repaired.read.records[0].fields[1].confidence,"clear");assert.equal(repaired.read.records[0].fields[2].confidence,"clear");assert.equal(repaired.disagreements,0);
});

test("첫 교정 응답의 값·단위·인용 중 하나라도 null 또는 불일치면 두 번째 합의로 확정하지 않는다",()=>{
  const field:ReadField={key:"principal",label:"원금",value:"500",unit:"원",quote:"원금 500원",confidence:"uncertain",bbox:null};
  const first={recordIndex:0,fieldIndex:0,meaningStatus:"supported",status:"corrected" as const,value:"500",unit:null,quote:null,reason:"첫 응답 불완전"};
  const second={...first,unit:"원",quote:"원금 500원"};
  const r=applyTargetedRepair({documentType:"x",complete:true,warnings:[],records:[{category:"debt",label:"d",fields:[field]}]},[first],[second]);
  assert.equal(r.read.records[0].fields[0].confidence,"uncertain");assert.equal(r.disagreements,1);
});

test("첫 agrees의 값·단위·인용 검증이 추출값과 다르면 확정하지 않으며 누락 check는 독립 agrees로 해소된다",()=>{
  const mk=(key:string,value:string):ReadField=>({key,label:key,value,unit:"원",quote:`${key} ${value}원`,confidence:"uncertain",bbox:null});
  const read:PageRead={documentType:"x",complete:true,warnings:[],records:[{category:"debt",label:"d",fields:[mk("principal","500"),mk("interest","0")]}]};
  const first=[{recordIndex:0,fieldIndex:0,meaningStatus:"supported",status:"agrees" as const,value:"500",unit:"만원",quote:"원금 500만원",reason:"잘못된 단위 agrees"}];
  const initial=applyFirstVerification(read,first);
  assert.equal(initial.read.records[0].fields[0].confidence,"uncertain");
  assert.equal(initial.targets.length,2);
  const repaired=applyTargetedRepair(initial.read,first,[
    {recordIndex:0,fieldIndex:0,meaningStatus:"supported",status:"agrees",value:"500",unit:"원",quote:"원금 500원",reason:"원문 일치"},
    {recordIndex:0,fieldIndex:1,meaningStatus:"supported",status:"agrees",value:"0",unit:"원",quote:"이자 0원",reason:"누락된 첫 검증을 보완"},
  ]);
  assert.equal(repaired.read.records[0].fields[0].confidence,"uncertain");
  assert.equal(repaired.read.records[0].fields[1].confidence,"clear");
});

test("누락행 재추출은 기존 합의 필드를 새 행에 보존하고 연결할 수 없으면 페이지를 partial로 남긴다",()=>{
  const confirmed=(key:string,value:string):ReadField=>({key,label:key,value,unit:null,quote:`${key} ${value}`,confidence:"clear",bbox:null});
  const baseline:PageRead={documentType:"debt_certificate",complete:true,warnings:[],records:[{category:"debt",label:"행",fields:[confirmed("contract_id","C-1"),confirmed("creditor","은행A"),confirmed("principal","500")]}]};
  const checks=[0,1,2].map(fieldIndex=>({recordIndex:0,fieldIndex,meaningStatus:"supported",status:"agrees" as const,value:baseline.records[0].fields[fieldIndex].value,unit:null,quote:baseline.records[0].fields[fieldIndex].quote,reason:"원문 일치"}));
  const reread:PageRead={documentType:"debt_certificate",complete:true,warnings:[],records:[{category:"debt",label:"행 재추출",fields:[confirmed("contract_id","C-1"),confirmed("creditor","은행A")]}]};
  const merged=preserveAgreedFieldsAfterOmission(baseline,checks,reread);
  assert.equal(merged.complete,true);assert.ok(merged.records[0].fields.some(f=>f.key==="principal"&&f.value==="500"&&f.confidence==="clear"));
  assert.equal(reread.records[0].fields.some(f=>f.key==="principal"),false,"원시 누락행 재추출 snapshot은 baseline 필드 병합으로 변형되지 않아야 합니다.");
  const unmatched=preserveAgreedFieldsAfterOmission(baseline,checks,{...reread,records:[{...reread.records[0],fields:[confirmed("contract_id","C-2")]}]});
  assert.equal(unmatched.complete,false);assert.ok(unmatched.warnings.length);
});
