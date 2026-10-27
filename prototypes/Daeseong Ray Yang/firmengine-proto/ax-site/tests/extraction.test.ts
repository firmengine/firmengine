import test from "node:test";
import assert from "node:assert/strict";
import { applyExtraction, createCase, currentFacts, reviewFact, DRAFT_RULESET } from "../lib/domain.ts";
import type { CaseData } from "../lib/domain.ts";
import { calculateCase } from "../lib/assessment.ts";
import { EXTRACT_INSTRUCTIONS,DOC_FIELDS,projectPage, validatePageRead } from "../lib/extraction.ts";
import type { PageRead, ReadField, ReadRecord } from "../lib/extraction.ts";

const hash="d".repeat(64);
// Synthetic fixtures explicitly state KRW; missing-unit regressions opt into null.
function field(key:string,value:string|null,extra:Partial<ReadField>={}):ReadField{return {key,label:key,value,unit:"KRW",quote:value===null?null:`${key} ${value}`,confidence:"clear",bbox:[0,0,1,1],...extra};}
function loan(contract="contract-a",principal="100000000"):ReadRecord{return {category:"debt",label:"합성은행",fields:[field("creditor","합성은행"),field("contract_id",contract),field("principal",principal),field("interest","1000000"),field("secured","no"),field("classification","ordinary"),field("as_of","2026-10-27")]};}
function read(records:ReadRecord[],complete=true):PageRead{return {documentType:"debt_certificate",records,warnings:[],complete};}
function fixture(reads:PageRead[]):CaseData{
  const data=createCase("추출 경계 합성 검증","synthetic-extraction","2026-10-27");
  data.documents=[{id:"doc",name:"synthetic.pdf",sha256:hash,status:"active",pages:reads.map((_,i)=>i+1)}];
  data.pages=reads.map((r,i)=>({documentId:"doc",page:i+1,role:"evidence",text:r.records.flatMap(x=>x.fields.map(f=>f.quote??"")).join("\n"),imageUrl:`/synthetic-page-${i+1}.png`}));
  data.context.inventoryComplete={income:"yes",debt:"yes",asset:"yes"};
  return data;
}
const apply=(data:CaseData,r:PageRead,page=1)=>applyExtraction(data,projectPage(r,"doc",page,hash));

test("원금·이자는 각 원문 필드 및 단위에 연결되고 명시적 0을 보존한다",()=>{
  const row=loan();row.fields.find(f=>f.key==="principal")!.unit="천원";row.fields.find(f=>f.key==="principal")!.value="100000";row.fields.find(f=>f.key==="principal")!.quote="원금 100000 천원";
  row.fields.find(f=>f.key==="interest")!.value="0";row.fields.find(f=>f.key==="interest")!.quote="이자 0원";
  const r=read([row]),data=apply(fixture([r]),r),c=calculateCase(data, DRAFT_RULESET);
  assert.equal(c.debtPrincipalWon,"100000000");assert.equal(c.debtInterestWon,"0");
  const f=currentFacts(data).find(f=>f.key==="debt.principal")!;
  assert.equal(f.numeric?.rawValue,"100000");assert.equal(f.numeric?.unit,"천원");assert.equal(f.numeric?.amountWon,"100000000");assert.ok(data.debts[0].factIds.includes(f.id));
});

for(const reading of ["no-quote","unreadable","uncertain"] as const)test(`${reading} 금액은 다른 유효 사실로 우회해 계산되지 않는다`,()=>{
  const row=loan();const f=row.fields.find(f=>f.key==="principal")!;
  if(reading==="no-quote")f.quote=null;else f.confidence=reading;
  const r=read([row]),data=apply(fixture([r]),r);
  assert.equal(data.debts[0].principal,null);assert.equal(calculateCase(data, DRAFT_RULESET).totalDebtWon,null);
  const candidate=currentFacts(data).find(f=>f.key==="debt.principal");
  if(reading==="uncertain"){assert.ok(candidate);assert.ok(candidate.validation.some(v=>v.code==="UNCERTAIN_READING"));assert.ok(!data.debts[0].factIds.includes(candidate.id));}else assert.equal(candidate,undefined);
});

test("빈 이자·담보·분류는 0·무담보·일반채권으로 바뀌지 않는다",()=>{
  const row=loan();row.fields=row.fields.filter(f=>!["interest","secured","classification"].includes(f.key));
  const r=read([row]),data=apply(fixture([r]),r),c=calculateCase(data, DRAFT_RULESET);
  assert.equal(data.debts[0].interest,null);assert.equal(data.debts[0].secured,"unknown");assert.equal(data.debts[0].classification,"unknown");assert.equal(c.debtInterestWon,null);assert.equal(c.unsecuredDebtWon,null);
});

test("원문 페이지 text/imageUrl을 보존하여 존재하지 않는 인용을 거부한다",()=>{
  const r=read([loan()]),data=fixture([r]),before=structuredClone(data.pages[0]);
  const result=apply(data,r);assert.equal(result.pages[0].text,before.text);assert.equal(result.pages[0].imageUrl,before.imageUrl);
  const bad=read([loan("fabricated-contract","999999")]);
  const rejected=apply(result,bad);assert.equal(rejected.pages[0].text,before.text);assert.equal(rejected.debts.length,0);assert.ok(rejected.extractionWarnings?.some(w=>w.includes("원문 인용")));
});

test("완전한 페이지 재추출은 사라진 자동 레코드를 철회하고 최신 버전만 집계한다",()=>{
  const r=read([loan("contract-a"),loan("contract-b","200000000")]);
  let data=apply(fixture([r]),r);assert.equal(data.debts.length,2);
  const oldIds=new Set(currentFacts(data).map(f=>f.id));
  const reduced=read([r.records[0]]);data=apply(data,reduced);
  assert.equal(data.debts.length,1);assert.equal(calculateCase(data, DRAFT_RULESET).totalDebtWon,"101000000");
  assert.ok(currentFacts(data).every(f=>!oldIds.has(f.id)));assert.ok(data.facts.some(f=>f.state==="retracted"));
  assert.ok(currentFacts(data).every(f=>f.version>=3));
  data=apply(data,reduced);assert.equal(data.debts.length,1);assert.equal(calculateCase(data, DRAFT_RULESET).totalDebtWon,"101000000");
});

test("부분 판독은 이전 페이지의 다른 레코드를 철회하지 않는다",()=>{
  const r=read([loan("contract-a"),loan("contract-b","200000000")]);
  let data=apply(fixture([r]),r);data=apply(data,read([r.records[0]],false));
  assert.equal(data.debts.length,2);assert.equal(calculateCase(data, DRAFT_RULESET).totalDebtWon,"302000000");
});

test("완전한 빈 결과는 해당 페이지 자동 객체만 제거한다",()=>{
  const one=read([loan("contract-a")]),two=read([loan("contract-b","200000000")]);
  let data=apply(fixture([one,two]),one);data=apply(data,two,2);data=apply(data,read([]));
  assert.equal(data.debts.length,1);assert.equal(data.debts[0].contractId,"contract-b");assert.equal(calculateCase(data, DRAFT_RULESET).totalDebtWon,"201000000");
});

test("같은 발행기관의 완전한 계약번호가 확인된 반복 페이지는 중복 합산되지 않는다",()=>{
  const row=loan();row.fields.push(field("creditor_identity_id","SYNTHETIC-ISSUER-1001"));
  const r=read([row]);let data=apply(fixture([r,r]),r);data=apply(data,r,2);
  assert.equal(data.debts.length,2);assert.equal(calculateCase(data, DRAFT_RULESET).debtRows.length,1);assert.equal(calculateCase(data, DRAFT_RULESET).totalDebtWon,"101000000");
});

test("사람이 확인한 사실은 재추출로 지워지지 않고 변경 후보는 충돌 처리된다",()=>{
  const r=read([loan()]);let data=apply(fixture([r]),r);
  const original=currentFacts(data).find(f=>f.key==="debt.principal")!;
  data=reviewFact(data,original.id,{state:"verified",recognition:"accepted",actor:"synthetic-reviewer",reason:"합성 원문 대조"});
  const verified=currentFacts(data).find(f=>f.logicalId===original.logicalId)!;
  const changed=read([loan("contract-a","200000000")]);data.pages[0].text+="\nprincipal 200000000";
  data=apply(data,changed);assert.ok(currentFacts(data).some(f=>f.id===verified.id));assert.ok(currentFacts(data).some(f=>f.state==="disputed"&&f.key==="debt.principal"));assert.equal(calculateCase(data, DRAFT_RULESET).debtPrincipalWon,null);
});

test("상충하는 같은 키는 마지막값으로 덮어쓰지 않고 두 후보를 보존한다",()=>{
  const row=loan();row.fields.push(field("principal","200000000"));const r=read([row]),data=apply(fixture([r]),r);
  assert.equal(data.debts[0].principal,null);const candidates=currentFacts(data).filter(f=>f.key==="debt.principal");assert.equal(candidates.length,2);assert.ok(candidates.every(f=>f.validation.some(v=>v.code==="FIELD_CONFLICT")));assert.equal(calculateCase(data, DRAFT_RULESET).debtPrincipalWon,null);
});

test("같은 키·같은 값 반복은 stale fact 참조를 만들지 않는다",()=>{
  const row=loan();row.fields.push({...row.fields.find(f=>f.key==="principal")!});const r=read([row]),data=apply(fixture([r]),r);
  assert.equal(data.debts.length,1);assert.equal(currentFacts(data).filter(f=>f.key==="debt.principal").length,1);assert.equal(calculateCase(data, DRAFT_RULESET).debtPrincipalWon,"100000000");
});

test("합계 소득의 누락 분모와 불명확 금액 기준을 추정하지 않는다",()=>{
  const r=read([{category:"income",label:"합성 사업소득",fields:[field("net","12000000"),field("amount_basis","period_total"),field("kind","business")]}]);
  const data=apply(fixture([r]),r);assert.equal(data.incomes[0].periodMonths,null);assert.equal(calculateCase(data, DRAFT_RULESET).monthlyIncomeWon,null);
});

test("판독 스키마는 누락 confidence/quote 및 잘못된 bbox를 거부한다",()=>{
  assert.doesNotThrow(()=>validatePageRead(read([loan()])));
  const malformed=read([loan()]) as unknown as {records:{fields:Record<string,unknown>[]}[]};delete malformed.records[0].fields[0].confidence;
  assert.throws(()=>validatePageRead(malformed),/원문 필드/);
});

test("허용된 전체 피처키를 보존하고 단축키·전체키 혼용도 typed 금액에 연결한다",()=>{
  const row=loan();row.fields.find(f=>f.key==="principal")!.key="debt.principal";
  const r=read([row,{category:"other",label:"추가 원문 사실",fields:[field("case.prior_dismissal","yes"),field("spouse.income","500000"),field("custom_detail","원문 추가사실")]}]);
  const data=apply(fixture([r]),r),keys=currentFacts(data).map(f=>f.key);
  assert.ok(keys.includes("case.prior_dismissal"));assert.ok(keys.includes("spouse.income"));assert.ok(keys.includes("other.custom_detail"));assert.ok(!keys.includes("debt.debt.principal"));assert.equal(calculateCase(data,DRAFT_RULESET).debtPrincipalWon,"100000000");
});

test("계약 식별이 없는 같은 채권자의 반복 페이지는 총액 확정을 보류한다",()=>{
  const row=loan();row.fields=row.fields.filter(f=>f.key!=="contract_id");const r=read([row]);
  let data=apply(fixture([r,r]),r);data=apply(data,r,2);
  const c=calculateCase(data,DRAFT_RULESET);assert.equal(c.totalDebtWon,null);assert.ok(c.issues.some(x=>x.startsWith("DEBT_IDENTITY_AMBIGUOUS")));
});

test("워크플로의 전체 camelCase 키도 기간·금액·기준일을 같은 typed 객체에 연결한다",()=>{
  const income:ReadRecord={category:"income",label:"합성 기간 소득",fields:[field("income.kind","wage"),field("income.net","12000",{unit:"천원"}),field("income.periodStart","2026-01-01"),field("income.periodEnd","2026-06-30"),field("income.periodMonths","6"),field("income.amountBasis","period_total"),field("income.recurring","yes")]};
  const asset:ReadRecord={category:"asset",label:"합성 자산",fields:[field("ASSET.grossValue","3000",{unit:"만원"}),field("asset.securedPayoff","0"),field("asset.securedPayoffScope","applicant_interest"),field("asset.disposalCosts","0"),field("asset.protectedValue","0"),field("asset.ownershipBps","10000"),field("asset.asOf","2026-10-27"),field("asset.valuationBasis","합성 평가서")]};
  const debt=loan();debt.fields=debt.fields.map(f=>({...f,key:({contract_id:"debt.contractId",as_of:"debt.asOf"} as Record<string,string>)[f.key]??f.key}));debt.fields.push(field("debt.dueDate","2026-11-30"));
  const r=read([income,asset,debt,{category:"other",label:"합성 절차 사실",fields:[field("CASE.priorDismissal","yes")]}]),data=apply(fixture([r]),r);
  assert.equal(data.incomes[0].periodStart,"2026-01-01");assert.equal(data.incomes[0].periodEnd,"2026-06-30");assert.equal(data.incomes[0].periodMonths,6);assert.equal(data.incomes[0].amountBasis,"period_total");assert.equal(calculateCase(data,DRAFT_RULESET).monthlyIncomeWon,"2000000");
  assert.equal(data.assets[0].grossValue?.amountWon,"30000000");assert.equal(data.assets[0].securedPayoffScope,"applicant_interest");assert.ok(data.assets[0].factIds.some(id=>currentFacts(data).some(f=>f.id===id&&f.key==="asset.secured_payoff_scope"&&f.value==="applicant_interest")));assert.equal(data.assets[0].ownershipBps,10000);assert.equal(data.assets[0].asOf,"2026-10-27");assert.equal(data.assets[0].valuationBasis,"합성 평가서");
  assert.equal(data.debts[0].contractId,"contract-a");assert.equal(data.debts[0].asOf,"2026-10-27");assert.equal(data.debts[0].dueDate,"2026-11-30");
  const facts=currentFacts(data);assert.equal(facts.find(f=>f.key==="asset.gross_value")?.numeric?.amountWon,"30000000");assert.ok(facts.some(f=>f.key==="case.prior_dismissal"));assert.ok(facts.every(f=>!/[A-Z]/.test(f.key)));
});

test("전체 camelCase와 단축 snake_case의 동일 필드는 중복 제거하고 상충값은 투영하지 않는다",()=>{
  for(const second of ["1000000","2000000"]){
    const r=read([{category:"asset",label:"합성 자산",fields:[field("gross_value","1000000"),field("asset.grossValue",second)]}]),data=apply(fixture([r]),r),facts=currentFacts(data).filter(f=>f.key==="asset.gross_value");
    if(second==="1000000"){assert.equal(facts.length,1);assert.equal(data.assets[0].grossValue?.amountWon,"1000000");assert.deepEqual(data.assets[0].factIds,[facts[0].id]);}
    else {assert.equal(facts.length,2);assert.ok(facts.every(f=>f.validation.some(v=>v.code==="FIELD_CONFLICT")));assert.equal(data.assets.length,0);}
  }
});

test("키 표기만 바뀐 재판독은 같은 논리 사실의 새 버전으로 연결한다",()=>{
  const r=read([{category:"asset",label:"합성 자산",fields:[field("asset.grossValue","1000000")]}]);
  let data=apply(fixture([r]),r);const original=currentFacts(data)[0];
  const reread=structuredClone(r);reread.records[0].fields[0].key="gross_value";data=apply(data,reread);
  const facts=currentFacts(data);assert.equal(facts.length,1);assert.equal(facts[0].logicalId,original.logicalId);assert.ok(facts[0].version>original.version);assert.equal(facts[0].key,"asset.gross_value");assert.equal(data.assets[0].grossValue?.amountWon,"1000000");
});

test("명시 단위가 없는 원문 금액은 모든 typed 축에서 원으로 추정하지 않는다",()=>{
  for(const unit of [null,"","  "]){
    const r=read([
      {category:"income",label:"합성 소득",fields:[field("net","500",{unit}),field("amount_basis","monthly")]},
      {category:"debt",label:"합성 채무",fields:[field("creditor","은행A"),field("principal","500",{unit})]},
      {category:"asset",label:"합성 재산",fields:[field("gross_value","500",{unit})]},
      {category:"transaction",label:"합성 거래",fields:[field("amount","500",{unit}),field("direction","out"),field("date","2026-10-27")]},
    ]),original=structuredClone(r),projection=projectPage(r,"doc",1,hash);
    for(const numeric of [projection.incomes![0].net,projection.debts![0].principal,projection.assets![0].grossValue,projection.transactions![0].amount]){
      assert.equal(numeric?.rawValue,"500");assert.equal(numeric?.amountWon,null);assert.equal(numeric?.normalizationStatus,"review_required");
    }
    const amountFacts=projection.facts!.filter(f=>f.numeric);
    assert.equal(amountFacts.length,4);assert.ok(amountFacts.every(f=>f.numeric?.amountWon===null&&f.validation?.some(v=>v.code==="MONETARY_UNIT_MISSING")));
    assert.deepEqual(r,original);
  }
});

test("원·천원·만원의 명시적 원문 단위만 해당 배율로 변환한다",()=>{
  for(const [unit,expected] of [["원","500"],["천원","500000"],["만원","5000000"]]){
    const r=read([{category:"transaction",label:"합성 거래",fields:[field("amount","500",{unit,quote:`금액 500 / 단위 ${unit}`})]}]),projection=projectPage(r,"doc",1,hash);
    assert.equal(projection.transactions![0].amount.amountWon,expected);assert.equal(projection.transactions![0].amount.normalizationStatus,"exact");assert.equal(projection.facts![0].numeric?.unit,unit);
  }
});

test("신용정보조회서의 대출 발생금액은 current debt principal이 아닌 신용이력 fact로만 남긴다",()=>{
  const row:ReadRecord={category:"debt",label:"대출정보 행",fields:[field("creditor","은행A"),field("classification","신용대출"),field("origination_date","2026-01-15"),field("reported_amount","700",{unit:"천원"}),field("amount","700",{unit:"천원",quote:"금액 700 천원"})]};
  const p=projectPage({...read([row]),documentType:"credit_report"},"doc",1,hash);
  assert.equal(p.debts?.length,0);
  const amounts=p.facts?.filter(f=>f.key==="credit_report.amount");assert.equal(amounts?.length,1);
  assert.equal(amounts?.[0].numeric?.amountWon,"700000");assert.equal(amounts?.[0].numeric?.unit,"천원");
  assert.ok(!p.facts?.some(f=>(f.key??"").startsWith("debt.")));
  assert.ok(p.warnings?.some(w=>w.includes("현재 잔액이 아니므로")));
});

test("건강보험료 미납표의 premium arrears·late charge·total·0 비용은 단위와 별도 fact로 유지하고 debt 분류하지 않는다",()=>{
  const row:ReadRecord={category:"debt",label:"보험료 미납 행",fields:[field("creditor","국민건강보험공단"),field("period","2025.03-2026.07(17)"),field("as_of","2026-08-13"),field("principal","210000",{unit:"원",quote:"미납보험료 210000"}),field("interest","9000",{unit:"원",quote:"연체금 9000"}),field("total","219000",{unit:"원",quote:"미납액계 219000"}),field("disposition_amount","0",{unit:"원",quote:"체납처분비등 0"})]};
  const p=projectPage({...read([row]),documentType:"건강보험료 미납내역서"},"doc",1,hash);
  assert.equal(p.debts?.length,0);
  for(const [key,won] of [["premium_arrears","210000"],["late_charge","9000"],["total_arrears","219000"],["disposal_costs","0"]]){
    const f=p.facts?.find(x=>x.key===`health_insurance_arrears.${key}`);assert.ok(f);assert.equal(f.numeric?.amountWon,won);assert.equal(f.numeric?.unit,"원");
  }
  assert.ok(p.warnings?.some(w=>w.includes("법적 채무 분류 전")));
});

test("typed current debt에는 quoted creditor와 명시적 current claim basis가 모두 필요하다",()=>{
  const metadata:ReadRecord={category:"debt",label:"신용조회 메타",fields:[field("creditor","은행A"),field("origination_date","2026-01-15"),field("contract_id","C-1")]};
  const claim:ReadRecord={category:"debt",label:"채권증명",fields:[field("creditor","은행B"),field("principal","500",{unit:"원"})]};
  const noCreditor:ReadRecord={category:"debt",label:"무기명 채권",fields:[field("principal","300",{unit:"원"})]};
  const p=projectPage(read([metadata,claim,noCreditor]),"doc",1,hash);
  assert.equal(p.debts?.length,1);assert.equal(p.debts?.[0].creditor,"은행B");assert.equal(p.debts?.[0].principal?.amountWon,"500");
  assert.ok(p.facts?.some(f=>f.key==="debt.contract_id"&&f.value==="C-1"));
});

test("IncomeSource payerIdentityId는 인용된 source ID만 받고 aggregation 결론은 unknown으로 시작한다",()=>{
  const good:ReadRecord={category:"income",label:"급여",fields:[field("label","월급"),field("employer","합성회사"),field("payer_identity_id","사업자-123",{quote:"지급자 식별번호 사업자-123"}),field("net","100",{unit:"만원"})]};
  const uncertain:ReadRecord={category:"income",label:"추가 급여",fields:[field("label","월급2"),field("payer_identity_id","사업자-999",{confidence:"uncertain"}),field("net","200",{unit:"만원"})]};
  const p=projectPage(read([good,uncertain]),"doc",1,hash);
  assert.equal(p.incomes?.[0].payerIdentityId,"사업자-123");assert.equal(p.incomes?.[0].aggregationTreatment,"unknown");assert.equal(p.incomes?.[0].aggregationReviewed,false);
  assert.equal(p.incomes?.[1].payerIdentityId,undefined);assert.equal(p.incomes?.[1].aggregationTreatment,"unknown");assert.equal(p.incomes?.[1].aggregationReviewed,false);
});

test("신원 추출은 명시된 person.role만 사실로 보존하고 신청인 추정을 금지한다",()=>{
  const input:PageRead={documentType:"identity_family",complete:true,warnings:[],records:[{category:"person",label:"합성 대상 행",fields:[field("name","Synthetic Applicant"),field("role","applicant"),field("address","Synthetic Address"),field("resident_id_masked","900101-1******")]}]};
  const projected=projectPage(input,"doc",1,hash);
  assert.ok(projected.facts?.some(fact=>fact.key==="person.role"&&fact.value==="applicant"));
  assert.ok(projected.facts?.some(fact=>fact.key==="person.name"&&fact.value==="Synthetic Applicant"));
  assert.match(DOC_FIELDS.identity_family,/원문에서 신청인 본인이라고 명시된 경우에만 person\.role=applicant/);
  assert.match(EXTRACT_INSTRUCTIONS,/이름의 유일성/);
});

test("bank account와 lease 원문 namespace의 금액은 단위가 있을 때만 source fact로 보존하고 typed 자산을 만들지 않는다",()=>{
  const r:PageRead={documentType:"synthetic",complete:true,warnings:[],records:[{category:"other",label:"계좌/임대 자료",fields:[
    field("bank_account.account_number","1234-****",{quote:"계좌번호 1234-****"}),
    field("bank_account.active_status","해지",{quote:"상태 해지"}),
    field("lease.deposit","1000",{unit:"만원",quote:"보증금 1000만원"}),
    field("lease.secured_balance","800",{unit:"만원",quote:"현재 대출잔액 800만원"}),
    field("lease.arrears_deduction","50",{unit:"만원",quote:"미납차임 50만원"}),
  ]}]};
  const p=projectPage(r,"doc",1,hash);
  assert.equal(p.assets?.length??0,0);assert.equal(p.debts?.length??0,0);
  for(const [key,won] of [["lease.deposit","10000000"],["lease.secured_balance","8000000"],["lease.arrears_deduction","500000"]]){
    const f=p.facts?.find(x=>x.key===key);assert.ok(f);assert.equal(f.numeric?.amountWon,won);assert.equal(f.numeric?.unit,"만원");
  }
  assert.equal(p.facts?.find(x=>x.key==="bank_account.account_number")?.value,"1234-****");
  assert.equal(p.facts?.find(x=>x.key==="bank_account.active_status")?.value,"해지");
  assert.ok(!p.facts?.some(x=>x.key==="bank_account.balance"));
});

test("bank transaction rows miscategorized as debt stay as flagged source facts and never become typed debts",()=>{
  const r=read([{category:"debt",label:"synthetic transaction-like row",fields:[
    field("creditor","Synthetic Counterparty",{quote:"counterparty Synthetic Counterparty"}),
    field("principal","1234",{unit:"원",quote:"transaction amount 1234원"}),
    field("interest","0",{unit:"원",quote:"balance 0원"}),
  ]}]);r.documentType="bank_transactions";
  const p=projectPage(r,"synthetic-bank-page",1,hash);
  assert.equal(p.debts?.length,0);assert.ok(p.warnings?.some(w=>w.includes("typed 현재채무 생성은 보류")));
  const facts=p.facts??[];assert.equal(facts.length,3);assert.ok(facts.every(f=>f.validation?.some(v=>v.code==="DOCUMENT_CATEGORY_MISMATCH"&&v.severity==="error")));
});


test("임대차 금액을 other 소득으로 분류해도 신청인 임대인 근거 없이는 수입을 만들지 않는다",()=>{
  for(const kind of ["rent","other","business",null]){
    const r:PageRead={documentType:"lease",complete:true,warnings:[],records:[{category:"income",label:"임대차 금액",fields:[field("kind",kind),field("gross","750000"),field("monthly_rent","750000")]}]};
    const projected=projectPage(r,"synthetic-doc",1,hash);
    assert.equal(projected.incomes?.length,0);
    assert.ok(projected.facts?.some(f=>f.key==="lease.monthly_rent"));
    assert.ok(projected.warnings?.some(w=>w.includes("임대인")));
  }
  const r:PageRead={documentType:"lease",complete:true,warnings:[],records:[{category:"income",label:"신청인 임대수입",fields:[field("kind","rent"),field("gross","750000"),field("applicant_is_landlord","yes",{quote:"신청인은 이 계약의 임대인입니다."})]}]};
  assert.equal(projectPage(r,"synthetic-doc",1,hash).incomes?.length,1);
});
